"""
Student profile step rules — Deep Dive: Lead Management Module §4.2.
Field numbers (#) in comments refer to that table. Errors use dotted keys
such as "academic.ug.score", exactly like the Node API.
"""
import re
from datetime import date

from rest_framework import serializers

from common.normalize import normalize_mobile
from common.validation import EmailField

from . import profile_constants as c


def pick(values, label):
    message = f'Select {label}'
    return serializers.ChoiceField(choices=values, error_messages={
        'required': message, 'invalid_choice': message, 'null': message, 'blank': message,
    })


def person_name(label):
    """#1, #2: letters, space and "." only; max 50."""
    return serializers.RegexField(
        r'^[A-Za-z .]+$', max_length=50,
        error_messages={
            'required': f'{label} is required', 'blank': f'{label} is required', 'null': f'{label} is required',
            'max_length': f'{label} must be 50 characters or fewer',
            'invalid': f'{label} can only contain letters, spaces and "."',
        },
    )


class IndianMobileField(serializers.CharField):
    """#4, #14: 10 digits starting 6–9, after stripping +91, spaces and a leading 0."""

    def __init__(self, label, **kwargs):
        self.label_text = label
        super().__init__(error_messages={
            'required': f'{label} is required', 'blank': f'{label} is required', 'null': f'{label} is required',
        }, **kwargs)

    def to_internal_value(self, data):
        value = normalize_mobile(super().to_internal_value(data)) or ''
        if not re.match(r'^[6-9]\d{9}$', value):
            raise serializers.ValidationError(f'{self.label_text} must be 10 digits starting with 6–9')
        return value


class OptionalEmail(serializers.CharField):
    """Optional email that may be sent as "" — stored as unset."""

    def __init__(self, **kwargs):
        super().__init__(required=False, allow_blank=True, **kwargs)

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if value and not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', value):
            raise serializers.ValidationError('Enter a valid email address')
        return value or None


def age_on(dob: date, today: date | None = None) -> int:
    today = today or date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


class PersonalSerializer(serializers.Serializer):
    firstName = person_name('First name')
    lastName = person_name('Last name')
    email = EmailField()
    mobile = IndianMobileField('Mobile number')
    dob = serializers.CharField(error_messages={'required': 'Date of birth is required', 'blank': 'Date of birth is required'})
    gender = pick(c.GENDERS, 'a gender')
    state = pick(c.INDIAN_STATES, 'a state')
    city = serializers.CharField(max_length=100, error_messages={'required': 'City is required', 'blank': 'City is required'})
    pinCode = serializers.RegexField(r'^\d{6}$', error_messages={
        'required': 'PIN code is required', 'blank': 'PIN code is required', 'invalid': 'PIN code must be 6 digits',
    })
    # #11 — optional
    address = serializers.CharField(max_length=250, required=False, allow_blank=True, error_messages={
        'max_length': 'Address must be 250 characters or fewer',
    })

    def validate_dob(self, value):
        """#5 — stored as YYYY-MM-DD; age between MIN_AGE and MAX_AGE."""
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', value):
            raise serializers.ValidationError('Date of birth is required')
        try:
            dob = date.fromisoformat(value)
        except ValueError:
            raise serializers.ValidationError('Enter a valid date')
        if not c.MIN_AGE <= age_on(dob) <= c.MAX_AGE:
            raise serializers.ValidationError(f'Age must be between {c.MIN_AGE} and {c.MAX_AGE}')
        return value

    def validate(self, attrs):
        if not attrs.get('address'):
            attrs.pop('address', None)
        return attrs


class GuardianSerializer(serializers.Serializer):
    name = serializers.RegexField(r'^[A-Za-z ]+$', max_length=100, error_messages={
        'required': 'Parent/guardian name is required', 'blank': 'Parent/guardian name is required',
        'invalid': 'Parent/guardian name can only contain letters',
    })
    relationship = pick(c.RELATIONSHIPS, 'a relationship')
    mobile = IndianMobileField('Parent/guardian mobile')
    email = OptionalEmail()  # #15 — optional

    def validate(self, attrs):
        if not attrs.get('email'):
            attrs.pop('email', None)
        return attrs


class PersonalStepSerializer(serializers.Serializer):
    personal = PersonalSerializer()
    guardian = GuardianSerializer()

    def validate(self, attrs):
        # #14: must not equal the candidate's mobile
        if attrs['guardian']['mobile'] == attrs['personal']['mobile']:
            raise serializers.ValidationError({'guardian': {'mobile': ["Must be different from the candidate's mobile"]}})
        return attrs


def year_field(label):
    return serializers.IntegerField(error_messages={
        'required': f'{label} is required', 'null': f'{label} is required', 'invalid': f'{label} must be a year',
    })


def score_issue(grade_type, score, mandatory: bool) -> dict:
    """#17/#20/#25: pick the type, then the value — % 0–100 or CGPA 0–10, up to 2 decimals."""
    if score is None:
        issues = {}
        if mandatory:
            issues['score'] = 'Score is required'
            if not grade_type:
                issues['gradeType'] = 'Select a grade type'
        return issues
    if not grade_type:
        return {'gradeType': 'Select a grade type'}
    top = 10 if grade_type == 'CGPA' else 100
    if score < 0 or score > top:
        return {'score': f'{grade_type} must be between 0 and {top}'}
    if abs(score * 100 - round(score * 100)) > 1e-6:  # 9.2 * 100 is 919.9999… in floating point
        return {'score': 'Use at most 2 decimal places'}
    return {}


