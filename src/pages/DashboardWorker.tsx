import React, { useState, useEffect } from "react";
import "./DashboardWorker.css"; // Usaremos el CSS mejorado
import { IonIcon } from "@ionic/react";
import {
  timeOutline,
  chatbubbleEllipsesOutline,
  settingsOutline,
  logOutOutline,
  homeOutline,
  listOutline,       // Icono Tareas
  timerOutline,      // Icono Reloj (Diferente al del menu para variar)
  addOutline,
  trashOutline,
  personOutline,
  notificationsOutline,
  helpCircleOutline,
  closeOutline,
} from "ionicons/icons";
import { useHistory } from "react-router-dom";
import { signOut } from "firebase/auth";
// IMPORTANTE: Conexión a Firebase DB
import { auth, db } from "../firebase";
import { doc, setDoc, onSnapshot, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";

import WorkerTimePanel from "../components/WorkerTimePanel";
import ChatPanel from "../components/ChatPanel"; 
// Importamos el Clima Premium
import WeatherCard from "../components/WeatherCard";

interface DashboardWorkerProps { fullName: string | null; }

const WEATHER_API_KEY = import.meta.env.VITE_OPENWEATHERMAP_KEY;
const WEATHER_CITY = "Bakersfield,US";

const DashboardWorker: React.FC<DashboardWorkerProps> = ({ fullName }) => {
  const history = useHistory();
  const [activeTab, setActiveTab] = useState<"home"|"time"|"chat">("home");
  
  // Modales
  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false); // Modal de Tareas

  // Clima
  const [weather, setWeather] = useState<any>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  // Tareas (Persistencia en Firebase)
  const [tasks, setTasks] = useState<string[]>([]);
  const [newTaskInput, setNewTaskInput] = useState("");

  // --- 🔥 LÓGICA FIREBASE PARA TAREAS (Igual que el Boss) ---
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const userDocRef = doc(db, "users", user.uid);

    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Usamos el mismo campo 'bossTasks' o puedes cambiarlo a 'workerTasks' si quieres separarlos,
        // pero como cada usuario tiene su propio documento, 'tasks' o 'personalTasks' está bien.
        // Usaremos 'personalTasks' para diferenciarlo semánticamente.
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
      await updateDoc(userDocRef, {
        personalTasks: arrayUnion(taskToAdd)
      });
    } catch (error) { console.error("Error adding task:", error); }
  };

  const deleteTask = async (taskToDelete: string) => {
    const user = auth.currentUser;
    if (!user) return;
    const newTasks = tasks.filter(t => t !== taskToDelete);
    setTasks(newTasks);

    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        personalTasks: arrayRemove(taskToDelete)
      });
    } catch (error) { console.error("Error deleting task:", error); }
  };
  // --- FIN LÓGICA FIREBASE ---

  const handleLogoutClick = () => setShowConfirm(true);
  
  const handleConfirmYes = async () => {
    setShowConfirm(false);
    setShowModal(false);
    await signOut(auth);
    history.replace("/login");
  };

  // Fetch Clima
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

  return (
    <div className="ios-container">
      {/* HEADER */}
      {activeTab === "home" && (
        <header className="ios-navbar">
          <h1 className="ios-title">Rangel Valley</h1>
          <div className="ios-gear" onClick={()=>setShowModal(true)}><IonIcon icon={settingsOutline}/></div>
        </header>
      )}

      <main className="ios-main">
        {/* HOME TAB */}
        {activeTab === "home" && (
          <div className="welcome-card">
            
            {/* Saludo Estilo iOS */}
            <div style={{ textAlign: 'left', paddingLeft: '5px', marginBottom: '15px' }}>
              <h2 style={{color: "#1c1c1e", fontSize: '28px', fontWeight: '700', margin: 0}}>
                {fullName ? fullName.split(' ')[0] : "Worker"}
              </h2>
              <span style={{ color: '#8e8e93', fontSize: '14px', fontWeight: '500' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
            </div>

            {/* WEATHER CARD PREMIUM */}
            <WeatherCard weather={weather} loading={weatherLoading} />

            {/* GRID DE ACCIONES */}
            <div className="quick-actions-grid">
              
              {/* Botón 1: Tareas Personales */}
              <div className="action-card" onClick={() => setShowTasksModal(true)}>
                <IonIcon icon={listOutline} className="grid-icon" />
                <span className="action-label">My Tasks</span>
                {tasks.length > 0 && (
                  <span className="action-badge">{tasks.length}</span>
                )}
              </div>

              {/* Botón 2: Acceso Directo al Reloj (Clock In/Out) */}
              <div className="action-card" onClick={() => setActiveTab("time")}>
                <IonIcon icon={timerOutline} className="grid-icon" />
                <span className="action-label">Time Clock</span>
              </div>

            </div>
          </div>
        )}

        {/* TIME PANEL (Intacto, lógica de trabajador) */}
        {activeTab === "time" && <WorkerTimePanel userName={fullName} onBack={()=>setActiveTab("home")} />}
        
        {/* CHAT */}
        {activeTab === "chat" && (
          <ChatPanel 
            onBack={() => setActiveTab("home")} 
            userName={fullName} 
          />
        )}
      </main>

      {/* TAB BAR */}
      <nav className="ios-tabbar">
        <div className={`tab-item ${activeTab==="home"?"active-tab":""}`} onClick={()=>setActiveTab("home")}>
          <IonIcon icon={homeOutline}/><span>Home</span>
        </div>
        <div className={`tab-item ${activeTab==="time"?"active-tab":""}`} onClick={()=>setActiveTab("time")}>
          <IonIcon icon={timeOutline}/><span>Time</span>
        </div>
        <div className={`tab-item ${activeTab==="chat"?"active-tab":""}`} onClick={()=>setActiveTab("chat")}>
          <IonIcon icon={chatbubbleEllipsesOutline}/><span>Chat</span>
        </div>
      </nav>
      
      {/* MODALES */}

      {/* 1. SETTINGS (Estilo Agrupado) */}
      {showModal && (
        <div className="settings-modal-bg modal-show" onClick={()=>setShowModal(false)}>
          <div className="settings-modal-sheet modal-show" onClick={e=>e.stopPropagation()}>
             <div style={{padding: '10px 0', textAlign: 'center', color: '#8e8e93', fontSize: '12px'}}>Settings</div>
             <div className="settings-group">
                <div className="settings-option">
                   <IonIcon icon={personOutline} /><span>Profile</span>
                </div>
                <div className="settings-option">
                   <IonIcon icon={notificationsOutline} /><span>Notifications</span>
                </div>
                <div className="settings-option">
                   <IonIcon icon={helpCircleOutline} /><span>Support</span>
                </div>
             </div>
             <div className="settings-group">
                <div className="settings-option logout-opt" onClick={handleLogoutClick}>
                  <IonIcon icon={logOutOutline}/><span>Log out</span>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* 2. CONFIRM LOGOUT */}
      {showConfirm && (
        <div className="confirm-modal-bg modal-show" onClick={()=>setShowConfirm(false)}>
          <div className="confirm-modal-sheet modal-show" onClick={e=>e.stopPropagation()}>
            <div className="confirm-modal-message">Log out?</div>
            <div className="confirm-modal-actions">
              <div className="confirm-btn yes" onClick={handleConfirmYes}>Yes</div>
              <div className="confirm-btn no" onClick={()=>setShowConfirm(false)}>No</div>
            </div>
          </div>
        </div>
      )}

      {/* 3. TASKS MODAL */}
      {showTasksModal && (
        <div className="settings-modal-bg modal-show" style={{justifyContent: 'flex-end'}} onClick={() => setShowTasksModal(false)}>
          <div className="tasks-modal-content" onClick={e=>e.stopPropagation()}>
            <div className="tasks-header">
              <h2>My Tasks</h2>
              <div onClick={() => setShowTasksModal(false)} style={{fontSize: '24px', color: '#8e8e93', cursor:'pointer'}}>
                <IonIcon icon={closeOutline}/>
              </div>
            </div>
            <div className="tasks-list">
              {tasks.length === 0 ? (
                <div style={{textAlign: 'center', color: '#8e8e93', marginTop: '50px'}}>
                  No tasks yet.
                </div>
              ) : (
                tasks.map((task, index) => (
                  <div key={index} className="task-item">
                    <span className="task-text">{task}</span>
                    <button className="delete-task-btn" onClick={() => deleteTask(task)}>
                      <IonIcon icon={trashOutline} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="add-task-bar">
              <input 
                type="text" 
                className="add-task-input" 
                placeholder="New task..."
                value={newTaskInput}
                onChange={(e) => setNewTaskInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
              />
              <button className="add-task-btn" onClick={addTask}>
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