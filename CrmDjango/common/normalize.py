"""Normalisers used for duplicate blocking: match on mobile and email."""
import re


def normalize_email(email: str | None) -> str | None:
    trimmed = (email or '').strip().lower()
    return trimmed or None


def normalize_mobile(mobile: str | None) -> str | None:
    """Digits only; strips a leading 91 / 0 from numbers longer than 10 digits."""
    if not mobile:
        return None
    digits = re.sub(r'\D', '', str(mobile))
    if len(digits) > 10 and digits.startswith('91'):
        digits = digits[-10:]
    if len(digits) > 10 and digits.startswith('0'):
        digits = digits.lstrip('0')
    return digits or None


def mask_mobile(mobile: str | None) -> str | None:
    if not mobile:
        return mobile
    if len(mobile) <= 4:
        return '****'
    return '*' * (len(mobile) - 4) + mobile[-4:]


def mask_email(email: str | None) -> str | None:
    if not email:
        return email
    local, _, domain = email.partition('@')
    if not domain:
        return '****'
    return local[:2] + '*' * max(2, len(local) - 2) + '@' + domain
