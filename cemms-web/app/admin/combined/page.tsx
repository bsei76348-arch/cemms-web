// app/admin/combined/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { auth, originalDb, webCemmsDb, wasteWatchDb } from '@/app/lib/combinedFirebase';
import { collection, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import {
  ArrowLeft, Leaf, Recycle, TrendingUp, Calendar, Trash2, RefreshCw,
  Download, Maximize2, Minimize2, Plus, MapPin, Package, Search,
  AlertCircle, Database, Edit, Globe, BarChart3, PieChart, X,
  CheckCircle, Info, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, Smartphone, Monitor
} from 'lucide-react';
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend, CategoryScale, LinearScale,
  BarElement, Title, Filler
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, Filler);

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
  source: string;
  type: string;
  date: Date;
  collectionName?: string;
  dbInstance?: 'web' | 'mobile'; // to know which database to delete/update
}

interface WasteRecord {
  id: string;
  barangay: string;
  totalWaste: number;
  biodegradable: number;
  nonBiodegradable: number;
  recyclable: number;
  residual: number;
  date: Date;
}

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

type SortDirection = 'asc' | 'desc';
type SortField = 'barangay' | 'amount' | 'type' | 'date' | 'totalWaste' | 'biodegradable' | 'nonBiodegradable' | 'recyclable' | 'residual';

const safeToDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (value && typeof value.toDate === 'function') return value.toDate();
  if (value && typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) return date;
  }
  return new Date();
};

const safeReduce = <T,>(arr: T[], reducer: (acc: number, item: T) => number, initial: number = 0): number => {
  if (!arr.length) return initial;
  return arr.reduce(reducer, initial);
};

