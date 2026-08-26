/*
 * Destructive demo seed for the local Firestore emulator only.
 *
 * Example:
 *   $env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
 *   $env:GCLOUD_PROJECT='demo-avalon-manager'
 *   node scripts/seed-demo.mjs
 */

const EXPECTED_EMULATOR_HOST = '127.0.0.1:8080';
const EXPECTED_PROJECT_ID = 'demo-avalon-manager';

function firebaseConfigProjectId() {
  const raw = process.env.FIREBASE_CONFIG;
  if (!raw?.trim().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed.projectId === 'string' ? parsed.projectId.trim() : null;
  } catch {
    return null;
  }
}

const declaredProjectIds = [
  process.env.GCLOUD_PROJECT,
  process.env.GOOGLE_CLOUD_PROJECT,
  firebaseConfigProjectId(),
].map(value => value?.trim()).filter(Boolean);

if (
  process.env.FIRESTORE_EMULATOR_HOST !== EXPECTED_EMULATOR_HOST
  || declaredProjectIds.length === 0
  || declaredProjectIds.some(projectId => projectId !== EXPECTED_PROJECT_ID)
) {
  throw new Error(
    `Refusing destructive seed. FIRESTORE_EMULATOR_HOST must be ${EXPECTED_EMULATOR_HOST} `
    + `and every declared projectId must be ${EXPECTED_PROJECT_ID}.`,
  );
}

const [{ initializeApp }, { getFirestore, Timestamp }] = await Promise.all([
  import('firebase-admin/app'),
  import('firebase-admin/firestore'),
]);

initializeApp({ projectId: EXPECTED_PROJECT_ID });
const db = getFirestore();

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const now = new Date();
const nowTimestamp = Timestamp.fromDate(now);

