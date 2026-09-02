import React from 'react';
import { SessionGroup, Attendee, Member } from '../types';
import { CheckCircle2, Activity, ArrowRight, Trash2, X, AlertTriangle, Plus, Loader2 } from 'lucide-react';
import BoardMemberBadge from './BoardMemberBadge';

export interface GroupsCanvasProps {
  isAdminModeActive?: boolean;
  sessionName: string;
  setSessionName: (name: string) => void;
  sessionDate: string;
  setSessionDate: (date: string) => void;
  groups: SessionGroup[];
  setGroups: (groups: SessionGroup[]) => void;
  isAutoMode: boolean;
  onAutoAssign: () => void;
  onCostModalOpen: () => void;
  onExportSimulation: () => void;
  onMoveToRecord: () => void;
  saving?: boolean;
  editingGroupId: string | null;
  setEditingGroupId: (id: string | null) => void;
  editingGroupName: string;
  setEditingGroupName: (name: string) => void;
  onUpdateTargetSize: (groupId: string, size: number) => void;
  onCreateGroup: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDropToGroup: (e: React.DragEvent, groupId: string) => void;
  onDragStart: (e: React.DragEvent, memberId: string, source: string) => void;
  removeFromGroup: (memberId: string, groupId: string) => void;
  attendees: Attendee[];
  getMemberFromInfo: (name?: string, studentIdPrefix?: string) => Member | undefined;
  memberAttendanceCount: Record<string, number>;
  activeRequestId: string | null;
  setActiveRequestId: (id: string | null) => void;
  getReunionWarnings: (attendeeIds: string[]) => string[];
  calculateGroupAverageStudentId: (attendeeIds: string[]) => number | string;
  calculateGroupAverageAttendance: (attendeeIds: string[]) => number;
}

