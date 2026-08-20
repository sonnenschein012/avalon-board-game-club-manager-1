import { useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import type { InterviewApplicant } from '../types';
import type { ApplicantDraft } from '../services/interviewsService';

interface Props {
  open: boolean;
  applicant?: InterviewApplicant | null;
  onClose: () => void;
  onSave: (draft: ApplicantDraft) => Promise<boolean>;
}

const emptyDraft = (): ApplicantDraft => ({ applicantNumber: '', name: '', phone: '', applicationData: [] });

export default function ApplicantFormModal({ open, applicant, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<ApplicantDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setDraft(applicant ? {
      applicantNumber: applicant.applicantNumber,
      name: applicant.name,
      phone: applicant.phone,
      applicationData: applicant.applicationData.map(field => ({ ...field })),
    } : emptyDraft());
  }, [applicant, open]);
  if (!open) return null;
  const valid = Boolean(draft.applicantNumber.trim() && draft.name.trim() && draft.phone.trim());
  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try { if (await onSave(draft)) onClose(); } finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
    <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-black text-navy">{applicant ? '지원자 정보 수정' : '지원자 개별 추가'}</h2><p className="text-[10px] uppercase text-slate-400">Firestore applicant record</p></div><button onClick={onClose} className="p-2 text-slate-400"><X size={18} /></button></header>
      <div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-bold text-slate-500">지원번호<input value={draft.applicantNumber} onChange={event => setDraft({ ...draft, applicantNumber: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
          <label className="text-xs font-bold text-slate-500">이름<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
          <label className="text-xs font-bold text-slate-500">연락처<input value={draft.phone} onChange={event => setDraft({ ...draft, phone: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
        </div>
        <section className="space-y-2 rounded-2xl bg-slate-50 p-4"><div className="flex items-center justify-between"><h3 className="text-xs font-black text-navy">지원서 추가 정보</h3><button onClick={() => setDraft({ ...draft, applicationData: [...draft.applicationData, { header: '', value: '' }] })} className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-bold text-navy"><Plus size={12} />항목</button></div>
          {draft.applicationData.map((field, index) => <div key={index} className="grid grid-cols-[1fr_2fr_auto] gap-2"><input aria-label="항목명" value={field.header} onChange={event => setDraft({ ...draft, applicationData: draft.applicationData.map((item, i) => i === index ? { ...item, header: event.target.value } : item) })} placeholder="항목명" className="rounded-xl border border-slate-200 px-3 py-2 text-xs" /><input aria-label="답변" value={field.value} onChange={event => setDraft({ ...draft, applicationData: draft.applicationData.map((item, i) => i === index ? { ...item, value: event.target.value } : item) })} placeholder="내용" className="rounded-xl border border-slate-200 px-3 py-2 text-xs" /><button onClick={() => setDraft({ ...draft, applicationData: draft.applicationData.filter((_, i) => i !== index) })} className="rounded-xl p-2 text-red-500"><Trash2 size={14} /></button></div>)}
        </section>
      </div>
      <footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4"><button onClick={onClose} className="px-4 text-xs font-bold text-slate-500">취소</button><button disabled={!valid || saving} onClick={submit} className="flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-xs font-black text-white disabled:opacity-40">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}저장</button></footer>
    </div>
  </div>;
}
