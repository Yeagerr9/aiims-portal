import React, { useState, useEffect, useMemo, useRef } from 'react';
import './index.css';
import Confetti from 'react-confetti'; 
import * as XLSX from 'xlsx'; 
import aiimsLogo from './assets/logo.png';

import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, deleteDoc, 
  onSnapshot, query, addDoc, orderBy, writeBatch, collectionGroup
} from 'firebase/firestore';
import { 
  LayoutDashboard, List, Building2, History, Search, Plus, 
  Moon, Sun, LogOut, XCircle, Edit2, Trash2, Zap, 
  CheckCircle2, Clock, UserCircle, UploadCloud, ChevronLeft, 
  ChevronRight, Download, Upload, Filter, TrendingUp, Users,
  FileText, AlertCircle, Calendar, Mail, Phone, MapPin, Award
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
const APP_ID_CANDIDATES = Array.from(new Set(['aiims-default', window.__app_id].filter(Boolean)));
const ORG_ID = "aiims_raipur_main_db"; 
const UNDERTAKINGS_PATHS = [
  ...APP_ID_CANDIDATES.map((id) => ['artifacts', id, 'organization_data', ORG_ID, 'undertakings']),
  ['organization_data', ORG_ID, 'undertakings'],
  ['undertakings'],
];
const AUDIT_LOGS_PATHS = [
  ...APP_ID_CANDIDATES.map((id) => ['artifacts', id, 'organization_data', ORG_ID, 'audit_logs']),
  ['organization_data', ORG_ID, 'audit_logs'],
  ['audit_logs'],
];
const UNDERTAKINGS_GROUP = 'undertakings';
const AUDIT_LOGS_GROUP = 'audit_logs';

// --- Enhanced Shared UI Components ---
const StatusBadge = ({ status }) => {
  const styles = {
    Accepted: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/5 dark:text-emerald-400",
    Notified: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/5 dark:text-blue-400",
    Pending: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-400",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles.Pending}`}>
      {status === 'Accepted' && <CheckCircle2 className="w-3 h-3" />}
      {status === 'Pending' && <Clock className="w-3 h-3" />}
      {status === 'Notified' && <Mail className="w-3 h-3" />}
      {status}
    </span>
  );
};

const StatCard = ({ icon, label, value, trend, darkMode }) => {
  const IconComponent = icon;
  const cardClass = darkMode 
    ? "bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700" 
    : "bg-gradient-to-br from-white to-slate-50 border-slate-200 shadow-sm";
  
  return (
    <div className={`p-6 rounded-2xl border ${cardClass} group hover:scale-[1.02] transition-all duration-300`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${darkMode ? 'bg-blue-500/10' : 'bg-blue-500/5'}`}>
          <IconComponent className="w-5 h-5 text-blue-600" />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
            <TrendingUp className="w-3 h-3" />
            {trend}%
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium opacity-60">{label}</p>
        <p className="text-3xl font-bold tracking-tight">{value}</p>
      </div>
    </div>
  );
};

const App = () => {
  const [adminUser, setAdminUser] = useState(null); 
  const [darkMode, setDarkMode] = useState(true); 
  const [activeView, setActiveView] = useState('dashboard');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [passwordResetMessage, setPasswordResetMessage] = useState('');
  const [activeUndertakingsPath, setActiveUndertakingsPath] = useState(UNDERTAKINGS_PATHS[0]);
  const [activeAuditLogsPath, setActiveAuditLogsPath] = useState(AUDIT_LOGS_PATHS[0]);
  const [showConfetti, setShowConfetti] = useState(false);
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({ 
    firstName: '', 
    lastName: '', 
    email: '', 
    department: '', 
    phone: '',
    position: '',
    undertakingReceived: false 
  });

  // Theme Constants
  const bgClass = darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900";
  const cardClass = darkMode 
    ? "bg-slate-900 border-slate-800" 
    : "bg-white border-slate-200 shadow-sm";

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setAdminUser(user && !user.isAnonymous ? user : null);
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!adminUser) {
      setEmployees([]);
      setAuditLogs([]);
      setIsLoadingData(false);
      return undefined;
    }

    setIsLoadingData(true);
    const employeeSnapshots = {};
    const auditSnapshots = {};
    let hasResolvedInitialLoad = false;

    const normalizeEmployee = (item) => {
      const status = String(item.status || '').toLowerCase();
      const statusImpliesUndertaking = ['accepted', 'compliant', 'done', 'verified', 'yes', 'true', '1'].includes(status);
      return {
        ...item,
        undertakingReceived: item.undertakingReceived ?? statusImpliesUndertaking,
      };
    };

    const flattenAndMerge = (snapshotMap, type) => {
      const merged = new Map();

      Object.entries(snapshotMap).forEach(([pathKey, docs]) => {
        docs.forEach((item) => {
          const dedupeKey = item.email || item.id;
          if (!merged.has(dedupeKey)) {
            merged.set(dedupeKey, { ...item, sourcePath: pathKey });
          }
        });
      });

      const pathWithMostRecords = Object.entries(snapshotMap)
        .sort((a, b) => b[1].length - a[1].length)?.[0]?.[0];

      if (pathWithMostRecords) {
        const parsedPath = pathWithMostRecords.split('|');
        const isWritableCollectionPath = parsedPath.length % 2 === 1 && parsedPath[0] !== 'group';

        if (isWritableCollectionPath) {
          if (type === 'employees') {
            setActiveUndertakingsPath(parsedPath);
          } else {
            setActiveAuditLogsPath(parsedPath);
          }
        }
      }

      return Array.from(merged.values());
    };

    const employeeUnsubs = UNDERTAKINGS_PATHS.map((pathParts) => {
      const pathKey = pathParts.join('|');
      return onSnapshot(
        query(collection(db, ...pathParts)),
        (snap) => {
          employeeSnapshots[pathKey] = snap.docs.map((d) => normalizeEmployee({ id: d.id, ...d.data(), __collectionPath: pathKey }));
          setEmployees(flattenAndMerge(employeeSnapshots, 'employees'));
          if (!hasResolvedInitialLoad) {
            hasResolvedInitialLoad = true;
            setIsLoadingData(false);
          }
        },
        (error) => {
          console.error(`Unable to read employees from ${pathParts.join('/')}:`, error);
          if (!hasResolvedInitialLoad) {
            hasResolvedInitialLoad = true;
            setIsLoadingData(false);
          }
        }
      );
    });

    const auditUnsubs = AUDIT_LOGS_PATHS.map((pathParts) => {
      const pathKey = pathParts.join('|');
      return onSnapshot(
        query(collection(db, ...pathParts), orderBy('timestamp', 'desc')),
        (snap) => {
          auditSnapshots[pathKey] = snap.docs.map((d) => ({ id: d.id, ...d.data(), __collectionPath: pathKey }));
          const mergedLogs = flattenAndMerge(auditSnapshots, 'audit').sort(
            (a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
          );
          setAuditLogs(mergedLogs);
        },
        (error) => {
          console.error(`Unable to read audit logs from ${pathParts.join('/')}:`, error);
        }
      );
    });

    const groupEmployeeUnsub = onSnapshot(
      query(collectionGroup(db, UNDERTAKINGS_GROUP)),
      (snap) => {
        const key = `group|${UNDERTAKINGS_GROUP}`;
        employeeSnapshots[key] = snap.docs
          .filter((d) => d.ref.path.includes(`/${ORG_ID}/`))
          .map((d) => normalizeEmployee({ id: d.id, ...d.data(), __collectionPath: d.ref.parent.path.split('/').join('|') }));

        setEmployees(flattenAndMerge(employeeSnapshots, 'employees'));
        if (!hasResolvedInitialLoad) {
          hasResolvedInitialLoad = true;
          setIsLoadingData(false);
        }
      },
      (error) => {
        console.error('Unable to read undertakings via collectionGroup:', error);
      }
    );

    const groupAuditUnsub = onSnapshot(
      query(collectionGroup(db, AUDIT_LOGS_GROUP), orderBy('timestamp', 'desc')),
      (snap) => {
        const key = `group|${AUDIT_LOGS_GROUP}`;
        auditSnapshots[key] = snap.docs
          .filter((d) => d.ref.path.includes(`/${ORG_ID}/`))
          .map((d) => ({ id: d.id, ...d.data(), __collectionPath: d.ref.parent.path.split('/').join('|') }));

        const mergedLogs = flattenAndMerge(auditSnapshots, 'audit').sort(
          (a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
        );
        setAuditLogs(mergedLogs);
      },
      (error) => {
        console.error('Unable to read audit logs via collectionGroup:', error);
      }
    );

    return () => {
      employeeUnsubs.forEach((unsubscribe) => unsubscribe());
      auditUnsubs.forEach((unsubscribe) => unsubscribe());
      groupEmployeeUnsub();
      groupAuditUnsub();
    };
  }, [adminUser]);

  const stats = useMemo(() => {
    const total = employees.length;
    const compliant = employees.filter(e => e.undertakingReceived).length;
    const pending = total - compliant;
    const depts = {};
    
    employees.forEach(e => {
      const d = e.department || 'Unassigned';
      if (!depts[d]) depts[d] = { total: 0, compliant: 0 };
      depts[d].total++;
      if (e.undertakingReceived) depts[d].compliant++;
    });
    
    return { 
      total, 
      compliant, 
      pending,
      percentage: total > 0 ? Math.round((compliant / total) * 100) : 0, 
      departments: depts 
    };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const safeEmail = (emp.email || '').toLowerCase();
      const safeName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
      const matchesSearch = safeEmail.includes(searchTerm.toLowerCase()) || safeName.includes(searchTerm.toLowerCase());
      const matchesDept = filterDept === 'all' || emp.department === filterDept;
      const matchesStatus = filterStatus === 'all' || 
                           (filterStatus === 'compliant' && emp.undertakingReceived) ||
                           (filterStatus === 'pending' && !emp.undertakingReceived);
      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [employees, searchTerm, filterDept, filterStatus]);

  const handleSave = async (e) => {
    e.preventDefault();
    const isNew = !employees.find(emp => emp.email === formData.email);
    
    await setDoc(
      doc(db, ...activeUndertakingsPath, formData.email), 
      {
        ...formData, 
        status: formData.undertakingReceived ? 'Accepted' : 'Pending', 
        updatedAt: new Date().toISOString()
      }, 
      { merge: true }
    );

    // Add audit log
    await addDoc(
      collection(db, ...activeAuditLogsPath),
      {
        action: isNew ? 'Created' : 'Updated',
        details: `${isNew ? 'Added' : 'Updated'} record for ${formData.firstName} ${formData.lastName}`,
        timestamp: new Date().toISOString(),
        user: adminUser.email
      }
    );

    setIsAddModalOpen(false);
    setFormData({ firstName: '', lastName: '', email: '', department: '', phone: '', position: '', undertakingReceived: false });
    
    if (formData.undertakingReceived && isNew) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    }
  };

  const handleDelete = async (empId, empName) => {
    if (window.confirm(`Are you sure you want to delete ${empName}?`)) {
      await deleteDoc(doc(db, ...activeUndertakingsPath, empId));
      
      await addDoc(
        collection(db, ...activeAuditLogsPath),
        {
          action: 'Deleted',
          details: `Removed record for ${empName}`,
          timestamp: new Date().toISOString(),
          user: adminUser.email
        }
      );
    }
  };

  const exportToExcel = () => {
    const exportData = employees.map(emp => ({
      'First Name': emp.firstName,
      'Last Name': emp.lastName,
      'Email': emp.email,
      'Department': emp.department,
      'Phone': emp.phone || 'N/A',
      'Position': emp.position || 'N/A',
      'Status': emp.undertakingReceived ? 'Compliant' : 'Pending',
      'Updated': emp.updatedAt ? new Date(emp.updatedAt).toLocaleDateString() : 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Staff Records');
    XLSX.writeFile(wb, `AIIMS_Staff_Records_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImportExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const getCellValue = (row, labels) => {
      for (const label of labels) {
        if (row[label] !== undefined && row[label] !== null && String(row[label]).trim() !== '') {
          return String(row[label]).trim();
        }
      }
      return '';
    };

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (!rows.length) {
        alert('The selected Excel sheet is empty.');
        return;
      }

      const normalized = rows
        .map((row) => {
          const firstName = getCellValue(row, ['First Name', 'FirstName', 'firstName']);
          const lastName = getCellValue(row, ['Last Name', 'LastName', 'lastName']);
          const email = getCellValue(row, ['Email', 'email', 'Email Address']);
          const department = getCellValue(row, ['Department', 'department']);
          const phone = getCellValue(row, ['Phone', 'Phone Number', 'phone']);
          const position = getCellValue(row, ['Position', 'position', 'Designation']);
          const status = getCellValue(row, ['Status', 'status', 'Undertaking Status']).toLowerCase();
          const undertakingRaw = getCellValue(row, ['undertakingReceived', 'Undertaking Received', 'Compliant']);
          const undertakingReceived = undertakingRaw
            ? ['accepted', 'compliant', 'yes', 'true', '1', 'verified'].includes(undertakingRaw.toLowerCase())
            : ['accepted', 'compliant', 'yes', 'true', '1', 'verified'].includes(status);

          return {
            firstName,
            lastName,
            email: email.toLowerCase(),
            department,
            phone,
            position,
            undertakingReceived,
          };
        })
        .filter((row) => row.email);

      if (!normalized.length) {
        alert('No valid rows found. Make sure the Excel file has an Email column.');
        return;
      }

      const batch = writeBatch(db);
      const now = new Date().toISOString();

      normalized.forEach((entry) => {
        batch.set(
          doc(db, ...activeUndertakingsPath, entry.email),
          {
            ...entry,
            status: entry.undertakingReceived ? 'Accepted' : 'Pending',
            updatedAt: now,
          },
          { merge: true }
        );
      });

      await batch.commit();

      await addDoc(collection(db, ...activeAuditLogsPath), {
        action: 'Imported',
        details: `Imported ${normalized.length} staff record(s) from Excel`,
        timestamp: now,
        user: adminUser?.email || 'System',
      });

      alert(`Successfully imported ${normalized.length} staff record(s).`);
    } catch (error) {
      console.error('Excel import failed:', error);
      alert(`Excel import failed: ${error.message}`);
    } finally {
      event.target.value = '';
    }
  };

  const handleForgotPassword = async () => {
    setLoginError('');
    setPasswordResetMessage('');

    if (!loginEmail.trim()) {
      setLoginError('Please enter your email first, then click "Forgot password".');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, loginEmail.trim());
      setPasswordResetMessage('Password reset email sent. Please check your inbox/spam folder.');
    } catch (error) {
      setLoginError(`Unable to send reset email: ${error.message}`);
    }
  };

  if (!adminUser) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${bgClass} relative overflow-hidden`}>
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className={`relative w-full max-w-md p-10 rounded-3xl border ${cardClass} backdrop-blur-xl`}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 mb-4 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-xl shadow-blue-600/20">
              <img src={aiimsLogo} className="w-12 h-12 object-contain" alt="AIIMS" />
            </div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
              AIIMS Raipur
            </h1>
            <p className="text-sm opacity-60">Staff Compliance Portal</p>
          </div>

          <form onSubmit={async (e) => { 
            e.preventDefault(); 
            try {
              setLoginError('');
              setPasswordResetMessage('');
              await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
            } catch (error) {
              setLoginError('Login failed: ' + error.message);
            }
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 opacity-60">Email Address</label>
              <input 
                type="email" 
                placeholder="admin@aiims.edu" 
                className={`w-full p-4 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'} focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all`}
                value={loginEmail} 
                onChange={e => setLoginEmail(e.target.value)} 
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 opacity-60">Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                className={`w-full p-4 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'} focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all`}
                value={loginPassword} 
                onChange={e => setLoginPassword(e.target.value)} 
                required
              />
            </div>
            <button className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-blue-600/30 transition-all duration-300 hover:scale-[1.02]">
              Sign In Securely
            </button>
            <button
              type="button"
              onClick={handleForgotPassword}
              className="w-full text-sm text-blue-600 hover:text-blue-500 font-semibold"
            >
              Forgot password?
            </button>
            {loginError && <p className="text-sm text-red-500">{loginError}</p>}
            {passwordResetMessage && <p className="text-sm text-emerald-500">{passwordResetMessage}</p>}
          </form>

          <div className="mt-6 text-center text-xs opacity-40">
            <p>© 2025 AIIMS Raipur. All rights reserved.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoadingData) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${bgClass}`}>
        <p className="text-sm opacity-60">Loading staff records...</p>
      </div>
    );
  }

  return (
    <div className={`flex h-screen w-full ${bgClass} relative`}>
      {showConfetti && <Confetti recycle={false} numberOfPieces={500} />}

      {/* Enhanced Sidebar */}
      <aside className={`w-72 border-r ${darkMode ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'} flex flex-col`}>
        {/* Logo Section */}
        <div className="p-6 border-b border-slate-800/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <img src={aiimsLogo} className="w-6 h-6 object-contain" alt="AIIMS Logo" />
            </div>
            <div>
              <span className="font-bold text-lg">AIIMS Portal</span>
              <p className="text-xs opacity-40">Compliance System</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
            <UserCircle className="w-4 h-4 text-blue-600" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{adminUser.email}</p>
              <p className="text-[10px] opacity-40">Administrator</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', badge: null },
            { id: 'registry', icon: List, label: 'Staff Registry', badge: stats.total },
            { id: 'departments', icon: Building2, label: 'Departments', badge: Object.keys(stats.departments).length },
            { id: 'audit', icon: History, label: 'Audit Trail', badge: null },
          ].map((item) => (
            <button 
              key={item.id} 
              onClick={() => setActiveView(item.id)} 
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeView === item.id 
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/30 scale-[1.02]' 
                  : `${darkMode ? 'text-slate-400 hover:bg-slate-800/50' : 'text-slate-600 hover:bg-slate-100'} hover:scale-[1.01]`
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-4 h-4" /> 
                {item.label}
              </div>
              {item.badge !== null && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  activeView === item.id 
                    ? 'bg-white/20' 
                    : 'bg-blue-500/10 text-blue-600'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer Actions */}
        <div className={`p-4 border-t ${darkMode ? 'border-slate-800' : 'border-slate-200'} space-y-2`}>
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-100'
            }`}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button 
            onClick={() => signOut(auth)} 
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/5 rounded-xl transition-all font-medium"
          >
            <LogOut className="w-4 h-4" /> 
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Enhanced Header */}
        <header className={`h-20 border-b ${darkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-white/50'} backdrop-blur-xl flex items-center justify-between px-8`}>
          <div>
            <h2 className="text-2xl font-bold capitalize mb-1">{activeView}</h2>
            <p className="text-xs opacity-40">Last updated: {new Date().toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-3">
            {activeView === 'registry' && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleImportExcel}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all hover:scale-[1.02]"
                >
                  <Upload className="w-4 h-4" />
                  Import Excel
                </button>
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all hover:scale-[1.02]"
                >
                  <Download className="w-4 h-4" />
                  Export Data
                </button>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {activeView === 'dashboard' && (
            <div className="space-y-8 max-w-7xl mx-auto">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                  icon={Users} 
                  label="Total Staff" 
                  value={stats.total} 
                  trend={12}
                  darkMode={darkMode}
                />
                <StatCard 
                  icon={CheckCircle2} 
                  label="Compliant" 
                  value={stats.compliant} 
                  trend={8}
                  darkMode={darkMode}
                />
                <StatCard 
                  icon={Clock} 
                  label="Pending" 
                  value={stats.pending} 
                  darkMode={darkMode}
                />
                <StatCard 
                  icon={Award} 
                  label="Compliance Rate" 
                  value={`${stats.percentage}%`} 
                  trend={5}
                  darkMode={darkMode}
                />
              </div>

              {/* Main Dashboard Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity */}
                <div className={`lg:col-span-2 p-6 rounded-2xl border ${cardClass}`}>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold">Recent Activity</h3>
                    <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                      View All →
                    </button>
                  </div>
                  <div className="space-y-3">
                    {auditLogs.slice(0, 6).map((log, i) => (
                      <div key={i} className={`flex items-start gap-4 p-4 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'} group hover:scale-[1.01] transition-all`}>
                        <div className={`p-2 rounded-lg ${darkMode ? 'bg-blue-500/10' : 'bg-blue-500/5'}`}>
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium mb-1">{log.details}</p>
                          <div className="flex items-center gap-3 text-xs opacity-40">
                            <span>{new Date(log.timestamp).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>{log.user}</span>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                          log.action === 'Created' ? 'bg-emerald-500/10 text-emerald-600' :
                          log.action === 'Updated' ? 'bg-blue-500/10 text-blue-600' :
                          'bg-red-500/10 text-red-600'
                        }`}>
                          {log.action}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Compliance Meter */}
                <div className={`p-6 rounded-2xl border ${cardClass} flex flex-col items-center justify-center text-center`}>
                  <div className="relative w-40 h-40 mb-6">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke={darkMode ? '#1e293b' : '#e2e8f0'}
                        strokeWidth="12"
                        fill="none"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="url(#gradient)"
                        strokeWidth="12"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${(stats.percentage / 100) * 440} 440`}
                        className="transition-all duration-1000"
                      />
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#10b981" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div>
                        <div className="text-4xl font-bold">{stats.percentage}%</div>
                        <div className="text-xs opacity-40 mt-1">Complete</div>
                      </div>
                    </div>
                  </div>
                  <h4 className="font-bold text-lg mb-2">Total Compliance</h4>
                  <p className="text-sm opacity-60">
                    {stats.compliant} of {stats.total} staff members
                  </p>
                </div>
              </div>

              {/* Department Quick Stats */}
              <div className={`p-6 rounded-2xl border ${cardClass}`}>
                <h3 className="text-lg font-bold mb-6">Department Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(stats.departments).slice(0, 6).map(([name, data]) => {
                    const percentage = Math.round((data.compliant / data.total) * 100);
                    return (
                      <div key={name} className={`p-4 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-sm">{name}</h4>
                          <span className="text-xs font-bold text-blue-600">{percentage}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-600 to-emerald-600 rounded-full transition-all duration-1000"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <p className="text-xs opacity-40 mt-2">
                          {data.compliant} / {data.total} compliant
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeView === 'registry' && (
            <div className="max-w-7xl mx-auto">
              <div className={`rounded-2xl border ${cardClass} overflow-hidden`}>
                {/* Enhanced Filters */}
                <div className={`p-6 border-b ${darkMode ? 'border-slate-800' : 'border-slate-200'} space-y-4`}>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="relative flex-1 min-w-[300px]">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                      <input 
                        className={`w-full pl-11 pr-4 py-3 text-sm rounded-xl border ${
                          darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                        } focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all`}
                        placeholder="Search by name or email..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                      />
                    </div>
                    <select 
                      className={`px-4 py-3 rounded-xl border text-sm font-medium ${
                        darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                      } outline-none focus:ring-2 focus:ring-blue-600`}
                      value={filterDept}
                      onChange={e => setFilterDept(e.target.value)}
                    >
                      <option value="all">All Departments</option>
                      {Object.keys(stats.departments).map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                    <select 
                      className={`px-4 py-3 rounded-xl border text-sm font-medium ${
                        darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                      } outline-none focus:ring-2 focus:ring-blue-600`}
                      value={filterStatus}
                      onChange={e => setFilterStatus(e.target.value)}
                    >
                      <option value="all">All Status</option>
                      <option value="compliant">Compliant</option>
                      <option value="pending">Pending</option>
                    </select>
                    <button 
                      onClick={() => {
                        setFormData({ firstName: '', lastName: '', email: '', department: '', phone: '', position: '', undertakingReceived: false });
                        setIsAddModalOpen(true);
                      }} 
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-blue-600/30 transition-all hover:scale-[1.02] flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Staff
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-sm opacity-60">
                    <span>Showing {filteredEmployees.length} of {stats.total} records</span>
                  </div>
                </div>

                {/* Enhanced Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className={`${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'} text-xs font-bold uppercase tracking-wider`}>
                      <tr>
                        <th className="p-4 opacity-60">Staff Member</th>
                        <th className="p-4 opacity-60">Contact</th>
                        <th className="p-4 opacity-60">Department</th>
                        <th className="p-4 opacity-60 text-center">Status</th>
                        <th className="p-4 opacity-60">Last Updated</th>
                        <th className="p-4 opacity-60 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${darkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
                      {filteredEmployees.map(emp => (
                        <tr key={emp.id} className={`${darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'} transition-colors`}>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-bold text-sm">
                                {emp.firstName?.[0]}{emp.lastName?.[0]}
                              </div>
                              <div>
                                <div className="font-semibold">{emp.firstName} {emp.lastName}</div>
                                <div className="text-xs opacity-40">{emp.position || 'Staff Member'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-xs">
                                <Mail className="w-3 h-3 opacity-40" />
                                {emp.email}
                              </div>
                              {emp.phone && (
                                <div className="flex items-center gap-2 text-xs opacity-60">
                                  <Phone className="w-3 h-3" />
                                  {emp.phone}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {emp.department}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <StatusBadge status={emp.undertakingReceived ? 'Accepted' : 'Pending'} />
                          </td>
                          <td className="p-4 text-xs opacity-60">
                            {emp.updatedAt ? new Date(emp.updatedAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => { 
                                  setFormData(emp); 
                                  setIsAddModalOpen(true); 
                                }} 
                                className="p-2 text-blue-600 hover:bg-blue-500/10 rounded-lg transition-all"
                              >
                                <Edit2 className="w-4 h-4"/>
                              </button>
                              <button 
                                onClick={() => handleDelete(emp.id, `${emp.firstName} ${emp.lastName}`)}
                                className="p-2 text-red-600 hover:bg-red-500/10 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4"/>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeView === 'departments' && (
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(stats.departments).map(([name, data]) => {
                  const percentage = Math.round((data.compliant / data.total) * 100);
                  return (
                    <div key={name} className={`p-6 rounded-2xl border ${cardClass} hover:scale-[1.02] transition-all duration-300`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className={`p-3 rounded-xl ${darkMode ? 'bg-blue-500/10' : 'bg-blue-500/5'}`}>
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          percentage >= 80 ? 'bg-emerald-500/10 text-emerald-600' :
                          percentage >= 50 ? 'bg-amber-500/10 text-amber-600' :
                          'bg-red-500/10 text-red-600'
                        }`}>
                          {percentage}%
                        </span>
                      </div>
                      <h3 className="font-bold text-lg mb-4">{name}</h3>
                      <div className="space-y-3">
                        <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-600 to-emerald-600 rounded-full transition-all duration-1000"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="opacity-60">Progress</span>
                          <span className="font-bold">{data.compliant} / {data.total}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeView === 'audit' && (
            <div className="max-w-4xl mx-auto space-y-4">
              {auditLogs.map((log, i) => (
                <div key={i} className={`p-5 rounded-2xl border ${cardClass} hover:scale-[1.01] transition-all`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`p-2.5 rounded-xl ${
                        log.action === 'Created' ? 'bg-emerald-500/10' :
                        log.action === 'Updated' ? 'bg-blue-500/10' :
                        'bg-red-500/10'
                      }`}>
                        {log.action === 'Created' && <Plus className="w-4 h-4 text-emerald-600" />}
                        {log.action === 'Updated' && <Edit2 className="w-4 h-4 text-blue-600" />}
                        {log.action === 'Deleted' && <Trash2 className="w-4 h-4 text-red-600" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className={`font-bold ${
                            log.action === 'Created' ? 'text-emerald-600' :
                            log.action === 'Updated' ? 'text-blue-600' :
                            'text-red-600'
                          }`}>
                            {log.action}
                          </span>
                        </div>
                        <p className="text-sm opacity-80">{log.details}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs opacity-40">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(log.timestamp).toLocaleDateString()}
                          </div>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <UserCircle className="w-3 h-3" />
                            {log.user}
                          </div>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs opacity-40">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Enhanced Add/Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-2xl p-8 rounded-3xl border ${cardClass} shadow-2xl animate-in zoom-in-95 duration-200`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">
                {employees.find(e => e.email === formData.email) ? 'Edit Staff Record' : 'Add New Staff'}
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 hover:bg-slate-800 rounded-lg transition-all"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 opacity-60">First Name *</label>
                  <input 
                    className={`w-full p-3 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all`}
                    placeholder="John" 
                    value={formData.firstName} 
                    onChange={e => setFormData({ ...formData, firstName: e.target.value })} 
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 opacity-60">Last Name *</label>
                  <input 
                    className={`w-full p-3 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all`}
                    placeholder="Doe" 
                    value={formData.lastName} 
                    onChange={e => setFormData({ ...formData, lastName: e.target.value })} 
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 opacity-60">Email Address *</label>
                <input 
                  type="email"
                  className={`w-full p-3 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all`}
                  placeholder="john.doe@aiims.edu" 
                  value={formData.email} 
                  onChange={e => setFormData({ ...formData, email: e.target.value })} 
                  required
                  disabled={!!employees.find(e => e.email === formData.email)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 opacity-60">Department *</label>
                  <input 
                    className={`w-full p-3 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all`}
                    placeholder="Cardiology" 
                    value={formData.department} 
                    onChange={e => setFormData({ ...formData, department: e.target.value })} 
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 opacity-60">Position</label>
                  <input 
                    className={`w-full p-3 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all`}
                    placeholder="Senior Consultant" 
                    value={formData.position} 
                    onChange={e => setFormData({ ...formData, position: e.target.value })} 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 opacity-60">Phone Number</label>
                <input 
                  type="tel"
                  className={`w-full p-3 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all`}
                  placeholder="+91 98765 43210" 
                  value={formData.phone} 
                  onChange={e => setFormData({ ...formData, phone: e.target.value })} 
                />
              </div>

              <div className={`flex items-center gap-3 p-4 rounded-xl border ${darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                <input 
                  type="checkbox" 
                  id="undertaking"
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-600"
                  checked={formData.undertakingReceived} 
                  onChange={e => setFormData({ ...formData, undertakingReceived: e.target.checked })} 
                />
                <label htmlFor="undertaking" className="text-sm font-medium cursor-pointer">
                  Undertaking Document Received and Verified
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                    darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'
                  }`}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-blue-600/30 transition-all hover:scale-[1.02]"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
