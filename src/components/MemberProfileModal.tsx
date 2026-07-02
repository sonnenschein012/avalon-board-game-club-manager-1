import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Gamepad2 } from 'lucide-react';
import { Member, Game, Session } from '../types';
import { db } from '../lib/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { formatTimestamp } from '../lib/utils';
import { toast } from 'sonner';

interface MemberProfileModalProps {
  member: Member | null;
  onClose: () => void;
  games: Game[];
  members: Member[];
}

export default function MemberProfileModal({ member, onClose, games, members }: MemberProfileModalProps) {
  const [memberSessions, setMemberSessions] = useState<Session[]>([]);

  useEffect(() => {
    if (member) {
      const fetchHistory = async () => {
        try {
          const q = query(collection(db, 'sessions'), orderBy('date', 'desc'));
          const snap = await getDocs(q);
          const filtered = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Session))
            .filter(s => s.groups.some(g => (g.memberIds as string[]).includes(member.id)));
          setMemberSessions(filtered);
        } catch (error) {
          console.error(error);
          toast.error('활동 기록을 불러오는 중 오류가 발생했습니다.');
        }
      };
      fetchHistory();
    }
  }, [member]);

  if (!member) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col p-4 md:p-8 overflow-y-auto"
        >
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 md:top-6 md:right-6 p-2 hover:bg-slate-100 rounded-lg transition-colors z-10"
            title="닫기"
          >
            <X size={20} />
          </button>

          <div className="space-y-8 md:space-y-12">
            {/* Profile Header */}
            <div className="flex flex-wrap items-center gap-4 md:gap-6 mt-4 md:mt-0">
              <div className="w-16 h-16 md:w-20 md:h-20 shrink-0 bg-navy hover:bg-gold rounded-3xl flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-sm">
                {member.name?.[0] || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-3xl font-black text-slate-800 flex flex-wrap items-center gap-2 md:gap-3">
                  <span className="break-all">{member.name}</span>
                  {member.isBoardMember && <span title="임원" className="text-2xl shrink-0">👑</span>}
                </h2>
                <p className="text-xs font-medium text-slate-400 italic break-all">@{member.nickname || member.name} • {member.studentId}</p>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">성별</p>
                <p className="text-sm font-bold">{member.gender}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">가입 학기</p>
                <p className="text-sm font-bold">{member.semester}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">참석 횟수</p>
                <p className="text-sm font-bold text-navy hover:text-gold">{memberSessions.length}회</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">선호 장르</p>
                <p className="text-sm font-bold text-slate-800 leading-snug">
                  {(Array.isArray(member.preferredGenre) && member.preferredGenre.length > 0)
                    ? member.preferredGenre.map(genre => (
                        <span key={genre} className="inline-block mr-1 mb-1 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-xs">
                          {genre}
                        </span>
                      ))
                    : (!Array.isArray(member.preferredGenre) && member.preferredGenre 
                        ? member.preferredGenre 
                        : <span className="text-slate-400 italic font-mono text-xs">미지정</span>)}
                </p>
              </div>
              <div className="col-span-2 md:col-span-4 p-4 bg-slate-50 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">메모</p>
                <p className="text-xs text-slate-600 leading-relaxed italic">{member.memo || '기록된 메모가 없습니다.'}</p>
              </div>
            </div>

            {/* All Played Games (Aggregated) */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Gamepad2 size={16} /> 플레이한 모든 게임
              </h3>
              <div className="p-4 bg-slate-50 rounded-xl  flex flex-wrap gap-2">
                {(() => {
                  const playedGameStrings = new Set<string>();
                  memberSessions.forEach(session => {
                    const group = session.groups.find(g => (g.memberIds as string[]).includes(member.id));
                    if (group && group.gameIds) {
                      group.gameIds.forEach(id => playedGameStrings.add(id));
                    }
                  });
                  const playedArray = Array.from(playedGameStrings).map(gId => {
                    return games.find(g => g.id === gId || g.title === gId)?.title || gId;
                  });

                  if (playedArray.length === 0) {
                    return <span className="text-xs text-slate-400 italic">아직 플레이한 게임이 없습니다.</span>;
                  }

                  return playedArray.map((title, idx) => (
                    <span key={idx} className="text-xs font-bold text-slate-700 bg-white  px-2 py-1 rounded shadow-sm">
                      {title}
                    </span>
                  ));
                })()}
              </div>
            </div>

            {/* Session History */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Calendar size={16} /> 참석 및 조 편성 기록
              </h3>
              <div className="space-y-4 border-l-2 border-transparent pl-4 py-2">
                {memberSessions.length === 0 && (
                  <p className="text-xs text-slate-400 italic">아직 참여한 세션 기록이 없습니다.</p>
                )}
                {memberSessions.map(session => {
                  const group = session.groups.find(g => (g.memberIds as string[]).includes(member.id));
                  const teammates = members.filter(m => (group?.memberIds as string[] | undefined)?.includes(m.id) && m.id !== member.id);
                  return (
                    <div key={session.id} className="relative group">
                      <div className="absolute -left-[21px] top-2 w-3 h-3 bg-white border-2 border-indigo-500 rounded-full group-hover:scale-125 transition-transform" />
                      <div className="p-4 bg-slate-50 hover:bg-slate-100 hover:border-transparent  rounded-xl transition-all space-y-2">
                        <div className="flex justify-between items-start">
                          <p className="text-xs font-bold text-slate-800">{formatTimestamp(session.date)}</p>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-navy hover:text-gold">
                            <span>{group?.name || '조 이름 없음'}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 bg-white p-2  rounded-lg">
                          {(group?.gameIds || []).map((gId, gIdx) => {
                            const title = games.find(g => g.id === gId || g.title === gId)?.title || gId;
                            return (
                            <span key={`${gId}-${gIdx}`} className="text-[10px] font-black text-slate-800 uppercase bg-slate-50  px-1.5 py-0.5 rounded shadow-sm">
                              {title}
                            </span>
                          )})}
                          {(!group?.gameIds || group?.gameIds.length === 0) && (
                            <span className="text-xs font-black text-slate-400 uppercase italic">기록된 게임 없음</span>
                          )}
                        </div>
                        <div className="pt-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">함께 플레이한 조원</p>
                          <div className="flex flex-wrap gap-1">
                            {teammates.length > 0 ? teammates.map(t => (
                              <span key={t.id} className="text-[10px] bg-slate-50 text-navy px-1.5 py-0.5 rounded font-medium">
                                {t.name}
                              </span>
                            )) : (
                              <span className="text-[10px] text-slate-400">조원 없음</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
