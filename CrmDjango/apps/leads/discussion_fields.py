"""
Counsellor custom fields (Go-live GL-15) — the 27 "Counsellor Discussion" fields.

Each field: label, type (choice | text | textarea | number | name_relation),
options, limits, `show_if` (parent field + value) and `shared` (stored on the
student profile instead, so profile #29/#30 and discussion #4/#5 are one value).
A hidden child is cleared on save; the history keeps the old value.
"""
YES_NO = ['Yes', 'No']
LEVELS = ['High', 'Medium', 'Low']
RELATIONS = ['Father', 'Mother', 'Sibling', 'Spouse', 'Relative', 'Self', 'Other']

DISCUSSION_FIELDS: dict[str, dict] = {
    'parentInvolved': {'no': 1, 'label': 'Is Parent/Guardian involved in career decision?', 'type': 'choice', 'options': YES_NO},
    'decisionInfluencer': {'no': 2, 'label': 'Key Decision Influencer in Family', 'type': 'name_relation', 'options': RELATIONS},
    'jobAspirationDomain': {'no': 3, 'label': 'Job Aspirations Domain', 'type': 'text', 'max': 150},
    'employmentStatus': {
        'no': 4, 'label': 'Fresher or Working', 'type': 'choice', 'options': ['Fresher', 'Working'],
        # same stored field as profile #29 (Fresher / Experienced)
        'shared': ('work', 'employmentStatus', {'Fresher': 'Fresher', 'Working': 'Experienced'}),
    },
    'currentCompany': {
        'no': 5, 'label': 'Currently Working (Company Name)', 'type': 'text', 'max': 100,
        'show_if': ('employmentStatus', 'Working'), 'shared': ('work', 'organization', None),
    },
    'currentSalary': {'no': 6, 'label': 'Current Salary (INR / month)', 'type': 'number', 'min': 0, 'max': 10_000_000,
                      'show_if': ('employmentStatus', 'Working')},
    'experienceRelevant': {'no': 7, 'label': 'Is experience relevant to GCC hiring profiles?', 'type': 'choice',
                           'options': YES_NO, 'show_if': ('employmentStatus', 'Working')},
    'candidateDecisionLevel': {'no': 8, 'label': 'Candidate Level of Decision Making', 'type': 'choice', 'options': LEVELS},
    'parentsDecisionLevel': {'no': 9, 'label': "Parents' Level of Decision Making", 'type': 'choice', 'options': LEVELS},
    'qualificationInterestLevel': {'no': 10, 'label': "Candidate's Interest Level in Professional Qualification",
                                   'type': 'choice', 'options': LEVELS},
    'oneYearProgramInterest': {'no': 11, 'label': 'Interested in a 1-year industry-aligned program?', 'type': 'choice', 'options': YES_NO},
    'careerDiscussant': {'no': 12, 'label': 'With whom does the candidate discuss career growth?', 'type': 'name_relation', 'options': RELATIONS},
    'professionalCoursesInterest': {'no': 13, 'label': 'Interested in Professional Courses – CPA/ACCA/EA etc.?', 'type': 'choice', 'options': YES_NO},
    'preferredQualification': {'no': 14, 'label': 'Preferred Professional Qualification', 'type': 'choice',
                               'options': ['US CPA', 'ACCA', 'US EA', 'US CMA', 'Other'],
                               'show_if': ('professionalCoursesInterest', 'Yes')},
    'expertDiscussion': {'no': 15, 'label': 'Interested in One-on-One discussion with Expert?', 'type': 'choice', 'options': YES_NO},
    'familySize': {'no': 16, 'label': 'Family Size', 'type': 'number', 'min': 1, 'max': 20, 'integer': True},
    'earningMembers': {'no': 17, 'label': 'Earning Members in Family', 'type': 'number', 'min': 0, 'max': 20, 'integer': True},
    'coApplicantName': {'no': 18, 'label': 'Name of Financial Co-applicant', 'type': 'text', 'max': 100,
                        'show_if': ('canPayIndependently', 'No')},
    'coApplicantRelation': {'no': 19, 'label': 'Relation with Financial Co-applicant', 'type': 'text', 'max': 60,
                            'show_if': ('canPayIndependently', 'No')},
    'canPayIndependently': {'no': 20, 'label': 'Can candidate pay fees independently?', 'type': 'choice', 'options': YES_NO},
    'coApplicantOccupation': {'no': 21, 'label': 'Financial Co-applicant Job/Business', 'type': 'choice',
                              'options': ['Job', 'Business'], 'show_if': ('canPayIndependently', 'No')},
    'coApplicantEarnings': {'no': 22, 'label': 'Financial Co-applicant Monthly Earnings (INR)', 'type': 'number',
                            'min': 0, 'max': 100_000_000, 'show_if': ('canPayIndependently', 'No')},
    'coApplicantExpenses': {'no': 23, 'label': 'Financial Co-applicant Monthly Expenses (INR)', 'type': 'number',
                            'min': 0, 'max': 100_000_000, 'show_if': ('canPayIndependently', 'No')},
    'existingLoan': {'no': 24, 'label': 'Existing Loan in Family', 'type': 'choice', 'options': YES_NO},
    'existingLoanDetails': {'no': 24.1, 'label': 'Loan details', 'type': 'textarea', 'max': 250,
                            'show_if': ('existingLoan', 'Yes'), 'required_if_shown': True},
    'loanDefault': {'no': 25, 'label': 'Loan Default History in Family', 'type': 'choice', 'options': YES_NO},
    'loanDefaultDetails': {'no': 25.1, 'label': 'Default details', 'type': 'textarea', 'max': 250,
                           'show_if': ('loanDefault', 'Yes'), 'required_if_shown': True},
    'loanInterest': {'no': 26, 'label': 'Candidate Interested in Loan Facility', 'type': 'choice', 'options': YES_NO},
    'careerConcern': {'no': 27, 'label': 'Any specific career concern/question?', 'type': 'textarea', 'max': 1000},
}

# The 27 numbered fields (details boxes count with their parent) — for Custom Fields Completion %.
NUMBERED = [k for k, m in DISCUSSION_FIELDS.items() if float(m['no']).is_integer()]


def is_shown(key: str, data: dict) -> bool:
    cond = DISCUSSION_FIELDS[key].get('show_if')
    return not cond or data.get(cond[0]) == cond[1]


def completion_percent(data: dict) -> int:
    """Filled ÷ applicable numbered fields; a hidden child doesn't count."""
    applicable = [k for k in NUMBERED if is_shown(k, data)]
    filled = [k for k in applicable if _filled(data.get(k))]
    return round(len(filled) / len(applicable) * 100) if applicable else 0


def _filled(value) -> bool:
    if isinstance(value, dict):
        return bool(value.get('name') or value.get('relation'))
    return value not in (None, '', [])
