"""
Lead core: one create service for every source (validate → normalise →
duplicate check → create → assign → notify), assignment, list/read, update,
notes and timeline. Go-live Minimum Scope §3–§5, §9, §11.
"""
from collections import Counter as Tally

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from apps.masters.models import Cohort, CustomFieldDef, Program, Source, Stage, Tag
from apps.notifications.services import notify, notify_admins
from apps.tasks.queries import move_open_tasks, with_next_follow_up
from apps.users.models import User
from common.exceptions import ApiError
from common.masking import apply_field_rules, strip_uneditable_fields
from common.normalize import normalize_email, normalize_mobile
from common.pagination import ListQuery
from common.roles import COUNSELLOR
from common.scope import lead_scope_q

from .activity import log_activity
from .assignment import pick_next_owner
from .filters import apply_filters
from .history import record_changes
from .models import Counter, Lead, LeadActivity, Note, default_consent
from .presenters import CREATED_VIA_LABELS, lead_doc, with_relations

SORT_FIELDS = {
    'createdAt': 'created_at', 'updatedAt': 'updated_at', 'firstName': 'first_name', 'lastName': 'last_name',
    'leadNo': 'lead_no', 'stageChangedAt': 'stage_changed_at', 'lastActivityAt': 'last_activity_at',
    'assignedAt': 'assigned_at', 'nextFollowUpAt': 'next_follow_up_at', 'city': 'city', 'state': 'state',
    'email': 'email', 'mobile': 'mobile', 'stage': 'stage__order', 'owner': 'owner__name',
    'source': 'source__name', 'firstSource': 'first_source__name', 'program': 'program_interest__name',
    'status': 'status', 'reEnquiryCount': 're_enquiry_count',
}
SORTABLE = list(SORT_FIELDS)

# API field → model attribute, for create/update payloads
SIMPLE_FIELDS = {
    'firstName': 'first_name', 'lastName': 'last_name', 'altMobile': 'alt_mobile', 'city': 'city',
    'state': 'state', 'country': 'country', 'track': 'track', 'status': 'status',
    'lastDisposition': 'last_disposition', 'utm': 'utm', 'referral': 'referral', 'customFields': 'custom_fields',
}
FK_FIELDS = {
    'source': ('source_id', Source), 'programInterest': ('program_interest_id', Program),
    'cohort': ('cohort_id', Cohort), 'stage': ('stage_id', Stage), 'owner': ('owner_id', User),
}
ASSIGN_REASONS = ['New allocation', 'Workload', 'Leave', 'Language', 'Performance', 'Other']
HISTORY_LABELS = {
    'firstName': 'First name', 'lastName': 'Last name', 'email': 'Email', 'mobile': 'Mobile',
    'altMobile': 'Alternate mobile', 'city': 'City', 'state': 'State', 'country': 'Country', 'track': 'Track',
    'status': 'Status', 'lastDisposition': 'Last disposition', 'source': 'Latest source', 'programInterest': 'Program',
    'cohort': 'Cohort', 'tags': 'Tags', 'consent': 'Consent', 'utm': 'UTM', 'referral': 'Referral',
    'customFields': 'Custom fields',
}


# ---------------------------------------------------------------- helpers


def lead_number(seq: int) -> str:
    """Go-live §6.1: GCC-L-0000001, sequential, never reused."""
    return f'GCC-L-{seq:07d}'


def _plain(value):
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_plain(v) for v in value]
    return value


def fire(trigger: str, lead, actor=None, **extra) -> None:
    """Automation hook (GL-24); imported lazily to keep the apps independent."""
    from apps.messaging.automations import fire_trigger

    fire_trigger(trigger, lead, actor=actor, **extra)


def validate_custom_fields(custom_fields: dict | None) -> None:
    defs = {d.key: d for d in CustomFieldDef.objects.filter(is_active=True)}
    errors: dict = {}
    for key, value in (custom_fields or {}).items():
        d = defs.get(key)
        if not d:
            errors[f'customFields.{key}'] = 'Unknown custom field'
            continue
        if value is None or value == '':
            continue
        if d.type == 'number' and (isinstance(value, bool) or not isinstance(value, (int, float))):
            errors[f'customFields.{key}'] = f'{d.label} must be a number'
        elif d.type == 'boolean' and not isinstance(value, bool):
            errors[f'customFields.{key}'] = f'{d.label} must be true/false'
        elif d.type == 'select' and str(value) not in (d.options or []):
            errors[f'customFields.{key}'] = f"{d.label} must be one of: {', '.join(d.options or [])}"
    if errors:
        raise ApiError.bad_request('Validation failed', errors)


