"""
Stage rules of Go-live §7, mapped onto the Lead Stages sheet.

The go-live doc names some stages differently from the sheet (Junk → Invalid,
Lost → Closed - Lost); the two stages the sheet does not have — Re-enquired and
Application Submitted — are seeded as system stages.
"""
UNTOUCHED = 'Untouched'
NOT_CONNECTED = 'Not Connected'
INTERESTED = 'Interested'
RE_ENQUIRED = 'Re-enquired'
APPLICATION_SUBMITTED = 'Application Submitted'
NOT_INTERESTED = 'Not Interested'
JUNK = 'Invalid'
LOST = 'Closed - Lost'

# GL-20: counsellors cannot pick these — the system sets them
LOCKED_STAGES = {APPLICATION_SUBMITTED, RE_ENQUIRED}
# GL-08: a re-enquiry reopens a closed lead (every "lost"-type stage)
# GL-24: automations never fire for these
NO_AUTOMATION_STAGES = {JUNK}

ATTEMPT_LIMIT = 10  # GL-18: consecutive "Not connected"
ATTEMPT_MIN_DAYS = 3
ATTEMPT_LOST_REASON = 'Stopped answering after counselling (5-7 attempts)'

LANGUAGE_BARRIER = 'Language barrier'  # sub-stage that alerts Admin to reassign


def needs_follow_up(stage) -> bool:
    """GL-19: every open stage (Untouched, Not Connected, Interested, … Re-enquired) carries a follow-up."""
    return stage.type == 'open' and stage.name != APPLICATION_SUBMITTED


def needs_reason(stage) -> bool:
    """Closing a lead (Not Interested, Invalid, Not Eligible, Lost) needs a reason."""
    return stage.type == 'lost'


def status_for(stage) -> str:
    return {'converted': 'converted', 'lost': 'lost'}.get(stage.type, 'active')
