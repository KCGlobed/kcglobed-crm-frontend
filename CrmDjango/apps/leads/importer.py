"""
Excel / CSV bulk upload and import-update (Go-live GL-11, GL-37).

template → preview (first 20 rows with errors) → upload with:
  source (mandatory), assign (unassigned | one counsellor | split equally),
  duplicates (skip — default | update empty fields), send welcome message.
Result: created / updated / skipped / failed with a downloadable error file.

Import-update: when a "Lead ID" column is mapped, rows matching a lead (by Lead
ID, else mobile) update only the mapped columns; the owner changes only when an
"Owner email" column is mapped and the uploader is an Admin.
"""
import csv
import io
import os
import re
import uuid
from datetime import date, datetime

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.masters.models import Program, Source
from apps.notifications.services import notify
from apps.users.models import User
from common.exceptions import ApiError
from common.normalize import normalize_email, normalize_mobile
from common.roles import ADMIN, COUNSELLOR

from .activity import log_activity
from .history import record_changes
from .models import Counter, Lead, LeadActivity

MAX_ROWS = 20_000
MAX_FILE_BYTES = 10 * 1024 * 1024
PREVIEW_ROWS = 20
ALLOWED_EXTENSIONS = ('.csv', '.xlsx', '.xls')
MOBILE_RE = re.compile(r'^[6-9]\d{9}$')
EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
NAME_RE = re.compile(r'^[A-Za-z][A-Za-z .]*$')
LEAD_NO_RE = re.compile(r'^GCC-L-\d{7}$', re.I)

# CRM field → (template header, aliases used for auto-matching)
FIELDS = {
    'firstName': ('First Name', ['first name', 'firstname', 'first', 'name', 'full name', 'student name']),
    'lastName': ('Last Name', ['last name', 'lastname', 'surname']),
    'mobile': ('Mobile', ['mobile', 'mobile number', 'phone', 'phone number', 'contact', 'contact number']),
    'email': ('Email', ['email', 'email id', 'e-mail', 'email address']),
    'state': ('State', ['state', 'current state']),
    'city': ('City', ['city', 'current city']),
    'programInterest': ('Program Interest', ['program', 'program interest', 'programme', 'course']),
    'leadNo': ('Lead ID', ['lead id', 'lead no', 'lead number']),
    'ownerEmail': ('Owner Email', ['owner email', 'counsellor email', 'owner']),
}
TEMPLATE_FIELDS = ['firstName', 'lastName', 'mobile', 'email', 'state', 'city', 'programInterest']
ERROR_DIR = 'import-errors'


# ------------------------------------------------------------------ files


def check_upload(upload) -> None:
    if upload is None:
        raise ApiError.bad_request('Upload a CSV or Excel file')
    if upload.size > MAX_FILE_BYTES:
        raise ApiError.bad_request('The file is larger than 10 MB')
    if not upload.name.lower().endswith(ALLOWED_EXTENSIONS):
        raise ApiError.bad_request('Only .xlsx, .xls or .csv files are allowed')


def _cell(value) -> str:
    if value is None:
        return ''
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value).strip()


def read_table(upload) -> tuple[list[str], list[dict]]:
    name = upload.name.lower()
    upload.seek(0)
    content = upload.read()
    try:
        if name.endswith('.xlsx'):
            from openpyxl import load_workbook

            sheet = load_workbook(io.BytesIO(content), read_only=True, data_only=True).worksheets[0]
            table = [list(r) for r in sheet.iter_rows(values_only=True)]
        elif name.endswith('.xls'):
            import xlrd

            sheet = xlrd.open_workbook(file_contents=content).sheet_by_index(0)
            table = [sheet.row_values(i) for i in range(sheet.nrows)]
        else:
            table = list(csv.reader(io.StringIO(content.decode('utf-8-sig', errors='replace'))))
    except Exception:  # noqa: BLE001
        raise ApiError.bad_request('The uploaded file has no readable sheet')
    if not table:
        raise ApiError.bad_request('The uploaded file is empty')
    headers = [_cell(h) for h in table[0]]
    rows = []
    for index, raw in enumerate(table[1:], start=2):
        values = [_cell(v) for v in raw]
        if not any(values):
            continue
        row = {h: values[i] if i < len(values) else '' for i, h in enumerate(headers) if h}
        row['__row'] = index
        rows.append(row)
    return [h for h in headers if h], rows


