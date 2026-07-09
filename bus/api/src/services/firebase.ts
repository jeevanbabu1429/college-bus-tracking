import admin from "firebase-admin";
import { readFileSync } from "node:fs";

let initialized = false;
let initWarned = false;

// Returns the singleton firebase-admin app, or null if FCM is not configured.
// Two ways to configure (pick one):
//   1) FIREBASE_SERVICE_ACCOUNT_PATH=/abs/path/to/serviceAccount.json
//   2) FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
//      (private key may contain literal "\n" — they get converted to real newlines)
export function getFirebaseApp(): admin.app.App | null {
  if (initialized) {
    return admin.apps.length ? admin.app() : null;
  }
  initialized = true;

  const credential = buildCredential();
  if (!credential) {
    if (!initWarned) {
      console.warn(
        "[fcm] Firebase Admin not configured — push notifications disabled. " +
          "Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY."
      );
      initWarned = true;
    }
    return null;
  }

  return admin.initializeApp({ credential });
}

function buildCredential(): admin.credential.Credential | null {
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (path) {
    try {
      const json = JSON.parse(readFileSync(path, "utf8"));
      return admin.credential.cert(json);
    } catch (err) {
      console.error("[fcm] Failed to load service account at", path, err);
      return null;
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && rawKey) {
    const privateKey = rawKey.replace(/\\n/g, "\n");
    return admin.credential.cert({ projectId, clientEmail, privateKey });
  }

  return null;
}

export function isFirebaseReady(): boolean {
  return getFirebaseApp() !== null;
}
