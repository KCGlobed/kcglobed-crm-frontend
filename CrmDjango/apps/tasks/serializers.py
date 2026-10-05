from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from common.validation import ObjectIdField, optional_text

from .models import PRIORITIES, REMINDER_OPTIONS, STATUSES, TASK_TYPES

# Forms send "now"-ish times; a minute of grace avoids rejecting them on submit.
PAST_GRACE = timedelta(minutes=1)


def _not_in_past(value):
    if value < timezone.now() - PAST_GRACE:
        raise serializers.ValidationError('Due date-time cannot be in the past')
    return value


class CreateTaskSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=list(TASK_TYPES), error_messages={
        'required': 'Select a follow-up type', 'invalid_choice': 'Select a follow-up type',
    })
    dueAt = serializers.DateTimeField(error_messages={
        'required': 'Due date-time is required', 'invalid': 'Enter a valid date-time',
    })
    assignee = ObjectIdField(required=False, allow_null=True)
    priority = serializers.ChoiceField(choices=PRIORITIES, required=False)
    reminderMinutes = serializers.ChoiceField(choices=REMINDER_OPTIONS, required=False, error_messages={
        'invalid_choice': 'Reminder must be 5, 15, 30 or 60 minutes',
    })
    notes = optional_text(500)

    def validate_dueAt(self, value):
        return _not_in_past(value)


class UpdateTaskSerializer(serializers.Serializer):
    """Reschedule, edit, reassign, or close (status done/cancelled) a follow-up."""

    type = serializers.ChoiceField(choices=list(TASK_TYPES), required=False)
    dueAt = serializers.DateTimeField(required=False)
    assignee = ObjectIdField(required=False)
    priority = serializers.ChoiceField(choices=PRIORITIES, required=False)
    reminderMinutes = serializers.ChoiceField(choices=REMINDER_OPTIONS, required=False)
    notes = optional_text(500)
    status = serializers.ChoiceField(choices=STATUSES, required=False)
    outcome = optional_text(500)

    def validate_dueAt(self, value):
        return _not_in_past(value)
