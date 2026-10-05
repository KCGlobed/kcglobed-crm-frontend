from django.db import models
from django.db.models import Q

from common.models import BaseModel

# SOW ID 4: departments, teams and counsellor groups share one hierarchy.
TEAM_TYPES = ['department', 'team', 'counsellor_group']


class Team(BaseModel):
    name = models.CharField(max_length=100, unique=True)
    # short unique code used in reports and exports, e.g. ADM-MUM
    code = models.CharField(max_length=20, null=True, blank=True)
    type = models.CharField(max_length=20, choices=[(t, t) for t in TEAM_TYPES], default='team')
    description = models.CharField(max_length=500, null=True, blank=True)
    manager = models.ForeignKey(
        'users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='managed_teams'
    )
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='children')
    location = models.CharField(max_length=100, null=True, blank=True)
    # programs this team handles — groundwork for program routing (SOW ID 72)
    programs = models.ManyToManyField('masters.Program', blank=True, related_name='teams')
    # when false, members are skipped by round-robin even if they receive leads
    receives_leads = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        db_table = 'teams'
        constraints = [models.UniqueConstraint(fields=['code'], condition=Q(code__isnull=False), name='team_code_unique')]
