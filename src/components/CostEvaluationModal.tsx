import React from 'react';
import { Activity, X } from 'lucide-react';
import { SessionGroup, Attendee, Member } from '../types';
import { ECONOMIC_WEIGHTS } from '../constants/economicWeights';
import { getMemberFromAttendee } from '../domain/matching/getMemberFromAttendee';

export default function CostEvaluationModal({ 
  isOpen, 
  onClose, 
  groups, 
  attendees, 
  members, 
  memberAttendanceCount, 
  memberPairRecentCounts,
  memberPairLastSession
}: {
  isOpen: boolean;
  onClose: () => void;
  groups: SessionGroup[];
  attendees: Attendee[];
  members: Member[];
  memberAttendanceCount: Record<string, number>;
  memberPairRecentCounts: Record<string, number>;
  memberPairLastSession: Record<string, boolean>;
}) {
  const getMemberFromInfo = React.useCallback((name?: string, studentIdPrefix?: string) => {
    return getMemberFromAttendee(members, name, studentIdPrefix);
  }, [members]);

  const requestedPairs = React.useMemo(() => {
    const pairs: {a: string, b: string}[] = [];
    attendees.forEach(attA => {
      if (attA.request) {
        const memA = getMemberFromInfo(attA.name, attA.studentIdPrefix);
        if (!memA) return;
        members.forEach(memB => {
          if (memA.id !== memB.id && attA.request!.includes(memB.name)) {
            pairs.push({ a: memA.id, b: memB.id });
          }
        });
      }
    });
    return pairs;
  }, [attendees, members]);

  const overallGenderRatio = React.useMemo(() => {
    const globalMems = attendees.map(a => getMemberFromInfo(a.name, a.studentIdPrefix)).filter(Boolean) as Member[];
    const totalCount = globalMems.length || 1;
    return globalMems.filter(m => m.gender === '여').length / totalCount;
  }, [attendees, members]);

  const globalAvgAttendance = React.useMemo(() => {
    const globalMems = attendees.map(a => getMemberFromInfo(a.name, a.studentIdPrefix)).filter(Boolean) as Member[];
    if (globalMems.length === 0) return 0;
    const allAtt = globalMems.map(m => memberAttendanceCount[m.id] || 0);
    return allAtt.length > 0 ? allAtt.reduce((a, b) => a + b, 0) / allAtt.length : 0;
  }, [attendees, members, memberAttendanceCount]);

  const globalVarAttendance = React.useMemo(() => {
    const globalMems = attendees.map(a => getMemberFromInfo(a.name, a.studentIdPrefix)).filter(Boolean) as Member[];
    if (globalMems.length === 0) return 0;
    const allAtt = globalMems.map(m => memberAttendanceCount[m.id] || 0);
    const avg = allAtt.reduce((a, b) => a + b, 0) / allAtt.length;
    return allAtt.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / allAtt.length;
  }, [attendees, members, memberAttendanceCount]);

  const globalVPool = React.useMemo(() => {
    const globalMems = attendees.map(a => getMemberFromInfo(a.name, a.studentIdPrefix)).filter(Boolean) as Member[];
    if (globalMems.length === 0) return 0;
    const globalYears = globalMems.map(m => parseInt(m.studentId?.match(/^20(\d{2})|^(\d{2})/)?.slice(1).find(x=>x) || ECONOMIC_WEIGHTS.DEFAULT_STUDENT_YEAR));
    const globalAvgYear = globalYears.reduce((a, b) => a + b, 0) / globalYears.length;
    return globalYears.reduce((a, b) => a + Math.pow(b - globalAvgYear, 2), 0) / globalYears.length;
  }, [attendees, members]);

  const globalSTarget = React.useMemo(() => {
    const globalMems = attendees.map(a => getMemberFromInfo(a.name, a.studentIdPrefix)).filter(Boolean) as Member[];
    if (globalMems.length === 0) return 0;
    const globalSemCounts = {} as Record<string, number>;
    globalMems.forEach(m => globalSemCounts[m.semester || ''] = (globalSemCounts[m.semester || ''] || 0) + 1);
    let sPool = 0;
    Object.values(globalSemCounts).forEach(c => sPool += Math.pow(c - ECONOMIC_WEIGHTS.SEM_TARGET_COUNT, 2));
    const numGroups = groups.length || 1;
    return sPool / numGroups;
  }, [attendees, members, groups.length]);

  const getGroupCostBreakdown = (gMemberIds: string[]) => {
    const breakdown = { total: 0, ageVar: 0, semPenalty: 0, attVar: 0, genderPenalty: 0, reunionPenalty: 0, requestReward: 0 };
    if (gMemberIds.length === 0) return breakdown;
    const gMems = gMemberIds.map(id => attendees.find(a=>a.id===id)).filter(Boolean).map(a => members.find(m=>m.name===a?.name)).filter(Boolean) as Member[];
    
    const years = gMems.map(m => parseInt(m.studentId?.match(/^20(\d{2})|^(\d{2})/)?.slice(1).find(x=>x) || ECONOMIC_WEIGHTS.DEFAULT_STUDENT_YEAR));
    const avgYear = years.reduce((a, b) => a + b, 0) / (years.length || 1);
    const vGroup = years.reduce((a, b) => a + Math.pow(b - avgYear, 2), 0) / (years.length || 1);
    
    let ageVarCost = 0;
    if (globalVPool > 0) {
      ageVarCost = ((vGroup - globalVPool) / globalVPool) * ECONOMIC_WEIGHTS.AGE_VAR;
    }

    const semCounts = {} as Record<string, number>;
    gMems.forEach(m => semCounts[m.semester || ''] = (semCounts[m.semester || ''] || 0) + 1);
    let sGroup = 0;
    Object.values(semCounts).forEach(c => sGroup += Math.pow(c - ECONOMIC_WEIGHTS.SEM_TARGET_COUNT, 2));
    let semPenalty = 0;
    if (globalSTarget > 0) {
      semPenalty = (sGroup - globalSTarget) / globalSTarget;
    }

    const attCounts = gMems.map(m => memberAttendanceCount[m.id] || 0);
    const avgAtt = attCounts.reduce((a, b) => a + b, 0) / (attCounts.length || 1);
    
    let attVarCost = 0;
    if (globalVarAttendance >= ECONOMIC_WEIGHTS.ATT_VAR_THRESHOLD) {
      const expectedGroupVarAtt = globalVarAttendance / (gMems.length || 1);
      attVarCost = (((Math.pow(avgAtt - globalAvgAttendance, 2)) - expectedGroupVarAtt) / (expectedGroupVarAtt + ECONOMIC_WEIGHTS.ATT_VAR_EPSILON)) * ECONOMIC_WEIGHTS.ATT_VAR;
    }

    let reunionPenalty = 0;
    let requestReward = 0;
    for(let i = 0; i < gMems.length; i++) {
      for(let j = i + 1; j < gMems.length; j++) {
        const id1 = gMems[i].id;
        const id2 = gMems[j].id;
        const pair = [id1, id2].sort().join('|');
        if ((memberPairRecentCounts[pair] || 0) >= ECONOMIC_WEIGHTS.REUNION_RECENT_THRESHOLD) reunionPenalty += ECONOMIC_WEIGHTS.REUNION_RECENT;
        if (memberPairLastSession[pair]) reunionPenalty += ECONOMIC_WEIGHTS.REUNION_LAST;
        
        const matchedPair = requestedPairs.some(p => (p.a === id1 && p.b === id2) || (p.a === id2 && p.b === id1));
        if (matchedPair) requestReward += ECONOMIC_WEIGHTS.REQUEST_REWARD;
      }
    }

    let genderCost = 0;
    if (overallGenderRatio > 0 && overallGenderRatio < 1) {
      const n = gMems.length || 1;
      const expectedGenderError = Math.sqrt((overallGenderRatio * (1 - overallGenderRatio)) / n);
      if (expectedGenderError >= ECONOMIC_WEIGHTS.GENDER_ERROR_THRESHOLD) {
        const groupFemaleRatio = gMems.filter(m => m.gender === '여').length / n;
        genderCost = ((Math.abs(groupFemaleRatio - overallGenderRatio) - expectedGenderError) / (expectedGenderError + ECONOMIC_WEIGHTS.GENDER_ERROR_EPSILON)) * ECONOMIC_WEIGHTS.GENDER_PENALTY;
      }
    }

    const total = ageVarCost + (semPenalty * ECONOMIC_WEIGHTS.SEM_PENALTY) + attVarCost + genderCost + reunionPenalty - requestReward;
    
    return {
      total,
      ageVar: ageVarCost,
      semPenalty: semPenalty * ECONOMIC_WEIGHTS.SEM_PENALTY,
      attVar: attVarCost,
      genderPenalty: genderCost,
      reunionPenalty,
      requestReward
    };
  };

  const costBreakdowns = groups.map((g, index) => ({
    name: g.name || `TEAM ${index + 1}`,
    breakdown: getGroupCostBreakdown(g.memberIds)
  }));
  const totalCost = costBreakdowns.reduce((acc, curr) => acc + curr.breakdown.total, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b flex justify-between items-center bg-navy text-white">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Activity size={20} className="text-gold" />
            비용 평가지표 분석
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-full transition">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto bg-slate-50">
          <div className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
            <span className="font-bold text-slate-700">전체 평가지표 총합</span>
            <span className="text-2xl font-black text-navy">{totalCost.toFixed(2)}</span>
          </div>
          <div className="space-y-4">
            {costBreakdowns.map((item, i) => (
              <div key={i} className="bg-white border text-left border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800 text-base">{item.name}</h3>
                  <span className="font-bold text-white bg-navy px-3 py-1 rounded-full text-xs shadow-sm tracking-wide">총 비용: {item.breakdown.total.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                  <div className="bg-slate-50 p-3 rounded-lg flex flex-col items-start text-left">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">학번 편차 (x{ECONOMIC_WEIGHTS.AGE_VAR.toFixed(1)})</span>
                    <span className="font-medium text-slate-700">{item.breakdown.ageVar.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg flex flex-col items-start text-left">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">기수 편차 (x{ECONOMIC_WEIGHTS.SEM_PENALTY.toFixed(1)})</span>
                    <span className="font-medium text-slate-700">{item.breakdown.semPenalty.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg flex flex-col items-start text-left">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">출석 편차 (x{ECONOMIC_WEIGHTS.ATT_VAR.toFixed(1)})</span>
                    <span className="font-medium text-slate-700">{item.breakdown.attVar.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg flex flex-col items-start text-left">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">성비 편차 (x{ECONOMIC_WEIGHTS.GENDER_PENALTY.toFixed(1)})</span>
                    <span className="font-medium text-slate-700">{item.breakdown.genderPenalty.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg flex flex-col items-start text-left">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">재회 페널티</span>
                    <span className="font-medium text-slate-700">{item.breakdown.reunionPenalty.toFixed(2)}</span>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg flex flex-col items-start text-left">
                    <span className="text-emerald-600 text-[10px] font-bold uppercase tracking-wider mb-1">희망 조원 보상</span>
                    <span className="font-bold text-emerald-700">-{item.breakdown.requestReward.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
