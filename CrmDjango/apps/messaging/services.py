"""
SMS and email (Go-live §8): templates (GL-21), per-lead send (GL-22), bulk
campaigns (GL-23), delivery status and opt-out (GL-25). Automations live in
automations.py and use the same `send_message`.
"""
import logging
import re
import threading
from datetime import datetime, time, timedelta

from django.conf import settings
from django.core import signing
from django.db import close_old_connections, transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.leads.activity import log_activity
from apps.leads.models import Lead, LeadActivity
from apps.notifications.services import notify
from common.exceptions import ApiError
from common.models import compact

from .models import CHANNELS, LIVE_CHANNELS, PLACEHOLDERS, Campaign, Message, MessageTemplate
from .providers import get_provider

logger = logging.getLogger('crm')

PLACEHOLDER_RE = re.compile(r'\{(\w+)\}')
MOBILE_RE = re.compile(r'^[6-9]\d{9}$')
EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
SENDER_ID_RE = re.compile(r'^[A-Z]{6}$')
BULK_MAX = 50_000
# GL-23: bulk sends only 9 am – 9 pm IST (BULK_SEND_WINDOW=HH:MM-HH:MM overrides, e.g. for QA)
BULK_WINDOW = tuple(time(*map(int, part.split(':')))
                    for part in getattr(settings, 'BULK_SEND_WINDOW', '09:00-21:00').split('-'))
BATCH_SIZE = 200
CHANNEL_LABELS = {'sms': 'SMS', 'email': 'Email', 'whatsapp': 'WhatsApp'}
UNSUBSCRIBE_SALT = 'crm.unsubscribe'


# ------------------------------------------------------------- templates


def template_doc(t: MessageTemplate) -> dict:
    return compact({
        '_id': t.id, 'name': t.name, 'channel': t.channel, 'subject': t.subject, 'body': t.body,
        'dltTemplateId': t.dlt_template_id, 'senderId': t.sender_id, 'isActive': t.is_active,
        'placeholders': sorted(set(PLACEHOLDER_RE.findall(t.body + ' ' + (t.subject or '')))),
        'createdAt': t.created_at, 'updatedAt': t.updated_at,
    })


def _validate_template(data: dict, existing: MessageTemplate | None = None) -> dict:
    merged = {
        'name': existing.name if existing else None, 'channel': existing.channel if existing else None,
        'subject': existing.subject if existing else None, 'body': existing.body if existing else None,
        'dltTemplateId': existing.dlt_template_id if existing else None,
        'senderId': existing.sender_id if existing else None,
        **{k: v for k, v in data.items() if v is not None or k in data},
    }
    errors = {}
    channel = merged.get('channel')
    if channel not in LIVE_CHANNELS:
        errors['channel'] = 'Channel must be SMS or Email' if channel != 'whatsapp' else 'WhatsApp is not live yet'
    if not (merged.get('name') or '').strip():
        errors['name'] = 'Template name is required'
    body = (merged.get('body') or '').strip()
    if not body:
        errors['body'] = 'Message text is required'
    unknown = [p for p in PLACEHOLDER_RE.findall(body + ' ' + (merged.get('subject') or '')) if p not in PLACEHOLDERS]
    if unknown:
        errors['body'] = f"Unknown placeholder(s): {', '.join('{' + u + '}' for u in unknown)}"
    if channel == 'sms':
        if len(body) > 1000:
            errors['body'] = 'SMS text can be at most 1000 characters'
        if not (merged.get('dltTemplateId') or '').strip():
            errors['dltTemplateId'] = 'DLT Template ID is required for SMS (TRAI)'
        elif not str(merged['dltTemplateId']).strip().isdigit():
            errors['dltTemplateId'] = 'DLT Template ID is numeric'
        if not SENDER_ID_RE.match((merged.get('senderId') or '').strip().upper()):
            errors['senderId'] = 'Sender ID is 6 capital letters (DLT header)'
    if channel == 'email' and not (merged.get('subject') or '').strip():
        errors['subject'] = 'Email subject is required'
    if errors:
        raise ApiError.bad_request('Validation failed', errors)
    return merged


