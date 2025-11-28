import React, { useState, useRef, useEffect } from "react";
import "./WorkerTimePanel.css";
import { auth } from "../firebase";
import { IonIcon } from "@ionic/react";
import { chevronBackOutline, closeOutline } from "ionicons/icons";
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
  
  const [weekSeconds, setWeekSeconds] = useState<number[]>(
    Array(daysOfWeek.length).fill(0)
  );
  
  const timerInterval = useRef<number | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  // Detectar si hoy es domingo (0 = Domingo)
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

  async function handleIn() {
    // --- PROTECCIÓN DE DOMINGO ---
    if (new Date().getDay() === 0) {
      alert("It's Sunday! No work allowed today. Go rest! 😴");
      return;
    }
    // -----------------------------

    if (!timerRunning) {
      const user = auth.currentUser;
      if (!user) return;
      setTimerRunning(true);
      setTimerSeconds(0);
      startTimeRef.current = new Date();
      if (timerInterval.current) clearInterval(timerInterval.current);
      timerInterval.current = window.setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
      const dateISO = getTodayISO();
      await saveClockIn({
        userId: user.uid,
        userName: user.displayName ?? user.email ?? null,
        dateISO,
        inTime: startTimeRef.current.toISOString(),
      });
    }
  }

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
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  }

  const totalSecondsWeek = weekSeconds.reduce((a, b) => a + b, 0);

  return (
    <div className="time-panel-worker">
      {/* HEADER */}
      <div className="time-header">
        <button className="back-btn-icon" onClick={onBack}>
          <IonIcon icon={chevronBackOutline} />
        </button>
        <span className="header-title">Time Clock</span>
        <div style={{ width: 32 }}></div> 
      </div>

      {/* CONTENIDO SCROLLABLE */}
      <div className="scrollable-content">
        
        {/* CRONÓMETRO GIGANTE */}
        <div className="timer-display-container">
          <div className={`timer-status ${timerRunning ? 'active' : ''}`}>
            {timerRunning ? "CURRENTLY WORKING" : (isSunday ? "ENJOY YOUR SUNDAY" : "READY TO START")}
          </div>
          <div className="main-timer">
            {formatTimerDisplay(timerSeconds)}
          </div>
        </div>

        {/* BOTONES */}
        <div className="btn-row">
          <button
            className={`action-btn clock-in ${timerRunning || isSunday ? "disabled" : ""}`}
            onClick={!timerRunning && !isSunday ? handleIn : undefined}
            disabled={timerRunning || isSunday}
          >
            {isSunday ? "Sunday Off" : "Clock In"}
          </button>
          
          <button
            className={`action-btn clock-out ${!timerRunning ? "disabled" : ""}`}
            onClick={timerRunning ? handleOut : undefined}
            disabled={!timerRunning}
          >
            Clock Out
          </button>
        </div>

        {/* LISTA SEMANAL */}
        <h3 className="section-title">This Week</h3>
        <div className="week-list-container">
          {daysOfWeek.map((day, idx) => {
            const secs = weekSeconds[idx];
            const hasWork = secs > 0;
            return (
              <div
                key={day}
                className="week-row"
                onClick={() => hasWork && setOpenDay(day)}
              >
                <span className="day-label">{day}</span>
                <span className={`day-time ${hasWork ? 'filled' : 'empty'}`}>
                  {hasWork ? formatFriendlyDuration(secs) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* BARRA INFERIOR FIJA (WEEKLY TOTAL) */}
      <div className="bottom-total-bar">
        <span className="total-label-small">Weekly Total</span>
        <span className="total-value-large">{formatFriendlyDuration(totalSecondsWeek)}</span>
      </div>

      {/* MODAL DETALLE */}
      {openDay && (
        <div className="day-modal-overlay" onClick={() => setOpenDay(null)}>
          <div className="day-modal" onClick={e => e.stopPropagation()}>
            <div className="day-modal-header">
              <span>{openDay}</span>
              <button className="modal-close-icon" onClick={() => setOpenDay(null)}>
                <IonIcon icon={closeOutline} />
              </button>
            </div>
            <div className="day-modal-content">
              <span className="modal-big-time">
                {formatFriendlyDuration(weekSeconds[daysOfWeek.indexOf(openDay)])}
              </span>
              <span className="modal-subtitle">Total logged time</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerTimePanel;