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
  onAuthStateChanged 
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
  FileSpreadsheet, List, FolderPlus, Clock, ArrowRightLeft, MousePointerClick
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

// --- Helper Components ---
const TableSkeleton = () => (
  <div className="animate-pulse space-y-3">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="h-16 bg-slate-200/50 dark:bg-white/5 rounded-2xl w-full backdrop-blur-sm"></div>
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
  // --- STATE ---
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

  // --- INIT ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user && !user.isAnonymous) {
            setAdminUser(user);
        } else {
            setAdminUser(null);
        }
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
    const unsubDept = onSnapshot(qDept, (snapshot) => {
        const meta = {};
        snapshot.docs.forEach(doc => { meta[doc.id] = doc.data(); });
        setDeptMetadata(meta);
    });

    const qLogs = query(collection(db, 'artifacts', appId, 'organization_data', ORG_ID, 'audit_logs'), orderBy('timestamp', 'desc'));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAuditLogs(logs);
    });
    
    return () => { unsubEmp(); unsubDept(); unsubLogs(); };
  };

  // --- ACTIONS ---
  const handleAdminLogin = async (e) => {
      e.preventDefault();
      setAuthError('');
      try {
          await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
          setShowAdminLogin(false);
          setLoginEmail(''); setLoginPassword('');
      } catch (err) {
          setAuthError("Invalid Credentials.");
      }
  };

  const handleAdminLogout = async () => {
      await signOut(auth);
      setAdminUser(null);
      setActiveView('dashboard');
  };

  const logAction = async (action, details, type = 'info', actor = 'Admin') => {
      try {
          await addDoc(collection(db, 'artifacts', appId, 'organization_data', ORG_ID, 'audit_logs'), {
              action, details, type, timestamp: new Date().toISOString(), user: actor
          });
      } catch (err) { console.error("Log Error:", err); }
  };

  // --- TOGGLE HANDLERS ---
  const toggleNotification = async (emp) => {
      if(!adminUser || viewOnlyMode) return;
      const newStatus = !emp.notificationSent;
      try {
          const ref = doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings', emp.id);
          let masterStatus = 'Pending';
          if(newStatus) masterStatus = 'Notified';
          if(emp.undertakingReceived) masterStatus = 'Accepted'; 

          await setDoc(ref, {
              notificationSent: newStatus,
              status: masterStatus,
              updatedAt: new Date().toISOString()
          }, { merge: true });
          await logAction("Manual Toggle", `Set Notification to ${newStatus} for ${emp.email}`, 'warning');
      } catch(e) { console.error(e); }
  };

  const toggleUndertaking = async (emp) => {
      if(!adminUser || viewOnlyMode) return;
      const newStatus = !emp.undertakingReceived;
      try {
          const ref = doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings', emp.id);
          await setDoc(ref, {
              undertakingReceived: newStatus,
              status: newStatus ? 'Accepted' : (emp.notificationSent ? 'Notified' : 'Pending'),
              updatedAt: new Date().toISOString()
          }, { merge: true });
          await logAction("Manual Toggle", `Set Undertaking to ${newStatus} for ${emp.email}`, 'warning');
      } catch(e) { console.error(e); }
  };

  const handleCreateDepartment = async () => {
      if(!adminUser || viewOnlyMode) return;
      if(!deptFormData.name.trim()) return alert("Please enter a department name.");
      try {
          const batch = writeBatch(db);
          deptFormData.selectedEmps.forEach(empId => {
              const ref = doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings', empId);
              batch.update(ref, { department: deptFormData.name, updatedAt: new Date().toISOString() });
          });
          await batch.commit();
          await logAction("Department Created", `Created '${deptFormData.name}'`, 'success');
          setIsDeptModalOpen(false);
          setDeptFormData({ name: '', selectedEmps: [] });
      } catch (err) { console.error(err); alert("Failed."); }
  };

  const handleUpdateDeptMeta = async () => {
      if(!adminUser || viewOnlyMode || !selectedDepartment) return;
      try {
          await setDoc(doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'department_metadata', selectedDepartment), {
              ...deptMetaForm, updatedAt: new Date().toISOString()
          }, { merge: true });
          setIsDeptEditModalOpen(false);
          await logAction("Dept Info Updated", `Updated metadata for ${selectedDepartment}`, 'info');
      } catch (err) { console.error(err); alert("Failed."); }
  };

  const handleMoveEmployees = async () => {
      if(!adminUser || viewOnlyMode || !selectedDepartment) return;
      if(selectedMoveEmps.length === 0) return alert("Select at least one employee.");
      try {
          const batch = writeBatch(db);
          selectedMoveEmps.forEach(empId => {
              const ref = doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings', empId);
              batch.update(ref, { department: selectedDepartment, updatedAt: new Date().toISOString() });
          });
          await batch.commit();
          await logAction("Staff Moved", `Moved ${selectedMoveEmps.length} staff to ${selectedDepartment}`, 'warning');
          setIsMoveMemberModalOpen(false); setSelectedMoveEmps([]);
      } catch (err) { console.error(err); alert("Move failed."); }
  };

  const handleExportCSV = () => {
      const headers = ["Sr No", "First Name", "Last Name", "Email", "Department", "Mobile", "Status", "Undertaking Received", "Notification Sent"];
      const csv = [headers.join(","), ...employees.map(e => 
        [e.srNo, `"${e.firstName}"`, `"${e.lastName}"`, e.email, `"${e.department || ''}"`, e.mobile, e.status, e.undertakingReceived ? "Yes" : "No", e.notificationSent ? "Yes" : "No"].join(",")
      )].join("\n");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      link.download = `aiims_compliance_report_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      logAction("Data Export", "Downloaded CSV Report");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !adminUser) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
        if (jsonData.length < 2) return alert("File appears empty.");
        const batch = writeBatch(db);
        let count = 0;
        const headers = jsonData[0].map(h => h?.toString().toLowerCase().trim() || '');
        const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('user id'));
        
        let notifIdx = headers.findIndex(h => h.includes('email sent') || h.includes('notification'));
        let underIdx = headers.findIndex(h => h.includes('undertaking') || h.includes('received'));
        let deptIdx = headers.findIndex(h => h.includes('department') || h.includes('dept'));
        let mobileIdx = headers.findIndex(h => h.includes('mobile'));

        const isTrue = (val) => {
            if (!val) return false;
            const s = val.toString().toLowerCase().trim();
            return s === 'yes' || s === 'true' || s === 'done' || s === 'sent' || s === 'received' || s === 'later' || s.length > 1;
        };

        const existingUsers = new Map(employees.map(e => [e.email.toLowerCase(), e]));

        jsonData.forEach((row, index) => {
           if (index === 0) return; 
           const email = row[emailIdx > -1 ? emailIdx : 3]?.toString().trim();
           if (email && email.includes('@')) {
              const docRef = doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings', email);
              const existing = existingUsers.get(email.toLowerCase());
              let newNotified = existing?.notificationSent || false;
              if (notifIdx > -1 && row[notifIdx]) newNotified = true; 
              let newUndertaking = existing?.undertakingReceived || false;
              if (underIdx > -1 && isTrue(row[underIdx])) newUndertaking = true;
              let newDept = existing?.department || 'Unassigned';
              if (deptIdx > -1 && row[deptIdx]) newDept = row[deptIdx];

              batch.set(docRef, {
                  srNo: row[0] || existing?.srNo || '',
                  firstName: row[1] || existing?.firstName || '',
                  lastName: row[2] || existing?.lastName || '',
                  email: email,
                  department: newDept,
                  mobile: (mobileIdx > -1 && row[mobileIdx]) ? row[mobileIdx] : (existing?.mobile || ''),
                  contactPerson: existing?.contactPerson || row[4] || '',
                  notificationSent: newNotified,
                  undertakingReceived: newUndertaking,
                  status: newUndertaking ? 'Accepted' : (newNotified ? 'Notified' : 'Pending'),
                  updatedAt: new Date().toISOString()
              }, { merge: true });
              count++;
           }
        });
        await batch.commit();
        await logAction("Bulk Import", `Merged ${count} records from Excel`, 'info');
        alert(`Merged ${count} records successfully.`);
        setIsImportModalOpen(false);
      } catch (err) { alert("Import failed."); console.error(err); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleEmployeeSearch = (e) => {
      e.preventDefault();
      const emp = employees.find(e => e.email.toLowerCase() === empSearchEmail.toLowerCase().trim());
      if(!emp) { alert("No record found. Please contact IT Division."); return; }
      setFoundEmployee(emp); setUploadStatus('idle');
  };

  const handleEmployeeUpload = async (e) => {
      const file = e.target.files[0];
      if(!file || !foundEmployee) return;
      setUploadStatus('uploading');
      setTimeout(async () => {
          try {
              const ref = doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings', foundEmployee.id);
              await setDoc(ref, { undertakingReceived: true, receivedDate: new Date().toISOString().split('T')[0], status: 'Accepted', updatedAt: new Date().toISOString() }, { merge: true });
              await logAction("Undertaking Uploaded", `User ${foundEmployee.email} uploaded compliance doc.`, 'success', 'Employee Portal');
              setUploadStatus('success');
              setShowConfetti(true);
              setTimeout(() => setShowConfetti(false), 8000); 
          } catch (err) { console.error(err); setUploadStatus('error'); }
      }, 2000);
  };

  const stats = useMemo(() => {
    const total = employees.length;
    const accepted = employees.filter(e => e.undertakingReceived).length;
    const pending = employees.filter(e => !e.undertakingReceived).length;
    const notified = employees.filter(e => e.notificationSent && !e.undertakingReceived).length;
    const deptMap = { 'Unassigned': { name: 'Unassigned', total: 0, compliant: 0, employees: [] } };
    employees.forEach(emp => {
        let d = (emp.department || 'Unassigned').trim();
        if(!d) d = 'Unassigned';
        if(!deptMap[d]) deptMap[d] = { name: d, total: 0, compliant: 0, employees: [] };
        deptMap[d].total++;
        if (emp.undertakingReceived) deptMap[d].compliant++;
    });
    if(deptMap['Unassigned'].total === 0) delete deptMap['Unassigned'];
    return { total, accepted, pending, notified, percentage: total > 0 ? Math.round((accepted / total) * 100) : 0, departments: deptMap };
  }, [employees]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!adminUser || viewOnlyMode) return;
    const docId = formData.email || `unknown_${Date.now()}`;
    let status = 'Pending';
    if(formData.notificationSent) status = 'Notified';
    if(formData.undertakingReceived) status = 'Accepted';
    try {
        await setDoc(doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings', docId), { ...formData, status, updatedAt: new Date().toISOString() }, { merge: true });
        await logAction(editingId ? "Updated Record" : "Created Record", `Employee: ${formData.email}`, 'success');
        setIsAddModalOpen(false); resetForm();
    } catch (err) { alert("Error saving record."); }
  };
  
  const handleClearDatabase = async () => {
    if (!adminUser || !window.confirm("⚠️ DANGER: This will delete ALL records. Are you sure?")) return;
    if (!window.confirm("⚠️ FINAL WARNING: This action cannot be undone. Confirm wipe?")) return;
    try {
        const batch = writeBatch(db);
        employees.forEach(emp => {
            const ref = doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings', emp.id);
            batch.delete(ref);
        });
        await batch.commit();
        await logAction("Database Wipe", "All records deleted by Admin", 'danger');
        alert("Database cleared successfully.");
    } catch (err) { console.error(err); alert("Failed to clear database."); }
  };

  const handleInputChange = (e) => { const { name, value, type, checked } = e.target; setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value })); };
  const resetForm = () => { setFormData({ firstName: '', lastName: '', email: '', contactPerson: '', mobile: '', status: 'Pending', notificationSent: false, undertakingReceived: false, type: 'Individual', srNo: '', department: '', responsibleOfficer: '', sentDate: '', receivedDate: '' }); setEditingId(null); };

  const filteredEmployees = employees.filter(emp => {
      const matchSearch = (emp.email || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (emp.firstName || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (filterStatus === 'All') return matchSearch;
      if (filterStatus === 'Accepted') return matchSearch && emp.undertakingReceived;
      if (filterStatus === 'Notified') return matchSearch && emp.notificationSent;
      if (filterStatus === 'Pending') return matchSearch && !emp.notificationSent && !emp.undertakingReceived;
      return matchSearch;
  });

  const unassignedEmployees = employees.filter(e => (!e.department || e.department === 'Unassigned'));

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredEmployees.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  // --- UI CONSTANTS ---
  const glassClass = darkMode 
    ? "bg-white/5 border border-white/10 text-white backdrop-blur-xl shadow-lg hover:bg-white/10"
    : "bg-white/70 border border-white/50 text-slate-800 backdrop-blur-xl shadow-lg hover:bg-white/90";
  
  const bgClass = darkMode
    ? "bg-black text-white"
    : "bg-[#eef2f6] text-slate-900"; 

  // === RENDER ===
  if (!adminUser) {
      return (
        <div className={`flex items-center justify-center min-h-screen relative overflow-hidden ${bgClass} transition-colors duration-500`}>
             {showConfetti && <Confetti numberOfPieces={200} recycle={false} />}
             
             {/* Liquid Gradient Orbs */}
             <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/20 rounded-full blur-[150px] animate-pulse"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/20 rounded-full blur-[150px]"></div>

             <div className="absolute top-6 right-6 flex gap-3 z-20">
                 <button onClick={() => setDarkMode(!darkMode)} className={`p-3 rounded-full ${glassClass} transition-transform hover:scale-110`}>
                    {darkMode ? <Sun className="w-5 h-5 text-amber-300"/> : <Moon className="w-5 h-5 text-indigo-600"/>}
                 </button>
                 <button onClick={() => setShowAdminLogin(true)} className={`flex items-center gap-2 px-5 py-3 rounded-full text-xs font-bold transition-all hover:scale-105 ${glassClass}`}>
                    <Lock className="w-4 h-4"/> Admin
                 </button>
             </div>

             <div className={`w-full max-w-lg p-10 mx-4 rounded-[3rem] shadow-2xl relative z-10 animate-in fade-in zoom-in duration-700 ${glassClass}`}>
                 <div className="flex flex-col items-center text-center mb-10">
                     <div className={`w-28 h-28 rounded-full shadow-xl p-5 mb-6 flex items-center justify-center ${darkMode ? 'bg-white/10 border-white/20' : 'bg-white border-blue-100'}`}>
                        <img src={aiimsLogo} alt="AIIMS" className="w-full h-full object-contain" />
                     </div>
                     <h1 className="text-3xl font-black mb-1 text-center">AIIMS Raipur</h1>
                     <p className={`text-sm font-bold uppercase tracking-widest ${darkMode ? 'text-white/60' : 'text-slate-500'}`}>Compliance Portal</p>
                 </div>

                 {showPublicList ? (
                     <div className="animate-in slide-in-from-right duration-300">
                         <div className="flex items-center justify-between mb-6">
                             <h3 className="font-bold text-lg">Public Status List</h3>
                             <button onClick={() => setShowPublicList(false)} className="text-xs font-bold text-blue-500 hover:underline">Back</button>
                         </div>
                         <div className={`rounded-3xl border overflow-hidden max-h-96 overflow-y-auto ${darkMode ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-white/50'}`}>
                             <table className="w-full text-left text-xs">
                                 <thead className={`${darkMode ? 'bg-white/10 text-white/50' : 'bg-slate-100 text-slate-500'} font-bold uppercase sticky top-0 backdrop-blur-md`}>
                                     <tr><th className="p-4">Name</th><th className="p-4">Dept</th><th className="p-4 text-right">Status</th></tr>
                                 </thead>
                                 <tbody className={`divide-y ${darkMode ? 'divide-white/10' : 'divide-slate-200'}`}>
                                     {employees.map(emp => (
                                         <tr key={emp.id} className="hover:bg-white/5 transition-colors">
                                             <td className="p-4 font-bold">{emp.firstName} {emp.lastName}</td>
                                             <td className={`p-4 ${darkMode ? 'text-white/60' : 'text-slate-500'}`}>{emp.department}</td>
                                             <td className="p-4 text-right">
                                                 {emp.undertakingReceived ? 
                                                    <span className="text-emerald-500 font-bold">Received</span> : 
                                                    <span className="text-amber-500 font-bold">Pending</span>
                                                 }
                                             </td>
                                         </tr>
                                     ))}
                                 </tbody>
                             </table>
                         </div>
                     </div>
                 ) : (
                     <>
                        {!foundEmployee ? (
                            <form onSubmit={handleEmployeeSearch} className="space-y-6">
                                <div className="space-y-4">
                                    <div className="relative group">
                                        <Mail className={`absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${darkMode ? 'text-white/50' : 'text-slate-400'}`} />
                                        <input type="email" placeholder="Official Email ID" value={empSearchEmail} onChange={(e) => setEmpSearchEmail(e.target.value)} className={`w-full pl-14 pr-6 py-5 rounded-2xl outline-none font-bold transition-all shadow-inner border ${darkMode ? 'bg-black/20 border-white/10 text-white focus:ring-blue-500/50' : 'bg-white border-slate-200 text-slate-900 focus:ring-blue-200'}`} required />
                                    </div>
                                </div>
                                <button type="submit" className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3">
                                    Check Status <ArrowLeft className="w-5 h-5 rotate-180"/>
                                </button>
                                <button type="button" onClick={() => setShowPublicList(true)} className={`w-full py-3 text-xs font-bold flex items-center justify-center gap-2 ${darkMode ? 'text-white/50 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                                    <List className="w-4 h-4"/> View Public List
                                </button>
                            </form>
                        ) : (
                            <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
                                <div className={`p-6 rounded-3xl border text-left relative overflow-hidden group ${darkMode ? 'bg-white/5 border-white/10' : 'bg-white/60 border-white'}`}>
                                    <button onClick={() => {setFoundEmployee(null); setUploadStatus('idle');}} className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 transition-colors"><LogOut className="w-5 h-5 opacity-60"/></button>
                                    <h3 className="text-[10px] font-bold uppercase text-blue-500 tracking-wider mb-3">Authenticated User</h3>
                                    <div className="flex items-center gap-5">
                                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg">
                                            {(foundEmployee.firstName || '?').charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-xl font-black leading-tight">{foundEmployee.firstName} {foundEmployee.lastName}</p>
                                            <p className="text-sm opacity-60 font-medium mt-1">{foundEmployee.email}</p>
                                        </div>
                                    </div>
                                    <div className="mt-6">
                                        <div className={`py-3 rounded-xl text-xs font-bold uppercase text-center border backdrop-blur-md ${foundEmployee.undertakingReceived ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'}`}>
                                            {foundEmployee.undertakingReceived ? '✅ Compliance Verified' : '⚠️ Action Required'}
                                        </div>
                                    </div>
                                </div>

                                {uploadStatus === 'success' || foundEmployee.undertakingReceived ? (
                                    <div className="text-center py-8 bg-emerald-500/10 rounded-3xl border border-emerald-500/20 relative overflow-hidden">
                                        <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white shadow-lg animate-bounce">
                                            <CheckCircle2 className="w-10 h-10"/>
                                        </div>
                                        <h3 className="text-2xl font-black mb-1">You are Compliant!</h3>
                                        <p className="text-sm opacity-70 px-6">Your undertaking has been securely filed.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className={`relative border-2 border-dashed rounded-3xl p-10 text-center transition-all duration-300 ${uploadStatus === 'uploading' ? 'border-blue-500 bg-blue-500/5' : 'border-current opacity-60 hover:opacity-100 hover:border-blue-500 cursor-pointer hover:scale-[1.02]'}`}>
                                            {uploadStatus === 'uploading' ? (
                                                <div className="flex flex-col items-center"><Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4"/><p className="text-sm font-bold text-blue-500">Uploading...</p></div>
                                            ) : (
                                                <label className="cursor-pointer block">
                                                    <input type="file" accept=".pdf,.jpg,.png" onChange={handleEmployeeUpload} className="hidden" />
                                                    <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                                                        <UploadCloud className="w-8 h-8" />
                                                    </div>
                                                    <p className="text-lg font-bold mb-1">Upload Signed Undertaking</p>
                                                    <p className="text-xs opacity-50">PDF, JPG or PNG (Max 5MB)</p>
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                     </>
                 )}
             </div>

             {showAdminLogin && (
                 <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4">
                     <div className={`p-10 rounded-[2.5rem] shadow-2xl w-full max-w-sm relative animate-in zoom-in-95 duration-300 ${glassClass}`}>
                         <button onClick={() => setShowAdminLogin(false)} className="absolute top-6 right-6 opacity-50 hover:opacity-100"><XCircle className="w-8 h-8"/></button>
                         <div className="flex flex-col items-center mb-8">
                             <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border border-white/20 shadow-lg bg-gradient-to-br from-white/10 to-transparent"><Lock className="w-8 h-8"/></div>
                             <h2 className="text-2xl font-black">Admin Console</h2>
                         </div>
                         <form onSubmit={handleAdminLogin} className="space-y-5">
                             <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className={`w-full px-5 py-4 rounded-2xl font-bold outline-none border focus:ring-2 focus:ring-blue-500/50 ${darkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-100 border-slate-200 text-black'}`} placeholder="Email" autoFocus />
                             <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className={`w-full px-5 py-4 rounded-2xl font-bold outline-none border focus:ring-2 focus:ring-blue-500/50 ${darkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-100 border-slate-200 text-black'}`} placeholder="Password" />
                             <button type="submit" className="w-full py-4 bg-white text-black rounded-2xl font-bold hover:scale-[1.02] transition-transform shadow-xl">Unlock</button>
                         </form>
                     </div>
                 </div>
             )}
        </div>
      );
  }

  // === ADMIN DASHBOARD ===
  return (
    <div className={`flex h-screen w-full overflow-hidden ${bgClass} transition-colors duration-500`}>
      
      {/* Ambient Background */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden opacity-50">
          <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-blue-500/20 rounded-full blur-[150px]"></div>
          <div className="absolute bottom-[10%] left-[10%] w-[30%] h-[30%] bg-purple-500/20 rounded-full blur-[150px]"></div>
      </div>

      {/* FLOATING GLASS DOCK */}
      <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-2 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-in slide-in-from-bottom-10 duration-700 ${glassClass}`}>
          <button onClick={() => {setActiveView('dashboard'); setSelectedDepartment(null)}} className={`p-4 rounded-full transition-all duration-300 ${activeView === 'dashboard' ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'opacity-60 hover:opacity-100'}`}><LayoutDashboard className="w-6 h-6" /></button>
          <button onClick={() => {setActiveView('registry'); setSelectedDepartment(null)}} className={`p-4 rounded-full transition-all duration-300 ${activeView === 'registry' ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'opacity-60 hover:opacity-100'}`}><List className="w-6 h-6" /></button>
          <button onClick={() => {setActiveView('departments'); setSelectedDepartment(null)}} className={`p-4 rounded-full transition-all duration-300 ${activeView === 'departments' ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'opacity-60 hover:opacity-100'}`}><Building2 className="w-6 h-6" /></button>
          <button onClick={() => {setActiveView('audit'); setSelectedDepartment(null)}} className={`p-4 rounded-full transition-all duration-300 ${activeView === 'audit' ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'opacity-60 hover:opacity-100'}`}><History className="w-6 h-6" /></button>
          <div className="w-px h-8 bg-current opacity-20 mx-2"></div>
          <button onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)} className="p-2 pr-4 rounded-full bg-black/5 flex items-center gap-3 hover:bg-black/10 transition-colors">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center font-bold text-white text-xs">{adminUser?.email ? adminUser.email.charAt(0).toUpperCase() : 'A'}</div>
              <span className="text-xs font-bold mr-1">Admin</span>
          </button>
          {isAdminMenuOpen && (
              <div className={`absolute bottom-full mb-4 left-1/2 -translate-x-1/2 rounded-2xl p-2 w-48 shadow-2xl flex flex-col gap-1 ${glassClass}`}>
                  <button onClick={handleClearDatabase} className="flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 text-xs font-bold text-red-500 transition-colors text-left"><Trash2 className="w-4 h-4"/> Wipe Data</button>
                  <div className="h-px bg-current opacity-10 my-1"></div>
                  <button onClick={handleAdminLogout} className="flex items-center gap-3 p-3 rounded-xl hover:bg-black/5 text-xs font-bold transition-colors text-left"><LogOut className="w-4 h-4"/> Logout</button>
              </div>
          )}
      </div>

      {/* CONTENT AREA */}
      <main className="flex-1 h-full overflow-y-auto p-8 pb-32 relative z-10 scroll-smooth">
         <header className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
                <img src={aiimsLogo} className="w-12 h-12 object-contain" />
                <div>
                    <h1 className="text-3xl font-black capitalize mb-1">{activeView}</h1>
                    <p className="text-xs font-bold opacity-50 uppercase tracking-widest">AIIMS Compliance Portal</p>
                </div>
            </div>
            <button onClick={() => setDarkMode(!darkMode)} className={`p-3 rounded-full ${glassClass} transition-transform hover:scale-110`}>{darkMode ? <Sun className="w-5 h-5 text-amber-300"/> : <Moon className="w-5 h-5 text-indigo-600"/>}</button>
         </header>

         {loading ? <TableSkeleton /> : (
             <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                {activeView === 'dashboard' && (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <button onClick={() => {setFilterStatus('All'); setActiveView('registry')}} className={`p-6 rounded-[2.5rem] text-left transition-all group ${glassClass} border-l-4 border-l-blue-500`}>
                                <h3 className="text-4xl font-black mb-2 group-hover:scale-110 transition-transform origin-left">{stats.total}</h3>
                                <p className="text-xs font-bold opacity-60 uppercase tracking-widest">Total Staff</p>
                            </button>
                            <button onClick={() => {setFilterStatus('Accepted'); setActiveView('registry')}} className={`p-6 rounded-[2.5rem] text-left transition-all group ${glassClass} border-l-4 border-l-emerald-500`}>
                                <h3 className="text-4xl font-black mb-2 group-hover:scale-110 transition-transform origin-left">{stats.accepted}</h3>
                                <p className="text-xs font-bold opacity-60 uppercase tracking-widest">Compliant</p>
                            </button>
                            <button onClick={() => {setFilterStatus('Notified'); setActiveView('registry')}} className={`p-6 rounded-[2.5rem] text-left transition-all group ${glassClass} border-l-4 border-l-amber-500`}>
                                <h3 className="text-4xl font-black mb-2 group-hover:scale-110 transition-transform origin-left">{stats.notified}</h3>
                                <p className="text-xs font-bold opacity-60 uppercase tracking-widest">Notified</p>
                            </button>
                            <button onClick={() => {setFilterStatus('Pending'); setActiveView('registry')}} className={`p-6 rounded-[2.5rem] text-left transition-all group ${glassClass} border-l-4 border-l-red-500`}>
                                <h3 className="text-4xl font-black mb-2 group-hover:scale-110 transition-transform origin-left">{stats.pending}</h3>
                                <p className="text-xs font-bold opacity-60 uppercase tracking-widest">Action Req</p>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className={`rounded-[2.5rem] p-8 ${glassClass}`}>
                                <h3 className="font-bold mb-6 flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-400"/> Quick Actions</h3>
                                <div className="space-y-3">
                                    <button onClick={handleExportCSV} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-black/5 hover:bg-black/10 transition-colors text-left text-sm font-bold opacity-80">
                                        <div className="p-2 bg-green-500/20 text-green-500 rounded-lg"><FileBarChart className="w-4 h-4"/></div> Download Report
                                    </button>
                                    <button onClick={() => setIsImportModalOpen(true)} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-black/5 hover:bg-black/10 transition-colors text-left text-sm font-bold opacity-80">
                                        <div className="p-2 bg-purple-500/20 text-purple-500 rounded-lg"><FileSpreadsheet className="w-4 h-4"/></div> Import Data
                                    </button>
                                    <button onClick={() => {resetForm(); setIsAddModalOpen(true)}} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-black/5 hover:bg-black/10 transition-colors text-left text-sm font-bold opacity-80">
                                        <div className="p-2 bg-blue-500/20 text-blue-500 rounded-lg"><Plus className="w-4 h-4"/></div> Add Staff
                                    </button>
                                </div>
                            </div>

                            <div className={`md:col-span-2 rounded-[2.5rem] p-8 flex items-center justify-between ${glassClass}`}>
                                <div>
                                    <h3 className="font-bold mb-2 text-xl">Compliance Analytics</h3>
                                    <p className="text-sm opacity-50 mb-6 max-w-xs">Real-time status tracking across all departments.</p>
                                    <div className="flex gap-4">
                                        <div className="flex items-center gap-2 text-xs font-bold opacity-70"><span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></span> Compliant</div>
                                        <div className="flex items-center gap-2 text-xs font-bold opacity-70"><span className="w-3 h-3 rounded-full bg-slate-500"></span> Pending</div>
                                    </div>
                                </div>
                                <div className="w-40 h-40 rounded-full relative flex items-center justify-center shadow-2xl" style={{background: `conic-gradient(#10b981 ${stats.percentage}%, rgba(128,128,128,0.2) 0)`}}>
                                    <div className={`w-32 h-32 rounded-full flex items-center justify-center ${darkMode ? 'bg-black' : 'bg-slate-50'}`}>
                                        <span className="text-3xl font-black">{stats.percentage}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeView === 'registry' && (
                    <div className={`rounded-[2.5rem] overflow-hidden shadow-2xl ${glassClass}`}>
                        <div className="p-6 border-b border-white/5 flex flex-col md:flex-row justify-between gap-4">
                            <input className={`flex-1 rounded-2xl px-6 py-4 font-bold text-sm outline-none transition-colors ${darkMode ? 'bg-black/30 focus:bg-black/50 text-white' : 'bg-white focus:bg-white/80 text-black'}`} placeholder="Search registry..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            <div className="flex gap-2">
                                <button onClick={handleExportCSV} className="px-5 py-2 bg-black/5 border border-white/10 rounded-xl font-bold text-xs hover:bg-black/10 transition-colors">Export</button>
                                <button onClick={() => setIsImportModalOpen(true)} className="px-5 py-2 bg-black/5 border border-white/10 rounded-xl font-bold text-xs hover:bg-black/10 transition-colors">Import</button>
                                <button onClick={() => {resetForm(); setIsAddModalOpen(true)}} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-colors shadow-lg">Add New</button>
                            </div>
                        </div>
                        <table className="w-full text-left">
                            <thead className="bg-black/5 text-xs font-bold opacity-50 uppercase">
                                <tr>
                                    <th className="p-6">Staff</th>
                                    <th className="p-6">Department</th>
                                    <th className="p-6 text-center">Notified</th>
                                    <th className="p-6 text-center">Undertaking</th>
                                    <th className="p-6 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {currentItems.map(emp => (
                                    <tr key={emp.id} className="hover:bg-black/5 transition-colors">
                                        <td className="p-6">
                                            <div className="font-bold text-sm">{emp.firstName} {emp.lastName}</div>
                                            <div className="text-xs opacity-50">{emp.email}</div>
                                            <div className="text-[10px] opacity-30 mt-1 font-mono">{emp.mobile || 'N/A'}</div>
                                        </td>
                                        <td className="p-6 text-xs font-bold opacity-60">{emp.department || 'Unassigned'}</td>
                                        
                                        {/* CLICKABLE NOTIFICATION TOGGLE */}
                                        <td className="p-6 text-center">
                                            <button 
                                                onClick={() => toggleNotification(emp)}
                                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border shadow-sm hover:scale-105 active:scale-95 ${
                                                    emp.notificationSent 
                                                    ? 'bg-blue-500/20 text-blue-500 border-blue-500/30 shadow-blue-500/10' 
                                                    : 'bg-white/5 text-white/30 border-white/10 hover:bg-white/10 hover:text-white'
                                                }`}
                                            >
                                                {emp.notificationSent ? <Bell className="w-3 h-3 fill-current"/> : <MousePointerClick className="w-3 h-3"/>}
                                                {emp.notificationSent ? 'Sent' : 'Mark Sent'}
                                            </button>
                                        </td>

                                        {/* CLICKABLE UNDERTAKING TOGGLE */}
                                        <td className="p-6 text-center">
                                            <button 
                                                onClick={() => toggleUndertaking(emp)}
                                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border shadow-sm hover:scale-105 active:scale-95 ${
                                                    emp.undertakingReceived 
                                                    ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30 shadow-emerald-500/10' 
                                                    : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 hover:text-red-300'
                                                }`}
                                            >
                                                {emp.undertakingReceived ? <CheckCircle2 className="w-3 h-3"/> : <XCircle className="w-3 h-3"/>}
                                                {emp.undertakingReceived ? 'Received' : 'Pending'}
                                            </button>
                                        </td>

                                        <td className="p-6 text-right">
                                            <button onClick={() => {setFormData(emp); setEditingId(emp.id); setIsAddModalOpen(true)}} className="opacity-40 hover:opacity-100 p-2 rounded-lg bg-black/5 hover:bg-black/10 transition-colors"><Edit2 className="w-4 h-4"/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="p-6 border-t border-white/5 flex justify-between items-center bg-black/5">
                            <span className="text-xs font-bold opacity-40">Page {currentPage} of {totalPages}</span>
                            <div className="flex gap-2">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-3 rounded-lg hover:bg-black/10 disabled:opacity-30"><ChevronLeft className="w-4 h-4"/></button>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-3 rounded-lg hover:bg-black/10 disabled:opacity-30"><ChevronRight className="w-4 h-4"/></button>
                            </div>
                        </div>
                    </div>
                )}

                {activeView === 'departments' && (
                    <div className="space-y-6">
                        {selectedDepartment ? (
                            <div className={`rounded-[2.5rem] overflow-hidden animate-in slide-in-from-right duration-500 ${glassClass}`}>
                                <div className="p-8 border-b border-white/10 flex justify-between items-center bg-black/5">
                                    <div>
                                        <button onClick={() => setSelectedDepartment(null)} className="text-xs font-bold text-blue-500 mb-3 flex items-center gap-1 hover:underline"><ArrowLeft className="w-3 h-3"/> All Departments</button>
                                        <h2 className="text-3xl font-black flex items-center gap-3"><Building2 className="w-8 h-8 text-blue-500"/> {selectedDepartment}</h2>
                                        <div className="flex gap-6 mt-3 text-xs opacity-50 font-bold uppercase tracking-wider">
                                            <span className="flex items-center gap-2"><UserCircle className="w-3 h-3"/> {deptMetadata[selectedDepartment]?.hodName || 'No Head Assigned'}</span>
                                            <span className="flex items-center gap-2"><Phone className="w-3 h-3"/> {deptMetadata[selectedDepartment]?.hodPhone || 'N/A'}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={() => {setDeptMetaForm(deptMetadata[selectedDepartment] || {}); setIsDeptEditModalOpen(true)}} className="px-4 py-2 bg-black/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-black/10 transition-colors">Edit Details</button>
                                        <button onClick={() => setIsMoveMemberModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 transition-colors shadow-lg">Move Members</button>
                                    </div>
                                </div>
                                <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {employees.filter(e => e.department === selectedDepartment).map(emp => (
                                        <div key={emp.id} className="p-5 bg-black/5 border border-white/5 rounded-2xl flex items-center gap-4 hover:bg-black/10 transition-colors group">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-400 dark:from-gray-700 dark:to-black flex items-center justify-center font-bold text-white shadow-lg">{emp.firstName.charAt(0)}</div>
                                            <div className="overflow-hidden">
                                                <div className="text-sm font-bold truncate">{emp.firstName} {emp.lastName}</div>
                                                <div className="text-xs opacity-40 truncate">{emp.email}</div>
                                            </div>
                                            <div className="ml-auto">
                                                {emp.undertakingReceived ? <CheckCircle2 className="w-5 h-5 text-emerald-500"/> : <Clock className="w-5 h-5 text-amber-500 opacity-50"/>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xl font-bold">All Departments</h3>
                                    <button onClick={() => setIsDeptModalOpen(true)} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-lg"><FolderPlus className="w-4 h-4 inline mr-2"/>Create New</button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {Object.entries(stats.departments).map(([name, data]) => (
                                        <div key={name} onClick={() => setSelectedDepartment(name)} className={`p-6 rounded-[2rem] hover:bg-white/20 transition-all cursor-pointer group hover:scale-[1.02] ${glassClass}`}>
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/10 flex items-center justify-center text-blue-500 font-bold text-2xl group-hover:scale-110 transition-transform">{name.charAt(0)}</div>
                                                <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${data.compliant === data.total ? 'bg-emerald-500/20 text-emerald-500' : 'bg-black/5 opacity-50'}`}>{data.total} Staff</span>
                                            </div>
                                            <h4 className="font-bold text-xl mb-3 truncate">{name}</h4>
                                            <div className="w-full bg-black/10 h-2 rounded-full overflow-hidden mb-3">
                                                <div style={{width: `${(data.compliant/data.total)*100}%`}} className="bg-blue-500 h-full shadow-[0_0_10px_#3b82f6]"></div>
                                            </div>
                                            <div className="flex justify-between text-xs opacity-40 font-bold">
                                                <span>{Math.round((data.compliant/data.total)*100) || 0}% Compliance</span>
                                                <span className="text-blue-500 group-hover:underline">Open &rarr;</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeView === 'audit' && (
                     <div className="max-w-3xl mx-auto space-y-8 relative pl-8 border-l border-white/10 ml-4 md:ml-auto md:pl-0 md:border-l-0 md:relative before:absolute before:left-1/2 before:top-0 before:bottom-0 before:w-px before:bg-gradient-to-b before:from-transparent before:via-white/20 before:to-transparent hidden md:block">
                        {auditLogs.map((log, i) => (
                            <div key={i} className="flex items-center justify-between w-full">
                                <div className="w-[45%] text-right pr-8">
                                    <div className="font-bold text-sm">{log.action}</div>
                                    <div className="text-xs opacity-40 mt-1">{formatDate(log.timestamp)}</div>
                                </div>
                                <div className="absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-black border-2 border-blue-500 rounded-full shadow-[0_0_10px_#3b82f6] z-10"></div>
                                <div className="w-[45%] pl-8">
                                    <div className={`p-4 rounded-xl ${glassClass}`}>
                                        <p className="text-xs opacity-70">{log.details}</p>
                                        <div className="mt-2 text-[10px] font-bold text-blue-500 uppercase tracking-widest">{log.user}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                     </div>
                )}
             </div>
         )}
      </main>

      {/* MODAL: IMPORT EXCEL */}
      {isImportModalOpen && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4">
              <div className={`w-full max-w-md rounded-[2.5rem] p-10 text-center shadow-2xl animate-in zoom-in-95 duration-300 ${glassClass}`}>
                  <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-500 border border-blue-500/20">
                      <UploadCloud className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-black mb-2">Smart Import</h3>
                  <p className="text-sm opacity-50 mb-8">Upload your Excel file. We will automatically merge status updates without erasing existing data.</p>
                  
                  <label className="block w-full py-12 border-2 border-dashed border-white/20 rounded-3xl cursor-pointer hover:border-blue-500/50 hover:bg-black/5 transition-all group">
                      <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                      <span className="text-sm font-bold opacity-60 group-hover:opacity-100 transition-colors">Click to Select .xlsx File</span>
                  </label>
                  <button onClick={() => setIsImportModalOpen(false)} className="mt-8 opacity-40 text-xs font-bold hover:opacity-100 uppercase tracking-widest transition-colors">Cancel Operation</button>
              </div>
          </div>
      )}

      {/* MODAL: ADD/EDIT */}
      {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
              <div className={`w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl ${glassClass}`}>
                  <h3 className="text-xl font-black mb-6">Staff Details</h3>
                  <form onSubmit={handleSave} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <input name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleInputChange} className={`p-4 rounded-xl text-sm font-bold outline-none border focus:border-blue-500/50 ${darkMode ? 'bg-black/20 border-white/10' : 'bg-slate-100 border-slate-200'}`} />
                        <input name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleInputChange} className={`p-4 rounded-xl text-sm font-bold outline-none border focus:border-blue-500/50 ${darkMode ? 'bg-black/20 border-white/10' : 'bg-slate-100 border-slate-200'}`} />
                      </div>
                      <input name="email" placeholder="Email" value={formData.email} onChange={handleInputChange} className={`w-full p-4 rounded-xl text-sm font-bold outline-none border focus:border-blue-500/50 ${darkMode ? 'bg-black/20 border-white/10' : 'bg-slate-100 border-slate-200'}`} />
                      <div className="grid grid-cols-2 gap-4">
                        <input name="department" placeholder="Department" value={formData.department} onChange={handleInputChange} className={`p-4 rounded-xl text-sm font-bold outline-none border focus:border-blue-500/50 ${darkMode ? 'bg-black/20 border-white/10' : 'bg-slate-100 border-slate-200'}`} />
                        <input name="mobile" placeholder="Mobile" value={formData.mobile} onChange={handleInputChange} className={`p-4 rounded-xl text-sm font-bold outline-none border focus:border-blue-500/50 ${darkMode ? 'bg-black/20 border-white/10' : 'bg-slate-100 border-slate-200'}`} />
                      </div>
                      <div className="flex gap-4 pt-4">
                          <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3 bg-black/10 rounded-xl font-bold hover:bg-black/20">Cancel</button>
                          <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 shadow-lg">Save</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;