def list_templates(params) -> list[dict]:
    qs = MessageTemplate.objects.all()
    if params.get('channel'):
        qs = qs.filter(channel=params['channel'])
    if params.get('active') == 'true':
        qs = qs.filter(is_active=True)
    return [template_doc(t) for t in qs.order_by('channel', 'name')]


def save_template(actor, data: dict, template_id: str | None = None) -> dict:
    existing = None
    if template_id:
        existing = MessageTemplate.objects.filter(pk=template_id).first()
        if not existing:
            raise ApiError.not_found('Template not found')
        if 'channel' in data and data['channel'] != existing.channel:
            raise ApiError.bad_request('Validation failed', {'channel': 'The channel of a template cannot change'})
    merged = _validate_template(data, existing)
    t = existing or MessageTemplate(created_by_id=actor.id)
    t.name, t.channel, t.body = merged['name'].strip(), merged['channel'], merged['body'].strip()
    t.subject = (merged.get('subject') or '').strip() or None if t.channel == 'email' else None
    t.dlt_template_id = (merged.get('dltTemplateId') or '').strip() or None if t.channel == 'sms' else None
    t.sender_id = (merged.get('senderId') or '').strip().upper() or None if t.channel == 'sms' else None
    if 'isActive' in data:
        t.is_active = bool(data['isActive'])
    if MessageTemplate.objects.filter(channel=t.channel, name__iexact=t.name).exclude(pk=t.pk).exists():
        raise ApiError.conflict('A template with this name already exists', {'name': 'Name already used'})
    t.save()
    return template_doc(t)


# --------------------------------------------------------------- render


def lead_values(lead: Lead) -> dict:
    owner = lead.owner if lead.owner_id else None
    return {
        'first_name': lead.first_name, 'last_name': lead.last_name,
        'counsellor_name': owner.name if owner else None, 'counsellor_mobile': owner.mobile if owner else None,
        'program_interest': lead.program_interest.name if lead.program_interest_id and lead.program_interest else None,
        'lead_id': lead.lead_no,
    }


def render(text: str | None, lead: Lead) -> str:
    """Placeholders filled; a missing value removes the placeholder, never sends it raw (GL-21)."""
    if not text:
        return ''
    values = lead_values(lead)
    out = PLACEHOLDER_RE.sub(lambda m: str(values.get(m.group(1)) or ''), text)
    out = re.sub(r'\(\s*\)|\[\s*\]', '', out)  # "( )" left behind by an empty value
    out = re.sub(r'[ \t]{2,}', ' ', out)
    return re.sub(r' +([,.!?;:])', r'\1', out).strip()


def address_of(lead: Lead, channel: str) -> str | None:
    value = lead.mobile if channel in ('sms', 'whatsapp') else lead.email
    if not value:
        return None
    if channel == 'email':
        return value if EMAIL_RE.match(value) else None
    return value if MOBILE_RE.match(value) else None


def opted_out(lead: Lead, channel: str) -> bool:
    return (lead.consent or {}).get(channel) is False


def unsubscribe_url(lead: Lead) -> str:
    token = signing.dumps({'l': lead.id, 'c': 'email'}, salt=UNSUBSCRIBE_SALT)
    return f"{settings.PUBLIC_API_URL.rstrip('/')}/api/v1/public/unsubscribe/{token}"


def _with_footer(body: str, lead: Lead) -> str:
    return f'{body}<p style="font-size:12px;color:#888">Don\'t want these emails? <a href="{unsubscribe_url(lead)}">Unsubscribe</a></p>'


# ----------------------------------------------------------------- send


def _activity_title(message: Message, template_name: str | None) -> str:
    label = CHANNEL_LABELS.get(message.channel, message.channel)
    return f"{label} {message.status}: {template_name or 'custom message'}"


