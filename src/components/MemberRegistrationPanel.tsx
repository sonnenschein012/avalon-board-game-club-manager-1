import { useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, Link2, Loader2, Search, UserPlus, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import type { InterviewApplicantWithAccess, Member } from '../types';
import { AVAILABLE_GENRES } from '../domain/members/memberForm';
import { useMemberRegistrationLogic, type InterviewMemberRegistrationDraft } from '../hooks/useMemberRegistrationLogic';
import {
  defaultMemberNickname,
  getApplicantPhone,
  getApplicantStudentYear,
  getRegistrationSemester,
  hasSameSemesterMatch,
  normalizeMemberName,
  normalizeStudentYear,
  requiresDistinctMemberNickname,
} from '../domain/interviews/memberRegistration';

type RegistrationTab = 'pending' | 'registered';

interface Props {
  roundId: string;
  applicants: InterviewApplicantWithAccess[];
}

function eligibleSelectedApplicant(applicant: InterviewApplicantWithAccess) {
  return applicant.selectionStatus === 'selected'
    && (applicant.lifecycle ?? 'active') === 'active'
    && (applicant.applicationStatus ?? 'active') === 'active';
}

export default function MemberRegistrationPanel({ roundId, applicants }: Props) {
  const { members, loading, createMember, linkMember, clearRegistration } = useMemberRegistrationLogic(roundId);
  const [tab, setTab] = useState<RegistrationTab>('pending');
  const [query, setQuery] = useState('');
  const [registeringApplicantId, setRegisteringApplicantId] = useState<string | null>(null);
  const selectedApplicants = useMemo(() => applicants.filter(eligibleSelectedApplicant), [applicants]);
  const memberById = useMemo(() => new Map(members.map(member => [member.id, member])), [members]);
  const pending = selectedApplicants.filter(applicant => !applicant.memberId);
  const registered = selectedApplicants.filter(applicant => Boolean(applicant.memberId));
  const normalizedQuery = query.trim().toLowerCase();
  const visible = (tab === 'pending' ? pending : registered).filter(applicant => {
    const member = applicant.memberId ? memberById.get(applicant.memberId) : null;
    return !normalizedQuery || `${applicant.name} ${applicant.applicantNumber} ${getApplicantStudentYear(applicant)} ${member?.nickname ?? ''}`.toLowerCase().includes(normalizedQuery);
  });
  const registeringApplicant = pending.find(applicant => applicant.id === registeringApplicantId) ?? null;

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="선발자" value={selectedApplicants.length} />
      <Metric label="등록 대기" value={pending.length} tone="amber" />
      <Metric label="등록 완료" value={registered.length} tone="emerald" />
    </div>
    <section className="rounded-3xl bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div><h3 className="font-black text-navy">부원 등록</h3><p className="mt-1 text-xs text-slate-500">선발자를 기존 부원과 연결하거나 활동 명부에 새로 등록합니다.</p></div>
        <div className="relative min-w-0 md:w-72"><Search size={15} className="absolute left-3 top-2.5 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm" placeholder="이름, 지원번호, 학번 검색" /></div>
      </div>
      <div className="mt-4 flex gap-1 rounded-xl bg-slate-50 p-1">
        <TabButton active={tab === 'pending'} onClick={() => setTab('pending')} label={`등록 대기 ${pending.length}`} />
        <TabButton active={tab === 'registered'} onClick={() => setTab('registered')} label={`등록 완료 ${registered.length}`} />
      </div>
      <div className="mt-4 space-y-2">
        {loading && <div className="flex justify-center py-10 text-slate-400"><Loader2 className="animate-spin" /></div>}
        {!loading && visible.map(applicant => {
          const member = applicant.memberId ? memberById.get(applicant.memberId) : null;
          return tab === 'pending'
            ? <article key={applicant.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><UserPlus size={18} /></span><div className="min-w-0"><p className="font-black text-navy">{applicant.name}<span className="ml-2 text-xs font-medium text-slate-400">{applicant.applicantNumber}</span></p><p className="mt-1 text-xs text-slate-500">{getApplicantStudentYear(applicant) || '학번 확인 필요'} · {getApplicantPhone(applicant) || '연락처 없음'}</p></div></div><button type="button" onClick={() => setRegisteringApplicantId(applicant.id)} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-navy px-4 py-2.5 text-xs font-black text-white hover:bg-gold"><UserPlus size={14} />부원으로 등록</button></article>
            : <article key={applicant.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${member ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{member ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}</span><div className="min-w-0"><p className="font-black text-navy">{applicant.name}<span className="ml-2 text-xs font-medium text-slate-400">{applicant.applicantNumber}</span></p>{member ? <p className="mt-1 text-xs text-slate-500">{member.nickname} · {member.semester} · {member.status ?? '활동'}</p> : <p className="mt-1 text-xs font-bold text-red-600">연결된 부원 정보가 명부에 없습니다.</p>}</div></div>{member ? <Link to="/" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-navy"><Users size={14} />동아리원 관리</Link> : <button type="button" onClick={() => void clearRegistration(applicant.id).catch(error => toast.error(error instanceof Error ? error.message : '연결 정보를 정리하지 못했습니다.'))} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600">연결 정보 정리</button>}</article>;
        })}
        {!loading && visible.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">{selectedApplicants.length === 0 ? '선발된 지원자가 없습니다.' : tab === 'pending' ? '등록 대기자가 없습니다.' : '등록 완료된 부원이 없습니다.'}</div>}
      </div>
    </section>
    {registeringApplicant && <MemberRegistrationModal key={registeringApplicant.id} applicant={registeringApplicant} members={members} onCreate={createMember} onLink={linkMember} onClose={() => setRegisteringApplicantId(null)} />}
  </div>;
}

function MemberRegistrationModal({ applicant, members, onCreate, onLink, onClose }: { applicant: InterviewApplicantWithAccess; members: Member[]; onCreate: (applicantId: string, input: InterviewMemberRegistrationDraft) => Promise<string>; onLink: (applicantId: string, memberId: string) => Promise<void>; onClose: () => void }) {
  const studentYear = getApplicantStudentYear(applicant);
  const [form, setForm] = useState<InterviewMemberRegistrationDraft>({
    name: applicant.name,
    nickname: defaultMemberNickname(applicant.name, studentYear),
    studentId: studentYear,
    phone: getApplicantPhone(applicant),
    gender: '',
    semester: getRegistrationSemester(),
    preferredGenre: [],
    memo: '',
    isBoardMember: false,
  });
  const [saving, setSaving] = useState(false);
  const matches = members.filter(member => normalizeMemberName(member.name) === normalizeMemberName(form.name) && normalizeStudentYear(member.studentId) === normalizeStudentYear(form.studentId));
  const sameSemester = hasSameSemesterMatch(form.semester, matches);
  const nicknameConflict = requiresDistinctMemberNickname(form, matches);

  const linkMember = async (member: Member) => {
    if (saving) return;
    setSaving(true);
    try {
      await onLink(applicant.id, member.id);
      toast.success(member.status === '휴면' ? `${member.name} 부원을 활동 상태로 복원하고 연결했습니다.` : `${member.name} 부원과 연결했습니다.`);
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '기존 부원과 연결하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (matches.length > 0 && nicknameConflict) {
      toast.error('동명이인을 구분할 수 있도록 기존 부원과 다른 닉네임을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      await onCreate(applicant.id, form);
      toast.success(`${form.name} 지원자를 동아리원으로 등록했습니다.`);
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '부원으로 등록하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${applicant.name} 부원 등록`}><div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-black text-navy">{applicant.name} 부원 등록</h3><p className="mt-1 text-xs text-slate-500">지원서 정보를 확인하고 필요한 항목을 직접 보완해주세요.</p></div><button type="button" onClick={onClose} className="rounded-xl bg-slate-100 p-2 text-slate-500"><X size={18} /></button></div>
    {matches.length > 0 && <section className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4"><h4 className="flex items-center gap-2 text-sm font-black text-navy"><Link2 size={15} />기존 부원 연결 제안</h4><p className="mt-1 text-xs text-slate-500">이름과 학번이 같은 부원입니다. 다른 사람이라면 아래 닉네임을 수정해 새로 등록할 수 있습니다.</p>{sameSemester && <p className="mt-2 text-xs font-bold text-amber-700">가입 학기까지 같은 부원이 있습니다. 기존 부원인지 먼저 확인해주세요.</p>}<div className="mt-3 grid gap-2 md:grid-cols-2">{matches.map(member => <article key={member.id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm"><div><p className="text-sm font-black text-navy">{member.nickname}</p><p className="mt-1 text-[11px] text-slate-500">{member.semester} · {member.status ?? '활동'}</p></div><button type="button" disabled={saving} onClick={() => void linkMember(member)} className="rounded-lg bg-navy px-3 py-2 text-[10px] font-black text-white disabled:opacity-50">{member.status === '휴면' ? '복원 후 연결' : '기존 부원 연결'}</button></article>)}</div></section>}
    <form onSubmit={submit} className="mt-5 space-y-5"><div className="grid gap-4 md:grid-cols-4"><Field label="이름"><input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="input-field" /></Field><Field label="닉네임"><input required value={form.nickname} onChange={event => setForm({ ...form, nickname: event.target.value })} className={`input-field ${nicknameConflict ? 'border-red-300' : ''}`} />{nicknameConflict && <span className="text-[10px] font-bold text-red-600">기존 부원과 다른 닉네임이 필요합니다.</span>}</Field><Field label="학번"><input required value={form.studentId} onChange={event => setForm({ ...form, studentId: normalizeStudentYear(event.target.value) })} className="input-field" placeholder="25" /></Field><Field label="연락처"><input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className="input-field" placeholder="010-0000-0000" /></Field><Field label="성별"><select required value={form.gender} onChange={event => setForm({ ...form, gender: event.target.value as InterviewMemberRegistrationDraft['gender'] })} className="input-field"><option value="">선택</option><option value="남">남</option><option value="여">여</option><option value="기타">기타</option></select></Field><Field label="가입 학기"><input required value={form.semester} onChange={event => setForm({ ...form, semester: event.target.value })} className="input-field" placeholder={getRegistrationSemester()} /></Field><Field label="임원 여부"><label className="flex items-center gap-2 pt-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={form.isBoardMember} onChange={event => setForm({ ...form, isBoardMember: event.target.checked })} />해당됨</label></Field><Field label="메모"><input value={form.memo} onChange={event => setForm({ ...form, memo: event.target.value })} className="input-field" /></Field><div className="md:col-span-4"><p className="mb-2 text-[10px] font-bold uppercase text-slate-400">선호 장르</p><div className="flex flex-wrap gap-2">{AVAILABLE_GENRES.map(genre => { const selected = form.preferredGenre.includes(genre); return <button key={genre} type="button" onClick={() => setForm({ ...form, preferredGenre: selected ? form.preferredGenre.filter(item => item !== genre) : [...form.preferredGenre, genre] })} className={`rounded-full border px-3 py-1.5 text-[10px] font-bold ${selected ? 'border-gold bg-navy text-white' : 'border-slate-100 bg-white text-slate-500'}`}>{genre}</button>; })}</div></div></div><div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500">취소</button><button type="submit" disabled={saving || nicknameConflict} className="inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-xs font-black text-white disabled:opacity-40">{saving && <Loader2 size={14} className="animate-spin" />}새 부원 등록</button></div></form>
  </div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-1"><span className="block text-[10px] font-bold uppercase text-slate-400">{label}</span>{children}</label>; }
function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`flex-1 rounded-lg px-3 py-2 text-xs font-black ${active ? 'bg-white text-navy shadow-sm' : 'text-slate-500'}`}>{label}</button>; }
function Metric({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'amber' | 'emerald' }) { const colors = { slate: 'bg-white text-navy', amber: 'bg-amber-50 text-amber-800', emerald: 'bg-emerald-50 text-emerald-800' }; return <div className={`rounded-2xl border border-slate-100 p-4 shadow-sm ${colors[tone]}`}><p className="text-xs font-bold opacity-70">{label}</p><p className="mt-1 text-2xl font-black">{value}명</p></div>; }
