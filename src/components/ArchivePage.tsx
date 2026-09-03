import React from 'react';
import PageHeader from './PageHeader';
import { BarChart } from 'lucide-react';
import { useArchiveLogic } from '../hooks/useArchiveLogic';
import { GAME_GENRES as AVAILABLE_GENRES } from '../domain/games/gameCatalog';
import { ARCHIVE_DIFFICULTY_RANGES } from '../domain/stats/archiveGameFilters';

import ArchiveWidgetRanking from './ArchiveWidgetRanking';
import ArchiveWidgetPopularGames from './ArchiveWidgetPopularGames';
import ArchiveWidgetCorePlayers from './ArchiveWidgetCorePlayers';
import ArchiveWidgetCharts from './ArchiveWidgetCharts';
import ArchiveExpandedChartModal from './ArchiveExpandedChartModal';
import ArchiveFormulaModal from './ArchiveFormulaModal';

export default function ArchivePage() {
  const {
    games,
    selectedSemester,
    setSelectedSemester,
    availableSemesters,
    filteredSessions,
    
    rankingIncludeBoardMembers, setRankingIncludeBoardMembers,
    attendanceRankingMetric, setAttendanceRankingMetric,
    attendanceRanking,

    popularGameGenres, setPopularGameGenres,
    popularGameDifficulties, setPopularGameDifficulties,
    popularGames,

    corePlayerGenres, setCorePlayerGenres,
    corePlayerDifficulties, setCorePlayerDifficulties,
    corePlayerIncludeBoardMembers, setCorePlayerIncludeBoardMembers,
    corePlayerGameIds, setCorePlayerGameIds,
    corePlayerGameSearch, setCorePlayerGameSearch,
    corePlayers,

    expandedChart, setExpandedChart,
    formulaModal, setFormulaModal,

    attendanceTrendMetric, setAttendanceTrendMetric,
    attendanceTrend,

    normalizeNewcomerTrend, setNormalizeNewcomerTrend,
    newcomerTrend,

    stagnationTrend,
    gameMmi,
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
              {availableSemesters.map(s => <option key={s} value={s}>{s === '전체' ? '전체 학기' : `${s} 학기`}</option>)}
            </select>
          </div>
        }
      />

      <div className="flex-1 min-h-[400px]">
        <div className="space-y-6">
          <ArchiveWidgetRanking
            selectedSemester={selectedSemester}
            filteredSessionsLength={filteredSessions.length}
            rankingIncludeBoardMembers={rankingIncludeBoardMembers}
            setRankingIncludeBoardMembers={setRankingIncludeBoardMembers}
            attendanceRankingMetric={attendanceRankingMetric}
            setAttendanceRankingMetric={setAttendanceRankingMetric}
            attendanceRanking={attendanceRanking}
          />

          <ArchiveWidgetPopularGames
            selectedSemester={selectedSemester}
            popularGameGenres={popularGameGenres}
            setPopularGameGenres={setPopularGameGenres}
            popularGameDifficulties={popularGameDifficulties}
            setPopularGameDifficulties={setPopularGameDifficulties}
            popularGames={popularGames}
            availableGenres={AVAILABLE_GENRES}
            difficultyRanges={ARCHIVE_DIFFICULTY_RANGES}
          />

          <ArchiveWidgetCorePlayers
            selectedSemester={selectedSemester}
            corePlayerIncludeBoardMembers={corePlayerIncludeBoardMembers}
            setCorePlayerIncludeBoardMembers={setCorePlayerIncludeBoardMembers}
            corePlayerGenres={corePlayerGenres}
            setCorePlayerGenres={setCorePlayerGenres}
            corePlayerDifficulties={corePlayerDifficulties}
            setCorePlayerDifficulties={setCorePlayerDifficulties}
            corePlayerGameIds={corePlayerGameIds}
            setCorePlayerGameIds={setCorePlayerGameIds}
            corePlayerGameSearch={corePlayerGameSearch}
            setCorePlayerGameSearch={setCorePlayerGameSearch}
            games={games}
            corePlayers={corePlayers}
            availableGenres={AVAILABLE_GENRES}
            difficultyRanges={ARCHIVE_DIFFICULTY_RANGES}
          />

          <ArchiveWidgetCharts
            selectedSemester={selectedSemester}
            attendanceTrendMetric={attendanceTrendMetric}
            setAttendanceTrendMetric={setAttendanceTrendMetric}
            attendanceTrend={attendanceTrend}
            setExpandedChart={setExpandedChart}
            normalizeNewcomerTrend={normalizeNewcomerTrend}
            setNormalizeNewcomerTrend={setNormalizeNewcomerTrend}
            newcomerTrend={newcomerTrend}
            setFormulaModal={setFormulaModal}
            stagnationTrend={stagnationTrend}
            gameMmi={gameMmi}
          />
        </div>
      </div>

      <ArchiveExpandedChartModal
        selectedSemester={selectedSemester}
        expandedChart={expandedChart}
        setExpandedChart={setExpandedChart}
        attendanceTrendMetric={attendanceTrendMetric}
        setAttendanceTrendMetric={setAttendanceTrendMetric}
        attendanceTrend={attendanceTrend}
        normalizeNewcomerTrend={normalizeNewcomerTrend}
        setNormalizeNewcomerTrend={setNormalizeNewcomerTrend}
        newcomerTrend={newcomerTrend}
        stagnationTrend={stagnationTrend}
      />

      <ArchiveFormulaModal
        formulaModal={formulaModal}
        setFormulaModal={setFormulaModal}
      />
    </div>
  );
}
