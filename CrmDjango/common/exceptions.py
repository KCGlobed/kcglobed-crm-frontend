"""ApiError and the central exception handler — same envelope as the Node API."""
import logging

from django.conf import settings
from django.db import IntegrityError
from django.http import Http404
from rest_framework import exceptions as drf
from rest_framework.response import Response

logger = logging.getLogger('crm')


class ApiError(Exception):
    def __init__(self, status: int, message: str, errors: dict | None = None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.errors = errors or {}

    @classmethod
    def bad_request(cls, message: str, errors: dict | None = None):
        return cls(400, message, errors)

    @classmethod
    def unauthorized(cls, message: str = 'Authentication required'):
        return cls(401, message)

    @classmethod
    def forbidden(cls, message: str = 'You do not have permission to perform this action'):
        return cls(403, message)

    @classmethod
    def not_found(cls, message: str = 'Resource not found'):
        return cls(404, message)

    @classmethod
    def conflict(cls, message: str, errors: dict | None = None):
        return cls(409, message, errors)

    @classmethod
    def unprocessable(cls, message: str, errors: dict | None = None):
        return cls(422, message, errors)


def error_body(status: int, message: str, errors: dict | None = None) -> dict:
    return {'success': False, 'message': message, 'status': status, 'errors': errors or {}}


def error_response(status: int, message: str, errors: dict | None = None, headers=None) -> Response:
    return Response(error_body(status, message, errors), status=status, headers=headers)


def flatten_errors(detail, prefix: str = '') -> dict:
    """DRF nested error detail → {"a.b.0.c": "first message"}, like the Node zod handler."""
    out: dict = {}
    if isinstance(detail, dict):
        for key, value in detail.items():
            part = '' if key == 'non_field_errors' else str(key)
            joined = f'{prefix}.{part}' if prefix and part else (prefix or part)
            for k, v in flatten_errors(value, joined).items():
                out.setdefault(k, v)
    elif isinstance(detail, list):
        if detail and all(not isinstance(x, (dict, list)) for x in detail):
            out.setdefault(prefix or 'body', str(detail[0]))
        else:
            for i, value in enumerate(detail):
                if value in ({}, []):
                    continue
                for k, v in flatten_errors(value, f'{prefix}.{i}' if prefix else str(i)).items():
                    out.setdefault(k, v)
    else:
        out.setdefault(prefix or 'body', str(detail))
    return out


def api_exception_handler(exc, context):
    if isinstance(exc, ApiError):
        return error_response(exc.status, exc.message, exc.errors)
    if isinstance(exc, drf.Throttled):
        message = getattr(exc, 'crm_message', None) or 'Rate limit exceeded. Slow down and retry shortly.'
        headers = {'Retry-After': str(int(exc.wait))} if exc.wait else None
        return error_response(429, message, headers=headers)
    if isinstance(exc, drf.AuthenticationFailed):
        return error_response(401, str(exc.detail))
    if isinstance(exc, drf.NotAuthenticated):
        return error_response(401, 'Authentication required')
    if isinstance(exc, drf.PermissionDenied):
        return error_response(403, 'You do not have permission to perform this action')
    if isinstance(exc, drf.ParseError):
        return error_response(400, 'Malformed request body')
    if isinstance(exc, drf.UnsupportedMediaType):
        return error_response(400, 'Unsupported content type')
    if isinstance(exc, (Http404, drf.NotFound)):
        return error_response(404, 'Resource not found')
    if isinstance(exc, drf.MethodNotAllowed):
        request = context.get('request')
        return error_response(404, f'Route not found: {request.method} {request.get_full_path()}')
    if isinstance(exc, drf.ValidationError):
        return error_response(400, 'Validation failed', flatten_errors(exc.detail))
    if isinstance(exc, IntegrityError):
        return error_response(409, 'Duplicate record')

    logger.exception('Unhandled error: %s', exc)
    message = str(exc) if settings.DEBUG else 'Something went wrong. Please try again.'
    return error_response(500, message)
