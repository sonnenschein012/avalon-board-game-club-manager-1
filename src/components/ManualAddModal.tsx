import React, { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import type { Attendee, Member } from '../types';
import type { ManualAttendeeInput } from '../services/attendeesService';
import { attendeeMember } from '../domain/attendance/guests';

interface ManualAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: ManualAttendeeInput) => Promise<void | boolean>;
  isAdding: boolean;
  attendees?: Attendee[];
  members?: Member[];
}

export default function ManualAddModal({ isOpen, onClose, onAdd, isAdding, attendees = [], members = [] }: ManualAddModalProps) {
  const [participantType, setParticipantType] = useState<'member' | 'guest'>('member');
  const [invitedByAttendeeId, setInvitedByAttendeeId] = useState('');
  const inviters = attendees.filter(a => a.status !== '결석' && attendeeMember(a, members));
  const [name, setName] = useState('');
  const [studentIdPrefix, setStudentIdPrefix] = useState('');
  const [drink, setDrink] = useState('');
  const [afterparty, setAfterparty] = useState(false);
  const [request, setRequest] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const added = await onAdd({ name, studentIdPrefix: participantType === 'guest' ? '' : studentIdPrefix, drink, afterparty: participantType === 'guest' ? false : afterparty, request: participantType === 'guest' ? '' : request, participantType, ...(participantType === 'guest' ? { invitedByAttendeeId } : {}) });
    if (added === false) return;
    setName('');
    setStudentIdPrefix('');
    setDrink('');
    setAfterparty(false);
    setRequest('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-hidden flex flex-col">
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex shrink-0 justify-between items-center">
          <h2 className="text-sm font-bold text-slate-800">
            명단 추가
          </h2>
          <button onClick={onClose} aria-label="닫기" className="-mr-2 flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors focus-visible:outline-2 focus-visible:outline-navy">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="min-h-0 overflow-y-auto p-6 space-y-4">
          <fieldset disabled={isAdding} className="space-y-2">
            <legend className="text-xs font-bold text-slate-400">참가자 유형</legend>
            <div className="relative isolate grid grid-cols-2 rounded-full bg-slate-50 p-1 ring-1 ring-inset ring-slate-200">
              <span aria-hidden="true" className={`pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-8px)/2)] rounded-full bg-white shadow-sm ring-1 ring-slate-100 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${participantType === 'guest' ? 'translate-x-full' : 'translate-x-0'}`} />
              {([{ value: 'member', label: '동아리원' }, { value: 'guest', label: '게스트' }] as const).map(option => (
                <label key={option.value} className="relative z-10 min-w-0 cursor-pointer rounded-full">
                  <input type="radio" name="participant-type" value={option.value} checked={participantType === option.value}
                    onChange={() => setParticipantType(option.value)} className="peer absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0" />
                  <span className={`pointer-events-none flex min-h-11 items-center justify-center rounded-full px-4 text-sm transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-navy peer-disabled:opacity-50 motion-reduce:transition-none ${participantType === option.value ? 'font-bold text-navy' : 'font-medium text-slate-400 hover:text-slate-600'}`}>
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {participantType === 'guest' && <div className="space-y-1">
            <label htmlFor="manual-inviter" className="text-[10px] font-bold text-slate-400 uppercase">초대한 동아리원</label>
            <div className="relative">
              <select id="manual-inviter" required value={invitedByAttendeeId} onChange={e => setInvitedByAttendeeId(e.target.value)} className={`input-field appearance-none pr-10 ${invitedByAttendeeId ? 'text-slate-800' : 'text-slate-400'}`}>
                <option value="">참석 중인 회원 선택</option>
                {inviters.map(a => <option key={a.id} value={a.id}>{a.name} · {attendeeMember(a, members)?.nickname} · {attendeeMember(a, members)?.studentId}</option>)}
              </select>
              <ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            {!inviters.length && <p className="pt-1 text-xs leading-relaxed text-slate-500">초대한 회원을 먼저 추가해주세요.</p>}
          </div>}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">이름</label>
            <input 
              type="text"
              className="input-field"
              placeholder="홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          {participantType === 'member' && <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">학번 (선택)</label>
            <input 
              type="text"
              className="input-field"
              placeholder="예: 25"
              value={studentIdPrefix}
              onChange={(e) => setStudentIdPrefix(e.target.value)}
            />
          </div>}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">음료 (선택)</label>
            <input 
              type="text"
              className="input-field"
              placeholder="음료명 입력"
              value={drink}
              onChange={(e) => setDrink(e.target.value)}
            />
          </div>
          {participantType === 'member' && <><div className="space-y-1">
            <label className="flex min-h-11 items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-slate-300 accent-navy focus:ring-navy"
                checked={afterparty}
                onChange={(e) => setAfterparty(e.target.checked)}
              />
              <span className="text-xs font-bold text-slate-600">뒤풀이 참석</span>
            </label>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">희망사항 (선택)</label>
            <input 
              type="text"
              className="input-field"
              placeholder="예: 홍길동과 같은 조"
              value={request}
              onChange={(e) => setRequest(e.target.value)}
            />
          </div>
          </>}
          <div className="pt-4">
            <button 
              type="submit" 
              disabled={isAdding || !name.trim() || (participantType === 'guest' && !inviters.some(a => a.id === invitedByAttendeeId))}
              className="w-full bg-navy text-white font-bold py-2.5 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition"
            >
              {isAdding ? '추가 중...' : '추가하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
