"""
24-hex identifiers, shaped like MongoDB ObjectIds.

The React frontend and API clients already treat ids as 24-character hex
strings (validated with /^[0-9a-fA-F]{24}$/), so primary keys keep that shape.
The timestamp prefix keeps them roughly creation-ordered, which round-robin
relies on (it rotates over users sorted by id).
"""
import itertools
import os
import re
import threading
import time

_ID_RE = re.compile(r'^[0-9a-fA-F]{24}$')
_counter = itertools.count(int.from_bytes(os.urandom(3), 'big'))
_lock = threading.Lock()
_process_random = os.urandom(5).hex()


def new_object_id() -> str:
    with _lock:
        count = next(_counter) & 0xFFFFFF
    return f'{int(time.time()):08x}{_process_random}{count:06x}'


def is_object_id(value) -> bool:
    return isinstance(value, str) and bool(_ID_RE.match(value))
