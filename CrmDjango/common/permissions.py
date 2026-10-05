"""
Backend permission enforcement — never rely on the frontend's checks (SOW §9).
Super admin bypasses module ticks; everyone else needs the exact module+action.
"""
from rest_framework.permissions import BasePermission

from .exceptions import ApiError
from .permissions_catalog import has_action

PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED'


def _require_user(request, view):
    user = request.user
    if not getattr(user, 'is_authenticated', False):
        raise ApiError.unauthorized()
    # GL-02: a user with a temporary password must set their own before doing anything else.
    if user.must_change_password and not getattr(view, 'allow_pending_password', False):
        raise ApiError(403, 'Set a new password to continue', {'code': PASSWORD_CHANGE_REQUIRED})
    return user


class IsAuthenticated(BasePermission):
    def has_permission(self, request, view):
        _require_user(request, view)
        return True


class ModulePermission(BasePermission):
    """
    Reads `view.required_permissions`, a {HTTP method: (module, action)} map.
    Methods without an entry only need a signed-in user.
    """

    def has_permission(self, request, view):
        user = _require_user(request, view)
        needed = getattr(view, 'required_permissions', {}).get(request.method)
        if not needed or user.is_super_admin or has_action(user.permissions, *needed):
            return True
        raise ApiError.forbidden()
