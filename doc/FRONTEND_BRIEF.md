# KCG CRM — Frontend build brief

You are building the frontend for an existing, fully working Django REST backend. Do NOT change the API contract;
build against it exactly as documented. Every endpoint below is live and validated.

## What you get
- Backend base URL: `{{base_url}}` (local: http://127.0.0.1:8000, staging: ask the backend team)
- API reference: [LEAD_FLOW.md](LEAD_FLOW.md) (lead flow) and [ADMIN_USER_MANAGEMENT.md](ADMIN_USER_MANAGEMENT.md)
  (users, roles, teams, audit, configuration)
- Postman: `postman/KCG_CRM_Lead_Flow.postman_collection.json` and
  `postman/KCG_CRM_Admin_User_Management.postman_collection.json`. Import both, set base_url / email / password,
  run "01 Authentication / Login" first. Every request has example success and error responses — use them as your
  mock data and as the source of truth for field names.

## Ground rules (apply to every screen)
1. Auth: `POST /api/auth/login/ {email, password}` → `data.access_token`, `data.refresh_token`, `data.user`,
   `data.access`. Send `Authorization: Bearer <access_token>` on every call. Refresh with
   `POST /api/auth/refresh/ {refresh}`. On 401 → refresh once, then redirect to login. Access token lives 8h,
   refresh 7d.
2. Response envelope is always `{success, message, status, data}` (+ `pagination` on lists). Show `message` in
   toasts. Errors: 400 = show field errors from `data` (e.g. `data.email[0]`) and `message`; 403 = "no permission";
   404 = "not found" (also used when a record is outside the user's scope — never distinguish); 502/503 = show
   `message` (email / payment gateway problems); 429 = rate limited.
3. Permissions drive the UI: `data.access.permissions` is `{module: {view, add, change, delete, export, import,
   assign, approve, manage}}` and `data.access.scopes` is `{module: "own|team|team_tree|hierarchy|department|all"}`.
   `GET /api/access/me/menu/` gives the sidebar. Hide what the user cannot do; the backend enforces it anyway.
4. Lead actions: never hardcode stage logic. `GET /api/leads/{uid}/` returns `available_actions` — render exactly
   those buttons (mapping in "Lead detail" below). `GET /api/leads/workflow/` gives stages (with colours), call
   outcomes, not-eligible reasons and follow-up statuses for dropdowns and badges.
5. Lists: `?page=&page_size=` (max 200, or `page_size=all` for dropdowns); `pagination.next_page` /
   `previous_page` are full URLs. Filters and search params are documented per endpoint.
6. Masking: phone/email may come back masked (`******3210`, `v****@example.com`) for users without the
   sensitive-data permission. Render as-is; never try to unmask.
7. Files: uploads are `multipart/form-data` (field names in the docs). Downloads are authenticated GETs returning
   `application/pdf` or the file — fetch with the bearer token and open the blob; do not put the URL in an
   `<a href>`.
8. Dates are ISO (`YYYY-MM-DD`, times `HH:MM`, datetimes with `+05:30`). Send `X-Request-ID` if you have a
   correlation id.

## Roles and navigation
- Super Admin / Admin: Leads, Follow-ups, Interviews, Students & Documents, Payments, Users, Roles, Teams,
  Departments, Audit Logs, Configuration.
- Team Leader / Manager: Leads, Follow-ups, Interviews, Students & Documents, Payments (their team's data only).
- Counsellor: Leads (own), Follow-ups, Interviews, Students & Documents.
- Finance: Payments (verify offline payments), Students (read).
- Student (separate portal, separate layout, no CRM menu): My Profile, Documents, Interview, Payment, Letters.

Build the menu from `/api/access/me/menu/` rather than hardcoding it.

## CRM screens to build

### Leads list — `GET /api/leads/`
Columns: Lead ID (`uid`, show short), Application ID (`application_id`), Student Name (`full_name`), Phone, Email,
Program, Counsellor (`assigned_to.name`), Stage (badge with `stage.color` / `stage.name`), Follow-up Date
(`next_follow_up_at`), Created Date. Actions: View.
Search box → `?search=` (name, phone, email, application id). Filters: `stage` (multi, `?stage=a,b`),
`assigned_to` (uid or `me`), `unassigned=true`, `program`, `created_from/created_to`, `follow_up_from/follow_up_to`.
"Add lead" form → `POST /api/leads/` (`first_name*`, `last_name`, `phone*`, `email`, `city`, `state`, `program`,
`source`; optional `assigned_to` uid from `GET /api/leads/assignees/` — leave empty for round robin). Show the
returned `message` (it says which counsellor got the lead, or that no active counsellor was available).

### Lead detail — `GET /api/leads/{uid}/`
Header: name, application id, stage badge, counsellor, created. Tabs: Overview, Profile, Documents, Interview,
Payment, Letters, Timeline, Assignment history.
Render buttons from `available_actions`:
- `assign` → `PATCH /api/leads/{uid}/assign/ {assigned_to}` (admins) or `POST /api/leads/{uid}/auto-assign/`
- `start_call` → `POST /api/leads/{uid}/call/start/`
- `call_outcome` → modal, `POST /api/leads/{uid}/call/ {outcome, notes, reason, reason_detail, follow_up_date,
  follow_up_time}`. Outcomes: `NOT_INTERESTED`, `FOLLOW_UP` (date + time required), `NOT_ELIGIBLE` (reason
  required; reason `other` needs `reason_detail`), `INTERESTED` (only offered in follow-up stage).
- `follow_up` → `POST /api/leads/{uid}/follow-ups/ {follow_up_date, follow_up_time, notes}`
- `mark_interested` → `POST /api/leads/{uid}/mark-interested/ {notes}`
- `update_profile` / `complete_profile` → Profile tab (below)
- `send_document_email` → `POST /api/leads/{uid}/send-document-email/` (confirm dialog; on 502 show retry)
- `review_documents` → Documents tab
- `approve_profile` → `POST /api/leads/{uid}/approve-profile/`; on 400 show `message` plus the lists in
  `data.missing_fields` / `pending_documents` / `rejected_documents` / `unreviewed_documents`
- `schedule_interview` / `reschedule_interview` → Interview tab (calendar modal)
- `cancel_interview` / `complete_interview` → `PATCH /api/interviews/{id}/status/ {status}`
- `interview_result` → `PATCH /api/interviews/{id}/result/ {result: SELECTED|NOT_SELECTED, notes}`
- `initiate_payment` / `record_offline_payment` / `verify_offline_payment` → Payment tab
- `generate_letters` / `view_letters` → Letters tab

Timeline tab: `GET /api/leads/{uid}/activities/?page_size=all` — show `type_display`, `actor.name`, `created_at`,
`from_stage → to_stage`, `note`, and `changes` (metadata) in an expandable row.

### Profile tab — `GET/PATCH /api/leads/{uid}/profile/`
Form grouped as Personal / Academic / Guardian / Program using the existing application field names exactly
(`first_name`, `last_name`, `email`, `phone`, `date_of_birth`, `gender` (0/1/2), `address`, `city`, `state`,
`pincode`, `tenth_passing_year`, `tenth_passing_percentage`, `twelveth_passing_year`,
`twelveth_passing_percentage`, `institution`, `guardian_dropdown` (MOTHER/FATHER/SPOUSE/OTHER), `guardian_name`,
`guardian_phone`, `initial_program`, `final_program` …). Highlight `missing_fields` from the GET response.
"Complete profile" → `POST /api/leads/{uid}/complete-profile/`. Form is editable only when `available_actions`
contains `update_profile`.

### Documents tab — `GET /api/leads/{uid}/documents/`
Checklist rows: label, required, status badge (PENDING/SUBMITTED/APPROVED/REJECTED), uploaded date, rejection
reason, Download (`document.download_url`), Approve / Reject (reason required) →
`PATCH /api/students/documents/{id}/review/ {status, rejection_reason}`. `?history=true` shows older versions.
Global "Students & Documents" page: `GET /api/students/` (list) and `GET /api/students/documents/pending-review/`
(queue with Approve/Reject inline).

### Follow-ups page — `GET /api/leads/follow-ups/?scope=today|upcoming|overdue|completed`
Tabs Today / Upcoming / Overdue / Completed. Columns: Student, Application ID, Date, Time, Notes, Status
(`is_overdue` → red). Row actions: open lead; Mark completed / missed / cancelled →
`PATCH /api/leads/follow-ups/{id}/ {status, outcome, notes}`.

### Interviews page — `GET /api/interviews/`
List (`?status`, `?result`, `?counsellor=me`, `?date_from/date_to`) and a calendar view
(`?view=calendar&date_from&date_to` → `[{date, interviews[]}]`). Schedule modal (from the lead):
`POST /api/leads/{uid}/interview/ {scheduled_date, start_time, end_time (optional, default 90 min), interviewer
(uid from GET /api/interviews/interviewers/), mode online|in_person|phone, meeting_link, location, notes}`.
On 400 show the clash message. Columns: Student, Application ID, Date, Time, Counsellor, Status, Result.

### Payments page — `GET /api/payments/`
Columns: Student, Application ID, Amount, Method, Status, Transaction ID, Payment Date. Filters `status`, `method`,
`search`, `date_from/to`. Finance users get Verify / Reject on `OFFLINE_PENDING` rows →
`POST /api/payments/{uid}/verify/ {approve, notes}`.
Payment tab on the lead: `GET /api/leads/{uid}/payment/` (amount, currency, settled, payments[]).
- Online: `POST /api/leads/{uid}/payment/` → `data.checkout`. If `checkout.gateway === "razorpay"`, open Razorpay
  Checkout with `{key, order_id, amount, currency, name, description, prefill}`; in the handler
  `POST /api/leads/{uid}/payment/verify/ {payment_uid, order_id: razorpay_order_id, payment_id: razorpay_payment_id,
  signature: razorpay_signature}`. If `gateway === "sandbox"` (dev only) post signature `sandbox-success`.
  On 400 "Payment failed. Please try again." offer Retry (initiate again). On 503 show that online payment is not
  configured and offer offline.
- Offline: `POST /api/leads/{uid}/offline-payment/` multipart `{payment_mode (cash, cheque, dd, neft, rtgs, imps,
  upi, card, other), payment_date, transaction_id, proof (file), notes}`.

### Letters tab — `GET /api/leads/{uid}/letters/`
Two cards (Pre-placement offer, Provisional admission) with `letter_number`, `generated_at`, Download
(`download_url`, authenticated GET). "Regenerate" → `POST /api/leads/{uid}/generate-letters/`.

### Admin screens (see ADMIN_USER_MANAGEMENT.md and the admin Postman collection)
Users (list/create/edit/activate/deactivate/delete, role, team, department, manager, permission overrides,
sessions), Roles (matrix editor: modules × actions + `data_scope` per module, catalog from
`GET /api/access/permissions/`), Teams & Departments (tree, leader, members), Audit Logs (filters), Configuration
(typed key/value editor: value input depends on `data_type`; system rows cannot change key or type).

## Student portal screens (separate app or route group, role `student`)
- Set password page at `<portal_url>/set-password?uid=&token=` (link comes from the email):
  `POST /api/auth/reset-password/ {uid, token, new_password, confirm_password}`, then login.
- My Profile: `GET /api/student/me/` → `application`, `stage`, `next_step` (show prominently), documents summary.
  `PATCH /api/student/me/` for the few contact/guardian fields (locked after approval).
- Documents: `GET /api/student/documents/` checklist; per row Upload / Re-upload (multipart
  `POST /api/student/documents/ {document_type, file}`; PDF/JPG/PNG ≤ 5 MB); show `rejection_reason`; approved
  rows are locked.
- Interview: `GET /api/student/interview/` (date, time, mode, meeting link, status, result). Never show counsellor.
- Payment: `GET /api/student/payment/` (amount, payment_open, settled, payments). Pay button →
  `POST /api/student/payment/` then Razorpay Checkout → `POST /api/student/payment/verify/`.
- Letters: `GET /api/student/letters/` with Download (`GET /api/student/letters/{uid}/download/`).

The student must never see CRM routes; if a student token hits a CRM endpoint the API returns 403.

## Definition of done
- Run the full "KCG CRM - Lead Flow" Postman scenario through your UI: create lead → counsellor works it →
  student uploads → review → approve → interview → selected → pay (sandbox) → both letters downloadable.
- Every list has search, filters and pagination; every action button appears only when allowed; every error
  message from the API is visible to the user; no stage logic or role logic hardcoded in the frontend.
