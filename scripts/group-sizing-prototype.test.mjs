import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeGroups, solveGroupSizes } from './group-sizing-prototype.mjs';

const solve = (total, count, targets = []) => solveGroupSizes({ total, groups: makeGroups(count, targets) });

for (const [total, expected] of [
  [25, [7, 5, 5, 4, 4]],
  [26, [6, 6, 5, 5, 4]],
  [28, [7, 6, 5, 5, 5]],
  [30, [8, 6, 6, 5, 5]],
  [31, [8, 7, 6, 5, 5]],
  [33, [8, 7, 6, 6, 6]],
  [34, [10, 7, 6, 6, 5]],
  [36, [10, 7, 7, 6, 6]],
]) {
  test(`reproduces accepted ${total}-person five-group decision`, () => {
    assert.deepEqual(solve(total, 5).sizes, expected);
  });
}

test('fixed capacity is preserved before general composition preferences', () => {
  const result = solve(30, 5, [7]);
  assert.deepEqual(result.sizes, [7, 6, 6, 6, 5]);
  assert.equal(result.assignments[0].size, 7);
  assert.equal(result.operatorDeviation, 0);
});

test('all fixed capacities keep their own group IDs even if their layout is disfavored', () => {
  const targets = [5, 7, 8, 4, 6];
  const result = solve(30, 5, targets);
  assert.deepEqual(result.assignments.map(g => g.size), targets);
  assert.deepEqual(result.adjustments, []);
  assert.deepEqual(solve(35, 5, [7, 7, 7, 7, 7]).sizes, [7, 7, 7, 7, 7]);
});

test('too few or too many fixed seats are automatically adjusted by the minimum total amount', () => {
  const under = solve(28, 5, [5, 5, 5, 5, 5]);
  const over = solve(25, 5, [6, 6, 6, 6, 6]);
  assert.equal(under.operatorDeviation, 3);
  assert.equal(over.operatorDeviation, 5);
  assert.deepEqual(under.sizes, [7, 6, 5, 5, 5]);
  assert.deepEqual(over.sizes, [6, 5, 5, 5, 4]);
});

test('out-of-range operator targets are preferences, never invalid capacities', () => {
  const result = solve(20, 3, [12, 2]);
  assert.equal(result.operatorDeviation, 4);
  assert.equal(result.assignments[0].size, 10);
  assert.equal(result.assignments[1].size, 4);
});

test('empty UI targets and explicit null/undefined all mean unspecified', () => {
  const groups = [{ id: 'a', targetSize: 0 }, { id: 'b', targetSize: null }, { id: 'c' }];
  const result = solveGroupSizes({ total: 18, groups });
  assert.deepEqual(result.sizes, [7, 6, 5]);
  assert.equal(result.operatorDeviation, 0);
});

test('extra fours do not incur repetition or undersized-room penalties', () => {
  const result = solve(34, 6);
  assert.deepEqual(result.sizes, [8, 6, 6, 5, 5, 4]);
  assert.equal(result.preferenceScore, 0);
  assert.equal(result.extraFourCount, 1);
  assert.equal(solve(42, 8).preferenceScore, 0);
  assert.deepEqual(solve(42, 8).sizes, [8, 6, 6, 5, 5, 4, 4, 4]);
});

test('a fixed four can occupy the extra role regardless of its index', () => {
  for (let index = 0; index < 6; index++) {
    const targets = Array(6).fill(null);
    targets[index] = 4;
    const result = solve(34, 6, targets);
    assert.equal(result.assignments[index].size, 4);
    assert.equal(result.operatorDeviation, 0);
    assert.deepEqual(result.sizes, [8, 6, 6, 5, 5, 4]);
  }
});

test('one free group can exceed four without disturbing five fixed groups', () => {
  const result = solve(33, 6, [5, 5, 5, 6, 6]);
  assert.equal(result.assignments[5].size, 6);
  assert.equal(result.penalties.missingExtraFours, 1);
  assert.equal(result.operatorDeviation, 0);
});

test('multiple free groups relax only the unattainable extra-four quota', () => {
  const result = solve(42, 7, [5, 5, 6, 7]);
  assert.equal(result.operatorDeviation, 0);
  assert.equal(result.extraFourCount, 1);
  assert.equal(result.penalties.missingExtraFours, 1);
  assert.equal(result.sizes.reduce((sum, n) => sum + n, 0), 42);
  assert.equal(result.penalties.excessEightPlus, 0);
});