def auto_mapping(headers: list[str]) -> dict:
    """Auto-match by header name (case / spacing insensitive)."""
    norm = {re.sub(r'[^a-z0-9]+', ' ', h.lower()).strip(): h for h in headers}
    mapping = {}
    for field, (label, aliases) in FIELDS.items():
        for alias in [label.lower(), *aliases]:
            if alias in norm and norm[alias] not in mapping.values():
                mapping[field] = norm[alias]
                break
    return mapping


def template_file() -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Font

    book = Workbook()
    sheet = book.active
    sheet.title = 'Leads'
    sheet.append([FIELDS[f][0] for f in TEMPLATE_FIELDS])
    sheet.append(['Aarav', 'Sharma', '9876543210', 'aarav@example.com', 'Maharashtra', 'Mumbai', 'GMBA'])
    for cell in sheet[1]:
        cell.font = Font(bold=True)
    for col in 'ABCDEFG':
        sheet.column_dimensions[col].width = 20
    notes = book.create_sheet('Instructions')
    for line in [
        ['First Name and Mobile are required. Mobile: 10 digits starting 6-9 (+91 / leading 0 are removed).'],
        ['Email optional; must be valid. Max 20,000 rows / 10 MB.'],
        ['To update existing leads add a "Lead ID" column (GCC-L-0000123); add "Owner Email" to change the owner.'],
    ]:
        notes.append(line)
    out = io.BytesIO()
    book.save(out)
    return out.getvalue()


# -------------------------------------------------------------- validation


class Ctx:
    """Lookups shared by preview and upload."""

    def __init__(self, rows, mapping):
        self.mapping = mapping
        programs = Program.objects.filter(is_active=True)
        self.programs = {p.name.lower(): p.id for p in programs} | {p.code.lower(): p.id for p in programs}
        self.counsellors = {u.email: u for u in User.objects.filter(role=COUNSELLOR, is_active=True)}
        mobiles = {normalize_mobile(self.col(r, 'mobile')) for r in rows} - {None, ''}
        emails = {normalize_email(self.col(r, 'email')) for r in rows} - {None, ''}
        lead_nos = {self.col(r, 'leadNo').upper() for r in rows if self.col(r, 'leadNo')}
        existing = Lead.objects.filter(Q(mobile__in=mobiles) | Q(email__in=emails) | Q(lead_no__in=lead_nos), is_deleted=False)
        self.by_mobile, self.by_email, self.by_no = {}, {}, {}
        for lead in existing:
            self.by_mobile[lead.mobile] = lead
            if lead.email:
                self.by_email[lead.email] = lead
            self.by_no[lead.lead_no] = lead

    def col(self, row: dict, field: str) -> str:
        column = self.mapping.get(field)
        return (row.get(column) or '').strip() if column else ''


