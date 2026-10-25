import React, { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from 'vitest';
import { useAttendanceLogic } from './useAttendanceLogic';
import { runAutoAssignment } from '../lib/runAutoAssignment';
import { simulateAutoAssign } from '../domain/matching/autoAssignAlgorithm';
import * as diagnostics from '../domain/matching/assignmentDiagnostics';

vi.mock('../lib/firebase', () => ({ db: {}, handleFirestoreError: vi.fn(), OperationType: { WRITE: 'write' } }));
vi.mock('../lib/runAutoAssignment', () => ({ runAutoAssignment: vi.fn() }));
vi.mock('../services/auditService', () => ({ addAuditEventToTransaction: vi.fn() }));
vi.mock('../services/dailyPlanningService', () => ({ archiveDailyPlanning: vi.fn() }));
vi.mock('../services/attendeesService', () => ({
  deleteAttendeeRecord: vi.fn(), clearAllAttendees: vi.fn(), quickAddMemberRecord: vi.fn(),
  manualAddAttendeeRecord: vi.fn(), importAttendanceRows: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./useFirestore', () => {
  const data: Record<string, unknown[]> = {
    attendees: Array.from({ length: 8 }, (_, i) => ({ id: `a${i}`, memberId: `m${i}`, name: `합성회원${i}`, request: '', status: '대기' })),
    members: Array.from({ length: 8 }, (_, i) => ({ id: `m${i}`, name: `합성회원${i}`, studentId: '260001', gender: i % 2 ? '남' : '여', isBoardMember: i < 2 })),
    sessions: [],
  };
  return { useFirestore: (collection: string) => ({ data: data[collection], loading: false }) };
});

let root: Root;
let latest: ReturnType<typeof useAttendanceLogic>;
let reportSpy: MockInstance<typeof diagnostics.createAssignmentDiagnosticReport>;
let sequence = 0;
function Harness({ scope }: { scope: string }) {
  const logic = useAttendanceLogic({ draftScope: scope });
  useEffect(() => { latest = logic; });
  return null;
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  vi.mocked(runAutoAssignment).mockImplementation(async input => simulateAutoAssign(input));
  reportSpy = vi.spyOn(diagnostics, 'createAssignmentDiagnosticReport');
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:diagnostics');
    static revokeObjectURL = vi.fn();
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  root = createRoot(document.createElement('div'));
  act(() => root.render(<Harness scope={`diagnostics-${++sequence}`} />));
  act(() => {
    latest.setSessionDate('2026-10-26');
    latest.setGroups([0, 1].map(i => ({ id: `g${i}`, memberIds: [], targetSize: 4, gameIds: [] })));
  });
});
afterEach(() => {
  act(() => root.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const exportReport = () => {
  act(() => latest.exportSimulationData());
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  return reportSpy.mock.results.at(-1)!.value as ReturnType<typeof diagnostics.createAssignmentDiagnosticReport>;
};

it('keeps the completed search when exporting repeatedly and after a manual adjustment', async () => {
  await act(async () => { latest.handleAutoAssign(); });
  expect(runAutoAssignment).toHaveBeenCalledTimes(1);
  expect(vi.mocked(runAutoAssignment).mock.calls[0]![0].withHistory).toBe(true);
  const assignment = latest.groups;
  const first = exportReport();
  expect(first.automaticRun!.initialCandidates).toHaveLength(8);
  expect(first.comparison.status).toBe('unchanged');
  expect(first.current.people).toHaveLength(8);
  expect(exportReport().automaticRun).toEqual(first.automaticRun);
  expect(latest.groups).toBe(assignment);
  act(() => latest.setGroups(current => {
    const changed = structuredClone(current);
    [changed[0]!.memberIds[0], changed[1]!.memberIds[0]] = [changed[1]!.memberIds[0]!, changed[0]!.memberIds[0]!];
    return changed;
  }));
  const adjusted = exportReport();
  expect(adjusted.comparison.status).toBe('manually_adjusted');
  expect(adjusted.automaticRun).toEqual(first.automaticRun);
  expect(runAutoAssignment).toHaveBeenCalledTimes(1);
});

it('exports an honest partial snapshot with no saved run instead of starting the worker', () => {
  const report = exportReport();
  expect(report.automaticRun).toBeNull();
  expect(report.current.complete).toBe(false);
  expect(report.current.unassigned).toHaveLength(8);
  expect(runAutoAssignment).not.toHaveBeenCalled();
  expect(latest.groups.every(g => g.memberIds.length === 0)).toBe(true);
});

it('does not attach a previous date run to a different date', async () => {
  await act(async () => { latest.handleAutoAssign(); });
  act(() => latest.setSessionDate('2026-10-27'));
  expect(exportReport().automaticRun).toBeNull();
  expect(runAutoAssignment).toHaveBeenCalledTimes(1);
});
