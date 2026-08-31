import { useCallback, useEffect, useRef, useState } from 'react';
import type { InterviewNote, InterviewOverallRating, InterviewRoundInterviewer } from '../types';
import { saveInterviewNote, subscribeInterviewNote } from '../services/interviewsService';
import { isInterviewRevisionConflict } from '../domain/interviews/revisionConflict';

interface NoteDraft {
  generalNotes: string;
  answers: Record<string, string>;
  overallRating: InterviewOverallRating | null;
}

type NoteSaveState = 'loading' | 'saved' | 'saving' | 'error' | 'conflict';

const EMPTY_NOTE: NoteDraft = { generalNotes: '', answers: {}, overallRating: null };
const serialize = (draft: NoteDraft) => JSON.stringify(draft);
const toDraft = (note: InterviewNote | null): NoteDraft => note ? {
  generalNotes: note.generalNotes ?? '',
  answers: note.answers ?? {},
  overallRating: note.overallRating ?? null,
} : EMPTY_NOTE;

export function useInterviewNoteLogic(
  roundId: string,
  applicantId: string | null,
  interviewer: InterviewRoundInterviewer | null,
) {
  const [draft, setDraft] = useState<NoteDraft>(EMPTY_NOTE);
  const [note, setNote] = useState<InterviewNote | null>(null);
  const [state, setState] = useState<NoteSaveState>('loading');
  const [revision, setRevision] = useState(0);
  const initialized = useRef(false);
  const lastSaved = useRef(serialize(EMPTY_NOTE));
  const draftRef = useRef<NoteDraft>(EMPTY_NOTE);
  const revisionRef = useRef(0);
  const remoteConflictRef = useRef<{ note: InterviewNote | null; draft: NoteDraft; revision: number } | null>(null);
  const ownSaveSerializedRef = useRef<string | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const generationRef = useRef(0);

  const acceptDraft = useCallback((next: NoteDraft, nextNote: InterviewNote | null, nextRevision: number) => {
    setDraft(next);
    draftRef.current = next;
    setNote(nextNote);
    lastSaved.current = serialize(next);
    revisionRef.current = nextRevision;
    setRevision(nextRevision);
    remoteConflictRef.current = null;
    setState('saved');
  }, []);

  useEffect(() => {
    generationRef.current += 1;
    initialized.current = false;
    setDraft(EMPTY_NOTE);
    draftRef.current = EMPTY_NOTE;
    setNote(null);
    revisionRef.current = 0;
    setRevision(0);
    lastSaved.current = serialize(EMPTY_NOTE);
    remoteConflictRef.current = null;
    ownSaveSerializedRef.current = null;
    if (!applicantId) { setState('loading'); return; }
    setState('loading');
    return subscribeInterviewNote(roundId, applicantId, (value, metadata) => {
      const next = toDraft(value);
      const nextSerialized = serialize(next);
      const currentSerialized = serialize(draftRef.current);
      const nextRevision = value?.revision ?? 0;
      const hasUnsavedLocalChanges = initialized.current && currentSerialized !== lastSaved.current;
      const acknowledgesOwnSave = metadata.hasPendingWrites
        || nextSerialized === ownSaveSerializedRef.current;

      setNote(value);
      if (!hasUnsavedLocalChanges || currentSerialized === nextSerialized || acknowledgesOwnSave) {
        lastSaved.current = nextSerialized;
        revisionRef.current = nextRevision;
        setRevision(nextRevision);
        remoteConflictRef.current = null;
        if (currentSerialized === nextSerialized || !hasUnsavedLocalChanges) {
          setDraft(next);
          draftRef.current = next;
          setState(metadata.hasPendingWrites ? 'saving' : 'saved');
        } else {
          setState('saving');
        }
      } else if (nextRevision > revisionRef.current || nextSerialized !== lastSaved.current) {
        remoteConflictRef.current = { note: value, draft: next, revision: nextRevision };
        setState('conflict');
      }
      initialized.current = true;
    }, () => setState('error'));
  }, [applicantId, roundId]);

  const queueSave = useCallback(() => {
    const generation = generationRef.current;
    const execute = async (): Promise<boolean> => {
      if (!initialized.current || !applicantId || !interviewer || remoteConflictRef.current) return false;
      const current = draftRef.current;
      const currentSerialized = serialize(current);
      if (currentSerialized === lastSaved.current) return true;
      setState('saving');
      ownSaveSerializedRef.current = currentSerialized;
      try {
        const nextRevision = await saveInterviewNote({
          roundId,
          applicantId,
          interviewerId: interviewer.interviewerId,
          interviewerName: interviewer.displayName,
          generalNotes: current.generalNotes,
          answers: current.answers,
          overallRating: current.overallRating,
          expectedRevision: revisionRef.current,
        });
        if (generation !== generationRef.current) return true;
        revisionRef.current = nextRevision;
        setRevision(nextRevision);
        lastSaved.current = currentSerialized;
        if (serialize(draftRef.current) === currentSerialized) setState('saved');
        return true;
      } catch (error) {
        if (generation !== generationRef.current) return false;
        setState(isInterviewRevisionConflict(error) ? 'conflict' : 'error');
        return false;
      }
    };
    const task = saveQueueRef.current.then(execute, execute);
    saveQueueRef.current = task.then(() => undefined, () => undefined);
    return task;
  }, [applicantId, interviewer, roundId]);

  useEffect(() => {
    if (!initialized.current || !applicantId || !interviewer || state === 'conflict') return;
    if (serialize(draft) === lastSaved.current) return;
    const timer = window.setTimeout(() => { void queueSave(); }, 700);
    return () => window.clearTimeout(timer);
  }, [applicantId, draft, interviewer, queueSave, state]);

  const acceptRemote = () => {
    const remote = remoteConflictRef.current;
    if (!remote) return;
    acceptDraft(remote.draft, remote.note, remote.revision);
  };

  const overwriteRemote = async () => {
    const remote = remoteConflictRef.current;
    if (!remote) return false;
    revisionRef.current = remote.revision;
    setRevision(remote.revision);
    lastSaved.current = serialize(remote.draft);
    remoteConflictRef.current = null;
    return queueSave();
  };

  const retrySave = () => state === 'conflict' ? Promise.resolve(false) : queueSave();

  return {
    note,
    revision,
    generalNotes: draft.generalNotes,
    answers: draft.answers,
    overallRating: draft.overallRating,
    state,
    acceptRemote,
    overwriteRemote,
    retrySave,
    flush: async () => ({ saved: await queueSave(), revision: revisionRef.current }),
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
    setOverallRating: (overallRating: InterviewOverallRating | null) => setDraft(current => {
      const next = { ...current, overallRating };
      draftRef.current = next;
      return next;
    }),
  };
}
