"""
Master data (SOW §12): central configurable lists reused by dependent modules.
All masters share isActive + sortOrder so listing/ordering behaves the same everywhere.
"""
from django.db import models

from common.models import BaseModel, compact, ref

CHANNELS = ['paid', 'organic', 'referral', 'partner', 'direct', 'event', 'other']
COHORT_STATUSES = ['planned', 'open', 'closed', 'completed']
STAGE_TYPES = ['open', 'converted', 'lost']
CUSTOM_FIELD_TYPES = ['text', 'number', 'date', 'select', 'boolean']


def _choices(values):
    return [(v, v) for v in values]


class Source(BaseModel):
    name = models.CharField(max_length=100, unique=True)
    channel = models.CharField(max_length=20, choices=_choices(CHANNELS), default='other')
    description = models.CharField(max_length=500, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'sources'

    def to_dict(self) -> dict:
        return compact({
            '_id': self.id, 'name': self.name, 'channel': self.channel, 'description': self.description,
            'isActive': self.is_active, 'sortOrder': self.sort_order,
            'createdAt': self.created_at, 'updatedAt': self.updated_at,
        })


class Program(BaseModel):
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=20, unique=True)
    track = models.CharField(max_length=100, null=True, blank=True)
    duration_months = models.IntegerField(null=True, blank=True)
    description = models.CharField(max_length=1000, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'programs'

    def save(self, *args, **kwargs):
        self.code = (self.code or '').strip().upper()
        super().save(*args, **kwargs)

    def to_dict(self) -> dict:
        return compact({
            '_id': self.id, 'name': self.name, 'code': self.code, 'track': self.track,
            'durationMonths': self.duration_months, 'description': self.description,
            'isActive': self.is_active, 'sortOrder': self.sort_order,
            'createdAt': self.created_at, 'updatedAt': self.updated_at,
        })


class Cohort(BaseModel):
    name = models.CharField(max_length=100)
    program = models.ForeignKey(Program, on_delete=models.PROTECT, related_name='cohorts')
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)
    capacity = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=_choices(COHORT_STATUSES), default='planned')
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'cohorts'
        constraints = [models.UniqueConstraint(fields=['program', 'name'], name='cohort_program_name_unique')]

    def to_dict(self, populate_program: bool = True) -> dict:
        return compact({
            '_id': self.id, 'name': self.name,
            'program': ref(self.program, 'name', 'code') if populate_program else self.program_id,
            'startDate': self.start_date, 'endDate': self.end_date, 'capacity': self.capacity,
            'status': self.status, 'sortOrder': self.sort_order,
            'createdAt': self.created_at, 'updatedAt': self.updated_at,
        })


class Stage(BaseModel):
    name = models.CharField(max_length=100, unique=True)
    type = models.CharField(max_length=20, choices=_choices(STAGE_TYPES), default='open')
    color = models.CharField(max_length=20, null=True, blank=True)
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    # set only by the system (e.g. Untouched on create); counsellors cannot pick it
    is_system = models.BooleanField(default=False)

    class Meta:
        db_table = 'stages'

    def sub_stage_list(self) -> list['SubStage']:
        # uses prefetch_related('sub_stages') when present
        return sorted(self.sub_stages.all(), key=lambda s: (s.position, s.created_at))

    def to_dict(self) -> dict:
        return compact({
            '_id': self.id, 'name': self.name, 'type': self.type, 'color': self.color, 'order': self.order,
            'isActive': self.is_active, 'isSystem': self.is_system,
            'subStages': [s.to_dict() for s in self.sub_stage_list()],
            'createdAt': self.created_at, 'updatedAt': self.updated_at,
        })

    def to_ref(self) -> dict:
        """Shape used when a lead populates its stage."""
        return compact({
            '_id': self.id, 'name': self.name, 'color': self.color, 'type': self.type, 'order': self.order,
            'isSystem': self.is_system, 'subStages': [s.to_dict() for s in self.sub_stage_list()],
        })


class SubStage(BaseModel):
    """Sub-stage with the action a counsellor should take (Lead Stages sheet)."""

    stage = models.ForeignKey(Stage, on_delete=models.CASCADE, related_name='sub_stages')
    name = models.CharField(max_length=150)
    counsellor_action = models.CharField(max_length=1000, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    position = models.IntegerField(default=0)

    class Meta:
        db_table = 'sub_stages'
        ordering = ['position', 'created_at']

    def to_dict(self) -> dict:
        return compact({
            '_id': self.id, 'name': self.name, 'counsellorAction': self.counsellor_action, 'isActive': self.is_active,
        })


class Disposition(BaseModel):
    name = models.CharField(max_length=100, unique=True)
    category = models.CharField(max_length=100, null=True, blank=True)
    requires_follow_up = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'dispositions'

    def to_dict(self) -> dict:
        return compact({
            '_id': self.id, 'name': self.name, 'category': self.category, 'requiresFollowUp': self.requires_follow_up,
            'isActive': self.is_active, 'sortOrder': self.sort_order,
            'createdAt': self.created_at, 'updatedAt': self.updated_at,
        })


class Tag(BaseModel):
    name = models.CharField(max_length=50, unique=True)
    color = models.CharField(max_length=20, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'tags'

    def to_dict(self) -> dict:
        return compact({
            '_id': self.id, 'name': self.name, 'color': self.color,
            'isActive': self.is_active, 'sortOrder': self.sort_order,
            'createdAt': self.created_at, 'updatedAt': self.updated_at,
        })


class CustomFieldDef(BaseModel):
    """GCC-specific lead fields without code changes (SOW ID 15)."""

    key = models.CharField(max_length=50, unique=True)
    label = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=_choices(CUSTOM_FIELD_TYPES))
    options = models.JSONField(default=list)
    required = models.BooleanField(default=False)
    module = models.CharField(max_length=20, default='lead')
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'custom_field_defs'

    def to_dict(self) -> dict:
        return compact({
            '_id': self.id, 'key': self.key, 'label': self.label, 'type': self.type, 'options': self.options or [],
            'required': self.required, 'module': self.module, 'isActive': self.is_active, 'sortOrder': self.sort_order,
            'createdAt': self.created_at, 'updatedAt': self.updated_at,
        })
