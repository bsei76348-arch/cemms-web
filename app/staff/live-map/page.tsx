'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import StaffSidebar from '@/app/lib/StaffSidebar';
import { Map, MapPin, Palette, RefreshCw, TrendingUp, AlertTriangle, CheckCircle, Calendar } from 'lucide-react';

// ALL 16 BARANGAYS in Marilao
const barangays = [
  'Abangan Norte', 'Abangan Sur', 'Ibayo', 'Lambakin', 'Lias', 'Loma de Gato',
  'Nagbalon', 'Patubig', 'Poblacion I', 'Poblacion II', 'Prenza I', 'Prenza II',
  'Santa Rosa I', 'Santa Rosa II', 'Saog', 'Tabing Ilog'
];

// Normalize barangay name
const normalizeBarangayName = (name: string): string => {
  const mapping: Record<string, string> = {
    'Poblacion 1': 'Poblacion I', 'Poblacion 2': 'Poblacion II',
    'Prenza 1': 'Prenza I', 'Prenza 2': 'Prenza II',
    'Santa Rosa 1': 'Santa Rosa I', 'Santa Rosa 2': 'Santa Rosa II',
    'Loma De Gato': 'Loma de Gato'
  };
  return mapping[name.trim()] || name.trim();
};

const defaultEmissions: Record<string, number> = {};
barangays.forEach(b => { defaultEmissions[b] = 0; });

const getEmissionColor = (emission: number) => {
  if (emission === 0) return '#9CA3AF';
  if (emission >= 2000) return '#991B1B';
  if (emission >= 1000) return '#DC2626';
  if (emission >= 700) return '#F97316';
  if (emission >= 500) return '#F59E0B';
  if (emission >= 300) return '#84CC16';
  return '#14B89D'; // teal for very low
};

const getEmissionLevel = (emission: number): string => {
  if (emission === 0) return 'No Data';
  if (emission >= 2000) return 'Critical';
  if (emission >= 1000) return 'Very High';
  if (emission >= 700) return 'High';
  if (emission >= 500) return 'Medium';
  if (emission >= 300) return 'Low';
  return 'Very Low';
};

// Barangay positions on the map (adjust these percentages to match your map)
const getBarangayPosition = (barangay: string): { x: string, y: string } => {
  const positions: Record<string, { x: string, y: string }> = {
    'Abangan Norte': { x: '14%', y: '55%' },
    'Abangan Sur': { x: '23%', y: '58%' },
    'Ibayo': { x: '33%', y: '70%' },
    'Lambakin': { x: '47%', y: '54%' },
    'Lias': { x: '41%', y: '65%' },
    'Loma de Gato': { x: '80%', y: '25%' },
    'Nagbalon': { x: '22%', y: '80%' },
    'Patubig': { x: '35%', y: '42%' },
    'Poblacion I': { x: '25%', y: '70%' },
    'Poblacion II': { x: '25%', y: '66%' },
    'Prenza I': { x: '58%', y: '28%' },
    'Prenza II': { x: '61%', y: '37%' },
    'Santa Rosa I': { x: '44%', y: '46%' },
    'Santa Rosa II': { x: '45%', y: '32%' },
    'Saog': { x: '34%', y: '57%' },
    'Tabing Ilog': { x: '30%', y: '50%' }
  };
  return positions[barangay] || { x: '50%', y: '50%' };
};

