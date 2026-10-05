from django.conf import settings
from django.http import HttpResponse
from django.utils.html import escape

from apps.audit.services import audit
from common.exceptions import ApiError
from common.responses import created, ok
from common.views import ApiView, PublicView

from . import automations, services
from .models import PLACEHOLDERS, TRIGGERS, Message


def _check_webhook_secret(request):
    secret = getattr(settings, 'MESSAGING_WEBHOOK_SECRET', None) or settings.CAPTURE_API_KEY
    if not secret or request.headers.get('x-webhook-secret') != secret:
        raise ApiError.unauthorized('Invalid webhook secret')


class TemplateListView(ApiView):
    required_permissions = {'GET': ('communications', 'view'), 'POST': ('communications', 'edit')}

    def get(self, request):
        return ok('Templates fetched successfully', services.list_templates(request.query_params))

    def post(self, request):
        template = services.save_template(request.user, dict(request.data))
        audit(request, 'template_create', 'communications', 'MessageTemplate', template['_id'], after=request.data)
        return created('Template created successfully', template)


class TemplateDetailView(ApiView):
    required_permissions = {'PUT': ('communications', 'edit')}

    def put(self, request, template_id):
        template = services.save_template(request.user, dict(request.data), template_id)
        audit(request, 'template_update', 'communications', 'MessageTemplate', template_id, after=request.data)
        return ok('Template updated successfully', template)


class MessagingOptionsView(ApiView):
    required_permissions = {'GET': ('communications', 'view')}

    def get(self, request):
        return ok('Messaging options fetched', {
            'placeholders': PLACEHOLDERS,
            'triggers': [{'value': k, 'label': v[0], 'channels': v[1]} for k, v in TRIGGERS.items()],
            'channels': [{'value': 'sms', 'label': 'SMS'}, {'value': 'email', 'label': 'Email'}],
            'bulkWindow': '09:00-21:00', 'bulkMax': services.BULK_MAX,
        })


class AutomationListView(ApiView):
    required_permissions = {'GET': ('automation', 'view')}

    def get(self, request):
        return ok('Automations fetched successfully', automations.list_rules())


class AutomationDetailView(ApiView):
    required_permissions = {'PUT': ('automation', 'edit')}

    def put(self, request, rule_id):
        rule = automations.update_rule(request.user, rule_id, dict(request.data))
        audit(request, 'automation_update', 'communications', 'AutomationRule', rule_id, after=request.data)
        return ok('Automation updated successfully', rule)


class CampaignListView(ApiView):
    required_permissions = {'GET': ('communications', 'edit'), 'POST': ('communications', 'edit')}

    def get(self, request):
        return ok('Campaigns fetched successfully', services.list_campaigns())

    def post(self, request):
        preview = str(request.data.get('preview')).lower() == 'true'
        result = services.create_campaign(request.user, dict(request.data), preview=preview)
        if preview:
            return ok('Bulk send preview', result)
        audit(request, 'bulk_send', 'communications', 'Campaign', result['campaign']['_id'], after={
            'channel': result['channel'], 'template': result['template']['name'], 'final': result['final'],
            'scheduledAt': request.data.get('scheduledAt'),
        })
        message = 'Bulk send scheduled' if request.data.get('scheduledAt') else 'Bulk send started'
        return created(message, result)


class CampaignDetailView(ApiView):
    required_permissions = {'GET': ('communications', 'edit')}

    def get(self, request, campaign_id):
        return ok('Campaign fetched successfully', services.get_campaign(campaign_id))


class CampaignCancelView(ApiView):
    required_permissions = {'POST': ('communications', 'edit')}

    def post(self, request, campaign_id):
        result = services.cancel_campaign(campaign_id)
        audit(request, 'bulk_send_cancel', 'communications', 'Campaign', campaign_id)
        return ok('Campaign cancelled', result)


class LeadMessagesView(ApiView):
    required_permissions = {'GET': ('communications', 'view'), 'POST': ('communications', 'create')}

    def get(self, request, lead_id):
        return ok('Messages fetched successfully', services.lead_messages(request.user, lead_id))

    def post(self, request, lead_id):
        message = services.send_to_lead(request.user, lead_id, dict(request.data))
        audit(request, 'message_send', 'communications', 'Lead', lead_id,
              after={'channel': message['channel'], 'template': message.get('template'), 'status': message['status']})
        return created('Message sent' if message['status'] != 'failed' else 'Message failed', message)


class LeadMessagePreviewView(ApiView):
    required_permissions = {'POST': ('communications', 'view')}

    def post(self, request, lead_id):
        return ok('Preview', services.preview_for_lead(request.user, lead_id, request.data.get('template') or ''))


# ------------------------------------------------------------ webhooks


class DeliveryStatusWebhook(PublicView):
    """Provider delivery report: {messageId | providerMessageId, status, error}."""

    def post(self, request):
        _check_webhook_secret(request)
        data = request.data
        qs = Message.objects.select_related('template')
        message = (qs.filter(pk=data.get('messageId')).first() if data.get('messageId')
                   else qs.filter(provider_message_id=data.get('providerMessageId')).first())
        if not message:
            raise ApiError.not_found('Message not found')
        services.update_status(message, str(data.get('status') or '').lower(), data.get('error'))
        return ok('Status recorded', services.message_doc(message))


class InboundSmsWebhook(PublicView):
    """Replies to our SMS: {from, text}. STOP opts the lead out of SMS."""

    def post(self, request):
        _check_webhook_secret(request)
        count = services.handle_inbound_sms(str(request.data.get('from') or ''), str(request.data.get('text') or ''))
        return ok('Reply processed', {'optedOut': count})


class UnsubscribeView(PublicView):
    def get(self, request, token):
        try:
            lead = services.unsubscribe(token)
            text = f'{escape(lead.first_name)}, you have been unsubscribed from GCC School emails.'
        except ApiError as exc:
            text = escape(exc.message)
        return HttpResponse(f'<!doctype html><meta charset="utf-8"><title>Unsubscribe</title>'
                            f'<p style="font-family:sans-serif;padding:40px">{text}</p>')
