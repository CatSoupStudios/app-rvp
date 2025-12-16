import React, { useState, useEffect } from "react";
import "./DashboardBoss.css"; 
import { IonIcon } from "@ionic/react";
import {
  timeOutline, // REGRESA EL RELOJ
  chatbubbleEllipsesOutline,
  sparklesOutline,
  settingsOutline,
  logOutOutline,
  homeOutline,
  listOutline,
  peopleOutline,
  addOutline,
  trashOutline,
  personOutline,
  notificationsOutline,
  closeOutline,
  arrowForwardOutline,
  briefcaseOutline,
  imagesOutline
} from "ionicons/icons";
import { useHistory } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc, onSnapshot, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";

// COMPONENTES
import GPTProChat from "../components/GPTProChat";
import BossTimePanel from "../components/BossTimePanel"; 
import ChatPanel from "../components/ChatPanel"; 
import WeatherCard from "../components/WeatherCard";
import CrewPanel from "../components/CrewPanel";
import ProjectsPanel from "../components/ProjectsPanel"; 
import GalleryPanel from "../components/GalleryPanel"; 

interface DashboardBossProps {
  fullName: string | null;
  initialWorkTimes?: any[]; 
}

const WEATHER_API_KEY = import.meta.env.VITE_OPENWEATHERMAP_KEY;
const WEATHER_CITY = "Bakersfield,US";

