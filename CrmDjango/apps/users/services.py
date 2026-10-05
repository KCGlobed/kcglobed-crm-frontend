from django.db.models import Q

from apps.authentication.passwords import hash_password
from apps.authentication.services import issue_credentials, revoke_sessions
from common.exceptions import ApiError
from common.pagination import ListQuery
from common.roles import COUNSELLOR, OTHER, ROLE_ACCESS, ROLE_LABELS, can_manage, creatable_roles

from .models import User, safe_user

# API field → model field (payloads use the camelCase names)
USER_FIELDS = {
    'name': 'name',
    'mobile': 'mobile',
    'designation': 'designation',
    'isActive': 'is_active',
    'receivesLeads': 'receives_leads',
    'team': 'team_id',
    'reportingManager': 'reporting_manager_id',
    'templateKey': 'template_key',
    'permissions': 'permissions',
    'dataScope': 'data_scope',
    'fieldRules': 'field_rules',
}
SORT_FIELDS = {'createdAt': 'created_at', 'lastLoginAt': 'last_login_at'}


def _assign(user: User, payload: dict) -> None:
    for key, field in USER_FIELDS.items():
        if key in payload:
            value = payload[key]
            if key in ('permissions', 'fieldRules'):
                value = [dict(item) for item in value]
            setattr(user, field, value)


def _apply_role(user: User, role: str) -> None:
    """A go-live role fixes permissions and data scope (§3); custom access keeps what was ticked."""
    user.role = role
    access = ROLE_ACCESS.get(role)
    if access:
        user.permissions = access['permissions']
        user.data_scope = access['data_scope']
        user.field_rules = []
        user.template_key = None


def _check_refs(payload: dict) -> None:
    """Unknown team/manager ids are rejected instead of failing on the FK."""
    from apps.teams.models import Team

    if payload.get('team') and not Team.objects.filter(pk=payload['team']).exists():
        raise ApiError.bad_request('Validation failed', {'team': 'Team not found'})
    if payload.get('reportingManager') and not User.objects.filter(pk=payload['reportingManager']).exists():
        raise ApiError.bad_request('Validation failed', {'reportingManager': 'User not found'})


def _managed_user(actor, user_id: str) -> User:
    """The target user, if the caller's role may manage it (Admin → counsellors only)."""
    user = User.objects.select_related('created_by').filter(pk=user_id).first()
    if not user:
        raise ApiError.not_found('User not found')
    if not actor.is_super_admin and not can_manage(actor, user.role):
        raise ApiError.forbidden('You can only manage Admission Counsellors')
    return user


def visible_users(actor):
    """GL-03 / §3: Super Admin sees everyone, Admin sees counsellors."""
    qs = User.objects.all()
    if actor.is_super_admin:
        return qs
    roles = creatable_roles(actor)
    return qs.filter(role__in=roles) if roles else qs


def list_users(actor, query: ListQuery, params) -> tuple[list[dict], int]:
    qs = visible_users(actor).select_related('team', 'reporting_manager', 'created_by')
    if query.search:
        s = query.search
        qs = qs.filter(Q(name__icontains=s) | Q(email__icontains=s) | Q(mobile__icontains=s) | Q(designation__icontains=s))
    if params.get('team'):
        qs = qs.filter(team_id=params['team'])
    if params.get('role'):
        qs = qs.filter(role=params['role'])
    if params.get('is_active') == 'true':
        qs = qs.filter(is_active=True)
    if params.get('is_active') == 'false':
        qs = qs.filter(is_active=False)
    if params.get('receives_leads') == 'true':
        qs = qs.filter(receives_leads=True)
    total = qs.count()
    items = query.slice(qs.order_by(*query.order(SORT_FIELDS)))
    return [safe_user(u, team='ref', manager=('name',), created_by=True) for u in items], total


