"""
Counsellor Discussion tab (GL-15): the 27 internal fields, autosaved one or
more at a time. Shared fields (#4, #5) live on the student profile (#29, #30),
so both screens show one value. A parent answer that hides a child clears the
child on save; the History tab keeps the old value.
"""
import re
from datetime import datetime, time, timedelta

from django.db import transaction
from django.utils import timezone

from apps.tasks.models import Task
from common.exceptions import ApiError

from .activity import log_activity
from .discussion_fields import DISCUSSION_FIELDS, completion_percent, is_shown
from .history import record_changes
from .models import LeadDiscussion, LeadProfile

NAME_RE = re.compile(r"^[A-Za-z][A-Za-z .']*$")


def _shared_values(profile: LeadProfile | None) -> dict:
    work = (profile.work if profile else None) or {}
    out = {}
    for key, meta in DISCUSSION_FIELDS.items():
        shared = meta.get('shared')
        if not shared:
            continue
        _, field, value_map = shared
        value = work.get(field)
        if value_map:
            reverse = {v: k for k, v in value_map.items()}
            value = reverse.get(value)
        if value not in (None, ''):
            out[key] = value
    return out


def current_data(lead_id: str) -> tuple[LeadDiscussion | None, LeadProfile | None, dict]:
    discussion = LeadDiscussion.objects.filter(lead_id=lead_id).first()
    profile = LeadProfile.objects.filter(lead_id=lead_id).first()
    data = {k: v for k, v in ((discussion.data if discussion else None) or {}).items()
            if not DISCUSSION_FIELDS.get(k, {}).get('shared')}
    data.update(_shared_values(profile))
    return discussion, profile, data


def field_meta() -> list[dict]:
    out = []
    for key, m in DISCUSSION_FIELDS.items():
        out.append({
            'key': key, 'no': m['no'], 'label': m['label'], 'type': m['type'], 'options': m.get('options'),
            'max': m.get('max'), 'min': m.get('min'), 'integer': m.get('integer', False),
            'showIf': {'field': m['show_if'][0], 'value': m['show_if'][1]} if m.get('show_if') else None,
            'requiredIfShown': m.get('required_if_shown', False), 'sharedWithProfile': bool(m.get('shared')),
        })
    return out


def _missing(data: dict) -> list[str]:
    return [k for k, m in DISCUSSION_FIELDS.items()
            if m.get('required_if_shown') and is_shown(k, data) and not (data.get(k) or '').strip()]


def present(lead_id: str) -> dict:
    discussion, _, data = current_data(lead_id)
    return {
        'lead': lead_id, 'fields': field_meta(), 'data': data, 'completionPercent': completion_percent(data),
        'missing': _missing(data), 'updatedAt': discussion.updated_at if discussion else None,
    }


def _clean_value(key: str, value):
    m = DISCUSSION_FIELDS[key]
    if value in (None, '') or value == {}:
        return None
    kind = m['type']
    if kind == 'choice':
        if value not in m['options']:
            raise ApiError.bad_request('Validation failed', {key: f"Choose one of: {', '.join(m['options'])}"})
        return value
    if kind in ('text', 'textarea'):
        text = str(value).strip()
        if len(text) > m['max']:
            raise ApiError.bad_request('Validation failed', {key: f"Max {m['max']} characters"})
        return text or None
    if kind == 'number':
        try:
            number = float(value)
        except (TypeError, ValueError):
            raise ApiError.bad_request('Validation failed', {key: 'Enter a number'})
        if m.get('integer') and not number.is_integer():
            raise ApiError.bad_request('Validation failed', {key: 'Enter a whole number'})
        if number < m.get('min', 0) or number > m.get('max', 10**12):
            raise ApiError.bad_request('Validation failed', {key: f"Must be between {m.get('min', 0)} and {m['max']}"})
        return int(number) if number.is_integer() else number
    if kind == 'name_relation':
        if not isinstance(value, dict):
            raise ApiError.bad_request('Validation failed', {key: 'Send {name, relation}'})
        name = str(value.get('name') or '').strip()
        relation = value.get('relation') or None
        if name and (len(name) > 60 or not NAME_RE.match(name)):
            raise ApiError.bad_request('Validation failed', {f'{key}.name': 'Letters and spaces only, max 60'})
        if relation and relation not in m['options']:
            raise ApiError.bad_request('Validation failed', {f'{key}.relation': f"Choose one of: {', '.join(m['options'])}"})
        return {'name': name or None, 'relation': relation} if (name or relation) else None
    return value


