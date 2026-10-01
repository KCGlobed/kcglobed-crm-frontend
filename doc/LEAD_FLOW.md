# CRM Lead Flow — entity design, APIs and implementation

Scope: **lead → round-robin counsellor → call → follow-up / not interested / not eligible → interested → profile
completion → document email → student portal upload → counsellor review → profile approval → interview → selected /
not selected → ₹11,800 payment (online or offline) → pre-placement offer letter → provisional admission letter.**
Nothing outside this flow was built (no loans, NFET, WhatsApp, dialer, analytics).

Related: [ADMIN_USER_MANAGEMENT.md](ADMIN_USER_MANAGEMENT.md) (roles, data scopes, audit, configuration API),
Postman: `postman/KCG_CRM_Lead_Flow.postman_collection.json`.

---

## 1. Architecture

| Layer | Where | Notes |
|---|---|---|
| Stage engine | `leads/workflow.py` | `Stage` codes, `Action`s, the `TRANSITIONS` table, `apply()` (row-locked, writes the timeline), `available_actions()` |
| Round robin | `leads/assignment.py` | `assign_round_robin()` locks `RoundRobinPointer` (pk 1) with `SELECT … FOR UPDATE`; eligible = active users whose role slug is in config `leads.round_robin_roles` |
| Calls / follow-ups / interested | `leads/services.py` | `record_call_outcome`, `create_follow_up`, `update_follow_up`, `mark_interested` |
| Student profile, documents, email, approval | `students/services.py` | `complete_profile`, `send_document_email`, `upload_document`, `review_document`, `approve_profile` |
| Interviews | `interviews/services.py` | `schedule` (conflict check), `set_status`, `set_result` |
| Payments | `payments/services.py`, `payments/gateways.py` | Razorpay + sandbox adapters, online / offline / webhook, `settle()` → letters |
| Letters | `letters/services.py`, `letters/templates/letters/*.html` | xhtml2pdf, stored in private storage |
| Private files | `core/storage.py` | `PRIVATE_MEDIA_ROOT` (outside `MEDIA_URL`), streamed only by authorised views |

Every stage change goes through `workflow.apply(lead, action, actor, outcome=…)`: it validates the transition
against the table, saves the stage, and writes one `LeadActivity` with `from_stage` / `to_stage` / metadata.
Views never set `Lead.stage`. The only exception is the Super Admin override (`PATCH /api/leads/<uid>/stage/`),
audited as `stage_overridden`.

Authorisation reuses the existing RBAC: module permission (`leads`, `students`, `interviews`, `payments`) +
data scope (own / team / team_tree / hierarchy / department / all) → `visible_leads(user)`. A lead outside the
scope is a **404** everywhere (lead, profile, documents, interview, payment, letters). Students use the `student`
role and only `/api/student/…`, always resolved from `request.user.application`.

---

## 2. Entities

### Existing, reused
- `leads.Lead` (contact fields, source, UTM, `assigned_to`, `stage`) — **new columns**: `program`, `application`
  (1-1 → `students.Application`), `next_follow_up_at`, `lost_reason`, `lost_reason_detail`.
- `leads.LeadStage` — the 22 flow stages are seeded; codes are slug style (`documents-pending`); the specification's
  `DOCUMENTS_PENDING` names map 1:1 (`leads.workflow.Stage`). Flow stages cannot be deleted or re-coded.
- `leads.LeadActivity` — the timeline; **new columns** `from_stage`, `to_stage`; `changes` holds the metadata;
  `type` extended with every event of the flow (see §7).
- `users.User` / roles / data scopes / audit / configuration.

