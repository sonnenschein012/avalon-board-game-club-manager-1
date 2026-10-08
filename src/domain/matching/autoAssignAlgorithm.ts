import type { SessionGroup } from '../../types';
import { solveGroupSizes, type SizeSolution } from './groupSizing.mjs';
import { combineScores, compareUtility, evaluateUtilityGroup, type AssignmentScore, type UtilityContext } from './personalUtility';

export interface SimulationSample {
  requestProduct: string; requestScore: number; boardMissing: number; boardMissingNonFour: number; welfare: number;
}
export interface AutoAssignResult {
  updatedGroups: SessionGroup[];
  sizing: SizeSolution;
  score: AssignmentScore;
  samples: SimulationSample[];
  fixed: Record<string, string>;
}
export interface AutoAssignInput {
  availableIds: string[]; initialGroups: SessionGroup[]; context: UtilityContext; withHistory?: boolean;
}

export function simulateAutoAssign({ availableIds, initialGroups, context, withHistory = false }: AutoAssignInput): AutoAssignResult {
  if (!initialGroups.length) throw new Error('조를 먼저 생성해주세요.');
  const fixed: Record<string, string> = {};
  const allIds = [...initialGroups.flatMap(g => g.memberIds), ...availableIds];
  if (new Set(allIds).size !== allIds.length) throw new Error('중복 배치된 인원이 있습니다.');
  if (allIds.some(id => !context.people.has(id))) throw new Error('조에 미등록 또는 결석 인원이 있습니다. 명단을 확인해주세요.');
  if (allIds.length !== context.people.size) throw new Error('참석 명단과 편성 대상이 일치하지 않습니다.');
  initialGroups.forEach(g => g.memberIds.forEach(id => { fixed[id] = g.id; }));
  const sizing = solveGroupSizes({ total: allIds.length, groups: initialGroups.map(g => ({ id: g.id, targetSize: g.targetSize, minimum: g.memberIds.length })) });
  if (sizing.status !== 'ok') throw new Error(sizing.reason === 'manual-capacity'
    ? '수동 배치를 유지하면서 조별 4~10명을 채울 수 없습니다. 조 수나 수동 배치를 조정해주세요.'
    : `${allIds.length}명을 ${initialGroups.length}개 조에 4~10명씩 배치할 수 없습니다. 조 수를 조정해주세요.`);
  const capacities = new Map(sizing.assignments.map(g => [g.id, g.size]));
  const movable = new Set(availableIds);
  const cache = new Map<string, AssignmentScore>();
  const evaluate = (ids: string[]) => {
    const key = JSON.stringify([...ids].sort());
    let score = cache.get(key);
    if (!score) {
      score = evaluateUtilityGroup(ids, context);
      if (cache.size > 20000) cache.clear();
      cache.set(key, score);
    }
    return score;
  };
  // Seeded search makes identical inputs repeatable; no claim of global optimality.
  let state = 2166136261;
  for (const char of JSON.stringify([allIds.slice().sort(), sizing.assignments, fixed])) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  const random = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
  const shuffle = (ids: string[]) => {
    const result = [...ids].sort();
    for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j]!, result[i]!]; }
    return result;
  };
  const samples: SimulationSample[] = [];
  const sample = (score: AssignmentScore) => {
    if (withHistory) samples.push({ requestProduct: String(score.requestProduct), requestScore: score.requestScore,
      boardMissing: score.boardMissing, boardMissingNonFour: score.boardMissingNonFour, welfare: score.welfare });
  };
  let best: { groups: SessionGroup[]; score: AssignmentScore } | undefined;
  const starts = availableIds.length > 1 ? 8 : 1;
  for (let start = 0; start < starts; start++) {
    const groups = initialGroups.map(g => ({ ...g, memberIds: [...g.memberIds], targetSize: capacities.get(g.id)! }));
    const remaining = shuffle(availableIds);
    for (const group of groups) while (group.memberIds.length < group.targetSize) group.memberIds.push(remaining.pop()!);
    const scores = groups.map(g => evaluate(g.memberIds));
    let currentScore = combineScores(scores, context.parameters);
    const swap = (a: number, ai: number, b: number, bi: number) => {
      const ga = groups[a]!, gb = groups[b]!;
      const left = [...ga.memberIds], right = [...gb.memberIds];
      [left[ai], right[bi]] = [right[bi]!, left[ai]!];
      const sa = evaluate(left), sb = evaluate(right);
      const candidateScores = [...scores]; candidateScores[a] = sa; candidateScores[b] = sb;
      const candidateScore = combineScores(candidateScores, context.parameters);
      if (compareUtility(candidateScore, currentScore) >= 0) return false;
      ga.memberIds = left; gb.memberIds = right; scores[a] = sa; scores[b] = sb;
      currentScore = candidateScore;
      return true;
    };
    sample(currentScore);
    if (groups.length > 1 && availableIds.length > 1) {
      for (let step = 0; step < 2000; step++) {
        const a = Math.floor(random() * groups.length), b = Math.floor(random() * groups.length);
        if (a === b) continue;
        const ga = groups[a]!, gb = groups[b]!;
        const ai = Math.floor(random() * ga.memberIds.length), bi = Math.floor(random() * gb.memberIds.length);
        if (movable.has(ga.memberIds[ai]!) && movable.has(gb.memberIds[bi]!)) swap(a, ai, b, bi);
        if (step % 100 === 0) sample(currentScore);
      }
      // Bounded polishing; termination does not certify a global optimum.
      for (let pass = 0; pass < 3; pass++) {
        let improved = false;
        for (let a = 0; a < groups.length; a++) for (let b = a + 1; b < groups.length; b++) {
          for (let ai = 0; ai < groups[a]!.memberIds.length; ai++) for (let bi = 0; bi < groups[b]!.memberIds.length; bi++) {
            if (movable.has(groups[a]!.memberIds[ai]!) && movable.has(groups[b]!.memberIds[bi]!)) improved = swap(a, ai, b, bi) || improved;
          }
        }
        if (!improved) break;
      }
    }
    const score = currentScore;
    sample(score);
    if (!best || compareUtility(score, best.score) < 0) best = { groups, score };
  }
  return { updatedGroups: best!.groups, score: best!.score, sizing, samples, fixed };
}

export function getSizingNotices(sizing: SizeSolution, groups: SessionGroup[]): string[] {
  const name = (id: string) => groups.find(g => g.id === id)?.name || `조 ${groups.findIndex(g => g.id === id) + 1}`;
  const notices = sizing.adjustments.map(a => `${name(a.id)}의 설정 인원을 ${a.from}명에서 ${a.to}명으로 조정했습니다.`);
  const p = sizing.penalties;
  if (p.missingExtraFours) notices.push(`추가 조 중 ${p.missingExtraFours}개는 4명으로 구성할 수 없어 해당 규칙을 완화했습니다.`);
  if (p.excessEightPlus) notices.push('8명 이상 조를 1개 이하로 구성하는 규칙을 완화했습니다.');
  if (p.excessSevenPlus) notices.push('7명 이상 조를 2개 이하로 구성하는 규칙을 완화했습니다.');
  if (p.repeatedLargeSizes) notices.push('7명 이상 조의 인원 중복을 피하는 규칙을 완화했습니다.');
  if (p.nineOrTenGroups) notices.push('상위 조건을 충족하기 위해 9~10명 조를 구성했습니다.');
  return notices;
}
