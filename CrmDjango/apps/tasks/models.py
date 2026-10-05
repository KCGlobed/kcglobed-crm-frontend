"""
Follow-ups / tasks on a lead (Deep Dive: Lead Management §10.2).
Every open lead should have a dated next action; reminders and overdue alerts
are sent by apps.tasks.reminders.
"""
from django.db import models
from django.utils import timezone

from common.models import BaseModel

# Go-live GL-36: the six follow-up types
TASK_TYPES = {
    'call_back': 'Call back',
    'follow_up_call': 'Follow-up call',
    'counselling_session': 'Counselling session',
    'expert_one_on_one': 'Expert one-on-one',
    'document_collection': 'Document collection',
    'other': 'Other',
}
PRIORITIES = ['high', 'normal']
REMINDER_OPTIONS = [5, 15, 30, 60]  # minutes before the due time
STATUSES = ['open', 'done', 'cancelled']


class Task(BaseModel):
    lead = models.ForeignKey('leads.Lead', on_delete=models.CASCADE, related_name='tasks')
    type = models.CharField(max_length=30, choices=list(TASK_TYPES.items()))
    due_at = models.DateTimeField(db_index=True)
    assignee = models.ForeignKey('users.User', on_delete=models.PROTECT, related_name='tasks')
    priority = models.CharField(max_length=10, default='normal')
    reminder_minutes = models.IntegerField(default=15)
    notes = models.CharField(max_length=500, null=True, blank=True)
    status = models.CharField(max_length=10, default='open', db_index=True)
    outcome = models.CharField(max_length=500, null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    created_by = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    # notification bookkeeping — each alert is sent once per due time
    reminder_sent_at = models.DateTimeField(null=True, blank=True)
    overdue_notified_at = models.DateTimeField(null=True, blank=True)
    escalated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'tasks'
        indexes = [
            models.Index(fields=['assignee', 'status', 'due_at']),
            models.Index(fields=['lead', 'status']),
        ]

    @property
    def is_overdue(self) -> bool:
        return self.status == 'open' and self.due_at < timezone.now()

    @property
    def type_label(self) -> str:
        return TASK_TYPES.get(self.type, self.type)