### New
| Model | Key fields | Rules |
|---|---|---|
| `students.Application` | `application_id` (unique, `NFET-2026-096370` style, prefix configurable), `user` (student login), personal / academic / guardian / program fields **with the existing names** (`first_name`, `tenth_passing_year`, `employement_status`, `guardian_dropdown`, …), legacy document columns (`aadhaar`, `photo`, …) mirroring the latest upload, `profile_status`, `status`, `profile_completed_by/at`, `approved_by/at`, `document_email_sent_at` | created with the lead (from its contact data); never duplicated |
| `students.ApplicationDocument` | `application`, `document_type` (aadhaar, dob_certificate, photo, signature, resume, tenth_marksheet, twelveth_marksheet, graduation_marksheet, other), `file` (private), `status` SUBMITTED / APPROVED / REJECTED, `is_current`, `uploaded_by/at`, `reviewed_by/at`, `rejection_reason` | one current row per type (DB constraint); re-uploads keep history |
| `leads.LeadAssignment` | `lead`, `counsellor`, `assignment_type` ROUND_ROBIN / MANUAL / UNASSIGNED, `assigned_by`, `assigned_at`, `note` | never deleted |
| `leads.RoundRobinPointer` | pk 1, `last_user` | locked during assignment |
| `leads.CallLog` | `lead`, `counsellor`, `called_at`, `outcome`, `reason`, `reason_detail`, `notes`, `follow_up` | |
| `leads.FollowUp` | `lead`, `counsellor`, `follow_up_date`, `follow_up_time`, `notes`, `status` PENDING / COMPLETED / MISSED / CANCELLED, `outcome`, `completed_at` | `Lead.next_follow_up_at` is kept in sync |
| `interviews.Interview` | `lead`, `application`, `counsellor`, `interviewer`, `scheduled_date`, `start_time`, `end_time`, `mode`, `meeting_link`, `location`, `status` SCHEDULED / COMPLETED / NO_SHOW / CANCELLED / RESCHEDULED, `result` PENDING / SELECTED / NOT_SELECTED, `result_by/at` | end > start (DB check); no overlapping open interview for the same counsellor / interviewer |
| `payments.Payment` | `uid`, `lead`, `application`, `amount`, `currency`, `method` ONLINE / OFFLINE, `status` PENDING / SUCCESS / FAILED / OFFLINE_PENDING / VERIFIED / REJECTED, gateway ids + signature + response, `payment_mode`, `transaction_id`, `payment_date`, `proof` (private), `created_by`, `paid_at`, `verified_by/at` | amount = config `payments.seat_reservation_amount` |
| `letters.Letter` | `uid`, `lead`, `application`, `payment`, `letter_type` PRE_PLACEMENT_OFFER / PROVISIONAL_ADMISSION, `letter_number`, `file` (private PDF), `is_current`, `generated_by/at` | one current per type; regeneration keeps history |

Migrations: `students/0001`, `interviews/0001`, `payments/0001`, `letters/0001`, `leads/0003_admission_flow`,
`leads/0004_seed_admission_flow` (stages, modules `students` / `interviews` / `payments` with the role matrix,
`student` role, pointer row, configuration keys). All additive.

---

## 3. Stages and transitions

| From | Action (endpoint) | To |
|---|---|---|
| new | assign (create lead / `auto-assign` / `assign`) | assigned |
| assigned, calling, follow-up | `POST call/start` | calling (follow-up stays) |
| assigned, calling, follow-up | `POST call` outcome NOT_INTERESTED | not-interested (end) |
| assigned, calling, follow-up | `POST call` outcome NOT_ELIGIBLE (+ reason) | not-eligible (end) |
| assigned, calling, follow-up | `POST call` outcome FOLLOW_UP (+ date, time) | follow-up |
| follow-up | `POST call` outcome INTERESTED / `POST mark-interested` | interested |
| interested | `POST complete-profile` (required fields filled) | profile-completed |
| profile-completed, documents-pending | `POST send-document-email` | documents-pending |
| documents-pending, documents-review | student upload of the last required document | documents-submitted |
| documents-submitted / documents-review | document APPROVED | documents-review |
| documents-submitted / documents-review | document REJECTED | documents-pending |
| documents-submitted, documents-review | `POST approve-profile` | profile-approved |
| profile-approved | `POST interview` | interview-scheduled |
| interview-scheduled | `POST interview` again (reschedule) | interview-scheduled |
| interview-scheduled | `PATCH interviews/<id>/status` CANCELLED / NO_SHOW | profile-approved |
| interview-scheduled | `PATCH interviews/<id>/status` COMPLETED | interview-completed |
| interview-completed | `PATCH interviews/<id>/result` SELECTED | selected → payment-pending |
| interview-completed | `PATCH interviews/<id>/result` NOT_SELECTED | not-selected (end) |
| payment-pending | `POST payment` (online order) | payment-pending |
| payment-pending | online verified / webhook captured | payment-success → letters |
| payment-pending | online failed | payment-pending |
| payment-pending | `POST offline-payment` | offline-payment-pending |
| offline-payment-pending | `POST payments/<uid>/verify` approve | offline-payment-verified → letters |
| offline-payment-pending | `POST payments/<uid>/verify` reject | payment-pending |
| payment-success / offline-payment-verified | letters generated | pre-placement-offer-generated → provisional-admission-generated |

