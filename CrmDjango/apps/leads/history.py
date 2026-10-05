"""
Field-change history (Go-live GL-27) and the matching "Field change" timeline
entry (GL-26). The History tab is Admin-only, so it keeps real values; the
timeline is visible to counsellors, so contact values are summarised there.
"""
import json

from common.renderers import ApiEncoder

from .activity import log_activity
from .models import FieldChange

PRIVATE_FIELDS = {'email', 'mobile', 'altMobile', 'personal.email', 'personal.mobile', 'guardian.mobile', 'guardian.email'}


def display(value) -> str | None:
    if value is None or value == '' or value == [] or value == {}:
        return None
    if isinstance(value, bool):
        return 'Yes' if value else 'No'
    if isinstance(value, (dict, list)):
        return json.dumps(value, cls=ApiEncoder, ensure_ascii=False)
    return str(value)


def record_changes(lead_id: str, section: str, changes: list[tuple[str, str, object, object]], actor=None,
                   *, actor_name: str | None = None, timeline: bool = True, title: str | None = None) -> int:
    """
    `changes` = [(field key, label, old, new)]. Unchanged pairs are ignored.
    Writes History rows and (optionally) one timeline entry summarising them.
    """
    rows, lines = [], []
    who = actor_name or (actor.name if actor else 'System')
    for field, label, old, new in changes:
        old_text, new_text = display(old), display(new)
        if old_text == new_text:
            continue
        rows.append(FieldChange(
            lead_id=lead_id, section=section, field=field, label=label,
            old_value=old_text, new_value=new_text,
            changed_by_id=getattr(actor, 'id', None), changed_by_name=who,
        ))
        if field in PRIVATE_FIELDS:
            lines.append(f'{label} updated')
        else:
            lines.append(f"{label}: {_short(old_text) or '—'} → {_short(new_text) or '—'}")
    if not rows:
        return 0
    FieldChange.objects.bulk_create(rows)
    if timeline:
        labels = ', '.join(r.label for r in rows[:6]) + (f' +{len(rows) - 6} more' if len(rows) > 6 else '')
        log_activity(
            lead_id, 'edit', title or f'{_section_label(section)} updated ({labels})',
            description='\n'.join(lines), actor_id=getattr(actor, 'id', None), actor_name=who,
            data={'section': section, 'fields': [r.field for r in rows]},
        )
    return len(rows)


def _short(text: str | None, limit: int = 120) -> str | None:
    if text is None:
        return None
    return text if len(text) <= limit else text[: limit - 1] + '…'


def _section_label(section: str) -> str:
    return {'lead': 'Lead', 'profile': 'Student profile', 'discussion': 'Counsellor discussion', 'system': 'Lead'}.get(section, 'Lead')


def history_doc(change: FieldChange) -> dict:
    return {
        '_id': change.id,
        'section': change.section,
        'field': change.field,
        'label': change.label,
        'oldValue': change.old_value,
        'newValue': change.new_value,
        'changedBy': ({'_id': change.changed_by_id, 'name': change.changed_by_name}
                      if change.changed_by_id else {'_id': None, 'name': change.changed_by_name or 'System'}),
        'createdAt': change.created_at,
    }
