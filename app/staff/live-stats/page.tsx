'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import StaffSidebar from '@/app/lib/StaffSidebar';
import {
  Leaf, Home, BarChart3, AlertTriangle, CheckCircle, Award, Lightbulb,
  PieChart, TrendingUp, Zap, Sun, Calendar, RefreshCw, Download, X, Filter,
  Eye, Clock, Trophy, Users, Activity, Target, Bell, FileText, Send
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  ArcElement, PointElement, LineElement, Filler
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  ArcElement, PointElement, LineElement, Filler
);

// 16 barangays of Marilao
const barangays = [
  'Abangan Norte', 'Abangan Sur', 'Ibayo', 'Lambakin', 'Lias', 'Loma de Gato',
  'Nagbalon', 'Patubig', 'Poblacion I', 'Poblacion II', 'Prenza I', 'Prenza II',
  'Santa Rosa I', 'Santa Rosa II', 'Saog', 'Tabing Ilog'
];

// Normalize barangay name (consistent with other pages)
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

// Helper: get emission level text
const getEmissionLevel = (emission: number): string => {
  if (emission === 0) return 'No Data';
  if (emission >= 2000) return 'Critical';
  if (emission >= 1000) return 'Very High';
  if (emission >= 700) return 'High';
  if (emission >= 500) return 'Medium';
  if (emission >= 300) return 'Low';
  return 'Very Low';
};

