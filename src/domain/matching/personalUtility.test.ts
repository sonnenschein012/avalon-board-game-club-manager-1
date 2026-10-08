import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { Attendee, Member, Session, SessionGroup } from '../../types';
import { buildUtilityContext, combineScores, compareUtility, evaluateUtilityGroup, getRequestNotices, pairKey, relativeProtection } from './personalUtility';
import { simulateAutoAssign, getSizingNotices } from './autoAssignAlgorithm';
import { solveGroupSizes } from './groupSizing.mjs';
import { evaluateAssignment } from '../../../scripts/group-utility-prototype.mjs';

const date = (s: string) => Timestamp.fromDate(new Date(`${s}T12:00:00`));
const fixture = (count = 8) => {
  const members: Member[] = Array.from({ length: count }, (_, i) => ({
    id: `m${i}`, name: `회원${String(i).padStart(2, '0')}`, nickname: '', studentId: String(23 + i % 3),
    phone: '', gender: i % 2 ? '여' : '남', semester: '2026-2', preferredGenre: [], createdAt: date('2026-01-01'), isBoardMember: i < 2,
  }));
  const attendees: Attendee[] = members.map((m, i) => ({ id: `a${i}`, name: m.name, request: '', status: '대기', importDate: date('2026-10-08'), importId: 'test' }));
  const input = { members, attendees, sessions: [] as Session[], assignmentDate: '2026-10-08' };
  return input;
};
const groups = (a: string[] = [], b: string[] = []): SessionGroup[] => [
  { id: 'one', name: '첫 조', memberIds: a, gameIds: ['keep-game'], notes: 'keep-note' },
  { id: 'two', memberIds: b, gameIds: [] },
];
const session = (day: string, ids: string[]): Session => ({ id: day, name: day, date: date(day), groups: [{ id: 'past', memberIds: ids, gameIds: [] }] });

