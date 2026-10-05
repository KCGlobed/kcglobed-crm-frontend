from django.db import models

from common.models import BaseModel


class Session(BaseModel):
    """One refresh-token session per login (SOW ID 6: session tracking)."""

    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='sessions')
    refresh_token_hash = models.CharField(max_length=64, db_index=True)
    user_agent = models.CharField(max_length=500, null=True, blank=True)
    ip = models.CharField(max_length=64, null=True, blank=True)
    expires_at = models.DateTimeField(db_index=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    # last user-driven request (background polls don't count) — idle logout after 30 min (GL-05)
    last_seen_at = models.DateTimeField(null=True, blank=True, db_index=True)
    logged_out_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'sessions'
