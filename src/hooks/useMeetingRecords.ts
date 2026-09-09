import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { DailyPlanning } from '../domain/attendance/dailyPlanning';
import { deleteDailyPlanning, restoreDailyPlanningVersion, type DailyPlanningVersion } from '../services/dailyPlanningService';

export type MeetingRecord = DailyPlanning & { id: string };

export function useMeetingRecords() {
  const [records, setRecords] = useState<MeetingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => onSnapshot(query(collection(db, 'DailyPlannings'), orderBy('date', 'desc')),
    snapshot => {
      setRecords(snapshot.docs.map(item => ({ ...item.data(), id: item.id } as MeetingRecord)));
      setLoading(false);
      setError('');
    }, () => {
      setError('모임 진행 기록을 불러오지 못했습니다. 창을 닫고 다시 시도해주세요.');
      setLoading(false);
    }), []);
  const remove = async (id: string) => {
    await deleteDailyPlanning(id);
    setRecords(current => current.filter(record => record.id !== id));
  };
  return { records, loading, error, remove };
}

export function useMeetingVersions(planningId: string) {
  const [versions, setVersions] = useState<DailyPlanningVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => onSnapshot(query(collection(db, 'DailyPlannings', planningId, 'versions'), orderBy('archivedAt', 'desc')),
    snapshot => {
      setVersions(snapshot.docs.map(item => ({ ...item.data(), id: item.id } as DailyPlanningVersion)));
      setLoading(false);
      setError('');
    }, () => {
      setError('이전 버전을 불러오지 못했습니다. 목록으로 돌아가 다시 시도해주세요.');
      setLoading(false);
    }), [planningId]);
  return { versions, loading, error, restore: (versionId: string) => restoreDailyPlanningVersion(planningId, versionId) };
}
