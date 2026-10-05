"""
Meta Lead Ads (Go-live GL-09).

Webhook (leadgen) → MetaLeadEvent (the Meta lead id is unique, so a resent
webhook never creates a second lead) → fetch the lead from the Graph API →
map answers per form → the shared create-or-re-enquire service.

Failed fetches retry after 1, 5, 15 and 60 minutes, then land in "Integration
errors" for the Super Admin with a Retry button.

Without META_ACCESS_TOKEN (sandbox / QA) the lead's answers and ad names are
read from the webhook payload itself, so test events can be posted locally.
"""
import hashlib
import hmac
import json
import logging
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

from django.conf import settings
from django.db.models import Count, Q
from django.utils import timezone

from apps.notifications.services import notify_admins
from common.exceptions import ApiError

from .models import DEFAULT_MAPPING, MAPPABLE_FIELDS, RETRY_DELAYS_MINUTES, MetaFormMapping, MetaLeadEvent

logger = logging.getLogger('crm')
GRAPH = 'https://graph.facebook.com'
LEAD_FIELDS = 'created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,platform'


class FetchError(Exception):
    pass


# ------------------------------------------------------------------ webhook


def verify_subscription(params) -> str:
    """GET handshake: hub.mode=subscribe & hub.verify_token must match → echo hub.challenge."""
    if params.get('hub.mode') == 'subscribe' and params.get('hub.verify_token') == settings.META_VERIFY_TOKEN \
            and settings.META_VERIFY_TOKEN:
        return params.get('hub.challenge') or ''
    raise ApiError.forbidden('Verification token mismatch')


def check_signature(raw_body: bytes, header: str | None) -> None:
    secret = settings.META_APP_SECRET
    if not secret:
        return  # sandbox
    expected = 'sha256=' + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    if not header or not hmac.compare_digest(expected, header):
        raise ApiError.unauthorized('Invalid Meta signature')


def receive(body: dict) -> dict:
    """POST: every leadgen change → event → processed now (well inside the 60-second target)."""
    counts = {'received': 0, 'created': 0, 'reEnquiries': 0, 'duplicates': 0, 'failed': 0}
    for entry in body.get('entry') or []:
        for change in entry.get('changes') or []:
            if change.get('field') != 'leadgen':
                continue
            value = change.get('value') or {}
            leadgen_id = str(value.get('leadgen_id') or '')
            if not leadgen_id:
                continue
            counts['received'] += 1
            event, made = MetaLeadEvent.objects.get_or_create(leadgen_id=leadgen_id, defaults={
                'page_id': str(value.get('page_id') or entry.get('id') or ''), 'form_id': str(value.get('form_id') or ''),
                'ad_id': str(value.get('ad_id') or ''), 'payload': value, 'event_time': _from_epoch(value.get('created_time')),
            })
            if not made and event.status in ('processed', 'duplicate'):
                counts['duplicates'] += 1  # resent webhook → nothing new
                continue
            outcome = process(event)
            counts[{'created': 'created', 're_enquiry': 'reEnquiries'}.get(outcome, 'failed')] += 1
    return counts


def _from_epoch(value):
    try:
        return datetime.fromtimestamp(int(value), tz=dt_timezone.utc) if value else None
    except (TypeError, ValueError):
        return None


# --------------------------------------------------------------- fetching


def _graph_get(path: str, params: dict) -> dict:
    query = urllib.parse.urlencode({**params, 'access_token': settings.META_ACCESS_TOKEN})
    url = f"{GRAPH}/{settings.META_GRAPH_VERSION}/{path}?{query}"
    try:
        with urllib.request.urlopen(url, timeout=20) as response:
            return json.loads(response.read())
    except Exception as exc:  # noqa: BLE001
        raise FetchError(f'Graph API: {exc}') from exc


def fetch_lead(event: MetaLeadEvent) -> dict:
    """The adapter: Graph API in production, the webhook payload itself in sandbox."""
    if settings.META_ACCESS_TOKEN:
        data = _graph_get(event.leadgen_id, {'fields': LEAD_FIELDS})
        form_id = data.get('form_id') or event.form_id
        mapping = MetaFormMapping.objects.filter(form_id=form_id).first()
        if form_id and not (mapping and mapping.form_name):
            data['form_name'] = _graph_get(form_id, {'fields': 'name'}).get('name')
        return data
    payload = event.payload or {}
    if payload.get('simulate_error'):
        raise FetchError(str(payload['simulate_error']))
    if not payload.get('field_data'):
        raise FetchError('Meta access token is not configured and the event has no field_data')
    return payload


# ---------------------------------------------------------------- mapping


def form_mapping(form_id: str, form_name: str | None, page_id: str | None) -> MetaFormMapping:
    mapping, _ = MetaFormMapping.objects.get_or_create(form_id=form_id or 'unknown', defaults={
        'form_name': form_name, 'page_id': page_id, 'mapping': {},
    })
    if form_name and mapping.form_name != form_name:
        mapping.form_name = form_name
        mapping.save(update_fields=['form_name', 'updated_at'])
    return mapping


