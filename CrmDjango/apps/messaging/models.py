"""
SMS and email (Go-live §8): templates, every message sent, bulk campaigns and
event automations. Channel-agnostic so WhatsApp plugs in as a third channel (GL-39).
"""
from django.db import models

from common.models import BaseModel

CHANNELS = ['sms', 'email', 'whatsapp']
LIVE_CHANNELS = ['sms', 'email']  # WhatsApp after the vendor is chosen
PLACEHOLDERS = ['first_name', 'last_name', 'counsellor_name', 'counsellor_mobile', 'program_interest', 'lead_id']

MESSAGE_STATUSES = ['queued', 'sent', 'delivered', 'failed', 'bounced', 'skipped']

# GL-24 triggers: key → (label, default channels)
TRIGGERS = {
    'lead_created': ('New lead created (Meta, Quick Add)', ['sms', 'email']),
    'lead_created_bulk': ('New lead from bulk upload (only if "Send welcome message" is ticked)', ['sms', 'email']),
    'lead_assigned': ('Lead assigned / reassigned — counsellor name and number', ['sms']),
    'first_not_connected': ('First "Not connected" disposition — "We tried to reach you"', ['sms']),
    'stage_interested': ('Stage → Interested — program details', ['email']),
    'stage_application_submitted': ('Stage → Application Submitted — acknowledgement', ['sms', 'email']),
    're_enquired': ('Re-enquired — "Your counsellor will call you shortly"', ['sms']),
}


class MessageTemplate(BaseModel):
    """GL-21. SMS templates carry the DLT template id and sender id (TRAI)."""

    name = models.CharField(max_length=120)
    channel = models.CharField(max_length=10, choices=[(c, c) for c in CHANNELS])
    subject = models.CharField(max_length=200, null=True, blank=True)  # email only
    body = models.TextField()  # SMS text, or the email's rich-text HTML
    dlt_template_id = models.CharField(max_length=40, null=True, blank=True)
    sender_id = models.CharField(max_length=20, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        db_table = 'message_templates'
        constraints = [models.UniqueConstraint(fields=['channel', 'name'], name='template_channel_name_unique')]


class Campaign(BaseModel):
    """GL-23 bulk send: a template to a filtered/selected set of leads, now or scheduled."""

    name = models.CharField(max_length=150)
    channel = models.CharField(max_length=10)
    template = models.ForeignKey(MessageTemplate, on_delete=models.PROTECT, related_name='campaigns')
    # how the audience was picked (lead ids, or the list's filters) — kept for the report
    audience = models.JSONField(default=dict)
    # draft → scheduled → sending → done | cancelled
    status = models.CharField(max_length=20, default='scheduled', db_index=True)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    # {selected, excluded: {optedOut, invalid, duplicate}, final}
    counts = models.JSONField(default=dict)
    created_by = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        db_table = 'campaigns'


class Message(BaseModel):
    """Every SMS/email the CRM sends; the lead's timeline entry follows its delivery status."""

    lead = models.ForeignKey('leads.Lead', on_delete=models.CASCADE, related_name='messages')
    channel = models.CharField(max_length=10)
    template = models.ForeignKey(MessageTemplate, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    campaign = models.ForeignKey(Campaign, null=True, blank=True, on_delete=models.CASCADE, related_name='messages')
    trigger = models.CharField(max_length=40, null=True, blank=True)  # automation trigger key
    to_address = models.CharField(max_length=254)
    subject = models.CharField(max_length=200, null=True, blank=True)
    body = models.TextField()
    status = models.CharField(max_length=20, default='queued', db_index=True)
    error = models.TextField(null=True, blank=True)
    provider = models.CharField(max_length=30, null=True, blank=True)
    provider_message_id = models.CharField(max_length=120, null=True, blank=True, db_index=True)
    sent_by = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    sent_by_label = models.CharField(max_length=100, null=True, blank=True)  # user name or "Automation"
    activity = models.ForeignKey('leads.LeadActivity', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'messages'
        indexes = [models.Index(fields=['lead', '-created_at']), models.Index(fields=['lead', 'trigger', 'created_at'])]


class AutomationRule(BaseModel):
    """GL-24: one row per trigger and channel — on/off and the template it sends."""

    trigger = models.CharField(max_length=40)
    channel = models.CharField(max_length=10)
    is_active = models.BooleanField(default=False)
    template = models.ForeignKey(MessageTemplate, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    updated_by = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        db_table = 'automation_rules'
        constraints = [models.UniqueConstraint(fields=['trigger', 'channel'], name='automation_trigger_channel_unique')]
