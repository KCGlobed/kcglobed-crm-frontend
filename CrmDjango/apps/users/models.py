from django.db import models

from common.models import BaseModel, compact, ref
from common.permissions_catalog import DATA_SCOPES
from common.roles import ROLE_LABELS, ROLES


class User(BaseModel):
    """
    CRM staff user. Access is per user: module → actions, a data scope and
    field rules (SOW "Roles & Access"); templates only pre-fill these.
    """

    name = models.CharField(max_length=100)
    email = models.CharField(max_length=254, unique=True)
    password_hash = models.CharField(max_length=128)
    mobile = models.CharField(max_length=16, null=True, blank=True)
    designation = models.CharField(max_length=100, null=True, blank=True)
    is_super_admin = models.BooleanField(default=False)
    # go-live role (super_admin / admin / counsellor); `other` = permission-builder access
    role = models.CharField(max_length=20, choices=[(r, r) for r in ROLES], default='other', db_index=True)
    # set for a new user or after "Resend credentials"; cleared by the first password change
    must_change_password = models.BooleanField(default=False)
    temp_password_expires_at = models.DateTimeField(null=True, blank=True)
    # when the user last (re)joined the round-robin order by logging in (GL-12)
    rr_joined_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    # participates in round-robin lead distribution
    receives_leads = models.BooleanField(default=False)
    team = models.ForeignKey('teams.Team', null=True, blank=True, on_delete=models.SET_NULL, related_name='members')
    reporting_manager = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL, related_name='direct_reports'
    )
    permissions = models.JSONField(default=list)
    data_scope = models.CharField(max_length=20, choices=[(s, s) for s in DATA_SCOPES], default='own')
    field_rules = models.JSONField(default=list)
    # template key the permissions were pre-filled from (display only)
    template_key = models.CharField(max_length=50, null=True, blank=True)
    last_login_at = models.DateTimeField(null=True, blank=True)
    password_reset_token_hash = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    password_reset_expires = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        db_table = 'users'
        indexes = [models.Index(fields=['is_active', 'receives_leads'])]

    def __str__(self):
        return self.email


def safe_user(user: User, *, team: str = 'id', manager: tuple[str, ...] | None = None, created_by: bool = False) -> dict:
    """
    The user as the API returns it — never the password or reset fields.

    `team='ref'` populates {_id, name}; `manager` lists the reportingManager
    fields to populate (None returns only its id).
    """
    if team == 'ref':
        team_value = ref(user.team, 'name') if user.team_id else None
    else:
        team_value = user.team_id
    if manager is not None:
        manager_value = ref(user.reporting_manager, *manager) if user.reporting_manager_id else None
    else:
        manager_value = user.reporting_manager_id
    return compact(
        {
            '_id': user.id,
            'name': user.name,
            'email': user.email,
            'mobile': user.mobile,
            'designation': user.designation,
            'isSuperAdmin': user.is_super_admin,
            'role': user.role,
            'roleLabel': ROLE_LABELS.get(user.role, user.role),
            'mustChangePassword': user.must_change_password,
            'isActive': user.is_active,
            'receivesLeads': user.receives_leads,
            'team': team_value,
            'reportingManager': manager_value,
            'permissions': user.permissions or [],
            'dataScope': user.data_scope,
            'fieldRules': user.field_rules or [],
            'templateKey': user.template_key,
            'lastLoginAt': user.last_login_at,
            'createdBy': ref(user.created_by, 'name') if created_by and user.created_by_id else user.created_by_id,
            'createdAt': user.created_at,
            'updatedAt': user.updated_at,
        }
    )


class PermissionTemplate(BaseModel):
    key = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=500, null=True, blank=True)
    permissions = models.JSONField(default=list)
    data_scope = models.CharField(max_length=20, default='own')
    field_rules = models.JSONField(default=list)
    # seeded system templates cannot be deleted, only edited
    is_system = models.BooleanField(default=False)

    class Meta:
        db_table = 'permission_templates'

    def to_dict(self) -> dict:
        return compact(
            {
                '_id': self.id,
                'key': self.key,
                'name': self.name,
                'description': self.description,
                'permissions': self.permissions or [],
                'dataScope': self.data_scope,
                'fieldRules': self.field_rules or [],
                'isSystem': self.is_system,
                'createdAt': self.created_at,
                'updatedAt': self.updated_at,
            }
        )
