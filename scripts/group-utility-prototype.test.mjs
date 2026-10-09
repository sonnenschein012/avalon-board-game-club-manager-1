import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EXAMPLE_PARAMETERS as p, saturation, yearCost, protectUtilities,
  evaluateAssignment, compareAssignments, syntheticMembers, twoGroups,
} from './group-utility-prototype.mjs';

const groups = twoGroups(['A', 'B', 'C', 'D'], ['E', 'F', 'G', 'H']);
const evaluate = (extra = {}, parameters = p) => evaluateAssignment({ members: syntheticMembers(), groups, ...extra }, parameters);
const person = (result, id) => result.people.find(row => row.id === id);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('gender utilities increase with decreasing positive increments', () => {
  for (const [a, k] of [[p.sameA, p.sameK], [p.otherA, p.otherK]]) {
    let previous = Infinity;
    for (let n = 1; n <= 9; n++) {
      const increment = saturation(n, a, k) - saturation(n - 1, a, k);
      assert.ok(increment > 0 && increment < previous);
      previous = increment;
    }
  }
  assert.ok(saturation(1, p.sameA, p.sameK) > saturation(1, p.otherA, p.otherK));
  assert.ok(p.sameK > p.otherK);
});

test('year gap is symmetric, increasing and has diminishing increments', () => {
  let previous = Infinity;
  for (let d = 1; d <= 15; d++) {
    close(yearCost([d]), yearCost([-d]));
    const increment = yearCost([d]) - yearCost([d - 1]);
    assert.ok(increment > 0 && increment < previous);
    previous = increment;
  }
});

test('nearby peers lower group year burden with diminishing additional relief', () => {
  const costs = [0, 1, 2, 3, 4].map(near => yearCost([...Array(near).fill(0), ...Array(4 - near).fill(5)]));
  let previous = Infinity;
  for (let i = 1; i < costs.length; i++) {
    const relief = costs[i - 1] - costs[i];
    assert.ok(relief > 0 && relief < previous);
    previous = relief;
  }
  assert.ok(costs[1] > costs[4], 'distant peers still count even with a same-year peer');
});

test('soft year cost preserves uniform gaps and remains finite at narrow smoothing', () => {
  close(yearCost([4, 4, 4]), yearCost([4]));
  assert.ok(Number.isFinite(yearCost([0, 100, 100], { ...p, yearT: 1e-8 })));
  assert.ok(yearCost([0, 100, 100], { ...p, yearT: 1e-8 }) >= 0);
});

test('one-sided requests benefit both endpoints and reverse/duplicate entries do not add value', () => {
  const once = evaluate({ requests: [['A', 'B']] });
  const repeated = evaluate({ requests: [['B', 'A'], ['A', 'B'], ['A', 'B']] });
  assert.deepEqual(once, repeated);
  assert.equal(person(once, 'A').requestCount, 1);
  assert.equal(person(once, 'B').requestCount, 1);
  assert.equal(once.requestProduct, 4n);
});

test('a four-request star counts the hub and all four requesters', () => {
  const input = { members: syntheticMembers(10), groups: twoGroups(['A', 'B', 'C', 'D', 'E'], ['F', 'G', 'H', 'I', 'J']) };
  const star = evaluateAssignment({ ...input, requests: ['B', 'C', 'D', 'E'].map(id => [id, 'A']) });
  const pair = evaluateAssignment({ ...input, requests: [['A', 'B']] });
  assert.equal(person(star, 'A').requestCount, 4);
  assert.equal(star.requestProduct, 80n);
  assert.equal(pair.requestProduct, 4n);
  close(star.requestScore, Math.log(5) + 4 * Math.log(2));
});

test('two dispersed satisfied pairs outrank two pairs concentrated on a hub', () => {
  const requests = [['A', 'B'], ['A', 'C'], ['D', 'E']];
  const concentrated = evaluate({ requests });
  const dispersed = evaluate({ requests, groups: twoGroups(['A', 'B', 'D', 'E'], ['C', 'F', 'G', 'H']) });
  assert.equal(concentrated.requestProduct, 12n);
  assert.equal(dispersed.requestProduct, 16n);
  assert.ok(compareAssignments(dispersed, concentrated) < 0);
});

test('unmet requests grant no attenuation and are reported once', () => {
  const baseline = evaluate();
  const result = evaluate({ requests: [['A', 'E'], ['E', 'A']] });
  assert.equal(result.requestProduct, 1n);
  close(person(result, 'A').utility, person(baseline, 'A').utility);
  assert.equal(person(result, 'A').attenuation, 1);
  assert.deepEqual(result.unmetRequests, [['A', 'E']]);
});

