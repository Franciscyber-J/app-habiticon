import admin from "firebase-admin";

if (!admin.apps.length) {
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "";
  
  const privateKey = rawKey
    .replace(/\\n/g, "\n")   // \n literal → quebra real
    .replace(/^"|"$/g, "");  // remove aspas externas se houver

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

export const adminDb = admin.firestore();