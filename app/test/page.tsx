'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function TestPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Try to fetch from a collection - pwede mo palitan ung 'users' sa kung anong collection name mo sa Android app
        const querySnapshot = await getDocs(collection(db, 'users'));
        const docs = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setData(docs);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>Firebase Connection Test</h1>
      <p>Collection: <strong>users</strong></p>
      
      {data.length === 0 ? (
        <p>Walang data sa users collection. Try mo mag-add sa Android app mo!</p>
      ) : (
        <ul>
          {data.map((doc) => (
            <li key={doc.id}>{JSON.stringify(doc)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}