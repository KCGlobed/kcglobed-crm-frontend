import logging
import secrets
import string
from datetime import timedelta

import jwt
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from apps.users.models import User, safe_user
from common.authentication import check_session, idle_limit
from common.exceptions import ApiError

from .models import Session
from .passwords import check_password, hash_password
from .tokens import decode_refresh_token, random_token, sha256, sign_access_token, sign_refresh_token

logger = logging.getLogger('crm')

SYMBOLS = '@#$%&*!?'


def _mail(to: str, subject: str, text: str, html: str) -> None:
    """Email adapter: SMTP when configured, otherwise the console backend logs it (dev)."""
    try:
        send_mail(subject, text, settings.DEFAULT_FROM_EMAIL, [to], html_message=html)
    except Exception as exc:  # noqa: BLE001 — a mail failure must not lose the user record
        logger.error('Mail to %s failed: %s', to, exc)


# ------------------------------------------------------------ credentials


def generate_temp_password(length: int = 12) -> str:
    """GL-02: 12 characters with letters, numbers and a symbol (and an uppercase letter)."""
    pool = string.ascii_letters + string.digits + SYMBOLS
    while True:
        chars = [secrets.choice(pool) for _ in range(length)]
        text = ''.join(chars)
        if (any(c.isupper() for c in text) and any(c.islower() for c in text)
                and any(c.isdigit() for c in text) and any(c in SYMBOLS for c in text)):
            return text


def issue_credentials(user: User) -> str:
    """New temporary password, valid 48 hours; the user must change it at first login."""
    temp = generate_temp_password()
    user.password_hash = hash_password(temp)
    user.must_change_password = True
    user.temp_password_expires_at = timezone.now() + timedelta(hours=settings.TEMP_PASSWORD_HOURS)
    user.save(update_fields=['password_hash', 'must_change_password', 'temp_password_expires_at', 'updated_at'])
    revoke_sessions(user.id)  # an older temporary password stops working too

    login_url = f'{settings.FRONTEND_URL}/login'
    text = (
        f'Hello {user.name},\n\nYour GCC School CRM account is ready.\n\n'
        f'Login: {login_url}\nUsername: {user.email}\nTemporary password: {temp}\n\n'
        f'The temporary password expires in {settings.TEMP_PASSWORD_HOURS} hours. '
        'You will be asked to set your own password when you first sign in.'
    )
    html = (
        f'<p>Hello {user.name},</p><p>Your GCC School CRM account is ready.</p>'
        f'<p><b>Login:</b> <a href="{login_url}">{login_url}</a><br><b>Username:</b> {user.email}<br>'
        f'<b>Temporary password:</b> <code>{temp}</code></p>'
        f'<p>The temporary password expires in {settings.TEMP_PASSWORD_HOURS} hours. '
        'You will be asked to set your own password when you first sign in.</p>'
    )
    _mail(user.email, 'Your GCC School CRM login', text, html)
    logger.info('Login credentials sent to %s', user.email)
    return temp


# ---------------------------------------------------------------- sessions


def live_sessions(now=None):
    """Sessions of users who are logged in right now (not revoked, expired or idle)."""
    now = now or timezone.now()
    return Session.objects.filter(
        revoked_at__isnull=True, expires_at__gt=now, last_seen_at__gte=now - idle_limit()
    )


def live_user_ids(now=None) -> set[str]:
    return set(live_sessions(now).values_list('user_id', flat=True))


def _create_session(user: User, ip: str | None, user_agent: str | None) -> tuple[str, str, Session]:
    now = timezone.now()
    session = Session.objects.create(
        user=user,
        refresh_token_hash='pending',
        user_agent=(user_agent or '')[:500] or None,
        ip=ip,
        expires_at=now + timedelta(days=settings.REFRESH_TOKEN_TTL_DAYS),
        last_seen_at=now,
    )
    refresh = sign_refresh_token(user.id, session.id)
    session.refresh_token_hash = sha256(refresh)
    session.save(update_fields=['refresh_token_hash', 'updated_at'])
    return sign_access_token(user.id, session.id), refresh, session


def login(email: str, password: str, ip: str | None, user_agent: str | None) -> dict:
    user = User.objects.filter(email=email.lower()).first()
    if not user or not check_password(password, user.password_hash):
        raise ApiError.unauthorized('Invalid email or password')
    if not user.is_active:
        raise ApiError.forbidden('Your account is deactivated. Contact your administrator.')
    if user.must_change_password and user.temp_password_expires_at and user.temp_password_expires_at < timezone.now():
        raise ApiError.unauthorized('Your temporary password has expired. Ask your admin to resend your login credentials.')

    was_live = user.id in live_user_ids()
    access, refresh, _ = _create_session(user, ip, user_agent)
    user.last_login_at = timezone.now()
    fields = ['last_login_at', 'updated_at']
    if not was_live:
        # GL-12: a counsellor who logs in (re)joins the round-robin at the end of the order
        user.rr_joined_at = user.last_login_at
        fields.append('rr_joined_at')
    user.save(update_fields=fields)
    return {'user': safe_user(user), 'access_token': access, 'refresh_token': refresh, 'joined_rotation': not was_live}


