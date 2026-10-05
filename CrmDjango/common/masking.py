"""Per-user field rules (permission builder step 6), applied on the server."""
from .normalize import mask_email, mask_mobile


def apply_field_rules(record: dict | None, rules: list[dict]) -> dict | None:
    """hidden → removed; masked → partial mask (mobile/email) or "****"; readonly → unchanged."""
    if not rules or record is None:
        return record
    out = dict(record)
    for rule in rules:
        field, mode = rule.get('field'), rule.get('mode')
        if field not in out:
            continue
        if mode == 'hidden':
            del out[field]
        elif mode == 'masked':
            value = out[field]
            if isinstance(value, str):
                lower = field.lower()
                if 'email' in lower:
                    out[field] = mask_email(value)
                elif 'mobile' in lower or 'phone' in lower:
                    out[field] = mask_mobile(value)
                else:
                    out[field] = '****'
            elif value is not None:
                out[field] = '****'
    return out


def strip_uneditable_fields(payload: dict, rules: list[dict]) -> dict:
    """Drops fields the user may not edit (readonly/hidden) from an incoming payload."""
    if not rules:
        return payload
    out = dict(payload)
    for rule in rules:
        if rule.get('mode') in ('readonly', 'hidden'):
            out.pop(rule.get('field'), None)
    return out
