# CRM API — Django

A Python/Django port of the Node backend in `../CrmBackend`. It uses Django 6, Django REST Framework and SQLite.

The original API contract is kept:
- Same paths under `/api/v1`, with no trailing slashes.
- Same JSON envelopes, field names and `_id` values (24-hex strings).
- Same error codes, cookies, permissions, data scope and masking.

On top of it sits the **Go-Live Minimum Scope (Lead Management)**: three roles, Meta Lead Ads, Quick Add and Excel upload, round-robin, dispositions, SMS/email, timeline and history, notifications, search, filters and import/export. See [Go-live scope](#go-live-scope) below. [`../API_DOCUMENTATION.md`](../API_DOCUMENTATION.md) is the reference for the original endpoints.

## Run it

```bash
py -3.14 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
copy .env.example .env          # fill SECRET_KEY, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, CAPTURE_API_KEY
.venv\Scripts\python manage.py migrate
.venv\Scripts\python manage.py seed      # stages, masters, demo users, SMS/email templates, automations
.venv\Scripts\python manage.py runserver 127.0.0.1:4000
```

Port 4000 is where the Vite dev proxy (`crmfrontend/vite.config.ts`) sends `/api`. Start the frontend with `npm run dev` in `crmfrontend` and open http://localhost:5173.

Demo logins:

| Role | Login |
|---|---|
| Super Admin | `admin@gccschool.com / Admin@12345` |
| Admin | `priya.admin@gccschool.com / Welcome@123` |
| Admission Counsellor | `arjun.c@`, `sara.c@`, `neha.c@gccschool.com / Welcome@123` |

### Background work

One tick sends follow-up reminders (15 min before), overdue alerts, the 2-hour Admin escalations and the Untouched alerts. Untouched alerts count working hours only: 9:30–19:00, Mon–Sat. The same tick sends the hourly Unassigned-pool reminder, hands pooled Meta leads to logged-in counsellors (every 5 min), retries failed Meta fetches and starts scheduled bulk sends.

The tick runs whenever a notification bell polls, at most once a minute. For a reliable schedule, keep `python manage.py send_reminders --loop` running, or run `python manage.py send_reminders` every minute from cron or Task Scheduler. A Super Admin can also trigger it with `POST /api/v1/system/tick`.

`runserver` is for development. In production, put the app behind a WSGI server such as gunicorn, or waitress on Windows, using `config.wsgi:application`. Set `DEBUG=false` and serve over HTTPS so the refresh cookie is sent with `Secure`.

### Settings for go-live (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | console | Credential emails, password resets and email messages. Use a GCC-domain sender with SPF/DKIM. |
| `META_VERIFY_TOKEN` | `gcc-crm-meta-verify` | Token for Meta's webhook subscription handshake. |
| `META_APP_SECRET` | — | Checks `X-Hub-Signature-256`. Required in production. |
| `META_ACCESS_TOKEN` | — | Page token used to fetch leads from the Graph API. Without it, the webhook reads answers from the payload (sandbox/QA). |
| `SMS_PROVIDER` | `console` | `console` logs SMS. `http` posts to `SMS_HTTP_URL` with `SMS_HTTP_KEY` (DLT vendor). |
| `SMS_AUTO_DELIVER` | `true` | The console provider reports messages as delivered at once. |
| `MESSAGING_WEBHOOK_SECRET` | `CAPTURE_API_KEY` | `X-Webhook-Secret` for the delivery-status and inbound-SMS (STOP) webhooks. |
| `PUBLIC_API_URL` | `http://localhost:4000` | Base of the unsubscribe link in emails. |
| `SESSION_IDLE_MINUTES`, `TEMP_PASSWORD_HOURS` | 30, 48 | Idle logout and temporary-password lifetime. |
| `WORKING_DAY_START`, `WORKING_DAY_END`, `WORKING_DAYS` | 09:30, 19:00, 0-5 | Working hours for the Untouched timers. |
| `BULK_SEND_WINDOW` | `09:00-21:00` | Bulk SMS/email window (IST). |

Webhooks to register with the vendors:
- Meta: `GET/POST /api/v1/webhooks/meta-leads`, field `leadgen`.
- SMS/email delivery reports: `POST /api/v1/webhooks/messaging/status` with `{providerMessageId, status, error}`.
- SMS replies (STOP): `POST /api/v1/webhooks/messaging/inbound-sms` with `{from, text}`.

## Tests

All suites are black-box HTTP tests and need a running, seeded server. They use Node's built-in test runner. For the go-live suite, start the server in QA mode. Emails then go to files, rate limits are lifted, and bulk jobs run inline:

```bash
MAIL_OUTBOX_DIR=./tmp-mail AUTH_RATE_LIMIT=1000 API_RATE_LIMIT=100000 RUN_JOBS_INLINE=true \
  BULK_SEND_WINDOW=00:00-23:59 .venv/Scripts/python manage.py runserver 127.0.0.1:4000 --noreload
```

```bash
export API_URL=http://localhost:4000/api/v1 CAPTURE_API_KEY=<your key> MAIL_OUTBOX_DIR=./tmp-mail
node --test tests/golive.test.mjs        # Go-live checklist §13.1 (45 tests)
node --test tests/api.e2e.test.mjs       # core API, updated to the go-live rules (59 tests)
node --test tests/extra_flows.test.mjs   # auth / users / capture extras (16 tests)
node --test tests/followups.test.mjs     # follow-ups, reminders, history (13 tests; run from CrmDjango/)
```

`../CrmBackend/tests/api.e2e.test.mjs` is still the contract for the retired Node backend. It asserts pre-go-live rules, such as Quick Add without a source and assignment without a reason.

The tests create users and leads with unique names each run. Run them against a QA copy of the database, not the one you demo from.

### Postman

Import `postman/CRM_Django_API.postman_collection.json` (226 requests in 16 folders). It stores the token, a per-run id and every created id in collection variables. Run it top to bottom with the Collection Runner from the `postman/` folder: the uploads use `sample-leads.csv`, `sample-document.pdf` and `sample-photo.png`.

```bash
cd postman && npx newman run CRM_Django_API.postman_collection.json
```

The collection is generated: edit `postman/build-postman.mjs` and run `node postman/build-postman.mjs`, not the JSON.

## Go-live scope

| Area | Where |
|---|---|
| Roles, user creation by email, temporary passwords, forced password change, 30-min idle logout | `common/roles.py`, `apps/users`, `apps/authentication` |
| Visibility: counsellors see only their leads (list, search, filters, export, API) | `common/scope.py`, `apps/leads/services.py` |
| One create service for all sources; duplicate → re-enquiry (fills empty fields, reopens closed leads) | `apps/leads/services.py`, `apps/leads/capture.py` |
| Meta Lead Ads: webhook, Graph fetch, per-form mapping, idempotency, retries, Integration errors, daily check | `apps/integrations/meta.py` |
| Quick Add with live duplicate check | `GET /leads/check-duplicate`, `POST /leads` |
| Excel/CSV upload: template, preview, source, assign modes, duplicates, error file, import-update | `apps/leads/importer.py` |
| Round-robin to logged-in counsellors; pool when nobody is online; manual and bulk assign with reason | `apps/leads/assignment.py`, `POST /leads/bulk-assign` |
| Student profile with documents and city-by-state; Counsellor Discussion (27 fields) | `apps/leads/profile.py`, `documents.py`, `discussion.py` |
| Dispositions: mandatory follow-up, reasons, locked stages, attempt limit → Lost, call log | `apps/leads/dispositions.py`, `stage_rules.py` |
| SMS/email: DLT templates, per-lead and bulk sends, automations, delivery status, STOP/unsubscribe | `apps/messaging` |
| Timeline, History tab, activity log with CSV export | `apps/leads/history.py`, `apps/audit` |
| Notifications and My Day | `apps/tasks/reminders.py`, `GET /leads/my-day` |
| Global search, smart, advanced and saved filters, exports with profile and counsellor fields (>10k in the background) | `apps/leads/filters.py`, `lists.py`, `exports.py` |

Stages come from the Lead Stages sheet. The go-live doc's *Junk* is the sheet's **Invalid** and *Lost* is **Closed - Lost**. **Re-enquired** and **Application Submitted** were added as system stages, and **Language barrier** as a Not Connected disposition. WhatsApp and a dialer are not live. Messaging is channel-agnostic, and the `calls` table already has the dialer columns.

## Layout

```
config/        settings (all secrets from .env), urls
common/        envelope + errors, pagination, JWT auth + sessions, roles, module permissions,
               rate limits, masking, normalisers, data scope, 24-hex ids
apps/
  authentication/   login, refresh rotation, idle sessions, temp passwords, reset/change, me
  users/            users, roles, permission templates, `seed` command
  teams/            hierarchy, tree, members, stats, round-robin pause
  masters/          sources, programs, cohorts, stages (+ sub-stages), dispositions, tags, custom fields
  leads/            leads, capture/re-enquiry, assignment, dispositions, profile, documents,
                    counsellor discussion, filters, search, notes, timeline, history, import, export
  tasks/            follow-ups and the scheduler tick (`send_reminders`)
  messaging/        templates, sends, campaigns, automations, provider adapter, opt-out
  integrations/     Meta Lead Ads
  notifications/    in-app notifications
  audit/            activity log
  dashboard/        summary
tests/         golive, api.e2e, extra_flows, followups
```

## Differences from the Node backend

| Area | Node | Django | Why |
|---|---|---|---|
| Database | MongoDB Atlas | SQLite (`db.sqlite3`) | Requested. Existing Mongo data is **not migrated**: start from `manage.py seed`. |
| `__v` on documents | returned | not returned | Mongoose-internal version key; the frontend never reads it. |
| Unknown ids in a payload (source, stage, team…) | stored as dangling ids | 400 with a field error | A SQL foreign key cannot point at nothing. |
| Removing a sub-stage in Masters | leads kept a dangling id | those leads' sub-stage is cleared | Same reason. Deactivate (`isActive: false`) a sub-stage to keep it on leads. |
| NoSQL-injection body sanitiser | yes | not needed | The ORM always uses parameterised SQL. |
| Lead numbers | `LD-000123` | `GCC-L-0000123` | Go-live §6.1. |
| Business rules | pre-go-live | Go-Live Minimum Scope | See above. |
