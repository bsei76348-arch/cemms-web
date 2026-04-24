import { accountsAuth, accountsDb } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { User, signOut as firebaseSignOut } from 'firebase/auth';

export interface UserRole {
  uid: string;
  email: string;
  role: 'admin' | 'staff';
  firestoreRole?: string;
}

/**
 * Get user role consistently: Firestore > email fallback > default 'staff'
 */
export async function getUserRole(user: User): Promise<UserRole> {
  let role: 'admin' | 'staff' = 'staff';
  let firestoreRole: string | undefined;

  try {
    const userDoc = await getDoc(doc(accountsDb, 'users', user.uid));
    if (userDoc.exists()) {
      firestoreRole = userDoc.data().role;
      if (firestoreRole === 'admin' || firestoreRole === 'staff') {
        role = firestoreRole;
      }
    }
  } catch (error) {
    console.warn('Firestore role fetch failed:', error);
  }

  // Email fallback for demo accounts
  if (user.email === 'admin@cemms.com') {
    role = 'admin';
  }

  console.log('getUserRole DEBUG:', {
    uid: user.uid,
    email: user.email,
    firestoreRole,
    finalRole: role
  });

  return {
    uid: user.uid,
    email: user.email!,
    role,
    firestoreRole
  };
}

/**
 * Check if user is admin
 */
export function isAdminRole(userRole: UserRole): boolean {
  return userRole.role === 'admin';
}

/**
 * Auth state listener with role
 * Checks real Firebase auth first, then falls back to localStorage mock
 */
export function onAuthStateWithRole(
  callback: (userRole: UserRole | null) => void
) {
  // First check real Firebase auth
  const unsubscribe = accountsAuth.onAuthStateChanged(async (user: User | null) => {
    if (user) {
      const userRole = await getUserRole(user);
      callback(userRole);
    } else {
      // Fallback: check localStorage for mock user (from login page)
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('cemms_user');
        if (stored) {
          try {
            const mock = JSON.parse(stored);
            callback({
              uid: mock.uid,
              email: mock.email,
              role: mock.role as 'admin' | 'staff',
              firestoreRole: mock.role
            });
            return;
          } catch {}
        }
      }
      callback(null);
    }
  });
  return unsubscribe;
}

/**
 * Sign out user
 */
export async function signOut() {
  await firebaseSignOut(accountsAuth);
}
