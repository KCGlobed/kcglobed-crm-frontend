"""
Data scope (SOW permission builder step 5) → which lead owners a user may see.

own  → records they own
team → records owned by anyone in their team, teams they manage, every team
       below those at any depth, or their direct reports
all  → no restriction
location/program/cohort → resolved as "team" until those scopes get their own data.
"""
from django.db.models import Q


def visible_owner_ids(principal) -> set[str] | None:
    """None means "everything"; otherwise the owner ids the caller may see."""
    from apps.teams.services import descendant_ids
    from apps.teams.models import Team
    from apps.users.models import User

    if principal.is_super_admin or principal.data_scope == 'all':
        return None
    if principal.data_scope == 'own':
        return {principal.id}

    base = set(Team.objects.filter(manager_id=principal.id).values_list('id', flat=True))
    if principal.team:
        base.add(principal.team)
    team_ids = base | descendant_ids(base)

    members = User.objects.filter(Q(team_id__in=team_ids) | Q(reporting_manager_id=principal.id))
    owner_ids = set(members.values_list('id', flat=True))
    owner_ids.add(principal.id)
    return owner_ids


def lead_scope_q(principal, field: str = 'owner_id') -> Q:
    """
    Lead filter for the caller. Scoped users also see unassigned leads so new
    arrivals are not invisible to the team that must pick them up; own scope
    stays strictly own.
    """
    owners = visible_owner_ids(principal)
    if owners is None:
        return Q()
    if principal.data_scope == 'own':
        return Q(**{f'{field}__in': owners})
    return Q(**{f'{field}__in': owners}) | Q(**{f'{field}__isnull': True})
