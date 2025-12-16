import React, { useState, useEffect } from "react";
import "./ProjectsPanel.css";
import { IonIcon } from "@ionic/react";
import { 
  chevronBackOutline, 
  addOutline, 
  personOutline, 
  documentTextOutline,
  trashOutline,
  checkmarkCircleOutline,
  briefcaseOutline,
  cashOutline,
  cubeOutline, 
  constructOutline,
  createOutline, 
  shareOutline,
  closeOutline,
  checkmarkDoneOutline,
  receiptOutline,
  listOutline
} from "ionicons/icons";
import { db, auth } from "../firebase";
import { collection, addDoc, onSnapshot, query, where, doc, updateDoc } from "firebase/firestore"; // Se eliminó deleteDoc
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoImg from "../img/logo-rvp.webp"; 

// --- INTERFACES ---
interface ProjectItem {
  id: string;
  type: 'material' | 'labor';
  name: string;
  description: string;
  price: number;
  qty: number;
}

interface ExpenseItem {
  id: string;
  category: 'material' | 'labor' | 'other';
  name: string;
  price: number;
  qty: number;
  date: string;
}

interface ProjectData {
  id?: string;
  title: string;
  clientName: string;
  projectNotes: string;
  date: string;
  items: ProjectItem[];     
  expenses?: ExpenseItem[]; 
  status: 'Draft' | 'Sent' | 'Paid' | 'Deleted';
  total: number;
  taxRate: number;
}

interface ProjectsPanelProps {
  onHideDock?: (hide: boolean) => void;
  userName: string | null; 
}

