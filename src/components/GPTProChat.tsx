import { useState, useRef, useEffect } from "react";
import axios from "axios";
import "./GPTProChat.css";
import { IonIcon } from "@ionic/react";
import { 
  closeOutline, 
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
      content: `You are a PRO assistant for a contractor specialized in construction. The user's name is "${userName}". Keep answers short, clear, and practical.`,
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

  useEffect(() => {
    document.body.style.overflow = "hidden";
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
        { role: "assistant", content: "Connection error. Please try again." },
      ]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSend();
  };

  return (
    <>
      <div className="gpt-backdrop" onClick={onClose} />
      
      <div className="gpt-container">
        {/* --- HEADER --- */}
        <header className="gpt-header">
          <div className="gpt-header-left">
            <div className="gpt-icon-badge">
                <IonIcon icon={sparklesOutline} />
            </div>
            <div className="gpt-header-info">
                <span className="gpt-title">Pro Assistant</span>
                {/* CAMBIO AQUÍ: Branding personalizado */}
                <span className="gpt-subtitle">Rangel Contractor</span>
            </div>
          </div>
          
          {onClose && (
            <button className="gpt-close-btn" onClick={onClose}>
              <IonIcon icon={closeOutline} />
            </button>
          )}
        </header>

        {/* --- CHAT BODY --- */}
        <div className="gpt-body">
          <div className="gpt-messages-spacer"></div>
          
          {messages
            .filter((m) => m.role !== "system")
            .map((msg, i) => (
              <div
                key={i}
                className={`gpt-bubble ${msg.role === "user" ? "user" : "bot"}`}
              >
                {msg.content}
              </div>
            ))}

          {loading && (
            <div className="gpt-loading-bubble">
              <div className="dot"></div>
              <div className="dot"></div>
              <div className="dot"></div>
            </div>
          )}

          <div ref={msgEndRef} style={{height: '20px'}} />
        </div>

        {/* --- INPUT AREA --- */}
        <div className="gpt-input-area">
          <div className="gpt-input-wrapper">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              inputMode="text"
              onKeyDown={handleKeyDown}
              /* CAMBIO AQUÍ: Quité el autoFocus para que no salte el teclado */
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className={`gpt-send-btn ${input.trim() ? 'active' : ''}`}
            >
              <IonIcon icon={arrowUpOutline} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default GPTProChat;