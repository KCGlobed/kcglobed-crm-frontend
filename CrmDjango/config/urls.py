"""
URL map — identical paths to the Node API (base /api/v1, no trailing slashes).
Anything unmatched returns the JSON 404 envelope.
"""
import time

from django.http import JsonResponse
from django.urls import path, re_path

from apps.audit.views import AuditLogExportView, AuditLogListView
from apps.authentication.urls import urlpatterns as auth_urls
from apps.dashboard.views import DashboardSummaryView
from apps.integrations.urls import integration_urls
from apps.leads.urls import lead_urls, webhook_urls
from apps.masters.urls import urlpatterns as master_urls
from apps.messaging.urls import messaging_urls, messaging_webhook_urls
from apps.messaging.views import UnsubscribeView
from apps.notifications.views import NotificationListView, NotificationReadAllView, NotificationReadView
from apps.tasks.views import LeadTasksView, SchedulerTickView, TaskDetailView, TaskListView, TaskSummaryView
from apps.teams.urls import urlpatterns as team_urls
from apps.users.urls import template_urls, user_urls
from common.views import route_not_found

STARTED = time.monotonic()


def health(request):
    return JsonResponse({'success': True, 'message': 'OK', 'status': 200, 'data': {'uptime': time.monotonic() - STARTED}})


def under(prefix: str, patterns: list) -> list:
    """Mounts app routes at /api/v1/<prefix>; an empty route maps to the bare prefix (no trailing slash)."""
    out = []
    for p in patterns:
        route = str(p.pattern)
        out.append(path(f'api/v1/{prefix}/{route}' if route else f'api/v1/{prefix}', p.callback))
    return out


urlpatterns = [
    path('health', health),
    *under('auth', auth_urls),
    *under('users', user_urls),
    *under('teams', team_urls),
    *under('permission-templates', template_urls),
    *under('masters', master_urls),
    *under('leads', lead_urls),
    *under('webhooks', webhook_urls),
    *under('webhooks', messaging_webhook_urls),
    *under('messaging', messaging_urls),
    *under('integrations', integration_urls),
    path('api/v1/public/unsubscribe/<str:token>', UnsubscribeView.as_view()),
    path('api/v1/audit-logs/export', AuditLogExportView.as_view()),
    path('api/v1/leads/<str:lead_id>/tasks', LeadTasksView.as_view()),
    path('api/v1/system/tick', SchedulerTickView.as_view()),
    path('api/v1/tasks', TaskListView.as_view()),
    path('api/v1/tasks/summary', TaskSummaryView.as_view()),
    path('api/v1/tasks/<str:task_id>', TaskDetailView.as_view()),
    path('api/v1/notifications', NotificationListView.as_view()),
    path('api/v1/notifications/read-all', NotificationReadAllView.as_view()),
    path('api/v1/notifications/<str:notification_id>/read', NotificationReadView.as_view()),
    path('api/v1/audit-logs', AuditLogListView.as_view()),
    path('api/v1/dashboard/summary', DashboardSummaryView.as_view()),
    re_path(r'^.*$', route_not_found),
]
