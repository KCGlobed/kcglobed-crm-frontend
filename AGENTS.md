# KC Globe CRM - Frontend Architecture & Conventions

## 1. Tech Stack
- **Framework**: React 19 / Vite / TypeScript
- **State Management**: Redux Toolkit (`@reduxjs/toolkit`, `react-redux`)
- **Routing**: React Router DOM v7
- **Networking**: Native `fetch` wrapped in `services/apiRequest.ts` with silent JWT refresh (`services/tokenService.ts`)
- **Styling**: Tailwind CSS v4 utility classes. Pages (`index.tsx`) use the raw indigo/gray palette;
  Views and Forms use the CRM theme tokens (`bg-minor`, `text-crmText`, `crmSuccess-*`) defined in
  `src/index.css` (White Major `#ffffff`/`#faf8fc` with `#A03F99` accent)

## 2. Directory & File Structure
```
src/
├── assets/                     # Static assets (logos, SVGs, images)
├── components/                 # Presentation & UI components
│   └── common/                 # Global UI widgets (Header, Sidebar, AppLayout)
├── hooks/                      # Custom hooks (useRedux.ts, useDebounce.ts)
├── pages/                      # Feature-based pages (login, dashboard, roles, users, notFound)
├── routes/                     # Central routes & route guards (index.tsx, privateRoutes.tsx, publicRoutes.tsx)
├── services/                   # Network & API layer
│   ├── apiRequest.ts           # Central fetch wrapper, headers, 401 retry interceptor
│   ├── tokenService.ts         # Silent refresh token handler (POST /api/auth/refresh/)
│   └── apiServices.ts          # Pure async endpoint helper functions
├── store/                      # Redux Toolkit
│   ├── store.ts                # configureStore combining slices
│   └── slices/                 # Feature slices (authSlice.ts, roleSlice.ts, userSlice.ts)
└── utils/                      # Utilities, helpers, and types
    ├── constants.ts            # BASE_URL, API_ROUTES
    ├── tokenStorage.ts         # localStorage token read/write helpers
    └── types.ts                # Centralized TypeScript contracts & interfaces
```

## 3. Core Architectural Rules & Contracts
1. **Network Layer**:
   - Every backend API endpoint is defined in `services/apiServices.ts` using `apiRequest()`.
   - `services/apiRequest.ts` automatically attaches `Authorization: Bearer <token>`, handles JSON vs FormData, and intercepts `401 Unauthorized` responses to invoke `tryRefreshToken()`.
   - `services/tokenService.ts` executes silent refresh against `POST /api/auth/refresh/` using `{ refresh: refreshToken }` payload.
2. **State Management**:
   - Features have dedicated slices in `store/slices/` using `createAsyncThunk`.
   - Components only interact with state via typed `useAppDispatch` from `src/hooks/useAppDispatch`
     and `useAppSelector` from `src/hooks/useRedux`.
3. **Routing**:
   - `routes/privateRoutes.tsx` protects internal views via `state.auth.isAuthenticated`.
   - `routes/publicRoutes.tsx` prevents authenticated users from landing on `/login`.
   - `routes/index.tsx` configures all route paths.
4. **Visual Guidelines**:
   - Strictly adhere to the White Major & `#A03F99` accent theme.
   - Use table classes (`.roles-table-card`, `.roles-table`), stat cards (`.roles-metric-grid`, `.role-stat-card`), and toolbars (`.roles-toolbar`).

## 5. API Integration Workflow

**This is the standing procedure for every new endpoint — follow it without being asked.**
Given an API path and a sample response, execute all five phases in order and close with the
Phase 5 report.

### Phase 1 - Discovery (before writing anything)
- Read the closest existing implementation and mirror it. Current references:
  - **List fetch** -> `fetchRolesApi` + `fetchRoles` (`roleSlice.ts`)
  - **Detail fetch** -> `fetchRoleByIdApi` + `fetchRoleById` (`roleSlice.ts`), `fetchUserById` (`userSlice.ts`)
  - **POST with payload** -> `loginApi` + `loginUser` (`authSlice.ts`)
