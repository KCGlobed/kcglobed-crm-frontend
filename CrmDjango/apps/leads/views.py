import json
import time

from django.http import FileResponse, HttpResponse

from apps.audit.services import audit
from common.exceptions import ApiError
from common.pagination import parse_list_query, parse_page
from common.responses import build_pagination, created, ok
from common.roles import COUNSELLOR
from common.validation import validated
from common.views import ApiView, PublicView

from . import capture, discussion, dispositions, documents, export, exports, importer, lists, profile, services
from .profile_constants import CITIES_BY_STATE, INDIAN_STATES
from .profile_serializers import DeclarationSerializer, UnlockSerializer
from .serializers import (
    AssignWithReasonSerializer,
    BulkAssignSerializer,
    CaptureLeadSerializer,
    DispositionSerializer,
    NoteEditSerializer,
    NoteSerializer,
    QuickAddSerializer,
    SavedFilterSerializer,
    UpdateLeadSerializer,
)


def _is_counsellor(user) -> bool:
    return not user.is_super_admin and getattr(user, 'role', None) == COUNSELLOR


class LeadListView(ApiView):
    required_permissions = {'GET': ('leads', 'view'), 'POST': ('leads', 'create')}

    def get(self, request):
        query = parse_list_query(request, services.SORTABLE)
        items, total, notice = services.list_leads(request.user, query, request.query_params)
        response = ok('Leads fetched successfully', items, build_pagination(total, query.page, query.page_size))
        if notice:
            response.data['notice'] = notice
        return response

    def post(self, request):
        """GL-10 Quick Add."""
        data = dict(validated(QuickAddSerializer, request.data))
        user = request.user
        if _is_counsellor(user) or (user.data_scope == 'own' and not user.is_super_admin):
            data.pop('owner', None)
            data.pop('autoAssign', None)  # a counsellor's Quick Add is assigned to them
        lead = services.create_lead(data, via='manual', actor=user, auto_assign=bool(data.get('autoAssign')))
        audit(request, 'create', 'leads', 'Lead', lead['_id'], after={'via': 'Quick Add', 'leadNo': lead['leadNo']})
        return created('Lead created successfully', lead)


class CheckDuplicateView(ApiView):
    required_permissions = {'GET': ('leads', 'view')}

    def get(self, request):
        q = request.query_params
        return ok('Duplicate check', services.check_duplicate(request.user, q.get('mobile'), q.get('email'), q.get('exclude')))


class FilterFieldsView(ApiView):
    required_permissions = {'GET': ('leads', 'view')}

    def get(self, request):
        data = lists.filter_fields(request.user)
        data['exportColumns'] = export.column_options()
        data['assignReasons'] = services.ASSIGN_REASONS
        return ok('Filter fields', data)


class SavedFilterListView(ApiView):
    required_permissions = {'GET': ('leads', 'view'), 'POST': ('leads', 'view')}

    def get(self, request):
        return ok('Saved filters', lists.list_saved(request.user))

    def post(self, request):
        data = validated(SavedFilterSerializer, request.data)
        return created('Filter saved', lists.save_filter(request.user, data['name'], dict(data['params'])))


class SavedFilterDetailView(ApiView):
    required_permissions = {'DELETE': ('leads', 'view')}

    def delete(self, request, filter_id):
        lists.delete_saved(request.user, filter_id)
        return ok('Filter deleted', None)


class GlobalSearchView(ApiView):
    required_permissions = {'GET': ('leads', 'view')}

    def get(self, request):
        return ok('Search results', lists.global_search(request.user, request.query_params.get('q') or ''))


class MyDayView(ApiView):
    required_permissions = {'GET': ('leads', 'view')}

    def get(self, request):
        return ok('My day', lists.my_day(request.user))


