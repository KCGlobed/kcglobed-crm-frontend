from apps.audit.services import audit
from common.exceptions import ApiError
from common.pagination import parse_list_query
from common.responses import build_pagination, created, ok
from common.validation import validated
from common.views import ApiView

from . import services
from .models import PermissionTemplate, User
from .serializers import CreateUserSerializer, PermissionTemplateSerializer, SetPermissionsSerializer, UpdateUserSerializer


class UserOptionsView(ApiView):
    """Active users for owner dropdowns — any signed-in user, regardless of users.view."""

    def get(self, request):
        users = User.objects.filter(is_active=True).order_by('name')
        data = [
            {
                '_id': u.id,
                'name': u.name,
                'email': u.email,
                'receivesLeads': u.receives_leads,
                'role': u.role,
                **({'team': u.team_id} if u.team_id else {}),
                **({'designation': u.designation} if u.designation else {}),
            }
            for u in users
        ]
        return ok('User options fetched successfully', data)


class UserListView(ApiView):
    required_permissions = {'GET': ('users', 'view'), 'POST': ('users', 'create')}

    def get(self, request):
        query = parse_list_query(request, ['name', 'email', 'createdAt', 'lastLoginAt'])
        items, total = services.list_users(request.user, query, request.query_params)
        return ok('Users fetched successfully', items, build_pagination(total, query.page, query.page_size))

    def post(self, request):
        data = validated(CreateUserSerializer, request.data)
        user = services.create_user(dict(data), request.user)
        audit(request, 'create', 'users', 'User', user['_id'], after=user)
        message = 'User created successfully'
        if user.get('mustChangePassword'):
            message = f"User created — login credentials emailed to {user['email']}"
        return created(message, user)


class UserDetailView(ApiView):
    required_permissions = {'GET': ('users', 'view'), 'PUT': ('users', 'edit'), 'DELETE': ('users', 'delete')}

    def get(self, request, user_id):
        return ok('User fetched successfully', services.get_user(request.user, user_id))

    def put(self, request, user_id):
        data = validated(UpdateUserSerializer, request.data, partial=True)
        user, before = services.update_user(user_id, dict(data), request.user)
        audit(request, 'update', 'users', 'User', user_id, before=before, after=user)
        return ok('User updated successfully', user)

    def delete(self, request, user_id):
        user = services.set_active(user_id, False, request.user)
        audit(request, 'deactivate', 'users', 'User', user_id)
        return ok('User deactivated successfully', user)


class UserReactivateView(ApiView):
    required_permissions = {'POST': ('users', 'edit')}

    def post(self, request, user_id):
        user = services.set_active(user_id, True, request.user)
        audit(request, 'reactivate', 'users', 'User', user_id)
        return ok('User reactivated successfully', user)


class ResendCredentialsView(ApiView):
    """GL-02: a new 48-hour temporary password, emailed; the old one stops working."""

    required_permissions = {'POST': ('users', 'edit')}

    def post(self, request, user_id):
        user = services.resend_credentials(user_id, request.user)
        audit(request, 'resend_credentials', 'users', 'User', user_id)
        return ok(f"New login credentials emailed to {user['email']}", user)


class UserPermissionsView(ApiView):
    required_permissions = {'POST': ('users', 'edit')}

    def post(self, request, user_id):
        data = validated(SetPermissionsSerializer, request.data)
        user, before = services.set_permissions(user_id, data, request.user)
        audit(request, 'set_permissions', 'users', 'User', user_id, before=before, after={
            'permissions': data['permissions'],
            'dataScope': data['dataScope'],
            'fieldRules': data.get('fieldRules'),
            'templateKey': data.get('templateKey'),
        })
        return ok('Permissions updated successfully', user)


TEMPLATE_FIELDS = {
    'name': 'name', 'description': 'description', 'permissions': 'permissions',
    'dataScope': 'data_scope', 'fieldRules': 'field_rules',
}


def _apply_template(template: PermissionTemplate, data: dict) -> None:
    for key, field in TEMPLATE_FIELDS.items():
        if key in data:
            value = data[key]
            if key in ('permissions', 'fieldRules'):
                value = [dict(v) for v in value]
            setattr(template, field, value)


class TemplateListView(ApiView):
    required_permissions = {'GET': ('users', 'view'), 'POST': ('users', 'create')}

    def get(self, request):
        templates = PermissionTemplate.objects.order_by('-is_system', 'name')
        return ok('Permission templates fetched successfully', [t.to_dict() for t in templates])

    def post(self, request):
        data = validated(PermissionTemplateSerializer, request.data)
        if PermissionTemplate.objects.filter(key=data['key']).exists():
            raise ApiError.conflict('A template with this key already exists', {'key': 'A template with this key already exists'})
        template = PermissionTemplate(key=data['key'], is_system=False)
        _apply_template(template, data)
        template.save()
        audit(request, 'create', 'users', 'PermissionTemplate', template.id, after=template.to_dict())
        return created('Template created successfully', template.to_dict())


class TemplateDetailView(ApiView):
    required_permissions = {'PUT': ('users', 'edit'), 'DELETE': ('users', 'delete')}

    def _get(self, template_id) -> PermissionTemplate:
        template = PermissionTemplate.objects.filter(pk=template_id).first()
        if not template:
            raise ApiError.not_found('Template not found')
        return template

    def put(self, request, template_id):
        template = self._get(template_id)
        data = validated(PermissionTemplateSerializer, request.data, partial=True)
        before = template.to_dict()
        _apply_template(template, data)  # `key` cannot change
        template.save()
        audit(request, 'update', 'users', 'PermissionTemplate', template.id, before=before, after=template.to_dict())
        return ok('Template updated successfully', template.to_dict())

    def delete(self, request, template_id):
        template = self._get(template_id)
        if template.is_system:
            raise ApiError.unprocessable('System templates cannot be deleted — edit them instead')
        before = template.to_dict()
        template.delete()
        audit(request, 'delete', 'users', 'PermissionTemplate', template_id, before=before)
        return ok('Template deleted successfully', None)
