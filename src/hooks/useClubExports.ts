import { useState } from 'react';
import { toast } from 'sonner';
import { buildGamesCsv, buildMembersCsv, buildSessionsCsv } from '../domain/exports/clubCsv';
import { downloadCsv } from '../lib/downloadCsv';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { loadGameExportData, loadMemberExportData, loadSessionExportData } from '../services/settingsService';

function getTodayStr(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export function useClubExports() {
  const [exportingMembers, setExportingMembers] = useState(false);
  const [exportingGames, setExportingGames] = useState(false);
  const [exportingSessions, setExportingSessions] = useState(false);

  const exportMembers = async () => {
    setExportingMembers(true);
    try {
      const { members, sessions } = await loadMemberExportData();
      downloadCsv(`Members_backup_${getTodayStr()}.csv`, buildMembersCsv(members, sessions));
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
      const games = await loadGameExportData();
      downloadCsv(`Games_backup_${getTodayStr()}.csv`, buildGamesCsv(games));
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
      const { sessions, membersById, gameTitlesById } = await loadSessionExportData();
      const csv = buildSessionsCsv(sessions, membersById, gameTitlesById);
      downloadCsv(`Sessions_backup_${getTodayStr()}.csv`, csv);
      toast.success('모임 아카이브를 성공적으로 내보냈습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'sessions/members/games');
      toast.error('내보내기 중 오류가 발생했습니다.');
    } finally {
      setExportingSessions(false);
    }
  };

  return {
    exportingMembers,
    exportMembers,
    exportingGames,
    exportGames,
    exportingSessions,
    exportSessions,
  };
}