def _next_working_morning():
    day = timezone.localdate() + timedelta(days=1)
    while day.weekday() == 6:  # Sunday off
        day += timedelta(days=1)
    return timezone.make_aware(datetime.combine(day, time(11, 0)), timezone.get_current_timezone())


def save(actor, lead_id: str, changes: dict) -> dict:
    from .services import find_lead_for_actor

    lead = find_lead_for_actor(actor, lead_id)
    unknown = [k for k in changes if k not in DISCUSSION_FIELDS]
    if unknown:
        raise ApiError.bad_request('Validation failed', {unknown[0]: 'Unknown field'})
    clean = {k: _clean_value(k, v) for k, v in changes.items()}

    with transaction.atomic():
        discussion, profile, before = current_data(lead_id)
        after = {**before, **clean}
        after = {k: v for k, v in after.items() if v is not None}
        # hidden children are cleared (repeat: a cleared child can hide its own children)
        for _ in range(3):
            after = {k: v for k, v in after.items() if is_shown(k, after)}
        if after.get('familySize') is not None and after.get('earningMembers') is not None \
                and after['earningMembers'] > after['familySize']:
            raise ApiError.bad_request('Validation failed', {'earningMembers': 'Cannot be more than Family Size'})

        own = {k: v for k, v in after.items() if not DISCUSSION_FIELDS[k].get('shared')}
        discussion = discussion or LeadDiscussion(lead_id=lead_id)
        discussion.data = own
        discussion.completion_percent = completion_percent(after)
        discussion.updated_by_id = actor.id
        discussion.save()

        # shared fields → the student profile's work section
        work = dict((profile.work if profile else None) or {})
        work_before = dict(work)
        for key, m in DISCUSSION_FIELDS.items():
            if not m.get('shared'):
                continue
            _, field, value_map = m['shared']
            value = after.get(key)
            work[field] = value_map.get(value, value) if (value_map and value is not None) else value
            if work[field] is None:
                work.pop(field, None)
        if work.get('employmentStatus') != 'Experienced':
            for hidden in ('organization', 'designation', 'functionalArea', 'experienceYears', 'experienceMonths'):
                work.pop(hidden, None)
        if work != work_before:
            profile = profile or LeadProfile(lead_id=lead_id)
            profile.work = work or None
            profile.updated_by_id = actor.id
            profile.save()
            from .profile import refresh_completion

            refresh_completion(lead_id)

    keys = [k for k in DISCUSSION_FIELDS if before.get(k) != after.get(k)]
    record_changes(lead_id, 'discussion', [(k, DISCUSSION_FIELDS[k]['label'], before.get(k), after.get(k)) for k in keys],
                   actor, title=f"Counsellor discussion updated ({len(keys)} field{'s' if len(keys) != 1 else ''})")

    # #15 Yes → follow-up "Expert one-on-one"
    if after.get('expertDiscussion') == 'Yes' and before.get('expertDiscussion') != 'Yes' \
            and not Task.objects.filter(lead_id=lead_id, type='expert_one_on_one', status='open').exists():
        due = _next_working_morning()
        task = Task.objects.create(lead_id=lead_id, type='expert_one_on_one', due_at=due,
                                   assignee_id=lead.owner_id or actor.id, created_by_id=actor.id,
                                   notes='Candidate asked for a one-on-one with an expert')
        log_activity(lead_id, 'task', f"Follow-up scheduled: Expert one-on-one · due {timezone.localtime(due):%d %b %Y, %I:%M %p}",
                     actor_id=actor.id, actor_name=actor.name, data={'taskId': task.id})
    return {**present(lead_id), 'changed': keys}
