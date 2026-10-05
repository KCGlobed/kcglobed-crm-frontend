import logging

from django.conf import settings
from django.http import JsonResponse

from .exceptions import error_body

logger = logging.getLogger('crm')


class JsonServerErrorMiddleware:
    """Last line of defence: anything that escapes a view becomes the JSON 500 envelope."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_exception(self, request, exception):
        logger.exception('Unhandled error on %s %s', request.method, request.get_full_path())
        message = str(exception) if settings.DEBUG else 'Something went wrong. Please try again.'
        return JsonResponse(error_body(500, message), status=500)
