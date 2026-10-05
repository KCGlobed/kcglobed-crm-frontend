# CRM API — v1

Base URL: `/api/v1` (dev: `http://localhost:4000/api/v1`, or same-origin through the Vite proxy).

## Conventions

**Authentication.** Send `Authorization: Bearer <access_token>`. The token comes from `/auth/login` or `/auth/refresh`. The refresh token travels as the httpOnly cookie `crm_rt`.

**Permissions.** Each endpoint below lists the `module.action` it requires. Super admins pass every check. Results are also limited by the caller's **data scope**: `own` returns records they own, `team` returns their team and reports plus unassigned records, `all` returns everything. **Field rules** may mask or hide fields such as `mobile` and `email` in responses.

**Success envelope**

```json
{ "success": true, "message": "Leads fetched successfully", "status": 200, "data": [], "pagination": { … } }
```

`pagination` appears on list endpoints only:

```json
{ "total_results": 100, "total_pages": 4, "current_page": 1, "page_size": 25, "next_page": 2, "previous_page": null }
```

**Error envelope**

```json
{ "success": false, "message": "Validation failed", "status": 400, "errors": { "mobile": "Enter a valid mobile number" } }
```

| Status | Meaning |
|---|---|
| 400 | Validation failed (`errors` maps field → message) or malformed id |
| 401 | Missing, expired or invalid token. The client should refresh once, then sign in again |
| 403 | Authenticated but lacks the module/action permission |
| 404 | Not found, or outside the caller's data scope |
| 409 | Duplicate (lead mobile/email, user email, master name) |
| 422 | Business rule violation (e.g. deactivating a team that still has members) |
| 429 | Rate limited (auth: 20 / 15 min; API: 300 / min) |
| 500 | Unexpected error. The message is generic in production; details go to the server log |

**List query parameters** (shared by every list endpoint)

| Param | Default | Notes |
|---|---|---|
| `page` | 1 | |
| `page_size` | 25 | max 100 |
| `search` | — | case-insensitive; fields per endpoint |
| `sort_by` | per endpoint | whitelisted; unknown values fall back to the default |
| `sort_order` | `desc` | `asc` / `desc` |

---

## Auth

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/auth/login` | — (rate-limited) | `{ email, password }` | `{ user, access_token }` and sets the `crm_rt` cookie. 401 on bad credentials, 403 if deactivated |
| POST | `/auth/refresh` | `crm_rt` cookie (or `{ refresh_token }`) | — | `{ user, access_token }`, rotated cookie. 401 if expired or reused (reuse revokes the session) |
| POST | `/auth/logout` | cookie | — | Revokes the session, clears the cookie |
| POST | `/auth/forgot-password` | — (rate-limited) | `{ email }` | Always 200 (no user enumeration). Emails a 30-min link, or logs it when SMTP is unset |
| POST | `/auth/reset-password` | — (rate-limited) | `{ token, password }` | 200, and all the user's sessions are revoked. 400 if the token is invalid or expired |
| POST | `/auth/change-password` | Bearer | `{ currentPassword, newPassword }` | 200, and other sessions are revoked. 400 if current password is wrong |
| GET | `/auth/me` | Bearer | — | `{ user }` with `permissions`, `dataScope`, `fieldRules`, team, manager |

Password rule: at least 8 characters, including a letter and a number.

## Users & access

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/users/options` | any signed-in user | Active users `{ _id, name, email, receivesLeads, team, designation }` for owner dropdowns |
| GET | `/users` | `users.view` | Search name/email/mobile. Filters: `team`, `is_active`, `receives_leads`. Sort: `name`, `email`, `createdAt`, `lastLoginAt` |
| POST | `/users` | `users.create` | `{ name, email, password, mobile?, designation?, team?, reportingManager?, isActive?, receivesLeads?, isSuperAdmin?, templateKey?, permissions?, dataScope?, fieldRules? }`. 409 on duplicate email. Only a super admin may create a super admin |
| GET | `/users/:id` | `users.view` | |
| PUT | `/users/:id` | `users.edit` | Any create field, password optional. Changing admin status or deactivating requires super admin. Deactivation revokes sessions |
| POST | `/users/:id/permissions` | `users.edit` | `{ permissions: [{ module, actions[] }], dataScope, fieldRules: [{ field, mode }], templateKey? }`. Audited with before/after |
| DELETE | `/users/:id` | `users.delete` | Deactivates the user (no hard delete) and revokes sessions. You cannot deactivate yourself |

