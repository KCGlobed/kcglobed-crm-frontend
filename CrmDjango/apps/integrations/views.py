from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date

from apps.audit.services import audit
from common.exceptions import ApiError
from common.responses import ok
from common.views import ApiView, PublicView

from . import meta


def _super_admin_only(request):
    if not request.user.is_super_admin:
        raise ApiError.forbidden('Only the Super Admin can manage the Meta integration')


class MetaWebhookView(PublicView):
    """GL-09: GET = subscription handshake, POST = leadgen events (signed with the app secret)."""

    def get(self, request):
        return HttpResponse(meta.verify_subscription(request.GET), content_type='text/plain')

    def post(self, request):
        raw = request._request.body  # read before parsing, for the signature
        meta.check_signature(raw, request.headers.get('x-hub-signature-256'))
        counts = meta.receive(request.data if isinstance(request.data, dict) else {})
        return ok('Webhook received', counts)


class MetaFormsView(ApiView):
    def get(self, request):
        _super_admin_only(request)
        return ok('Meta forms fetched', meta.list_mappings())


class MetaFormDetailView(ApiView):
    def put(self, request, form_key):
        _super_admin_only(request)
        result = meta.save_mapping(request.user, form_key, dict(request.data))
        audit(request, 'meta_mapping_update', 'integrations', 'MetaFormMapping', form_key, after=request.data)
        return ok('Mapping saved', result)


class MetaEventsView(ApiView):
    def get(self, request):
        _super_admin_only(request)
        return ok('Meta events fetched', meta.list_events(request.query_params.get('status')))


class MetaEventRetryView(ApiView):
    def post(self, request, event_id):
        _super_admin_only(request)
        result = meta.retry(event_id)
        audit(request, 'meta_retry', 'integrations', 'MetaLeadEvent', event_id, after={'outcome': result['outcome']})
        return ok('Retried', result)


class MetaDailyCheckView(ApiView):
    def get(self, request):
        _super_admin_only(request)
        day = parse_date(request.query_params.get('date') or '') or timezone.localdate()
        return ok('Daily check', {'date': day.isoformat(), 'forms': meta.daily_check(day)})
