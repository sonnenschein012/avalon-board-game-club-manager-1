import { Member, Game, Session } from '../../types';

export function getMemberPlayedGames(memberId: string, sessions: Session[]): Set<string> {
  const played = new Set<string>();
  sessions.forEach(session => {
    session.groups.forEach(group => {
      if (group.memberIds.includes(memberId)) {
        group.gameIds.forEach(gid => played.add(gid));
      }
    });
  });
  return played;
}

function prng(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return (h / 4294967296) + 0.5;
}

export type RecMode = 'SIZE_MATCH' | 'NEW_GAME' | 'POPULAR' | 'HIDDEN' | 'RANDOM';

export type Reason = { type: string, label: string, detail: string };

export function recommendGames(
  groupMembers: Member[],
  mode: RecMode,
  seed: number,
  sessions: Session[],
  games: Game[],
  members: Member[]
): { game: Game; playedCount: number; score: number; reasons: Reason[] }[] {
  const groupSize = groupMembers.length;
  if (groupSize === 0) return [];

  const playedMaps = groupMembers.map(m => ({
    member: m,
    played: getMemberPlayedGames(m.id, sessions)
  }));

  const sortedSessions = [...sessions].sort((a, b) => {
    const da = a.date?.toMillis ? a.date.toMillis() : 0;
    const db = b.date?.toMillis ? b.date.toMillis() : 0;
    return db - da;
  });

  const totalPlays: Record<string, number> = {};
  const gameUniquePlayers: Record<string, Set<string>> = {};
  sessions.forEach(s => {
    s.groups.forEach(g => {
      g.gameIds.forEach(gid => {
        totalPlays[gid] = (totalPlays[gid] || 0) + 1;
        if (!gameUniquePlayers[gid]) gameUniquePlayers[gid] = new Set();
        const gidSet = gameUniquePlayers[gid] as Set<string>;
        g.memberIds.forEach(mid => gidSet.add(mid));
      });
    });
  });

  const N = members.length || 1;

  const baseCandidates = games.filter(game => {
    const min = game.minPlayers || 1;
    const max = game.maxPlayers || 99;
    return groupSize >= min && groupSize <= max;
  });

  const computeForSeed = (s: number) => {
    const candidates = baseCandidates.map(game => {
      const playedCount = groupMembers.filter(m => {
        const played = playedMaps.find(pm => pm.member.id === m.id)?.played;
        return played?.has(game.id) || played?.has(game.title);
      }).length;

      const gid = game.id;
      const title = game.title;
      const gameTotalPlays = (totalPlays[gid] || 0) + (totalPlays[title] || 0);
      const getIsPlayed = (gameIds: string[]) => gameIds.includes(gid) || gameIds.includes(title);
      const rand = prng(gid + s.toString());

      return { game, playedCount, gameTotalPlays, getIsPlayed, rand };
    });

    type Reason = { type: string, label: string, detail: string };
    
    let results: { game: Game; playedCount: number; score: number; gameTotalPlays?: number; unplayedRate?: number; reasons: Reason[] }[];

    switch (mode) {
      case 'SIZE_MATCH':
        results = candidates.map(c => {
          const bestMin = c.game.bestMinPlayers || c.game.minPlayers || 1;
          const bestMax = c.game.bestMaxPlayers || c.game.maxPlayers || 99;
          let sizeScore = 0.4;
          const reasons: Reason[] = [];
          if (groupSize >= bestMin && groupSize <= bestMax) {
            sizeScore = 1.0;
            reasons.push({ type: 'SIZE_MATCH', label: '인원 적합', detail: '추천 인원 범위에 맞음' });
          }
          else if (groupSize >= bestMin - 1 && groupSize <= bestMax + 1) {
            sizeScore = 0.7;
            reasons.push({ type: 'SIZE_MATCH', label: '인원 근접', detail: '추천 인원 범위 근접' });
          } else {
            reasons.push({ type: 'SIZE_MATCH', label: '인원 무관', detail: '인원 범위와 무관한 추천' });
          }
          
          return { ...c, score: sizeScore + (c.rand * 0.001), reasons };
        }).sort((a, b) => b.score - a.score);
        break;

      case 'NEW_GAME': {
        const scoredNewGame = candidates.map(c => {
          const unplayedRate = (groupSize - c.playedCount) / groupSize;
          const reasons: Reason[] = [{
            type: 'NEW_GAME',
            label: unplayedRate === 1 ? '전원 미경험' : '미경험 신선함',
            detail: `미경험자가 ${groupSize - c.playedCount}명 포함됨`
          }];
          return { ...c, score: unplayedRate * 10000 + c.gameTotalPlays, unplayedRate, gameTotalPlays: c.gameTotalPlays, reasons };
        });
        
        const validUnplayed = scoredNewGame.filter(c => c.unplayedRate > 0).sort((a, b) => b.score - a.score);
        if (validUnplayed.length < 3) {
          const zeroUnplayed = scoredNewGame.filter(c => c.unplayedRate === 0).map(c => ({
            ...c,
            reasons: [{ type: 'NEW_GAME', label: '경험 게임', detail: '그룹원이 모두 접해본 게임' }]
          })).sort((a, b) => (b.gameTotalPlays || 0) - (a.gameTotalPlays || 0));
          results = [...validUnplayed, ...zeroUnplayed];
        } else {
          results = validUnplayed;
        }
        break;
      }

      case 'POPULAR':
        results = candidates.map(c => {
          let totalRecentExposure = 0;
          groupMembers.forEach(m => {
            const mSessions = sortedSessions.filter(s => s.groups.some(g => g.memberIds.includes(m.id)));
            const recent = mSessions.slice(0, 2);
            let exposure = 0;
            recent.forEach(sess => {
              sess.groups.filter(g => g.memberIds.includes(m.id)).forEach(g => {
                if (c.getIsPlayed(g.gameIds)) exposure++;
              });
            });
            totalRecentExposure += exposure;
          });
          const avgExposure = totalRecentExposure / groupSize;
          const score = Math.log10(c.gameTotalPlays + 1) * Math.max(0, 1 - (avgExposure * 0.4));
          const reasons: Reason[] = [{
            type: 'POPULAR',
            label: '인기 게임',
            detail: `지금까지 전체 ${c.gameTotalPlays}회 플레이됨`
          }];
          return { ...c, score: score + (c.rand * 0.0001), reasons };
        }).sort((a, b) => b.score - a.score);
        break;

      case 'HIDDEN':
        results = candidates.map(c => {
          const reasons: Reason[] = [];
          if (c.gameTotalPlays < 3) {
            reasons.push({ type: 'HIDDEN', label: '낮은 관련성', detail: '숨겨진 꿀잼 탐색 조건 미달' });
            return { ...c, score: -1, reasons };
          }
          
          const sizeA = gameUniquePlayers[c.game.id]?.size || 0;
          const sizeB = gameUniquePlayers[c.game.title]?.size || 0;
          const ng = Math.max(sizeA, sizeB); 
          const unspreadRatio = 1 - (ng / N);
          const score = Math.log10(c.gameTotalPlays + 1) * unspreadRatio;
          
          reasons.push({
            type: 'HIDDEN',
            label: '숨은 꿀잼',
            detail: `경험자가 소수인 숨겨진 수작`
          });
          
          return { ...c, score: score + (c.rand * 0.0001), reasons };
        }).filter(c => c.score >= 0).sort((a, b) => b.score - a.score);
        break;

      case 'RANDOM':
        results = candidates.filter(c => {
          let everyonePlayedRecently = true;
          groupMembers.forEach(m => {
            const mSessions = sortedSessions.filter(s => s.groups.some(g => g.memberIds.includes(m.id)));
            const recent3 = mSessions.slice(0, 3);
            let playedInRecent3 = false;
            recent3.forEach(sess => {
              sess.groups.filter(g => g.memberIds.includes(m.id)).forEach(g => {
                if (c.getIsPlayed(g.gameIds)) playedInRecent3 = true;
              });
            });
            if (!playedInRecent3) everyonePlayedRecently = false;
          });
          return !everyonePlayedRecently;
        }).map(c => ({
          ...c,
          score: c.rand,
          reasons: [{ type: 'RANDOM', label: '무작위 제안', detail: `전원이 최근에 플레이하지 않음` }]
        })).sort((a, b) => b.score - a.score);
        break;
      
      default:
        results = candidates.map(c => ({ ...c, score: c.rand, reasons: [{ type: 'UNKNOWN', label: '일반 추천', detail: '기본 추천' }] })).sort((a, b) => b.score - a.score);
        break;
    }
    return results;
  };

  const getResultsForSeed = (s: number): { game: Game; playedCount: number; score: number; reasons: Reason[] }[] => {
    const raw = computeForSeed(s);
    if (s === 0 || raw.length < 6) return raw;
    
    const prevIds = getResultsForSeed(s - 1).slice(0, 3).map(r => r.game.id);
    const filtered = raw.filter(c => !prevIds.includes(c.game.id));
    
    if (filtered.length < 3) return raw;
    return filtered;
  };

  return getResultsForSeed(seed).slice(0, 3).map(r => ({ game: r.game, playedCount: r.playedCount, score: r.score, reasons: r.reasons }));
}