`module` ∈ `dashboard, leads, tasks, applications, documents, exams, interviews, offers, payments, loans, communications, automation, reports, users, teams, masters, audit`
`action` ∈ `view, create, edit, delete, export, import, reassign, approve`
`dataScope` ∈ `own, team, location, program, cohort, all`. For now `location`, `program` and `cohort` behave like `team`.
`fieldRules[].mode` ∈ `hidden, readonly, masked`

### Permission templates

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/permission-templates` | `users.view` | Seeded system templates: admissions-admin, team-leader, counsellor, marketing, finance, interviewer, support |
| POST | `/permission-templates` | `users.create` | `{ key, name, description?, permissions, dataScope, fieldRules }` |
| PUT | `/permission-templates/:id` | `users.edit` | `key` cannot change |
| DELETE | `/permission-templates/:id` | `users.delete` | 422 for system templates |

### Teams

Departments, teams and counsellor groups share one hierarchy: each unit has a `type` and an optional `parent`. The `team` data scope covers the caller's own team, every team they manage, **all teams below those at any depth**, and their direct reports.

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/teams/options` | any signed-in user | Active teams `{ _id, name, code, type, parent }` for dropdowns |
| GET | `/teams/tree` | `teams.view` | Nested org chart: `[{ _id, name, code, type, manager, memberCount, totalMembers, children: [...] }]`. `totalMembers` includes everything below. `?include_inactive=true` |
| GET | `/teams` | `teams.view` | Includes `memberCount` (active) and `subTeamCount`. Search covers name, code and location. Filters: `is_active`, `type`, `parent` (id, or `root` for top level), `manager`, `location`. Sort: `name` (default), `code`, `type`, `createdAt`, `updatedAt` |
| POST | `/teams` | `teams.create` | See the body below. 409 on duplicate name (case-insensitive) or code |
| GET | `/teams/:id` | `teams.view` | Adds `ancestors` (breadcrumb, top level first), `children` (sub-teams with `memberCount`), `members` (with `reportingManager`, `lastLoginAt`) |
| PUT | `/teams/:id` | `teams.edit` | Partial body. Send `null` to clear a field. 422 if the new parent is the team itself or one of its sub-teams, or the parent is inactive. `isActive: false` follows the DELETE rules; `isActive: true` needs an active parent |
| DELETE | `/teams/:id` | `teams.delete` | Deactivates (no hard delete). 422 while it has active members or active sub-teams |
| GET | `/teams/:id/stats` | `teams.view` | Lead workload per member: `{ totals: { members, receivingLeads, total, active, converted, lost, assignedThisWeek, conversionRate }, byMember: [...] }`. `?include_sub_teams=true` rolls up every team below |
| POST | `/teams/:id/members` | `teams.edit` | `{ userIds: [], setReportingManager? }`. Moves active users into the team (a user has one team). With `setReportingManager`, their reporting manager becomes the team manager. Moved users are notified. Returns `{ added, alreadyMembers }` |
| DELETE | `/teams/:id/members/:userId` | `teams.edit` | Removes the user from the team. Their leads and login are unchanged. 404 if they are not a member |

**Team body**

```json
{
  "name": "Admissions Team A", "code": "ADM-A", "type": "team",
  "parent": "<teamId>", "manager": "<userId>", "location": "Mumbai",
  "programs": ["<programId>"], "receivesLeads": true,
  "description": "", "isActive": true
}
```

- `type` ∈ `department, team, counsellor_group` (default `team`).
- `code` is optional, unique, and stored upper-case (letters, numbers, `-`, `_`).
- `manager` must be an active user; `programs` must exist in Masters.
- `receivesLeads: false` pauses lead distribution for the team. Round-robin then skips its members even when their own `receivesLeads` is ticked. Members of inactive teams are skipped too.

## Masters

`GET /masters/bootstrap` returns every active master in one call: `{ sources, programs, cohorts, stages, dispositions, tags, customFields }`. Any signed-in user can call it.

Each master type below shares the same five routes:

| Method | Path | Permission |
|---|---|---|
| GET | `/masters/:type` | `masters.view` (search, `is_active`, plus type-specific filters) |
| POST | `/masters/:type` | `masters.create` |
| GET | `/masters/:type/:id` | `masters.view` |
| PUT | `/masters/:type/:id` | `masters.edit` (partial body) |
| DELETE | `/masters/:type/:id` | `masters.delete`. Deactivates the record; cohorts are set to `closed` instead |