// Gradient color: teal (low) → yellow-green (high)
const getGradientColor = (value: number, max: number): string => {
  if (max === 0) return '#14B89D';
  const ratio = value / max;
  const start = { r: 20, g: 184, b: 157 }; // #14B89D
  const end = { r: 212, g: 232, b: 179 };   // #D4E8B3
  const r = Math.round(start.r + (end.r - start.r) * ratio);
  const g = Math.round(start.g + (end.g - start.g) * ratio);
  const b = Math.round(start.b + (end.b - start.b) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
};

interface Toast { id: string; type: 'success' | 'error' | 'info'; message: string; }
interface Alert { id: string; barangay: string; emission: number; level: string; timestamp: Date; status: 'unread' | 'read'; }
interface Target { barangay: string; targetEmission: number; currentEmission: number; progress: number; }
interface BarangayDetail {
  name: string; emission: number; level: string; color: string; rank: number;
  totalRecords: number; averagePerRecord: number; householdCount: number;
  sources: { name: string; amount: number; percentage: number }[];
  comparison: { vsAverage: number; vsHighest: number; vsLowest: number };
}

export default function StaffLiveStats() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const [barangaysData, setBarangaysData] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedBarangayDetail, setSelectedBarangayDetail] = useState<BarangayDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'targets' | 'alerts'>('overview');

  const addToast = (type: Toast['type'], message: string) => {
    const id = `toast-${toastIdRef.current++}-${Date.now()}`;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  // Fetch emission data from all sources (same as admin)
  const fetchData = async () => {
    try {
      const emissionsMap: Record<string, number> = {};
      const recordsCount: Record<string, number> = {};
      barangays.forEach(b => { emissionsMap[b] = 0; recordsCount[b] = 0; });

      // 1. Calculator submissions
      const calcSnap = await getDocs(collection(mobileDb, 'calculations'));
      calcSnap.forEach(doc => {
        const data = doc.data();
        let barangay = normalizeBarangayName(data.barangay || '');
        const amount = Number(data.dailyCarbon || data.carbonAmount || 0);
        if (barangay && emissionsMap[barangay] !== undefined && amount > 0) {
          emissionsMap[barangay] += amount;
          recordsCount[barangay]++;
        }
      });

      // 2. Bill scan submissions
      const billsSnap = await getDocs(collection(mobileDb, 'bills'));
      billsSnap.forEach(doc => {
        const data = doc.data();
        let barangay = normalizeBarangayName(data.barangay || '');
        const amount = Number(data.carbonEmission || data.totalCarbon || 0);
        if (barangay && emissionsMap[barangay] !== undefined && amount > 0) {
          emissionsMap[barangay] += amount;
          recordsCount[barangay]++;
        }
      });

      // 3. Web submissions (emissions collection)
      const webSnap = await getDocs(collection(webCemmsDb, 'emissions'));
      webSnap.forEach(doc => {
        const data = doc.data();
        let barangay = normalizeBarangayName(data.barangay || '');
        const amount = Number(data.carbonAmount || data.amount || 0);
        if (barangay && emissionsMap[barangay] !== undefined && amount > 0) {
          emissionsMap[barangay] += amount;
          recordsCount[barangay]++;
        }
      });

      const stats = barangays.map(name => ({
        name,
        emission: Math.round(emissionsMap[name]),
        level: getEmissionLevel(emissionsMap[name]),
        color: '#14B89D', // placeholder
        records: recordsCount[name],
        households: recordsCount[name] // treat each submission as one household for simplicity
      }));
      stats.sort((a, b) => b.emission - a.emission);
      const maxEmission = stats.length ? stats[0].emission : 1;
      stats.forEach(s => { s.color = getGradientColor(s.emission, maxEmission); });
      setBarangaysData(stats);

      // Generate alerts for high emissions
      const newAlerts: Alert[] = [];
      stats.forEach((b, idx) => {
        if (b.emission >= 700) {
          newAlerts.push({
            id: `${Date.now()}-${idx}`,
            barangay: b.name,
            emission: b.emission,
            level: b.level,
            timestamp: new Date(),
            status: 'unread'
          });
        }
      });
      setAlerts(newAlerts.slice(0, 5));

      // Load saved targets from localStorage (read-only for staff)
      const savedTargets = localStorage.getItem('emissionTargets');
      if (savedTargets) {
        const parsed = JSON.parse(savedTargets);
        const withProgress = parsed.map((t: any) => ({
          ...t,
          currentEmission: emissionsMap[t.barangay] || 0,
          progress: t.targetEmission > 0 ? Math.min(100, Math.round(((emissionsMap[t.barangay] || 0) / t.targetEmission) * 100)) : 0
        }));
        setTargets(withProgress);
      }

      addToast('success', 'Data synced from web + mobile');
    } catch (err: any) {
      addToast('error', `Sync failed: ${err.message}`);
    }
  };

  // Real-time listeners
  useEffect(() => {
    fetchData();
    const unsubCalc = onSnapshot(collection(db, 'calculations'), () => fetchData());
    const unsubBills = onSnapshot(collection(db, 'bills'), () => fetchData());
    const unsubEmissions = onSnapshot(collection(db, 'emissions'), () => fetchData());
    return () => {
      unsubCalc();
      unsubBills();
      unsubEmissions();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);
      } else {
        // Fallback: check localStorage for mock user
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('cemms_user');
          if (stored) {
            try {
              const mock = JSON.parse(stored);
              setUser({ uid: mock.uid, email: mock.email, displayName: mock.role });
              setLoading(false);
              return;
            } catch {}
          }
        }
        router.push('/login');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogout = () => signOut(auth).then(() => router.push('/login'));

  const dismissAlert = (id: string) => setAlerts(alerts.filter(a => a.id !== id));

  const showBarangayDetails = (barangay: any, index: number) => {
    const total = barangaysData.reduce((s, b) => s + b.emission, 0);
    const avg = total / barangaysData.length;
    const highest = barangaysData[0]?.emission || 0;
    const lowestWithData = barangaysData.filter(b => b.emission > 0).pop();
    const lowest = lowestWithData?.emission || 0;
    const sources = [
      { name: 'Electricity Usage', amount: Math.round(barangay.emission * 0.65), percentage: 65 },
      { name: 'Cooking Fuel', amount: Math.round(barangay.emission * 0.20), percentage: 20 },
      { name: 'Appliances', amount: Math.round(barangay.emission * 0.10), percentage: 10 },
      { name: 'Lighting', amount: Math.round(barangay.emission * 0.05), percentage: 5 }
    ];
    const detail: BarangayDetail = {
      name: barangay.name, emission: barangay.emission, level: barangay.level, color: barangay.color, rank: index + 1,
      totalRecords: barangay.records || 0, averagePerRecord: barangay.records ? Math.round(barangay.emission / barangay.records) : 0,
      householdCount: barangay.households || 0, sources,
      comparison: { vsAverage: avg ? Math.round((barangay.emission / avg) * 100) : 0, vsHighest: highest ? Math.round((barangay.emission / highest) * 100) : 0, vsLowest: lowest ? Math.round((barangay.emission / lowest) * 100) : 0 }
    };
    setSelectedBarangayDetail(detail);
    setShowDetailsModal(true);
  };

  const totalEmission = barangaysData.reduce((s, b) => s + b.emission, 0);
  const averageEmission = Math.round(totalEmission / barangays.length);
  const criticalCount = barangaysData.filter(b => b.emission >= 2000).length;
  const veryHighCount = barangaysData.filter(b => b.emission >= 1000 && b.emission < 2000).length;
  const highCount = barangaysData.filter(b => b.emission >= 700 && b.emission < 1000).length;
  const lowCount = barangaysData.filter(b => b.emission > 0 && b.emission < 300).length;
  const veryLowCount = barangaysData.filter(b => b.emission >= 300 && b.emission < 700).length;
  const noDataCount = barangaysData.filter(b => b.emission === 0).length;
  const highEmissionAreas = criticalCount + veryHighCount + highCount;

  // Distribution data for horizontal bars
  const distributionLevels = [
    { label: 'Critical', count: criticalCount, color: '#EF4444' },
    { label: 'Very High', count: veryHighCount, color: '#F97316' },
    { label: 'High', count: highCount, color: '#F59E0B' },
    { label: 'Medium', count: barangaysData.filter(b => b.emission >= 500 && b.emission < 700).length, color: '#EAB308' },
    { label: 'Low', count: barangaysData.filter(b => b.emission >= 300 && b.emission < 500).length, color: '#84CC16' },
    { label: 'Very Low', count: veryLowCount, color: '#D4E8B3' },
    { label: 'No Data', count: noDataCount, color: '#94A3B8' }
  ].filter(level => level.count > 0 || level.label === 'No Data');

  // Bar chart data
  const barChartData = {
    labels: barangaysData.map(b => b.name),
    datasets: [{
      label: 'CO₂ Emission (kg)',
      data: barangaysData.map(b => b.emission),
      backgroundColor: barangaysData.map(b => b.color),
      borderRadius: 10,
      barPercentage: 0.7,
      categoryPercentage: 0.8,
    }]
  };
  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: any) => `${ctx.raw.toLocaleString()} kg CO₂`, title: (ctx: any) => `${ctx[0].label}` } }
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: 'CO₂ Emission (kg)', color: '#64748B' }, grid: { color: '#E5E7EB' } },
      x: { ticks: { rotation: 45, maxRotation: 45, font: { size: 11 } }, grid: { display: false } }
    },
  };

  // Donut chart for top 5
  const top5 = barangaysData.filter(b => b.emission > 0).slice(0, 5);
  const otherTotal = barangaysData.filter(b => b.emission > 0).slice(5).reduce((s, b) => s + b.emission, 0);
  const donutLabels = [...top5.map(b => b.name)];
  const donutData = [...top5.map(b => b.emission)];
  const donutColors = [...top5.map(b => b.color)];
  if (otherTotal > 0) { donutLabels.push('Others'); donutData.push(otherTotal); donutColors.push('#94A3B8'); }
  const donutChartData = { labels: donutLabels, datasets: [{ data: donutData, backgroundColor: donutColors, borderWidth: 0 }] };
  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: { position: 'bottom' as const, labels: { font: { size: 12 }, usePointStyle: true, boxWidth: 10 } },
      tooltip: { callbacks: { label: (ctx: any) => `${ctx.label}: ${ctx.raw.toLocaleString()} kg (${Math.round((ctx.raw / totalEmission) * 100)}%)` } }
    },
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FDF9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <RefreshCw size={48} className="animate-spin" color="#14B89D" />
      </div>
    );
  }

  const userName = user?.email?.split('@')[0] || 'Staff';
  const highestBarangay = barangaysData[0];
  const lowestBarangay = barangaysData.filter(b => b.emission > 0).pop();
  const top5Total = donutData.reduce((a, b) => a + b, 0);
  const top5Percent = totalEmission ? Math.round((top5Total / totalEmission) * 100) : 0;

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

        {/* Header Card – Teal Green */}
        <div className="header-card">
          <div>
            <h1>Household Emission Analytics</h1>
            <p>Monitor household carbon emissions across 16 barangays of Marilao</p>
          </div>
          <div className="header-actions">
            <button className="icon-btn" onClick={fetchData}><RefreshCw size={16} /> Sync</button>
            <div className="staff-badge"><span className="live-dot"></span> STAFF VIEW</div>
            <div className="date-badge"><Calendar size={14} /> {new Date().toLocaleDateString()}</div>
          </div>
        </div>

        {/* 4 Stats Cards – Pastel variants */}
        <div className="stats-grid">
          <div className="stat-card pastel-teal">
            <div className="stat-icon"><Leaf size={24} /></div>
            <div className="stat-content">
              <div className="stat-value">{totalEmission.toLocaleString()} <span className="stat-unit">kg</span></div>
              <div className="stat-label">Total Household CO₂</div>
              <div className="stat-trend">From web + mobile submissions</div>
            </div>
          </div>
          <div className="stat-card pastel-mint">
            <div className="stat-icon"><BarChart3 size={24} /></div>
            <div className="stat-content">
              <div className="stat-value">{averageEmission.toLocaleString()} <span className="stat-unit">kg</span></div>
              <div className="stat-label">Average per Barangay</div>
              <div className="stat-trend">{noDataCount} barangays have no data</div>
            </div>
          </div>
          <div className="stat-card pastel-coral warning">
            <div className="stat-icon"><AlertTriangle size={24} /></div>
            <div className="stat-content">
              <div className="stat-value" style={{ color: '#DC2626' }}>{highEmissionAreas}</div>
              <div className="stat-label">High Emission Areas</div>
              <div className="stat-trend">{criticalCount} critical, {veryHighCount} very high, {highCount} high</div>
            </div>
          </div>
          <div className="stat-card pastel-yellowgreen">
            <div className="stat-icon"><CheckCircle size={24} /></div>
            <div className="stat-content">
              <div className="stat-value">{lowCount + veryLowCount}</div>
              <div className="stat-label">Low Emission Areas</div>
              <div className="stat-trend">Good environmental performance</div>
            </div>
          </div>
        </div>

        {/* Tabs – Teal themed */}
        <div className="tab-nav">
          <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            <BarChart3 size={16} /> Overview
          </button>
          <button className={`tab-btn ${activeTab === 'targets' ? 'active' : ''}`} onClick={() => setActiveTab('targets')}>
            <Award size={16} /> Reduction Targets
          </button>
          <button className={`tab-btn ${activeTab === 'alerts' ? 'active' : ''}`} onClick={() => setActiveTab('alerts')}>
            <Bell size={16} /> Alerts {alerts.length > 0 && <span className="alert-badge">{alerts.length}</span>}
          </button>
        </div>

        {activeTab === 'overview' && (
          <>
            <div className="overview-grid">
              {/* Bar Chart with teal→yellow-green gradient */}
              <div className="chart-card">
                <div className="card-header">
                  <h3><BarChart3 size={20} /> Barangay Household CO₂ Comparison</h3>
                  <span className="trend-badge">{barangaysData.filter(b => b.emission > 0).length} barangays with data</span>
                </div>
                <div className="chart-container" style={{ height: '360px' }}>
                  <Bar data={barChartData} options={barChartOptions} />
                </div>
                <div className="chart-note">
                  <Lightbulb size={14} /> Color gradient: teal (lower emissions) → yellow-green (higher emissions)
                </div>
              </div>

              {/* Top 5 Donut */}
              <div className="donut-card">
                <div className="card-header">
                  <h3><PieChart size={18} /> Top 5 Highest Emissions</h3>
                </div>
                <div className="donut-container" style={{ height: '300px' }}>
                  <Doughnut data={donutChartData} options={donutOptions} />
                </div>
              </div>

              {/* Emission Level Distribution */}
              <div className="distribution-card">
                <div className="card-header">
                  <h3><PieChart size={18} /> Emission Level Distribution</h3>
                </div>
                <div className="distribution-description">Colors indicate the emission severity for each barangay, from green (low) to red (critical).</div>
                <div className="distribution-list">
                  {distributionLevels.map((level) => (
                    <div key={level.label} className="distribution-item">
                      <div className="distribution-label">
                        <span className="level-dot" style={{ background: level.color }}></span>
                        <span>{level.label}</span>
                        <span className="level-count">{level.count}</span>
                      </div>
                      <div className="distribution-bar-container">
                        <div className="distribution-bar" style={{ width: `${(level.count / barangays.length) * 100}%`, background: level.color }}></div>
                      </div>
                      <div className="distribution-percent">{Math.round((level.count / barangays.length) * 100)}%</div>
                    </div>
                  ))}
                </div>
                <div className="distribution-note">* Based on 16 barangays. "No Data" means zero submissions.</div>
              </div>

              {/* Combined Insights Card */}
              <div className="combined-insights-card">
                <h3><TrendingUp size={18} /> Key Insights</h3>
                <div className="insight-split">
                  <div className="insight-group">
                    <div className="insight-row">
                      <Award size={20} color="#F59E0B" />
                      <div>
                        <strong>Highest Emission</strong>
                        <p>{highestBarangay?.name || 'N/A'} – {highestBarangay?.emission?.toLocaleString() || 0} kg</p>
                      </div>
                    </div>
                    <div className="insight-row">
                      <Leaf size={20} color="#14B89D" />
                      <div>
                        <strong>Lowest Emission</strong>
                        <p>{lowestBarangay?.name || 'N/A'} – {lowestBarangay?.emission?.toLocaleString() || 0} kg</p>
                      </div>
                    </div>
                  </div>
                  <div className="insight-group">
                    <div className="insight-row">
                      <BarChart3 size={20} />
                      <div>
                        <strong>Top 5 Contribution</strong>
                        <p>{top5Total.toLocaleString()} kg ({top5Percent}% of total)</p>
                      </div>
                    </div>
                    <div className="insight-row">
                      <AlertTriangle size={20} color="#DC2626" />
                      <div>
                        <strong>Critical Areas</strong>
                        <p>{criticalCount} barangays need immediate attention</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Data Table */}
            <div className="data-table">
              <div className="table-header">
                <h3><Trophy size={20} /> Barangay Household Emission Ranking</h3>
                <button className="icon-btn" onClick={() => {
                  const csv = [['Barangay', 'CO₂ (kg)', 'Status'], ...barangaysData.map(b => [b.name, b.emission, b.level])].map(row => row.join(',')).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `emissions-${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  addToast('success', 'Exported to CSV');
                }}><Download size={14} /> Export</button>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>Rank</th><th>Barangay</th><th>CO₂ Emission</th><th>Submissions</th><th>Status</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {barangaysData.map((barangay, index) => (
                      <tr key={barangay.name}>
                        <td className={`rank rank-${index + 1}`}>#{index + 1}</td>
                        <td><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', borderRadius: '3px', background: barangay.color }}></div><strong>{barangay.name}</strong></div></td>
                        <td className="amount">{barangay.emission > 0 ? `${barangay.emission.toLocaleString()} kg` : '—'}</td>
                        <td>{barangay.records || 0}</td>
                        <td><span className={`status-badge status-${barangay.level.toLowerCase().replace(' ', '-')}`}>{barangay.level}</span></td>
                        <td><button className="view-btn" onClick={() => showBarangayDetails(barangay, index)}>View Details</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'targets' && (
          <>
            <div className="targets-card">
              <div className="card-header">
                <h3><Award size={20} /> Household Emission Reduction Targets</h3>
                <span className="trend-badge">View Only</span>
              </div>
              {targets.length === 0 ? (
                <div className="empty-state">
                  <Target size={48} color="#94A3B8" />
                  <h4>No targets set yet</h4>
                  <p>Admin will set emission reduction targets for barangays.</p>
                </div>
              ) : (
                <div className="targets-list">
                  {targets.map((target) => (
                    <div key={target.barangay} className="target-item">
                      <div className="target-header">
                        <div><h4>{target.barangay}</h4><span className="target-subtitle">Target: {target.targetEmission.toLocaleString()} kg</span></div>
                      </div>
                      <div className="progress-bar-container"><div className="progress-bar" style={{ width: `${target.progress}%`, background: target.progress > 100 ? '#DC2626' : '#14B89D' }}></div></div>
                      <div className="target-stats"><span>Current: {target.currentEmission.toLocaleString()} kg</span><span className={target.progress > 100 ? 'over-target' : 'under-target'}>{target.progress > 100 ? `${target.progress - 100}% over target` : `${100 - target.progress}% to target`}</span></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="recommendations-card">
              <h3><Lightbulb size={20} /> Household Emission Reduction Recommendations</h3>
              <div className="recommendations-list">
                <div className="rec-item"><Zap size={22} /><div><strong>Switch to LED Lights</strong><p>Replace incandescent bulbs with LED to reduce lighting emissions by 75%</p></div></div>
                <div className="rec-item"><Sun size={22} /><div><strong>Energy Efficient Appliances</strong><p>Promote 5-star rated appliances and unplug devices when not in use</p></div></div>
                <div className="rec-item"><Sun size={22} /><div><strong>Solar Power Adoption</strong><p>Encourage rooftop solar panel installation for households</p></div></div>
                <div className="rec-item"><BarChart3 size={22} /><div><strong>Increase Data Collection</strong><p>{noDataCount} barangays have no household emission data yet</p></div></div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'alerts' && (
          <>
            <div className="alerts-card">
              <div className="card-header">
                <h3><Bell size={20} /> Real-time Household Emission Alerts</h3>
                <span className="alert-count">{alerts.length} new alerts</span>
              </div>
              {alerts.length === 0 ? (
                <div className="empty-state"><CheckCircle size={48} color="#14B89D" /><h4>All clear!</h4><p>No critical household emission alerts at this moment</p></div>
              ) : (
                <div className="alerts-list">
                  {alerts.map((alert) => (
                    <div key={alert.id} className={`alert-item alert-${alert.level.toLowerCase().replace(' ', '-')}`}>
                      <div className="alert-icon">{alert.level === 'Critical' ? <AlertTriangle size={20} color="#DC2626" /> : alert.level === 'Very High' ? <AlertTriangle size={20} color="#F97316" /> : <AlertTriangle size={20} color="#F59E0B" />}</div>
                      <div className="alert-content"><div className="alert-title"><strong>{alert.barangay}</strong> - {alert.level} Household Emission Alert</div><div className="alert-message">Household CO₂ emission reached {alert.emission.toLocaleString()} kg</div><div className="alert-time">{alert.timestamp.toLocaleTimeString()}</div></div>
                      <button className="dismiss-btn" onClick={() => dismissAlert(alert.id)}>Dismiss</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="info-card">
              <h3><Activity size={20} /> Recommended Actions for High Household Emissions</h3>
              <div className="info-list">
                <div className="info-item"><CheckCircle size={16} /> Conduct household energy audit for critical barangays</div>
                <div className="info-item"><CheckCircle size={16} /> Schedule energy efficiency seminar for residents</div>
                <div className="info-item"><CheckCircle size={16} /> Prepare monthly household emission report for MENRO</div>
                <div className="info-item"><CheckCircle size={16} /> Distribute energy-saving tips to barangay captains</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Details Modal (no target setting for staff) */}
      {showDetailsModal && selectedBarangayDetail && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><div className="modal-title"><div className="color-indicator" style={{ background: selectedBarangayDetail.color }}></div><h3>{selectedBarangayDetail.name}</h3></div><button className="close-modal" onClick={() => setShowDetailsModal(false)}>✕</button></div>
            <div className="modal-body">
              <div className="detail-rank"><div className="rank-badge" style={{ background: selectedBarangayDetail.color }}>#{selectedBarangayDetail.rank}</div><div className="level-badge-large" style={{ background: selectedBarangayDetail.color }}>{selectedBarangayDetail.level}</div></div>
              <div className="detail-stats">
                <div className="detail-stat"><div className="detail-stat-label">Total Household CO₂</div><div className="detail-stat-value" style={{ color: selectedBarangayDetail.color }}>{selectedBarangayDetail.emission.toLocaleString()} <span className="detail-stat-unit">kg</span></div></div>
                <div className="detail-stat"><div className="detail-stat-label">Total Submissions</div><div className="detail-stat-value">{selectedBarangayDetail.totalRecords} <span className="detail-stat-unit">records</span></div></div>
                <div className="detail-stat"><div className="detail-stat-label">Households</div><div className="detail-stat-value">{selectedBarangayDetail.householdCount} <span className="detail-stat-unit">households</span></div></div>
              </div>
              <div className="detail-section"><h4><BarChart3 size={16} /> Average Emission per Household</h4><div className="avg-household"><div className="avg-value" style={{ color: selectedBarangayDetail.color }}>{Math.round(selectedBarangayDetail.emission / Math.max(selectedBarangayDetail.householdCount, 1)).toLocaleString()}<span className="avg-unit">kg per household</span></div><div className="avg-note">Based on {selectedBarangayDetail.totalRecords} total submissions</div></div></div>
              <div className="detail-section"><h4><TrendingUp size={16} /> Comparison with Other Barangays</h4><div className="comparison-grid"><div className="comparison-item"><span className="comparison-label">vs. Municipal Average</span><div className="comparison-bar-container"><div className="comparison-bar" style={{ width: `${Math.min(selectedBarangayDetail.comparison.vsAverage, 100)}%`, background: selectedBarangayDetail.color }}></div></div><span className="comparison-value">{selectedBarangayDetail.comparison.vsAverage}% of average</span></div><div className="comparison-item"><span className="comparison-label">vs. Highest Barangay</span><div className="comparison-bar-container"><div className="comparison-bar" style={{ width: `${Math.min(selectedBarangayDetail.comparison.vsHighest, 100)}%`, background: selectedBarangayDetail.color }}></div></div><span className="comparison-value">{selectedBarangayDetail.comparison.vsHighest}% of highest</span></div><div className="comparison-item"><span className="comparison-label">vs. Lowest Barangay</span><div className="comparison-bar-container"><div className="comparison-bar" style={{ width: `${Math.min(selectedBarangayDetail.comparison.vsLowest, 100)}%`, background: selectedBarangayDetail.color }}></div></div><span className="comparison-value">{selectedBarangayDetail.comparison.vsLowest}× lowest</span></div></div></div>
              <div className="detail-section"><h4><PieChart size={16} /> Household Emission Sources Breakdown</h4><div className="sources-list">{selectedBarangayDetail.sources.map((source, idx) => (<div key={idx} className="source-item"><div className="source-header"><span className="source-name">{source.name}</span><span className="source-percentage">{source.percentage}%</span></div><div className="source-bar-container"><div className="source-bar" style={{ width: `${source.percentage}%`, background: selectedBarangayDetail.color }}></div></div><div className="source-amount">{source.amount.toLocaleString()} kg</div></div>))}</div></div>
              <div className="detail-section"><h4><Lightbulb size={16} /> Household Action Plan for {selectedBarangayDetail.name}</h4><div className="recommendation-list">{selectedBarangayDetail.emission >= 2000 && (<div className="recommendation-item urgent"><AlertTriangle size={18} /><div><strong>URGENT: High Household Emissions</strong><p>Schedule immediate household energy audit and community seminar</p></div></div>)}<div className="recommendation-item"><Lightbulb size={18} /><div><strong>LED Lighting Campaign</strong><p>Distribute LED bulbs and educate about energy-efficient lighting</p></div></div><div className="recommendation-item"><Zap size={18} /><div><strong>Appliance Efficiency Program</strong><p>Promote energy-efficient appliances and proper usage habits</p></div></div><div className="recommendation-item"><Sun size={18} /><div><strong>Solar Energy Initiative</strong><p>Introduce subsidized solar panel installation for households</p></div></div></div></div>
              <div className="detail-actions">
                <button className="action-secondary" onClick={() => alert(`Generating household emission report for ${selectedBarangayDetail.name}`)}><FileText size={14} /> Generate Report</button>
                <button className="action-secondary" onClick={() => alert(`Sending energy-saving tips to ${selectedBarangayDetail.name}`)}><Send size={14} /> Send Alert</button>
              </div>
            </div>
          </div>
        </div>
      )}

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
        
        /* Stats Cards */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
          margin-bottom: 28px;
        }
        .stat-card {
          padding: 14px 18px;
          border-radius: 20px;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          position: relative;
          padding-top: 48px;
        }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(0,0,0,0.08); }
        .stat-card .stat-value { font-size: 24px; font-weight: 800; margin-bottom: 2px; }
        .stat-card .stat-label { font-size: 12px; font-weight: 500; margin-bottom: 4px; }
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
        .stat-trend { font-size: 12px; color: #5A7C2E; }
        .stat-unit { font-size: 16px; font-weight: 500; }
        
        .stat-card.pastel-teal { background: #D6F4EE; border: 1px solid #9FE5D5; }
        .stat-card.pastel-teal .stat-value { color: #0F5C4B; }
        .stat-card.pastel-teal .stat-label { color: #3B7A6A; }
        
        .stat-card.pastel-mint { background: #DCFCE7; border: 1px solid #BBF7D0; }
        .stat-card.pastel-mint .stat-value { color: #166534; }
        .stat-card.pastel-mint .stat-label { color: #4B5563; }
        
        .stat-card.pastel-coral { background: #FFEDD5; border: 1px solid #FED7AA; }
        .stat-card.pastel-coral .stat-value { color: #9A3412; }
        .stat-card.pastel-coral .stat-label { color: #C2410C; }
        
        .stat-card.pastel-yellowgreen { background: #E9F5DB; border: 1px solid #D4E8B3; }
        .stat-card.pastel-yellowgreen .stat-value { color: #3D5C1A; }
        .stat-card.pastel-yellowgreen .stat-label { color: #5A7C2E; }
        
        /* Tabs */
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
        .tab-btn.active { background: #14B89D; color: white; }
        .alert-badge { background: #DC2626; color: white; border-radius: 30px; padding: 0 8px; font-size: 11px; margin-left: 8px; }
        
        /* Overview Grid */
        .overview-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 28px;
          margin-bottom: 28px;
        }
        .chart-card, .donut-card, .distribution-card, .combined-insights-card {
          background: white;
          border-radius: 28px;
          padding: 24px;
          border: 1px solid #C8E6C9;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          transition: all 0.2s;
        }
        .chart-card:hover, .donut-card:hover, .distribution-card:hover, .combined-insights-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.08);
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .card-header h3 { display: flex; align-items: center; gap: 10px; color: #166534; margin: 0; font-size: 18px; font-weight: 700; }
        .trend-badge { background: #E9F5DB; padding: 4px 14px; border-radius: 40px; font-size: 13px; color: #3D5C1A; font-weight: 500; }
        .chart-container { width: 100%; height: 360px; }
        .chart-note { text-align: center; margin-top: 20px; font-size: 13px; color: #64748B; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .donut-container { height: 300px; display: flex; justify-content: center; align-items: center; }
        
        .distribution-description { font-size: 13px; color: #4B5563; margin-bottom: 20px; }
        .distribution-list { display: flex; flex-direction: column; gap: 16px; }
        .distribution-item { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .distribution-label { display: flex; align-items: center; gap: 8px; width: 110px; font-size: 14px; font-weight: 500; }
        .level-dot { width: 14px; height: 14px; border-radius: 4px; }
        .level-count { margin-left: auto; font-weight: 700; color: #166534; }
        .distribution-bar-container { flex: 2; height: 10px; background: #E5E7EB; border-radius: 12px; overflow: hidden; }
        .distribution-bar { height: 100%; border-radius: 12px; }
        .distribution-percent { width: 45px; font-size: 13px; font-weight: 500; text-align: right; color: #0F5C4B; }
        .distribution-note { margin-top: 16px; font-size: 12px; color: #94A3B8; text-align: center; border-top: 1px solid #E5E7EB; padding-top: 16px; }
        
        .combined-insights-card h3 {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 18px;
          font-weight: 700;
          color: #166534;
          margin-bottom: 20px;
        }
        .insight-split { display: flex; flex-direction: column; gap: 20px; }
        .insight-group { display: flex; flex-direction: column; gap: 14px; }
        .insight-row {
          display: flex;
          gap: 14px;
          background: #F9FAFB;
          padding: 14px;
          border-radius: 20px;
          transition: all 0.2s;
        }
        .insight-row:hover { background: #E9F5DB; }
        .insight-row strong { display: block; color: #166534; margin-bottom: 6px; font-size: 14px; }
        .insight-row p { margin: 0; font-size: 14px; color: #4B5563; }
        
        /* Data Table */
        .data-table {
          background: white;
          border-radius: 28px;
          overflow: hidden;
          border: 1px solid #C8E6C9;
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
        .table-header h3 { display: flex; align-items: center; gap: 10px; color: #3D5C1A; margin: 0; font-size: 18px; font-weight: 700; }
        .table-scroll {
          max-height: 500px;
          overflow-y: auto;
          overflow-x: auto;
        }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th, td { padding: 14px 18px; text-align: left; border-bottom: 1px solid #E6F7F3; }
        th { background: #F0FDF4; color: #0F5C4B; font-weight: 700; position: sticky; top: 0; z-index: 10; font-size: 14px; }
        .rank { font-weight: 800; }
        .rank-1 { color: #F59E0B; }
        .rank-2 { color: #94A3B8; }
        .rank-3 { color: #CD7F32; }
        .amount { font-weight: 800; color: #0F5C4B; }
        .status-badge { padding: 4px 12px; border-radius: 40px; font-size: 12px; font-weight: 700; display: inline-block; }
        .status-critical { background: #FEE2E2; color: #DC2626; }
        .status-very-high { background: #FFEDD5; color: #F97316; }
        .status-high { background: #FEF3C7; color: #F59E0B; }
        .status-medium { background: #FEF9C3; color: #EAB308; }
        .status-low { background: #D1FAE5; color: #14B89D; }
        .view-btn { background: #14B89D; border: none; padding: 6px 16px; border-radius: 40px; color: white; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.2s; }
        .view-btn:hover { background: #0F5C4B; transform: translateY(-1px); }
        
        /* Targets & Alerts Cards */
        .targets-card, .recommendations-card, .alerts-card, .info-card {
          background: white;
          border-radius: 28px;
          padding: 24px;
          border: 1px solid #C8E6C9;
          margin-bottom: 28px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .target-item { padding: 16px; background: #F9FAFB; border-radius: 20px; border: 1px solid #E5E7EB; margin-bottom: 14px; }
        .target-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .target-header h4 { margin: 0; color: #166534; font-size: 16px; }
        .target-subtitle { font-size: 12px; color: #64748B; }
        .progress-bar-container { height: 10px; background: #E5E7EB; border-radius: 12px; overflow: hidden; margin-bottom: 8px; }
        .progress-bar { height: 100%; border-radius: 12px; }
        .target-stats { display: flex; justify-content: space-between; font-size: 13px; color: #4B5563; margin-top: 6px; }
        .over-target { color: #DC2626; }
        .under-target { color: #14B89D; }
        .rec-item, .info-item {
          display: flex;
          gap: 14px;
          padding: 14px;
          background: #F9FAFB;
          border-radius: 20px;
          font-size: 14px;
          margin-bottom: 10px;
        }
        .rec-item strong, .info-item strong { color: #166534; }
        .empty-state { text-align: center; padding: 60px 20px; color: #94A3B8; }
        .empty-state h4 { margin: 16px 0 8px; color: #4B5563; }
        
        /* Alerts specific */
        .alerts-list { display: flex; flex-direction: column; gap: 12px; }
        .alert-item {
          display: flex;
          gap: 12px;
          padding: 16px;
          border-radius: 20px;
          background: #F9FAFB;
          align-items: center;
          border-left: 4px solid;
        }
        .alert-critical { border-left-color: #DC2626; }
        .alert-very-high { border-left-color: #F97316; }
        .alert-high { border-left-color: #F59E0B; }
        .alert-content { flex: 1; }
        .alert-title { margin-bottom: 4px; }
        .alert-message { font-size: 13px; color: #64748B; margin-bottom: 4px; }
        .alert-time { font-size: 11px; color: #94A3B8; }
        .dismiss-btn { background: #FFE2E6; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; color: #FF69B4; }
        
        /* Details Modal */
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; z-index: 1000;
        }
        .details-modal {
          background: white; border-radius: 32px; width: 720px; max-width: 90%;
          max-height: 85vh; overflow-y: auto;
        }
        .modal-header { padding: 20px 28px; border-bottom: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: center; }
        .modal-title { display: flex; align-items: center; gap: 12px; }
        .modal-title h3 { margin: 0; color: #0F5C4B; font-size: 20px; }
        .close-modal { background: none; border: none; font-size: 28px; cursor: pointer; color: #64748B; }
        .modal-body { padding: 24px 28px; }
        .detail-rank { display: flex; gap: 16px; margin-bottom: 24px; }
        .rank-badge { width: 70px; height: 70px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; font-size: 22px; }
        .level-badge-large { padding: 8px 20px; border-radius: 40px; color: white; font-weight: 700; font-size: 14px; }
        .detail-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; margin-bottom: 28px; }
        .detail-stat { text-align: center; }
        .detail-stat-label { font-size: 13px; color: #64748B; margin-bottom: 6px; }
        .detail-stat-value { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
        .detail-section { margin-top: 24px; }
        .detail-section h4 { display: flex; align-items: center; gap: 8px; color: #166534; margin-bottom: 16px; font-size: 16px; }
        .avg-household { background: #F0FDF4; padding: 16px; border-radius: 20px; text-align: center; }
        .avg-value { font-size: 36px; font-weight: 800; }
        .comparison-grid { display: flex; flex-direction: column; gap: 12px; }
        .comparison-item { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .comparison-label { width: 140px; font-size: 13px; color: #4B5563; }
        .comparison-bar-container { flex: 1; height: 6px; background: #E5E7EB; border-radius: 6px; }
        .comparison-bar { height: 100%; border-radius: 6px; }
        .sources-list { display: flex; flex-direction: column; gap: 12px; }
        .source-item { background: #F9FAFB; padding: 12px; border-radius: 16px; }
        .source-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .source-bar-container { height: 6px; background: #E5E7EB; border-radius: 6px; margin-bottom: 6px; }
        .source-bar { height: 100%; border-radius: 6px; }
        .recommendation-item { display: flex; gap: 12px; padding: 12px; background: #F9FAFB; border-radius: 16px; margin-bottom: 8px; }
        .detail-actions { display: flex; gap: 12px; margin-top: 28px; }
        .action-secondary { flex: 1; padding: 12px; border-radius: 44px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; background: #F1F5F9; color: #334155; }
        .action-secondary:hover { background: #E2E8F0; }
        
        @media (max-width: 1024px) {
          .main-content { margin-left: 0; padding: 20px; }
          .stats-grid { grid-template-columns: repeat(2,1fr); }
          .overview-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .stats-grid { grid-template-columns: 1fr; }
          .tab-nav { width: 100%; justify-content: center; }
        }
      `}</style>
    </div>
  );
}