def _check_references(payload: dict) -> None:
    """Unknown ids are reported as field errors instead of failing on the foreign key."""
    errors = {}
    for key, (_, model) in FK_FIELDS.items():
        value = payload.get(key)
        if value and not model.objects.filter(pk=value).exists():
            errors[key] = 'Not found'
    if payload.get('tags'):
        found = set(Tag.objects.filter(pk__in=payload['tags']).values_list('id', flat=True))
        if any(t not in found for t in payload['tags']):
            errors['tags'] = 'One or more tags were not found'
    if errors:
        raise ApiError.bad_request('Validation failed', errors)


def find_duplicate(mobile: str | None, email: str | None, exclude_id: str | None = None) -> Lead | None:
    """GL-08: same normalised mobile or same email as a live lead."""
    condition = Q()
    if mobile:
        condition |= Q(mobile=mobile)
    if email:
        condition |= Q(email=email)
    if not condition:
        return None
    qs = Lead.objects.filter(condition, is_deleted=False).select_related('owner', 'stage')
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)
    return qs.order_by('created_at').first()


def can_see(actor, lead: Lead) -> bool:
    return Lead.objects.filter(lead_scope_q(actor), pk=lead.pk).exists()


def duplicate_info(actor, lead: Lead, field: str) -> tuple[str, dict]:
    """
    Message for a duplicate hit. Someone who may see the lead gets its id, owner and
    stage; a counsellor whose search hits another counsellor's lead gets no details (GL-07).
    """
    if actor is None or can_see(actor, lead):
        owner = lead.owner.name if lead.owner_id else 'Unassigned'
        stage = lead.stage.name if lead.stage_id else '—'
        message = f'Lead exists: {lead.lead_no}, owner: {owner}, stage: {stage}'
        return message, {'leadId': lead.id, 'leadNo': lead.lead_no, 'owner': owner, 'stage': stage, 'visible': True}
    return 'Lead exists, assigned to another counsellor', {'visible': False}


def check_duplicate(actor, mobile: str | None, email: str | None, exclude_id: str | None = None) -> dict:
    """GL-10: Quick Add runs this as soon as a mobile or email is typed."""
    mobile, email = normalize_mobile(mobile), normalize_email(email)
    lead = find_duplicate(mobile, email, exclude_id)
    if not lead:
        return {'exists': False}
    field = 'mobile' if mobile and lead.mobile == mobile else 'email'
    message, info = duplicate_info(actor, lead, field)
    return {'exists': True, 'field': field, 'message': message, **info}


def default_stage() -> Stage | None:
    return Stage.objects.filter(is_active=True, name='Untouched').first() or (
        Stage.objects.filter(is_active=True, type='open').order_by('order').first()
    )


def _scoped(actor, qs=None):
    """Live leads in the caller's data scope, annotated with their next open follow-up."""
    qs = qs if qs is not None else Lead.objects.all()
    return with_next_follow_up(qs.filter(lead_scope_q(actor), is_deleted=False))


def get_populated_lead(lead_id: str) -> dict:
    lead = with_next_follow_up(with_relations(Lead.objects)).filter(pk=lead_id).first()
    if not lead:
        raise ApiError.not_found('Lead not found')
    return lead_doc(lead, populate_created_by=True, extras=True)


def _active_counsellor(owner_id: str) -> User:
    """Leads are owned by Admission Counsellors (Go-live §5)."""
    user = User.objects.filter(pk=owner_id, is_active=True).first()
    if not user:
        raise ApiError.bad_request('Validation failed', {'owner': 'Choose an active counsellor'})
    if user.role != COUNSELLOR:
        raise ApiError.bad_request('Validation failed', {'owner': 'Leads can only be assigned to Admission Counsellors'})
    return user


