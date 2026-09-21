import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { Attendee } from '../types';
import { createAttendanceMemberDraft, type AttendanceMemberDraft } from '../domain/members/attendanceRegistration';
import { GAME_GENRES } from '../domain/games/gameCatalog';

export default function AttendanceMemberRegistrationModal({ attendee, onSave, onClose }: {
  attendee: Attendee;
  onSave: (draft: AttendanceMemberDraft) => Promise<boolean>;
  onClose: () => void;
}) {
  const [form, setForm] = useState(() => createAttendanceMemberDraft(attendee));
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="출석 부원 등록">
    <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div><h2 className="text-lg font-black text-navy">{attendee.name} 부원 등록</h2>
          <p className="mt-1 text-sm text-slate-500">출석 정보를 확인하고 가입 학기와 성별을 선택해주세요.</p></div>
        <button type="button" aria-label="등록 닫기" disabled={saving} onClick={onClose} className="rounded-xl bg-slate-100 p-2"><X size={18} /></button>
      </div>
      <form onSubmit={submit} className="mt-5 space-y-5">
        <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
          {(['name', 'nickname', 'studentId', 'phone', 'semester'] as const).map(key => <label key={key} className="space-y-1 text-sm font-bold">
            <span>{{ name: '이름', nickname: '닉네임', studentId: '학번', phone: '연락처', semester: '가입 학기' }[key]}</span>
            <input className="input-field" required={key !== 'phone' && key !== 'nickname'} value={form[key]}
              onChange={event => setForm({ ...form, [key]: event.target.value })}
              placeholder={key === 'semester' ? '2026-2' : key === 'studentId' ? '26' : ''} />
          </label>)}
          <label className="space-y-1 text-sm font-bold"><span>성별</span><select required className="input-field" value={form.gender}
            onChange={event => setForm({ ...form, gender: event.target.value as AttendanceMemberDraft['gender'] })}>
            <option value="">선택</option><option value="남">남</option><option value="여">여</option><option value="기타">기타</option>
          </select></label>
          <label className="space-y-1 text-sm font-bold"><span>메모</span><input className="input-field" value={form.memo} onChange={event => setForm({ ...form, memo: event.target.value })} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isBoardMember} onChange={event => setForm({ ...form, isBoardMember: event.target.checked })} />임원</label>
          <div className="sm:col-span-2"><p className="mb-2 text-sm font-bold">선호 장르</p><div className="flex flex-wrap gap-3">
            {GAME_GENRES.map(genre => <label key={genre} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={form.preferredGenre.includes(genre)}
              onChange={event => setForm({ ...form, preferredGenre: event.target.checked ? [...form.preferredGenre, genre] : form.preferredGenre.filter(value => value !== genre) })} />{genre}</label>)}
          </div></div>
        </fieldset>
        <div className="flex justify-end gap-3">
          <button type="button" disabled={saving} onClick={onClose} className="px-4 py-2 text-sm">취소</button>
          <button type="submit" disabled={saving} className="rounded-xl bg-navy px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? '등록 중…' : '부원 등록'}</button>
        </div>
      </form>
    </section>
  </div>;
}
