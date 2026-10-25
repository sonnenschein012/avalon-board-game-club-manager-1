import type { SessionGroup } from '../../types';
import type { AutoAssignResult } from './autoAssignAlgorithm';
import { combineScores, compareUtility, evaluateUtilityGroup, type AssignmentScore, type UtilityContext } from './personalUtility';

export interface AssignmentDiagnosticRun {
  sessionDate: string;
  scope: string | null;
  completedAt: string;
  context: UtilityContext;
  result: AutoAssignResult;
}

const sortedEntries = <T>(map: Map<string, T>) => [...map].sort(([a], [b]) => a.localeCompare(b));
// Compare evaluation inputs, not object identity or display names. A subscription
// refresh with identical values must not invalidate a useful comparison.
function contextKey(context: UtilityContext) {
  return JSON.stringify({
    people: sortedEntries(context.people).map(([id, p]) => [id, p.memberId, p.gender, p.year, p.board]),
    requests: [...context.requests.values()].map(pair => [...pair].sort()).sort(),
    exposures: sortedEntries(context.exposures).map(([id, peers]) => [id, sortedEntries(peers)]),
    parameters: Object.entries(context.parameters).sort(([a], [b]) => a.localeCompare(b)),
  });
}

function distribution(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (fraction: number) => {
    if (!sorted.length) return null;
    const position = (sorted.length - 1) * fraction;
    const lower = Math.floor(position), upper = Math.ceil(position);
    return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
  };
  return { count: sorted.length, min: quantile(0), q1: quantile(.25), median: quantile(.5), q3: quantile(.75), max: quantile(1),
    mean: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : null,
    negativeCount: sorted.filter(value => value < 0).length };
}

const summary = (score: AssignmentScore) => ({
  requestProduct: String(score.requestProduct), requestScore: score.requestScore,
  boardMissing: score.boardMissing, boardMissingNonFour: score.boardMissingNonFour,
  welfare: score.welfare, totalUtility: score.totalUtility,
});

