import { Member, Session } from '../../types';
import { getLocalDateKey } from '../attendance/sessionMetadata';
import { getSemester } from '../semester/getSemester';
import { isMemberActiveAtSemester } from '../stats/getSemesterRosterCounts';

export interface ParticipationHistory {
  attendanceCounts: Record<string, number>;
  currentSemesterAttendanceCounts: Record<string, number>;
  currentSemesterOpportunityCounts: Record<string, number>;
}

/**
 * Builds attendance inputs known strictly before the session being assigned.
 * A same-day saved session is intentionally excluded, as are future sessions.
 */
export function getParticipationHistory(
  members: Member[],
  sessions: Session[],
  assignmentDate: string
): ParticipationHistory {
  const attendanceCounts: Record<string, number> = {};
  const currentSemesterAttendanceCounts: Record<string, number> = {};
  const currentSemesterOpportunityCounts: Record<string, number> = {};
  const currentSemester = getSemester(assignmentDate);

  members.forEach(member => {
    attendanceCounts[member.id] = 0;
    currentSemesterAttendanceCounts[member.id] = 0;
    currentSemesterOpportunityCounts[member.id] = 0;
  });

  const pastSessions = sessions.filter(session => {
    const date = session.date?.toDate?.();
    return Boolean(date && !Number.isNaN(date.getTime()) && getLocalDateKey(date) < assignmentDate);
  });

  pastSessions.forEach(session => {
    session.groups.forEach(group => {
      group.memberIds.forEach(memberId => {
        if (attendanceCounts[memberId] !== undefined) attendanceCounts[memberId]++;
      });
    });
  });

  const currentSemesterPastSessions = pastSessions.filter(session => getSemester(session.date) === currentSemester);
  members.forEach(member => {
    if (!isMemberActiveAtSemester(member, currentSemester)) return;

    const joinedAt = member.createdAt?.toMillis?.();
    const eligibleSessions = currentSemesterPastSessions.filter(session => {
      const sessionAt = session.date?.toMillis?.();
      return !Number.isFinite(joinedAt) || !Number.isFinite(sessionAt) || sessionAt >= joinedAt!;
    });

    currentSemesterOpportunityCounts[member.id] = eligibleSessions.length;
    currentSemesterAttendanceCounts[member.id] = eligibleSessions.reduce((count, session) => (
      count + (session.groups.some(group => group.memberIds.includes(member.id)) ? 1 : 0)
    ), 0);
  });

  return { attendanceCounts, currentSemesterAttendanceCounts, currentSemesterOpportunityCounts };
}
