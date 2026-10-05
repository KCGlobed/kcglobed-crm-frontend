# GCC School / KC GlobEd — In-house CRM & ATP Portal

**Source of truth:** `CRM & ATP Portal SOW Final V1.xlsx` (v1.0, September 2026)
**This document:** requirement breakdown, module map, roles & permission model, data model, API surface, frontend page list, and build order — Steps 1–3 of the agreed implementation process.

---

## 1. What the SOW says (summary)

- **227 features across 15 modules**, split into 3 phases:
  - **Phase 1 — Run the journey** (129 features: 114 Must, 15 Should): run the agreed lead-to-interview journey end-to-end for real candidates. Exit: go-live on one intake cycle.
  - **Phase 2 — Automate & scale** (78): campaigns/attribution, communication suite + automation rule builder, dialer, lead scoring/SLA, education loans, advanced payments, document manager, support desk, manager dashboards.
  - **Phase 3 — Optimise** (20): predictive scoring, remarketing, ROI/MEI, real-time & scheduled reports, WhatsApp bot, mobile CRM.
- **Access model is the differentiator:** roles are **not hard-coded**. Super admin creates a user and ticks modules → actions → data scope → field visibility. Templates (Counsellor, Team Leader, Marketing, Finance, Support, Interviewer) are just **saved tick-sets**.
- **Two candidate tracks** (Candidate Journey sheet): **paid-ads track** (long ~17-section application, no NFET initially) and **channel-partner track** (short form → NFET fee → Aon exam → score + counsellor review). Both converge on the candidate dashboard, then round-robin counsellor assignment → counselling → interview → offer → token payment → admission.
- **Student Panel** is a first-class product: 30 features (registration, OTP login, dashboard, multi-step application with save/resume, documents, exam slot booking, offer acceptance, payments with retry/receipts, timeline, notifications).

### Known gaps in the workbook (flagged, not blocking)

- Requirements tab holds feature IDs **1–227**; the Read Me mentions 270 + 10 `NEW-xx` features, and the Candidate Journey references IDs 251–259 and NEW-01…NEW-10 that are **absent from the tab**. The NEW items are described in prose on *Roles & Access* (plug-and-play permission builder) and *Student Panel* (ID 254, candidate dashboard) — both are covered by this architecture.
- The Summary tab's by-module formula is broken (totals 115 ≠ 227). Ignored; the Requirements tab rows are authoritative.
- *Open Questions* Q-01…Q-13 (gateway, dialer, Aon integration mode, exact stage list, masking fields, BSP, retention) remain open — assumptions below in §9.

---

## 2. Module map (what we build, by phase)

| # | Module | P1 | P2 | P3 | Phase-1 core |
|---|--------|----|----|----|--------------|
| 1 | Admin & User Management (IDs 1–9) | 8 | 1 | 0 | Users, teams/hierarchy, custom permission builder, templates, audit log, config management, data masking |
| 2 | Lead Management (10–32) | 19 | 4 | 0 | Multi-source capture API, quick add, bulk CSV/XLSX upload with mapping+error report, duplicate blocking, custom fields, source/UTM/referral tracking, Meta & Google connectors (webhook endpoints), 360 profile, timeline, notes, tags, search, export |
| 3 | Marketing & Acquisition (33–50) | 6 | 8 | 4 | Source master, channel classification, first-touch attribution, UTM-to-lead mapping, landing-page attribution |
| 4 | Communication (51–70) | 9 | 9 | 2 | Email send + templates + personalisation merge-fields, SMS/WhatsApp templates, one-to-one WhatsApp (deep-link), communication history on timeline, consent/opt-out |
| 5 | Counsellor & Sales (71–101) | 14 | 14 | 3 | Round-robin distribution, work queue, ownership, reassignment, click-to-call, call disposition, callbacks, conversation notes, tasks & follow-ups, reminders, overdue queue, real-time notifications, 1:1 email/WhatsApp |
| 6 | Application & Student Journey (102–118) | 14 | 3 | 0 | Registration, email verification, OTP login, application-number login, student dashboard, progress tracker, multi-step form, save & resume, declaration & submit, document upload + verification, status, timeline, notifications centre, profile update |
| 7 | Program & Eligibility (119–125) | 5 | 2 | 0 | Program master, program interest, cohort management, eligibility rules, eligibility verification |
| 8 | Examination / NFET / Aon (126–137) | 9 | 3 | 0 | NFET payment gate, exam integration (adapter + manual fallback), slot booking, admit card, completion status, real-time result capture, scorecard, score thresholds, manual override |
| 9 | Interview & Selection (138–146) | 8 | 0 | 1 | Scheduling, slot management, reminders, attendance, evaluation (ratings + parameters), shortlist/reject/hold, selection status + reason |
| 10 | Offer & Admission (147–154) | 6 | 2 | 0 | Shortlisted status, offer milestones (issued/accepted/rejected/expired), online acceptance, dynamic token enablement, candidate-specific amount, offer communication |
| 11 | Payment Management (155–171) | 11 | 5 | 1 | Gateway integration (adapter; Razorpay-style), application/NFET/token fees as separate transactions, dynamic enablement by stage, reconciliation, retry, automated receipt, payment communications, payment dashboard |
| 12 | Education Loan (172–182) | 0 | 10 | 1 | — (Phase 2) |
| 13 | Automation & Nurturing (183–198) | 5 | 9 | 2 | Event triggers for: application submitted, shortlisted, interview, payment pending, payment completed (template-driven) |
| 14 | Notifications (199–208) | 9 | 1 | 0 | In-app notification centre + events: new lead, reassignment, task due, overdue, payment, application, interview, exam, admin alerts |
| 15 | Reports & Analytics (209–227) | 8 | 9 | 2 | Lead funnel, follow-up, application, exam, interview, payment, admission reports + Excel/CSV export |

