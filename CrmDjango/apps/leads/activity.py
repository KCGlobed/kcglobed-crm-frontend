import logging

from django.utils import timezone

from .models import Lead, LeadActivity

logger = logging.getLogger('crm')


def log_activity(lead_id: str, type_: str, title: str, *, description: str | None = None, data: dict | None = None,
                 actor_id: str | None = None, actor_name: str | None = None, actor_type: str | None = None) -> None:
    """Appends to the lead timeline and bumps lastActivityAt. Never raises."""
    try:
        LeadActivity.objects.create(
            lead_id=lead_id,
            type=type_,
            title=title,
            description=description,
            data=data,
            actor_id=actor_id,
            actor_type='user' if actor_id else (actor_type or 'system'),
            actor_name=actor_name,
        )
        Lead.objects.filter(pk=lead_id).update(last_activity_at=timezone.now())
    except Exception as exc:  # noqa: BLE001
        logger.error('Activity write failed for lead %s: %s', lead_id, exc)
