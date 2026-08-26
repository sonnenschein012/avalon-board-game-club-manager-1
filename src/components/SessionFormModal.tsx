import React from 'react';
import { Loader2, Save, Plus, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Member, Game, SessionGroup } from '../types';
import { cn } from '../lib/utils';
import { DndContext, useDraggable, useDroppable, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

export interface ModalControl {
  isAdding: boolean;
  editingSessionId: string | null;
  handleClose: () => void;
  handleSave: () => void;
  saving?: boolean;
}

export interface SessionData {
  sessionName: string;
  setSessionName: (val: string) => void;
  sessionDate: string;
  setSessionDate: (val: string) => void;
}

export interface CoreData {
  members: Member[];
  games: Game[];
  groups: SessionGroup[];
  setGroups: React.Dispatch<React.SetStateAction<SessionGroup[]>>;
  unassignedIds: string[];
}

export interface GroupActions {
  assignToGroup: (memberId: string, groupId: string) => void;
  updateGroupName: (groupId: string, newName: string) => void;
  toggleGameInGroup: (gameId: string, groupId: string) => void;
  removeFromGroup: (memberId: string, groupId: string) => void;
  handleCreateGroup: () => void;
}

export interface DndHandlers {
  onDragEnd: (event: DragEndEvent) => void;
}

function DraggableMember({ memberId, source, children, className }: { memberId: string, source: string, children: React.ReactNode, className?: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: memberId,
    data: { source }
  });
  
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 999 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={className}>
      {children}
    </div>
  );
}

function DroppablePool({ id, className, children }: { id: string, className?: string, children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && "ring-2 ring-gold bg-indigo-50/50")}>
      {children}
    </div>
  );
}

interface SessionFormModalProps {
  modalControl: ModalControl;
  sessionData: SessionData;
  coreData: CoreData;
  groupActions: GroupActions;
  dndHandlers: DndHandlers;
}

