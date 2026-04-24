// app/admin/page.tsx – Teal Green Theme, No Tables
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth, mobileDb, webCemmsDb } from '@/app/lib/combinedFirebase';
import { signOut } from 'firebase/auth';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import AdminSidebar from '../lib/AdminSidebar';
import {
  Leaf, Home, MapPin, AlertTriangle, Calendar,
  TrendingUp, FileText, Map, BarChart3, Recycle, Zap, CheckCircle, Clock,
  RefreshCw, Maximize2, Minimize2, Search, ChevronDown, ChevronUp,
  Monitor, Smartphone, X, Download, PieChart, Filter, LineChart
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  ArcElement, PointElement, LineElement, Filler
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  ArcElement, PointElement, LineElement, Filler
);

const barangays = [
  'Abangan Norte', 'Abangan Sur', 'Ibayo', 'Lambakin', 'Lias', 'Loma de Gato',
  'Nagbalon', 'Patubig', 'Poblacion I', 'Poblacion II', 'Prenza I', 'Prenza II',
  'Santa Rosa I', 'Santa Rosa II', 'Saog', 'Tabing Ilog'
];

const shortLabels = barangays.map(b => {
  if (b === 'Poblacion I') return 'Pob.I';
  if (b === 'Poblacion II') return 'Pob.II';
  if (b === 'Santa Rosa I') return 'S.Rosa I';
  if (b === 'Santa Rosa II') return 'S.Rosa II';
  if (b === 'Abangan Norte') return 'Abg.N';
  if (b === 'Abangan Sur') return 'Abg.S';
  if (b === 'Loma de Gato') return 'Loma';
  return b;
});

interface CEMMSRecord {
  id: string;
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

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setFullscreen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const [webRecords, setWebRecords] = useState<CEMMSRecord[]>([]);
  const [mobileRecords, setMobileRecords] = useState<CEMMSRecord[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [lastSync, setLastSync] = useState(new Date());

  // Filters (still used for stats and charts, but tables removed)
  const [globalBarangayFilter, setGlobalBarangayFilter] = useState('all');
  const [globalSourceFilter, setGlobalSourceFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'week' | 'month'>('all');

  const [totalEmissions, setTotalEmissions] = useState(0);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [activeBarangays, setActiveBarangays] = useState(0);
  const [highRiskCount, setHighRiskCount] = useState(0);
  const [previousTotalEmissions, setPreviousTotalEmissions] = useState(0);
  const [emissionsTrend, setEmissionsTrend] = useState(0);
  const [weeklyData, setWeeklyData] = useState<{ week: string; total: number }[]>([]);

  const addToast = (type: Toast['type'], message: string) => {
    const id = `toast-${toastIdRef.current++}-${Date.now()}`;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const fetchAllData = async () => {
    try {
      const webSnap = await getDocs(collection(webCemmsDb, 'emissions'));
      const webList: CEMMSRecord[] = [];
      webSnap.forEach(doc => {
        const data = doc.data();
        const amount = Number(data.carbonAmount || data.amount || 0);
        if (amount > 0 && data.barangay) {
          webList.push({
            id: doc.id,
            barangay: data.barangay,
            amount,
            source: 'Web App',
            type: 'Web Input',
            date: data.createdAt?.toDate?.() || new Date(),
            collectionName: 'emissions'
          });
        }
      });

      const mobileSnap = await getDocs(collection(mobileDb, 'calculations'));
      const mobileList: CEMMSRecord[] = [];
      mobileSnap.forEach(doc => {
        const data = doc.data();
        const amount = Number(data.dailyCarbon || data.carbonAmount || 0);
        if (amount > 0 && data.barangay) {
          mobileList.push({
            id: doc.id,
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

      const all = [...webList.map(r => ({ ...r, typeLabel: 'Web Input' })), 
                   ...mobileList.map(r => ({ ...r, typeLabel: 'App Input' }))];
      all.sort((a,b) => b.date.getTime() - a.date.getTime());
      setRecentActivities(all.slice(0, 10));

      const total = [...webList, ...mobileList].reduce((sum, r) => sum + r.amount, 0);
      const prevTotal = totalEmissions;
      setTotalEmissions(Math.round(total));
      setTotalSubmissions(webList.length + mobileList.length);
      if (prevTotal > 0) setEmissionsTrend(((total - prevTotal) / prevTotal) * 100);
      else setEmissionsTrend(0);

      const barangayEmissionMap: Record<string, number> = {};
      barangays.forEach(b => barangayEmissionMap[b] = 0);
      [...webList, ...mobileList].forEach(r => {
        if (barangayEmissionMap[r.barangay] !== undefined)
          barangayEmissionMap[r.barangay] += r.amount;
      });
      const active = Object.values(barangayEmissionMap).filter(v => v > 0).length;
      setActiveBarangays(active);
      const high = Object.values(barangayEmissionMap).filter(v => v >= 1000).length;
      setHighRiskCount(high);

      // Weekly data for trend
      const now = new Date();
      const weeks: { label: string; start: Date; end: Date }[] = [];
      for (let i = 5; i >= 0; i--) {
        const end = new Date(now);
        end.setDate(now.getDate() - (i * 7));
        const start = new Date(end);
        start.setDate(end.getDate() - 6);
        weeks.push({
          label: `Week ${6 - i} (${start.toLocaleDateString()})`,
          start,
          end
        });
      }
      const weeklyTotals = weeks.map(week => {
        const total = [...webList, ...mobileList].reduce((sum, r) => {
          if (r.date >= week.start && r.date <= week.end) return sum + r.amount;
          return sum;
        }, 0);
        return { week: week.label, total: Math.round(total) };
      });
      setWeeklyData(weeklyTotals);

      setLastSync(new Date());
      addToast('success', `Synced: ${webList.length} web + ${mobileList.length} mobile records`);
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Sync failed: ' + err.message);
    }
  };

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);
        await fetchAllData();
      } else {
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
            } catch {}
          }
        }
        router.push('/login');
      }
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    const unsubWeb = onSnapshot(collection(webCemmsDb, 'emissions'), () => fetchAllData());
    const unsubMobile = onSnapshot(collection(mobileDb, 'calculations'), () => fetchAllData());
    return () => { unsubWeb(); unsubMobile(); };
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    // Clear localStorage mock user
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cemms_user');
    }
    router.push('/login');
  };

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
    setGlobalBarangayFilter('all');
    setGlobalSourceFilter('all');
    setDateRange({ start: '', end: '' });
    setDatePreset('all');
  };

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

