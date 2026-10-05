"""Success envelope + pagination block, identical to the Node API."""
import math

from rest_framework.response import Response


def build_pagination(total: int, page: int, page_size: int) -> dict:
    total_pages = max(1, math.ceil(total / page_size))
    return {
        'total_results': total,
        'total_pages': total_pages,
        'current_page': page,
        'page_size': page_size,
        'next_page': page + 1 if page < total_pages else None,
        'previous_page': page - 1 if page > 1 else None,
    }


def ok(message: str, data=None, pagination: dict | None = None, status: int = 200, headers=None) -> Response:
    body = {'success': True, 'message': message, 'status': status, 'data': data}
    if pagination:
        body['pagination'] = pagination
    return Response(body, status=status, headers=headers)


def created(message: str, data=None) -> Response:
    return ok(message, data, status=201)