class SchoolSerializer(serializers.Serializer):
    yearOfPassing = year_field('Year of passing')
    gradeType = pick(c.GRADE_TYPES, 'a grade type')
    score = serializers.FloatField(error_messages={'required': 'Score is required', 'null': 'Score is required'})
    medium = pick(c.MEDIUMS, 'a medium')


class UgSerializer(serializers.Serializer):
    qualification = pick(c.UG_QUALIFICATIONS, 'a qualification')
    status = pick(c.QUALIFICATION_STATUSES, 'a status')
    institution = serializers.CharField(max_length=150, error_messages={
        'required': 'Institution name is required', 'blank': 'Institution name is required',
        'max_length': 'Institution name must be 150 characters or fewer',
    })
    gradeType = serializers.ChoiceField(choices=c.GRADE_TYPES, required=False, error_messages={'invalid_choice': 'Select a grade type'})
    score = serializers.FloatField(required=False)
    yearOfPassing = year_field('UG year of passing')
    medium = pick(c.MEDIUMS, 'a medium')


class HigherQualificationSerializer(serializers.Serializer):
    has = serializers.BooleanField(error_messages={'required': 'Select Yes or No', 'null': 'Select Yes or No', 'invalid': 'Select Yes or No'})
    details = serializers.CharField(max_length=150, required=False, allow_blank=True, error_messages={
        'max_length': 'Qualification details must be 150 characters or fewer',
    })


class AcademicSerializer(serializers.Serializer):
    class10 = SchoolSerializer()
    class12 = SchoolSerializer()
    ug = UgSerializer()
    higherQualification = HigherQualificationSerializer()

    def validate(self, a):
        now = date.today().year
        issues: dict[str, dict] = {}

        def add(section, field, message):
            issues.setdefault(section, {}).setdefault(field, [message])

        c10, c12, ug, hq = a['class10'], a['class12'], a['ug'], a['higherQualification']
        # #16 — 1990 to current year
        if not c.MIN_PASSING_YEAR <= c10['yearOfPassing'] <= now:
            add('class10', 'yearOfPassing', f'Year must be between {c.MIN_PASSING_YEAR} and {now}')
        # #19 — later than #16 (and not in the future)
        if c12['yearOfPassing'] <= c10['yearOfPassing']:
            add('class12', 'yearOfPassing', 'Must be later than the Class 10th year')
        elif c12['yearOfPassing'] > now:
            add('class12', 'yearOfPassing', f'Year cannot be after {now}')
        for section, data, mandatory in (
            ('class10', c10, True), ('class12', c12, True), ('ug', ug, ug['status'] == 'Completed'),  # #25
        ):
            for field, message in score_issue(data.get('gradeType'), data.get('score'), mandatory).items():
                add(section, field, message)
        # #26 — later than #19; a future year only while Pursuing
        latest = c.max_pursuing_year() if ug['status'] == 'Pursuing' else now
        if ug['yearOfPassing'] <= c12['yearOfPassing']:
            add('ug', 'yearOfPassing', 'Must be later than the Class 12th year')
        elif ug['yearOfPassing'] > latest:
            add('ug', 'yearOfPassing',
                f'Year cannot be after {latest}' if ug['status'] == 'Pursuing' else 'A future year is allowed only while Pursuing')
        # #28 — Yes → details mandatory
        if hq['has'] and not hq.get('details'):
            add('higherQualification', 'details', 'Enter the qualification details')
        if issues:
            raise serializers.ValidationError(issues)

        # Hidden fields are cleared on save (Deep Dive LM-18).
        a['higherQualification'] = hq if hq['has'] else {'has': False}
        return a


class AcademicStepSerializer(serializers.Serializer):
    academic = AcademicSerializer()


class WorkSerializer(serializers.Serializer):
    employmentStatus = pick(c.EMPLOYMENT_STATUSES, 'an employment status')
    organization = serializers.CharField(max_length=100, required=False, allow_blank=True)
    designation = serializers.CharField(max_length=100, required=False, allow_blank=True)
    functionalArea = serializers.CharField(max_length=100, required=False, allow_blank=True)
    # #33 — years 0–30, months 0–11
    experienceYears = serializers.IntegerField(min_value=0, max_value=30, required=False, error_messages={
        'min_value': 'Years must be 0–30', 'max_value': 'Years must be 0–30', 'invalid': 'Whole years only',
    })
    experienceMonths = serializers.IntegerField(min_value=0, max_value=11, required=False, error_messages={
        'min_value': 'Months must be 0–11', 'max_value': 'Months must be 0–11', 'invalid': 'Whole months only',
    })

    def validate(self, w):
        if w['employmentStatus'] != 'Experienced':
            # #30–#33 show only for Experienced; a fresher keeps none of them (LM-18).
            return {'employmentStatus': w['employmentStatus']}
        needed = {
            'organization': 'Organization name is required',
            'designation': 'Designation is required',
            'functionalArea': 'Functional area is required',
            'experienceYears': 'Years are required',
            'experienceMonths': 'Months are required',
        }
        missing = {k: [m] for k, m in needed.items() if w.get(k) in (None, '')}
        if missing:
            raise serializers.ValidationError(missing)
        return w


class WorkStepSerializer(serializers.Serializer):
    work = WorkSerializer()


class DeclarationSerializer(serializers.Serializer):
    accepted = serializers.BooleanField(error_messages={'required': 'Accept the declaration to continue'})

    def validate_accepted(self, value):
        if value is not True:
            raise serializers.ValidationError('Accept the declaration to continue')
        return value


class UnlockSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=3, max_length=500, error_messages={
        'required': 'Enter a reason for unlocking', 'blank': 'Enter a reason for unlocking',
        'min_length': 'Enter a reason for unlocking',
    })