Anything else → `400 {"stage": ["This action is not allowed for the current lead stage."]}`.
`GET /api/leads/<uid>/` returns `available_actions` (stage × caller permissions) so the UI never shows invalid buttons:

| stage | available_actions |
|---|---|
| new (unassigned) | assign |
| assigned | start_call, call_outcome |
| calling | call_outcome |
| follow-up | start_call, call_outcome, follow_up, mark_interested |
| interested | update_profile, complete_profile |
| profile-completed | update_profile, send_document_email |
| documents-pending | update_profile, send_document_email, review_documents |
| documents-submitted / documents-review | update_profile, review_documents, approve_profile |
| profile-approved | schedule_interview |
| interview-scheduled | reschedule_interview, cancel_interview, complete_interview, interview_result |
| interview-completed | interview_result |
| selected / payment-pending | initiate_payment, record_offline_payment |
| offline-payment-pending | verify_offline_payment |
| payment-success / offline-payment-verified | generate_letters |
| *-generated | view_letters, generate_letters |
| not-interested / not-eligible / not-selected | (none) |

---

## 4. Permissions (seeded)

| Module → action | Admin | Manager | Team Leader | Counsellor | Finance | Student |
|---|---|---|---|---|---|---|
| leads (call, follow-up, interested, letters) | all / all | all / team_tree | v,a,c,e / team | v,a,c / own | view / all | – |
| leads-assign (manual / auto assign) | ✓ | ✓ | ✓ | – | – | – |
| students: view, change (profile, email), approve (review docs, approve profile) | all | v,c,approve / team_tree | v,c,approve / team | v,c,approve / own | view | – |
| interviews: view, add (schedule), change (status), approve (result) | all | v,a,c,approve | v,a,c,approve | v,a,c,approve / own | – | – |
| payments: view, add (online / offline), approve (verify offline) | all | v,a,c | v,a,c | v,a,c / own | v,a,c,approve,export / all | – |
| `/api/student/…` | – | – | – | – | – | own application only |

Super Admin: everything. The student role has no module permissions, so every CRM endpoint answers 403.

---

## 5. API reference

All responses use the standard envelope `{success, message, status, data}` (+ `pagination` on lists).
Auth: `Authorization: Bearer <access_token>`. Errors: 400 validation / stage rule, 401, 403 permission,
404 not found or outside scope, 409 conflict, 502 email / gateway error, 503 online gateway not configured.

### 5.1 Leads (`/api/leads/`, module `leads`)

| Method | URL | Body / query | Response `data` |
|---|---|---|---|
| GET | `/api/leads/` | `stage=<code>[,code]`, `assigned_to=<uid>\|me`, `unassigned=true`, `search` (name, phone, email, application id), `program`, `source`, `created_from/to`, `follow_up_from/to`, `page`, `page_size` | rows: `uid, application_id, full_name, phone (masked), email, city, program, source, stage{id,code,name,kind,color}, assigned_to{uid,name,email}, next_follow_up_at, created_at` |
| POST | `/api/leads/` | `first_name*, last_name, phone*, email, city, state, country, program, source, remarks, utm_*` (+ optional `assigned_to` uid) | lead detail; stage `assigned` (round robin) or `new` with message "No active counsellor available. Lead has been kept unassigned" |
| GET | `/api/leads/<uid>/` | | lead detail: contact + `application{id, application_id, full_name, profile_status, status, document_email_sent_at, initial_program}`, `stage`, `assigned_to`, `next_follow_up_at`, `lost_reason`, `available_actions[]`, `pending_follow_up`, `interview`, `payment`, `letters[]` |
| PATCH | `/api/leads/<uid>/` | contact fields (not `stage` / `assigned_to`) | lead detail |
| GET | `/api/leads/workflow/` | | `stages[]` (with actions), `call_outcomes`, `not_eligible_reasons`, `follow_up_statuses`, `action_permissions` |
| PATCH | `/api/leads/<uid>/assign/` | `{assigned_to: uid\|null, note}` (leads-assign) | lead detail |
| POST | `/api/leads/<uid>/auto-assign/` | (leads-assign) | lead detail or 400 no active counsellor |
| GET | `/api/leads/<uid>/assignments/` | | `[{counsellor, assignment_type, assigned_by, note, assigned_at}]` newest first |
| POST | `/api/leads/<uid>/call/start/` | | lead detail (stage `calling`) |
| POST | `/api/leads/<uid>/call/` | `{outcome: NOT_INTERESTED\|FOLLOW_UP\|NOT_ELIGIBLE\|INTERESTED, notes, reason (qualification\|age\|program\|other), reason_detail, follow_up_date, follow_up_time, called_at}` | `{call{…}, lead{…}}` |
| GET | `/api/leads/<uid>/call/` | | call history |
| GET / POST | `/api/leads/<uid>/follow-ups/` | POST `{follow_up_date*, follow_up_time*, notes}` (lead in follow-up) | follow-up rows |
| POST | `/api/leads/<uid>/mark-interested/` | `{notes}` | lead detail (stage `interested`) |
| GET | `/api/leads/follow-ups/` | `scope=today\|upcoming\|overdue\|completed\|all`, `status`, `counsellor=<uid>\|me`, `date_from/to` | `[{id, lead{uid, full_name, application_id, stage}, counsellor, follow_up_date, follow_up_time, notes, status, outcome, is_overdue, completed_at}]` |
| PATCH | `/api/leads/follow-ups/<id>/` | `{status: COMPLETED\|MISSED\|CANCELLED, outcome, notes}` | follow-up |
| PATCH | `/api/leads/<uid>/stage/` | `{stage: <code>, remark}` — **Super Admin only** | lead detail |
| GET | `/api/leads/<uid>/activities/` | `type=` | timeline `[{type, type_display, from_stage, to_stage, from_value, to_value, note, changes (metadata), actor, created_at}]` |

