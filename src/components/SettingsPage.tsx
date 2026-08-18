import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Member, Game, Session, Admin } from '../types';
import { toast } from 'sonner';
import { formatTimestamp } from '../lib/utils';

import SettingsAdminPanel from './SettingsAdminPanel';
import SettingsExportPanel from './SettingsExportPanel';

export default function SettingsPage({ 
  isAdminModeActive, 
  setIsAdminModeActive,
  isMasterAdmin 
}: { 
  isAdminModeActive: boolean; 
  setIsAdminModeActive: (active: boolean) => void;
  isMasterAdmin: boolean; 
}) {
  const [exportingMembers, setExportingMembers] = useState(false);
  const [exportingGames, setExportingGames] = useState(false);
  const [exportingSessions, setExportingSessions] = useState(false);

  // Admin Management State
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);

  const fetchAdmins = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'admins'));
      const adminData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Admin));
      setAdmins(adminData);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'admins');
      toast.error('관리자 목록을 불러오지 못했습니다.');
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);



  const addAdmin = async () => {
    if (!newAdminEmail) return;

    if (!newAdminEmail.includes('@')) {
      toast.error('유효한 이메일 주소를 입력해주세요.');
      return;
    }
    setAddingAdmin(true);
    try {
      const normalizedEmail = newAdminEmail.trim().toLowerCase();
      await setDoc(doc(db, 'admins', normalizedEmail), {
        email: normalizedEmail,
        role: 'admin',
        createdAt: serverTimestamp()
      });
      toast.success(`${newAdminEmail} 관리자가 추가되었습니다.`);
      setNewAdminEmail('');
      fetchAdmins();
    } catch (e) {
      toast.error('관리자 추가에 실패했습니다.');
      handleFirestoreError(e, OperationType.CREATE, `admins/${newAdminEmail.trim().toLowerCase()}`);
    } finally {
      setAddingAdmin(false);
    }
  };

  const removeAdmin = async (email: string) => {
    const target = admins.find(a => a.id === email);
    if (target?.role === 'master') {
      toast.error('마스터 관리자는 삭제할 수 없습니다.');
      return;
    }
    try {
      await deleteDoc(doc(db, 'admins', email));
      toast.success('관리자 권한이 삭제되었습니다.');
      fetchAdmins();
    } catch (e) {
      toast.error('관리자 삭제에 실패했습니다.');
      handleFirestoreError(e, OperationType.DELETE, `admins/${email}`);
    }
  };

  const downloadCSV = (filename: string, csvContent: string) => {
    // Add UTF-8 BOM
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getTodayStr = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  };

  const escapeCSV = (str: unknown) => {
    if (str === null || str === undefined) return '';
    const s = String(str);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const exportMembers = async () => {
    setExportingMembers(true);
    try {
      // 1. Fetch Members
      const membersSnap = await getDocs(collection(db, 'members'));
      const members = membersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Member));

      // 2. Fetch Sessions to calculate attendance
      const sessionsSnap = await getDocs(collection(db, 'sessions'));
      const sessions = sessionsSnap.docs.map(d => d.data() as Session);

      const attendanceCounts: Record<string, number> = {};
      sessions.forEach(s => {
        s.groups.forEach(g => {
          g.memberIds.forEach(mId => {
            attendanceCounts[mId] = (attendanceCounts[mId] || 0) + 1;
          });
        });
      });

      // 3. Prepare CSV
      const headers = ['이름', '닉네임', '학번', '연락처', '성별', '가입학기', '선호장르', '누적참석횟수', '메모'];
      const rows = members.map(m => [
        m.name,
        m.nickname,
        m.studentId,
        m.phone,
        m.gender,
        m.semester,
        m.preferredGenre,
        attendanceCounts[m.id] || 0,
        m.memo
      ]);

      const csvContent = [
        headers.map(escapeCSV).join(','),
        ...rows.map(row => row.map(escapeCSV).join(','))
      ].join('\n');

      downloadCSV(`Members_backup_${getTodayStr()}.csv`, csvContent);
      toast.success('동아리원 명부를 성공적으로 내보냈습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'members/sessions');
      toast.error('내보내기 중 오류가 발생했습니다.');
    } finally {
      setExportingMembers(false);
    }
  };

  const exportGames = async () => {
    setExportingGames(true);
    try {
      const gamesSnap = await getDocs(collection(db, 'games'));
      const games = gamesSnap.docs.map(d => d.data() as Game);

      const headers = ['게임명', '최소인원', '최대인원', '추천최소인원', '추천최대인원', '난이도', '장르', '메모'];
      const rows = games.map(g => [
        g.title,
        g.minPlayers,
        g.maxPlayers,
        g.bestMinPlayers,
        g.bestMaxPlayers,
        g.complexity,
        (g.genres || []).join('/'),
        g.memo
      ]);

      const csvContent = [
        headers.map(escapeCSV).join(','),
        ...rows.map(row => row.map(escapeCSV).join(','))
      ].join('\n');

      downloadCSV(`Games_backup_${getTodayStr()}.csv`, csvContent);
      toast.success('게임 라이브러리를 성공적으로 내보냈습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'games');
      toast.error('내보내기 중 오류가 발생했습니다.');
    } finally {
      setExportingGames(false);
    }
  };

  const exportSessions = async () => {
    setExportingSessions(true);
    try {
      const sessionsSnap = await getDocs(collection(db, 'sessions'));
      const sessions = sessionsSnap.docs.map(d => d.data() as Session);
      const membersSnap = await getDocs(collection(db, 'members'));
      const membersMap = new Map<string, string>();
      membersSnap.docs.forEach(d => {
        membersMap.set(d.id, d.data().name);
      });
      const gamesSnap = await getDocs(collection(db, 'games'));
      const gamesMap = new Map<string, string>();
      gamesSnap.docs.forEach(d => {
        gamesMap.set(d.id, d.data().title);
        gamesMap.set(d.data().title, d.data().title); // For backward compatibility if ID is stored as title
      });

      // [날짜, 조 이름, 조원 명단(쉼표 구분), 플레이한 게임들(쉼표 구분)]
      const headers = ['날짜', '조 이름', '조원 명단', '플레이한 게임들'];
      const rows: string[][] = [];

      sessions.forEach(s => {
        const dateStr = s.date?.toDate ? (s.date.toDate().toISOString().split('T')[0] ?? '') : formatTimestamp(s.date);
        s.groups.forEach((g, idx) => {
          const groupName = g.name || `TEAM ${idx + 1}`;
          const membersList = g.memberIds.map(mId => membersMap.get(mId) || 'Unknown').join(', ');
          const gamesList = g.gameIds?.map(gId => gamesMap.get(gId) || gId).join(', ') || '';
          rows.push([dateStr, groupName, membersList, gamesList]);
        });
      });

      // sort by date descending
      rows.sort((a, b) => (b[0] ?? '').localeCompare(a[0] ?? ''));

      const csvContent = [
        headers.map(escapeCSV).join(','),
        ...rows.map(row => row.map(escapeCSV).join(','))
      ].join('\n');

      downloadCSV(`Sessions_backup_${getTodayStr()}.csv`, csvContent);
      toast.success('모임 아카이브를 성공적으로 내보냈습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'sessions/members/games');
      toast.error('내보내기 중 오류가 발생했습니다.');
    } finally {
      setExportingSessions(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">설정 및 내보내기</h1>
        <p className="text-xs text-slate-400 font-mono uppercase mt-1">System / Settings & Export</p>
      </div>

      {isMasterAdmin && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">관리자 편집 모드</h2>
              <p className="text-sm text-slate-500 mt-1">
                동아리원, 게임 라이브러리, 세션 기록 등의 데이터를 수정하거나 삭제할 수 있는 권한을 활성화합니다.
                비활성화 시 읽기 전용으로 표시됩니다.
              </p>
            </div>
            <button
              onClick={() => setIsAdminModeActive(!isAdminModeActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                isAdminModeActive ? 'bg-navy' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isAdminModeActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      <SettingsAdminPanel
        isMasterAdmin={isMasterAdmin}
        admins={admins}
        loadingAdmins={loadingAdmins}
        newAdminEmail={newAdminEmail}
        setNewAdminEmail={setNewAdminEmail}
        addingAdmin={addingAdmin}
        addAdmin={addAdmin}
        removeAdmin={removeAdmin}
      />

      <SettingsExportPanel
        exportingMembers={exportingMembers}
        exportMembers={exportMembers}
        exportingGames={exportingGames}
        exportGames={exportGames}
        exportingSessions={exportingSessions}
        exportSessions={exportSessions}
      />
    </div>
  );
}
