"""
Masters share one controller across seven types; each type declares its model,
validation, search fields, sorting and how "delete" behaves (deactivate — or
close, for cohorts). Masters are never hard-deleted.
"""
from dataclasses import dataclass, field
from typing import Callable

from django.db import transaction
from django.db.models import Q

from apps.audit.services import audit
from common.exceptions import ApiError
from common.pagination import parse_list_query
from common.responses import build_pagination, created, ok
from common.validation import validated
from common.views import ApiView

from . import serializers as s
from .models import Cohort, CustomFieldDef, Disposition, Program, Source, Stage, SubStage, Tag


@dataclass
class MasterType:
    model: type
    entity: str
    serializer: type
    fields: dict[str, str]  # API key → model attribute
    unique: list[tuple[str, ...]]  # API keys that must be unique together
    search: list[str] = field(default_factory=lambda: ['name'])
    sortable: list[str] = field(default_factory=lambda: ['name', 'createdAt', 'sortOrder'])
    default_sort: str = 'createdAt'
    deactivate: Callable = lambda obj: setattr(obj, 'is_active', False)
    filters: Callable = lambda params: {}


SORT_FIELDS = {'createdAt': 'created_at', 'sortOrder': 'sort_order', 'startDate': 'start_date'}
COMMON = {'isActive': 'is_active', 'sortOrder': 'sort_order'}

TYPES: dict[str, MasterType] = {
    'sources': MasterType(
        Source, 'Source', s.SourceSerializer,
        {'name': 'name', 'channel': 'channel', 'description': 'description', **COMMON},
        [('name',)],
        filters=lambda p: {'channel': p['channel']} if p.get('channel') else {},
    ),
    'programs': MasterType(
        Program, 'Program', s.ProgramSerializer,
        {'name': 'name', 'code': 'code', 'track': 'track', 'durationMonths': 'duration_months',
         'description': 'description', **COMMON},
        [('code',)],
        search=['name', 'code'],
    ),
    'cohorts': MasterType(
        Cohort, 'Cohort', s.CohortSerializer,
        {'name': 'name', 'program': 'program_id', 'startDate': 'start_date', 'endDate': 'end_date',
         'capacity': 'capacity', 'status': 'status', 'sortOrder': 'sort_order'},
        [('program', 'name')],
        sortable=['name', 'startDate', 'createdAt'],
        default_sort='startDate',
        deactivate=lambda obj: setattr(obj, 'status', 'closed'),
        filters=lambda p: {
            **({'program_id': p['program']} if p.get('program') else {}),
            **({'status': p['status']} if p.get('status') else {}),
        },
    ),
    'stages': MasterType(
        Stage, 'Stage', s.StageSerializer,
        {'name': 'name', 'type': 'type', 'color': 'color', 'order': 'order', 'isActive': 'is_active'},
        [('name',)],
        sortable=['name', 'order'],
        default_sort='order',
    ),
    'dispositions': MasterType(
        Disposition, 'Disposition', s.DispositionSerializer,
        {'name': 'name', 'category': 'category', 'requiresFollowUp': 'requires_follow_up', **COMMON},
        [('name',)],
    ),
    'tags': MasterType(Tag, 'Tag', s.TagSerializer, {'name': 'name', 'color': 'color', **COMMON}, [('name',)]),
    'custom-fields': MasterType(
        CustomFieldDef, 'Custom field', s.CustomFieldSerializer,
        {'key': 'key', 'label': 'label', 'type': 'type', 'options': 'options', 'required': 'required', **COMMON},
        [('key',)],
        search=['key', 'label'],
        sortable=['label', 'sortOrder', 'createdAt'],
    ),
}


def master_type(type_key: str) -> MasterType:
    cfg = TYPES.get(type_key)
    if not cfg:
        raise ApiError.not_found(f'Route not found: unknown master type "{type_key}"')
    return cfg


def to_dict(obj, populated: bool = True) -> dict:
    if isinstance(obj, Cohort):
        return obj.to_dict(populate_program=populated)
    return obj.to_dict()


def _queryset(cfg: MasterType):
    qs = cfg.model.objects.all()
    if cfg.model is Cohort:
        qs = qs.select_related('program')
    if cfg.model is Stage:
        qs = qs.prefetch_related('sub_stages')
    return qs


def _apply(cfg: MasterType, obj, data: dict) -> None:
    for key, attr in cfg.fields.items():
        if key in data:
            setattr(obj, attr, data[key])


def _assert_unique(cfg: MasterType, obj, data: dict) -> None:
    """Duplicate names/codes/keys → 409 with the offending field, as the Mongo index did."""
    for keys in cfg.unique:
        values = {}
        for key in keys:
            value = data[key] if key in data else getattr(obj, cfg.fields[key])
            if key == 'code' and isinstance(value, str):
                value = value.strip().upper()
            values[cfg.fields[key]] = value
        if any(v in (None, '') for v in values.values()):
            continue
        clash = cfg.model.objects.filter(**values)
        if obj.pk and not obj._state.adding:
            clash = clash.exclude(pk=obj.pk)
        if clash.exists():
            errors = {key: f'A record with this {key} already exists' for key in keys}
            raise ApiError.conflict('Duplicate record', errors)


