from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

from apps.masters.models import Program
from apps.notifications.services import notify
from apps.users.models import User
from common.exceptions import ApiError
from common.models import compact, ref
from common.pagination import ListQuery

from .models import Team

# API field → model attribute
TEAM_FIELDS = {
    'name': 'name', 'code': 'code', 'type': 'type', 'description': 'description', 'manager': 'manager_id',
    'parent': 'parent_id', 'location': 'location', 'receivesLeads': 'receives_leads', 'isActive': 'is_active',
}
SORT_FIELDS = {'createdAt': 'created_at', 'updatedAt': 'updated_at'}

# ---------------------------------------------------------------- hierarchy


def descendant_ids(root_ids) -> set[str]:
    """Every team below the given roots, at any depth (roots excluded)."""
    found: set[str] = set()
    frontier = set(root_ids)
    while frontier:
        children = set(Team.objects.filter(parent_id__in=frontier).values_list('id', flat=True)) - found - set(root_ids)
        found |= children
        frontier = children
    return found


def ancestors(team: Team) -> list[dict]:
    """Parent chain from the top-level team down to the direct parent."""
    chain, seen = [], {team.id}
    current = team.parent
    while current and current.id not in seen:
        seen.add(current.id)
        chain.append(compact({'_id': current.id, 'name': current.name, 'code': current.code, 'type': current.type}))
        current = current.parent
    return list(reversed(chain))


def _member_counts(team_ids) -> dict[str, dict]:
    rows = (
        User.objects.filter(team_id__in=team_ids)
        .values('team_id')
        .annotate(total=Count('id'), active=Count('id', filter=Q(is_active=True)))
    )
    return {r['team_id']: r for r in rows}


def _sub_team_counts(team_ids) -> dict[str, int]:
    rows = Team.objects.filter(parent_id__in=team_ids, is_active=True).values('parent_id').annotate(count=Count('id'))
    return {r['parent_id']: r['count'] for r in rows}


def team_doc(team: Team) -> dict:
    """The stored team as returned by create/update/deactivate."""
    return compact({
        '_id': team.id, 'name': team.name, 'code': team.code, 'type': team.type, 'description': team.description,
        'manager': team.manager_id, 'parent': team.parent_id, 'location': team.location,
        'programs': list(team.programs.values_list('id', flat=True)),
        'receivesLeads': team.receives_leads, 'isActive': team.is_active, 'createdBy': team.created_by_id,
        'createdAt': team.created_at, 'updatedAt': team.updated_at,
    })


# ---------------------------------------------------------------- validation


def _normalise(payload: dict) -> dict:
    """Blank optional strings from forms arrive as '' — store them as unset."""
    out = dict(payload)
    for key in ('code', 'description', 'location', 'manager', 'parent'):
        if out.get(key) == '':
            out[key] = None
    if isinstance(out.get('code'), str):
        out['code'] = out['code'].strip().upper()
    if isinstance(out.get('name'), str):
        out['name'] = out['name'].strip()
    return out


def _assert_unique(payload: dict, exclude_id: str | None = None) -> None:
    others = Team.objects.exclude(pk=exclude_id) if exclude_id else Team.objects.all()
    if payload.get('name') and others.filter(name__iexact=payload['name']).exists():
        raise ApiError.conflict('A team with this name already exists', {'name': 'A team with this name already exists'})
    if payload.get('code') and others.filter(code=payload['code']).exists():
        raise ApiError.conflict('This team code is already in use', {'code': 'This team code is already in use'})


