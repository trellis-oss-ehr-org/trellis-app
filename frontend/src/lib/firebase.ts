import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged as onAuthChanged,
  type User,
} from "firebase/auth";
import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

const googleProvider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function signUpWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logOut() {
  return signOut(auth);
}

export const onAuthStateChanged = onAuthChanged;
export type { User };

// --- Firebase Cloud Messaging (Push Notifications) ---

let _messaging: Messaging | null = null;

export function getFirebaseMessaging(): Messaging | null {
  if (!("serviceWorker" in navigator)) return null;
  if (!_messaging) {
    _messaging = getMessaging(app);
  }
  return _messaging;
}

export async function requestPushToken(): Promise<string | null> {
  const m = getFirebaseMessaging();
  if (!m) return null;

  // Pass Firebase config to the SW via URL query params (all values are public keys)
  const cfgParams = new URLSearchParams({
    apiKey: firebaseConfig.apiKey || "",
    authDomain: firebaseConfig.authDomain || "",
    projectId: firebaseConfig.projectId || "",
    storageBucket: firebaseConfig.storageBucket || "",
    messagingSenderId: firebaseConfig.messagingSenderId || "",
    appId: firebaseConfig.appId || "",
  });
  const sw = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${cfgParams.toString()}`
  );

  const token = await getToken(m, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: sw,
  });
  return token || null;
}

export { onMessage };
