from datetime import datetime, time, timezone

from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import serializers

from common.validation import ObjectIdField, StrictBooleanField, optional_text

from .models import CHANNELS, COHORT_STATUSES, CUSTOM_FIELD_TYPES, STAGE_TYPES


class LooseDateTimeField(serializers.Field):
    """zod `z.coerce.date()`: accepts an ISO datetime or a plain YYYY-MM-DD date."""

    default_error_messages = {'invalid': 'Enter a valid date'}

    def to_internal_value(self, data):
        if isinstance(data, str):
            value = parse_datetime(data)
            if value is None:
                day = parse_date(data)
                value = datetime.combine(day, time.min) if day else None
            if value is not None:
                return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        self.fail('invalid')

    def to_representation(self, value):
        return value


def name_field(max_length: int):
    return serializers.CharField(max_length=max_length, error_messages={
        'required': 'Name is required', 'blank': 'Name is required',
    })


class SourceSerializer(serializers.Serializer):
    name = name_field(100)
    channel = serializers.ChoiceField(choices=CHANNELS, required=False)
    description = optional_text(500)
    isActive = StrictBooleanField(required=False)
    sortOrder = serializers.IntegerField(required=False)


class ProgramSerializer(serializers.Serializer):
    name = name_field(150)
    code = serializers.CharField(max_length=20, error_messages={'required': 'Code is required', 'blank': 'Code is required'})
    track = optional_text(100)
    durationMonths = serializers.IntegerField(min_value=1, required=False)
    description = optional_text(1000)
    isActive = StrictBooleanField(required=False)
    sortOrder = serializers.IntegerField(required=False)


class CohortSerializer(serializers.Serializer):
    name = name_field(100)
    program = ObjectIdField()
    startDate = LooseDateTimeField(required=False)
    endDate = LooseDateTimeField(required=False)
    capacity = serializers.IntegerField(min_value=1, required=False)
    status = serializers.ChoiceField(choices=COHORT_STATUSES, required=False)
    sortOrder = serializers.IntegerField(required=False)


class SubStageInputSerializer(serializers.Serializer):
    _id = ObjectIdField(required=False)
    name = serializers.CharField(max_length=150, error_messages={
        'required': 'Sub-stage name is required', 'blank': 'Sub-stage name is required',
    })
    counsellorAction = optional_text(1000)
    isActive = StrictBooleanField(required=False)


class StageSerializer(serializers.Serializer):
    name = name_field(100)
    type = serializers.ChoiceField(choices=STAGE_TYPES, required=False)
    color = optional_text(20)
    order = serializers.IntegerField(required=False)
    isActive = StrictBooleanField(required=False)
    subStages = SubStageInputSerializer(many=True, required=False, max_length=50)


class DispositionSerializer(serializers.Serializer):
    name = name_field(100)
    category = optional_text(100)
    requiresFollowUp = StrictBooleanField(required=False)
    isActive = StrictBooleanField(required=False)
    sortOrder = serializers.IntegerField(required=False)


class TagSerializer(serializers.Serializer):
    name = name_field(50)
    color = optional_text(20)
    isActive = StrictBooleanField(required=False)
    sortOrder = serializers.IntegerField(required=False)


class CustomFieldSerializer(serializers.Serializer):
    key = serializers.RegexField(
        r'^[a-z][a-zA-Z0-9_]*$', max_length=50,
        error_messages={'invalid': 'Key must start with a letter (camelCase, no spaces)'},
    )
    label = serializers.CharField(max_length=100, error_messages={'required': 'Label is required', 'blank': 'Label is required'})
    type = serializers.ChoiceField(choices=CUSTOM_FIELD_TYPES)
    options = serializers.ListField(child=serializers.CharField(min_length=1), required=False)
    required = StrictBooleanField(required=False)
    isActive = StrictBooleanField(required=False)
    sortOrder = serializers.IntegerField(required=False)
