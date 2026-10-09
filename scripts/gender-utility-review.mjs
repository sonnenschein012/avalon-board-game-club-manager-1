import { pathToFileURL } from 'node:url';
import { EXAMPLE_PARAMETERS, protectUtilities, saturation } from './group-utility-prototype.mjs';

// All peers have the same year, no requests/history, and equal board coverage.
// Under these assumptions a gender-count layout represents every equivalent ID assignment.
export const GENDER_REVIEW_SIZES = [
  [4, 4], [5, 4], [5, 5], [6, 5], [6, 6], [7, 6], [8, 6], [8, 7],
  [7, 6, 5], [8, 6, 5], [8, 7, 6], [6, 5, 5, 4], [8, 6, 6, 5, 5],
];
export const PREVIOUS_GENDER_PARAMETERS = Object.freeze({
  ...EXAMPLE_PARAMETERS, sameA: 3, sameK: 1.2, otherA: 4, otherK: 0.35,
});

// First increment and diminishing increments are independent controls.
// Review-only curves; app defaults are deliberately unchanged.
export function reviewCurve(n, first, tail, family = 'geometric') {
  if (!Number.isInteger(n) || n < 0 || !Number.isFinite(first) || first <= 0 ||
    !Number.isFinite(tail) || tail <= 0 || tail >= 1) throw new TypeError('invalid curve input');
  if (!['geometric', 'hyperbolic', 'piecewise'].includes(family)) throw new TypeError('unknown curve family');
  if (!n) return 0;
  if (family === 'geometric') return first * (1 - tail ** n) / (1 - tail);
  if (family === 'hyperbolic') {
    const h = (1 / tail - 1) / 2;
    return first * n * (1 + h) / (1 + h * n);
  }
  return first * (1 + tail * (1 - (tail / 2) ** (n - 1)) / (1 - tail / 2));
}

export const REVIEW_CURVES = ['geometric', 'hyperbolic', 'piecewise'].map(family => ({
  ...EXAMPLE_PARAMETERS, family, sameFirst: 1.2, otherFirst: 1, sameTail: 0.2, otherTail: 0.45,
}));

export function genderUtility(n, same, parameters) {
  return parameters.family
    ? reviewCurve(n, same ? parameters.sameFirst : parameters.otherFirst,
      same ? parameters.sameTail : parameters.otherTail, parameters.family)
    : saturation(n, same ? parameters.sameA : parameters.otherA, same ? parameters.sameK : parameters.otherK);
}

export function evaluateGenderLayout(sizes, minority, parameters = EXAMPLE_PARAMETERS) {
  if (!sizes.length || sizes.length !== minority.length || sizes.some((size, i) =>
    !Number.isInteger(size) || size < 4 || size > 10 || !Number.isInteger(minority[i]) || minority[i] < 0 || minority[i] > size)) {
    throw new TypeError('gender review needs fixed capacities and valid counts');
  }
  const utilities = [];
  let minorityIsolated = 0, majorityIsolated = 0, mixedGroups = 0;
  sizes.forEach((size, i) => {
    const few = minority[i], many = size - few;
    if (few === 1) minorityIsolated++;
    if (many === 1) majorityIsolated++;
    if (few && many) mixedGroups++;
    for (const [count, others] of [[few, many], [many, few]]) {
      if (!count) continue;
      const utility = genderUtility(count - 1, true, parameters) + genderUtility(others, false, parameters);
      utilities.push(...Array(count).fill(utility));
    }
  });
  return { minority: [...minority], minorityIsolated, majorityIsolated, mixedGroups, totalUtility: utilities.reduce((a, b) => a + b, 0),
    welfare: protectUtilities(utilities, parameters).welfare };
}

export function reviewGenderComposition(sizes, count, parameters = EXAMPLE_PARAMETERS) {
  if (!Array.isArray(sizes) || !sizes.length || sizes.some(s => !Number.isInteger(s) || s < 4 || s > 10) ||
    !Number.isInteger(count) || count < 0 || count > sizes.reduce((sum, s) => sum + s, 0)) throw new TypeError('invalid gender review input');
  let best = null, withoutIsolation = null, layouts = 0, optimalMinIsolated = Infinity, optimalMaxIsolated = -Infinity;
  const visit = (counts, left) => {
    if (counts.length === sizes.length) {
      if (left) return;
      const result = evaluateGenderLayout(sizes, counts, parameters);
      layouts++;
      if (!best || result.welfare > best.welfare + 1e-9) {
        best = result;
        optimalMinIsolated = result.minorityIsolated;
        optimalMaxIsolated = result.minorityIsolated;
      } else if (Math.abs(result.welfare - best.welfare) <= 1e-9) {
        optimalMinIsolated = Math.min(optimalMinIsolated, result.minorityIsolated);
        optimalMaxIsolated = Math.max(optimalMaxIsolated, result.minorityIsolated);
      }
      if (!result.minorityIsolated && (!withoutIsolation || result.welfare > withoutIsolation.welfare + 1e-9)) withoutIsolation = result;
      return;
    }
    for (let n = 0; n <= Math.min(sizes[counts.length], left); n++) visit([...counts, n], left - n);
  };
  visit([], count);
  return { sizes: [...sizes], count, layouts, best, withoutIsolation, optimalMinIsolated, optimalMaxIsolated };
}

export function reviewGenderSuite(parameters = EXAMPLE_PARAMETERS) {
  return GENDER_REVIEW_SIZES.flatMap(sizes => Array.from({
    length: Math.floor(sizes.reduce((sum, s) => sum + s, 0) / 2) - 1,
  }, (_, i) => reviewGenderComposition(sizes, i + 2, parameters)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.table([['previous', PREVIOUS_GENDER_PARAMETERS], ...REVIEW_CURVES.map(p => [p.family, p])].map(([model, p]) => {
    const cases = reviewGenderSuite(p);
    return { model, cases: cases.length, necessarilyIsolatedMinorityCases: cases.filter(c => c.optimalMinIsolated > 0).length,
      exclusivelySingleGenderCases: cases.filter(c => !c.best.mixedGroups).length };
  }));
  const grid = [];
  for (const ratio of [1.05, 1.1, 1.2, 1.3]) for (const first of [0.5, 1, 2])
    for (const sameTail of [0.1, 0.2, 0.3]) for (const otherTail of [0.2, 0.4, 0.6])
      for (const protectionS of [0.5, 2, 5]) {
        const p = { ...EXAMPLE_PARAMETERS, family: 'geometric', sameFirst: ratio * first,
          otherFirst: first, sameTail, otherTail, protectionS };
        grid.push(reviewGenderComposition([8, 6, 6, 5, 5], 3, p));
      }
  console.log(JSON.stringify({ gridModels: grid.length, unavoidableIsolation: grid.filter(c => c.optimalMinIsolated > 0).length }));
  console.table(REVIEW_CURVES.map(p => {
    const c = reviewGenderComposition([8, 6, 6, 5, 5], 3, p);
    return { family: p.family, best: c.best.minority.join('/'),
      bestNoIsolation: c.withoutIsolation.minority.join('/'), welfareGap: c.best.welfare - c.withoutIsolation.welfare };
  }));
}
