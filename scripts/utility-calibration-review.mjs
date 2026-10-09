import { EXAMPLE_PARAMETERS } from './group-utility-prototype.mjs';

/** Reparameterize the existing exponential, without changing the utility family. */
export function parametersFromIncrements({ sameFirst, otherFirst, sameTail, otherTail }, base = EXAMPLE_PARAMETERS) {
  if (![sameFirst, otherFirst, sameTail, otherTail].every(Number.isFinite) ||
    otherFirst <= 0 || sameFirst <= otherFirst || sameTail <= 0 || sameTail >= otherTail || otherTail >= 1) {
    throw new TypeError('require positive first gains, same first > other first, and 0 < same tail < other tail < 1');
  }
  return { ...base, sameA: sameFirst / (1 - sameTail), sameK: -Math.log(sameTail),
    otherA: otherFirst / (1 - otherTail), otherK: -Math.log(otherTail) };
}

/** Exploratory grid, not a satisfaction fit or a new operational constraint. */
export function calibrationCandidates(base = EXAMPLE_PARAMETERS) {
  const candidates = [{ label: 'current', parameters: { ...base } }];
  for (const otherFirst of [0.4, 0.75, 1.1]) for (const ratio of [1.1, 1.2, 1.3])
    for (const sameTail of [0.15, 0.25]) for (const otherTail of [0.35, 0.5, 0.65]) {
      const inputs = { sameFirst: ratio * otherFirst, otherFirst, sameTail, otherTail };
      candidates.push({ label: `first-${otherFirst}-ratio-${ratio}-tails-${sameTail}-${otherTail}`,
        inputs, parameters: parametersFromIncrements(inputs, base) });
    }
  return candidates;
}

export function summarizeCalibration(result, context) {
  const { updatedGroups: groups, score } = result;
  const ids = groups.flatMap(group => group.memberIds);
  if (new Set(ids).size !== context.people.size || ids.length !== context.people.size ||
    ids.some(id => !context.people.has(id)) || groups.some(group => group.memberIds.length !== group.targetSize)) {
    throw new Error('calibration must assign every attendee once at fixed capacities');
  }
  const assigned = new Map(groups.flatMap(group => group.memberIds.map(id => [id, group.id])));
  const femaleCounts = groups.map(group => group.memberIds.filter(id => context.people.get(id).gender === '여').length);
  const sexSizes = gender => {
    const sizes = groups.flatMap(group => group.memberIds.filter(id => context.people.get(id).gender === gender).map(() => group.memberIds.length));
    return sizes.length ? sizes.reduce((a, b) => a + b, 0) / sizes.length : null;
  };
  const mean = field => score.people.length ? score.people.reduce((sum, person) => sum + person[field], 0) / score.people.length : 0;
  return { requestProduct: String(score.requestProduct), requestPairs: context.requests.size,
    satisfiedPairs: [...context.requests.values()].filter(([a, b]) => assigned.get(a) === assigned.get(b)).length,
    boardMissing: score.boardMissing, boardMissingNonFour: score.boardMissingNonFour,
    femaleCounts, femaleIsolated: femaleCounts.filter(n => n === 1).length,
    femaleMeanGroupSize: sexSizes('여'), maleMeanGroupSize: sexSizes('남'),
    meanSame: mean('sameUtility'), meanOther: mean('otherUtility'), meanYear: mean('yearCost'), meanReunion: mean('reunionCost'),
    minimumBaseUtility: score.people.length ? Math.min(...score.people.map(person => person.baseUtility)) : null,
    welfare: score.welfare };
}

/** Offline diagnostic only: retain the comparator's priorities and fixed sizes.
 * This does not add a gender quota or change the production search. */
export function refineCalibrationPairs(initialGroups, requests, evaluate, compare, passes = 3) {
  const groups = initialGroups.map(group => ({ ...group, memberIds: [...group.memberIds] }));
  let score = evaluate(groups), accepted = 0;
  const swap = (a, leftIndices, b, rightIndices) => {
    const candidate = groups.map(group => ({ ...group, memberIds: [...group.memberIds] }));
    leftIndices.forEach((index, i) => {
      [candidate[a].memberIds[index], candidate[b].memberIds[rightIndices[i]]] =
        [candidate[b].memberIds[rightIndices[i]], candidate[a].memberIds[index]];
    });
    const next = evaluate(candidate);
    if (compare(next, score) >= 0) return false;
    groups[a] = candidate[a]; groups[b] = candidate[b]; score = next; accepted++;
    return true;
  };
  for (let pass = 0; pass < passes; pass++) {
    const before = accepted;
    for (const pair of requests) {
      const a = groups.findIndex(group => pair.every(id => group.memberIds.includes(id)));
      if (a < 0) continue;
      for (let b = 0; b < groups.length; b++) {
        if (a === b) continue;
        // Recompute location after each accepted move; don't move unrelated IDs.
        for (let i = 0; i < groups[b].memberIds.length; i++) for (let j = i + 1; j < groups[b].memberIds.length; j++) {
          const current = groups.findIndex(group => pair.every(id => group.memberIds.includes(id)));
          if (current < 0 || current === b) continue;
          swap(current, pair.map(id => groups[current].memberIds.indexOf(id)), b, [i, j]);
        }
      }
    }
    for (let a = 0; a < groups.length; a++) for (let b = a + 1; b < groups.length; b++)
      for (let i = 0; i < groups[a].memberIds.length; i++) for (let j = 0; j < groups[b].memberIds.length; j++) swap(a, [i], b, [j]);
    if (accepted === before) break;
  }
  return { updatedGroups: groups, score, accepted };
}
