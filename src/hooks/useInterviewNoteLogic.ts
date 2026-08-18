import { useEffect, useRef, useState } from 'react';
import type { InterviewNote, InterviewRoundInterviewer } from '../types';
import { saveInterviewNote, subscribeInterviewNote } from '../services/interviewsService';

interface NoteDraft {
  generalNotes: string;
  answers: Record<string, string>;
}

const EMPTY_NOTE: NoteDraft = { generalNotes: '', answers: {} };

export function useInterviewNoteLogic(
  roundId: string,
  applicantId: string | null,
  interviewer: InterviewRoundInterviewer | null,
) {
  const [draft, setDraft] = useState<NoteDraft>(EMPTY_NOTE);
  const [note, setNote] = useState<InterviewNote | null>(null);
  const [state, setState] = useState<'loading' | 'saved' | 'saving' | 'error'>('loading');
  const initialized = useRef(false);
  const lastSaved = useRef(JSON.stringify(EMPTY_NOTE));
  const draftRef = useRef<NoteDraft>(EMPTY_NOTE);

  useEffect(() => {
    initialized.current = false;
    setDraft(EMPTY_NOTE);
    draftRef.current = EMPTY_NOTE;
    setNote(null);
    if (!applicantId) { setState('loading'); return; }
    setState('loading');
    return subscribeInterviewNote(roundId, applicantId, value => {
      const next = value ? { generalNotes: value.generalNotes ?? '', answers: value.answers ?? {} } : EMPTY_NOTE;
      const nextSerialized = JSON.stringify(next);
      const currentSerialized = JSON.stringify(draftRef.current);
      const hasUnsavedLocalChanges = initialized.current && currentSerialized !== lastSaved.current;
      setNote(value);
      if (!hasUnsavedLocalChanges || currentSerialized === nextSerialized) {
        setDraft(next);
        draftRef.current = next;
      }
      lastSaved.current = nextSerialized;
      initialized.current = true;
      setState(hasUnsavedLocalChanges && currentSerialized !== nextSerialized ? 'saving' : 'saved');
    }, () => setState('error'));
  }, [applicantId, roundId]);

  useEffect(() => {
    if (!initialized.current || !applicantId || !interviewer) return;
    const serialized = JSON.stringify(draft);
    if (serialized === lastSaved.current) return;
    setState('saving');
    const timer = window.setTimeout(() => {
      void saveInterviewNote({
        roundId,
        applicantId,
        interviewerId: interviewer.interviewerId,
        interviewerName: interviewer.displayName,
        generalNotes: draft.generalNotes,
        answers: draft.answers,
      }).then(() => {
        lastSaved.current = serialized;
        if (JSON.stringify(draftRef.current) === serialized) setState('saved');
      }).catch(() => setState('error'));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [applicantId, draft, interviewer, roundId]);

  useEffect(() => () => {
    if (!initialized.current || !applicantId || !interviewer) return;
    const current = draftRef.current;
    if (JSON.stringify(current) === lastSaved.current) return;
    void saveInterviewNote({
      roundId,
      applicantId,
      interviewerId: interviewer.interviewerId,
      interviewerName: interviewer.displayName,
      generalNotes: current.generalNotes,
      answers: current.answers,
    });
  }, [applicantId, interviewer, roundId]);

  return {
    note,
    generalNotes: draft.generalNotes,
    answers: draft.answers,
    state,
    setGeneralNotes: (generalNotes: string) => setDraft(current => {
      const next = { ...current, generalNotes };
      draftRef.current = next;
      return next;
    }),
    setAnswer: (questionId: string, answer: string) => setDraft(current => {
      const next = { ...current, answers: { ...current.answers, [questionId]: answer } };
      draftRef.current = next;
      return next;
    }),
  };
}