# ----------------------------------------------------------------- create


def create_lead(payload: dict, *, via: str, actor=None, auto_assign: bool = False, created_note: str | None = None,
                welcome: bool = True) -> dict:
    """
    One create service for Quick Add, capture and Meta (bulk upload batches its own
    inserts but follows the same rules). Duplicates are refused here — capture
    sources turn them into a re-enquiry before calling this.
    """
    mobile = normalize_mobile(payload.get('mobile'))
    email = normalize_email(payload.get('email'))
    if not mobile:
        raise ApiError.bad_request('Validation failed', {'mobile': 'Mobile number is required'})

    duplicate = find_duplicate(mobile, email)
    if duplicate:
        field = 'mobile' if duplicate.mobile == mobile else 'email'
        message, info = duplicate_info(actor, duplicate, field)
        raise ApiError.conflict(message, {field: message, **({'leadId': info['leadId']} if info.get('visible') else {})})

    validate_custom_fields(payload.get('customFields'))
    _check_references(payload)

    stage = default_stage()
    owner_id = payload.get('owner') or None
    by_label = actor.name if actor else 'System'
    if owner_id:
        _active_counsellor(owner_id)
    elif actor is not None and via == 'manual' and actor.role == COUNSELLOR:
        owner_id, by_label = actor.id, 'Quick Add'  # GL-10: a counsellor's Quick Add is theirs
    elif auto_assign or payload.get('autoAssign'):
        owner_id, by_label = pick_next_owner(), 'Round-robin'

    now = timezone.now()
    lead = Lead(
        mobile=mobile, email=email, stage=stage, stage_changed_at=now,
        first_source_id=payload.get('source'), created_via=via,
        created_by_id=actor.id if actor else None, last_activity_at=now,
        consent={**default_consent(), **_plain(payload.get('consent') or {})},
        meta=payload.get('meta') or {}, meta_lead_id=(payload.get('meta') or {}).get('leadId'),
        meta_form_id=(payload.get('meta') or {}).get('formId'),
    )
    for key, attr in SIMPLE_FIELDS.items():
        if payload.get(key) is not None:
            value = _plain(payload[key])
            setattr(lead, attr, None if value == '' else value)
    for key, (attr, _) in FK_FIELDS.items():
        if key in payload and key not in ('stage', 'owner'):
            setattr(lead, attr, payload[key] or None)

    with transaction.atomic():
        lead.lead_no = lead_number(Counter.next_range('lead'))
        try:
            lead.save()
        except IntegrityError:
            raise ApiError.conflict('A lead with this mobile or email already exists')
        if payload.get('tags'):
            lead.tags.set(payload['tags'])

    lead = Lead.objects.select_related('source').get(pk=lead.pk)
    log_activity(
        lead.id, 'created', f'Lead created via {CREATED_VIA_LABELS.get(via, via)}',
        description=created_note or _created_description(lead, actor),
        actor_id=actor.id if actor else None, actor_name=actor.name if actor else 'System',
        data={'via': via, 'source': lead.source.name if lead.source_id else None},
    )
    if note := (payload.get('note') or '').strip():
        Note.objects.create(lead=lead, body=note[:2000], created_by_id=actor.id if actor else None)
        log_activity(lead.id, 'note', 'Note added', description=note[:300], actor_id=actor.id if actor else None,
                     actor_name=actor.name if actor else 'System')

    if owner_id:
        assign_owner(lead, owner_id, by_label=by_label, actor=actor, reason='New allocation')
    elif via in ('meta', 'capture', 'google'):
        # GL-12: nobody online → Unassigned pool + Admin alert
        notify_admins('unassigned_pool', 'New lead in the Unassigned pool',
                      f'{lead.full_name} ({lead.lead_no}) — no counsellor is logged in', {'leadId': lead.id})
    if welcome and via in ('meta', 'manual', 'capture', 'google'):
        fire('lead_created', lead, actor=actor)
    return get_populated_lead(lead.id)


