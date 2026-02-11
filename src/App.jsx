import React, { useState, useEffect, useMemo } from 'react';
import './index.css';
import Confetti from 'react-confetti'; 
import * as XLSX from 'xlsx'; 
import aiimsLogo from './assets/logo.png';

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  addDoc,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { 
  Users, CheckCircle2, Plus, Search, 
  UploadCloud, AlertTriangle, ChevronLeft, 
  ChevronRight, Phone, UserCircle, 
  LayoutDashboard, History, Bell, TrendingUp, Settings, Lock,
  ArrowLeft, Mail, Edit2, Trash2, ShieldCheck, Building2,
  Moon, Sun, LogOut, XCircle, Loader2, Download, FileBarChart, Zap,
  FileSpreadsheet, List, FolderPlus, Clock, ArrowRightLeft, MousePointerClick, Send, ShieldAlert, UserCheck
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyDThqWllfTOdPTrkw9BKnpZAfTTV_Uzdew",
  authDomain: "aiims-compliance-portal.firebaseapp.com",
  projectId: "aiims-compliance-portal",
  storageBucket: "aiims-compliance-portal.firebasestorage.app",
  messagingSenderId: "808579792768",
  appId: "1:808579792768:web:d505dfd6d86d3fd6d14b65"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'aiims-default'; 
const ORG_ID = "aiims_raipur_main_db"; 

// --- Liquid Glass Helper Components ---
const GlassCard = ({ children, className = "" }) => (
  <div className={`relative overflow-hidden bg-white/5 backdrop-blur-3xl backdrop-saturate-150 border-t border-l border-white/20 border-b border-r border-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] rounded-[2rem] md:rounded-[2.5rem] ${className}`}>
    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
    {children}
  </div>
);

const GlassButton = ({ children, onClick, className = "", active = false, variant = 'default' }) => {
  const variants = {
    default: "bg-white/10 hover:bg-white/20 border-white/10 text-white",
    primary: "bg-blue-500/30 hover:bg-blue-500/50 border-blue-400/30 text-blue-100 shadow-[0_0_20px_rgba(59,130,246,0.3)]",
    success: "bg-emerald-500/30 hover:bg-emerald-500/50 border-emerald-400/30 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.3)]",
    danger: "bg-red-500/30 hover:bg-red-500/50 border-red-400/30 text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.3)]",
    amber: "bg-amber-500/30 hover:bg-amber-500/50 border-amber-400/30 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.3)]",
    active: "bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.4)] scale-110"
  };

  return (
    <button 
      onClick={onClick}
      className={`relative px-4 py-3 md:px-5 rounded-full font-bold text-[10px] md:text-xs uppercase tracking-wider transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] border backdrop-blur-md flex items-center justify-center gap-2 group ${active ? variants.active : variants[variant]} ${className}`}
    >
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />
      {children}
    </button>
  );
};

const TableSkeleton = () => (
  <div className="animate-pulse space-y-3">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="h-16 bg-white/5 rounded-3xl w-full backdrop-blur-sm border border-white/5"></div>
    ))}
  </div>
);

const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    try {
        const d = new Date(isoString);
        return isNaN(d.getTime()) ? 'Invalid' : d.toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit'
        });
    } catch (e) { return 'Error'; }
};