def rotate_refresh_token(token: str, ip: str | None) -> dict:
    try:
        payload = decode_refresh_token(token)
    except jwt.PyJWTError:
        raise ApiError.unauthorized('Session expired. Please sign in again.')
    if payload.get('type') != 'refresh':
        raise ApiError.unauthorized()

    session = Session.objects.filter(pk=payload.get('sid')).first()
    try:
        check_session(session)
    except Exception as exc:  # AuthenticationFailed → same message as a 401 ApiError
        raise ApiError.unauthorized(str(getattr(exc, 'detail', 'Session expired. Please sign in again.')))
    if session.refresh_token_hash != sha256(token):
        # Token reuse — revoke the session defensively.
        session.revoked_at = timezone.now()
        session.save(update_fields=['revoked_at', 'updated_at'])
        raise ApiError.unauthorized('Session invalidated. Please sign in again.')

    user = User.objects.filter(pk=payload.get('sub')).first()
    if not user or not user.is_active:
        raise ApiError.unauthorized('Your account is inactive.')

    new_refresh = sign_refresh_token(user.id, session.id)
    session.refresh_token_hash = sha256(new_refresh)
    session.last_used_at = timezone.now()
    session.ip = ip or session.ip
    session.save()
    return {
        'user': safe_user(user),
        'access_token': sign_access_token(user.id, session.id),
        'refresh_token': new_refresh,
    }


def logout(token: str | None) -> User | None:
    """Revokes the session; returns its user so the logout can be audited."""
    if not token:
        return None
    try:
        payload = decode_refresh_token(token)
    except jwt.PyJWTError:
        return None  # already invalid — nothing to revoke
    now = timezone.now()
    session = Session.objects.select_related('user').filter(pk=payload.get('sid')).first()
    if not session:
        return None
    Session.objects.filter(pk=session.pk).update(revoked_at=session.revoked_at or now, logged_out_at=now)
    return session.user


def revoke_sessions(user_id: str, keep_session_id: str | None = None) -> None:
    sessions = Session.objects.filter(user_id=user_id, revoked_at__isnull=True)
    if keep_session_id:
        sessions = sessions.exclude(pk=keep_session_id)
    sessions.update(revoked_at=timezone.now())


# ---------------------------------------------------------------- passwords


def request_password_reset(email: str) -> None:
    user = User.objects.filter(email=email.lower()).first()
    # Always succeed from the caller's perspective (no user enumeration).
    if not user or not user.is_active:
        return
    token = random_token()
    user.password_reset_token_hash = sha256(token)
    user.password_reset_expires = timezone.now() + timedelta(minutes=30)
    user.save(update_fields=['password_reset_token_hash', 'password_reset_expires', 'updated_at'])

    link = f'{settings.FRONTEND_URL}/reset-password?token={token}'
    html = (
        f'<p>Hello {user.name},</p><p>Click the link below to reset your password. '
        f'It expires in 30 minutes.</p><p><a href="{link}">{link}</a></p>'
    )
    _mail(user.email, 'Reset your CRM password', link, html)
    logger.info('Password reset requested for %s', user.email)


def reset_password(token: str, password: str) -> None:
    user = User.objects.filter(
        password_reset_token_hash=sha256(token), password_reset_expires__gt=timezone.now()
    ).first()
    if not user:
        raise ApiError.bad_request('This reset link is invalid or has expired. Request a new one.')
    user.password_hash = hash_password(password)
    user.password_reset_token_hash = None
    user.password_reset_expires = None
    user.must_change_password = False
    user.temp_password_expires_at = None
    user.save()
    revoke_sessions(user.id)


def change_password(user_id: str, current: str, new: str, session_id: str | None) -> None:
    user = User.objects.filter(pk=user_id).first()
    if not user:
        raise ApiError.not_found('User not found')
    if not check_password(current, user.password_hash):
        raise ApiError.bad_request('Current password is incorrect', {'currentPassword': 'Current password is incorrect'})
    if current == new:
        raise ApiError.bad_request('Validation failed', {'newPassword': 'Choose a password different from the current one'})
    user.password_hash = hash_password(new)
    user.must_change_password = False
    user.temp_password_expires_at = None
    user.save(update_fields=['password_hash', 'must_change_password', 'temp_password_expires_at', 'updated_at'])
    # Sign out every other session.
    revoke_sessions(user.id, keep_session_id=session_id)


def get_me(user_id: str) -> dict:
    user = User.objects.select_related('team', 'reporting_manager').filter(pk=user_id).first()
    if not user:
        raise ApiError.not_found('User not found')
    return safe_user(user, team='ref', manager=('name', 'email'))
