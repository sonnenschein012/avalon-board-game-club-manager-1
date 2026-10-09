import type { Attendee, Member } from '../../types';

export interface RequestCandidate {
  id: string;
  name: string;
  studentId: string;
  nickname: string;
  memberId: string | null;
}
export interface RequestChoice {
  key: string;
  signature: string;
  requesterId: string;
  requester: string;
  request: string;
  mention: string;
  candidates: RequestCandidate[];
  selectedId: string | null;
}
export type RequestSelections = Record<string, { signature: string; recipientId: string | null }>;
export interface AbsentRequest { requesterId: string; requester: string; recipient: string }

export function isRequestSelections(value: unknown): value is RequestSelections {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) &&
    Object.values(value).every(selection => selection && typeof selection === 'object' &&
      typeof selection.signature === 'string' && (selection.recipientId === null || typeof selection.recipientId === 'string')));
}

/** Resolve names once for scoring and both automatic/manual attendance views.
 * Full and given names use substring matching without word/particle restrictions.
 * Given names are derived from three-character Korean names, and never from a full-name match.
 */
export function resolveCompanionRequests(input: {
  attendees: Attendee[]; members: Member[]; memberToAttendee: Map<string, string>;
  assignmentDate: string; selections?: RequestSelections;
}) {
  const { attendees, members, memberToAttendee, assignmentDate, selections = {} } = input;
  const attendeeToMember = new Map([...memberToAttendee].map(([memberId, id]) => [id, members.find(member => member.id === memberId)!]));
  const active = attendees.filter(attendee => attendee.status !== '결석').map((attendee): RequestCandidate => {
    const member = attendeeToMember.get(attendee.id);
    return { id: attendee.id, name: member?.name ?? attendee.name, studentId: member?.studentId ?? attendee.studentIdPrefix ?? '',
      nickname: member?.nickname ?? '', memberId: member?.id ?? null };
  });
  const fullNames = [...new Set([...members.map(member => member.name), ...active.map(candidate => candidate.name)])].filter(Boolean);
  const requests: [string, string][] = [];
  const absentRequests: AbsentRequest[] = [];
  const choices: RequestChoice[] = [];
  for (const attendee of attendees) {
    const requester = attendeeToMember.get(attendee.id);
    if (!requester || !attendee.request) continue;
    const spans: { start: number; end: number }[] = [];
    const mentions = new Map<string, RequestCandidate[]>();
    for (const name of fullNames) {
      let start = attendee.request.indexOf(name);
      if (start < 0) continue;
      while (start >= 0) {
        spans.push({ start, end: start + name.length });
        start = attendee.request.indexOf(name, start + name.length);
      }
      const candidates = active.filter(candidate => candidate.id !== attendee.id && candidate.name === name);
      if (candidates.length) mentions.set(name, candidates);
      else if (name !== requester.name && members.some(member => member.name === name)) {
        absentRequests.push({ requesterId: attendee.id, requester: requester.name, recipient: name });
      }
    }
    const givenNames = [...new Set(active.filter(candidate => candidate.id !== attendee.id && /^[가-힣]{3}$/.test(candidate.name))
      .map(candidate => candidate.name.slice(1)))];
    for (const name of givenNames) {
      let start = attendee.request.indexOf(name);
      let found = false;
      while (start >= 0) {
        if (!spans.some(span => start < span.end && start + name.length > span.start)) {
          found = true;
          break;
        }
        start = attendee.request.indexOf(name, start + name.length);
      }
      if (found && !mentions.has(name)) mentions.set(name, active.filter(candidate => candidate.id !== attendee.id && candidate.name.slice(1) === name && /^[가-힣]{3}$/.test(candidate.name)));
    }
    for (const [mention, candidates] of mentions) {
      candidates.sort((a, b) => a.name.localeCompare(b.name) || a.studentId.localeCompare(b.studentId) || a.id.localeCompare(b.id));
      const key = JSON.stringify([attendee.id, mention]);
      const signature = JSON.stringify([assignmentDate, attendee.request, requester.id,
        candidates.map(candidate => [candidate.id, candidate.memberId, candidate.name, candidate.studentId])]);
      const selection = Object.hasOwn(selections, key) ? selections[key] : undefined;
      if (candidates.length > 1 || selection) {
        const selectedId = selection?.signature === signature && candidates.some(candidate => candidate.id === selection.recipientId && candidate.memberId)
          ? selection.recipientId : null;
        choices.push({ key, signature, requesterId: attendee.id, requester: requester.name, request: attendee.request, mention, candidates, selectedId });
        if (selectedId) requests.push([attendee.id, selectedId]);
      } else if (candidates[0]!.memberId) requests.push([attendee.id, candidates[0]!.id]);
    }
  }
  return { requests, absentRequests, choices };
}
