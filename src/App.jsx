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
  ChevronRight, Phone, UserCircle, ChevronDown, 
  LayoutDashboard, History, Bell, Menu, TrendingUp, Settings, Eye, Lock,
  ArrowLeft, Mail, Edit2, Trash2, ShieldCheck, Building2,
  Moon, Sun, LogOut, KeyRound, XCircle, Loader2, Download, FileBarChart, Zap,
  FileSpreadsheet, List, FolderPlus, Clock, UserCheck, ArrowRightLeft
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
  <div className="animate-pulse space-y-4">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800/50 rounded-xl w-full"></div>
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
  // --- AUTH & USER STATE ---
  const [adminUser, setAdminUser] = useState(null); 
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // --- DATA STATE ---
  const [employees, setEmployees] = useState([]);
  const [deptMetadata, setDeptMetadata] = useState({}); 
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // --- UI STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState(null); 
  const [viewOnlyMode, setViewOnlyMode] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('All');

  // --- EMPLOYEE PORTAL STATE ---
  const [empSearchEmail, setEmpSearchEmail] = useState('');
  const [foundEmployee, setFoundEmployee] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle'); 
  const [showConfetti, setShowConfetti] = useState(false); 
  const [showPublicList, setShowPublicList] = useState(false);

  // --- MODALS & FORMS ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isDeptEditModalOpen, setIsDeptEditModalOpen] = useState(false); 
  const [isMoveMemberModalOpen, setIsMoveMemberModalOpen] = useState(false); 
  const [editingId, setEditingId] = useState(null);
  
  // Form Data
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
  
  // Pagination
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

  // --- CORE AUTH LOGIC ---
  const handleAdminLogin = async (e) => {
      e.preventDefault();
      setAuthError('');
      try {
          await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
          setShowAdminLogin(false);
          setLoginEmail(''); setLoginPassword('');
      } catch (err) {
          setAuthError("Invalid Credentials. Access Denied.");
      }
  };

  const handleAdminLogout = async () => {
      await signOut(auth);
      setAdminUser(null);
      setActiveView('dashboard');
  };

  // --- LOGGING ---
  const logAction = async (action, details, type = 'info', actor = 'Admin') => {
      try {
          await addDoc(collection(db, 'artifacts', appId, 'organization_data', ORG_ID, 'audit_logs'), {
              action, details, type, timestamp: new Date().toISOString(), user: actor
          });
      } catch (err) { console.error("Log Error:", err); }
  };

  // --- DEPARTMENT LOGIC ---
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
          setDeptSearchTerm('');
      } catch (err) { console.error(err); alert("Failed to create department."); }
  };

  const handleUpdateDeptMeta = async () => {
      if(!adminUser || viewOnlyMode || !selectedDepartment) return;
      try {
          await setDoc(doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'department_metadata', selectedDepartment), {
              ...deptMetaForm,
              updatedAt: new Date().toISOString()
          }, { merge: true });
          setIsDeptEditModalOpen(false);
          await logAction("Dept Info Updated", `Updated metadata for ${selectedDepartment}`, 'info');
      } catch (err) { console.error(err); alert("Failed to update department info."); }
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
          setIsMoveMemberModalOpen(false);
          setSelectedMoveEmps([]);
          setMoveSearchTerm('');
      } catch (err) { console.error(err); alert("Move failed."); }
  };

  // --- EXCEL IMPORT/EXPORT (FIXED) ---
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
        
        // Smart Header Detection (Case Insensitive)
        const headers = jsonData[0].map(h => h?.toString().toLowerCase().trim() || '');
        const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('user id')); // Updated to catch "User IDs"
        
        // Detect Status Columns in Excel
        let notifIdx = headers.findIndex(h => h.includes('notification') || h.includes('sent') || h.includes('notified') || h.includes('email sent'));
        let underIdx = headers.findIndex(h => h.includes('undertaking') || h.includes('received') || h.includes('compliance'));
        let deptIdx = headers.findIndex(h => h.includes('department') || h.includes('dept'));
        let mobileIdx = headers.findIndex(h => h.includes('mobile') || h.includes('phone'));

        const isTrue = (val) => {
            if (!val) return false;
            const s = val.toString().toLowerCase().trim();
            return s === 'yes' || s === 'true' || s === 'done' || s === 'sent' || s === 'received' || s === 'later' || s.length > 2; // "later" counts as notified in your file context
        };

        const existingUsers = new Map(employees.map(e => [e.email.toLowerCase(), e]));

        jsonData.forEach((row, index) => {
           if (index === 0) return; // Skip headers
           
           const email = row[emailIdx > -1 ? emailIdx : 3]?.toString().trim(); // Fallback to col 3

           if (email && email.includes('@')) {
              const docRef = doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings', email);
              const existing = existingUsers.get(email.toLowerCase());

              // 1. Notification Status (Merge)
              let newNotified = existing?.notificationSent || false;
              if (notifIdx > -1 && row[notifIdx]) {
                  // If cell has content, mark as notified
                  newNotified = true; 
              }

              // 2. Undertaking Status (Merge)
              let newUndertaking = existing?.undertakingReceived || false;
              if (underIdx > -1 && isTrue(row[underIdx])) newUndertaking = true;

              // 3. Department (Update)
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
                  
                  // Key Merge Logic:
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
        alert(`Success! Merged ${count} records.\n\nNote: Notifications and Undertaking statuses were updated where provided.`);
        setIsImportModalOpen(false);
      } catch (err) { alert("Import failed. Check file format."); console.error(err); }
    };
    reader.readAsArrayBuffer(file);
  };

  // --- EMPLOYEE PORTAL LOGIC ---
  const handleEmployeeSearch = (e) => {
      e.preventDefault();
      const emp = employees.find(e => e.email.toLowerCase() === empSearchEmail.toLowerCase().trim());
      if(!emp) { alert("No record found. Please contact IT Division."); return; }
      setFoundEmployee(emp);
      setUploadStatus('idle');
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

  // --- ADMIN STATS ---
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

  // --- CRUD HANDLERS ---
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

  // --- RENDER HELPERS ---
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

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredEmployees.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  // === FRONT PAGE (EMPLOYEE PORTAL) ===
  if (!adminUser) {
      return (
        <div className={`flex items-center justify-center min-h-screen relative overflow-hidden ${darkMode ? 'dark bg-gray-900' : 'bg-slate-50'}`}>
             {showConfetti && <Confetti numberOfPieces={200} recycle={false} />}
             <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-600 to-blue-500 rounded-b-[50px] shadow-2xl z-0"></div>
             <div className="absolute top-4 right-4 flex gap-2 z-10">
                 <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/20 shadow-lg">{darkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}</button>
                 <button onClick={() => setShowAdminLogin(true)} className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md text-white border border-white/20 rounded-full text-xs font-bold hover:bg-white/20 shadow-lg transition-all"><Lock className="w-3 h-3"/> Admin Access</button>
             </div>
             <div className="w-full max-w-lg p-8 mx-4 glass-prism rounded-3xl bg-white dark:bg-slate-900 shadow-2xl relative z-10 animate-in fade-in zoom-in duration-500">
                 <div className="flex flex-col items-center text-center mb-8">
                     <div className="w-24 h-24 bg-white rounded-full shadow-lg p-4 mb-4 flex items-center justify-center border-4 border-blue-50 dark:border-slate-700">
                        <img src={aiimsLogo} alt="AIIMS" className="w-full h-full object-contain" />
                     </div>
                     <h1 className="text-2xl font-black text-slate-800 dark:text-white mb-1">AIIMS Raipur</h1>
                     <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-slate-800 rounded-full border border-blue-100 dark:border-slate-700"><ShieldCheck className="w-3 h-3 text-blue-600"/><p className="text-[10px] font-bold text-blue-800 dark:text-blue-400 uppercase tracking-widest">Secure Compliance Gateway</p></div>
                 </div>
                 {showPublicList ? (
                     <div className="animate-in slide-in-from-right duration-300">
                         <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-slate-700 dark:text-white">Public Status List</h3><button onClick={() => setShowPublicList(false)} className="text-xs font-bold text-blue-600 hover:underline">Back to Search</button></div>
                         <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-96 overflow-y-auto">
                             <table className="w-full text-left text-xs">
                                 <thead className="bg-slate-100 dark:bg-slate-700 text-slate-500 font-bold uppercase sticky top-0"><tr><th className="p-3">Name</th><th className="p-3">Department</th><th className="p-3 text-right">Status</th></tr></thead>
                                 <tbody className="divide-y divide-slate-200 dark:divide-slate-700">{employees.map(emp => (<tr key={emp.id}><td className="p-3 font-bold dark:text-white">{emp.firstName} {emp.lastName}</td><td className="p-3 text-slate-500">{emp.department}</td><td className="p-3 text-right">{emp.undertakingReceived ? <span className="text-emerald-600 font-bold">Received</span> : <span className="text-amber-500 font-bold">Pending</span>}</td></tr>))}</tbody>
                             </table>
                         </div>
                     </div>
                 ) : (
                     <>
                        {!foundEmployee ? (
                            <form onSubmit={handleEmployeeSearch} className="space-y-4">
                                <div className="bg-blue-50/50 dark:bg-slate-800/50 p-6 rounded-xl border border-blue-100 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 mb-3 text-center uppercase font-bold tracking-wide">Identity Verification</p>
                                    <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><input type="email" placeholder="Enter Official Email ID" value={empSearchEmail} onChange={(e) => setEmpSearchEmail(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold dark:text-white text-lg" required /></div>
                                </div>
                                <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2">Check Status <ArrowLeft className="w-5 h-5 rotate-180"/></button>
                                <button type="button" onClick={() => setShowPublicList(true)} className="w-full py-2 text-slate-500 dark:text-slate-400 text-xs font-bold hover:text-blue-600 flex items-center justify-center gap-2"><List className="w-4 h-4"/> View Public Compliance List</button>
                            </form>
                        ) : (
                            <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
                                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-left relative overflow-hidden group">
                                    <button onClick={() => {setFoundEmployee(null); setUploadStatus('idle');}} className="absolute top-2 right-2 p-2 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full z-10"><LogOut className="w-4 h-4 text-slate-500"/></button>
                                    <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2">Authenticated User</h3>
                                    <div className="flex items-center gap-4"><div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center text-xl font-black text-blue-600 shadow-sm border border-slate-100 dark:border-slate-600">{(foundEmployee.firstName || '?').charAt(0)}</div><div><p className="text-lg font-black text-slate-800 dark:text-white leading-tight">{foundEmployee.firstName} {foundEmployee.lastName}</p><p className="text-xs text-slate-500 font-medium">{foundEmployee.email}</p></div></div>
                                    <div className="mt-6 flex items-center gap-2"><div className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase text-center border ${foundEmployee.undertakingReceived ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{foundEmployee.undertakingReceived ? '✅ Compliance Verified' : '⚠️ Action Required'}</div></div>
                                </div>
                                {uploadStatus === 'success' || foundEmployee.undertakingReceived ? (
                                    <div className="text-center py-6 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800 relative overflow-hidden">
                                        <div className="w-16 h-16 bg-white dark:bg-emerald-900 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-500 shadow-sm border border-emerald-100 dark:border-emerald-800 animate-bounce relative z-10"><CheckCircle2 className="w-8 h-8"/></div>
                                        <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-400 relative z-10">Certificate of Compliance</h3>
                                        <p className="text-xs text-emerald-600 dark:text-emerald-500 px-4 mb-4 relative z-10">Your undertaking has been securely filed with the IT Department.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${uploadStatus === 'uploading' ? 'border-blue-400 bg-blue-50/50' : 'border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 cursor-pointer group hover:scale-[1.02] hover:shadow-xl'}`}>
                                            {uploadStatus === 'uploading' ? (
                                                <div className="flex flex-col items-center"><Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3"/><p className="text-sm font-bold text-blue-700">Encrypting & Uploading...</p></div>
                                            ) : (
                                                <label className="cursor-pointer block"><input type="file" accept=".pdf,.jpg,.png" onChange={handleEmployeeUpload} className="hidden" /><div className="w-14 h-14 bg-blue-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600 group-hover:scale-110 transition-transform"><UploadCloud className="w-7 h-7" /></div><p className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-700">Upload Signed Undertaking</p><p className="text-[10px] text-slate-400 mt-2 font-medium bg-white dark:bg-slate-800 px-2 py-1 rounded-full inline-block border border-slate-100 dark:border-slate-700">PDF, JPG or PNG (Max 5MB)</p></label>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                     </>
                 )}
             </div>

             {/* ADMIN LOGIN MODAL */}
             {showAdminLogin && (
                 <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                     <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl w-full max-w-sm relative animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-700">
                         <button onClick={() => setShowAdminLogin(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6"/></button>
                         <div className="flex flex-col items-center mb-6">
                             <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center mb-3 shadow-xl"><ShieldCheck className="w-7 h-7 text-white"/></div>
                             <h2 className="text-xl font-black dark:text-white">IT Admin Console</h2>
                             <p className="text-xs text-slate-500">Authorized Personnel Only</p>
                         </div>
                         
                         {authError && <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> {authError}</div>}

                         <form onSubmit={handleAdminLogin} className="space-y-4">
                             <div>
                                 <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Admin Email</label>
                                 <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none focus:ring-2 focus:ring-slate-900 dark:text-white" placeholder="admin@aiims.edu" autoFocus />
                             </div>
                             <div>
                                 <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Secure Password</label>
                                 <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none focus:ring-2 focus:ring-slate-900 dark:text-white" placeholder="••••••••" />
                             </div>
                             <button type="submit" className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 hover:scale-[1.02] transition-transform shadow-lg">Authenticate</button>
                         </form>
                     </div>
                 </div>
             )}
        </div>
      );
  }

  // === ADMIN DASHBOARD VIEW ===
  return (
    <div className={`flex h-screen overflow-hidden ${darkMode ? 'dark bg-gray-900 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 glass-prism border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
         <div className="h-full flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
               <img src={aiimsLogo} alt="AIIMS" className="w-10 h-10 object-contain bg-white rounded-lg p-1"/>
               <div><h2 className="font-extrabold text-sm text-blue-900 dark:text-white">AIIMS Raipur</h2><p className="text-[10px] text-slate-500 font-bold uppercase">IT Admin</p></div>
            </div>

            <nav className="flex-1 p-4 space-y-1">
               <button onClick={() => {setActiveView('dashboard'); setFilterStatus('All'); setSelectedDepartment(null)}} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl ${activeView === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><LayoutDashboard className="w-5 h-5" /> Dashboard</button>
               <button onClick={() => {setActiveView('registry'); setSelectedDepartment(null)}} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl ${activeView === 'registry' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Users className="w-5 h-5" /> Registry</button>
               <button onClick={() => {setActiveView('departments'); setSelectedDepartment(null)}} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl ${activeView === 'departments' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Building2 className="w-5 h-5" /> Departments</button>
               <button onClick={() => {setActiveView('audit'); setSelectedDepartment(null)}} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl ${activeView === 'audit' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><History className="w-5 h-5" /> Audit Logs</button>
            </nav>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800">
               <button onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-900 text-white shadow-lg hover:bg-slate-800">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">{adminUser?.email ? adminUser.email.charAt(0).toUpperCase() : 'A'}</div>
                  <div className="flex-1 overflow-hidden text-left"><p className="text-xs font-bold truncate">Admin</p><p className="text-[9px] text-slate-400">Online</p></div>
                  <Settings className="w-4 h-4 text-slate-400" />
               </button>
               {isAdminMenuOpen && (
                   <div className="absolute bottom-20 left-4 right-4 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 p-2 z-50">
                       <button onClick={handleClearDatabase} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-red-50 text-xs font-bold text-red-600"><Trash2 className="w-4 h-4"/> Wipe Data</button>
                       <div className="h-px bg-slate-100 my-1"></div>
                       <button onClick={handleAdminLogout} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-xs font-bold text-slate-600"><LogOut className="w-4 h-4"/> Logout</button>
                   </div>
               )}
            </div>
         </div>
      </aside>

      {/* CONTENT AREA */}
      <main className="flex-1 ml-0 md:ml-64 flex flex-col h-full overflow-hidden">
         <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-6">
            <h1 className="text-lg font-extrabold text-slate-800 dark:text-white capitalize">{activeView}</h1>
            <div className="flex gap-2">
                <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">{darkMode ? <Sun className="w-5 h-5 text-amber-400"/> : <Moon className="w-5 h-5 text-indigo-600"/>}</button>
            </div>
         </header>

         <div className="flex-1 overflow-y-auto p-6">
             {loading ? <TableSkeleton /> : (
                 <>
                    {activeView === 'dashboard' && (
                        <div className="space-y-6">
                            {/* Stats Cards with Gradient */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <button onClick={() => {setFilterStatus('All'); setActiveView('registry')}} className="p-6 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl shadow-lg shadow-blue-500/30 text-left hover:scale-105 transition-transform">
                                    <h3 className="text-3xl font-black">{stats.total}</h3>
                                    <p className="text-sm font-bold opacity-80 uppercase flex items-center gap-2"><Users className="w-4 h-4"/> Total Staff</p>
                                </button>
                                <button onClick={() => {setFilterStatus('Accepted'); setActiveView('registry')}} className="p-6 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl shadow-lg shadow-emerald-500/30 text-left hover:scale-105 transition-transform">
                                    <h3 className="text-3xl font-black">{stats.accepted}</h3>
                                    <p className="text-sm font-bold opacity-80 uppercase flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> Compliant</p>
                                </button>
                                <button onClick={() => {setFilterStatus('Notified'); setActiveView('registry')}} className="p-6 bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-2xl shadow-lg shadow-amber-500/30 text-left hover:scale-105 transition-transform">
                                    <h3 className="text-3xl font-black">{stats.notified}</h3>
                                    <p className="text-sm font-bold opacity-80 uppercase flex items-center gap-2"><Bell className="w-4 h-4"/> Notified</p>
                                </button>
                                <button onClick={() => {setFilterStatus('Pending'); setActiveView('registry')}} className="p-6 bg-gradient-to-br from-red-500 to-pink-600 text-white rounded-2xl shadow-lg shadow-red-500/30 text-left hover:scale-105 transition-transform">
                                    <h3 className="text-3xl font-black">{stats.pending}</h3>
                                    <p className="text-sm font-bold opacity-80 uppercase flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> Action Req</p>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Quick Actions */}
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500"/> Quick Actions</h3>
                                    <div className="space-y-3">
                                        <button onClick={handleExportCSV} className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 transition-colors text-left text-sm font-bold text-slate-600 dark:text-slate-300">
                                            <div className="p-2 bg-green-100 text-green-600 rounded-lg"><FileBarChart className="w-4 h-4"/></div> Download Excel Report
                                        </button>
                                        <button onClick={() => setIsImportModalOpen(true)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 transition-colors text-left text-sm font-bold text-slate-600 dark:text-slate-300">
                                            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><FileSpreadsheet className="w-4 h-4"/></div> Import Excel Data
                                        </button>
                                        <button onClick={() => {resetForm(); setIsAddModalOpen(true)}} className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 transition-colors text-left text-sm font-bold text-slate-600 dark:text-slate-300">
                                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Plus className="w-4 h-4"/></div> Add New Employee
                                        </button>
                                    </div>
                                </div>

                                {/* Analytics */}
                                <div className="md:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-500"/> Compliance Analytics</h3>
                                        <p className="text-sm text-slate-500 mb-4">Real-time tracking of compliance submissions.</p>
                                        <div className="flex gap-4">
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Accepted ({stats.accepted})</div>
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><span className="w-3 h-3 rounded-full bg-slate-200"></span> Pending ({stats.pending})</div>
                                        </div>
                                    </div>
                                    <div className="w-32 h-32 rounded-full relative" style={{background: `conic-gradient(#10b981 ${stats.percentage}%, #e2e8f0 0)`}}>
                                        <div className="absolute inset-2 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center">
                                            <span className="text-xl font-black text-slate-800 dark:text-white">{stats.percentage}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeView === 'registry' && (
                        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row justify-between gap-4">
                                <input className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-sm" placeholder="Search registry..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                <div className="flex gap-2">
                                    <button onClick={handleExportCSV} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-50 flex items-center gap-2"><Download className="w-4 h-4"/> Export</button>
                                    <button onClick={() => setIsImportModalOpen(true)} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-50 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4"/> Import</button>
                                    <button onClick={() => {resetForm(); setIsAddModalOpen(true)}} className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 flex items-center gap-2"><Plus className="w-4 h-4"/> Add</button>
                                </div>
                            </div>
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs font-bold text-slate-500 uppercase">
                                    <tr>
                                        <th className="p-4">Staff</th>
                                        <th className="p-4">Department</th>
                                        <th className="p-4 text-center">Notified</th>
                                        <th className="p-4 text-center">Undertaking</th>
                                        <th className="p-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {currentItems.map(emp => (
                                        <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                            <td className="p-4">
                                                <div className="font-bold text-sm dark:text-white">{emp.firstName} {emp.lastName}</div>
                                                <div className="text-xs text-slate-500">{emp.email}</div>
                                                <div className="text-[10px] text-slate-400 mt-1">{emp.mobile || 'No Mobile'}</div>
                                            </td>
                                            <td className="p-4 text-xs font-bold text-slate-600 dark:text-slate-400">{emp.department || 'Unassigned'}</td>
                                            <td className="p-4 text-center">
                                                {emp.notificationSent ? 
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-md text-[10px] font-bold"><Bell className="w-3 h-3"/> Sent</span> : 
                                                    <span className="text-slate-300">-</span>
                                                }
                                            </td>
                                            <td className="p-4 text-center">
                                                {emp.undertakingReceived ? 
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-[10px] font-bold"><CheckCircle2 className="w-3 h-3"/> Received</span> : 
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded-md text-[10px] font-bold"><XCircle className="w-3 h-3"/> Pending</span>
                                                }
                                            </td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => {setFormData(emp); setEditingId(emp.id); setIsAddModalOpen(true)}} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg"><Edit2 className="w-4 h-4"/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {/* Pagination Controls */}
                            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                                <span className="text-xs font-bold text-slate-500">Page {currentPage} of {totalPages}</span>
                                <div className="flex gap-2">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"><ChevronLeft className="w-4 h-4"/></button>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"><ChevronRight className="w-4 h-4"/></button>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {activeView === 'departments' && (
                        <div className="space-y-6">
                            {selectedDepartment ? (
                                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in slide-in-from-right duration-300">
                                    <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                                        <div>
                                            <button onClick={() => setSelectedDepartment(null)} className="text-xs font-bold text-blue-600 mb-2 flex items-center gap-1 hover:underline"><ArrowLeft className="w-3 h-3"/> Back to All Departments</button>
                                            <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2"><Building2 className="w-6 h-6 text-blue-500"/> {selectedDepartment}</h2>
                                            <div className="flex gap-4 mt-2 text-xs text-slate-500">
                                                <span className="flex items-center gap-1"><UserCircle className="w-3 h-3"/> Head: {deptMetadata[selectedDepartment]?.hodName || 'Not Assigned'}</span>
                                                <span className="flex items-center gap-1"><Phone className="w-3 h-3"/> {deptMetadata[selectedDepartment]?.hodPhone || 'N/A'}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => {setDeptMetaForm(deptMetadata[selectedDepartment] || {}); setIsDeptEditModalOpen(true)}} className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 flex items-center gap-2"><Edit2 className="w-3 h-3"/> Edit HOD</button>
                                            <button onClick={() => setIsMoveMemberModalOpen(true)} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-2"><ArrowRightLeft className="w-3 h-3"/> Move Members</button>
                                        </div>
                                    </div>
                                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {employees.filter(e => e.department === selectedDepartment).map(emp => (
                                            <div key={emp.id} className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">{emp.firstName.charAt(0)}</div>
                                                <div>
                                                    <div className="text-sm font-bold dark:text-white">{emp.firstName} {emp.lastName}</div>
                                                    <div className="text-xs text-slate-500">{emp.email}</div>
                                                </div>
                                                <div className="ml-auto">
                                                    {emp.undertakingReceived ? <CheckCircle2 className="w-5 h-5 text-emerald-500"/> : <Clock className="w-5 h-5 text-amber-500"/>}
                                                </div>
                                            </div>
                                        ))}
                                        {employees.filter(e => e.department === selectedDepartment).length === 0 && <p className="text-slate-400 italic text-sm">No members found.</p>}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-xl font-bold dark:text-white">Department Overview</h3>
                                        <button onClick={() => setIsDeptModalOpen(true)} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 flex items-center gap-2"><FolderPlus className="w-4 h-4"/> Create Department</button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {Object.entries(stats.departments).map(([name, data]) => (
                                            <div key={name} onClick={() => setSelectedDepartment(name)} className="p-6 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer group">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-blue-600 font-bold text-xl group-hover:scale-110 transition-transform">{name.charAt(0)}</div>
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${data.compliant === data.total ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{data.total} Staff</span>
                                                </div>
                                                <h4 className="font-bold text-lg dark:text-white mb-2 truncate">{name}</h4>
                                                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mb-2">
                                                    <div style={{width: `${(data.compliant/data.total)*100}%`}} className="bg-blue-500 h-full"></div>
                                                </div>
                                                <div className="flex justify-between text-xs text-slate-500">
                                                    <span>{Math.round((data.compliant/data.total)*100) || 0}% Done</span>
                                                    <span className="text-blue-600 font-bold group-hover:underline">Manage &rarr;</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {activeView === 'audit' && (
                         <div className="max-w-4xl mx-auto space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                            {auditLogs.map((log, i) => (
                                <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-blue-500 text-slate-500 group-[.is-active]:text-emerald-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                        <History className="w-5 h-5"/>
                                    </div>
                                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                                        <div className="flex items-center justify-between space-x-2 mb-1">
                                            <div className="font-bold text-slate-900 dark:text-white">{log.action}</div>
                                            <time className="font-mono text-xs text-slate-500">{formatDate(log.timestamp)}</time>
                                        </div>
                                        <div className="text-slate-500 text-xs">{log.details}</div>
                                        <div className="mt-2 text-[10px] uppercase font-bold text-blue-600 bg-blue-50 inline-block px-2 py-1 rounded">User: {log.user}</div>
                                    </div>
                                </div>
                            ))}
                            {auditLogs.length === 0 && <div className="text-center p-10 text-slate-400">No logs found yet.</div>}
                         </div>
                    )}
                 </>
             )}
         </div>
      </main>

      {/* MODAL: ADD/EDIT EMPLOYEE */}
      {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                  <h3 className="text-lg font-black mb-4 dark:text-white">{editingId ? 'Edit Staff' : 'Add Staff'}</h3>
                  <form onSubmit={handleSave} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <input name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleInputChange} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold outline-none" required />
                        <input name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleInputChange} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold outline-none" />
                      </div>
                      <input name="email" placeholder="Email Address" value={formData.email} onChange={handleInputChange} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold outline-none" required />
                      <input name="department" placeholder="Department" value={formData.department} onChange={handleInputChange} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold outline-none" />
                      <input name="mobile" placeholder="Mobile" value={formData.mobile} onChange={handleInputChange} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold outline-none" />
                      
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2">
                          <label className="flex items-center gap-2 text-sm font-bold dark:text-white cursor-pointer">
                              <input type="checkbox" name="notificationSent" checked={formData.notificationSent} onChange={handleInputChange} /> Notification Sent
                          </label>
                          <label className="flex items-center gap-2 text-sm font-bold dark:text-white cursor-pointer">
                              <input type="checkbox" name="undertakingReceived" checked={formData.undertakingReceived} onChange={handleInputChange} /> Undertaking Received
                          </label>
                      </div>

                      <div className="flex justify-end gap-2 pt-4">
                          <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
                          <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">Save</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL: IMPORT EXCEL */}
      {isImportModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-8 text-center shadow-2xl">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                      <UploadCloud className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold dark:text-white mb-2">Import Excel Data</h3>
                  <p className="text-sm text-slate-500 mb-6">Upload .xlsx file with columns: SrNo, First Name, Last Name, Email, Dept, Mobile</p>
                  <label className="block w-full py-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 transition-all group">
                      <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-300 group-hover:text-blue-600">Click to Select Excel File</span>
                  </label>
                  <button onClick={() => setIsImportModalOpen(false)} className="mt-6 text-slate-400 text-sm font-bold hover:text-slate-600">Cancel Import</button>
              </div>
          </div>
      )}

      {/* MODAL: CREATE DEPT */}
      {isDeptModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6">
                  <h3 className="text-lg font-black mb-4 dark:text-white">Create Department</h3>
                  <div className="space-y-4">
                      <input placeholder="Department Name" value={deptFormData.name} onChange={(e) => setDeptFormData({...deptFormData, name: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold outline-none" />
                      <div className="relative">
                          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400"/><input placeholder="Search unassigned staff..." value={deptSearchTerm} onChange={(e) => setDeptSearchTerm(e.target.value)} className="w-full pl-10 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold outline-none" />
                      </div>
                      <div className="max-h-40 overflow-y-auto bg-slate-50 dark:bg-slate-800 rounded-xl p-2">
                          {unassignedEmployees.map(emp => (
                              <label key={emp.id} className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-slate-700 rounded cursor-pointer">
                                  <input type="checkbox" onChange={(e) => {
                                      if(e.target.checked) setDeptFormData(p => ({...p, selectedEmps: [...p.selectedEmps, emp.id]}));
                                      else setDeptFormData(p => ({...p, selectedEmps: p.selectedEmps.filter(id => id !== emp.id)}));
                                  }} />
                                  <span className="text-xs font-bold dark:text-white">{emp.firstName} {emp.lastName}</span>
                              </label>
                          ))}
                      </div>
                      <button onClick={handleCreateDepartment} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">Create</button>
                      <button onClick={() => setIsDeptModalOpen(false)} className="w-full py-2 text-slate-500 font-bold text-xs">Cancel</button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL: EDIT HOD */}
      {isDeptEditModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6">
                  <h3 className="text-lg font-black mb-4 dark:text-white">Edit HOD Details</h3>
                  <div className="space-y-4">
                      <input placeholder="HOD Name" value={deptMetaForm.hodName} onChange={(e) => setDeptMetaForm({...deptMetaForm, hodName: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold outline-none" />
                      <input placeholder="HOD Email" value={deptMetaForm.hodEmail} onChange={(e) => setDeptMetaForm({...deptMetaForm, hodEmail: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold outline-none" />
                      <input placeholder="HOD Phone" value={deptMetaForm.hodPhone} onChange={(e) => setDeptMetaForm({...deptMetaForm, hodPhone: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold outline-none" />
                      <button onClick={handleUpdateDeptMeta} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">Save Details</button>
                      <button onClick={() => setIsDeptEditModalOpen(false)} className="w-full py-2 text-slate-500 font-bold text-xs">Cancel</button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL: MOVE MEMBERS */}
      {isMoveMemberModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6">
                  <h3 className="text-lg font-black mb-2 dark:text-white">Move Members</h3>
                  <p className="text-xs text-slate-500 mb-4">Moving to: <span className="font-bold text-blue-600">{selectedDepartment}</span></p>
                  <div className="space-y-4">
                      <div className="relative">
                          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400"/><input placeholder="Search employees..." value={moveSearchTerm} onChange={(e) => setMoveSearchTerm(e.target.value)} className="w-full pl-10 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold outline-none" />
                      </div>
                      <div className="max-h-40 overflow-y-auto bg-slate-50 dark:bg-slate-800 rounded-xl p-2">
                          {employees.filter(e => e.department !== selectedDepartment && (e.email.toLowerCase().includes(moveSearchTerm) || e.firstName.toLowerCase().includes(moveSearchTerm))).map(emp => (
                              <label key={emp.id} className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-slate-700 rounded cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0">
                                  <input type="checkbox" onChange={(e) => {
                                      if(e.target.checked) setSelectedMoveEmps(p => [...p, emp.id]);
                                      else setSelectedMoveEmps(p => p.filter(id => id !== emp.id));
                                  }} />
                                  <div className="flex-1">
                                      <div className="text-xs font-bold dark:text-white">{emp.firstName} {emp.lastName}</div>
                                      <div className="text-[10px] text-slate-500">{emp.department}</div>
                                  </div>
                              </label>
                          ))}
                      </div>
                      <div className="flex justify-between items-center"><span className="text-xs font-bold text-blue-600">{selectedMoveEmps.length} selected</span><div className="flex gap-2"><button onClick={() => setIsMoveMemberModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold text-xs hover:bg-slate-100 rounded-lg">Cancel</button><button onClick={handleMoveEmployees} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-xs">Move Selected</button></div></div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default App;