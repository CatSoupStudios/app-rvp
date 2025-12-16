import { db } from "./firebase";
import { collection, addDoc, getDocs, query, where, updateDoc } from "firebase/firestore";

// --- INTERFAZ PARA CLOCK IN ---
// Definimos esto para que sea fácil pasar la ubicación opcional
interface ClockInData {
  userId: string;
  userName: string | null;
  dateISO: string;
  inTime: string;
  location?: { lat: number; lng: number }; // <--- NUEVO CAMPO
}

// --- CORRECCIÓN DE FECHAS (INTACTA) ---
export function getTodayISO(): string {
  const dt = new Date();
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getWeekDatesISO(): string[] {
  const now = new Date();
  const dayOfWeek = now.getDay(); 
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const dates: string[] = [];
  for (let i = 0; i < 6; i++) { 
    const d = new Date(now);
    d.setDate(now.getDate() + mondayOffset + i);
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
  }
  return dates;
}
// --- FIN CORRECCIÓN ---

// Save clock-in (IN)
// AHORA GUARDA UBICACIÓN SI EXISTE
export async function saveClockIn({ userId, userName, dateISO, inTime, location }: ClockInData) {
  const col = collection(db, "work_times");
  
  // Solo permite un clock-in por día y usuario sin outTime
  const q = query(col, where("userId", "==", userId), where("date", "==", dateISO), where("outTime", "==", null));
  const existing = await getDocs(q);
  
  if (!existing.empty) {
    return; // Ya existe, no duplicar
  }

  await addDoc(col, {
    userId,
    userName,
    date: dateISO,
    inTime,
    outTime: null,
    dayFinished: false,
    // Guardamos la ubicación si la mandaron, si no, null
    location: location || null, 
    createdAt: new Date().toISOString(),
  });
}

// Save clock-out (OUT)
export async function saveClockOut({ userId, dateISO, outTime }: { 
  userId: string, dateISO: string, outTime: string 
}) {
  const col = collection(db, "work_times");
  const q = query(col, where("userId", "==", userId), where("date", "==", dateISO), where("outTime", "==", null));
  const docsSnap = await getDocs(q);
  
  if (docsSnap.empty) {
    throw new Error("No clock-in record found for user today");
  }

  const docRef = docsSnap.docs[0].ref;
  await updateDoc(docRef, {
    outTime,
    dayFinished: true,
    updatedAt: new Date().toISOString(),
  });
}

// Read clocks for user and specific day
// AHORA DEVUELVE LA LOCATION AL LEER
export async function getClocksForDay(userId: string, dateISO: string) {
  const col = collection(db, "work_times");
  const q = query(col, where("userId", "==", userId), where("date", "==", dateISO));
  const snap = await getDocs(q);
  
  return snap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      date: data.date ?? "",
      inTime: data.inTime,
      outTime: data.outTime,
      location: data.location || null, // <--- Recuperamos location
    };
  });
}

// Lee todos los clock-in/out válidos MON-SAT
// AHORA DEVUELVE LA LOCATION AL LEER
export async function getClocksForWeek(userId: string, weekDatesISO: string[]) {
  const col = collection(db, "work_times");
  const q = query(col, where("userId", "==", userId), where("date", "in", weekDatesISO));
  const snap = await getDocs(q);
  
  return snap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      date: data.date ?? "",
      inTime: data.inTime,
      outTime: data.outTime,
      location: data.location || null, // <--- Recuperamos location
    };
  });
}

// Sumar horas del día (INTACTO)
export function sumWorkedSeconds(clocks: { inTime: string, outTime: string | null }[]): number {
  let totalSecs = 0;
  clocks.forEach((clock) => {
    if (clock.inTime && clock.outTime) {
      const tIn = Date.parse(clock.inTime);
      const tOut = Date.parse(clock.outTime);
      const diff = tOut - tIn;
      if (!isNaN(tIn) && !isNaN(tOut) && diff > 0 && diff < 43200 * 1000) {
        totalSecs += Math.floor(diff / 1000);
      }
    }
  });
  return totalSecs;
}