Validation on `POST call/`: NOT_ELIGIBLE needs `reason` ("Reason is required."), `other` needs `reason_detail`;
FOLLOW_UP needs `follow_up_date` (today or later) and `follow_up_time`; INTERESTED only from `follow-up`.

### 5.2 Profile and documents, CRM side (module `students`)

| Method | URL | Body | Response `data` |
|---|---|---|---|
| GET | `/api/leads/<uid>/profile/` | | `{application{…all existing fields…}, missing_fields[], documents[] (checklist), approval_problems{missing_fields, pending_documents, rejected_documents, unreviewed_documents}}` |
| PATCH | `/api/leads/<uid>/profile/` | any editable application field (see `students/services.py::PROFILE_AUDIT_FIELDS`); allowed from `interested` to `documents-review` | same payload |
| POST | `/api/leads/<uid>/complete-profile/` | | same payload + `lead`; 400 `"Please complete required student profile fields."` with `missing_fields` |
| POST | `/api/leads/<uid>/send-document-email/` | | `{application, document_email_sent_at, lead}`; 502 `"Unable to send document upload email."` (retry allowed) |
| GET | `/api/leads/<uid>/documents/` | `history=true` | `{documents[] checklist, approval_problems, history[]}` |
| POST | `/api/leads/<uid>/approve-profile/` | (students:approve) | payload + `lead`; 400 with the exact blocking requirement |
| GET | `/api/students/documents/pending-review/` | `search`, `document_type` | submitted documents of visible leads |
| PATCH | `/api/students/documents/<id>/review/` | `{status: APPROVED\|REJECTED, rejection_reason}` (reason mandatory on reject) | document |
| GET | `/api/students/documents/<id>/download/` | | the file (authorised CRM users) |
| GET | `/api/students/` | `search, stage, profile_status, status` | applications of visible leads |
| GET | `/api/students/<application_id>/` | | profile payload + `lead` |

Checklist row: `{document_type, label, required, status (PENDING\|SUBMITTED\|APPROVED\|REJECTED), document{id, status, original_name, size, uploaded_at, reviewed_at, rejection_reason, download_url} | null}`.

Profile validation: phone fields 7–15 digits; percentages 0–100; years 4 digits; pincode 4–10 digits;
`guardian_dropdown = OTHER` needs `guardian_other_reason`; email cannot change after the portal login exists.
Required fields and required document types come from configuration (`students.required_profile_fields`,
`students.required_documents`). Uploads: PDF / JPG / PNG, ≤ `students.max_document_size_mb`.

### 5.3 Student portal (`/api/student/`, role `student`)

