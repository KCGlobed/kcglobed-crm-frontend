"""
Inbound leads (Go-live §4): Meta Lead Ads, website capture and Google forms go
through `ingest` — a new lead is created; a duplicate becomes a re-enquiry on
the existing lead (GL-08) and goes back to its owner (§5.1).
"""
from django.db.models import Q
from django.utils import timezone

from apps.masters.models import Program, Source, Stage
from apps.notifications.services import notify, notify_admins
from apps.users.models import User
from common.normalize import normalize_email, normalize_mobile
from common.roles import COUNSELLOR

from . import services
from . import stage_rules as rules
from .activity import log_activity
from .assignment import pick_next_owner
from .dispositions import set_stage
from .history import record_changes
from .models import Lead

VIA_LABELS = {'meta': 'Meta Ads', 'capture': 'Website', 'google': 'Google', 'manual': 'Quick Add', 'import': 'Bulk Upload'}
# lead field → (model attribute, label) filled on a re-enquiry when empty
FILLABLE = {
    'lastName': ('last_name', 'Last name'), 'email': ('email', 'Email'), 'city': ('city', 'City'),
    'state': ('state', 'State'), 'programInterest': ('program_interest_id', 'Program'),
}


def source_named(name: str | None, channel: str = 'other') -> str | None:
    if not name:
        return None
    source = Source.objects.filter(name__iexact=name).first()
    if not source:
        source = Source.objects.create(name=name, channel=channel)
    return source.id


def program_matching(value: str | None) -> str | None:
    if not value:
        return None
    p = Program.objects.filter(Q(name__iexact=value) | Q(code__iexact=value), is_active=True).first()
    return p.id if p else None


def _owner_is_active_counsellor(lead: Lead) -> bool:
    return bool(lead.owner_id) and User.objects.filter(pk=lead.owner_id, is_active=True, role=COUNSELLOR).exists()


def re_enquire(lead: Lead, payload: dict, *, via: str, source_id: str | None, round_robin: bool) -> Lead:
    """
    GL-08: no new lead. Empty fields are filled (filled ones never overwritten),
    Latest Source updated, First Source kept, owner notified, closed stages reopen.
    """
    lead = Lead.objects.select_related('stage', 'sub_stage', 'owner', 'source').get(pk=lead.pk)
    filled, changes = [], []
    for key, (attr, label) in FILLABLE.items():
        value = payload.get(key)
        if key == 'email':
            value = normalize_email(value)
            if value and Lead.objects.filter(email=value, is_deleted=False).exclude(pk=lead.pk).exists():
                continue  # would collide with another lead
        if value and not getattr(lead, attr):
            setattr(lead, attr, value)
            filled.append(label)
            changes.append((key, label, None, value))
    old_source = lead.source.name if lead.source_id else None
    if source_id:
        lead.source_id = source_id
    now = timezone.now()
    lead.re_enquiry_count += 1
    lead.last_enquired_at = now
    if payload.get('meta'):
        lead.meta = {**(lead.meta or {}), 'lastEnquiry': payload['meta']}
    lead.save()

    source_name = Source.objects.filter(pk=lead.source_id).values_list('name', flat=True).first() if lead.source_id else None
    label = source_name or VIA_LABELS.get(via, via)
    log_activity(
        lead.id, 're_enquiry', f'Re-enquired via {label}',
        description=f"Filled: {', '.join(filled)}" if filled else 'No empty fields to fill',
        actor_type='system', actor_name='System',
        data={'via': via, 'source': source_name, 'filled': filled, 'count': lead.re_enquiry_count},
    )
    if source_id and old_source != source_name:
        changes.append(('source', 'Latest source', old_source, source_name))
    changes.append(('reEnquiryCount', 'Re-enquiry count', lead.re_enquiry_count - 1, lead.re_enquiry_count))
    record_changes(lead.id, 'system', changes, None, actor_name='System', timeline=False)

    # closed lead → Re-enquired (also resets the attempt counter)
    if lead.stage_id and lead.stage.type == 'lost':
        reopened = Stage.objects.filter(name=rules.RE_ENQUIRED, is_active=True).first()
        if reopened:
            set_stage(lead, reopened, None, actor_name='System', reason=f'Re-enquired via {label}',
                      title=f'Stage changed: {lead.stage.name} → {rules.RE_ENQUIRED} (re-enquiry)')
    Lead.objects.filter(pk=lead.pk).update(not_connected_streak=0, not_connected_since=None)

    # §5.1: back to the current owner if Active, otherwise round-robin
    if _owner_is_active_counsellor(lead):
        notify(lead.owner_id, 're_enquiry', f'Re-enquiry on your lead: {lead.full_name}',
               f'{lead.lead_no} re-enquired via {label}', {'leadId': lead.id})
    else:
        owner_id = pick_next_owner() if round_robin else None
        if owner_id:
            services.assign_owner(lead, owner_id, by_label='Round-robin', reason='Re-enquiry')
        else:
            notify_admins('unassigned_pool', 'Re-enquiry waiting in the Unassigned pool',
                          f'{lead.full_name} ({lead.lead_no}) re-enquired via {label}', {'leadId': lead.id})
    services.fire('re_enquired', lead)
    return lead


