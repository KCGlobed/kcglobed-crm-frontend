"""
Student profile for a lead. Access always goes through the lead, so data scope
and field rules match the lead itself. Kept free of HTTP concerns so the
student portal can reuse it later.
"""
import json

from django.utils import timezone

from common.exceptions import ApiError
from common.masking import apply_field_rules
from common.normalize import normalize_email
from common.renderers import ApiEncoder

from . import profile_constants as c
from .activity import log_activity
from .history import record_changes
from .models import LeadProfile
from .profile_serializers import AcademicStepSerializer, PersonalStepSerializer, WorkStepSerializer
from .services import find_lead_for_actor, get_lead_for_actor

STEP_SERIALIZERS = {
    'personal': PersonalStepSerializer,
    'academic': AcademicStepSerializer,
    'work': WorkStepSerializer,
}
STEP_LABELS = {
    'documents': 'the documents (#34-#41)',
    'personal': 'Step 1 (personal & guardian)',
    'academic': 'Step 2 (academic)',
    'work': 'Step 3 (work experience)',
}


def _plain(value):
    """Serializer output (OrderedDicts) → JSON-safe plain data; drops None like the Node JSON round-trip."""
    return json.loads(json.dumps(value, cls=ApiEncoder), object_hook=lambda d: {k: v for k, v in d.items() if v is not None})


def _passes(serializer_class, data: dict) -> bool:
    return serializer_class(data=data).is_valid()


def completed_steps(p: dict) -> dict:
    """A step counts as complete when what is stored still passes that step's validation."""
    return {
        'personal': _passes(PersonalStepSerializer, {'personal': p.get('personal'), 'guardian': p.get('guardian')}),
        'academic': _passes(AcademicStepSerializer, {'academic': p.get('academic')}),
        'work': _passes(WorkStepSerializer, {'work': p.get('work')}),
    }


def _filled(value) -> bool:
    return value is not None and value != ''


def completion_percent(p: dict, docs: dict | None = None) -> int:
    """
    Profile Completion % (LM-15) = filled fields ÷ applicable fields. Hidden
    conditional fields don't count, Age is calculated, and the document uploads
    (#34–#41) are left out until that step is built.
    """
    personal, guardian = p.get('personal') or {}, p.get('guardian') or {}
    a, w = p.get('academic') or {}, p.get('work') or {}

    def school(s):
        s = s or {}
        return [s.get('yearOfPassing'), True if _filled(s.get('gradeType')) and _filled(s.get('score')) else None, s.get('medium')]

    ug, hq = a.get('ug') or {}, a.get('higherQualification') or {}
    fields = [
        *(personal.get(k) for k in ('firstName', 'lastName', 'email', 'mobile', 'dob', 'gender', 'state', 'city', 'pinCode', 'address')),
        *(guardian.get(k) for k in ('name', 'relationship', 'mobile', 'email')),
        *school(a.get('class10')),
        *school(a.get('class12')),
        ug.get('qualification'), ug.get('status'), ug.get('institution'),
        True if _filled(ug.get('gradeType')) and _filled(ug.get('score')) else None,
        ug.get('yearOfPassing'), ug.get('medium'),
        hq.get('has'),
        *([hq.get('details')] if hq.get('has') else []),
        w.get('employmentStatus'),
        *([w.get('organization'), w.get('designation'), w.get('functionalArea'),
           True if _filled(w.get('experienceYears')) and _filled(w.get('experienceMonths')) else None]
          if w.get('employmentStatus') == 'Experienced' else []),
        True if (p.get('declaration') or {}).get('accepted') else None,
        # documents #34-#41: graduation result only applies once the UG is Completed
        *([True if docs.get(t) else None for t in docs['_applicable']] if docs else []),
    ]
    return round(sum(1 for f in fields if _filled(f)) / len(fields) * 100)


def documents_state(lead_id: str, p: dict) -> dict:
    from .documents import RULES
    from .models import LeadDocument

    uploaded = set(LeadDocument.objects.filter(lead_id=lead_id, is_current=True).values_list('doc_type', flat=True))
    ug_status = ((p.get('academic') or {}).get('ug') or {}).get('status')
    # mandatory documents only — optional PAN / Resume never hold a profile below 100%
    types = [t for t, (_, _, m) in RULES.items() if m is True or (m == 'if_completed' and ug_status == 'Completed')]
    return {'_applicable': types, **{t: t in uploaded for t in types}}


