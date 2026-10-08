import type { Attendee, Member, Session, SessionGroup } from '../../types';
import { getMemberFromAttendee } from './getMemberFromAttendee';
import { getLocalDateKey } from '../attendance/sessionMetadata';

// Initial operating values; observational satisfaction calibration remains open.
export const REVIEW_PARAMETERS = Object.freeze({
  sameA: 3, sameK: 1.2, otherA: 4, otherK: 0.35,
  yearB: 3, yearH: 0.3, yearT: 0.75, attenuationK: 0.25,
  reunionRho: 0.35, reunionPower: 2, reunionA: 0.6,
  protectionS: 2,
});
export type UtilityParameters = { [K in keyof typeof REVIEW_PARAMETERS]: number };
export interface UtilityPerson {
  id: string; memberId: string; name: string; gender: '남' | '여' | null;
  year: number | null; board: boolean;
}
export interface UtilityContext {
  people: Map<string, UtilityPerson>;
  requests: Map<string, [string, string]>;
  absentRequests: { requesterId: string; requester: string; recipient: string }[];
  exposures: Map<string, Map<string, number>>;
  parameters: UtilityParameters;
}
interface PersonUtility {
  id: string; name: string; requestCount: number; sameUtility: number; otherUtility: number;
  yearCost: number; attenuation: number; reunionCost: number; utility: number;
}
export interface PersonScore extends PersonUtility {
  convertedUtility: number; protectionWeight: number; protectedUtility: number;
}
export interface AssignmentScore {
  requestProduct: bigint; requestScore: number; boardMissing: number; boardMissingNonFour: number;
  welfare: number; totalUtility: number; people: PersonScore[];
}
export const pairKey = (a: string, b: string) => JSON.stringify([a, b].sort());
const saturation = (n: number, a: number, k: number) => -a * Math.expm1(-k * n);

/** Translation-invariant protection over the entire assignment, with fixed scale.
 * W = 1.5 sum(u) - 0.5 s sum(log(cosh((u - mean(u)) / (2s)))).
 * dW/du_i = 1.5 - 0.25 (tanh(z_i/2) - mean(tanh(z/2))) in [1, 2].
 * Contributions decompose W; they are not u_i multiplied by its marginal weight.
 */
export function relativeProtection(utilities: number[], scale: number) {
  if (!Number.isFinite(scale) || scale <= 0 || utilities.some(u => !Number.isFinite(u))) throw new Error('보호 평가 입력을 확인해주세요.');
  const mean = utilities.reduce((sum, u) => sum + u / (utilities.length || 1), 0);
  const converted = utilities.map(u => (u - mean) / scale);
  const tangents = converted.map(z => Math.tanh(z / 2));
  const averageTangent = tangents.reduce((sum, t) => sum + t / (utilities.length || 1), 0);
  const weights = tangents.map(t => 1.5 - 0.25 * (t - averageTangent));
  const contributions = utilities.map((u, i) => {
    const x = Math.abs(converted[i]! / 2);
    const logCosh = x + Math.log1p(Math.exp(-2 * x)) - Math.LN2;
    return 1.5 * u - 0.5 * scale * logCosh;
  });
  return { mean, converted, weights, contributions, welfare: contributions.reduce((sum, c) => sum + c, 0) };
}

function protectPeople(people: PersonUtility[], parameters: UtilityParameters) {
  const protection = relativeProtection(people.map(p => p.utility), parameters.protectionS);
  return {
    welfare: protection.welfare,
    people: people.map((person, i): PersonScore => ({ ...person,
      convertedUtility: protection.converted[i]!, protectionWeight: protection.weights[i]!,
      protectedUtility: protection.contributions[i]!,
    })),
  };
}

export function validateUtilityParameters(p: UtilityParameters) {
  for (const name of Object.keys(REVIEW_PARAMETERS) as (keyof UtilityParameters)[]) {
    if (!Number.isFinite(p[name]) || p[name] <= 0) throw new Error('효용 파라미터를 확인해주세요.');
  }
  if (p.reunionRho >= 1 || p.reunionPower <= 1 || p.sameK <= p.otherK ||
    saturation(1, p.sameA, p.sameK) <= saturation(1, p.otherA, p.otherK)) throw new Error('효용 관계식의 파라미터 조건을 확인해주세요.');
}

