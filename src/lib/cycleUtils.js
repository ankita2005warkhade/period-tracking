// src/lib/cycleUtils.js

import {
  doc,
  getDoc,
  collection,
  setDoc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";

import { db } from "./firebase";

/* ============================================================
   🔹 1. Get the current active cycle ID
   Path: users/{uid}/appState/latestState
   ============================================================ */
export async function getActiveCycleId(uid) {
  const latestRef = doc(db, "users", uid, "appState", "latestState");
  const snap = await getDoc(latestRef);

  if (!snap.exists()) return null;
  return snap.data().activeCycleId;
}

/* ============================================================
   🔹 2. Update latestState
   Path: users/{uid}/appState/latestState
   ============================================================ */
export async function updateLatestState(uid, data) {
  const latestRef = doc(db, "users", uid, "appState", "latestState");
  await setDoc(latestRef, data, { merge: true });
}

/* ============================================================
   🔹 3. Save Daily Log
   Path: users/{uid}/cycles/{cycleId}/dailyLogs/{dateId}
   ============================================================ */
export async function saveDailyLog(uid, cycleId, logData) {
  const logsRef = collection(
    db,
    "users",
    uid,
    "cycles",
    cycleId,
    "dailyLogs"
  );

  await setDoc(doc(logsRef, logData.date), logData);
}

/* ============================================================
   🔹 4. Fetch all logs in a cycle
   ============================================================ */
export async function getCycleLogs(uid, cycleId) {
  const logsRef = collection(
    db,
    "users",
    uid,
    "cycles",
    cycleId,
    "dailyLogs"
  );

  const q = query(logsRef, orderBy("date", "asc"));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ============================================================
   🔹 5. Predict next period using 28-day cycle
   ============================================================ */
export function predictNextPeriod(startDate) {
  const next = new Date(startDate);
  next.setDate(next.getDate() + 28);
  return next.toISOString().split("T")[0];
}

/* ============================================================
   🔹 6. Calculate health score
   ============================================================ */
export function calculateHealthScore(cycleLength, symptomTypesCount) {
  let score = 100;

  if (cycleLength < 3 || cycleLength > 8) score -= 25;
  if (symptomTypesCount > 4) score -= 15;

  if (score < 10) score = 10;
  return score;
}

/* ============================================================
   🔹 7. Complete Cycle (summary saving)
   Path: users/{uid}/cycles/{cycleId}
   Also updates latestState
   ============================================================ */
export async function endCycle(uid, cycleId, summaryData) {
  const cycleRef = doc(db, "users", uid, "cycles", cycleId);
  await setDoc(cycleRef, summaryData, { merge: true });

  // Reset state
  await updateLatestState(uid, {
    isCycleRunning: false,
    activeCycleId: null,
  });
}

/* ============================================================
   🔹 8. Generate next day (for automatic simulation)
   ============================================================ */
export function getNextDay(previousDate) {
  const d = new Date(previousDate);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}
