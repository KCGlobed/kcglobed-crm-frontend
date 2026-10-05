"""
Go-live roles (Go-Live Minimum Scope §2–3): Super Admin, Admin, Admission Counsellor.

A role fixes the user's permissions and data scope. `other` keeps users whose
access was hand-built with the permission builder (a later-release feature).
"""

SUPER_ADMIN, ADMIN, COUNSELLOR, OTHER = 'super_admin', 'admin', 'counsellor', 'other'
ROLES = [SUPER_ADMIN, ADMIN, COUNSELLOR, OTHER]
ROLE_LABELS = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Admin',
    COUNSELLOR: 'Admission Counsellor',
    OTHER: 'Custom access',
}

# who may create / manage which role (§2): Super Admin → Admin + Counsellor; Admin → Counsellor
MANAGEABLE = {
    SUPER_ADMIN: {ADMIN, COUNSELLOR, OTHER},
    ADMIN: {COUNSELLOR},
}


def _p(module, *actions):
    return {'module': module, 'actions': list(actions)}


# §3 data visibility table, as module permissions
ROLE_ACCESS = {
    ADMIN: {
        'data_scope': 'all',
        'permissions': [
            _p('dashboard', 'view'),
            _p('leads', 'view', 'create', 'edit', 'export', 'import', 'reassign'),
            _p('tasks', 'view', 'create', 'edit'),
            _p('communications', 'view', 'create', 'edit', 'delete'),
            _p('automation', 'view', 'edit'),
            _p('users', 'view', 'create', 'edit', 'delete'),
            _p('masters', 'view'),
            _p('audit', 'view'),
            _p('reports', 'view', 'export'),
        ],
    },
    COUNSELLOR: {
        'data_scope': 'own',
        'permissions': [
            _p('dashboard', 'view'),
            _p('leads', 'view', 'create', 'edit'),
            _p('tasks', 'view', 'create', 'edit'),
            _p('communications', 'view', 'create'),
            _p('masters', 'view'),
        ],
    },
}


def creatable_roles(actor) -> set[str]:
    if actor.is_super_admin:
        return MANAGEABLE[SUPER_ADMIN]
    return MANAGEABLE.get(getattr(actor, 'role', None), set())


def can_manage(actor, target_role: str) -> bool:
    return target_role in creatable_roles(actor)
