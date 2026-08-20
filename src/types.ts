import { Timestamp } from 'firebase/firestore';

export type AttendeeId = string;
export type MemberId = string;

export interface Member {
  id: string;
  name: string;
  nickname: string;
  studentId: string;
  phone: string;
  gender: '남' | '여' | '기타';
  semester: string; // e.g. "2025-1"
  preferredGenre: string[];
  memo?: string;
  isBoardMember?: boolean;
  status?: '활동' | '휴면';
  dormantSemester?: string;
  createdAt: Timestamp;
}

export interface Game {
  id: string;
  title: string;
  minPlayers?: number;
  maxPlayers?: number;
  bestMinPlayers?: number;
  bestMaxPlayers?: number;
  complexity?: number;
  image?: string;
  memo?: string;
  genres?: string[];
}

export interface Attendee {
  id: string;
  name: string;
  studentIdPrefix?: string;
  drink?: string;
  afterparty?: boolean;
  request: string;
  importDate: Timestamp;
  importId: string;
  status: '대기' | '편성됨' | '결석';
}

export interface SessionGroup {
  id: string;
  name?: string;
  memberIds: AttendeeId[];
  gameIds: string[];
  notes?: string;
  targetSize?: number;
}

export interface StoredSessionGroup {
  id: string;
  name?: string;
  memberIds: MemberId[];
  gameIds: string[];
  notes?: string;
  targetSize?: number;
}

export interface Session {
  id: string;
  date: Timestamp;
  name: string; // e.g. "2025-04-24 정기 모임"
  groups: StoredSessionGroup[];
  /** Immutable list of board members when this session was created. */
  boardMemberIds?: string[];
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: Record<string, unknown>;
}

export interface Admin {
  id: string; // The email
  email: string;
  role: 'master' | 'admin';
  createdAt: Timestamp;
}

export type InterviewRoundStatus = 'draft' | 'collecting' | 'closed' | 'interviewing' | 'finished';

export interface InterviewDaySchedule {
  date: string;
  startTime: string;
  endTime: string;
}

export interface InterviewQuestion {
  id: string;
  text: string;
}

export interface InterviewMessageTemplates {
  availability: string;
  reminder: string;
  confirmation: string;
  reschedule: string;
}

