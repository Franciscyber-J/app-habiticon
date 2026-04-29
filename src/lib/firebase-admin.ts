import admin from "firebase-admin";

if (!admin.apps.length) {
  const base64 = process.env.FIREBASE_ADMIN_CREDENTIALS ?? "";
  const json = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));

  admin.initializeApp({
    credential: admin.credential.cert(json),
  });
}

export const adminDb = admin.firestore();