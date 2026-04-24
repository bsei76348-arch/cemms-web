// app/staff/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth, mobileDb, webCemmsDb } from '@/app/lib/combinedFirebase';
import { signOut } from 'firebase/auth';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import StaffSidebar from '../lib/StaffSidebar';
import {
  Leaf, Home, MapPin, AlertTriangle, Trophy, Activity, Calendar,
  TrendingUp, FileText, Map, BarChart3, Recycle, Zap,
  CheckCircle, Clock, RefreshCw
} from 'lucide-react';

const BARANGAYS = [
  'Abangan Norte', 'Abangan Sur', 'Ibayo', 'Lambakin',
  'Lias', 'Loma de Gato', 'Nagbalon', 'Patubig',
  'Poblacion I', 'Poblacion II', 'Prenza I', 'Prenza II',
  'Santa Rosa I', 'Santa Rosa II', 'Saog', 'Tabing Ilog'
];

const colorPalette = [
  '#14B89D', '#D6F4EE', '#DCFCE7', '#E9F5DB', '#FFEDD5', '#BBF7D0',
  '#9FE5D5', '#D4E8B3', '#FED7AA', '#5A7C2E', '#3D5C1A', '#0F5C4B',
  '#166534', '#C2410C', '#9A3412', '#3B7A6A'
];

const safeToDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (value && typeof value.toDate === 'function') return value.toDate();
  if (value && typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
};

