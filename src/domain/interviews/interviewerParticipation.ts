import type { InterviewSchedule, InterviewScheduleInterviewer } from "../../types";

export function countActiveInterviewerSchedules(
  interviewerId: string,
  participants: ReadonlyArray<
    Pick<InterviewScheduleInterviewer, "interviewerId" | "scheduleId" | "active">
  >,
  schedules: ReadonlyArray<Pick<InterviewSchedule, "id" | "status">>,
): number {
  const activeScheduleIds = new Set(
    schedules
      .filter((schedule) => schedule.status !== "archived")
      .map((schedule) => schedule.id),
  );
  return new Set(
    participants
      .filter(
        (participant) =>
          participant.active &&
          participant.interviewerId === interviewerId &&
          activeScheduleIds.has(participant.scheduleId),
      )
      .map((participant) => participant.scheduleId),
  ).size;
}
