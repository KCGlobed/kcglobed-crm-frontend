from django.db import models

from common.models import CreatedOnlyModel, compact, ref


class AuditLog(CreatedOnlyModel):
    actor = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    actor_name = models.CharField(max_length=100)
    action = models.CharField(max_length=50, db_index=True)
    module = models.CharField(max_length=30, db_index=True)
    entity_type = models.CharField(max_length=50, null=True, blank=True)
    entity_id = models.CharField(max_length=50, null=True, blank=True)
    before = models.JSONField(null=True, blank=True)
    after = models.JSONField(null=True, blank=True)
    ip = models.CharField(max_length=64, null=True, blank=True)
    user_agent = models.CharField(max_length=500, null=True, blank=True)

    class Meta:
        db_table = 'audit_logs'
        indexes = [models.Index(fields=['module', '-created_at']), models.Index(fields=['actor', '-created_at'])]

    def to_dict(self) -> dict:
        return compact({
            '_id': self.id,
            'actor': ref(self.actor, 'name', 'email') if self.actor_id else None,
            'actorName': self.actor_name, 'action': self.action, 'module': self.module,
            'entityType': self.entity_type, 'entityId': self.entity_id,
            'before': self.before, 'after': self.after, 'ip': self.ip, 'userAgent': self.user_agent,
            'createdAt': self.created_at,
        })
