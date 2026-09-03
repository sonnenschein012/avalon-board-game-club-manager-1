import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  getInterviewLink,
  subscribeInterviewAccess,
  subscribeInterviewApplicants,
  subscribeInterviewChangeRequests,
  subscribeInterviewRound,
  subscribeInterviewSchedules,
  subscribeRoundInterviewers,
  subscribeRoundScheduleInterviewers,
} from '../../services/interviewsService';
import type {
  InterviewAccess,
  InterviewApplicant,
  InterviewApplicantWithAccess,
  InterviewChangeRequest,
  InterviewRound,
  InterviewRoundInterviewer,
  InterviewSchedule,
  InterviewScheduleInterviewer,
} from '../../types';

export function useInterviewRoundData(roundId: string) {
  const [round, setRound] = useState<InterviewRound | null>(null);
  const [applicants, setApplicants] = useState<InterviewApplicant[]>([]);
  const [access, setAccess] = useState<InterviewAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [interviewers, setInterviewers] = useState<InterviewRoundInterviewer[]>([]);
  const [schedules, setSchedules] = useState<InterviewSchedule[]>([]);
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
  const [roundScheduleInterviewers, setRoundScheduleInterviewers] = useState<InterviewScheduleInterviewer[]>([]);
  const [changeRequests, setChangeRequests] = useState<InterviewChangeRequest[]>([]);
  const normalizedRoundId = roundId.trim();

  useEffect(() => {
    if (!normalizedRoundId) {
      setRound(null);
      setApplicants([]);
      setAccess([]);
      setInterviewers([]);
      setSchedules([]);
      setActiveScheduleId(null);
      setRoundScheduleInterviewers([]);
      setChangeRequests([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const stopRound = subscribeInterviewRound(
      normalizedRoundId,
      value => {
        setRound(value);
        setLoading(false);
      },
      error => {
        console.error(error);
        toast.error('면접 회차를 불러오지 못했습니다.');
        setLoading(false);
      },
    );
    const stopApplicants = subscribeInterviewApplicants(normalizedRoundId, setApplicants, console.error);
    const stopAccess = subscribeInterviewAccess(normalizedRoundId, setAccess, console.error);
    const stopInterviewers = subscribeRoundInterviewers(normalizedRoundId, setInterviewers, console.error);
    const stopRoundScheduleInterviewers = subscribeRoundScheduleInterviewers(normalizedRoundId, setRoundScheduleInterviewers, console.error);
    const stopSchedules = subscribeInterviewSchedules(normalizedRoundId, setSchedules, console.error);
    const stopRequests = subscribeInterviewChangeRequests(normalizedRoundId, setChangeRequests, console.error);
    return () => {
      stopRound();
      stopApplicants();
      stopAccess();
      stopInterviewers();
      stopRoundScheduleInterviewers();
      stopSchedules();
      stopRequests();
    };
  }, [normalizedRoundId]);

  useEffect(() => {
    setActiveScheduleId(current => current && schedules.some(schedule => schedule.id === current && schedule.status !== 'archived')
      ? current
      : schedules.find(schedule => schedule.status !== 'archived')?.id ?? null);
  }, [schedules]);

  const activeSchedule = useMemo(() => schedules.find(schedule => schedule.id === activeScheduleId) ?? null, [activeScheduleId, schedules]);
  const activeSchedulingConfig = activeSchedule ?? round;
  const activeInterviewers: InterviewRoundInterviewer[] = useMemo(() => activeScheduleId
    ? roundScheduleInterviewers.filter(item => item.scheduleId === activeScheduleId)
    : interviewers, [activeScheduleId, interviewers, roundScheduleInterviewers]);

  const applicantById = useMemo(() => new Map(applicants.map(item => [item.id, item])), [applicants]);

  const joinedApplicants = useMemo<InterviewApplicantWithAccess[]>(() => {
    const accessByToken = new Map(access.map(item => [item.id, item]));
    return applicants.map(applicant => ({
      ...applicant,
      access: accessByToken.get(applicant.accessToken) ?? null,
      link: getInterviewLink(applicant.accessToken),
    }));
  }, [access, applicants]);

  const joinedApplicantById = useMemo(() => new Map(joinedApplicants.map(item => [item.id, item])), [joinedApplicants]);
  return {
    round, setRound, applicants, setApplicants, joinedApplicants,
    applicantById, joinedApplicantById, loading, interviewers, schedules,
    activeSchedule, activeScheduleId, setActiveScheduleId, activeSchedulingConfig,
    activeInterviewers, roundScheduleInterviewers, changeRequests,
  };
}

export type InterviewRoundData = ReturnType<typeof useInterviewRoundData>;
