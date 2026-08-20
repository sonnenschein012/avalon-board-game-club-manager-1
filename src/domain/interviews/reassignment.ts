import { availabilityToAssignmentCandidates, parseSlotId } from './scheduling';

export interface ReassignmentApplicant {
  id: string;
  availability: string[];
  current?: { slotId: string; interviewerId: string } | null;
}

export interface ReassignmentInterviewer {
  id: string;
  name: string;
  availability: string[];
}

export interface ReassignmentRecommendation {
  slotId: string;
  interviewerId: string;
  interviewerName: string;
  changesOtherAssignments: false;
}

function slotMinutes(slotId: string): number {
  const parsed = parseSlotId(slotId);
  if (!parsed) return Number.MAX_SAFE_INTEGER;
  const [hour = '0', minute = '0'] = parsed.time.split(':');
  return new Date(`${parsed.date}T00:00:00+09:00`).getTime() / 60_000 + Number(hour) * 60 + Number(minute);
}

export function recommendReassignment(
  applicant: ReassignmentApplicant,
  interviewers: readonly ReassignmentInterviewer[],
  occupied: ReadonlySet<string>,
  availabilitySlotMinutes: number,
  assignmentSlotMinutes: number,
): ReassignmentRecommendation[] {
  const applicantSlots = new Set(availabilityToAssignmentCandidates(applicant.availability, availabilitySlotMinutes, assignmentSlotMinutes));
  const currentMinutes = applicant.current ? slotMinutes(applicant.current.slotId) : 0;
  return interviewers.flatMap(interviewer => availabilityToAssignmentCandidates(interviewer.availability, availabilitySlotMinutes, assignmentSlotMinutes)
    .filter(slotId => applicantSlots.has(slotId) && !occupied.has(`${interviewer.id}|${slotId}`))
    .map(slotId => ({ slotId, interviewerId: interviewer.id, interviewerName: interviewer.name, changesOtherAssignments: false as const })))
    .sort((left, right) => {
      const leftSameDay = applicant.current && parseSlotId(left.slotId)?.date === parseSlotId(applicant.current.slotId)?.date ? 0 : 1;
      const rightSameDay = applicant.current && parseSlotId(right.slotId)?.date === parseSlotId(applicant.current.slotId)?.date ? 0 : 1;
      return leftSameDay - rightSameDay
        || Math.abs(slotMinutes(left.slotId) - currentMinutes) - Math.abs(slotMinutes(right.slotId) - currentMinutes)
        || left.slotId.localeCompare(right.slotId)
        || left.interviewerName.localeCompare(right.interviewerName);
    });
}

export function candidatesForVacatedSlot(
  slotId: string,
  interviewerId: string,
  applicants: readonly ReassignmentApplicant[],
  availabilitySlotMinutes: number,
  assignmentSlotMinutes: number,
): string[] {
  return applicants.filter(applicant => {
    if (applicant.current?.slotId === slotId && applicant.current.interviewerId === interviewerId) return false;
    return availabilityToAssignmentCandidates(applicant.availability, availabilitySlotMinutes, assignmentSlotMinutes).includes(slotId);
  }).map(applicant => applicant.id);
}
