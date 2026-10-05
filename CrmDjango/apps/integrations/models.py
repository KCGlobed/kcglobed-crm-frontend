"""Meta Lead Ads (Go-live GL-09): form mappings and the webhook event queue."""
from django.db import models

from common.models import BaseModel

# CRM fields a Meta form answer can be mapped to
MAPPABLE_FIELDS = {
    'full_name': 'Full name (split into first/last)',
    'first_name': 'First name',
    'last_name': 'Last name',
    'phone_number': 'Mobile',
    'email': 'Email',
    'city': 'City',
    'state': 'State',
    'program': 'Program interest (name or code)',
}

# Meta's standard question keys and the CRM field they map to unless a form says otherwise
DEFAULT_MAPPING = {
    'full_name': 'full_name',
    'first_name': 'first_name',
    'last_name': 'last_name',
    'phone_number': 'phone_number',
    'email': 'email',
    'city': 'city',
    'state': 'state',
}

RETRY_DELAYS_MINUTES = [1, 5, 15, 60]  # then the event goes to "Integration errors"


class MetaFormMapping(BaseModel):
    """Per Meta lead form: which answer feeds which CRM field (Super Admin screen)."""

    form_id = models.CharField(max_length=64, unique=True)
    form_name = models.CharField(max_length=255, null=True, blank=True)
    page_id = models.CharField(max_length=64, null=True, blank=True)
    # {meta question key: CRM field key from MAPPABLE_FIELDS}
    mapping = models.JSONField(default=dict)
    is_active = models.BooleanField(default=True)
    updated_by = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        db_table = 'meta_form_mappings'


class MetaLeadEvent(BaseModel):
    """
    One leadgen webhook event. The Meta lead id is unique, so a resent webhook
    is recognised and never creates a second lead.
    """

    leadgen_id = models.CharField(max_length=64, unique=True)
    page_id = models.CharField(max_length=64, null=True, blank=True)
    form_id = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    ad_id = models.CharField(max_length=64, null=True, blank=True)
    event_time = models.DateTimeField(null=True, blank=True)
    payload = models.JSONField(default=dict)
    # received → processed | duplicate ; failed (retrying) → error (gave up, shown to Super Admin)
    status = models.CharField(max_length=20, default='received', db_index=True)
    attempts = models.IntegerField(default=0)
    next_attempt_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_error = models.TextField(null=True, blank=True)
    lead = models.ForeignKey('leads.Lead', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'meta_lead_events'