- Check whether the page and table already exist. Much of this app is scaffolded with stubbed
  thunks (`const response = await "";`), so the real work is usually wiring the network layer,
  not building UI. Never rebuild a page that already works.
- Diff the sample response against the existing type. Report every mismatch instead of silently
  coding around it.

### Phase 2 - Blueprint (state it before editing)
List every file to touch, tagged `[NEW]` or `[MODIFY]`, in dependency order:
types -> services -> slice -> store -> page -> routes. State explicitly what is out of scope.

### Phase 3 - Execution

**Layer 1 - `src/utils/types.ts`**
- **Follow CLAUDE.md § 2 for all typing rules.** In short: one interface per entity (all fields
  optional), never create separate
  `*ListApiResponse`, `*DetailApiResponse`, `*Payload`, or `*Item` aliases.
- Mirror the JSON field order from the backend response.

**Layer 2 - `src/services/apiServices.ts`**
- Group every endpoint under a `// ----------------<Feature> service------- //` marker.
- `apiRequest` takes **positional arguments**, not an options object:
  `apiRequest<T>(url, method, body?, retry?)`. Writing `apiRequest(url, { method: 'GET' })` is wrong.
- `BASE_URL` has no trailing slash. Write paths with a leading and trailing slash: `/access/roles/`.
- Naming: `fetchXApi`, `fetchXByIdApi`, `createXApi`, `updateXApi`, `deleteXApi`. Each declares
  `Promise<any>` — never use `ApiResponse<T>` wrappers.

**Layer 3 - `src/store/slices/<feature>Slice.ts`**
- `createAsyncThunk<Return, Arg>` with explicit generics. Return `response.data`, never the envelope.
- Keep the house error idiom: `catch (err: any) { return rejectWithValue(err.message || "Failed to ..."); }`.
  `err: any` trips `no-explicit-any` but matches every existing thunk - stay consistent.
- List fetch uses `loading` plus the `condition` guard that drops duplicate in-flight requests.
- Detail fetch uses its own `selected<X>Loading` flag so it never toggles the table spinner, and
  takes no `condition` guard (different ids are legitimately concurrent).
- A detail `fulfilled` also patches the matching row in `state.data` to keep the list in sync.
- Mutations use `actionLoading`. Register any new reducer in `store/store.ts`.

**Layer 4 - page**
- Reach state only through `useAppDispatch` (from `src/hooks/useAppDispatch`) and `useAppSelector`
  (from `src/hooks/useRedux`). Never import `useDispatch` / `useSelector` from `react-redux`.

### Phase 4 - Validation (run it, do not assume)
This repo carries ~604 pre-existing TypeScript errors, so a clean `tsc` is neither achievable nor
the gate. The gate is that **your change adds none**:

```bash
npx tsc -b --noEmit 2>&1 | grep 'error TS' | sed 's/([0-9]*,[0-9]*)//' | sort > after.txt
git stash -q
npx tsc -b --noEmit 2>&1 | grep 'error TS' | sed 's/([0-9]*,[0-9]*)//' | sort > before.txt
git stash pop -q
comm -13 before.txt after.txt    # must print nothing
```

- `npx vite build` must pass (`npm run build` runs `tsc -b` first and will fail on the backlog).
- `curl` the endpoint to prove the path resolves: **401** means the route exists and only auth is
  missing, which is the expected result. **404** means the path is wrong - fix it before reporting.

### Phase 5 - Report
Close with, in this order:
1. **Touched files checklist** - each file and one line on what changed.
2. **Pattern mirrored** - which existing feature was copied, and any deliberate deviation.
3. **Validation table** - real numbers from Phase 4, not claims.
4. **Flags** - anything still stubbed, any field the UI expects that the response does not return,
   and any lint delta.

Never report the work as done while part of it was skipped. Finish everything in scope, then say
plainly what was left out and why.