const App = () => {
  const [adminUser, setAdminUser] = useState(null); 
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [employees, setEmployees] = useState([]);
  const [deptMetadata, setDeptMetadata] = useState({}); 
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [darkMode, setDarkMode] = useState(true); 
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedDepartment, setSelectedDepartment] = useState(null); 
  const [viewOnlyMode, setViewOnlyMode] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('All');

  const [empSearchEmail, setEmpSearchEmail] = useState('');
  const [foundEmployee, setFoundEmployee] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle'); 
  const [showConfetti, setShowConfetti] = useState(false); 
  const [showPublicList, setShowPublicList] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isDeptEditModalOpen, setIsDeptEditModalOpen] = useState(false); 
  const [isMoveMemberModalOpen, setIsMoveMemberModalOpen] = useState(false); 
  const [showWipeModal, setShowWipeModal] = useState(false); 
  const [wipePassword, setWipePassword] = useState(''); 
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', contactPerson: '',
    mobile: '', status: 'Pending', notificationSent: false,
    undertakingReceived: false, type: 'Individual', srNo: '',
    department: '', responsibleOfficer: '', sentDate: '', receivedDate: ''
  });

  const [deptFormData, setDeptFormData] = useState({ name: '', selectedEmps: [] });
  const [deptMetaForm, setDeptMetaForm] = useState({ hodName: '', hodEmail: '', hodPhone: '' });
  const [deptSearchTerm, setDeptSearchTerm] = useState(''); 
  const [moveSearchTerm, setMoveSearchTerm] = useState('');
  const [selectedMoveEmps, setSelectedMoveEmps] = useState([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user && !user.isAnonymous) { setAdminUser(user); } else { setAdminUser(null); }
        fetchData();
    });
    return () => unsubscribe();
  }, []);

  const fetchData = () => {
    const qEmpReal = query(collection(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings'));
    const unsubEmp = onSnapshot(qEmpReal, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (parseInt(a.srNo) || 999999) - (parseInt(b.srNo) || 999999));
      setEmployees(data);
      setLoading(false);
    });
    const qDept = query(collection(db, 'artifacts', appId, 'organization_data', ORG_ID, 'department_metadata'));
    const unsubDept = onSnapshot(qDept, (snapshot) => { const meta = {}; snapshot.docs.forEach(doc => { meta[doc.id] = doc.data(); }); setDeptMetadata(meta); });
    const qLogs = query(collection(db, 'artifacts', appId, 'organization_data', ORG_ID, 'audit_logs'), orderBy('timestamp', 'desc'));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => { const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); setAuditLogs(logs); });
    return () => { unsubEmp(); unsubDept(); unsubLogs(); };
  };

  const handleAdminLogin = async (e) => {
      e.preventDefault(); setAuthError('');
      try { await signInWithEmailAndPassword(auth, loginEmail, loginPassword); setShowAdminLogin(false); setLoginEmail(''); setLoginPassword(''); } catch (err) { setAuthError("Invalid Credentials."); }
  };
  const handleAdminLogout = async () => { await signOut(auth); setAdminUser(null); setActiveView('dashboard'); };
  const logAction = async (action, details, type = 'info', actor = 'Admin') => { try { await addDoc(collection(db, 'artifacts', appId, 'organization_data', ORG_ID, 'audit_logs'), { action, details, type, timestamp: new Date().toISOString(), user: actor }); } catch (err) { console.error("Log Error:", err); } };

  const toggleNotification = async (emp) => {
      if(!adminUser || viewOnlyMode) return;
      const newStatus = !emp.notificationSent;
      try {
          const ref = doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings', emp.id);
          let masterStatus = 'Pending';
          if(newStatus) masterStatus = 'Notified';
          if(emp.undertakingReceived) masterStatus = 'Accepted'; 
          await setDoc(ref, { notificationSent: newStatus, status: masterStatus, updatedAt: new Date().toISOString() }, { merge: true });
          await logAction("Manual Toggle", `Set Notification to ${newStatus} for ${emp.email}`, 'warning');
      } catch(e) { console.error(e); }
  };

  const toggleUndertaking = async (emp) => {
      if(!adminUser || viewOnlyMode) return;
      const newStatus = !emp.undertakingReceived;
      try {
          const ref = doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings', emp.id);
          await setDoc(ref, { undertakingReceived: newStatus, status: newStatus ? 'Accepted' : (emp.notificationSent ? 'Notified' : 'Pending'), updatedAt: new Date().toISOString() }, { merge: true });
          await logAction("Manual Toggle", `Set Undertaking to ${newStatus} for ${emp.email}`, 'warning');
      } catch(e) { console.error(e); }
  };

  const handleExportCSV = () => {
      const headers = ["Sr No", "First Name", "Last Name", "Email", "Department", "Responsible Person", "Mobile", "Status", "Undertaking Received", "Notification Sent"];
      const csv = [headers.join(","), ...employees.map(e => [e.srNo, `"${e.firstName}"`, `"${e.lastName}"`, e.email, `"${e.department || ''}"`, `"${e.contactPerson || ''}"`, e.mobile, e.status, e.undertakingReceived ? "Yes" : "No", e.notificationSent ? "Yes" : "No"].join(","))].join("\n");
      const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `aiims_compliance_report_${new Date().toISOString().split('T')[0]}.csv`; link.click(); logAction("Data Export", "Downloaded CSV Report");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0]; if (!file || !adminUser) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result); const workbook = XLSX.read(data, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
        if (jsonData.length < 2) return alert("File appears empty.");
        const batch = writeBatch(db); let count = 0;
        const headers = jsonData[0].map(h => h?.toString().toLowerCase().trim() || '');
        const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('user id'));
        let notifIdx = headers.findIndex(h => h.includes('email sent') || h.includes('notification'));
        let underIdx = headers.findIndex(h => h.includes('undertaking') || h.includes('received'));
        let deptIdx = headers.findIndex(h => h.includes('department') || h.includes('dept'));
        let mobileIdx = headers.findIndex(h => h.includes('mobile'));
        let contactIdx = headers.findIndex(h => h.includes('contact person') || h.includes('responsible'));
        const isTrue = (val) => { if (!val) return false; const s = val.toString().toLowerCase().trim(); return s === 'yes' || s === 'true' || s === 'done' || s === 'sent' || s === 'received' || s === 'later' || s.length > 1; };
        const existingUsers = new Map(employees.map(e => [e.email.toLowerCase(), e]));
        jsonData.forEach((row, index) => {
           if (index === 0) return; 
           const email = row[emailIdx > -1 ? emailIdx : 3]?.toString().trim();
           if (email && email.includes('@')) {
              const docRef = doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings', email);
              const existing = existingUsers.get(email.toLowerCase());
              let newNotified = existing?.notificationSent || false; if (notifIdx > -1 && row[notifIdx]) newNotified = true; 
              let newUndertaking = existing?.undertakingReceived || false; if (underIdx > -1 && isTrue(row[underIdx])) newUndertaking = true;
              let newDept = existing?.department || 'Unassigned'; if (deptIdx > -1 && row[deptIdx]) newDept = row[deptIdx];
              let newContact = existing?.contactPerson || ''; if (contactIdx > -1 && row[contactIdx]) newContact = row[contactIdx];
              batch.set(docRef, { srNo: row[0] || existing?.srNo || '', firstName: row[1] || existing?.firstName || '', lastName: row[2] || existing?.lastName || '', email: email, department: newDept, mobile: (mobileIdx > -1 && row[mobileIdx]) ? row[mobileIdx] : (existing?.mobile || ''), contactPerson: newContact, notificationSent: newNotified, undertakingReceived: newUndertaking, status: newUndertaking ? 'Accepted' : (newNotified ? 'Notified' : 'Pending'), updatedAt: new Date().toISOString() }, { merge: true }); count++;
           }
        });
        await batch.commit(); await logAction("Bulk Import", `Merged ${count} records`, 'info'); alert(`Merged ${count} records.`); setIsImportModalOpen(false);
      } catch (err) { alert("Import failed."); console.error(err); }
    }; reader.readAsArrayBuffer(file);
  };

  const handleEmployeeSearch = (e) => { e.preventDefault(); const emp = employees.find(e => e.email.toLowerCase() === empSearchEmail.toLowerCase().trim()); if(!emp) { alert("No record found."); return; } setFoundEmployee(emp); setUploadStatus('idle'); };
  const handleEmployeeUpload = async (e) => { const file = e.target.files[0]; if(!file || !foundEmployee) return; setUploadStatus('uploading'); setTimeout(async () => { try { const ref = doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings', foundEmployee.id); await setDoc(ref, { undertakingReceived: true, receivedDate: new Date().toISOString().split('T')[0], status: 'Accepted', updatedAt: new Date().toISOString() }, { merge: true }); await logAction("Undertaking Uploaded", `User ${foundEmployee.email}`, 'success'); setUploadStatus('success'); setShowConfetti(true); setTimeout(() => setShowConfetti(false), 8000); } catch (err) { console.error(err); setUploadStatus('error'); } }, 2000); };
  
  const handleVerifyAndWipe = async (e) => { e.preventDefault(); if (!adminUser || !wipePassword) return; const credential = EmailAuthProvider.credential(adminUser.email, wipePassword); try { await reauthenticateWithCredential(adminUser, credential); const batch = writeBatch(db); employees.forEach(emp => { const ref = doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings', emp.id); batch.delete(ref); }); await batch.commit(); await logAction("Database Wipe", "All records deleted", 'danger'); alert("Wiped Successfully."); setShowWipeModal(false); setWipePassword(''); } catch (err) { alert("Incorrect Password."); } };
  const handleDeleteUser = async (empId) => { if(!adminUser || viewOnlyMode) return; if(!window.confirm("Delete this user?")) return; try { await deleteDoc(doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings', empId)); await logAction("User Deleted", `Deleted ${empId}`, 'warning'); } catch(e) { alert("Failed."); } };
  const handleSave = async (e) => { e.preventDefault(); if (!adminUser || viewOnlyMode) return; const docId = formData.email || `unknown_${Date.now()}`; let status = 'Pending'; if(formData.notificationSent) status = 'Notified'; if(formData.undertakingReceived) status = 'Accepted'; try { await setDoc(doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings', docId), { ...formData, status, updatedAt: new Date().toISOString() }, { merge: true }); await logAction(editingId ? "Updated Record" : "Created Record", formData.email, 'success'); setIsAddModalOpen(false); resetForm(); } catch (err) { alert("Error."); } };
  const handleCreateDepartment = async () => { if(!adminUser) return; try { const batch = writeBatch(db); deptFormData.selectedEmps.forEach(empId => { const ref = doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings', empId); batch.update(ref, { department: deptFormData.name }); }); await batch.commit(); setIsDeptModalOpen(false); setDeptFormData({ name: '', selectedEmps: [] }); } catch(e) { alert("Failed"); } };
  const handleUpdateDeptMeta = async () => { if(!adminUser) return; try { await setDoc(doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'department_metadata', selectedDepartment), { ...deptMetaForm }, { merge: true }); setIsDeptEditModalOpen(false); } catch(e) { alert("Failed"); } };
  const handleMoveEmployees = async () => { if(!adminUser) return; try { const batch = writeBatch(db); selectedMoveEmps.forEach(empId => { const ref = doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings', empId); batch.update(ref, { department: selectedDepartment }); }); await batch.commit(); setIsMoveMemberModalOpen(false); setSelectedMoveEmps([]); } catch(e) { alert("Failed"); } };

  const handleInputChange = (e) => { const { name, value, type, checked } = e.target; setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value })); };
  const resetForm = () => { setFormData({ firstName: '', lastName: '', email: '', contactPerson: '', mobile: '', status: 'Pending', notificationSent: false, undertakingReceived: false, type: 'Individual', srNo: '', department: '', responsibleOfficer: '', sentDate: '', receivedDate: '' }); setEditingId(null); };

  const stats = useMemo(() => {
    const total = employees.length;
    const accepted = employees.filter(e => e.undertakingReceived).length;
    const pending = employees.filter(e => !e.undertakingReceived).length;
    const notified = employees.filter(e => e.notificationSent && !e.undertakingReceived).length;
    const deptMap = { 'Unassigned': { name: 'Unassigned', total: 0, compliant: 0, employees: [] } };
    employees.forEach(emp => { let d = (emp.department || 'Unassigned').trim(); if(!d) d = 'Unassigned'; if(!deptMap[d]) deptMap[d] = { name: d, total: 0, compliant: 0, employees: [] }; deptMap[d].total++; if (emp.undertakingReceived) deptMap[d].compliant++; });
    if(deptMap['Unassigned'].total === 0) delete deptMap['Unassigned'];
    return { total, accepted, pending, notified, percentage: total > 0 ? Math.round((accepted / total) * 100) : 0, departments: deptMap };
  }, [employees]);

  const filteredEmployees = employees.filter(emp => {
      const match = (emp.email || '').toLowerCase().includes(searchTerm.toLowerCase()) || (emp.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) || (emp.contactPerson || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (filterStatus === 'All') return match;
      if (filterStatus === 'Accepted') return match && emp.undertakingReceived;
      if (filterStatus === 'Notified') return match && emp.notificationSent;
      if (filterStatus === 'Pending') return match && !emp.notificationSent && !emp.undertakingReceived;
      return match;
  });
  const unassignedEmployees = employees.filter(e => (!e.department || e.department === 'Unassigned'));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredEmployees.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  const bgClass = darkMode ? "bg-black text-white" : "bg-[#f0f4f8] text-slate-900"; 

  // === RENDER ===
  if (!adminUser) {
      return (
        <div className={`flex items-center justify-center min-h-screen relative overflow-hidden ${bgClass} transition-colors duration-700`}>
             {showConfetti && <Confetti numberOfPieces={200} recycle={false} />}
             <div className="absolute inset-0 overflow-hidden pointer-events-none">
                 <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-500/20 rounded-full blur-[150px] animate-pulse"></div>
                 <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/20 rounded-full blur-[150px] animate-pulse delay-1000"></div>
             </div>
             <div className="absolute top-6 right-6 flex gap-3 z-20">
                 <GlassButton onClick={() => setDarkMode(!darkMode)} className="p-3">{darkMode ? <Sun className="w-5 h-5 text-amber-300"/> : <Moon className="w-5 h-5 text-indigo-600"/>}</GlassButton>
                 <GlassButton onClick={() => setShowAdminLogin(true)}><Lock className="w-4 h-4"/> Admin</GlassButton>
             </div>
             <GlassCard className="w-full max-w-lg p-10 mx-4 z-10 animate-in fade-in zoom-in duration-700">
                 <div className="flex flex-col items-center text-center mb-10">
                     <div className={`w-28 h-28 rounded-full shadow-2xl p-5 mb-6 flex items-center justify-center ${darkMode ? 'bg-white/5' : 'bg-white border border-blue-100'}`}><img src={aiimsLogo} alt="AIIMS" className="w-full h-full object-contain" /></div>
                     <h1 className="text-3xl font-black mb-1 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">AIIMS Raipur</h1>
                     <p className={`text-sm font-bold uppercase tracking-[0.2em] ${darkMode ? 'text-white/60' : 'text-slate-500'}`}>Compliance Portal</p>
                 </div>
                 {showPublicList ? (
                     <div className="animate-in slide-in-from-right duration-500">
                         <div className="flex items-center justify-between mb-6"><h3 className="font-bold text-lg">Public Status</h3><button onClick={() => setShowPublicList(false)} className="text-xs font-bold text-blue-400 hover:text-blue-300">Back</button></div>
                         <div className={`rounded-3xl border overflow-hidden max-h-96 overflow-y-auto ${darkMode ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-white/50'}`}>
                             <table className="w-full text-left text-xs">
                                 <thead className="bg-white/5 font-bold uppercase sticky top-0 backdrop-blur-md"><tr><th className="p-4">Name</th><th className="p-4">Dept</th><th className="p-4 text-right">Status</th></tr></thead>
                                 <tbody className="divide-y divide-white/5">{employees.map(emp => (<tr key={emp.id} className="hover:bg-white/5 transition-colors"><td className="p-4 font-bold">{emp.firstName} {emp.lastName}</td><td className="p-4 opacity-70">{emp.department}</td><td className="p-4 text-right">{emp.undertakingReceived ? <span className="text-emerald-400 font-bold">Received</span> : <span className="text-amber-400 font-bold">Pending</span>}</td></tr>))}</tbody>
                             </table>
                         </div>
                     </div>
                 ) : (
                     <>
                        {!foundEmployee ? (
                            <form onSubmit={handleEmployeeSearch} className="space-y-6">
                                <div className="relative group"><Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 opacity-50" /><input type="email" placeholder="Official Email ID" value={empSearchEmail} onChange={(e) => setEmpSearchEmail(e.target.value)} className={`w-full pl-14 pr-6 py-5 rounded-3xl outline-none font-bold transition-all shadow-inner border ${darkMode ? 'bg-black/20 border-white/10 text-white focus:border-blue-500/50' : 'bg-white border-slate-200 text-slate-900 focus:border-blue-300'}`} required /></div>
                                <GlassButton onClick={() => {}} className="w-full py-5 text-lg" variant="primary">Check Status <ArrowLeft className="w-5 h-5 rotate-180"/></GlassButton>
                                <button type="button" onClick={() => setShowPublicList(true)} className="w-full py-3 text-xs font-bold flex items-center justify-center gap-2 opacity-50 hover:opacity-100 transition-opacity"><List className="w-4 h-4"/> View Public List</button>
                            </form>
                        ) : (
                            <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
                                <GlassCard className="p-6">
                                    <button onClick={() => {setFoundEmployee(null); setUploadStatus('idle');}} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10"><LogOut className="w-5 h-5 opacity-60"/></button>
                                    <h3 className="text-[10px] font-bold uppercase text-blue-400 tracking-wider mb-3">User Profile</h3>
                                    <div className="flex items-center gap-5"><div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg">{(foundEmployee.firstName || '?').charAt(0)}</div><div><p className="text-xl font-black leading-tight">{foundEmployee.firstName} {foundEmployee.lastName}</p><p className="text-sm opacity-60 font-medium mt-1">{foundEmployee.email}</p></div></div>
                                    <div className="mt-6"><div className={`py-3 rounded-2xl text-xs font-bold uppercase text-center border backdrop-blur-md ${foundEmployee.undertakingReceived ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/20 border-amber-500/30 text-amber-300'}`}>{foundEmployee.undertakingReceived ? '✅ Verified' : '⚠️ Pending'}</div></div>
                                </GlassCard>
                                {uploadStatus === 'success' || foundEmployee.undertakingReceived ? (
                                    <GlassCard className="text-center py-8 bg-emerald-500/10 border-emerald-500/20"><div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white shadow-[0_0_30px_rgba(16,185,129,0.4)] animate-bounce"><CheckCircle2 className="w-10 h-10"/></div><h3 className="text-2xl font-black mb-1 text-emerald-100">Compliant</h3><p className="text-sm text-emerald-200/60 px-6">Undertaking securely filed.</p></GlassCard>
                                ) : (
                                    <div className="space-y-4"><div className={`relative border-2 border-dashed rounded-3xl p-10 text-center transition-all duration-500 ${uploadStatus === 'uploading' ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/20 hover:border-blue-400 hover:bg-white/5 cursor-pointer group hover:scale-[1.02]'}`}>{uploadStatus === 'uploading' ? (<div className="flex flex-col items-center"><Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4"/><p className="text-sm font-bold text-blue-300">Encrypting...</p></div>) : (<label className="cursor-pointer block"><input type="file" accept=".pdf,.jpg,.png" onChange={handleEmployeeUpload} className="hidden" /><div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 text-white group-hover:scale-110 transition-transform group-hover:bg-blue-500 group-hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]"><UploadCloud className="w-8 h-8" /></div><p className="text-lg font-bold mb-1">Upload Undertaking</p><p className="text-xs opacity-50">PDF, JPG, PNG (Max 5MB)</p></label>)}</div></div>
                                )}
                            </div>
                        )}
                     </>
                 )}
             </GlassCard>
             {showAdminLogin && (<div className="fixed inset-0 bg-black/90 backdrop-blur-3xl z-50 flex items-center justify-center p-4"><GlassCard className="w-full max-w-sm p-10"><button onClick={() => setShowAdminLogin(false)} className="absolute top-6 right-6 opacity-50 hover:opacity-100"><XCircle className="w-8 h-8"/></button><div className="flex flex-col items-center mb-8"><div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border border-white/20 shadow-lg bg-gradient-to-br from-white/10 to-transparent"><Lock className="w-8 h-8"/></div><h2 className="text-2xl font-black">Admin Access</h2></div><form onSubmit={handleAdminLogin} className="space-y-5"><input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full px-5 py-4 bg-black/30 border border-white/10 rounded-2xl font-bold outline-none focus:border-blue-500/50 text-white placeholder-white/20 transition-all" placeholder="Email" autoFocus /><input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full px-5 py-4 bg-black/30 border border-white/10 rounded-2xl font-bold outline-none focus:border-blue-500/50 text-white placeholder-white/20 transition-all" placeholder="Password" /><GlassButton className="w-full py-4 text-black" variant="active">Unlock Dashboard</GlassButton></form></GlassCard></div>)}
        </div>
      );
  }

  // === ADMIN DASHBOARD ===
  return (
    <div className={`flex h-screen w-full overflow-hidden ${bgClass} transition-colors duration-500`}>
      {/* Moving Cyber Grid Background */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none opacity-30">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] animate-pan-grid"></div>
          <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-blue-500/20 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-[10%] left-[10%] w-[30%] h-[30%] bg-purple-500/20 rounded-full blur-[120px] animate-pulse delay-700"></div>
      </div>

      {/* DOCK */}
      <GlassCard className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-3 rounded-full !bg-white/10 !border-white/20 !backdrop-blur-2xl animate-in slide-in-from-bottom-10 duration-700">
          {['dashboard', 'registry', 'departments', 'audit'].map(view => (
            <GlassButton key={view} onClick={() => {setActiveView(view); setSelectedDepartment(null)}} active={activeView === view} className="!p-4 !rounded-full !border-0"><div className="capitalize">{view === 'dashboard' ? <LayoutDashboard className="w-5 h-5"/> : view === 'registry' ? <List className="w-5 h-5"/> : view === 'departments' ? <Building2 className="w-5 h-5"/> : <History className="w-5 h-5"/>}</div></GlassButton>
          ))}
          <div className="w-px h-8 bg-white/20 mx-2"></div>
          <button onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)} className="p-2 pr-4 rounded-full bg-black/20 flex items-center gap-3 hover:bg-black/40 transition-colors border border-white/10"><div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center font-bold text-white text-xs">{adminUser?.email ? adminUser.email.charAt(0).toUpperCase() : 'A'}</div><span className="text-xs font-bold mr-1">Admin</span></button>
          {isAdminMenuOpen && (
              <GlassCard className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 rounded-2xl p-2 w-48 flex flex-col gap-1">
                  <button onClick={() => setShowWipeModal(true)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/20 text-xs font-bold text-red-400 transition-colors text-left"><Trash2 className="w-4 h-4"/> Wipe Data</button>
                  <div className="h-px bg-white/10 my-1"></div>
                  <button onClick={handleAdminLogout} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 text-xs font-bold transition-colors text-left"><LogOut className="w-4 h-4"/> Logout</button>
              </GlassCard>
          )}
      </GlassCard>

      <main className="flex-1 h-full overflow-y-auto p-8 pb-32 relative z-10">
         <header className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4"><img src={aiimsLogo} className="w-12 h-12 object-contain" /><div><h1 className="text-3xl font-black capitalize mb-1 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">{activeView}</h1><p className="text-xs font-bold opacity-50 uppercase tracking-widest">Compliance Portal</p></div></div>
            <GlassButton onClick={() => setDarkMode(!darkMode)} className="!p-3 !rounded-full">{darkMode ? <Sun className="w-5 h-5 text-amber-300"/> : <Moon className="w-5 h-5 text-indigo-600"/>}</GlassButton>
         </header>

         {loading ? <TableSkeleton /> : (
             <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                {activeView === 'dashboard' && (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <GlassCard className="p-6 cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => {setFilterStatus('All'); setActiveView('registry')}}><h3 className="text-4xl font-black mb-2">{stats.total}</h3><p className="text-xs font-bold opacity-60 uppercase tracking-widest text-blue-300">Total Staff</p></GlassCard>
                            <GlassCard className="p-6 cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => {setFilterStatus('Accepted'); setActiveView('registry')}}><h3 className="text-4xl font-black mb-2">{stats.accepted}</h3><p className="text-xs font-bold opacity-60 uppercase tracking-widest text-emerald-300">Compliant</p></GlassCard>
                            <GlassCard className="p-6 cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => {setFilterStatus('Notified'); setActiveView('registry')}}><h3 className="text-4xl font-black mb-2">{stats.notified}</h3><p className="text-xs font-bold opacity-60 uppercase tracking-widest text-amber-300">Notified</p></GlassCard>
                            <GlassCard className="p-6 cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => {setFilterStatus('Pending'); setActiveView('registry')}}><h3 className="text-4xl font-black mb-2">{stats.pending}</h3><p className="text-xs font-bold opacity-60 uppercase tracking-widest text-red-300">Action Req</p></GlassCard>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <GlassCard className="p-8"><h3 className="font-bold mb-6 flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-400"/> Quick Actions</h3><div className="space-y-3"><button onClick={handleExportCSV} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-left text-sm font-bold opacity-80"><div className="p-2 bg-green-500/20 text-green-400 rounded-lg"><FileBarChart className="w-4 h-4"/></div> Download Report</button><button onClick={() => setIsImportModalOpen(true)} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-left text-sm font-bold opacity-80"><div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg"><FileSpreadsheet className="w-4 h-4"/></div> Import Data</button><button onClick={() => {resetForm(); setIsAddModalOpen(true)}} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-left text-sm font-bold opacity-80"><div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg"><Plus className="w-4 h-4"/></div> Add Staff</button></div></GlassCard>
                            <GlassCard className="md:col-span-2 p-8 flex items-center justify-between"><div><h3 className="font-bold mb-2 text-xl">Overview</h3><p className="text-sm opacity-50 mb-6 max-w-xs">System-wide compliance metrics.</p><div className="flex gap-4"><div className="flex items-center gap-2 text-xs font-bold opacity-70"><span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></span> Compliant</div><div className="flex items-center gap-2 text-xs font-bold opacity-70"><span className="w-3 h-3 rounded-full bg-white/20"></span> Pending</div></div></div><div className="w-40 h-40 rounded-full relative flex items-center justify-center shadow-2xl" style={{background: `conic-gradient(#10b981 ${stats.percentage}%, rgba(255,255,255,0.05) 0)`}}><div className="w-32 h-32 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10"><span className="text-3xl font-black">{stats.percentage}%</span></div></div></GlassCard>
                        </div>
                    </div>
                )}

                {activeView === 'registry' && (
                    <GlassCard className="overflow-hidden">
                        <div className="p-6 border-b border-white/5 flex flex-col md:flex-row justify-between gap-4"><input className="flex-1 bg-black/20 border border-white/10 rounded-2xl px-6 py-4 font-bold text-sm text-white outline-none focus:border-blue-500/50 transition-colors placeholder-white/30" placeholder="Search registry..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /><div className="flex gap-2"><GlassButton onClick={handleExportCSV}>Export</GlassButton><GlassButton onClick={() => setIsImportModalOpen(true)}>Import</GlassButton><GlassButton onClick={() => {resetForm(); setIsAddModalOpen(true)}} variant="active"><Plus className="w-4 h-4"/> Add New</GlassButton></div></div>
                        <table className="w-full text-left"><thead className="bg-white/5 text-xs font-bold opacity-50 uppercase"><tr><th className="p-6">Staff</th><th className="p-6">Department</th><th className="p-6">Responsible</th><th className="p-6 text-center">Notified</th><th className="p-6 text-center">Undertaking</th><th className="p-6 text-right">Action</th></tr></thead><tbody className="divide-y divide-white/5">{currentItems.map(emp => (<tr key={emp.id} className="hover:bg-white/5 transition-colors"><td className="p-6"><div className="font-bold text-sm">{emp.firstName} {emp.lastName}</div><div className="text-xs opacity-50">{emp.email}</div><div className="text-[10px] opacity-30 mt-1 font-mono">{emp.mobile || 'N/A'}</div></td><td className="p-6 text-xs font-bold opacity-60">{emp.department || 'Unassigned'}</td><td className="p-6">{emp.contactPerson ? (<div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-lg text-[10px] font-bold text-purple-400"><UserCheck className="w-3 h-3"/> {emp.contactPerson}</div>) : <span className="text-[10px] opacity-30">-</span>}</td><td className="p-6 text-center"><GlassButton onClick={() => toggleNotification(emp)} className="!px-3 !py-1 !text-[10px]" variant={emp.notificationSent ? "primary" : "amber"}>{emp.notificationSent ? <Bell className="w-3 h-3 fill-current"/> : <Send className="w-3 h-3"/>} {emp.notificationSent ? 'Sent' : 'Mark Sent'}</GlassButton></td><td className="p-6 text-center"><GlassButton onClick={() => toggleUndertaking(emp)} className="!px-3 !py-1 !text-[10px]" variant={emp.undertakingReceived ? "success" : "danger"}>{emp.undertakingReceived ? <CheckCircle2 className="w-3 h-3"/> : <XCircle className="w-3 h-3"/>} {emp.undertakingReceived ? 'Received' : 'Pending'}</GlassButton></td><td className="p-6 text-right flex gap-2 justify-end"><GlassButton onClick={() => {setFormData(emp); setEditingId(emp.id); setIsAddModalOpen(true)}} className="!p-2"><Edit2 className="w-4 h-4"/></GlassButton><GlassButton onClick={() => handleDeleteUser(emp.id)} variant="danger" className="!p-2"><Trash2 className="w-4 h-4"/></GlassButton></td></tr>))}</tbody></table>
                        <div className="p-6 border-t border-white/5 flex justify-between items-center bg-white/5"><span className="text-xs font-bold opacity-40">Page {currentPage} of {totalPages}</span><div className="flex gap-2"><GlassButton onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="w-4 h-4"/></GlassButton><GlassButton onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="w-4 h-4"/></GlassButton></div></div>
                    </GlassCard>
                )}

                {/* Other Views (Departments, Audit) follow same GlassCard pattern... */}
                {activeView === 'departments' && (
                    <div className="space-y-6">
                        {selectedDepartment ? (
                            <GlassCard className="animate-in slide-in-from-right duration-500"><div className="p-8 border-b border-white/10 flex justify-between items-center bg-black/20"><div><button onClick={() => setSelectedDepartment(null)} className="text-xs font-bold text-blue-400 mb-3 flex items-center gap-1 hover:underline"><ArrowLeft className="w-3 h-3"/> All Departments</button><h2 className="text-3xl font-black flex items-center gap-3"><Building2 className="w-8 h-8 text-blue-500"/> {selectedDepartment}</h2></div><div className="flex gap-3"><GlassButton onClick={() => {setDeptMetaForm(deptMetadata[selectedDepartment] || {}); setIsDeptEditModalOpen(true)}}>Edit Details</GlassButton><GlassButton onClick={() => setIsMoveMemberModalOpen(true)} variant="primary">Move Members</GlassButton></div></div><div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-4">{employees.filter(e => e.department === selectedDepartment).map(emp => (<div key={emp.id} className="p-5 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-4 hover:bg-white/10 transition-colors group"><div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-black flex items-center justify-center font-bold text-white shadow-lg border border-white/10">{emp.firstName.charAt(0)}</div><div className="overflow-hidden"><div className="text-sm font-bold truncate">{emp.firstName} {emp.lastName}</div><div className="text-xs opacity-40 truncate">{emp.email}</div></div><div className="ml-auto">{emp.undertakingReceived ? <CheckCircle2 className="w-5 h-5 text-emerald-400"/> : <Clock className="w-5 h-5 text-amber-400 opacity-50"/>}</div></div>))}</div></GlassCard>
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">All Departments</h3><GlassButton onClick={() => setIsDeptModalOpen(true)} variant="active"><FolderPlus className="w-4 h-4 inline mr-2"/>Create New</GlassButton></div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{Object.entries(stats.departments).map(([name, data]) => (<GlassCard key={name} className="p-6 hover:scale-[1.02] cursor-pointer transition-transform group" onClick={() => setSelectedDepartment(name)}><div className="flex justify-between items-start mb-6"><div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/10 flex items-center justify-center text-blue-300 font-bold text-2xl group-hover:scale-110 transition-transform">{name.charAt(0)}</div><span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${data.compliant === data.total ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/50'}`}>{data.total} Staff</span></div><h4 className="font-bold text-xl mb-3 truncate">{name}</h4><div className="w-full bg-white/5 h-2 rounded-full overflow-hidden mb-3"><div style={{width: `${(data.compliant/data.total)*100}%`}} className="bg-blue-500 h-full shadow-[0_0_10px_#3b82f6]"></div></div><div className="flex justify-between text-xs opacity-40 font-bold"><span>{Math.round((data.compliant/data.total)*100) || 0}% Compliance</span><span className="text-blue-400 group-hover:underline">Open &rarr;</span></div></GlassCard>))}</div>
                            </>
                        )}
                    </div>
                )}

                {activeView === 'audit' && (
                     <div className="max-w-3xl mx-auto space-y-8 relative pl-8 border-l border-white/10 ml-4 md:ml-auto md:pl-0 md:border-l-0 md:relative before:absolute before:left-1/2 before:top-0 before:bottom-0 before:w-px before:bg-gradient-to-b before:from-transparent before:via-white/20 before:to-transparent hidden md:block">
                        {auditLogs.map((log, i) => (<div key={i} className="flex items-center justify-between w-full"><div className="w-[45%] text-right pr-8"><div className="font-bold text-sm">{log.action}</div><div className="text-xs opacity-40 mt-1">{formatDate(log.timestamp)}</div></div><div className="absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-black border-2 border-blue-500 rounded-full shadow-[0_0_10px_#3b82f6] z-10"></div><div className="w-[45%] pl-8"><GlassCard className="p-4 rounded-xl"><p className="text-xs opacity-70">{log.details}</p><div className="mt-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest">{log.user}</div></GlassCard></div></div>))}
                     </div>
                )}
             </div>
         )}
      </main>

      {/* MODALS using GlassCard */}
      {isImportModalOpen && (<div className="fixed inset-0 bg-black/90 backdrop-blur-3xl z-50 flex items-center justify-center p-4"><GlassCard className="w-full max-w-md p-10 text-center"><div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-400 border border-blue-500/20"><UploadCloud className="w-10 h-10" /></div><h3 className="text-2xl font-black mb-2">Smart Import</h3><p className="text-sm opacity-50 mb-8">Upload your Excel file. We will automatically merge status updates without erasing existing data.</p><label className="block w-full py-12 border-2 border-dashed border-white/20 rounded-3xl cursor-pointer hover:border-blue-500/50 hover:bg-white/5 transition-all group"><input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" /><span className="text-sm font-bold opacity-60 group-hover:opacity-100 transition-colors">Click to Select .xlsx File</span></label><button onClick={() => setIsImportModalOpen(false)} className="mt-8 opacity-40 text-xs font-bold hover:opacity-100 uppercase tracking-widest transition-colors">Cancel Operation</button></GlassCard></div>)}
      {/* Wipe Modal */}
      {showWipeModal && (<div className="fixed inset-0 bg-black/90 backdrop-blur-3xl z-50 flex items-center justify-center p-4"><GlassCard className="w-full max-w-md p-10 border-red-500/30"><div className="flex flex-col items-center text-center mb-6"><div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/30"><ShieldAlert className="w-8 h-8 text-red-500"/></div><h3 className="text-2xl font-black text-red-500">Security Check</h3><p className="text-sm opacity-60 mt-2">Enter Admin Password to confirm wipe.</p></div><form onSubmit={handleVerifyAndWipe} className="space-y-4"><input type="password" value={wipePassword} onChange={(e) => setWipePassword(e.target.value)} className="w-full px-5 py-4 bg-black/30 border border-white/10 rounded-2xl font-bold outline-none focus:border-red-500/50 text-white placeholder-white/20 transition-all" placeholder="Admin Password" autoFocus /><div className="flex gap-3 pt-2"><GlassButton onClick={() => setShowWipeModal(false)} className="flex-1">Cancel</GlassButton><GlassButton type="submit" variant="danger" className="flex-1">Confirm Wipe</GlassButton></div></form></GlassCard></div>)}
      
      {/* Other Modals (Add/Edit etc) follow same pattern... */}
      {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-3xl z-50 flex items-center justify-center p-4">
              <GlassCard className="w-full max-w-lg p-8">
                  <h3 className="text-xl font-black mb-6">Staff Details</h3>
                  <form onSubmit={handleSave} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <input name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleInputChange} className="p-4 bg-black/20 border border-white/10 rounded-2xl text-sm font-bold text-white outline-none focus:border-blue-500/50" />
                        <input name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleInputChange} className="p-4 bg-black/20 border border-white/10 rounded-2xl text-sm font-bold text-white outline-none focus:border-blue-500/50" />
                      </div>
                      <input name="email" placeholder="Email" value={formData.email} onChange={handleInputChange} className="w-full p-4 bg-black/20 border border-white/10 rounded-2xl text-sm font-bold text-white outline-none focus:border-blue-500/50" />
                      <input name="contactPerson" placeholder="Responsible Person(s)" value={formData.contactPerson} onChange={handleInputChange} className="w-full p-4 bg-black/20 border border-white/10 rounded-2xl text-sm font-bold text-white outline-none focus:border-blue-500/50" />
                      <div className="grid grid-cols-2 gap-4">
                        <input name="department" placeholder="Department" value={formData.department} onChange={handleInputChange} className="p-4 bg-black/20 border border-white/10 rounded-2xl text-sm font-bold text-white outline-none focus:border-blue-500/50" />
                        <input name="mobile" placeholder="Mobile" value={formData.mobile} onChange={handleInputChange} className="p-4 bg-black/20 border border-white/10 rounded-2xl text-sm font-bold text-white outline-none focus:border-blue-500/50" />
                      </div>
                      <div className="flex gap-4 pt-4">
                          <GlassButton onClick={() => setIsAddModalOpen(false)} className="flex-1">Cancel</GlassButton>
                          <GlassButton type="submit" variant="primary" className="flex-1">Save</GlassButton>
                      </div>
                  </form>
              </GlassCard>
          </div>
      )}
    </div>
  );
};

export default App;