| Method | URL | Body | Response `data` |
|---|---|---|---|
| GET / PATCH | `/api/student/me/` | PATCH: contact / guardian fields only | `{application, stage{code,name}, next_step, documents{required, approved, rejected, pending}}` |
| GET | `/api/student/documents/` | | checklist |
| POST | `/api/student/documents/` | multipart `document_type, file` | document (201). Re-upload allowed unless the document is approved |
| GET | `/api/student/documents/<id>/download/` | | own file |
| GET | `/api/student/interview/` | | `{scheduled_date, start_time, end_time, mode, meeting_link, location, status, result}` or null |
| GET | `/api/student/payment/` | | `{amount, currency, stage, payment_open, settled, payments[]}` |
| POST | `/api/student/payment/` | | `{payment, checkout}` (gateway checkout payload) |
| POST | `/api/student/payment/verify/` | `{order_id, payment_id, signature, payment_uid?}` | payment; 400 `"Payment failed. Please try again."` |
| GET | `/api/student/letters/` | | `[{uid, letter_type, label, letter_number, generated_at, download_url}]` |
| GET | `/api/student/letters/<uid>/download/` | | PDF |

Login: the document email contains `<students.portal_url>/set-password?uid=…&token=…`; the portal calls the existing
`POST /api/auth/reset-password/` with `uid, token, new_password, confirm_password`, then `POST /api/auth/login/`.
No password is ever mailed or stored in clear.

### 5.4 Interviews (module `interviews`)

| Method | URL | Body | Response `data` |
|---|---|---|---|
| GET | `/api/leads/<uid>/interview/` | | `{interview, history[]}` |
| POST | `/api/leads/<uid>/interview/` | `{scheduled_date*, start_time*, end_time (default +interviews.default_duration_minutes), interviewer (uid), mode online\|in_person\|phone, meeting_link, location, notes}` | `{interview, lead}` (201); 400 on past date, end ≤ start, or clash `"Clashes with the interview of …"` |
| GET | `/api/interviews/` | `date_from, date_to, status, result, counsellor=<uid>\|me, interviewer, search, view=list\|calendar` | rows, or `[{date, interviews[]}]` for the calendar |
| GET | `/api/interviews/<id>/` | | interview |
| PATCH | `/api/interviews/<id>/status/` | `{status: COMPLETED\|NO_SHOW\|CANCELLED, notes}` | interview |
| PATCH | `/api/interviews/<id>/result/` | `{result: SELECTED\|NOT_SELECTED, notes}` (interviews:approve) | `{interview, lead}` — SELECTED moves the lead to `payment-pending` |
| GET | `/api/interviews/interviewers/` | `search` | users who may record a result |

### 5.5 Payments (module `payments`)

| Method | URL | Body | Response `data` |
|---|---|---|---|
| GET | `/api/payments/gateway/` | | `{gateway, online_available, amount, currency, reason?}` |
| GET | `/api/leads/<uid>/payment/` | | `{amount, currency, settled, payments[]}` |
| POST | `/api/leads/<uid>/payment/` | | `{payment, checkout, lead}` (201). Razorpay checkout: `{gateway, key, order_id, amount (paise), currency, name, description, prefill}` |
| POST | `/api/leads/<uid>/payment/verify/` | `{order_id, payment_id, signature, payment_uid?}` | `{payment, lead}`; failure → payment FAILED, lead stays `payment-pending`, 400 |
| POST | `/api/leads/<uid>/offline-payment/` | multipart `payment_mode* (cash, cheque, dd, neft, rtgs, imps, upi, card, other), payment_date*, transaction_id, amount (must equal the configured amount), proof, notes` | `{payment, lead}` (201), lead `offline-payment-pending` |
| POST | `/api/payments/<uid>/verify/` | `{approve: true\|false, notes}` (payments:approve) | `{payment, lead}` |
| GET | `/api/payments/` | `status, method, search, date_from, date_to` | rows |
| GET | `/api/payments/<uid>/` · `/proof/` | | payment / proof file |
| POST | `/api/payments/webhook/razorpay/` | Razorpay event body, header `X-Razorpay-Signature` | idempotent settlement |

Payment row: `{uid, lead{uid, full_name, application_id, stage}, purpose, amount, currency, method, status, gateway,
gateway_order_id, gateway_payment_id, failure_reason, payment_mode, transaction_id, payment_date, proof_url, notes,
created_by, created_at, paid_at, verified_by, verified_at}`.

