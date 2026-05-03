import admin from "firebase-admin";

if (!admin.apps.length) {
  const base64 = process.env.FIREBASE_ADMIN_CREDENTIALS ?? "";
  const json = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));

  admin.initializeApp({
    credential: admin.credential.cert(json),
    // Puxa o nome do bucket do .env ou usa o padrão do projeto
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${json.project_id}.appspot.com`
  });
}

export const adminDb = admin.firestore();
export const adminStorage = admin.storage();