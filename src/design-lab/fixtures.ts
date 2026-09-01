import type {
  Attendee,
  InterviewApplicantWithAccess,
  InterviewChangeRequest,
  InterviewRound,
  InterviewRoundInterviewer,
  Member,
  SessionGroup,
} from '../types';

export type MembersScenarioState = 'default' | 'empty' | 'crowded' | 'long-names';
export type InterviewScenarioState = 'default' | 'mobile-heavy' | 'change-needed';
export type AttendanceScenarioState = 'default' | 'empty' | 'crowded';

function timestampAt(iso: string) {
  const date = new Date(iso);
  const milliseconds = date.getTime();
  return {
    seconds: Math.floor(milliseconds / 1000),
    nanoseconds: 0,
    toDate: () => new Date(milliseconds),
    toMillis: () => milliseconds,
    isEqual: (other: { toMillis(): number }) => other.toMillis() === milliseconds,
    valueOf: () => String(milliseconds).padStart(20, '0'),
    toJSON: () => ({ seconds: Math.floor(milliseconds / 1000), nanoseconds: 0, type: 'firestore/timestamp/1.0' }),
  } as unknown as Member['createdAt'];
}

const memberNames = ['김민준', '이서연', '박지훈', '최유진', '정도윤', '한지우', '윤서준', '송하린', '임현우', '오수빈', '강준서', '신예린'];

function makeMember(index: number, name = memberNames[index % memberNames.length] ?? `멤버 ${index + 1}`): Member {
  return {
    id: `scenario-member-${String(index + 1).padStart(2, '0')}`,
    name,
    nickname: index % 3 === 0 ? `avalon${index + 1}` : '',
    studentId: `${String(20 + (index % 6)).padStart(2, '0')}100${String(index + 1).padStart(2, '0')}`,
    phone: `010-0000-${String(index + 1).padStart(4, '0')}`,
    gender: index % 2 === 0 ? '남' : '여',
    semester: `202${4 + (index % 3)}-${index % 2 === 0 ? 1 : 2}`,
    preferredGenre: index % 2 === 0 ? ['전략', '협력'] : ['파티', '추리'],
    memo: index % 4 === 0 ? 'Scenario Lab에서만 사용하는 결정적 가짜 데이터' : '',
    isBoardMember: index === 0 || index === 7,
    status: index % 9 === 8 ? '휴면' : '활동',
    dormantSemester: index % 9 === 8 ? '2026-2' : '',
    createdAt: timestampAt('2026-01-10T09:00:00+09:00'),
  };
}

export function createMembersFixture(state: MembersScenarioState): Member[] {
  if (state === 'empty') return [];
  if (state === 'crowded') return Array.from({ length: 48 }, (_, index) => makeMember(index));
  if (state === 'long-names') {
    const names = [
      '아주긴이름을가진아발론회원',
      'Alexandria-Cassandra Montgomery',
      '김가나다라마바사아자차카타파하',
      '복합성명 테스트 사용자 주니어',
    ];
    return names.map((name, index) => makeMember(index, name));
  }
  return Array.from({ length: 8 }, (_, index) => makeMember(index));
}

function makeAttendee(index: number, member?: Member): Attendee {
  return {
    id: `scenario-attendee-${String(index + 1).padStart(2, '0')}`,
    name: member?.name ?? `비회원 참가자 ${index + 1}`,
    studentIdPrefix: member?.studentId.slice(0, 2) ?? '26',
    drink: index % 3 === 0 ? '아이스티' : '',
    afterparty: index % 2 === 0,
    request: index % 5 === 0 ? '처음 오는 사람과 같은 조를 희망해요.' : '',
    importDate: timestampAt('2026-08-27T18:00:00+09:00'),
    importId: 'scenario-import-20260827',
    status: index < 4 ? '편성됨' : '대기',
  };
}

export function createAttendanceFixture(state: AttendanceScenarioState): {
  members: Member[];
  attendees: Attendee[];
  groups: SessionGroup[];
} {
  if (state === 'empty') return { members: [], attendees: [], groups: [] };
  const size = state === 'crowded' ? 28 : 10;
  const members = Array.from({ length: size - 2 }, (_, index) => makeMember(index));
  const attendees = Array.from({ length: size }, (_, index) => makeAttendee(index, members[index]));
  const groupCount = state === 'crowded' ? 6 : 2;
  const groups = Array.from({ length: groupCount }, (_, groupIndex) => ({
    id: `scenario-group-${groupIndex + 1}`,
    name: `${groupIndex + 1}조`,
    memberIds: attendees
      .filter((_, attendeeIndex) => attendeeIndex < groupCount * 3 && attendeeIndex % groupCount === groupIndex)
      .map(attendee => attendee.id),
    gameIds: [],
    targetSize: state === 'crowded' ? 5 : 4,
  }));
  return { members, attendees, groups };
}

