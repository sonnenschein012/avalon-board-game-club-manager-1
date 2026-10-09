import { pathToFileURL } from 'node:url';

// Independent review values matched to initial defaults; not satisfaction-fitted.
export const EXAMPLE_PARAMETERS = Object.freeze({
  sameA: 1.2, sameK: Math.log(4), otherA: 5 / 7, otherK: -Math.log(0.65),
  yearB: 3, yearH: 0.3, yearT: 0.75,
  attenuationK: 0.25,
  reunionRho: 0.35, reunionPower: 2, reunionA: 0.6,
  protectionS: 2,
});

export function saturation(n, amplitude, speed) {
  return -amplitude * Math.expm1(-speed * n);
}

export function yearCost(distances, p = EXAMPLE_PARAMETERS) {
  if (distances.length === 0) return 0;
  const costs = distances.map(d => saturation(Math.abs(d), p.yearB, p.yearH));
  const minimum = Math.min(...costs);
  const meanExp = costs.reduce((sum, c) => sum + Math.exp(-(c - minimum) / p.yearT), 0) / costs.length;
  return minimum - p.yearT * Math.log(meanExp);
}

// Independent softplus form of the centered, fixed-scale welfare.
// The derivative includes the shift in the whole-assignment mean.
export function protectUtilities(utilities, p = EXAMPLE_PARAMETERS, attenuations = utilities.map(() => 1)) {
  if (!Number.isFinite(p.protectionS) || p.protectionS <= 0 || utilities.some(u => !Number.isFinite(u)) ||
    attenuations.length !== utilities.length || attenuations.some(w => !Number.isFinite(w) || w < 0 || w > 1)) throw new TypeError('invalid protection input');
  const maximum = attenuations.reduce((max, w) => Math.max(max, w), 0);
  const normalized = attenuations.map(w => maximum ? w / maximum : 1);
  const mass = normalized.reduce((sum, w) => sum + w, 0) || 1;
  const mean = utilities.reduce((sum, u, i) => sum + u * (normalized[i] / mass), 0);
  const converted = utilities.map(u => (u - mean) / p.protectionS);
  const sigmoids = converted.map(v => {
    const z = -v;
    return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
  });
  const averageSigmoid = sigmoids.reduce((sum, value, i) => sum + value * (normalized[i] / mass), 0);
  const weights = sigmoids.map(g => 1.5 + 0.5 * (g - averageSigmoid));
  const effectiveWeights = weights.map((weight, i) => weight * attenuations[i]);
  const contributions = utilities.map((u, i) => {
    const z = -converted[i];
    const softplus = Math.max(z, 0) + Math.log1p(Math.exp(-Math.abs(z)));
    return attenuations[i] * (1.5 * u - 0.5 * p.protectionS * (softplus - Math.LN2));
  });
  return { mean, converted, weights, effectiveWeights, contributions, welfare: contributions.reduce((sum, value) => sum + value, 0) };
}

