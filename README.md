# KcGlobed CRM — Frontend

React 19 + TypeScript + Vite + Redux Toolkit (RTK Query) + Tailwind CSS v4.

See the root [README](../README.md) for setup, architecture and the seeded demo accounts.

```bash
npm install
npm run dev     # http://localhost:5173 — proxies /api to the backend set in src/constants/config.ts
npm run lint
npm run build
```

## Lead status colours

The approved lead status palette lives in `src/lib/stageColors.ts` (`STAGE_COLORS`, keyed by the exact stage name) and is rendered everywhere through `StageBadge` in `src/components/ui/Badge.tsx`. Statuses outside the palette fall back to the colour set in Masters (unless it is one of the palette colours, which are reserved for their statuses), then to a neutral badge. Text colour on a fill is picked by WCAG contrast (`textOn`).

## Tests

```bash
npm test        # node --test: palette mapping and contrast (src/**/*.test.mjs)
npm run lint
npm run build   # tsc + vite build
```

## Push notifications

Browser push uses Firebase Cloud Messaging. The web app's Firebase settings and the VAPID public key are in `src/constants/firebase.ts` (override with `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_VAPID_KEY`). A user turns push on or off with the "Push Notifications" switch in the bell (per browser: off unregisters the device and silences toasts and pop-ups there, and is remembered in `localStorage`); the device token is registered with `POST /api/v1/notifications/push/subscriptions` and dropped on sign-out or when switched off. `public/firebase-messaging-sw.js` receives the pushes: a toast with a "View" action while the CRM tab is open (`src/lib/push.ts`, `PushNotifications`), a system notification otherwise. The backend sends through FCM only when its `PUSH_PROVIDER=fcm` with a service-account key (see the root README). Independently of push, the bell polls every 10 s and shows each new notification as the same toast (with "View"); a tab in the background keeps the toast until the user returns and also gets a browser pop-up, so alerts reach an open CRM even before FCM is configured. Toasts are coloured by event (`src/index.css`, `.crm-toast-*`): assignment purple, untouched lead gold, follow-up teal, overdue follow-up red.
