"""Lead → API JSON, matching the populated Mongo documents the frontend was built on."""
from common.models import compact, ref

from .models import Lead

LEAD_RELATED = ['first_source', 'source', 'program_interest', 'cohort', 'stage', 'owner', 'created_by', 'profile', 'discussion']


def with_relations(queryset):
    return queryset.select_related(*LEAD_RELATED).prefetch_related('tags', 'stage__sub_stages')


CREATED_VIA_LABELS = {
    'manual': 'Quick Add', 'import': 'Bulk Upload', 'meta': 'Meta', 'capture': 'Website', 'google': 'Google',
}


def _profile_value(profile, path: str):
    section, *rest = path.split('__')
    value = getattr(profile, section, None) if profile else None
    for key in rest:
        value = value.get(key) if isinstance(value, dict) else None
    return value


def system_fields(lead: Lead) -> dict:
    """Go-live §6.1 system fields + the profile / counsellor values used as list columns (GL-32/38)."""
    from django.utils import timezone

    from .discussion_fields import DISCUSSION_FIELDS
    from .profile_constants import PROFILE_FILTER_FIELDS

    profile = getattr(lead, 'profile', None) if _has(lead, 'profile') else None
    discussion = getattr(lead, 'discussion', None) if _has(lead, 'discussion') else None
    data = (discussion.data if discussion else None) or {}
    next_due = getattr(lead, 'next_follow_up_at', None)
    return {
        'createdViaLabel': CREATED_VIA_LABELS.get(lead.created_via, lead.created_via),
        'reEnquiryCount': lead.re_enquiry_count,
        'lastEnquiredAt': lead.last_enquired_at,
        'meta': lead.meta or None,
        'uploadFileName': lead.upload_file_name,
        'profileCompletion': profile.completion_percent if profile else 0,
        'customFieldsCompletion': discussion.completion_percent if discussion else 0,
        'optedOut': {c: (lead.consent or {}).get(c) is False for c in ('sms', 'email')},
        'isOverdue': bool(next_due and next_due < timezone.now()),
        'ownerActive': lead.owner.is_active if lead.owner_id and lead.owner else None,
        'profileValues': {k: _profile_value(profile, path) for k, (path, _) in PROFILE_FILTER_FIELDS.items()} if profile else {},
        'discussionValues': {k: v for k, v in data.items() if k in DISCUSSION_FIELDS},
    }


def _has(lead: Lead, relation: str) -> bool:
    try:
        getattr(lead, relation)
        return True
    except Exception:  # noqa: BLE001 — RelatedObjectDoesNotExist
        return False


def lead_doc(lead: Lead, *, populate_created_by: bool = False, extras: bool = False) -> dict:
    doc = _base_doc(lead, populate_created_by)
    if extras:
        doc.update(system_fields(lead))
    return doc


def _base_doc(lead: Lead, populate_created_by: bool) -> dict:
    return compact({
        '_id': lead.id,
        'leadNo': lead.lead_no,
        'firstName': lead.first_name,
        'lastName': lead.last_name,
        'email': lead.email,
        'mobile': lead.mobile,
        'altMobile': lead.alt_mobile,
        'city': lead.city,
        'state': lead.state,
        'country': lead.country,
        'firstSource': ref(lead.first_source, 'name', 'channel'),
        'source': ref(lead.source, 'name', 'channel'),
        'utm': lead.utm or {},
        'referral': lead.referral or {},
        'track': lead.track,
        'programInterest': ref(lead.program_interest, 'name', 'code'),
        'cohort': ref(lead.cohort, 'name'),
        'stage': lead.stage.to_ref() if lead.stage_id else None,
        'subStage': lead.sub_stage_id,
        'stageChangedAt': lead.stage_changed_at,
        'status': lead.status,
        'lastDisposition': lead.last_disposition,
        'owner': ref(lead.owner, 'name', 'email'),
        'assignedAt': lead.assigned_at,
        'tags': [ref(t, 'name', 'color') for t in lead.tags.all()],
        'score': lead.score,
        'consent': lead.consent,
        'customFields': lead.custom_fields or {},
        'lastActivityAt': lead.last_activity_at,
        # earliest open follow-up, when the queryset was annotated with it
        'nextFollowUpAt': getattr(lead, 'next_follow_up_at', None),
        'createdVia': lead.created_via,
        'createdBy': ref(lead.created_by, 'name') if populate_created_by else lead.created_by_id,
        'isDeleted': lead.is_deleted,
        'deletedAt': lead.deleted_at,
        'createdAt': lead.created_at,
        'updatedAt': lead.updated_at,
    })


def sub_stage_name(lead: Lead) -> str:
    return lead.sub_stage.name if lead.sub_stage_id and lead.sub_stage else ''