def refresh_completion(lead_id: str) -> int:
    """Stores Profile Completion % for list filters / columns (GL-34) and the discussion's %."""
    from .discussion import current_data
    from .discussion_fields import completion_percent as discussion_percent
    from .models import LeadDiscussion

    profile = LeadProfile.objects.filter(lead_id=lead_id).first()
    p = _as_dict(profile)
    percent = completion_percent(p, documents_state(lead_id, p))
    if profile and profile.completion_percent != percent:
        LeadProfile.objects.filter(pk=profile.pk).update(completion_percent=percent)
    elif not profile and percent:
        LeadProfile.objects.create(lead_id=lead_id, completion_percent=percent)
    _, _, data = current_data(lead_id)
    LeadDiscussion.objects.filter(lead_id=lead_id).update(completion_percent=discussion_percent(data))
    return percent


def _as_dict(profile: LeadProfile | None) -> dict:
    if not profile:
        return {}
    return {
        'personal': profile.personal, 'guardian': profile.guardian, 'academic': profile.academic,
        'work': profile.work, 'declaration': profile.declaration, 'locked': profile.locked,
        'updatedAt': profile.updated_at,
    }


def present(actor, lead_id: str, p: dict, exists: bool) -> dict:
    def mask(section):
        return apply_field_rules(section, actor.field_rules) if section else None

    declaration = p.get('declaration') or {}
    return {
        'lead': lead_id,
        'exists': exists,
        'personal': mask(p.get('personal')),
        'guardian': mask(p.get('guardian')),
        'academic': p.get('academic'),
        'work': p.get('work'),
        'declaration': (
            {'accepted': True, 'acceptedAt': declaration.get('acceptedAt'), 'textVersion': declaration.get('textVersion')}
            if declaration.get('accepted') else {'accepted': False}
        ),
        'declarationText': c.DECLARATION_TEXT,
        'locked': bool(p.get('locked')),
        'steps': {**completed_steps(p), 'documents': _documents_done(lead_id, p)},
        'completionPercent': completion_percent(p, documents_state(lead_id, p)),
        'updatedAt': p.get('updatedAt'),
    }


def _documents_done(lead_id: str, p: dict) -> bool:
    from .documents import RULES

    state = documents_state(lead_id, p)
    ug_status = ((p.get('academic') or {}).get('ug') or {}).get('status')
    mandatory = [t for t, (_, _, m) in RULES.items() if m is True or (m == 'if_completed' and ug_status == 'Completed')]
    return all(state.get(t) for t in mandatory)


def get_profile(actor, lead_id: str) -> dict:
    lead = get_lead_for_actor(actor, lead_id)
    profile = LeadProfile.objects.filter(lead_id=lead_id).first()
    # Doc: "Autocapture from Lead Form" — prefill contact fields from the lead until step 1 is saved
    # (the row can already exist, e.g. created by the Counsellor Discussion's shared work fields).
    prefill = {k: lead[k] for k in ('firstName', 'lastName', 'email', 'mobile') if isinstance(lead.get(k), str) and lead[k]}
    if profile:
        data = _as_dict(profile)
        if not data.get('personal'):
            data['personal'] = prefill
        return present(actor, lead_id, data, True)
    return present(actor, lead_id, {'personal': prefill}, False)


def save_step(actor, lead_id: str, step: str, data: dict) -> tuple[dict | None, dict]:
    find_lead_for_actor(actor, lead_id)  # 404 outside the caller's scope
    profile = LeadProfile.objects.filter(lead_id=lead_id).first()
    if profile and profile.locked:
        raise ApiError.unprocessable('The profile is locked after the declaration. Ask an admin to unlock it.')
    before = _plain(_as_dict(profile)) if profile else None

    clean = _plain(data)
    for section in ('personal', 'guardian'):
        if clean.get(section, {}).get('email'):
            clean[section]['email'] = normalize_email(clean[section]['email'])

    if step == 'personal':
        _sync_lead_contact(actor, lead_id, clean.get('personal') or {})
    if step == 'work' and (clean.get('work') or {}).get('employmentStatus') != 'Experienced':
        for hidden in ('organization', 'designation', 'functionalArea', 'experienceYears', 'experienceMonths'):
            (clean.get('work') or {}).pop(hidden, None)

    old = _as_dict(profile) if profile else {}
    profile = profile or LeadProfile(lead_id=lead_id)
    for section, value in clean.items():
        setattr(profile, section, value)
    profile.updated_by_id = actor.id
    profile.save()
    changes = []
    for section, value in clean.items():
        changes.extend(_flat_changes(section, old.get(section) or {}, value or {}))
    record_changes(lead_id, 'profile', changes, actor, title=f'Student profile {STEP_LABELS[step]} saved')
    if not changes:
        log_activity(lead_id, 'profile', f'Profile {STEP_LABELS[step]} saved', actor_id=actor.id, actor_name=actor.name,
                     data={'step': step})
    refresh_completion(lead_id)
    return before, present(actor, lead_id, _as_dict(profile), True)


