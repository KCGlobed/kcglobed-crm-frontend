from apps.audit.services import audit
from common.pagination import parse_page
from common.responses import build_pagination, created, ok
from common.validation import validated
from common.views import ApiView

from . import services
from .models import TASK_TYPES
from .serializers import CreateTaskSerializer, UpdateTaskSerializer


class TaskListView(ApiView):
    """?view=today|overdue|upcoming|open|completed &assignee=me|<id> &lead &type &priority"""

    required_permissions = {'GET': ('tasks', 'view')}

    def get(self, request):
        page, page_size = parse_page(request)
        items, total = services.list_tasks(request.user, request.query_params, page, page_size)
        return ok('Follow-ups fetched successfully', items, build_pagination(total, page, page_size))


class TaskSummaryView(ApiView):
    required_permissions = {'GET': ('tasks', 'view')}

    def get(self, request):
        counts = services.summary(request.user, request.query_params.get('assignee'))
        types = [{'value': k, 'label': v} for k, v in TASK_TYPES.items()]
        return ok('Follow-up counts fetched successfully', {'counts': counts, 'types': types})


class TaskDetailView(ApiView):
    required_permissions = {'PUT': ('tasks', 'edit')}

    def put(self, request, task_id):
        data = validated(UpdateTaskSerializer, request.data, partial=True)
        task = services.update_task(request.user, task_id, dict(data))
        audit(request, 'update', 'tasks', 'Task', task_id, after=request.data)
        return ok('Follow-up updated successfully', task)


class LeadTasksView(ApiView):
    required_permissions = {'GET': ('tasks', 'view'), 'POST': ('tasks', 'create')}

    def get(self, request, lead_id):
        return ok('Follow-ups fetched successfully', services.lead_tasks(request.user, lead_id))

    def post(self, request, lead_id):
        data = validated(CreateTaskSerializer, request.data)
        task = services.create_task(request.user, lead_id, dict(data))
        audit(request, 'create', 'tasks', 'Task', task['_id'], after=request.data)
        return created('Follow-up scheduled successfully', task)


class SchedulerTickView(ApiView):
    """
    Runs the reminder / alert / retry tick now (Super Admin). Cron should call
    `manage.py send_reminders --loop`; this is for operations and QA. With DEBUG,
    `at` (ISO date-time) simulates a later time to check the 2-hour alerts.
    """

    def post(self, request):
        from django.conf import settings
        from django.utils.dateparse import parse_datetime

        from common.exceptions import ApiError

        from .reminders import process_due

        if not request.user.is_super_admin:
            raise ApiError.forbidden()
        at = parse_datetime(str(request.data.get('at') or '')) if settings.DEBUG else None
        return ok('Tick done', process_due(at))