const DashboardBoss: React.FC<DashboardBossProps> = ({ fullName, initialWorkTimes = [] }) => {
  const history = useHistory();
  const [activeTab, setActiveTab] = useState<"home" | "time" | "chat" | "crew" | "projects" | "gallery">("home");
  
  const [hideDock, setHideDock] = useState(false);
  const [showModal, setShowModal] = useState(false); 
  const [showConfirm, setShowConfirm] = useState(false);
  const [showProChat, setShowProChat] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false); 

  const [weather, setWeather] = useState<any>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [tasks, setTasks] = useState<string[]>([]);
  const [newTaskInput, setNewTaskInput] = useState("");

  // --- LÓGICA ---
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const userDocRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setTasks(docSnap.data().bossTasks || []);
      } else {
        setDoc(userDocRef, { bossTasks: [] }, { merge: true });
      }
    });
    return () => unsubscribe();
  }, []);

  const addTask = async () => {
    if (!newTaskInput.trim()) return;
    const user = auth.currentUser;
    if (!user) return;
    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { bossTasks: arrayUnion(newTaskInput) });
      setNewTaskInput("");
    } catch (error) { console.error("Error saving task:", error); }
  };

  const deleteTask = async (taskToDelete: string) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { bossTasks: arrayRemove(taskToDelete) });
    } catch (error) { console.error("Error deleting task:", error); }
  };

  const handleModalOpen = () => setShowModal(true);
  const handleModalClose = () => setShowModal(false);
  const handleLogoutClick = () => setShowConfirm(true);
  const handleConfirmYes = async () => { setShowConfirm(false); setShowModal(false); await signOut(auth); history.replace("/login"); };
  const handleConfirmNo = () => setShowConfirm(false);

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
    if (activeTab === "projects") return "Projects & Invoices";
    if (activeTab === "crew") return "Staff Directory";
    if (activeTab === "chat") return "Messages";
    if (activeTab === "gallery") return "Job Gallery";
    return "Timesheets & Map";
  };

  const shouldHideDock = hideDock || activeTab === "chat" || showProChat;

  return (
    <div className="db-container">
      
      {!shouldHideDock && (
        <header className="db-header">
          <span className="db-brand">{getTitle()}</span>
          <button className="db-btn-icon" onClick={handleModalOpen}>
            <IonIcon icon={settingsOutline} />
          </button>
        </header>
      )}

      <main className="db-content">
        {activeTab === "home" && (
          <div className="fade-enter">
            <div className="welcome-block">
              <span className="welcome-sub">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric' })}
              </span>
              <h2 className="welcome-title">
                Hello, {fullName ? fullName.split(' ')[0] : "Boss"}.
              </h2>
            </div>

            <div className="component-wrapper">
               <WeatherCard weather={weather} loading={weatherLoading} />
            </div>

            {/* --- GRID PRINCIPAL (AHORA DE 4 ELEMENTOS) --- */}
            <div className="premium-grid">
              
              {/* 1. PROJECTS */}
              <div className="premium-card card-projects" onClick={() => setActiveTab("projects")}>
                <div className="card-top">
                  <div className="card-icon-bubble bubble-orange">
                    <IonIcon icon={briefcaseOutline} />
                  </div>
                  <IonIcon icon={arrowForwardOutline} className="card-arrow" />
                </div>
                <div className="card-meta">
                  <h3>Projects</h3>
                  <p>Invoices & Costs</p>
                </div>
              </div>

              {/* 2. CREW */}
              <div className="premium-card card-crew" onClick={() => setActiveTab("crew")}>
                <div className="card-top">
                  <div className="card-icon-bubble bubble-blue">
                    <IonIcon icon={peopleOutline} />
                  </div>
                  <IonIcon icon={arrowForwardOutline} className="card-arrow" />
                </div>
                <div className="card-meta">
                  <h3>Crew</h3>
                  <p>Staff Directory</p>
                </div>
              </div>

              {/* 3. GALLERY (NUEVO CUADRITO) */}
              <div className="premium-card card-gallery" onClick={() => setActiveTab("gallery")}>
                <div className="card-top">
                  <div className="card-icon-bubble bubble-purple">
                    <IonIcon icon={imagesOutline} />
                  </div>
                  <IonIcon icon={arrowForwardOutline} className="card-arrow" />
                </div>
                <div className="card-meta">
                  <h3>Gallery</h3>
                  <p>Project Photos</p>
                </div>
              </div>

              {/* 4. TASKS */}
              <div className="premium-card card-tasks" onClick={() => setShowTasksModal(true)}>
                <div className="card-top">
                  <div className="card-icon-bubble bubble-dark">
                    <IonIcon icon={listOutline} />
                  </div>
                  <IonIcon icon={arrowForwardOutline} className="card-arrow" />
                </div>
                <div className="card-meta">
                  <h3>Tasks</h3>
                  <p>{tasks.length > 0 ? `${tasks.length} Pending` : "To-Do List"}</p>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* RENDERIZADO DE PANELES */}
        {activeTab === "time" && <BossTimePanel workTimes={initialWorkTimes} />}
        {activeTab === "crew" && <CrewPanel />}
        {activeTab === "chat" && <ChatPanel onBack={() => setActiveTab("home")} userName={fullName} />}
        {activeTab === "projects" && <ProjectsPanel onHideDock={setHideDock} userName={fullName} />}
        {activeTab === "gallery" && <GalleryPanel onHideDock={setHideDock} />}
        
        {showProChat && <GPTProChat userName={fullName || "User"} onClose={() => setShowProChat(false)} />}
      </main>

      {/* DOCK FLOTANTE - REGRESAMOS EL RELOJ */}
      <nav className={`glass-dock ${shouldHideDock ? 'dock-hidden' : ''}`}>
        <div className={`dock-icon ${activeTab==="home"?"active":""}`} onClick={()=>setActiveTab("home")}>
          <IonIcon icon={homeOutline} />
        </div>
        
        <div className={`dock-icon ${activeTab==="projects"?"active":""}`} onClick={()=>setActiveTab("projects")}>
          <IonIcon icon={briefcaseOutline} />
        </div>

        <div className="dock-fab-pro" onClick={()=>setShowProChat(true)}>
          <IonIcon icon={sparklesOutline} />
        </div>
        
        {/* AQUI REGRESA TU MAPA/TIEMPO */}
        <div className={`dock-icon ${activeTab==="time"?"active":""}`} onClick={()=>setActiveTab("time")}>
          <IonIcon icon={timeOutline} />
        </div>
        
        <div className={`dock-icon ${activeTab==="chat"?"active":""}`} onClick={()=>setActiveTab("chat")}>
          <IonIcon icon={chatbubbleEllipsesOutline} />
        </div>
      </nav>

      {/* MODALES */}
      {showModal && (
        <div className="modal-overlay" onClick={handleModalClose}>
          <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
             <div style={{width: '40px', height: '4px', background: '#e0e0e0', borderRadius: '4px', margin: '0 auto 25px auto'}}></div>
             <div className="settings-item"> <IonIcon icon={personOutline} /><span>Profile</span> </div>
             <div className="settings-item"> <IonIcon icon={notificationsOutline} /><span>Notifications</span> </div>
             <div className="settings-item danger" onClick={handleLogoutClick}> <IonIcon icon={logOutOutline} /><span>Log out</span> </div>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="modal-overlay center" onClick={handleConfirmNo}>
          <div style={{background: 'white', padding: '30px', borderRadius: '24px', width: '280px', textAlign: 'center'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{marginTop: 0, fontWeight: 800}}>Sign Out?</h3>
            <p style={{color: '#666', marginBottom: '25px'}}>Are you sure you want to exit?</p>
            <div style={{display: 'flex', gap: '10px'}}>
              <button style={{flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#f5f5f7', fontWeight: 600, cursor: 'pointer'}} onClick={handleConfirmNo}>Cancel</button>
              <button style={{flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#111', color: 'white', fontWeight: 600, cursor: 'pointer'}} onClick={handleConfirmYes}>Yes</button>
            </div>
          </div>
        </div>
      )}

      {showTasksModal && (
        <div className="modal-overlay" style={{zIndex: 9999}} onClick={() => setShowTasksModal(false)}>
          <div className="modal-full" onClick={e=>e.stopPropagation()}>
            <div className="tasks-header">
              <h2>My Tasks</h2>
              <div onClick={() => setShowTasksModal(false)} style={{cursor:'pointer', fontSize: '24px'}}><IonIcon icon={closeOutline}/></div>
            </div>
            <div className="tasks-body">
              {tasks.length === 0 ? (
                <div style={{textAlign: 'center', color: '#999', marginTop: '50px'}}>No pending tasks.</div>
              ) : (
                tasks.map((task, index) => (
                  <div key={index} className="task-pill">
                    <span style={{flex: 1}}>{task}</span>
                    <div onClick={() => deleteTask(task)} style={{color: '#ff3b30', cursor: 'pointer', padding: '5px'}}><IonIcon icon={trashOutline} /></div>
                  </div>
                ))
              )}
            </div>
            <div className="task-input-bar">
              <input type="text" placeholder="Add new task..." value={newTaskInput} onChange={(e) => setNewTaskInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} />
              <button className="task-add-btn" onClick={addTask}><IonIcon icon={addOutline} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default DashboardBoss;