**Phase-1 cross-cutting:** JWT auth + refresh, session & audit logging, permission enforcement middleware, masters admin, file storage for documents, seed data.

---

## 3. Roles & permissions (plug-and-play model)

Permissions are stored **per user**, not per role. A "role" is a **template** that pre-fills the ticks.

```
User ──< UserModuleAccess (module, canView, canCreate, canEdit, canDelete,
          canExport, canReassign, canApprove)
User ──  dataScope: OWN | TEAM | LOCATION | PROGRAM | COHORT | ALL
User ──< UserFieldRule (field, HIDDEN | READ_ONLY)   ← data masking
PermissionTemplate (seeded: Super Admin, Admissions Admin, Team Leader,
  Counsellor, Marketing, Finance, Interviewer, Support) ──< same structure
```

- Sidebar/menu renders **only ticked modules** (hidden, not greyed).
- Backend middleware `requirePermission(module, action)` + `scopeFilter(user)` on every query — frontend checks are cosmetic only.
- Default template matrix is seeded exactly from the *Roles & Access* sheet (e.g. Counsellor: leads = Own, add only; payments = own, masked; no export).
- Every permission change is written to the audit log.
- **Students are a separate principal** (candidate auth: OTP / application number), never CRM users.

---

## 4. Data model (core entities)

**Identity & access:** `User`, `Team` (hierarchy, reporting manager), `PermissionTemplate`, `UserModuleAccess`, `UserFieldRule`, `Session`, `AuditLog`, `OtpToken`

**Masters:** `Source` (+ channel enum: Paid/Organic/Referral/Partner/Direct/Other), `Campaign`, `Program`, `Cohort` (capacity, dates), `Stage` (ordered, configurable), `Disposition`, `Tag`, `CustomFieldDef` + `CustomFieldValue`, `MessageTemplate` (email/SMS/WhatsApp, merge fields), `FeeType`, `EligibilityRule`, `LoanPartner` (P2)

**Lead core:** `Lead` (owner, stage, status, firstSource, latestSource, UTM set, referral/partner fields, program interest, cohort, score, consent flags, duplicate-of) with unique indexes on normalised mobile/email; `LeadActivity` (polymorphic timeline: call, note, task, stage change, communication, payment, document, system), `Note`, `LeadTag`, `Task` (type: call/meeting/document/payment/interview/callback; due, status), `CallLog` (disposition, next action), `AssignmentLog`, `RoundRobinPointer`

**Candidate journey:** `StudentAccount` (1:1 Lead), `Application` (program, cohort, track: ADS|PARTNER, status, currentStep, declaration), `ApplicationSection` (JSON per step — supports configurable multi-step forms & save/resume), `Document` (type, file, status: pending/verified/rejected/reupload, verifier, reason), `ExamAttempt` (status, slot, score, admit card ref), `ExamSlot`, `Interview` (slot, panel, attendance, decision), `InterviewSlot`, `InterviewEvaluation` (parameter ratings + comments), `Offer` (status, expiry, amount override), `Payment` (feeType, stage-gated, gateway ref, status, amount), `Receipt`

**Comms & system:** `CommunicationLog` (channel, template, to, status), `Notification` (in-app, read state), `ConsentRecord`, `AutomationRule` + `AutomationLog` (P2 — P1 ships fixed triggers)