class LeadExportView(ApiView):
    """GL-38: the current filtered list with chosen columns; >10,000 rows → background job."""

    required_permissions = {'GET': ('leads', 'export')}

    def get(self, request):
        params = request.query_params
        keys, fmt = export.parse_options(params)
        queryset = services.filtered(request.user, params, params.get('search'))
        total = queryset.count()
        filters = {k: v for k, v in params.items() if k not in ('columns', 'format')}
        if total > export.EXPORT_LIMIT:
            job = exports.start_job(request.user, filters, keys, fmt, total)
            audit(request, 'export', 'leads', 'Lead', after={'format': fmt, 'columns': keys, 'filters': filters,
                                                            'rowCount': total, 'background': True})
            response = ok(f'{total:,} leads — the export is being prepared; the link will appear in notifications',
                          exports.job_doc(job))
            response.status_code = 202
            return response
        content, count = exports.export_now(request.user, queryset, keys, fmt)
        audit(request, 'export', 'leads', 'Lead', after={'format': fmt, 'columns': keys, 'filters': filters, 'rowCount': count})
        response = HttpResponse(content, content_type=export.CONTENT_TYPES[fmt])
        response['Content-Disposition'] = f'attachment; filename="leads-{int(time.time() * 1000)}.{fmt}"'
        return response


class ExportJobView(ApiView):
    required_permissions = {'GET': ('leads', 'export')}

    def get(self, request, export_id):
        return ok('Export', exports.job_doc(exports.get_job(request.user, export_id)))


class ExportDownloadView(ApiView):
    required_permissions = {'GET': ('leads', 'export')}

    def get(self, request, export_id):
        return exports.download(request.user, export_id)


# ------------------------------------------------------------- bulk upload


class ImportTemplateView(ApiView):
    required_permissions = {'GET': ('leads', 'import')}

    def get(self, request):
        response = HttpResponse(importer.template_file(), content_type=export.CONTENT_TYPES['xlsx'])
        response['Content-Disposition'] = 'attachment; filename="lead-upload-template.xlsx"'
        return response


def _json_field(request, name: str, default):
    raw = request.data.get(name)
    if not raw:
        return default
    try:
        return json.loads(raw) if isinstance(raw, str) else raw
    except ValueError:
        raise ApiError.bad_request(f'{name} must be valid JSON')


class ImportPreviewView(ApiView):
    required_permissions = {'POST': ('leads', 'import')}

    def post(self, request):
        upload = request.FILES.get('file')
        importer.check_upload(upload)
        return ok('Preview', importer.preview(upload, _json_field(request, 'mapping', None)))


class LeadBulkUploadView(ApiView):
    required_permissions = {'POST': ('leads', 'import')}

    def post(self, request):
        upload = request.FILES.get('file')
        importer.check_upload(upload)
        options = _json_field(request, 'options', {})
        if not options:  # older clients: defaults={source, autoAssign}
            defaults = _json_field(request, 'defaults', {})
            options = {'source': defaults.get('source')}
        result = importer.import_leads(upload, _json_field(request, 'mapping', None), options, request.user)
        audit(request, 'import', 'leads', 'Lead', after={k: result[k] for k in ('fileName', 'total', 'created', 'updated',
                                                                               'skipped', 'failed')})
        return ok(f"Upload finished: {result['created']} created, {result['updated']} updated, "
                  f"{result['skipped']} skipped, {result['failed']} failed", result)


class ImportErrorFileView(ApiView):
    required_permissions = {'GET': ('leads', 'import')}

    def get(self, request, name):
        path = importer.error_file_path(name)
        return FileResponse(open(path, 'rb'), as_attachment=True, filename='upload-errors.xlsx',
                            content_type=export.CONTENT_TYPES['xlsx'])


# ---------------------------------------------------------------- assign


class BulkAssignView(ApiView):
    required_permissions = {'POST': ('leads', 'reassign')}

    def post(self, request):
        data = validated(BulkAssignSerializer, request.data)
        if data.get('selectAll'):
            filters = dict(data.get('filters') or {})
            ids = list(services.filtered(request.user, filters, filters.get('search')).values_list('id', flat=True))
        else:
            ids = data['leadIds']
        result = services.bulk_assign(request.user, ids, data['owners'], data['reason'], preview=bool(data.get('preview')))
        if data.get('preview'):
            return ok('Assignment preview', result)
        audit(request, 'bulk_assign', 'leads', 'Lead', after={'count': result['assigned'], 'reason': data['reason'],
                                                             'perCounsellor': result['perCounsellor']})
        return ok(f"{result['assigned']} leads assigned", result)


