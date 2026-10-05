from django.conf import settings

from apps.audit.services import audit, client_ip
from common.exceptions import ApiError
from common.responses import ok
from common.throttling import ApiRateThrottle, AuthRateThrottle
from common.views import ApiView, PublicView
from common.validation import validated

from . import services
from .serializers import ChangePasswordSerializer, ForgotPasswordSerializer, LoginSerializer, ResetPasswordSerializer


def set_refresh_cookie(response, token: str):
    response.set_cookie(
        settings.REFRESH_COOKIE,
        token,
        max_age=settings.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
        path=settings.REFRESH_COOKIE_PATH,
        httponly=True,
        secure=not settings.DEBUG,
        samesite='Lax',
    )
    return response


def refresh_token_of(request) -> str | None:
    token = request.COOKIES.get(settings.REFRESH_COOKIE)
    if token:
        return token
    data = request.data if isinstance(request.data, dict) else {}
    return data.get('refresh_token')


class AuthLimitedView(PublicView):
    throttle_classes = [ApiRateThrottle, AuthRateThrottle]


class LoginView(AuthLimitedView):
    def post(self, request):
        data = validated(LoginSerializer, request.data)
        result = services.login(data['email'], data['password'], client_ip(request), request.META.get('HTTP_USER_AGENT'))
        user = result['user']
        # No Bearer user yet — record the user who just signed in.
        audit(request, 'login', 'users', 'User', user['_id'], actor={'id': user['_id'], 'name': user['name']})
        if result['joined_rotation'] and user.get('role') == 'counsellor':
            # GL-12: pooled Meta leads go out as soon as a counsellor is online
            from apps.leads.assignment import distribute_pool

            distribute_pool()
        response = ok('Signed in successfully', {'user': user, 'access_token': result['access_token']})
        return set_refresh_cookie(response, result['refresh_token'])


class RefreshView(PublicView):
    def post(self, request):
        token = refresh_token_of(request)
        if not token:
            raise ApiError.unauthorized('Session expired. Please sign in again.')
        result = services.rotate_refresh_token(token, client_ip(request))
        response = ok('Session refreshed', {'user': result['user'], 'access_token': result['access_token']})
        return set_refresh_cookie(response, result['refresh_token'])


class LogoutView(PublicView):
    def post(self, request):
        user = services.logout(refresh_token_of(request))
        if user:
            audit(request, 'logout', 'users', 'User', user.id, actor={'id': user.id, 'name': user.name})
        response = ok('Signed out successfully', None)
        response.delete_cookie(settings.REFRESH_COOKIE, path=settings.REFRESH_COOKIE_PATH)
        return response


class ForgotPasswordView(AuthLimitedView):
    def post(self, request):
        data = validated(ForgotPasswordSerializer, request.data)
        services.request_password_reset(data['email'])
        return ok('If that email exists, a reset link has been sent', None)


class ResetPasswordView(AuthLimitedView):
    def post(self, request):
        data = validated(ResetPasswordSerializer, request.data)
        services.reset_password(data['token'], data['password'])
        return ok('Password reset successfully. You can now sign in.', None)


class ChangePasswordView(ApiView):
    allow_pending_password = True  # this is how a temporary password gets replaced

    def post(self, request):
        data = validated(ChangePasswordSerializer, request.data)
        services.change_password(request.user.id, data['currentPassword'], data['newPassword'], request.user.session_id)
        audit(request, 'change_password', 'users', 'User', request.user.id)
        return ok('Password changed successfully', None)


class MeView(ApiView):
    allow_pending_password = True

    def get(self, request):
        return ok('Profile fetched successfully', {'user': services.get_me(request.user.id)})
