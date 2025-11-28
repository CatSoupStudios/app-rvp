import React, { useState, useEffect } from "react";
import "./CrewPanel.css";
import { IonIcon } from "@ionic/react";
import { 
  addOutline, 
  searchOutline, 
  personCircleOutline, 
  closeOutline,
  checkmarkCircleOutline,
  caretDownOutline,
  createOutline, 
  saveOutline,
  trashOutline // Importamos el icono de basura
} from "ionicons/icons";
import { db, firebaseConfig } from "../firebase"; 
import { collection, onSnapshot, query, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore"; // deleteDoc agregado
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";

const CrewPanel: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // --- ESTADOS PARA CREAR ---
  const [newName, setNewName] = useState(""); 
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPhone, setNewPhone] = useState(""); 
  const [newPay, setNewPay] = useState("");     
  const [newRole, setNewRole] = useState("worker");

  // --- ESTADOS PARA EDITAR ---
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
      alert("User created!");
      setShowAddModal(false);
      setNewName(""); setNewEmail(""); setNewPass(""); setNewPhone(""); setNewPay("");
    } catch (error: any) { alert("Error: " + error.message); }
    setLoading(false);
  };

  // 3. ABRIR MODAL DE EDICIÓN
  const handleOpenEdit = (user: any) => {
    setSelectedUser(user);
    setEditName(user.nameAndLastName || user.displayName || "");
    setEditPhone(user.phoneNumber || "");
    setEditPay(user.hourlyPay || "");
    setEditRole(user.role || "worker");
    setEditEmail(user.email || "");
    setShowEditModal(true);
  };

  // 4. GUARDAR EDICIÓN
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
      alert("User updated successfully!");
      setShowEditModal(false);
    } catch (error: any) {
      alert("Error updating: " + error.message);
    }
    setLoading(false);
  };

  // 5. BORRAR USUARIO (NUEVA FUNCIÓN)
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    // Confirmación doble por seguridad
    const confirm = window.confirm(`⚠️ Are you sure you want to delete ${editName}? \n\nThis will remove them from your database and revoke their access.`);
    if (!confirm) return;

    setLoading(true);
    try {
      // Borramos el documento de Firestore
      await deleteDoc(doc(db, "users", selectedUser.id));
      
      alert("User deleted from database.");
      setShowEditModal(false); // Cerramos el modal
    } catch (error: any) {
      alert("Error deleting: " + error.message);
    }
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

  return (
    <div className="crew-container">
      
      <div className="crew-header">
        <h2 className="crew-title">My Crew</h2>
        <button className="add-crew-btn" onClick={() => setShowAddModal(true)}>
          <IonIcon icon={addOutline} />
        </button>
      </div>

      <div className="search-bar">
        <IonIcon icon={searchOutline} style={{ color: '#8e8e93', fontSize: '20px' }} />
        <input 
          type="text" 
          className="search-input"
          placeholder="Search crew..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="crew-list">
        {filteredUsers.length === 0 ? (
          <div style={{textAlign: 'center', color: '#8e8e93', marginTop: 20}}>
            No workers found.
          </div>
        ) : (
          filteredUsers.map(user => (
            <div key={user.id} className="crew-card" onClick={() => handleOpenEdit(user)}>
              <div className="crew-avatar">
                <IonIcon icon={personCircleOutline} />
              </div>
              <div className="crew-info">
                <div className="crew-name">
                  {user.nameAndLastName || user.displayName || "Unnamed"}
                </div>
                <div className="crew-email">{user.phoneNumber || "No phone"}</div>
                <div className="role-badge worker" style={{marginTop: 5}}>
                   ${user.hourlyPay || "0"}/hr
                </div>
              </div>
              <IonIcon icon={createOutline} style={{color: '#c7c7cc'}} />
            </div>
          ))
        )}
      </div>

      {/* --- MODAL ADD (Sin cambios) --- */}
      {showAddModal && (
        <div className="settings-modal-bg modal-show" style={{justifyContent: 'center', alignItems: 'center'}}>
           <div className="settings-modal-sheet modal-show" style={{ borderRadius: 24, maxHeight: '90vh', overflowY: 'auto', padding: 25, margin: 20, width: '100%', maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="modal-title">New User</h3>
              <IonIcon icon={closeOutline} size="large" className="modal-close-icon" onClick={() => setShowAddModal(false)} />
            </div>
            <div className="crew-form">
              <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Name"/></div>
              <div className="form-group"><label className="form-label">Role</label>
                <div style={{position: 'relative'}}>
                  <select className="form-input" style={{appearance: 'none', background: 'white'}} value={newRole} onChange={e => setNewRole(e.target.value)}>
                    <option value="worker">Worker</option><option value="jefe">Boss</option>
                  </select>
                  <IonIcon icon={caretDownOutline} style={{position: 'absolute', right: 15, top: 18, pointerEvents: 'none', color: '#8e8e93'}}/>
                </div>
              </div>
              <div style={{display: 'flex', gap: 10}}>
                <div className="form-group" style={{flex: 1}}><label className="form-label">Phone</label><input className="form-input" value={newPhone} onChange={e=>setNewPhone(e.target.value)} placeholder="Phone"/></div>
                <div className="form-group" style={{width: '100px'}}><label className="form-label">Pay</label><input type="number" className="form-input" value={newPay} onChange={e=>setNewPay(e.target.value)} placeholder="$$"/></div>
              </div>
              <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="Email"/></div>
              <div className="form-group"><label className="form-label">Password</label><input type="password" className="form-input" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="Pass"/></div>
              <button className="create-user-btn" onClick={handleCreateUser} disabled={loading}>{loading ? "..." : "Create"} <IonIcon icon={checkmarkCircleOutline} /></button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL EDITAR (CON BOTÓN DELETE) --- */}
      {showEditModal && (
        <div className="settings-modal-bg modal-show" style={{justifyContent: 'center', alignItems: 'center'}}>
          <div className="settings-modal-sheet modal-show" style={{ borderRadius: 24, maxHeight: '90vh', overflowY: 'auto', padding: 25, margin: 20, width: '100%', maxWidth: 400 }}>
            
            <div className="modal-header">
              <h3 className="modal-title">Edit Worker</h3>
              <IonIcon icon={closeOutline} size="large" className="modal-close-icon" onClick={() => setShowEditModal(false)} />
            </div>

            <div className="crew-form">
              
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={editName} onChange={e=>setEditName(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Role</label>
                <div style={{position: 'relative'}}>
                  <select className="form-input" style={{appearance: 'none', background: 'white'}} value={editRole} onChange={e => setEditRole(e.target.value)}>
                    <option value="worker">Worker</option>
                    <option value="jefe">Boss</option>
                  </select>
                  <IonIcon icon={caretDownOutline} style={{position: 'absolute', right: 15, top: 18, pointerEvents: 'none', color: '#8e8e93'}}/>
                </div>
              </div>

              <div style={{display: 'flex', gap: 10}}>
                <div className="form-group" style={{flex: 1}}>
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={editPhone} onChange={e=>setEditPhone(e.target.value)} />
                </div>
                <div className="form-group" style={{width: '100px'}}>
                  <label className="form-label">Pay</label>
                  <input type="number" className="form-input" value={editPay} onChange={e=>setEditPay(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email (Read Only)</label>
                <div style={{
                  padding: '16px', 
                  background: '#f2f2f7', 
                  borderRadius: '14px', 
                  color: '#8e8e93',
                  fontSize: '16px'
                }}>
                  {editEmail}
                </div>
              </div>

              {/* BOTÓN DE GUARDAR (AZUL) */}
              <button 
                className="create-user-btn"
                onClick={handleSaveEdit}
                disabled={loading}
                style={{background: '#007AFF', marginBottom: '10px'}} 
              >
                {loading ? "Saving..." : "Save Changes"}
                {!loading && <IonIcon icon={saveOutline} />}
              </button>

              {/* BOTÓN DE BORRAR (ROJO) */}
              <button 
                className="create-user-btn"
                onClick={handleDeleteUser}
                disabled={loading}
                style={{
                  background: 'white', 
                  color: '#ff3b30', // Rojo iOS
                  border: '1px solid #ff3b30'
                }} 
              >
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