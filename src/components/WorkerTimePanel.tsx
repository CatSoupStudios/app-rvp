import React, { useState, useRef, useEffect } from "react";
import "./WorkerTimePanel.css";
import { auth } from "../firebase";
import { IonIcon } from "@ionic/react";
import { 
  chevronBackOutline, 
  closeOutline,
  playOutline,
  stopOutline,
  timeOutline,
  calendarOutline
} from "ionicons/icons";
import {
  saveClockIn,
  saveClockOut,
  getClocksForWeek,
  getClocksForDay,
  getTodayISO,
  getWeekDatesISO,
  sumWorkedSeconds,
} from "../clockFirebase";

interface WorkerTimePanelProps {
  userName: string | null; 
  onBack: () => void;
}

interface ClockRecord {
  id: string;
  date: string;
  inTime?: string;
  outTime?: string;
}

function formatFriendlyDuration(secs: number) {
  if (secs <= 0) return "0m";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "< 1m";
}

function pad(num: number): string {
  return num.toString().padStart(2, "0");
}

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const WorkerTimePanel: React.FC<WorkerTimePanelProps> = ({ onBack }) => {
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [weekSeconds, setWeekSeconds] = useState<number[]>(Array(daysOfWeek.length).fill(0));
  
  const timerInterval = useRef<number | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  const isSunday = new Date().getDay() === 0;

  useEffect(() => {
    const initTimerFromDB = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const todayISO = getTodayISO();
      const clocksToday = await getClocksForDay(user.uid, todayISO);
      
      const activeClock = clocksToday.find(
        c => typeof c.inTime === "string" && (!c.outTime || c.outTime === null)
      );
      
      if (activeClock && activeClock.inTime) {
        const tIn = Date.parse(activeClock.inTime);
        const tNow = Date.now();
        const secondsSoFar = Math.floor((tNow - tIn) / 1000);
        setTimerSeconds(secondsSoFar > 0 ? secondsSoFar : 0);
        setTimerRunning(true);
        startTimeRef.current = new Date(tIn);
        
        if (timerInterval.current) clearInterval(timerInterval.current);
        timerInterval.current = window.setInterval(() => {
          setTimerSeconds(prev => prev + 1);
        }, 1000);
      } else {
        setTimerRunning(false);
        setTimerSeconds(0);
        if (timerInterval.current) clearInterval(timerInterval.current);
      }
    };
    initTimerFromDB();
  }, []);

  const fetchWeekClocks = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const weekDates = getWeekDatesISO();
    const clocks: ClockRecord[] = await getClocksForWeek(user.uid, weekDates);
    
    const secondsPerDay = daysOfWeek.map((_, idx) => {
      const dateISO = weekDates[idx];
      const dayClocks = clocks.filter((c: ClockRecord) => c.date === dateISO);
      const validClocks = dayClocks.filter(
        c => typeof c.inTime === "string" && typeof c.outTime === "string"
      );
      if (validClocks.length) {
        return sumWorkedSeconds(validClocks as { inTime: string, outTime: string | null }[]);
      }
      return 0;
    });
    setWeekSeconds(secondsPerDay);
  };

  useEffect(() => {
    fetchWeekClocks();
  }, []);

  // --- AQUÍ ESTABA EL ERROR: AHORA SÍ TOMA LA FOTO GPS ---
  const handleIn = () => {
    if (new Date().getDay() === 0) {
      alert("It's Sunday! No work allowed today. Go rest! 😴");
      return;
    }

    if (!timerRunning) {
      // 1. INTENTAMOS OBTENER UBICACIÓN (FOTO INSTANTÁNEA)
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            // ÉXITO: Tenemos coordenadas, las mandamos
            performClockIn(position.coords.latitude, position.coords.longitude);
          },
          (error) => {
            // ERROR: No hay permiso o GPS apagado -> Mandamos null pero dejamos trabajar
            console.warn("GPS Error:", error);
            performClockIn(null, null);
          },
          { timeout: 5000, enableHighAccuracy: true } // 5 segundos máximo para buscar satélite
        );
      } else {
        // Navegador no soporta GPS
        performClockIn(null, null);
      }
    }
  };

  // Función auxiliar para guardar en BD (Con o Sin coordenadas)
  const performClockIn = async (lat: number | null, lng: number | null) => {
      const user = auth.currentUser;
      if (!user) return;

      // Iniciar UI del Timer
      setTimerRunning(true);
      setTimerSeconds(0);
      startTimeRef.current = new Date();
      if (timerInterval.current) clearInterval(timerInterval.current);
      timerInterval.current = window.setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);

      const dateISO = getTodayISO();
      
      // Guardar en Firebase CON LOCATION (Si existe)
      await saveClockIn({
        userId: user.uid,
        userName: user.displayName ?? user.email ?? null,
        dateISO,
        inTime: startTimeRef.current.toISOString(),
        location: (lat && lng) ? { lat, lng } : undefined // <--- ESTO FALTABA
      });
  };

  async function handleOut() {
    if (timerRunning) {
      setTimerRunning(false);
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
      const user = auth.currentUser;
      if (!user) {
        setTimerSeconds(0);
        return;
      }
      const dateISO = getTodayISO();
      const outDate = new Date();
      await saveClockOut({
        userId: user.uid,
        dateISO,
        outTime: outDate.toISOString(),
      });
      await fetchWeekClocks();
      setTimerSeconds(0);
    }
  }

  function formatTimerDisplay(secs: number) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? h + ':' : ''}${pad(m)}:${pad(s)}`;
  }

  const totalSecondsWeek = weekSeconds.reduce((a, b) => a + b, 0);

  return (
    <div className="wtp-container">
      {/* HEADER */}
      <div className="wtp-header">
        <button className="wtp-back-btn" onClick={onBack}>
          <IonIcon icon={chevronBackOutline} />
        </button>
        <span className="wtp-title">Time Tracker</span>
        <div style={{ width: 40 }}></div> 
      </div>

      <div className="wtp-scroll-content">
        
        {/* TIMER CARD */}
        <div className={`wtp-timer-card ${timerRunning ? 'active-pulse' : ''}`}>
           <div className="wtp-timer-status">
              <div className={`status-dot ${timerRunning ? 'blink' : ''}`}></div>
              <span>{timerRunning ? "ON THE CLOCK" : (isSunday ? "SUNDAY OFF" : "READY TO WORK")}</span>
           </div>
           
           <div className="wtp-timer-digits">
              {formatTimerDisplay(timerSeconds)}
           </div>

           <div className="wtp-timer-label">Today's Session</div>
        </div>

        {/* CONTROLES */}
        <div className="wtp-controls">
          <button
            className={`wtp-btn btn-start ${timerRunning || isSunday ? "disabled" : ""}`}
            onClick={!timerRunning && !isSunday ? handleIn : undefined} // Llama a handleIn que busca GPS
            disabled={timerRunning || isSunday}
          >
            <div className="btn-icon-bg"><IonIcon icon={playOutline} /></div>
            <span>{isSunday ? "Closed" : "Clock In"}</span>
          </button>
          
          <button
            className={`wtp-btn btn-stop ${!timerRunning ? "disabled" : ""}`}
            onClick={timerRunning ? handleOut : undefined}
            disabled={!timerRunning}
          >
             <div className="btn-icon-bg"><IonIcon icon={stopOutline} /></div>
             <span>Clock Out</span>
          </button>
        </div>

        {/* LISTA SEMANAL */}
        <div className="wtp-week-section">
            <div className="section-header">
                <IonIcon icon={calendarOutline} />
                <span>Weekly History</span>
            </div>
            
            <div className="wtp-list-card">
            {daysOfWeek.map((day, idx) => {
                const secs = weekSeconds[idx];
                const hasWork = secs > 0;
                return (
                <div
                    key={day}
                    className="wtp-list-row"
                    onClick={() => hasWork && setOpenDay(day)}
                >
                    <span className="row-day">{day}</span>
                    <div className={`row-time ${hasWork ? 'has-data' : ''}`}>
                        {hasWork ? formatFriendlyDuration(secs) : "—"}
                    </div>
                </div>
                );
            })}
            </div>
        </div>
      </div>

      {/* BARRA INFERIOR */}
      <div className="wtp-bottom-bar">
        <span className="total-label">Total This Week</span>
        <span className="total-number">{formatFriendlyDuration(totalSecondsWeek)}</span>
      </div>

      {/* MODAL DETALLE */}
      {openDay && (
        <div className="wtp-modal-overlay" onClick={() => setOpenDay(null)}>
          <div className="wtp-modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle"></div>
            <div className="wtp-modal-header">
              <span className="modal-title">{openDay}</span>
              <button className="modal-close" onClick={() => setOpenDay(null)}>
                <IonIcon icon={closeOutline} />
              </button>
            </div>
            
            <div className="wtp-modal-body">
              <div className="big-stat-circle">
                 <IonIcon icon={timeOutline} />
                 <span className="big-time-text">
                    {formatFriendlyDuration(weekSeconds[daysOfWeek.indexOf(openDay)])}
                 </span>
                 <span className="big-time-label">Hours Logged</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerTimePanel;