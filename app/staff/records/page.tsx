// app/staff/records/page.tsx – View‑only records for staff
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, getDocs, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { mobileDb, webCemmsDb } from '@/app/lib/combinedFirebase';
import StaffSidebar from '@/app/lib/StaffSidebar';
import { 
  Archive, RefreshCw, CheckCircle, AlertTriangle, X,
  Calendar, MapPin, Monitor, Smartphone, Search, Download,
  ChevronUp, ChevronDown, Filter, Package,
  Clock, FileText, Zap, Eye
} from 'lucide-react';

interface CEMMSRecord {
  id: string;
  docId: string;
  barangay: string;
  amount: number;
  source: 'Web App' | 'Mobile App';
  type: string;
  date: Date;
  collectionName: string;
}

interface Toast { id: string; type: 'success' | 'error' | 'info'; message: string; }

type SortDirection = 'asc' | 'desc';
type SortField = 'barangay' | 'amount' | 'type' | 'date';

const barangays = [
  'Abangan Norte', 'Abangan Sur', 'Ibayo', 'Lambakin', 'Lias', 'Loma de Gato',
  'Nagbalon', 'Patubig', 'Poblacion I', 'Poblacion II', 'Prenza I', 'Prenza II',
  'Santa Rosa I', 'Santa Rosa II', 'Saog', 'Tabing Ilog'
];

