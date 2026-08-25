import type { Timestamp } from 'firebase/firestore';
import type {
  InterviewApplicationField,
  InterviewAssignmentEvent,
  InterviewAssignmentStatus,
  InterviewChangeRequest,
  InterviewDaySchedule,
  InterviewNote,
  InterviewOverallRating,
  InterviewQuestion,
  InterviewRecordEvent,
  InterviewRound,
  InterviewSchedule,
  InterviewRoundStatus,
} from '../../types';

export const INTERVIEW_LINK_ORIGIN = window.location.origin;

export interface InterviewRoundDraft {
  name: string;
  surveyOpensAt: Date;
  surveyClosesAt: Date;
  interviewDates: string[];
  dayStartTime: string;
  dayEndTime: string;
  availabilitySlotMinutes: number;
  assignmentSlotMinutes: number;
  status: InterviewRoundStatus;
  instructions: string;
  messageTemplates: InterviewRound['messageTemplates'];
  allowedSlots: string[];
  daySchedules: InterviewDaySchedule[];
  interviewQuestions: InterviewQuestion[];
}

export interface InterviewScheduleDraft {
  name: string;
  surveyOpensAt: Date;
  surveyClosesAt: Date;
  interviewDates: string[];
  dayStartTime: string;
  dayEndTime: string;
  availabilitySlotMinutes: number;
  assignmentSlotMinutes: number;
  status: Exclude<InterviewSchedule['status'], 'archived'>;
  instructions: string;
  allowedSlots: string[];
  daySchedules: InterviewDaySchedule[];
}

export interface ApplicantImportRow {
  applicantNumber: string;
  name: string;
  phone: string;
  applicationData: InterviewApplicationField[];
  sourceRowNumber: number;
}

export interface ApplicantDraft {
  applicantNumber: string;
  name: string;
  phone: string;
  applicationData: InterviewApplicationField[];
}

export interface ApplicantMergeCommitItem extends ApplicantImportRow {
  action: 'create' | 'update';
  existingId?: string;
}

export interface RoundInterviewerDraft {
  name: string;
  email?: string | null;
}

export interface AssignmentProposalWrite {
  applicantId: string;
  /** Revision observed when the automatic-assignment draft was created. */
  expectedAssignmentRevision: number;
  slotId: string;
  startsAt: Timestamp;
  durationMinutes: number;
  interviewerId: string;
  interviewerName: string;
  locked: boolean;
  source: 'manual' | 'automatic';
  status?: InterviewAssignmentStatus;
}

export interface InterviewRoundExportRecords {
  notes: InterviewNote[];
  assignmentEvents: InterviewAssignmentEvent[];
  recordEvents: InterviewRecordEvent[];
  changeRequests: InterviewChangeRequest[];
}

export interface CompleteInterviewInput {
  roundId: string;
  applicantId: string;
  interviewerId: string;
  interviewerName: string;
  generalNotes?: string;
  answers?: Record<string, string>;
  overallRating?: InterviewOverallRating | null;
}

export function generateInterviewToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function getInterviewLink(token: string): string {
  return new URL(`/interview/${encodeURIComponent(token)}`, INTERVIEW_LINK_ORIGIN).toString();
}