def send_message(lead: Lead, template: MessageTemplate | None, *, channel: str, actor=None, label: str | None = None,
                 trigger: str | None = None, campaign: Campaign | None = None, subject: str | None = None,
                 body: str | None = None, message: Message | None = None) -> Message:
    """Renders, logs on the timeline, hands to the provider and records the status."""
    to = address_of(lead, channel)
    rendered_body = body if body is not None else render(template.body if template else '', lead)
    rendered_subject = subject if subject is not None else render(template.subject if template else None, lead) or None
    sent_by = label or (actor.name if actor else 'Automation')
    if message is None:
        message = Message(lead=lead, channel=channel, template=template, campaign=campaign, trigger=trigger)
    message.to_address = to or ''
    message.subject, message.body = rendered_subject, rendered_body
    message.sent_by_id, message.sent_by_label = getattr(actor, 'id', None), sent_by

    if not to:
        message.status, message.error = 'failed', f"No valid {'mobile' if channel == 'sms' else 'email'} on the lead"
    else:
        provider = get_provider(channel)
        payload_body = _with_footer(rendered_body, lead) if channel == 'email' else rendered_body
        result = provider.send(to, payload_body, subject=rendered_subject,
                               sender_id=template.sender_id if template else None,
                               dlt_template_id=template.dlt_template_id if template else None)
        message.status, message.error = result.status, result.error
        message.provider, message.provider_message_id = result.provider, result.provider_message_id
        message.sent_at = timezone.now() if result.status in ('sent', 'delivered') else None
        message.delivered_at = timezone.now() if result.status == 'delivered' else None
    message.save()

    activity = LeadActivity.objects.create(
        lead=lead, type='communication', title=_activity_title(message, template.name if template else None),
        description=message.error or (rendered_subject or rendered_body)[:300],
        data={'messageId': message.id, 'channel': channel, 'status': message.status, 'template': template.name if template else None,
              'sentBy': sent_by, 'trigger': trigger, 'campaignId': campaign.id if campaign else None},
        actor_id=getattr(actor, 'id', None), actor_type='user' if actor else 'system', actor_name=sent_by,
    )
    Message.objects.filter(pk=message.pk).update(activity=activity)
    message.activity = activity
    if actor is not None:
        Lead.objects.filter(pk=lead.pk).update(last_activity_at=timezone.now())
    return message


def update_status(message: Message, status: str, error: str | None = None) -> Message:
    """GL-25: provider delivery reports move the message and its timeline entry."""
    if status not in ('sent', 'delivered', 'failed', 'bounced'):
        raise ApiError.bad_request('Validation failed', {'status': 'sent, delivered, failed or bounced'})
    message.status, message.error = status, error or message.error
    if status == 'delivered':
        message.delivered_at = timezone.now()
    message.save(update_fields=['status', 'error', 'delivered_at', 'updated_at'])
    if message.activity_id:
        activity = LeadActivity.objects.filter(pk=message.activity_id).first()
        if activity:
            activity.title = _activity_title(message, message.template.name if message.template_id else None)
            activity.data = {**(activity.data or {}), 'status': status, 'error': error}
            if error:
                activity.description = error
            activity.save(update_fields=['title', 'data', 'description'])
    return message


def message_doc(m: Message) -> dict:
    return compact({
        '_id': m.id, 'lead': m.lead_id, 'channel': m.channel, 'template': m.template.name if m.template_id else None,
        'to': m.to_address, 'subject': m.subject, 'body': m.body, 'status': m.status, 'error': m.error,
        'trigger': m.trigger, 'sentBy': m.sent_by_label, 'sentAt': m.sent_at, 'deliveredAt': m.delivered_at,
        'createdAt': m.created_at,
    })


def _usable_template(template_id: str, channel: str | None = None) -> MessageTemplate:
    t = MessageTemplate.objects.filter(pk=template_id).first()
    if not t:
        raise ApiError.bad_request('Validation failed', {'template': 'Template not found'})
    if not t.is_active:
        raise ApiError.bad_request('Validation failed', {'template': 'This template is inactive'})
    if channel and t.channel != channel:
        raise ApiError.bad_request('Validation failed', {'template': f'Choose a {CHANNEL_LABELS[channel]} template'})
    if t.channel == 'sms' and not (t.dlt_template_id and t.sender_id):
        raise ApiError.bad_request('Validation failed', {'template': 'Only DLT-approved SMS templates can be sent'})
    return t


