import re

from rest_framework import serializers

from common.permissions_catalog import DATA_SCOPES
from common.roles import ADMIN, COUNSELLOR, OTHER
from common.validation import (
    EmailField,
    FieldRuleSerializer,
    ModulePermissionSerializer,
    ObjectIdField,
    PasswordField,
    StrictBooleanField,
    person_name,
)


class OptionalTenDigitMobile(serializers.CharField):
    """GL-01: Mobile is optional; when given it is 10 digits."""

    def __init__(self, **kwargs):
        super().__init__(required=False, allow_blank=True, allow_null=True, **kwargs)

    def to_internal_value(self, data):
        value = re.sub(r'\D', '', super().to_internal_value(data) or '')
        if len(value) > 10 and value.startswith('91'):
            value = value[-10:]
        if value and not re.match(r'^\d{10}$', value):
            raise serializers.ValidationError('Mobile must be 10 digits')
        return value or None


class CreateUserSerializer(serializers.Serializer):
    """
    GL-01: Full Name, Email, Designation, optional Mobile and the Role.
    Without a password the user gets emailed temporary credentials (GL-02).
    The permission fields remain for custom-access users built with the permission builder.
    """

    name = person_name('Full name', 60, r'^[A-Za-z ]+$', 'letters and spaces')
    email = EmailField()
    designation = serializers.CharField(max_length=60, error_messages={
        'required': 'Designation is required', 'blank': 'Designation is required',
        'max_length': 'Designation must be 60 characters or fewer',
    })
    mobile = OptionalTenDigitMobile()
    role = serializers.ChoiceField(choices=[ADMIN, COUNSELLOR, OTHER], required=False, error_messages={
        'invalid_choice': 'Role must be Admin or Admission Counsellor',
    })
    password = PasswordField(required=False)
    isSuperAdmin = StrictBooleanField(required=False)
    isActive = StrictBooleanField(required=False)
    receivesLeads = StrictBooleanField(required=False)
    team = ObjectIdField(required=False, allow_null=True)
    reportingManager = ObjectIdField(required=False, allow_null=True)
    templateKey = serializers.CharField(required=False, allow_blank=True)
    permissions = ModulePermissionSerializer(many=True, required=False)
    dataScope = serializers.ChoiceField(choices=DATA_SCOPES, required=False)
    fieldRules = FieldRuleSerializer(many=True, required=False)


class UpdateUserSerializer(CreateUserSerializer):
    """GL-03: name/designation (and mobile) are editable; email never changes after creation."""

    email = EmailField(required=False)


class SetPermissionsSerializer(serializers.Serializer):
    permissions = ModulePermissionSerializer(many=True)
    dataScope = serializers.ChoiceField(choices=DATA_SCOPES)
    fieldRules = FieldRuleSerializer(many=True, required=False, default=list)
    templateKey = serializers.CharField(required=False, allow_null=True, allow_blank=True)


class PermissionTemplateSerializer(serializers.Serializer):
    key = serializers.RegexField(
        r'^[a-z0-9-_]+$', min_length=2, max_length=50,
        error_messages={'invalid': 'Key must be lowercase letters, numbers, dashes'},
    )
    name = serializers.CharField(min_length=2, max_length=100)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    permissions = ModulePermissionSerializer(many=True)
    dataScope = serializers.ChoiceField(choices=DATA_SCOPES)
    fieldRules = FieldRuleSerializer(many=True, required=False, default=list)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.partial:
            # a partial update must not reset fieldRules through its default
            self.fields['fieldRules'].default = serializers.empty
