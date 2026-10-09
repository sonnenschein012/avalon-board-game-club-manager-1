import { describe, expect, it } from 'vitest';
import type { SessionGroup } from '../../types';
import { simulateAutoAssign } from './autoAssignAlgorithm';
import { combineScores, compareUtility, evaluateUtilityGroup, pairKey, REVIEW_PARAMETERS, type UtilityContext } from './personalUtility';

// Entirely synthetic: five companion pairs and four groups of five.
const fixture = (): UtilityContext => {
  const years = [22, 24, 22, 23, 24, 22, 25, 26, 22, 23, 20, 22, 24, 22, 25, 21, 26, 23, 26, 24];
  const females = new Set([0, 2, 4, 7, 10, 11, 12]);
  return {
    people: new Map(years.map((year, i) => [`p${i}`, {
      id: `p${i}`, memberId: `m${i}`, name: `합성회원 ${i}`, year,
      gender: females.has(i) ? '여' : '남', board: i < 5,
    }])),
    requests: new Map(Array.from({ length: 5 }, (_, i) => {
      const pair: [string, string] = [`p${2 * i}`, `p${2 * i + 1}`];
      return [pairKey(...pair), pair];
    })),
    exposures: new Map(), absentRequests: [], requestChoices: [],
    // The recorded single-swap trap belongs to these supported, previous parameters.
    parameters: { ...REVIEW_PARAMETERS, sameA: 3, sameK: 1.2, otherA: 4, otherK: 0.35 },
  };
};
const groups = (ids: string[][]): SessionGroup[] => ids.map((memberIds, i) => ({ id: `g${i}`, memberIds, targetSize: 5, gameIds: [] }));
const score = (assignment: SessionGroup[], context: UtilityContext) => combineScores(assignment.map(g => evaluateUtilityGroup(g.memberIds, context)), context.parameters);

describe('bounded companion-pair search', () => {
  it('escapes a fulfilled-request trap that has no improving single-person swap', () => {
    const context = fixture();
    const trapped = groups([
      ['p18', 'p7', 'p6', 'p16', 'p14'], ['p8', 'p9', 'p2', 'p3', 'p11'],
      ['p15', 'p10', 'p5', 'p13', 'p4'], ['p19', 'p0', 'p1', 'p12', 'p17'],
    ]);
    const before = score(trapped, context);
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      for (let ai = 0; ai < 5; ai++) for (let bi = 0; bi < 5; bi++) {
        const candidate = groups(trapped.map(g => [...g.memberIds]));
        [candidate[a]!.memberIds[ai], candidate[b]!.memberIds[bi]] = [candidate[b]!.memberIds[bi]!, candidate[a]!.memberIds[ai]!];
        expect(compareUtility(score(candidate, context), before)).toBeGreaterThanOrEqual(0);
      }
    }
    const initialGroups = groups([[], [], [], []]);
    const args = { initialGroups, context, availableIds: [...context.people.keys()], withHistory: true };
    const result = simulateAutoAssign(args);
    expect(result.score.requestProduct).toBe(1024n);
    expect(result.score.boardMissing).toBe(before.boardMissing);
    expect(result.score.welfare).toBeGreaterThan(before.welfare + 0.001);
    expect(result.score.welfare).toBeCloseTo(score(result.updatedGroups, context).welfare, 12);
    expect(result.updatedGroups.every(g => g.memberIds.length === 5)).toBe(true);
    expect(new Set(result.updatedGroups.flatMap(g => g.memberIds)).size).toBe(20);
    expect(initialGroups.every(g => g.memberIds.length === 0)).toBe(true);
    expect(simulateAutoAssign(args)).toEqual(result);
  }, 15_000); // Runs the bounded multi-start search twice plus all single-swap alternatives.

  it('keeps fixed endpoints in place while satisfying their movable partners', () => {
    const context = fixture();
    const initialGroups = groups([['p0'], ['p2'], [], []]);
    const result = simulateAutoAssign({ initialGroups, context, availableIds: [...context.people.keys()].filter(id => id !== 'p0' && id !== 'p2') });
    expect(result.updatedGroups[0]!.memberIds).toEqual(expect.arrayContaining(['p0', 'p1']));
    expect(result.updatedGroups[1]!.memberIds).toEqual(expect.arrayContaining(['p2', 'p3']));
    expect(result.fixed).toEqual({ p0: 'g0', p2: 'g1' });
    expect(result.score.requestProduct).toBe(1024n);
    expect(initialGroups.map(g => g.memberIds)).toEqual([['p0'], ['p2'], [], []]);
  });
});
