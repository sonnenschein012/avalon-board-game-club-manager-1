import type { Game, Member, Session } from '../../types';
import { formatTimestamp } from '../../lib/utils';

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[,"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function serializeCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n');
}

export function buildMembersCsv(members: Member[], sessions: Session[]): string {
  const attendanceCounts: Record<string, number> = {};
  sessions.forEach(session => {
    session.groups.forEach(group => {
      group.memberIds.forEach(memberId => {
        attendanceCounts[memberId] = (attendanceCounts[memberId] || 0) + 1;
      });
    });
  });

  return serializeCsv(
    ['이름', '닉네임', '학번', '연락처', '성별', '가입학기', '상태', '휴면학기', '임원여부', '선호장르', '누적참석횟수', '메모'],
    members.map(member => [
      member.name || '',
      member.nickname || '',
      member.studentId || '',
      member.phone || '',
      member.gender || '',
      member.semester || '',
      member.status || '활동',
      member.dormantSemester || '',
      member.isBoardMember ? 'Y' : 'N',
      Array.isArray(member.preferredGenre) ? member.preferredGenre.join(', ') : '',
      attendanceCounts[member.id] || 0,
      member.memo || '',
    ]),
  );
}

export function buildGamesCsv(games: Game[]): string {
  return serializeCsv(
    ['게임명', '최소인원', '최대인원', '추천최소인원', '추천최대인원', '난이도', '장르', '메모'],
    games.map(game => [
      game.title,
      game.minPlayers,
      game.maxPlayers,
      game.bestMinPlayers,
      game.bestMaxPlayers,
      game.complexity,
      (game.genres || []).join('/'),
      game.memo,
    ]),
  );
}

export function buildSessionsCsv(
  sessions: Session[],
  membersById: ReadonlyMap<string, Member>,
  gameTitlesById: ReadonlyMap<string, string>,
): string {
  const gameTitles = new Map<string, string>();
  gameTitlesById.forEach((title, id) => {
    gameTitles.set(id, title);
    // Older archives store a game title directly in gameIds.
    gameTitles.set(title, title);
  });

  const rows: string[][] = [];
  sessions.forEach(session => {
    const date = session.date?.toDate
      ? (session.date.toDate().toISOString().split('T')[0] ?? '')
      : formatTimestamp(session.date);
    const sessionName = session.name || `${date} 정기 모임`;

    session.groups.forEach((group, index) => {
      const members = group.memberIds.map(memberId => {
        const member = membersById.get(memberId);
        // An explicit empty snapshot means no board members, even if the current roster changed.
        const isBoardMember = session.boardMemberIds?.includes(memberId) ?? member?.isBoardMember ?? false;
        const name = member?.nickname || member?.name || 'Unknown';
        return isBoardMember ? `${name}(임원)` : name;
      }).join(', ');
      const games = group.gameIds?.map(gameId => gameTitles.get(gameId) || gameId).join(', ') || '';
      rows.push([date, sessionName, group.name || `TEAM ${index + 1}`, members, games]);
    });
  });

  rows.sort((a, b) => (b[0] ?? '').localeCompare(a[0] ?? ''));
  return serializeCsv(['날짜', '세션명', '조 이름', '조원 명단', '플레이한 게임들'], rows);
}
