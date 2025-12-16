import React, { useState, useEffect } from "react";
import "./CrewPanel.css";
import { IonIcon } from "@ionic/react";
import { 
  addOutline, 
  searchOutline, 
  closeOutline,
  checkmarkCircleOutline,
  caretDownOutline,
  chevronForwardOutline,
  saveOutline,
  trashOutline,
  callOutline,
  walletOutline,
  personOutline,
  mailOutline,
  keyOutline
} from "ionicons/icons";
import { db, firebaseConfig } from "../firebase"; 
import { collection, onSnapshot, query, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";

const CrewPanel: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // --- ESTADOS CREAR/EDITAR (Misma lógica de antes) ---
  const [newName, setNewName] = useState(""); 
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPhone, setNewPhone] = useState(""); 
  const [newPay, setNewPay] = useState("");     
  const [newRole, setNewRole] = useState("worker");

  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPay, setEditPay] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editEmail, setEditEmail] = useState("");

  // 1. LEER USUARIOS
  useEffect(() => {
    const q = query(collection(db, "users")); 
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(allUsers); 
    });
    return () => unsubscribe();
  }, []);

  // 2. CREAR USUARIO
  const handleCreateUser = async () => {
    if (!newName || !newEmail || !newPass || !newPhone || !newPay) return alert("Fill all fields");
    if (newPass.length < 6) return alert("Password min 6 chars");
    setLoading(true);
    try {
      const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPass);
      const newUid = userCredential.user.uid;
      await setDoc(doc(db, "users", newUid), {
        nameAndLastName: newName, 
        displayName: newName,
        email: newEmail,
        phoneNumber: newPhone,
        hourlyPay: newPay,
        role: newRole,
        createdAt: new Date().toISOString(),
        bossTasks: [],
        personalTasks: []
      });
      await signOut(secondaryAuth); 
      setShowAddModal(false);
      setNewName(""); setNewEmail(""); setNewPass(""); setNewPhone(""); setNewPay("");
    } catch (error: any) { alert("Error: " + error.message); }
    setLoading(false);
  };

  // 3. EDITAR / BORRAR (Lógica intacta)
  const handleOpenEdit = (user: any) => {
    setSelectedUser(user);
    setEditName(user.nameAndLastName || user.displayName || "");
    setEditPhone(user.phoneNumber || "");
    setEditPay(user.hourlyPay || "");
    setEditRole(user.role || "worker");
    setEditEmail(user.email || "");
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      const userRef = doc(db, "users", selectedUser.id);
      await updateDoc(userRef, {
        nameAndLastName: editName,
        displayName: editName,
        phoneNumber: editPhone,
        hourlyPay: editPay,
        role: editRole
      });
      setShowEditModal(false);
    } catch (error: any) { alert("Error: " + error.message); }
    setLoading(false);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    const confirm = window.confirm(`Delete ${editName}?`);
    if (!confirm) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, "users", selectedUser.id));
      setShowEditModal(false); 
    } catch (error: any) { alert("Error: " + error.message); }
    setLoading(false);
  };

  const filteredUsers = users.filter(u => {
    const name = u.nameAndLastName || u.displayName || "";
    return (
      (name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(searchTerm.toLowerCase())) &&
      (u.role === 'worker' || u.role === 'trabajador')
    );
  });

  const getAvatarColor = (name: string) => {
    const colors = ['#FF9500', '#FF3B30', '#5856D6', '#007AFF', '#34C759', '#AF52DE'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) { hash = name.charCodeAt(i) + ((hash << 5) - hash); }
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (name: string) => name ? name.substring(0, 2).toUpperCase() : "??";

  return (
    <div className="cp-container">
      
      {/* SEARCH BAR (Ahora está arriba del todo) */}
      <div className="cp-search-wrapper">
        <div className="cp-search-bar">
          <IonIcon icon={searchOutline} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search crew members..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* CONTENEDOR DE SCROLL PARA LA LISTA */}
      <div className="cp-scroll-area">
        <div className="cp-list">
          {filteredUsers.length === 0 ? (
            <div className="cp-empty-state">
              <div className="empty-icon"><IonIcon icon={searchOutline} /></div>
              <p>No crew members found.</p>
            </div>
          ) : (
            filteredUsers.map(user => {
              const name = user.nameAndLastName || user.displayName || "Unnamed";
              const bgColor = getAvatarColor(name);
              
              return (
                <div key={user.id} className="cp-card" onClick={() => handleOpenEdit(user)}>
                  <div className="cp-avatar" style={{background: bgColor}}>
                    {getInitials(name)}
                  </div>
                  
                  <div className="cp-info">
                    <div className="cp-name">{name}</div>
                    <div className="cp-detail-row">
                      <IonIcon icon={callOutline} />
                      <span>{user.phoneNumber || "No phone"}</span>
                    </div>
                  </div>

                  <div className="cp-meta">
                    <div className="cp-pay-badge">${user.hourlyPay}/hr</div>
                    <IonIcon icon={chevronForwardOutline} className="cp-arrow" />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* BOTÓN FLOTANTE (FAB) - Fuera del scroll, fijo en pantalla */}
      <button className="cp-fab-add" onClick={() => setShowAddModal(true)}>
        <IonIcon icon={addOutline} />
      </button>

      {/* --- MODAL ADD --- */}
      {showAddModal && (
        <div className="cp-modal-overlay">
           <div className="cp-modal-card">
            <div className="cp-modal-header">
              <h3>New Member</h3>
              <button className="cp-close-btn" onClick={() => setShowAddModal(false)}>
                <IonIcon icon={closeOutline} />
              </button>
            </div>
            
            <div className="cp-form-scroll">
              <div className="cp-input-group">
                 <IonIcon icon={personOutline} />
                 <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Full Name"/>
              </div>

              <div className="cp-row">
                <div className="cp-input-group">
                  <IonIcon icon={callOutline} />
                  <input value={newPhone} onChange={e=>setNewPhone(e.target.value)} placeholder="Phone" type="tel"/>
                </div>
                <div className="cp-input-group" style={{flex: '0 0 100px'}}>
                  <IonIcon icon={walletOutline} />
                  <input value={newPay} onChange={e=>setNewPay(e.target.value)} placeholder="$/hr" type="number"/>
                </div>
              </div>

              <div className="cp-input-group">
                 <IonIcon icon={mailOutline} />
                 <input value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="Email Address" type="email"/>
              </div>

              <div className="cp-input-group">
                 <IonIcon icon={keyOutline} />
                 <input value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="Password (min 6)" type="password"/>
              </div>

              <div className="cp-select-wrapper">
                 <select value={newRole} onChange={e => setNewRole(e.target.value)}>
                    <option value="worker">Worker</option>
                    <option value="boss">Boss</option>
                 </select>
                 <IonIcon icon={caretDownOutline} className="select-arrow"/>
              </div>

              <button className="cp-primary-btn" onClick={handleCreateUser} disabled={loading}>
                 {loading ? "Creating..." : "Create Account"}
                 <IonIcon icon={checkmarkCircleOutline} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL EDIT --- */}
      {showEditModal && (
        <div className="cp-modal-overlay">
          <div className="cp-modal-card">
            <div className="cp-modal-header">
              <h3>Edit Details</h3>
              <button className="cp-close-btn" onClick={() => setShowEditModal(false)}>
                <IonIcon icon={closeOutline} />
              </button>
            </div>

            <div className="cp-form-scroll">
              <label className="cp-label">Contact Info</label>
              <div className="cp-input-group">
                 <input value={editName} onChange={e=>setEditName(e.target.value)} />
              </div>
              <div className="cp-row">
                 <div className="cp-input-group">
                    <input value={editPhone} onChange={e=>setEditPhone(e.target.value)} />
                 </div>
                 <div className="cp-input-group" style={{flex: '0 0 100px'}}>
                    <input type="number" value={editPay} onChange={e=>setEditPay(e.target.value)} />
                 </div>
              </div>

              <label className="cp-label">Account</label>
              <div className="cp-read-only-box">
                 {editEmail}
              </div>

              <label className="cp-label">Actions</label>
              <button className="cp-primary-btn" onClick={handleSaveEdit} disabled={loading}>
                 {loading ? "Saving..." : "Save Changes"}
                 <IonIcon icon={saveOutline} />
              </button>

              <button className="cp-danger-btn" onClick={handleDeleteUser} disabled={loading}>
                 Delete User
                 <IonIcon icon={trashOutline} />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CrewPanel;