"""
Lead export (SOW ID 32, Deep Dive LM-55): the current filtered list, within the
caller's data scope, with field rules applied, as CSV or XLSX. `columns` picks
and orders the columns; without it the original 21 columns are exported.
"""
import csv
import io

from common.exceptions import ApiError
from common.masking import apply_field_rules
from common.renderers import iso

from .presenters import lead_doc, sub_stage_name, with_relations

EXPORT_LIMIT = 10_000  # GL-38: above this the export is prepared in the background
MAX_EXPORT = 200_000
FORMATS = ('csv', 'xlsx')


def _get(doc: dict, path: str):
    first, _, second = path.partition('.')
    value = doc.get(first)
    if second:
        return value.get(second) if isinstance(value, dict) else None
    return value


def _field(path: str):
    return lambda doc, lead: _get(doc, path)


# key → (header, value getter). `doc` is the masked lead JSON, `lead` the model.
COLUMNS: dict[str, tuple[str, object]] = {
    'leadNo': ('Lead No', _field('leadNo')),
    'firstName': ('First Name', _field('firstName')),
    'lastName': ('Last Name', _field('lastName')),
    'mobile': ('Mobile', _field('mobile')),
    'email': ('Email', _field('email')),
    'city': ('City', _field('city')),
    'state': ('State', _field('state')),
    'source': ('Source', _field('source.name')),
    'channel': ('Channel', _field('source.channel')),
    'firstSource': ('First Source', _field('firstSource.name')),
    'stage': ('Stage', _field('stage.name')),
    'subStage': ('Sub Stage', lambda doc, lead: sub_stage_name(lead)),
    'status': ('Status', _field('status')),
    'lastDisposition': ('Last Disposition', _field('lastDisposition')),
    'owner': ('Owner', _field('owner.name')),
    'program': ('Program', _field('programInterest.name')),
    'cohort': ('Cohort', _field('cohort.name')),
    'track': ('Track', _field('track')),
    'tags': ('Tags', lambda doc, lead: ', '.join(t['name'] for t in doc.get('tags') or [])),
    'utmSource': ('UTM Source', _field('utm.source')),
    'utmMedium': ('UTM Medium', _field('utm.medium')),
    'utmCampaign': ('UTM Campaign', _field('utm.campaign')),
    'partner': ('Partner', _field('referral.partnerName')),
    'referralCode': ('Referral Code', _field('referral.code')),
    'createdVia': ('Created Via', _field('createdVia')),
    'createdAt': ('Created At', lambda doc, lead: iso(lead.created_at)),
    'updatedAt': ('Updated At', lambda doc, lead: iso(lead.updated_at)),
    'assignedAt': ('Assigned At', lambda doc, lead: iso(lead.assigned_at)),
    'stageChangedAt': ('Stage Changed At', lambda doc, lead: iso(lead.stage_changed_at)),
    'lastActivityAt': ('Last Activity At', lambda doc, lead: iso(lead.last_activity_at)),
    'nextFollowUpAt': ('Next Follow-up At', lambda doc, lead: iso(getattr(lead, 'next_follow_up_at', None))),
    # Go-live §6.1 system fields
    'createdViaLabel': ('Created Via (label)', _field('createdViaLabel')),
    'reEnquiryCount': ('Re-enquiry Count', _field('reEnquiryCount')),
    'uploadFileName': ('Upload File', _field('uploadFileName')),
    'metaCampaign': ('Meta Campaign', _field('meta.campaignName')),
    'metaAdset': ('Meta Ad Set', _field('meta.adsetName')),
    'metaAd': ('Meta Ad', _field('meta.adName')),
    'metaForm': ('Meta Form', _field('meta.formName')),
    'metaLeadId': ('Meta Lead ID', _field('meta.leadId')),
    'profileCompletion': ('Profile Completion %', _field('profileCompletion')),
    'customFieldsCompletion': ('Custom Fields Completion %', _field('customFieldsCompletion')),
    'optedOutSms': ('Opted out SMS', lambda doc, lead: 'Yes' if (doc.get('optedOut') or {}).get('sms') else 'No'),
    'optedOutEmail': ('Opted out Email', lambda doc, lead: 'Yes' if (doc.get('optedOut') or {}).get('email') else 'No'),
}


