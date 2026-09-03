import React, { useState } from 'react';
import { AlertCircle, Settings2, RefreshCw } from 'lucide-react';
import { Member, Game, Attendee } from '../types';
import type { DailyPlanning } from '../domain/attendance/dailyPlanning';
import { Reason, RecMode } from '../domain/recommendation/recommendGames';

interface MeetingDashboardTabProps {
  dailyPlanning: DailyPlanning;
  members: Member[];
  games: Game[];
  editingGroupId: string | null;
  editingGroupName: string;
  setEditingGroupId: (id: string | null) => void;
  setEditingGroupName: (name: string) => void;
  handleUpdateGroupName: (id: string) => void;
  getAttendeeFromMember: (m: Member) => Attendee | undefined;
  setSelectedMember: (m: Member) => void;
  groupSearchedGameIds: Record<string, string>;
  setGroupSearchedGameIds: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  memberPlayedGames: (id: string) => Set<string>;
  groupRecModes: Record<string, RecMode>;
  setGroupRecModes: React.Dispatch<React.SetStateAction<Record<string, RecMode>>>;
  recommendGames: (members: Member[], mode: RecMode, seed: number) => {game: Game, playedCount: number, score: number, reasons?: Reason[]}[];
}

export default function MeetingDashboardTab({
  dailyPlanning,
  members,
  games,
  editingGroupId,
  editingGroupName,
  setEditingGroupId,
  setEditingGroupName,
  handleUpdateGroupName,
  getAttendeeFromMember,
  setSelectedMember,
  groupSearchedGameIds,
  setGroupSearchedGameIds,
  memberPlayedGames,
  groupRecModes,
  setGroupRecModes,
  recommendGames
}: MeetingDashboardTabProps) {
  const [recSeeds, setRecSeeds] = useState<Record<string, number>>({});
  const [isRefreshing, setIsRefreshing] = useState<Record<string, boolean>>({});

  const handleRefresh = (groupId: string) => {
    setIsRefreshing(prev => ({ ...prev, [groupId]: true }));
    setRecSeeds(prev => ({ ...prev, [groupId]: (prev[groupId] || 0) + 1 }));
    setTimeout(() => {
      setIsRefreshing(prev => ({ ...prev, [groupId]: false }));
    }, 500);
  };

  return (
    <div className="space-y-8">
      {dailyPlanning.groups.map((group, idx) => {
        const groupMembers = Array.from(new Set(group.memberIds)).map(id => members.find(m => m.id === id)).filter(Boolean) as Member[];
        
        const groupRequests = groupMembers.map(m => {
          const a = getAttendeeFromMember(m);
          return {
            name: m.name,
            request: a?.request || ''
          }
        }).filter(r => r.request.trim() !== '');

        const mode: RecMode = groupRecModes[group.id] || 'SIZE_MATCH';
        const seed = recSeeds[group.id] || 0;
        const recommendations = recommendGames(groupMembers, mode, seed);

        return (
          <div key={group.id} className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm flex flex-col xl:flex-row gap-6 md:gap-8">
            <div className="flex-1 space-y-6">
              <div>
                {editingGroupId === group.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingGroupName}
                      onChange={(e) => setEditingGroupName(e.target.value)}
                      onBlur={() => handleUpdateGroupName(group.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdateGroupName(group.id)}
                      className="text-2xl font-black text-slate-800 tracking-tight bg-slate-50 border-b-2 border-navy outline-none px-2 py-1 rounded-t-lg w-full max-w-sm"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group/title">
                    <h2 
                      className="text-2xl font-black text-slate-800 tracking-tight cursor-pointer hover:text-navy transition-colors flex items-center gap-2"
                      onClick={() => {
                        setEditingGroupId(group.id);
                        setEditingGroupName(group.name || `TEAM ${idx + 1}`);
                      }}
                    >
                      {group.name || `TEAM ${idx + 1}`}
                      <Settings2 size={16} className="opacity-0 group-hover/title:opacity-100 text-slate-400 hover:text-navy transition-all" />
                    </h2>
                  </div>
                )}
                <p className="text-sm font-bold text-slate-400 mt-1">{groupMembers.length}명 참여</p>
              </div>

              {groupRequests.length > 0 && (
                <div className="bg-orange-50/50 rounded-2xl p-4 border border-orange-100">
                  <h3 className="text-xs font-black text-orange-600 uppercase tracking-widest mb-3 flex items-center gap-1"><AlertCircle size={12}/> 멤버 희망사항</h3>
                  <ul className="space-y-2">
                    {groupRequests.map((r, i) => (
                      <li key={i} className="text-sm text-orange-800 font-medium leading-relaxed">
                        <strong className="text-orange-950">{r.name}</strong>: {r.request}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">조원 명단</h3>
                <div className="flex flex-wrap gap-2">
                  {groupMembers.map(m => (
                    <button 
                      key={m.id}
                      onClick={() => setSelectedMember(m)}
                      className="px-4 py-2 bg-slate-50  rounded-xl text-sm font-bold text-slate-700 hover:border-transparent hover:bg-slate-50  transition"
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-transparent">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">특정 게임 경험 확인</h3>
                <div className="bg-slate-50 p-4 rounded-2xl flex flex-col sm:flex-row gap-4 items-center">
                  <div className="w-full sm:w-64 relative">
                    <input
                      type="text"
                      list={`games-list-${group.id}`}
                      placeholder="게임 제목 검색..."
                      value={groupSearchedGameIds[group.id] || ''}
                      onChange={(e) => setGroupSearchedGameIds(prev => ({ ...prev, [group.id]: e.target.value }))}
                      className="w-full bg-white  text-slate-700 text-sm font-bold rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-gold"
                    />
                    <datalist id={`games-list-${group.id}`}>
                      {games.map(g => (
                        <option key={g.id} value={g.title} />
                      ))}
                    </datalist>
                  </div>
                  
                  {groupSearchedGameIds[group.id] && (
                    <div className="flex-1 w-full flex justify-between items-center bg-white px-4 py-2.5 rounded-xl ">
                      <span className="text-xs font-bold text-slate-500">조원 중 경험자</span>
                      <span className="text-sm font-black text-navy hover:text-gold">
                        {(() => {
                          const gameIdOrTitle = groupSearchedGameIds[group.id];
                          const game = games.find(g => g.id === gameIdOrTitle || g.title === gameIdOrTitle);
                          if (!game) return 0;
                          return groupMembers.filter(m => {
                            const played = memberPlayedGames(m.id);
                            return played.has(game.id) || played.has(game.title);
                          }).length;
                        })()}명 <span className="text-slate-400 font-medium">/ {groupMembers.length}명</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="w-full xl:w-[400px] shrink-0 bg-white rounded-2xl p-6  shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                  맞춤 추천
                </h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleRefresh(group.id)}
                    className="p-1.5 text-slate-400 hover:text-navy hover:bg-slate-100 rounded-lg transition-colors"
                    title="재추출"
                  >
                    <RefreshCw size={14} className={isRefreshing[group.id] ? "animate-spin" : ""} />
                  </button>
                  <select 
                    value={mode}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setGroupRecModes(prev => ({ ...prev, [group.id]: e.target.value as 'SIZE_MATCH' | 'NEW_GAME' | 'POPULAR' | 'HIDDEN' | 'RANDOM' }))}
                    className="bg-slate-50 text-slate-700 font-bold px-2 py-1.5 outline-none  text-[10px] tracking-widest rounded-lg cursor-pointer"
                  >
                    <option value="SIZE_MATCH">인원 맞춤</option>
                    <option value="NEW_GAME">새로운 게임</option>
                    <option value="POPULAR">인기 게임</option>
                    <option value="HIDDEN">숨은 게임</option>
                    <option value="RANDOM">무작위 추천</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-4">
                {recommendations.length > 0 ? (
                  recommendations.map(({ game, playedCount, reasons }) => (
                    <div key={game.id} className="group relative bg-white p-6 rounded-3xl border-2 border-gold/20 shadow-sm hover:border-gold transition-all flex flex-col items-start gap-4">
                      <div className="w-full flex justify-between items-start">
                        <div>
                          <h4 className="text-xl font-black text-navy tracking-tight">{game.title}</h4>
                          <div className="flex gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2">
                            <span>{game.bestMinPlayers === game.bestMaxPlayers ? game.bestMinPlayers : `${game.bestMinPlayers}-${game.bestMaxPlayers}`}명 추천</span>
                            {game.genres && game.genres.length > 0 && <span>• {game.genres[0]}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0 flex items-center">
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] font-black text-gold px-2.5 py-1 bg-gold/10 rounded-lg whitespace-nowrap">
                              경험자 {Math.round((playedCount / (groupMembers.length || 1)) * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {reasons && reasons.length > 0 && (
                        <div className="w-full flex flex-wrap gap-2 mt-1">
                          {reasons.map((r, i) => (
                            <div key={i} className="flex flex-col gap-0.5">
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-bold self-start">{r.label}</span>
                              {r.detail && <span className="text-[10px] text-slate-400 font-medium px-1">{r.detail}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="w-full bg-slate-50 border border-slate-100 py-3 px-4 rounded-xl flex justify-between items-center mt-1">
                        <p className="text-[10px] font-bold text-slate-500">
                           조원 중 경험자
                        </p>
                        <p className="text-xs font-black text-navy">
                          {playedCount}명 <span className="text-slate-400 font-medium">/ {groupMembers.length}명</span>
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm font-medium text-slate-400 p-4  rounded-xl bg-slate-50 text-center">조건에 맞는 추천 게임이 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
