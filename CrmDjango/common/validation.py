"""
Request validation helpers and the reusable serializer fields that mirror the
Node zod schemas (objectId, mobile, password, …). Errors come back as the
same flat {"field.path": "message"} map.
"""
import re

from rest_framework import serializers

from .exceptions import ApiError, flatten_errors
from .permissions_catalog import ACTIONS, FIELD_RULE_MODES, MODULES

OBJECT_ID_RE = re.compile(r'^[0-9a-fA-F]{24}$')


def validated(serializer_class, data, *, partial: bool = False, context: dict | None = None) -> dict:
    """Runs a serializer; 400 "Validation failed" with dotted field errors when it fails."""
    serializer = serializer_class(data=data if data is not None else {}, partial=partial, context=context or {})
    if not serializer.is_valid():
        raise ApiError.bad_request('Validation failed', flatten_errors(serializer.errors))
    return serializer.validated_data


def required_messages(label: str) -> dict:
    message = f'{label} is required'
    return {'required': message, 'blank': message, 'null': message}


class ObjectIdField(serializers.CharField):
    default_error_messages = {'invalid_id': 'Invalid identifier'}

    def __init__(self, **kwargs):
        kwargs.setdefault('trim_whitespace', False)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if not OBJECT_ID_RE.match(value):
            self.fail('invalid_id')
        return value


class MobileField(serializers.CharField):
    default_error_messages = {'invalid_mobile': 'Enter a valid mobile number'}

    def __init__(self, **kwargs):
        kwargs.setdefault('error_messages', required_messages('Mobile number'))
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if not (7 <= len(value) <= 16) or not re.match(r'^[+\d][\d\s-]+$', value):
            self.fail('invalid_mobile')
        return value


class PasswordField(serializers.CharField):
    """GL-02: at least 8 characters with an uppercase letter, a number and a symbol."""

    default_error_messages = {
        'short': 'Password must be at least 8 characters',
        'upper': 'Password must contain an uppercase letter',
        'digit': 'Password must contain a number',
        'symbol': 'Password must contain a symbol',
    }

    def __init__(self, **kwargs):
        kwargs.setdefault('trim_whitespace', False)
        kwargs.setdefault('error_messages', required_messages('Password'))
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if len(value) < 8:
            self.fail('short')
        if not re.search(r'[A-Z]', value):
            self.fail('upper')
        if not re.search(r'\d', value):
            self.fail('digit')
        if not re.search(r'[^A-Za-z0-9]', value):
            self.fail('symbol')
        return value


class IndianMobileField(serializers.CharField):
    """Go-live §4.5: 10 digits starting 6–9, after stripping +91, spaces and a leading 0."""

    default_error_messages = {'invalid_mobile': 'Mobile must be 10 digits starting with 6–9'}

    def __init__(self, **kwargs):
        kwargs.setdefault('error_messages', required_messages('Mobile number'))
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        from .normalize import normalize_mobile

        value = normalize_mobile(super().to_internal_value(data)) or ''
        if not re.match(r'^[6-9]\d{9}$', value):
            self.fail('invalid_mobile')
        return value


def person_name(label: str, max_length: int, pattern: str = r'^[A-Za-z .]+$', allowed: str = 'letters, spaces and "."'):
    return serializers.RegexField(
        pattern, max_length=max_length,
        error_messages={
            'required': f'{label} is required', 'blank': f'{label} is required',
            'max_length': f'{label} must be {max_length} characters or fewer',
            'invalid': f'{label} can only contain {allowed}',
        },
    )


class EmailField(serializers.EmailField):
    default_error_messages = {'invalid': 'Enter a valid email address'}

    def __init__(self, **kwargs):
        kwargs.setdefault('error_messages', {'required': 'Enter a valid email address', 'blank': 'Enter a valid email address'})
        super().__init__(**kwargs)


class OptionalEmailField(serializers.CharField):
    """Email that may also be sent as "" (zod: z.email().optional().or(z.literal('')))."""

    default_error_messages = {'invalid': 'Enter a valid email address'}

    def __init__(self, **kwargs):
        kwargs.setdefault('required', False)
        kwargs.setdefault('allow_blank', True)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if value and not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', value):
            self.fail('invalid')
        return value


def optional_text(max_length: int, **kwargs) -> serializers.CharField:
    """zod `z.string().max(n).optional()` — may be empty, may not be null."""
    return serializers.CharField(max_length=max_length, required=False, allow_blank=True, **kwargs)


def nullable_text(max_length: int, **kwargs) -> serializers.CharField:
    return serializers.CharField(max_length=max_length, required=False, allow_blank=True, allow_null=True, **kwargs)


class StrictBooleanField(serializers.BooleanField):
    """zod booleans accept only true/false, not "true" or 1."""

    def to_internal_value(self, data):
        if isinstance(data, bool):
            return data
        self.fail('invalid', input=data)


class ModulePermissionSerializer(serializers.Serializer):
    module = serializers.ChoiceField(choices=MODULES)
    actions = serializers.ListField(child=serializers.ChoiceField(choices=ACTIONS))


class FieldRuleSerializer(serializers.Serializer):
    field = serializers.CharField(min_length=1)
    mode = serializers.ChoiceField(choices=FIELD_RULE_MODES)
