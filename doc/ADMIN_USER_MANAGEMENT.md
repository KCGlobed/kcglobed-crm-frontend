# Admin & User Management module

API reference for the user, role, permission, team, hierarchy, data-masking, audit-log and configuration features of
the KCG CRM backend. Everything lives under the existing `/api/access/` prefix and uses the existing JWT login.

Postman collection: `postman/KCG_CRM_Admin_User_Management.postman_collection.json`
(run *01 Authentication / Login* first; it stores the tokens).

---

## 1. Conventions

**Authentication.** `Authorization: Bearer <access_token>` on everything except login, refresh, logout,
forgot-password and reset-password. Tokens come from `POST /api/auth/login/` as `data.access_token` /
`data.refresh_token`. Access tokens live 8 hours, refresh tokens 7 days. Deactivating a user, resetting a password
or revoking sessions blacklists their refresh tokens.

**Authorization.** Every view declares a module (`permission_module`) and the HTTP method maps to an action:
`GET → view`, `POST → add`, `PUT/PATCH → change`, `DELETE → delete` (a view may override, e.g. activate/deactivate
are `change`). A Super Admin (role `super-admin`, Django superuser or legacy `is_admin`) always passes.
Everyone else needs the flag on their role (`RolePermission`) or a per-user override (`UserPermissionOverride`).

**Data scope.** On top of the action flag, each (role, module) row has a `data_scope` that limits *which records*
the user sees. Evaluated in SQL by `users/scoping.py`, never in Python:

| scope | records |
|---|---|
| `own` | only the user's own records |
| `team` | the user's team (`User.team`) plus the teams they lead |
| `team_tree` | those teams plus every child team |
| `hierarchy` | the user and everyone below them in the reporting chain (`User.reports_to`) |
| `department` | everyone in the user's department |
| `all` | everything |

A record outside the scope answers **404**, never 403, so ids cannot be probed.
Applied to: users (`/users/…`), teams (`/teams/…`), leads (`/api/leads/…`, via `assigned_to` / `created_by`).
`leads-view-all` (existing module) still grants every lead.

**Response envelope** (unchanged): every response is
```json
{"success": true, "message": "Users fetched successfully", "status": "200", "pagination": {...}, "data": ...}
{"success": false, "message": "Email: A user with this email already exists.", "status": "400", "data": {"email": ["A user with this email already exists."]}}
```
`pagination` only on list APIs (`?page=`, `?page_size=` up to 200 or `all`). Field errors are in `data`.

**Status codes.** 400 validation / business rule · 401 not authenticated, invalid or expired token · 403 no permission
(including escalation attempts) · 404 not found or outside your scope · 405 method not allowed · 409 database conflict
(duplicate / protected record) · 423 locked account · 429 throttled · 500 unexpected (no stack trace unless `DEBUG`).

**Request id.** Send `X-Request-ID` to correlate; it is echoed back and stored on audit rows. Without it one is generated.

---

## 2. Endpoints

### 2.1 Authentication (`/api/auth/`, unchanged URLs)