/** IDs in this context are attendee IDs; stored history is converted via memberId. */
export function buildUtilityContext(input: {
  attendees: Attendee[]; members: Member[]; sessions: Session[]; assignmentDate: string;
}, parameters: UtilityParameters = REVIEW_PARAMETERS): UtilityContext {
  validateUtilityParameters(parameters);
  const { attendees, members, sessions, assignmentDate } = input;
  const people = new Map<string, UtilityPerson>();
  const memberToAttendee = new Map<string, string>();
  for (const attendee of attendees) {
    if (attendee.status === '결석') continue;
    const member = getMemberFromAttendee(members, attendee.name, attendee.studentIdPrefix);
    if (!member) continue;
    if (memberToAttendee.has(member.id)) throw new Error(`${member.name}님의 출석 항목이 중복됩니다. 명단을 확인해주세요.`);
    const match = member.studentId?.match(/^20(\d{2})|^(\d{2})/);
    const yearText = match?.[1] ?? match?.[2];
    people.set(attendee.id, {
      id: attendee.id, memberId: member.id, name: member.name,
      gender: member.gender === '남' || member.gender === '여' ? member.gender : null,
      year: yearText === undefined ? null : Number(yearText), board: Boolean(member.isBoardMember),
    });
    memberToAttendee.set(member.id, attendee.id);
  }
  const requests = new Map<string, [string, string]>();
  const absentRequests: UtilityContext['absentRequests'] = [];
  for (const attendee of attendees) {
    const requester = people.get(attendee.id);
    if (!requester || !attendee.request) continue;
    for (const member of members) {
      // Deliberately preserve the existing full-member-name substring matching.
      if (member.id === requester.memberId || !attendee.request.includes(member.name)) continue;
      const recipientId = memberToAttendee.get(member.id);
      if (recipientId) requests.set(pairKey(attendee.id, recipientId), [attendee.id, recipientId]);
      else absentRequests.push({ requesterId: attendee.id, requester: requester.name, recipient: member.name });
    }
  }
  const past = sessions.map(session => ({ session, date: session.date?.toDate?.() }))
    .filter((item): item is { session: Session; date: Date } => Boolean(item.date && Number.isFinite(item.date.getTime()) && getLocalDateKey(item.date) < assignmentDate))
    .sort((a, b) => b.date.getTime() - a.date.getTime() || a.session.id.localeCompare(b.session.id));
  const exposures: UtilityContext['exposures'] = new Map();
  for (const person of people.values()) {
    const exposure = new Map<string, number>();
    let attendedSince = 0;
    for (const { session } of past) {
      const group = session.groups.find(g => g.memberIds.includes(person.memberId));
      if (!group) continue;
      for (const memberId of new Set(group.memberIds)) {
        const peerId = memberToAttendee.get(memberId);
        if (peerId && peerId !== person.id) exposure.set(peerId, (exposure.get(peerId) ?? 0) + parameters.reunionRho ** attendedSince);
      }
      attendedSince++;
    }
    exposures.set(person.id, exposure);
  }
  return { people, requests, absentRequests, exposures, parameters };
}

