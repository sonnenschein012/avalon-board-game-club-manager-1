import { useState, useEffect, useId, useCallback } from 'react';
import { toast } from 'sonner';
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
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const errorToastId = useId();
  const retry = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData([]);
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
        setError(null);
        toast.dismiss(errorToastId);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, collectionName);
        setError(error);
        const label = ({ members: '회원 명부', games: '게임 목록', sessions: '세션 기록', attendees: '출석 명단', DailyPlannings: '모임' } as Record<string, string>)[collectionName] || '데이터';
        toast.error(`${label}을 불러오지 못했습니다. 표시된 목록이 최신 상태가 아닐 수 있습니다.`, {
          id: errorToastId, duration: Infinity, action: { label: '다시 시도', onClick: retry },
        });
        setLoading(false);
      }
    );

    return () => { unsubscribe(); toast.dismiss(errorToastId); };
  }, [collectionName, orderField, orderDirection, attempt, errorToastId, retry]);

  return { data, loading, error, retry };
}