def validate_row(row: dict, ctx: Ctx, seen: dict) -> tuple[dict | None, str | None, Lead | None]:
    """→ (clean values, error, matching existing lead)."""
    first, last = ctx.col(row, 'firstName'), ctx.col(row, 'lastName')
    if first and not last and ctx.mapping.get('firstName') and ' ' in first and not ctx.mapping.get('lastName'):
        first, last = first.split(' ', 1)
    raw_mobile = ctx.col(row, 'mobile')
    mobile = normalize_mobile(raw_mobile) if raw_mobile else None
    email = normalize_email(ctx.col(row, 'email')) or None
    lead_no = ctx.col(row, 'leadNo').upper() or None
    target = ctx.by_no.get(lead_no) if lead_no else None

    if lead_no and not LEAD_NO_RE.match(lead_no):
        return None, f'Lead ID invalid: {lead_no}', None
    if lead_no and not target:
        return None, f'Lead ID not found: {lead_no}', None
    if not target:
        if not first:
            return None, 'First Name missing', None
        if not raw_mobile:
            return None, 'Mobile missing', None
    if first and (len(first) > 50 or not NAME_RE.match(first)):
        return None, 'First Name invalid (letters, spaces, dot; max 50)', None
    if raw_mobile and not (mobile and MOBILE_RE.match(mobile)):
        return None, 'Mobile invalid', None
    if email and not EMAIL_RE.match(email):
        return None, 'Email invalid', None
    program = ctx.col(row, 'programInterest')
    program_id = ctx.programs.get(program.lower()) if program else None
    if program and not program_id:
        return None, f'Program Interest not found: {program}', None
    owner_email = normalize_email(ctx.col(row, 'ownerEmail'))
    owner = ctx.counsellors.get(owner_email) if owner_email else None
    if owner_email and not owner:
        return None, f'Owner Email is not an active counsellor: {owner_email}', None
    for key, value in (('mobile', mobile), ('email', email)):
        if value and value in seen.get(key, {}):
            return None, f"Duplicate within file (row {seen[key][value]})", None
        if value:
            seen.setdefault(key, {})[value] = row['__row']
    existing = target or (ctx.by_mobile.get(mobile) if mobile else None) or (ctx.by_email.get(email) if email else None)
    values = {'first_name': first or None, 'last_name': last or None, 'mobile': mobile, 'email': email,
              'state': ctx.col(row, 'state') or None, 'city': ctx.col(row, 'city') or None,
              'program_interest_id': program_id, '_owner': owner}
    return values, None, existing


def preview(upload, mapping: dict | None) -> dict:
    headers, rows = read_table(upload)
    if len(rows) > MAX_ROWS:
        raise ApiError.bad_request(f'Maximum {MAX_ROWS:,} rows per upload (file has {len(rows):,})')
    mapping = mapping or auto_mapping(headers)
    ctx = Ctx(rows[:PREVIEW_ROWS], mapping)
    seen: dict = {}
    sample = []
    for row in rows[:PREVIEW_ROWS]:
        _, error, existing = validate_row(row, ctx, seen)
        sample.append({
            'row': row['__row'], 'values': {k: v for k, v in row.items() if k != '__row'}, 'error': error,
            'duplicateOf': existing.lead_no if existing and not error else None,
        })
    return {
        'headers': headers, 'mapping': mapping, 'totalRows': len(rows), 'rows': sample,
        'fields': [{'key': k, 'label': v[0], 'required': k in ('firstName', 'mobile')} for k, v in FIELDS.items()],
    }


# ------------------------------------------------------------------ upload


def _options(raw: dict, actor) -> dict:
    errors = {}
    source = Source.objects.filter(pk=raw.get('source'), is_active=True).first() if raw.get('source') else None
    if not source:
        errors['source'] = 'Choose the Source for this file'
    mode = raw.get('assignMode') or 'unassigned'
    owners = list(dict.fromkeys(raw.get('owners') or []))
    if mode not in ('unassigned', 'one', 'split'):
        errors['assignMode'] = 'Assign to: unassigned, one or split'
    elif mode == 'one' and len(owners) != 1:
        errors['owners'] = 'Choose one counsellor'
    elif mode == 'split' and len(owners) < 2:
        errors['owners'] = 'Choose at least two counsellors to split between'
    counsellors = list(User.objects.filter(pk__in=owners, role=COUNSELLOR, is_active=True))
    if mode != 'unassigned' and len(counsellors) != len(owners):
        errors['owners'] = 'Only active Admission Counsellors can receive leads'
    duplicates = raw.get('duplicates') or 'skip'
    if duplicates not in ('skip', 'update_empty'):
        errors['duplicates'] = 'Duplicates: skip or update_empty'
    if errors:
        raise ApiError.bad_request('Validation failed', errors)
    order = {o: i for i, o in enumerate(owners)}
    return {'source': source, 'mode': mode, 'owners': sorted(counsellors, key=lambda u: order[u.id]),
            'duplicates': duplicates, 'welcome': bool(raw.get('sendWelcome')),
            'can_change_owner': actor.is_super_admin or getattr(actor, 'role', None) == ADMIN}


