"""
Lead list helpers (GL-31..34): filter-panel metadata, saved filters, the
global search box and the counsellor's "My Day" counters.
"""
from datetime import timedelta

from django.db import IntegrityError
from django.db.models import Q
from django.utils import timezone

from apps.masters.models import Cohort, Program, Source, Stage, Tag
from apps.users.models import User
from common.exceptions import ApiError
from common.normalize import normalize_mobile
from common.roles import COUNSELLOR

from .discussion_fields import DISCUSSION_FIELDS
from .filters import LEAD_FIELDS, OPS, SMART_FILTERS, _day_range, smart_q
from .models import SavedFilter
from .profile_constants import PROFILE_FIELD_LABELS, PROFILE_FILTER_FIELDS
from .profile_constants import EMPLOYMENT_STATUSES, GENDERS, GRADE_TYPES, INDIAN_STATES, MEDIUMS, QUALIFICATION_STATUSES
from .profile_constants import RELATIONSHIPS, UG_QUALIFICATIONS

LEAD_LABELS = {
    'stage': 'Stage', 'subStage': 'Disposition', 'owner': 'Owner', 'source': 'Latest Source', 'firstSource': 'First Source',
    'program': 'Program Interest', 'cohort': 'Cohort', 'tag': 'Tag', 'status': 'Status', 'track': 'Track',
    'createdVia': 'Created Via', 'city': 'City', 'state': 'State', 'firstName': 'First Name', 'lastName': 'Last Name',
    'email': 'Email', 'mobile': 'Mobile', 'leadNo': 'Lead ID', 'metaCampaign': 'Meta campaign', 'metaAdset': 'Meta ad set',
    'metaAd': 'Meta ad', 'metaForm': 'Meta form', 'uploadFile': 'Upload file', 'createdAt': 'Created On',
    'lastActivityAt': 'Last Activity', 'nextFollowUpAt': 'Next Follow-up', 'assignedAt': 'Assigned On',
    'reEnquiryCount': 'Re-enquiry Count', 'profileCompletion': 'Profile Completion %',
    'customFieldsCompletion': 'Custom Fields Completion %', 'optedOutSms': 'Opted out (SMS)', 'optedOutEmail': 'Opted out (Email)',
}
TYPE_OPS = {
    'fk': ['is', 'is_not', 'any_of', 'none_of', 'empty', 'not_empty'],
    'choice': ['is', 'is_not', 'any_of', 'none_of', 'empty', 'not_empty'],
    'text': ['contains', 'is', 'is_not', 'empty', 'not_empty'],
    'date': ['today', 'yesterday', 'last_7_days', 'this_month', 'before', 'after', 'between', 'is', 'empty', 'not_empty'],
    'number': ['eq', 'gte', 'lte', 'between', 'empty', 'not_empty'],
    'bool': ['is', 'empty', 'not_empty'],
    'optout': ['is'],
}
PROFILE_OPTIONS = {
    'gender': GENDERS, 'state': INDIAN_STATES, 'guardianRelationship': RELATIONSHIPS, 'class10GradeType': GRADE_TYPES,
    'class12GradeType': GRADE_TYPES, 'class10Medium': MEDIUMS, 'class12Medium': MEDIUMS, 'ugMedium': MEDIUMS,
    'ugQualification': UG_QUALIFICATIONS, 'ugStatus': QUALIFICATION_STATUSES, 'employmentStatus': EMPLOYMENT_STATUSES,
}


def _opts(items):
    return [{'value': value, 'label': label} for value, label in items]


