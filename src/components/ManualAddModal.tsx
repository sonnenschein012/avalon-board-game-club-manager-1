import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { Attendee, Member } from '../types';
import type { ManualAttendeeInput } from '../services/attendeesService';
import { attendeeMember, isGuest } from '../domain/attendance/guests';

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
  const inviters = attendees.filter(a => a.status !== '결석' && attendeeMember(a, members) && !attendees.some(g => isGuest(g) && g.invitedByAttendeeId === a.id));
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-navy text-white">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Plus size={16} className="text-gold" />
            명단 추가
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-full transition">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <label className="block text-xs">참가자 유형
            <select value={participantType} onChange={e => setParticipantType(e.target.value as 'member' | 'guest')} className="w-full p-2 border rounded">
              <option value="member">동아리원</option><option value="guest">게스트</option>
            </select>
          </label>
          {participantType === 'guest' && <label className="block text-xs">초대한 동아리원
            <select required value={invitedByAttendeeId} onChange={e => setInvitedByAttendeeId(e.target.value)} className="w-full p-2 border rounded">
              <option value="">참석 중인 회원 선택</option>
              {inviters.map(a => <option key={a.id} value={a.id}>{a.name} · {attendeeMember(a, members)?.nickname} · {attendeeMember(a, members)?.studentId}</option>)}
            </select>
            {!inviters.length && <p>초대한 회원을 먼저 추가해주세요. 한 회원은 게스트 1명만 초대할 수 있습니다.</p>}
          </label>}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">이름</label>
            <input 
              type="text"
              className="w-full text-sm font-bold text-navy border-b-2 border-slate-200 focus:border-gold outline-none p-2 bg-transparent"
              placeholder="홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          {participantType === 'member' && <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">학번 (옵션, 예: 25)</label>
            <input 
              type="text"
              className="w-full text-sm font-bold text-navy border-b-2 border-slate-200 focus:border-gold outline-none p-2 bg-transparent"
              placeholder="학번 앞의 2자리 (예: 25)"
              value={studentIdPrefix}
              onChange={(e) => setStudentIdPrefix(e.target.value)}
            />
          </div>}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">{participantType === 'guest' ? '게스트 희망 음료 (필수)' : '음료 (선택)'}</label>
            <input 
              type="text"
              className="w-full text-sm font-bold text-navy border-b-2 border-slate-200 focus:border-gold outline-none p-2 bg-transparent"
              placeholder="음료명 입력"
              required={participantType === 'guest'}
              value={drink}
              onChange={(e) => setDrink(e.target.value)}
            />
          </div>
          {participantType === 'member' && <><div className="space-y-1">
            <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <input
                type="checkbox"
                className="accent-gold w-4 h-4"
                checked={afterparty}
                onChange={(e) => setAfterparty(e.target.checked)}
              />
              <span className="text-sm font-bold text-navy">뒷풀이 참석</span>
            </label>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">희망사항 (선택)</label>
            <input 
              type="text"
              className="w-full text-sm font-bold text-navy border-b-2 border-slate-200 focus:border-gold outline-none p-2 bg-transparent"
              placeholder="예: 홍길동과 같은 조"
              value={request}
              onChange={(e) => setRequest(e.target.value)}
            />
          </div>
          </>}
          <div className="pt-4">
            <button 
              type="submit" 
              disabled={isAdding || !name.trim() || (participantType === 'guest' && (!drink.trim() || !inviters.some(a => a.id === invitedByAttendeeId)))}
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
