from rest_framework import serializers

from common.validation import (
    MobileField,
    ObjectIdField,
    OptionalEmailField,
    StrictBooleanField,
    optional_text,
)

from .models import LEAD_STATUSES, LEAD_TRACKS


class UtmSerializer(serializers.Serializer):
    source = optional_text(200)
    medium = optional_text(200)
    campaign = optional_text(200)
    term = optional_text(200)
    content = optional_text(200)
    landingPage = optional_text(500)


class ReferralSerializer(serializers.Serializer):
    code = optional_text(100)
    partnerName = optional_text(200)
    partnerLink = optional_text(500)


class ConsentSerializer(serializers.Serializer):
    email = StrictBooleanField(required=False)
    sms = StrictBooleanField(required=False)
    whatsapp = StrictBooleanField(required=False)


class CreateLeadSerializer(serializers.Serializer):
    firstName = serializers.CharField(max_length=100, error_messages={
        'required': 'First name is required', 'blank': 'First name is required',
    })
    lastName = optional_text(100)
    email = OptionalEmailField()
    mobile = MobileField()
    altMobile = optional_text(16)
    city = optional_text(100)
    state = optional_text(100)
    country = optional_text(100)
    source = ObjectIdField(required=False)
    utm = UtmSerializer(required=False)
    referral = ReferralSerializer(required=False)
    track = serializers.ChoiceField(choices=LEAD_TRACKS, required=False)
    programInterest = ObjectIdField(required=False, allow_null=True)
    cohort = ObjectIdField(required=False, allow_null=True)
    stage = ObjectIdField(required=False)
    subStage = ObjectIdField(required=False, allow_null=True)
    owner = ObjectIdField(required=False, allow_null=True)
    tags = serializers.ListField(child=ObjectIdField(), required=False)
    customFields = serializers.DictField(required=False)
    consent = ConsentSerializer(required=False)
    autoAssign = StrictBooleanField(required=False)


class UpdateLeadSerializer(CreateLeadSerializer):
    owner = None
    autoAssign = None
    status = serializers.ChoiceField(choices=LEAD_STATUSES, required=False)
    lastDisposition = optional_text(100)


class AssignLeadSerializer(serializers.Serializer):
    owner = ObjectIdField()


class NoteSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=2000, error_messages={
        'max_length': 'Notes can be at most 2,000 characters',
        'required': 'Note cannot be empty', 'blank': 'Note cannot be empty',
    })
    category = optional_text(100)


class CaptureLeadSerializer(serializers.Serializer):
    """Public capture endpoint: looser contract for website forms & connectors."""

    firstName = serializers.CharField(max_length=100, required=False)
    name = serializers.CharField(max_length=200, required=False)
    lastName = optional_text(100)
    email = OptionalEmailField()
    mobile = MobileField()
    city = optional_text(100)
    state = optional_text(100)
    source = optional_text(100)
    program = optional_text(150)
    utm_source = optional_text(200)
    utm_medium = optional_text(200)
    utm_campaign = optional_text(200)
    utm_term = optional_text(200)
    utm_content = optional_text(200)
    landing_page = optional_text(500)
    referral_code = optional_text(100)
    partner_name = optional_text(200)
    partner_link = optional_text(500)
    track = serializers.ChoiceField(choices=LEAD_TRACKS, required=False)
    channel = serializers.ChoiceField(choices=['capture', 'meta', 'google'], required=False)


class ImportDefaultsSerializer(serializers.Serializer):
    source = ObjectIdField(required=False)
    programInterest = ObjectIdField(required=False)
    stage = ObjectIdField(required=False)
    track = serializers.ChoiceField(choices=LEAD_TRACKS, required=False)
    autoAssign = StrictBooleanField(required=False)


class BulkUploadSerializer(serializers.Serializer):
    # maps lead field → column header in the uploaded file
    mapping = serializers.DictField(child=serializers.CharField(allow_blank=True))
    defaults = ImportDefaultsSerializer(required=False)