def filter_fields(actor) -> dict:
    admin_view = actor.data_scope == 'all' or actor.is_super_admin
    fk_options = {
        'stage': _opts(Stage.objects.filter(is_active=True).order_by('order').values_list('id', 'name')),
        'owner': _opts(User.objects.filter(role=COUNSELLOR).order_by('name').values_list('id', 'name')) if admin_view else [],
        'source': _opts(Source.objects.filter(is_active=True).order_by('sort_order').values_list('id', 'name')),
        'program': _opts(Program.objects.filter(is_active=True).values_list('id', 'name')),
        'cohort': _opts(Cohort.objects.values_list('id', 'name')),
        'tag': _opts(Tag.objects.filter(is_active=True).values_list('id', 'name')),
    }
    fk_options['firstSource'] = fk_options['source']
    choice_options = {
        'status': _opts([(s, s.title()) for s in ('active', 'converted', 'lost')]),
        'track': _opts([(s, s.title()) for s in ('ads', 'partner', 'other')]),
        'createdVia': _opts([('meta', 'Meta'), ('import', 'Bulk Upload'), ('manual', 'Quick Add'), ('capture', 'Website')]),
        'optedOutSms': _opts([('true', 'Yes')]), 'optedOutEmail': _opts([('true', 'Yes')]),
    }
    fields = []
    for key, (_, type_) in LEAD_FIELDS.items():
        if key == 'owner' and not admin_view:
            continue
        fields.append({'key': key, 'label': LEAD_LABELS.get(key, key), 'type': type_, 'group': 'Lead',
                       'ops': TYPE_OPS[type_], 'options': fk_options.get(key) or choice_options.get(key)})
    for key, (_, type_) in PROFILE_FILTER_FIELDS.items():
        options = PROFILE_OPTIONS.get(key)
        fields.append({'key': f'pf.{key}', 'label': PROFILE_FIELD_LABELS[key], 'type': type_, 'group': 'Student profile',
                       'ops': TYPE_OPS[type_],
                       'options': _opts([(o, o) for o in options]) if options else
                       _opts([('true', 'Yes'), ('false', 'No')]) if type_ == 'bool' else None})
    for key, meta in DISCUSSION_FIELDS.items():
        if meta['type'] not in ('choice', 'number', 'text'):
            continue
        fields.append({'key': f'cf.{key}', 'label': f"{meta['no']}. {meta['label']}", 'type': meta['type'],
                       'group': 'Counsellor discussion', 'ops': TYPE_OPS[meta['type']],
                       'options': _opts([(o, o) for o in meta['options']]) if meta.get('options') else None})
    smart = [{'key': k, 'label': v} for k, v in SMART_FILTERS.items()
             if admin_view or k not in ('unassigned', 'owner_inactive')]
    return {'fields': fields, 'smartFilters': smart, 'operators': sorted(OPS)}


# ------------------------------------------------------------ saved filters


def saved_doc(f: SavedFilter) -> dict:
    return {'_id': f.id, 'name': f.name, 'params': f.params, 'createdAt': f.created_at}


def list_saved(actor) -> list[dict]:
    return [saved_doc(f) for f in SavedFilter.objects.filter(user_id=actor.id).order_by('name')]


def save_filter(actor, name: str, params: dict) -> dict:
    clean = {k: v for k, v in params.items() if k not in ('page', 'page_size') and v not in (None, '', [])}
    try:
        f, _ = SavedFilter.objects.update_or_create(user_id=actor.id, name=name.strip(), defaults={'params': clean})
    except IntegrityError:
        raise ApiError.conflict('A saved filter with this name already exists')
    return saved_doc(f)


def delete_saved(actor, filter_id: str) -> None:
    if not SavedFilter.objects.filter(pk=filter_id, user_id=actor.id).delete()[0]:
        raise ApiError.not_found('Saved filter not found')


# ----------------------------------------------------------- global search


def global_search(actor, term: str) -> dict:
    """GL-33: name (partial), mobile (full or last 4+ digits), email (partial), Lead ID — within scope."""
    from .services import _outside_scope_notice, filtered

    term = (term or '').strip()
    if len(term) < 2:
        return {'items': [], 'total': 0, 'notice': None}
    qs = filtered(actor, {}, term).select_related('stage', 'owner')
    total = qs.count()
    items = [{
        '_id': lead.id, 'leadNo': lead.lead_no, 'name': lead.full_name, 'mobile': lead.mobile, 'email': lead.email,
        'stage': lead.stage.name if lead.stage_id else None, 'owner': lead.owner.name if lead.owner_id else None,
    } for lead in qs.order_by('-last_activity_at')[:10]]
    notice = None
    if not total and actor.data_scope != 'all' and not actor.is_super_admin:
        notice = _outside_scope_notice(term)
    return {'items': items, 'total': total, 'notice': notice}


# ------------------------------------------------------------------ My Day


def my_day(actor) -> dict:
    """GL-31: four counters that open filtered lists."""
    from .services import filtered

    base = filtered(actor, {}).filter(status='active')
    now = timezone.now()
    start, end = _day_range(timezone.localdate())
    return {
        'newUntouched': base.filter(stage__name='Untouched').count(),
        'followUpsToday': base.filter(tasks__status='open', tasks__due_at__gte=start, tasks__due_at__lt=end).distinct().count(),
        'overdue': base.filter(smart_q('overdue', actor)).distinct().count(),
        'interestedNoActivity': base.filter(stage__name='Interested', last_activity_at__lt=now - timedelta(days=3)).count(),
        'links': {
            'newUntouched': {'smart': 'untouched'}, 'followUpsToday': {'smart': 'followups_today'},
            'overdue': {'smart': 'overdue'},
            'interestedNoActivity': {'filters': [{'field': 'stage', 'op': 'is', 'value': _stage_id('Interested')},
                                                 {'field': 'lastActivityAt', 'op': 'before',
                                                  'value': (timezone.localdate() - timedelta(days=2)).isoformat()}]},
        },
    }


def _stage_id(name: str):
    return Stage.objects.filter(name=name).values_list('id', flat=True).first()


__all__ = ['filter_fields', 'global_search', 'my_day', 'normalize_mobile', 'Q']