test('attenuation relief grows with request partners but each addition has less effect', () => {
  const weights = [0, 1, 2, 3].map(n => Math.exp(-p.attenuationK * n));
  assert.ok(weights[0] - weights[1] > weights[1] - weights[2]);
  assert.ok(weights[1] - weights[2] > weights[2] - weights[3]);
  const base = evaluate();
  const requested = evaluate({ requests: [['A', 'B']] });
  close(person(requested, 'A').utility, Math.exp(-p.attenuationK) * person(base, 'A').utility);
});

test('absence does not age history, and two people can have different reunion costs', () => {
  const result = evaluate({ history: [[['B', 'E']], [['B', 'F']], [['A', 'B', 'C', 'D']]] });
  const ab = person(result, 'A').reunionByPeer.find(peer => peer.id === 'B');
  const ba = person(result, 'B').reunionByPeer.find(peer => peer.id === 'A');
  close(ab.exposure, 1);
  close(ba.exposure, p.reunionRho ** 2);
  assert.ok(ab.cost > ba.cost);
});

test('recent repeated meetings cost more than the same count with intervening attendance', () => {
  const recent = evaluate({ history: [[['A', 'B']], [['A', 'B']]] });
  const spaced = evaluate({ history: [[['A', 'B']], [['A', 'E']], [['A', 'B']]] });
  assert.ok(person(recent, 'A').reunionCost > person(spaced, 'A').reunionCost);
  const increment1 = p.reunionA * (2 ** p.reunionPower - 1);
  const increment2 = p.reunionA * (3 ** p.reunionPower - 2 ** p.reunionPower);
  assert.ok(increment2 > increment1);
});

test('requested peers are exempt but other reunion costs remain unattenuated and additive', () => {
  const history = [[['A', 'B', 'C', 'D']], [['A', 'B', 'C', 'D']]];
  const base = evaluate({ history });
  const result = evaluate({ history, requests: [['A', 'C']] });
  const a = person(result, 'A');
  assert.equal(a.reunionByPeer.find(peer => peer.id === 'C').cost, 0);
  close(a.reunionByPeer.find(peer => peer.id === 'B').cost, person(base, 'A').reunionByPeer.find(peer => peer.id === 'B').cost);
  close(a.reunionCost, a.reunionByPeer.reduce((sum, peer) => sum + peer.cost, 0));
  close(a.utility, a.attenuation * (a.sameUtility + a.otherUtility - a.yearCost) - a.reunionCost);
});

test('fulfilled requests outrank board coverage and any inferred welfare improvement', () => {
  const requests = [['A', 'B']];
  const together = evaluate({ requests });
  const separate = evaluate({ requests, groups: twoGroups(['A', 'C', 'D', 'E'], ['B', 'F', 'G', 'H']) });
  assert.equal(together.boardMissing, 1);
  assert.equal(separate.boardMissing, 0);
  assert.ok(compareAssignments(together, { ...separate, welfare: 1e100 }) < 0);
});

test('equal request satisfaction prefers board coverage before inferred welfare', () => {
  const together = evaluate();
  const separate = evaluate({ groups: twoGroups(['A', 'C', 'D', 'E'], ['B', 'F', 'G', 'H']) });
  assert.ok(compareAssignments(separate, { ...together, welfare: 1e100 }) < 0);
});

test('with one board member, prefer leaving the four-person group uncovered', () => {
  const members = syntheticMembers(9).map(m => ({ ...m, board: m.id === 'A' }));
  const boardInFour = evaluateAssignment({ members, groups: twoGroups(['A', 'B', 'C', 'D'], ['E', 'F', 'G', 'H', 'I']) });
  const boardInFive = evaluateAssignment({ members, groups: twoGroups(['I', 'B', 'C', 'D'], ['E', 'F', 'G', 'H', 'A']) });
  assert.equal(boardInFour.boardMissing, boardInFive.boardMissing);
  assert.ok(compareAssignments(boardInFive, boardInFour) < 0);
});

test('manual placement and previously fixed capacity cannot be overridden by scoring', () => {
  assert.throws(() => evaluate({ fixed: { A: 'two' } }), /manual placement/);
  assert.throws(() => evaluate({ groups: [{ ...groups[0], capacity: 5 }, groups[1]] }), /capacity/);
  assert.throws(() => evaluate({ groups: twoGroups(['A', 'B', 'C', 'D'], ['A', 'F', 'G', 'H']) }), /duplicated/);
  assert.throws(() => evaluate({ groups: [groups[0]] }), /all attendees/);
});

test('relative protection has bounded actual derivatives and favors lower utilities', () => {
  const utilities = [-8, -4, 0, 4, 8];
  const result = protectUtilities(utilities);
  assert.ok(result.weights.every(w => w >= 1 && w <= 2));
  assert.ok(result.weights.slice(1).every((w, i) => w < result.weights[i]));
  for (let i = 0; i < utilities.length; i++) {
    const delta = 1e-5;
    const higher = [...utilities], lower = [...utilities]; higher[i] += delta; lower[i] -= delta;
    const derivative = (protectUtilities(higher).welfare - protectUtilities(lower).welfare) / (2 * delta);
    assert.ok(Math.abs(derivative - result.weights[i]) < 1e-7);
  }
});