export default function SessionFormModal({
  modalControl: { isAdding, handleClose, handleSave, editingSessionId, saving = false },
  sessionData: { sessionName, setSessionName, sessionDate, setSessionDate },
  coreData: { members, games, groups, setGroups, unassignedIds },
  groupActions: { assignToGroup, updateGroupName, toggleGameInGroup, removeFromGroup, handleCreateGroup },
  dndHandlers: { onDragEnd }
}: SessionFormModalProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  return (
    <AnimatePresence>
      {isAdding && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
        >
          <div className="bg-slate-50 w-full max-w-6xl h-full rounded-3xl shadow-2xl flex flex-col overflow-hidden ">
            {/* Builder Header */}
            <div className="p-6 bg-white border-b border-transparent flex flex-wrap justify-between items-center gap-4 shrink-0">
              <div className="flex flex-wrap items-center gap-6 w-full md:w-auto">
                <div className="space-y-1 w-full sm:w-auto">
                  <label className="text-xs font-bold text-navy hover:text-gold uppercase">세션 명칭</label>
                  <input 
                    value={sessionName} onChange={e => setSessionName(e.target.value)}
                    className="text-3xl font-black bg-transparent border-none focus:ring-0 p-0 placeholder:text-slate-200 w-full min-w-[200px]"
                  />
                </div>
                <div className="hidden md:block w-px h-10 bg-slate-100" />
                <div className="space-y-1 w-full sm:w-auto mt-2 sm:mt-0">
                  <label className="text-xs font-bold text-slate-400 uppercase">날짜 선택</label>
                  <input 
                    type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)}
                    className="text-sm font-bold bg-transparent border-none focus:ring-0 p-0 text-slate-500 w-full"
                  />
                </div>
              </div>
              <div className="flex gap-2 w-full md:w-auto justify-end mt-4 md:mt-0">
                <button onClick={handleClose} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 uppercase">닫기</button>
                <button onClick={handleSave} disabled={saving} className="flex flex-1 md:flex-none justify-center items-center gap-2 px-6 py-2 bg-navy hover:bg-gold text-white rounded-xl font-black shadow-lg shadow-sm text-xs uppercase disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="shrink-0 animate-spin" /> : <Save size={16} className="shrink-0" />} {saving ? (editingSessionId ? '수정 중…' : '저장 중…') : editingSessionId ? '수정' : '저장'}
                </button>
              </div>
            </div>

            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
              <div className="flex-1 overflow-y-auto flex flex-col md:flex-row min-h-0 bg-slate-50/50">
                {/* Unassigned Pool */}
                <div className="w-full md:w-72 bg-white md:border-r border-slate-100 flex flex-col shrink-0 order-2 md:order-1">
                  <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 sticky top-0 z-10">
                    <h3 className="text-xs font-bold text-slate-400 uppercase">미배정 인원 ({unassignedIds.length})</h3>
                  </div>
                  <DroppablePool
                    id="unassigned"
                    className="p-4 space-y-2 grow transition-colors"
                  >
                    {Array.from(new Set<string>(unassignedIds)).map(id => {
                      const m = members.find(x => x.id === id);
                      return (
                        <DraggableMember 
                          key={id}
                          memberId={id}
                          source="unassigned"
                          className="p-3 bg-slate-50 rounded-lg flex flex-wrap gap-2 justify-between items-center group cursor-grab active:cursor-grabbing hover:border-transparent transition-colors"
                        >
                          <div>
                            <p className="text-xs font-black">{m?.name}</p>
                            <p className="text-[10px] text-slate-400">{m?.nickname}</p>
                          </div>
                          <div className="flex flex-wrap gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            {groups.map((g, i) => (
                              <button 
                                key={g.id} 
                                onClick={() => assignToGroup(id, g.id)}
                                className="w-6 h-6 bg-navy hover:bg-gold text-white rounded flex items-center justify-center text-[10px] font-bold"
                              >
                                {i + 1}
                              </button>
                            ))}
                          </div>
                        </DraggableMember>
                      );
                    })}
                  </DroppablePool>
                </div>

              {/* Groups Canvas */}
              <div className="flex-1 p-4 md:p-8 space-y-4 md:space-y-8 order-1 md:order-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {groups.map((group, idx) => (
                    <div key={group.id} className="bg-white  rounded-2xl shadow-sm flex flex-col">
                      <div className="p-4 border-b border-transparent flex justify-between items-center bg-slate-50/30">
                        <input 
                          className="text-xs font-black text-navy hover:text-gold uppercase bg-transparent border-none p-0 focus:ring-0 placeholder:text-indigo-300"
                          placeholder={`TEAM ${idx + 1}`}
                          value={group.name || ''}
                          onChange={e => updateGroupName(group.id, e.target.value)}
                        />
                        <button onClick={() => setGroups(groups.filter(g => g.id !== group.id))} className="text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="p-4 space-y-4">
                        {/* Game Selector (Multiple) */}
                        <div className="space-y-2">
                           <label className="text-[10px] font-bold text-slate-400 uppercase">플레이 게임 (다중 선택)</label>
                           <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl  max-h-32 overflow-y-auto">
                             {games.map(game => {
                               const isSelected = group.gameIds?.includes(game.id) || group.gameIds?.includes(game.title);
                               return (
                                 <button
                                   key={game.id}
                                   onClick={() => toggleGameInGroup(game.id, group.id)}
                                   className={cn(
                                     "text-[10px] px-2 py-1 rounded transition-all font-bold",
                                     isSelected 
                                       ? "bg-navy hover:bg-gold text-white shadow-sm" 
                                       : "bg-white text-slate-400  hover:border-transparent"
                                   )}
                                 >
                                   {game.title}
                                 </button>
                               );
                             })}
                           </div>
                           {/* Selected Games Summary */}
                           <div className="flex flex-wrap gap-1 mt-1">
                             {group.gameIds?.map((gId, gIdx) => {
                               const title = games.find(g => g.id === gId || g.title === gId)?.title || gId;
                               return (
                               <span key={`${gId}-${gIdx}`} className="text-[9px] font-black text-navy hover:text-gold uppercase bg-slate-50 px-1.5 py-0.5 rounded">
                                 {title}
                               </span>
                             )})}
                           </div>
                        </div>

                        {/* Member List */}
                        <div className="space-y-2">
                           <label className="text-[10px] font-bold text-slate-400 uppercase">참여 멤버 ({group.memberIds.length})</label>
                           <DroppablePool 
                             id={group.id}
                             className="flex flex-wrap gap-2 min-h-[60px] bg-slate-50 p-2 rounded-xl border border-dashed border-transparent transition-colors hover:bg-slate-100"
                           >
                             {Array.from(new Set<string>(group.memberIds)).map(mId => {
                               const m = members.find(x => x.id === mId);
                               return (
                                 <DraggableMember 
                                   key={mId}
                                   memberId={mId}
                                   source={group.id}
                                   className="flex items-center gap-2 pl-2 pr-1 py-1 bg-white rounded-lg shadow-sm cursor-grab active:cursor-grabbing hover:border-transparent"
                                 >
                                   <span className="text-xs font-bold">{m?.name}</span>
                                   <button 
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       removeFromGroup(mId, group.id);
                                     }} 
                                     className="text-slate-300 hover:text-red-500"
                                     onPointerDown={(e) => e.stopPropagation()}
                                   >
                                     <X size={12} />
                                   </button>
                                 </DraggableMember>
                               );
                             })}
                             {group.memberIds.length === 0 && (
                               <p className="m-auto text-[10px] text-slate-300 italic">멤버를 이쪽으로 배정하세요</p>
                             )}
                           </DroppablePool>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button 
                    onClick={handleCreateGroup}
                    className="border-2 border-dashed border-transparent rounded-2xl flex flex-col items-center justify-center p-8 text-slate-400 hover:border-gold hover:text-navy hover:text-gold transition-all group"
                  >
                    <Plus size={32} className="group-hover:scale-110 transition-transform" />
                    <span className="mt-2 text-xs font-bold uppercase tracking-widest">신규 팀(조) 추가</span>
                  </button>
                </div>
              </div>
              </div>
            </DndContext>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