| `:type` | Body | Extra filters |
|---|---|---|
| `sources` | `{ name, channel?: paid\|organic\|referral\|partner\|direct\|event\|other, description?, isActive?, sortOrder? }` | `channel` |
| `programs` | `{ name, code, track?, durationMonths?, description?, isActive?, sortOrder? }` | — |
| `cohorts` | `{ name, program, startDate?, endDate?, capacity?, status?: planned\|open\|closed\|completed }` | `program`, `status` |
| `stages` | `{ name, type?: open\|converted\|lost, color?, order?, isActive?, subStages?: [{ _id?, name, counsellorAction?, isActive? }] }`. Send existing sub-stage `_id`s back so leads keep pointing at them; retire a sub-stage with `isActive: false`. `isSystem` is set by the seed only | — |
| `dispositions` | `{ name, category?, requiresFollowUp?, isActive?, sortOrder? }` | — |
| `tags` | `{ name, color?, isActive?, sortOrder? }` | — |
| `custom-fields` | `{ key (camelCase), label, type: text\|number\|date\|select\|boolean, options?, required?, isActive?, sortOrder? }` | — |

## Leads

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/leads` | `leads.view` | See the parameters below |
| POST | `/leads` | `leads.create` | See the body below. Returns 201 with the populated lead; 409 on duplicate mobile/email |
| GET | `/leads/export` | `leads.export` | Same search and filters as the list; max 5,000 rows; field rules applied. `format=csv` (default) or `xlsx`. `columns` = comma-separated keys in the order wanted (see below); omitted → the default 21 columns. 400 for an unknown column or format |
| POST | `/leads/bulk-upload` | `leads.import` | Multipart upload, see below |
| GET | `/leads/:id` | `leads.view` | 404 if outside the caller's scope |
| PUT | `/leads/:id` | `leads.edit` | Partial create body plus `status`, `lastDisposition`. See **Stages** below. Fields with a read-only/hidden rule are ignored |
| POST | `/leads/:id/assign` | `leads.reassign` | `{ owner }`. Notifies the new and previous owner |
| DELETE | `/leads/:id` | `leads.delete` | Soft delete; frees the mobile/email for reuse |
| GET | `/leads/:id/notes` | `leads.view` | Newest first |
| POST | `/leads/:id/notes` | `leads.view` | `{ body, category? }` |
| GET | `/leads/:id/timeline` | `leads.view` | Paginated history, newest first. Types: `created`, `assignment`, `stage_change`, `status_change`, `note`, `task` (follow-up scheduled / rescheduled / reassigned / completed / cancelled / overdue), `profile` (step saved, declaration, unlock), `edit` (with `before → after` per field in `description`; contact values are never written), `import`, `system` (re-enquiry). `?type=a,b` filters |

**`GET /leads` parameters.** Search covers first name, last name, email, lead number, and mobile (4 or more digits). Filters: `stage`, `sub_stage`, `source`, `owner`, `unassigned=true`, `program`, `cohort`, `tag`, `status` (active/converted/lost), `track` (ads/partner/other), `created_from`, `created_to` (YYYY-MM-DD). Sort by: `createdAt`, `updatedAt`, `firstName`, `stageChangedAt`, `lastActivityAt`, `assignedAt`.

**Export columns** (`GET /leads/export?columns=`): `leadNo`, `firstName`, `lastName`, `mobile`, `email`, `city`, `state`, `source`, `channel`, `firstSource`, `stage`, `subStage`, `status`, `lastDisposition`, `owner`, `program`, `cohort`, `track`, `tags`, `utmSource`, `utmMedium`, `utmCampaign`, `partner`, `referralCode`, `createdVia`, `createdAt`, `updatedAt`, `assignedAt`, `stageChangedAt`, `lastActivityAt`. Without `columns` the export keeps its original 21: `leadNo`, `firstName`, `lastName`, `mobile`, `email`, `city`, `state`, `source`, `channel`, `stage`, `subStage`, `status`, `owner`, `program`, `cohort`, `track`, `utmSource`, `utmMedium`, `utmCampaign`, `partner`, `createdAt`.

**Stages.** The stage list comes from *GCC_School_Lead_Stages_with_Counsellor_Actions.xlsx*: 14 stages, each with sub-stages and a counsellor action per sub-stage, plus the system stage **Untouched**, where every new lead starts (Deep Dive §7.2). Rules for `stage` / `subStage` on create and update:

- `subStage` is the `_id` of one of the stage's `subStages`. 400 if it belongs to another stage.
- When the target stage has active sub-stages, a sub-stage is required (400 `errors.subStage`).
- A system stage (`isSystem: true`, e.g. Untouched) cannot be picked manually (422).
- Changing the stage or sub-stage logs `Stage changed: A (sub) → B (sub)` on the timeline. Changing `stage` sets `status` from the stage type (open → active, converted, lost).
- Lead responses populate `stage` with its `subStages`, so clients resolve the sub-stage name and counsellor action from `lead.subStage`.

**Create body**

```json
{
  "firstName": "Aarav", "lastName": "Sharma",
  "mobile": "9820011001", "email": "aarav@example.com",
  "city": "Mumbai", "state": "MH",
  "source": "<sourceId>", "programInterest": "<programId>", "cohort": "<cohortId>", "stage": "<stageId>",
  "track": "ads",
  "utm": { "source": "google", "medium": "cpc", "campaign": "gmba-jan27", "term": "", "content": "", "landingPage": "/gmba" },
  "referral": { "code": "CP-204", "partnerName": "EduBridge", "partnerLink": "" },
  "tags": ["<tagId>"],
  "customFields": { "workExperienceYears": 3 },
  "owner": "<userId>",
  "autoAssign": false
}
```

- Mobile numbers are normalised (`+91 98200 11001` becomes `9820011001`) before duplicate checks.
- `source` becomes the immutable `firstSource` and the current `source`.
- `stage` defaults to the first open stage.
- If neither `owner` nor `autoAssign` is sent, a caller with own scope becomes the owner. Otherwise the lead stays unassigned.

**Bulk upload** (`multipart/form-data`)

| Field | Value |
|---|---|
| `file` | `.csv` / `.xlsx` / `.xls`, max 10 MB and 5,000 rows |
| `mapping` | JSON `{ "name"|"firstName": "<column>", "lastName"?, "mobile": "<column>", "email"?, "city"?, "state"? }` |
| `defaults` | JSON `{ source?, programInterest?, stage?, track?, autoAssign? }` |

The response looks like `{ total, inserted, failed, errors: [{ row, field, message }] }`. Valid rows are inserted. These rows are reported instead: a missing name or mobile, an invalid email, a duplicate within the file, or an existing lead.

### Follow-ups (tasks)

Deep Dive §10.2. A follow-up is the next dated action on a lead. Lead responses carry `nextFollowUpAt`, the earliest open follow-up. Reassigning a lead moves its open follow-ups to the new owner.

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/leads/:id/tasks` | `tasks.view` | The lead's follow-ups: open ones by due time, then closed ones |
| POST | `/leads/:id/tasks` | `tasks.create` | See the body below. Returns 201. 400 if `dueAt` is in the past. 403 if an own-scope user assigns someone else |
| GET | `/tasks` | `tasks.view` | Paginated. Filters: `view` = `today` / `overdue` / `upcoming` / `open` / `completed`; `assignee` = `me` or a user id (omit for everyone in your data scope); `lead`, `type`, `priority` |
| GET | `/tasks/summary` | `tasks.view` | `{ counts: { today, overdue, upcoming, completed }, types: [{ value, label }] }`; takes `assignee` |
| PUT | `/tasks/:id` | `tasks.edit` | Partial: `type`, `dueAt` (reschedule), `assignee`, `priority`, `reminderMinutes`, `notes`, `status` (`done` / `cancelled` / `open`), `outcome`. A new due time or assignee re-arms the reminders |

