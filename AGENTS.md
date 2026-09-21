# KC Globe CRM - Frontend Architecture & Conventions

## 1. Tech Stack
- **Framework**: React 19 / Vite / TypeScript
- **State Management**: Redux Toolkit (`@reduxjs/toolkit`, `react-redux`)
- **Routing**: React Router DOM v7
- **Networking**: Native `fetch` wrapped in `services/apiRequest.ts` with silent JWT refresh (`services/tokenService.ts`)
- **Styling**: Vanilla CSS (White Major `#ffffff`/`#faf8fc` with `#A03F99` accent theme tokens in `src/index.css`)

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
   - Components only interact with state via typed `useAppDispatch` and `useAppSelector` from `src/hooks/useRedux`.
3. **Routing**:
   - `routes/privateRoutes.tsx` protects internal views via `state.auth.isAuthenticated`.
   - `routes/publicRoutes.tsx` prevents authenticated users from landing on `/login`.
   - `routes/index.tsx` configures all route paths.
4. **Visual Guidelines**:
   - Strictly adhere to the White Major & `#A03F99` accent theme.
   - Use table classes (`.roles-table-card`, `.roles-table`), stat cards (`.roles-metric-grid`, `.role-stat-card`), and toolbars (`.roles-toolbar`).
