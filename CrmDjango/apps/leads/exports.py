"""
GL-38 export: up to 10,000 rows download at once; larger exports are prepared
in the background and the link arrives as a notification (valid 24 hours).
Each lead included gets an "Export" timeline entry, visible to the Super Admin only.
"""
import logging
import threading
import time
from datetime import timedelta

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import close_old_connections
from django.http import FileResponse
from django.utils import timezone

from apps.notifications.services import notify
from common.exceptions import ApiError

from . import export
from .models import ExportJob, LeadActivity

logger = logging.getLogger('crm')
LINK_HOURS = 24


def _log_on_leads(actor, lead_ids: list[str], fmt: str) -> None:
    LeadActivity.objects.bulk_create([
        LeadActivity(lead_id=lead_id, type='export', title=f'Included in an export ({fmt.upper()}) by {actor.name}',
                     actor_id=actor.id, actor_type='user', actor_name=actor.name)
        for lead_id in lead_ids
    ], batch_size=1000)


def export_now(actor, queryset, keys: list[str], fmt: str) -> tuple[bytes, int]:
    rows = list(export.build_rows(actor, queryset, keys))
    ids = list(queryset.order_by('-created_at').values_list('id', flat=True)[:export.EXPORT_LIMIT])
    _log_on_leads(actor, ids, fmt)
    return export.render(keys, rows, fmt), len(rows)


def start_job(actor, params: dict, keys: list[str], fmt: str, total: int) -> ExportJob:
    if total > export.MAX_EXPORT:
        raise ApiError.unprocessable(f'Exports are limited to {export.MAX_EXPORT:,} rows — narrow the filter')
    job = ExportJob.objects.create(user_id=actor.id, params={**params, 'columns': keys}, format=fmt, status='queued')

    def work():
        try:
            _run(job.id, actor, params, keys, fmt)
        except Exception as exc:  # noqa: BLE001
            logger.error('Export %s failed: %s', job.id, exc)
            ExportJob.objects.filter(pk=job.id).update(status='failed', error=str(exc)[:500])
            notify(actor.id, 'export_ready', 'Export failed', str(exc)[:200], {'exportId': job.id})
        finally:
            close_old_connections()

    if getattr(settings, 'RUN_JOBS_INLINE', False):
        work()
    else:
        threading.Thread(target=work, daemon=True).start()
    return job


def _run(job_id: str, actor, params: dict, keys: list[str], fmt: str) -> None:
    from .services import filtered

    ExportJob.objects.filter(pk=job_id).update(status='running')
    queryset = filtered(actor, params, params.get('search'))
    rows = list(export.build_rows(actor, queryset, keys, limit=export.MAX_EXPORT))
    content = export.render(keys, rows, fmt)
    job = ExportJob.objects.get(pk=job_id)
    job.file.save(f'leads-{int(time.time() * 1000)}.{fmt}', ContentFile(content), save=False)
    job.status, job.row_count = 'done', len(rows)
    job.expires_at = timezone.now() + timedelta(hours=LINK_HOURS)
    job.save()
    _log_on_leads(actor, list(queryset.values_list('id', flat=True)[:export.MAX_EXPORT]), fmt)
    notify(actor.id, 'export_ready', 'Your export is ready', f'{len(rows):,} leads · link valid {LINK_HOURS} hours',
           {'exportId': job.id, 'url': f'/api/v1/leads/exports/{job.id}/download'})


def job_doc(job: ExportJob) -> dict:
    return {'_id': job.id, 'status': job.status, 'format': job.format, 'rowCount': job.row_count,
            'expiresAt': job.expires_at, 'error': job.error, 'createdAt': job.created_at,
            'downloadUrl': f'/api/v1/leads/exports/{job.id}/download' if job.status == 'done' else None}


def get_job(actor, job_id: str) -> ExportJob:
    job = ExportJob.objects.filter(pk=job_id, user_id=actor.id).first()
    if not job:
        raise ApiError.not_found('Export not found')
    return job


def download(actor, job_id: str):
    job = get_job(actor, job_id)
    if job.status != 'done' or not job.file:
        raise ApiError.unprocessable('The export is not ready yet')
    if job.expires_at and job.expires_at < timezone.now():
        raise ApiError(410, 'This download link has expired — export again')
    return FileResponse(job.file.open('rb'), as_attachment=True, filename=job.file.name.rsplit('/', 1)[-1],
                        content_type=export.CONTENT_TYPES[job.format])