**Indexing:** normalised mobile/email (unique, duplicate blocking), leads(owner, stage, status, createdAt, source), tasks(assignee, dueAt, status), activities(leadId, createdAt), payments(status, feeType), full-text-ish search on name/mobile/email/leadNo/applicationNo.

---

## 5. API surface (v1, all under `/api/v1`)

Standard list contract everywhere: `?page&page_size&search&sort_by&sort_order&<filters>` → `{ success, message, status, data, pagination }`.

| Group | Endpoints (abridged) |
|-------|---------------------|
| Auth | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`, `GET /auth/me` (incl. permissions) |
| Users & access | CRUD `/users`, `POST /users/:id/permissions`, `GET/POST /permission-templates`, CRUD `/teams`, `GET /audit-logs`, `GET /sessions` |
| Masters | CRUD `/sources`, `/campaigns`, `/programs`, `/cohorts`, `/stages`, `/dispositions`, `/tags`, `/custom-fields`, `/templates`, `/fee-types`, `/eligibility-rules` |
| Leads | CRUD `/leads`, `POST /leads/bulk-upload` (+mapping, error report), `POST /leads/capture` (public, API-key: website/landing/connector), `POST /webhooks/meta-leads`, `POST /webhooks/google-leads`, `POST /leads/:id/assign`, `/leads/bulk` (P2), `GET /leads/:id/timeline`, `POST /leads/:id/notes`, `/leads/:id/tags`, `GET /leads/export`, `POST /leads/check-duplicate` |
| Counsellor ops | `GET /work-queue`, CRUD `/tasks`, `GET /tasks/overdue`, `POST /calls` (disposition), `POST /communications/send` (email/WhatsApp/SMS), `GET /leads/:id/communications` |
| Applications | `GET /applications`, `GET/PUT /applications/:id`, `PATCH /applications/:id/sections/:step`, `POST /applications/:id/submit`, documents: `POST /applications/:id/documents`, `PATCH /documents/:id/verify` |
| Student (candidate auth) | `POST /student/register`, `/student/verify-email`, `/student/otp/request`, `/student/otp/verify`, `/student/login/application-number`, `GET /student/dashboard`, `GET/PATCH /student/application`, `/student/documents`, `/student/exam/slots`, `POST /student/exam/book`, `GET /student/exam/admit-card`, `GET /student/offer`, `POST /student/offer/accept`, `GET /student/payments`, `POST /student/payments/initiate`, `/retry`, `GET /student/receipts/:id`, `/student/timeline`, `/student/notifications`, `PATCH /student/profile` |
| Exam | `GET /exam-attempts`, `POST /exam-attempts/:id/result` (integration/manual), `GET /exam-slots` CRUD, `POST /exam/reconciliation` (P2) |
| Interviews | CRUD `/interview-slots`, `/interviews`, `PATCH /interviews/:id/attendance`, `POST /interviews/:id/evaluation`, `PATCH /interviews/:id/decision` |
| Offers & payments | CRUD `/offers`, `PATCH /offers/:id/status`, `POST /payments/initiate`, `POST /webhooks/payment-gateway`, `GET /payments`, `/payments/dashboard`, `/payments/:id/receipt`, `POST /payments/reconcile` |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` |
| Reports | `GET /reports/lead-funnel`, `/reports/follow-ups`, `/reports/applications`, `/reports/exams`, `/reports/interviews`, `/reports/payments`, `/reports/admissions`, each `?format=csv|xlsx` for export; `GET /dashboard/summary` |

Gateway, Aon exam, Meta/Google connectors, WhatsApp/SMS/email providers are all **adapter interfaces** with a sandbox/manual implementation first (Open Questions Q-03/04/05/09), so the journey runs end-to-end now and real credentials plug in later without refactoring.

---

## 6. Frontend (single React app, two shells)

```
/login, /forgot-password …                 → public (staff)
/app/**        Staff CRM shell             → sidebar driven by UserModuleAccess
/portal/**     Student panel shell         → candidate auth (OTP / app-number)
```

**Staff pages:** Dashboard · Leads (list + saved filters + bulk upload wizard + export) · Lead 360 (header actions: call/WhatsApp/email/task; tabs: overview, timeline, notes, tasks, application, documents, exam, interview, offer, payments) · Work Queue · Tasks & Overdue · Applications + Document verification queue · Exams (slots, attempts, result entry) · Interviews (slots, calendar, evaluation) · Offers · Payments dashboard + transactions · Reports (7 reports + export) · Notifications · Admin: Users (permission builder with "preview as user"), Teams, Masters (programs, cohorts, sources, campaigns, stages, dispositions, tags, templates, custom fields, fee types, eligibility rules), Audit log · Profile/settings.