class LeadAssignView(ApiView):
    required_permissions = {'POST': ('leads', 'reassign')}

    def post(self, request, lead_id):
        data = validated(AssignWithReasonSerializer, request.data)
        lead = services.assign_lead(request.user, lead_id, data['owner'], data['reason'])
        audit(request, 'assign', 'leads', 'Lead', lead_id, after={'owner': data['owner'], 'reason': data['reason']})
        return ok('Lead assigned successfully', lead)


# ---------------------------------------------------------------- lead page


class LeadDetailView(ApiView):
    required_permissions = {'GET': ('leads', 'view'), 'PUT': ('leads', 'edit'), 'DELETE': ('leads', 'delete')}

    def get(self, request, lead_id):
        return ok('Lead fetched successfully', services.get_lead_for_actor(request.user, lead_id))

    def put(self, request, lead_id):
        data = dict(validated(UpdateLeadSerializer, request.data, partial=True))
        for key in ('followUpAt', 'followUpType', 'reason', 'note'):
            if key in request.data:
                data[key] = request.data[key]
        lead = services.update_lead(request.user, lead_id, data)
        audit(request, 'update', 'leads', 'Lead', lead_id, after=request.data)
        return ok('Lead updated successfully', lead)

    def delete(self, request, lead_id):
        services.soft_delete_lead(request.user, lead_id)
        audit(request, 'delete', 'leads', 'Lead', lead_id)
        return ok('Lead deleted successfully', None)


class DispositionOptionsView(ApiView):
    required_permissions = {'GET': ('leads', 'view')}

    def get(self, request):
        from apps.tasks.models import TASK_TYPES

        return ok('Disposition options', {
            'stages': dispositions.disposition_options(request.user),
            'followUpTypes': [{'value': k, 'label': v} for k, v in TASK_TYPES.items()],
        })


class LeadDispositionView(ApiView):
    """Log Call / Update popup (GL-16..20, GL-40)."""

    required_permissions = {'POST': ('leads', 'edit')}

    def post(self, request, lead_id):
        data = dict(validated(DispositionSerializer, request.data))
        lead = services.find_lead_for_actor(request.user, lead_id)
        result = dispositions.apply_disposition(request.user, lead, data)
        audit(request, 'disposition', 'leads', 'Lead', lead_id, after=request.data)
        return ok('Disposition saved', {**result, 'lead': services.get_lead_for_actor(request.user, lead_id)})


class LeadCallsView(ApiView):
    required_permissions = {'GET': ('leads', 'view')}

    def get(self, request, lead_id):
        services.find_lead_for_actor(request.user, lead_id)
        return ok('Calls fetched', dispositions.list_calls(lead_id))


class LeadNotesView(ApiView):
    required_permissions = {'GET': ('leads', 'view'), 'POST': ('leads', 'view')}

    def get(self, request, lead_id):
        return ok('Notes fetched successfully', services.list_notes(request.user, lead_id))

    def post(self, request, lead_id):
        data = validated(NoteSerializer, request.data)
        note = services.add_note(request.user, lead_id, data['body'], data.get('category'))
        return created('Note added successfully', note)


class LeadNoteDetailView(ApiView):
    required_permissions = {'PUT': ('leads', 'view')}

    def put(self, request, lead_id, note_id):
        data = validated(NoteEditSerializer, request.data)
        return ok('Note updated', services.edit_note(request.user, note_id, data['body']))


class LeadTimelineView(ApiView):
    required_permissions = {'GET': ('leads', 'view')}

    def get(self, request, lead_id):
        page, page_size = parse_page(request)
        types = [t for t in (request.query_params.get('type') or '').split(',') if t]
        items, total = services.timeline(request.user, lead_id, page, page_size, types)
        return ok('Timeline fetched successfully', items, build_pagination(total, page, page_size))


class LeadHistoryView(ApiView):
    """GL-27: Super Admin and Admin only."""

    required_permissions = {'GET': ('leads', 'view')}

    def get(self, request, lead_id):
        if _is_counsellor(request.user):
            raise ApiError.forbidden('The History tab is for Admins only')
        page, page_size = parse_page(request)
        items, total = services.lead_history(request.user, lead_id, page, page_size)
        return ok('History fetched successfully', items, build_pagination(total, page, page_size))