def _assert_relations(payload: dict, team_id: str | None = None) -> None:
    parent_id = payload.get('parent')
    if parent_id:
        if team_id and parent_id == team_id:
            raise ApiError.bad_request('A team cannot be its own parent', {'parent': 'A team cannot be its own parent'})
        parent = Team.objects.filter(pk=parent_id).first()
        if not parent:
            raise ApiError.bad_request('Parent team not found', {'parent': 'Parent team not found'})
        if not parent.is_active:
            raise ApiError.unprocessable('The parent team is inactive', {'parent': 'Pick an active parent team'})
        if team_id and parent_id in descendant_ids([team_id]):
            raise ApiError.unprocessable(
                'A team cannot report into one of its own sub-teams',
                {'parent': 'This team is above the selected parent — pick another'},
            )
    if payload.get('manager'):
        if not User.objects.filter(pk=payload['manager'], is_active=True).exists():
            raise ApiError.bad_request('Manager must be an active user', {'manager': 'Manager must be an active user'})
    if payload.get('programs'):
        unique = list(dict.fromkeys(payload['programs']))
        if Program.objects.filter(pk__in=unique).count() != len(unique):
            raise ApiError.bad_request('One or more programs were not found', {'programs': 'One or more programs were not found'})
        payload['programs'] = unique


def _assert_can_deactivate(team_id: str) -> None:
    """A team can only be switched off once nobody active is left in or under it."""
    active_members = User.objects.filter(team_id=team_id, is_active=True).count()
    active_sub_teams = Team.objects.filter(parent_id=team_id, is_active=True).count()
    if active_members:
        raise ApiError.unprocessable(
            f'This team still has {active_members} active member(s). Move them to another team first.'
        )
    if active_sub_teams:
        raise ApiError.unprocessable(
            f'This team still has {active_sub_teams} active sub-team(s). Move or deactivate them first.'
        )


def _apply(team: Team, payload: dict) -> None:
    for key, attr in TEAM_FIELDS.items():
        if key in payload:
            setattr(team, attr, payload[key])


# ---------------------------------------------------------------------- CRUD


def list_teams(query: ListQuery, params) -> tuple[list[dict], int]:
    qs = Team.objects.select_related('manager', 'parent').prefetch_related('programs')
    if query.search:
        s = query.search
        qs = qs.filter(Q(name__icontains=s) | Q(code__icontains=s) | Q(location__icontains=s))
    if params.get('is_active') == 'true':
        qs = qs.filter(is_active=True)
    if params.get('is_active') == 'false':
        qs = qs.filter(is_active=False)
    if params.get('type'):
        qs = qs.filter(type=params['type'])
    parent = params.get('parent')
    if parent == 'root':
        qs = qs.filter(parent__isnull=True)
    elif parent:
        qs = qs.filter(parent_id=parent)
    if params.get('manager'):
        qs = qs.filter(manager_id=params['manager'])
    if params.get('location'):
        qs = qs.filter(location__icontains=params['location'])

    total = qs.count()
    teams = list(query.slice(qs.order_by(*query.order(SORT_FIELDS))))
    ids = [t.id for t in teams]
    members, subs = _member_counts(ids), _sub_team_counts(ids)
    items = [
        compact({
            '_id': t.id, 'name': t.name, 'code': t.code, 'type': t.type, 'description': t.description,
            'manager': ref(t.manager, 'name', 'email'), 'parent': ref(t.parent, 'name', 'code'),
            'location': t.location, 'programs': [ref(p, 'name', 'code') for p in t.programs.all()],
            'receivesLeads': t.receives_leads, 'isActive': t.is_active, 'createdBy': t.created_by_id,
            'createdAt': t.created_at, 'updatedAt': t.updated_at,
            'memberCount': members.get(t.id, {}).get('active', 0),
            'subTeamCount': subs.get(t.id, 0),
        })
        for t in teams
    ]
    return items, total


def team_options() -> list[dict]:
    """Lightweight active-team list for dropdowns (user form, filters)."""
    return [
        compact({'_id': t.id, 'name': t.name, 'code': t.code, 'type': t.type, 'parent': t.parent_id})
        for t in Team.objects.filter(is_active=True).order_by('name')
    ]


