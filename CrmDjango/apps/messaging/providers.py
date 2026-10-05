"""
Provider adapter (GL-25): every SMS / email goes through `get_provider(channel)`,
so the vendor can change by configuration without code changes elsewhere.

SMS_PROVIDER=console (default) logs the SMS and, with SMS_AUTO_DELIVER, reports
it delivered at once — a stand-in until the DLT-registered vendor is connected.
SMS_PROVIDER=http posts to SMS_HTTP_URL (MSG91 / Gupshup style JSON API).
Email uses Django's mail backend (SMTP in production, console in development).
"""
import json
import logging
import secrets
import urllib.request
from dataclasses import dataclass

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils.html import strip_tags

logger = logging.getLogger('crm')


@dataclass
class SendResult:
    status: str  # sent | delivered | failed
    provider: str
    provider_message_id: str | None = None
    error: str | None = None


class ConsoleSms:
    name = 'console-sms'

    def send(self, to: str, body: str, *, sender_id: str | None, dlt_template_id: str | None, **_) -> SendResult:
        logger.info('SMS to %s [%s/%s]: %s', to, sender_id, dlt_template_id, body)
        status = 'delivered' if getattr(settings, 'SMS_AUTO_DELIVER', True) else 'sent'
        return SendResult(status, self.name, f'sms_{secrets.token_hex(8)}')


class HttpSms:
    """Generic JSON SMS gateway: POST {to, sender, templateId, message} with a bearer key."""

    name = 'http-sms'

    def send(self, to: str, body: str, *, sender_id: str | None, dlt_template_id: str | None, **_) -> SendResult:
        payload = json.dumps({'to': f'91{to}', 'sender': sender_id, 'templateId': dlt_template_id, 'message': body}).encode()
        request = urllib.request.Request(settings.SMS_HTTP_URL, data=payload, method='POST', headers={
            'Content-Type': 'application/json', 'Authorization': f'Bearer {settings.SMS_HTTP_KEY}',
        })
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                data = json.loads(response.read() or b'{}')
            return SendResult('sent', self.name, str(data.get('id') or data.get('messageId') or ''))
        except Exception as exc:  # noqa: BLE001
            return SendResult('failed', self.name, error=str(exc)[:300])


class DjangoEmail:
    name = 'email'

    def send(self, to: str, body: str, *, subject: str | None = None, **_) -> SendResult:
        try:
            message = EmailMultiAlternatives(subject or '', strip_tags(body), settings.DEFAULT_FROM_EMAIL, [to])
            message.attach_alternative(body, 'text/html')
            message.send()
            return SendResult('sent', self.name, f'em_{secrets.token_hex(8)}')
        except Exception as exc:  # noqa: BLE001
            return SendResult('failed', self.name, error=str(exc)[:300])


def get_provider(channel: str):
    if channel == 'email':
        return DjangoEmail()
    if channel == 'sms':
        return HttpSms() if getattr(settings, 'SMS_PROVIDER', 'console') == 'http' else ConsoleSms()
    raise ValueError(f'No provider for channel {channel}')  # WhatsApp plugs in here (GL-39)
