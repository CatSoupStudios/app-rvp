import { db } from "./firebase";
import { collection, addDoc, getDocs, query, where, updateDoc } from "firebase/firestore";

// --- CORRECCIÓN DE FECHAS ---
// Usamos hora local para evitar que se guarde como "mañana" si es tarde en la noche

export function getTodayISO(): string {
  const dt = new Date();
  const year = dt.getFullYear();
  // getMonth() devuelve 0-11, así que sumamos 1. padStart agrega el 0 si es necesario (ej: 05)
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getWeekDatesISO(): string[] {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Domingo, 1=Lunes...
  // Ajustamos para que la semana empiece en Lunes (si es Domingo -6, si no 1-dayOfWeek)
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const dates: string[] = [];
  for (let i = 0; i < 6; i++) { // Lunes a Sábado
    const d = new Date(now);
    d.setDate(now.getDate() + mondayOffset + i);
    
    // Usamos la misma lógica local para cada día de la semana
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
  }
  return dates;
}

// --- FIN CORRECCIÓN ---

// Save clock-in (IN)
// Previene duplicados: solo guarda si NO existe ya uno sin outTime para ese usuario y día
export async function saveClockIn({ userId, userName, dateISO, inTime }: { 
  userId: string, userName: string | null, dateISO: string, inTime: string
}) {
  const col = collection(db, "work_times");
  // Solo permite un clock-in por día y usuario sin outTime
  const q = query(col, where("userId", "==", userId), where("date", "==", dateISO), where("outTime", "==", null));
  const existing = await getDocs(q);
  if (!existing.empty) {
    // Ya existe un inTime sin outTime este día: no duplica
    return;
  }
  await addDoc(col, {
    userId,
    userName,
    date: dateISO,
    inTime,
    outTime: null,
    dayFinished: false,
    createdAt: new Date().toISOString(),
  });
}

// Save clock-out (OUT)
// Guarda el outTime SOLO en el registro sin outTime
export async function saveClockOut({ userId, dateISO, outTime }: { 
  userId: string, dateISO: string, outTime: string 
}) {
  const col = collection(db, "work_times");
  // Busca el registro abierto (sin outTime)
  const q = query(col, where("userId", "==", userId), where("date", "==", dateISO), where("outTime", "==", null));
  const docsSnap = await getDocs(q);
  if (docsSnap.empty) {
    // Si no encuentra registro de HOY abierto, podría ser que olvidó cerrar ayer.
    // Opcional: Podrías buscar cualquier registro abierto sin importar la fecha,
    // pero por ahora mantenemos tu lógica estricta por día.
    throw new Error("No clock-in record found for user today");
  }
  // Solo actualiza el primero encontrado (debería haber solo uno)
  const docRef = docsSnap.docs[0].ref;
  await updateDoc(docRef, {
    outTime,
    dayFinished: true,
    updatedAt: new Date().toISOString(),
  });
}

// Read clocks for user and specific day (TODOS los clock-in/out del día)
export async function getClocksForDay(userId: string, dateISO: string) {
  const col = collection(db, "work_times");
  const q = query(col, where("userId", "==", userId), where("date", "==", dateISO));
  const snap = await getDocs(q);
  return snap.docs.map(doc => {
    const data = doc.data() as { date?: string, inTime?: string, outTime?: string };
    return {
      id: doc.id,
      date: data.date ?? "",
      inTime: data.inTime,
      outTime: data.outTime,
    };
  });
}

// Lee todos los clock-in/out válidos MON-SAT
export async function getClocksForWeek(userId: string, weekDatesISO: string[]) {
  const col = collection(db, "work_times");
  const q = query(col, where("userId", "==", userId), where("date", "in", weekDatesISO));
  const snap = await getDocs(q);
  return snap.docs.map(doc => {
    const data = doc.data() as { date?: string, inTime?: string, outTime?: string };
    return {
      id: doc.id,
      date: data.date ?? "",
      inTime: data.inTime,
      outTime: data.outTime,
    };
  });
}

// Sumar horas del día [de un registro o varios, regresa segundos]
export function sumWorkedSeconds(clocks: { inTime: string, outTime: string | null }[]): number {
  let totalSecs = 0;
  clocks.forEach((clock) => {
    if (clock.inTime && clock.outTime) {
      const tIn = Date.parse(clock.inTime);
      const tOut = Date.parse(clock.outTime);
      const diff = tOut - tIn;
      // Solo suma rangos válidos: mínimo 1 seg, máximo 12h
      if (!isNaN(tIn) && !isNaN(tOut) && diff > 0 && diff < 43200 * 1000) {
        totalSecs += Math.floor(diff / 1000);
      }
    }
  });
  return totalSecs;
}