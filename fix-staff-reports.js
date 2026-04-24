const fs = require('fs');
const path = 'app/staff/reports/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Replace firebase import
content = content.replace(
  "import { auth, db } from '@/lib/firebase';\nimport { collection, getDocs, addDoc, updateDoc, doc, query, orderBy } from 'firebase/firestore';\n",
  "import { auth, mobileDb, webCemmsDb } from '@/app/lib/combinedFirebase';\nimport { collection, getDocs, addDoc, updateDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore';\n"
);

// 2. Replace db references in fetchAllData
content = content.replace(
  "getDocs(collection(db, 'calculations'))",
  "getDocs(collection(mobileDb, 'calculations'))"
);
content = content.replace(
  "getDocs(collection(db, 'bills'))",
  "getDocs(collection(mobileDb, 'bills'))"
);
content = content.replace(
  "getDocs(collection(db, 'emissions'))",
  "getDocs(collection(webCemmsDb, 'emissions'))"
);

// 3. Replace db reference in fetchFlags
content = content.replace(
  "query(collection(db, 'flags'), orderBy('createdAt', 'desc'))",
  "query(collection(webCemmsDb, 'flags'), orderBy('createdAt', 'desc'))"
);

// 4. Replace db reference in handleFlagBarangay addDoc
content = content.replace(
  "await addDoc(collection(db, 'flags'), newFlag);",
  "await addDoc(collection(webCemmsDb, 'flags'), newFlag);"
);

// 5. Replace db reference in handleUpdateFlagStatus
content = content.replace(
  "await updateDoc(doc(db, 'flags', flagId), { status: newStatus });",
  "await updateDoc(doc(webCemmsDb, 'flags', flagId), { status: newStatus });"
);

// 6. Add onSnapshot listeners before the auth useEffect
const snapshotCode = `
  // Real-time listeners for live sync
  useEffect(() => {
    const unsubCalc = onSnapshot(collection(mobileDb, 'calculations'), () => fetchAllData());
    const unsubBills = onSnapshot(collection(mobileDb, 'bills'), () => fetchAllData());
    const unsubEmissions = onSnapshot(collection(webCemmsDb, 'emissions'), () => fetchAllData());
    return () => { unsubCalc(); unsubBills(); unsubEmissions(); };
  }, []);
`;

// Find the auth checkAuth useEffect and insert before it
content = content.replace(
  '  // Authentication with mock fallback',
  snapshotCode + '\n  // Authentication with mock fallback'
);

fs.writeFileSync(path, content);
console.log('Updated app/staff/reports/page.tsx');
