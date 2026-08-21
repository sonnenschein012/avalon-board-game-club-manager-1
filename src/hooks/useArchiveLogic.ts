import { useState, useMemo } from 'react';
import { useFirestore } from './useFirestore';
import { Session, Game, Member } from '../types';
import { orderBy } from 'firebase/firestore';
import { getSemester } from '../domain/semester/getSemester';
import { getAttendanceRanking } from '../domain/stats/getAttendanceRanking';
import { getPopularGames } from '../domain/stats/getPopularGames';
import { getCorePlayers } from '../domain/stats/getCorePlayers';
import { getAttendanceTrend } from '../domain/stats/getAttendanceTrend';
import { getNewcomerTrend } from '../domain/stats/getNewcomerTrend';
import { getStagnationIndex } from '../domain/stats/getStagnationIndex';
import { getGameMmi } from '../domain/stats/getGameMmi';
import { getAvailableArchiveSemesters } from '../domain/semester/semesterSelection';

export function useArchiveLogic() {
  const { data: sessions } = useFirestore<Session>('sessions', orderBy('date', 'desc'));
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

  const [includeBoardMembers, setIncludeBoardMembers] = useState(false);
  const [attendanceMetric, setAttendanceMetric] = useState<'count' | 'rate'>('count');
  const w1Ranking = useMemo(() => getAttendanceRanking(filteredSessions, members, includeBoardMembers), [filteredSessions, members, includeBoardMembers]);

  const [w2Genres, setW2Genres] = useState<string[]>([]);
  const [w2Difficulties, setW2Difficulties] = useState<string[]>([]);
  const w2PopularGames = useMemo(() => getPopularGames(filteredSessions, games, activeMembersCount, w2Genres, w2Difficulties), [filteredSessions, games, activeMembersCount, w2Genres, w2Difficulties]);

  const [w3Genres, setW3Genres] = useState<string[]>([]);
  const [w3Difficulties, setW3Difficulties] = useState<string[]>([]);
  const [w3IncludeBoardMembers, setW3IncludeBoardMembers] = useState(false);
  const [w3TargetGames, setW3TargetGames] = useState<string[]>([]);
  const [w3GameSearchQuery, setW3GameSearchQuery] = useState('');
  const w3CorePlayers = useMemo(() => getCorePlayers(filteredSessions, games, members, w3Genres, w3Difficulties, w3IncludeBoardMembers, w3TargetGames), [filteredSessions, games, members, w3Genres, w3Difficulties, w3IncludeBoardMembers, w3TargetGames]);

  const [expandedChart, setExpandedChart] = useState<'w4' | 'w5' | 'w6' | null>(null);
  const [formulaModal, setFormulaModal] = useState<'w5' | 'w6' | 'w7' | null>(null);

  const [w4Metric, setW4Metric] = useState<'count' | 'rate'>('count');
  const isAllSemesters = selectedSemester === '전체';
  const w4Data = useMemo(() => getAttendanceTrend(chronologicalSessions, members, isAllSemesters), [chronologicalSessions, members, isAllSemesters]);

  const [w5Normalize, setW5Normalize] = useState<boolean>(false);
  const w5Data = useMemo(() => getNewcomerTrend(chronologicalSessions, members, w5Normalize, isAllSemesters), [chronologicalSessions, members, w5Normalize, isAllSemesters]);

  const w6Data = useMemo(() => getStagnationIndex(chronologicalSessions, isAllSemesters), [chronologicalSessions, isAllSemesters]);
  const w7MMI = useMemo(() => getGameMmi(filteredSessions, activeMembersCount, games), [filteredSessions, activeMembersCount, games]);

  return {
    sessions, games, members,
    selectedSemester, setSelectedSemester, availableSemesters, filteredSessions,
    includeBoardMembers, setIncludeBoardMembers, attendanceMetric, setAttendanceMetric, w1Ranking,
    w2Genres, setW2Genres, w2Difficulties, setW2Difficulties, w2PopularGames,
    w3Genres, setW3Genres, w3Difficulties, setW3Difficulties, w3IncludeBoardMembers, setW3IncludeBoardMembers, w3TargetGames, setW3TargetGames, w3GameSearchQuery, setW3GameSearchQuery, w3CorePlayers,
    expandedChart, setExpandedChart, formulaModal, setFormulaModal,
    w4Metric, setW4Metric, w4Data,
    w5Normalize, setW5Normalize, w5Data, w6Data, w7MMI,
  };
}
