"""
Plug-and-play access model (SOW "Roles & Access" sheet).
Permissions live on the USER (module → actions → data scope → field rules).
Templates are saved tick-sets used to pre-fill a user; they are not enforced at runtime.
"""

MODULES = [
    'dashboard', 'leads', 'tasks', 'applications', 'documents', 'exams', 'interviews', 'offers',
    'payments', 'loans', 'communications', 'automation', 'reports', 'users', 'teams', 'masters', 'audit',
]

ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'import', 'reassign', 'approve']

# Data visibility scopes, per SOW permission builder step 5.
DATA_SCOPES = ['own', 'team', 'location', 'program', 'cohort', 'all']

FIELD_RULE_MODES = ['hidden', 'readonly', 'masked']


def has_action(permissions: list[dict], module: str, action: str) -> bool:
    entry = next((p for p in permissions or [] if p.get('module') == module), None)
    return bool(entry) and action in (entry.get('actions') or [])
