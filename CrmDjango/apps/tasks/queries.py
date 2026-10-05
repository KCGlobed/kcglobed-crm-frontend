"""Query helpers other apps use without importing task services (avoids import cycles)."""
from django.db.models import Min, OuterRef, Subquery

from .models import Task


def with_next_follow_up(queryset):
    """Annotates leads with `next_follow_up_at`: the earliest open follow-up's due time."""
    earliest = (
        Task.objects.filter(lead=OuterRef('pk'), status='open')
        .values('lead')
        .annotate(first=Min('due_at'))
        .values('first')
    )
    return queryset.annotate(next_follow_up_at=Subquery(earliest))


def move_open_tasks(lead_id: str, from_user_id: str | None, to_user_id: str) -> int:
    """Reassigning a lead moves its open follow-ups to the new owner (Deep Dive LM-31)."""
    if not from_user_id or from_user_id == to_user_id:
        return 0
    return Task.objects.filter(lead_id=lead_id, status='open', assignee_id=from_user_id).update(
        assignee_id=to_user_id, reminder_sent_at=None, overdue_notified_at=None, escalated_at=None
    )
