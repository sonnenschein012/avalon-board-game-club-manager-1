import type { Member } from '../types';
import { useFirestore } from './useFirestore';
import {
  clearApplicantMemberRegistration,
  createMemberFromSelectedApplicant,
  linkSelectedApplicantToMember,
  type InterviewMemberRegistrationDraft,
} from '../services/interviewsService';

export function useMemberRegistrationLogic(roundId: string) {
  const { data: members, loading } = useFirestore<Member>('members');
  return {
    members,
    loading,
    createMember: (applicantId: string, input: InterviewMemberRegistrationDraft) => (
      createMemberFromSelectedApplicant(applicantId, roundId, input)
    ),
    linkMember: (applicantId: string, memberId: string) => (
      linkSelectedApplicantToMember(applicantId, memberId)
    ),
    clearRegistration: (applicantId: string) => clearApplicantMemberRegistration(applicantId),
  };
}

export type { InterviewMemberRegistrationDraft } from '../services/interviewsService';
