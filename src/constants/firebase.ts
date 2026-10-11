/**
 * Firebase web-app settings for push notifications (Cloud Messaging). These
 * identify the project to the browser and are public by design; the key that
 * can send messages lives only on the backend. Override per environment with
 * VITE_FIREBASE_* variables; the defaults are the kcglobded-crm project.
 */
const env = import.meta.env ?? {}

export const FIREBASE_CONFIG = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'AIzaSyAK5CNJBgTSbVcMmng4FkhV_mfKuBCYQSk',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? 'kcglobded-crm.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'kcglobded-crm',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? 'kcglobded-crm.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '318196208097',
  appId: env.VITE_FIREBASE_APP_ID ?? '1:318196208097:web:a88f9cafd74a9db32742a0',
}

/** Web Push certificate (VAPID public key): Firebase console → Cloud Messaging → Web configuration. */
export const FIREBASE_VAPID_KEY =
  env.VITE_FIREBASE_VAPID_KEY ?? 'BJqf9RPlxr4BINHzJ-gs9ryHfh1L1yXBGRQLYW7IM_fDhf8cGt8nEPecTEpBB2wE38kVk3abq3mGAuAA4vo4RcA'

/** The service worker that receives pushes (served from /public at the site root). */
export const PUSH_SW_PATH = '/firebase-messaging-sw.js'
