from rest_framework import serializers

from common.validation import ObjectIdField, StrictBooleanField, nullable_text

from .models import TEAM_TYPES


class TeamSerializer(serializers.Serializer):
    name = serializers.CharField(min_length=2, max_length=100, error_messages={
        'required': 'Team name is required', 'blank': 'Team name is required', 'min_length': 'Team name is required',
    })
    code = serializers.RegexField(
        r'^[A-Za-z0-9_-]*$', max_length=20, required=False, allow_null=True, allow_blank=True,
        error_messages={
            'invalid': 'Code can only contain letters, numbers, dashes and underscores',
            'max_length': 'Code must be 20 characters or fewer',
        },
    )
    type = serializers.ChoiceField(choices=TEAM_TYPES, required=False)
    description = nullable_text(500)
    manager = ObjectIdField(required=False, allow_null=True, allow_blank=True)
    parent = ObjectIdField(required=False, allow_null=True, allow_blank=True)
    location = nullable_text(100)
    programs = serializers.ListField(child=ObjectIdField(), max_length=50, required=False)
    receivesLeads = StrictBooleanField(required=False)
    isActive = StrictBooleanField(required=False)


class AddMembersSerializer(serializers.Serializer):
    userIds = serializers.ListField(
        child=ObjectIdField(), min_length=1, max_length=200,
        error_messages={'min_length': 'Pick at least one user', 'required': 'Pick at least one user'},
    )
    # also point each moved user's reporting manager at the team manager
    setReportingManager = StrictBooleanField(required=False)