describe('personal assignment integration', () => {
  it('uses shift-invariant importance with a fixed scale and keeps common improvements valuable', () => {
    const a = relativeProtection([2, 4, 6], 2), b = relativeProtection([-4, -2, 0], 2);
    expect(a.converted).toEqual(b.converted);
    expect(a.weights).toEqual(b.weights);
    expect(a.welfare - b.welfare).toBeCloseTo(27, 12);
    expect(relativeProtection([4, 8, 12], 2).weights).not.toEqual(a.weights);
    expect(relativeProtection([5, 5], 2).welfare).toBeGreaterThan(relativeProtection([0, 10], 2).welfare);
    expect(relativeProtection([7, 7, 7], 2).weights).toEqual([1.5, 1.5, 1.5]);
    expect(relativeProtection([], 2).welfare).toBe(0);
    expect(Number.isFinite(relativeProtection([-1e6, 0, 1e6], 2).welfare)).toBe(true);
  });

  it('matches displayed importance to the true whole-assignment derivative and preserves all sole improvements', () => {
    for (const scale of [0.1, 2, 10]) for (const values of [[-8, -4, 0, 4, 8], [0, 0, 20], [-20, 0, 0], [0], [3, 3, 3]]) {
      const score = relativeProtection(values, scale);
      expect(score.weights.every(w => w >= 1 && w <= 2)).toBe(true);
      for (let i = 0; i < values.length; i++) {
        const plus = [...values], minus = [...values]; plus[i]! += 1e-5; minus[i]! -= 1e-5;
        const derivative = (relativeProtection(plus, scale).welfare - relativeProtection(minus, scale).welfare) / 2e-5;
        expect(derivative).toBeCloseTo(score.weights[i]!, 7);
        const improved = [...values]; improved[i]! += 1;
        const gain = relativeProtection(improved, scale).welfare - score.welfare;
        expect(gain).toBeGreaterThanOrEqual(1 - 1e-10);
        expect(gain).toBeLessThanOrEqual(2 + 1e-10);
      }
    }
  });

  it('includes untouched people in protection, since a local comparison can reverse the correct decision', () => {
    expect(relativeProtection([1, 2.9], 2).welfare).toBeGreaterThan(relativeProtection([0, 4], 2).welfare);
    expect(relativeProtection([1, 2.9, 100, 100, 100, 100], 2).welfare)
      .toBeLessThan(relativeProtection([0, 4, 100, 100, 100, 100], 2).welfare);
    const input = fixture(12), context = buildUtilityContext(input);
    const first = evaluateUtilityGroup(['a0', 'a1', 'a2', 'a3'], context);
    const second = evaluateUtilityGroup(['a4', 'a5', 'a6', 'a7'], context);
    const third = evaluateUtilityGroup(['a8', 'a9', 'a10', 'a11'], context);
    const all = combineScores([first, second, third], { ...context.parameters, protectionS: 0.5 });
    expect(all.welfare).toBeCloseTo(relativeProtection(all.people.map(p => p.utility), 0.5).welfare, 12);
    expect(combineScores([combineScores([first, second]), third], { ...context.parameters, protectionS: 0.5 }).welfare).toBeCloseTo(all.welfare, 12);
    const result = simulateAutoAssign({ availableIds: [...context.people.keys()], context,
      initialGroups: [{ id: 'a', memberIds: [], gameIds: [] }, { id: 'b', memberIds: [], gameIds: [] }, { id: 'c', memberIds: [], gameIds: [] }] });
    const actual = combineScores(result.updatedGroups.map(g => evaluateUtilityGroup(g.memberIds, context)), context.parameters);
    expect(result.score).toEqual(actual);
  });
  it('agrees with the independent review evaluator for every eight-person two-group partition', () => {
    const input = fixture(); input.attendees[0]!.request = '회원01 회원02';
    input.attendees[3]!.request = '회원04';
    const historicalIds = [['m0', 'm2', 'm4', 'm6'], ['m1', 'm3', 'm5', 'm7']];
    input.sessions = [{ id: 'history', name: 'history', date: date('2026-10-01'),
      groups: historicalIds.map((memberIds, i) => ({ id: String(i), memberIds, gameIds: [] })) }];
    const context = buildUtilityContext(input);
    const ids = [...context.people.keys()];
    for (let a = 1; a < 6; a++) for (let b = a + 1; b < 7; b++) for (let c = b + 1; c < 8; c++) {
      const first = [ids[0]!, ids[a]!, ids[b]!, ids[c]!];
      const second = ids.filter(id => !first.includes(id));
      const score = combineScores([evaluateUtilityGroup(first, context), evaluateUtilityGroup(second, context)]);
      const reference = evaluateAssignment({
        members: [...context.people.values()].map(p => ({ id: p.id, gender: p.gender === '남' ? 'M' : 'F', year: p.year!, board: p.board })),
        groups: [{ id: 'first', capacity: 4, memberIds: first }, { id: 'second', capacity: 4, memberIds: second }],
        requests: [...context.requests.values()], fixed: {},
        history: [historicalIds.map(g => g.map(id => id.replace('m', 'a')))],
      });
      expect(score.requestProduct).toBe(reference.requestProduct);
      expect(score.boardMissing).toBe(reference.boardMissing);
      expect(score.totalUtility).toBeCloseTo(reference.totalUtility, 12);
      expect(score.welfare).toBeCloseTo(reference.welfare, 12);
    }
  });
  it('keeps name substring matching, deduplicates reciprocal requests and reports absent recipients only', () => {
    const input = fixture();
    input.attendees[0]!.request = '회원01 회원02 미등록이름';
    input.attendees[1]!.request = '회원00';
    input.attendees[2]!.status = '결석';
    const context = buildUtilityContext(input);
    expect(context.requests.size).toBe(1);
    expect(context.requests.has(pairKey('a0', 'a1'))).toBe(true);
    expect(context.absentRequests).toEqual([{ requesterId: 'a0', requester: '회원00', recipient: '회원02' }]);
    expect(context.people.has('a2')).toBe(false);
    input.attendees[0]!.request = '회원01과 같은 조는 싫어요';
    expect(buildUtilityContext(input).requests.size).toBe(1); // Intentionally retained legacy interpretation.
  });

  it('excludes missing year and unknown gender bilaterally without inventing defaults', () => {
    const input = fixture();
    input.members[1]!.gender = '기타'; input.members[1]!.studentId = '';
    const context = buildUtilityContext(input);
    const score = evaluateUtilityGroup(['a0', 'a1'], context);
    expect(score.people.every(p => p.sameUtility === 0 && p.otherUtility === 0 && p.yearCost === 0)).toBe(true);
    expect(context.people.get('a1')!.year).toBe(null);
  });

  it('uses individual attendance decay, chronological history and excludes same-day/future records', () => {
    const input = fixture();
    input.sessions = [session('2026-09-01', ['m0', 'm1']), session('2026-10-09', ['m0', 'm1']),
      session('2026-09-15', ['m1']), session('2026-10-08', ['m0', 'm1']), session('2026-10-01', ['m0', 'm1'])];
    const context = buildUtilityContext(input);
    expect(context.exposures.get('a0')!.get('a1')).toBeCloseTo(1.35, 12);
    expect(context.exposures.get('a1')!.get('a0')).toBeCloseTo(1.1225, 12);
    expect(evaluateUtilityGroup(['a0', 'a1'], context).people[0]!.reunionCost).toBeCloseTo(0.6 * 1.35 ** 2);
    input.attendees[0]!.request = '회원01';
    expect(evaluateUtilityGroup(['a0', 'a1'], buildUtilityContext(input)).people.every(p => p.reunionCost === 0)).toBe(true);
  });

  it('compares requests before board coverage and welfare without big penalties', () => {
    const input = fixture(); input.attendees[0]!.request = '회원01';
    const context = buildUtilityContext(input);
    const together = combineScores([evaluateUtilityGroup(['a0', 'a1', 'a2', 'a3'], context), evaluateUtilityGroup(['a4', 'a5', 'a6', 'a7'], context)]);
    const separate = combineScores([evaluateUtilityGroup(['a0', 'a2', 'a3', 'a4'], context), evaluateUtilityGroup(['a1', 'a5', 'a6', 'a7'], context)]);
    expect(together.requestProduct).toBe(4n);
    expect(together.boardMissing).toBe(1);
    expect(compareUtility({ ...together, welfare: -1e100 }, separate)).toBeLessThan(0);
    expect(compareUtility({ ...together, requestProduct: 1n, welfare: 1e100 }, separate)).toBeGreaterThan(0);
  });

  it('fills capacities, preserves manual placements and group metadata, and is repeatable', () => {
    const input = fixture(); input.attendees[0]!.request = '회원01';
    const context = buildUtilityContext(input);
    const initialGroups = groups(['a0'], ['a1']);
    const original = JSON.stringify(initialGroups);
    const args = { initialGroups, context, availableIds: ['a2', 'a3', 'a4', 'a5', 'a6', 'a7'], withHistory: true };
    const result = simulateAutoAssign(args);
    expect(result.updatedGroups.map(g => g.memberIds.length)).toEqual([4, 4]);
    expect(result.updatedGroups[0]!.memberIds).toContain('a0');
    expect(result.updatedGroups[1]!.memberIds).toContain('a1');
    expect(result.updatedGroups[0]!.gameIds).toEqual(['keep-game']);
    expect(result.updatedGroups[0]!.notes).toBe('keep-note');
    expect(new Set(result.updatedGroups.flatMap(g => g.memberIds)).size).toBe(8);
    expect(JSON.stringify(initialGroups)).toBe(original);
    expect(simulateAutoAssign(args).updatedGroups).toEqual(result.updatedGroups);
    expect(getRequestNotices(result.updatedGroups, context, result.fixed).join()).toContain('수동 배치를 유지');
    expect(() => JSON.stringify(result.samples)).not.toThrow();
  });

  it('optimizes requests even when that leaves a group without a board member', () => {
    const input = fixture(); input.attendees[0]!.request = '회원01';
    const context = buildUtilityContext(input);
    const result = simulateAutoAssign({ initialGroups: groups(), context, availableIds: [...context.people.keys()] });
    expect(result.score.requestProduct).toBe(4n);
    expect(result.score.boardMissing).toBe(1);
    expect(getRequestNotices(result.updatedGroups, context)).toEqual([]);
  });

  it.each(['star', 'chain', 'dense', 'pinned-apart'])('matches exhaustive small-case optimization for %s requests', kind => {
    const input = fixture();
    if (kind === 'star') input.attendees[0]!.request = input.members.slice(1).map(m => m.name).join(' ');
    if (kind === 'chain') input.attendees.forEach((a, i) => { a.request = input.members[(i + 1) % 8]!.name; });
    if (kind === 'dense') input.attendees.forEach((a, i) => {
      a.request = input.members.filter((_, j) => i !== j && (i + j) % 3 === 0).map(m => m.name).join(' ');
    });
    if (kind === 'pinned-apart') input.attendees[0]!.request = input.members[1]!.name;
    const context = buildUtilityContext(input);
    const initialGroups = kind === 'pinned-apart' ? groups(['a0'], ['a1']) : groups();
    const pinned = new Set(initialGroups.flatMap(g => g.memberIds));
    const ids = [...context.people.keys()];
    const result = simulateAutoAssign({ initialGroups, context, availableIds: ids.filter(id => !pinned.has(id)) });
    let optimal;
    for (let a = 1; a < 6; a++) for (let b = a + 1; b < 7; b++) for (let c = b + 1; c < 8; c++) {
      const first = [ids[0]!, ids[a]!, ids[b]!, ids[c]!], second = ids.filter(id => !first.includes(id));
      if (kind === 'pinned-apart' && !second.includes('a1')) continue;
      const candidate = combineScores([evaluateUtilityGroup(first, context), evaluateUtilityGroup(second, context)]);
      if (!optimal || compareUtility(candidate, optimal) < 0) optimal = candidate;
    }
    expect(result.score.requestProduct).toBe(optimal!.requestProduct);
    expect(result.score.boardMissing).toBe(optimal!.boardMissing);
    expect(result.score.welfare).toBeCloseTo(optimal!.welfare, 10);
  });

  it('rejects impossible sizes, duplicate IDs and unknown fixed attendees without mutating the draft', () => {
    const context = buildUtilityContext(fixture());
    expect(() => simulateAutoAssign({ initialGroups: [], context, availableIds: [...context.people.keys()] })).toThrow('먼저');
    expect(() => simulateAutoAssign({ initialGroups: groups(['unknown']), context, availableIds: [...context.people.keys()] })).toThrow('미등록');
    expect(() => simulateAutoAssign({ initialGroups: groups(['a0']), context, availableIds: [...context.people.keys()] })).toThrow('중복');
    expect(solveGroupSizes({ total: 7, groups: [{ id: 'a' }, { id: 'b' }] }).status).toBe('infeasible');
  });

  it('honors manual lower bounds before target preferences and reports adjustments', () => {
    const result = solveGroupSizes({ total: 11, groups: [{ id: 'one', targetSize: 4, minimum: 7 }, { id: 'two', targetSize: 7 }] });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') throw new Error('expected a feasible result');
    expect(result.assignments.map(g => g.size)).toEqual([7, 4]);
    expect(result.adjustments).toHaveLength(2);
    expect(getSizingNotices(result, groups()).join()).toContain('4명에서 7명');
    expect(solveGroupSizes({ total: 8, groups: [{ id: 'one', minimum: 5 }, { id: 'two', minimum: 4 }] }).status).toBe('infeasible');
  });

  it('relaxes the anonymous extra-four rule only when higher constraints prevent it', () => {
    const result = solveGroupSizes({ total: 33, groups: [5, 5, 5, 6, 6, 0].map((targetSize, i) => ({ id: String(i), targetSize })) });
    if (result.status !== 'ok') throw new Error('expected feasible');
    expect(result.penalties.missingExtraFours).toBe(1);
    expect(getSizingNotices(result, []).join()).toContain('4명으로 구성할 수 없어');
  });
});
