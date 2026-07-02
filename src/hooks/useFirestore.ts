import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  QueryConstraint
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

/**
 * 파이어스토어 컬렉션 데이터를 실시간으로 가져오는 커스텀 훅입니다.
 * @param collectionName 컬렉션 이름 (예: 'members', 'games')
 * @param queryConstraints 쿼리 조건 (예: orderBy, where)
 * @returns { data, loading } 데이터와 로딩 상태
 */
export function useFirestore<T>(collectionName: string, ...queryConstraints: QueryConstraint[]) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. 컬렉션 참조 및 쿼리 생성
    const q = query(collection(db, collectionName), ...queryConstraints);

    // 2. 실시간 스냅샷 리스너 설정
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as (T & { id: string })[];
        
        setData(list as unknown as T[]);
        setLoading(false);
      },
      (error) => {
        // 에러 발생 시 공통 핸들러 호출
        handleFirestoreError(error, OperationType.LIST, collectionName);
        setLoading(false);
      }
    );

    // 3. 컴포넌트 언마운트 시 리스너 해제
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, JSON.stringify(queryConstraints)]);

  return { data, loading };
}