def build_payload(data: dict, mapping: MetaFormMapping) -> tuple[dict, list[str]]:
    from apps.leads.capture import program_matching

    rules = {**DEFAULT_MAPPING, **(mapping.mapping or {})}
    payload: dict = {}
    unmapped = []
    for item in data.get('field_data') or []:
        question = item.get('name') or ''
        answer = ', '.join(str(v) for v in item.get('values') or [] if v not in (None, ''))
        target = rules.get(question)
        if not answer:
            continue
        if target == 'full_name':
            parts = answer.split()
            payload['firstName'] = payload.get('firstName') or (parts[0] if parts else None)
            payload['lastName'] = payload.get('lastName') or (' '.join(parts[1:]) or None)
        elif target == 'first_name':
            payload['firstName'] = answer
        elif target == 'last_name':
            payload['lastName'] = answer
        elif target == 'phone_number':
            payload['mobile'] = answer
        elif target in ('email', 'city', 'state'):
            payload[target] = answer
        elif target == 'program':
            payload['programInterest'] = program_matching(answer)
            if not payload['programInterest']:
                unmapped.append(f'{question}: {answer}')
        else:
            unmapped.append(f'{question}: {answer}')
    payload['firstName'] = (payload.get('firstName') or 'Meta lead')[:50]
    return payload, unmapped


def meta_attribution(data: dict, event: MetaLeadEvent, form_name: str | None) -> dict:
    keys = {
        'campaignId': 'campaign_id', 'campaignName': 'campaign_name', 'adsetId': 'adset_id', 'adsetName': 'adset_name',
        'adId': 'ad_id', 'adName': 'ad_name', 'formId': 'form_id', 'platform': 'platform', 'createdTime': 'created_time',
    }
    meta = {k: data.get(src) for k, src in keys.items() if data.get(src)}
    meta.update({'leadId': event.leadgen_id, 'formId': meta.get('formId') or event.form_id, 'pageId': event.page_id})
    if form_name or data.get('form_name'):
        meta['formName'] = form_name or data.get('form_name')
    return {k: str(v) for k, v in meta.items() if v}


# ------------------------------------------------------------- processing


def process(event: MetaLeadEvent) -> str:
    """Returns 'created' | 're_enquiry' | 'failed' | 'error'."""
    from apps.leads.capture import ingest, source_named

    event.attempts += 1
    try:
        data = fetch_lead(event)
        form_id = str(data.get('form_id') or event.form_id or '')
        mapping = form_mapping(form_id, data.get('form_name'), event.page_id)
        if not mapping.is_active:
            raise FetchError(f'Form {form_id} is switched off in the mapping screen')
        payload, unmapped = build_payload(data, mapping)
        if not payload.get('mobile'):
            raise FetchError('The Meta lead has no phone number answer (check the form mapping)')
        meta = meta_attribution(data, event, mapping.form_name)
        payload['meta'] = meta
        payload['track'] = 'ads'
        created_note = '\n'.join(x for x in [
            'Source: Meta Ads',
            ' · '.join(f'{label}: {meta[k]}' for k, label in (('campaignName', 'Campaign'), ('adsetName', 'Ad set'),
                                                              ('adName', 'Ad'), ('formName', 'Form')) if meta.get(k)) or None,
            f'Meta lead ID: {event.leadgen_id}', 'Created by: System',
        ] if x)
        result = ingest(payload, via='meta', source_id=source_named('Meta Ads', 'paid'), round_robin=True,
                        created_note=created_note,
                        extra_note=('Meta answers\n' + '\n'.join(unmapped)) if unmapped else None)
    except Exception as exc:  # noqa: BLE001
        return _failed(event, exc)
    event.status = 'processed'
    event.lead_id = result['lead']['_id']
    event.form_id = event.form_id or meta.get('formId')
    event.processed_at = timezone.now()
    event.last_error = None
    event.next_attempt_at = None
    event.save()
    return 're_enquiry' if result['duplicate'] else 'created'


def _failed(event: MetaLeadEvent, exc: Exception) -> str:
    message = str(exc)[:1000] or exc.__class__.__name__
    logger.warning('Meta lead %s failed (attempt %s): %s', event.leadgen_id, event.attempts, message)
    event.last_error = message
    retries_done = event.attempts - 1
    if retries_done < len(RETRY_DELAYS_MINUTES):
        event.status = 'failed'
        event.next_attempt_at = timezone.now() + timedelta(minutes=RETRY_DELAYS_MINUTES[retries_done])
        event.save()
        return 'failed'
    event.status = 'error'
    event.next_attempt_at = None
    event.save()
    notify_admins('integration_error', 'Meta lead could not be imported',
                  f'Lead {event.leadgen_id}: {message[:200]}', {'eventId': event.id}, super_only=True)
    return 'error'


def process_retries(now=None) -> int:
    now = now or timezone.now()
    due = MetaLeadEvent.objects.filter(status='failed', next_attempt_at__lte=now)[:50]
    for event in due:
        process(event)
    return len(due)


