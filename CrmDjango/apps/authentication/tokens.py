import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from django.conf import settings


def _now() -> datetime:
    return datetime.now(timezone.utc)


def sign_access_token(user_id: str, session_id: str) -> str:
    payload = {
        'sub': user_id,
        'sid': session_id,
        'type': 'access',
        'iat': _now(),
        'exp': _now() + timedelta(minutes=settings.ACCESS_TOKEN_TTL_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_ACCESS_SECRET, algorithm='HS256')


def sign_refresh_token(user_id: str, session_id: str) -> str:
    # jti makes every rotation unique even within the same second (same iat).
    payload = {
        'sub': user_id,
        'sid': session_id,
        'type': 'refresh',
        'jti': str(uuid.uuid4()),
        'iat': _now(),
        'exp': _now() + timedelta(days=settings.REFRESH_TOKEN_TTL_DAYS),
    }
    return jwt.encode(payload, settings.JWT_REFRESH_SECRET, algorithm='HS256')


def decode_refresh_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_REFRESH_SECRET, algorithms=['HS256'])


def decode_unverified(token: str) -> dict:
    return jwt.decode(token, options={'verify_signature': False, 'verify_exp': False})


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def random_token(nbytes: int = 32) -> str:
    return secrets.token_hex(nbytes)
