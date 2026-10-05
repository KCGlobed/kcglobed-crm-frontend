import json
import logging

from common.renderers import ApiEncoder

from .models import AuditLog

logger = logging.getLogger('crm')


def _json_safe(value):
    if value is None:
        return None
    return json.loads(json.dumps(value, cls=ApiEncoder))


def client_ip(request) -> str | None:
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def audit(request, action: str, module: str, entity_type: str | None = None, entity_id: str | None = None,
          before=None, after=None, actor: dict | None = None) -> None:
    """
    Audit write — an audit failure must never fail the request.
    `actor` ({id, name}) overrides the signed-in user, e.g. on login.
    """
    user = getattr(request, 'user', None)
    actor_id = actor['id'] if actor else getattr(user, 'id', None)
    actor_name = actor['name'] if actor else getattr(user, 'name', None)
    try:
        AuditLog.objects.create(
            actor_id=actor_id,
            actor_name=actor_name or 'system',
            action=action,
            module=module,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            before=_json_safe(before),
            after=_json_safe(after),
            ip=client_ip(request),
            user_agent=(request.META.get('HTTP_USER_AGENT') or '')[:500] or None,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error('Audit write failed: %s', exc)