class LeadDiscussionView(ApiView):
    required_permissions = {'GET': ('leads', 'view'), 'PUT': ('leads', 'edit')}

    def get(self, request, lead_id):
        services.find_lead_for_actor(request.user, lead_id)
        return ok('Counsellor discussion', discussion.present(lead_id))

    def put(self, request, lead_id):
        result = discussion.save(request.user, lead_id, dict(request.data))
        return ok('Saved', result)


class LeadDocumentsView(ApiView):
    required_permissions = {'GET': ('leads', 'view'), 'POST': ('leads', 'edit')}

    def get(self, request, lead_id):
        return ok('Documents', documents.list_documents(request.user, lead_id))

    def post(self, request, lead_id):
        doc = documents.upload(request.user, lead_id, request.data.get('type'), request.FILES.get('file'))
        audit(request, 'document_upload', 'leads', 'Lead', lead_id, after={'type': doc['type'], 'file': doc['fileName']})
        return created('Document uploaded', doc)


class LeadDocumentDownloadView(ApiView):
    required_permissions = {'GET': ('leads', 'view')}

    def get(self, request, lead_id, document_id):
        return documents.download(request.user, lead_id, document_id)


class ProfileOptionsView(ApiView):
    required_permissions = {'GET': ('leads', 'view')}

    def get(self, request):
        return ok('Profile options', {'states': INDIAN_STATES, 'citiesByState': CITIES_BY_STATE})


# ------------------------------------------------------- student profile


class ProfileView(ApiView):
    required_permissions = {'GET': ('leads', 'view')}

    def get(self, request, lead_id):
        return ok('Profile fetched successfully', profile.get_profile(request.user, lead_id))


class ProfileStepView(ApiView):
    required_permissions = {'PUT': ('leads', 'edit')}
    step: str = ''
    label: str = ''

    def put(self, request, lead_id):
        data = validated(profile.STEP_SERIALIZERS[self.step], request.data)
        before, result = profile.save_step(request.user, lead_id, self.step, data)
        audit(request, f'profile_{self.step}', 'leads', 'LeadProfile', lead_id, before=before, after=request.data)
        return ok(f'{self.label} saved', result)


class ProfilePersonalView(ProfileStepView):
    step, label = 'personal', 'Personal information'


class ProfileAcademicView(ProfileStepView):
    step, label = 'academic', 'Academic information'


class ProfileWorkView(ProfileStepView):
    step, label = 'work', 'Work experience'


class ProfileDeclarationView(ApiView):
    required_permissions = {'POST': ('leads', 'edit')}

    def post(self, request, lead_id):
        validated(DeclarationSerializer, request.data)
        result = profile.accept_declaration(request.user, lead_id)
        audit(request, 'profile_declaration', 'leads', 'LeadProfile', lead_id)
        return ok('Declaration accepted', result)


class ProfileUnlockView(ApiView):
    required_permissions = {'POST': ('leads', 'edit')}

    def post(self, request, lead_id):
        data = validated(UnlockSerializer, request.data)
        result = profile.unlock_profile(request.user, lead_id, data['reason'])
        audit(request, 'profile_unlock', 'leads', 'LeadProfile', lead_id, after={'reason': data['reason']})
        return ok('Profile unlocked', result)


# ------------------------------------------------- public capture (API key)


class CaptureView(PublicView):
    """Website / landing-page / Google capture with the shared API key (re-enquiry aware)."""

    channel: str | None = None

    def post(self, request):
        from django.conf import settings

        key = request.headers.get('x-api-key')
        if not settings.CAPTURE_API_KEY or key != settings.CAPTURE_API_KEY:
            raise ApiError.unauthorized('Invalid API key')
        body = dict(request.data)
        if self.channel:
            body['channel'] = self.channel
        data = validated(CaptureLeadSerializer, body)
        result = capture.capture_public(dict(data))
        message = 'Existing lead updated with re-enquiry' if result['duplicate'] else 'Lead captured successfully'
        return created(message, result)


class GoogleWebhookView(CaptureView):
    channel = 'google'