def preview_for_lead(actor, lead_id: str, template_id: str) -> dict:
    from apps.leads.services import find_lead_for_actor

    lead = find_lead_for_actor(actor, lead_id)
    t = _usable_template(template_id)
    out = {
        'channel': t.channel, 'template': template_doc(t), 'to': address_of(lead, t.channel),
        'subject': render(t.subject, lead) or None, 'body': render(t.body, lead), 'optedOut': opted_out(lead, t.channel),
    }
    if out['optedOut']:
        out['warning'] = f'This lead opted out of {CHANNEL_LABELS[t.channel]}. Send only a transactional message.'
    if not out['to']:
        out['warning'] = f"This lead has no valid {'mobile' if t.channel == 'sms' else 'email'}"
    return out


def send_to_lead(actor, lead_id: str, data: dict) -> dict:
    """GL-22: counsellors only to their own leads (scope check); email text may be edited before sending."""
    from apps.leads.services import find_lead_for_actor

    lead = find_lead_for_actor(actor, lead_id)
    t = _usable_template(data.get('template') or '', data.get('channel'))
    body = subject = None
    if t.channel == 'email':
        body = (data.get('body') or '').strip() or None
        subject = (data.get('subject') or '').strip() or None
    if not address_of(lead, t.channel):
        raise ApiError.unprocessable(f"This lead has no valid {'mobile' if t.channel == 'sms' else 'email'}")
    message = send_message(lead, t, channel=t.channel, actor=actor, subject=subject, body=body)
    return message_doc(message)


def lead_messages(actor, lead_id: str) -> list[dict]:
    from apps.leads.services import find_lead_for_actor

    find_lead_for_actor(actor, lead_id)
    qs = Message.objects.filter(lead_id=lead_id).select_related('template').order_by('-created_at')[:200]
    return [message_doc(m) for m in qs]


# ------------------------------------------------------------- opt-out


def opt_out(lead: Lead, channel: str, how: str) -> None:
    consent = {**(lead.consent or {}), channel: False}
    Lead.objects.filter(pk=lead.pk).update(consent=consent, updated_at=timezone.now())
    from apps.leads.history import record_changes

    record_changes(lead.id, 'system', [(f'consent.{channel}', f'{CHANNEL_LABELS[channel]} opt-in', 'Yes', 'No (opted out)')],
                   None, actor_name='System', timeline=False)
    log_activity(lead.id, 'communication', f'Opted out of {CHANNEL_LABELS[channel]}', description=how, actor_type='system',
                 actor_name='System', data={'channel': channel, 'optOut': True})


def handle_inbound_sms(sender: str, text: str) -> int:
    """A reply of STOP marks the lead opted out of SMS."""
    from common.normalize import normalize_mobile

    if (text or '').strip().upper() not in ('STOP', 'STOP ALL', 'UNSUBSCRIBE'):
        return 0
    mobile = normalize_mobile(sender)
    leads = list(Lead.objects.filter(mobile=mobile, is_deleted=False))
    for lead in leads:
        if not opted_out(lead, 'sms'):
            opt_out(lead, 'sms', 'Replied STOP to an SMS')
    return len(leads)


def unsubscribe(token: str) -> Lead:
    try:
        data = signing.loads(token, salt=UNSUBSCRIBE_SALT)
    except signing.BadSignature:
        raise ApiError.bad_request('This unsubscribe link is not valid')
    lead = Lead.objects.filter(pk=data.get('l')).first()
    if not lead:
        raise ApiError.not_found('Lead not found')
    if not opted_out(lead, 'email'):
        opt_out(lead, 'email', 'Clicked the unsubscribe link in an email')
    return lead


# ------------------------------------------------------------- campaigns


def in_bulk_window(when: datetime) -> bool:
    local = timezone.localtime(when).time()
    return BULK_WINDOW[0] <= local <= BULK_WINDOW[1]


