"""
Lead list filtering (Go-live GL-34): the simple query params the list always
had, one-click smart filters, and an advanced `filters` JSON of
{field, op, value} conditions on any lead, profile or counsellor field.
"""
import json
import re
from datetime import datetime, time, timedelta

from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date

from common.exceptions import ApiError

from .discussion_fields import DISCUSSION_FIELDS
from .profile_constants import PROFILE_FILTER_FIELDS

# field key → (ORM path, type). Types: fk, text, choice, date, number, bool
LEAD_FIELDS = {
    'stage': ('stage_id', 'fk'),
    'subStage': ('sub_stage_id', 'fk'),
    'owner': ('owner_id', 'fk'),
    'source': ('source_id', 'fk'),
    'firstSource': ('first_source_id', 'fk'),
    'program': ('program_interest_id', 'fk'),
    'cohort': ('cohort_id', 'fk'),
    'tag': ('tags__id', 'fk'),
    'status': ('status', 'choice'),
    'track': ('track', 'choice'),
    'createdVia': ('created_via', 'choice'),
    'city': ('city', 'text'),
    'state': ('state', 'text'),
    'firstName': ('first_name', 'text'),
    'lastName': ('last_name', 'text'),
    'email': ('email', 'text'),
    'mobile': ('mobile', 'text'),
    'leadNo': ('lead_no', 'text'),
    'metaCampaign': ('meta__campaignName', 'text'),
    'metaAdset': ('meta__adsetName', 'text'),
    'metaAd': ('meta__adName', 'text'),
    'metaForm': ('meta_form_id', 'text'),
    'uploadFile': ('upload_file_name', 'text'),
    'createdAt': ('created_at', 'date'),
    'lastActivityAt': ('last_activity_at', 'date'),
    'nextFollowUpAt': ('next_follow_up_at', 'date'),
    'assignedAt': ('assigned_at', 'date'),
    'reEnquiryCount': ('re_enquiry_count', 'number'),
    'profileCompletion': ('profile__completion_percent', 'number'),
    'customFieldsCompletion': ('discussion__completion_percent', 'number'),
    'optedOutSms': ('consent__sms', 'optout'),
    'optedOutEmail': ('consent__email', 'optout'),
}

OPS = {'is', 'is_not', 'any_of', 'none_of', 'contains', 'empty', 'not_empty', 'before', 'after', 'between',
       'today', 'yesterday', 'last_7_days', 'this_month', 'gte', 'lte', 'eq'}

SMART_FILTERS = {
    'new_today': 'Created today',
    'untouched': 'Stage = Untouched',
    'followups_today': 'Next follow-up is today',
    'overdue': 'Follow-up due time passed, still open',
    'interested': 'Stage = Interested',
    'no_activity_3d': 'Open stage, last activity more than 3 days ago',
    're_enquired': 'Re-enquired in last 7 days',
    'unassigned': 'No owner (Admin)',
    'owner_inactive': 'Owner is deactivated (Admin)',
}


def field_registry() -> dict[str, tuple[str, str]]:
    fields = dict(LEAD_FIELDS)
    for key, meta in DISCUSSION_FIELDS.items():
        if meta['type'] in ('choice', 'number', 'text'):
            fields[f'cf.{key}'] = (f'discussion__data__{key}', meta['type'])
    for key, (path, type_) in PROFILE_FILTER_FIELDS.items():
        fields[f'pf.{key}'] = (f'profile__{path}', type_)
    return fields


def _day_range(day):
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(day, time.min), tz)
    return start, start + timedelta(days=1)


def _parse_day(value):
    try:
        return parse_date(str(value)[:10]) if value else None
    except ValueError:
        return None


def _condition(path: str, type_: str, op: str, value) -> Q:
    if op not in OPS:
        raise ApiError.bad_request('Validation failed', {'filters': f'Unknown operator "{op}"'})
    if op == 'empty':
        return Q(**{f'{path}__isnull': True}) | Q(**{path: ''}) if type_ in ('text', 'choice') else Q(**{f'{path}__isnull': True})
    if op == 'not_empty':
        return ~_condition(path, type_, 'empty', None)
    if type_ == 'optout':  # consent flag false = opted out
        opted = op in ('is', 'eq') and str(value).lower() in ('true', 'yes', '1')
        return Q(**{path: False}) if opted else ~Q(**{path: False})
    if type_ == 'date':
        today = timezone.localdate()
        if op == 'today':
            start, end = _day_range(today)
        elif op == 'yesterday':
            start, end = _day_range(today - timedelta(days=1))
        elif op == 'last_7_days':
            start, end = _day_range(today - timedelta(days=6))[0], _day_range(today)[1]
        elif op == 'this_month':
            start, end = _day_range(today.replace(day=1))[0], _day_range(today)[1]
        elif op == 'before':
            return Q(**{f'{path}__lt': _day_range(_require_day(value))[0]})
        elif op == 'after':
            return Q(**{f'{path}__gte': _day_range(_require_day(value))[1]})
        elif op == 'between':
            low, high = (value or [None, None]) if isinstance(value, list) else (None, None)
            start, end = _day_range(_require_day(low))[0], _day_range(_require_day(high))[1]
        else:
            day = _require_day(value)
            start, end = _day_range(day)
            return Q(**{f'{path}__gte': start, f'{path}__lt': end}) if op in ('is', 'eq') else ~Q(**{f'{path}__gte': start, f'{path}__lt': end})
        return Q(**{f'{path}__gte': start, f'{path}__lt': end})
    if type_ == 'bool':
        flag = str(value).lower() in ('true', 'yes', '1')
        return Q(**{path: flag}) if op in ('is', 'eq') else ~Q(**{path: flag})
    if type_ == 'number':
        if op == 'between':
            low, high = value if isinstance(value, list) and len(value) == 2 else (None, None)
            return Q(**{f'{path}__gte': _num(low), f'{path}__lte': _num(high)})
        lookup = {'gte': 'gte', 'lte': 'lte', 'after': 'gt', 'before': 'lt'}.get(op)
        if lookup:
            return Q(**{f'{path}__{lookup}': _num(value)})
        if op in ('is', 'eq'):
            return Q(**{path: _num(value)})
        if op == 'is_not':
            return ~Q(**{path: _num(value)})
    if op in ('any_of', 'none_of'):
        values = value if isinstance(value, list) else [v for v in str(value or '').split(',') if v]
        q = Q(**{f'{path}__in': values})
        return q if op == 'any_of' else ~q
    if op == 'contains':
        return Q(**{f'{path}__icontains': str(value or '')})
    if op in ('is', 'eq'):
        return Q(**{f'{path}__iexact': value}) if type_ == 'text' else Q(**{path: value})
    if op == 'is_not':
        return ~(Q(**{f'{path}__iexact': value}) if type_ == 'text' else Q(**{path: value}))
    raise ApiError.bad_request('Validation failed', {'filters': f'Operator "{op}" does not apply to this field'})