export default function CombinedDashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [cemmsRecords, setCemmsRecords] = useState<CEMMSRecord[]>([]);
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editType, setEditType] = useState<'cemms' | 'waste'>('cemms');
  const [addType, setAddType] = useState<'emission' | 'waste'>('waste');
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const [wastePage, setWastePage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [wasteSortField, setWasteSortField] = useState<SortField>('date');
  const [wasteSortDir, setWasteSortDir] = useState<SortDirection>('desc');
  
  const [webCemmsPage, setWebCemmsPage] = useState(1);
  const [mobileCemmsPage, setMobileCemmsPage] = useState(1);
  
  const [webSortField, setWebSortField] = useState<SortField>('date');
  const [webSortDir, setWebSortDir] = useState<SortDirection>('desc');
  const [mobileSortField, setMobileSortField] = useState<SortField>('date');
  const [mobileSortDir, setMobileSortDir] = useState<SortDirection>('desc');
  
  const [emissionForm, setEmissionForm] = useState({
    barangay: '',
    amount: '',
    customType: 'Web Input'
  });
  const [wasteForm, setWasteForm] = useState({
    barangay: '',
    biodegradable: '',
    nonBiodegradable: '',
    recyclable: '',
    residual: ''
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: string; id: string; collectionName?: string; dbInstance?: 'web' | 'mobile' } | null>(null);
  const [activeTableTab, setActiveTableTab] = useState<'cemms' | 'waste'>('waste');
  const [cemmsSearch, setCemmsSearch] = useState('');
  const [wasteSearch, setWasteSearch] = useState('');
  const [cemmsFilterBarangay, setCemmsFilterBarangay] = useState('all');
  const [wasteFilterBarangay, setWasteFilterBarangay] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'week' | 'month'>('all');
  
  const [stats, setStats] = useState({
    totalEmissions: 0,
    totalWaste: 0,
    cemmsCount: 0,
    wasteCount: 0,
    previousEmissions: 0,
    previousWaste: 0
  });

  const router = useRouter();

  const addToast = (type: Toast['type'], message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser: any) => {
      if (firebaseUser) {
        setUser(firebaseUser);
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
              setInitialLoad(false);
              return;
            } catch {}
          }
        }
        router.push('/login');
      }
      setLoading(false);
      setInitialLoad(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 1. Mobile emissions from original database (calculations collection)
      const mobileSnapshot = await getDocs(collection(originalDb, 'calculations'));
      // 2. Web emissions from new database (emissions collection)
      const webSnapshot = await getDocs(collection(webCemmsDb, 'emissions'));
      
      const cemmsList: CEMMSRecord[] = [];
      let totalEmissions = 0;
      let previousEmissions = 0;
      const now = new Date();
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(now.getMonth() - 1);
      
      // Mobile app records (originalDb / calculations)
      mobileSnapshot.forEach(doc => {
        const data = doc.data();
        const amount = Number(data.dailyCarbon || data.carbonAmount || 0);
        let date = safeToDate(data.timestamp);
        if (date.getFullYear() === 1970) date = safeToDate(data.date);
        if (date.getFullYear() === 1970) date = safeToDate(data.createdAt);
        
        if (amount > 0 && data.barangay) {
          totalEmissions += amount;
          if (date >= oneMonthAgo) previousEmissions += amount;
          cemmsList.push({
            id: doc.id,
            barangay: data.barangay,
            amount,
            source: 'Mobile App',
            type: 'App Input',
            date,
            collectionName: 'calculations',
            dbInstance: 'mobile'
          });
        }
      });
      
      // Web app records (webCemmsDb / emissions)
      webSnapshot.forEach(doc => {
        const data = doc.data();
        const amount = Number(data.carbonAmount || data.amount || 0);
        const date = safeToDate(data.createdAt);
        if (amount > 0 && data.barangay) {
          totalEmissions += amount;
          if (date >= oneMonthAgo) previousEmissions += amount;
          cemmsList.push({
            id: doc.id,
            barangay: data.barangay,
            amount,
            source: 'Web App',
            type: 'Web Input',
            date,
            collectionName: 'emissions',
            dbInstance: 'web'
          });
        }
      });
      
      cemmsList.sort((a, b) => b.date.getTime() - a.date.getTime());
      setCemmsRecords(cemmsList);
      
      // Waste records (still from original database)
      const wasteSnapshot = await getDocs(collection(originalDb, 'waste_records'));
      const wasteList: WasteRecord[] = [];
      let totalWaste = 0;
      let previousWaste = 0;
      
      wasteSnapshot.forEach(doc => {
        const data = doc.data();
        const barangay = data.barangay;
        if (!barangay) return;
        
        const biodegradable = Number(data.biodegradable) || 0;
        const nonBiodegradable = Number(data.nonBiodegradable) || 0;
        const recyclable = Number(data.recyclable) || 0;
        const residual = Number(data.residual) || 0;
        const computedTotal = biodegradable + nonBiodegradable + recyclable + residual;
        const storedTotal = Number(data.totalWaste) || 0;
        const total = computedTotal > 0 ? computedTotal : storedTotal;
        
        if (total === 0) return;
        
        const date = safeToDate(data.date || data.createdAt || data.timestamp);
        totalWaste += total;
        if (date >= oneMonthAgo) previousWaste += total;
        
        wasteList.push({
          id: doc.id,
          barangay,
          totalWaste: total,
          biodegradable,
          nonBiodegradable,
          recyclable,
          residual,
          date
        });
      });
      
      wasteList.sort((a, b) => b.date.getTime() - a.date.getTime());
      setWasteRecords(wasteList);
      
      setStats({
        totalEmissions: Math.round(totalEmissions),
        totalWaste: Math.round(totalWaste),
        cemmsCount: cemmsList.length,
        wasteCount: wasteList.length,
        previousEmissions: Math.round(previousEmissions),
        previousWaste: Math.round(previousWaste)
      });
      setLastSync(new Date());
      addToast('success', 'Data synced from two databases');
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Error fetching data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyDatePreset = (preset: 'all' | 'today' | 'week' | 'month') => {
    setDatePreset(preset);
    const now = new Date();
    let start = '';
    let end = '';
    if (preset === 'today') {
      start = now.toISOString().split('T')[0];
      end = start;
    } else if (preset === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      start = weekAgo.toISOString().split('T')[0];
      end = new Date().toISOString().split('T')[0];
    } else if (preset === 'month') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(now.getMonth() - 1);
      start = monthAgo.toISOString().split('T')[0];
      end = new Date().toISOString().split('T')[0];
    }
    setDateRange({ start, end });
  };

  const handleAddRecord = async () => {
    if (addType === 'emission') {
      const amount = parseFloat(emissionForm.amount);
      if (!emissionForm.barangay || isNaN(amount) || amount <= 0) {
        addToast('error', 'Please fill in barangay and valid CO₂ amount');
        return;
      }
      setSubmitting(true);
      try {
        // Add to the NEW web database (webCemmsDb)
        await addDoc(collection(webCemmsDb, 'emissions'), {
          barangay: emissionForm.barangay,
          carbonAmount: amount,
          amount: amount,
          source: 'Web App',
          customType: 'Web Input',
          createdAt: serverTimestamp(),
          submittedBy: user?.email
        });
        addToast('success', 'Emission record added to Web DB');
        setShowAddModal(false);
        setEmissionForm({ barangay: '', amount: '', customType: 'Web Input' });
        await fetchAllData();
      } catch (err: any) {
        addToast('error', 'Error: ' + err.message);
      } finally {
        setSubmitting(false);
      }
    } else {
      const b = parseFloat(wasteForm.biodegradable) || 0;
      const nb = parseFloat(wasteForm.nonBiodegradable) || 0;
      const r = parseFloat(wasteForm.recyclable) || 0;
      const rs = parseFloat(wasteForm.residual) || 0;
      const total = b + nb + r + rs;
      if (!wasteForm.barangay || total === 0) {
        addToast('error', 'Please fill in barangay and at least one waste amount');
        return;
      }
      setSubmitting(true);
      try {
        // Waste records still in original database
        await addDoc(collection(originalDb, 'waste_records'), {
          barangay: wasteForm.barangay,
          biodegradable: b,
          nonBiodegradable: nb,
          recyclable: r,
          residual: rs,
          totalWaste: total,
          date: new Date().toISOString().split('T')[0],
          timestamp: new Date().toISOString(),
          createdAt: serverTimestamp(),
          submittedBy: user?.email
        });
        addToast('success', 'Waste record added');
        setShowAddModal(false);
        setWasteForm({
          barangay: '', biodegradable: '', nonBiodegradable: '', recyclable: '', residual: ''
        });
        await fetchAllData();
      } catch (err: any) {
        addToast('error', 'Error: ' + err.message);
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleEditRecord = async () => {
    if (!editingRecord) return;
    setSubmitting(true);
    try {
      if (editType === 'cemms') {
        const amount = parseFloat(emissionForm.amount);
        if (isNaN(amount) || amount <= 0) {
          addToast('error', 'Invalid amount');
          return;
        }
        // Determine which database to update
        const db = editingRecord.dbInstance === 'web' ? webCemmsDb : originalDb;
        const collectionName = editingRecord.collectionName || (editingRecord.dbInstance === 'web' ? 'emissions' : 'calculations');
        await updateDoc(doc(db, collectionName, editingRecord.id), {
          barangay: emissionForm.barangay,
          carbonAmount: amount,
          amount: amount,
          customType: editingRecord.dbInstance === 'web' ? 'Web Input' : 'App Input',
          updatedAt: serverTimestamp()
        });
        addToast('success', 'Emission updated');
      } else {
        const b = parseFloat(wasteForm.biodegradable) || 0;
        const nb = parseFloat(wasteForm.nonBiodegradable) || 0;
        const r = parseFloat(wasteForm.recyclable) || 0;
        const rs = parseFloat(wasteForm.residual) || 0;
        const total = b + nb + r + rs;
        await updateDoc(doc(originalDb, 'waste_records', editingRecord.id), {
          barangay: wasteForm.barangay,
          biodegradable: b,
          nonBiodegradable: nb,
          recyclable: r,
          residual: rs,
          totalWaste: total,
          updatedAt: serverTimestamp()
        });
        addToast('success', 'Waste updated');
      }
      setShowEditModal(false);
      await fetchAllData();
    } catch (err: any) {
      addToast('error', 'Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (!showDeleteConfirm) return;
    try {
      if (showDeleteConfirm.type === 'cemms') {
        const db = showDeleteConfirm.dbInstance === 'web' ? webCemmsDb : originalDb;
        await deleteDoc(doc(db, showDeleteConfirm.collectionName || 'emissions', showDeleteConfirm.id));
      } else {
        await deleteDoc(doc(originalDb, 'waste_records', showDeleteConfirm.id));
      }
      setShowDeleteConfirm(null);
      await fetchAllData();
      addToast('success', 'Record deleted');
    } catch (err: any) {
      addToast('error', 'Error: ' + err.message);
    }
  };

  const openEditModal = (type: 'cemms' | 'waste', record: any) => {
    setEditType(type);
    setEditingRecord(record);
    if (type === 'waste') {
      setWasteForm({
        barangay: record.barangay,
        biodegradable: record.biodegradable.toString(),
        nonBiodegradable: record.nonBiodegradable.toString(),
        recyclable: record.recyclable.toString(),
        residual: record.residual.toString()
      });
    } else {
      setEmissionForm({
        barangay: record.barangay,
        amount: record.amount.toString(),
        customType: record.type
      });
    }
    setShowEditModal(true);
  };

  const exportData = (format: 'json' | 'csv') => {
    const exportObj = {
      cemms: { records: cemmsRecords, totalEmissions: stats.totalEmissions },
      waste: { records: wasteRecords, totalWaste: stats.totalWaste },
      exportedAt: new Date().toISOString()
    };
    
    if (format === 'csv') {
      const cemmsRows = cemmsRecords.map(r => `${r.barangay},${r.amount},${r.type},${r.source},${r.date.toISOString()}`).join('\n');
      const wasteRows = wasteRecords.map(r => `${r.barangay},${r.totalWaste},${r.biodegradable},${r.nonBiodegradable},${r.recyclable},${r.residual},${r.date.toISOString()}`).join('\n');
      const csv = `CEMMS Records\nBarangay,Amount,Type,Source,Date\n${cemmsRows}\n\nWaste Records\nBarangay,Total,Biodegradable,NonBiodegradable,Recyclable,Residual,Date\n${wasteRows}`;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `combined-data-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', 'Exported as CSV');
    } else {
      const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `combined-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', 'Exported as JSON');
    }
  };

  const filterByDate = (records: any[], start: string, end: string) => {
    if (!start && !end) return records;
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;
    if (endDate) endDate.setHours(23, 59, 59);
    return records.filter(r => {
      const d = r.date;
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });
  };

  const sortRecords = <T extends CEMMSRecord | WasteRecord>(
    records: T[],
    field: SortField,
    direction: SortDirection
  ): T[] => {
    return [...records].sort((a, b) => {
      let aVal: any = a[field as keyof T];
      let bVal: any = b[field as keyof T];
      if (field === 'date') {
        aVal = a.date.getTime();
        bVal = b.date.getTime();
      }
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const filteredAllCemms = useMemo(() => {
    let filtered = filterByDate(cemmsRecords, dateRange.start, dateRange.end);
    filtered = filtered.filter(r => {
      const matchesSearch = r.barangay.toLowerCase().includes(cemmsSearch.toLowerCase()) ||
                            r.type.toLowerCase().includes(cemmsSearch.toLowerCase());
      const matchesBarangay = cemmsFilterBarangay === 'all' || r.barangay === cemmsFilterBarangay;
      return matchesSearch && matchesBarangay;
    });
    return filtered;
  }, [cemmsRecords, dateRange, cemmsSearch, cemmsFilterBarangay]);

  const webRecords = useMemo(() => filteredAllCemms.filter(r => r.source === 'Web App'), [filteredAllCemms]);
  const mobileRecords = useMemo(() => filteredAllCemms.filter(r => r.source === 'Mobile App'), [filteredAllCemms]);

  const sortedWebRecords = useMemo(() => sortRecords(webRecords, webSortField, webSortDir), [webRecords, webSortField, webSortDir]);
  const paginatedWebRecords = useMemo(() => {
    const start = (webCemmsPage - 1) * pageSize;
    return sortedWebRecords.slice(start, start + pageSize);
  }, [sortedWebRecords, webCemmsPage, pageSize]);

  const sortedMobileRecords = useMemo(() => sortRecords(mobileRecords, mobileSortField, mobileSortDir), [mobileRecords, mobileSortField, mobileSortDir]);
  const paginatedMobileRecords = useMemo(() => {
    const start = (mobileCemmsPage - 1) * pageSize;
    return sortedMobileRecords.slice(start, start + pageSize);
  }, [sortedMobileRecords, mobileCemmsPage, pageSize]);

  const filteredWaste = useMemo(() => {
    let filtered = filterByDate(wasteRecords, dateRange.start, dateRange.end);
    filtered = filtered.filter(r => {
      const matchesSearch = r.barangay.toLowerCase().includes(wasteSearch.toLowerCase());
      const matchesBarangay = wasteFilterBarangay === 'all' || r.barangay === wasteFilterBarangay;
      return matchesSearch && matchesBarangay;
    });
    return sortRecords(filtered, wasteSortField, wasteSortDir);
  }, [wasteRecords, dateRange, wasteSearch, wasteFilterBarangay, wasteSortField, wasteSortDir]);

  const paginatedWaste = useMemo(() => {
    const start = (wastePage - 1) * pageSize;
    return filteredWaste.slice(start, start + pageSize);
  }, [filteredWaste, wastePage, pageSize]);

  const emissionByBarangay = barangays.map(b =>
    safeReduce(
      cemmsRecords.filter(r => r.barangay === b),
      (sum, r) => sum + r.amount,
      0
    )
  );
  
  const barChartData = {
    labels: shortLabels,
    datasets: [{
      label: 'CO₂ Emissions (kg)',
      data: emissionByBarangay,
      backgroundColor: '#2E8B57',
      borderRadius: 8,
      barPercentage: 0.7,
      categoryPercentage: 0.8
    }]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { font: { size: 12, weight: 'bold' as const } } },
      tooltip: { backgroundColor: '#2E8B57', callbacks: { label: (ctx: any) => `${ctx.raw.toLocaleString()} kg` } }
    },
    scales: {
      x: { ticks: { font: { size: 10 }, maxRotation: 35, autoSkip: true }, grid: { display: false } },
      y: { ticks: { font: { size: 11 } }, title: { display: true, text: 'CO₂ (kg)', font: { size: 11, weight: 'bold' as const } } }
    }
  };

  const totalWasteComposition = {
    biodegradable: safeReduce(wasteRecords, (sum, r) => sum + r.biodegradable, 0),
    nonBiodegradable: safeReduce(wasteRecords, (sum, r) => sum + r.nonBiodegradable, 0),
    recyclable: safeReduce(wasteRecords, (sum, r) => sum + r.recyclable, 0),
    residual: safeReduce(wasteRecords, (sum, r) => sum + r.residual, 0)
  };
  
  const pieChartData = {
    labels: ['Biodegradable', 'Non-Biodegradable', 'Recyclable', 'Residual'],
    datasets: [{
      data: [
        totalWasteComposition.biodegradable,
        totalWasteComposition.nonBiodegradable,
        totalWasteComposition.recyclable,
        totalWasteComposition.residual
      ],
      backgroundColor: ['#2E8B57', '#F97316', '#3B82F6', '#A855F7'],
      borderWidth: 0,
      hoverOffset: 10
    }]
  };
  
  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { font: { size: 11 } } },
      tooltip: { 
        callbacks: { 
          label: (ctx: any) => {
            const val = ctx.raw;
            const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
            return `${ctx.label}: ${val.toLocaleString()} kg (${pct}%)`;
          }
        } 
      }
    },
    cutout: '55%'
  };

  const handleWasteSort = (field: SortField) => {
    if (wasteSortField === field) {
      setWasteSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setWasteSortField(field);
      setWasteSortDir('asc');
    }
  };

  const handleWebSort = (field: SortField) => {
    if (webSortField === field) {
      setWebSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setWebSortField(field);
      setWebSortDir('asc');
    }
  };

  const handleMobileSort = (field: SortField) => {
    if (mobileSortField === field) {
      setMobileSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setMobileSortField(field);
      setMobileSortDir('asc');
    }
  };

  const SortIcon = ({ field, currentField, direction }: { field: SortField; currentField: SortField; direction: SortDirection }) => {
    if (field !== currentField) return <ChevronDown size={14} className="opacity-30" />;
    return direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  if (initialLoad && loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
        <style jsx>{`
          .loading-screen {
            min-height: 100vh;
            background: #E8F5E9;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            font-family: system-ui, sans-serif;
          }
          .loading-spinner {
            width: 48px;
            height: 48px;
            border: 4px solid #C8E6C9;
            border-top-color: #2E8B57;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`combined-container ${isFullscreen ? 'fullscreen' : ''}`}>
      <style jsx>{`
        * { box-sizing: border-box; }
        .combined-container {
          min-height: 100vh;
          background: #E8F5E9;
          padding: 24px 28px;
          transition: all 0.3s ease;
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .combined-container.fullscreen {
          padding: 0;
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 2000;
          overflow-y: auto;
          background: #E8F5E9;
        }
        
        /* Toast */
        .toast-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 1100;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .toast {
          padding: 12px 20px;
          border-radius: 12px;
          background: white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 280px;
          animation: slideIn 0.3s ease;
        }
        .toast.success { border-left: 4px solid #2E8B57; }
        .toast.error { border-left: 4px solid #DC2626; }
        .toast.info { border-left: 4px solid #3B82F6; }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        /* Header */
        .combined-header {
          background: white;
          border-radius: 28px;
          padding: 20px 28px;
          margin-bottom: 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 20px;
          border: 1px solid #C8E6C9;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .back-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #2E8B57;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 40px;
          background: #E8F5E9;
          width: fit-content;
          transition: all 0.2s;
        }
        .back-btn:hover { background: #DCFCE7; transform: translateX(-2px); }
        .title-icon {
          width: 54px; height: 54px;
          background: #2E8B57;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(46,139,87,0.3);
        }
        h1 { color: #166534; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.3px; }
        .icon-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          border-radius: 40px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          background: #E8F5E9;
          border: 1px solid #C8E6C9;
          color: #166534;
          transition: all 0.2s;
        }
        .icon-btn:hover { background: #DCFCE7; border-color: #2E8B57; transform: translateY(-1px); }
        
        /* Stats Cards */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
          margin-bottom: 32px;
        }
        .stat-card {
          background: white;
          padding: 20px 24px;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 18px;
          border: 1px solid #C8E6C9;
          transition: all 0.2s;
        }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); background: #F0FDF4; }
        .stat-value { font-size: 28px; font-weight: 800; color: #166534; letter-spacing: -0.5px; }
        .trend-up { color: #2E8B57; font-size: 12px; font-weight: 600; }
        .trend-down { color: #DC2626; font-size: 12px; font-weight: 600; }
        
        /* Charts */
        .charts-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
          margin-bottom: 32px;
        }
        .chart-card {
          background: white;
          border-radius: 24px;
          padding: 20px 24px;
          border: 1px solid #C8E6C9;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .chart-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); border-color: #2E8B57; }
        
        /* Date Filter Bar */
        .date-filter-bar {
          background: white;
          border-radius: 24px;
          padding: 16px 24px;
          margin-bottom: 28px;
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
          border: 1px solid #C8E6C9;
        }
        .preset-btn {
          padding: 6px 16px;
          border-radius: 30px;
          font-size: 12px;
          font-weight: 600;
          background: #E8F5E9;
          border: 1px solid #C8E6C9;
          cursor: pointer;
          transition: all 0.2s;
          color: #166534;
        }
        .preset-btn.active { background: #2E8B57; color: white; border-color: #2E8B57; }
        .preset-btn:hover:not(.active) { background: #DCFCE7; color: #2E8B57; }
        
        /* Tables container */
        .data-table {
          background: white;
          border-radius: 24px;
          overflow: hidden;
          border: 1px solid #C8E6C9;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          margin-bottom: 32px;
        }
        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 24px;
          background: #F0FDF4;
          border-bottom: 1px solid #C8E6C9;
          flex-wrap: wrap;
          gap: 16px;
        }
        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          border: 1px solid #C8E6C9;
          border-radius: 40px;
          padding: 6px 18px;
        }
        .search-box input { border: none; outline: none; font-size: 13px; width: 180px; background: transparent; }
        .filter-select { padding: 6px 18px; border: 1px solid #C8E6C9; border-radius: 40px; background: white; font-size: 13px; cursor: pointer; }
        
        .table-wrapper { overflow-x: auto; width: 100%; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th, td { padding: 14px 12px; text-align: center; border-bottom: 1px solid #DCFCE7; }
        th:first-child, td:first-child { text-align: left; padding-left: 20px; }
        th { background: #DCFCE7; color: #166534; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.3px; cursor: pointer; user-select: none; }
        th:hover { background: #C8E6C9; }
        .amount-cell { font-weight: 800; color: #166534; }
        .type-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 40px;
          font-size: 11px;
          font-weight: 700;
        }
        .type-badge.web-input { background: #E8F5E9; color: #2E8B57; border: 1px solid #C8E6C9; }
        .type-badge.app-input { background: #E0F2FE; color: #0284C7; border: 1px solid #BAE6FD; }
        .action-buttons { display: flex; gap: 8px; justify-content: center; }
        .edit-btn, .delete-btn {
          padding: 5px 12px;
          border-radius: 30px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }
        .edit-btn { background: #E3F2FD; color: #1565C0; }
        .edit-btn:hover { background: #BBDEFB; }
        .delete-btn { background: #FEF2F2; color: #DC2626; }
        .delete-btn:hover { background: #FEE2E2; }
        
        /* Pagination */
        .pagination {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          background: #F0FDF4;
          border-top: 1px solid #C8E6C9;
          flex-wrap: wrap;
          gap: 12px;
        }
        .pagination-controls { display: flex; gap: 8px; align-items: center; }
        .page-btn {
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid #C8E6C9;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
        }
        .page-btn:hover:not(:disabled) { background: #E8F5E9; border-color: #2E8B57; }
        .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .page-number {
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
        }
        .page-number.active { background: #2E8B57; color: white; }
        
        /* Modals */
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease;
        }
        .modal-content {
          background: white;
          border-radius: 32px;
          width: 540px;
          max-width: 90%;
          max-height: 85vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease;
          border: 1px solid #C8E6C9;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        
        .toggle-btn {
          flex:1;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:8px;
          padding:12px;
          background:#E8F5E9;
          border:1px solid #C8E6C9;
          border-radius:40px;
          cursor:pointer;
          font-weight:600;
          transition: all 0.2s;
        }
        .toggle-btn.active { background:#2E8B57; color:white; border-color:#2E8B57; }
        .toggle-btn:hover:not(.active) { background:#DCFCE7; }
        .waste-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
        .total-display { background:#DCFCE7; padding:14px; border-radius:24px; text-align:center; font-weight:700; color:#2E8B57; }
        
        @media (max-width: 1000px) {
          .stats-grid { grid-template-columns: repeat(2,1fr); }
          .charts-row { grid-template-columns: 1fr; }
          .combined-container { padding: 16px; }
        }
        @media (max-width: 640px) {
          .stats-grid { grid-template-columns: 1fr; }
          .waste-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.type === 'success' && <CheckCircle size={18} color="#2E8B57" />}
            {toast.type === 'error' && <AlertCircle size={18} color="#DC2626" />}
            {toast.type === 'info' && <Info size={18} color="#3B82F6" />}
            <span>{toast.message}</span>
            <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="combined-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link href="/admin" className="back-btn"><ArrowLeft size={14} /> Back to CEMMS</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="title-icon"><TrendingUp size={28} color="white" /></div>
            <div>
              <h1>Combined Dashboard</h1>
              <p style={{ color: '#4A1D3F', margin: '6px 0 0', fontSize: 13 }}>CEMMS Carbon + Waste Watch · MENRO Marilao</p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="icon-btn" onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />} {isFullscreen ? 'Exit' : 'Fullscreen'}
          </button>
          <div className="icon-btn" style={{ position: 'relative' }}>
            <button onClick={() => exportData('json')} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 8 }}><Download size={14} /> Export</button>
          </div>
          <button className="icon-btn" onClick={fetchAllData}><RefreshCw size={14} /> Sync</button>
          <div className="icon-btn"><Calendar size={14} /> {new Date().toLocaleDateString()}</div>
        </div>
      </div>

      {/* Add Bar */}
      <div style={{ background: '#F0FDF4', borderRadius: 24, padding: '14px 24px', marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, border: '1px solid #C8E6C9' }}>
        <button onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 24px', background: '#2E8B57', color: 'white', border: 'none', borderRadius: 40, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => (e.currentTarget.style.background = '#256F45')} onMouseLeave={e => (e.currentTarget.style.background = '#2E8B57')}><Plus size={18} /> Add New Record</button>
        <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#166534' }}>
          <span><RefreshCw size={12} /> Last sync: {lastSync.toLocaleTimeString()}</span>
          <span><Leaf size={12} /> CEMMS: {stats.cemmsCount}</span>
          <span><Recycle size={12} /> Waste: {stats.wasteCount}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card"><div style={{ width: 56, height: 56, background: '#DCFCE7', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Leaf size={28} color="#2E8B57" /></div><div><div className="stat-value">{stats.totalEmissions.toLocaleString()} kg</div><div style={{ fontSize: 13, color: '#4B5563' }}>Total CO₂</div><div className={stats.totalEmissions > stats.previousEmissions ? 'trend-up' : 'trend-down'}>↗︎ {((stats.totalEmissions - stats.previousEmissions) / (stats.previousEmissions || 1) * 100).toFixed(1)}% vs last month</div></div></div>
        <div className="stat-card"><div style={{ width: 56, height: 56, background: '#DCFCE7', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Recycle size={28} color="#2E8B57" /></div><div><div className="stat-value">{stats.totalWaste.toLocaleString()} kg</div><div style={{ fontSize: 13, color: '#4B5563' }}>Total Waste</div><div className={stats.totalWaste > stats.previousWaste ? 'trend-up' : 'trend-down'}>↗︎ {((stats.totalWaste - stats.previousWaste) / (stats.previousWaste || 1) * 100).toFixed(1)}% vs last month</div></div></div>
        <div className="stat-card"><div style={{ width: 56, height: 56, background: '#DCFCE7', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Globe size={28} color="#2E8B57" /></div><div><div className="stat-value">{(stats.totalEmissions + stats.totalWaste).toLocaleString()} kg</div><div style={{ fontSize: 13, color: '#4B5563' }}>Total Impact</div></div></div>
        <div className="stat-card"><div style={{ width: 56, height: 56, background: '#DCFCE7', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Database size={28} color="#2E8B57" /></div><div><div className="stat-value">{stats.cemmsCount + stats.wasteCount}</div><div style={{ fontSize: 13, color: '#4B5563' }}>Total Records</div></div></div>
      </div>

      {/* Charts */}
      <div className="charts-row">
        <div className="chart-card"><h3 style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#166534', marginBottom: 20 }}><BarChart3 size={20} color="#2E8B57" /> CO₂ per Barangay</h3><div style={{ height: 280 }}><Bar data={barChartData} options={barOptions} /></div></div>
        <div className="chart-card"><h3 style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#166534', marginBottom: 20 }}><PieChart size={20} color="#F97316" /> Waste Composition</h3><div style={{ height: 280 }}><Pie data={pieChartData} options={pieOptions} /></div></div>
      </div>

      {/* Date Filter */}
      <div className="date-filter-bar">
        <label style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#166534' }}>Date Range:</label>
        <input type="date" value={dateRange.start} onChange={e => { setDateRange({...dateRange, start: e.target.value}); setDatePreset('all'); }} style={{ padding: '8px 16px', border: '1px solid #C8E6C9', borderRadius: 20, background: 'white' }} />
        <span>→</span>
        <input type="date" value={dateRange.end} onChange={e => { setDateRange({...dateRange, end: e.target.value}); setDatePreset('all'); }} style={{ padding: '8px 16px', border: '1px solid #C8E6C9', borderRadius: 20, background: 'white' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`preset-btn ${datePreset === 'today' ? 'active' : ''}`} onClick={() => applyDatePreset('today')}>Today</button>
          <button className={`preset-btn ${datePreset === 'week' ? 'active' : ''}`} onClick={() => applyDatePreset('week')}>This Week</button>
          <button className={`preset-btn ${datePreset === 'month' ? 'active' : ''}`} onClick={() => applyDatePreset('month')}>This Month</button>
          <button className="preset-btn" onClick={() => { setDateRange({ start: '', end: '' }); setDatePreset('all'); }}>Clear</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <button className={`table-tab ${activeTableTab === 'cemms' ? 'active' : ''}`} onClick={() => setActiveTableTab('cemms')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 24px', background: activeTableTab === 'cemms' ? '#2E8B57' : 'white', border: '1px solid #C8E6C9', borderRadius: 40, fontWeight: 700, color: activeTableTab === 'cemms' ? 'white' : '#166534', cursor: 'pointer', transition: 'all 0.2s' }}><Leaf size={16} /> CEMMS <span style={{ background: activeTableTab === 'cemms' ? 'rgba(255,255,255,0.25)' : '#DCFCE7', padding: '3px 10px', borderRadius: 30, fontSize: 12 }}>{filteredAllCemms.length}</span></button>
        <button className={`table-tab ${activeTableTab === 'waste' ? 'active' : ''}`} onClick={() => setActiveTableTab('waste')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 24px', background: activeTableTab === 'waste' ? '#2E8B57' : 'white', border: '1px solid #C8E6C9', borderRadius: 40, fontWeight: 700, color: activeTableTab === 'waste' ? 'white' : '#166534', cursor: 'pointer', transition: 'all 0.2s' }}><Recycle size={16} /> Waste <span style={{ background: activeTableTab === 'waste' ? 'rgba(255,255,255,0.25)' : '#DCFCE7', padding: '3px 10px', borderRadius: 30, fontSize: 12 }}>{filteredWaste.length}</span></button>
      </div>

      {/* CEMMS Tables - separated */}
      {activeTableTab === 'cemms' && (
        <>
          <div style={{ background: '#F0FDF4', borderRadius: 24, padding: '16px 24px', marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-box"><Search size={14} /><input placeholder="Search all CEMMS..." value={cemmsSearch} onChange={e => setCemmsSearch(e.target.value)} /></div>
            <select className="filter-select" value={cemmsFilterBarangay} onChange={e => setCemmsFilterBarangay(e.target.value)}><option value="all">All Barangays</option>{barangays.map(b => <option key={b}>{b}</option>)}</select>
            <select className="filter-select" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setWebCemmsPage(1); setMobileCemmsPage(1); setWastePage(1); }}><option value={10}>10 rows</option><option value={25}>25 rows</option><option value={50}>50 rows</option><option value={100}>100 rows</option></select>
          </div>

          {/* Web App Table (from new database) */}
          <div className="data-table">
            <div className="table-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#166534', margin: 0 }}><Monitor size={18} /> Web App Emissions</h3>
              <div style={{ fontSize: 13, color: '#166534' }}>Total: {webRecords.reduce((sum, r) => sum + r.amount, 0).toLocaleString()} kg</div>
            </div>
            <div className="table-wrapper">
              {paginatedWebRecords.length === 0 ? <div style={{ textAlign: 'center', padding: 60, color: '#166534' }}><Package size={48} color="#C8E6C9" /><p>No web app records</p></div> : (
                <table>
                  <thead>
                    <tr>
                      <th onClick={() => handleWebSort('barangay')}>Barangay <SortIcon field="barangay" currentField={webSortField} direction={webSortDir} /></th>
                      <th onClick={() => handleWebSort('amount')}>Amount <SortIcon field="amount" currentField={webSortField} direction={webSortDir} /></th>
                      <th onClick={() => handleWebSort('type')}>Type <SortIcon field="type" currentField={webSortField} direction={webSortDir} /></th>
                      <th onClick={() => handleWebSort('date')}>Date <SortIcon field="date" currentField={webSortField} direction={webSortDir} /></th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedWebRecords.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600, color: '#166534' }}>{r.barangay}</td>
                        <td className="amount-cell">{r.amount.toLocaleString()} kg</td>
                        <td><span className="type-badge web-input">{r.type}</span></td>
                        <td>{r.date.toLocaleDateString()}</td>
                        <td><div className="action-buttons"><button className="edit-btn" onClick={() => openEditModal('cemms', r)}><Edit size={12} /> Edit</button><button className="delete-btn" onClick={() => setShowDeleteConfirm({ type: 'cemms', id: r.id, collectionName: r.collectionName, dbInstance: r.dbInstance })}><Trash2 size={12} /> Delete</button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="pagination">
              <div>Showing {((webCemmsPage-1)*pageSize)+1} to {Math.min(webCemmsPage*pageSize, webRecords.length)} of {webRecords.length}</div>
              <div className="pagination-controls">
                <button className="page-btn" onClick={() => setWebCemmsPage(p => Math.max(1, p-1))} disabled={webCemmsPage===1}><ChevronLeft size={14} /></button>
                {[...Array(Math.ceil(webRecords.length/pageSize))].map((_,i) => (
                  <button key={i} className={`page-number ${webCemmsPage===i+1 ? 'active' : ''}`} onClick={() => setWebCemmsPage(i+1)}>{i+1}</button>
                ))}
                <button className="page-btn" onClick={() => setWebCemmsPage(p => Math.min(Math.ceil(webRecords.length/pageSize), p+1))} disabled={webCemmsPage===Math.ceil(webRecords.length/pageSize) || webRecords.length===0}><ChevronRight size={14} /></button>
              </div>
            </div>
          </div>

          {/* Mobile App Table (from original database) */}
          <div className="data-table">
            <div className="table-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#166534', margin: 0 }}><Smartphone size={18} /> Mobile App Emissions</h3>
              <div style={{ fontSize: 13, color: '#166534' }}>Total: {mobileRecords.reduce((sum, r) => sum + r.amount, 0).toLocaleString()} kg</div>
            </div>
            <div className="table-wrapper">
              {paginatedMobileRecords.length === 0 ? <div style={{ textAlign: 'center', padding: 60, color: '#166534' }}><Package size={48} color="#C8E6C9" /><p>No mobile app records</p></div> : (
                <table>
                  <thead>
                    <tr>
                      <th onClick={() => handleMobileSort('barangay')}>Barangay <SortIcon field="barangay" currentField={mobileSortField} direction={mobileSortDir} /></th>
                      <th onClick={() => handleMobileSort('amount')}>Amount <SortIcon field="amount" currentField={mobileSortField} direction={mobileSortDir} /></th>
                      <th onClick={() => handleMobileSort('type')}>Type <SortIcon field="type" currentField={mobileSortField} direction={mobileSortDir} /></th>
                      <th onClick={() => handleMobileSort('date')}>Date <SortIcon field="date" currentField={mobileSortField} direction={mobileSortDir} /></th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedMobileRecords.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600, color: '#166534' }}>{r.barangay}</td>
                        <td className="amount-cell">{r.amount.toLocaleString()} kg</td>
                        <td><span className="type-badge app-input">{r.type}</span></td>
                        <td>{r.date.toLocaleDateString()}</td>
                        <td><div className="action-buttons"><button className="edit-btn" onClick={() => openEditModal('cemms', r)}><Edit size={12} /> Edit</button><button className="delete-btn" onClick={() => setShowDeleteConfirm({ type: 'cemms', id: r.id, collectionName: r.collectionName, dbInstance: r.dbInstance })}><Trash2 size={12} /> Delete</button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="pagination">
              <div>Showing {((mobileCemmsPage-1)*pageSize)+1} to {Math.min(mobileCemmsPage*pageSize, mobileRecords.length)} of {mobileRecords.length}</div>
              <div className="pagination-controls">
                <button className="page-btn" onClick={() => setMobileCemmsPage(p => Math.max(1, p-1))} disabled={mobileCemmsPage===1}><ChevronLeft size={14} /></button>
                {[...Array(Math.ceil(mobileRecords.length/pageSize))].map((_,i) => (
                  <button key={i} className={`page-number ${mobileCemmsPage===i+1 ? 'active' : ''}`} onClick={() => setMobileCemmsPage(i+1)}>{i+1}</button>
                ))}
                <button className="page-btn" onClick={() => setMobileCemmsPage(p => Math.min(Math.ceil(mobileRecords.length/pageSize), p+1))} disabled={mobileCemmsPage===Math.ceil(mobileRecords.length/pageSize) || mobileRecords.length===0}><ChevronRight size={14} /></button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Waste Table */}
      {activeTableTab === 'waste' && (
        <div className="data-table">
          <div className="table-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#166534', margin: 0 }}><Recycle size={18} color="#2E8B57" /> Waste Collection Records</h3>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="search-box"><Search size={14} /><input placeholder="Search..." value={wasteSearch} onChange={e => setWasteSearch(e.target.value)} /></div>
              <select className="filter-select" value={wasteFilterBarangay} onChange={e => setWasteFilterBarangay(e.target.value)}><option value="all">All Barangays</option>{barangays.map(b => <option key={b}>{b}</option>)}</select>
            </div>
          </div>
          <div className="table-wrapper">
            {paginatedWaste.length === 0 ? <div style={{ textAlign: 'center', padding: 60, color: '#166534' }}><Package size={48} color="#C8E6C9" /><p>No waste records</p></div> : (
              <table>
                <thead>
                  <tr>
                    <th onClick={() => handleWasteSort('barangay')}>Barangay <SortIcon field="barangay" currentField={wasteSortField} direction={wasteSortDir} /></th>
                    <th onClick={() => handleWasteSort('totalWaste')}>Total <SortIcon field="totalWaste" currentField={wasteSortField} direction={wasteSortDir} /></th>
                    <th onClick={() => handleWasteSort('biodegradable')}>Bio <SortIcon field="biodegradable" currentField={wasteSortField} direction={wasteSortDir} /></th>
                    <th onClick={() => handleWasteSort('nonBiodegradable')}>Non-Bio <SortIcon field="nonBiodegradable" currentField={wasteSortField} direction={wasteSortDir} /></th>
                    <th onClick={() => handleWasteSort('recyclable')}>Recyclable <SortIcon field="recyclable" currentField={wasteSortField} direction={wasteSortDir} /></th>
                    <th onClick={() => handleWasteSort('residual')}>Residual <SortIcon field="residual" currentField={wasteSortField} direction={wasteSortDir} /></th>
                    <th onClick={() => handleWasteSort('date')}>Date <SortIcon field="date" currentField={wasteSortField} direction={wasteSortDir} /></th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedWaste.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600, color: '#166534' }}>{r.barangay}</td>
                      <td className="amount-cell">{r.totalWaste.toLocaleString()} kg</td>
                      <td>{r.biodegradable} kg</td>
                      <td>{r.nonBiodegradable} kg</td>
                      <td>{r.recyclable} kg</td>
                      <td>{r.residual} kg</td>
                      <td>{r.date.toLocaleDateString()}</td>
                      <td><div className="action-buttons"><button className="edit-btn" onClick={() => openEditModal('waste', r)}><Edit size={12} /> Edit</button><button className="delete-btn" onClick={() => setShowDeleteConfirm({ type: 'waste', id: r.id })}><Trash2 size={12} /> Delete</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="pagination">
            <div>Showing {((wastePage-1)*pageSize)+1} to {Math.min(wastePage*pageSize, filteredWaste.length)} of {filteredWaste.length}</div>
            <div className="pagination-controls">
              <button className="page-btn" onClick={() => setWastePage(p => Math.max(1, p-1))} disabled={wastePage===1}><ChevronLeft size={14} /></button>
              {[...Array(Math.ceil(filteredWaste.length/pageSize))].map((_,i) => (
                <button key={i} className={`page-number ${wastePage===i+1 ? 'active' : ''}`} onClick={() => setWastePage(i+1)}>{i+1}</button>
              ))}
              <button className="page-btn" onClick={() => setWastePage(p => Math.min(Math.ceil(filteredWaste.length/pageSize), p+1))} disabled={wastePage===Math.ceil(filteredWaste.length/pageSize) || filteredWaste.length===0}><ChevronRight size={14} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid #C8E6C9' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#166534' }}><Plus size={20} /> Add Record</h3>
              <button className="close-modal" onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', fontSize: 28, cursor: 'pointer' }}>×</button>
            </div>
            <div className="modal-body" style={{ padding: 28 }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
                <button className={`toggle-btn ${addType === 'emission' ? 'active' : ''}`} onClick={() => setAddType('emission')}><Leaf size={14} /> Emission</button>
                <button className={`toggle-btn ${addType === 'waste' ? 'active' : ''}`} onClick={() => setAddType('waste')}><Recycle size={14} /> Waste</button>
              </div>
              {addType === 'emission' ? (
                <>
                  <div className="form-group" style={{ marginBottom: 24 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 8, color: '#166534' }}><MapPin size={14} /> Barangay</label>
                    <select value={emissionForm.barangay} onChange={e => setEmissionForm({...emissionForm, barangay: e.target.value})} style={{ width: '100%', padding: '12px 16px', border: '1px solid #C8E6C9', borderRadius: 24, background: 'white' }}>
                      <option value="">Select</option>{barangays.map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 24 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 8, color: '#166534' }}><Package size={14} /> CO₂ (kg)</label>
                    <input type="number" step="0.01" placeholder="e.g., 125.5" value={emissionForm.amount} onChange={e => setEmissionForm({...emissionForm, amount: e.target.value})} style={{ width: '100%', padding: '12px 16px', border: '1px solid #C8E6C9', borderRadius: 24, background: 'white' }} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 24 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 8, color: '#166534' }}>Record Type</label>
                    <select value={emissionForm.customType} onChange={e => setEmissionForm({...emissionForm, customType: e.target.value})} style={{ width: '100%', padding: '12px 16px', border: '1px solid #C8E6C9', borderRadius: 24, background: 'white' }}>
                      <option value="Web Input">Web Input</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group" style={{ marginBottom: 24 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 8, color: '#166534' }}><MapPin size={14} /> Barangay</label>
                    <select value={wasteForm.barangay} onChange={e => setWasteForm({...wasteForm, barangay: e.target.value})} style={{ width: '100%', padding: '12px 16px', border: '1px solid #C8E6C9', borderRadius: 24, background: 'white' }}>
                      <option value="">Select</option>{barangays.map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="waste-grid">
                    <div><label style={{ fontSize: 12, display: 'block', marginBottom: 6, fontWeight: 600, color: '#166534' }}>Biodegradable</label><input type="number" step="0.01" value={wasteForm.biodegradable} onChange={e => setWasteForm({...wasteForm, biodegradable: e.target.value})} style={{ width: '100%', padding: '10px 14px', border: '1px solid #C8E6C9', borderRadius: 20, background: 'white' }} /></div>
                    <div><label style={{ fontSize: 12, display: 'block', marginBottom: 6, fontWeight: 600, color: '#166534' }}>Non-Biodegradable</label><input type="number" step="0.01" value={wasteForm.nonBiodegradable} onChange={e => setWasteForm({...wasteForm, nonBiodegradable: e.target.value})} style={{ width: '100%', padding: '10px 14px', border: '1px solid #C8E6C9', borderRadius: 20, background: 'white' }} /></div>
                    <div><label style={{ fontSize: 12, display: 'block', marginBottom: 6, fontWeight: 600, color: '#166534' }}>Recyclable</label><input type="number" step="0.01" value={wasteForm.recyclable} onChange={e => setWasteForm({...wasteForm, recyclable: e.target.value})} style={{ width: '100%', padding: '10px 14px', border: '1px solid #C8E6C9', borderRadius: 20, background: 'white' }} /></div>
                    <div><label style={{ fontSize: 12, display: 'block', marginBottom: 6, fontWeight: 600, color: '#166534' }}>Residual</label><input type="number" step="0.01" value={wasteForm.residual} onChange={e => setWasteForm({...wasteForm, residual: e.target.value})} style={{ width: '100%', padding: '10px 14px', border: '1px solid #C8E6C9', borderRadius: 20, background: 'white' }} /></div>
                  </div>
                  <div className="total-display">Total: {(parseFloat(wasteForm.biodegradable)||0)+(parseFloat(wasteForm.nonBiodegradable)||0)+(parseFloat(wasteForm.recyclable)||0)+(parseFloat(wasteForm.residual)||0)} kg</div>
                </>
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 16, padding: '20px 28px', borderTop: '1px solid #C8E6C9' }}>
              <button className="cancel-btn" onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: 12, borderRadius: 40, background: '#DCFCE7', border: 'none', fontWeight: 700, cursor: 'pointer', color: '#166534' }}>Cancel</button>
              <button className="submit-btn" onClick={handleAddRecord} disabled={submitting} style={{ flex: 1, padding: 12, borderRadius: 40, background: '#2E8B57', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}>{submitting ? 'Adding...' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingRecord && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid #C8E6C9' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#166534' }}><Edit size={20} /> Edit Record</h3>
              <button className="close-modal" onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', fontSize: 28, cursor: 'pointer' }}>×</button>
            </div>
            <div className="modal-body" style={{ padding: 28 }}>
              {editType === 'waste' ? (
                <>
                  <div className="form-group" style={{ marginBottom: 24 }}>
                    <label style={{ fontWeight: 700, marginBottom: 8, display: 'block', color: '#166534' }}>Barangay</label>
                    <select value={wasteForm.barangay} onChange={e => setWasteForm({...wasteForm, barangay: e.target.value})} style={{ width: '100%', padding: '12px 16px', border: '1px solid #C8E6C9', borderRadius: 24, background: 'white' }}>
                      {barangays.map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="waste-grid">
                    <div><label style={{ fontSize: 12, fontWeight: 600, color: '#166534' }}>Biodegradable</label><input type="number" step="0.01" value={wasteForm.biodegradable} onChange={e => setWasteForm({...wasteForm, biodegradable: e.target.value})} style={{ width: '100%', padding: '10px 14px', border: '1px solid #C8E6C9', borderRadius: 20, background: 'white' }} /></div>
                    <div><label style={{ fontSize: 12, fontWeight: 600, color: '#166534' }}>Non-Biodegradable</label><input type="number" step="0.01" value={wasteForm.nonBiodegradable} onChange={e => setWasteForm({...wasteForm, nonBiodegradable: e.target.value})} style={{ width: '100%', padding: '10px 14px', border: '1px solid #C8E6C9', borderRadius: 20, background: 'white' }} /></div>
                    <div><label style={{ fontSize: 12, fontWeight: 600, color: '#166534' }}>Recyclable</label><input type="number" step="0.01" value={wasteForm.recyclable} onChange={e => setWasteForm({...wasteForm, recyclable: e.target.value})} style={{ width: '100%', padding: '10px 14px', border: '1px solid #C8E6C9', borderRadius: 20, background: 'white' }} /></div>
                    <div><label style={{ fontSize: 12, fontWeight: 600, color: '#166534' }}>Residual</label><input type="number" step="0.01" value={wasteForm.residual} onChange={e => setWasteForm({...wasteForm, residual: e.target.value})} style={{ width: '100%', padding: '10px 14px', border: '1px solid #C8E6C9', borderRadius: 20, background: 'white' }} /></div>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group" style={{ marginBottom: 24 }}>
                    <label style={{ fontWeight: 700, marginBottom: 8, display: 'block', color: '#166534' }}>Barangay</label>
                    <select value={emissionForm.barangay} onChange={e => setEmissionForm({...emissionForm, barangay: e.target.value})} style={{ width: '100%', padding: '12px 16px', border: '1px solid #C8E6C9', borderRadius: 24, background: 'white' }}>
                      {barangays.map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 24 }}>
                    <label style={{ fontWeight: 700, marginBottom: 8, display: 'block', color: '#166534' }}>CO₂ (kg)</label>
                    <input type="number" step="0.01" value={emissionForm.amount} onChange={e => setEmissionForm({...emissionForm, amount: e.target.value})} style={{ width: '100%', padding: '12px 16px', border: '1px solid #C8E6C9', borderRadius: 24, background: 'white' }} />
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 16, padding: '20px 28px', borderTop: '1px solid #C8E6C9' }}>
              <button className="cancel-btn" onClick={() => setShowEditModal(false)} style={{ flex: 1, padding: 12, borderRadius: 40, background: '#DCFCE7', border: 'none', fontWeight: 700, cursor: 'pointer', color: '#166534' }}>Cancel</button>
              <button className="submit-btn" onClick={handleEditRecord} disabled={submitting} style={{ flex: 1, padding: 12, borderRadius: 40, background: '#2E8B57', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}>{submitting ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid #C8E6C9' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#DC2626' }}><AlertCircle size={20} /> Confirm Delete</h3>
              <button className="close-modal" onClick={() => setShowDeleteConfirm(null)} style={{ background: 'none', border: 'none', fontSize: 28, cursor: 'pointer' }}>×</button>
            </div>
            <div className="modal-body" style={{ padding: 28 }}><p style={{ color: '#166534' }}>Delete this record? Cannot be undone.</p></div>
            <div className="modal-footer" style={{ display: 'flex', gap: 16, padding: '20px 28px', borderTop: '1px solid #C8E6C9' }}>
              <button className="cancel-btn" onClick={() => setShowDeleteConfirm(null)} style={{ flex: 1, padding: 12, borderRadius: 40, background: '#DCFCE7', border: 'none', fontWeight: 700, cursor: 'pointer', color: '#166534' }}>Cancel</button>
              <button className="delete-confirm-btn" onClick={handleDeleteRecord} style={{ flex: 1, padding: 12, borderRadius: 40, background: '#DC2626', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}