SECTION_LABELS = {'personal': 'Personal', 'guardian': 'Guardian', 'academic': 'Academic', 'work': 'Work'}


def _flat(prefix: str, value, out: dict) -> dict:
    if isinstance(value, dict):
        for k, v in value.items():
            _flat(f'{prefix}.{k}' if prefix else k, v, out)
    else:
        out[prefix] = value
    return out


def _flat_changes(section: str, old: dict, new: dict) -> list:
    a, b = _flat('', old, {}), _flat('', new, {})
    return [(f'{section}.{key}', f'{SECTION_LABELS[section]}: {key}', a.get(key), b.get(key))
            for key in sorted(set(a) | set(b)) if a.get(key) != b.get(key)]


def _sync_lead_contact(actor, lead_id: str, personal: dict) -> None:
    """#1-#4 are the lead's own name / email / mobile: a change runs the duplicate check and updates the lead."""
    from common.normalize import normalize_mobile

    from .models import Lead
    from .services import duplicate_info, find_duplicate

    lead = Lead.objects.get(pk=lead_id)
    mobile = normalize_mobile(personal.get('mobile')) if personal.get('mobile') else None
    email = personal.get('email') or None
    dup = find_duplicate(mobile if mobile != lead.mobile else None, email if email != lead.email else None, lead_id)
    if dup:
        field = 'mobile' if mobile and dup.mobile == mobile else 'email'
        message, _ = duplicate_info(actor, dup, field)
        raise ApiError.conflict(message, {f'personal.{field}': message})
    updates, changes = {}, []
    for key, attr, label in (('firstName', 'first_name', 'First name'), ('lastName', 'last_name', 'Last name'),
                             ('email', 'email', 'Email'), ('mobile', 'mobile', 'Mobile')):
        value = mobile if key == 'mobile' else personal.get(key)
        if value and value != getattr(lead, attr):
            changes.append((key, label, getattr(lead, attr), value))
            updates[attr] = value
    if updates:
        Lead.objects.filter(pk=lead_id).update(**updates, updated_at=timezone.now())
        record_changes(lead_id, 'lead', changes, actor, timeline=False)


def accept_declaration(actor, lead_id: str) -> dict:
    find_lead_for_actor(actor, lead_id)
    profile = LeadProfile.objects.filter(lead_id=lead_id).first()
    steps = {**completed_steps(_as_dict(profile)), 'documents': _documents_done(lead_id, _as_dict(profile))}
    missing = [s for s, done in steps.items() if not done]
    if not profile or missing:
        raise ApiError.unprocessable(f"Complete {', '.join(STEP_LABELS[s] for s in missing)} before the declaration")
    if profile.locked:
        raise ApiError.unprocessable('The declaration has already been accepted')
    profile.declaration = {
        'accepted': True,
        'acceptedAt': json.loads(json.dumps(timezone.now(), cls=ApiEncoder)),
        'acceptedBy': actor.id,
        'textVersion': c.DECLARATION_VERSION,
    }
    profile.locked = True  # LM-17
    profile.updated_by_id = actor.id
    profile.save()
    refresh_completion(lead_id)
    log_activity(lead_id, 'profile', 'Profile declaration accepted — profile locked', actor_id=actor.id,
                 actor_name=actor.name, data={'textVersion': c.DECLARATION_VERSION})
    return present(actor, lead_id, _as_dict(profile), True)


def unlock_profile(actor, lead_id: str, reason: str) -> dict:
    """LM-17: only an admin can unlock a declared profile, with a reason. The declaration is withdrawn."""
    if not actor.is_super_admin and getattr(actor, 'role', None) != 'admin':
        raise ApiError.forbidden('Only an admin can unlock a profile')
    find_lead_for_actor(actor, lead_id)
    profile = LeadProfile.objects.filter(lead_id=lead_id).first()
    if not profile or not profile.locked:
        raise ApiError.unprocessable('The profile is not locked')
    profile.locked = False
    profile.declaration = None
    profile.unlock_history = [
        *(profile.unlock_history or []),
        {'by': actor.id, 'at': json.loads(json.dumps(timezone.now(), cls=ApiEncoder)), 'reason': reason},
    ]
    profile.updated_by_id = actor.id
    profile.save()
    log_activity(lead_id, 'profile', 'Profile unlocked — declaration withdrawn', description=reason,
                 actor_id=actor.id, actor_name=actor.name)
    return present(actor, lead_id, _as_dict(profile), True)
