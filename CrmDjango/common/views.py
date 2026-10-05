from django.http import JsonResponse
from rest_framework.exceptions import Throttled
from rest_framework.views import APIView

from .exceptions import ApiError, error_body
from .ids import is_object_id
from .permissions import ModulePermission


class ApiView(APIView):
    """
    Base view: Bearer auth, per-method module permissions and rate limits.

    Subclasses declare `required_permissions = {'GET': ('leads', 'view'), ...}`.
    """

    permission_classes = [ModulePermission]
    required_permissions: dict[str, tuple[str, str]] = {}

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        # Path ids are checked after auth/permissions, like the Mongo CastError → 400.
        for key, value in kwargs.items():
            if key.endswith('_id') and not is_object_id(value):
                raise ApiError.bad_request('Invalid identifier format')

    def check_throttles(self, request):
        for throttle in self.get_throttles():
            if not throttle.allow_request(request, self):
                exc = Throttled(throttle.wait())
                exc.crm_message = throttle.message
                raise exc


class PublicView(ApiView):
    """No token needed (login, capture webhooks, password reset)."""

    authentication_classes: list = []
    permission_classes: list = []


def route_not_found(request, *args, **kwargs):
    """Catch-all for unknown URLs — JSON 404 instead of Django's HTML page."""
    return JsonResponse(error_body(404, f'Route not found: {request.method} {request.get_full_path()}'), status=404)
