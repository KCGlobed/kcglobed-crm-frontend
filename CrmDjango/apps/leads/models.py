from django.db import models, transaction
from django.db.models import F, Q

from common.models import BaseModel, CreatedOnlyModel

LEAD_STATUSES = ['active', 'converted', 'lost']
LEAD_TRACKS = ['ads', 'partner', 'other']
LEAD_CHANNELS_IN = ['manual', 'capture', 'import', 'meta', 'google']
ACTIVITY_TYPES = [
    'created', 'note', 'call', 'task', 'stage_change', 'assignment', 'communication',
    'document', 'payment', 'edit', 'import', 'system',
]


def default_consent():
    return {'email': True, 'sms': True, 'whatsapp': True}


class Lead(BaseModel):
    lead_no = models.CharField(max_length=20, unique=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, null=True, blank=True)
    email = models.CharField(max_length=254, null=True, blank=True)
    mobile = models.CharField(max_length=20)
    alt_mobile = models.CharField(max_length=16, null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    state = models.CharField(max_length=100, null=True, blank=True)
    country = models.CharField(max_length=100, null=True, blank=True, default='India')

    # first-touch attribution is immutable after creation (SOW ID 38)
    first_source = models.ForeignKey('masters.Source', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    # latest-touch source, updated on re-enquiry (SOW ID 19/39)
    source = models.ForeignKey('masters.Source', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    utm = models.JSONField(default=dict)
    referral = models.JSONField(default=dict)
    track = models.CharField(max_length=10, default='other')

    program_interest = models.ForeignKey('masters.Program', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    cohort = models.ForeignKey('masters.Cohort', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    stage = models.ForeignKey('masters.Stage', null=True, blank=True, on_delete=models.SET_NULL, related_name='leads')
    sub_stage = models.ForeignKey('masters.SubStage', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    stage_changed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, default='active', db_index=True)
    last_disposition = models.CharField(max_length=100, null=True, blank=True)

    owner = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='owned_leads')
    assigned_at = models.DateTimeField(null=True, blank=True)
    # Untouched alerts (GL-30): 30 min → counsellor, 2 h → counsellor + Admin; cleared on (re)assignment
    untouched_early_alerted_at = models.DateTimeField(null=True, blank=True)
    untouched_alerted_at = models.DateTimeField(null=True, blank=True)

    # duplicate rule (GL-08): a repeat enquiry updates this lead instead of creating one
    re_enquiry_count = models.IntegerField(default=0)
    last_enquired_at = models.DateTimeField(null=True, blank=True)

    # Meta Lead Ads attribution (GL-09); the Meta lead id makes webhook retries idempotent
    meta_lead_id = models.CharField(max_length=64, null=True, blank=True)
    meta_form_id = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    meta = models.JSONField(default=dict)  # campaign / ad set / ad / form ids and names, created time
    upload_file_name = models.CharField(max_length=255, null=True, blank=True, db_index=True)

    # attempt limit (GL-18): consecutive "Not connected" dispositions since the last connect
    not_connected_streak = models.IntegerField(default=0)
    not_connected_since = models.DateTimeField(null=True, blank=True)

    tags = models.ManyToManyField('masters.Tag', blank=True, related_name='leads')
    score = models.IntegerField(default=0)
    consent = models.JSONField(default=default_consent)
    custom_fields = models.JSONField(default=dict)

    last_activity_at = models.DateTimeField(null=True, blank=True)
    created_via = models.CharField(max_length=10, default='manual')
    created_by = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        db_table = 'leads'
        constraints = [
            # Duplicate blocking (SOW ID 16): unique among non-deleted leads.
            models.UniqueConstraint(fields=['mobile'], condition=Q(is_deleted=False), name='lead_mobile_unique_live'),
            models.UniqueConstraint(
                fields=['email'], condition=Q(is_deleted=False, email__isnull=False), name='lead_email_unique_live'
            ),
            models.UniqueConstraint(fields=['meta_lead_id'], condition=Q(meta_lead_id__isnull=False), name='lead_meta_id_unique'),
        ]
        indexes = [
            models.Index(fields=['owner', 'stage']),
            models.Index(fields=['stage']),
            models.Index(fields=['source']),
            models.Index(fields=['first_name', 'last_name']),
            models.Index(fields=['last_activity_at']),
            models.Index(fields=['city']),
        ]

    @property
    def full_name(self) -> str:
        return ' '.join(p for p in [self.first_name, self.last_name] if p)


class LeadActivity(CreatedOnlyModel):
    """Chronological lead timeline (SOW ID 27)."""

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='activities')
    type = models.CharField(max_length=20)
    title = models.CharField(max_length=300)
    description = models.TextField(null=True, blank=True)
    data = models.JSONField(null=True, blank=True)
    actor = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    actor_type = models.CharField(max_length=10, default='system')
    actor_name = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = 'lead_activities'
        indexes = [models.Index(fields=['lead', '-created_at'])]


class Note(BaseModel):
    """Structured + free-text lead notes (SOW ID 28)."""

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='notes')
    body = models.TextField()
    category = models.CharField(max_length=100, null=True, blank=True)
    created_by = models.ForeignKey('users.User', on_delete=models.PROTECT, related_name='+')

    class Meta:
        db_table = 'notes'
        indexes = [models.Index(fields=['lead', '-created_at'])]


class Counter(models.Model):
    """Atomic sequence for human-readable numbers like LD-000123."""

    key = models.CharField(max_length=50, primary_key=True)
    seq = models.IntegerField(default=0)

    class Meta:
        db_table = 'counters'

    @classmethod
    def next_range(cls, key: str, count: int = 1) -> int:
        """Reserves `count` values and returns the first one."""
        with transaction.atomic():
            cls.objects.get_or_create(key=key)
            cls.objects.filter(key=key).update(seq=F('seq') + count)
            seq = cls.objects.get(key=key).seq
        return seq - count + 1


class RoundRobinState(models.Model):
    """Pointer for fair rotation (SOW ID 71: round-robin lead distribution)."""

    key = models.CharField(max_length=50, unique=True)
    last_user = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    # '<joined-at>|<user id>' of the last slot handed out (see apps.leads.assignment)
    last_position = models.CharField(max_length=80, null=True, blank=True)

    class Meta:
        db_table = 'round_robin_state'


class LeadProfile(BaseModel):
    """
    Student profile (Deep Dive: Lead Management Module §4.2), one per lead.
    Sections mirror the form steps: personal + guardian (step 1), academic (2),
    work (3), declaration (4). Each section is validated per step and stored as JSON.
    """

    lead = models.OneToOneField(Lead, on_delete=models.CASCADE, related_name='profile')
    personal = models.JSONField(null=True, blank=True)
    guardian = models.JSONField(null=True, blank=True)
    academic = models.JSONField(null=True, blank=True)
    work = models.JSONField(null=True, blank=True)
    # {accepted, acceptedAt, acceptedBy, textVersion}
    declaration = models.JSONField(null=True, blank=True)
    # set after the declaration (LM-17); only an admin can unlock
    locked = models.BooleanField(default=False)
    unlock_history = models.JSONField(default=list)
    completion_percent = models.IntegerField(default=0, db_index=True)  # stored for list filters (GL-34)
    updated_by = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        db_table = 'lead_profiles'


class FieldChange(CreatedOnlyModel):
    """
    GL-27 History tab: every field change on a lead — lead, student profile,
    counsellor discussion and system fields — with old value, new value, who, when.
    """

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='field_changes')
    section = models.CharField(max_length=20)  # lead | profile | discussion | system
    field = models.CharField(max_length=80)
    label = models.CharField(max_length=150)
    old_value = models.TextField(null=True, blank=True)
    new_value = models.TextField(null=True, blank=True)
    changed_by = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    changed_by_name = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = 'lead_field_changes'
        indexes = [models.Index(fields=['lead', '-created_at'])]


class Call(BaseModel):
    """
    GL-40: one row per call. Logged manually from the disposition popup until a
    dialer is connected; the dialer columns are ready for its data.
    """

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='calls')
    user = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='calls')
    direction = models.CharField(max_length=10, default='outbound')  # outbound | inbound
    status = models.CharField(max_length=20, default='answered')  # answered | not_answered | busy | failed
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.IntegerField(null=True, blank=True)  # talk time
    recording_url = models.CharField(max_length=500, null=True, blank=True)
    dialer_call_id = models.CharField(max_length=100, null=True, blank=True)
    source = models.CharField(max_length=20, default='manual')  # manual | dialer
    # the disposition saved with the call
    stage = models.ForeignKey('masters.Stage', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    sub_stage = models.ForeignKey('masters.SubStage', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    note = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'calls'
        indexes = [models.Index(fields=['lead', '-created_at'])]


DOCUMENT_TYPES = {
    'aadhaar': 'Aadhaar Card',
    'pan': 'PAN Card',
    'class10_marksheet': 'Class 10th Marksheet',
    'class12_marksheet': 'Class 12th Marksheet',
    'graduation_marksheet': 'Graduation Marksheet / Result',
    'photo': 'Photograph',
    'signature': 'Signature',
    'resume': 'Resume',
}


class LeadDocument(BaseModel):
    """Student profile documents (#34–#41). Replacing a document keeps the old one in history."""

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='documents')
    doc_type = models.CharField(max_length=30)
    file = models.FileField(upload_to='lead-documents/%Y/%m/')
    original_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100)
    size = models.IntegerField()
    is_current = models.BooleanField(default=True)
    uploaded_by = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        db_table = 'lead_documents'
        indexes = [models.Index(fields=['lead', 'doc_type', 'is_current'])]


class LeadDiscussion(BaseModel):
    """GL-15: the 27 counsellor custom fields, filled during or after the call (internal only)."""

    lead = models.OneToOneField(Lead, on_delete=models.CASCADE, related_name='discussion')
    data = models.JSONField(default=dict)
    completion_percent = models.IntegerField(default=0, db_index=True)
    updated_by = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        db_table = 'lead_discussions'


class SavedFilter(BaseModel):
    """GL-34: "My saved filters" — a user's named filter combination for the lead list."""

    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='saved_filters')
    name = models.CharField(max_length=80)
    params = models.JSONField(default=dict)

    class Meta:
        db_table = 'saved_filters'
        constraints = [models.UniqueConstraint(fields=['user', 'name'], name='saved_filter_name_unique')]


class ExportJob(BaseModel):
    """GL-38: exports above the direct-download limit are prepared in the background."""

    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='export_jobs')
    status = models.CharField(max_length=20, default='queued')  # queued | running | done | failed
    params = models.JSONField(default=dict)
    format = models.CharField(max_length=5, default='xlsx')
    file = models.FileField(upload_to='exports/%Y/%m/', null=True, blank=True)
    row_count = models.IntegerField(default=0)
    error = models.TextField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'export_jobs'
