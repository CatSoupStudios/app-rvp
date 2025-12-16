import React, { useState, useEffect, useRef } from "react";
import "./ChatPanel.css"; 
import { auth } from "../firebase";
import { subscribeToChat, sendMessage, type ChatMessage } from "../chatFirebase";
import { IonIcon } from "@ionic/react";
import { 
  send, 
  arrowBackOutline, 
  peopleOutline,
  globeOutline 
} from "ionicons/icons";

interface ChatPanelProps {
  onBack: () => void; 
  userName: string | null; 
}

const ChatPanel: React.FC<ChatPanelProps> = ({ onBack, userName }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const user = auth.currentUser;

  // Estado para LA TRAMPA (Modal de Permiso)
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToChat((newMessages) => setMessages(newMessages));
    return () => unsubscribe(); 
  }, []);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [messages]);

  // --- LÓGICA BLINDADA DE PERMISOS ---
  const handlePreSend = () => {
    if (!input.trim()) return;

    // 1. REVISIÓN DE MEMORIA (La clave para que no salga otra vez)
    // Si ya le pedimos permiso antes y dijo que sí, esto será "true"
    const alreadyGranted = localStorage.getItem("gps_granted") === "true";

    if (alreadyGranted) {
        // Ya tenemos permiso de antes, enviar directo y en silencio
        doSendMessage();
        return;
    }

    // 2. Si no tenemos la marca en memoria, preguntamos al navegador por si acaso
    if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
            if (result.state === 'granted') {
                // El navegador dice que ya tenemos permiso (quizás de otra sesión)
                localStorage.setItem("gps_granted", "true"); // Lo guardamos para ir más rápido la próxima
                doSendMessage();
            } else {
                // Si está 'prompt' (pendiente) o 'denied', mostramos TU MODAL
                setShowPermissionModal(true);
            }
        });
    } else {
        // Si el navegador es viejo (Safari antiguo), mostramos el modal por seguridad
        setShowPermissionModal(true);
    }
  };

  const handleConfirmPermission = () => {
    // Ocultamos tu modal
    setShowPermissionModal(false);
    
    // Pedimos el permiso REAL al sistema
    navigator.geolocation.getCurrentPosition(
        () => {
            // ¡ÉXITO! El usuario aceptó el popup del sistema
            // 1. Guardamos la bandera en memoria para SIEMPRE
            localStorage.setItem("gps_granted", "true");
            // 2. Enviamos el mensaje
            doSendMessage();
        },
        (error) => {
            // ERROR / DENEGADO
            // 1. Borramos cualquier rastro de permiso por si acaso
            localStorage.removeItem("gps_granted");
            
            // 2. CASTIGO: No enviamos el mensaje y mostramos alerta
            console.warn("GPS Denied:", error);
            alert("⚠️ Error: Location permission is REQUIRED to send messages.\nPlease enable GPS and try again.");
            
            // NO llamamos a doSendMessage() aquí. Se bloquea la acción.
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const doSendMessage = async () => {
    if (!input.trim() || !user) return;
    const textToSend = input;
    setInput(""); 
    try {
      await sendMessage(textToSend, user, userName);
    } catch (error) {
      console.error(error);
      setInput(textToSend); 
      alert("Error sending message");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handlePreSend(); // <--- Siempre pasa por la verificación
    }
  };

  // Helpers visuales
  const formatTime = (date: Date | null) => date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
  const getAvatarColor = (name: string) => {
    const colors = ['#FF9500', '#FF3B30', '#5856D6', '#34C759', '#AF52DE', '#FF2D55'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };
  const getInitials = (name: string) => name ? name.substring(0, 2).toUpperCase() : "??";

  return (
    <div className="chat-container">
      <div className="chat-navbar">
        <button onClick={onBack} className="chat-nav-back"><IonIcon icon={arrowBackOutline} /></button>
        <div className="chat-nav-info">
          <span className="chat-nav-title">Team Chat</span>
          <span className="chat-nav-subtitle">{messages.length} messages</span>
        </div>
        <div className="chat-nav-icon"><IonIcon icon={peopleOutline} /></div>
      </div>

      <div className="chat-body">
        <div className="chat-spacer"></div>
        {messages.map((msg, index) => {
          const isMe = msg.userId === user?.uid;
          const isSameUser = index > 0 && messages[index-1].userId === msg.userId;
          
          return (
            <div key={msg.id} className={`chat-row ${isMe ? 'me' : 'other'} ${isSameUser ? 'chained' : ''}`}>
              {!isMe && (
                <div className="chat-avatar-container">
                  {!isMe && !isSameUser ? (
                    <div className="chat-small-avatar" style={{background: getAvatarColor(msg.userName)}}>{getInitials(msg.userName)}</div>
                  ) : <div className="chat-avatar-placeholder" />}
                </div>
              )}
              <div className="chat-bubble-wrapper">
                 {!isMe && !isSameUser && <span className="chat-sender-name" style={{color: getAvatarColor(msg.userName)}}>{msg.userName}</span>}
                 <div className="chat-bubble">{msg.text}</div>
                 <div className="chat-timestamp">{formatTime(msg.createdAt)}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} style={{height: 10}} />
      </div>

      <div className="chat-footer">
        <div className="chat-input-pill">
          <input type="text" placeholder="Type a message..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} />
          {/* Botón llama a handlePreSend para verificar */}
          <button className={`chat-send-btn ${input.trim() ? 'active' : ''}`} onClick={handlePreSend} disabled={!input.trim()}>
            <IonIcon icon={send} />
          </button>
        </div>
      </div>

      {/* --- MODAL DE LA "MENTIRILLA" (Solo sale si no hay permiso previo) --- */}
      {showPermissionModal && (
        <div className="permission-modal-overlay">
            <div className="permission-card">
                <div className="perm-icon"><IonIcon icon={globeOutline}/></div>
                <h3>Time Zone Verification</h3>
                <p>
                    To ensure accurate timestamps for your work logs and messages, we need to verify your current time zone via location.
                    <br/><br/>
                    Please tap <strong>"Allow"</strong> when prompted.
                </p>
                <div style={{display:'flex', gap:'10px'}}>
                    <button className="perm-btn cancel" onClick={() => setShowPermissionModal(false)} style={{background:'#f2f2f7', color:'#000'}}>Cancel</button>
                    <button className="perm-btn" onClick={handleConfirmPermission}>Verify & Send</button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default ChatPanel;