export default function StaffRecordsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const [webRecords, setWebRecords] = useState<CEMMSRecord[]>([]);
  const [mobileRecords, setMobileRecords] = useState<CEMMSRecord[]>([]);
  const [lastSync, setLastSync] = useState(new Date());

  // Filters
  const [globalBarangayFilter, setGlobalBarangayFilter] = useState('all');
  const [globalSourceFilter, setGlobalSourceFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Search
  const [webSearch, setWebSearch] = useState('');
  const [mobileSearch, setMobileSearch] = useState('');

  // Sorting
  const [webSortField, setWebSortField] = useState<SortField>('date');
  const [webSortDir, setWebSortDir] = useState<SortDirection>('desc');
  const [mobileSortField, setMobileSortField] = useState<SortField>('date');
  const [mobileSortDir, setMobileSortDir] = useState<SortDirection>('desc');

  const addToast = (type: Toast['type'], message: string) => {
    const id = `toast-${toastIdRef.current++}-${Date.now()}`;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const fetchAllData = async () => {
    try {
      const webSnap = await getDocs(query(collection(webCemmsDb, 'emissions'), orderBy('createdAt', 'desc'), limit(200)));
      const webList: CEMMSRecord[] = [];
      webSnap.forEach(doc => {
        const data = doc.data();
        const amount = Number(data.carbonAmount || data.amount || 0);
        if (amount > 0 && data.barangay) {
          webList.push({
            id: doc.id,
            docId: doc.id,
            barangay: data.barangay,
            amount,
            source: 'Web App',
            type: 'Web Input',
            date: data.createdAt?.toDate?.() || new Date(),
            collectionName: 'emissions'
          });
        }
      });

      const mobileSnap = await getDocs(query(collection(mobileDb, 'calculations'), orderBy('timestamp', 'desc'), limit(200)));
      const mobileList: CEMMSRecord[] = [];
      mobileSnap.forEach(doc => {
        const data = doc.data();
        const amount = Number(data.dailyCarbon || data.carbonAmount || 0);
        if (amount > 0 && data.barangay) {
          mobileList.push({
            id: doc.id,
            docId: doc.id,
            barangay: data.barangay,
            amount,
            source: 'Mobile App',
            type: 'App Input',
            date: data.timestamp?.toDate?.() || data.createdAt?.toDate?.() || new Date(),
            collectionName: 'calculations'
          });
        }
      });

      webList.sort((a,b) => b.date.getTime() - a.date.getTime());
      mobileList.sort((a,b) => b.date.getTime() - a.date.getTime());

      setWebRecords(webList);
      setMobileRecords(mobileList);
      setLastSync(new Date());
      addToast('success', `Synced: ${webList.length} web + ${mobileList.length} mobile records`);
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Sync failed: ' + err.message);
    }
  };

  useEffect(() => {
    const unsubWeb = onSnapshot(query(collection(webCemmsDb, 'emissions'), orderBy('createdAt', 'desc'), limit(200)), () => fetchAllData());
    const unsubMobile = onSnapshot(query(collection(mobileDb, 'calculations'), orderBy('timestamp', 'desc'), limit(200)), () => fetchAllData());
    return () => { unsubWeb(); unsubMobile(); };
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        setUser(firebaseUser);
        await fetchAllData();
        setLoading(false);
        return;
      }
      // Fallback: check localStorage for mock user
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('cemms_user');
        if (stored) {
          try {
            const mock = JSON.parse(stored);
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

    const unsubscribeAuth = auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);
      } else {
        // Only redirect if no localStorage mock user exists
        if (typeof window !== 'undefined' && !localStorage.getItem('cemms_user')) {
          router.push('/login');
        }
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  const filterByDate = (records: CEMMSRecord[]) => {
    if (!dateRange.start && !dateRange.end) return records;
    const start = dateRange.start ? new Date(dateRange.start) : null;
    const end = dateRange.end ? new Date(dateRange.end) : null;
    if (end) end.setHours(23,59,59);
    return records.filter(r => {
      const d = r.date;
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  };

  const applyGlobalFilters = (records: CEMMSRecord[]) => {
    let filtered = records;
    if (globalBarangayFilter !== 'all') {
      filtered = filtered.filter(r => r.barangay === globalBarangayFilter);
    }
    if (globalSourceFilter === 'web') {
      filtered = filtered.filter(r => r.source === 'Web App');
    } else if (globalSourceFilter === 'mobile') {
      filtered = filtered.filter(r => r.source === 'Mobile App');
    }
    return filtered;
  };

  const sortRecords = (records: CEMMSRecord[], field: SortField, dir: SortDirection) => {
    return [...records].sort((a,b) => {
      let aVal: any = a[field];
      let bVal: any = b[field];
      if (field === 'date') { aVal = a.date.getTime(); bVal = b.date.getTime(); }
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const filteredWeb = useMemo(() => {
    let filtered = filterByDate(webRecords);
    filtered = applyGlobalFilters(filtered);
    filtered = filtered.filter(r =>
      r.barangay.toLowerCase().includes(webSearch.toLowerCase()) ||
      r.type.toLowerCase().includes(webSearch.toLowerCase())
    );
    return sortRecords(filtered, webSortField, webSortDir);
  }, [webRecords, dateRange, globalBarangayFilter, globalSourceFilter, webSearch, webSortField, webSortDir]);

  const filteredMobile = useMemo(() => {
    let filtered = filterByDate(mobileRecords);
    filtered = applyGlobalFilters(filtered);
    filtered = filtered.filter(r =>
      r.barangay.toLowerCase().includes(mobileSearch.toLowerCase()) ||
      r.type.toLowerCase().includes(mobileSearch.toLowerCase())
    );
    return sortRecords(filtered, mobileSortField, mobileSortDir);
  }, [mobileRecords, dateRange, globalBarangayFilter, globalSourceFilter, mobileSearch, mobileSortField, mobileSortDir]);

  const applyDatePreset = (preset: typeof datePreset) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'today') {
      const today = now.toISOString().split('T')[0];
      setDateRange({ start: today, end: today });
    } else if (preset === 'week') {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
      setDateRange({ start: weekAgo.toISOString().split('T')[0], end: now.toISOString().split('T')[0] });
    } else if (preset === 'month') {
      const monthAgo = new Date(now); monthAgo.setMonth(now.getMonth() - 1);
      setDateRange({ start: monthAgo.toISOString().split('T')[0], end: now.toISOString().split('T')[0] });
    } else {
      setDateRange({ start: '', end: '' });
    }
  };

  const clearFilters = () => {
    setWebSearch('');
    setMobileSearch('');
    setGlobalBarangayFilter('all');
    setGlobalSourceFilter('all');
    setDateRange({ start: '', end: '' });
    setDatePreset('all');
    setWebSortField('date');
    setWebSortDir('desc');
    setMobileSortField('date');
    setMobileSortDir('desc');
  };

  const exportToCSV = () => {
    const allRecords = [...filteredWeb, ...filteredMobile];
    if (allRecords.length === 0) {
      addToast('info', 'No records to export');
      return;
    }
    const headers = ['Barangay', 'Amount (kg CO₂)', 'Source', 'Type', 'Date'];
    const rows = allRecords.map(r => [
      r.barangay,
      r.amount,
      r.source,
      r.type,
      r.date.toLocaleString()
    ]);
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cemms-records-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', `Exported ${allRecords.length} records to CSV`);
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const SortIcon = ({ field, current, dir }: { field: SortField; current: SortField; dir: SortDirection }) => {
    if (field !== current) return <ChevronDown size={14} className="opacity-40" />;
    return dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FDF9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={48} className="animate-spin" color="#14B89D" />
          <p style={{ marginTop: 20, fontSize: 16, color: '#0F5C4B' }}>Loading records...</p>
        </div>
      </div>
    );
  }

  const userName = user?.email?.split('@')[0] || 'Staff';

  return (
    <div style={{ display: 'flex', background: '#F8FDF9', minHeight: '100vh' }}>
      <StaffSidebar userName={userName} />

      <div className="main-content">
        {/* Toast Notifications */}
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast ${t.type}`}>
              {t.type === 'success' && <CheckCircle size={18} />}
              {t.type === 'error' && <AlertTriangle size={18} />}
              <span style={{ fontSize: 14 }}>{t.message}</span>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}><X size={16} /></button>
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="header-card">
          <div>
            <h1>Emission Records</h1>
            <p>View all emission records from Web and Mobile apps (read‑only).</p>
          </div>
          <div className="header-actions">
            <button className="icon-btn" onClick={fetchAllData}><RefreshCw size={16} /> Sync</button>
            <button className="icon-btn" onClick={exportToCSV}><Download size={16} /> Export CSV</button>
            <div className="staff-badge"><span className="live-dot"></span> STAFF</div>
            <div className="date-badge"><Calendar size={14} /> {new Date().toLocaleDateString()}</div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="modern-filter-card">
          <div className="filter-header">
            <Filter size={16} /> <span>Filter Records</span>
            <button className="clear-all-btn" onClick={clearFilters}>Clear all filters</button>
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
              <select value={globalBarangayFilter} onChange={e => setGlobalBarangayFilter(e.target.value)}>
                <option value="all">All Barangays</option>
                {barangays.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div className="filter-item">
              <label><Monitor size={14} /> Source</label>
              <div className="source-toggle">
                <button className={`source-btn ${globalSourceFilter === 'all' ? 'active' : ''}`} onClick={() => setGlobalSourceFilter('all')}>All</button>
                <button className={`source-btn ${globalSourceFilter === 'web' ? 'active' : ''}`} onClick={() => setGlobalSourceFilter('web')}>Web</button>
                <button className={`source-btn ${globalSourceFilter === 'mobile' ? 'active' : ''}`} onClick={() => setGlobalSourceFilter('mobile')}>Mobile</button>
              </div>
            </div>
          </div>
        </div>

        {/* Web Records Table */}
        <div className="data-table">
          <div className="table-header">
            <h3><Monitor size={18} /> Web App Emissions <span className="badge">{filteredWeb.length}</span></h3>
            <div className="table-controls">
              <div className="search-box"><Search size={14} /><input placeholder="Search barangay/type..." value={webSearch} onChange={e => setWebSearch(e.target.value)} /></div>
            </div>
          </div>
          <div className="table-scroll">
            {filteredWeb.length === 0 ? (
              <div className="empty-state"><Package size={48} />No web records match filters</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th onClick={() => { if(webSortField==='barangay') setWebSortDir(prev=>prev==='asc'?'desc':'asc'); else { setWebSortField('barangay'); setWebSortDir('asc'); } }}>
                      Barangay <SortIcon field="barangay" current={webSortField} dir={webSortDir} />
                    </th>
                    <th onClick={() => { if(webSortField==='amount') setWebSortDir(prev=>prev==='asc'?'desc':'asc'); else { setWebSortField('amount'); setWebSortDir('asc'); } }}>
                      Amount <SortIcon field="amount" current={webSortField} dir={webSortDir} />
                    </th>
                    <th onClick={() => { if(webSortField==='type') setWebSortDir(prev=>prev==='asc'?'desc':'asc'); else { setWebSortField('type'); setWebSortDir('asc'); } }}>
                      Type <SortIcon field="type" current={webSortField} dir={webSortDir} />
                    </th>
                    <th onClick={() => { if(webSortField==='date') setWebSortDir(prev=>prev==='asc'?'desc':'asc'); else { setWebSortField('date'); setWebSortDir('asc'); } }}>
                      Date <SortIcon field="date" current={webSortField} dir={webSortDir} />
                    </th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWeb.map(r => (
                    <tr key={r.id}>
                      <td><strong>{r.barangay}</strong></td>
                      <td className="amount">{r.amount.toLocaleString()} kg</td>
                      <td><span className="type-badge web">{r.type}</span></td>
                      <td>{r.date.toLocaleString()} </td>
                      <td className="actions-cell">
                        <span className="view-only"><Eye size={14} /> Read‑only</span>
                       </td>
                     </tr>
                  ))}
                </tbody>
               </table>
            )}
          </div>
        </div>

        {/* Mobile Records Table */}
        <div className="data-table">
          <div className="table-header">
            <h3><Smartphone size={18} /> Mobile App Emissions <span className="badge">{filteredMobile.length}</span></h3>
            <div className="table-controls">
              <div className="search-box"><Search size={14} /><input placeholder="Search barangay/type..." value={mobileSearch} onChange={e => setMobileSearch(e.target.value)} /></div>
            </div>
          </div>
          <div className="table-scroll">
            {filteredMobile.length === 0 ? (
              <div className="empty-state"><Package size={48} />No mobile records match filters</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th onClick={() => { if(mobileSortField==='barangay') setMobileSortDir(prev=>prev==='asc'?'desc':'asc'); else { setMobileSortField('barangay'); setMobileSortDir('asc'); } }}>
                      Barangay <SortIcon field="barangay" current={mobileSortField} dir={mobileSortDir} />
                    </th>
                    <th onClick={() => { if(mobileSortField==='amount') setMobileSortDir(prev=>prev==='asc'?'desc':'asc'); else { setMobileSortField('amount'); setMobileSortDir('asc'); } }}>
                      Amount <SortIcon field="amount" current={mobileSortField} dir={mobileSortDir} />
                    </th>
                    <th onClick={() => { if(mobileSortField==='type') setMobileSortDir(prev=>prev==='asc'?'desc':'asc'); else { setMobileSortField('type'); setMobileSortDir('asc'); } }}>
                      Type <SortIcon field="type" current={mobileSortField} dir={mobileSortDir} />
                    </th>
                    <th onClick={() => { if(mobileSortField==='date') setMobileSortDir(prev=>prev==='asc'?'desc':'asc'); else { setMobileSortField('date'); setMobileSortDir('asc'); } }}>
                      Date <SortIcon field="date" current={mobileSortField} dir={mobileSortDir} />
                    </th>
                    <th>Details</th>
                   </tr>
                </thead>
                <tbody>
                  {filteredMobile.map(r => (
                    <tr key={r.id}>
                      <td><strong>{r.barangay}</strong></td>
                      <td className="amount">{r.amount.toLocaleString()} kg</td>
                      <td><span className="type-badge mobile">{r.type}</span></td>
                      <td>{r.date.toLocaleString()}</td>
                      <td className="actions-cell">
                        <span className="view-only"><Eye size={14} /> Read‑only</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="footer-info">
          <span><CheckCircle size={12} /> Real‑time from mobile & web</span>
          <span><Zap size={12} /> Emission factor: 0.5 kg CO₂/kWh (system setting)</span>
          <span><RefreshCw size={12} /> Last sync: {lastSync.toLocaleTimeString()}</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }

        .main-content {
          flex: 1;
          margin-left: 280px;
          padding: 28px 36px;
          background: #F8FDF9;
          min-height: 100vh;
        }

        /* Toast */
        .toast-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 1200;
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
        }
        .toast.success { border-left-color: #14B89D; }
        .toast.error { border-left-color: #DC2626; }
        .toast button { background: none; border: none; cursor: pointer; margin-left: auto; }

        /* Header */
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
        .header-card h1 { color: white; margin: 0 0 8px; font-size: 32px; font-weight: 700; }
        .header-card p { color: #E6F7F3; margin: 0; font-size: 15px; }
        .header-actions { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
        .icon-btn {
          display: flex; align-items: center; gap: 8px;
          background: white; border: 1px solid #9FE5D5;
          padding: 8px 18px; border-radius: 44px; font-size: 14px;
          cursor: pointer; transition: all 0.2s;
          color: #0F5C4B; font-weight: 500;
        }
        .icon-btn:hover { background: #E6F7F3; transform: translateY(-1px); }
        .staff-badge {
          display: flex; align-items: center; gap: 8px;
          background: #FEF2F2; padding: 8px 18px; border-radius: 44px;
          font-size: 13px; font-weight: 700; color: #DC2626;
        }
        .live-dot { width: 8px; height: 8px; background: #DC2626; border-radius: 50%; animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5; transform:scale(1.2)} }
        .date-badge {
          display: flex; align-items: center; gap: 8px;
          background: white; padding: 8px 18px; border-radius: 44px;
          font-size: 13px; color: #0F5C4B; font-weight: 500;
          border: 1px solid #9FE5D5;
        }

        /* Filter Card */
        .modern-filter-card {
          background: #E6F7F3;
          border-radius: 28px;
          padding: 24px 28px;
          margin-bottom: 28px;
          border: 1px solid #9FE5D5;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
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
        .clear-all-btn {
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
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 24px;
        }
        .filter-item {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .filter-item label {
          font-size: 14px;
          font-weight: 600;
          color: #2C7A66;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .date-range-inputs {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .date-range-inputs input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid #9FE5D5;
          border-radius: 16px;
          font-size: 14px;
          background: white;
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
        .filter-item select {
          padding: 10px 14px;
          border: 1px solid #9FE5D5;
          border-radius: 16px;
          background: white;
          font-size: 14px;
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

        /* Tables */
        .data-table {
          background: white;
          border-radius: 28px;
          overflow: hidden;
          border: 1px solid #C8E6C9;
          margin-bottom: 32px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 28px;
          background: #E9F5DB;
          border-bottom: 1px solid #D4E8B3;
          flex-wrap: wrap;
          gap: 16px;
        }
        .table-header h3 {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #3D5C1A;
          margin: 0;
          font-size: 18px;
          font-weight: 700;
        }
        .badge {
          background: #D4E8B3;
          padding: 4px 12px;
          border-radius: 40px;
          font-size: 13px;
          margin-left: 10px;
          color: #3D5C1A;
          font-weight: 700;
        }
        .table-controls {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
        }
        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          border: 1px solid #9FE5D5;
          border-radius: 44px;
          padding: 6px 16px;
        }
        .search-box input {
          border: none;
          outline: none;
          font-size: 14px;
          width: 180px;
        }
        .table-scroll {
          max-height: 520px;
          overflow-y: auto;
          overflow-x: auto;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        th, td {
          padding: 14px 18px;
          text-align: left;
          border-bottom: 1px solid #E6F7F3;
        }
        th {
          background: #F0FDF4;
          color: #0F5C4B;
          font-weight: 700;
          cursor: pointer;
          position: sticky;
          top: 0;
          z-index: 10;
          font-size: 14px;
        }
        th:hover { background: #DCFCE7; }
        .amount { font-weight: 800; color: #0F5C4B; font-size: 15px; }
        .type-badge {
          padding: 4px 12px;
          border-radius: 40px;
          font-size: 12px;
          font-weight: 700;
          display: inline-block;
        }
        .type-badge.web { background: #D6F4EE; color: #0F5C4B; }
        .type-badge.mobile { background: #E0F2FE; color: #0284C7; }
        .actions-cell {
          display: flex;
          gap: 10px;
        }
        .view-only {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: #F3F4F6;
          padding: 5px 12px;
          border-radius: 40px;
          font-size: 11px;
          color: #6B7280;
          font-weight: 500;
        }
        .empty-state {
          text-align: center;
          padding: 80px;
          color: #94A3B8;
          font-size: 15px;
        }

        .footer-info {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          background: white;
          padding: 14px 24px;
          border-radius: 24px;
          border: 1px solid #C8E6C9;
          font-size: 13px;
          color: #4B5563;
          flex-wrap: wrap;
        }

        @media (max-width: 1024px) {
          .main-content { margin-left: 0; padding: 20px; }
        }
        @media (max-width: 768px) {
          .filter-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}