import React, { useState, useEffect } from "react";
import "./GalleryPanel.css";
import { IonIcon } from "@ionic/react";
import { 
  imagesOutline, 
  arrowBackOutline, 
  cloudUploadOutline, 
  folderOpenOutline, 
  trashOutline,
  closeOutline,
  addOutline,
  alertCircleOutline 
} from "ionicons/icons";
import { db, auth } from "../firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, addDoc, deleteDoc } from "firebase/firestore";
import { SHA1 } from "crypto-js";

// TUS CREDENCIALES
const CLOUD_NAME = "dlh3rtxxm";
const UPLOAD_PRESET = "app-rvp";
const API_KEY = "PON_TU_API_KEY_AQUI"; 
const API_SECRET = "PON_TU_API_SECRET_AQUI"; 

interface ProjectData {
  id: string;
  title: string;
  clientName: string;
  galleryImages?: string[]; 
  status: string;
}

interface GalleryPanelProps {
  onHideDock?: (hide: boolean) => void;
}

const GalleryPanel: React.FC<GalleryPanelProps> = ({ onHideDock }) => {
  const [view, setView] = useState<'folders' | 'grid'>('folders');
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null); 

  // ESTADOS PARA MODALES
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // 1. CARGAR PROYECTOS
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    if (onHideDock) onHideDock(false);

    const q = query(collection(db, "projects"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectData));
      const visibleList = list.filter(p => p.status !== 'Deleted' || (p.galleryImages && p.galleryImages.length > 0));
      setProjects(visibleList);
      
      if (selectedProject) {
          const updated = list.find(p => p.id === selectedProject.id);
          if (updated) setSelectedProject(updated);
      }
    });
    return () => {
        unsubscribe();
        if (onHideDock) onHideDock(false);
    };
  }, [selectedProject?.id]); 

  // --- LOGICA CLOUDINARY (INTACTA) ---
  const deleteFromCloudinary = async (imageUrl: string) => {
      try {
          const parts = imageUrl.split('/');
          const filename = parts.pop()?.split('.')[0]; 
          const publicId = `${UPLOAD_PRESET}/${filename}`; 
          const timestamp = Math.round((new Date()).getTime() / 1000);
          const str = `public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`;
          const signature = SHA1(str).toString();
          const formData = new FormData();
          formData.append("public_id", publicId);
          formData.append("api_key", API_KEY);
          formData.append("timestamp", timestamp.toString());
          formData.append("signature", signature);
          await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, { method: "POST", body: formData });
      } catch (err) { console.log("Cloud delete error", err); }
  };

  // 2. CREAR FOLDER (CON MODAL)
  const confirmCreateFolder = async () => {
      if (!newFolderName.trim()) return;
      const user = auth.currentUser;
      if(!user) return;
      try {
          await addDoc(collection(db, "projects"), {
              userId: user.uid,
              title: newFolderName,
              clientName: "Custom Gallery",
              galleryImages: [],
              status: "Custom", 
              date: new Date().toISOString().split('T')[0],
              total: 0,
              items: []
          });
          setNewFolderName("");
          setShowCreateModal(false);
      } catch (e) { console.error(e); }
  };

  // 3. BORRAR FOLDER (CON MODAL)
  const confirmDeleteFolder = async () => {
      if(!selectedProject) return;
      // Borrar fotos de la nube
      if(selectedProject.galleryImages) {
          for (const url of selectedProject.galleryImages) {
              await deleteFromCloudinary(url);
          }
      }
      try {
          await deleteDoc(doc(db, "projects", selectedProject.id));
          setShowDeleteModal(false);
          setView('folders');
          setSelectedProject(null);
      } catch(e) { console.error(e); }
  };

  // 4. HANDLERS FOTOS
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProject) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.secure_url) {
        const projectRef = doc(db, "projects", selectedProject.id);
        await updateDoc(projectRef, { galleryImages: arrayUnion(data.secure_url) });
      } else { alert("Upload error"); }
    } catch (error) { alert("Upload failed"); }
    setUploading(false);
  };

  const handleDeleteImage = async (url: string, e: React.MouseEvent) => {
      e.stopPropagation(); 
      if(!selectedProject || !window.confirm("Delete photo permanently?")) return;
      await deleteFromCloudinary(url);
      try {
          const projectRef = doc(db, "projects", selectedProject.id);
          await updateDoc(projectRef, { galleryImages: arrayRemove(url) });
      } catch (e) { console.error(e); }
  };

  const handleOpenImage = (url: string) => { setSelectedImage(url); if (onHideDock) onHideDock(true); };
  const handleCloseImage = () => { setSelectedImage(null); if (onHideDock) onHideDock(false); };

  // --- VISTA 1: CARPETAS ---
  if (view === 'folders') {
    return (
      <div className="gp-container">
        <div className="gp-header">
          <h2>Job Gallery</h2>
        </div>
        
        <div className="gp-grid-folders">
          {projects.length === 0 ? (
             // EMPTY STATE FOLDERS
             <div className="gp-empty-state-main">
                <div className="gp-empty-icon">
                    <IonIcon icon={imagesOutline} />
                </div>
                <h3>No Folders Found</h3>
                <p>Create a new folder or add a project to start.</p>
             </div>
          ) : (
             projects.map(p => (
                <div key={p.id} className="gp-folder-card" onClick={() => { setSelectedProject(p); setView('grid'); }}>
                <div className="gp-folder-icon">
                    <IonIcon icon={folderOpenOutline} />
                    {p.galleryImages && p.galleryImages.length > 0 && (
                        <img src={p.galleryImages[0]} alt="preview" className="gp-folder-preview" />
                    )}
                </div>
                <div className="gp-folder-meta">
                    <h3>{p.title}</h3>
                    <p>{p.clientName}</p>
                    <span className="gp-count">{p.galleryImages?.length || 0}</span>
                </div>
                </div>
            ))
          )}
        </div>

        <div className="gp-fab-container">
            <button className="gp-add-folder-btn" onClick={() => setShowCreateModal(true)}>
                <IonIcon icon={addOutline} /> New Folder
            </button>
        </div>

        {/* MODAL CREAR FOLDER */}
        {showCreateModal && (
            <div className="gp-modal-overlay" onClick={() => setShowCreateModal(false)}>
                <div className="gp-modal-card" onClick={e => e.stopPropagation()}>
                    <h3>New Folder</h3>
                    <p>Enter a name for this gallery album.</p>
                    <input 
                        className="gp-modal-input"
                        placeholder="e.g. Random Jobs" 
                        value={newFolderName} 
                        onChange={e => setNewFolderName(e.target.value)} 
                        autoFocus
                    />
                    <div className="gp-modal-actions">
                        <button className="gp-btn-cancel" onClick={() => setShowCreateModal(false)}>Cancel</button>
                        <button className="gp-btn-confirm" onClick={confirmCreateFolder}>Create</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    );
  }

  // --- VISTA 2: GRID DE FOTOS ---
  return (
    <div className="gp-container">
      <div className="gp-navbar">
        <button onClick={() => setView('folders')} className="gp-back-btn">
          <IonIcon icon={arrowBackOutline} /> Back
        </button>
        <span className="gp-title">{selectedProject?.title}</span>
        <button className="gp-danger-btn" onClick={() => setShowDeleteModal(true)}>
            <IonIcon icon={trashOutline} />
        </button>
      </div>

      <div className="gp-photo-grid">
        {(!selectedProject?.galleryImages || selectedProject.galleryImages.length === 0) ? (
            <div className="gp-empty-state">
                <IonIcon icon={imagesOutline} />
                <p>Empty Folder</p>
                <p className="sub">Add photos using the + button</p>
            </div>
        ) : (
            selectedProject.galleryImages.map((url, idx) => (
                <div key={idx} className="gp-photo-item" onClick={() => handleOpenImage(url)}>
                    <img src={url} alt="job" />
                    <button className="gp-delete-photo-visible" onClick={(e) => handleDeleteImage(url, e)}>
                        <IonIcon icon={trashOutline} />
                    </button>
                </div>
            ))
        )}
        <div style={{height: 120}}></div>
      </div>

      <div className="gp-fab-container">
          <label className={`gp-round-upload ${uploading ? 'loading' : ''}`}>
              <input type="file" accept="image/*" onChange={handleFileUpload} disabled={uploading} hidden />
              <IonIcon icon={uploading ? cloudUploadOutline : addOutline} className={uploading ? 'spin' : ''} />
          </label>
      </div>

      {/* MODAL BORRAR FOLDER */}
      {showDeleteModal && (
            <div className="gp-modal-overlay" onClick={() => setShowDeleteModal(false)}>
                <div className="gp-modal-card" onClick={e => e.stopPropagation()}>
                    <div className="gp-icon-warn"><IonIcon icon={alertCircleOutline} /></div>
                    <h3>Delete Folder?</h3>
                    <p>This will permanently delete the folder <b>"{selectedProject?.title}"</b> and all its photos. This cannot be undone.</p>
                    <div className="gp-modal-actions">
                        <button className="gp-btn-cancel" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                        <button className="gp-btn-danger" onClick={confirmDeleteFolder}>Delete</button>
                    </div>
                </div>
            </div>
      )}

      {selectedImage && (
          <div className="gp-fullscreen" onClick={handleCloseImage}>
              <img src={selectedImage} alt="Full" />
              <button className="gp-close-full"><IonIcon icon={closeOutline} /></button>
          </div>
      )}
    </div>
  );
};

export default GalleryPanel;