def _check_program(data: dict) -> None:
    if data.get('program') and not Program.objects.filter(pk=data['program']).exists():
        raise ApiError.bad_request('Validation failed', {'program': 'Program not found'})


def _save_sub_stages(stage: Stage, items: list[dict]) -> None:
    """Replaces the sub-stage list; existing ids are kept so leads keep pointing at them."""
    existing = {sub.id: sub for sub in stage.sub_stages.all()}
    keep = []
    for position, item in enumerate(items):
        sub = existing.get(item.get('_id')) if item.get('_id') else None
        if sub is None:
            sub = SubStage(stage=stage)
        sub.name = item['name'].strip()
        sub.counsellor_action = (item.get('counsellorAction') or '').strip() or None
        sub.is_active = item.get('isActive', True)
        sub.position = position
        sub.save()
        keep.append(sub.id)
    stage.sub_stages.exclude(pk__in=keep).delete()


class MasterListView(ApiView):
    required_permissions = {'GET': ('masters', 'view'), 'POST': ('masters', 'create')}

    def get(self, request, type_key):
        cfg = master_type(type_key)
        query = parse_list_query(request, cfg.sortable, cfg.default_sort)
        params = request.query_params
        qs = _queryset(cfg)
        if query.search:
            condition = Q()
            for f in cfg.search:
                condition |= Q(**{f'{cfg.fields[f]}__icontains': query.search})
            qs = qs.filter(condition)
        # Cohorts have a status instead of isActive, so the flag does not apply to them.
        if 'isActive' in cfg.fields and params.get('is_active') in ('true', 'false'):
            qs = qs.filter(is_active=params['is_active'] == 'true')
        qs = qs.filter(**cfg.filters(params))
        total = qs.count()
        items = query.slice(qs.order_by(*query.order(SORT_FIELDS)))
        data = [to_dict(o) for o in items]
        return ok(f'{cfg.entity} list fetched successfully', data, build_pagination(total, query.page, query.page_size))

    def post(self, request, type_key):
        cfg = master_type(type_key)
        data = validated(cfg.serializer, request.data)
        _check_program(data)
        obj = cfg.model()
        _apply(cfg, obj, data)
        _assert_unique(cfg, obj, data)
        with transaction.atomic():
            obj.save()
            if cfg.model is Stage and 'subStages' in data:
                _save_sub_stages(obj, data['subStages'])
        obj = _queryset(cfg).get(pk=obj.pk)
        audit(request, 'create', 'masters', cfg.entity, obj.pk, after=request.data)
        return created(f'{cfg.entity} created successfully', to_dict(obj, populated=False))


class MasterDetailView(ApiView):
    required_permissions = {'GET': ('masters', 'view'), 'PUT': ('masters', 'edit'), 'DELETE': ('masters', 'delete')}

    def _get(self, cfg: MasterType, object_id):
        obj = _queryset(cfg).filter(pk=object_id).first()
        if not obj:
            raise ApiError.not_found(f'{cfg.entity} not found')
        return obj

    def get(self, request, type_key, object_id):
        cfg = master_type(type_key)
        return ok(f'{cfg.entity} fetched successfully', to_dict(self._get(cfg, object_id)))

    def put(self, request, type_key, object_id):
        cfg = master_type(type_key)
        obj = self._get(cfg, object_id)
        data = validated(cfg.serializer, request.data, partial=True)
        _check_program(data)
        before = to_dict(obj, populated=False)
        _assert_unique(cfg, obj, data)
        _apply(cfg, obj, data)
        with transaction.atomic():
            obj.save()
            if cfg.model is Stage and 'subStages' in data:
                _save_sub_stages(obj, data['subStages'])
        obj = self._get(cfg, object_id)
        audit(request, 'update', 'masters', cfg.entity, obj.pk, before=before, after=request.data)
        return ok(f'{cfg.entity} updated successfully', to_dict(obj, populated=False))

    def delete(self, request, type_key, object_id):
        cfg = master_type(type_key)
        obj = self._get(cfg, object_id)
        cfg.deactivate(obj)
        obj.save()
        audit(request, 'deactivate', 'masters', cfg.entity, obj.pk)
        return ok(f'{cfg.entity} deactivated successfully', to_dict(obj, populated=False))


class BootstrapView(ApiView):
    """Single call that loads every dropdown the CRM UI needs (any signed-in user)."""

    def get(self, request):
        data = {
            'sources': [o.to_dict() for o in Source.objects.filter(is_active=True).order_by('sort_order', 'name')],
            'programs': [o.to_dict() for o in Program.objects.filter(is_active=True).order_by('sort_order', 'name')],
            'cohorts': [
                o.to_dict()
                for o in Cohort.objects.select_related('program').filter(status__in=['planned', 'open']).order_by('start_date')
            ],
            'stages': [
                o.to_dict() for o in Stage.objects.prefetch_related('sub_stages').filter(is_active=True).order_by('order')
            ],
            'dispositions': [o.to_dict() for o in Disposition.objects.filter(is_active=True).order_by('sort_order', 'name')],
            'tags': [o.to_dict() for o in Tag.objects.filter(is_active=True).order_by('sort_order', 'name')],
            'customFields': [o.to_dict() for o in CustomFieldDef.objects.filter(is_active=True).order_by('sort_order')],
        }
        return ok('Master data fetched successfully', data)