Gateway selection: configuration `payments.gateway` = `razorpay` (env `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
`RAZORPAY_WEBHOOK_SECRET`) or `sandbox` (signature `sandbox-success` = paid). Without keys the API answers 503
`"Online payment is not configured…"`; offline payment still works.

### 5.6 Letters

| Method | URL | Notes |
|---|---|---|
| GET | `/api/leads/<uid>/letters/` (`history=true`) | current letters |
| POST | `/api/leads/<uid>/letters/` or `/generate-letters/` | (re)generate both; 400 `"Letters can only be generated after a successful or verified payment."` |
| GET | `/api/letters/<uid>/download/` | PDF, authorised CRM users |

Letters are generated automatically on settlement (online SUCCESS / offline VERIFIED) from
`letters/templates/letters/pre_placement_offer.html` and `provisional_admission.html` with the application's real data
and the `institution.*` configuration keys. If generation fails the payment stays settled and letters can be
regenerated.

---

## 6. Configuration keys (all editable at `/api/access/configurations/`)

| key | default | used by |
|---|---|---|
| `payments.seat_reservation_amount` | 11800 | amount of every payment |
| `payments.currency` | INR | |
| `payments.gateway` | razorpay | razorpay \| sandbox |
| `leads.round_robin_roles` | ["counsellor"] | who receives leads |
| `students.application_id_prefix` | NFET | application id format |
| `students.required_profile_fields` | 18 fields | complete-profile / approve-profile |
| `students.required_documents` | aadhaar, dob_certificate, photo, signature, tenth_marksheet, twelveth_marksheet | checklist / approval |
| `students.max_document_size_mb` | 5 | uploads |
| `students.portal_url` | http://127.0.0.1:3000/student | document email link |
| `interviews.default_duration_minutes` | 90 | schedule without end time |
| `letters.validity_days` | 15 | offer letter |
| `institution.name / address / email / phone / website / signatory_name / signatory_title` | GCC School … | letters |

---

## 7. Timeline events (`LeadActivity.type`)

`created`, `assigned`, `unassigned`, `call_started`, `call_completed`, `follow_up_created`, `follow_up_completed`,
`follow_up_cancelled`, `lead_not_interested`, `lead_not_eligible`, `lead_marked_interested`, `profile_updated`,
`profile_completed`, `document_email_sent`, `document_email_failed`, `document_uploaded`, `document_approved`,
`document_rejected`, `profile_approved`, `interview_scheduled`, `interview_rescheduled`, `interview_completed`,
`interview_cancelled`, `student_selected`, `student_not_selected`, `payment_initiated`, `payment_success`,
`payment_failed`, `offline_payment_recorded`, `offline_payment_verified`, `offline_payment_rejected`,
`pre_placement_offer_generated`, `provisional_admission_generated`, `stage_overridden`.
Each row carries `actor`, `created_at`, `from_stage`, `to_stage`, `note` and `changes` (metadata such as
`document_type`, `rejection_reason`, `interview_id`, `payment_id`, `letter_number`).
Security-relevant actions are also in the audit log (`/api/access/audit-logs/?module=students|interviews|payments|leads`).

---

## 8. Error messages required by the specification

| Situation | HTTP | message |
|---|---|---|
| No active counsellor | 201 (lead kept `new`) / 400 on auto-assign | "No active counsellor available. Lead has been kept unassigned." |
| Not eligible without reason | 400 | "Reason is required." |
| Missing profile data | 400 | "Please complete required student profile fields." (+ `missing_fields`) |
| Missing / unreviewed documents | 400 | "Required documents are pending." (+ `pending_documents`, `unreviewed_documents`) |
| Rejected documents | 400 | "Profile cannot be approved because required documents are rejected." |
| Email failure | 502 | "Unable to send document upload email." |
| Payment failure | 400 | "Payment failed. Please try again." |
| Invalid stage transition | 400 | "This action is not allowed for the current lead stage." |

---

## 9. Backward compatibility and operations

- Existing lead APIs keep their URLs and fields; new keys were added (`application_id`, `program`,
  `next_follow_up_at`, `available_actions`, …). `POST /api/leads/` now also creates the Application and
  round-robins the lead; `PATCH /api/leads/<uid>/stage/` is Super Admin only (it was open to `leads:change`).
- Existing stages `contacted`, `converted`, `lost` stay (sorted last); `new` remains the default.
- New settings: `PRIVATE_MEDIA_ROOT` (default `<project>/private_media`, set it on the server and back it up),
  `RAZORPAY_*` env vars. New requirements: `xhtml2pdf`, `razorpay`.
- Tests: `USE_SQLITE=1 python manage.py test` (164 tests). Round-robin concurrency relies on the row lock, which
  PostgreSQL enforces (SQLite ignores `FOR UPDATE`).
- Not built on purpose: frontend screens (APIs only, per decision), loans, NFET, consultant leads, WhatsApp / SMS,
  dialer integration (click-to-call is the `call/start` marker), reminders / notifications, analytics.