def create_user(payload: dict, actor) -> dict:
    custom_access = any(k in payload for k in ('permissions', 'dataScope', 'fieldRules', 'templateKey'))
    role = payload.get('role') or (OTHER if custom_access else COUNSELLOR)
    if payload.get('isSuperAdmin') and not actor.is_super_admin:
        raise ApiError.forbidden('Only a super admin can create another super admin')
    if not actor.is_super_admin and not can_manage(actor, role):
        raise ApiError.forbidden(f'You cannot create a user with the role {ROLE_LABELS.get(role, role)}')
    email = payload['email'].lower()
    if User.objects.filter(email=email).exists():
        raise ApiError.conflict('A user with this email already exists', {'email': 'A user with this email already exists'})
    _check_refs(payload)

    user = User(email=email, created_by_id=actor.id, is_super_admin=bool(payload.get('isSuperAdmin')))
    _assign(user, payload)
    _apply_role(user, role)
    if 'receivesLeads' not in payload:
        user.receives_leads = role == COUNSELLOR
    password = payload.get('password')
    user.password_hash = hash_password(password) if password else '!'
    user.save()
    if not password:
        issue_credentials(user)  # GL-02: emailed temporary password, change at first login
        user.refresh_from_db()
    return safe_user(user, created_by=True)


def get_user(actor, user_id: str) -> dict:
    user = visible_users(actor).select_related('team', 'reporting_manager', 'created_by').filter(pk=user_id).first()
    if not user:
        raise ApiError.not_found('User not found')
    return safe_user(user, team='ref', manager=('name', 'email'), created_by=True)


def update_user(user_id: str, payload: dict, actor) -> tuple[dict, dict]:
    user = _managed_user(actor, user_id)
    if 'email' in payload and payload['email'].lower() != user.email:
        raise ApiError.bad_request('Validation failed', {'email': 'Email cannot be changed after the user is created'})
    if 'isSuperAdmin' in payload and not actor.is_super_admin:
        raise ApiError.forbidden('Only a super admin can change admin status')
    if 'role' in payload and payload['role'] != user.role and not actor.is_super_admin:
        raise ApiError.forbidden('Only a super admin can change a role')
    if actor.id == user_id and payload.get('isActive') is False:
        raise ApiError.bad_request('You cannot deactivate your own account')
    if actor.id == user_id and payload.get('isSuperAdmin') is False:
        raise ApiError.bad_request('You cannot remove your own super admin access')
    _check_refs(payload)

    before = safe_user(user)
    _assign(user, payload)
    if 'isSuperAdmin' in payload:
        user.is_super_admin = payload['isSuperAdmin']
    if 'role' in payload:
        _apply_role(user, payload['role'])
    elif user.role in ROLE_ACCESS and any(k in payload for k in ('permissions', 'dataScope', 'fieldRules')):
        user.role = OTHER  # hand-edited access is no longer the standard role set
    if payload.get('password'):
        user.password_hash = hash_password(payload['password'])
        user.must_change_password = False
        user.temp_password_expires_at = None
    user.save()
    if payload.get('isActive') is False:
        revoke_sessions(user.id)
    return safe_user(user, created_by=True), before


def set_permissions(user_id: str, payload: dict, actor) -> tuple[dict, dict]:
    user = _managed_user(actor, user_id)
    before = {
        'permissions': user.permissions,
        'dataScope': user.data_scope,
        'fieldRules': user.field_rules,
        'templateKey': user.template_key,
    }
    user.permissions = [dict(p) for p in payload['permissions']]
    user.data_scope = payload['dataScope']
    user.field_rules = [dict(r) for r in payload.get('fieldRules') or []]
    user.template_key = payload.get('templateKey') or None
    if user.role in ROLE_ACCESS:
        user.role = OTHER
    user.save()
    return safe_user(user), before


def set_active(user_id: str, active: bool, actor) -> dict:
    """GL-03/04: deactivate (logged out at once, no login, off round-robin) or reactivate; never deleted."""
    if user_id == actor.id and not active:
        raise ApiError.bad_request('You cannot deactivate your own account')
    user = _managed_user(actor, user_id)
    user.is_active = active
    user.save(update_fields=['is_active', 'updated_at'])
    if not active:
        revoke_sessions(user.id)
    return safe_user(user, created_by=True)


def resend_credentials(user_id: str, actor) -> dict:
    user = _managed_user(actor, user_id)
    if not user.is_active:
        raise ApiError.unprocessable('Reactivate the user before sending new credentials')
    issue_credentials(user)
    user.refresh_from_db()
    return safe_user(user, created_by=True)