function slot(date: string, hour: number, minute: number) {
  return `${date}|${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function slotsForDates(dates: string[]) {
  return dates.flatMap(date => [18, 19, 20].flatMap(hour => [0, 30].map(minute => slot(date, hour, minute))));
}

function makeApplicant(index: number, round: InterviewRound, assigned: boolean, changeNeeded: boolean): InterviewApplicantWithAccess {
  const available = round.allowedSlots.filter((_, slotIndex) => (slotIndex + index) % 3 !== 0);
  const assignedSlot = round.allowedSlots[index % round.allowedSlots.length] ?? round.allowedSlots[0]!;
  const assignment = assigned ? {
    slotId: assignedSlot,
    startsAt: timestampAt(`${assignedSlot.replace('|', 'T')}:00+09:00`),
    durationMinutes: round.assignmentSlotMinutes,
    interviewerId: `scenario-interviewer-${(index % 3) + 1}`,
    interviewerName: ['김면접', '이면접', '박면접'][index % 3] ?? '면접관',
    status: changeNeeded ? 'change_requested' : (index % 4 === 0 ? 'confirmed' : 'scheduled'),
    locked: index % 4 === 0,
    source: index % 2 === 0 ? 'automatic' : 'manual',
    confirmationRevision: 1,
  } : null;
  const now = timestampAt('2026-08-27T12:00:00+09:00');
  return {
    id: `scenario-applicant-${String(index + 1).padStart(2, '0')}`,
    roundId: round.id,
    scheduleId: 'scenario-schedule-01',
    applicantNumber: `A-${String(index + 1).padStart(3, '0')}`,
    name: ['김도윤', '이하은', '박서준', '최민서', '정하준', '윤지아', '한시우', '송채원'][index % 8] ?? `지원자 ${index + 1}`,
    phone: `010-1000-${String(index + 1).padStart(4, '0')}`,
    applicationData: [{ header: '지원 동기', value: '보드게임과 좋은 사람들을 만나고 싶습니다.' }],
    accessToken: `scenario-token-${index + 1}`,
    sourceRowNumber: index + 2,
    source: 'csv',
    lifecycle: 'active',
    applicationStatus: 'active',
    archivedAt: null,
    archivedReason: null,
    availabilityMessage: { firstMarkedSentAt: now, lastMarkedSentAt: now },
    confirmationMessage: assignment?.status === 'confirmed'
      ? { firstMarkedSentAt: now, lastMarkedSentAt: now, assignmentRevision: 1 }
      : { firstMarkedSentAt: null, lastMarkedSentAt: null },
    assignment,
    assignmentRevision: assignment ? 1 : 0,
    interviewStatus: changeNeeded ? 'action_needed' : 'scheduled',
    selectionStatus: 'pending',
    createdAt: now,
    updatedAt: now,
    access: {
      id: `scenario-access-${index + 1}`,
      roundId: round.id,
      scheduleId: 'scenario-schedule-01',
      applicantId: `scenario-applicant-${String(index + 1).padStart(2, '0')}`,
      displayName: `지원자 ${index + 1}`,
      availability: available,
      submittedAt: now,
      updatedAt: now,
      active: true,
      changeRequestStatus: changeNeeded ? 'open' : 'none',
      createdAt: now,
    },
    link: `/interview/scenario-token-${index + 1}`,
  } as unknown as InterviewApplicantWithAccess;
}

export function createInterviewFixture(state: InterviewScenarioState): {
  round: InterviewRound;
  applicants: InterviewApplicantWithAccess[];
  interviewers: InterviewRoundInterviewer[];
  changeRequests: InterviewChangeRequest[];
} {
  const dates = state === 'mobile-heavy'
    ? ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']
    : ['2026-09-01', '2026-09-02', '2026-09-03'];
  const now = timestampAt('2026-08-27T12:00:00+09:00');
  const allowedSlots = slotsForDates(dates);
  const round = {
    id: 'scenario-round-2026-2',
    name: '2026년 2학기 신입부원 면접',
    surveyOpensAt: timestampAt('2026-08-20T00:00:00+09:00'),
    surveyClosesAt: timestampAt('2026-08-31T23:59:00+09:00'),
    interviewDates: dates,
    dayStartTime: '18:00',
    dayEndTime: '21:00',
    availabilitySlotMinutes: 30,
    assignmentSlotMinutes: 30,
    status: 'interviewing',
    instructions: '가능한 시간을 모두 선택해주세요.',
    messageTemplates: { availability: '', reminder: '', confirmation: '', reschedule: '', selected: '', rejected: '' },
    interviewQuestions: [],
    allowedSlots,
    daySchedules: dates.map(date => ({ date, startTime: '18:00', endTime: '21:00' })),
    timeZone: 'Asia/Seoul',
    scheduleRevision: 1,
    schemaVersion: 2,
    createdAt: now,
    updatedAt: now,
  } satisfies InterviewRound;
  const applicantCount = state === 'mobile-heavy' ? 180 : 7;
  const applicants = Array.from({ length: applicantCount }, (_, index) =>
    makeApplicant(index, round, index < applicantCount - 3, state === 'change-needed' && index === 1));
  const interviewers = Array.from({ length: 3 }, (_, index) => ({
    id: `scenario-round-interviewer-${index + 1}`,
    roundId: round.id,
    interviewerId: `scenario-interviewer-${index + 1}`,
    displayName: ['김면접', '이면접', '박면접'][index] ?? `면접관 ${index + 1}`,
    email: `interviewer${index + 1}@scenario.invalid`,
    phone: null,
    availability: allowedSlots.filter((_, slotIndex) => (slotIndex + index) % 4 !== 0),
    active: true,
    createdAt: now,
    updatedAt: now,
  })) satisfies InterviewRoundInterviewer[];
  const changeRequests = state === 'change-needed' ? [{
    id: 'scenario-change-request-01',
    roundId: round.id,
    scheduleId: 'scenario-schedule-01',
    applicantId: applicants[1]!.id,
    applicantName: applicants[1]!.name,
    status: 'open',
    reason: '수업 일정 변경으로 다른 시간대가 필요합니다.',
    requestedAt: now,
    resolvedAt: null,
    resolvedBy: null,
  } satisfies InterviewChangeRequest] : [];
  return { round, applicants, interviewers, changeRequests };
}