def _created_description(lead: Lead, actor) -> str:
    parts = [f'Source: {lead.source.name}' if lead.source_id else None]
    meta = lead.meta or {}
    if meta:
        parts.append(' · '.join(
            f'{label}: {meta[key]}' for key, label in (
                ('campaignName', 'Campaign'), ('adsetName', 'Ad set'), ('adName', 'Ad'), ('formName', 'Form'),
            ) if meta.get(key)
        ) or None)
    if lead.upload_file_name:
        parts.append(f'File: {lead.upload_file_name}')
    parts.append(f'Created by: {actor.name}' if actor else 'Created by: System')
    return '\n'.join(p for p in parts if p)


# -------------------------------------------------------------- assignment


def assign_owner(lead: Lead, owner_id: str, *, by_label: str, actor=None, reason: str | None = None,
                 notify_people: bool = True) -> Lead:
    """
    The single place ownership changes (GL-12/13): owner + time, open follow-ups
    move, untouched timers restart, timeline from → to by whom and why,
    History row, notifications and the "assigned" automation.
    """
    previous = User.objects.filter(pk=lead.owner_id).first() if lead.owner_id else None
    new_owner = User.objects.get(pk=owner_id)
    if previous and previous.id == owner_id:
        return lead
    now = timezone.now()
    Lead.objects.filter(pk=lead.pk).update(
        owner_id=owner_id, assigned_at=now, untouched_alerted_at=None, untouched_early_alerted_at=None, updated_at=now,
    )
    lead.owner_id, lead.assigned_at = owner_id, now
    moved = move_open_tasks(lead.id, previous.id if previous else None, owner_id)

    title = (f'Reassigned from {previous.name} to {new_owner.name} by {by_label}' if previous
             else f'Assigned to {new_owner.name} by {by_label}')
    lines = [f'Reason: {reason}' if reason else None, f'{moved} open follow-up(s) moved' if moved else None]
    log_activity(
        lead.id, 'assignment', title, description='\n'.join(x for x in lines if x) or None,
        actor_id=actor.id if actor else None,
        actor_name=actor.name if actor else by_label,
        actor_type=None if actor else 'system',
        data={'from': previous.id if previous else None, 'fromName': previous.name if previous else None,
              'to': owner_id, 'toName': new_owner.name, 'by': by_label, 'reason': reason, 'movedFollowUps': moved},
    )
    record_changes(lead.id, 'system', [('owner', 'Owner', previous.name if previous else None, new_owner.name)],
                   actor, actor_name=by_label if not actor else None, timeline=False)
    if notify_people:
        notify(owner_id, 'lead_assigned', 'New lead assigned to you',
               f'{lead.full_name} ({lead.lead_no}) · by {by_label}', {'leadId': lead.id})
        if previous:
            notify(previous.id, 'lead_reassigned', 'Lead reassigned away from you',
                   f'{lead.full_name} ({lead.lead_no}) now belongs to {new_owner.name}', {'leadId': lead.id})
    fire('lead_assigned', lead, actor=actor)
    return lead


def assign_lead(actor, lead_id: str, owner_id: str, reason: str) -> dict:
    lead = Lead.objects.filter(pk=lead_id, is_deleted=False).first()
    if not lead:
        raise ApiError.not_found('Lead not found')
    _active_counsellor(owner_id)
    if lead.owner_id == owner_id:
        raise ApiError.unprocessable('The lead is already assigned to this counsellor')
    assign_owner(lead, owner_id, by_label=actor.name, actor=actor, reason=reason)
    return get_populated_lead(lead.id)


def plan_split(lead_ids: list[str], owner_ids: list[str]) -> dict[str, list[str]]:
    """'Split equally among' — A, B, C, A, B, C … so counts differ by at most one."""
    plan: dict[str, list[str]] = {o: [] for o in owner_ids}
    for i, lead_id in enumerate(lead_ids):
        plan[owner_ids[i % len(owner_ids)]].append(lead_id)
    return plan


