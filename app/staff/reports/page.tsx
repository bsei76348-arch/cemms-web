// app/staff/reports/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth, mobileDb, webCemmsDb } from '@/app/lib/combinedFirebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore';
import {
  FileText, Leaf, BarChart3, Ruler, Award, Calendar,
  Download, Printer, RefreshCw, Filter, X, Flag, Eye, Check, Clock,
  TrendingUp, Monitor, Smartphone, ChevronUp, ChevronDown,
  MapPin, AlertTriangle, CheckCircle, Info, Trash2
} from 'lucide-react';
import StaffSidebar from '@/app/lib/StaffSidebar';

// 16 barangays ng Marilao
const BARANGAYS = [
  'Abangan Norte', 'Abangan Sur', 'Ibayo', 'Lambakin', 'Lias', 'Loma de Gato',
  'Nagbalon', 'Patubig', 'Poblacion I', 'Poblacion II', 'Prenza I', 'Prenza II',
  'Santa Rosa I', 'Santa Rosa II', 'Saog', 'Tabing Ilog'
];

const normalizeBarangayName = (name: string): string => {
  const mapping: Record<string, string> = {
    'Poblacion 1': 'Poblacion I', 'Poblacion 2': 'Poblacion II',
    'Prenza 1': 'Prenza I', 'Prenza 2': 'Prenza II',
    'Santa Rosa 1': 'Santa Rosa I', 'Santa Rosa 2': 'Santa Rosa II',
    'Loma De Gato': 'Loma de Gato', 'STA. ROSA 1': 'Santa Rosa I',
    'STA. ROSA 2': 'Santa Rosa II', 'PRENZA 1': 'Prenza I',
    'PRENZA 2': 'Prenza II', 'POBLACION 1': 'Poblacion I',
    'POBLACION 2': 'Poblacion II', 'LOMA DE GATO': 'Loma de Gato',
  };
  return mapping[name.trim()] || name.trim();
};

const getEmissionLabel = (value: number) => {
  if (value === 0) return 'NO DATA';
  if (value >= 2000) return 'CRITICAL';
  if (value >= 1000) return 'VERY HIGH';
  if (value >= 700) return 'HIGH';
  if (value >= 500) return 'MEDIUM';
  if (value >= 300) return 'LOW';
  return 'VERY LOW';
};

interface Flag {
  id: string;
  barangay: string;
  emissionLevel: number;
  flaggedBy: string;
  flaggedByName: string;
  createdAt: any;
  status: 'pending' | 'reviewed' | 'resolved';
  reason?: string;
}

interface ReportRecord {
  id: string;
  barangay: string;
  amount: number;
  source: 'Web App' | 'Mobile App';
  type: string;
  date: Date;
}

