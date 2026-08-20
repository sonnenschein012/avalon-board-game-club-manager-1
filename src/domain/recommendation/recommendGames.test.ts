import { describe, expect, it } from 'vitest';
import { recommendGames } from './recommendGames';
import { Member, Game, Session } from '../../types';
import type { Timestamp } from 'firebase/firestore';

describe('recommendGames', () => {
  const members: Member[] = [
    { id: 'm1', name: 'A', nickname: 'A', studentId: '2023', phone: '', gender: '남', semester: '2025-1', preferredGenre: [], createdAt: { toMillis: () => 1000 } as unknown as Timestamp },
    { id: 'm2', name: 'B', nickname: 'B', studentId: '2024', phone: '', gender: '여', semester: '2025-1', preferredGenre: [], createdAt: { toMillis: () => 1000 } as unknown as Timestamp },
    { id: 'm3', name: 'C', nickname: 'C', studentId: '2025', phone: '', gender: '남', semester: '2025-1', preferredGenre: [], createdAt: { toMillis: () => 1000 } as unknown as Timestamp }
  ];

  const games: Game[] = [
    { id: 'g1', title: 'Game 1', minPlayers: 2, maxPlayers: 4, bestMinPlayers: 3, bestMaxPlayers: 3 },
    { id: 'g2', title: 'Game 2', minPlayers: 3, maxPlayers: 6 },
    { id: 'g3', title: 'Game 3', minPlayers: 2, maxPlayers: 5 },
    { id: 'g4', title: 'Game 4', minPlayers: 1, maxPlayers: 2 }
  ];

  const sessions: Session[] = [
    {
      id: 's1',
      name: 'session1',
      date: { toMillis: () => 1000 } as unknown as Timestamp,
      groups: [
        {
          id: 'grp1',
          name: 'Grp 1',
          memberIds: ['m1', 'm2'],
          gameIds: ['g1', 'g1', 'g1', 'g2'] // g1 was played 3 times
        }
      ]
    }
  ];

  it('should return SIZE_MATCH reasoning', () => {
    const result = recommendGames(members, 'SIZE_MATCH', 123, sessions, games, members);
    // Group size is 3 (m1, m2, m3)
    // Game 1 best is 3-3, so it should be perfect match
    const recommendedG1 = result.find(r => r.game.id === 'g1');
    expect(recommendedG1).toBeDefined();
    expect(recommendedG1?.reasons?.some(r => r.type === 'SIZE_MATCH')).toBe(true);
  });

  it('should return NEW_GAME reasoning', () => {
    // m1, m2 played g1, g2
    // m3 has not played any
    const result = recommendGames(members, 'NEW_GAME', 123, sessions, games, members);
    // New games should be pushed to the top or marked as new game
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.reasons?.some(r => r.type === 'NEW_GAME')).toBe(true);
  });

  it('should return POPULAR reasoning', () => {
    const result = recommendGames(members, 'POPULAR', 123, sessions, games, members);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.reasons?.some(r => r.type === 'POPULAR')).toBe(true);
  });

  it('should return HIDDEN or low relevance for not enough plays', () => {
    const result = recommendGames(members, 'HIDDEN', 123, sessions, games, members);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.reasons?.some(r => r.type === 'HIDDEN')).toBe(true);
  });

  it('should return RANDOM reasoning', () => {
    const result = recommendGames(members, 'RANDOM', 123, sessions, games, members);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.reasons?.some(r => r.type === 'RANDOM')).toBe(true);
  });
});
