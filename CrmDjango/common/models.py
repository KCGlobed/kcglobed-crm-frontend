from django.db import models

from .ids import new_object_id


class ObjectIdField(models.CharField):
    """24-hex primary/foreign key value (see common.ids)."""

    def __init__(self, *args, **kwargs):
        kwargs.setdefault('max_length', 24)
        super().__init__(*args, **kwargs)


class BaseModel(models.Model):
    """id + createdAt/updatedAt on every table (the Mongo `timestamps: true`)."""

    id = ObjectIdField(primary_key=True, default=new_object_id, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class CreatedOnlyModel(models.Model):
    """Append-only records (timeline, audit, notifications) have no updatedAt."""

    id = ObjectIdField(primary_key=True, default=new_object_id, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        abstract = True


def compact(data: dict) -> dict:
    """Drops None values — Mongo leaves unset fields out of documents."""
    return {k: v for k, v in data.items() if v is not None}


def ref(obj, *fields: str) -> dict | None:
    """A populated reference: {_id, …selected fields} (Mongoose `populate(path, select)`)."""
    if obj is None:
        return None
    out = {'_id': obj.pk}
    for f in fields:
        value = getattr(obj, f, None)
        if value is not None:
            out[CAMEL.get(f, f)] = value
    return out


# snake_case model attribute → camelCase API key, for ref() selections
CAMEL = {
    'is_active': 'isActive',
    'is_system': 'isSystem',
    'receives_leads': 'receivesLeads',
    'last_login_at': 'lastLoginAt',
    'counsellor_action': 'counsellorAction',
}