export default function StaffReports() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'reports' | 'flags'>('reports');
  const router = useRouter();

  // Filters & sorting
  const [selectedBarangay, setSelectedBarangay] = useState('all');
  const [selectedSource, setSelectedSource] = useState<'all' | 'web' | 'mobile'>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [sortField, setSortField] = useState<'date' | 'barangay' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Data states
  const [allRecords, setAllRecords] = useState<ReportRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<ReportRecord[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [prevSummary, setPrevSummary] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [flaggingBarangay, setFlaggingBarangay] = useState<string | null>(null);
  
  // Toast notifications
  const [toasts, setToasts] = useState<{id: string, type: 'success'|'error'|'info', message: string}[]>([]);
  const toastIdRef = useRef(0);
  const addToast = (type: 'success'|'error'|'info', message: string) => {
    const id = `toast-${toastIdRef.current++}-${Date.now()}`;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  // Fetch all emission data from three sources
  const fetchAllData = useCallback(async () => {
    setIsGenerating(true);
    try {
      const [calcSnap, billsSnap, webSnap] = await Promise.all([
        getDocs(collection(mobileDb, 'calculations')),
        getDocs(collection(mobileDb, 'bills')),
        getDocs(collection(webCemmsDb, 'emissions'))
      ]);
      const records: ReportRecord[] = [];

      // Calculator (Mobile)
      calcSnap.forEach(doc => {
        const data = doc.data();
        const barangay = normalizeBarangayName(data.barangay || '');
        const amount = Number(data.dailyCarbon || data.carbonAmount || data.totalCarbon || 0);
        if (barangay && amount > 0 && BARANGAYS.includes(barangay)) {
          records.push({
            id: doc.id,
            barangay,
            amount,
            source: 'Mobile App',
            type: 'Calculator',
            date: data.createdAt?.toDate?.() || data.timestamp?.toDate?.() || new Date()
          });
        }
      });

      // Bill Scan (Mobile)
      billsSnap.forEach(doc => {
        const data = doc.data();
        const barangay = normalizeBarangayName(data.barangay || '');
        const amount = Number(data.carbonEmission || data.totalCarbon || data.amount || 0);
        if (barangay && amount > 0 && BARANGAYS.includes(barangay)) {
          records.push({
            id: doc.id,
            barangay,
            amount,
            source: 'Mobile App',
            type: 'Bill Scan',
            date: data.createdAt?.toDate?.() || data.timestamp?.toDate?.() || new Date()
          });
        }
      });

      // Web Input (Admin/Staff)
      webSnap.forEach(doc => {
        const data = doc.data();
        const barangay = normalizeBarangayName(data.barangay || '');
        const amount = Number(data.carbonAmount || data.amount || data.emission || data.totalCarbon || 0);
        if (barangay && amount > 0 && BARANGAYS.includes(barangay)) {
          records.push({
            id: doc.id,
            barangay,
            amount,
            source: 'Web App',
            type: 'Web Input',
            date: data.createdAt?.toDate?.() || data.timestamp?.toDate?.() || data.date?.toDate?.() || new Date()
          });
        }
      });

      records.sort((a, b) => b.date.getTime() - a.date.getTime());
      setAllRecords(records);
      addToast('success', `Loaded ${records.length} records`);
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Failed to load data: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  // Apply filters & sorting
  useEffect(() => {
    let filtered = [...allRecords];
    if (selectedBarangay !== 'all') {
      filtered = filtered.filter(r => r.barangay === selectedBarangay);
    }
    if (selectedSource === 'web') {
      filtered = filtered.filter(r => r.source === 'Web App');
    } else if (selectedSource === 'mobile') {
      filtered = filtered.filter(r => r.source === 'Mobile App');
    }
    if (dateRange.start) {
      const start = new Date(dateRange.start);
      filtered = filtered.filter(r => r.date >= start);
    }
    if (dateRange.end) {
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59);
      filtered = filtered.filter(r => r.date <= end);
    }

    // Sorting
    filtered.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      if (sortField === 'date') {
        aVal = a.date.getTime();
        bVal = b.date.getTime();
      }
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    setFilteredRecords(filtered);

    // Summary stats
    const totalEmissions = filtered.reduce((s, r) => s + r.amount, 0);
    const totalRecords = filtered.length;
    const avgEmission = totalRecords ? totalEmissions / totalRecords : 0;
    const barangayStats: Record<string, number> = {};
    filtered.forEach(r => {
      barangayStats[r.barangay] = (barangayStats[r.barangay] || 0) + r.amount;
    });
    const top = Object.entries(barangayStats).sort((a, b) => b[1] - a[1])[0];
    setSummary({
      totalEmissions,
      totalRecords,
      avgEmission,
      topBarangay: top ? top[0] : 'N/A',
      topEmission: top ? top[1] : 0,
      dateRange: { start: dateRange.start || 'All time', end: dateRange.end || 'Present' }
    });

    // Previous period comparison if both dates selected
    if (dateRange.start && dateRange.end) {
      const startPrev = new Date(dateRange.start);
      const endPrev = new Date(dateRange.end);
      const duration = endPrev.getTime() - new Date(dateRange.start).getTime();
      startPrev.setTime(startPrev.getTime() - duration);
      endPrev.setTime(endPrev.getTime() - duration);
      const prevRecords = allRecords.filter(r => r.date >= startPrev && r.date <= endPrev);
      setPrevSummary({
        totalEmissions: prevRecords.reduce((s, r) => s + r.amount, 0),
        totalRecords: prevRecords.length
      });
    } else {
      setPrevSummary(null);
    }
  }, [allRecords, selectedBarangay, selectedSource, dateRange, sortField, sortDir]);

  // Date presets
  const applyDatePreset = (preset: typeof datePreset) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'today') {
      const today = now.toISOString().split('T')[0];
      setDateRange({ start: today, end: today });
    } else if (preset === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      setDateRange({ start: weekAgo.toISOString().split('T')[0], end: now.toISOString().split('T')[0] });
    } else if (preset === 'month') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(now.getMonth() - 1);
      setDateRange({ start: monthAgo.toISOString().split('T')[0], end: now.toISOString().split('T')[0] });
    } else {
      setDateRange({ start: '', end: '' });
    }
  };

  const clearFilters = () => {
    setSelectedBarangay('all');
    setSelectedSource('all');
    setDateRange({ start: '', end: '' });
    setDatePreset('all');
    setSortField('date');
    setSortDir('desc');
  };

  // Export CSV
  const exportCSV = () => {
    if (filteredRecords.length === 0) {
      addToast('info', 'No records to export');
      return;
    }
    const headers = ['Date', 'Barangay', 'Source', 'Type', 'CO₂ (kg)'];
    const rows = filteredRecords.map(r => [
      r.date.toLocaleDateString(),
      r.barangay,
      r.source,
      r.type,
      r.amount.toFixed(2)
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emissions_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', `Exported ${filteredRecords.length} records to CSV`);
  };

  const printReport = () => window.print();

  // --- FLAGS: Real-time listener & CRUD ---
  // Real‑time listener for flags collection
  useEffect(() => {
    const q = query(collection(webCemmsDb, 'flags'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const flagsData: Flag[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          barangay: data.barangay,
          emissionLevel: data.emissionLevel,
          flaggedBy: data.flaggedBy,
          flaggedByName: data.flaggedByName,
          createdAt: data.createdAt,
          status: data.status,
          reason: data.reason,
        };
      });
      setFlags(flagsData);
    }, (error) => {
      console.error('Flags listener error:', error);
      addToast('error', 'Failed to load flags');
    });
    return () => unsubscribe();
  }, []);

  const handleFlagBarangay = async (barangay: string, emission: number) => {
    if (emission === 0) {
      addToast('error', `Cannot flag ${barangay} – No emission data available.`);
      return;
    }
    const reason = prompt(`Flag ${barangay}\n\nEmission: ${emission} kg CO₂\nClassification: ${getEmissionLabel(emission)}\n\nReason:`, 'Exceeds normal emission levels');
    if (!reason) return;

    setFlaggingBarangay(barangay);
    try {
      await addDoc(collection(webCemmsDb, 'flags'), {
        barangay,
        emissionLevel: emission,
        flaggedBy: user?.uid || 'staff-unknown',
        flaggedByName: user?.email?.split('@')[0] || 'staff',
        createdAt: new Date(),
        status: 'pending',
        reason,
      });
      addToast('success', `${barangay} flagged successfully!`);
    } catch (error: any) {
      console.error(error);
      addToast('error', 'Failed to flag barangay: ' + error.message);
    } finally {
      setFlaggingBarangay(null);
    }
  };

  // Staff can only flag — admin handles review/resolve/delete

  // Real-time emission listeners
  useEffect(() => {
    const unsubCalc = onSnapshot(collection(mobileDb, 'calculations'), () => fetchAllData());
    const unsubBills = onSnapshot(collection(mobileDb, 'bills'), () => fetchAllData());
    const unsubEmissions = onSnapshot(collection(webCemmsDb, 'emissions'), () => fetchAllData());
    return () => { unsubCalc(); unsubBills(); unsubEmissions(); };
  }, [fetchAllData]);

  // Authentication with mock fallback (staff only)
  useEffect(() => {
    const checkAuth = async () => {
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        setUser(firebaseUser);
        await fetchAllData();
        setLoading(false);
        return;
      }
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('cemms_user');
        if (stored) {
          try {
            const mock = JSON.parse(stored);
            // Only allow staff role; admin should go to admin reports
            if (mock.role === 'admin') {
              router.push('/admin/reports');
              return;
            }
            setUser({ uid: mock.uid, email: mock.email, displayName: mock.role });
            await fetchAllData();
            setLoading(false);
            return;
          } catch (e) {
            console.error('Failed to parse mock user:', e);
          }
        }
      }
      router.push('/login');
      setLoading(false);
    };
    checkAuth();
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        await fetchAllData();
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router, fetchAllData]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FDF9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <RefreshCw size={48} className="animate-spin" color="#14B89D" />
      </div>
    );
  }

  const userName = user?.email?.split('@')[0] || 'Staff';
  const pendingCount = flags.filter(f => f.status === 'pending').length;

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ChevronDown size={14} className="opacity-40" />;
    return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div style={{ display: 'flex', background: '#F8FDF9', minHeight: '100vh' }}>
      <StaffSidebar userName={userName} />

      <div className="main-content">
        {/* Toast Container */}
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast ${t.type}`}>
              {t.type === 'success' && <CheckCircle size={18} />}
              {t.type === 'error' && <AlertTriangle size={18} />}
              {t.type === 'info' && <Info size={18} />}
              <span>{t.message}</span>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}><X size={16} /></button>
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="header-card">
          <div>
            <h1>Emission Reports</h1>
            <p>Monitor and analyze household carbon emissions across 16 barangays of Marilao</p>
          </div>
          <div className="header-actions">
            <button className="icon-btn" onClick={fetchAllData} disabled={isGenerating}>
              <RefreshCw size={16} className={isGenerating ? 'spin' : ''} /> Sync
            </button>
            <button className="icon-btn" onClick={exportCSV} disabled={filteredRecords.length === 0}>
              <Download size={16} /> Export
            </button>
            <div className="staff-badge">
              <span className="live-dot"></span> STAFF
            </div>
            <div className="date-badge">
              <Calendar size={14} /> {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tab-nav">
          <button className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>
            <BarChart3 size={16} /> Emission Reports
          </button>
          <button className={`tab-btn ${activeTab === 'flags' ? 'active' : ''}`} onClick={() => setActiveTab('flags')}>
            <Flag size={16} /> Flagged Barangays
            {pendingCount > 0 && <span className="alert-badge">{pendingCount}</span>}
          </button>
        </div>

        {activeTab === 'reports' ? (
          <>
            {/* Advanced Filter Card */}
            <div className="filter-card">
              <div className="filter-header">
                <Filter size={16} /> <span>Advanced Filters</span>
                <button className="clear-btn" onClick={clearFilters}>Clear all filters</button>
              </div>
              <div className="filter-grid">
                <div className="filter-item">
                  <label><Calendar size={14} /> Date Range</label>
                  <div className="date-range-inputs">
                    <input type="date" value={dateRange.start} onChange={e => { setDateRange({...dateRange, start: e.target.value}); setDatePreset('all'); }} />
                    <span>—</span>
                    <input type="date" value={dateRange.end} onChange={e => { setDateRange({...dateRange, end: e.target.value}); setDatePreset('all'); }} />
                  </div>
                  <div className="preset-buttons">
                    <button className={`preset ${datePreset === 'today' ? 'active' : ''}`} onClick={() => applyDatePreset('today')}>Today</button>
                    <button className={`preset ${datePreset === 'week' ? 'active' : ''}`} onClick={() => applyDatePreset('week')}>This Week</button>
                    <button className={`preset ${datePreset === 'month' ? 'active' : ''}`} onClick={() => applyDatePreset('month')}>This Month</button>
                  </div>
                </div>
                <div className="filter-item">
                  <label><MapPin size={14} /> Barangay</label>
                  <select value={selectedBarangay} onChange={e => setSelectedBarangay(e.target.value)}>
                    <option value="all">All Barangays</option>
                    {BARANGAYS.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div className="filter-item">
                  <label><Monitor size={14} /> Source</label>
                  <div className="source-toggle">
                    <button className={`source-btn ${selectedSource === 'all' ? 'active' : ''}`} onClick={() => setSelectedSource('all')}>All</button>
                    <button className={`source-btn ${selectedSource === 'web' ? 'active' : ''}`} onClick={() => setSelectedSource('web')}>Web</button>
                    <button className={`source-btn ${selectedSource === 'mobile' ? 'active' : ''}`} onClick={() => setSelectedSource('mobile')}>Mobile</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Stats Cards */}
            {summary && (
              <div className="summary-card">
                <h3><TrendingUp size={18} /> Summary Report</h3>
                <div className="summary-grid">
                  <div className="summary-item pastel-teal">
                    <Leaf className="summary-icon" />
                    <div className="summary-value">{summary.totalEmissions.toLocaleString()} <span className="summary-unit">kg</span></div>
                    <div className="summary-label">Total CO₂</div>
                    {prevSummary && (
                      <div className={`trend ${summary.totalEmissions >= prevSummary.totalEmissions ? 'up' : 'down'}`}>
                        {summary.totalEmissions >= prevSummary.totalEmissions ? '▲' : '▼'} 
                        {Math.abs(((summary.totalEmissions - prevSummary.totalEmissions) / (prevSummary.totalEmissions || 1)) * 100).toFixed(1)}% vs prev
                      </div>
                    )}
                  </div>
                  <div className="summary-item pastel-mint">
                    <BarChart3 className="summary-icon" />
                    <div className="summary-value">{summary.totalRecords}</div>
                    <div className="summary-label">Total Records</div>
                  </div>
                  <div className="summary-item pastel-yellowgreen">
                    <Ruler className="summary-icon" />
                    <div className="summary-value">{summary.avgEmission.toFixed(1)} <span className="summary-unit">kg</span></div>
                    <div className="summary-label">Average per Record</div>
                  </div>
                  <div className="summary-item pastel-coral">
                    <Award className="summary-icon" />
                    <div className="summary-value">{summary.topBarangay}</div>
                    <div className="summary-label">Top Emitting</div>
                    <div className="summary-sub">{summary.topEmission.toLocaleString()} kg</div>
                  </div>
                </div>
                <div className="summary-footer">
                  <Calendar size={14} /> Period: {summary.dateRange.start} — {summary.dateRange.end}
                </div>
              </div>
            )}

            {/* Export Options Card */}
            {filteredRecords.length > 0 && (
              <div className="export-card">
                <h3><Download size={18} /> Export Options</h3>
                <div className="export-buttons">
                  <button className="export-btn csv" onClick={exportCSV}>📥 CSV</button>
                  <button className="export-btn print" onClick={printReport}>🖨️ Print / PDF</button>
                </div>
              </div>
            )}

            {/* Report Table */}
            <div className="report-card">
              <div className="card-header">
                <h3><FileText size={18} /> Report Data</h3>
                <span className="record-count">{filteredRecords.length} records</span>
              </div>
              {filteredRecords.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <h4>No data to display</h4>
                  <p>Adjust filters or sync data</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th onClick={() => { if (sortField === 'date') setSortDir(prev => prev === 'asc' ? 'desc' : 'asc'); else { setSortField('date'); setSortDir('desc'); } }}>
                          Date <SortIcon field="date" />
                        </th>
                        <th onClick={() => { if (sortField === 'barangay') setSortDir(prev => prev === 'asc' ? 'desc' : 'asc'); else { setSortField('barangay'); setSortDir('asc'); } }}>
                          Barangay <SortIcon field="barangay" />
                        </th>
                        <th>Source</th>
                        <th>Type</th>
                        <th onClick={() => { if (sortField === 'amount') setSortDir(prev => prev === 'asc' ? 'desc' : 'asc'); else { setSortField('amount'); setSortDir('desc'); } }}>
                          CO₂ (kg) <SortIcon field="amount" />
                        </th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((record, idx) => (
                        <tr key={`${record.id}-${idx}`}>
                          <td>{record.date.toLocaleDateString()}</td>
                          <td><strong>{record.barangay}</strong></td>
                          <td>
                            <span className={`source-badge ${record.source === 'Web App' ? 'web' : 'mobile'}`}>
                              {record.source === 'Web App' ? <Monitor size={12} /> : <Smartphone size={12} />}
                              {record.source}
                            </span>
                          </td>
                          <td>
                            <span className={`type-badge ${record.type === 'Calculator' ? 'type-calc' : record.type === 'Bill Scan' ? 'type-bill' : 'type-web'}`}>
                              {record.type}
                            </span>
                          </td>
                          <td className="amount">{record.amount.toLocaleString()} kg</td>
                          <td>
                            <button
                              className="flag-btn"
                              onClick={() => handleFlagBarangay(record.barangay, record.amount)}
                              disabled={flaggingBarangay === record.barangay}
                            >
                              {flaggingBarangay === record.barangay ? '...' : <Flag size={12} />}
                              Flag
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Flags Management Tab */
          <div className="report-card">
            <div className="card-header">
              <h3><Flag size={18} /> Flagged Barangays</h3>
              <span className="record-count">Total: {flags.length} | Pending: {pendingCount}</span>
            </div>
            <div className="table-container">
              {flags.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🚩</div>
                  <p>No flagged barangays yet.</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Barangay</th>
                      <th>Emission</th>
                      <th>Reason</th>
                      <th>Flagged By</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flags.map(flag => {
                      const date = flag.createdAt?.toDate ? flag.createdAt.toDate() : new Date(flag.createdAt);
                      return (
                        <tr key={flag.id}>
                          <td><strong>📍 {flag.barangay}</strong></td>
                          <td className="emission-high">{flag.emissionLevel.toLocaleString()} kg</td>
                          <td>{flag.reason || '—'}</td>
                          <td>@{flag.flaggedByName}</td>
                          <td>{date.toLocaleDateString()}</td>
                          <td>
                            <span className={`status-badge ${flag.status}`}>
                              {flag.status === 'pending' && <Clock size={12} />}
                              {flag.status === 'reviewed' && <Eye size={12} />}
                              {flag.status === 'resolved' && <Check size={12} />}
                              {flag.status.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <span style={{fontSize:'12px',color:'#94A3B8'}}>Admin manages this</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .animate-spin, .spin {
          animation: spin 1s linear infinite;
        }

        .main-content {
          flex: 1;
          margin-left: 280px;
          padding: 28px 36px;
          background: #F8FDF9;
          min-height: 100vh;
        }

        /* Toast Notifications */
        .toast-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 1100;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .toast {
          background: white;
          border-radius: 14px;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          border-left: 5px solid;
          font-size: 14px;
          min-width: 260px;
        }
        .toast.success { border-left-color: #14B89D; }
        .toast.error { border-left-color: #DC2626; }
        .toast.info { border-left-color: #3B82F6; }
        .toast button {
          background: none;
          border: none;
          cursor: pointer;
          margin-left: auto;
          color: #64748B;
          display: flex;
          align-items: center;
        }

        /* Header Card */
        .header-card {
          background: #14B89D;
          border-radius: 28px;
          padding: 24px 32px;
          margin-bottom: 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 20px;
          border: 1px solid #9FE5D5;
          box-shadow: 0 6px 16px rgba(20,184,157,0.12);
        }
        .header-card h1 {
          color: white;
          margin: 0 0 8px;
          font-size: 32px;
          font-weight: 700;
        }
        .header-card p {
          color: #E6F7F3;
          margin: 0;
          font-size: 15px;
        }
        .header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }
        .icon-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          border: 1px solid #9FE5D5;
          padding: 8px 18px;
          border-radius: 44px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          color: #0F5C4B;
          font-weight: 500;
        }
        .icon-btn:hover:not(:disabled) {
          background: #E6F7F3;
          transform: translateY(-1px);
        }
        .icon-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .staff-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #FEF2F2;
          padding: 8px 18px;
          border-radius: 44px;
          font-size: 13px;
          font-weight: 700;
          color: #DC2626;
        }
        .live-dot {
          width: 8px;
          height: 8px;
          background: #DC2626;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%,100% { opacity: 1; }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
        .date-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          padding: 8px 18px;
          border-radius: 44px;
          font-size: 13px;
          color: #0F5C4B;
          font-weight: 500;
          border: 1px solid #9FE5D5;
        }

        /* Tab Navigation */
        .tab-nav {
          display: flex;
          gap: 12px;
          margin-bottom: 28px;
          background: white;
          padding: 6px;
          border-radius: 60px;
          border: 1px solid #9FE5D5;
          width: fit-content;
        }
        .tab-btn {
          padding: 8px 28px;
          border-radius: 44px;
          border: none;
          background: transparent;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #4B5563;
        }
        .tab-btn.active {
          background: #14B89D;
          color: white;
        }
        .alert-badge {
          background: #DC2626;
          color: white;
          border-radius: 30px;
          padding: 0 8px;
          font-size: 11px;
          margin-left: 8px;
        }

        /* Filter Card */
        .filter-card {
          background: #E6F7F3;
          border-radius: 28px;
          padding: 24px 28px;
          margin-bottom: 28px;
          border: 1px solid #9FE5D5;
        }
        .filter-header {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          color: #0F5C4B;
          margin-bottom: 24px;
          padding-bottom: 12px;
          border-bottom: 1px solid #9FE5D5;
          font-size: 16px;
        }
        .clear-btn {
          margin-left: auto;
          background: none;
          border: none;
          color: #DC2626;
          font-size: 13px;
          cursor: pointer;
          font-weight: 500;
        }
        .filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 24px;
        }
        .filter-item {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .filter-item label {
          font-size: 14px;
          font-weight: 600;
          color: #2C7A66;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .filter-item input, .filter-item select {
          padding: 10px 14px;
          border: 1px solid #9FE5D5;
          border-radius: 20px;
          font-size: 14px;
          background: white;
        }
        .date-range-inputs {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .date-range-inputs input {
          flex: 1;
        }
        .preset-buttons {
          display: flex;
          gap: 8px;
          margin-top: 6px;
        }
        .preset {
          background: white;
          border: 1px solid #9FE5D5;
          padding: 6px 16px;
          border-radius: 40px;
          font-size: 13px;
          cursor: pointer;
          color: #0F5C4B;
          font-weight: 500;
        }
        .preset.active {
          background: #14B89D;
          color: white;
          border-color: #14B89D;
        }
        .source-toggle {
          display: flex;
          gap: 10px;
        }
        .source-btn {
          flex: 1;
          background: white;
          border: 1px solid #9FE5D5;
          padding: 8px 0;
          border-radius: 40px;
          font-size: 13px;
          cursor: pointer;
          text-align: center;
          color: #0F5C4B;
          font-weight: 500;
        }
        .source-btn.active {
          background: #14B89D;
          color: white;
          border-color: #14B89D;
        }

        /* Summary Card */
        .summary-card {
          background: white;
          border-radius: 28px;
          padding: 24px;
          border: 1px solid #C8E6C9;
          margin-bottom: 28px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .summary-card h3 {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #166534;
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 700;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
          margin-bottom: 16px;
        }
        .summary-item {
          text-align: center;
          padding: 16px;
          border-radius: 20px;
          transition: all 0.2s;
        }
        .summary-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(0,0,0,0.05);
        }
        .pastel-teal { background: #D6F4EE; border: 1px solid #9FE5D5; }
        .pastel-mint { background: #DCFCE7; border: 1px solid #BBF7D0; }
        .pastel-yellowgreen { background: #E9F5DB; border: 1px solid #D4E8B3; }
        .pastel-coral { background: #FFEDD5; border: 1px solid #FED7AA; }
        .summary-icon { width: 32px; height: 32px; margin: 0 auto 8px; }
        .pastel-teal .summary-icon { color: #0F5C4B; }
        .pastel-mint .summary-icon { color: #166534; }
        .pastel-yellowgreen .summary-icon { color: #3D5C1A; }
        .pastel-coral .summary-icon { color: #9A3412; }
        .summary-value {
          font-size: 28px;
          font-weight: 800;
          margin-bottom: 6px;
        }
        .pastel-teal .summary-value { color: #0F5C4B; }
        .pastel-mint .summary-value { color: #166534; }
        .pastel-yellowgreen .summary-value { color: #3D5C1A; }
        .pastel-coral .summary-value { color: #9A3412; }
        .summary-unit { font-size: 12px; font-weight: 500; color: #64748B; }
        .summary-label { font-size: 13px; font-weight: 500; }
        .pastel-teal .summary-label { color: #3B7A6A; }
        .pastel-mint .summary-label { color: #4B5563; }
        .pastel-yellowgreen .summary-label { color: #5A7C2E; }
        .pastel-coral .summary-label { color: #C2410C; }
        .summary-sub { font-size: 11px; margin-top: 4px; }
        .trend { font-size: 11px; margin-top: 8px; font-weight: 600; }
        .trend.up { color: #DC2626; }
        .trend.down { color: #14B89D; }
        .summary-footer {
          padding-top: 16px;
          border-top: 1px solid #E5E7EB;
          font-size: 12px;
          color: #64748B;
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        /* Export Card */
        .export-card {
          background: white;
          border-radius: 28px;
          padding: 20px 24px;
          border: 1px solid #C8E6C9;
          margin-bottom: 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }
        .export-card h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #166534;
          margin: 0;
          font-size: 16px;
          font-weight: 700;
        }
        .export-buttons {
          display: flex;
          gap: 12px;
        }
        .export-btn {
          padding: 8px 20px;
          border-radius: 44px;
          cursor: pointer;
          font-weight: 500;
          border: none;
          font-size: 14px;
        }
        .export-btn.csv { background: #14B89D; color: white; }
        .export-btn.print { background: #E9F5DB; border: 1px solid #D4E8B3; color: #3D5C1A; }

        /* Report Table Card */
        .report-card {
          background: white;
          border-radius: 28px;
          padding: 24px;
          border: 1px solid #C8E6C9;
          overflow: hidden;
          margin-bottom: 28px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .card-header h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #166534;
          margin: 0;
          font-size: 18px;
          font-weight: 700;
        }
        .record-count {
          font-size: 13px;
          background: #E9F5DB;
          padding: 4px 12px;
          border-radius: 40px;
          color: #3D5C1A;
        }
        .table-container {
          overflow-x: auto;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        .data-table th {
          text-align: left;
          padding: 14px 16px;
          background: #F0FDF4;
          color: #0F5C4B;
          font-weight: 700;
          border-bottom: 2px solid #D4E8B3;
          cursor: pointer;
        }
        .data-table td {
          padding: 14px 16px;
          border-bottom: 1px solid #E6F7F3;
        }
        .source-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 40px;
          font-size: 12px;
          font-weight: 600;
        }
        .source-badge.web { background: #D6F4EE; color: #0F5C4B; }
        .source-badge.mobile { background: #E0F2FE; color: #0284C7; }
        .type-badge {
          padding: 4px 12px;
          border-radius: 40px;
          font-size: 11px;
          font-weight: 600;
        }
        .type-calc { background: #E8F5E9; color: #2E7D32; }
        .type-bill { background: #FCE4EC; color: #C2185B; }
        .type-web { background: #FFF3E0; color: #E65100; }
        .amount { font-weight: 800; color: #0F5C4B; }
        .flag-btn {
          background: #F97316;
          border: none;
          padding: 6px 14px;
          border-radius: 30px;
          color: white;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }
        .flag-btn:hover:not(:disabled) {
          background: #EA580C;
          transform: scale(1.02);
        }
        .flag-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        /* Flags table status badges */
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 40px;
          font-size: 12px;
          font-weight: 600;
          color: white;
        }
        .status-badge.pending { background: #F97316; }
        .status-badge.reviewed { background: #3B82F6; }
        .status-badge.resolved { background: #14B89D; }
        .emission-high { color: #DC2626; font-weight: 700; }
        .action-buttons {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        .btn-review, .btn-resolve, .btn-delete {
          padding: 4px 12px;
          border-radius: 40px;
          font-size: 12px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          color: white;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .btn-review { background: #3B82F6; }
        .btn-resolve { background: #14B89D; }
        .btn-delete { background: #DC2626; }
        .resolved-text { color: #14B89D; font-weight: 600; display: flex; align-items: center; gap: 4px; }
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #94A3B8;
        }
        .empty-icon { font-size: 64px; margin-bottom: 16px; }

        @media (max-width: 1024px) {
          .main-content { margin-left: 0; padding: 20px; }
          .summary-grid { grid-template-columns: repeat(2, 1fr); }
          .filter-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .summary-grid { grid-template-columns: 1fr; }
          .export-card { flex-direction: column; align-items: stretch; }
          .table-container { font-size: 12px; }
        }
        @media print {
          .main-content { margin-left: 0; padding: 0; }
          .header-actions, .filter-card, .export-card, .tab-nav, .flag-btn, .action-buttons { display: none; }
        }
      `}</style>
    </div>
  );
}