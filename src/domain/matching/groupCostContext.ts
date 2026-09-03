import type { Attendee, Member, Session } from '../../types';
import { getMemberFromAttendee } from './getMemberFromAttendee';
import { getActivity, getExperience, getStudentYear, type CostCalculationContext } from './groupCostFunction';
import { getParticipationHistory } from './participationHistory';

interface GroupCostContextInput {
  attendees: Attendee[];
  members: Member[];
  /** Newest first, matching the attendance page's session query. */
  sessions: Session[];
  assignmentDate: string;
}

/** Shared inputs for assignment, simulation export, and the score breakdown. */
export function buildGroupCostContext({
  attendees,
  members,
  sessions,
  assignmentDate,
}: GroupCostContextInput): CostCalculationContext {
  const matchedAttendees = attendees.map(attendee => ({
    attendee,
    member: getMemberFromAttendee(members, attendee.name, attendee.studentIdPrefix),
  }));
  const attendingMembers = matchedAttendees
    .map(({ member }) => member)
    .filter((member): member is Member => Boolean(member));
  const overallGenderRatio = attendingMembers.filter(member => member.gender === '여').length / (attendingMembers.length || 1);
  const years = attendingMembers.map(getStudentYear);
  const averageYear = years.reduce((sum, year) => sum + year, 0) / (years.length || 1);
  const vPool = years.reduce((sum, year) => sum + Math.pow(year - averageYear, 2), 0) / (years.length || 1);

  const participationHistory = getParticipationHistory(attendingMembers, sessions, assignmentDate);
  const memberExperience: Record<string, number> = {};
  const memberActivity: Record<string, number> = {};
  attendingMembers.forEach(member => {
    memberExperience[member.id] = getExperience(participationHistory.attendanceCounts[member.id] || 0);
    memberActivity[member.id] = getActivity(
      participationHistory.currentSemesterAttendanceCounts[member.id] || 0,
      participationHistory.currentSemesterOpportunityCounts[member.id] || 0
    );
  });
  const overallExperienceAverage = attendingMembers.length > 0
    ? attendingMembers.reduce((sum, member) => sum + memberExperience[member.id]!, 0) / attendingMembers.length
    : 0;
  const overallActivityAverage = attendingMembers.length > 0
    ? attendingMembers.reduce((sum, member) => sum + memberActivity[member.id]!, 0) / attendingMembers.length
    : 0.5;

  // Reunion warnings and scoring use the latest recorded sessions, independently
  // of the assignment-date cutoff used for participation experience/activity.
  const memberPairRecentCounts: Record<string, number> = {};
  const memberPairLastSession: Record<string, boolean> = {};
  sessions.slice(0, 3).forEach((session, index) => {
    session.groups.forEach(group => {
      for (let i = 0; i < group.memberIds.length; i++) {
        for (let j = i + 1; j < group.memberIds.length; j++) {
          const pair = [group.memberIds[i], group.memberIds[j]].sort().join('|');
          memberPairRecentCounts[pair] = (memberPairRecentCounts[pair] || 0) + 1;
          if (index === 0) memberPairLastSession[pair] = true;
        }
      }
    });
  });

  const requestedPairs: { a: string; b: string }[] = [];
  matchedAttendees.forEach(({ attendee, member }) => {
    if (!attendee.request || !member) return;
    members.forEach(requestedMember => {
      if (member.id !== requestedMember.id && attendee.request.includes(requestedMember.name)) {
        requestedPairs.push({ a: member.id, b: requestedMember.id });
      }
    });
  });

  return {
    overallGenderRatio,
    vPool,
    memberExperience,
    memberActivity,
    overallExperienceAverage,
    overallActivityAverage,
    memberPairRecentCounts,
    memberPairLastSession,
    requestedPairs,
  };
}
