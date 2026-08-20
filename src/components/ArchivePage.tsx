import React from 'react';
import PageHeader from './PageHeader';
import { BarChart } from 'lucide-react';
import { useArchiveLogic } from '../hooks/useArchiveLogic';

import ArchiveWidgetRanking from './ArchiveWidgetRanking';
import ArchiveWidgetPopularGames from './ArchiveWidgetPopularGames';
import ArchiveWidgetCorePlayers from './ArchiveWidgetCorePlayers';
import ArchiveWidgetCharts from './ArchiveWidgetCharts';
import ArchiveExpandedChartModal from './ArchiveExpandedChartModal';
import ArchiveFormulaModal from './ArchiveFormulaModal';

const AVAILABLE_GENRES = ['카드', '파티', '협상', '전략', '타일', '경매', '추리', '수학', '마피아', '심리', '협력', '주사위', '순발력', '퍼즐', '그림', '기억력', '배팅', '타이쿤', '퀴즈', '단어'];
const DIFFICULTY_RANGES = [
  { label: '1점대' },
  { label: '2점대' },
  { label: '3점대' },
  { label: '4점대 이상' }
];

export default function ArchivePage() {
  const {
    games,
    selectedSemester,
    setSelectedSemester,
    availableSemesters,
    filteredSessions,
    
    includeBoardMembers, setIncludeBoardMembers,
    attendanceMetric, setAttendanceMetric,
    w1Ranking,

    w2Genres, setW2Genres,
    w2Difficulties, setW2Difficulties,
    w2PopularGames,

    w3Genres, setW3Genres,
    w3Difficulties, setW3Difficulties,
    w3IncludeBoardMembers, setW3IncludeBoardMembers,
    w3TargetGames, setW3TargetGames,
    w3GameSearchQuery, setW3GameSearchQuery,
    w3CorePlayers,

    expandedChart, setExpandedChart,
    formulaModal, setFormulaModal,

    w4Metric, setW4Metric,
    w4Data,

    w5Normalize, setW5Normalize,
    w5Data,

    w6Data,
    w7MMI,
  } = useArchiveLogic();

  return (
    <div className="space-y-6 flex flex-col min-h-full pb-10">
      <PageHeader 
        title="통계 및 아카이브"
        subtitle="DATA & ANALYTICS"
        icon={BarChart}
        actions={
          <div className="flex items-center gap-3">
            <select 
              value={selectedSemester} 
              onChange={e => setSelectedSemester(e.target.value)}
              className="bg-white border text-sm border-slate-100 rounded-xl px-4 py-2.5 font-bold focus:outline-none shadow-sm text-slate-600 focus:ring-2 focus:ring-navy/20 cursor-pointer"
            >
              {availableSemesters.map(s => <option key={s} value={s}>{`${s} 학기`}</option>)}
            </select>
          </div>
        }
      />

      <div className="flex-1 min-h-[400px]">
        <div className="space-y-6">
          <ArchiveWidgetRanking
            selectedSemester={selectedSemester}
            filteredSessionsLength={filteredSessions.length}
            includeBoardMembers={includeBoardMembers}
            setIncludeBoardMembers={setIncludeBoardMembers}
            attendanceMetric={attendanceMetric}
            setAttendanceMetric={setAttendanceMetric}
            w1Ranking={w1Ranking}
          />

          <ArchiveWidgetPopularGames
            selectedSemester={selectedSemester}
            w2Genres={w2Genres}
            setW2Genres={setW2Genres}
            w2Difficulties={w2Difficulties}
            setW2Difficulties={setW2Difficulties}
            w2PopularGames={w2PopularGames}
            AVAILABLE_GENRES={AVAILABLE_GENRES}
            DIFFICULTY_RANGES={DIFFICULTY_RANGES}
          />

          <ArchiveWidgetCorePlayers
            selectedSemester={selectedSemester}
            w3IncludeBoardMembers={w3IncludeBoardMembers}
            setW3IncludeBoardMembers={setW3IncludeBoardMembers}
            w3Genres={w3Genres}
            setW3Genres={setW3Genres}
            w3Difficulties={w3Difficulties}
            setW3Difficulties={setW3Difficulties}
            w3TargetGames={w3TargetGames}
            setW3TargetGames={setW3TargetGames}
            w3GameSearchQuery={w3GameSearchQuery}
            setW3GameSearchQuery={setW3GameSearchQuery}
            games={games}
            w3CorePlayers={w3CorePlayers}
            AVAILABLE_GENRES={AVAILABLE_GENRES}
            DIFFICULTY_RANGES={DIFFICULTY_RANGES}
          />

          <ArchiveWidgetCharts
            w4Metric={w4Metric}
            setW4Metric={setW4Metric}
            w4Data={w4Data}
            setExpandedChart={setExpandedChart}
            w5Normalize={w5Normalize}
            setW5Normalize={setW5Normalize}
            w5Data={w5Data}
            setFormulaModal={setFormulaModal}
            w6Data={w6Data}
            w7MMI={w7MMI}
          />
        </div>
      </div>

      <ArchiveExpandedChartModal
        expandedChart={expandedChart}
        setExpandedChart={setExpandedChart}
        w4Metric={w4Metric}
        setW4Metric={setW4Metric}
        w4Data={w4Data}
        w5Normalize={w5Normalize}
        setW5Normalize={setW5Normalize}
        w5Data={w5Data}
        w6Data={w6Data}
      />

      <ArchiveFormulaModal
        formulaModal={formulaModal}
        setFormulaModal={setFormulaModal}
      />
    </div>
  );
}
