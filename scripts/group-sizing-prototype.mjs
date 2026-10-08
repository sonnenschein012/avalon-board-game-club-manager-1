import { pathToFileURL } from 'node:url';
import { solveGroupSizes } from '../src/domain/matching/groupSizing.mjs';
export { solveGroupSizes, PREFERENCE } from '../src/domain/matching/groupSizing.mjs';

export function makeGroups(count, targets = []) {
  return Array.from({ length: count }, (_, i) => ({ id: `group-${String(i + 1).padStart(2, '0')}`, targetSize: targets[i] ?? null }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cases = [
    ...[25, 26, 28, 30, 31, 33, 34, 36].map(total => ({ label: `${total} people / 5 groups`, total, groups: makeGroups(5) })),
    { label: '18 / 3 (tie)', total: 18, groups: makeGroups(3) },
    { label: '30 / 5 (fixed 7)', total: 30, groups: makeGroups(5, [7]) },
    { label: '34 / 6 (extra four)', total: 34, groups: makeGroups(6) },
    { label: '33 / 6 (one free, no four possible)', total: 33, groups: makeGroups(6, [5, 5, 5, 6, 6]) },
    { label: '42 / 7 (one extra four possible)', total: 42, groups: makeGroups(7, [5, 5, 6, 7]) },
  ];
  console.table(cases.map(({ label, ...input }) => {
    const r = solveGroupSizes(input);
    return { case: label, sizes: r.sizes.join('/'), deviation: r.operatorDeviation, missingExtraFours: r.penalties.missingExtraFours, score: r.preferenceScore, ties: r.policyTieCount };
  }));
}
