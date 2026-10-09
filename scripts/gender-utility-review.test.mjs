import test from 'node:test';
import assert from 'node:assert/strict';
import { REVIEW_CURVES, reviewCurve, evaluateGenderLayout, reviewGenderComposition, genderUtility } from './gender-utility-review.mjs';
import { parametersFromIncrements } from './utility-calibration-review.mjs';

test('review curves separate first increment from positive diminishing increments', () => {
  for (const family of ['geometric', 'hyperbolic', 'piecewise']) {
    assert.equal(reviewCurve(0, 1.2, 0.2, family), 0);
    assert.ok(Math.abs(reviewCurve(1, 1.2, 0.2, family) - 1.2) < 1e-12);
    let previous = Infinity;
    for (let n = 1; n <= 10; n++) {
      const increment = reviewCurve(n, 1.2, 0.2, family) - reviewCurve(n - 1, 1.2, 0.2, family);
      assert.ok(increment > 0 && increment < previous);
      previous = increment;
    }
  }
  assert.throws(() => reviewCurve(-1, 1, 0.2));
  assert.throws(() => reviewCurve(1, 1, 1));
});

test('whole-population protection still prefers isolated peers in the 30-person counterexample', () => {
  for (const p of REVIEW_CURVES) {
    const result = reviewGenderComposition([8, 6, 6, 5, 5], 3, p);
    assert.equal(result.layouts, 35);
    assert.equal(result.optimalMinIsolated, 3);
    assert.equal(result.optimalMaxIsolated, 3);
    assert.equal(result.best.minority.reduce((a, b) => a + b, 0), 3);
    assert.ok(result.best.welfare > result.withoutIsolation.welfare);
    assert.throws(() => evaluateGenderLayout([4, 4], [5, 0], p));
  }
});

test('small symmetric example exposes the mixing versus isolation tradeoff', () => {
  for (const p of REVIEW_CURVES) {
    const nonIsolated = evaluateGenderLayout([4, 4], [3, 0], p);
    const isolated = evaluateGenderLayout([4, 4], [1, 2], p);
    const segregated = evaluateGenderLayout([4, 4], [4, 0], p);
    const mixed = evaluateGenderLayout([4, 4], [2, 2], p);
    const sameOnly = genderUtility(3, true, p);
    const mixedPerson = genderUtility(1, true, p) + genderUtility(2, false, p);
    assert.equal(Math.sign(nonIsolated.welfare - isolated.welfare), Math.sign(sameOnly - mixedPerson));
    assert.equal(Math.sign(segregated.welfare - mixed.welfare), Math.sign(sameOnly - mixedPerson));
  }
});

test('lower-scale candidate keeps three minority peers together without preferring full segregation', () => {
  const p = parametersFromIncrements({ sameFirst: 0.9, otherFirst: 0.25, sameTail: 0.25, otherTail: 0.65 });
  const result = reviewGenderComposition([8, 6, 6, 5, 5], 3, p);
  assert.equal(result.layouts, 35);
  assert.equal(result.optimalMaxIsolated, 0);
  assert.equal(result.best.minority.reduce((a, b) => a + b, 0), 3);
  const segregated = evaluateGenderLayout([4, 4], [4, 0], p);
  const mixed = evaluateGenderLayout([4, 4], [2, 2], p);
  assert.ok(mixed.welfare > segregated.welfare);
  // Smaller group counts can retain a tradeoff; this is not an isolation prohibition.
  assert.equal(reviewGenderComposition([5, 5], 3, p).optimalMinIsolated, 1);
});
