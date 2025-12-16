import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { IonIcon } from "@ionic/react";
import { 
  timeOutline, 
  cashOutline, 
  personOutline, 
  alertCircleOutline,
  briefcaseOutline,
  locationOutline,
  closeOutline,
  mapOutline,
  moonOutline // Icono para cuando descansan
} from "ionicons/icons";
import "./BossTimePanel.css";

// --- MAPA (Leaflet) ---
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- INTERFACES ---
interface LocationCoords {
  lat: number;
  lng: number;
}

interface WorkTime {
  userId: string;
  inTime: string;
  outTime?: string | null; 
  id?: string;
  location?: LocationCoords;
}

interface WorkerData {
  uid: string;
  nameAndLastName: string;
  email: string;
  hourlyPay: string;
  role: string;
}

interface WorkerStats {
  isActive: boolean;
  totalHours: string;
  totalPay: string;
  lastLocation: LocationCoords | null;
}

interface BossTimePanelProps {
  workTimes: any[];
}

const BossTimePanel: React.FC<BossTimePanelProps> = ({ workTimes }) => {
  const [workers, setWorkers] = useState<WorkerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<WorkerData | null>(null);

  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        setLoading(true);
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("role", "==", "worker")); 
        const snapshot = await getDocs(q);
        
        const workersList: WorkerData[] = snapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        } as WorkerData));

        setWorkers(workersList);
      } catch (err) {
        console.error("Error fetching workers:", err);
        setError("Could not load staff list.");
      } finally {
        setLoading(false);
      }
    };
    fetchWorkers();
  }, []);

  // --- LÓGICA CORREGIDA PARA MAPA ---
  const getWorkerStats = (uid: string, hourlyPayStr: string): WorkerStats => {
    const hourlyPay = parseFloat(hourlyPayStr) || 0;
    const userTimes = (workTimes as WorkTime[]).filter(t => t.userId === uid);

    let totalSeconds = 0;
    let isActive = false;
    let lastLocation: LocationCoords | null = null;

    userTimes.forEach((t) => {
      if (!t.inTime) return;

      // CAMBIO IMPORTANTE: 
      // Solo nos importa la ubicación si el turno sigue ABIERTO (!outTime).
      // Si ya hizo ClockOut, ignoramos la ubicación histórica para limpiar el mapa.
      
      if (!t.outTime) {
        isActive = true;
        // Solo si está activo y tiene ubicación, la guardamos
        if (t.location) {
            lastLocation = t.location;
        }
      } else {
        // Cálculo de horas (Histórico)
        const startMs = new Date(t.inTime).getTime();
        const endMs = new Date(t.outTime).getTime();
        if (endMs > startMs) {
          totalSeconds += (endMs - startMs) / 1000;
        }
      }
    });

    const totalHours = totalSeconds / 3600;
    const totalPay = totalHours * hourlyPay;

    return {
      isActive,
      totalHours: totalHours.toFixed(2),
      totalPay: totalPay.toFixed(2),
      lastLocation // Esto será null si no está activo
    };
  };

  if (loading) return <div className="btp-loading-container"><div className="btp-spinner"></div></div>;
  if (error) return <div className="btp-error-container"><IonIcon icon={alertCircleOutline} className="error-icon" /><p>{error}</p></div>;

  const renderModalContent = () => {
    if (!selectedWorker) return null;
    const stats = getWorkerStats(selectedWorker.uid, selectedWorker.hourlyPay);

    return (
      <div className="btp-modal-overlay" onClick={() => setSelectedWorker(null)}>
        <div className="btp-modal-card" onClick={e => e.stopPropagation()}>
          
          <div className="btp-modal-header">
            <div className="header-info">
              <h3>{selectedWorker.nameAndLastName}</h3>
              <span className={stats.isActive ? "status-tag active" : "status-tag"}>
                {stats.isActive ? "Currently Working" : "Off Duty"}
              </span>
            </div>
            <button className="close-btn" onClick={() => setSelectedWorker(null)}>
              <IonIcon icon={closeOutline} />
            </button>
          </div>

          <div className="btp-modal-stats">
             <div className="modal-stat-box">
                <span className="label">Hours</span>
                <span className="val">{stats.totalHours}h</span>
             </div>
             <div className="modal-stat-box green">
                <span className="label">To Pay</span>
                <span className="val">${stats.totalPay}</span>
             </div>
          </div>

          {/* SECCIÓN DEL MAPA (CONDICIONAL) */}
          <div className="btp-map-section">
            <div className="map-title">
              <IonIcon icon={locationOutline} /> 
              {stats.isActive ? "Current Location" : "Status"}
            </div>
            
            <div className="map-wrapper">
              {/* LÓGICA DE VISUALIZACIÓN */}
              {stats.isActive ? (
                  // CASO 1: ESTÁ TRABAJANDO
                  stats.lastLocation ? (
                    // 1.1: Tiene GPS -> Muestra Mapa
                    <>
                      <MapContainer 
                        center={[stats.lastLocation.lat, stats.lastLocation.lng]} 
                        zoom={15} 
                        scrollWheelZoom={false}
                        style={{ height: "100%", width: "100%" }}
                      >
                        <TileLayer
                          attribution='© CARTO'
                          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        />
                        <Marker position={[stats.lastLocation.lat, stats.lastLocation.lng]}>
                          <Popup>{selectedWorker.nameAndLastName}<br/>Working Here</Popup>
                        </Marker>
                      </MapContainer>
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${stats.lastLocation.lat},${stats.lastLocation.lng}`}
                        target="_blank" rel="noreferrer" className="open-maps-btn"
                      >
                        Open Maps <IonIcon icon={mapOutline} style={{marginLeft: 5}}/>
                      </a>
                    </>
                  ) : (
                    // 1.2: Trabajando pero SIN GPS -> Alerta
                    <div className="no-map-data">
                      <IonIcon icon={alertCircleOutline} style={{color: '#ff9500'}}/>
                      <p>Worker is Active but GPS is off.</p>
                    </div>
                  )
              ) : (
                  // CASO 2: NO ESTÁ TRABAJANDO (Clock Out) -> Pantalla de descanso
                  <div className="no-map-data">
                    <IonIcon icon={moonOutline} style={{color: '#8e8e93'}} />
                    <p>Worker is currently Off Duty.</p>
                    <span style={{fontSize: '12px', color: '#ccc'}}>Location hidden</span>
                  </div>
              )}
            </div>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="btp-container"> 
      {workers.length === 0 ? (
        <div className="btp-empty"><IonIcon icon={briefcaseOutline} /><p>No staff found.</p></div>
      ) : (
        <div className="btp-list">
          {workers.map((worker) => {
            const stats = getWorkerStats(worker.uid, worker.hourlyPay);
            return (
              <div 
                key={worker.uid} 
                className={`btp-card ${stats.isActive ? 'is-active' : ''}`}
                onClick={() => setSelectedWorker(worker)} 
                style={{cursor: 'pointer'}}
              >
                <div className="btp-card-top">
                  <div className="btp-user-row">
                    <div className="btp-avatar">
                      {worker.nameAndLastName ? worker.nameAndLastName.charAt(0).toUpperCase() : <IonIcon icon={personOutline} />}
                        {stats.isActive && <div className="btp-status-dot pulse"></div>}
                    </div>
                    <div className="btp-info">
                      <h3>{worker.nameAndLastName || "Unknown"}</h3>
                      <span className="btp-role-badge">${worker.hourlyPay}/hr</span>
                    </div>
                  </div>
                  <div className={`btp-status-badge ${stats.isActive ? 'active' : 'inactive'}`}>
                    {stats.isActive ? 'Active' : 'Offline'}
                  </div>
                </div>
                <div className="btp-stats-grid">
                  <div className="btp-stat-box">
                    <div className="btp-stat-icon grey"><IonIcon icon={timeOutline} /></div>
                    <div className="btp-stat-data">
                        <span className="label">Hours</span>
                        <span className="value">{stats.totalHours}</span>
                    </div>
                  </div>
                  <div className="btp-stat-box highlight">
                    <div className="btp-stat-icon green"><IonIcon icon={cashOutline} /></div>
                    <div className="btp-stat-data">
                        <span className="label">Total Pay</span>
                        <span className="value money">${stats.totalPay}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {selectedWorker && renderModalContent()}
    </div>
  );
};

export default BossTimePanel;