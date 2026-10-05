"""Rate limits, per client IP: auth 20 / 15 min, API 300 / min (express-rate-limit parity)."""
import os

from rest_framework.throttling import SimpleRateThrottle


class _FixedRateThrottle(SimpleRateThrottle):
    num_requests: int
    duration: int
    message: str

    def __init__(self):  # rates are fixed in code, not read from settings
        self.rate = f'{self.num_requests}/{self.duration}s'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}


class ApiRateThrottle(_FixedRateThrottle):
    scope = 'api'
    num_requests = int(os.environ.get('API_RATE_LIMIT', '300'))
    duration = 60
    message = 'Rate limit exceeded. Slow down and retry shortly.'


class AuthRateThrottle(_FixedRateThrottle):
    """Login, forgot-password and reset-password."""

    scope = 'auth'
    num_requests = int(os.environ.get('AUTH_RATE_LIMIT', '20'))
    duration = 15 * 60
    message = 'Too many attempts. Please try again in a few minutes.'
