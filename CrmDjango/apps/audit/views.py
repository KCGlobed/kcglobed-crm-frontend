import csv
import io
from datetime import datetime, time

from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date

from apps.users.models import User
from common.pagination import parse_list_query
from common.responses import build_pagination, ok
from common.roles import COUNSELLOR
from common.views import ApiView

from .models import AuditLog


def _day(value: str | None):
    try:
        return parse_date((value or '')[:10]) if value else None
    except ValueError:
        return None


def scoped_logs(request, search: str | None = None):
    """
    GL-28: the Super Admin sees everything; an Admin sees the counsellors'
    activity (and their own). Filter by user, module, action and date.
    """
    user, q = request.user, request.query_params
    qs = AuditLog.objects.select_related('actor')
    if not user.is_super_admin:
        counsellors = User.objects.filter(role=COUNSELLOR).values_list('id', flat=True)
        qs = qs.filter(Q(actor_id__in=counsellors) | Q(actor_id=user.id))
    if q.get('module'):
        qs = qs.filter(module=q['module'])
    if q.get('action'):
        qs = qs.filter(action__in=q['action'].split(','))
    if q.get('actor'):
        qs = qs.filter(actor_id=q['actor'])
    if search:
        qs = qs.filter(Q(actor_name__icontains=search) | Q(entity_type__icontains=search)
                       | Q(entity_id__icontains=search) | Q(action__icontains=search))
    tz = timezone.get_current_timezone()
    if _day(q.get('created_from')):
        qs = qs.filter(created_at__gte=timezone.make_aware(datetime.combine(_day(q['created_from']), time.min), tz))
    if _day(q.get('created_to')):
        qs = qs.filter(created_at__lte=timezone.make_aware(datetime.combine(_day(q['created_to']), time.max), tz))
    return qs


class AuditLogListView(ApiView):
    required_permissions = {'GET': ('audit', 'view')}

    def get(self, request):
        query = parse_list_query(request, ['createdAt'])
        qs = scoped_logs(request, query.search)
        total = qs.count()
        items = query.slice(qs.order_by('-created_at', '-id'))
        return ok('Audit logs fetched successfully', [a.to_dict() for a in items],
                  build_pagination(total, query.page, query.page_size))


class AuditLogExportView(ApiView):
    """GL-28: the activity log is exportable (CSV)."""

    required_permissions = {'GET': ('audit', 'view')}

    def get(self, request):
        qs = scoped_logs(request, (request.query_params.get('search') or '').strip() or None)
        buffer = io.StringIO()
        writer = csv.writer(buffer, lineterminator='\n')
        writer.writerow(['Time (IST)', 'User', 'Action', 'Module', 'Entity', 'Entity ID', 'IP', 'Details'])
        for a in qs.order_by('-created_at')[:50_000]:
            writer.writerow([timezone.localtime(a.created_at).strftime('%Y-%m-%d %H:%M:%S'), a.actor_name, a.action,
                             a.module, a.entity_type or '', a.entity_id or '', a.ip or '',
                             '' if a.after is None else str(a.after)[:500]])
        response = HttpResponse(buffer.getvalue().encode('utf-8'), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="activity-log.csv"'
        return response