  const combinedFiltered = useMemo(() => {
    let combined = [...webRecords, ...mobileRecords];
    combined = filterByDate(combined);
    combined = applyGlobalFilters(combined);
    return combined;
  }, [webRecords, mobileRecords, dateRange, globalBarangayFilter, globalSourceFilter]);

  const emissionsByBarangay = barangays.map(b =>
    combinedFiltered.filter(r => r.barangay === b).reduce((sum, r) => sum + r.amount, 0)
  );

  const barChartData = {
    labels: shortLabels,
    datasets: [{
      label: 'CO₂ Emissions (kg)',
      data: emissionsByBarangay,
      backgroundColor: (ctx: any) => {
        const values = ctx.chart.data.datasets[0].data;
        return values.map((v: number) => {
          if (v > 1000) return '#EF4444';
          if (v > 500) return '#F59E0B';
          return '#14B89D';
        });
      },
      borderRadius: 10,
      barPercentage: 0.65,
      categoryPercentage: 0.8,
      borderWidth: 0,
    }]
  };
  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: 'top' as const, 
        labels: { font: { size: 13, weight: 'bold' as const }, usePointStyle: true, boxWidth: 10, padding: 15 }
      },
      tooltip: { 
        backgroundColor: '#1F2937',
        titleColor: '#F9FAFB',
        bodyColor: '#D1D5DB',
        padding: 10,
        cornerRadius: 8,
        bodyFont: { size: 13 },
        titleFont: { size: 14 }
      }
    },
    scales: {
      x: { 
        ticks: { maxRotation: 35, autoSkip: true, font: { size: 11, weight: 500 as const } }, 
        grid: { display: false },
        title: { display: true, text: 'Barangay', font: { size: 12, weight: 'bold' as const } }
      },
      y: { 
        title: { display: true, text: 'CO₂ Emissions (kg)', font: { size: 12, weight: 'bold' as const } }, 
        beginAtZero: true,
        grid: { color: '#E5E7EB', drawBorder: true },
        ticks: { callback: (val: string | number) => Number(val).toLocaleString(), font: { size: 11 } }
      }
    }
  };

  const lineChartData = {
    labels: weeklyData.map(d => d.week.split(' ')[0] + ' ' + d.week.split(' ')[2]),
    datasets: [{
      label: 'Weekly CO₂ Emissions (kg)',
      data: weeklyData.map(d => d.total),
      borderColor: '#14B89D',
      backgroundColor: 'rgba(20, 184, 157, 0.1)',
      borderWidth: 3,
      tension: 0.3,
      fill: true,
      pointBackgroundColor: '#0F5C4B',
      pointBorderColor: '#E6F7F3',
      pointRadius: 5,
      pointHoverRadius: 7,
    }]
  };
  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: 'top' as const, 
        labels: { font: { size: 13, weight: 'bold' as const }, usePointStyle: true, boxWidth: 10, padding: 15 }
      },
      tooltip: {
        backgroundColor: '#1F2937',
        titleFont: { size: 14 },
        bodyFont: { size: 13 }
      }
    },
    scales: {
      x: { 
        title: { display: true, text: 'Week', font: { size: 12, weight: 'bold' as const } },
        ticks: { font: { size: 11 } }
      },
      y: { 
        title: { display: true, text: 'CO₂ Emissions (kg)', font: { size: 12, weight: 'bold' as const } },
        beginAtZero: true,
        ticks: { callback: (val: string | number) => Number(val).toLocaleString(), font: { size: 11 } },
        grid: { color: '#E5E7EB' }
      }
    }
  };

  const exportToCSV = () => {
    // Export all records without filtering tables
    const allRecords = [...webRecords, ...mobileRecords];
    const headers = ['Barangay', 'Amount (kg)', 'Source', 'Type', 'Date'];
    const rows = allRecords.map(r => [r.barangay, r.amount, r.source, r.type, r.date.toLocaleDateString()]);
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cemms-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Exported to CSV');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FDF9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={48} className="animate-spin" color="#14B89D" />
          <p style={{ marginTop: 20, fontSize: 16, color: '#0F5C4B' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const userName = user?.email?.split('@')[0] || 'Admin';

  return (
    <div style={{ display: 'flex', background: '#F8FDF9', minHeight: '100vh' }}>
      <AdminSidebar userName={userName} onLogout={handleLogout} />
      
      <div className={`main-content ${isFullscreen ? 'fullscreen' : ''}`}>
        {/* Toast notifications */}
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

        {/* Header Card */}
        <div className="header-card">
          <div>
            <h1>CEMMS Dashboard</h1>
            <p>Welcome back, {userName}! Real-time carbon emission monitoring.</p>
          </div>
          <div className="header-actions">
            <button className="icon-btn" onClick={() => setFullscreen(!isFullscreen)}>
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button className="icon-btn" onClick={fetchAllData}><RefreshCw size={16} /> Sync</button>
            <button className="icon-btn" onClick={exportToCSV}><Download size={16} /> Export</button>
            <div className="live-badge"><span className="live-dot"></span> LIVE</div>
            <div className="date-badge"><Calendar size={14} /> {new Date().toLocaleDateString()}</div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card pastel-yellowgreen">
            <div className="stat-icon"><Leaf size={24} /></div>
            <div className="stat-content">
              <div className="stat-value">{totalEmissions.toLocaleString()} kg</div>
              <div className="stat-label">Total CO₂</div>
              {emissionsTrend !== 0 && (
                <div className={`stat-trend ${emissionsTrend > 0 ? 'trend-up' : 'trend-down'}`}>
                  {emissionsTrend > 0 ? '↑' : '↓'} {Math.abs(emissionsTrend).toFixed(1)}% from previous
                </div>
              )}
            </div>
          </div>
          <div className="stat-card pastel-teal">
            <div className="stat-icon"><Home size={24} /></div>
            <div className="stat-content">
              <div className="stat-value">{totalSubmissions}</div>
              <div className="stat-label">Total Submissions</div>
            </div>
          </div>
          <div className="stat-card pastel-mint">
            <div className="stat-icon"><MapPin size={24} /></div>
            <div className="stat-content">
              <div className="stat-value">{activeBarangays}/{barangays.length}</div>
              <div className="stat-label">Active Barangays</div>
            </div>
          </div>
          <div className="stat-card pastel-coral warning">
            <div className="stat-icon"><AlertTriangle size={24} /></div>
            <div className="stat-content">
              <div className="stat-value">{highRiskCount}</div>
              <div className="stat-label">High Risk Areas</div>
              <div className="stat-trend">≥1000 kg CO₂</div>
            </div>
          </div>
        </div>

        {/* Filter Card */}
        <div className="modern-filter-card light-teal">
          <div className="filter-header">
            <Filter size={16} /> <span>Advanced Filters</span>
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

        {/* Charts Row */}
        <div className="charts-row">
          <div className="chart-card pastel-yellowgreen">
            <h3><BarChart3 size={20} /> CO₂ Emissions per Barangay</h3>
            <div className="chart-container"><Bar data={barChartData} options={barOptions} /></div>
          </div>
          <div className="chart-card pastel-yellowgreen">
            <h3><TrendingUp size={20} /> Weekly Emissions Trend (Last 6 Weeks)</h3>
            <div className="chart-container"><Line data={lineChartData} options={lineOptions} /></div>
          </div>
        </div>

        {/* Recent Activity & Quick Actions */}
        <div className="bottom-grid">
          <div className="activity-card pastel-yellowgreen">
            <h3><Clock size={18} /> Recent Activity</h3>
            <div className="activity-list">
              {recentActivities.slice(0,5).map((act,i) => (
                <div key={i} className="activity-item">
                  <div className="activity-icon">{act.source === 'Web App' ? <Monitor size={14} /> : <Smartphone size={14} />}</div>
                  <div><strong>{act.barangay}</strong> <span className="activity-type">{act.type}</span><br/><span className="activity-meta">{act.amount.toLocaleString()} kg • {act.date.toLocaleTimeString()}</span></div>
                </div>
              ))}
            </div>
          </div>
          <div className="actions-card pastel-yellowgreen">
            <h3><Zap size={18} /> Quick Actions</h3>
            <div className="actions-grid">
              <button className="action-btn" onClick={()=>router.push('/admin/reports')}><FileText size={16} /><div><strong>Generate Report</strong><p>Export data</p></div></button>
              <button className="action-btn" onClick={()=>router.push('/admin/live-map')}><Map size={16} /><div><strong>View Map</strong><p>Hotspots</p></div></button>
              <button className="action-btn" onClick={()=>router.push('/admin/live-stats')}><BarChart3 size={16} /><div><strong>Analytics</strong><p>Detailed stats</p></div></button>
            
            </div>
          </div>
        </div>

        <div className="footer-info">
          <span><CheckCircle size={12} /> Real-time from mobile & web</span>
          <span><Zap size={12} /> Emission factor: 0.5 kg CO₂/kWh</span>
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
          transition: all 0.3s;
        }
        .main-content.fullscreen {
          margin-left: 0;
          padding: 20px;
        }
        
        /* Toast */
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
        }
        .toast.success { border-left-color: #14B89D; }
        .toast.error { border-left-color: #DC2626; }
        .toast button { background: none; border: none; cursor: pointer; margin-left: auto; }
        
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
        .live-badge {
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
        
        /* Stats Cards */
        .stats-grid {
          display: grid; grid-template-columns: repeat(4,1fr); gap: 24px; margin-bottom: 28px;
        }
        .stat-card {
          padding: 14px 18px; border-radius: 20px;
          transition: all 0.2s;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          position: relative;
          padding-top: 48px;
        }
        .stat-card:hover { transform: translateY(-3px); box-shadow: 0 12px 24px rgba(0,0,0,0.08); }
        .stat-card .stat-value { font-size: 24px; font-weight: 800; margin-bottom: 2px; }
        .stat-card .stat-label { font-size: 12px; font-weight: 500; }
        .stat-card .stat-content { text-align: center; }
        .stat-card .stat-icon {
          position: absolute;
          top: 16px;
          left: 16px;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .stat-card.warning { border-left: 5px solid #F97316; }
        .stat-trend { font-size: 12px; margin-top: 6px; font-weight: 500; text-align: center; }
        .trend-up { color: #DC2626; }
        .trend-down { color: #14B89D; }
        
        .stat-card.pastel-yellowgreen { background: #E9F5DB; border: 1px solid #D4E8B3; }
        .stat-card.pastel-yellowgreen .stat-value { color: #3D5C1A; }
        .stat-card.pastel-yellowgreen .stat-label { color: #5A7C2E; }
        
        .stat-card.pastel-teal { background: #D6F4EE; border: 1px solid #9FE5D5; }
        .stat-card.pastel-teal .stat-value { color: #0F5C4B; }
        .stat-card.pastel-teal .stat-label { color: #3B7A6A; }
        
        .stat-card.pastel-mint { background: #DCFCE7; border: 1px solid #BBF7D0; }
        .stat-card.pastel-mint .stat-value { color: #166534; }
        .stat-card.pastel-mint .stat-label { color: #4B5563; }
        
        .stat-card.pastel-coral { background: #FFEDD5; border: 1px solid #FED7AA; }
        .stat-card.pastel-coral .stat-value { color: #9A3412; }
        .stat-card.pastel-coral .stat-label { color: #C2410C; }
        
        /* Filter Card */
        .modern-filter-card.light-teal {
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
        
        /* Charts Row */
        .charts-row {
          display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-bottom: 28px;
        }
        .chart-card {
          border-radius: 28px; padding: 24px 28px;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .chart-card:hover { transform: translateY(-3px); box-shadow: 0 12px 24px rgba(0,0,0,0.08); }
        .chart-card h3 { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; font-size: 18px; font-weight: 700; }
        .chart-container { height: 300px; position: relative; }
        
        .chart-card.pastel-yellowgreen { background: #E9F5DB; border: 1px solid #D4E8B3; }
        .chart-card.pastel-yellowgreen h3 { color: #3D5C1A; }
        
        /* Bottom Grid */
        .bottom-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-bottom: 28px; }
        .activity-card, .actions-card {
          border-radius: 28px; padding: 24px;
          transition: all 0.2s;
        }
        .activity-card.pastel-yellowgreen, .actions-card.pastel-yellowgreen {
          background: #E9F5DB; border: 1px solid #D4E8B3;
        }
        .activity-card h3, .actions-card h3 { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; font-size: 18px; font-weight: 700; }
        .activity-card h3 { color: #3D5C1A; }
        .actions-card h3 { color: #3D5C1A; }
        .activity-list { display: flex; flex-direction: column; gap: 14px; max-height: 280px; overflow-y: auto; }
        .activity-item { display: flex; align-items: center; gap: 14px; padding: 10px 0; border-bottom: 1px solid #D4E8B3; font-size: 14px; }
        .activity-icon { width: 36px; height: 36px; background: white; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: #3D5C1A; }
        .activity-type { font-size: 10px; background: white; padding: 3px 8px; border-radius: 24px; margin-left: 8px; color: #3D5C1A; font-weight: 600; }
        .activity-meta { font-size: 11px; color: #5A7C2E; }
        .actions-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 14px; }
        .action-btn {
          display: flex; align-items: center; gap: 12px; padding: 12px;
          background: white; border: 1px solid #D4E8B3; border-radius: 20px;
          cursor: pointer; transition: all 0.2s; text-align: left;
          color: #1F2937;
        }
        .action-btn:hover { background: #E6F7F3; transform: translateY(-2px); border-color: #14B89D; }
        .action-btn strong { display: block; font-size: 14px; color: #3D5C1A; }
        .action-btn p { margin: 0; font-size: 11px; color: #6B7280; }
        .action-btn.combined { background: linear-gradient(135deg, #DCFCE7, #E9F5DB); border-color: #BBF7D0; }
        
        .footer-info {
          display: flex; justify-content: space-between; gap: 20px;
          background: white; padding: 14px 24px; border-radius: 24px;
          border: 1px solid #C8E6C9; font-size: 13px; color: #4B5563;
          flex-wrap: wrap;
        }
        
        @media (max-width: 1024px) {
          .main-content { margin-left: 0; padding: 20px; }
          .stats-grid { grid-template-columns: repeat(2,1fr); }
          .charts-row { grid-template-columns: 1fr; }
          .bottom-grid { grid-template-columns: 1fr; }
          .filter-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .stats-grid { grid-template-columns: 1fr; }
          .actions-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}