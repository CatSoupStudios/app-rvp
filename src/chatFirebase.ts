import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp, 
  Timestamp 
} from "firebase/firestore";
import { db } from "./firebase"; 

// Definimos la interfaz del mensaje
export interface ChatMessage {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userColor: string;
  createdAt: Date | null; 
}

const COLLECTION_NAME = "global_chat";

// Función para generar un color consistente basado en el ID del usuario
// Así el usuario siempre tiene el mismo color
export const getUserColor = (userId: string) => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return '#' + "00000".substring(0, 6 - c.length) + c;
};

// Enviar mensaje (Actualizado para recibir nombre personalizado)
export const sendMessage = async (text: string, user: any, customName?: string | null) => {
  if (!text.trim()) return;

  // Prioridad: 1. Nombre de la BD (customName) -> 2. DisplayName de Auth -> 3. Email
  const finalName = customName || user.displayName || user.email || "Anonymous";

  try {
    await addDoc(collection(db, COLLECTION_NAME), {
      text: text.trim(),
      userId: user.uid,
      userName: finalName, 
      userColor: getUserColor(user.uid),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

// Escuchar mensajes (Realtime)
export const subscribeToChat = (callback: (msgs: ChatMessage[]) => void) => {
  // Traemos los últimos 50 mensajes ordenados cronológicamente
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("createdAt", "asc"), 
    limit(50) 
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const messages: ChatMessage[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        text: data.text,
        userId: data.userId,
        userName: data.userName,
        userColor: data.userColor || getUserColor(data.userId),
        createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : null,
      };
    });
    callback(messages);
  });

  return unsubscribe; 
};