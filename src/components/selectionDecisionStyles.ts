import type { InterviewSelectionStatus } from '../types';

export type SelectionDecision = Exclude<InterviewSelectionStatus, 'pending'>;

const DECISION_BUTTON_STYLES: Record<SelectionDecision, { active: string; inactive: string }> = {
  rejected: {
    active: 'border-red-600 bg-red-600 text-white hover:bg-red-700',
    inactive: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
  },
  selected: {
    active: 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700',
    inactive: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
  },
};

export function getSelectionDecisionButtonClass(
  selection: InterviewSelectionStatus,
  decision: SelectionDecision,
): string {
  const styles = DECISION_BUTTON_STYLES[decision];
  return selection === decision ? styles.active : styles.inactive;
}