def ingest(payload: dict, *, via: str, source_id: str | None, round_robin: bool, created_note: str | None = None,
           extra_note: str | None = None) -> dict:
    """Create-or-re-enquire. Returns {'lead': lead json, 'duplicate': bool}."""
    mobile = normalize_mobile(payload.get('mobile'))
    email = normalize_email(payload.get('email'))
    existing = services.find_duplicate(mobile, email)
    if existing:
        lead = re_enquire(existing, payload, via=via, source_id=source_id, round_robin=round_robin)
        if extra_note:
            _system_note(lead.id, extra_note)
        return {'lead': services.get_populated_lead(lead.id), 'duplicate': True}
    body = {**payload, 'mobile': mobile, 'email': email, 'source': source_id}
    lead = services.create_lead(body, via=via, actor=None, auto_assign=round_robin, created_note=created_note)
    if extra_note:
        _system_note(lead['_id'], extra_note)
    return {'lead': lead, 'duplicate': False}


def _system_note(lead_id: str, text: str) -> None:
    from .models import Note

    author = User.objects.filter(is_super_admin=True, is_active=True).order_by('created_at').first()
    if author:
        Note.objects.create(lead_id=lead_id, body=text[:2000], category='Meta answers', created_by=author)
    log_activity(lead_id, 'note', 'Note added (Meta answers)', description=text[:2000], actor_type='system',
                 actor_name='System')


def capture_public(data: dict) -> dict:
    """The website / landing-page capture endpoint (API key)."""
    channel = data.get('channel') or 'capture'
    first, last = data.get('firstName'), data.get('lastName')
    if not first and data.get('name'):
        parts = data['name'].split()
        first, last = parts[0], last or ' '.join(parts[1:]) or None
    utm = {k: data.get(f'utm_{k}') for k in ('source', 'medium', 'campaign', 'term', 'content') if data.get(f'utm_{k}')}
    if data.get('landing_page'):
        utm['landingPage'] = data['landing_page']
    referral = {k: data.get(src) for k, src in (('code', 'referral_code'), ('partnerName', 'partner_name'),
                                                ('partnerLink', 'partner_link')) if data.get(src)}
    default_source = {'meta': 'Meta Ads', 'google': 'Google Ads'}.get(channel, 'Website')
    source_id = source_named(data.get('source') or default_source, 'paid' if channel in ('meta', 'google') else 'organic')
    payload = {
        'firstName': first or 'Unknown', 'lastName': last, 'mobile': data.get('mobile'), 'email': data.get('email'),
        'city': data.get('city'), 'state': data.get('state'), 'programInterest': program_matching(data.get('program')),
        'utm': utm, 'referral': referral, 'track': data.get('track') or ('ads' if channel in ('meta', 'google') else 'other'),
    }
    return ingest(payload, via=channel, source_id=source_id, round_robin=channel in ('meta', 'google'))
