// Browser-safe capacity model. Personal utilities never affect capacities.
// Quarter-point units keep the provisional preference comparisons exact.
export const PREFERENCE = Object.freeze({ duplicate: 4, four: 6, noLarge: 3, extraLarge: 1 });

function compare(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function compareIds(a, b) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function* compositions(total, count, minimum = 4, prefix = []) {
  if (count === 0) {
    if (total === 0) yield prefix;
    return;
  }
  for (let size = minimum; size <= 10 && size * count <= total; size++) {
    if (total - size > 10 * (count - 1)) continue;
    yield* compositions(total - size, count - 1, size, [...prefix, size]);
  }
}

// For absolute-distance cost, sorted fixed targets can be matched to a sorted
// subsequence of capacities without crossings. Unspecified groups use the rest.
// Dynamic programming chooses that subsequence, avoiding labeled permutations.
function matchTargets(sizes, groups) {
  if (groups.some(g => g.minimum > 4)) return matchMinimums(sizes, groups);
  const fixed = groups.filter(g => g.targetSize !== null)
    .sort((a, b) => a.targetSize - b.targetSize || compareIds(a, b));
  const free = groups.filter(g => g.targetSize === null).sort(compareIds);
  const memo = new Map();
  function visit(i, j) {
    if (j === fixed.length) return { cost: 0, indices: [] };
    if (sizes.length - i < fixed.length - j) return { cost: Infinity, indices: [] };
    const key = `${i}:${j}`;
    if (memo.has(key)) return memo.get(key);
    const tail = visit(i + 1, j + 1);
    const take = { cost: Math.abs(sizes[i] - fixed[j].targetSize) + tail.cost, indices: [i, ...tail.indices] };
    const skip = visit(i + 1, j);
    const best = take.cost <= skip.cost ? take : skip;
    memo.set(key, best);
    return best;
  }
  const best = visit(0, 0);
  const used = new Set(best.indices);
  const allocation = new Map(fixed.map((g, j) => [g.id, sizes[best.indices[j]]]));
  const remaining = sizes.filter((_, i) => !used.has(i)).reverse();
  free.forEach((g, i) => allocation.set(g.id, remaining[i]));
  return { deviation: best.cost, allocation };
}

// Labeled minimums from manual placements can break sorted target matching.
// Memoize remaining capacity counts rather than enumerating permutations.
function matchMinimums(sizes, groups) {
  const counts = Array.from({ length: 7 }, (_, i) => sizes.filter(n => n === i + 4).length);
  const memo = new Map();
  function visit(index) {
    if (index === groups.length) return { cost: 0, choices: [] };
    const key = counts.join(',');
    if (memo.has(key)) return memo.get(key);
    let best = { cost: Infinity, choices: [] };
    const group = groups[index];
    for (let i = 6; i >= 0; i--) {
      const size = i + 4;
      if (!counts[i] || size < group.minimum) continue;
      counts[i]--;
      const tail = visit(index + 1);
      counts[i]++;
      const cost = tail.cost + (group.targetSize === null ? 0 : Math.abs(size - group.targetSize));
      if (cost < best.cost) best = { cost, choices: [size, ...tail.choices] };
    }
    memo.set(key, best);
    return best;
  }
  const best = visit(0);
  return { deviation: best.cost, allocation: new Map(groups.map((g, i) => [g.id, best.choices[i]])) };
}

function evaluate(sizes, deviation) {
  const requestedExtras = Math.max(0, sizes.length - 5);
  const extraCount = Math.min(requestedExtras, sizes.filter(n => n === 4).length);
  // Ascending order puts the anonymous extra fours first. No group number owns
  // the extra role; only the capacity multiset matters at this stage.
  const core = sizes.slice(extraCount);
  const frequencies = new Map();
  for (const size of core) frequencies.set(size, (frequencies.get(size) ?? 0) + 1);
  const largeCount = core.filter(n => n >= 7).length;
  const penalties = {
    missingExtraFours: requestedExtras - extraCount,
    excessEightPlus: Math.max(0, core.filter(n => n >= 8).length - 1),
    excessSevenPlus: Math.max(0, largeCount - 2),
    repeatedLargeSizes: [...frequencies].reduce((sum, [n, count]) => sum + (n >= 7 ? Math.max(0, count - 1) : 0), 0),
    nineOrTenGroups: core.filter(n => n >= 9).length,
  };
  const preferenceParts = {
    repetition: [...frequencies.values()].reduce((sum, count) => sum + Math.max(0, count - 2) ** 2 * PREFERENCE.duplicate, 0),
    fours: (frequencies.get(4) ?? 0) * PREFERENCE.four,
    noLarge: sizes.length >= 5 && largeCount === 0 ? PREFERENCE.noLarge : 0,
    extraLarge: Math.max(0, largeCount - 1) * PREFERENCE.extraLarge,
  };
  const preferenceQuarterPoints = Object.values(preferenceParts).reduce((sum, value) => sum + value, 0);
  return {
    rank: [deviation, ...Object.values(penalties), preferenceQuarterPoints],
    penalties,
    preferenceParts,
    preferenceScore: preferenceQuarterPoints / 4,
    extraCount,
  };
}

/**
 * Groups: { id: string, targetSize?: positive integer | null }[].
 * 0/undefined/null mean unspecified, matching the existing UI's empty value.
 * Targets outside 4..10 remain preferences, adjusted into the feasible range.
 * Manual counts are minimum capacities; identities, requests and board roles are not inputs.
 */
export function solveGroupSizes({ total, groups }) {
  if (!Number.isSafeInteger(total) || total < 0) throw new TypeError('total must be a nonnegative safe integer');
  if (!Array.isArray(groups) || groups.length === 0) throw new TypeError('at least one group is required');
  const ids = new Set();
  const normalized = groups.map(group => {
    if (!group || typeof group.id !== 'string' || !group.id || ids.has(group.id)) throw new TypeError('group IDs must be nonempty and unique');
    ids.add(group.id);
    const targetSize = group.targetSize == null || group.targetSize === 0 ? null : group.targetSize;
    if (targetSize !== null && (!Number.isSafeInteger(targetSize) || targetSize < 1 || targetSize > Math.floor(Number.MAX_SAFE_INTEGER / groups.length) - 10)) {
      throw new TypeError('targetSize must be a positive safely summable integer or unspecified');
    }
    const minimum = group.minimum ?? 4;
    if (!Number.isInteger(minimum) || minimum < 0) throw new TypeError('invalid manual minimum');
    return { id: group.id, targetSize, minimum: Math.max(4, minimum) };
  }).sort(compareIds);
  if (total < 4 * groups.length || total > 10 * groups.length) {
    return { status: 'infeasible', reason: 'change-group-count', minTotal: 4 * groups.length, maxTotal: 10 * groups.length };
  }
  let selected;
  let candidateCount = 0;
  let policyTieCount = 0;
  for (const sizes of compositions(total, groups.length)) {
    candidateCount++;
    const matching = matchTargets(sizes, normalized);
    if (!Number.isFinite(matching.deviation)) continue;
    const score = evaluate(sizes, matching.deviation);
    const descending = [...sizes].reverse();
    const order = selected ? compare(score.rank, selected.rank) : -1;
    if (order < 0) policyTieCount = 1;
    else if (order === 0) policyTieCount++;
    if (order < 0 || (order === 0 && compare(descending, selected.sizes) < 0)) {
      selected = { ...score, sizes: descending, matching };
    }
  }
  if (!selected) return { status: 'infeasible', reason: 'manual-capacity', minTotal: 4 * groups.length, maxTotal: 10 * groups.length };
  const assignments = normalized.map(g => ({
    id: g.id,
    targetSize: g.targetSize,
    size: selected.matching.allocation.get(g.id),
  }));
  const adjustments = assignments.filter(g => g.targetSize !== null && g.targetSize !== g.size)
    .map(g => ({ id: g.id, from: g.targetSize, to: g.size }));
  return {
    status: 'ok',
    sizes: selected.sizes,
    assignments,
    adjustments,
    operatorDeviation: selected.rank[0],
    penalties: selected.penalties,
    preferenceScore: selected.preferenceScore,
    preferenceParts: Object.fromEntries(Object.entries(selected.preferenceParts).map(([key, value]) => [key, value / 4])),
    extraFourCount: selected.extraCount,
    rank: selected.rank,
    candidateCount,
    policyTieCount,
  };
}
