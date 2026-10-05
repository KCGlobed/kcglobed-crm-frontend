"""
Trigger-based automations (GL-24). Each trigger × channel is a rule Admin can
switch on/off and point at a template. Never fires for Junk/Invalid leads,
never twice for the same trigger on the same lead within 24 hours, and skips
opted-out channels. Must never break the operation that fired it.
"""
import logging
from datetime import timedelta

from django.utils import timezone

from apps.leads.stage_rules import NO_AUTOMATION_STAGES
from common.exceptions import ApiError

from .models import TRIGGERS, AutomationRule, Message, MessageTemplate

logger = logging.getLogger('crm')
DEDUPE = timedelta(hours=24)


def fire_trigger(trigger: str, lead, actor=None, *, force: bool = False, **_extra) -> int:
    """`force` sends even when the rule is switched off — the bulk-upload "Send welcome message" tick."""
    from apps.leads.models import Lead

    from .services import address_of, opted_out, send_message

    sent = 0
    try:
        lead = Lead.objects.select_related('stage', 'owner', 'program_interest').get(pk=lead.pk)
        if lead.is_deleted or (lead.stage_id and lead.stage.name in NO_AUTOMATION_STAGES):
            return 0
        rules = AutomationRule.objects.filter(trigger=trigger, template__is_active=True).select_related('template')
        if not force:
            rules = rules.filter(is_active=True)
        since = timezone.now() - DEDUPE
        for rule in rules:
            if opted_out(lead, rule.channel) or not address_of(lead, rule.channel):
                continue
            if Message.objects.filter(lead=lead, trigger=trigger, channel=rule.channel, created_at__gte=since).exists():
                continue
            send_message(lead, rule.template, channel=rule.channel, label='Automation', trigger=trigger)
            sent += 1
    except Exception as exc:  # noqa: BLE001
        logger.error('Automation %s failed for lead %s: %s', trigger, getattr(lead, 'pk', None), exc)
    return sent


def rule_doc(rule: AutomationRule) -> dict:
    label, _ = TRIGGERS.get(rule.trigger, (rule.trigger, []))
    return {
        '_id': rule.id, 'trigger': rule.trigger, 'triggerLabel': label, 'channel': rule.channel,
        'isActive': rule.is_active,
        'template': {'_id': rule.template.id, 'name': rule.template.name} if rule.template_id and rule.template else None,
        'updatedBy': rule.updated_by.name if rule.updated_by_id and rule.updated_by else None,
        'updatedAt': rule.updated_at,
    }


def ensure_rules() -> None:
    """One rule per trigger × default channel (seed + first read)."""
    for trigger, (_, channels) in TRIGGERS.items():
        for channel in channels:
            AutomationRule.objects.get_or_create(trigger=trigger, channel=channel)


def list_rules() -> list[dict]:
    ensure_rules()
    order = list(TRIGGERS)
    rules = AutomationRule.objects.select_related('template', 'updated_by')
    return [rule_doc(r) for r in sorted(rules, key=lambda r: (order.index(r.trigger) if r.trigger in order else 99, r.channel))]


def update_rule(actor, rule_id: str, data: dict) -> dict:
    rule = AutomationRule.objects.filter(pk=rule_id).first()
    if not rule:
        raise ApiError.not_found('Automation not found')
    if 'template' in data:
        if data['template']:
            t = MessageTemplate.objects.filter(pk=data['template']).first()
            if not t or t.channel != rule.channel:
                raise ApiError.bad_request('Validation failed', {'template': f'Choose an active {rule.channel} template'})
            rule.template = t
        else:
            rule.template = None
    if 'isActive' in data:
        rule.is_active = bool(data['isActive'])
    if rule.is_active and not rule.template_id:
        raise ApiError.bad_request('Validation failed', {'template': 'Pick a template before switching it on'})
    rule.updated_by_id = actor.id
    rule.save()
    return rule_doc(AutomationRule.objects.select_related('template', 'updated_by').get(pk=rule.pk))
