# GCC School CRM & ATP Portal

In-house CRM for GCC School / KC GlobEd admissions, built from `CRM & ATP Portal SOW Final V1.xlsx` (227 features, 15 modules, 3 phases).

**Status: Phase 1, slice 1 (Foundation + Lead Management).** The full requirement breakdown, module map, data model and roadmap are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Every endpoint is documented in [API_DOCUMENTATION.md](API_DOCUMENTATION.md).

| Area | What works today |
|---|---|
| Auth | Login, logout, short-lived access token + rotating httpOnly refresh cookie (reuse detection), silent session restore on reload, forgot / reset / change password, rate-limited auth routes |
| Access control | Plug-and-play per-user permissions: modules → actions → data scope (own / team / all) → field rules (hidden / read-only / masked). 7 seeded templates from the SOW *Roles & Access* sheet. Enforced on every API route; the UI hides what the user can't use |
| Users & teams | User CRUD, deactivation (signs out all sessions), teams with managers and parent teams (team scope follows the hierarchy), round-robin pool flag |
| Masters | Stages, sources (with channel), programs, cohorts, dispositions, tags, custom lead fields — all configurable, nothing hard-coded |
| Leads | Quick add, public capture API + Meta/Google webhook endpoints, CSV/XLSX bulk upload with column mapping and row-level error report, duplicate blocking on normalised mobile/email, first- and latest-touch attribution, UTM + referral/partner tracking, round-robin assignment, reassignment with notifications, 360 profile, timeline, notes, stage changes (status follows stage type), soft delete, CSV export |
| Listings | Server-side search (debounced), sort, filters, pagination; state lives in the URL so it survives navigation |
| Dashboard | Totals, stage / source / counsellor distributions (click-through to filtered leads), recent leads — all scope-aware |
| Ops | In-app notifications, audit log with before/after diffs, consistent API envelope, central error handling, structured logging |

## Architecture

```
DummyCrmReact/
├── CrmBackend/          Node + Express + TypeScript + Mongoose (MongoDB Atlas)
│   ├── src/
│   │   ├── config/      env, logger, db connection
│   │   ├── constants/   modules / actions / scopes (permission vocabulary)
│   │   ├── models/      Mongoose schemas + indexes
│   │   ├── validators/  Zod request schemas
│   │   ├── middlewares/ auth, permit(module, action), validate, errors, rate limits, upload
│   │   ├── services/    business logic (leads, import, assignment, auth, audit…)
│   │   ├── controllers/ thin HTTP adapters
│   │   ├── routes/      route wiring under /api/v1
│   │   ├── utils/       pagination, masking, data scope, tokens, responses
│   │   └── seed/        idempotent seed (templates, masters, demo users, sample leads)
│   └── tests/           end-to-end API suite (node:test)
├── crmfrontend/         React 19 + TypeScript + Vite
│   └── src/
│       ├── app/         Redux store + typed hooks
│       ├── services/    RTK Query API layer (auto token refresh)
│       ├── features/    auth slice
│       ├── components/  UI kit: DataTable, Drawer, Modal, fields, feedback states
│       ├── layouts/     app shell (sidebar, header, notifications, profile menu)
│       ├── pages/       dashboard, leads, admin (users, teams, masters, audit), auth
│       ├── routes/      lazy routes + auth/permission guards
│       └── hooks/ constants/ lib/ types/
└── docs/ARCHITECTURE.md
```

**Database choice.** The brief suggested PostgreSQL + Prisma. This build uses **MongoDB Atlas + Mongoose**, a deliberate decision made at kick-off because no local database was available. Relational guarantees are covered where they matter. Partial unique indexes enforce duplicate blocking, atomic counters generate lead numbers, and aggregation pipelines feed the reports.

**Frontend state.** Redux holds only auth/session state. All server data goes through RTK Query: per-endpoint caching, tag invalidation, and isolated loading/error states. A failed `POST /leads` therefore never clears the leads list. Forms keep the user's input on failure so they can retry.

## Getting started

Prerequisites: Node 20+ and a MongoDB connection string (Atlas or local).

```bash
# Backend
cd CrmBackend
cp .env.example .env        # fill MONGO_URI, JWT secrets, CAPTURE_API_KEY, SEED_ADMIN_PASSWORD
npm install
npm run seed                # idempotent — safe to re-run
npm run dev                 # http://localhost:4000  (health: /health)

# Frontend (second terminal)
cd crmfrontend
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173  (proxies /api → :4000)
```

### Seeded accounts