export default function StaffDashboard() {
  const [user, setUser] = useState<any>(null); // Fixed: use 'any' type
  const [loading, setLoading] = useState(true);
  const [barangaysData, setBarangaysData] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [totalEmissions, setTotalEmissions] = useState(0);
  const [totalHouseholds, setTotalHouseholds] = useState(0);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const router = useRouter();

  const fetchData = async () => {
    try {
      const emissionsMap: Record<string, number> = {};
      const recordsCount: Record<string, number> = {};
      BARANGAYS.forEach(b => {
        emissionsMap[b] = 0;
        recordsCount[b] = 0;
      });

      const allRecords: any[] = [];

      // 1. Fetch from 'calculations' collection (mobile app)
      const calcSnapshot = await getDocs(collection(mobileDb, 'calculations'));
      calcSnapshot.forEach(doc => {
        const data = doc.data();
        const barangay = data.barangay;
        const amount = Number(data.dailyCarbon || data.carbonAmount || 0);
        if (barangay && BARANGAYS.includes(barangay) && amount > 0) {
          emissionsMap[barangay] += amount;
          recordsCount[barangay]++;
          allRecords.push({
            id: doc.id,
            type: 'calculator',
            barangay,
            amount,
            date: safeToDate(data.createdAt || data.timestamp || data.date),
          });
        }
      });

      // 2. Fetch from 'emissions' collection (web app)
      const emissionsSnapshot = await getDocs(collection(webCemmsDb, 'emissions'));
      emissionsSnapshot.forEach(doc => {
        const data = doc.data();
        const barangay = data.barangay;
        const amount = Number(data.carbonAmount || data.amount || 0);
        if (barangay && BARANGAYS.includes(barangay) && amount > 0) {
          emissionsMap[barangay] += amount;
          recordsCount[barangay]++;
          allRecords.push({
            id: doc.id,
            type: 'emission',
            barangay,
            amount,
            date: safeToDate(data.createdAt || data.timestamp),
          });
        }
      });

      const stats = BARANGAYS.map((name, idx) => ({
        name,
        emission: Math.round(emissionsMap[name]),
        records: recordsCount[name],
        color: colorPalette[idx % colorPalette.length],
      }));
      stats.sort((a, b) => b.emission - a.emission);
      setBarangaysData(stats);

      const total = stats.reduce((sum, b) => sum + b.emission, 0);
      const households = stats.reduce((sum, b) => sum + b.records, 0);
      setTotalEmissions(total);
      setTotalHouseholds(households);

      allRecords.sort((a, b) => b.date.getTime() - a.date.getTime());
      setRecentActivities(allRecords.slice(0, 6));
      setLastSync(new Date());
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  // Real-time listeners for both databases
  useEffect(() => {
    const unsubMobile = onSnapshot(collection(mobileDb, 'calculations'), () => fetchData());
    const unsubWeb = onSnapshot(collection(webCemmsDb, 'emissions'), () => fetchData());
    return () => { unsubMobile(); unsubWeb(); };
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        await fetchData();
        setLoading(false);
      } else {
        // Check for mock user from localStorage (hardcoded login)
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('cemms_user');
          if (stored) {
            try {
              const mock = JSON.parse(stored);
              setUser({ uid: mock.uid, email: mock.email, displayName: mock.role } as any);
              await fetchData();
              setLoading(false);
              return;
            } catch (e) {
              console.error(e);
            }
          }
        }
        router.push('/login');
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.log('Sign out error (mock user):', e);
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('cemms_user');
      }
      router.push('/login');
    }
  };

  const highEmissions = barangaysData.filter(b => b.emission >= 1000).length;
  const mediumEmissions = barangaysData.filter(b => b.emission >= 500 && b.emission < 1000).length;
  const lowEmissions = barangaysData.filter(b => b.emission > 0 && b.emission < 500).length;
  const noDataCount = barangaysData.filter(b => b.emission === 0).length;
  const activeBarangays = barangaysData.filter(b => b.emission > 0).length;

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

  const userName = user?.email?.split('@')[0] || 'Staff';

  return (
    <div style={{ display: 'flex', background: '#F8FDF9', minHeight: '100vh' }}>
      <StaffSidebar userName={userName} />

      <div className="dashboard-main">
        {/* Header Card – Teal Green */}
        <div className="header-card">
          <div>
            <h1>Staff Dashboard</h1>
            <p>Welcome, {userName}! Here's the emission overview of Marilao.</p>
          </div>
          <div className="header-actions">
            <button className="icon-btn" onClick={fetchData}>
              <RefreshCw size={16} /> Sync
            </button>
            <div className="staff-badge">
              <span className="live-dot"></span> STAFF
            </div>
            <div className="date-badge">
              <Calendar size={14} /> {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Stats Cards – Pastel variants */}
        <div className="stats-grid">
          <div className="stat-card pastel-teal">
            <div className="stat-icon"><Leaf size={22} /></div>
            <div className="stat-content">
              <div className="stat-value">{totalEmissions.toLocaleString()} <span className="stat-unit">kg</span></div>
              <div className="stat-label">Total CO₂ Emissions</div>
              <div className="stat-trend">Across all barangays</div>
            </div>
          </div>
          <div className="stat-card pastel-mint">
            <div className="stat-icon"><Home size={22} /></div>
            <div className="stat-content">
              <div className="stat-value">{totalHouseholds.toLocaleString()}</div>
              <div className="stat-label">Total Submissions</div>
              <div className="stat-trend">From calculator & web</div>
            </div>
          </div>
          <div className="stat-card pastel-yellowgreen">
            <div className="stat-icon"><MapPin size={22} /></div>
            <div className="stat-content">
              <div className="stat-value">{activeBarangays}</div>
              <div className="stat-label">Active Barangays</div>
              <div className="stat-trend">Out of {BARANGAYS.length}</div>
            </div>
          </div>
          <div className="stat-card pastel-coral warning">
            <div className="stat-icon"><AlertTriangle size={22} /></div>
            <div className="stat-content">
              <div className="stat-value" style={{ color: '#DC2626' }}>{highEmissions}</div>
              <div className="stat-label">High Risk Areas</div>
              <div className="stat-trend">Need attention</div>
            </div>
          </div>
        </div>

        {/* Status Overview */}
        <div className="status-overview">
          <div className="status-header">
            <h3><Activity size={16} /> Emission Status Overview</h3>
            <span className="status-subtitle">{BARANGAYS.length} Barangays of Marilao</span>
          </div>
          <div className="status-cards">
            <div className="status-item critical">
              <div className="status-count">{highEmissions}</div>
              <div className="status-label">High Risk</div>
              <div className="status-desc">≥1000 kg CO₂</div>
            </div>
            <div className="status-item warning">
              <div className="status-count">{mediumEmissions}</div>
              <div className="status-label">Medium Risk</div>
              <div className="status-desc">500-999 kg CO₂</div>
            </div>
            <div className="status-item good">
              <div className="status-count">{lowEmissions}</div>
              <div className="status-label">Low Risk</div>
              <div className="status-desc">&lt;500 kg CO₂</div>
            </div>
            <div className="status-item no-data">
              <div className="status-count">{noDataCount}</div>
              <div className="status-label">No Data</div>
              <div className="status-desc">Awaiting submissions</div>
            </div>
          </div>
        </div>

        {/* Barangay Rankings Table */}
        <div className="table-card">
          <div className="card-header">
            <h3><Trophy size={16} /> Barangay Rankings</h3>
            <Link href="/staff/rankings" className="view-all-link">
              View All <TrendingUp size={12} />
            </Link>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Barangay</th>
                  <th>CO₂ Emission</th>
                  <th>Submissions</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {barangaysData.slice(0, 10).map((barangay, index) => (
                  <tr key={barangay.name}>
                    <td className={`rank rank-${index + 1}`}>#{index + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: barangay.color }}></div>
                        <strong>{barangay.name}</strong>
                      </div>
                    </td>
                    <td className="amount">{barangay.emission > 0 ? `${barangay.emission.toLocaleString()} kg` : '—'}</td>
                    <td>{barangay.records || 0}</td>
                    <td>
                      <span className={`status-badge ${barangay.emission >= 1000 ? 'critical' : barangay.emission >= 500 ? 'warning' : barangay.emission > 0 ? 'good' : 'no-data'}`}>
                        {barangay.emission >= 1000 ? 'Critical' : barangay.emission >= 500 ? 'Monitor' : barangay.emission > 0 ? 'Good' : 'No Data'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Section: Recent Activity + Quick Actions */}
        <div className="bottom-section">
          <div className="activity-card">
            <div className="card-header">
              <h3><Clock size={16} /> Recent Activity</h3>
              <span className="activity-badge">Live</span>
            </div>
            <div className="activity-list">
              {recentActivities.length === 0 ? (
                <div className="empty-activity">No recent activity</div>
              ) : (
                recentActivities.map((activity, idx) => (
                  <div key={idx} className="activity-item">
                    <div className="activity-icon">
                      {activity.type === 'calculator' ? <Zap size={14} /> : <FileText size={14} />}
                    </div>
                    <div className="activity-details">
                      <div className="activity-title">
                        <strong>{activity.barangay}</strong>
                        <span className="activity-type">{activity.type === 'calculator' ? 'Calculator' : 'Web Entry'}</span>
                      </div>
                      <div className="activity-meta">
                        {activity.amount.toLocaleString()} kg CO₂ • {activity.date.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="actions-card">
            <h3><Zap size={16} /> Quick Actions</h3>
            <div className="actions-grid">
              <button className="action-btn" onClick={() => router.push('/staff/reports')}>
                <FileText size={16} />
                <div><strong>Generate Report</strong><p>Export emission data</p></div>
              </button>
              <button className="action-btn" onClick={() => router.push('/staff/live-map')}>
                <Map size={16} />
                <div><strong>View Map</strong><p>See emission hotspots</p></div>
              </button>
              <button className="action-btn" onClick={() => router.push('/staff/live-stats')}>
                <BarChart3 size={16} />
                <div><strong>View Analytics</strong><p>Detailed statistics</p></div>
              </button>
              
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="footer-info">
          <div className="info-text"><CheckCircle size={11} /> Data is updated in real-time from submissions</div>
          <div className="info-text"><Zap size={11} /> Emission factor: 0.5 kg CO₂ per kWh</div>
          <div className="info-text"><RefreshCw size={11} /> Last sync: {lastSync.toLocaleTimeString()}</div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }

        .dashboard-main {
          flex: 1;
          margin-left: 280px;
          padding: 28px 36px;
          background: #F8FDF9;
          min-height: 100vh;
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
          gap: 14px;
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
        .icon-btn:hover {
          background: #E6F7F3;
          transform: translateY(-1px);
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
        .stat-card .stat-value {
          font-size: 24px;
          font-weight: 800;
          margin-bottom: 2px;
        }
        .stat-card .stat-label {
          font-size: 12px;
          font-weight: 500;
          margin-bottom: 4px;
        }
        .stat-card .stat-content {
          text-align: center;
        }
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
        .stat-trend {
          font-size: 12px;
          color: #5A7C2E;
        }
        .stat-unit {
          font-size: 16px;
          font-weight: 500;
        }
        .stat-card.pastel-teal { background: #D6F4EE; border: 1px solid #9FE5D5; }
        .stat-card.pastel-teal .stat-value { color: #0F5C4B; }
        .stat-card.pastel-teal .stat-label { color: #3B7A6A; }
        .stat-card.pastel-mint { background: #DCFCE7; border: 1px solid #BBF7D0; }
        .stat-card.pastel-mint .stat-value { color: #166534; }
        .stat-card.pastel-mint .stat-label { color: #4B5563; }
        .stat-card.pastel-yellowgreen { background: #E9F5DB; border: 1px solid #D4E8B3; }
        .stat-card.pastel-yellowgreen .stat-value { color: #3D5C1A; }
        .stat-card.pastel-yellowgreen .stat-label { color: #5A7C2E; }
        .stat-card.pastel-coral { background: #FFEDD5; border: 1px solid #FED7AA; }
        .stat-card.pastel-coral .stat-value { color: #9A3412; }
        .stat-card.pastel-coral .stat-label { color: #C2410C; }

        /* Status Overview */
        .status-overview {
          background: white;
          border-radius: 28px;
          padding: 24px;
          border: 1px solid #C8E6C9;
          margin-bottom: 28px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .status-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .status-header h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #166534;
          margin: 0;
          font-size: 18px;
          font-weight: 700;
        }
        .status-subtitle {
          font-size: 13px;
          color: #64748B;
        }
        .status-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }
        .status-item {
          text-align: center;
          padding: 16px;
          border-radius: 20px;
          transition: all 0.2s;
        }
        .status-item.critical { background: #FEF2F2; border: 1px solid #FEE2E2; }
        .status-item.warning { background: #FFFBEB; border: 1px solid #FEF3C7; }
        .status-item.good { background: #F0FDF4; border: 1px solid #DCFCE7; }
        .status-item.no-data { background: #F9FAFB; border: 1px solid #E5E7EB; }
        .status-count {
          font-size: 32px;
          font-weight: 800;
          margin-bottom: 8px;
        }
        .status-item.critical .status-count { color: #DC2626; }
        .status-item.warning .status-count { color: #F59E0B; }
        .status-item.good .status-count { color: #14B89D; }
        .status-item.no-data .status-count { color: #94A3B8; }
        .status-label {
          font-weight: 600;
          font-size: 13px;
          margin-bottom: 4px;
        }
        .status-desc {
          font-size: 11px;
          color: #64748B;
        }

        /* Table Card */
        .table-card {
          background: white;
          border-radius: 28px;
          padding: 24px;
          border: 1px solid #C8E6C9;
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
        .view-all-link {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #14B89D;
          text-decoration: none;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
        }
        .view-all-link:hover {
          color: #0F5C4B;
        }
        .table-container {
          overflow-x: auto;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th {
          text-align: left;
          padding: 14px 16px;
          background: #F0FDF4;
          color: #0F5C4B;
          font-weight: 700;
          border-bottom: 2px solid #D4E8B3;
          font-size: 14px;
        }
        td {
          padding: 12px 16px;
          border-bottom: 1px solid #E6F7F3;
          font-size: 14px;
        }
        .rank {
          font-weight: 800;
          font-size: 14px;
        }
        .rank-1 { color: #F59E0B; }
        .rank-2 { color: #94A3B8; }
        .rank-3 { color: #CD7F32; }
        .amount {
          font-weight: 700;
          color: #0F5C4B;
        }
        .status-badge {
          padding: 4px 12px;
          border-radius: 40px;
          font-size: 12px;
          font-weight: 600;
          display: inline-block;
        }
        .status-badge.critical { background: #FEE2E2; color: #DC2626; }
        .status-badge.warning { background: #FEF3C7; color: #F59E0B; }
        .status-badge.good { background: #DCFCE7; color: #14B89D; }
        .status-badge.no-data { background: #F3F4F6; color: #6B7280; }

        /* Bottom Section */
        .bottom-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
          margin-bottom: 28px;
        }
        .activity-card, .actions-card {
          background: white;
          border-radius: 28px;
          padding: 24px;
          border: 1px solid #C8E6C9;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .activity-badge {
          background: #14B89D;
          color: white;
          padding: 4px 12px;
          border-radius: 40px;
          font-size: 12px;
          font-weight: 600;
        }
        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 280px;
          overflow-y: auto;
        }
        .empty-activity {
          text-align: center;
          padding: 40px;
          color: #94A3B8;
        }
        .activity-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #F9FAFB;
          border-radius: 20px;
          transition: all 0.2s;
        }
        .activity-item:hover {
          background: #E9F5DB;
        }
        .activity-icon {
          width: 36px;
          height: 36px;
          background: white;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #14B89D;
        }
        .activity-details {
          flex: 1;
        }
        .activity-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
          flex-wrap: wrap;
        }
        .activity-title strong {
          font-size: 14px;
          color: #1F2937;
        }
        .activity-type {
          font-size: 10px;
          padding: 2px 8px;
          background: #E6F7F3;
          border-radius: 40px;
          color: #0F5C4B;
          font-weight: 600;
        }
        .activity-meta {
          font-size: 11px;
          color: #64748B;
        }
        .actions-card h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #166534;
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 700;
        }
        .actions-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }
        .action-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #F9FAFB;
          border: 1px solid #E5E7EB;
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
          width: 100%;
          color: #1F2937;
        }
        .action-btn:hover {
          background: #E9F5DB;
          transform: translateY(-2px);
          border-color: #D4E8B3;
        }
        .action-btn strong {
          display: block;
          font-size: 13px;
          color: #166534;
          margin-bottom: 2px;
        }
        .action-btn p {
          margin: 0;
          font-size: 10px;
          color: #6B7280;
        }
        .combined-btn {
          background: linear-gradient(135deg, #E9F5DB, #D6F4EE);
          border-color: #C8E6C9;
        }

        /* Footer */
        .footer-info {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          background: white;
          padding: 14px 24px;
          border-radius: 24px;
          border: 1px solid #C8E6C9;
          font-size: 12px;
          color: #4B5563;
          flex-wrap: wrap;
        }
        .info-text {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .dashboard-main { margin-left: 0; padding: 20px; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .status-cards { grid-template-columns: repeat(2, 1fr); }
          .bottom-section { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .stats-grid { grid-template-columns: 1fr; }
          .status-cards { grid-template-columns: 1fr; }
          .actions-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}