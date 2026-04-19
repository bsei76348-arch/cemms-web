import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface UserRole {
  role: 'admin' | 'staff';
}

export async function getUserRole(user: User): Promise<UserRole> {
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return { role: userData.role || 'staff' };
    }
    return { role: 'staff' };
  } catch (error) {
    console.error('Error getting user role:', error);
    return { role: 'staff' };
  }
}
