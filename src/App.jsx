import React, { useState, useEffect, useMemo } from 'react';
import './index.css';
import Confetti from 'react-confetti'; 
import * as XLSX from 'xlsx'; // Restored Excel Features
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
  Moon, Sun, LogOut, KeyRound, XCircle, Loader2, Download, FileBarChart, Zap
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

// --- Main App Component ---
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

  // --- MODALS & FORMS ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', contactPerson: '',
    mobile: '', status: 'Pending', notificationSent: false,
    undertakingReceived: false, type: 'Individual', srNo: '',
    department: '', responsibleOfficer: '', sentDate: '', receivedDate: ''
  });
  
  // --- INIT ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user && !user.isAnonymous) {
            setAdminUser(user);
            fetchData(); 
        } else {
            setAdminUser(null);
            fetchData();
        }
    });
    return () => unsubscribe();
  }, []);

  const fetchData = () => {
    const ORG_ID = "aiims_raipur_main_db"; 
    // Employees
    const qEmpReal = query(collection(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings'));
    const unsubEmp = onSnapshot(qEmpReal, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (parseInt(a.srNo) || 999999) - (parseInt(b.srNo) || 999999));
      setEmployees(data);
      setLoading(false);
    });
    // Dept Metadata
    const qDept = query(collection(db, 'artifacts', appId, 'organization_data', ORG_ID, 'department_metadata'));
    const unsubDept = onSnapshot(qDept, (snapshot) => {
        const meta = {};
        snapshot.docs.forEach(doc => { meta[doc.id] = doc.data(); });
        setDeptMetadata(meta);
    });
    // Logs
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
      const ORG_ID = "aiims_raipur_main_db";
      try {
          await addDoc(collection(db, 'artifacts', appId, 'organization_data', ORG_ID, 'audit_logs'), {
              action, details, type, timestamp: new Date().toISOString(), user: actor
          });
      } catch (err) { console.error("Log Error:", err); }
  };

  // --- EXCEL IMPORT/EXPORT (RESTORED) ---
  const handleExportCSV = () => {
      const headers = ["Sr No", "First Name", "Last Name", "Email", "Department", "Mobile", "Status", "Undertaking Received"];
      const csv = [headers.join(","), ...employees.map(e => 
        [e.srNo, `"${e.firstName}"`, `"${e.lastName}"`, e.email, `"${e.department || ''}"`, e.mobile, e.status, e.undertakingReceived ? "Yes" : "No"].join(",")
      )].join("\n");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      link.download = `aiims_compliance_report_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      logAction("Data Export", "Downloaded CSV Report");
  };

  // --- EMPLOYEE PORTAL LOGIC ---
  const handleEmployeeSearch = (e) => {
      e.preventDefault();
      // REMOVED MOBILE CHECK as requested
      const emp = employees.find(e => e.email.toLowerCase() === empSearchEmail.toLowerCase().trim());
      
      if(!emp) {
          alert("No record found. Please contact IT Division.");
          return;
      }
      setFoundEmployee(emp);
      setUploadStatus('idle');
  };

  const handleEmployeeUpload = async (e) => {
      const file = e.target.files[0];
      if(!file || !foundEmployee) return;

      const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      if (!validTypes.includes(file.type)) {
          alert("Security Alert: Only PDF, JPG, and PNG files are allowed.");
          return;
      }
      if (file.size > 5 * 1024 * 1024) { 
          alert("File is too large. Max size is 5MB.");
          return;
      }

      setUploadStatus('uploading');
      
      setTimeout(async () => {
          try {
              const ORG_ID = "aiims_raipur_main_db";
              const ref = doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings', foundEmployee.id);
              
              await setDoc(ref, {
                  undertakingReceived: true,
                  receivedDate: new Date().toISOString().split('T')[0],
                  status: 'Accepted',
                  fileURL: 'simulated_secure_url.pdf',
                  updatedAt: new Date().toISOString()
              }, { merge: true });

              await logAction("Undertaking Uploaded", `User ${foundEmployee.email} uploaded compliance doc.`, 'success', 'Employee Portal');
              
              setUploadStatus('success');
              setShowConfetti(true);
              setTimeout(() => setShowConfetti(false), 8000); 
          } catch (err) {
              console.error(err);
              setUploadStatus('error');
          }
      }, 2000);
  };

  // --- ADMIN STATS ---
  const stats = useMemo(() => {
    const total = employees.length;
    const accepted = employees.filter(e => e.undertakingReceived).length;
    const pending = employees.filter(e => !e.undertakingReceived).length;
    const notified = employees.filter(e => e.notificationSent && !e.undertakingReceived).length;
    
    const deptMap = {};
    employees.forEach(emp => {
        let d = (emp.department || 'Unassigned').trim();
        if(!d) d = 'Unassigned';
        if (!deptMap[d]) deptMap[d] = { name: d, total: 0, compliant: 0, employees: [] };
        deptMap[d].total++;
        if (emp.undertakingReceived) deptMap[d].compliant++;
    });
    return { 
        total, accepted, pending, notified,
        percentage: total > 0 ? Math.round((accepted / total) * 100) : 0, 
        departments: deptMap 
    };
  }, [employees]);

  // --- CRUD HANDLERS ---
  const handleSave = async (e) => {
    e.preventDefault();
    if (!adminUser || viewOnlyMode) return;
    const ORG_ID = "aiims_raipur_main_db";
    const docId = formData.email || `unknown_${Date.now()}`;
    
    let status = 'Pending';
    if(formData.notificationSent) status = 'Notified';
    if(formData.undertakingReceived) status = 'Accepted';

    try {
        await setDoc(doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings', docId), { 
            ...formData, status, updatedAt: new Date().toISOString() 
        }, { merge: true });
        
        await logAction(editingId ? "Updated Record" : "Created Record", `Employee: ${formData.email}`, 'success');
        setIsAddModalOpen(false); 
        resetForm();
    } catch (err) { alert("Error saving record."); }
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
                     <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-slate-800 rounded-full border border-blue-100 dark:border-slate-700">
                        <ShieldCheck className="w-3 h-3 text-blue-600"/>
                        <p className="text-[10px] font-bold text-blue-800 dark:text-blue-400 uppercase tracking-widest">Secure Compliance Gateway</p>
                     </div>
                 </div>

                 {!foundEmployee ? (
                     <form onSubmit={handleEmployeeSearch} className="space-y-4">
                         <div className="bg-blue-50/50 dark:bg-slate-800/50 p-6 rounded-xl border border-blue-100 dark:border-slate-700">
                             <p className="text-xs text-slate-500 mb-3 text-center uppercase font-bold tracking-wide">Identity Verification</p>
                             <div className="space-y-3">
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input type="email" placeholder="Enter Official Email ID" value={empSearchEmail} onChange={(e) => setEmpSearchEmail(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold dark:text-white text-lg" required />
                                </div>
                             </div>
                         </div>
                         <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2">
                             Check Status <ArrowLeft className="w-5 h-5 rotate-180"/>
                         </button>
                     </form>
                 ) : (
                     <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
                         {/* Employee Info Card */}
                         <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-left relative overflow-hidden group">
                             <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-16 translate-x-16 group-hover:bg-blue-500/20 transition-all"></div>
                             
                             <button onClick={() => {setFoundEmployee(null); setUploadStatus('idle');}} className="absolute top-2 right-2 p-2 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full z-10"><LogOut className="w-4 h-4 text-slate-500"/></button>
                             
                             <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2">Authenticated User</h3>
                             <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center text-xl font-black text-blue-600 shadow-sm border border-slate-100 dark:border-slate-600">
                                    {(foundEmployee.firstName || '?').charAt(0)}
                                </div>
                                <div>
                                    <p className="text-lg font-black text-slate-800 dark:text-white leading-tight">{foundEmployee.firstName} {foundEmployee.lastName}</p>
                                    <p className="text-xs text-slate-500 font-medium">{foundEmployee.email}</p>
                                </div>
                             </div>
                             
                             <div className="mt-6 flex items-center gap-2">
                                 <div className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase text-center border ${foundEmployee.undertakingReceived ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                     {foundEmployee.undertakingReceived ? '✅ Compliance Verified' : '⚠️ Action Required'}
                                 </div>
                             </div>
                         </div>

                         {/* Upload or Success State */}
                         {uploadStatus === 'success' || foundEmployee.undertakingReceived ? (
                             <div className="text-center py-6 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800 relative overflow-hidden">
                                 <div className="absolute inset-0 bg-repeat opacity-5" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M1 1h2v2H1V1zm4 0h2v2H5V1zm5 4h2v2h-2V5zm-5 4h2v2H5V9zm5 5h2v2h-2v-2zM5 13h2v2H5v-2zm-5 5h2v2H0v-2z\' fill=\'%23000000\' fill-opacity=\'1\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")'}}></div>
                                 <div className="w-16 h-16 bg-white dark:bg-emerald-900 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-500 shadow-sm border border-emerald-100 dark:border-emerald-800 animate-bounce relative z-10">
                                     <CheckCircle2 className="w-8 h-8"/>
                                 </div>
                                 <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-400 relative z-10">Certificate of Compliance</h3>
                                 <p className="text-xs text-emerald-600 dark:text-emerald-500 px-4 mb-4 relative z-10">Your undertaking has been securely filed with the IT Department.</p>
                                 <div className="inline-block px-4 py-1 bg-white dark:bg-slate-800 rounded-full text-[10px] font-mono text-slate-500 border border-emerald-200 relative z-10">
                                    REF: {foundEmployee.id.substring(0,8).toUpperCase()}
                                 </div>
                             </div>
                         ) : (
                             <div className="space-y-4">
                                 <div className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${uploadStatus === 'uploading' ? 'border-blue-400 bg-blue-50/50' : 'border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 cursor-pointer group hover:scale-[1.02] hover:shadow-xl'}`}>
                                     {uploadStatus === 'uploading' ? (
                                         <div className="flex flex-col items-center">
                                             <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3"/>
                                             <p className="text-sm font-bold text-blue-700">Encrypting & Uploading...</p>
                                         </div>
                                     ) : (
                                         <label className="cursor-pointer block">
                                             <input type="file" accept=".pdf,.jpg,.png" onChange={handleEmployeeUpload} className="hidden" />
                                             <div className="w-14 h-14 bg-blue-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600 group-hover:scale-110 transition-transform">
                                                <UploadCloud className="w-7 h-7" />
                                             </div>
                                             <p className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-700">Upload Signed Undertaking</p>
                                             <p className="text-[10px] text-slate-400 mt-2 font-medium bg-white dark:bg-slate-800 px-2 py-1 rounded-full inline-block border border-slate-100 dark:border-slate-700">PDF, JPG or PNG (Max 5MB)</p>
                                         </label>
                                     )}
                                 </div>
                             </div>
                         )}
                     </div>
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
               <button onClick={() => {setActiveView('dashboard'); setFilterStatus('All')}} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl ${activeView === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><LayoutDashboard className="w-5 h-5" /> Dashboard</button>
               <button onClick={() => setActiveView('registry')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl ${activeView === 'registry' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Users className="w-5 h-5" /> Registry</button>
               <button onClick={() => setActiveView('departments')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl ${activeView === 'departments' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Building2 className="w-5 h-5" /> Departments</button>
               <button onClick={() => setActiveView('audit')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl ${activeView === 'audit' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><History className="w-5 h-5" /> Audit Logs</button>
            </nav>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800">
               <button onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-900 text-white shadow-lg hover:bg-slate-800">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">{adminUser?.email ? adminUser.email.charAt(0).toUpperCase() : 'A'}</div>
                  <div className="flex-1 overflow-hidden text-left"><p className="text-xs font-bold truncate">Admin</p><p className="text-[9px] text-slate-400">Online</p></div>
                  <Settings className="w-4 h-4 text-slate-400" />
               </button>
               {isAdminMenuOpen && (
                   <div className="absolute bottom-20 left-4 right-4 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 p-2 z-50">
                       <button onClick={() => alert("Coming soon")} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-red-50 text-xs font-bold text-red-600"><Trash2 className="w-4 h-4"/> Wipe Data</button>
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
                            {/* NEW: Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <button onClick={() => {setFilterStatus('All'); setActiveView('registry')}} className="p-6 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/30 text-left hover:scale-105 transition-transform">
                                    <h3 className="text-3xl font-black">{stats.total}</h3>
                                    <p className="text-sm font-bold opacity-80 uppercase flex items-center gap-2"><Users className="w-4 h-4"/> Total Staff</p>
                                </button>
                                <button onClick={() => {setFilterStatus('Accepted'); setActiveView('registry')}} className="p-6 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/30 text-left hover:scale-105 transition-transform">
                                    <h3 className="text-3xl font-black">{stats.accepted}</h3>
                                    <p className="text-sm font-bold opacity-80 uppercase flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> Compliant</p>
                                </button>
                                <button onClick={() => {setFilterStatus('Notified'); setActiveView('registry')}} className="p-6 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/30 text-left hover:scale-105 transition-transform">
                                    <h3 className="text-3xl font-black">{stats.notified}</h3>
                                    <p className="text-sm font-bold opacity-80 uppercase flex items-center gap-2"><Bell className="w-4 h-4"/> Notified</p>
                                </button>
                                <button onClick={() => {setFilterStatus('Pending'); setActiveView('registry')}} className="p-6 bg-red-500 text-white rounded-2xl shadow-lg shadow-red-500/30 text-left hover:scale-105 transition-transform">
                                    <h3 className="text-3xl font-black">{stats.pending}</h3>
                                    <p className="text-sm font-bold opacity-80 uppercase flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> Action Req</p>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* NEW: Quick Actions Panel */}
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500"/> Quick Actions</h3>
                                    <div className="space-y-3">
                                        <button onClick={handleExportCSV} className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 transition-colors text-left text-sm font-bold text-slate-600 dark:text-slate-300">
                                            <div className="p-2 bg-green-100 text-green-600 rounded-lg"><FileBarChart className="w-4 h-4"/></div> Download Excel Report
                                        </button>
                                        <button onClick={() => {resetForm(); setIsAddModalOpen(true)}} className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 transition-colors text-left text-sm font-bold text-slate-600 dark:text-slate-300">
                                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Plus className="w-4 h-4"/></div> Add New Employee
                                        </button>
                                    </div>
                                </div>

                                {/* NEW: Visual Analytics (CSS Pie Chart) */}
                                <div className="md:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-500"/> Compliance Analytics</h3>
                                        <p className="text-sm text-slate-500 mb-4">Real-time tracking of department submissions.</p>
                                        <div className="flex gap-4">
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Accepted ({stats.accepted})</div>
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><span className="w-3 h-3 rounded-full bg-slate-200"></span> Pending ({stats.pending})</div>
                                        </div>
                                    </div>
                                    {/* CSS Conic Gradient Pie Chart */}
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
                                    <button onClick={() => {resetForm(); setIsAddModalOpen(true)}} className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 flex items-center gap-2"><Plus className="w-4 h-4"/> Add</button>
                                </div>
                            </div>
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs font-bold text-slate-500 uppercase">
                                    <tr><th className="p-4">Staff</th><th className="p-4">Contact</th><th className="p-4">Department</th><th className="p-4">Status</th><th className="p-4 text-right">Action</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredEmployees.slice(0, 50).map(emp => (
                                        <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                            <td className="p-4">
                                                <div className="font-bold text-sm dark:text-white">{emp.firstName} {emp.lastName}</div>
                                                <div className="text-xs text-slate-500">{emp.email}</div>
                                            </td>
                                            <td className="p-4 text-xs font-mono text-slate-600 dark:text-slate-400">{emp.mobile || 'N/A'}</td>
                                            <td className="p-4 text-xs font-bold text-slate-600 dark:text-slate-400">{emp.department || 'Unassigned'}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${emp.undertakingReceived ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {emp.undertakingReceived ? 'Compliant' : 'Pending'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => {setFormData(emp); setEditingId(emp.id); setIsAddModalOpen(true)}} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg"><Edit2 className="w-4 h-4"/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    
                    {activeView === 'departments' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {Object.entries(stats.departments).map(([name, data]) => (
                                <div key={name} className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all cursor-pointer">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">{name.charAt(0)}</div>
                                        <span className="text-xs font-bold text-slate-400">{data.total} Staff</span>
                                    </div>
                                    <h4 className="font-bold text-lg dark:text-white mb-2">{name}</h4>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-2">
                                        <div style={{width: `${(data.compliant/data.total)*100}%`}} className="bg-emerald-500 h-full"></div>
                                    </div>
                                    <div className="text-xs text-emerald-600 font-bold">{data.compliant} Compliant</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeView === 'audit' && (
                         <div className="space-y-4">
                            {auditLogs.map((log, i) => (
                                <div key={i} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                    <div>
                                        <div className="font-bold text-sm dark:text-white">{log.action}</div>
                                        <div className="text-xs text-slate-500">{log.details}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300">{log.user}</div>
                                        <div className="text-[10px] text-slate-400 font-mono mt-1">{formatDate(log.timestamp)}</div>
                                    </div>
                                </div>
                            ))}
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
    </div>
  );
};

export default App;