def team_tree(include_inactive: bool) -> list[dict]:
    """Whole org chart in one call — the hierarchy is small, so it's built in memory."""
    qs = Team.objects.select_related('manager').order_by('name')
    if not include_inactive:
        qs = qs.filter(is_active=True)
    teams = list(qs)
    members = _member_counts([t.id for t in teams])
    nodes = {
        t.id: compact({
            '_id': t.id, 'name': t.name, 'code': t.code, 'type': t.type, 'location': t.location,
            'isActive': t.is_active, 'receivesLeads': t.receives_leads, 'manager': ref(t.manager, 'name'),
            'memberCount': members.get(t.id, {}).get('active', 0), 'totalMembers': 0, 'children': [],
        })
        for t in teams
    }
    roots = []
    for t in teams:
        parent = nodes.get(t.parent_id) if t.parent_id else None
        (parent['children'] if parent else roots).append(nodes[t.id])

    def roll_up(node: dict) -> int:
        node['totalMembers'] = node['memberCount'] + sum(roll_up(c) for c in node['children'])
        return node['totalMembers']

    for root in roots:
        roll_up(root)
    return roots


def team_detail(team_id: str) -> dict:
    team = (
        Team.objects.select_related('manager', 'parent', 'created_by')
        .prefetch_related('programs')
        .filter(pk=team_id)
        .first()
    )
    if not team:
        raise ApiError.not_found('Team not found')

    children = list(Team.objects.select_related('manager').filter(parent_id=team.id).order_by('-is_active', 'name'))
    child_members = _member_counts([c.id for c in children])
    members = list(User.objects.select_related('reporting_manager').filter(team_id=team.id).order_by('-is_active', 'name'))
    return compact({
        '_id': team.id, 'name': team.name, 'code': team.code, 'type': team.type, 'description': team.description,
        'manager': ref(team.manager, 'name', 'email', 'designation', 'mobile'),
        'parent': ref(team.parent, 'name', 'code', 'type'),
        'location': team.location,
        'programs': [ref(p, 'name', 'code') for p in team.programs.all()],
        'receivesLeads': team.receives_leads, 'isActive': team.is_active,
        'createdBy': ref(team.created_by, 'name'),
        'createdAt': team.created_at, 'updatedAt': team.updated_at,
        'ancestors': ancestors(team),
        'children': [
            compact({
                '_id': c.id, 'name': c.name, 'code': c.code, 'type': c.type, 'isActive': c.is_active,
                'location': c.location, 'manager': ref(c.manager, 'name'), 'receivesLeads': c.receives_leads,
                'memberCount': child_members.get(c.id, {}).get('active', 0),
            })
            for c in children
        ],
        'members': [
            compact({
                '_id': m.id, 'name': m.name, 'email': m.email, 'mobile': m.mobile, 'designation': m.designation,
                'isActive': m.is_active, 'receivesLeads': m.receives_leads,
                'reportingManager': ref(m.reporting_manager, 'name'), 'lastLoginAt': m.last_login_at,
            })
            for m in members
        ],
        'memberCount': sum(1 for m in members if m.is_active),
    })


def create_team(raw: dict, actor_id: str) -> Team:
    payload = _normalise(raw)
    _assert_unique(payload)
    _assert_relations(payload)
    team = Team(created_by_id=actor_id)
    _apply(team, payload)
    team.save()
    if payload.get('programs'):
        team.programs.set(payload['programs'])
    return team


def update_team(team_id: str, raw: dict) -> tuple[dict, Team]:
    team = Team.objects.filter(pk=team_id).first()
    if not team:
        raise ApiError.not_found('Team not found')
    payload = _normalise(raw)
    _assert_unique(payload, team.id)
    _assert_relations(payload, team.id)

    if payload.get('isActive') is False and team.is_active:
        _assert_can_deactivate(team.id)
    if payload.get('isActive') is True and not team.is_active:
        parent_id = payload['parent'] if 'parent' in payload else team.parent_id
        if parent_id and Team.objects.filter(pk=parent_id, is_active=False).exists():
            raise ApiError.unprocessable('Reactivate the parent team first, or move this team under an active one')

    before = team_doc(team)
    _apply(team, payload)
    team.save()
    if 'programs' in payload:
        team.programs.set(payload['programs'])
    return before, team


def deactivate_team(team_id: str) -> Team:
    team = Team.objects.filter(pk=team_id).first()
    if not team:
        raise ApiError.not_found('Team not found')
    if team.is_active:
        _assert_can_deactivate(team.id)
        team.is_active = False
        team.save(update_fields=['is_active', 'updated_at'])
    return team


