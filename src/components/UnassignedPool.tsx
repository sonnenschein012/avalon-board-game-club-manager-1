import React from 'react';
import { Attendee, Member } from '../types';
import { X, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

export interface UnassignedPoolProps {
  unassignedAttendees: Attendee[];
  getMemberFromInfo: (name?: string, studentIdPrefix?: string) => Member | undefined;
  memberAttendanceCount: Record<string, number>;
  onManualAddOpen: () => void;
  onDragStart: (e: React.DragEvent, memberId: string, source: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDropToUnassigned: (e: React.DragEvent) => void;
  onQuickAddMember: (attendee: Attendee) => void;
  onDeleteAttendee: (attendee: Attendee) => void;
}

export default function UnassignedPool({
  unassignedAttendees,
  getMemberFromInfo,
  memberAttendanceCount,
  onManualAddOpen,
  onDragStart,
  onDragOver,
  onDropToUnassigned,
  onQuickAddMember,
  onDeleteAttendee,
}: UnassignedPoolProps) {
  return (
    <div className="md:col-span-1 bg-white rounded-2xl shadow-sm flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
        <h3 className="text-xs font-bold text-slate-400 uppercase">출석 명단 / 미배정 ({unassignedAttendees.length})</h3>
        <button 
          onClick={onManualAddOpen}
          className="text-[10px] font-bold bg-navy text-white hover:bg-slate-800 px-2 py-1 rounded transition"
        >
          + 명단 추가
        </button>
      </div>
      <div 
        className="p-4 space-y-2 grow overflow-y-auto"
        onDragOver={onDragOver}
        onDrop={onDropToUnassigned}
      >
        {unassignedAttendees.length === 0 && (
          <p className="text-[10px] text-slate-300 italic text-center p-4">명단이 없습니다.</p>
        )}
        {unassignedAttendees.map(a => {
          const m = getMemberFromInfo(a.name, a.studentIdPrefix);
          const isRegistered = !!m;

          return (
            <div 
              key={a.id} 
              draggable={isRegistered}
              onDragStart={isRegistered ? (e) => onDragStart(e, a.id, 'unassigned') : undefined}
              className={cn(
                "p-3 bg-slate-50 rounded-lg flex flex-col gap-1 transition-colors relative",
                isRegistered ? "cursor-grab active:cursor-grabbing hover:border-transparent" : "opacity-80 grayscale"
              )}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-black text-slate-800">{a.name}</p>
                  {a.studentIdPrefix && <p className="text-[10px] text-slate-400">{a.studentIdPrefix}학번</p>}
                </div>
                <div className="flex gap-1 items-center">
                  {!isRegistered && (
                    <button 
                      onClick={() => onQuickAddMember(a)}
                      className="text-[9px] px-2 py-1 bg-orange-100 text-orange-600 rounded whitespace-nowrap hover:bg-orange-200 font-bold"
                    >
                      + 멤버 추가
                    </button>
                  )}
                  <button 
                    onClick={() => onDeleteAttendee(a)}
                    className="p-1 text-slate-300 hover:text-red-500 rounded-full hover:bg-red-50 transition"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
              
              <div className="flex gap-2 text-[10px] text-slate-500 font-bold">
                {a.drink && <span>🥤 {a.drink}</span>}
                {a.afterparty && <span>🍻 뒷풀이참석</span>}
              </div>
              {a.request && <p className="text-[10px] text-orange-500 mt-1 italic leading-tight bg-orange-50 p-1.5 rounded">"{a.request}"</p>}
              {(!isRegistered || memberAttendanceCount[m?.id || ''] === 0) && (
                <div className="text-[10px] text-orange-600 bg-orange-50 px-2 py-1.5 rounded-md font-bold flex items-center gap-1.5 mt-1 border border-orange-100/50 w-fit">
                  <AlertTriangle size={12} className="shrink-0" /> ⚠️ 처음 왔어요
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
