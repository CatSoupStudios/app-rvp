import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
admin.initializeApp();

export const debugCleanup = functions.pubsub.schedule('every friday 15:00')
  .timeZone('America/Los_Angeles')
  .onRun(async () => {
    const db = admin.firestore();
    const workTimes = db.collection("work_times");

    const snap = await workTimes.get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    console.log(`[debugCleanup] Limpieza viernes 3pm hora de Bakersfield CA - completada a las ${new Date().toLocaleString()}`);
    return null;
  });