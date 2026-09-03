import { useState, useMemo } from 'react';
import { useFirestore } from './useFirestore';
import { Session, Game, Member } from '../types';
import { getSemester } from '../domain/semester/getSemester';
import { getAttendanceRanking } from '../domain/stats/getAttendanceRanking';
import { getPopularGames } from '../domain/stats/getPopularGames';
import { getCorePlayers } from '../domain/stats/getCorePlayers';
import { getAttendanceTrend } from '../domain/stats/getAttendanceTrend';
import { getNewcomerTrend } from '../domain/stats/getNewcomerTrend';
import { getStagnationIndex } from '../domain/stats/getStagnationIndex';
import { getGameMmi } from '../domain/stats/getGameMmi';
import { getAvailableArchiveSemesters } from '../domain/semester/semesterSelection';

export type ArchiveChartId = 'attendance' | 'newcomers' | 'stagnation';
export type ArchiveFormulaId = 'newcomers' | 'stagnation' | 'gameMmi';

export function useArchiveLogic() {
  const { data: sessions } = useFirestore<Session>('sessions', 'date', 'desc');
  const { data: games } = useFirestore<Game>('games');
  const { data: members } = useFirestore<Member>('members');

  const [selectedSemester, setSelectedSemester] = useState<string>(() => getSemester(new Date()));

  const availableSemesters = useMemo(() => {
    return getAvailableArchiveSemesters(sessions.map(session => session.date));
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => selectedSemester === '전체' || getSemester(s.date) === selectedSemester);
  }, [sessions, selectedSemester]);

  const activeMemberIds = useMemo(() => {
    const ids = new Set<string>();
    filteredSessions.forEach(s => s.groups.forEach(g => g.memberIds.forEach(id => ids.add(id))));
    return ids;
  }, [filteredSessions]);

  const activeMembersCount = activeMemberIds.size;
  const chronologicalSessions = useMemo(() => [...filteredSessions].reverse(), [filteredSessions]);

  const [rankingIncludeBoardMembers, setRankingIncludeBoardMembers] = useState(false);
  const [attendanceRankingMetric, setAttendanceRankingMetric] = useState<'count' | 'rate'>('count');
  const attendanceRanking = useMemo(
    () => getAttendanceRanking(filteredSessions, members, rankingIncludeBoardMembers),
    [filteredSessions, members, rankingIncludeBoardMembers],
  );

  const [popularGameGenres, setPopularGameGenres] = useState<string[]>([]);
  const [popularGameDifficulties, setPopularGameDifficulties] = useState<string[]>([]);
  const popularGames = useMemo(
    () => getPopularGames(filteredSessions, games, activeMembersCount, popularGameGenres, popularGameDifficulties),
    [filteredSessions, games, activeMembersCount, popularGameGenres, popularGameDifficulties],
  );

  const [corePlayerGenres, setCorePlayerGenres] = useState<string[]>([]);
  const [corePlayerDifficulties, setCorePlayerDifficulties] = useState<string[]>([]);
  const [corePlayerIncludeBoardMembers, setCorePlayerIncludeBoardMembers] = useState(false);
  const [corePlayerGameIds, setCorePlayerGameIds] = useState<string[]>([]);
  const [corePlayerGameSearch, setCorePlayerGameSearch] = useState('');
  const corePlayers = useMemo(
    () => getCorePlayers(
      filteredSessions, games, members, corePlayerGenres, corePlayerDifficulties,
      corePlayerIncludeBoardMembers, corePlayerGameIds,
    ),
    [filteredSessions, games, members, corePlayerGenres, corePlayerDifficulties, corePlayerIncludeBoardMembers, corePlayerGameIds],
  );

  const [expandedChart, setExpandedChart] = useState<ArchiveChartId | null>(null);
  const [formulaModal, setFormulaModal] = useState<ArchiveFormulaId | null>(null);

  const [attendanceTrendMetric, setAttendanceTrendMetric] = useState<'count' | 'rate'>('count');
  const isAllSemesters = selectedSemester === '전체';
  const attendanceTrend = useMemo(
    () => getAttendanceTrend(chronologicalSessions, members, isAllSemesters),
    [chronologicalSessions, members, isAllSemesters],
  );

  const [normalizeNewcomerTrend, setNormalizeNewcomerTrend] = useState(false);
  const newcomerTrend = useMemo(
    () => getNewcomerTrend(chronologicalSessions, members, normalizeNewcomerTrend, isAllSemesters),
    [chronologicalSessions, members, normalizeNewcomerTrend, isAllSemesters],
  );

  const stagnationTrend = useMemo(
    () => getStagnationIndex(chronologicalSessions, isAllSemesters),
    [chronologicalSessions, isAllSemesters],
  );
  const gameMmi = useMemo(
    () => getGameMmi(filteredSessions, activeMembersCount, games),
    [filteredSessions, activeMembersCount, games],
  );

  return {
    sessions, games, members,
    selectedSemester, setSelectedSemester, availableSemesters, filteredSessions,
    rankingIncludeBoardMembers, setRankingIncludeBoardMembers,
    attendanceRankingMetric, setAttendanceRankingMetric, attendanceRanking,
    popularGameGenres, setPopularGameGenres,
    popularGameDifficulties, setPopularGameDifficulties, popularGames,
    corePlayerGenres, setCorePlayerGenres,
    corePlayerDifficulties, setCorePlayerDifficulties,
    corePlayerIncludeBoardMembers, setCorePlayerIncludeBoardMembers,
    corePlayerGameIds, setCorePlayerGameIds,
    corePlayerGameSearch, setCorePlayerGameSearch, corePlayers,
    expandedChart, setExpandedChart, formulaModal, setFormulaModal,
    attendanceTrendMetric, setAttendanceTrendMetric, attendanceTrend,
    normalizeNewcomerTrend, setNormalizeNewcomerTrend, newcomerTrend, stagnationTrend, gameMmi,
  };
}
