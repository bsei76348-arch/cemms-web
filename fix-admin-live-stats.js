const fs = require('fs');
const path = 'app/admin/live-stats/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Replace firebase import
content = content.replace(
  "import { auth, webCemmsDb } from '@/app/lib/combinedFirebase'; // Use only one Firestore instance",
  "import { auth, mobileDb, webCemmsDb } from '@/app/lib/combinedFirebase';"
);

// 2. Replace collection(webCemmsDb, 'calculations') with collection(mobileDb, 'calculations')
content = content.replace(
  "collection(webCemmsDb, 'calculations')",
  "collection(mobileDb, 'calculations')"
);

// 3. Fix comment about using one Firestore instance
content = content.replace(
  "// Fixed: both onSnapshot listeners use the same Firestore instance",
  "// Fixed: onSnapshot listeners use correct Firestore instances"
);

fs.writeFileSync(path, content);
console.log('Updated app/admin/live-stats/page.tsx');
