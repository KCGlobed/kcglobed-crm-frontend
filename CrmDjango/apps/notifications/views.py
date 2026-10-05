from django.utils import timezone

from apps.tasks.reminders import process_due_throttled
from common.exceptions import ApiError
from common.pagination import parse_page
from common.responses import build_pagination, ok
from common.views import ApiView

from .models import Notification


class NotificationListView(ApiView):
    def get(self, request):
        # The bell polls every 30 s, so this is where due reminders get sent (at most once a minute).
        process_due_throttled()
        page, page_size = parse_page(request, default_size=15, max_size=50)
        mine = Notification.objects.filter(user_id=request.user.id)
        qs = mine.filter(read_at__isnull=True) if request.query_params.get('unread') == 'true' else mine
        if request.query_params.get('type'):
            qs = qs.filter(type__in=request.query_params['type'].split(','))
        total = qs.count()
        unread = mine.filter(read_at__isnull=True).count()
        items = qs.order_by('-created_at', '-id')[(page - 1) * page_size : page * page_size]
        return ok(
            'Notifications fetched successfully',
            {'items': [n.to_dict() for n in items], 'unreadCount': unread},
            build_pagination(total, page, page_size),
            headers={'X-Unread-Count': str(unread)},
        )


class NotificationReadView(ApiView):
    def patch(self, request, notification_id):
        notification = Notification.objects.filter(pk=notification_id, user_id=request.user.id).first()
        if not notification:
            raise ApiError.not_found('Notification not found')
        notification.read_at = timezone.now()
        notification.save(update_fields=['read_at'])
        return ok('Notification marked as read', notification.to_dict())


class NotificationReadAllView(ApiView):
    def patch(self, request):
        Notification.objects.filter(user_id=request.user.id, read_at__isnull=True).update(read_at=timezone.now())
        return ok('All notifications marked as read', None)
