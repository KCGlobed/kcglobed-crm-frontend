"""
Round-robin (Go-live GL-12).

Eligible counsellor = role Admission Counsellor + Active + a live login session
(+ not opted out of distribution, + not in a paused/inactive team). They are
ordered by when they joined the rotation (their login), so A → B → C → A, and
someone who logs in again rejoins at the end. The pointer is stored in the
database and claimed inside a transaction, so concurrent leads never share a slot.
"""
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.authentication.services import live_user_ids
from apps.teams.models import Team
from apps.users.models import User
from common.roles import COUNSELLOR

from .models import RoundRobinState


def eligible_counsellors() -> list[User]:
    paused = Team.objects.filter(Q(receives_leads=False) | Q(is_active=False)).values_list('id', flat=True)
    online = live_user_ids()
    users = (
        User.objects.filter(role=COUNSELLOR, is_active=True, receives_leads=True, pk__in=online)
        .exclude(team_id__in=list(paused))
    )
    return sorted(users, key=_position)


def _position(user: User) -> str:
    joined = user.rr_joined_at or user.created_at or timezone.now()
    return f'{joined.isoformat()}|{user.id}'


def _take(count: int) -> list[str]:
    pool = eligible_counsellors()
    if not pool or count <= 0:
        return []
    with transaction.atomic():
        state, _ = RoundRobinState.objects.select_for_update().get_or_create(key='leads')
        positions = [_position(u) for u in pool]
        # next after the last slot handed out; wraps to the start of the order
        start = next((i for i, pos in enumerate(positions) if pos > (state.last_position or '')), 0)
        owners = [pool[(start + i) % len(pool)] for i in range(count)]
        state.last_user = owners[-1]
        state.last_position = _position(owners[-1])
        state.save(update_fields=['last_user', 'last_position'])
    return [u.id for u in owners]


def pick_next_owner() -> str | None:
    taken = _take(1)
    return taken[0] if taken else None


def assign_batch(count: int) -> list[str | None]:
    """Owners for `count` new leads in rotation order (bulk import with auto-assign)."""
    taken = _take(count)
    return taken if taken else [None] * count


def distribute_pool(limit: int = 500) -> int:
    """
    Pooled live leads (Meta / capture that arrived with nobody online) go out
    round-robin, oldest first, once counsellors are logged in.
    """
    from .models import Lead
    from .services import assign_owner

    pooled = list(
        Lead.objects.filter(owner__isnull=True, is_deleted=False, status='active', created_via__in=['meta', 'google', 'capture'])
        .order_by('created_at')[:limit]
    )
    if not pooled:
        return 0
    owners = _take(len(pooled))
    for lead, owner_id in zip(pooled, owners):
        assign_owner(lead, owner_id, by_label='Round-robin')
    return len(owners)