def _cell_value(value):
    if isinstance(value, dict):  # Name + Relation
        return ' / '.join(str(v) for v in value.values() if v)
    if isinstance(value, bool):
        return 'Yes' if value else 'No'
    return value


def _register_profile_and_discussion() -> None:
    """Every profile dropdown/number field and every counsellor field is an export column (GL-38)."""
    from .discussion_fields import DISCUSSION_FIELDS
    from .profile_constants import PROFILE_FIELD_LABELS

    for key, label in PROFILE_FIELD_LABELS.items():
        COLUMNS[f'pf.{key}'] = (f'Profile: {label}', lambda doc, lead, k=key: _cell_value((doc.get('profileValues') or {}).get(k)))
    for key, meta in DISCUSSION_FIELDS.items():
        COLUMNS[f'cf.{key}'] = (f"CF {meta['no']}: {meta['label']}",
                                lambda doc, lead, k=key: _cell_value((doc.get('discussionValues') or {}).get(k)))


_register_profile_and_discussion()


def column_options() -> list[dict]:
    return [{'key': k, 'label': v[0], 'group': 'Profile' if k.startswith('pf.') else 'Counsellor discussion'
             if k.startswith('cf.') else 'Lead'} for k, v in COLUMNS.items()]

DEFAULT_COLUMNS = [
    'leadNo', 'firstName', 'lastName', 'mobile', 'email', 'city', 'state', 'source', 'channel', 'stage',
    'subStage', 'status', 'owner', 'program', 'cohort', 'track', 'utmSource', 'utmMedium', 'utmCampaign',
    'partner', 'createdAt',
]


def parse_options(params) -> tuple[list[str], str]:
    """Reads ?columns=a,b,c&format=csv|xlsx; unknown values are a 400, not a silent drop."""
    fmt = (params.get('format') or 'csv').lower()
    if fmt not in FORMATS:
        raise ApiError.bad_request('Validation failed', {'format': 'Format must be csv or xlsx'})
    raw = params.get('columns')
    if not raw:
        return DEFAULT_COLUMNS, fmt
    keys = list(dict.fromkeys(k.strip() for k in raw.split(',') if k.strip()))
    unknown = [k for k in keys if k not in COLUMNS]
    if unknown or not keys:
        raise ApiError.bad_request('Validation failed', {'columns': f"Unknown column(s): {', '.join(unknown) or '(none)'}"})
    return keys, fmt


def build_rows(actor, queryset, keys: list[str], limit: int = EXPORT_LIMIT):
    leads = with_relations(queryset).select_related('sub_stage').order_by('-created_at')[:limit]
    for lead in leads.iterator(chunk_size=500) if limit > EXPORT_LIMIT else leads:
        doc = apply_field_rules(lead_doc(lead, extras=True), actor.field_rules)
        yield ['' if (v := COLUMNS[k][1](doc, lead)) is None else v for k in keys]


def render(keys: list[str], rows, fmt: str) -> bytes:
    headers = [COLUMNS[k][0] for k in keys]
    if fmt == 'xlsx':
        from openpyxl import Workbook

        book = Workbook(write_only=True)
        sheet = book.create_sheet('Leads')
        sheet.append(headers)
        for row in rows:
            sheet.append(row)
        out = io.BytesIO()
        book.save(out)
        return out.getvalue()

    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator='\n')
    writer.writerow(headers)
    writer.writerows(rows)
    return buffer.getvalue().encode('utf-8')


CONTENT_TYPES = {
    'csv': 'text/csv; charset=utf-8',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}
