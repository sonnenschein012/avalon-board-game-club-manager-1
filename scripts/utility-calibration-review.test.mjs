import test from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLE_PARAMETERS, saturation, evaluateAssignment, compareAssignments } from './group-utility-prototype.mjs';
import { calibrationCandidates, parametersFromIncrements, summarizeCalibration, refineCalibrationPairs } from './utility-calibration-review.mjs';

test('first gain and tail map exactly to the existing exponential and valid candidate conditions', () => {
  // This exploratory grid was defined against the previous operating curve.
  const baseline = { ...EXAMPLE_PARAMETERS, sameA: 3, sameK: 1.2, otherA: 4, otherK: 0.35 };
  const cases = calibrationCandidates(baseline);
  assert.equal(cases.length, 55);
  for (const { inputs, parameters: p } of cases.slice(1)) {
    for (const [first, tail, amplitude, speed] of [[inputs.sameFirst, inputs.sameTail, p.sameA, p.sameK], [inputs.otherFirst, inputs.otherTail, p.otherA, p.otherK]]) {
      const one = saturation(1, amplitude, speed), two = saturation(2, amplitude, speed);
      assert.ok(Math.abs(one - first) < 1e-12);
      assert.ok(Math.abs((two - one) / one - tail) < 1e-12);
      for (let n = 0; n <= 9; n++) assert.ok(Math.abs(saturation(n, amplitude, speed) - first * (1 - tail ** n) / (1 - tail)) < 1e-12);
    }
    assert.ok(p.sameK > p.otherK && p.sameK > baseline.sameK && p.otherK > baseline.otherK);
    assert.ok(inputs.sameFirst / inputs.otherFirst <= 1.3 + 1e-12);
    assert.equal(p.protectionS, EXAMPLE_PARAMETERS.protectionS);
    assert.equal(p.reunionRho, EXAMPLE_PARAMETERS.reunionRho);
  }
  assert.throws(() => parametersFromIncrements({ sameFirst: 1, otherFirst: 1, sameTail: 0.2, otherTail: 0.5 }));
  assert.throws(() => parametersFromIncrements({ sameFirst: 1.2, otherFirst: 1, sameTail: 0.8, otherTail: 0.5 }));
});

test('offline pair moves can improve whole-assignment welfare without losing requests or board coverage', () => {
  const members = Array.from({ length: 8 }, (_, i) => ({ id: String(i), gender: 'M', year: [0, 1, 4, 5].includes(i) ? 22 : 26, board: i === 2 || i === 4 }));
  const groups = [{ id: 'a', targetSize: 4, memberIds: ['0', '1', '2', '3'] }, { id: 'b', targetSize: 4, memberIds: ['4', '5', '6', '7'] }];
  const requests = [['0', '1']];
  const evaluate = rows => evaluateAssignment({ members, requests, groups: rows.map(g => ({ ...g, capacity: g.targetSize })) });
  const baseline = evaluate(groups);
  const result = refineCalibrationPairs(groups, requests, evaluate, compareAssignments);
  assert.ok(result.score.welfare > baseline.welfare);
  assert.equal(result.score.requestProduct, baseline.requestProduct);
  assert.equal(result.score.boardMissing, 0);
  assert.equal(new Set(result.updatedGroups.flatMap(g => g.memberIds)).size, 8);
  assert.ok(result.updatedGroups.every(g => g.memberIds.length === g.targetSize));
  assert.deepEqual(groups[0].memberIds, ['0', '1', '2', '3']);
});

test('calibration summary enforces whole assignment and counts request pairs once', () => {
  const people = new Map(Array.from({ length: 8 }, (_, i) => [String(i), { gender: i < 3 ? '여' : '남' }]));
  const rows = [...people.keys()].map(id => ({ id, sameUtility: 1, otherUtility: 1, yearCost: 0.5, reunionCost: 0.1, baseUtility: 1.4 }));
  const context = { people, requests: new Map([['pair', ['0', '4']]]) };
  const result = { updatedGroups: [{ id: 'a', targetSize: 4, memberIds: ['0', '1', '4', '5'] }, { id: 'b', targetSize: 4, memberIds: ['2', '3', '6', '7'] }],
    score: { requestProduct: 4n, boardMissing: 0, boardMissingNonFour: 0, people: rows, welfare: 10 } };
  assert.deepEqual(summarizeCalibration(result, context).femaleCounts, [2, 1]);
  assert.equal(summarizeCalibration(result, context).satisfiedPairs, 1);
  assert.equal(summarizeCalibration(result, context).femaleMeanGroupSize, 4);
  assert.equal(summarizeCalibration(result, context).femaleIsolated, 1);
  assert.throws(() => summarizeCalibration({ ...result, updatedGroups: [{ ...result.updatedGroups[0], memberIds: ['0', '0', '4', '5'] }, result.updatedGroups[1]] }, context));
});