export default function GroupsCanvas({
  isAdminModeActive,
  sessionName,
  setSessionName,
  sessionDate,
  setSessionDate,
  groups,
  setGroups,
  isAutoMode,
  onAutoAssign,
  onCostModalOpen,
  onExportSimulation,
  onMoveToRecord,
  saving = false,
  editingGroupId,
  setEditingGroupId,
  editingGroupName,
  setEditingGroupName,
  onUpdateTargetSize,
  onCreateGroup,
  onDragOver,
  onDropToGroup,
  onDragStart,
  removeFromGroup,
  attendees,
  getMemberFromInfo,
  memberAttendanceCount,
  activeRequestId,
  setActiveRequestId,
  getReunionWarnings,
  calculateGroupAverageStudentId,
  calculateGroupAverageAttendance,
}: GroupsCanvasProps) {
  return (
    <div className="md:col-span-3">
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
        <div className="p-4 border-b border-transparent flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50/50 gap-4 md:gap-0">
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center md:w-auto md:max-w-[55%]">
            <input 
              value={sessionName} onChange={e => setSessionName(e.target.value)}
              aria-label="세션명"
              className="w-full min-w-0 text-lg font-black bg-transparent border-none focus:ring-0 p-0 text-slate-800 sm:flex-1"
            />
            <input 
              type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)}
              aria-label="세션 날짜"
              className="w-full shrink-0 text-sm font-bold bg-transparent border-none focus:ring-0 p-0 text-slate-500 sm:w-auto"
            />
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto justify-start md:justify-end">
            {isAutoMode && (
              <button 
                onClick={onAutoAssign}
                className="flex items-center gap-1 md:gap-2 px-3 py-2 md:px-5 md:py-2 bg-orange-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-orange-100 hover:bg-orange-600 transition animate-pulse whitespace-nowrap"
              >
                <CheckCircle2 size={14} className="shrink-0" /> <span className="hidden sm:inline">조편성 시작</span><span className="sm:hidden">시작</span>
              </button>
            )}
            <button 
              onClick={onCostModalOpen}
              className="flex items-center gap-1 md:gap-2 px-3 py-2 md:px-5 md:py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-bold shadow-sm transition whitespace-nowrap"
            >
              <Activity size={14} className="shrink-0" /> <span className="hidden sm:inline">비용평가지표</span><span className="sm:hidden">지표</span>
            </button>
            {isAdminModeActive && (
              <button 
                onClick={onExportSimulation}
                className="flex items-center gap-1 md:gap-2 px-3 py-2 md:px-5 md:py-2 bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 rounded-lg text-xs font-bold shadow-sm transition whitespace-nowrap"
              >
                <Activity size={14} className="shrink-0" /> <span className="hidden sm:inline">분포 데이터 추출</span><span className="sm:hidden">추출</span>
              </button>
            )}
            <button 
              onClick={onMoveToRecord}
              disabled={saving}
              className="flex items-center gap-1 md:gap-2 px-3 py-2 md:px-5 md:py-2 bg-navy hover:bg-gold text-white rounded-lg text-xs font-bold shadow-lg shadow-sm transition whitespace-nowrap"
            >
              <span className="hidden sm:inline">{saving ? '저장 중…' : '오늘의 모임 시작'}</span><span className="sm:hidden">{saving ? '저장 중…' : '모임 시작'}</span>
              {saving ? <Loader2 size={14} className="shrink-0 animate-spin" /> : <ArrowRight size={14} className="shrink-0" />}
            </button>
          </div>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto bg-slate-50/30">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {groups.map((group, idx) => (
              <div key={group.id} className="bg-white rounded-xl shadow-sm">
                <div className="p-3 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
                  <div className="flex items-center gap-2">
                    {editingGroupId === group.id ? (
                      <input
                        type="text"
                        value={editingGroupName}
                        onChange={(e) => setEditingGroupName(e.target.value)}
                        onBlur={() => {
                          setGroups(groups.map(g => g.id === group.id ? { ...g, name: editingGroupName } : g));
                          setEditingGroupId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setGroups(groups.map(g => g.id === group.id ? { ...g, name: editingGroupName } : g));
                            setEditingGroupId(null);
                          }
                        }}
                        className="text-[11px] font-black text-navy uppercase bg-slate-100 border-none outline-none rounded px-1 min-w-[60px]"
                        autoFocus
                      />
                    ) : (
                      <span 
                        className="text-[11px] font-black text-navy hover:text-gold uppercase cursor-pointer"
                        onClick={() => {
                          setEditingGroupId(group.id);
                          setEditingGroupName(group.name || `TEAM ${idx + 1}`);
                        }}
                      >
                        {group.name || `TEAM ${idx + 1}`}
                      </span>
                    )}
                    {isAutoMode && (
                      <div className="flex items-center gap-1 ml-2">
                        <span className="text-[10px] text-slate-400 font-bold">목표:</span>
                        <input 
                          type="number" 
                          min="1"
                          value={group.targetSize || ''} 
                          onChange={(e) => onUpdateTargetSize(group.id, parseInt(e.target.value) || 0)}
                          className="w-10 h-6 text-[10px] bg-white rounded px-1 font-bold text-center"
                          placeholder="인원"
                        />
                      </div>
                    )}
                  </div>
                  <button onClick={() => setGroups(groups.filter(g => g.id !== group.id))} className="text-slate-300 hover:text-red-500">
                    <Trash2 size={12} />
                  </button>
                </div>
                <div 
                  className="p-3 min-h-[100px]"
                  onDragOver={onDragOver}
                  onDrop={(e) => onDropToGroup(e, group.id)}
                >
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set<string>(group.memberIds)).map(aId => {
                      const a = attendees.find(x => x.id === aId);
                      const m = getMemberFromInfo(a?.name, a?.studentIdPrefix);
                      const borderColor = m?.isBoardMember 
                        ? 'border-l-gold' 
                        : m?.gender === '여' ? 'border-l-crimson' : 'border-l-blue-400';
                      return (
                        <div 
                          key={aId} 
                          draggable
                          onDragStart={(e) => onDragStart(e, aId, group.id)}
                          className={`flex flex-col gap-1 px-2 py-1.5 bg-white rounded shadow-sm cursor-grab border-l-2 ${borderColor}`}
                        >
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="text-[11px] font-bold whitespace-nowrap">{a?.name}</span>
                            {m?.isBoardMember && <BoardMemberBadge />}
                            <button onClick={() => removeFromGroup(aId, group.id)} className="text-slate-300 hover:text-red-500"><X size={10} /></button>
                          </div>
                          <div className="flex gap-1 text-[9px] text-slate-400 font-bold mb-1">
                            {a?.studentIdPrefix && <span className="text-slate-500">{a.studentIdPrefix}학번</span>}
                            {a?.afterparty && <span title="뒷풀이 예정">🍻</span>}
                            {a?.request && (
                              <div className="relative group/req flex items-center">
                                <span 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setActiveRequestId(activeRequestId === a.id ? null : a.id); 
                                  }} 
                                  className="text-orange-500 cursor-pointer"
                                >
                                  💬
                                </span>
                                {activeRequestId === a.id && (
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-800 text-white text-[10px] p-2 rounded shadow-xl z-50 whitespace-nowrap">
                                    <span className="font-bold text-orange-300">{a.name}</span>: {a.request}
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {(!m || memberAttendanceCount[m.id] === 0) && (
                            <div className="text-[10px] text-orange-600 bg-orange-50 px-2 py-1.5 rounded-md font-bold flex items-center gap-1.5 border border-orange-100/50">
                              <AlertTriangle size={12} className="shrink-0" /> ⚠️ 처음 왔어요
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {group.memberIds.length === 0 && (
                      <p className="m-auto text-[10px] text-slate-300 italic py-4">신청자를 끌어다 놓으세요</p>
                    )}
                  </div>
                  
                  <div className="mt-4">
                    {getReunionWarnings(group.memberIds).map((warn, i) => (
                      <div key={i} className="text-[10px] text-orange-600 bg-orange-50 px-2 py-1.5 rounded-md font-bold flex items-center gap-1.5 mb-1.5 border border-orange-100/50">
                        <AlertTriangle size={12} className="shrink-0" /> ⚠️ 재회 주의: {warn}님은 최근 자주 같은 조였습니다.
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="bg-slate-50 flex justify-between items-center p-3 rounded-b-xl border-t border-slate-100">
                  <div className="flex gap-2">
                    <span className="text-[10px] font-bold text-slate-500">조 평균 학번</span>
                    <span className="text-xs font-black text-navy">{calculateGroupAverageStudentId(group.memberIds) || '-'}학번</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[10px] font-bold text-slate-500">조 평균 참석 횟수</span>
                    <span className="text-xs font-black text-navy">{calculateGroupAverageAttendance(group.memberIds).toFixed(1)}회</span>
                  </div>
                </div>
              </div>
            ))}
            
            <button 
              onClick={onCreateGroup}
              className="border-2 border-dashed border-transparent rounded-xl flex flex-col items-center justify-center p-6 text-slate-400 hover:border-gold hover:text-navy hover:text-gold transition-all group"
            >
              <Plus size={24} className="group-hover:scale-110 mb-1 transition-transform" />
              <span className="text-[10px] font-bold uppercase tracking-widest">신규 팀 추가</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
