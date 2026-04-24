const fs = require('fs');
const path = 'app/staff/live-map/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Replace firebase import
content = content.replace(
  "import { auth, db } from '@/lib/firebase';\nimport { signOut } from 'firebase/auth';\nimport { collection, getDocs, onSnapshot } from 'firebase/firestore';",
  "import { auth, mobileDb, webCemmsDb } from '@/app/lib/combinedFirebase';\nimport { signOut } from 'firebase/auth';\nimport { collection, getDocs, onSnapshot } from 'firebase/firestore';"
);

// 2. Replace db references in fetchAllEmissions
content = content.replace(
  "collection(db, 'calculations')",
  "collection(mobileDb, 'calculations')"
);
content = content.replace(
  "collection(db, 'bills')",
  "collection(mobileDb, 'bills')"
);
content = content.replace(
  "collection(db, 'emissions')",
  "collection(webCemmsDb, 'emissions')"
);

fs.writeFileSync(path, content);
console.log('Updated app/staff/live-map/page.tsx');