def _audience(actor, audience: dict) -> list[Lead]:
    from apps.leads.services import filtered

    if audience.get('leadIds'):
        qs = filtered(actor, {}).filter(pk__in=audience['leadIds'])
    elif audience.get('selectAll'):
        qs = filtered(actor, audience.get('filters') or {}, (audience.get('filters') or {}).get('search'))
    else:
        raise ApiError.bad_request('Validation failed', {'audience': 'Select leads or "all matching this filter"'})
    return list(qs.select_related('owner', 'program_interest', 'stage').order_by('created_at'))


def plan_audience(leads: list[Lead], channel: str) -> tuple[list[Lead], dict]:
    final, seen = [], set()
    excluded = {'optedOut': 0, 'invalid': 0, 'duplicate': 0}
    for lead in leads:
        if opted_out(lead, channel):
            excluded['optedOut'] += 1
            continue
        address = address_of(lead, channel)
        if not address:
            excluded['invalid'] += 1
            continue
        if address in seen:
            excluded['duplicate'] += 1
            continue
        seen.add(address)
        final.append(lead)
    return final, {'selected': len(leads), 'excluded': excluded, 'final': len(final)}


def _parse_schedule(value):
    if not value:
        return None
    when = value if isinstance(value, datetime) else parse_datetime(str(value))
    if when is None:
        raise ApiError.bad_request('Validation failed', {'scheduledAt': 'Enter a valid date-time'})
    return timezone.make_aware(when, timezone.get_current_timezone()) if timezone.is_naive(when) else when


def create_campaign(actor, data: dict, *, preview: bool) -> dict:
    channel = data.get('channel')
    if channel not in LIVE_CHANNELS:
        raise ApiError.bad_request('Validation failed', {'channel': 'Channel must be sms or email'})
    t = _usable_template(data.get('template') or '', channel)
    scheduled = _parse_schedule(data.get('scheduledAt'))
    now = timezone.now()
    if scheduled and scheduled < now - timedelta(minutes=1):
        raise ApiError.bad_request('Validation failed', {'scheduledAt': 'Schedule time must be in the future'})
    when = scheduled or now
    if not in_bulk_window(when):
        raise ApiError.unprocessable('Bulk sends run between 9 am and 9 pm only' + (
            ' — choose a scheduled time inside that window' if scheduled else ' — schedule it for later'))

    leads = _audience(actor, data.get('audience') or {})
    final, counts = plan_audience(leads, channel)
    if counts['selected'] > BULK_MAX:
        raise ApiError.unprocessable(f'A bulk send can go to at most {BULK_MAX:,} recipients')
    sample = final[0] if final else None
    summary = {
        **counts, 'channel': channel, 'template': template_doc(t),
        'sample': {'to': address_of(sample, channel), 'subject': render(t.subject, sample) or None,
                   'body': render(t.body, sample)} if sample else None,
    }
    if preview:
        return summary
    if not final:
        raise ApiError.unprocessable('No recipients left after exclusions')
    name = (data.get('name') or '').strip() or f"{CHANNEL_LABELS[channel]} · {t.name} · {timezone.localtime(when):%d %b %H:%M}"
    campaign = Campaign.objects.create(
        name=name[:150], channel=channel, template=t, status='scheduled', scheduled_at=when, counts=counts,
        audience={'leadIds': [lead.id for lead in final], 'filters': (data.get('audience') or {}).get('filters')},
        created_by_id=actor.id,
    )
    if not scheduled:
        start_campaign_async(campaign.id)
    return {**summary, 'campaign': campaign_doc(campaign)}


def campaign_doc(c: Campaign, with_report: bool = False) -> dict:
    doc = compact({
        '_id': c.id, 'name': c.name, 'channel': c.channel, 'template': c.template.name if c.template_id else None,
        'status': c.status, 'scheduledAt': c.scheduled_at, 'startedAt': c.started_at, 'finishedAt': c.finished_at,
        'counts': c.counts, 'createdBy': c.created_by.name if c.created_by_id and c.created_by else None,
        'createdAt': c.created_at,
    })
    from django.db.models import Count

    rows = Message.objects.filter(campaign=c).values('status').annotate(n=Count('id'))
    by_status = {s: 0 for s in ('queued', 'sent', 'delivered', 'failed', 'bounced')}
    by_status.update({r['status']: r['n'] for r in rows})
    doc['report'] = by_status
    if with_report:
        failures = Message.objects.filter(campaign=c, status__in=['failed', 'bounced']).select_related('lead')[:200]
        doc['failures'] = [{'lead': m.lead.lead_no, 'name': m.lead.full_name, 'to': m.to_address, 'reason': m.error or m.status}
                           for m in failures]
    return doc


