import { useEffect, useState } from "react";
import { IonApp, IonSpinner } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { IonRouterOutlet } from "@ionic/react";
import { Switch, Route, Redirect } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebase";
import { collection, query, where, getDocs, orderBy, onSnapshot } from "firebase/firestore";
import type { User } from "firebase/auth";
import Login from "./pages/Login";
import DashboardBoss from "./pages/DashboardBoss";
import DashboardWorker from "./pages/DashboardWorker";

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"boss" | "worker" | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState<string | null>(null);
  
  // Estado para guardar los registros de tiempo (principalmente para el Jefe)
  const [workTimes, setWorkTimes] = useState<any[]>([]); 
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeWorkTimes: () => void = () => {};

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      
      // Limpiamos listener y datos anteriores
      unsubscribeWorkTimes();
      setWorkTimes([]);

      setUser(firebaseUser);
      setFullName(null);
      setRole(null);
      setError(null);

      if (firebaseUser) {
        const currentEmail = firebaseUser.email;
        let name: string | null = null;
        let userRole: "boss" | "worker" = "worker";

        if (currentEmail) {
          try {
            // 1. OBTENER DATOS DEL USUARIO
            const usersRef = collection(db, "users");
            const qUser = query(usersRef, where("email", "==", currentEmail));
            const querySnapshot = await getDocs(qUser);
            
            if (!querySnapshot.empty) {
              const userData = querySnapshot.docs[0].data();
              name = userData.nameAndLastName || null;
              userRole = userData.role === "boss" ? "boss" : "worker";
            } else {
              setError("Usuario no encontrado en la base de datos.");
            }

            setFullName(name);
            setRole(userRole);

            // 2. CARGAR HISTORIAL DE TIEMPOS
            // Solo es crítico para el JEFE tenerlos precargados aquí para pasarlos al panel
            // El trabajador los carga en su propio componente, pero mantenemos la lógica por si acaso.
            const timesRef = collection(db, "work_times");
            let qTimes;

            if (userRole === "boss") {
              // Si es Jefe: Descarga TODO el historial ordenado por fecha de entrada
              qTimes = query(timesRef, orderBy("inTime", "desc"));
            } else {
              // Si es Trabajador: Descarga SOLO sus registros
              qTimes = query(
                timesRef, 
                where("uid", "==", firebaseUser.uid), // Ojo: asegúrate si guardas como 'uid' o 'userId' en tu BD.
                // Si tus registros tienen 'userId', cámbialo aquí también si ves que no carga nada para el worker.
                orderBy("inTime", "desc")
              );
            }

            // Escuchamos cambios en tiempo real
            unsubscribeWorkTimes = onSnapshot(qTimes, (snapshot) => {
              const timesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }));
              
              console.log("✅ App cargó registros:", timesData.length);
              setWorkTimes(timesData);
              
              setLoading(false);
            }, (err) => {
              console.error("Error cargando tiempos:", err);
              setLoading(false);
            });

            return; 

          } catch (err) {
            console.error(err);
            setError("Error leyendo registro de usuario.");
          }
        }
      }
      
      setLoading(false);
    });

    return () => {
      unsubAuth();
      unsubscribeWorkTimes();
    };
  }, []);

  if (loading) {
    return (
      <IonApp>
        <div style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          backgroundColor: "#ffffff"
        }}>
          <IonSpinner name="crescent" color="primary" style={{ transform: 'scale(1.5)' }} />
          <p style={{ marginTop: "20px", color: "#888", fontSize: "0.9rem" }}>RVP...</p>
        </div>
      </IonApp>
    );
  }

  if (error) {
    return (
      <IonApp>
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          color: "#D30",
          textAlign: "center",
          padding: "20px"
        }}>
          <div>
            <h3>Coneccion Wrong</h3>
            <p>{error}</p>
          </div>
        </div>
      </IonApp>
    );
  }

  return (
    <IonApp>
      <IonReactRouter>
        <IonRouterOutlet key={user?.uid || "anon"}>
          <Switch>
            <Route exact path="/">
              {user
                ? role === "boss"
                  ? <Redirect to="/dashboard-boss" />
                  : <Redirect to="/dashboard-worker" />
                : <Login />}
            </Route>

            <Route exact path="/dashboard-boss">
              {!user || role !== "boss"
                ? <Redirect to="/" />
                : <DashboardBoss 
                    fullName={fullName} 
                    initialWorkTimes={workTimes} // SÍ se lo pasamos al Jefe
                  />}
            </Route>

            <Route exact path="/dashboard-worker">
              {!user || role !== "worker"
                ? <Redirect to="/" />
                : <DashboardWorker 
                    fullName={fullName} 
                    // QUITAMOS initialWorkTimes AQUÍ PARA ELIMINAR EL ERROR
                  />}
            </Route>

            <Route path="*">
              <Redirect to="/" />
            </Route>
          </Switch>
        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;