export default function StaffLiveMap() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [emissions, setEmissions] = useState<Record<string, number>>(defaultEmissions);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNumbersAlways, setShowNumbersAlways] = useState(false);
  const router = useRouter();

  const fetchAllEmissions = async () => {
    setIsRefreshing(true);
    try {
      const barangayEmissions: Record<string, number> = {};
      barangays.forEach(b => { barangayEmissions[b] = 0; });

      // 1. Calculations
      const calculationsSnap = await getDocs(collection(mobileDb, 'calculations'));
      calculationsSnap.forEach(doc => {
        const data = doc.data();
        const barangay = normalizeBarangayName(data.barangay || '');
        const amount = Number(data.dailyCarbon || data.carbonAmount || 0);
        if (barangayEmissions[barangay] !== undefined) barangayEmissions[barangay] += amount;
      });

      // 2. Bills
      const billsSnap = await getDocs(collection(mobileDb, 'bills'));
      billsSnap.forEach(doc => {
        const data = doc.data();
        const barangay = normalizeBarangayName(data.barangay || '');
        const amount = Number(data.carbonEmission || data.carbonAmount || 0);
        if (barangayEmissions[barangay] !== undefined) barangayEmissions[barangay] += amount;
      });

      // 3. Emissions (web inputs)
      const emissionsSnap = await getDocs(collection(webCemmsDb, 'emissions'));
      emissionsSnap.forEach(doc => {
        const data = doc.data();
        const barangay = normalizeBarangayName(data.barangay || '');
        const amount = Number(data.carbonAmount || data.amount || 0);
        if (barangayEmissions[barangay] !== undefined) barangayEmissions[barangay] += amount;
      });

      Object.keys(barangayEmissions).forEach(key => {
        barangayEmissions[key] = Math.round(barangayEmissions[key]);
      });

      setEmissions(barangayEmissions);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching emissions:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Real-time listeners
  useEffect(() => {
    fetchAllEmissions();
    const unsubCalc = onSnapshot(collection(db, 'calculations'), () => fetchAllEmissions());
    const unsubBills = onSnapshot(collection(db, 'bills'), () => fetchAllEmissions());
    const unsubEmissions = onSnapshot(collection(db, 'emissions'), () => fetchAllEmissions());
    return () => { unsubCalc(); unsubBills(); unsubEmissions(); };
  }, []);

  // Auth
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUser(user);
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

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FDF9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <RefreshCw size={48} className="animate-spin" color="#14B89D" />
      </div>
    );
  }

  const userName = user?.email?.split('@')[0] || 'Staff';
  const total = Object.values(emissions).reduce((a, b) => a + b, 0);
  const average = Math.round(total / barangays.length);
  const activeBarangays = Object.values(emissions).filter(v => v > 0).length;
  let highest = { name: '', value: 0 };
  let lowest = { name: '', value: Infinity };
  Object.entries(emissions).forEach(([name, val]) => {
    if (val > highest.value) { highest = { name, value: val }; }
    if (val > 0 && val < lowest.value) { lowest = { name, value: val }; }
  });

  return (
    <div style={{ display: 'flex', background: '#F8FDF9', minHeight: '100vh' }}>
      <StaffSidebar userName={userName} />

      <div className="main-content">
        {/* Header Card – Teal Green */}
        <div className="header-card">
          <div>
            <h1><Map className="inline mr-2" size={28} /> Emission Map</h1>
            <p>Real-time carbon emissions per barangay – Municipality of Marilao (Staff View)</p>
          </div>
          <div className="header-actions">
            <button className="icon-btn" onClick={fetchAllEmissions} disabled={isRefreshing}>
              <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} /> Sync
            </button>
            <div className="staff-badge"><span className="live-dot"></span> STAFF</div>
            <div className="date-badge"><Calendar size={14} /> {new Date().toLocaleDateString()}</div>
          </div>
        </div>

        {/* Stats Cards – Pastel variants */}
        <div className="stats-grid">
          <div className="stat-card pastel-teal">
            <div className="stat-icon"><TrendingUp size={22} /></div>
            <div className="stat-content">
              <div className="stat-value">{total.toLocaleString()} kg</div>
              <div className="stat-label">Total CO₂</div>
            </div>
          </div>
          <div className="stat-card pastel-mint">
            <div className="stat-icon"><MapPin size={22} /></div>
            <div className="stat-content">
              <div className="stat-value">{activeBarangays}/{barangays.length}</div>
              <div className="stat-label">Active Barangays</div>
            </div>
          </div>
          <div className="stat-card pastel-yellowgreen">
            <div className="stat-icon"><AlertTriangle size={22} /></div>
            <div className="stat-content">
              <div className="stat-value">{average.toLocaleString()} kg</div>
              <div className="stat-label">Average / Barangay</div>
            </div>
          </div>
          <div className="stat-card pastel-coral">
            <div className="stat-icon"><CheckCircle size={22} /></div>
            <div className="stat-content">
              <div className="stat-value">{highest.value > 0 ? highest.name : '—'}</div>
              <div className="stat-label">Highest Emission</div>
              {highest.value > 0 && <div className="stat-sub">{highest.value.toLocaleString()} kg</div>}
            </div>
          </div>
        </div>

        {/* Map + Legend */}
        <div className="map-wrapper">
          <div className="map-container">
            <div className="map-header">
              <div>
                <h2><MapPin size={18} /> Barangay Emissions Map</h2>
              </div>
              <div className="map-controls">
                {/* Toggle Switch */}
                <label className="toggle-switch">
                  <span className="toggle-label">Always show values</span>
                  <input
                    type="checkbox"
                    checked={showNumbersAlways}
                    onChange={(e) => setShowNumbersAlways(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <div className="last-updated">Last updated: {lastUpdated.toLocaleTimeString()}</div>
              </div>
            </div>
            <div className="map-visualization">
              <img src="/MAP.png" alt="Marilao Municipality Map" className="map-image" />
              {barangays.map((name) => {
                const emission = emissions[name] || 0;
                const borderColor = getEmissionColor(emission);
                const level = getEmissionLevel(emission);
                const position = getBarangayPosition(name);
                return (
                  <div
                    key={name}
                    className="barangay-marker"
                    style={{
                      left: position.x,
                      top: position.y,
                      borderColor: borderColor
                    }}
                    onClick={() => alert(`${name}\nCO₂: ${emission.toLocaleString()} kg\nLevel: ${level}`)}
                  >
                    <div className="marker-content">
                      <div className="marker-name">{name}</div>
                      {showNumbersAlways ? (
                        <div className="marker-always-details">
                          <span className="marker-value">{emission.toLocaleString()} kg</span>
                          <span className="marker-level">{level}</span>
                        </div>
                      ) : (
                        <div className="marker-hover-details">
                          <span className="marker-value">{emission.toLocaleString()} kg</span>
                          <span className="marker-level">{level}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="map-note">
              💡 {showNumbersAlways ? "Emission values are always shown." : "Hover over markers to see emission values."} Click for full details.
            </div>
          </div>

          <div className="legend-panel">
            <h3><Palette size={18} /> Emission Legend</h3>
            <div className="legend-items">
              <div className="legend-item"><div className="color-dot" style={{ background: '#9CA3AF' }}></div><span>No Data (0 kg)</span></div>
              <div className="legend-item"><div className="color-dot" style={{ background: '#14B89D' }}></div><span>Very Low (1–299 kg)</span></div>
              <div className="legend-item"><div className="color-dot" style={{ background: '#84CC16' }}></div><span>Low (300–499 kg)</span></div>
              <div className="legend-item"><div className="color-dot" style={{ background: '#F59E0B' }}></div><span>Medium (500–699 kg)</span></div>
              <div className="legend-item"><div className="color-dot" style={{ background: '#F97316' }}></div><span>High (700–999 kg)</span></div>
              <div className="legend-item"><div className="color-dot" style={{ background: '#DC2626' }}></div><span>Very High (1,000–1,999 kg)</span></div>
              <div className="legend-item"><div className="color-dot" style={{ background: '#991B1B' }}></div><span>Critical (≥2,000 kg)</span></div>
            </div>
            <div className="summary-box">
              <h4>📊 Municipal Summary</h4>
              <div className="summary-row"><span>Total Emissions:</span><strong>{total.toLocaleString()} kg</strong></div>
              <div className="summary-row"><span>Average:</span><strong>{average.toLocaleString()} kg</strong></div>
              {highest.value > 0 && <div className="summary-row"><span>Highest:</span><strong>{highest.name} ({highest.value.toLocaleString()} kg)</strong></div>}
              {lowest.value !== Infinity && <div className="summary-row"><span>Lowest (active):</span><strong>{lowest.name} ({lowest.value.toLocaleString()} kg)</strong></div>}
              <div className="summary-row"><span>Active Barangays:</span><strong>{activeBarangays} / {barangays.length}</strong></div>
            </div>
            <div className="watermark">🗺️ MENRO Marilao · Real-time Carbon Map (Staff)</div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        .animate-spin { animation: spin 1s linear infinite; }

        .main-content {
          flex: 1;
          margin-left: 280px;
          padding: 28px 36px;
          background: #F8FDF9;
          min-height: 100vh;
        }

        /* Header Card – Teal */
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
          display: flex;
          align-items: center;
          gap: 10px;
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
        }
        .icon-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          border: 1px solid #9FE5D5;
          padding: 8px 20px;
          border-radius: 44px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          color: #0F5C4B;
          font-weight: 500;
        }
        .icon-btn:hover { background: #E6F7F3; transform: translateY(-1px); }
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
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5; transform:scale(1.2)} }
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

        /* Stats Cards – Pastel variants */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
          margin-bottom: 28px;
        }
        .stat-card {
          padding: 20px 24px;
          border-radius: 24px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 18px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(0,0,0,0.08); }
        .stat-icon {
          width: 52px;
          height: 52px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .stat-value { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
        .stat-label { font-size: 13px; font-weight: 500; }
        .stat-sub { font-size: 11px; margin-top: 4px; opacity: 0.8; }

        .pastel-teal { background: #D6F4EE; border: 1px solid #9FE5D5; }
        .pastel-teal .stat-icon { background: white; color: #0F5C4B; }
        .pastel-teal .stat-value { color: #0F5C4B; }
        .pastel-teal .stat-label { color: #3B7A6A; }

        .pastel-mint { background: #DCFCE7; border: 1px solid #BBF7D0; }
        .pastel-mint .stat-icon { background: white; color: #166534; }
        .pastel-mint .stat-value { color: #166534; }
        .pastel-mint .stat-label { color: #4B5563; }

        .pastel-yellowgreen { background: #E9F5DB; border: 1px solid #D4E8B3; }
        .pastel-yellowgreen .stat-icon { background: white; color: #3D5C1A; }
        .pastel-yellowgreen .stat-value { color: #3D5C1A; }
        .pastel-yellowgreen .stat-label { color: #5A7C2E; }

        .pastel-coral { background: #FFEDD5; border: 1px solid #FED7AA; }
        .pastel-coral .stat-icon { background: white; color: #9A3412; }
        .pastel-coral .stat-value { color: #9A3412; }
        .pastel-coral .stat-label { color: #C2410C; }

        /* Map containers */
        .map-wrapper {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 28px;
        }
        .map-container {
          background: white;
          border-radius: 28px;
          padding: 24px;
          border: 1px solid #C8E6C9;
          box-shadow: 0 4px 12px rgba(0,0,0,0.04);
        }
        .map-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 20px;
        }
        .map-controls {
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        .toggle-switch {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          font-size: 13px;
          color: #166534;
          font-weight: 500;
        }
        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
          position: absolute;
        }
        .toggle-slider {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
          background-color: #ccc;
          border-radius: 24px;
          transition: 0.2s;
        }
        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 20px;
          width: 20px;
          left: 2px;
          bottom: 2px;
          background-color: white;
          border-radius: 50%;
          transition: 0.2s;
        }
        .toggle-switch input:checked + .toggle-slider {
          background-color: #14B89D;
        }
        .toggle-switch input:checked + .toggle-slider:before {
          transform: translateX(20px);
        }
        .map-header h2 {
          margin: 0;
          color: #166534;
          font-size: 18px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .last-updated {
          font-size: 12px;
          color: #94A3B8;
        }
        .map-visualization {
          position: relative;
          width: 100%;
          height: auto;
          border-radius: 20px;
          overflow: hidden;
          border: 2px solid #C8E6C9;
          background: #f0f0f0;
        }
        .map-image {
          width: 100%;
          height: auto;
          display: block;
          object-fit: contain;
        }
        /* Markers */
        .barangay-marker {
          position: absolute;
          transform: translate(-50%, -50%);
          background: white;
          border: 3px solid;
          border-radius: 14px;
          padding: 6px 29px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          min-width: 70px;
          text-align: center;
          z-index: 10;
          white-space: nowrap;
        }
        .barangay-marker:hover {
          transform: translate(-50%, -50%) scale(1.05);
          box-shadow: 0 6px 16px rgba(0,0,0,0.2);
          z-index: 20;
          background: white;
        }
        .marker-content {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .marker-name {
          font-size: 11px;
          font-weight: 800;
          color: #1F2937;
          transition: all 0.2s;
        }
        /* For hover mode: hidden by default, shown on hover */
        .marker-hover-details {
          display: none;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          margin-top: 4px;
        }
        .barangay-marker:hover .marker-hover-details {
          display: flex;
        }
        /* For always-show mode: always visible */
        .marker-always-details {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          margin-top: 4px;
        }
        .marker-value {
          font-size: 10px;
          font-weight: 700;
          color: #0F5C4B;
        }
        .marker-level {
          font-size: 9px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 12px;
          background: #E6F7F3;
          color: #0F5C4B;
        }
        .map-note {
          margin-top: 20px;
          padding: 14px;
          background: #E9F5DB;
          border-radius: 20px;
          font-size: 13px;
          color: #3D5C1A;
          text-align: center;
          border-left: 4px solid #14B89D;
        }

        /* Legend Panel */
        .legend-panel {
          background: white;
          border-radius: 28px;
          padding: 24px;
          border: 1px solid #C8E6C9;
          box-shadow: 0 4px 12px rgba(0,0,0,0.04);
        }
        .legend-panel h3 {
          margin: 0 0 20px 0;
          color: #166534;
          font-size: 18px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .legend-items {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 28px;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          color: #4B5563;
        }
        .color-dot {
          width: 24px;
          height: 24px;
          border-radius: 8px;
        }
        .summary-box {
          background: #F9FAFB;
          border-radius: 20px;
          padding: 18px;
          margin-top: 20px;
        }
        .summary-box h4 {
          margin: 0 0 12px 0;
          color: #166534;
          font-size: 15px;
          font-weight: 700;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          font-size: 13px;
        }
        .summary-row strong {
          color: #1F2937;
        }
        .watermark {
          text-align: center;
          margin-top: 20px;
          font-size: 10px;
          color: #94A3B8;
        }

        @media (max-width: 1024px) {
          .main-content { margin-left: 0; padding: 20px; }
          .stats-grid { grid-template-columns: repeat(2,1fr); }
          .map-wrapper { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .stats-grid { grid-template-columns: 1fr; }
          .map-header { flex-direction: column; align-items: stretch; }
          .map-controls { justify-content: space-between; }
        }
      `}</style>
    </div>
  );
}