def bulk_assign(actor, lead_ids: list[str], owner_ids: list[str], reason: str, *, preview: bool) -> dict:
    """
    GL-13 bulk: one counsellor, or split equally among a chosen set. The preview
    returns the count per counsellor; the real run assigns, moves follow-ups and
    sends one alert per counsellor ("25 leads assigned to you by <Admin>").
    """
    owners = [_active_counsellor(o) for o in dict.fromkeys(owner_ids)]
    leads = list(Lead.objects.filter(pk__in=lead_ids, is_deleted=False).order_by('created_at'))
    if not leads:
        raise ApiError.unprocessable('No leads selected')
    plan = plan_split([lead.id for lead in leads], [o.id for o in owners])
    names = {o.id: o.name for o in owners}
    summary = {
        'total': len(leads),
        'perCounsellor': [{'_id': oid, 'name': names[oid], 'count': len(ids)} for oid, ids in plan.items()],
    }
    if preview:
        return summary

    by_lead = {lead.id: lead for lead in leads}
    reassigned_away: Tally = Tally()
    changed = 0
    for owner_id, ids in plan.items():
        for lead_id in ids:
            lead = by_lead[lead_id]
            if lead.owner_id == owner_id:
                continue
            if lead.owner_id:
                reassigned_away[lead.owner_id] += 1
            assign_owner(lead, owner_id, by_label=actor.name, actor=actor, reason=reason, notify_people=False)
            changed += 1
    for owner_id, ids in plan.items():
        if ids:
            notify(owner_id, 'lead_assigned', f'{len(ids)} leads assigned to you by {actor.name}', f'Reason: {reason}',
                   {'bulk': True})
    for old_owner, count in reassigned_away.items():
        notify(old_owner, 'lead_reassigned', f'{count} of your leads were reassigned by {actor.name}', f'Reason: {reason}',
               {'bulk': True})
    return {**summary, 'assigned': changed}


# ------------------------------------------------------------- list / read


def filtered(actor, params, search: str | None = None):
    """The caller's scope + search + filters — shared by the list, export and bulk actions."""
    return apply_filters(_scoped(actor), params, actor, search)


def list_leads(actor, query: ListQuery, params) -> tuple[list[dict], int, str | None]:
    qs = filtered(actor, params, query.search)
    total = qs.count()
    rows = query.slice(
        with_relations(qs).select_related('profile', 'discussion').order_by(*query.order(SORT_FIELDS))
    )
    notice = None
    if total == 0 and query.search and actor.data_scope != 'all' and not actor.is_super_admin:
        notice = _outside_scope_notice(query.search)
    return [apply_field_rules(lead_doc(lead, extras=True), actor.field_rules) for lead in rows], total, notice


def _outside_scope_notice(search: str) -> str | None:
    """GL-07: an exact mobile / email / Lead ID that belongs to someone else's lead."""
    mobile = normalize_mobile(search)
    term = search.strip()
    q = Q(lead_no__iexact=term) | Q(email__iexact=term.lower())
    if mobile and len(mobile) == 10:
        q |= Q(mobile=mobile)
    if Lead.objects.filter(q, is_deleted=False).exists():
        return 'Lead exists, assigned to another counsellor'
    return None


def find_lead_for_actor(actor, lead_id: str) -> Lead:
    lead = with_relations(_scoped(actor)).filter(pk=lead_id).first()
    if lead:
        return lead
    if Lead.objects.filter(pk=lead_id, is_deleted=False).exists():
        raise ApiError.not_found('This lead is no longer assigned to you')  # GL-06
    raise ApiError.not_found('Lead not found or not accessible')


def get_lead_for_actor(actor, lead_id: str) -> dict:
    lead = find_lead_for_actor(actor, lead_id)
    return apply_field_rules(lead_doc(lead, populate_created_by=True, extras=True), actor.field_rules)


# ------------------------------------------------------------------ update


def _values(lead: Lead) -> dict:
    def name(obj):
        return obj.name if obj else None

    return {
        'firstName': lead.first_name, 'lastName': lead.last_name, 'email': lead.email, 'mobile': lead.mobile,
        'altMobile': lead.alt_mobile, 'city': lead.city, 'state': lead.state, 'country': lead.country,
        'track': lead.track, 'status': lead.status, 'lastDisposition': lead.last_disposition,
        'source': name(lead.source), 'programInterest': name(lead.program_interest), 'cohort': name(lead.cohort),
        'tags': ', '.join(sorted(t.name for t in lead.tags.all())) or None,
        'consent': ', '.join(k for k, v in (lead.consent or {}).items() if v is True) or 'none',
        'utm': lead.utm or None, 'referral': lead.referral or None, 'customFields': lead.custom_fields or None,
    }


