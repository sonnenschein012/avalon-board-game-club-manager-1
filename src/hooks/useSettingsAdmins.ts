import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { addAdminRecord, listAdmins, removeAdminRecord } from '../services/settingsService';
import type { Admin } from '../types';

export function useSettingsAdmins() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);

  const fetchAdmins = useCallback(async () => {
    try {
      setAdmins(await listAdmins());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'admins');
      toast.error('관리자 목록을 불러오지 못했습니다.');
    } finally {
      setLoadingAdmins(false);
    }
  }, []);

  useEffect(() => {
    void fetchAdmins();
  }, [fetchAdmins]);

  const addAdmin = async () => {
    if (!newAdminEmail) return;
    if (!newAdminEmail.includes('@')) {
      toast.error('유효한 이메일 주소를 입력해주세요.');
      return;
    }

    setAddingAdmin(true);
    const normalizedEmail = newAdminEmail.trim().toLowerCase();
    try {
      await addAdminRecord(normalizedEmail);
      toast.success(`${newAdminEmail} 관리자가 추가되었습니다.`);
      setNewAdminEmail('');
      void fetchAdmins();
    } catch (error) {
      toast.error('관리자 추가에 실패했습니다.');
      handleFirestoreError(error, OperationType.CREATE, `admins/${normalizedEmail}`);
    } finally {
      setAddingAdmin(false);
    }
  };

  const removeAdmin = async (email: string) => {
    if (admins.find(admin => admin.id === email)?.role === 'master') {
      toast.error('마스터 관리자는 삭제할 수 없습니다.');
      return;
    }

    try {
      await removeAdminRecord(email);
      toast.success('관리자 권한이 삭제되었습니다.');
      void fetchAdmins();
    } catch (error) {
      toast.error('관리자 삭제에 실패했습니다.');
      handleFirestoreError(error, OperationType.DELETE, `admins/${email}`);
    }
  };

  return {
    admins,
    loadingAdmins,
    newAdminEmail,
    setNewAdminEmail,
    addingAdmin,
    addAdmin,
    removeAdmin,
  };
}
