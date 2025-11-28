import React, { useState, useEffect, useRef } from "react";
import "./ChatPanel.css"; 
import { auth } from "../firebase";
// Importamos 'type' explícitamente para evitar errores de compilación
import { subscribeToChat, sendMessage, type ChatMessage } from "../chatFirebase";
import { IonIcon } from "@ionic/react";
import { send, arrowBackOutline } from "ionicons/icons";

interface ChatPanelProps {
  onBack: () => void; 
  userName: string | null; // <--- Recibimos el nombre real aquí
}

const ChatPanel: React.FC<ChatPanelProps> = ({ onBack, userName }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  
  const user = auth.currentUser;

  // 1. Suscribirse al chat
  useEffect(() => {
    const unsubscribe = subscribeToChat((newMessages) => {
      setMessages(newMessages);
    });
    return () => unsubscribe(); 
  }, []);

  // 2. Auto-scroll al fondo cuando llegan mensajes nuevos
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 3. Manejar Envío
  const handleSend = async () => {
    if (!input.trim() || !user) return;
    
    const textToSend = input;
    setInput(""); // Limpiar input rápido
    
    try {
      // Enviamos el mensaje pasando el userName real
      await sendMessage(textToSend, user, userName);
    } catch (error) {
      console.error("Error al enviar", error);
      setInput(textToSend); // Devolver el texto si falla
      alert("No se pudo enviar el mensaje");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Formato de fecha
  const formatTime = (date: Date | null) => {
    if (!date) return "...";
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && 
                    date.getMonth() === now.getMonth() &&
                    date.getFullYear() === now.getFullYear();
    
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (isToday) return `Hoy ${timeStr}`;
    return `${date.toLocaleDateString([], {day: '2-digit', month: '2-digit'})} ${timeStr}`;
  };

  return (
    <div className="chat-panel-container">
      
      {/* HEADER */}
      <div className="chat-header">
        <button onClick={onBack} className="chat-back-btn">
          <IonIcon icon={arrowBackOutline} />
        </button>
        <div className="chat-title">
          <span className="hashtag">#</span> General
        </div>
      </div>

      {/* LISTA DE MENSAJES */}
      <div className="chat-messages-area">
        {messages.map((msg, index) => {
          // Agrupar mensajes del mismo usuario si son seguidos
          const isSameUser = index > 0 && messages[index-1].userId === msg.userId;
          
          return (
            <div key={msg.id} className={`message-row ${isSameUser ? 'compact' : ''}`}>
              
              {!isSameUser && (
                <div className="message-header">
                  <span 
                    className="message-username" 
                    style={{ color: msg.userColor }}
                  >
                    {msg.userName}
                  </span>
                  <span className="message-time">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              )}

              <div className="message-content">
                {msg.text}
              </div>
            </div>
          );
        })}
        {/* Referencia invisible para hacer scroll automático */}
        <div ref={bottomRef} />
      </div>

      {/* INPUT AREA */}
      <div className="chat-input-area">
        <div className="input-wrapper">
          <input
            type="text"
            placeholder={`Enviar mensaje como ${userName || "Usuario"}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button 
            className="send-btn" 
            onClick={handleSend}
            disabled={!input.trim()}
          >
            <IonIcon icon={send} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;