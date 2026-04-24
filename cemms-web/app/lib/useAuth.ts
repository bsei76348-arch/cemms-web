import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export function useAuth(redirectToLogin = true) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      let currentUser = auth.currentUser;
      // Fallback to localStorage mock user
      if (!currentUser && typeof window !== 'undefined') {
        const stored = localStorage.getItem('cemms_user');
        if (stored) {
          try {
            const mock = JSON.parse(stored);
            currentUser = { uid: mock.uid, email: mock.email, displayName: mock.role } as any;
            // Also set it on auth so future listeners see it
            Object.defineProperty(auth, 'currentUser', { value: currentUser, writable: true, configurable: true });
          } catch {}
        }
      }
      if (currentUser) {
        setUser(currentUser);
      } else if (redirectToLogin) {
        router.push('/login');
      }
      setLoading(false);
    };
    checkAuth();

    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) setUser(firebaseUser);
      else if (redirectToLogin && !localStorage.getItem('cemms_user')) router.push('/login');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router, redirectToLogin]);

  return { user, loading };
}