import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

function getFirebaseApp() {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT env var not set");
  }

  return initializeApp({
    credential: cert(JSON.parse(serviceAccount)),
  });
}

export function getFirebaseMessaging() {
  const app = getFirebaseApp();
  return getMessaging(app);
}