**Body**

```json
{ "type": "call_back", "dueAt": "2026-10-06T12:30:00Z", "assignee": "<userId>", "priority": "high", "reminderMinutes": 15, "notes": "" }
```

- `type` is one of `call_back`, `follow_up_call`, `counselling_session`, `expert_one_on_one`, `document_collection`, `payment_follow_up`, `parent_call`, `other`.
- `priority` is `high` or `normal`.
- `reminderMinutes` is 5, 15, 30 or 60.
- `notes` has a maximum of 500 characters.
- `assignee` defaults to the lead owner.

A response includes `typeLabel`, `isOverdue`, `completedAt` and `completedBy`.

**Alerts.** `manage.py send_reminders` sends these, and so does the notifications poll, at most once a minute. Schedule the command every minute in production. Each alert is sent once:

| When | Who | Notification |
|---|---|---|
| `reminderMinutes` before due | assignee | `task_due` "Follow-up due in N min" |
| at the due time | assignee | `task_overdue` "Follow-up overdue", plus a timeline entry |
| 2 hours after due | assignee's reporting manager (else team manager) | `task_overdue` "Overdue 2+ hrs" |
| lead still in Untouched 2 hours after assignment | owner and their team leader | `system` |

### Student profile

Follows Deep Dive: Lead Management Module §4.2. Each lead has one profile, and access follows the lead (data scope, field masking). Document uploads (#34–#41) are not built yet.

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/leads/:id/profile` | `leads.view` | `{ exists, personal, guardian, academic, work, declaration, declarationText, locked, steps: { personal, academic, work }, completionPercent }`. A new profile is prefilled from the lead's first name, last name, email and mobile |
| PUT | `/leads/:id/profile/personal` | `leads.edit` | `{ personal: {...}, guardian: {...} }`, step 1 |
| PUT | `/leads/:id/profile/academic` | `leads.edit` | `{ academic: { class10, class12, ug, higherQualification } }`, step 2 |
| PUT | `/leads/:id/profile/work` | `leads.edit` | `{ work: {...} }`, step 3 |
| POST | `/leads/:id/profile/declaration` | `leads.edit` | `{ accepted: true }`. 422 until steps 1–3 pass. Stores the timestamp and text version, then **locks** the profile (step saves return 422) |
| POST | `/leads/:id/profile/unlock` | super admin | `{ reason }`. Withdraws the declaration and unlocks the profile. The reason is kept in `unlockHistory` and the audit log |

Validation errors return 400 with dotted field keys such as `academic.ug.score`:

- **Names:** letters, spaces and "." only, max 50. The guardian name allows letters only.
- **Mobile numbers:** 10 digits starting 6–9; `+91`, spaces and a leading 0 are stripped. The guardian mobile must differ from the candidate's.
- **Other personal fields:** DOB gives an age of 17–40; PIN code is 6 digits; address is optional, max 250; guardian email is optional.
- **Years:** Class 10 runs from 1990 to the current year. Class 12 must be after Class 10. The UG year must be after Class 12, and a future year is allowed only while Pursuing (up to 5 years ahead).
- **Grade type + score:** Percentage 0–100 or CGPA 0–10, up to 2 decimals. Required for Class 10 and 12; for UG only when Completed.
- **Higher qualification:** Yes requires details (max 150).
- **Experience:** fields are required only for Experienced; years 0–30, months 0–11. Hidden fields are cleared on save.

## Public capture (website, landing pages, connectors)

Each endpoint requires the header `x-api-key: <CAPTURE_API_KEY>`. A missing or wrong key returns 401.

| Method | Path | Notes |
|---|---|---|
| POST | `/leads/capture` | Website and landing-page forms |
| POST | `/webhooks/meta-leads` | Meta lead ads. Sets `createdVia=meta` and track `ads` |
| POST | `/webhooks/google-leads` | Google lead forms. Sets `createdVia=google` and track `ads` |

Request body:

```json
{
  "name": "Rohan Desai", "mobile": "9833300111", "email": "rohan@example.com",
  "source": "Google Ads", "program": "GMBA",
  "utm_source": "google", "utm_medium": "cpc", "utm_campaign": "gmba-jan27",
  "utm_term": "", "utm_content": "", "landing_page": "/gmba",
  "referral_code": "", "partner_name": "", "partner_link": "", "track": "ads"
}
```

- `firstName`/`lastName` can be sent instead of `name`.
- `source` is matched by name; an unknown name creates a new source on the fly. `program` matches by name or code.
- New leads are auto-assigned round-robin, and the response is `201 { duplicate: false, leadNo, leadId }`.
- A matching mobile/email is treated as a **re-enquiry**. The latest-touch `source` updates, `firstSource` stays, a timeline entry is added, and the response is `{ duplicate: true, … }`.

## Dashboard, notifications, audit

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/dashboard/summary` | `dashboard.view` | `{ totals: { total, newToday, newThisWeek, unassigned, converted, lost }, byStage, bySource, byOwner, recentLeads, myLeadsToday }`, scope-aware |
| GET | `/notifications` | signed in | `?page&unread=true` returns `{ items, unreadCount }` + pagination. Also sets the `X-Unread-Count` header. Types: `lead_assigned`, `lead_reassigned`, `task_due` (follow-up assigned or due soon), `task_overdue`, `system` (re-enquiry on your lead, untouched lead, added to a team). `data.leadId` / `data.taskId` link to the record |
| PATCH | `/notifications/:id/read` | signed in (own only) | |
| PATCH | `/notifications/read-all` | signed in | |
| GET | `/audit-logs` | `audit.view` | Filters: `module`, `action`, `actor`, `created_from`, `created_to`. Search covers actor name, entity type/id and action. Entries include `before`/`after`, IP and user agent |

## Health

`GET /health` (outside `/api/v1`) returns `{ success: true, data: { uptime } }`.