def list_campaigns() -> list[dict]:
    return [campaign_doc(c) for c in Campaign.objects.select_related('template', 'created_by').order_by('-created_at')[:100]]


def get_campaign(campaign_id: str) -> dict:
    c = Campaign.objects.select_related('template', 'created_by').filter(pk=campaign_id).first()
    if not c:
        raise ApiError.not_found('Campaign not found')
    return campaign_doc(c, with_report=True)


def cancel_campaign(campaign_id: str) -> dict:
    updated = Campaign.objects.filter(pk=campaign_id, status='scheduled').update(status='cancelled', updated_at=timezone.now())
    if not updated:
        raise ApiError.unprocessable('Only a scheduled campaign can be cancelled')
    return get_campaign(campaign_id)


def run_campaign(campaign_id: str) -> None:
    """Sends in batches. Claimed with a conditional update so it runs once."""
    if not Campaign.objects.filter(pk=campaign_id, status='scheduled').update(status='sending', started_at=timezone.now()):
        return
    campaign = Campaign.objects.select_related('template').get(pk=campaign_id)
    ids = campaign.audience.get('leadIds') or []
    with transaction.atomic():
        Message.objects.bulk_create([
            Message(lead_id=lead_id, channel=campaign.channel, template=campaign.template, campaign=campaign,
                    to_address='', body='', status='queued', sent_by_id=campaign.created_by_id,
                    sent_by_label=f'Bulk: {campaign.name}'[:100])
            for lead_id in ids
        ], batch_size=500)
    queued = Message.objects.filter(campaign=campaign, status='queued').select_related(
        'lead__owner', 'lead__program_interest')
    sent = failed = 0
    for start in range(0, len(ids), BATCH_SIZE):
        for message in queued[:BATCH_SIZE]:
            lead = message.lead
            if opted_out(lead, campaign.channel):  # opted out after scheduling
                message.status, message.error = 'failed', 'Opted out'
                message.save(update_fields=['status', 'error'])
                failed += 1
                continue
            send_message(lead, campaign.template, channel=campaign.channel, campaign=campaign,
                         label=f'Bulk: {campaign.name}'[:100], message=message)
            if message.status in ('sent', 'delivered'):
                sent += 1
            else:
                failed += 1
        if Campaign.objects.filter(pk=campaign_id, status='cancelled').exists():
            break
    Campaign.objects.filter(pk=campaign_id).update(status='done', finished_at=timezone.now())
    if campaign.created_by_id:
        notify(campaign.created_by_id, 'bulk_done', f'Bulk {CHANNEL_LABELS[campaign.channel]} finished: {campaign.name}',
               f'{sent} sent, {failed} failed', {'campaignId': campaign.id})


def start_campaign_async(campaign_id: str) -> None:
    def work():
        try:
            run_campaign(campaign_id)
        except Exception as exc:  # noqa: BLE001
            logger.error('Campaign %s failed: %s', campaign_id, exc)
        finally:
            close_old_connections()

    if getattr(settings, 'RUN_JOBS_INLINE', False):
        work()
    else:
        transaction.on_commit(lambda: threading.Thread(target=work, daemon=True).start())


def process_scheduled() -> int:
    """Called from the scheduler tick: starts scheduled campaigns that are due (inside the window)."""
    now = timezone.now()
    due = list(Campaign.objects.filter(status='scheduled', scheduled_at__lte=now).values_list('id', flat=True))
    if due and not in_bulk_window(now):
        return 0
    for campaign_id in due:
        run_campaign(campaign_id)
    return len(due)


__all__ = ['CHANNELS']
