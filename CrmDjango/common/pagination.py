"""The shared list contract: ?page&page_size&search&sort_by&sort_order."""
from dataclasses import dataclass

MAX_PAGE_SIZE = 100


@dataclass
class ListQuery:
    page: int
    page_size: int
    search: str | None
    sort_by: str
    descending: bool

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    def slice(self, queryset):
        return queryset[self.offset : self.offset + self.page_size]

    def order(self, field_map: dict[str, str] | None = None) -> list[str]:
        """ORM ordering for sort_by; `field_map` translates API names to model fields."""
        field = (field_map or {}).get(self.sort_by, self.sort_by)
        return [f'-{field}', '-pk'] if self.descending else [field, 'pk']


def _int(value, fallback: int) -> int:
    try:
        number = int(float(value))
    except (TypeError, ValueError):
        return fallback
    return number or fallback


def parse_page(request, default_size: int = 25, max_size: int = MAX_PAGE_SIZE) -> tuple[int, int]:
    q = request.query_params
    page = max(1, _int(q.get('page'), 1))
    page_size = min(max_size, max(1, _int(q.get('page_size'), default_size)))
    return page, page_size


def parse_list_query(request, sortable: list[str], default_sort: str = 'createdAt') -> ListQuery:
    """`sortable` whitelists sort fields; unknown values fall back to the default."""
    q = request.query_params
    page, page_size = parse_page(request)
    search = (q.get('search') or '').strip() or None
    requested = q.get('sort_by') or default_sort
    sort_by = requested if requested in sortable else default_sort
    return ListQuery(page, page_size, search, sort_by, q.get('sort_order') != 'asc')