export function evaluateUtilityGroup(ids: string[], context: UtilityContext): AssignmentScore {
  const p = context.parameters;
  const members = [...ids].sort().map(id => {
    const person = context.people.get(id);
    if (!person) throw new Error('조에 미등록 또는 결석 인원이 있습니다. 명단을 확인해주세요.');
    return person;
  });
  const people = members.map(person => {
    const peers = members.filter(peer => peer.id !== person.id);
    const requestCount = peers.filter(peer => context.requests.has(pairKey(person.id, peer.id))).length;
    const sameCount = person.gender === null ? 0 : peers.filter(peer => peer.gender === person.gender).length;
    const otherCount = person.gender === null ? 0 : peers.filter(peer => peer.gender !== null && peer.gender !== person.gender).length;
    const sameUtility = saturation(sameCount, p.sameA, p.sameK);
    const otherUtility = saturation(otherCount, p.otherA, p.otherK);
    const ageCosts = person.year === null ? [] : peers.filter(peer => peer.year !== null)
      .map(peer => saturation(Math.abs(peer.year! - person.year!), p.yearB, p.yearH));
    const minimum = ageCosts.length ? Math.min(...ageCosts) : 0;
    const yearCost = ageCosts.length ? minimum - p.yearT * Math.log(ageCosts.reduce((sum, cost) => sum + Math.exp(-(cost - minimum) / p.yearT), 0) / ageCosts.length) : 0;
    const reunionCost = peers.reduce((sum, peer) => sum + (context.requests.has(pairKey(person.id, peer.id)) ? 0 :
      p.reunionA * (context.exposures.get(person.id)?.get(peer.id) ?? 0) ** p.reunionPower), 0);
    const attenuation = Math.exp(-p.attenuationK * requestCount);
    const utility = attenuation * (sameUtility + otherUtility - yearCost) - reunionCost;
    return { id: person.id, name: person.name, requestCount, sameUtility, otherUtility, yearCost, attenuation, reunionCost, utility };
  });
  const uncovered = members.length > 0 && !members.some(person => person.board);
  return {
    requestProduct: people.reduce((product, person) => product * BigInt(1 + person.requestCount), 1n),
    requestScore: people.reduce((sum, person) => sum + Math.log1p(person.requestCount), 0),
    boardMissing: Number(uncovered), boardMissingNonFour: Number(uncovered && ids.length !== 4),
    totalUtility: people.reduce((sum, person) => sum + person.utility, 0), ...protectPeople(people, p),
  };
}

export function combineScores(scores: AssignmentScore[], parameters: UtilityParameters = REVIEW_PARAMETERS): AssignmentScore {
  const total = scores.reduce((total, score) => ({
    requestProduct: total.requestProduct * score.requestProduct,
    requestScore: total.requestScore + score.requestScore,
    boardMissing: total.boardMissing + score.boardMissing,
    boardMissingNonFour: total.boardMissingNonFour + score.boardMissingNonFour,
    totalUtility: total.totalUtility + score.totalUtility,
    people: [...total.people, ...score.people],
  }), { requestProduct: 1n, requestScore: 0, boardMissing: 0, boardMissingNonFour: 0, totalUtility: 0, people: [] as PersonScore[] });
  // Cached group evaluations contain local decompositions; always recompute
  // protection from ALL raw personal utilities, including untouched groups.
  total.people.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { ...total, ...protectPeople(total.people, parameters) };
}

// Negative means a is preferred; explicit requests cannot be outweighed.
export function compareUtility(a: AssignmentScore, b: AssignmentScore): number {
  if (a.requestProduct !== b.requestProduct) return a.requestProduct > b.requestProduct ? -1 : 1;
  return a.boardMissing - b.boardMissing || a.boardMissingNonFour - b.boardMissingNonFour || b.welfare - a.welfare;
}

export function getRequestNotices(groups: SessionGroup[], context: UtilityContext, fixed: Record<string, string> = {}, relevantIds?: string[]): string[] {
  const assigned = new Map(groups.flatMap(group => group.memberIds.map(id => [id, group.id] as const)));
  const relevant = relevantIds ? new Set(relevantIds) : null;
  const notices = context.absentRequests.filter(r => !relevant || relevant.has(r.requesterId))
    .map(r => `${r.requester}님이 요청한 ${r.recipient}님은 불참하여 동반 요청 평가에서 제외했습니다.`);
  for (const [a, b] of context.requests.values()) {
    if (relevant && !relevant.has(a) && !relevant.has(b)) continue;
    if (assigned.has(a) && assigned.get(a) === assigned.get(b)) continue;
    const names = `${context.people.get(a)!.name}님과 ${context.people.get(b)!.name}님`;
    const pinnedApart = fixed[a] && fixed[b] && fixed[a] !== fixed[b] && assigned.get(a) === fixed[a] && assigned.get(b) === fixed[b];
    notices.push(pinnedApart ? `동반 요청 미충족: ${names}은 수동 배치를 유지하여 서로 다른 조에 배치되었습니다.` :
      `동반 요청 미충족: ${names}이 현재 같은 조에 배치되지 않았습니다.`);
  }
  return notices;
}
