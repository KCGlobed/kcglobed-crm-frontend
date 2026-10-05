"""
Bearer access-token authentication.

The user and their session are loaded fresh on every request so that
deactivation, logout and the 30-minute idle timeout take effect immediately
(SOW §9, Go-live GL-04/GL-05).
"""
from dataclasses import dataclass, field
from datetime import timedelta

import jwt
from django.conf import settings
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

# A request is "background" (not user activity) when the client marks it so —
# e.g. the notification bell's 30 s poll. It must not keep an idle session alive.
BACKGROUND_HEADER = 'HTTP_X_BACKGROUND'
SEEN_WRITE_EVERY = timedelta(seconds=60)


@dataclass
class Principal:
    """What the API knows about the caller (the Node `req.user`)."""

    id: str
    name: str
    email: str
    is_super_admin: bool
    permissions: list = field(default_factory=list)
    data_scope: str = 'own'
    field_rules: list = field(default_factory=list)
    team: str | None = None
    session_id: str | None = None
    role: str = 'other'
    must_change_password: bool = False

    is_authenticated = True

    @classmethod
    def from_user(cls, user, session_id: str | None = None) -> 'Principal':
        return cls(
            id=user.id,
            name=user.name,
            email=user.email,
            is_super_admin=user.is_super_admin,
            permissions=user.permissions or [],
            data_scope=user.data_scope or 'own',
            field_rules=user.field_rules or [],
            team=user.team_id,
            session_id=session_id,
            role=user.role,
            must_change_password=user.must_change_password,
        )


def idle_limit() -> timedelta:
    return timedelta(minutes=settings.SESSION_IDLE_MINUTES)


def check_session(session, now=None):
    """Raises if the session is revoked, expired or idle; returns it otherwise."""
    from apps.authentication.models import Session

    now = now or timezone.now()
    if not session or session.revoked_at or session.expires_at < now:
        raise AuthenticationFailed('Session expired. Please sign in again.')
    if session.last_seen_at and now - session.last_seen_at > idle_limit():
        Session.objects.filter(pk=session.pk, revoked_at__isnull=True).update(revoked_at=now)
        raise AuthenticationFailed('You were signed out after 30 minutes of inactivity. Please sign in again.')
    return session


class JWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        from apps.authentication.models import Session
        from apps.users.models import User

        header = request.META.get('HTTP_AUTHORIZATION', '')
        if not header.startswith('Bearer '):
            return None
        try:
            payload = jwt.decode(header[7:], settings.JWT_ACCESS_SECRET, algorithms=['HS256'])
        except jwt.PyJWTError:
            raise AuthenticationFailed('Session expired or invalid. Please sign in again.')
        if payload.get('type') != 'access':
            raise AuthenticationFailed('Authentication required')

        user = User.objects.filter(pk=payload.get('sub')).first()
        if not user or not user.is_active:
            raise AuthenticationFailed('Your account is inactive. Contact your administrator.')

        now = timezone.now()
        session = check_session(Session.objects.filter(pk=payload.get('sid'), user=user).first(), now)
        if not request.META.get(BACKGROUND_HEADER) and (
            not session.last_seen_at or now - session.last_seen_at > SEEN_WRITE_EVERY
        ):
            Session.objects.filter(pk=session.pk).update(last_seen_at=now)
        return Principal.from_user(user, session.id), payload

    def authenticate_header(self, request):
        # Makes DRF answer 401 (not 403) for anonymous calls to protected views.
        return 'Bearer'