| Role (template) | Email | Password | What to try |
|---|---|---|---|
| Super admin | admin@gccschool.com | value of `SEED_ADMIN_PASSWORD` (dev: `Admin@12345`) | Everything; Users → edit a user's permission ticks |
| Team leader (team scope) | tanvi.tl@gccschool.com | Welcome@123 | Sees the whole team's leads, can reassign and export |
| Counsellor (own scope) | arjun.c@gccschool.com | Welcome@123 | Sees only own leads; no export / reassign / admin menus |
| Counsellor | sara.c@gccschool.com | Welcome@123 | Receives round-robin leads |
| Marketing | dev.mkt@gccschool.com | Welcome@123 | Read-only leads with **masked** mobile/email; bulk import |

Change all passwords before any shared or production use.

## Environment variables

**Backend (`CrmBackend/.env`)**

| Variable | Purpose |
|---|---|
| `PORT` | API port (default 4000) |
| `NODE_ENV` | `production` hides internal error messages, sets secure cookies |
| `FRONTEND_URL` | CORS origin and base for password-reset links |
| `MONGO_URI`, `DB_NAME` | Database connection |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Token signing secrets (long random strings, different from each other) |
| `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS` | Token lifetimes (default 15m / 7 days) |
| `CAPTURE_API_KEY` | Shared key for the public lead-capture and webhook endpoints |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Super admin created by `npm run seed` |
| `SMTP_*`, `MAIL_FROM` | Outgoing mail; if `SMTP_HOST` is blank, reset links are written to the log instead |

**Frontend (`crmfrontend/.env`)**

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | API base path (default `/api/v1`). No secrets ever go in the frontend env |

## Commands

| Where | Command | Does |
|---|---|---|
| CrmBackend | `npm run dev` | API with auto-reload |
| CrmBackend | `npm run seed` | Seed templates, masters, demo users, sample leads |
| CrmBackend | `npm run typecheck` | Strict TypeScript check |
| CrmBackend | `npm run build && npm start` | Compile to `dist/` and run |
| CrmBackend | `npm run test:e2e` | 36 end-to-end API tests (server must be running on a seeded DB) |
| crmfrontend | `npm run dev` | Vite dev server |
| crmfrontend | `npm run lint` | ESLint (incl. React Compiler rules) |
| crmfrontend | `npm run build` | Typecheck + production bundle in `dist/` |

### What the test suite covers

Authentication: bad credentials, validation, refresh rotation and reuse detection. RBAC denial on export, users, masters, lead creation and reassignment. Data scope for own vs team. Field masking. Lead validation, duplicate blocking (including `+91` normalisation), and proof that a failed create doesn't break listing. Search, sort, filter and pagination. Stage→status logic, notes and timeline, reassignment notifications, and soft delete. Capture-key enforcement, first-touch vs latest-touch attribution, and bulk upload with an error report. Permission changes applying on the next request, deactivation cutting off access, the audit trail, master duplicates, the dashboard, and consistent 404/400 handling.

## How auth works

1. `POST /auth/login` returns an access token (15 min) in the body and sets an httpOnly `crm_rt` refresh cookie, scoped to `/api/v1/auth`.
2. The frontend keeps the access token **in memory only**, never in localStorage.
3. On any 401, the API layer makes **one** refresh call (a mutex queues concurrent requests). The cookie rotates and the original request retries. If refresh fails, the user is sent to `/login`.
4. On page load, a silent refresh restores the session from the cookie.
5. Each refresh token is single-use. Presenting an already-rotated token revokes the whole session (theft detection).
6. Password reset, password change and deactivation revoke the user's sessions.

## How permissions work

- Every user carries `permissions: [{ module, actions[] }]`, a `dataScope`, and `fieldRules`. Templates only pre-fill these values, so editing one user never affects another.
- Backend: `requireAuth` reloads the user from the database on every request, so deactivation and permission changes take effect immediately. `permit(module, action)` guards each route. `buildOwnerScopeFilter` restricts queries to own / team / all. `applyFieldRules` masks or hides fields in responses, and `stripUneditableFields` drops read-only fields from writes.
- Frontend: `can(user, module, action)` drives the sidebar, buttons and route guards. These checks exist for usability only. The backend enforces everything on its own.

## Deployment notes

- Build both apps. Serve `crmfrontend/dist` as static files with SPA fallback to `index.html`. Reverse-proxy `/api` to the Node process (`node dist/server.js`) on the **same origin**, so the refresh cookie works without cross-site settings.
- Set `NODE_ENV=production`, strong unique JWT secrets, a real `CAPTURE_API_KEY` and SMTP. Restrict the Atlas network access list to the server.
- The API runs behind `trust proxy` for correct client IPs in rate limiting and audit logs.

## Not in this slice

These are tracked in the roadmap in `docs/ARCHITECTURE.md` §7:

- Tasks, follow-ups and call dispositions
- Student panel
- Application and documents
- NFET/exam, interviews, offers, payments
- Communication templates and sending
- Reports
- Live Meta/Google connector subscriptions. The webhook endpoints exist; the platform-side setup does not.
