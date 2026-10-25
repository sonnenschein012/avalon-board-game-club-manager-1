import { describe, expect, it } from 'vitest';
import { createAssignmentDiagnosticReport, type AssignmentDiagnosticRun } from './assignmentDiagnostics';
import { simulateAutoAssign } from './autoAssignAlgorithm';
import { REVIEW_PARAMETERS, type UtilityContext } from './personalUtility';

function fixture() {
  const context: UtilityContext = {
    people: new Map(Array.from({ length: 8 }, (_, i) => [`private-attendee-${i}`, {
      id: `private-attendee-${i}`, memberId: `private-member-${i}`, name: `비공개이름${i}`,
      gender: i % 2 ? '남' : '여', year: 22 + i % 4, board: i < 2,
    }])),
    requests: new Map([['pair', ['private-attendee-0', 'private-attendee-1']]]),
    absentRequests: [], requestChoices: [], exposures: new Map(), parameters: REVIEW_PARAMETERS,
  };
  const initialGroups = [0, 1].map(i => ({ id: `private-group-${i}`, name: '비공개 조 이름',
    memberIds: i ? [] : ['private-attendee-0'], targetSize: 4, gameIds: ['비공개게임'], notes: '비공개메모' }));
  const availableIds = [...context.people.keys()].slice(1);
  const result = simulateAutoAssign({ context, initialGroups, availableIds, withHistory: true });
  const run: AssignmentDiagnosticRun = { context, result, sessionDate: '2026-10-26', scope: 'private-owner', completedAt: '2026-10-26T01:00:00Z' };
  const input = { groups: result.updatedGroups, context, sessionDate: run.sessionDate, scope: run.scope,
    lastRun: run, exportedAt: '2026-10-26T02:00:00Z' };
  return { context, initialGroups, availableIds, result, run, input };
}

describe('assignment diagnostic report', () => {
  it('preserves the actual run and global personal contributions without changing the selected assignment', () => {
    const { input, result, context, initialGroups, availableIds } = fixture();
    const report = createAssignmentDiagnosticReport(input);
    expect(report.automaticRun!.searchHistory).toEqual(result.samples);
    expect(report.automaticRun!.initialCandidates).toHaveLength(8);
    expect(new Set(report.automaticRun!.initialCandidates.map(s => s.start)).size).toBe(8);
    expect(result.samples.filter(s => s.phase === 'final')).toHaveLength(8);
    expect(report.current.people.reduce((sum, p) => sum + p.protectedUtility, 0)).toBeCloseTo(result.score.welfare, 12);
    expect(report.current.distributions.baseUtility.count).toBe(8);
    const base = report.current.people.map(p => p.baseUtility).sort((a, b) => a - b);
    expect(report.current.distributions.baseUtility.median).toBeCloseTo((base[3]! + base[4]!) / 2, 12);
    expect(report.current.distributions.baseUtility.q1).toBeCloseTo(base[1]! * .25 + base[2]! * .75, 12);
    expect(report.comparison).toEqual({ status: 'unchanged', comparable: true, preference: 0, welfareDelta: 0 });
    const withoutHistory = simulateAutoAssign({ context, initialGroups, availableIds });
    expect(withoutHistory.updatedGroups).toEqual(result.updatedGroups);
    expect(withoutHistory.score).toEqual(result.score);
    const json = JSON.stringify(report);
    for (const secret of ['private-attendee', 'private-member', 'private-group', 'private-owner', '비공개']) expect(json).not.toContain(secret);
  });

  it('compares manual changes using the same aliases and rejects altered fixed placements', () => {
    const { input, result } = fixture();
    const changed = structuredClone(result.updatedGroups);
    const left = changed[0]!, right = changed[1]!;
    const index = left.memberIds.findIndex(id => id !== 'private-attendee-0');
    [left.memberIds[index], right.memberIds[0]] = [right.memberIds[0]!, left.memberIds[index]!];
    const report = createAssignmentDiagnosticReport({ ...input, groups: changed });
    expect(report.comparison.status).toBe('manually_adjusted');
    expect(report.comparison.comparable).toBe(true);
    expect(report.automaticRun!.result.summary.welfare).toBe(result.score.welfare);
    expect(report.current.people.map(p => p.person)).toEqual(report.automaticRun!.result.people.map(p => p.person));
    const fixedIndex = left.memberIds.indexOf('private-attendee-0');
    [left.memberIds[fixedIndex], right.memberIds[0]] = [right.memberIds[0]!, left.memberIds[fixedIndex]!];
    expect(createAssignmentDiagnosticReport({ ...input, groups: changed }).comparison)
      .toMatchObject({ status: 'constraints_changed', comparable: false, welfareDelta: null });
  });

  it('accepts identical refreshed context values but not changed evaluation inputs or capacity', () => {
    const { input } = fixture();
    const context = structuredClone(input.context);
    expect(createAssignmentDiagnosticReport({ ...input, context }).comparison.status).toBe('unchanged');
    context.parameters = { ...context.parameters, protectionS: context.parameters.protectionS + 1 };
    expect(createAssignmentDiagnosticReport({ ...input, context }).comparison)
      .toMatchObject({ status: 'inputs_changed', comparable: false, preference: null });
    const groups = input.groups.map(g => ({ ...g, targetSize: 5 }));
    expect(createAssignmentDiagnosticReport({ ...input, groups }).comparison.status).toBe('constraints_changed');
  });

  it('reports partial, duplicate and excluded people explicitly without counting anybody twice', () => {
    const { input } = fixture();
    const groups = structuredClone(input.groups);
    const removed = groups[0]!.memberIds.pop()!;
    groups[1]!.memberIds.push(groups[0]!.memberIds[0]!, 'unknown-private-attendee');
    const report = createAssignmentDiagnosticReport({ ...input, groups });
    expect(report.current.complete).toBe(false);
    expect(report.current.unassigned).toHaveLength(1);
    expect(report.current.duplicates).toHaveLength(1);
    expect(report.current.excluded).toHaveLength(1);
    expect(report.current.people).toHaveLength(7);
    expect(report.comparison.status).toBe('incomplete_assignment');
    expect(report.comparison.welfareDelta).toBeNull();
    expect(JSON.stringify(report)).not.toContain(removed);
  });

  it('exports current data without fabricating history after a reload or across dates/accounts', () => {
    const { input } = fixture();
    for (const overrides of [{ lastRun: null }, { sessionDate: '2026-10-27' }, { scope: 'another-account' }]) {
      const report = createAssignmentDiagnosticReport({ ...input, ...overrides });
      expect(report.automaticRun).toBeNull();
      expect(report.comparison.status).toBe('no_saved_run');
      expect(report.current.people).toHaveLength(8);
    }
    const empty = createAssignmentDiagnosticReport({ ...input, groups: [], lastRun: null });
    expect(empty.current.distributions.baseUtility).toMatchObject({ count: 0, mean: null, min: null, max: null });
  });
});
