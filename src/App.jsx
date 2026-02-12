import React, { useState, useEffect, useMemo } from 'react';
import './index.css';
import Confetti from 'react-confetti'; 
import * as XLSX from 'xlsx'; 
import aiimsLogo from './assets/logo.png';

import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, deleteDoc, 
  onSnapshot, query, addDoc, orderBy, writeBatch
} from 'firebase/firestore';
import { 
  LayoutDashboard, List, Building2, History, Search, Plus, 
  Moon, Sun, LogOut, XCircle, Edit2, Trash2, Zap, 
  CheckCircle2, Clock, UserCircle, UploadCloud, ChevronLeft, ChevronRight
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

// --- Shared UI Components ---
const StatusBadge = ({ status }) => {
  const styles = {
    Accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    Notified: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    Pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status] || styles.Pending}`}>
      {status}
    </span>
  );
};

const App = () => {
  const [adminUser, setAdminUser] = useState(null); 
  const [darkMode, setDarkMode] = useState(true); 
  const [activeView, setActiveView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', department: '', undertakingReceived: false });

  // Theme Constants
  const bgClass = darkMode ? "bg-[#020617] text-slate-200" : "bg-[#F8FAFC] text-slate-900";
  const cardClass = darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm";

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setAdminUser(user && !user.isAnonymous ? user : null);
    });
    
    const unsubEmp = onSnapshot(query(collection(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings')), (snap) => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    const unsubLogs = onSnapshot(query(collection(db, 'artifacts', appId, 'organization_data', ORG_ID, 'audit_logs'), orderBy('timestamp', 'desc')), (snap) => {
      setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubAuth(); unsubEmp(); unsubLogs(); };
  }, []);

  const stats = useMemo(() => {
    const total = employees.length;
    const compliant = employees.filter(e => e.undertakingReceived).length;
    const depts = {};
    employees.forEach(e => {
      const d = e.department || 'Unassigned';
      if (!depts[d]) depts[d] = { total: 0, compliant: 0 };
      depts[d].total++;
      if (e.undertakingReceived) depts[d].compliant++;
    });
    return { total, compliant, percentage: total > 0 ? Math.round((compliant / total) * 100) : 0, departments: depts };
  }, [employees]);

  const handleSave = async (e) => {
    e.preventDefault();
    await setDoc(doc(db, 'artifacts', appId, 'organization_data', ORG_ID, 'undertakings', formData.email), {
      ...formData, status: formData.undertakingReceived ? 'Accepted' : 'Pending', updatedAt: new Date().toISOString()
    }, { merge: true });
    setIsAddModalOpen(false);
  };

  if (!adminUser) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${bgClass}`}>
        <div className={`w-full max-w-md p-8 rounded-2xl border ${cardClass} text-center`}>
          <img src={aiimsLogo} className="w-20 mx-auto mb-4" alt="AIIMS" />
          <h1 className="text-2xl font-bold mb-6">AIIMS Raipur Portal</h1>
          <form onSubmit={async (e) => { e.preventDefault(); await signInWithEmailAndPassword(auth, loginEmail, loginPassword); }} className="space-y-4">
            <input type="email" placeholder="Admin Email" className="w-full p-4 rounded-xl border bg-transparent" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
            <input type="password" placeholder="Password" className="w-full p-4 rounded-xl border bg-transparent" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
            <button className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold">Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen w-full ${bgClass}`}>
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-950">
        <div className="p-6 flex items-center gap-3">
          <img src={aiimsLogo} className="w-8 h-8 object-contain" alt="AIIMS Logo" />
          <span className="font-bold text-blue-600">AIIMS Portal</span>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Overview' },
            { id: 'registry', icon: List, label: 'Staff Records' },
            { id: 'departments', icon: Building2, label: 'Departments' },
            { id: 'audit', icon: History, label: 'Audit Logs' },
          ].map((item) => (
            <button key={item.id} onClick={() => setActiveView(item.id)} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeView === item.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <item.icon className="w-4 h-4" /> {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <button onClick={() => signOut(auth)} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 rounded-lg"><LogOut className="w-4 h-4" /> Logout</button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md">
          <h2 className="text-lg font-bold capitalize">{activeView}</h2>
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">{darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}</button>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {activeView === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: 'Total Records', val: stats.total },
                  { label: 'Compliant', val: stats.compliant },
                  { label: 'Pending', val: stats.total - stats.compliant },
                  { label: 'Health', val: `${stats.percentage}%` }
                ].map((s, i) => (
                  <div key={i} className={`p-6 rounded-xl border ${cardClass}`}>
                    <p className="text-xs font-bold opacity-50 uppercase mb-1">{s.label}</p>
                    <h3 className="text-2xl font-bold">{s.val}</h3>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`col-span-2 p-8 rounded-xl border ${cardClass}`}>
                  <h4 className="font-bold mb-6">Recent Activity</h4>
                  <div className="space-y-4">
                    {auditLogs.slice(0, 5).map((log, i) => (
                      <div key={i} className="flex justify-between py-2 border-b dark:border-slate-800">
                        <span className="text-sm">{log.details}</span>
                        <span className="text-[10px] opacity-40">{new Date(log.timestamp).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={`p-8 rounded-xl border ${cardClass} flex flex-col items-center justify-center`}>
                  <div className="w-32 h-32 rounded-full border-8 border-blue-600 border-t-slate-200 flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold">{stats.percentage}%</span>
                  </div>
                  <h4 className="font-bold">Total Compliance</h4>
                </div>
              </div>
            </div>
          )}

          {activeView === 'registry' && (
            <div className={`rounded-xl border ${cardClass} overflow-hidden`}>
              <div className="p-4 border-b dark:border-slate-800 flex justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                  <input className="w-full pl-10 pr-4 py-2 text-sm bg-transparent border rounded-lg" placeholder="Search registry..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <button onClick={() => setIsAddModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">+ Add Staff</button>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs font-bold opacity-50">
                  <tr><th className="p-4">Name</th><th className="p-4">Dept</th><th className="p-4 text-center">Status</th><th className="p-4 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                  {employees.filter(e => e.email.includes(searchTerm)).map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-4"><div className="font-bold">{emp.firstName} {emp.lastName}</div><div className="text-xs opacity-50">{emp.email}</div></td>
                      <td className="p-4 text-xs font-medium">{emp.department}</td>
                      <td className="p-4 text-center"><StatusBadge status={emp.undertakingReceived ? 'Accepted' : 'Pending'} /></td>
                      <td className="p-4 text-right">
                        <button onClick={() => { setFormData(emp); setIsAddModalOpen(true); }} className="p-2 text-blue-500"><Edit2 className="w-4 h-4"/></button>
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
                <div key={name} className={`p-6 rounded-xl border ${cardClass}`}>
                  <h3 className="font-bold mb-4">{name}</h3>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full mb-2">
                    <div style={{ width: `${(data.compliant / data.total) * 100}%` }} className="h-full bg-blue-600 rounded-full" />
                  </div>
                  <p className="text-[10px] font-bold opacity-50">{data.compliant} / {data.total} Compliant</p>
                </div>
              ))}
            </div>
          )}

          {activeView === 'audit' && (
            <div className="max-w-3xl mx-auto space-y-6">
              {auditLogs.map((log, i) => (
                <div key={i} className={`p-4 rounded-xl border ${cardClass} flex justify-between items-center`}>
                  <div>
                    <p className="text-sm font-bold text-blue-600">{log.action}</p>
                    <p className="text-xs opacity-70">{log.details}</p>
                  </div>
                  <span className="text-[10px] opacity-40">{new Date(log.timestamp).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-lg p-8 rounded-2xl border ${cardClass}`}>
            <h3 className="text-xl font-bold mb-6">Staff Entry</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <input className="w-full p-3 rounded-lg border bg-transparent" placeholder="First Name" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} />
              <input className="w-full p-3 rounded-lg border bg-transparent" placeholder="Last Name" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} />
              <input className="w-full p-3 rounded-lg border bg-transparent" placeholder="Email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              <input className="w-full p-3 rounded-lg border bg-transparent" placeholder="Department" value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} />
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={formData.undertakingReceived} onChange={e => setFormData({ ...formData, undertakingReceived: e.target.checked })} />
                <span className="text-sm">Undertaking Received</span>
              </div>
              <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold">Save Record</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;