function key(a, b) { return JSON.stringify([a, b].sort()); }
function stringOrder(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

function validateParameters(p) {
  for (const [name, value] of Object.entries(EXAMPLE_PARAMETERS)) {
    if (typeof p[name] !== typeof value || !Number.isFinite(p[name])) throw new TypeError(`invalid parameter: ${name}`);
    if (p[name] <= 0) throw new TypeError(`positive parameter required: ${name}`);
  }
  if (p.reunionRho >= 1 || p.reunionPower <= 1) throw new TypeError('require 0 < rho < 1 and reunionPower > 1');
  if (p.sameK <= p.otherK || saturation(1, p.sameA, p.sameK) <= saturation(1, p.otherA, p.otherK)) {
    throw new TypeError('same-gender utility must saturate faster and have a larger first increment');
  }
}

/**
 * Synthetic input only: members {id, gender:'M'|'F', year, board?},
 * groups {id, capacity, memberIds}, requests [[id,id]], fixed {memberId:groupId}.
 * history: newest-first past meetings; each meeting is an array of ID arrays.
 * Nonattended meetings do not age a person's history. Missing/nonbinary gender,
 * missing year, production request parsing and timestamps need separate policy.
 * @param {{members: Array<{id: string, gender: string, year: number, board?: boolean}>, groups: Array<{id: string, capacity: number, memberIds: string[]}>, requests?: string[][], fixed?: Record<string, string>, history?: string[][][]}} input
 */
export function evaluateAssignment({ members, groups, requests = [], fixed = {}, history = [] }, p = EXAMPLE_PARAMETERS) {
  validateParameters(p);
  const memberMap = new Map();
  for (const member of members) {
    if (!member.id || memberMap.has(member.id) || !['M', 'F'].includes(member.gender) || !Number.isInteger(member.year)) {
      throw new TypeError('synthetic members require unique IDs, M/F gender and integer year');
    }
    memberMap.set(member.id, member);
  }
  const sortedMembers = [...members].sort((a, b) => stringOrder(a.id, b.id));
  const groupMap = new Map();
  const assigned = new Map();
  for (const group of groups) {
    if (!group.id || groupMap.has(group.id) || !Number.isInteger(group.capacity) || group.capacity < 4 || group.capacity > 10) {
      throw new TypeError('groups require unique IDs and capacities in 4..10');
    }
    if (group.memberIds.length !== group.capacity) throw new TypeError('assignment must fill its previously selected capacity');
    groupMap.set(group.id, group);
    for (const id of group.memberIds) {
      if (!memberMap.has(id) || assigned.has(id)) throw new TypeError('unknown or duplicated attendee');
      assigned.set(id, group.id);
    }
  }
  if (assigned.size !== members.length) throw new TypeError('all attendees must be assigned');
  for (const [id, groupId] of Object.entries(fixed)) {
    if (!memberMap.has(id) || !groupMap.has(groupId) || assigned.get(id) !== groupId) throw new TypeError('manual placement must be preserved');
  }
  const pairs = new Map();
  for (const [a, b] of requests) {
    if (!memberMap.has(a) || !memberMap.has(b) || a === b) throw new TypeError('requests need two distinct participating IDs');
    pairs.set(key(a, b), [a, b].sort());
  }
  for (const meeting of history) {
    const ids = meeting.flat();
    if (new Set(ids).size !== ids.length) throw new TypeError('historical meeting contains a duplicate attendee');
  }

  const rawPeople = sortedMembers.map(member => {
    const peers = groupMap.get(assigned.get(member.id)).memberIds.filter(id => id !== member.id)
      .sort(stringOrder).map(id => memberMap.get(id));
    const n = peers.filter(peer => pairs.has(key(member.id, peer.id))).length;
    const sameCount = peers.filter(peer => peer.gender === member.gender).length;
    const sameUtility = saturation(sameCount, p.sameA, p.sameK);
    const otherUtility = saturation(peers.length - sameCount, p.otherA, p.otherK);
    const ageCost = yearCost(peers.map(peer => peer.year - member.year), p);
    const exposure = new Map();
    let participatedSince = 0;
    for (const meeting of history) {
      const pastGroup = meeting.find(ids => ids.includes(member.id));
      if (!pastGroup) continue;
      for (const id of pastGroup) {
        if (id !== member.id) exposure.set(id, (exposure.get(id) ?? 0) + p.reunionRho ** participatedSince);
      }
      participatedSince++;
    }
    const reunionByPeer = peers.map(peer => {
      const requested = pairs.has(key(member.id, peer.id));
      const h = exposure.get(peer.id) ?? 0;
      return { id: peer.id, exposure: h, requested, cost: requested ? 0 : p.reunionA * h ** p.reunionPower };
    });
    const reunionCost = reunionByPeer.reduce((sum, peer) => sum + peer.cost, 0);
    const attenuation = Math.exp(-p.attenuationK * n);
    const baseUtility = sameUtility + otherUtility - ageCost - reunionCost;
    const utility = attenuation * (sameUtility + otherUtility - ageCost) - reunionCost;
    return {
      id: member.id, requestCount: n, requestUtility: Math.log1p(n),
      sameUtility, otherUtility, yearCost: ageCost, attenuation,
      reunionByPeer, reunionCost, baseUtility, utility,
    };
  });
  const protection = protectUtilities(rawPeople.map(person => person.baseUtility), p, rawPeople.map(person => person.attenuation));
  const people = rawPeople.map((person, i) => ({ ...person,
    convertedUtility: protection.converted[i], protectedUtility: protection.contributions[i] - (1 - person.attenuation) * person.reunionCost,
    protectionWeight: protection.weights[i], effectiveWeight: protection.effectiveWeights[i],
  }));
  // Sum(log(1+n)) = log(product(1+n)). Compare the integer product exactly:
  // floating-point near-ties must not allow lower priorities to win.
  const requestProduct = people.reduce((product, person) => product * BigInt(1 + person.requestCount), 1n);
  const uncovered = groups.filter(group => !group.memberIds.some(id => memberMap.get(id).board));
  const unmetRequests = [...pairs.values()].filter(([a, b]) => assigned.get(a) !== assigned.get(b))
    .sort((a, b) => stringOrder(key(...a), key(...b)));
  const canonical = [...groups].sort((a, b) => stringOrder(a.id, b.id))
    .map(g => [g.id, [...g.memberIds].sort(stringOrder)]);
  return {
    requestProduct,
    requestScore: people.reduce((sum, person) => sum + person.requestUtility, 0),
    boardMissing: uncovered.length,
    boardMissingNonFour: uncovered.filter(group => group.capacity !== 4).length,
    totalUtility: people.reduce((sum, person) => sum + person.utility, 0),
    welfare: people.reduce((sum, person) => sum + person.protectedUtility, 0),
    people, unmetRequests,
    canonical: JSON.stringify(canonical),
  };
}

// Negative means left is preferred. Never mix the priority levels in a sum.
export function compareAssignments(left, right) {
  if (left.requestProduct !== right.requestProduct) return left.requestProduct > right.requestProduct ? -1 : 1;
  if (left.boardMissing !== right.boardMissing) return left.boardMissing - right.boardMissing;
  if (left.boardMissingNonFour !== right.boardMissingNonFour) return left.boardMissingNonFour - right.boardMissingNonFour;
  if (left.welfare !== right.welfare) return right.welfare - left.welfare;
  return stringOrder(left.canonical, right.canonical);
}

export function syntheticMembers(count = 8) {
  return Array.from({ length: count }, (_, i) => ({ id: String.fromCharCode(65 + i), gender: i % 2 ? 'F' : 'M', year: 23 + i % 3, board: i < 2 }));
}

export function twoGroups(first, second) {
  return [{ id: 'one', capacity: first.length, memberIds: first }, { id: 'two', capacity: second.length, memberIds: second }];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const members = syntheticMembers();
  const cases = [
    ['requested boards together', twoGroups(['A', 'B', 'C', 'D'], ['E', 'F', 'G', 'H']), [['A', 'B']]],
    ['requested boards separated', twoGroups(['A', 'C', 'D', 'E'], ['B', 'F', 'G', 'H']), [['A', 'B']]],
    ['no request, boards together', twoGroups(['A', 'B', 'C', 'D'], ['E', 'F', 'G', 'H']), []],
    ['no request, boards separated', twoGroups(['A', 'C', 'D', 'E'], ['B', 'F', 'G', 'H']), []],
  ];
  console.table(cases.map(([name, groups, requests]) => {
    const r = evaluateAssignment({ members, groups, requests });
    return { case: name, requestProduct: String(r.requestProduct), boardMissing: r.boardMissing, totalUtility: r.totalUtility.toFixed(3), welfare: r.welfare.toFixed(3) };
  }));
  console.table([[0, 10], [5, 5], [-10, 0], [-5, -5]].map(utilities => ({
    utilities: utilities.join('/'), sum: utilities.reduce((a, b) => a + b, 0),
    welfare: protectUtilities(utilities).welfare.toFixed(3),
    weights: protectUtilities(utilities).weights.map(w => w.toFixed(3)).join('/'),
  })));
}