def _require_day(value):
    day = _parse_day(value)
    if not day:
        raise ApiError.bad_request('Validation failed', {'filters': 'Enter dates as YYYY-MM-DD'})
    return day


def _num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        raise ApiError.bad_request('Validation failed', {'filters': 'Enter a number'})


def advanced_q(raw) -> Q:
    """`filters` = JSON list of {field, op, value}; all conditions must match (AND)."""
    try:
        conditions = json.loads(raw) if isinstance(raw, str) else (raw or [])
    except ValueError:
        raise ApiError.bad_request('Validation failed', {'filters': 'filters must be valid JSON'})
    registry = field_registry()
    q = Q()
    for cond in conditions:
        field = cond.get('field')
        if field not in registry:
            raise ApiError.bad_request('Validation failed', {'filters': f'Unknown filter field "{field}"'})
        path, type_ = registry[field]
        q &= _condition(path, type_, cond.get('op', 'is'), cond.get('value'))
    return q


def smart_q(key: str, actor) -> Q:
    from apps.tasks.models import Task  # noqa: F401  (documented dependency: overdue uses open follow-ups)

    now = timezone.now()
    start, end = _day_range(timezone.localdate())
    if key == 'new_today':
        return Q(created_at__gte=start, created_at__lt=end)
    if key == 'untouched':
        return Q(stage__name='Untouched')
    if key == 'followups_today':
        return Q(next_follow_up_at__gte=start, next_follow_up_at__lt=end)
    if key == 'overdue':
        return Q(tasks__status='open', tasks__due_at__lt=now)
    if key == 'interested':
        return Q(stage__name='Interested')
    if key == 'no_activity_3d':
        return Q(status='active', last_activity_at__lt=now - timedelta(days=3))
    if key == 're_enquired':
        return Q(re_enquiry_count__gt=0, last_enquired_at__gte=now - timedelta(days=7))
    if key == 'unassigned':
        return Q(owner__isnull=True)
    if key == 'owner_inactive':
        return Q(owner__is_active=False)
    raise ApiError.bad_request('Validation failed', {'smart': f'Unknown smart filter "{key}"'})


def apply_filters(qs, params, actor, search: str | None = None):
    """Search + simple params + smart filter + advanced conditions."""
    if search:
        condition = (
            Q(first_name__icontains=search) | Q(last_name__icontains=search)
            | Q(email__icontains=search) | Q(lead_no__icontains=search)
        )
        parts = search.split()
        if len(parts) >= 2:
            condition |= Q(first_name__icontains=parts[0], last_name__icontains=' '.join(parts[1:]))
        digits = re.sub(r'\D', '', search)
        if len(digits) >= 4:
            condition |= Q(mobile__contains=digits[-10:])
        qs = qs.filter(condition)

    get = params.get
    simple = {
        'stage': 'stage_id', 'sub_stage': 'sub_stage_id', 'source': 'source_id', 'first_source': 'first_source_id',
        'owner': 'owner_id', 'program': 'program_interest_id', 'cohort': 'cohort_id', 'tag': 'tags__id',
        'status': 'status', 'track': 'track', 'meta_form': 'meta_form_id', 'upload_file': 'upload_file_name',
        'created_via': 'created_via',
    }
    for param, path in simple.items():
        if get(param):
            qs = qs.filter(**{path: get(param)})
    for param, path in (('city', 'city'), ('state', 'state'), ('meta_campaign', 'meta__campaignName')):
        if get(param):
            qs = qs.filter(**{f'{path}__icontains': get(param)})
    if get('unassigned') == 'true':
        qs = qs.filter(owner__isnull=True)
    if get('owner_inactive') == 'true':
        qs = qs.filter(owner__is_active=False)
    if get('opted_out') in ('sms', 'email'):
        qs = qs.filter(**{f"consent__{get('opted_out')}": False})
    if get('re_enquired') == 'true':
        qs = qs.filter(re_enquiry_count__gt=0)
    for prefix, path in (('created', 'created_at'), ('last_activity', 'last_activity_at'), ('next_follow_up', 'next_follow_up_at')):
        low, high = _parse_day(get(f'{prefix}_from')), _parse_day(get(f'{prefix}_to'))
        if low:
            qs = qs.filter(**{f'{path}__gte': _day_range(low)[0]})
        if high:
            qs = qs.filter(**{f'{path}__lt': _day_range(high)[1]})
    if get('smart'):
        qs = qs.filter(smart_q(get('smart'), actor))
    if get('filters'):
        qs = qs.filter(advanced_q(get('filters')))
    return qs.distinct()