# ------------------------------------------------------------- Go-live

from common.validation import IndianMobileField, person_name  # noqa: E402

NAME_PATTERN = r'^[A-Za-z][A-Za-z .]*$'


class QuickAddSerializer(serializers.Serializer):
    """GL-10 Quick Add: First Name*, Last Name, Mobile*, Email, State, City, Program, Source*, Note."""

    firstName = person_name('First name', 50, NAME_PATTERN)
    lastName = serializers.RegexField(NAME_PATTERN, max_length=50, required=False, allow_blank=True, allow_null=True,
                                      error_messages={'invalid': 'Last name can only contain letters, spaces and "."'})
    mobile = IndianMobileField()
    email = OptionalEmailField()
    state = optional_text(100)
    city = optional_text(100)
    programInterest = ObjectIdField(required=False, allow_null=True)
    source = ObjectIdField(error_messages={'required': 'Source is required', 'blank': 'Source is required'})
    note = optional_text(2000)
    owner = ObjectIdField(required=False, allow_null=True)
    autoAssign = StrictBooleanField(required=False)
    # older clients still send these
    tags = serializers.ListField(child=ObjectIdField(), required=False)
    customFields = serializers.DictField(required=False)
    consent = ConsentSerializer(required=False)
    track = serializers.ChoiceField(choices=LEAD_TRACKS, required=False)
    cohort = ObjectIdField(required=False, allow_null=True)
    utm = UtmSerializer(required=False)
    referral = ReferralSerializer(required=False)
    altMobile = optional_text(16)
    country = optional_text(100)


ASSIGN_REASONS = ['New allocation', 'Workload', 'Leave', 'Language', 'Performance', 'Other']


class AssignWithReasonSerializer(serializers.Serializer):
    owner = ObjectIdField()
    reason = serializers.ChoiceField(choices=ASSIGN_REASONS, error_messages={
        'required': 'Choose a reason', 'invalid_choice': 'Choose a reason',
    })


class BulkAssignSerializer(serializers.Serializer):
    leadIds = serializers.ListField(child=ObjectIdField(), required=False)
    selectAll = StrictBooleanField(required=False)
    filters = serializers.DictField(required=False)
    owners = serializers.ListField(child=ObjectIdField(), min_length=1, error_messages={
        'min_length': 'Choose at least one counsellor', 'required': 'Choose at least one counsellor',
    })
    reason = serializers.ChoiceField(choices=ASSIGN_REASONS, error_messages={
        'required': 'Choose a reason', 'invalid_choice': 'Choose a reason',
    })
    preview = StrictBooleanField(required=False)

    def validate(self, attrs):
        if not attrs.get('leadIds') and not attrs.get('selectAll'):
            raise serializers.ValidationError({'leadIds': 'Select at least one lead'})
        return attrs


class NoteEditSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=2000, error_messages={
        'required': 'Note cannot be empty', 'blank': 'Note cannot be empty', 'max_length': 'Notes can be at most 2,000 characters',
    })


class CallSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['answered', 'not_answered', 'busy', 'failed'], required=False)
    durationSeconds = serializers.IntegerField(min_value=0, max_value=6 * 3600, required=False, allow_null=True)
    direction = serializers.ChoiceField(choices=['outbound', 'inbound'], required=False)


class DispositionSerializer(serializers.Serializer):
    stage = ObjectIdField(error_messages={'required': 'Choose a stage'})
    subStage = ObjectIdField(required=False, allow_null=True)
    reason = optional_text(300)
    followUpAt = serializers.DateTimeField(required=False, allow_null=True)
    followUpType = serializers.CharField(required=False, allow_null=True)
    followUpNote = optional_text(500)
    note = optional_text(2000)
    interaction = serializers.ChoiceField(choices=['call', 'update'], required=False)
    call = CallSerializer(required=False)


class SavedFilterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=80, error_messages={'required': 'Name the filter', 'blank': 'Name the filter'})
    params = serializers.DictField()