/** Pure export: never runs another search or changes the working assignment. */
export function createAssignmentDiagnosticReport(input: {
  groups: SessionGroup[]; context: UtilityContext; sessionDate: string; scope: string | null;
  lastRun: AssignmentDiagnosticRun | null; exportedAt: string;
}) {
  const { groups, context, sessionDate, scope, exportedAt } = input;
  const run = input.lastRun?.sessionDate === sessionDate && input.lastRun.scope === scope ? input.lastRun : null;
  // File-local aliases preserve before/after joins without names or database IDs.
  const personIds = [...new Set([...context.people.keys(), ...(run?.context.people.keys() ?? []),
    ...groups.flatMap(g => g.memberIds), ...(run?.result.updatedGroups.flatMap(g => g.memberIds) ?? [])])].sort();
  const groupIds = [...new Set([...groups.map(g => g.id), ...(run?.result.updatedGroups.map(g => g.id) ?? [])])].sort();
  const peopleAliases = new Map(personIds.map((id, i) => [id, `person-${i + 1}`]));
  const groupAliases = new Map(groupIds.map((id, i) => [id, `group-${i + 1}`]));
  const personAlias = (id: string) => peopleAliases.get(id)!;
  const groupAlias = (id: string) => groupAliases.get(id)!;

  const describe = (assignment: SessionGroup[], ctx: UtilityContext) => {
    const assigned = new Set<string>();
    const duplicateIds = new Set<string>();
    const excludedIds = new Set<string>();
    const evaluatedGroups = assignment.map(group => ({ ...group, memberIds: group.memberIds.filter(id => {
      if (!ctx.people.has(id)) { excludedIds.add(id); return false; }
      if (assigned.has(id)) { duplicateIds.add(id); return false; }
      assigned.add(id); return true;
    }) }));
    const score = combineScores(evaluatedGroups.map(g => evaluateUtilityGroup(g.memberIds, ctx)), ctx.parameters);
    const unassignedIds = [...ctx.people.keys()].filter(id => !assigned.has(id));
    const complete = !unassignedIds.length && !excludedIds.size && !duplicateIds.size && ctx.people.size > 0;
    const requests = [...ctx.requests.values()];
    return { score, report: {
      complete, expectedPeople: ctx.people.size, evaluatedPeople: score.people.length,
      unassigned: unassignedIds.map(personAlias), excluded: [...excludedIds].map(personAlias), duplicates: [...duplicateIds].map(personAlias),
      parameters: ctx.parameters, summary: summary(score),
      requests: { totalPairs: requests.length,
        fulfilledPairs: requests.filter(([a, b]) => evaluatedGroups.some(g => g.memberIds.includes(a) && g.memberIds.includes(b))).length },
      groups: evaluatedGroups.map(g => ({ group: groupAlias(g.id), targetSize: g.targetSize ?? null, size: g.memberIds.length, people: g.memberIds.map(personAlias) })),
      people: score.people.map(p => ({
        person: personAlias(p.id), group: groupAlias(evaluatedGroups.find(g => g.memberIds.includes(p.id))!.id),
        requestCount: p.requestCount, sameUtility: p.sameUtility, otherUtility: p.otherUtility,
        yearCost: p.yearCost, reunionCost: p.reunionCost, baseUtility: p.baseUtility,
        attenuation: p.attenuation, utility: p.utility, convertedUtility: p.convertedUtility,
        protectionWeight: p.protectionWeight, effectiveWeight: p.effectiveWeight, protectedUtility: p.protectedUtility,
      })),
      distributions: {
        baseUtility: distribution(score.people.map(p => p.baseUtility)),
        utility: distribution(score.people.map(p => p.utility)),
        protectedUtility: distribution(score.people.map(p => p.protectedUtility)),
        yearCost: distribution(score.people.map(p => p.yearCost)),
        reunionCost: distribution(score.people.map(p => p.reunionCost)),
      },
    } };
  };
  const current = describe(groups, context);
  const original = run ? describe(run.result.updatedGroups, run.context) : null;
  const sameContext = Boolean(run && contextKey(run.context) === contextKey(context));
  const sameConstraints = Boolean(run && groups.length === run.result.updatedGroups.length &&
    run.result.updatedGroups.every(before => groups.some(after => after.id === before.id &&
      after.targetSize === before.targetSize && after.memberIds.length === before.memberIds.length)) &&
    Object.entries(run.result.fixed).every(([id, group]) => groups.some(g => g.id === group && g.memberIds.includes(id))));
  const comparable = sameContext && sameConstraints && current.report.complete;
  const samePlacement = Boolean(run && groups.length === run.result.updatedGroups.length &&
    run.result.updatedGroups.every(before => groups.some(after => after.id === before.id &&
      JSON.stringify([...after.memberIds].sort()) === JSON.stringify([...before.memberIds].sort()))));
  const comparisonStatus = !run ? 'no_saved_run' : !sameContext ? 'inputs_changed' : !current.report.complete ? 'incomplete_assignment'
    : !sameConstraints ? 'constraints_changed' : samePlacement ? 'unchanged' : 'manually_adjusted';
  return {
    schemaVersion: 1, model: 'personal-utility-v3-protect-then-attenuate-provisional',
    sessionDate, exportedAt, current: current.report,
    automaticRun: run && original ? {
      completedAt: run.completedAt, result: original.report,
      fixed: Object.entries(run.result.fixed).map(([id, group]) => ({ person: personAlias(id), group: groupAlias(group) })),
      sizing: { sizes: run.result.sizing.sizes, penalties: run.result.sizing.penalties,
        adjustments: run.result.sizing.adjustments.map(a => ({ ...a, id: groupAlias(a.id) })) },
      // These are the actual starting scores from this search, not a new run
      // with the already-completed assignment treated as fixed.
      initialCandidates: run.result.samples.filter(sample => sample.phase === 'initial'),
      searchHistory: run.result.samples,
    } : null,
    comparison: { status: comparisonStatus, comparable,
      preference: comparable && run ? Math.sign(compareUtility(current.score, run.result.score)) : null,
      welfareDelta: comparable && run ? current.score.welfare - run.result.score.welfare : null,
    },
    notes: [
      'current는 추출 시점의 배치, automaticRun은 이 화면에서 마지막으로 완료한 자동 편성 실행입니다. 추출은 편성을 다시 실행하지 않습니다.',
      '이름·회원/출석 문서 ID·조 이름·메모·요청 원문을 제외합니다. person/group 번호는 이 파일 안에서만 연결하는 임시 번호입니다.',
      '개인 분포는 평가된 사람들의 점수 분포입니다. 부분 편성은 전체 참석자와 직접 비교하지 않습니다. 분위수는 정렬 후 선형 보간합니다.',
      'initialCandidates는 같은 정원·수동 고정 조건에서 시작한 최대 8개 초기 배치입니다. 표본이 작고 반복 실행은 결정적이므로 전체 가능한 편성의 분포나 백분위로 해석하지 않습니다.',
      'searchHistory는 시작 배치·탐색 중간 점수·개인 교환 후·최종 점수입니다. 모든 후보나 모든 개선을 기록하지 않으며 동일 점수가 반복될 수 있습니다.',
      'comparison.preference는 현재 배치 기준으로 -1이면 개선, 0이면 동점, 1이면 악화입니다. 동반 요청 → 운영진 배치 → 전체 효용 순으로 비교하며 welfareDelta만으로 우열을 판단하지 않습니다.',
      'automaticRun이 null이면 보관된 실행이 없습니다. 새로고침·화면 이동 후에는 현재 배치 평가만 추출하며 과거 탐색 이력을 만들어내지 않습니다.',
      '점수는 현재 평가 모델의 계산값이며 실제 만족도나 전역 최적성을 나타내지 않습니다.',
    ],
  };
}