def update_lead(actor, lead_id: str, payload: dict) -> dict:
    """Edits lead fields; a stage change goes through the disposition rules (GL-16..20)."""
    from .dispositions import apply_disposition

    lead = (
        _scoped(actor).filter(pk=lead_id)
        .select_related('stage', 'sub_stage', 'source', 'program_interest', 'cohort')
        .prefetch_related('tags')
        .first()
    )
    if not lead:
        find_lead_for_actor(actor, lead_id)  # raises the right 404
    before = _values(lead)

    data = strip_uneditable_fields(dict(payload), actor.field_rules)
    stage_fields = {k: data.pop(k) for k in ('stage', 'subStage', 'followUpAt', 'followUpType', 'reason', 'note') if k in data}
    if data.get('mobile'):
        data['mobile'] = normalize_mobile(data['mobile'])
    if 'email' in data:
        data['email'] = normalize_email(data['email'])
    if data.get('mobile') or data.get('email'):
        duplicate = find_duplicate(data.get('mobile'), data.get('email'), lead.id)
        if duplicate:
            field = 'mobile' if data.get('mobile') and duplicate.mobile == data['mobile'] else 'email'
            message, _ = duplicate_info(actor, duplicate, field)
            raise ApiError.conflict(message, {field: message})
    if 'customFields' in data:
        validate_custom_fields(data['customFields'])
    _check_references(data)

    for key, attr in SIMPLE_FIELDS.items():
        if key in data:
            setattr(lead, attr, _plain(data[key]))
    for key in ('mobile', 'email'):
        if key in data:
            setattr(lead, key, data[key])
    for key, (attr, _) in FK_FIELDS.items():
        if key in data and key not in ('owner', 'stage'):
            setattr(lead, attr, data[key] or None)
    if 'consent' in data:
        lead.consent = {**(lead.consent or default_consent()), **_plain(data['consent'])}

    with transaction.atomic():
        try:
            lead.save()
        except IntegrityError:
            raise ApiError.conflict('Another lead already uses this mobile or email')
        if 'tags' in data:
            lead.tags.set(data['tags'] or [])

    stage_changed = (stage_fields.get('stage') not in (None, lead.stage_id)) or (
        'subStage' in stage_fields and (stage_fields.get('subStage') or None) != lead.sub_stage_id)
    if stage_changed:
        apply_disposition(actor, lead, {
            'stage': stage_fields.get('stage') or lead.stage_id,
            'subStage': stage_fields.get('subStage'),
            'followUpAt': stage_fields.get('followUpAt'),
            'followUpType': stage_fields.get('followUpType'),
            'reason': stage_fields.get('reason'),
            'note': stage_fields.get('note'),
            'interaction': 'update',
        })

    lead = Lead.objects.select_related('source', 'program_interest', 'cohort').prefetch_related('tags').get(pk=lead.pk)
    after = _values(lead)
    if before['status'] != after['status'] and 'status' in data:
        log_activity(lead.id, 'status_change', f"Status changed: {before['status']} → {after['status']}",
                     actor_id=actor.id, actor_name=actor.name, data={'from': before['status'], 'to': after['status']})
    edited = [k for k in data if k in HISTORY_LABELS and k != 'status']
    record_changes(lead.id, 'lead', [(k, HISTORY_LABELS[k], before.get(k), after.get(k)) for k in edited], actor)
    if before['status'] != after['status']:
        record_changes(lead.id, 'system', [('status', 'Status', before['status'], after['status'])], actor, timeline=False)
    return get_populated_lead(lead.id)


def soft_delete_lead(actor, lead_id: str) -> None:
    lead = Lead.objects.filter(pk=lead_id, is_deleted=False).first()
    if not lead:
        raise ApiError.not_found('Lead not found')
    lead.is_deleted = True
    lead.deleted_at = timezone.now()
    lead.deleted_by_id = actor.id
    lead.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by', 'updated_at'])


# --------------------------------------------------------- notes / timeline

NOTE_EDIT_MINUTES = 15  # GL-35


