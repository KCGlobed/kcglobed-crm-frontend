import logging

from .models import Notification

logger = logging.getLogger('crm')


def notify(user_id: str, type_: str, title: str, body: str | None = None, data: dict | None = None) -> None:
    """In-app notification write — must never fail the main operation."""
    try:
        Notification.objects.create(user_id=user_id, type=type_, title=title, body=body, data=data)
    except Exception as exc:  # noqa: BLE001
        logger.error('Notification write failed: %s', exc)


def admin_ids(*, include_super: bool = True, super_only: bool = False) -> list[str]:
    """Active Admins (+ Super Admins) — who gets the "Admin" alerts of GL-30."""
    from django.db.models import Q

    from apps.users.models import User
    from common.roles import ADMIN

    if super_only:
        q = Q(is_super_admin=True)
    else:
        q = Q(role=ADMIN) | Q(is_super_admin=True) if include_super else Q(role=ADMIN)
    return list(User.objects.filter(q, is_active=True).values_list('id', flat=True))


def notify_admins(type_: str, title: str, body: str | None = None, data: dict | None = None, *,
                  include_super: bool = True, super_only: bool = False) -> int:
    ids = admin_ids(include_super=include_super, super_only=super_only)
    for user_id in ids:
        notify(user_id, type_, title, body, data)
    return len(ids)
