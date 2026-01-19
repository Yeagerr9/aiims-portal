import React, { useState, useEffect, useMemo } from 'react';
import './index.css';
import * as XLSX from 'xlsx';
import aiimsLogo from './assets/logo.png';

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
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
  writeBatch,
  addDoc,
  orderBy
} from 'firebase/firestore';
import { 
  Users, CheckCircle2, Plus, Search, 
  UploadCloud, FileText, AlertTriangle, ChevronLeft, 
  ChevronRight, Phone, UserCircle, ChevronDown, ChevronUp, 
  LayoutDashboard, History, Bell, Menu, TrendingUp, Clock, Settings, Eye, Lock,
  FolderPlus, ArrowLeft, Mail, Edit2, Trash2, ShieldCheck, Download, Building2,
  Moon, Sun  // <--- FIXED: These were missing!
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

// --- Safety Helper Functions ---
const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    try {
        const d = new Date(isoString);
        return isNaN(d.getTime()) ? 'Invalid Date' : d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    } catch (e) {
        return 'Date Error';
    }
};

const App = () => {
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [deptMetadata, setDeptMetadata] = useState({}); 
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState(null); 
  
  // Admin Features
  const [viewOnlyMode, setViewOnlyMode] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);

  // Filtering
  const [filterStatus, setFilterStatus] = useState('All'); 

  // Pagination & Expansion
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRowId, setExpandedRowId] = useState(null); 
  const itemsPerPage = 10;
  
  // Modals
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

  // Department Management State
  const [deptFormData, setDeptFormData] = useState({ name: '', selectedEmps: [] });
  const [deptMetaForm, setDeptMetaForm] = useState({ hodName: '', hodEmail: '', hodPhone: '' });
  const [deptSearchTerm, setDeptSearchTerm] = useState(''); 
  const [moveSearchTerm, setMoveSearchTerm] = useState('');
  const [selectedMoveEmps, setSelectedMoveEmps] = useState([]);

  // --- Init ---
  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error("Auth Error:", err));
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Fetch Employees
    const qEmp = query(collection(db, 'artifacts', appId, 'users', user.uid, 'undertakings'));
    const unsubEmp = onSnapshot(qEmp, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Robust sorting that handles missing SrNo
      data.sort((a, b) => {
          const valA = parseInt(a.srNo) || 999999;
          const valB = parseInt(b.srNo) || 999999;
          return valA - valB;
      });
      setEmployees(data);
      setLoading(false);
    }, (error) => {
        console.error("Employee Fetch Error:", error);
        setLoading(false);
    });

    // Fetch Department Metadata
    const qDept = query(collection(db, 'artifacts', appId, 'users', user.uid, 'department_metadata'));
    const unsubDept = onSnapshot(qDept, (snapshot) => {
        const meta = {};
        snapshot.docs.forEach(doc => { meta[doc.id] = doc.data(); });
        setDeptMetadata(meta);
    });

    // Fetch Logs
    const qLogs = query(collection(db, 'artifacts', appId, 'users', user.uid, 'audit_logs'), orderBy('timestamp', 'desc'));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAuditLogs(logs);
    });

    return () => { unsubEmp(); unsubDept(); unsubLogs(); };
  }, [user]);

  // --- Logic & Stats ---
  const logAction = async (action, details, type = 'info') => {
      if(!user || viewOnlyMode) return;
      try {
          await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'audit_logs'), {
              action, details, type, timestamp: new Date().toISOString(), user: 'Admin'
          });
      } catch (err) { console.error("Log Error:", err); }
  };

  const calculateStatus = (sent, received) => {
      if (received) return 'Accepted';
      if (sent) return 'Notified';
      return 'Pending';
  };

  const stats = useMemo(() => {
    const total = employees.length;
    const accepted = employees.filter(e => e.undertakingReceived).length;
    const notifiedOnly = employees.filter(e => e.notificationSent && !e.undertakingReceived).length;
    const pending = employees.filter(e => !e.notificationSent && !e.undertakingReceived).length;
    
    const deptMap = { 'Unassigned': { name: 'Unassigned', total: 0, compliant: 0, pending: 0, employees: [] } };
    
    employees.forEach(emp => {
        let d = (emp.department || 'Unassigned').trim();
        if(d === '') d = 'Unassigned';
        
        if (!deptMap[d]) deptMap[d] = { name: d, total: 0, compliant: 0, pending: 0, employees: [] };
        deptMap[d].total++;
        deptMap[d].employees.push(emp);
        if (emp.undertakingReceived) deptMap[d].compliant++;
        else deptMap[d].pending++;
    });

    if(deptMap['Unassigned'].total === 0) delete deptMap['Unassigned'];

    return {
      total, accepted, notifiedOnly, pending,
      percentage: total > 0 ? Math.round((accepted / total) * 100) : 0,
      departments: deptMap
    };
  }, [employees]);

  // --- Handlers ---
  const handleDashboardClick = (viewName) => {
      setFilterStatus(viewName);
      setActiveView('registry');
  };

  const handleCreateDepartment = async () => {
      if(!user || viewOnlyMode) return;
      if(!deptFormData.name.trim()) return alert("Please enter a department name.");
      
      try {
          const batch = writeBatch(db);
          deptFormData.selectedEmps.forEach(empId => {
              const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'undertakings', empId);
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
      if(!user || viewOnlyMode || !selectedDepartment) return;
      try {
          await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'department_metadata', selectedDepartment), {
              ...deptMetaForm,
              updatedAt: new Date().toISOString()
          }, { merge: true });
          setIsDeptEditModalOpen(false);
          await logAction("Dept Info Updated", `Updated metadata for ${selectedDepartment}`, 'info');
      } catch (err) { console.error(err); alert("Failed to update department info."); }
  };

  const handleMoveEmployees = async () => {
      if(!user || viewOnlyMode || !selectedDepartment) return;
      if(selectedMoveEmps.length === 0) return alert("Select at least one employee.");

      try {
          const batch = writeBatch(db);
          selectedMoveEmps.forEach(empId => {
              const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'undertakings', empId);
              batch.update(ref, { department: selectedDepartment, updatedAt: new Date().toISOString() });
          });
          await batch.commit();
          await logAction("Staff Moved", `Moved ${selectedMoveEmps.length} staff to ${selectedDepartment}`, 'warning');
          setIsMoveMemberModalOpen(false);
          setSelectedMoveEmps([]);
          setMoveSearchTerm('');
      } catch (err) { console.error(err); alert("Move failed."); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user || viewOnlyMode) return;
    const docId = formData.email || `unknown_${Date.now()}`;
    const nextFormData = { ...formData };
    
    const isRecv = nextFormData.undertakingReceived;
    const isSent = nextFormData.notificationSent;
    nextFormData.status = calculateStatus(isSent, isRecv);

    if(isSent && !nextFormData.sentDate) nextFormData.sentDate = new Date().toISOString().split('T')[0];
    if(isRecv && !nextFormData.receivedDate) nextFormData.receivedDate = new Date().toISOString().split('T')[0];

    try {
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'undertakings', docId), {
          ...nextFormData, updatedAt: new Date().toISOString()
        }, { merge: true });
        await logAction(editingId ? "Updated Record" : "Created Record", `Employee: ${formData.email}`, 'success');
        setIsAddModalOpen(false);
        resetForm();
    } catch (err) { alert("Error saving record."); }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const resetForm = () => {
    setFormData({ 
        firstName: '', lastName: '', email: '', contactPerson: '', mobile: '', 
        status: 'Pending', notificationSent: false, undertakingReceived: false, 
        type: 'Individual', srNo: '', department: '', responsibleOfficer: '',
        sentDate: '', receivedDate: ''
    });
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    if (!user || viewOnlyMode || !window.confirm('Delete this record?')) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'undertakings', id));
    await logAction("Deleted Record", `ID: ${id}`, 'danger');
  };

  const handleClearDatabase = async () => {
    if (!user || viewOnlyMode || !window.confirm("⚠️ DANGER: This will delete ALL records. Confirm?")) return;
    const batch = writeBatch(db);
    employees.forEach(emp => batch.delete(doc(db, 'artifacts', appId, 'users', user.uid, 'undertakings', emp.id)));
    await batch.commit();
    await logAction("Database Wipe", "All records deleted by Admin", 'danger');
    alert("Database cleared.");
  };

  // --- IMPORT LOGIC ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !user || viewOnlyMode) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
        
        if (jsonData.length < 2) return alert("File appears empty.");

        const batch = writeBatch(db);
        let count = 0, updateCount = 0;

        const headers = jsonData[0].map(h => h?.toString().toLowerCase().trim() || '');
        const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('user ids'));
        const deptIdx = headers.findIndex(h => h.includes('department') || h.includes('dept')); 
        const srNoIdx = headers.findIndex(h => h.includes('sr') || h.includes('serial'));
        const firstIdx = headers.findIndex(h => h.includes('first'));
        const lastIdx = headers.findIndex(h => h.includes('last'));
        const mobileIdx = headers.findIndex(h => h.includes('mobile'));
        const contactIdx = headers.findIndex(h => h.includes('contact'));

        let undertakingIdx = -1;
        let notifiedIdx = -1;

        // Smart Scan for Status Columns (First 10 rows)
        for (let i = 1; i < Math.min(jsonData.length, 10); i++) {
            const row = jsonData[i];
            row.forEach((cell, idx) => {
                const val = cell?.toString().toLowerCase().trim() || '';
                if (undertakingIdx === -1 && (val === 'received' || val === 'submitted' || val === 'yes')) undertakingIdx = idx;
                if (notifiedIdx === -1 && (val === 'done' || val === 'later' || val === 'verify' || val === 'sent')) notifiedIdx = idx;
            });
        }

        const isYes = (val) => {
            if (!val) return false;
            const s = val.toString().toLowerCase().trim();
            return s === 'received' || s === 'yes' || s === 'true' || s === 'done';
        };

        const existingMap = new Map(employees.map(emp => [emp.email.toLowerCase(), emp]));

        jsonData.forEach((row, index) => {
           if (index === 0) return; 
           const eIdx = emailIdx > -1 ? emailIdx : 3;
           const email = row[eIdx]?.toString().trim();

           if (email && email.includes('@')) {
              const existingUser = existingMap.get(email.toLowerCase());
              const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'undertakings', email);

              let fileUndertaking = (undertakingIdx > -1) ? isYes(row[undertakingIdx]) : (existingUser?.undertakingReceived || false);
              let fileNotified = (notifiedIdx > -1) ? isYes(row[notifiedIdx]) : (existingUser?.notificationSent || false);

              const finalStatus = calculateStatus(fileNotified, fileUndertaking);
              const fileDept = row[deptIdx > -1 ? deptIdx : 99];
              const finalDept = fileDept || existingUser?.department || '';

              const newData = {
                  srNo: row[srNoIdx > -1 ? srNoIdx : 0] || existingUser?.srNo || '',
                  firstName: row[firstIdx > -1 ? firstIdx : 1] || existingUser?.firstName || '',
                  lastName: row[lastIdx > -1 ? lastIdx : 2] || existingUser?.lastName || '',
                  email: email,
                  contactPerson: row[contactIdx > -1 ? contactIdx : 4] || existingUser?.contactPerson || '',
                  mobile: row[mobileIdx > -1 ? mobileIdx : 5] || existingUser?.mobile || '',
                  department: finalDept,
                  status: finalStatus,
                  undertakingReceived: fileUndertaking,
                  notificationSent: fileNotified,
                  updatedAt: new Date().toISOString(),
                  type: 'Individual',
                  sentDate: (fileNotified && !existingUser?.sentDate) ? new Date().toISOString().split('T')[0] : (existingUser?.sentDate || ''),
                  receivedDate: (fileUndertaking && !existingUser?.receivedDate) ? new Date().toISOString().split('T')[0] : (existingUser?.receivedDate || '')
              };

              batch.set(docRef, newData, { merge: true });
              if (existingUser) updateCount++; else count++;
           }
        });

        await batch.commit();
        await logAction("Bulk Import", `Imported ${count} new, Updated ${updateCount}`, 'info');
        alert(`Import Success!\n• New: ${count}\n• Updated: ${updateCount}`);
        setIsImportModalOpen(false);
      } catch (err) { alert("Import failed."); console.error(err); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExportCSV = () => {
    if (employees.length === 0) return alert("No data.");
    const headers = ["Sr No", "First Name", "Last Name", "Email", "Department", "Contact Person", "Mobile", "Status", "Undertaking Received", "Notified", "Sent Date", "Received Date"];
    const csv = [headers.join(","), ...employees.map(e => 
      [e.srNo, `"${e.firstName}"`, `"${e.lastName}"`, e.email, `"${e.department || ''}"`, `"${e.contactPerson}"`, e.mobile, e.status, e.undertakingReceived ? "Yes" : "No", e.notificationSent ? "Yes" : "No", e.sentDate, e.receivedDate].join(",")
    )].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `aiims_compliance_report.csv`;
    link.click();
    logAction("Data Export", "Downloaded CSV Report");
  };

  const filteredEmployees = employees.filter(emp => {
      const matchSearch = (emp.email || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (emp.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (emp.department || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      if (filterStatus === 'All') return matchSearch;
      if (filterStatus === 'Accepted') return matchSearch && emp.undertakingReceived;
      if (filterStatus === 'Notified') return matchSearch && emp.notificationSent;
      if (filterStatus === 'Pending') return matchSearch && !emp.notificationSent && !emp.undertakingReceived;
      return matchSearch;
  });

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const currentData = filteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const unassignedEmployees = employees.filter(e => 
      (!e.department || e.department === 'Unassigned') && 
      (e.email.toLowerCase().includes(deptSearchTerm.toLowerCase()) || e.firstName.toLowerCase().includes(deptSearchTerm.toLowerCase()))
  );

  return (
    <div className={`flex h-screen overflow-hidden ${darkMode ? 'dark bg-gray-900 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 glass-prism border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
         <div className="h-full flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
               <div className="w-10 h-10 bg-white rounded-lg p-1.5 shadow-sm border border-slate-100">
                  <img src={aiimsLogo} alt="AIIMS" className="w-full h-full object-contain"/>
               </div>
               <div>
                  <h2 className="font-extrabold text-sm leading-tight text-blue-900 dark:text-white">AIIMS Raipur</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Compliance Portal</p>
               </div>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
               <button onClick={() => {setActiveView('dashboard'); setFilterStatus('All'); setSelectedDepartment(null);}} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all ${activeView === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  <LayoutDashboard className="w-5 h-5" /> Dashboard
               </button>
               <button onClick={() => {setActiveView('registry'); setSelectedDepartment(null);}} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all ${activeView === 'registry' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  <Users className="w-5 h-5" /> Employee Registry
               </button>
               <button onClick={() => {setActiveView('departments'); setSelectedDepartment(null);}} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all ${activeView === 'departments' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  <Building2 className="w-5 h-5" /> Department View
               </button>
               <button onClick={() => {setActiveView('audit'); setSelectedDepartment(null);}} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all ${activeView === 'audit' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  <History className="w-5 h-5" /> Audit Logs
               </button>
            </nav>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 relative">
               <button onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-xs text-white font-bold">AD</div>
                  <div className="flex-1 overflow-hidden text-left">
                     <p className="text-xs font-bold truncate dark:text-white">Admin User</p>
                     <p className="text-[10px] text-slate-500 truncate">System Administrator</p>
                  </div>
                  <Settings className="w-4 h-4 text-slate-400" />
               </button>
               {isAdminMenuOpen && (
                   <div className="absolute bottom-20 left-4 right-4 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2 animate-in slide-in-from-bottom-2 z-50">
                       <button onClick={() => setViewOnlyMode(!viewOnlyMode)} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold dark:text-white">
                           {viewOnlyMode ? <Lock className="w-4 h-4 text-red-500"/> : <Eye className="w-4 h-4 text-emerald-500"/>}
                           {viewOnlyMode ? "Disable View Only" : "Enable View Only"}
                       </button>
                   </div>
               )}
            </div>
         </div>
      </aside>

      {/* CONTENT */}
      <main className="flex-1 ml-0 md:ml-64 flex flex-col h-full overflow-hidden relative">
         <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-6 z-40">
            <div className="flex items-center gap-4">
               <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Menu className="w-5 h-5"/></button>
               <h1 className="text-lg font-extrabold text-slate-800 dark:text-white capitalize">{activeView.replace('_', ' ')}</h1>
            </div>
            <div className="flex items-center gap-3">
               <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  {darkMode ? <Sun className="w-5 h-5 text-amber-400"/> : <Moon className="w-5 h-5 text-indigo-600"/>}
               </button>
            </div>
         </header>

         <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
            <div className="max-w-full mx-auto space-y-6">
               
               {/* DASHBOARD */}
               {activeView === 'dashboard' && (
                  <div className="space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <button onClick={() => handleDashboardClick('All')} className="text-left w-full hover:scale-105 transition-transform"><PrismCard title="Total Staff" value={stats.total} icon={Users} color="blue" /></button>
                        <button onClick={() => handleDashboardClick('Accepted')} className="text-left w-full hover:scale-105 transition-transform"><PrismCard title="Compliant" value={stats.accepted} icon={ShieldCheck} color="emerald" /></button>
                        <button onClick={() => handleDashboardClick('Notified')} className="text-left w-full hover:scale-105 transition-transform"><PrismCard title="Notified" value={stats.notifiedOnly} icon={Bell} color="amber" /></button>
                        <button onClick={() => handleDashboardClick('Pending')} className="text-left w-full hover:scale-105 transition-transform"><PrismCard title="Pending Action" value={stats.pending} icon={AlertTriangle} color="red" /></button>
                     </div>
                     <div className="p-8 rounded-3xl bg-white dark:bg-slate-800 shadow-xl border border-slate-100 dark:border-slate-700">
                        <h3 className="text-xl font-bold mb-4 dark:text-white flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-500"/> Overall Compliance</h3>
                        <div className="h-6 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex relative">
                           <div style={{width: `${stats.percentage}%`}} className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full transition-all duration-1000 ease-out"></div>
                        </div>
                        <div className="flex justify-between mt-3 text-sm font-bold text-slate-500"><span>0%</span><span className="text-emerald-600">{stats.percentage}% Achieved</span><span>100%</span></div>
                     </div>
                  </div>
               )}

               {/* REGISTRY */}
               {activeView === 'registry' && (
                  <div className="glass-prism rounded-3xl overflow-hidden flex flex-col min-h-[600px]">
                     <Toolbar 
                        searchTerm={searchTerm} 
                        setSearchTerm={setSearchTerm} 
                        viewOnlyMode={viewOnlyMode} 
                        onClear={handleClearDatabase} 
                        onExport={handleExportCSV} 
                        onImport={() => setIsImportModalOpen(true)} 
                        onAdd={() => { resetForm(); setIsAddModalOpen(true); }}
                     />
                     <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left">
                           <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                              <tr>
                                 <th className="w-12 p-4"></th>
                                 <th className="p-4 text-xs font-extrabold uppercase text-slate-500">Identity</th>
                                 <th className="p-4 text-xs font-extrabold uppercase text-slate-500">Info</th>
                                 <th className="p-4 text-xs font-extrabold uppercase text-slate-500">Contact</th>
                                 <th className="p-4 text-xs font-extrabold uppercase text-slate-500">Notified</th>
                                 <th className="p-4 text-xs font-extrabold uppercase text-slate-500">Undertaking</th>
                                 {!viewOnlyMode && <th className="p-4 text-xs font-extrabold uppercase text-slate-500 text-right">Actions</th>}
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {currentData.map(emp => (
                                 <React.Fragment key={emp.id}>
                                    <tr className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${expandedRowId === emp.id ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                                       <td className="p-4 text-center">
                                          <button onClick={() => setExpandedRowId(expandedRowId === emp.id ? null : emp.id)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"><ChevronDown className="w-4 h-4 text-slate-500"/></button>
                                       </td>
                                       <td className="p-4"><div className="font-bold text-sm text-slate-800 dark:text-slate-200">{emp.email}</div><div className="text-[10px] font-mono text-slate-500">ID: {emp.srNo || 'N/A'}</div></td>
                                       <td className="p-4"><div className="flex items-center gap-3"><Avatar name={emp.firstName} /><div><div className="font-bold text-sm text-slate-700 dark:text-slate-200 capitalize">{emp.firstName} {emp.lastName}</div><div className="text-xs text-slate-500">{emp.department || 'General'}</div></div></div></td>
                                       <td className="p-4"><div className="space-y-1">{emp.mobile ? <div className="flex items-center gap-1.5 text-xs font-mono text-slate-600 dark:text-slate-400"><Phone className="w-3 h-3 text-emerald-500"/> {emp.mobile}</div> : <span className="text-[10px] text-slate-400 opacity-50">No Mobile</span>}{emp.contactPerson ? <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400"><UserCircle className="w-3 h-3 text-blue-500"/> {emp.contactPerson}</div> : <span className="text-[10px] text-slate-400 opacity-50">No Contact</span>}</div></td>
                                       <td className="p-4">{emp.notificationSent ? <div className="flex items-center gap-1 text-blue-600 font-bold text-[10px]"><Bell className="w-3 h-3"/> Yes</div> : <span className="text-slate-400 text-[10px]">No</span>}</td>
                                       <td className="p-4">{emp.undertakingReceived ? <div className="flex items-center gap-1 text-emerald-600 font-bold text-[10px]"><CheckCircle2 className="w-3 h-3"/> Received</div> : <span className="text-slate-400 text-[10px]">Pending</span>}</td>
                                       {!viewOnlyMode && (<td className="p-4 text-right"><button onClick={() => { setFormData(emp); setEditingId(emp.id); setIsAddModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4"/></button></td>)}
                                    </tr>
                                    {expandedRowId === emp.id && (
                                       <tr className="bg-slate-50/50 dark:bg-slate-900/30"><td colSpan="7" className="p-6"><div className="grid grid-cols-1 md:grid-cols-3 gap-8"><div className="space-y-3"><h4 className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Tracking Dates</h4><div className="flex justify-between text-sm"><span className="text-slate-500">Sent Date:</span><span className="font-mono font-bold dark:text-white">{formatDate(emp.sentDate)}</span></div><div className="flex justify-between text-sm"><span className="text-slate-500">Received Date:</span><span className="font-mono font-bold dark:text-white">{formatDate(emp.receivedDate)}</span></div></div><div className="space-y-3"><h4 className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Responsibility</h4><div className="text-sm"><span className="text-slate-500 block mb-1">Responsible Officer:</span><div className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-purple-500"/> {emp.responsibleOfficer || 'Not Assigned'}</div></div></div>{!viewOnlyMode && (<div className="flex flex-col gap-2 border-l border-slate-200 dark:border-slate-700 pl-6 justify-center"><button onClick={() => handleDelete(emp.id)} className="w-full py-2 px-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 flex items-center justify-center gap-2"><Trash2 className="w-3.5 h-3.5"/> Delete Record</button></div>)}</div></td></tr>
                                    )}
                                 </React.Fragment>
                              ))}
                           </tbody>
                        </table>
                     </div>
                     <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white/50 dark:bg-slate-900/50">
                        <span className="text-xs font-bold text-slate-500">Page {currentPage} of {totalPages}</span>
                        <div className="flex gap-2">
                           <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><ChevronLeft className="w-5 h-5" /></button>
                           <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><ChevronRight className="w-5 h-5" /></button>
                        </div>
                     </div>
                  </div>
               )}

               {/* DEPARTMENT VIEW */}
               {activeView === 'departments' && (
                  <div className="space-y-6">
                     {/* DRILL DOWN VIEW (IF SELECTED) */}
                     {selectedDepartment ? (
                        <div className="glass-prism rounded-3xl overflow-hidden min-h-[600px] flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                           {/* Dept Header */}
                           <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
                              <button onClick={() => setSelectedDepartment(null)} className="mb-4 flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-600 uppercase tracking-wider"><ArrowLeft className="w-4 h-4"/> Back to Departments</button>
                              <div className="flex justify-between items-start">
                                 <div>
                                    <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                                       <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30"><Building2 className="w-6 h-6"/></div>
                                       {selectedDepartment}
                                    </h2>
                                    <div className="mt-4 flex gap-6 text-sm text-slate-600 dark:text-slate-300">
                                       <div className="flex items-center gap-2"><UserCircle className="w-4 h-4 text-blue-500"/> <strong>Head:</strong> {deptMetadata[selectedDepartment]?.hodName || 'Not Assigned'}</div>
                                       <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-emerald-500"/> {deptMetadata[selectedDepartment]?.hodPhone || 'N/A'}</div>
                                       <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-amber-500"/> {deptMetadata[selectedDepartment]?.hodEmail || 'N/A'}</div>
                                    </div>
                                 </div>
                                 {!viewOnlyMode && (
                                    <div className="flex gap-2">
                                       <button onClick={() => { setDeptMetaForm(deptMetadata[selectedDepartment] || {}); setIsDeptEditModalOpen(true); }} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 flex items-center gap-2"><Edit2 className="w-4 h-4"/> Edit Details</button>
                                       <button onClick={() => setIsMoveMemberModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 flex items-center gap-2"><Plus className="w-4 h-4"/> Add/Move Members</button>
                                    </div>
                                 )}
                              </div>
                           </div>
                           
                           {/* Dept Employees Table */}
                           <div className="flex-1 p-6 bg-slate-50 dark:bg-slate-900/30">
                              <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">Department Members</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                 {employees.filter(e => e.department === selectedDepartment).map(emp => (
                                    <div key={emp.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
                                       <div className="flex items-center gap-3">
                                          <Avatar name={emp.firstName} />
                                          <div>
                                             <div className="font-bold text-sm text-slate-800 dark:text-white">{emp.firstName} {emp.lastName}</div>
                                             <div className="text-xs text-slate-500">{emp.email}</div>
                                          </div>
                                       </div>
                                       {emp.undertakingReceived ? <CheckCircle2 className="w-5 h-5 text-emerald-500"/> : <Clock className="w-5 h-5 text-amber-500"/>}
                                    </div>
                                 ))}
                                 {employees.filter(e => e.department === selectedDepartment).length === 0 && <p className="text-slate-400 italic">No members in this department yet.</p>}
                              </div>
                           </div>
                        </div>
                     ) : (
                        // Default Dept Grid
                        <>
                           <div className="flex justify-between items-center">
                              <h3 className="text-xl font-bold dark:text-white flex items-center gap-2"><Building2 className="w-6 h-6"/> Department Performance</h3>
                              {!viewOnlyMode && <button onClick={() => setIsDeptModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-2"><FolderPlus className="w-4 h-4"/> Create Dept</button>}
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {Object.entries(stats.departments).map(([deptName, data]) => {
                                 const pct = Math.round((data.compliant / data.total) * 100) || 0;
                                 return (
                                    <div key={deptName} onClick={() => setSelectedDepartment(deptName)} className="bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-6 rounded-2xl relative overflow-hidden group cursor-pointer hover:shadow-xl transition-all hover:-translate-y-1">
                                       <div className="flex justify-between items-start mb-4">
                                          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-lg">{deptName.charAt(0)}</div>
                                          <span className={`px-2 py-1 rounded text-[10px] font-bold ${pct === 100 ? 'bg-emerald-100 text-emerald-700' : pct > 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{pct}% Compliance</span>
                                       </div>
                                       <h4 className="text-lg font-bold dark:text-white truncate">{deptName}</h4>
                                       <div className="flex gap-4 mt-2 text-xs text-slate-500">
                                          <span>Total: {data.total}</span>
                                          <span className="text-emerald-600">Done: {data.compliant}</span>
                                          <span className="text-red-500">Pending: {data.pending}</span>
                                       </div>
                                       <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full mt-4 overflow-hidden mb-4">
                                          <div style={{width: `${pct}%`}} className="bg-blue-600 h-full"></div>
                                       </div>
                                       <div className="text-xs font-bold text-blue-600 flex items-center gap-1 group-hover:underline">Manage Department <ChevronRight className="w-3 h-3"/></div>
                                    </div>
                                 )
                              })}
                           </div>
                        </>
                     )}
                  </div>
               )}

               {/* AUDIT VIEW */}
               {activeView === 'audit' && (
                  <div className="glass-prism rounded-3xl p-6 min-h-[600px]">
                     <h3 className="text-xl font-bold mb-6 dark:text-white flex items-center gap-2"><History className="w-6 h-6"/> System Audit Logs</h3>
                     <div className="space-y-4">
                        {auditLogs.length === 0 ? <p className="text-slate-400 italic">No logs recorded yet.</p> : auditLogs.map((log, i) => (
                           <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                              <div className={`mt-1.5 w-2 h-2 rounded-full ${log.type === 'danger' ? 'bg-red-500' : log.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
                              <div className="flex-1">
                                 <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm font-bold text-slate-800 dark:text-white">{log.action}</span>
                                    <span className="text-xs font-mono text-slate-400">{formatDate(log.timestamp)}</span>
                                 </div>
                                 <p className="text-xs text-slate-500 dark:text-slate-400">{log.details}</p>
                                 <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">User: {log.user || 'System'}</p>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               )}

            </div>
         </div>
      </main>

      {/* --- MODALS --- */}
      
      {/* 1. CREATE DEPT MODAL */}
      {isDeptModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="glass-prism rounded-2xl w-full max-w-lg bg-white dark:bg-slate-900 p-8">
                  <h3 className="text-xl font-bold dark:text-white mb-4">Create New Department</h3>
                  <div className="space-y-4">
                      <InputGroup label="Department Name" name="name" value={deptFormData.name} onChange={(e) => setDeptFormData({...deptFormData, name: e.target.value})} />
                      <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input type="text" className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none" placeholder="Search unassigned employees..." value={deptSearchTerm} onChange={(e) => setDeptSearchTerm(e.target.value)} />
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl max-h-40 overflow-y-auto">
                          {unassignedEmployees.map(emp => (
                              <label key={emp.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 p-1 rounded">
                                  <input type="checkbox" onChange={(e) => {
                                      if(e.target.checked) setDeptFormData(p => ({...p, selectedEmps: [...p.selectedEmps, emp.id]}));
                                      else setDeptFormData(p => ({...p, selectedEmps: p.selectedEmps.filter(id => id !== emp.id)}));
                                  }} />
                                  <span className="text-xs dark:text-white truncate">{emp.email}</span>
                              </label>
                          ))}
                          {unassignedEmployees.length === 0 && <p className="text-xs text-slate-400 italic">No unassigned employees found matching search.</p>}
                      </div>
                      <div className="flex justify-end gap-3 mt-4">
                          <button onClick={() => setIsDeptModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
                          <button onClick={handleCreateDepartment} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">Create & Move</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* 2. EDIT HOD MODAL */}
      {isDeptEditModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="glass-prism rounded-2xl w-full max-w-md bg-white dark:bg-slate-900 p-8">
                  <h3 className="text-xl font-bold dark:text-white mb-4">Edit Department Details</h3>
                  <div className="space-y-4">
                      <InputGroup label="Head of Department Name" name="hodName" value={deptMetaForm.hodName || ''} onChange={(e) => setDeptMetaForm({...deptMetaForm, hodName: e.target.value})} />
                      <InputGroup label="Contact Number" name="hodPhone" value={deptMetaForm.hodPhone || ''} onChange={(e) => setDeptMetaForm({...deptMetaForm, hodPhone: e.target.value})} />
                      <InputGroup label="Email Address" name="hodEmail" value={deptMetaForm.hodEmail || ''} onChange={(e) => setDeptMetaForm({...deptMetaForm, hodEmail: e.target.value})} />
                      <div className="flex justify-end gap-3 mt-4">
                          <button onClick={() => setIsDeptEditModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
                          <button onClick={handleUpdateDeptMeta} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">Save Changes</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* 3. MOVE MEMBERS MODAL */}
      {isMoveMemberModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="glass-prism rounded-2xl w-full max-w-lg bg-white dark:bg-slate-900 p-8">
                  <h3 className="text-xl font-bold dark:text-white mb-2">Move Members</h3>
                  <p className="text-xs text-slate-500 mb-4">Select employees to move to <strong>{selectedDepartment}</strong>.</p>
                  <div className="space-y-4">
                      <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input type="text" className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none" placeholder="Search any employee..." value={moveSearchTerm} onChange={(e) => setMoveSearchTerm(e.target.value)} />
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl max-h-60 overflow-y-auto">
                          {employees.filter(e => e.department !== selectedDepartment && (e.email.toLowerCase().includes(moveSearchTerm.toLowerCase()) || e.firstName.toLowerCase().includes(moveSearchTerm.toLowerCase()))).map(emp => (
                              <label key={emp.id} className="flex items-center justify-between gap-2 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 p-2 rounded border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                                  <div className="flex items-center gap-3">
                                      <input type="checkbox" onChange={(e) => {
                                          if(e.target.checked) setSelectedMoveEmps(p => [...p, emp.id]);
                                          else setSelectedMoveEmps(p => p.filter(id => id !== emp.id));
                                      }} />
                                      <div>
                                          <div className="text-xs font-bold dark:text-white">{emp.firstName} {emp.lastName}</div>
                                          <div className="text-[10px] text-slate-500">{emp.email}</div>
                                      </div>
                                  </div>
                                  <div className="text-[9px] px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300">{emp.department || 'Unassigned'}</div>
                              </label>
                          ))}
                      </div>
                      <div className="flex justify-between items-center mt-4">
                          <span className="text-xs font-bold text-blue-600">{selectedMoveEmps.length} selected</span>
                          <div className="flex gap-2">
                              <button onClick={() => setIsMoveMemberModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
                              <button onClick={handleMoveEmployees} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">Move Selected</button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* 4. ADD/EDIT EMPLOYEE MODAL */}
      {isAddModalOpen && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-prism rounded-2xl w-full max-w-2xl bg-white dark:bg-slate-900 p-8 max-h-[90vh] overflow-y-auto">
               <div className="flex justify-between mb-6">
                  <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                     <Edit2 className="w-5 h-5 text-blue-500"/> {editingId ? 'Edit Record' : 'Add Employee'}
                  </h3>
                  <button onClick={() => setIsAddModalOpen(false)} className="hover:bg-slate-100 p-1 rounded-full"><X className="w-6 h-6"/></button>
               </div>
               <form onSubmit={handleSave} className="space-y-6">
                  <div>
                     <h4 className="text-xs font-extrabold uppercase text-slate-400 mb-3 border-b pb-1">Identity Details</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputGroup label="Sr No" name="srNo" value={formData.srNo} onChange={handleInputChange} />
                        <InputGroup label="Email ID" name="email" value={formData.email} onChange={handleInputChange} disabled={!!editingId} />
                        <InputGroup label="First Name" name="firstName" value={formData.firstName} onChange={handleInputChange} />
                        <InputGroup label="Last Name" name="lastName" value={formData.lastName} onChange={handleInputChange} />
                        <InputGroup label="Department" name="department" value={formData.department} onChange={handleInputChange} />
                        <InputGroup label="Responsible Officer" name="responsibleOfficer" value={formData.responsibleOfficer} onChange={handleInputChange} />
                     </div>
                  </div>
                  <div>
                     <h4 className="text-xs font-extrabold uppercase text-slate-400 mb-3 border-b pb-1">Contact Info</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputGroup label="Contact Person Name" name="contactPerson" value={formData.contactPerson} onChange={handleInputChange} />
                        <InputGroup label="Mobile Number" name="mobile" value={formData.mobile} onChange={handleInputChange} />
                     </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                     <h4 className="text-xs font-extrabold uppercase text-slate-400 mb-3">Compliance Tracking</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                           <label className="flex items-center gap-3 cursor-pointer">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${formData.notificationSent ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300'}`}>
                                 {formData.notificationSent && <CheckCircle2 className="w-3.5 h-3.5" />}
                              </div>
                              <input type="checkbox" name="notificationSent" checked={formData.notificationSent} onChange={handleInputChange} className="hidden" />
                              <span className="font-bold text-sm dark:text-white">Notification Sent</span>
                           </label>
                           {formData.notificationSent && (
                              <div className="pl-8">
                                 <label className="text-[10px] font-bold text-slate-500 uppercase">Sent Date</label>
                                 <input type="date" name="sentDate" value={formData.sentDate} onChange={handleInputChange} className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg text-sm font-mono"/>
                              </div>
                           )}
                        </div>
                        <div className="space-y-3">
                           <label className="flex items-center gap-3 cursor-pointer">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${formData.undertakingReceived ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                                 {formData.undertakingReceived && <CheckCircle2 className="w-3.5 h-3.5" />}
                              </div>
                              <input type="checkbox" name="undertakingReceived" checked={formData.undertakingReceived} onChange={handleInputChange} className="hidden" />
                              <span className="font-bold text-sm dark:text-white">Undertaking Received</span>
                           </label>
                           {formData.undertakingReceived && (
                              <div className="pl-8">
                                 <label className="text-[10px] font-bold text-slate-500 uppercase">Received Date</label>
                                 <input type="date" name="receivedDate" value={formData.receivedDate} onChange={handleInputChange} className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg text-sm font-mono"/>
                              </div>
                           )}
                        </div>
                     </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                     <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100">Cancel</button>
                     <button type="submit" className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30">Save Record</button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {isImportModalOpen && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-prism rounded-2xl w-full max-w-md bg-white dark:bg-slate-900 p-8 text-center">
               <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                  <UploadCloud className="w-8 h-8" />
               </div>
               <h3 className="text-xl font-bold dark:text-white mb-2">Import Excel Data</h3>
               <p className="text-sm text-slate-500 mb-6">Supports "Email Sent" and "Undertaking Received" lists.</p>
               <label className="block w-full py-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 transition-all group">
                  <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300 group-hover:text-blue-600">Click to Select Excel File</span>
               </label>
               <button onClick={() => setIsImportModalOpen(false)} className="mt-6 text-slate-400 text-sm font-bold hover:text-slate-600">Cancel Import</button>
            </div>
         </div>
      )}

    </div>
  );
};

// --- Subcomponents ---
const Toolbar = ({ searchTerm, setSearchTerm, viewOnlyMode, onClear, onExport, onImport, onAdd }) => (
    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
        <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Search employee, email, department..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex gap-2">
            {!viewOnlyMode && <button onClick={onClear} className="px-3 py-2 bg-red-100 text-red-600 rounded-lg text-xs font-bold hover:bg-red-200 flex items-center gap-2"><Trash2 className="w-4 h-4"/> Clear</button>}
            <button onClick={onExport} className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 flex items-center gap-2"><Download className="w-4 h-4"/> Export</button>
            {!viewOnlyMode && <button onClick={onImport} className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 flex items-center gap-2"><UploadCloud className="w-4 h-4"/> Import</button>}
            {!viewOnlyMode && <button onClick={onAdd} className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-black rounded-lg text-xs font-bold hover:opacity-90 flex items-center gap-2"><Plus className="w-4 h-4"/> Add New</button>}
        </div>
    </div>
);

const PrismCard = ({ title, value, icon: Icon, color }) => {
    const colors = {
        blue: 'from-blue-500 to-indigo-600',
        emerald: 'from-emerald-500 to-teal-600',
        amber: 'from-amber-400 to-orange-500',
        red: 'from-red-500 to-pink-600',
    };
    return (
        <div className="glass-prism p-6 rounded-2xl relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300 cursor-pointer">
            <div className={`absolute top-0 right-0 w-24 h-24 opacity-10 rounded-full translate-x-8 -translate-y-8 bg-gradient-to-br ${colors[color]}`}></div>
            <div className="relative z-10">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-lg bg-gradient-to-br ${colors[color]} text-white`}>
                    <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white">{value}</h3>
                <p className="text-xs font-bold uppercase text-slate-500 mt-1">{title}</p>
            </div>
        </div>
    );
};

const InputGroup = ({ label, name, value, onChange, disabled }) => (
  <div>
    <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">{label}</label>
    <input name={name} value={value} onChange={onChange} disabled={disabled} className="w-full mt-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 dark:text-white font-medium" />
  </div>
);

const Avatar = ({ name }) => (
  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 p-[2px] shrink-0 shadow-sm">
    <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white uppercase">
      {name ? name.charAt(0) : '?'}
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
    if (status === 'Accepted') return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3 h-3"/> Compliant</span>;
    if (status === 'Notified') return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-700 border border-blue-200"><Bell className="w-3 h-3"/> Notified</span>;
    return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700 border border-red-200"><AlertTriangle className="w-3 h-3"/> Pending</span>;
};

export default App;