| Method | URL | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/login/` | none | `{email, password}` → tokens, `user`, `access` (`permissions` + **`scopes`**). Lockout after `security.max_failed_logins` failures for `security.lockout_minutes` (configuration). Audited: `login`, `login_failed`. |
| POST | `/api/auth/refresh/` | none | `{refresh}` |
| POST | `/api/auth/logout/` | none | `{refresh}`; audited `logout` |
| POST | `/api/auth/logout-all/` | bearer | audited `logout_all` |
| POST | `/api/auth/change-password/` | bearer | audited `password_change` |
| POST | `/api/auth/forgot-password/` | none | 5/hour per IP; audited `password_reset_request` |
| GET | `/api/auth/reset-password/<uid>/<token>/` | none | link check |
| POST | `/api/auth/reset-password/` | none | audited `password_reset` |
| GET | `/api/access/me/permissions/` | bearer | `{role, full_access, permissions, scopes}` |
| GET | `/api/access/me/menu/` | bearer | sidebar |
| GET | `/api/access/me/sessions/` | bearer | **new** – my live refresh tokens (`is_revoked`) |
| GET | `/api/access/permissions/` | bearer | **new** – catalog: actions, scopes, modules, method→action map |

### 2.2 Users (`/api/access/users/`, module `users`)

| Method | URL | Action | Notes |
|---|---|---|---|
| GET | `/users/` | view | filters `search, role (slug), is_active, team (id\|none), department (id\|none), reports_to (uid\|none)`, `ordering` (`email, first_name, last_name, created_at, updated_at, is_active, role, team, department`, `-` for desc). Scoped. |
| POST | `/users/` | add | `email*, first_name, last_name, password*, phone1, phone2, address, city, state, country, pincode, dob, role (id), reports_to (uid), team (id), department (id)`. Mails login details. |
| GET | `/users/<uid>/` | view | |
| PATCH | `/users/<uid>/` | change | same fields minus password. Role / team / department / manager assignment happens here. |
| DELETE | `/users/<uid>/` | delete | **new** soft delete. Blocked: yourself, last Super Admin, user with open leads. Direct reports move to their manager, led teams lose their leader, tokens revoked. |
| PATCH | `/users/<uid>/deactivate/` · `/activate/` | change | |
| PATCH | `/users/<uid>/set-password/` | change | needs every permission the target has |
| GET / PUT | `/users/<uid>/permissions/` | view / change | overrides (`can_*` true/false/null + `data_scope`), `effective`, **`scopes`**. Not on yourself. |
| GET | `/users/<uid>/hierarchy/` | view | **new** managers chain, direct reports, subordinate count, team (+ parent chain), led teams, department |
| GET | `/users/<uid>/team/` | view | **new** |
| GET / DELETE | `/users/<uid>/sessions/` | view / change | **new** list / revoke all sessions |
| GET | `/users/reporting-tree/` · `/users/reporting-options/` | view | unchanged |

### 2.3 Roles (`/api/access/roles/`, module `roles`) – unchanged URLs, extended payloads

| Method | URL | Notes |
|---|---|---|
| GET / POST | `/roles/` | `?search=` added. POST accepts `permissions: [{module, can_view … can_manage, data_scope}]`, `copy_from`. |
| GET | `/roles/options/` | module `users`; Super Admin hidden from non Super Admins |
| GET / PATCH / DELETE | `/roles/<id>/` | |
| GET / PUT | `/roles/<id>/permissions/` | matrix rows now carry the 9 `can_*` flags and `data_scope`. On PUT a row **without** `data_scope` keeps its scope. |

Actions: `view, add, change, delete, export, import, assign, approve, manage`.

### 2.4 Departments & teams (`/api/access/…`, modules `departments`, `teams`) – all new

| Method | URL | Action | Notes |
|---|---|---|---|
| GET / POST | `/departments/` | view / add | `name*, code, description, head_uid` · filters `is_active, search` |
| GET | `/departments/options/` | users:view | dropdown |
| GET / PATCH / DELETE | `/departments/<id>/` | | delete blocked while teams or users belong to it |
| PATCH | `/departments/<id>/activate/` · `/deactivate/` | change | |
| GET / POST | `/teams/` | view / add | `name*, code, description, department (id), parent (id), leader_uid` · filters `department, parent (id\|none), is_active, search`. Scoped. Parent must be inside your scope. |
| GET | `/teams/options/` | users:view | dropdown, scoped |
| GET | `/teams/tree/` | view | nested, scoped |
| GET / PATCH / DELETE | `/teams/<id>/` | | delete blocked with child teams or members |
| PATCH | `/teams/<id>/activate/` · `/deactivate/` | change | deactivate cascades to child teams; activate needs an active parent |
| PATCH | `/teams/<id>/leader/` | change | `{leader: uid \| null}` – active user inside your users scope |
| GET / POST / DELETE | `/teams/<id>/members/` | view / change | `{users: [uid, …]}` (≤ 200). Sets / clears `User.team`; department inherited when empty. |
| GET | `/hierarchy/` | teams:view | departments → team trees → members, scoped |

Hierarchy rules enforced (serializer + DB check constraint `team_not_own_parent`): a team cannot be its own parent,
no cycles, parent must be active, parent and child must share a department, inactive teams refuse new members unless
`hierarchy.allow_inactive_team_members` is on, a user cannot report to themselves or to someone below them, inactive
users cannot be managers / leaders / heads.

### 2.5 Audit logs (`/api/access/audit-logs/`, module `audit-logs`, read-only)

| Method | URL | Notes |
|---|---|---|
| GET | `/audit-logs/` | filters `user (uid or email), action, module, object_type, object_id, success, request_id, search, date_from, date_to (YYYY-MM-DD), ordering (created_at, action, actor)` |
| GET | `/audit-logs/<id>/` | adds `old_data`, `new_data`, `metadata` |
| GET | `/audit-logs/options/` | actions, modules, object types for filters |

### 2.6 Configurations (`/api/access/configurations/`, module `configurations`)

| Method | URL | Notes |
|---|---|---|
| GET / POST | `/configurations/` | filters `group, is_active, search`. POST: `key* (a-z0-9 . _ -), name*, group, description, data_type* (string\|integer\|decimal\|boolean\|json\|list), value*, default_value, choices (list), min_value, max_value` |
| GET / PATCH / DELETE | `/configurations/<id>/` | system rows: key and data_type immutable, cannot be deleted |
| PATCH | `/configurations/<id>/activate/` · `/deactivate/` | inactive = the code falls back to its built-in default |

Seeded (system) keys: `masking.enabled` (true), `masking.phone_visible_digits` (4), `masking.email_visible_chars` (1),
`security.max_failed_logins` (5), `security.lockout_minutes` (15), `hierarchy.allow_inactive_team_members` (false).
Lead stages remain at `/api/leads/stages/`; modules remain at `/api/access/modules/`.

---

## 3. Permission matrix (seeded)

`all` = view, add, change, delete, export. Roles other than Admin / Super Admin / Staff / Sales Person are new,
seeded with `is_system = false` (they can be renamed, edited or deleted). Staff and Sales Person keep whatever they
had. Existing custom roles are not touched by the migration.

| Module | Super Admin | Admin | Manager | Team Leader | Counsellor | Marketing | Finance | HR | Support | Tech |
|---|---|---|---|---|---|---|---|---|---|---|
| users | all | all | view | view | – | – | – | view, add, change | – | – |
| roles | all | view, add, change | – | – | – | – | – | – | – | – |
| departments | all | all | view | view | – | – | – | view, add, change | – | – |
| teams | all | all | view, add, change | view | – | – | – | view, add, change | – | – |
| leads | all | all | all | view, add, change, export | view, add, change | view, add, change, export | view | – | view, change | view |
| leads-assign (change) | ✓ | ✓ | ✓ | ✓ | – | – | – | – | – | – |
| leads-view-all (view) | ✓ | ✓ | – | – | – | ✓ | ✓ | – | ✓ | ✓ |
| lead-stages | all | all | view | – | – | – | – | – | – | – |
| audit-logs (view) | ✓ | ✓ | – | – | – | – | – | – | – | ✓ |
| configurations | all | all | – | – | – | – | – | – | – | view |
| sensitive-data (view = unmasked) | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | – | – | – |
| **data scope** users / teams / leads | all | all | team_tree | team | own | all (leads) | all (leads) | all | all (leads) | all |

Escalation guards (server side, cannot be bypassed from the frontend): nobody can grant an action or a wider data
scope than they hold themselves; only a Super Admin can assign the Super Admin role or edit a Super Admin; nobody can
change their own role or their own overrides; a team / department can only be assigned by someone whose scope covers
it; a password can only be set for a user whose permissions are a subset of the actor's.

---

## 4. Validation rules (backend)

| Field | Rule |
|---|---|
| email | valid format, unique case-insensitively |
| password | required on create, ≥ 8 chars + Django validators (common / numeric / similarity); never changed via PATCH |
| phone1 / phone2 | optional; normalised to digits (+ optional leading `+`), 7–15 digits |
| role | must exist and be active; Super Admin only by Super Admin; not stronger than the actor's; not your own |
| reports_to | active user, not yourself, not someone below you |
| team | must exist; active unless configured; inside actor's `teams` scope |
| department | must exist and be active; inside actor's `departments` scope |
| role / department / team name | unique (team & department: case-insensitive); `code` auto-slug, unique |
| team parent | see hierarchy rules |
| permission rows | module must exist and be active, no duplicate modules, `data_scope` ∈ scopes |
| configuration | key pattern, unique; value coerced / validated per `data_type`, `choices`, `min_value`, `max_value` |
| audit filters | dates `YYYY-MM-DD`, ordering whitelist |
| list ordering | whitelisted fields only |

Database constraints: unique email, unique role name/slug, unique (role, module), unique (user, module), unique
department/team name & code, `team_not_own_parent` check, FK `on_delete` = `SET_NULL` for people references,
`PROTECT` for department → team.

---

## 5. Data masking

`core/masking.py`. Applied server side in the serializers; the raw value never leaves the API for callers without
`view` on the `sensitive-data` module (Super Admin always sees raw). A user always sees their own record unmasked.

| field | example |
|---|---|
| phone (`Lead.phone`, `Lead.alternate_phone`, `User.phone1`, `User.phone2`) | `9876543210` → `******3210`, `+919876543210` → `+********3210` |
| email (`Lead.email`) | `vishal@example.com` → `v****@example.com` |
| lead history `changes` | old / new phone & email values masked the same way |

Configurable: `masking.enabled`, `masking.phone_visible_digits`, `masking.email_visible_chars`.
The migration grants `sensitive-data` view to every existing role that already had `leads` view, so nobody loses
data they see today; revoke it per role in the matrix.

---

## 6. Audit log

`audit/services.py::log_event()` – never raises, scrubs `password*`, `token`, `refresh`, `access*`, `secret`,
`authorization` values to `***`. Each row: actor (+ email snapshot), action, module, object type / id / repr,
old_data, new_data (only changed keys), success, message, ip (X-Forwarded-For aware), user agent, request id,
metadata, timestamp. Indexed on created_at, actor, action, module, (object_type, object_id).

Events: `login`, `login_failed`, `logout`, `logout_all`, `password_change`, `password_reset_request`,
`password_reset`, `password_set`, `create` / `update` / `delete` / `activate` / `deactivate` (users, roles, departments,
teams, configurations), `role_assign`, `permission_change` (role matrix and user overrides, old/new), `team_assign`
(team / department / manager change), `member_add` / `member_remove`, `lead_assign` (single and bulk),
`config_change`, `session_revoke`. Django admin shows the log read-only.

---

## 7. Backward compatibility

* No existing URL, method or field was removed. Existing responses gained keys only: `data_scope` in the matrix,
  `scopes` in `me/permissions` and login, `team` / `department` in user payloads, four extra `can_*` flags.
* Existing behaviour preserved by the migration: every existing permission row gets `data_scope = all` except
  `leads` (= `hierarchy`, which is what `visible_leads()` did before). `leads-view-all` still works.
* `ProtectedError` now answers **409** instead of 400; `IntegrityError` answers 409 instead of 500.
* Lead serializers now need `context={"request": request}` (all existing views were updated). A serializer used
  without a request masks the fields (fails closed).
* `User.phone1/phone2` are now validated on write (7–15 digits). Existing stored values are untouched.
* New settings: three apps in `INSTALLED_APPS`, `core.middleware.RequestContextMiddleware`, `REQUEST_ID_HEADER`.
  The two `print()` calls of the email settings were removed from `settings.py`.

## 8. Not implemented / open points

* **Location scope** – the spec lists it "if the architecture supports location"; there is no location model, so it
  was left out (city/state/country on users are free text).
* **Swagger / OpenAPI** – the project has no schema generator; documentation is this file plus the Postman
  collection (decision taken during planning).
* `ALLOWED_HOSTS = ['*']` and the hard-coded fallback `SECRET_KEY` in `settings.py` were left as they were; set them
  from the environment in production.
* Deleted users keep their email (unique), so the same email cannot be re-registered without restoring the record.
* Roles created through the API get a permission row per module via signals; the seed migration also completes
  missing rows for roles that were created outside the API.
