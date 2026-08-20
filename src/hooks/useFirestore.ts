import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  QueryConstraint
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

const constraintCache = new Map<string, QueryConstraint[]>();

function stableConstraints(constraints: QueryConstraint[]) {
  const key = JSON.stringify(constraints);
  const cached = constraintCache.get(key);
  if (cached) return cached;
  constraintCache.set(key, constraints);
  return constraints;
}

/**
 * 파이어스토어 컬렉션 데이터를 실시간으로 가져오는 커스텀 훅입니다.
 * @param collectionName 컬렉션 이름 (예: 'members', 'games')
 * @param queryConstraints 쿼리 조건 (예: orderBy, where)
 * @returns { data, loading } 데이터와 로딩 상태
 */
export function useFirestore<T>(collectionName: string, ...queryConstraints: QueryConstraint[]) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const constraints = stableConstraints(queryConstraints);

  useEffect(() => {
    // 1. 컬렉션 참조 및 쿼리 생성
    const q = query(collection(db, collectionName), ...constraints);

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
  }, [collectionName, constraints]);

  return { data, loading };
}
