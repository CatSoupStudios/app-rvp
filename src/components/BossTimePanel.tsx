import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { IonIcon, IonSpinner } from "@ionic/react";
import { 
  timeOutline, 
  cashOutline, 
  personOutline, 
  alertCircleOutline 
} from "ionicons/icons";
import "./BossTimePanel.css";

interface WorkTime {
  userId: string;
  inTime: string;
  outTime?: string | null; 
  id?: string;
}

interface WorkerData {
  uid: string;
  nameAndLastName: string;
  email: string;
  hourlyPay: string;
  role: string;
}

interface BossTimePanelProps {
  workTimes: any[];
}

const BossTimePanel: React.FC<BossTimePanelProps> = ({ workTimes }) => {
  const [workers, setWorkers] = useState<WorkerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const getWorkerStats = (uid: string, hourlyPayStr: string) => {
    const hourlyPay = parseFloat(hourlyPayStr) || 0;
    const userTimes = workTimes.filter(t => t.userId === uid);

    let totalSeconds = 0;
    let isActive = false;

    userTimes.forEach((t: WorkTime) => {
      if (!t.inTime) return;

      if (!t.outTime) {
        isActive = true;
      } else {
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
      totalPay: totalPay.toFixed(2)
    };
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "50px" }}>
        <IonSpinner name="crescent" color="primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "20px", color: "#ff3b30" }}>
        <IonIcon icon={alertCircleOutline} size="large" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    // Quitamos el padding general del contenedor principal en CSS o aquí mismo si prefieres
    <div className="ios-main-nopadding"> 
      
      {/* Título eliminado, ya está en el Header */}

      {workers.length === 0 ? (
        <p className="empty-state">No staff registered.</p>
      ) : (
        <div className="workers-list">
          {workers.map((worker) => {
            const stats = getWorkerStats(worker.uid, worker.hourlyPay);
            return (
              <div key={worker.uid} className="worker-card">
                <div className="card-header">
                  <div className="worker-identity">
                    <div className={`worker-avatar ${stats.isActive ? 'active' : 'inactive'}`}>
                      {worker.nameAndLastName 
                        ? worker.nameAndLastName.charAt(0).toUpperCase() 
                        : <IonIcon icon={personOutline} />}
                    </div>
                    <div className="worker-info">
                      <h3>{worker.nameAndLastName || "Unknown"}</h3>
                      <span className={`status-text ${stats.isActive ? 'active' : 'inactive'}`}>
                        {stats.isActive ? "Active now" : "Clocked out"}
                      </span>
                    </div>
                  </div>
                  <div className="pay-badge">
                    ${worker.hourlyPay}/hr
                  </div>
                </div>
                <hr className="card-divider" />
                <div className="stats-row">
                  <div className="stat-group">
                    <span className="stat-label">
                      <IonIcon icon={timeOutline} /> Total Hours
                    </span>
                    <span className="stat-value">
                      {stats.totalHours} h
                    </span>
                  </div>
                  <div className="stat-group" style={{ alignItems: "flex-end" }}>
                    <span className="stat-label">
                      <IonIcon icon={cashOutline} /> Total Pay
                    </span>
                    <span className="stat-value money">
                      ${stats.totalPay}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BossTimePanel;