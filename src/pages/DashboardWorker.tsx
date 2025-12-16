import React, { useState, useEffect } from "react";
import "./DashboardWorker.css"; 
import { IonIcon } from "@ionic/react";
import {
  timeOutline,
  chatbubbleEllipsesOutline,
  settingsOutline,
  logOutOutline,
  homeOutline,
  listOutline,
  timerOutline,
  addOutline,
  trashOutline,
  personOutline,
  notificationsOutline,
  closeOutline,
  arrowForwardOutline,
  briefcaseOutline
} from "ionicons/icons";
import { useHistory } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc, onSnapshot, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";

import WorkerTimePanel from "../components/WorkerTimePanel";
import ChatPanel from "../components/ChatPanel"; 
import WeatherCard from "../components/WeatherCard";

interface DashboardWorkerProps { fullName: string | null; }

const WEATHER_API_KEY = import.meta.env.VITE_OPENWEATHERMAP_KEY;
const WEATHER_CITY = "Bakersfield,US";

const DashboardWorker: React.FC<DashboardWorkerProps> = ({ fullName }) => {
  const history = useHistory();
  const [activeTab, setActiveTab] = useState<"home"|"time"|"chat">("home");
  
  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);

  const [weather, setWeather] = useState<any>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  const [tasks, setTasks] = useState<string[]>([]);
  const [newTaskInput, setNewTaskInput] = useState("");

  // --- LÓGICA FIREBASE (INTACTA) ---
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const userDocRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTasks(data.personalTasks || []);
      } else {
        setDoc(userDocRef, { personalTasks: [] }, { merge: true });
      }
    });
    return () => unsubscribe();
  }, []);

  const addTask = async () => {
    if (!newTaskInput.trim()) return;
    const user = auth.currentUser;
    if (!user) return;
    const taskToAdd = newTaskInput;
    setNewTaskInput("");
    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { personalTasks: arrayUnion(taskToAdd) });
    } catch (error) { console.error("Error adding task:", error); }
  };

  const deleteTask = async (taskToDelete: string) => {
    const user = auth.currentUser;
    if (!user) return;
    const newTasks = tasks.filter(t => t !== taskToDelete);
    setTasks(newTasks);
    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { personalTasks: arrayRemove(taskToDelete) });
    } catch (error) { console.error("Error deleting task:", error); }
  };

  const handleLogoutClick = () => setShowConfirm(true);
  const handleConfirmYes = async () => {
    setShowConfirm(false); setShowModal(false);
    await signOut(auth);
    history.replace("/login");
  };

  useEffect(() => {
    setWeatherLoading(true);
    const fetchWeather = async () => {
      try {
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${WEATHER_CITY}&appid=${WEATHER_API_KEY}&units=metric`);
        const data = await res.json();
        if (data.cod === 200) {
          setWeather({
            city: data.name,
            temp: data.main.temp,
            tempMin: data.main.temp_min,
            tempMax: data.main.temp_max,
            desc: data.weather[0].description,
            icon: data.weather[0].icon,
          });
        }
      } catch (e) { setWeather(null); }
      setWeatherLoading(false);
    };
    fetchWeather();
  }, []);

  const getTitle = () => {
    if (activeTab === "home") return "Rangel Valley";
    if (activeTab === "time") return "Time Clock";
    return "Team Chat";
  };

  return (
    <div className="dw-container">
      
      {/* HEADER (Solo visible si no es chat, igual que Boss) */}
      {activeTab !== "chat" && (
        <header className="dw-header">
          <span className="dw-brand">{getTitle()}</span>
          <button className="dw-btn-icon" onClick={()=>setShowModal(true)}>
            <IonIcon icon={settingsOutline} />
          </button>
        </header>
      )}

      <main className="dw-content">
        {activeTab === "home" && (
          <div className="fade-enter">
            
            {/* WELCOME SECTION */}
            <div className="welcome-block">
              <span className="welcome-sub">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric' })}
              </span>
              <h2 className="welcome-title">
                Hello, {fullName ? fullName.split(' ')[0] : "Worker"}.
              </h2>
            </div>

            {/* WEATHER CARD */}
            <div className="component-wrapper">
               <WeatherCard weather={weather} loading={weatherLoading} />
            </div>

            {/* BENTO GRID (Estilo Premium) */}
            <div className="premium-grid">
              
              {/* CARD 1: TIME CLOCK (Acceso rápido) */}
              <div className="premium-card card-clock" onClick={() => setActiveTab("time")}>
                <div className="card-top">
                  <div className="card-icon-bubble bubble-orange">
                    <IonIcon icon={timerOutline} />
                  </div>
                  <IonIcon icon={arrowForwardOutline} className="card-arrow" />
                </div>
                <div className="card-meta">
                  <h3>Time Clock</h3>
                  <p>Log your hours</p>
                </div>
              </div>

              {/* CARD 2: MY TASKS */}
              <div className="premium-card card-tasks" onClick={() => setShowTasksModal(true)}>
                <div className="card-top">
                  <div className="card-icon-bubble bubble-purple">
                    <IonIcon icon={listOutline} />
                  </div>
                  <IonIcon icon={arrowForwardOutline} className="card-arrow" />
                </div>
                <div className="card-meta">
                  <h3>My Tasks</h3>
                  <p>{tasks.length > 0 ? `${tasks.length} Pending` : "All clear"}</p>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* PANELES DE CONTENIDO */}
        {activeTab === "time" && <WorkerTimePanel userName={fullName} onBack={()=>setActiveTab("home")} />}
        {activeTab === "chat" && <ChatPanel onBack={() => setActiveTab("home")} userName={fullName} />}
      </main>

      {/* DOCK FLOTANTE (Navegación) */}
      <nav className="glass-dock">
        <div className={`dock-icon ${activeTab==="home"?"active":""}`} onClick={()=>setActiveTab("home")}>
          <IonIcon icon={homeOutline} />
        </div>
        
        {/* Botón Central: TIME */}
        <div className="dock-fab-main" onClick={()=>setActiveTab("time")}>
          <IonIcon icon={timeOutline} />
        </div>

        <div className={`dock-icon ${activeTab==="chat"?"active":""}`} onClick={()=>setActiveTab("chat")}>
          <IonIcon icon={chatbubbleEllipsesOutline} />
        </div>
      </nav>
      
      {/* MODALES ESTILIZADOS */}

      {/* SETTINGS */}
      {showModal && (
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
             <div className="sheet-handle"></div>
             <div className="settings-item"> <IonIcon icon={personOutline} /><span>Profile</span> </div>
             <div className="settings-item"> <IonIcon icon={notificationsOutline} /><span>Notifications</span> </div>
             <div className="settings-item danger" onClick={handleLogoutClick}> <IonIcon icon={logOutOutline} /><span>Log out</span> </div>
          </div>
        </div>
      )}

      {/* CONFIRM LOGOUT */}
      {showConfirm && (
        <div className="modal-overlay center" onClick={()=>setShowConfirm(false)}>
          <div className="confirm-card" onClick={e=>e.stopPropagation()}>
            <h3>Log out?</h3>
            <div className="confirm-actions">
               <button className="btn-cancel" onClick={()=>setShowConfirm(false)}>No</button>
               <button className="btn-confirm" onClick={handleConfirmYes}>Yes</button>
            </div>
          </div>
        </div>
      )}

      {/* TASKS MODAL */}
      {showTasksModal && (
        <div className="modal-overlay" style={{zIndex: 9999}} onClick={() => setShowTasksModal(false)}>
          <div className="modal-full" onClick={e=>e.stopPropagation()}>
            <div className="tasks-header">
              <h2>Personal Tasks</h2>
              <div onClick={() => setShowTasksModal(false)} className="close-icon"><IonIcon icon={closeOutline}/></div>
            </div>
            <div className="tasks-body">
              {tasks.length === 0 ? (
                <div className="empty-tasks">
                  <IonIcon icon={briefcaseOutline} />
                  <p>No tasks yet.</p>
                </div>
              ) : (
                tasks.map((task, index) => (
                  <div key={index} className="task-pill">
                    <span className="task-txt">{task}</span>
                    <button className="del-btn" onClick={() => deleteTask(task)}>
                      <IonIcon icon={trashOutline} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="task-input-bar">
              <input 
                type="text" 
                placeholder="New task..."
                value={newTaskInput}
                onChange={(e) => setNewTaskInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
              />
              <button className="add-btn" onClick={addTask}>
                <IonIcon icon={addOutline} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default DashboardWorker;