**Student pages:** Register/Verify → OTP login → Dashboard (status, progress tracker, pending actions) → Application (multi-step, save & resume, declaration) → Documents → Exam (fee, slot booking, admit card, score) → Interview → Offer (accept) → Payments (pay/retry/receipts) → Timeline → Notifications → Profile.

**Stack:** React 19 + TypeScript + Vite, Redux Toolkit (+ RTK Query for the API layer — gives caching, invalidation, loading/error isolation per endpoint), React Router v7, Tailwind CSS v4, React Hook Form + Zod resolvers, headless UI primitives; shared `DataTable` (server-driven search/sort/pagination/filters/column visibility), `FormDrawer`, `ConfirmDialog`, toasts, skeletons, empty/error states with retry. Route-level code splitting; permission-gated nav/actions.

**Backend stack:** Node + TypeScript + Express, layered `routes → controllers → services → repositories`, Zod validation, centralized error handler (safe messages out, Winston logs in), helmet/CORS/rate-limit, bcrypt, JWT access (short) + rotating refresh (httpOnly cookie), multer uploads with type/size validation, audit middleware. **ORM/DB: see decision below.**

---

## 7. Build order (maps to SOW weekly plan & process steps 4–18)

1. **Foundation** — backend scaffold, config, error handling, logging, auth (login/refresh/forgot/reset/change), sessions, audit log.
2. **Access** — users, teams/hierarchy, permission templates + per-user builder, enforcement middleware, data-scope filters, field masking.
3. **Masters** — all master CRUD + seeds (stages, dispositions, sources, channels, programs, cohorts, templates, fee types, tags, custom fields, eligibility rules).
4. **Leads** — capture (public API + webhooks), quick add, bulk upload, duplicate blocking, list (search/sort/filter/pagination/export), 360 profile, timeline, notes, tags.
5. **Counsellor ops** — round-robin, work queue, reassignment, tasks/follow-ups/callbacks, call dispositions, overdue queue, notifications.
6. **Student panel + applications** — registration/verification/OTP, dashboard, multi-step form with save & resume, declaration/submit, documents upload + verification.
7. **Exam** — NFET payment gate, slots, booking, admit card, result capture (manual + adapter), thresholds, override.
8. **Interview → Offer → Payments** — slots, scheduling, evaluation, decisions; offer lifecycle + acceptance; gateway adapter, three fee stages, retry, receipts, reconciliation, payment dashboard.
9. **Communication + fixed triggers** — templates, merge fields, send + log, consent; the five Phase-1 automated triggers.
10. **Reports & dashboards** — 7 Phase-1 reports + exports + role dashboards.
11. **Hardening** — permission tests, API error tests, E2E of both candidate tracks, TS/lint clean, production builds, README + API docs.

Each slice ships backend + frontend + seeds together so the app is demoable at every step.

---

## 8. Error handling & data-safety contract (SOW §6/§16)

- RTK Query isolates every endpoint's loading/error state — a failed `POST /leads` leaves the list cache intact; forms keep values and offer retry; list failures render an in-panel error state with retry, never a blank app.
- Global error boundary per route-shell; layout/sidebar never unmounts on data errors.
- Backend: Zod 400s with field errors, 401 refresh flow, 403 permission, 409 duplicates (mobile/email), 422 business rules, 500 sanitized + logged with request id.

## 9. Working assumptions (pending SOW Open Questions)

| Q | Assumption until answered |
|---|---------------------------|
| Q-03 gateway | Gateway adapter with sandbox driver (Razorpay-compatible shape); swap driver when merchant account exists |
| Q-04 Aon | Adapter + **manual result entry + CSV import** fallback so Phase 1 works without credentials |
| Q-05 dialer | Phase 1 = click-to-call (`tel:`) + manual disposition; dialer adapter in Phase 2 |
| Q-06 stages | Seeded default: New → Verified → Contacted → Counselling → Application Started → Application Submitted → Exam Pending → Exam Completed → Interview Scheduled → Interviewed → Shortlisted → Offer Issued → Offer Accepted → Token Paid → Admitted (+ Lost/Not Eligible). Fully editable in Masters |
| Q-07 round-robin | Pure rotation among active, eligible counsellors; engine interface allows weighted rules later |
| Q-08 masking | Field-rule engine generic; seeded: mobile/email/payment masked for Counsellor template per Roles & Access sheet |
| Q-09 WhatsApp | Phase 1 = `wa.me` deep-link + template log; BSP adapter in Phase 2 |
| Q-11 retention | Soft-delete everywhere + audit; retention jobs deferred |
| Q-12 mobile | Responsive web (the staff CRM and portal are built mobile-friendly) |

---

## 10. Decisions (confirmed 2026-10-01)

- **Database:** MongoDB Atlas + Mongoose, backend in **TypeScript** (user's call — deviates deliberately from the brief's Postgres/Prisma line; no local DB install available). Duplicate blocking via unique indexes on normalised mobile/email; reporting via aggregation pipelines.
- **Location:** the old practice code in `CrmBackend/` is replaced in place by the new TypeScript CRM backend.
- **Delivery:** slice 1 = build-order steps 1–4 (foundation, access, masters, full Lead Management) wired to the React frontend, then user review before continuing down the journey.

---

## 11. Slice 1 delivery — SOW traceability (2026-10-01)

Delivered and covered by `CrmBackend/tests/api.e2e.test.mjs` (36 passing tests) unless marked *partial*.

| SOW ID | Feature | Where |
|---|---|---|
| 1 | User & team management | `/users`, `/teams`; Users & Access, Teams pages |
| 2 | Default role-based access | 7 seeded templates (`seed.ts`) from the Roles & Access sheet |
| 3 | Custom role-based access | Per-user permission builder: module × action matrix, data scope, field rules |
| 4 | Teams & hierarchy | Departments → teams → counsellor groups (any depth), team codes, managers, programs handled, member management with reporting-manager sync, org-chart tree, team detail with per-member lead workload, cycle-safe re-parenting → `team` data scope covers all teams below
| 5 | Data masking | Field rules `masked / hidden / readonly`, applied to responses, exports and writes |
| 6 | Session & audit log | Session per login (refresh rotation, reuse detection), audit log with before/after, IP, user agent |
| 7 | Access control by team | `own / team / all` scope on lists, details, exports, dashboard. *Partial:* location/program/cohort currently resolve as team |
| 9 | Configuration management | *Partial:* masters for stages, sources, programs, cohorts, dispositions, tags, custom fields. Templates, rules and notification config come with their modules |
| 10 | Multi-source capture | `POST /leads/capture` (API key) |
| 12 | Quick add | Add lead drawer |
| 13 | Bulk upload | CSV/XLSX, column mapping, defaults, round-robin, row-level error report and download |
| 15 | Custom fields | Custom-field master; rendered on the lead form; type-validated server-side |
| 16 | Duplicate blocking | Normalised mobile/email, partial unique indexes, 409 with the existing lead number |
| 19, 38, 39 | Source tracking, first/latest touch | Immutable `firstSource` + current `source`, updated on re-enquiry |
| 20, 40, 41 | UTM & landing page | `utm.*` captured from forms and connectors |
| 21 | Referral / partner tracking | `referral.code / partnerName / partnerLink`, partner track |
| 22, 23 | Meta / Google connectors | *Partial:* webhook endpoints are live; platform-side subscription setup is pending ad-account access |
| 25 | One-view lead profile | Lead 360: header actions, overview (contact, attribution, journey, custom fields). Tabs for payments, documents etc. arrive with those modules |
| 27 | Lead timeline | Created, assignment, stage change, note, edit, import, re-enquiry |
| 28, 89 | Notes | Categorised notes; logged on the timeline |
| 29 | Tags | *Partial:* tag master and display. Tag editing on the lead form comes in slice 2 |
| 30 | Lead search | Name, mobile, email, lead number. Application number comes with the Applications module |
| 32, 227 | Export | Scope- and mask-aware CSV export, permission-gated |
| 33, 34 | Source master, channel classification | Sources master with channel |
| 71, 74, 75 | Round-robin, ownership, reassignment | Rotation pointer over the `receivesLeads` pool; assign/reassign with audit and notifications |
| 78 | Click-to-call | *Partial:* `tel:` link. Dialer integration is Phase 2 (Q-05) |
| 97, 98 | One-to-one email / WhatsApp | *Partial:* `mailto:` / `wa.me` deep links. Logged sending via templates comes with the Communication module |
| 99, 199, 200 | Real-time notifications | In-app notification centre (30 s polling): new assignment, reassignment |
| 119, 121 | Program master, cohorts | Masters |
| 120 | Program interest | Lead field + filter |

**Next slice (2):** tasks/follow-ups/callbacks + call dispositions + overdue queue (IDs 73, 85, 88, 90–92, 201–202), tag editing, then the student panel and application journey (IDs 102–118).