test('small group counts remove only the missing-large-group penalty', () => {
  assert.deepEqual(solve(12, 2).sizes, [6, 6]);
  assert.equal(solve(12, 2).preferenceParts.noLarge, 0);
  assert.equal(solve(16, 4).preferenceParts.noLarge, 0);
  assert.equal(solve(20, 5).preferenceParts.noLarge, 0.75);
});

test('policy ties use the provisional smaller-maximum fallback', () => {
  const result = solve(18, 3);
  assert.equal(result.policyTieCount, 2);
  assert.deepEqual(result.sizes, [7, 6, 5]);
});

test('result and labeled assignments do not depend on input ordering', () => {
  const groups = makeGroups(6, [7, null, 5, null, 4, null]);
  const before = structuredClone(groups);
  assert.deepEqual(solveGroupSizes({ total: 35, groups }), solveGroupSizes({ total: 35, groups: [...groups].reverse() }));
  assert.deepEqual(groups, before);
});

test('outside 4..10 per group returns an explicit infeasible result without partial allocation', () => {
  for (const total of [19, 51]) {
    assert.deepEqual(solve(total, 5), { status: 'infeasible', reason: 'change-group-count', minTotal: 20, maxTotal: 50 });
  }
});

test('invalid totals, IDs and fractional/negative targets are rejected', () => {
  assert.throws(() => solve(-1, 5), TypeError);
  assert.throws(() => solve(20.5, 5), TypeError);
  assert.throws(() => solve(0, 0), TypeError);
  assert.throws(() => solve(20, 5, [-1]), TypeError);
  assert.throws(() => solve(20, 5, [4.5]), TypeError);
  assert.throws(() => solveGroupSizes({ total: 8, groups: [{ id: 'a' }, { id: 'a' }] }), TypeError);
});

// Independent labeled exhaustive oracle: does not use the prototype's sorted
// subsequence matcher or ranking. It checks that minimum operator deviation
// survives all lower-priority policies, for every feasible total.
test('operator deviation matches exhaustive labeled allocation for mixed targets', () => {
  for (const targets of [[7, null, 5], [10, 4, null, 7], [12, 2, 9], [null, 6, null, 5]]) {
    const minima = new Map();
    function enumerate(i, total, cost) {
      if (i === targets.length) {
        minima.set(total, Math.min(minima.get(total) ?? Infinity, cost));
        return;
      }
      for (let n = 4; n <= 10; n++) enumerate(i + 1, total + n, cost + (targets[i] === null ? 0 : Math.abs(n - targets[i])));
    }
    enumerate(0, 0, 0);
    for (const [total, minimum] of minima) {
      assert.equal(solve(total, targets.length, targets).operatorDeviation, minimum, `${total}: ${targets}`);
    }
  }
});

test('all feasible totals for 1..10 groups conserve people and produce deterministic capacities', () => {
  for (let count = 1; count <= 10; count++) {
    for (let total = 4 * count; total <= 10 * count; total++) {
      const result = solve(total, count);
      assert.equal(result.status, 'ok');
      assert.equal(result.sizes.length, count);
      assert.equal(result.sizes.reduce((sum, n) => sum + n, 0), total);
      assert.ok(result.sizes.every(n => Number.isInteger(n) && n >= 4 && n <= 10));
      assert.deepEqual(result.assignments.map(g => g.size).sort((a, b) => b - a), result.sizes);
      assert.deepEqual(solve(total, count), result);
    }
  }
});

test('manual lower bounds match independent labeled enumeration before target preferences', () => {
  for (const [targets, minimums] of [[[4, 8, null], [8, 4, 5]], [[10, 4, 6], [4, 7, 6]], [[null, 6, 5], [9, 4, 4]]]) {
    const minima = new Map();
    function enumerate(i, total, cost) {
      if (i === targets.length) { minima.set(total, Math.min(minima.get(total) ?? Infinity, cost)); return; }
      for (let n = minimums[i]; n <= 10; n++) enumerate(i + 1, total + n, cost + (targets[i] === null ? 0 : Math.abs(n - targets[i])));
    }
    enumerate(0, 0, 0);
    const groups = targets.map((targetSize, i) => ({ id: String(i), targetSize, minimum: minimums[i] }));
    for (let total = 12; total <= 30; total++) {
      const result = solveGroupSizes({ total, groups });
      if (!minima.has(total)) { assert.equal(result.status, 'infeasible'); continue; }
      assert.equal(result.operatorDeviation, minima.get(total));
      assert.ok(result.assignments.every(g => g.size >= minimums[Number(g.id)]));
      assert.deepEqual(result, solveGroupSizes({ total, groups: [...groups].reverse() }));
    }
  }
});