function kstParts(date = now) {
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function kstDateKey(dayOffset = 0) {
  const current = kstParts();
  const shifted = new Date(Date.UTC(current.year, current.month - 1, current.day + dayOffset));
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, '0'),
    String(shifted.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function kstDate(dayOffset = 0, time = '12:00') {
  return new Date(`${kstDateKey(dayOffset)}T${time}:00+09:00`);
}

function timestamp(dayOffset = 0, time = '12:00') {
  return Timestamp.fromDate(kstDate(dayOffset, time));
}

function semesterForDate(date = now) {
  const { year, month } = kstParts(date);
  if (month >= 3 && month <= 8) return `${year}-1`;
  if (month >= 9) return `${year}-2`;
  return `${year - 1}-2`;
}

function previousSemester(semester) {
  const [yearText, term] = semester.split('-');
  const year = Number(yearText);
  return term === '2' ? `${year}-1` : `${year - 1}-2`;
}

function slotsForDates(dates, startTime, endTime, slotMinutes = 30) {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return dates.flatMap(date => {
    const result = [];
    for (let minute = start; minute < end; minute += slotMinutes) {
      result.push(`${date}|${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`);
    }
    return result;
  });
}

function slot(date, time) {
  return `${date}|${time}`;
}

function assignmentLockId(roundId, interviewerId, slotId) {
  return [roundId, interviewerId, slotId].map(encodeURIComponent).join('__');
}

function applicantKeyId(roundId, applicantNumber) {
  return [roundId, applicantNumber.normalize('NFKC').trim().replace(/\s+/g, ' ').toUpperCase()]
    .map(encodeURIComponent)
    .join('__');
}

const currentSemester = semesterForDate();
const previousTerm = previousSemester(currentSemester);
const twoTermsAgo = previousSemester(previousTerm);
const todayKey = kstDateKey();
// MeetingProgress uses an ISO/UTC date key for its initial selection.
const planningDateKey = now.toISOString().slice(0, 10);

const members = [
  { id: 'member-01', name: '김민준', nickname: '민준', studentId: '20201234', phone: '010-2100-1001', gender: '남', semester: twoTermsAgo, preferredGenre: ['전략', '협상'], memo: '운영진 · 전략 게임 설명 가능', isBoardMember: true, status: '활동' },
  { id: 'member-02', name: '이서윤', nickname: '서윤', studentId: '20211235', phone: '010-2100-1002', gender: '여', semester: twoTermsAgo, preferredGenre: ['파티', '추리'], memo: '', isBoardMember: true, status: '활동' },
  { id: 'member-03', name: '박지호', nickname: '지호', studentId: '20221236', phone: '010-2100-1003', gender: '남', semester: previousTerm, preferredGenre: ['전략', '타일'], memo: '', isBoardMember: false, status: '활동' },
  { id: 'member-04', name: '최유진', nickname: '유진', studentId: '20221237', phone: '010-2100-1004', gender: '여', semester: previousTerm, preferredGenre: ['협력', '퍼즐'], memo: '', isBoardMember: false, status: '활동' },
  { id: 'member-05', name: '정다은', nickname: '다은', studentId: '20231238', phone: '010-2100-1005', gender: '여', semester: previousTerm, preferredGenre: ['카드', '파티'], memo: '신입 안내 도우미', isBoardMember: false, status: '활동' },
  { id: 'member-06', name: '오현우', nickname: '현우', studentId: '20231239', phone: '010-2100-1006', gender: '남', semester: previousTerm, preferredGenre: ['전략', '타이쿤'], memo: '', isBoardMember: false, status: '활동' },
  { id: 'member-07', name: '한수빈', nickname: '수빈', studentId: '20241240', phone: '010-2100-1007', gender: '여', semester: currentSemester, preferredGenre: ['마피아', '심리'], memo: '', isBoardMember: false, status: '활동' },
  { id: 'member-08', name: '윤도현', nickname: '도현', studentId: '20241241', phone: '010-2100-1008', gender: '남', semester: currentSemester, preferredGenre: ['전략', '주사위'], memo: '', isBoardMember: false, status: '활동' },
  { id: 'member-09', name: '강하린', nickname: '하린', studentId: '20251242', phone: '010-2100-1009', gender: '여', semester: currentSemester, preferredGenre: ['그림', '단어'], memo: '', isBoardMember: false, status: '활동' },
  { id: 'member-10', name: '장예린', nickname: '예린', studentId: '20261243', phone: '010-2100-1010', gender: '여', semester: currentSemester, preferredGenre: ['카드', '타일'], memo: '면접 선발 후 등록', isBoardMember: false, status: '활동', registrationSource: { roundId: 'demo-round', applicantId: 'applicant-014' } },
  { id: 'member-11', name: '임재현', nickname: '재현', studentId: '20211244', phone: '010-2100-1011', gender: '남', semester: twoTermsAgo, preferredGenre: ['경매', '전략'], memo: '', isBoardMember: false, status: '휴면', dormantSemester: currentSemester },
  { id: 'member-12', name: '문소희', nickname: '소희', studentId: '20221245', phone: '010-2100-1012', gender: '기타', semester: twoTermsAgo, preferredGenre: ['협력', '퀴즈'], memo: '', isBoardMember: false, status: '휴면', dormantSemester: previousTerm },
].map((member, index) => ({
  ...member,
  dormantSemester: member.dormantSemester ?? '',
  createdAt: timestamp(-400 + index * 14),
}));

const games = [
  { id: 'game-splendor', title: '스플렌더', minPlayers: 2, maxPlayers: 4, bestMinPlayers: 3, bestMaxPlayers: 4, complexity: 1.8, genres: ['카드', '전략'], memo: '입문 전략 게임' },
  { id: 'game-avalon', title: '레지스탕스 아발론', minPlayers: 5, maxPlayers: 10, bestMinPlayers: 7, bestMaxPlayers: 8, complexity: 1.7, genres: ['마피아', '협상', '심리'], memo: '동아리 대표 게임' },
  { id: 'game-wingspan', title: '윙스팬', minPlayers: 1, maxPlayers: 5, bestMinPlayers: 3, bestMaxPlayers: 4, complexity: 2.5, genres: ['카드', '전략'], memo: '' },
  { id: 'game-catan', title: '카탄', minPlayers: 3, maxPlayers: 4, bestMinPlayers: 4, bestMaxPlayers: 4, complexity: 2.3, genres: ['협상', '주사위'], memo: '' },
  { id: 'game-terraforming', title: '테라포밍 마스', minPlayers: 1, maxPlayers: 5, bestMinPlayers: 3, bestMaxPlayers: 3, complexity: 3.3, genres: ['카드', '타이쿤', '전략'], memo: '장시간 전략 게임' },
  { id: 'game-codenames', title: '코드네임', minPlayers: 4, maxPlayers: 8, bestMinPlayers: 6, bestMaxPlayers: 8, complexity: 1.3, genres: ['파티', '단어'], memo: '' },
  { id: 'game-azul', title: '아줄', minPlayers: 2, maxPlayers: 4, bestMinPlayers: 2, bestMaxPlayers: 3, complexity: 1.8, genres: ['타일', '퍼즐'], memo: '' },
  { id: 'game-root', title: '루트', minPlayers: 2, maxPlayers: 4, bestMinPlayers: 4, bestMaxPlayers: 4, complexity: 3.8, genres: ['전략', '협상'], memo: '비대칭 전략' },
];

const sessionTemplates = [
  { offset: -70, games: [['game-splendor'], ['game-codenames']], members: [['member-01', 'member-03', 'member-05', 'member-07'], ['member-02', 'member-04', 'member-06', 'member-08']] },
  { offset: -56, games: [['game-avalon'], ['game-azul']], members: [['member-01', 'member-02', 'member-05', 'member-09'], ['member-03', 'member-04', 'member-07', 'member-08']] },
  { offset: -42, games: [['game-catan'], ['game-splendor']], members: [['member-02', 'member-03', 'member-06', 'member-07'], ['member-01', 'member-04', 'member-08', 'member-09']] },
  { offset: -28, games: [['game-wingspan'], ['game-codenames']], members: [['member-01', 'member-05', 'member-07', 'member-10'], ['member-02', 'member-03', 'member-08', 'member-09']] },
  { offset: -14, games: [['game-terraforming'], ['game-avalon']], members: [['member-03', 'member-05', 'member-06', 'member-10'], ['member-01', 'member-02', 'member-07', 'member-08', 'member-09']] },
  { offset: -3, games: [['game-splendor', 'game-azul'], ['game-root']], members: [['member-01', 'member-04', 'member-07', 'member-09'], ['member-02', 'member-03', 'member-05', 'member-08', 'member-10']] },
];

const sessions = sessionTemplates.map((template, index) => ({
  id: `session-${String(index + 1).padStart(2, '0')}`,
  date: timestamp(template.offset, '19:00'),
  name: `${kstDateKey(template.offset).slice(5).replace('-', '/')} 정기 모임`,
  boardMemberIds: ['member-01', 'member-02'],
  groups: template.members.map((memberIds, groupIndex) => ({
    id: `session-${index + 1}-group-${groupIndex + 1}`,
    name: `${groupIndex + 1}조`,
    memberIds,
    gameIds: template.games[groupIndex],
    notes: groupIndex === 0 && index === sessionTemplates.length - 1 ? '신입 설명을 천천히 진행' : '',
    targetSize: memberIds.length,
  })),
}));

const attendeeMembers = members.slice(0, 9);
const attendees = [
  ...attendeeMembers.map((member, index) => ({
    id: `attendee-${String(index + 1).padStart(2, '0')}`,
    name: member.name,
    studentIdPrefix: member.studentId.slice(2, 4),
    drink: ['아메리카노', '제로 콜라', '아이스티', '물'][index % 4],
    afterparty: index % 3 === 0,
    request: index === 4 ? '김민준과 같은 조를 희망해요.' : index === 7 ? '전략 게임을 해보고 싶어요.' : '',
    importDate: timestamp(0, '17:30'),
    importId: `demo-${planningDateKey}`,
    status: index < 2 ? '편성됨' : '대기',
  })),
  { id: 'attendee-guest', name: '문하늘', studentIdPrefix: '26', drink: '레몬에이드', afterparty: true, request: '처음이라 설명이 쉬운 게임을 원해요.', importDate: timestamp(0, '17:31'), importId: `demo-${planningDateKey}`, status: '대기' },
];

const dailyPlanning = {
  name: `${planningDateKey.slice(5).replace('-', '/')} 정기 모임`,
  date: planningDateKey,
  createdAt: nowTimestamp,
  groups: [
    { id: 'today-group-1', name: '원탁 1조', memberIds: ['member-01', 'member-04', 'member-07'], gameIds: ['game-splendor'], notes: '', targetSize: 3 },
    { id: 'today-group-2', name: '원탁 2조', memberIds: ['member-02', 'member-05', 'member-08'], gameIds: ['game-codenames'], notes: '파티 게임 우선', targetSize: 3 },
    { id: 'today-group-3', name: '원탁 3조', memberIds: ['member-03', 'member-06', 'member-09'], gameIds: ['game-catan'], notes: '', targetSize: 3 },
  ],
};

const roundId = 'demo-round';
const openScheduleId = 'demo-schedule-open';
const closedScheduleId = 'demo-schedule-closed';
const finishedScheduleId = 'demo-schedule-finished';
const openDates = [kstDateKey(2), kstDateKey(3)];
const closedDates = [kstDateKey(5), kstDateKey(6)];
const finishedDates = [kstDateKey(-10), kstDateKey(-9)];
const openSlots = slotsForDates(openDates, '18:00', '21:00');
const closedSlots = slotsForDates(closedDates, '13:00', '17:00');
const finishedSlots = slotsForDates(finishedDates, '18:00', '20:00');

const messageTemplates = {
  availability: '{name} 님, {deadline}까지 가능한 시간을 선택해주세요.\n{link}',
  reminder: '{name} 님, 면접 가능시간 응답을 부탁드립니다.\n{link}',
  confirmation: '{name} 님의 면접은 {interviewDate} {interviewTime}, 담당 {interviewerName}입니다.',
  reschedule: '{name} 님의 면접이 {oldInterviewDate} {oldInterviewTime}에서 {interviewDate} {interviewTime}으로 변경되었습니다.',
};

const interviewQuestions = [
  { id: 'question-motivation', text: '아발론에 지원한 동기와 기대하는 활동은 무엇인가요?' },
  { id: 'question-games', text: '가장 좋아하는 보드게임과 그 이유를 알려주세요.' },
  { id: 'question-activity', text: '학기 중 참여 가능한 빈도와 협업 경험을 이야기해주세요.' },
];

function daySchedules(dates, startTime, endTime) {
  return dates.map(date => ({ date, startTime, endTime }));
}

const round = {
  name: '2026년 2학기 신입부원 면접 · 로컬 데모',
  surveyOpensAt: timestamp(-7, '09:00'),
  surveyClosesAt: timestamp(1, '23:59'),
  interviewDates: [...openDates, ...closedDates],
  dayStartTime: '18:00',
  dayEndTime: '21:00',
  availabilitySlotMinutes: 30,
  assignmentSlotMinutes: 30,
  status: 'collecting',
  instructions: '가능한 칸을 모두 선택해주세요. 선택한 시간 중 실제 면접 시간을 안내드립니다.',
  messageTemplates,
  interviewQuestions,
  allowedSlots: openSlots,
  daySchedules: daySchedules(openDates, '18:00', '21:00'),
  timeZone: 'Asia/Seoul',
  scheduleRevision: 1,
  schemaVersion: 2,
  createdAt: timestamp(-14),
  updatedAt: nowTimestamp,
};

const publicRound = {
  name: round.name,
  surveyOpensAt: round.surveyOpensAt,
  surveyClosesAt: round.surveyClosesAt,
  interviewDates: round.interviewDates,
  dayStartTime: round.dayStartTime,
  dayEndTime: round.dayEndTime,
  availabilitySlotMinutes: round.availabilitySlotMinutes,
  status: round.status,
  instructions: round.instructions,
  allowedSlots: round.allowedSlots,
  active: true,
  daySchedules: round.daySchedules,
  timeZone: 'Asia/Seoul',
  scheduleRevision: round.scheduleRevision,
  schemaVersion: 2,
  updatedAt: nowTimestamp,
};

function makeSchedule({ id, name, order, status, dates, startTime, endTime, allowedSlots, opensAt, closesAt }) {
  const common = {
    roundId,
    name,
    order,
    status,
    surveyOpensAt: opensAt,
    surveyClosesAt: closesAt,
    interviewDates: dates,
    dayStartTime: startTime,
    dayEndTime: endTime,
    availabilitySlotMinutes: 30,
    assignmentSlotMinutes: 30,
    instructions: round.instructions,
    allowedSlots,
    daySchedules: daySchedules(dates, startTime, endTime),
    timeZone: 'Asia/Seoul',
    scheduleRevision: 1,
    schemaVersion: 1,
    createdAt: timestamp(-14 + order),
    updatedAt: nowTimestamp,
  };
  return {
    id,
    admin: common,
    public: {
      roundId,
      surveyOpensAt: common.surveyOpensAt,
      surveyClosesAt: common.surveyClosesAt,
      interviewDates: dates,
      dayStartTime: startTime,
      dayEndTime: endTime,
      availabilitySlotMinutes: 30,
      instructions: common.instructions,
      allowedSlots,
      daySchedules: common.daySchedules,
      timeZone: 'Asia/Seoul',
      scheduleRevision: 1,
      active: status !== 'finished' && status !== 'archived',
      schemaVersion: 1,
      updatedAt: nowTimestamp,
    },
  };
}

const schedules = [
  makeSchedule({ id: openScheduleId, name: '1차 평일 저녁', order: 1, status: 'collecting', dates: openDates, startTime: '18:00', endTime: '21:00', allowedSlots: openSlots, opensAt: timestamp(-2, '09:00'), closesAt: timestamp(1, '23:59') }),
  makeSchedule({ id: closedScheduleId, name: '2차 주말 오후', order: 2, status: 'interviewing', dates: closedDates, startTime: '13:00', endTime: '17:00', allowedSlots: closedSlots, opensAt: timestamp(-9, '09:00'), closesAt: timestamp(-1, '23:59') }),
  makeSchedule({ id: finishedScheduleId, name: '사전 면접 완료', order: 3, status: 'finished', dates: finishedDates, startTime: '18:00', endTime: '20:00', allowedSlots: finishedSlots, opensAt: timestamp(-20, '09:00'), closesAt: timestamp(-12, '23:59') }),
];

const interviewerProfiles = [
  { id: 'demo-interviewer-1', name: '김민준', email: 'demo.admin@avalon.local', phone: '010-3100-2001', active: true },
  { id: 'demo-interviewer-2', name: '이서윤', email: null, phone: '010-3100-2002', active: true },
  { id: 'demo-interviewer-3', name: '박지호', email: 'jiho@demo.local', phone: '010-3100-2003', active: true },
  { id: 'demo-interviewer-4', name: '최유진', email: null, phone: null, active: true },
  { id: 'demo-interviewer-unassigned', name: '배정 대기 면접관', email: null, phone: null, active: true },
].map(profile => ({ ...profile, createdAt: timestamp(-20), updatedAt: nowTimestamp }));

const openAvailability = {
  'demo-interviewer-1': [slot(openDates[0], '18:00'), slot(openDates[0], '18:30'), slot(openDates[0], '19:30'), slot(openDates[0], '20:00'), slot(openDates[1], '18:00'), slot(openDates[1], '18:30'), slot(openDates[1], '19:00')],
  'demo-interviewer-2': [slot(openDates[0], '18:30'), slot(openDates[0], '19:00'), slot(openDates[0], '19:30'), slot(openDates[1], '18:30'), slot(openDates[1], '19:00'), slot(openDates[1], '19:30')],
  'demo-interviewer-3': [slot(openDates[0], '19:00'), slot(openDates[0], '20:00'), slot(openDates[1], '19:00'), slot(openDates[1], '20:00')],
  'demo-interviewer-4': [],
  'demo-interviewer-unassigned': [],
};

const closedAvailability = Object.fromEntries(interviewerProfiles.map((profile, index) => [
  profile.id,
  profile.active ? closedSlots.filter((_, slotIndex) => slotIndex % 4 === index % 4).slice(0, 5) : [],
]));
const finishedAvailability = {
  'demo-interviewer-1': [slot(finishedDates[0], '18:00'), slot(finishedDates[0], '18:30'), slot(finishedDates[1], '18:00')],
  'demo-interviewer-2': [slot(finishedDates[0], '18:30'), slot(finishedDates[0], '19:00'), slot(finishedDates[1], '18:30')],
  'demo-interviewer-3': [slot(finishedDates[0], '19:00'), slot(finishedDates[1], '19:00')],
  'demo-interviewer-4': [],
  'demo-interviewer-inactive': [],
};

const availabilityBySchedule = {
  [openScheduleId]: openAvailability,
  [closedScheduleId]: closedAvailability,
  [finishedScheduleId]: finishedAvailability,
};

function assignment({ scheduleId, slotId, interviewerId, status = 'scheduled', locked = false, source = 'automatic', revision = 1 }) {
  const schedule = schedules.find(item => item.id === scheduleId);
  const interviewer = interviewerProfiles.find(item => item.id === interviewerId);
  const [date, time] = slotId.split('|');
  return {
    scheduleId,
    scheduleName: schedule?.admin.name ?? null,
    slotId,
    startsAt: Timestamp.fromDate(new Date(`${date}T${time}:00+09:00`)),
    durationMinutes: 30,
    interviewerId,
    interviewerName: interviewer?.name ?? '면접관',
    status,
    locked,
    source,
    confirmationRevision: revision,
  };
}

function sentMessage(sentAt, assignmentRevision) {
  return {
    firstMarkedSentAt: sentAt,
    lastMarkedSentAt: sentAt,
    ...(assignmentRevision == null ? {} : { assignmentRevision }),
  };
}

function applicantApplication(name, number) {
  return [
    { header: '학번', value: `2026${String(1000 + Number(number)).slice(-4)}` },
    { header: '지원 동기', value: `${name} 지원자는 새로운 사람들과 다양한 보드게임을 즐기고 싶어 지원했습니다.` },
    { header: '선호 게임', value: Number(number) % 2 === 0 ? '전략·타일 게임' : '파티·협상 게임' },
  ];
}

const applicantDefinitions = [
  { id: 'applicant-001', number: '001', name: '최서연', token: 'demo-new', scheduleId: openScheduleId, availability: [], submittedAt: null, firstAccessedAt: null },
  { id: 'applicant-002', number: '002', name: '김도윤', token: 'demo-edit', scheduleId: openScheduleId, availability: [slot(openDates[0], '18:00'), slot(openDates[0], '18:30'), slot(openDates[0], '19:00')], submittedAt: timestamp(-1, '14:00') },
  { id: 'applicant-003', number: '003', name: '윤하린', token: 'demo-unassigned', scheduleId: null, availability: [], submittedAt: null },
  { id: 'applicant-004', number: '004', name: '박준서', token: 'demo-empty', scheduleId: openScheduleId, availability: [], submittedAt: timestamp(-1, '14:10') },
  { id: 'applicant-005', number: '005', name: '이가은', token: 'demo-no-overlap', scheduleId: openScheduleId, availability: [slot(openDates[0], '20:30')], submittedAt: timestamp(-1, '14:20') },
  { id: 'applicant-006', number: '006', name: '오수빈', token: 'demo-assigned', scheduleId: openScheduleId, availability: [slot(openDates[0], '18:00'), slot(openDates[0], '18:30')], submittedAt: timestamp(-2, '11:00'), assignment: assignment({ scheduleId: openScheduleId, slotId: slot(openDates[0], '18:00'), interviewerId: 'demo-interviewer-1', revision: 1 }) },
  { id: 'applicant-007', number: '007', name: '한지민', token: 'demo-locked', scheduleId: openScheduleId, availability: [slot(openDates[0], '18:30'), slot(openDates[0], '19:00')], submittedAt: timestamp(-2, '11:10'), assignment: assignment({ scheduleId: openScheduleId, slotId: slot(openDates[0], '18:30'), interviewerId: 'demo-interviewer-2', status: 'confirmed', locked: true, source: 'manual', revision: 2 }), assignmentRevision: 2, confirmationRevision: 2 },
  { id: 'applicant-008', number: '008', name: '송민재', token: 'demo-change', scheduleId: openScheduleId, availability: [slot(openDates[0], '19:00'), slot(openDates[0], '20:00')], submittedAt: timestamp(-2, '11:20'), assignment: assignment({ scheduleId: openScheduleId, slotId: slot(openDates[0], '19:00'), interviewerId: 'demo-interviewer-3', status: 'change_requested', revision: 1 }), interviewStatus: 'action_needed', actionNeededReason: '수업 시간과 겹쳐 일정 변경 요청', changeRequestStatus: 'open' },
  { id: 'applicant-009', number: '009', name: '강예린', token: 'demo-old-notice', scheduleId: openScheduleId, availability: [slot(openDates[1], '18:00'), slot(openDates[1], '18:30')], submittedAt: timestamp(-2, '11:30'), assignment: assignment({ scheduleId: openScheduleId, slotId: slot(openDates[1], '18:00'), interviewerId: 'demo-interviewer-1', status: 'scheduled', revision: 2 }), assignmentRevision: 2, confirmationRevision: 1 },
  { id: 'applicant-010', number: '010', name: '정우진', token: 'demo-completed', scheduleId: openScheduleId, availability: [slot(openDates[0], '19:30'), slot(openDates[0], '20:00')], submittedAt: timestamp(-3, '10:00'), assignment: assignment({ scheduleId: openScheduleId, slotId: slot(openDates[0], '19:30'), interviewerId: 'demo-interviewer-1', status: 'completed', locked: true, source: 'manual', revision: 3 }), assignmentRevision: 3, confirmationRevision: 3, interviewStatus: 'completed', rating: 'strongly_recommend', selectionStatus: 'pending' },
  { id: 'applicant-011', number: '011', name: '문채원', token: 'demo-pending-neutral', scheduleId: finishedScheduleId, availability: [slot(finishedDates[0], '18:00')], submittedAt: timestamp(-13), assignment: assignment({ scheduleId: finishedScheduleId, slotId: slot(finishedDates[0], '18:00'), interviewerId: 'demo-interviewer-1', status: 'completed', locked: true, source: 'manual', revision: 1 }), interviewStatus: 'completed', rating: 'neutral', selectionStatus: 'pending' },
  { id: 'applicant-012', number: '012', name: '배서준', token: 'demo-pending-unrated', scheduleId: finishedScheduleId, availability: [slot(finishedDates[0], '18:30')], submittedAt: timestamp(-13), assignment: assignment({ scheduleId: finishedScheduleId, slotId: slot(finishedDates[0], '18:30'), interviewerId: 'demo-interviewer-2', status: 'completed', locked: true, source: 'manual', revision: 1 }), interviewStatus: 'completed', rating: null, selectionStatus: 'pending' },
  { id: 'applicant-013', number: '013', name: '신도윤', token: 'demo-selected', scheduleId: finishedScheduleId, availability: [slot(finishedDates[0], '19:00')], submittedAt: timestamp(-13), assignment: assignment({ scheduleId: finishedScheduleId, slotId: slot(finishedDates[0], '19:00'), interviewerId: 'demo-interviewer-3', status: 'completed', locked: true, source: 'manual', revision: 1 }), interviewStatus: 'completed', rating: 'recommend', selectionStatus: 'selected' },
  { id: 'applicant-014', number: '014', name: '장예린', token: 'demo-selected-member', scheduleId: finishedScheduleId, availability: [slot(finishedDates[1], '18:00')], submittedAt: timestamp(-12), assignment: assignment({ scheduleId: finishedScheduleId, slotId: slot(finishedDates[1], '18:00'), interviewerId: 'demo-interviewer-1', status: 'completed', locked: true, source: 'manual', revision: 1 }), interviewStatus: 'completed', rating: 'strongly_recommend', selectionStatus: 'selected', memberId: 'member-10' },
  { id: 'applicant-015', number: '015', name: '조하늘', token: 'demo-rejected', scheduleId: finishedScheduleId, availability: [slot(finishedDates[1], '18:30')], submittedAt: timestamp(-12), assignment: assignment({ scheduleId: finishedScheduleId, slotId: slot(finishedDates[1], '18:30'), interviewerId: 'demo-interviewer-2', status: 'completed', locked: true, source: 'manual', revision: 1 }), interviewStatus: 'completed', rating: 'not_recommend', selectionStatus: 'rejected' },
  { id: 'applicant-016', number: '016', name: '류건우', token: 'demo-rejected-strong', scheduleId: finishedScheduleId, availability: [slot(finishedDates[1], '19:00')], submittedAt: timestamp(-12), assignment: assignment({ scheduleId: finishedScheduleId, slotId: slot(finishedDates[1], '19:00'), interviewerId: 'demo-interviewer-3', status: 'completed', locked: true, source: 'manual', revision: 1 }), interviewStatus: 'completed', rating: 'strongly_not_recommend', selectionStatus: 'rejected' },
  { id: 'applicant-017', number: '017', name: '서재민', token: 'demo-withdrawn', scheduleId: closedScheduleId, availability: [closedSlots[0]], submittedAt: timestamp(-3), lifecycle: 'active', applicationStatus: 'withdrawn', previousAssignment: assignment({ scheduleId: closedScheduleId, slotId: closedSlots[0], interviewerId: 'demo-interviewer-1', status: 'cancelled', revision: 2 }) },
  { id: 'applicant-018', number: '018', name: '노유나', token: 'demo-archived', scheduleId: closedScheduleId, availability: [closedSlots[1]], submittedAt: timestamp(-3), lifecycle: 'archived', applicationStatus: 'active', archivedReason: '중복 지원서 정리' },
  { id: 'applicant-019', number: '019', name: '홍지수', token: 'demo-awaiting', scheduleId: openScheduleId, availability: [], submittedAt: null, availabilitySent: true },
];

function buildApplicant(definition, index) {
  const sentAt = timestamp(-4, '18:00');
  const assignmentRevision = definition.assignmentRevision ?? (definition.assignment ? 1 : 0);
  const confirmationRevision = definition.confirmationRevision;
  const isCompleted = definition.interviewStatus === 'completed';
  const lifecycle = definition.lifecycle ?? 'active';
  const applicationStatus = definition.applicationStatus ?? 'active';
  const selectionStatus = definition.selectionStatus ?? 'pending';
  const active = lifecycle === 'active' && applicationStatus === 'active';
  const scheduleAssignmentRevision = definition.scheduleId ? 1 : 0;
  const responseAt = definition.submittedAt ?? null;
  const confirmationSentAt = definition.assignment && (confirmationRevision != null || isCompleted) ? sentAt : null;
  const applicant = {
    roundId,
    scheduleId: definition.scheduleId,
    scheduleAssignedAt: definition.scheduleId ? timestamp(-8) : null,
    scheduleAssignmentRevision,
    applicantNumber: definition.number,
    name: definition.name,
    phone: `010-4200-${String(3000 + index).slice(-4)}`,
    applicationData: applicantApplication(definition.name, definition.number),
    accessToken: definition.token,
    sourceRowNumber: index,
    source: 'csv',
    lifecycle,
    applicationStatus,
    withdrawnAt: applicationStatus === 'withdrawn' ? timestamp(-1) : null,
    withdrawnBy: applicationStatus === 'withdrawn' ? 'demo-admin@avalon.local' : null,
    archivedAt: lifecycle === 'archived' ? timestamp(-1) : null,
    archivedReason: lifecycle === 'archived' ? definition.archivedReason ?? '운영진 보관 처리' : null,
    availabilityMessage: definition.availabilitySent || responseAt ? sentMessage(sentAt) : sentMessage(null),
    reminderMessage: sentMessage(null),
    confirmationMessage: confirmationSentAt
      ? sentMessage(confirmationSentAt, confirmationRevision ?? assignmentRevision)
      : sentMessage(null, 0),
    assignment: definition.assignment ?? null,
    previousAssignment: definition.previousAssignment ?? null,
    assignmentRevision,
    interviewStatus: definition.interviewStatus ?? 'scheduled',
    actionNeededReason: definition.actionNeededReason ?? null,
    overallRating: definition.rating ?? null,
    interviewCompletedAt: isCompleted ? timestamp(-8, '21:00') : null,
    interviewCompletedBy: isCompleted ? 'demo-admin@avalon.local' : null,
    selectionStatus,
    selectionDecidedAt: selectionStatus === 'pending' ? null : timestamp(-7),
    selectionDecidedBy: selectionStatus === 'pending' ? null : 'demo-admin@avalon.local',
    memberId: definition.memberId ?? null,
    memberRegisteredAt: definition.memberId ? timestamp(-5) : null,
    memberRegisteredBy: definition.memberId ? 'demo-admin@avalon.local' : null,
    createdAt: timestamp(-14 + Math.min(index, 10), '10:00'),
    updatedAt: nowTimestamp,
  };
  const access = {
    roundId,
    scheduleId: definition.scheduleId,
    scheduleAssignmentRevision,
    applicantId: definition.id,
    displayName: definition.name,
    availability: definition.availability,
    submittedAt: responseAt,
    updatedAt: responseAt,
    responseUpdatedAt: responseAt,
    firstAccessedAt: definition.firstAccessedAt === null ? null : responseAt ?? (definition.scheduleId ? timestamp(-2, '09:00') : null),
    tokenRevision: 1,
    supersededBy: null,
    supersededAt: null,
    reissuedFrom: null,
    active,
    assignmentSummary: definition.assignment ? {
      slotId: definition.assignment.slotId,
      interviewerName: definition.assignment.interviewerName,
      status: definition.assignment.status,
      revision: assignmentRevision,
    } : null,
    changeRequestStatus: definition.changeRequestStatus ?? 'none',
    createdAt: timestamp(-14),
  };
  return { ...definition, applicant, access };
}

const applicantRecords = applicantDefinitions.map(buildApplicant);

const completedNotes = applicantRecords.filter(record => record.applicant.interviewStatus === 'completed').map((record, index) => ({
  id: `${roundId}__${record.id}`,
  roundId,
  applicantId: record.id,
  interviewerId: record.applicant.assignment?.interviewerId ?? '',
  interviewerName: record.applicant.assignment?.interviewerName ?? '',
  generalNotes: index === 0
    ? '대화가 자연스럽고 신규 인원과도 먼저 소통하려는 태도가 좋았습니다.\n정기 모임 참여 의지가 구체적입니다.'
    : index === 2 ? '' : '지원서 내용과 면접 답변이 일관적이었습니다.',
  answers: {
    'question-motivation': '새로운 사람들과 꾸준히 취미를 나누고 싶다고 답했습니다.',
    'question-games': index === 2 ? '' : '규칙 설명과 상호작용이 있는 게임을 좋아합니다.',
    'question-activity': '월 2~3회 참여 가능하며 팀 프로젝트 경험이 있습니다.',
  },
  overallRating: record.applicant.overallRating,
  createdAt: timestamp(-8),
  updatedAt: timestamp(-7),
  updatedBy: 'demo-admin@avalon.local',
}));

const documents = [];
function addDocument(collectionName, id, data) {
  documents.push({ collectionName, id, data });
}

members.forEach(({ id, ...data }) => addDocument('members', id, data));
games.forEach(({ id, ...data }) => addDocument('games', id, data));
sessions.forEach(({ id, ...data }) => addDocument('sessions', id, data));
attendees.forEach(({ id, ...data }) => addDocument('attendees', id, data));
addDocument('DailyPlannings', planningDateKey, dailyPlanning);
addDocument('admins', 'demo.admin@avalon.local', { email: 'demo.admin@avalon.local', role: 'master', createdAt: nowTimestamp });

addDocument('interviewRounds', roundId, round);
addDocument('interviewPublicRounds', roundId, publicRound);
schedules.forEach(schedule => {
  addDocument('interviewSchedules', schedule.id, schedule.admin);
  addDocument('interviewPublicSchedules', schedule.id, schedule.public);
});

interviewerProfiles.forEach(({ id, ...profile }) => {
  addDocument('interviewerProfiles', id, profile);
  addDocument('interviewRoundInterviewers', `${roundId}__${id}`, {
    roundId,
    interviewerId: id,
    displayName: profile.name,
    email: profile.email,
    phone: profile.phone,
    // The round-level roster is the legacy fallback and must stay inside the
    // round's own allowedSlots. Concrete schedules keep independent copies.
    availability: openAvailability[id] ?? [],
    active: profile.active,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  });
  schedules.forEach(schedule => addDocument('interviewScheduleInterviewers', `${schedule.id}__${id}`, {
    roundId,
    scheduleId: schedule.id,
    interviewerId: id,
    displayName: profile.name,
    email: profile.email,
    phone: profile.phone,
    availability: availabilityBySchedule[schedule.id][id] ?? [],
    active: id === 'demo-interviewer-unassigned' ? false : profile.active,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  }));
});

applicantRecords.forEach(record => {
  addDocument('interviewApplicants', record.id, record.applicant);
  addDocument('interviewAccess', record.token, record.access);
  addDocument('interviewApplicantKeys', applicantKeyId(roundId, record.number), {
    roundId,
    applicantId: record.id,
    applicantNumber: record.number,
    createdAt: record.applicant.createdAt,
  });
  if (record.applicant.assignment?.slotId) {
    const current = record.applicant.assignment;
    addDocument('interviewAssignmentLocks', assignmentLockId(roundId, current.interviewerId, current.slotId), {
      roundId,
      scheduleId: record.applicant.scheduleId,
      applicantId: record.id,
      interviewerId: current.interviewerId,
      slotId: current.slotId,
      startsAt: current.startsAt,
      durationMinutes: current.durationMinutes,
      updatedAt: nowTimestamp,
    });
  }
});

completedNotes.forEach(({ id, ...note }) => addDocument('interviewNotes', id, note));
addDocument('interviewChangeRequests', 'demo-change', {
  roundId,
  scheduleId: openScheduleId,
  applicantId: 'applicant-008',
  applicantName: '송민재',
  status: 'open',
  reason: '수업 종료 시간이 바뀌어 다른 시간으로 조정이 필요합니다.',
  requestedAt: timestamp(-1, '16:30'),
  resolvedAt: null,
  resolvedBy: null,
});

function validateDocuments() {
  const paths = new Set();
  for (const document of documents) {
    const path = `${document.collectionName}/${document.id}`;
    if (paths.has(path)) throw new Error(`Duplicate fixture path: ${path}`);
    paths.add(path);
  }

  const memberIds = new Set(members.map(member => member.id));
  const gameIds = new Set(games.map(game => game.id));
  for (const session of [...sessions, { id: planningDateKey, ...dailyPlanning }]) {
    for (const group of session.groups) {
      for (const memberId of group.memberIds) {
        if (!memberIds.has(memberId)) throw new Error(`Unknown member ${memberId} in ${session.id}`);
      }
      for (const gameId of group.gameIds) {
        if (!gameIds.has(gameId)) throw new Error(`Unknown game ${gameId} in ${session.id}`);
      }
    }
  }

  const scheduleById = new Map(schedules.map(schedule => [schedule.id, schedule]));
  const occupied = new Set();
  for (const record of applicantRecords) {
    if (record.access.applicantId !== record.id || record.applicant.accessToken !== record.token) {
      throw new Error(`Applicant/access mismatch for ${record.id}`);
    }
    if (record.access.scheduleId !== record.applicant.scheduleId) {
      throw new Error(`Schedule mismatch for ${record.id}`);
    }
    const schedule = record.applicant.scheduleId ? scheduleById.get(record.applicant.scheduleId) : null;
    if (schedule && record.access.availability.some(slotId => !schedule.admin.allowedSlots.includes(slotId))) {
      throw new Error(`Availability outside schedule for ${record.id}`);
    }
    const current = record.applicant.assignment;
    if (!current) continue;
    if (!schedule?.admin.allowedSlots.includes(current.slotId)) throw new Error(`Assignment outside schedule for ${record.id}`);
    if (!record.access.availability.includes(current.slotId)) throw new Error(`Assignment outside applicant availability for ${record.id}`);
    const interviewerSlots = availabilityBySchedule[record.applicant.scheduleId]?.[current.interviewerId] ?? [];
    if (!interviewerSlots.includes(current.slotId)) throw new Error(`Assignment outside interviewer availability for ${record.id}`);
    const resource = `${current.interviewerId}|${current.slotId}`;
    if (occupied.has(resource)) throw new Error(`Duplicate assignment resource ${resource}`);
    occupied.add(resource);
  }

  for (const token of ['demo-new', 'demo-edit', 'demo-completed']) {
    if (!applicantRecords.some(record => record.token === token)) throw new Error(`Missing required token ${token}`);
  }
}

async function clearEmulator() {
  const collections = await db.listCollections();
  for (const collectionRef of collections) {
    await db.recursiveDelete(collectionRef);
  }
}

async function writeDocuments() {
  for (let offset = 0; offset < documents.length; offset += 450) {
    const batch = db.batch();
    documents.slice(offset, offset + 450).forEach(document => {
      batch.set(db.collection(document.collectionName).doc(document.id), document.data);
    });
    await batch.commit();
  }
}

validateDocuments();
console.log(`Safety check passed for ${EXPECTED_PROJECT_ID} at ${EXPECTED_EMULATOR_HOST}.`);
console.log('Clearing Firestore emulator collections...');
await clearEmulator();
console.log(`Writing ${documents.length} demo documents...`);
await writeDocuments();
console.log('Demo seed complete.');
console.log(`Admin: demo.admin@avalon.local | Round: ${roundId} | Planning date: ${planningDateKey}`);
console.log('Public tokens: demo-new, demo-edit, demo-completed');