# ------------------------------------------------------------------- members


def add_members(team_id: str, user_ids: list[str], set_reporting_manager: bool, actor_id: str) -> dict:
    team = Team.objects.filter(pk=team_id).first()
    if not team:
        raise ApiError.not_found('Team not found')
    if not team.is_active:
        raise ApiError.unprocessable('Members cannot be added to an inactive team')

    ids = list(dict.fromkeys(user_ids))
    users = list(User.objects.filter(pk__in=ids))
    if len(users) != len(ids):
        raise ApiError.bad_request('One or more users were not found', {'userIds': 'One or more users were not found'})
    inactive = [u.name for u in users if not u.is_active]
    if inactive:
        raise ApiError.unprocessable(f'Inactive users cannot be added: {", ".join(inactive)}')

    moving = [u for u in users if u.team_id != team.id]
    if moving:
        User.objects.filter(pk__in=[u.id for u in moving]).update(team_id=team.id, updated_at=timezone.now())
    if set_reporting_manager and team.manager_id:
        # The manager can be a member of their own team but never reports to themselves.
        User.objects.filter(pk__in=[i for i in ids if i != team.manager_id]).update(
            reporting_manager_id=team.manager_id, updated_at=timezone.now()
        )
    for u in moving:
        if u.id != actor_id:
            notify(u.id, 'system', f'You were added to {team.name}', None, {'teamId': team.id})

    return {
        'added': len(moving),
        'alreadyMembers': len(users) - len(moving),
        'before': [{'user': u.id, 'previousTeam': u.team_id} for u in moving],
    }


def remove_member(team_id: str, user_id: str) -> User:
    if not Team.objects.filter(pk=team_id).exists():
        raise ApiError.not_found('Team not found')
    user = User.objects.filter(pk=user_id, team_id=team_id).first()
    if not user:
        raise ApiError.not_found('This user is not a member of the team')
    user.team_id = None
    user.save(update_fields=['team', 'updated_at'])
    return user


# --------------------------------------------------------------------- stats


def team_stats(team_id: str, include_sub_teams: bool) -> dict:
    """Lead workload per member; with include_sub_teams it rolls up everyone below too."""
    from apps.leads.models import Lead

    if not Team.objects.filter(pk=team_id).exists():
        raise ApiError.not_found('Team not found')
    team_ids = [team_id, *(descendant_ids([team_id]) if include_sub_teams else [])]
    members = list(User.objects.select_related('team').filter(team_id__in=team_ids))

    week_ago = timezone.now() - timedelta(days=7)
    rows = (
        Lead.objects.filter(owner_id__in=[m.id for m in members], is_deleted=False)
        .values('owner_id')
        .annotate(
            total=Count('id'),
            active=Count('id', filter=Q(status='active')),
            converted=Count('id', filter=Q(status='converted')),
            lost=Count('id', filter=Q(status='lost')),
            assignedThisWeek=Count('id', filter=Q(assigned_at__gte=week_ago)),
        )
    )
    by_owner = {r.pop('owner_id'): r for r in rows}
    empty = {'total': 0, 'active': 0, 'converted': 0, 'lost': 0, 'assignedThisWeek': 0}

    by_member = [
        {
            'user': compact({
                '_id': m.id, 'name': m.name, 'designation': m.designation, 'isActive': m.is_active,
                'receivesLeads': m.receives_leads, 'team': ref(m.team, 'name'),
            }),
            **by_owner.get(m.id, empty),
        }
        for m in members
    ]
    by_member.sort(key=lambda r: (-r['total'], r['user']['name']))

    totals = {k: sum(r[k] for r in by_member) for k in empty}
    closed = totals['converted'] + totals['lost']
    return {
        'includeSubTeams': include_sub_teams,
        'teamCount': len(team_ids),
        'totals': {
            **totals,
            'members': sum(1 for m in members if m.is_active),
            'receivingLeads': sum(1 for m in members if m.is_active and m.receives_leads),
            'conversionRate': round(totals['converted'] / closed * 100, 1) if closed else None,
        },
        'byMember': by_member,
    }
