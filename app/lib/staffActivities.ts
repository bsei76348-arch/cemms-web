// app/lib/staffActivity.ts
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function logStaffActivity(userId: string, action: string, details?: any) {
  try {
    await addDoc(collection(db, 'staff_activities'), {
      userId,
      action,
      details,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}