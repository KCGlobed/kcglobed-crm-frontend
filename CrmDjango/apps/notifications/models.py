from django.db import models

from common.models import CreatedOnlyModel, compact

NOTIFICATION_TYPES = [
    'lead_assigned', 'lead_reassigned', 'task_due', 'task_overdue', 'payment',
    'application', 'interview', 'exam', 'system',
    # Go-live GL-30
    're_enquiry', 'unassigned_pool', 'language_barrier', 'untouched', 'bulk_done', 'export_ready',
    'integration_error',
]


class Notification(CreatedOnlyModel):
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=30, choices=[(t, t) for t in NOTIFICATION_TYPES])
    title = models.CharField(max_length=300)
    body = models.TextField(null=True, blank=True)
    data = models.JSONField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'notifications'
        indexes = [models.Index(fields=['user', 'read_at', '-created_at'])]

    def to_dict(self) -> dict:
        return compact({
            '_id': self.id, 'user': self.user_id, 'type': self.type, 'title': self.title, 'body': self.body,
            'data': self.data, 'readAt': self.read_at, 'createdAt': self.created_at,
        })