const ProjectsPanel: React.FC<ProjectsPanelProps> = ({ onHideDock, userName }) => {
  const [view, setView] = useState<'list' | 'create' | 'preview'>('list');
  const [listFilter, setListFilter] = useState<'active' | 'completed' | 'taxes'>('active');
  const [projects, setProjects] = useState<ProjectData[]>([]);
  
  const [editMode, setEditMode] = useState<'estimate' | 'expenses'>('estimate');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewProject, setPreviewProject] = useState<ProjectData | null>(null);

  // FORM STATE
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [projectNotes, setProjectNotes] = useState("");
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [taxRate, setTaxRate] = useState<string>("0");
  const [status, setStatus] = useState<'Draft' | 'Sent' | 'Paid' | 'Deleted'>('Draft');

  // 1. CARGAR PROYECTOS
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    if (onHideDock) onHideDock(false);

    const q = query(collection(db, "projects"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => {
          const data = doc.data();
          return { 
              id: doc.id, 
              ...data,
              expenses: data.expenses || [] 
          } as ProjectData;
      });
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setProjects(list);
    });
    return () => {
        unsubscribe();
        if (onHideDock) onHideDock(false);
    };
  }, []);

  // FILTROS
  const activeProjects = projects.filter(p => p.status !== 'Paid' && p.status !== 'Deleted');
  const paidProjects = projects.filter(p => p.status === 'Paid');
  const displayProjects = listFilter === 'active' ? activeProjects : paidProjects;

  // 2. MATEMÁTICA
  const subtotalIncome = items.reduce((acc, i) => acc + (i.price * i.qty), 0);
  const tax = subtotalIncome * (parseFloat(taxRate || "0") / 100);
  const totalIncome = subtotalIncome + tax;

  const totalExpenses = expenses.reduce((acc, exp) => acc + (exp.price * exp.qty), 0);
  const netProfit = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  // 3. GENERAR PDF CLIENTE
  const generateClientPDF = (project: ProjectData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth(); 
    const pageHeight = doc.internal.pageSize.getHeight();

    try { doc.addImage(logoImg, 'WEBP', 14, 10, 35, 35); } catch (err) { console.error(err); }

    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text("Rangel Valley Painting Inc", pageWidth - 14, 18, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(80);
    doc.text("License #1086206", pageWidth - 14, 24, { align: "right" });
    doc.text("David Rangel: 661-900-2521", pageWidth - 14, 29, { align: "right" });
    doc.text("Office: 661-428-6638", pageWidth - 14, 34, { align: "right" });
    doc.text("r.rangel36@yahoo.com", pageWidth - 14, 39, { align: "right" });

    doc.setDrawColor(220); doc.line(14, 48, pageWidth - 14, 48);

    doc.setTextColor(0); doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text("BILL TO:", 14, 60);
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    doc.text(project.clientName, 14, 66);
    
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text("ESTIMATE DETAILS:", pageWidth - 80, 60);
    doc.setFont("helvetica", "normal");
    doc.text(`Project: ${project.title}`, pageWidth - 80, 66);
    doc.text(`Date: ${project.date}`, pageWidth - 80, 71);
    doc.text(`Est. No: #${project.id?.substring(0,6).toUpperCase() || 'NEW'}`, pageWidth - 80, 76);

    let currentY = 90;
    if (project.projectNotes) {
        doc.setFillColor(245, 245, 245); doc.roundedRect(14, currentY, pageWidth - 28, 20, 2, 2, 'F');
        doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("SCOPE OF WORK:", 18, currentY + 6);
        doc.setFont("helvetica", "normal");
        const splitNotes = doc.splitTextToSize(project.projectNotes, pageWidth - 36);
        doc.text(splitNotes, 18, currentY + 12);
        currentY += (splitNotes.length * 5) + 25;
    }

    const tableBody = project.items.map(item => [
      item.type === 'material' ? 'Material' : 'Labor',
      item.name + (item.description ? `\n${item.description}` : ''), 
      item.qty, 
      `$${item.price.toLocaleString()}`, 
      `$${(item.price * item.qty).toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Type', 'Description', 'Qty', 'Unit Price', 'Total']],
      body: tableBody,
      theme: 'plain', 
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
      bodyStyles: { textColor: [50, 50, 50] },
      columnStyles: {
          0: { cellWidth: 20, fontStyle: 'bold' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
          3: { cellWidth: 25, halign: 'right' },
          4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const rightMargin = pageWidth - 14;
    
    doc.setFontSize(10); doc.setTextColor(80);
    doc.text(`Subtotal:`, rightMargin - 50, finalY);
    doc.text(`$${(project.total - (project.total * (project.taxRate/100) || 0)).toLocaleString()}`, rightMargin, finalY, { align: 'right' });
    
    if (project.taxRate > 0) {
        doc.text(`Tax (${project.taxRate}%):`, rightMargin - 50, finalY + 6);
        doc.text(`$${(project.total - (project.total / (1 + project.taxRate/100))).toLocaleString()}`, rightMargin, finalY + 6, { align: 'right' });
    }

    doc.setFontSize(14); doc.setTextColor(0); doc.setFont("helvetica", "bold");
    doc.text(`TOTAL:`, rightMargin - 50, finalY + 16);
    doc.text(`$${project.total.toLocaleString()}`, rightMargin, finalY + 16, { align: 'right' });

    // FOOTER (Aquí usamos footerY)
    const footerY = pageHeight - 30; // Fijamos a 30px del final
    
    doc.setDrawColor(0); doc.setLineWidth(0.5);
    doc.line(14, footerY, 80, footerY); 
    doc.line(pageWidth - 80, footerY, pageWidth - 14, footerY); 

    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("Client Signature", 14, footerY + 5);
    doc.text(`Authorized By: ${userName || "David Rangel"}`, pageWidth - 80, footerY + 5); 
    doc.setFont("helvetica", "normal"); doc.setTextColor(100);
    doc.text("Rangel Valley Painting Inc.", pageWidth - 80, footerY + 9);

    doc.setFontSize(7); doc.setTextColor(150);
    doc.text("Make all checks payable to: Rangel Valley Painting. Thank you for your business.", pageWidth / 2, pageHeight - 10, { align: 'center' });

    doc.save(`Estimate_${project.clientName.replace(/\s+/g, '_')}.pdf`);
  };

  // 4. GENERAR PDF CONTADOR
  const generateAccountantPDF = (project: ProjectData) => {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFillColor(46, 125, 50);
      doc.rect(0, 0, pageWidth, 25, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont("helvetica", "bold");
      doc.text("INTERNAL PROFIT & LOSS REPORT", 14, 16);
      doc.setFontSize(10);
      doc.text(`Project: ${project.title} | Client: ${project.clientName}`, 14, 32);
      doc.setTextColor(0);

      doc.text("FINANCIAL SUMMARY", 14, 45);
      doc.line(14, 47, pageWidth - 14, 47);
      
      const pIncome = project.total;
      const pExpenses = (project.expenses || []).reduce((a, b) => a + (b.price * b.qty), 0);
      const pProfit = pIncome - pExpenses;

      doc.text(`Total Income (Sold):`, 14, 55);
      doc.text(`$${pIncome.toLocaleString()}`, 80, 55, {align:'right'});
      doc.text(`Total Expenses (Cost):`, 14, 62);
      doc.setTextColor(200, 0, 0); 
      doc.text(`-$${pExpenses.toLocaleString()}`, 80, 62, {align:'right'});
      
      doc.setTextColor(0); doc.setFont("helvetica", "bold");
      doc.text(`NET PROFIT:`, 14, 72);
      doc.setTextColor(0, 150, 0); 
      doc.text(`$${pProfit.toLocaleString()}`, 80, 72, {align:'right'});
      doc.setTextColor(0);

      doc.setFont("helvetica", "bold");
      doc.text("EXPENSE BREAKDOWN (RECEIPTS)", 14, 90);
      
      const expenseBody = (project.expenses || []).map(exp => [
          exp.date, exp.category.toUpperCase(), exp.name, exp.qty,
          `$${exp.price.toLocaleString()}`, `$${(exp.price * exp.qty).toLocaleString()}`
      ]);

      autoTable(doc, {
          startY: 95,
          head: [['Date', 'Category', 'Description', 'Qty', 'Cost', 'Total']],
          body: expenseBody,
          theme: 'grid',
          headStyles: { fillColor: [100, 100, 100] },
          styles: { fontSize: 9 }
      });

      doc.save(`ACCOUNTING_${project.clientName}.pdf`);
  };

  // HANDLERS
  const handleAddItem = (type: 'material' | 'labor') => {
    setItems([...items, { id: Date.now().toString(), type, name: "", description: "", price: 0, qty: 1 }]);
  };

  const handleAddExpense = () => {
      const newExp: ExpenseItem = {
          id: Date.now().toString(), category: 'material', name: "", price: 0, qty: 1,
          date: new Date().toISOString().split('T')[0]
      };
      setExpenses([...expenses, newExp]);
  };

  const handleUpdateItem = (id: string, field: keyof ProjectItem, value: any) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleUpdateExpense = (id: string, field: keyof ExpenseItem, value: any) => {
      setExpenses(expenses.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const handleRemoveItem = (id: string) => { setItems(items.filter(i => i.id !== id)); };
  const handleRemoveExpense = (id: string) => { setExpenses(expenses.filter(e => e.id !== id)); };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const confirm = window.confirm("Archive this project? It will remain in the database (Deleted status).");
      if(confirm) {
          try { 
              // SOFT DELETE: Actualizamos el status en lugar de borrar
              const docRef = doc(db, "projects", id);
              await updateDoc(docRef, { status: 'Deleted' }); 
          } catch(err) { console.error(err); }
      }
  };

  // NAVEGACIÓN
  const goToCreate = () => { 
      setEditingId(null); 
      setTitle(""); setClientName(""); setProjectNotes(""); setItems([]); setExpenses([]); setTaxRate("0"); setStatus('Draft');
      setEditMode('estimate');
      if (onHideDock) onHideDock(true); 
      setView('create'); 
  };

  const goToEdit = (p: ProjectData, e: React.MouseEvent) => {
      e.stopPropagation(); 
      setEditingId(p.id || null);
      setTitle(p.title); setClientName(p.clientName); setProjectNotes(p.projectNotes || ""); 
      setItems(p.items); setExpenses(p.expenses || []); setTaxRate(p.taxRate.toString()); setStatus(p.status);
      setEditMode('estimate');
      if (onHideDock) onHideDock(true);
      setView('create');
  };

  const goToPreview = (p: ProjectData) => {
      setPreviewProject(p);
      if (onHideDock) onHideDock(true);
      setView('preview');
  };

  const goToList = () => { 
      if (onHideDock) onHideDock(false); 
      setView('list'); 
  };

  const handleSave = async (markAsPaid: boolean = false) => {
    if (!auth.currentUser || !title) return alert("Title required");
    const finalStatus = markAsPaid ? 'Paid' : (status === 'Paid' ? 'Paid' : 'Draft');
    const projectData = {
      userId: auth.currentUser.uid,
      title, clientName, projectNotes,
      date: new Date().toISOString().split('T')[0],
      items, expenses, 
      taxRate: parseFloat(taxRate || "0"),
      total: totalIncome, 
      status: finalStatus,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingId) await updateDoc(doc(db, "projects", editingId), projectData as any);
      else await addDoc(collection(db, "projects"), { ...projectData, createdAt: new Date().toISOString() } as any);
      goToList();
    } catch (e) { console.error(e); }
  };

  const getStatusLabel = (s: string) => s === 'Draft' ? 'Working' : s;

  // --- VISTA 1: LISTA ---
  if (view === 'list') {
    return (
      <div className="pp-container">
        <div className="pp-header">
          <h2 className="pp-header-title">Projects</h2>
          <div className="pp-header-actions">
             <div className="pp-toggle-bg">
                 <button className={`pp-toggle-btn ${listFilter === 'active' ? 'active' : ''}`} onClick={() => setListFilter('active')}>Active</button>
                 <button className={`pp-toggle-btn ${listFilter === 'completed' ? 'active' : ''}`} onClick={() => setListFilter('completed')}>Done</button>
                 <button className={`pp-toggle-btn ${listFilter === 'taxes' ? 'active' : ''}`} onClick={() => setListFilter('taxes')}>Taxes</button>
             </div>
             <button className="pp-fab-mini" onClick={goToCreate}><IonIcon icon={addOutline} /></button>
          </div>
        </div>

        <div className="pp-content">
          {displayProjects.length === 0 ? (
            <div className="pp-empty">
              <div className="empty-circle"><IonIcon icon={briefcaseOutline} /></div>
              <p>No projects found.</p>
            </div>
          ) : (
            <div className="pp-grid">
              {displayProjects.map(p => {
                  const pExp = (p.expenses || []).reduce((a,b)=>a+(b.price*b.qty),0);
                  const pProfit = p.total - pExp;

                  return (
                    <div key={p.id} className={`pp-card-project ${p.status === 'Paid' ? 'paid-card' : ''}`} onClick={() => listFilter !== 'taxes' && goToPreview(p)}>
                    
                    <div className="pp-card-head">
                        <span className={`pp-badge ${p.status.toLowerCase()}`}>{getStatusLabel(p.status)}</span>
                        {listFilter !== 'taxes' && (
                            <button className="pp-icon-btn delete" onClick={(e) => handleDeleteProject(p.id!, e)}><IonIcon icon={closeOutline} /></button>
                        )}
                    </div>
                    
                    <h3 className="pp-project-title">{p.title}</h3>
                    <p className="pp-client-sub">{p.clientName}</p>
                    
                    {listFilter === 'taxes' ? (
                        <div className="pp-tax-summary">
                            <div className="tax-row"><span>Sold:</span> <b>${p.total.toLocaleString()}</b></div>
                            <div className="tax-row"><span>Cost:</span> <b style={{color:'red'}}>-${pExp.toLocaleString()}</b></div>
                            <div className="tax-row profit"><span>Net:</span> <b style={{color:'green'}}>${pProfit.toLocaleString()}</b></div>
                            <button className="pp-tax-btn" onClick={() => generateAccountantPDF(p)}>
                                <IonIcon icon={shareOutline} /> Accountant PDF
                            </button>
                        </div>
                    ) : (
                        <div className="pp-card-foot">
                            <span className="pp-date">{p.date}</span>
                            <span className={`pp-money ${p.status === 'Paid' ? 'paid-text' : ''}`}>${p.total.toLocaleString()}</span>
                        </div>
                    )}
                    </div>
                  )
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- VISTA 2: PREVIEW ---
  if (view === 'preview' && previewProject) {
      return (
        <div className="pp-container" style={{background: '#fff'}}>
            <div className="pp-navbar">
                <button onClick={goToList} className="pp-nav-back"><IonIcon icon={chevronBackOutline}/></button>
                <span className="pp-nav-title">Preview</span>
                {previewProject.status !== 'Paid' && (
                    <button className="pp-nav-back" onClick={(e) => goToEdit(previewProject, e)}><IonIcon icon={createOutline}/></button>
                )}
            </div>
            
            <div className="pp-content form-pad">
                <div className="pp-preview-paper">
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20}}>
                        <img src={logoImg} alt="Logo" style={{width: 60, height: 60, objectFit: 'contain'}} />
                        <div style={{textAlign: 'right'}}>
                            <h2 style={{margin:0, fontSize: 16}}>Rangel Valley Painting Inc</h2>
                            <p style={{margin:0, fontSize: 11, color: '#666'}}>Lic #1086206</p>
                        </div>
                    </div>
                    <div className="pp-preview-meta">
                        <p><strong>Project:</strong> {previewProject.title}</p>
                        <p><strong>Client:</strong> {previewProject.clientName}</p>
                        {previewProject.projectNotes && (
                            <div style={{marginTop: 15, background: '#f9f9f9', padding: 10, borderRadius: 8}}>
                                <p style={{margin:0, fontSize: 12, color: '#333'}}><strong>Scope of Work:</strong></p>
                                <p style={{margin:'5px 0 0 0', fontSize: 13, color: '#555'}}>{previewProject.projectNotes}</p>
                            </div>
                        )}
                    </div>
                    <div className="pp-preview-list">
                        {previewProject.items.map((it, idx) => (
                            <div key={idx} className="pp-preview-row">
                                <div className="desc">
                                    <strong>{it.name}</strong>
                                    {it.description && <span>{it.description}</span>}
                                </div>
                                <div style={{fontSize: 12, color:'#666'}}>x{it.qty}</div>
                                <div className="amount">${(it.price * it.qty).toLocaleString()}</div>
                            </div>
                        ))}
                    </div>
                    <div className="pp-preview-total">
                        <h3>Total: ${previewProject.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
                    </div>
                    <div style={{marginTop: 40, borderTop: '1px solid #eee', paddingTop: 10}}>
                        <p style={{fontSize: 12, color: '#888'}}>Authorized by: <strong>{userName || "David Rangel"}</strong></p>
                    </div>
                </div>
            </div>
            <div className="pp-total-bar">
                <button className="pp-save-btn" onClick={() => generateClientPDF(previewProject)}>Share PDF <IonIcon icon={shareOutline} /></button>
            </div>
        </div>
      )
  }

  // --- VISTA 3: CREAR / EDITAR ---
  if (view === 'create') {
    return (
        <div className="pp-container">
        <div className="pp-navbar">
            <button onClick={goToList} className="pp-nav-back"><IonIcon icon={chevronBackOutline}/></button>
            <span className="pp-nav-title">{editingId ? "Edit Project" : "New Estimate"}</span>
            <div style={{width: 30}}></div>
        </div>

        <div className="pp-profit-card">
            <div className="pp-profit-row"><span className="label">Estimate (Sold)</span><span className="val-in">${totalIncome.toLocaleString()}</span></div>
            <div className="pp-profit-row"><span className="label">Expenses (Cost)</span><span className="val-out">-${totalExpenses.toLocaleString()}</span></div>
            <div className="pp-divider"></div>
            <div className="pp-profit-row final">
                <span className="label">Net Profit</span>
                <span className={`val-profit ${netProfit >= 0 ? 'good' : 'bad'}`}>${netProfit.toLocaleString()}<span className="margin-badge">{profitMargin.toFixed(0)}%</span></span>
            </div>
        </div>

        <div className="pp-tabs-container">
            <button className={`pp-tab ${editMode === 'estimate' ? 'active' : ''}`} onClick={()=>setEditMode('estimate')}>Estimate</button>
            <button className={`pp-tab ${editMode === 'expenses' ? 'active' : ''}`} onClick={()=>setEditMode('expenses')}>Expenses</button>
        </div>

        <div className="pp-content form-pad" style={{paddingTop: 10}}>
            
            {editMode === 'estimate' && (
                <>
                    <div className="pp-form-group">
                        <div className="pp-input-row"><IonIcon icon={documentTextOutline} className="pp-icon"/><input placeholder="Project Name" value={title} onChange={e=>setTitle(e.target.value)} /></div>
                        <div className="pp-divider-line"></div>
                        <div className="pp-input-row"><IonIcon icon={personOutline} className="pp-icon"/><input placeholder="Client Name" value={clientName} onChange={e=>setClientName(e.target.value)} /></div>
                        <div className="pp-divider-line"></div>
                        <div className="pp-input-row"><IonIcon icon={cashOutline} className="pp-icon"/>
                            <div style={{flex: 1, display: 'flex', alignItems: 'center'}}><span style={{fontSize: 14, color: '#999', marginRight: 10}}>Tax %</span><input type="number" placeholder="0" value={taxRate} onChange={e=>setTaxRate(e.target.value)} /></div>
                        </div>
                    </div>
                    <div className="pp-section-label">SCOPE OF WORK</div>
                    <div className="pp-form-group"><div style={{padding: 15}}><textarea className="pp-desc-input" placeholder="General description..." rows={4} value={projectNotes} onChange={e => setProjectNotes(e.target.value)} style={{fontSize: 15, background: 'transparent', border: 'none'}} /></div></div>
                    
                    <div className="pp-section-label">ESTIMATE ITEMS</div>
                    {items.map((item) => (
                    <div key={item.id} className={`pp-item-card fade-in ${item.type}`}>
                        <div className="pp-item-top">
                            <div className={`pp-type-icon ${item.type}`}><IonIcon icon={item.type === 'material' ? cubeOutline : constructOutline} /></div>
                            <input className="pp-item-input name" placeholder="Item Name" value={item.name} onChange={e => handleUpdateItem(item.id, 'name', e.target.value)}/>
                            <button onClick={() => handleRemoveItem(item.id)} className="pp-trash-btn"><IonIcon icon={trashOutline} /></button>
                        </div>
                        <div className="pp-item-desc-row"><textarea className="pp-desc-input" placeholder="Details..." rows={2} value={item.description} onChange={e => handleUpdateItem(item.id, 'description', e.target.value)}/></div>
                        <div className="pp-item-bottom">
                            <div className="pp-pill-input"><span>$</span><input type="number" placeholder="Price" value={item.price || ""} onChange={e => handleUpdateItem(item.id, 'price', parseFloat(e.target.value))}/></div>
                            <div className="pp-x">x</div>
                            <div className="pp-pill-input qty"><input type="number" placeholder="1" value={item.qty} onChange={e => handleUpdateItem(item.id, 'qty', parseFloat(e.target.value))}/><span className="unit">Qty</span></div>
                            <div className="pp-row-total">${(item.price * item.qty).toLocaleString()}</div>
                        </div>
                    </div>
                    ))}
                    <div className="pp-action-grid">
                        <button className="pp-add-item-btn material" onClick={() => handleAddItem('material')}><IonIcon icon={cubeOutline} /> Material</button>
                        <button className="pp-add-item-btn labor" onClick={() => handleAddItem('labor')}><IonIcon icon={constructOutline} /> Labor</button>
                    </div>
                </>
            )}

            {editMode === 'expenses' && (
                <>
                    <div className="pp-section-label">REAL COST LOG</div>
                    {expenses.length === 0 && (
                        <div style={{textAlign:'center', padding: 40, color: '#ccc'}}>
                            <IonIcon icon={listOutline} style={{fontSize: 40, opacity: 0.3}} />
                            <p>No expenses added yet.</p>
                        </div>
                    )}
                    {expenses.map((exp) => (
                        <div key={exp.id} className="pp-item-card fade-in" style={{borderLeftColor: '#FF3B30'}}>
                            <div className="pp-item-top">
                                <div className="pp-type-icon" style={{background:'#FF3B30'}}><IonIcon icon={receiptOutline} /></div>
                                <input className="pp-item-input name" placeholder="Store / Employee Name" value={exp.name} onChange={e => handleUpdateExpense(exp.id, 'name', e.target.value)}/>
                                <button onClick={() => handleRemoveExpense(exp.id)} className="pp-trash-btn"><IonIcon icon={trashOutline} /></button>
                            </div>
                            <div className="pp-item-bottom" style={{marginTop:10}}>
                                <div className="pp-pill-input"><span>$</span><input type="number" placeholder="Cost" value={exp.price || ""} onChange={e => handleUpdateExpense(exp.id, 'price', parseFloat(e.target.value))}/></div>
                                <div className="pp-x">x</div>
                                <div className="pp-pill-input qty"><input type="number" placeholder="1" value={exp.qty} onChange={e => handleUpdateExpense(exp.id, 'qty', parseFloat(e.target.value))}/></div>
                                <div className="pp-row-total" style={{color:'#FF3B30'}}>-${(exp.price * exp.qty).toLocaleString()}</div>
                            </div>
                            <div style={{marginTop:5, paddingLeft:42}}><input type="date" value={exp.date} onChange={e => handleUpdateExpense(exp.id, 'date', e.target.value)} style={{border:'none', background:'transparent', fontSize:12, color:'#888'}} /></div>
                        </div>
                    ))}
                    <button className="pp-add-item-btn" style={{borderColor: '#FF3B30', color: '#FF3B30', marginTop: 20}} onClick={handleAddExpense}>
                        <IonIcon icon={addOutline} /> Add Expense Receipt
                    </button>
                </>
            )}
            <div style={{height: 140}}></div>
        </div>

        <div className="pp-total-bar">
            <div className="pp-math-total">
                <span className="label-big">{editMode === 'estimate' ? 'Total Income' : 'Total Spent'}</span>
                <span className="value-big" style={{color: editMode === 'expenses' ? '#FF3B30' : '#111'}}>
                    ${editMode === 'estimate' ? totalIncome.toLocaleString() : totalExpenses.toLocaleString()}
                </span>
            </div>
            <div style={{display:'flex', gap: 10}}>
                {status !== 'Paid' && (
                    <button className="pp-save-btn paid" onClick={() => handleSave(true)}>Mark Paid <IonIcon icon={checkmarkDoneOutline} /></button>
                )}
                <button className="pp-save-btn" onClick={() => handleSave(false)}>Save <IonIcon icon={checkmarkCircleOutline} /></button>
            </div>
        </div>
        </div>
    );
  }

  return null;
};

export default ProjectsPanel;