def retry(event_id: str) -> dict:
    event = MetaLeadEvent.objects.filter(pk=event_id).first()
    if not event:
        raise ApiError.not_found('Event not found')
    if event.status == 'processed':
        raise ApiError.unprocessable('This Meta lead is already in the CRM')
    event.attempts = 0
    outcome = process(event)
    event.refresh_from_db()
    return {**event_doc(event), 'outcome': outcome}


def event_doc(e: MetaLeadEvent) -> dict:
    return {
        '_id': e.id, 'leadgenId': e.leadgen_id, 'pageId': e.page_id, 'formId': e.form_id, 'adId': e.ad_id,
        'status': e.status, 'attempts': e.attempts, 'nextAttemptAt': e.next_attempt_at, 'lastError': e.last_error,
        'lead': e.lead_id, 'eventTime': e.event_time, 'processedAt': e.processed_at, 'createdAt': e.created_at,
    }


def list_events(status: str | None) -> list[dict]:
    qs = MetaLeadEvent.objects.all()
    if status == 'errors':
        qs = qs.filter(status__in=['failed', 'error'])
    elif status:
        qs = qs.filter(status=status)
    return [event_doc(e) for e in qs.order_by('-created_at')[:200]]


# ------------------------------------------------------------ mapping screen


def mapping_doc(m: MetaFormMapping) -> dict:
    return {
        '_id': m.id, 'formId': m.form_id, 'formName': m.form_name, 'pageId': m.page_id,
        'mapping': {**DEFAULT_MAPPING, **(m.mapping or {})}, 'isActive': m.is_active,
        'questions': sorted({item.get('name') for e in MetaLeadEvent.objects.filter(form_id=m.form_id).order_by('-created_at')[:20]
                             for item in (e.payload or {}).get('field_data') or [] if item.get('name')}),
        'updatedAt': m.updated_at,
    }


def list_mappings() -> dict:
    return {'fields': [{'value': k, 'label': v} for k, v in MAPPABLE_FIELDS.items()],
            'forms': [mapping_doc(m) for m in MetaFormMapping.objects.order_by('form_name', 'form_id')]}


def save_mapping(actor, form_id: str, data: dict) -> dict:
    mapping = data.get('mapping') or {}
    if not isinstance(mapping, dict):
        raise ApiError.bad_request('Validation failed', {'mapping': 'mapping must be {question: field}'})
    bad = [v for v in mapping.values() if v and v not in MAPPABLE_FIELDS and v != 'ignore']
    if bad:
        raise ApiError.bad_request('Validation failed', {'mapping': f"Unknown CRM field(s): {', '.join(bad)}"})
    m, _ = MetaFormMapping.objects.get_or_create(form_id=form_id)
    m.mapping = {k: v for k, v in mapping.items() if v}
    if 'formName' in data:
        m.form_name = data['formName'] or m.form_name
    if 'isActive' in data:
        m.is_active = bool(data['isActive'])
    m.updated_by_id = actor.id
    m.save()
    return mapping_doc(m)


# --------------------------------------------------------------- daily check


def daily_check(day) -> list[dict]:
    """Meta lead count per form vs CRM count per form for one day."""
    from apps.leads.models import Lead

    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(day, datetime.min.time()), tz)
    end = start + timedelta(days=1)
    events = MetaLeadEvent.objects.filter(created_at__gte=start, created_at__lt=end)
    by_form = {r['form_id']: r for r in events.values('form_id').annotate(
        received=Count('id'), errors=Count('id', filter=~Q(status='processed')))}
    crm = {r['meta_form_id']: r['n'] for r in Lead.objects.filter(created_at__gte=start, created_at__lt=end,
                                                                     meta_form_id__isnull=False)
           .values('meta_form_id').annotate(n=Count('id'))}
    names = dict(MetaFormMapping.objects.values_list('form_id', 'form_name'))
    rows = []
    for form_id in sorted(set(by_form) | set(crm) | set(names)):
        meta_count = _meta_count(form_id, start, end) if settings.META_ACCESS_TOKEN else (by_form.get(form_id) or {}).get('received', 0)
        processed = (by_form.get(form_id) or {}).get('received', 0) - (by_form.get(form_id) or {}).get('errors', 0)
        rows.append({'formId': form_id, 'formName': names.get(form_id), 'metaCount': meta_count,
                     'crmCount': processed, 'newLeads': crm.get(form_id, 0), 'match': meta_count == processed})
    return rows


def _meta_count(form_id: str, start, end) -> int | None:
    try:
        filtering = json.dumps([{'field': 'time_created', 'operator': 'GREATER_THAN', 'value': int(start.timestamp())},
                                {'field': 'time_created', 'operator': 'LESS_THAN', 'value': int(end.timestamp())}])
        data = _graph_get(f'{form_id}/leads', {'filtering': filtering, 'summary': 'true', 'limit': 0})
        return int((data.get('summary') or {}).get('total_count') or 0)
    except FetchError:
        return None