test('relative protection prefers balanced equal-total utilities and preserves sole improvements', () => {
  assert.ok(protectUtilities([5, 5]).welfare > protectUtilities([0, 10]).welfare);
  for (const utilities of [[-100, 0, 100], [-5, -5], [0], [0, 0, 0], [10, 20, 30]]) {
    for (let i = 0; i < utilities.length; i++) {
      const higher = [...utilities]; higher[i] += 1;
      const gain = protectUtilities(higher).welfare - protectUtilities(utilities).welfare;
      assert.ok(gain >= 1 - 1e-9 && gain <= 2 + 1e-9);
    }
  }
});

test('relative protection ignores common shifts, keeps a fixed scale and stays finite', () => {
  const a = protectUtilities([2, 4, 6]), b = protectUtilities([-4, -2, 0]);
  assert.deepEqual(a.converted, b.converted);
  assert.deepEqual(a.weights, b.weights);
  close(a.welfare - b.welfare, 1.5 * 3 * 6);
  assert.notDeepEqual(a.weights, protectUtilities([4, 8, 12]).weights);
  assert.ok(Number.isFinite(protectUtilities([-1e6, 0, 1e6]).welfare));
  assert.deepEqual(protectUtilities([7, 7, 7]).weights, [1.5, 1.5, 1.5]);
  assert.equal(protectUtilities([]).welfare, 0);
});

test('protection precedes unequal attenuation with bounded actual derivatives', () => {
  const values = [-10, -2, 5, 20], attenuations = [1, 0.78, 0.1, 0];
  const score = protectUtilities(values, p, attenuations);
  for (let i = 0; i < values.length; i++) {
    assert.ok(score.weights[i] >= 1 && score.weights[i] <= 2);
    const plus = [...values], minus = [...values]; plus[i] += 1e-5; minus[i] -= 1e-5;
    const derivative = (protectUtilities(plus, p, attenuations).welfare - protectUtilities(minus, p, attenuations).welfare) / 2e-5;
    assert.ok(Math.abs(derivative - attenuations[i] * score.weights[i]) < 1e-7);
  }
  const shifted = protectUtilities(values.map(u => u + 5), p, attenuations);
  close(shifted.welfare - score.welfare, 7.5 * attenuations.reduce((sum, w) => sum + w, 0));
  assert.equal(protectUtilities(values, p, [0, 0, 0, 0]).welfare, 0);
  assert.throws(() => protectUtilities(values, p, [1]), /protection input/);
});

test('evaluation is order-independent and does not mutate inputs', () => {
  const input = { members: syntheticMembers(), groups: structuredClone(groups), requests: [['A', 'B'], ['B', 'C']] };
  const original = structuredClone(input);
  const a = evaluateAssignment(input);
  const b = evaluateAssignment({ members: [...input.members].reverse(), groups: [...input.groups].reverse().map(g => ({ ...g, memberIds: [...g.memberIds].reverse() })), requests: [...input.requests].reverse() });
  assert.deepEqual(a, b);
  assert.deepEqual(input, original);
});

test('synthetic input rejects unknown gender, invalid requests, repeated history IDs and bad parameters', () => {
  assert.throws(() => evaluate({ members: syntheticMembers().map(m => ({ ...m, gender: '?' })) }), /synthetic members/);
  assert.throws(() => evaluate({ requests: [['A', 'missing']] }), /participating IDs/);
  assert.throws(() => evaluate({ history: [[['A'], ['A']]] }), /duplicate attendee/);
  assert.throws(() => evaluate({}, { ...p, reunionRho: 1 }), /rho/);
  assert.throws(() => evaluate({}, { ...p, sameK: 0.1 }), /saturate/);
});

test('exhaustive eight-person trial keeps requests first and preserves manual placement', () => {
  const ids = syntheticMembers().map(m => m.id);
  const results = [];
  for (let mask = 0; mask < 256; mask++) {
    const first = ids.filter((_, i) => mask & (1 << i));
    if (first.length !== 4 || !first.includes('A')) continue;
    const second = ids.filter(id => !first.includes(id));
    results.push(evaluate({ groups: twoGroups(first, second), requests: [['A', 'B']], fixed: { A: 'one' } }));
  }
  assert.equal(results.length, 35);
  results.sort(compareAssignments);
  assert.equal(results[0].requestProduct, 4n);
  assert.equal(results[0].boardMissing, 1);
  assert.deepEqual(results[0].unmetRequests, []);
  assert.ok(results.every(r => compareAssignments(results[0], r) <= 0));
});
