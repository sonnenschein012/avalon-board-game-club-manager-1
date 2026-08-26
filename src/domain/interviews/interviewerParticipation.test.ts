import { describe, expect, it } from "vitest";
import { countActiveInterviewerSchedules } from "./interviewerParticipation";

describe("interviewer participation summary", () => {
  const schedules = [
    { id: "active-1", status: "draft" as const },
    { id: "active-2", status: "interviewing" as const },
    { id: "archived", status: "archived" as const },
  ];

  it("counts active schedule participation without requiring applicant assignments", () => {
    expect(
      countActiveInterviewerSchedules(
        "interviewer-1",
        [
          { interviewerId: "interviewer-1", scheduleId: "active-1", active: true },
          { interviewerId: "interviewer-1", scheduleId: "active-2", active: true },
        ],
        schedules,
      ),
    ).toBe(2);
  });

  it("excludes inactive participation and archived schedules", () => {
    expect(
      countActiveInterviewerSchedules(
        "interviewer-1",
        [
          { interviewerId: "interviewer-1", scheduleId: "active-1", active: false },
          { interviewerId: "interviewer-1", scheduleId: "archived", active: true },
          { interviewerId: "interviewer-2", scheduleId: "active-2", active: true },
        ],
        schedules,
      ),
    ).toBe(0);
  });
});
