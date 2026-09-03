import type { Game, Member, StoredSessionGroup } from '../../types';

export interface ImportedSession {
  name: string;
  date: string;
  groups: Omit<StoredSessionGroup, 'id'>[];
  boardMemberIds?: string[];
}

const cleanString = (value = '') => value.replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();
const splitNames = (value = '') => value.split(',').map(name => name.trim()).filter(Boolean);

function findMember(token: string, members: readonly Member[]) {
  const cleanToken = token.replace(/\(임원\)|👑|\*/g, '').trim();
  const normalizedToken = cleanString(cleanToken);
  const normalizedName = normalizedToken.replace(/^\d{2}/, '');
  return members.find(member =>
    member.nickname === cleanToken
    || member.name === cleanToken
    || cleanString(member.nickname) === normalizedToken
    || cleanString(member.name) === normalizedToken
    || cleanString(member.name).replace(/^\d{2}/, '') === normalizedName
  );
}

/** Reads both historical roster CSVs and current exports without changing their role snapshots. */
export function parseSessionCsvRows(
  rows: readonly Record<string, string>[],
  fields: readonly string[],
  members: readonly Member[],
  games: readonly Game[],
): { sessions: ImportedSession[]; missingGames: string[] } {
  const findGame = (name: string) => games.find(game => cleanString(game.title) === cleanString(name));
  const missingGames = new Set<string>();
  for (const row of rows) {
    for (const gameName of splitNames(row['플레이한 게임들'])) {
      if (!findGame(gameName)) missingGames.add(gameName);
    }
  }
  if (missingGames.size > 0) return { sessions: [], missingGames: [...missingGames] };

  // Legacy files have no role snapshot. An explicit empty snapshot in current
  // exports must remain [], so later member-role changes cannot rewrite history.
  const hasSnapshotColumns = fields.includes('세션명');
  const sessions = new Map<string, ImportedSession>();
  for (const row of rows) {
    const date = (row['날짜'] || '').trim();
    if (!date) continue;
    const name = (row['세션명'] || '').trim() || `${date} 정기 모임`;
    const sessionKey = `${date}\u0000${name}`;
    let session = sessions.get(sessionKey);
    if (!session) {
      session = { date, name, groups: [], ...(hasSnapshotColumns ? { boardMemberIds: [] } : {}) };
      sessions.set(sessionKey, session);
    }

    const memberIds: string[] = [];
    for (const token of splitNames(row['조원 명단'] || row['조원 명단(닉네임)'])) {
      const member = findMember(token, members);
      if (!member) continue;
      memberIds.push(member.id);
      if (/\(임원\)|👑|\*$/.test(token) && session.boardMemberIds && !session.boardMemberIds.includes(member.id)) {
        session.boardMemberIds.push(member.id);
      }
    }

    session.groups.push({
      name: (row['조 이름'] || '').trim(),
      memberIds,
      gameIds: splitNames(row['플레이한 게임들']).flatMap(name => {
        const game = findGame(name);
        return game ? [game.id] : [];
      }),
      targetSize: memberIds.length || 4,
      notes: '',
    });
  }
  return { sessions: [...sessions.values()], missingGames: [] };
}