def import_leads(upload, mapping: dict | None, raw_options: dict, actor) -> dict:
    from .services import default_stage, fire, lead_number

    opts = _options(raw_options, actor)
    headers, rows = read_table(upload)
    if not rows:
        raise ApiError.bad_request('The uploaded file has no data rows')
    if len(rows) > MAX_ROWS:
        raise ApiError.bad_request(f'Maximum {MAX_ROWS:,} rows per upload (file has {len(rows):,})')
    mapping = {k: v for k, v in (mapping or auto_mapping(headers)).items() if v}
    if not mapping.get('leadNo'):
        if not mapping.get('firstName'):
            raise ApiError.bad_request('Map a column to First Name')
        if not mapping.get('mobile'):
            raise ApiError.bad_request('Map a column to Mobile')
    missing = [c for c in mapping.values() if c not in headers]
    if missing:
        raise ApiError.bad_request(f"Column(s) not in the file: {', '.join(missing)}")

    ctx = Ctx(rows, mapping)
    seen: dict = {}
    failed: list[dict] = []
    skipped: list[dict] = []
    to_create: list[tuple[int, dict]] = []
    to_update: list[tuple[int, dict, Lead, bool]] = []  # (row, values, lead, overwrite mapped)
    for row in rows:
        values, error, existing = validate_row(row, ctx, seen)
        if error:
            failed.append({'row': row['__row'], 'reason': error, 'data': row})
        elif existing and ctx.col(row, 'leadNo'):
            to_update.append((row['__row'], values, existing, True))  # GL-37 import-update
        elif existing and opts['duplicates'] == 'update_empty':
            to_update.append((row['__row'], values, existing, False))
        elif existing:
            skipped.append({'row': row['__row'], 'reason': f'Duplicate of lead {existing.lead_no}', 'data': row})
        else:
            to_create.append((row['__row'], values))

    file_name = upload.name[:255]
    now = timezone.now()
    stage = default_stage()
    owners = opts['owners']
    created_leads: list[Lead] = []
    with transaction.atomic():
        if to_create:
            start = Counter.next_range('lead', len(to_create))
            for i, (_, values) in enumerate(to_create):
                owner = owners[0] if opts['mode'] == 'one' else owners[i % len(owners)] if opts['mode'] == 'split' else None
                values = {k: v for k, v in values.items() if k != '_owner'}
                created_leads.append(Lead(
                    **values, lead_no=lead_number(start + i), source=opts['source'], first_source=opts['source'],
                    created_via='import', created_by_id=actor.id, stage=stage, stage_changed_at=now,
                    owner_id=owner.id if owner else None, assigned_at=now if owner else None, last_activity_at=now,
                    upload_file_name=file_name, track='other',
                ))
            Lead.objects.bulk_create(created_leads, batch_size=1000)
            names = {u.id: u.name for u in owners}
            activities = []
            for lead in created_leads:
                activities.append(LeadActivity(
                    lead=lead, type='created', title='Lead created via Bulk Upload',
                    description=f"Source: {opts['source'].name}\nFile: {file_name}\nCreated by: {actor.name}",
                    data={'via': 'import', 'source': opts['source'].name, 'file': file_name},
                    actor_id=actor.id, actor_type='user', actor_name=actor.name,
                ))
                if lead.owner_id:
                    activities.append(LeadActivity(
                        lead=lead, type='assignment', title=f'Assigned to {names[lead.owner_id]} by {actor.name}',
                        description='Reason: New allocation (bulk upload)',
                        data={'to': lead.owner_id, 'toName': names[lead.owner_id], 'by': actor.name, 'reason': 'New allocation'},
                        actor_id=actor.id, actor_type='user', actor_name=actor.name,
                    ))
            LeadActivity.objects.bulk_create(activities, batch_size=1000)

    updated = 0
    for row_no, values, lead, overwrite in to_update:
        if _apply_update(lead, values, overwrite, opts, actor, file_name):
            updated += 1
        else:
            skipped.append({'row': row_no, 'reason': f'Duplicate of lead {lead.lead_no} (nothing to update)', 'data': None})

    # one alert per counsellor
    per_owner: dict[str, int] = {}
    for lead in created_leads:
        if lead.owner_id:
            per_owner[lead.owner_id] = per_owner.get(lead.owner_id, 0) + 1
    for owner_id, count in per_owner.items():
        notify(owner_id, 'lead_assigned', f'{count} leads assigned to you by {actor.name}', f'Bulk upload: {file_name}', {'bulk': True})
    if opts['welcome']:
        for lead in created_leads:
            fire('lead_created_bulk', lead, actor=actor, force=True)

    error_rows = [*failed, *skipped]
    error_file = _write_error_file(headers, error_rows) if error_rows else None
    result = {
        'total': len(rows), 'created': len(created_leads), 'updated': updated, 'skipped': len(skipped),
        'failed': len(failed), 'fileName': file_name, 'errorFile': error_file,
        'errors': [{'row': e['row'], 'reason': e['reason']} for e in error_rows[:200]],
        'perCounsellor': [{'_id': u.id, 'name': u.name, 'count': per_owner.get(u.id, 0)} for u in owners],
    }
    notify(actor.id, 'bulk_done', f'Bulk upload finished: {file_name}',
           f"{result['created']} created, {updated} updated, {result['skipped']} skipped, {result['failed']} failed",
           {'errorFile': error_file})
    return result


