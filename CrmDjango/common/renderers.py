import datetime
import decimal
import json

from rest_framework.renderers import JSONRenderer


def iso(value: datetime.datetime | None) -> str | None:
    """JavaScript Date#toISOString shape: 2026-10-04T08:15:30.123Z."""
    if value is None:
        return None
    if value.tzinfo is not None:
        value = value.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    return value.strftime('%Y-%m-%dT%H:%M:%S.') + f'{value.microsecond // 1000:03d}Z'


class ApiEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, datetime.datetime):
            return iso(o)
        if isinstance(o, datetime.date):
            return o.isoformat()
        if isinstance(o, decimal.Decimal):
            return float(o)
        return super().default(o)


class ApiJSONRenderer(JSONRenderer):
    encoder_class = ApiEncoder
