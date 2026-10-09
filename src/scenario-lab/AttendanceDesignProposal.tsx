import CostEvaluationModal from '../components/CostEvaluationModal';
import { attendanceButtonBase as button, attendanceButtonStyles } from '../components/attendanceButtonStyles';
import type { UtilityContext } from '../domain/matching/personalUtility';
import type { SessionGroup } from '../types';

export type AttendanceButtonProposal = 'a' | 'b';
export const attendanceButtonProposals = {
  a: {
    mode: `${button} border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50`,
    autoAssign: `${button} bg-navy text-white hover:bg-[#243649] disabled:cursor-wait disabled:opacity-60`,
    evaluation: `${button} border border-slate-200 bg-white text-navy hover:bg-slate-50`,
  },
  b: attendanceButtonStyles,
} as const;

export function EvaluationProposal(props: { groups: SessionGroup[]; context: UtilityContext; onClose: () => void }) {
  return <CostEvaluationModal isOpen {...props} />;
}
