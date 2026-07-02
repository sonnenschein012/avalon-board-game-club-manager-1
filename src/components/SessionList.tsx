import React from 'react';
import { Calendar, Edit2, Trash2, History } from 'lucide-react';
import { Session, Member, Game } from '../types';
import { formatTimestamp } from '../lib/utils';

interface SessionListProps {
  filteredSessions: Session[];
  members: Member[];
  games: Game[];
  handleEdit: (session: Session) => void;
  setItemToDelete: (item: { id: string, name: string }) => void;
  setViewingMember: (member: Member) => void;
}

export default function SessionList({
  filteredSessions, members, games, handleEdit, setItemToDelete, setViewingMember
}: SessionListProps) {
  return (
    <div className="space-y-6">
      {filteredSessions.map(session => (
        <div key={session.id} className="relative">
          <div className="flex items-center gap-4 mb-4 border-b border-transparent pb-2">
            <div className="w-10 h-10 bg-slate-50 text-navy hover:text-gold rounded-xl flex items-center justify-center">
              <Calendar size={20} />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-slate-800 uppercase leading-none">{session.name}</h2>
              <p className="text-[11px] font-mono text-slate-400 mt-1">{formatTimestamp(session.date)}</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => handleEdit(session)}
                className="p-2 text-slate-300 hover:text-navy hover:text-gold transition-colors bg-white rounded-lg  hover:border-transparent"
              >
                <Edit2 size={16} />
              </button>
              <button 
                onClick={() => setItemToDelete({ id: session.id, name: session.name })}
                className="p-2 text-slate-300 hover:text-red-500 transition-colors bg-white rounded-lg  hover:border-red-100"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {session.groups.map((group, gIdx) => {
              const groupMembers = members.filter(m => (group.memberIds as string[]).includes(m.id));
              return (
                <div key={group.id || gIdx} className="glass-panel p-5 space-y-4 hover:border-transparent transition-colors">
                  <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                    <div className="flex items-center gap-2">
                       <div className="w-6 h-6 bg-navy hover:bg-gold text-white rounded text-[10px] font-bold flex items-center justify-center">
                         {gIdx + 1}
                       </div>
                       <span className="text-xs font-black text-slate-800 tracking-tighter">{group.name || `팀 ${gIdx + 1}`}</span>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1 max-w-[50%]">
                      {(group.gameIds || []).map((gId, idx) => {
                        const title = games.find(g => g.id === gId || g.title === gId)?.title || gId;
                        return (
                        <span key={`${gId}-${idx}`} className="text-[9px] px-1.5 py-0.5 bg-slate-50 text-navy hover:text-gold rounded font-bold uppercase ">
                          {title}
                        </span>
                      )})}
                      {(!group.gameIds || group.gameIds.length === 0) && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-50 text-slate-400 rounded font-bold uppercase">NO GAMES</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">조원 명단</p>
                    <div className="flex flex-wrap gap-1">
                      {groupMembers.map(m => (
                        <button 
                          key={m.id} 
                          onClick={() => setViewingMember(m)}
                          className="text-[10px] bg-slate-50 hover:bg-slate-200  px-1.5 py-0.5 rounded font-medium text-slate-600 transition-colors"
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      
      {filteredSessions.length === 0 && (
        <div className="h-64 border-2 border-dashed border-transparent rounded-3xl flex flex-col items-center justify-center text-slate-300">
          <History size={48} className="opacity-20 mb-4" />
          <p className="text-xs font-bold uppercase tracking-widest">기록된 세션이 없습니다.</p>
        </div>
      )}
    </div>
  );
}
