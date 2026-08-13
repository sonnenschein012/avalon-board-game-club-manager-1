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

export interface InterviewMessageTemplates {
  availability: string;
  reminder: string;
  confirmation: string;
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
  allowedSlots: string[];
  schemaVersion: 1;
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
  schemaVersion: 1;
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
  confirmationRevision?: number;
}

export interface InterviewApplicant {
  id: string;
  roundId: string;
  applicantNumber: string;
  name: string;
  phone: string;
  applicationData: InterviewApplicationField[];
  accessToken: string;
  sourceRowNumber: number;
  availabilityMessage: InterviewMessageStatus;
  reminderMessage?: InterviewMessageStatus;
  confirmationMessage: InterviewMessageStatus;
  assignment: InterviewAssignment | null;
  assignmentRevision?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  active: boolean;
  createdAt: Timestamp;
}