export interface InterviewRound {
  id: string;
  name: string;
  surveyOpensAt: Timestamp;
  surveyClosesAt: Timestamp;
  interviewDates: string[];
  dayStartTime: string;
  dayEndTime: string;
  availabilitySlotMinutes: number;
  assignmentSlotMinutes: number;
  status: InterviewRoundStatus;
  instructions: string;
  messageTemplates: InterviewMessageTemplates;
  interviewQuestions: InterviewQuestion[];
  allowedSlots: string[];
  daySchedules: InterviewDaySchedule[];
  timeZone: 'Asia/Seoul';
  scheduleRevision: number;
  schemaVersion: 2;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface InterviewPublicRound {
  id: string;
  name: string;
  surveyOpensAt: Timestamp;
  surveyClosesAt: Timestamp;
  interviewDates: string[];
  dayStartTime: string;
  dayEndTime: string;
  availabilitySlotMinutes: number;
  status: InterviewRoundStatus;
  instructions: string;
  allowedSlots: string[];
  active: boolean;
  daySchedules: InterviewDaySchedule[];
  timeZone: 'Asia/Seoul';
  scheduleRevision: number;
  schemaVersion: 2;
  updatedAt: Timestamp;
}

export interface InterviewApplicationField {
  header: string;
  value: string;
}

export interface InterviewMessageStatus {
  firstMarkedSentAt: Timestamp | null;
  lastMarkedSentAt: Timestamp | null;
  assignmentRevision?: number;
}

export interface InterviewAssignment {
  slotId?: string;
  startsAt: Timestamp;
  durationMinutes: number;
  interviewerId: string;
  interviewerName: string;
  status: InterviewAssignmentStatus;
  locked: boolean;
  source: 'manual' | 'automatic';
  confirmationRevision?: number;
}

export type InterviewAssignmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'change_requested'
  | 'completed'
  | 'no_show'
  | 'cancelled'
  | 'needs_reschedule';

export type InterviewApplicantLifecycle = 'active' | 'archived';

export type InterviewApplicantStatus = 'active' | 'withdrawn';

export type InterviewProgressStatus = 'scheduled' | 'completed' | 'action_needed';

export type InterviewOverallRating =
  | 'strongly_recommend'
  | 'recommend'
  | 'neutral'
  | 'not_recommend'
  | 'strongly_not_recommend';

export type InterviewSelectionStatus = 'pending' | 'selected' | 'rejected';

export interface InterviewApplicant {
  id: string;
  roundId: string;
  applicantNumber: string;
  name: string;
  phone: string;
  applicationData: InterviewApplicationField[];
  accessToken: string;
  sourceRowNumber: number | null;
  source: 'manual' | 'csv';
  lifecycle: InterviewApplicantLifecycle;
  applicationStatus?: InterviewApplicantStatus;
  withdrawnAt?: Timestamp | null;
  withdrawnBy?: string | null;
  archivedAt: Timestamp | null;
  archivedReason: string | null;
  availabilityMessage: InterviewMessageStatus;
  reminderMessage?: InterviewMessageStatus;
  confirmationMessage: InterviewMessageStatus;
  assignment: InterviewAssignment | null;
  previousAssignment?: InterviewAssignment | null;
  assignmentRevision?: number;
  interviewStatus?: InterviewProgressStatus;
  actionNeededReason?: string | null;
  overallRating?: InterviewOverallRating | null;
  interviewCompletedAt?: Timestamp | null;
  interviewCompletedBy?: string | null;
  selectionStatus?: InterviewSelectionStatus;
  selectionDecidedAt?: Timestamp | null;
  selectionDecidedBy?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface InterviewerProfile {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface InterviewRoundInterviewer {
  id: string;
  roundId: string;
  interviewerId: string;
  displayName: string;
  email: string | null;
  availability: string[];
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface InterviewChangeRequest {
  id: string;
  roundId: string;
  applicantId: string;
  applicantName: string;
  status: 'open' | 'resolved' | 'dismissed';
  reason: string;
  requestedAt: Timestamp;
  resolvedAt: Timestamp | null;
  resolvedBy: string | null;
}

export interface InterviewAssignmentEvent {
  id: string;
  roundId: string;
  applicantId: string;
  type:
    | 'assigned'
    | 'changed'
    | 'unassigned'
    | 'status_changed'
    | 'locked'
    | 'unlocked'
    | 'schedule_reset'
    | 'withdrawn'
    | 'restored';
  previousAssignment: InterviewAssignment | null;
  nextAssignment: InterviewAssignment | null;
  previousRevision?: number;
  nextRevision?: number;
  reason?: string | null;
  createdAt: Timestamp;
  createdBy: string | null;
}

export interface InterviewNote {
  id: string;
  roundId: string;
  applicantId: string;
  interviewerId: string;
  interviewerName: string;
  generalNotes: string;
  answers: Record<string, string>;
  overallRating?: InterviewOverallRating | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy: string | null;
}

export interface InterviewRecordEvent {
  id: string;
  roundId: string;
  applicantId: string;
  type: 'completed' | 'schedule_reset_snapshot' | 'withdrawal_snapshot' | 'rating_changed';
  assignmentRevision: number;
  assignment: InterviewAssignment | null;
  interviewStatus: InterviewProgressStatus;
  overallRating: InterviewOverallRating | null;
  noteSnapshot: {
    interviewerId: string;
    interviewerName: string;
    generalNotes: string;
    answers: Record<string, string>;
    overallRating: InterviewOverallRating | null;
    createdAt: Timestamp | null;
    updatedAt: Timestamp | null;
    updatedBy: string | null;
  } | null;
  previousOverallRating?: InterviewOverallRating | null;
  nextOverallRating?: InterviewOverallRating | null;
  reason?: string | null;
  createdAt: Timestamp;
  createdBy: string | null;
}

export interface InterviewAccess {
  id: string;
  roundId: string;
  applicantId: string;
  displayName: string;
  availability: string[];
  submittedAt: Timestamp | null;
  updatedAt: Timestamp | null;
  responseUpdatedAt?: Timestamp | null;
  firstAccessedAt?: Timestamp | null;
  tokenRevision?: number;
  supersededBy?: string | null;
  supersededAt?: Timestamp | null;
  reissuedFrom?: string | null;
  active: boolean;
  assignmentSummary?: {
    slotId: string;
    interviewerName: string;
    status: InterviewAssignmentStatus;
    revision: number;
  } | null;
  changeRequestStatus?: 'none' | 'open' | 'resolved' | 'dismissed';
  createdAt: Timestamp;
}