def _apply_update(lead: Lead, values: dict, overwrite: bool, opts: dict, actor, file_name: str) -> bool:
    """overwrite=True: GL-37 mapped columns replace values; False: only empty fields are filled."""
    from .services import assign_owner

    labels = {'first_name': 'First name', 'last_name': 'Last name', 'email': 'Email', 'mobile': 'Mobile',
              'state': 'State', 'city': 'City', 'program_interest_id': 'Program'}
    changes = []
    for attr, label in labels.items():
        new = values.get(attr)
        old = getattr(lead, attr)
        if new is None or new == old or (not overwrite and old not in (None, '')):
            continue
        if attr in ('mobile', 'email') and Lead.objects.filter(**{attr: new}, is_deleted=False).exclude(pk=lead.pk).exists():
            continue
        setattr(lead, attr, new)
        changes.append((attr, label, old, new))
    if changes:
        lead.save()
        record_changes(lead.id, 'lead', changes, actor, title=f'Updated from bulk upload ({file_name})')
    owner = values.get('_owner')
    if overwrite and owner and opts['can_change_owner'] and owner.id != lead.owner_id:
        assign_owner(lead, owner.id, by_label=actor.name, actor=actor, reason='Import update')
        return True
    return bool(changes)


def _write_error_file(headers: list[str], rows: list[dict]) -> str:
    from openpyxl import Workbook

    book = Workbook(write_only=True)
    sheet = book.create_sheet('Errors')
    sheet.append(['Row', 'Reason', *headers])
    for e in rows:
        data = e.get('data') or {}
        sheet.append([e['row'], e['reason'], *[data.get(h, '') for h in headers]])
    name = f'{uuid.uuid4().hex}.xlsx'
    folder = os.path.join(settings.MEDIA_ROOT, ERROR_DIR)
    os.makedirs(folder, exist_ok=True)
    book.save(os.path.join(folder, name))
    return name


def error_file_path(name: str) -> str:
    if not re.fullmatch(r'[0-9a-f]{32}\.xlsx', name or ''):
        raise ApiError.not_found('Error file not found')
    path = os.path.join(settings.MEDIA_ROOT, ERROR_DIR, name)
    if not os.path.exists(path):
        raise ApiError.not_found('Error file not found')
    return path


__all__ = ['import_leads', 'preview', 'template_file', 'check_upload', 'log_activity']
