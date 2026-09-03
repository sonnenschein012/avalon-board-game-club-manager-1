import { useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query, type OrderByDirection } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

/** Subscribe to a collection, optionally ordered by one field. */
export function useFirestore<T>(
  collectionName: string,
  orderField?: string,
  orderDirection: OrderByDirection = 'asc',
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const reference = collection(db, collectionName);
    const q = orderField ? query(reference, orderBy(orderField, orderDirection)) : query(reference);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as T[];
        
        setData(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, collectionName);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [collectionName, orderField, orderDirection]);

  return { data, loading };
}
