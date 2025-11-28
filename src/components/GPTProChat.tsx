import { useState, useRef, useEffect } from "react";
import axios from "axios";
import "./GPTProChat.css";
import { IonIcon } from "@ionic/react";
import { 
  closeOutline, // Este es el icono bonito
  arrowUpOutline, 
  sparklesOutline 
} from "ionicons/icons";

interface GPTProChatProps {
  userName: string;
  onClose?: () => void;
}

const OPENAI_KEY = import.meta.env.VITE_OPENAI_KEY;

function GPTProChat({ userName, onClose }: GPTProChatProps) {
  const [messages, setMessages] = useState([
    {
      role: "system",
      content: `You are a PRO assistant for a contractor specialized in construction, remodeling, and painting in the United States. The user's name is "${userName}". Keep answers short, clear, and practical.`,
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  const msgEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () =>
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Bloqueo de scroll del body SIMPLE y EFECTIVO
  useEffect(() => {
    document.body.style.overflow = "hidden";
    
    // Pequeño fix para asegurar que al abrir en móviles se vea bien
    setTimeout(scrollToBottom, 100);

    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          messages: [...messages, userMsg],
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const assistantMsg = res.data.choices[0].message.content;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: assistantMsg },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Try again later." },
      ]);
    }

    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    <>
      {/* 1. CAPA DE SEGURIDAD (Telón de fondo) */}
      <div className="ios-gpt-backdrop" />

      {/* 2. CONTENEDOR PRINCIPAL */}
      <div className="ios-gpt-wrapper">
        
        {/* Navbar */}
        <div className="ios-gpt-navbar">
          <div style={{ width: 32 }}> {/* Espacio para centrar título */}
             <IonIcon icon={sparklesOutline} style={{color: "#007aff", fontSize: "22px"}} />
          </div>
          
          <span className="gpt-nav-title">Contractor Assistant</span>
          
          {onClose && (
            <button className="ios-gpt-close-btn" onClick={onClose}>
              {/* Icono bonito de Ionicons */}
              <IonIcon icon={closeOutline} />
            </button>
          )}
        </div>

        {/* Chat Area */}
        <div className="ios-gpt-chat-area">
          {messages
            .filter((m) => m.role !== "system")
            .map((msg, i) => (
              <div
                key={i}
                className={
                  msg.role === "user"
                    ? "ios-chat-bubble user"
                    : "ios-chat-bubble bot"
                }
              >
                {msg.content}
              </div>
            ))}

          {loading && (
            <div className="typing-indicator">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
          )}

          <div ref={msgEndRef} />
        </div>

        {/* Input Bar */}
        <div className="ios-gpt-input-bar">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask here..."
            inputMode="text"
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="send-btn-icon"
          >
            <IonIcon icon={arrowUpOutline} className="send-arrow" />
          </button>
        </div>
      </div>
    </>
  );
}

export default GPTProChat;