def note_doc(note: Note, actor=None) -> dict:
    editable = bool(actor and note.created_by_id == actor.id
                    and (timezone.now() - note.created_at).total_seconds() < NOTE_EDIT_MINUTES * 60)
    return {
        '_id': note.id, 'lead': note.lead_id, 'body': note.body,
        **({'category': note.category} if note.category else {}),
        'createdBy': {'_id': note.created_by.id, 'name': note.created_by.name} if note.created_by_id else None,
        'createdAt': note.created_at, 'updatedAt': note.updated_at,
        'edited': note.updated_at - note.created_at > timezone.timedelta(seconds=1),
        'editable': editable,
    }


def add_note(actor, lead_id: str, body: str, category: str | None) -> dict:
    find_lead_for_actor(actor, lead_id)  # scope check
    note = Note.objects.create(lead_id=lead_id, body=body.strip(), category=(category or '').strip() or None, created_by_id=actor.id)
    log_activity(
        lead_id, 'note', f'Note added ({category})' if category else 'Note added',
        description=body, actor_id=actor.id, actor_name=actor.name, data={'noteId': note.id},
    )
    return note_doc(Note.objects.select_related('created_by').get(pk=note.id), actor)


def edit_note(actor, note_id: str, body: str) -> dict:
    """GL-35: the author may edit within 15 minutes; after that the note is locked. Never deleted."""
    note = Note.objects.select_related('created_by').filter(pk=note_id).first()
    if not note:
        raise ApiError.not_found('Note not found')
    find_lead_for_actor(actor, note.lead_id)
    if note.created_by_id != actor.id:
        raise ApiError.forbidden('Only the author can edit a note')
    if (timezone.now() - note.created_at).total_seconds() >= NOTE_EDIT_MINUTES * 60:
        raise ApiError.unprocessable('Notes can only be edited within 15 minutes of adding them')
    old = note.body
    note.body = body.strip()
    note.save(update_fields=['body', 'updated_at'])
    log_activity(note.lead_id, 'note', 'Note edited', description=note.body, actor_id=actor.id, actor_name=actor.name,
                 data={'noteId': note.id, 'previous': old})
    return note_doc(note, actor)


def list_notes(actor, lead_id: str) -> list[dict]:
    find_lead_for_actor(actor, lead_id)
    notes = Note.objects.select_related('created_by').filter(lead_id=lead_id).order_by('-created_at', '-id')
    return [note_doc(n, actor) for n in notes]


def activity_doc(a: LeadActivity) -> dict:
    out = {
        '_id': a.id, 'lead': a.lead_id, 'type': a.type, 'title': a.title,
        'actorType': a.actor_type, 'createdAt': a.created_at,
    }
    if a.description is not None:
        out['description'] = a.description
    if a.data is not None:
        out['data'] = a.data
    if a.actor_id:
        out['actor'] = {'_id': a.actor.id, 'name': a.actor.name} if a.actor else a.actor_id
    if a.actor_name:
        out['actorName'] = a.actor_name
    return out


# timeline entries only the Super Admin sees (GL-26: "Lead included in an export")
SUPER_ADMIN_ONLY_TYPES = {'export'}


def timeline(actor, lead_id: str, page: int, page_size: int, types: list[str] | None = None) -> tuple[list[dict], int]:
    find_lead_for_actor(actor, lead_id)
    qs = LeadActivity.objects.select_related('actor').filter(lead_id=lead_id)
    if not actor.is_super_admin:
        qs = qs.exclude(type__in=SUPER_ADMIN_ONLY_TYPES)
    if types:
        qs = qs.filter(type__in=types)
    total = qs.count()
    items = qs.order_by('-created_at', '-id')[(page - 1) * page_size : page * page_size]
    return [activity_doc(a) for a in items], total


def lead_history(actor, lead_id: str, page: int, page_size: int) -> tuple[list[dict], int]:
    """GL-27: every field change on the lead — Super Admin and Admin only (checked by the view)."""
    from .history import history_doc
    from .models import FieldChange

    find_lead_for_actor(actor, lead_id)
    qs = FieldChange.objects.filter(lead_id=lead_id)
    total = qs.count()
    items = qs.order_by('-created_at', '-id')[(page - 1) * page_size : page * page_size]
    return [history_doc(c) for c in items], total
