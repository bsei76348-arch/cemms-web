const fs = require('fs');
const path = 'app/admin/reports/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Replace firebase import
content = content.replace(
  "import { auth, db } from '@/lib/firebase';",
  "import { auth, mobileDb, webCemmsDb } from '@/app/lib/combinedFirebase';"
);
content = content.replace(
  "import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy } from 'firebase/firestore';",
  "import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore';"
);

// 2. Replace StaffSidebar with AdminSidebar
content = content.replace(
  "import StaffSidebar from '@/app/lib/StaffSidebar';",
  "import AdminSidebar from '@/app/lib/AdminSidebar';"
);

// 3. Replace component name
content = content.replace('export default function StaffReports() {', 'export default function AdminReports() {');

// 4. Replace db references in fetchAllData
content = content.replace("getDocs(collection(db, 'calculations'))", "getDocs(collection(mobileDb, 'calculations'))");
content = content.replace("getDocs(collection(db, 'bills'))", "getDocs(collection(mobileDb, 'bills'))");
content = content.replace("getDocs(collection(db, 'emissions'))", "getDocs(collection(webCemmsDb, 'emissions'))");

// 5. Replace db reference in fetchFlags
content = content.replace("query(collection(db, 'flags'), orderBy('createdAt', 'desc'))", "query(collection(webCemmsDb, 'flags'), orderBy('createdAt', 'desc'))");

// 6. Replace db reference in handleFlagBarangay addDoc
content = content.replace("await addDoc(collection(db, 'flags'), newFlag);", "await addDoc(collection(webCemmsDb, 'flags'), newFlag);");

// 7. Replace db reference in handleUpdateFlagStatus
content = content.replace("await updateDoc(doc(db, 'flags', flagId), { status: newStatus });", "await updateDoc(doc(webCemmsDb, 'flags', flagId), { status: newStatus });");

// 8. Replace StaffSidebar with AdminSidebar in JSX
content = content.replace('<StaffSidebar userName={userName} />', '<AdminSidebar userName={userName} onLogout={handleLogout} />');

// 9. Replace "STAFF" badge with "ADMIN"
content = content.replace('STAFF', 'ADMIN');

// 10. Add onSnapshot listeners before the auth useEffect
const snapshotCode = `
  // Real-time listeners for live sync
  useEffect(() => {
    const unsubCalc = onSnapshot(collection(mobileDb, 'calculations'), () => fetchAllData());
    const unsubBills = onSnapshot(collection(mobileDb, 'bills'), () => fetchAllData());
    const unsubEmissions = onSnapshot(collection(webCemmsDb, 'emissions'), () => fetchAllData());
    return () => { unsubCalc(); unsubBills(); unsubEmissions(); };
  }, []);

`;

content = content.replace(
  '  // Authentication with mock fallback',
  snapshotCode + '  // Authentication with mock fallback'
);

// 11. Add handleLogout function
const logoutCode = `
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
`;

content = content.replace(
  '  const fetchAllData = async () => {',
  logoutCode + '\n  const fetchAllData = async () => {'
);

fs.writeFileSync(path, content);
console.log('Updated app/admin/reports/page.tsx');
