# Coverage

판정 기준: `있음`은 JSX/CSS/SVG/시각 상태·반응형·레이아웃 근거가 있는 파일이다. `main.tsx`는 `index.css`를 로드하므로 전역 시각 진입점으로 포함했다. 도메인 파일의 일반 문자열 `fixed`는 제외했다.

| 파일 경로 | 시각 관련 여부 | 분류 태그 | 기록된 문서 | 제외 사유 또는 핵심 근거 |
|---|---|---|---|---|
| `src/App.tsx` | 있음 | [FOUNDATION] [LAYOUT] [RESPONSIVE] | 01, 03, 04 | 셸, header, padding, overflow |
| `src/components/ApplicantCsvImportModal.tsx` | 있음 | [OUT-OF-PILOT] [MODAL] [TABLE] | 05 | modal, form, preview table |
| `src/components/ApplicantDetailModal.tsx` | 있음 | [OUT-OF-PILOT] [MODAL] [OVERFLOW] | 05 | fixed modal, sticky header, table-like content |
| `src/components/ApplicantFormModal.tsx` | 있음 | [OUT-OF-PILOT] [MODAL] [FORM] | 05 | modal/form classes |
| `src/components/ArchiveExpandedChartModal.tsx` | 있음 | [OUT-OF-PILOT] [CHART] [MODAL] | 05 | chart modal |
| `src/components/ArchiveFormulaModal.tsx` | 있음 | [OUT-OF-PILOT] [MODAL] | 05 | fixed overlay and panel |
| `src/components/ArchivePage.tsx` | 있음 | [OUT-OF-PILOT] [CHART] [CARD] | 05 | archive widget layout |
| `src/components/ArchiveWidgetCharts.tsx` | 있음 | [OUT-OF-PILOT] [CHART] | 05 | chart widget styling |
| `src/components/ArchiveWidgetCorePlayers.tsx` | 있음 | [OUT-OF-PILOT] [CHART] [CARD] | 05 | ranking/card styling |
| `src/components/ArchiveWidgetPopularGames.tsx` | 있음 | [OUT-OF-PILOT] [CHART] [CARD] | 05 | widget/card styling |
| `src/components/ArchiveWidgetRanking.tsx` | 있음 | [OUT-OF-PILOT] [CHART] [CARD] | 05 | ranking widget styling |
| `src/components/AttendancePage.tsx` | 있음 | [OUT-OF-PILOT] [DENSE-UI] [TABLE] | 05 | attendance layout/status classes |
| `src/components/AutoAssignmentPanel.tsx` | 있음 | [OUT-OF-PILOT] [DENSE-UI] | 05 | assignment panel UI |
| `src/components/AvailabilityGrid.tsx` | 있음 | [OUT-OF-PILOT] [DENSE-UI] [TABLE] [SCROLL] | 05 | availability grid and overflow |
| `src/components/AvalonLogo.tsx` | 있음 | [SHARED] [ICON] | 01, 02 | SVG viewBox/className |
| `src/components/ConfirmDeleteModal.tsx` | 있음 | [SHARED] [MODAL] [BUTTON] | 02, 03 | fixed modal and destructive buttons |
| `src/components/CostEvaluationModal.tsx` | 있음 | [OUT-OF-PILOT] [MODAL] [DENSE-UI] | 05 | modal/panel UI |
| `src/components/FilterPills.tsx` | 있음 | [OUT-OF-PILOT] [DENSE-UI] | 05 | pill classes |
| `src/components/GameFilters.tsx` | 있음 | [OUT-OF-PILOT] [FILTER] [INPUT] | 05 | filter inputs |
| `src/components/GameForm.tsx` | 있음 | [OUT-OF-PILOT] [FORM] [INPUT] | 05 | form/input classes |
| `src/components/GameList.tsx` | 있음 | [OUT-OF-PILOT] [TABLE] [CARD] | 05 | list/card classes |
| `src/components/GamesPage.tsx` | 있음 | [OUT-OF-PILOT] [LAYOUT] | 05 | page layout/actions |
| `src/components/GroupGamesEditModal.tsx` | 있음 | [OUT-OF-PILOT] [MODAL] [DENSE-UI] | 05 | modal UI |
| `src/components/GroupsCanvas.tsx` | 있음 | [OUT-OF-PILOT] [CANVAS] | 05 | canvas/group layout |
| `src/components/icons/DiamondSvg.tsx` | 있음 | [OUT-OF-PILOT] [ICON] | 05 | SVG icon |
| `src/components/icons/RookSvg.tsx` | 있음 | [OUT-OF-PILOT] [ICON] | 05 | SVG icon |
| `src/components/InterviewerDashboard.tsx` | 있음 | [OUT-OF-PILOT] [DENSE-UI] [CARD] | 05 | dashboard UI |
| `src/components/InterviewersPanel.tsx` | 있음 | [OUT-OF-PILOT] [DENSE-UI] | 05 | panel UI |
| `src/components/InterviewRoundFormModal.tsx` | 있음 | [OUT-OF-PILOT] [MODAL] [FORM] | 05 | modal/form UI |
| `src/components/InterviewRoundPage.tsx` | 있음 | [OUT-OF-PILOT] [DENSE-UI] | 05 | page layout |
| `src/components/InterviewRoundsPage.tsx` | 있음 | [OUT-OF-PILOT] [DENSE-UI] | 05 | page/layout classes |
| `src/components/InterviewSchedulePanel.tsx` | 있음 | [OUT-OF-PILOT] [DENSE-UI] [TABLE] | 05 | schedule panel/grid |
| `src/components/InterviewWorkspaceModal.tsx` | 있음 | [OUT-OF-PILOT] [MODAL] [DENSE-UI] | 05 | workspace modal |
| `src/components/LoginGate.tsx` | 있음 | [OUT-OF-PILOT] [CARD] [LAYOUT] | 05 | login gate surface |
| `src/components/ManualAddModal.tsx` | 있음 | [OUT-OF-PILOT] [MODAL] [FORM] | 05 | modal/form UI |
| `src/components/MeetingCardStyleModal.tsx` | 있음 | [OUT-OF-PILOT] [MODAL] [CARD] | 05 | card style modal |
| `src/components/MeetingCanvasTab.tsx` | 있음 | [OUT-OF-PILOT] [CANVAS] | 05 | canvas tab UI |
| `src/components/MeetingDashboardTab.tsx` | 있음 | [OUT-OF-PILOT] [CARD] [DENSE-UI] | 05 | dashboard cards |
| `src/components/MeetingProgressPage.tsx` | 있음 | [OUT-OF-PILOT] [CANVAS] [LAYOUT] | 05 | meeting progress layout |
| `src/components/MemberFilters.tsx` | 있음 | [PILOT] [FILTER] [INPUT] | 03, 04 | tabs, search, selects |
| `src/components/MemberForm.tsx` | 있음 | [PILOT] [FORM] [INPUT] [LAYOUT] | 01, 03 | form grid, fields, pills |
| `src/components/MemberList.tsx` | 있음 | [PILOT] [TABLE] [MOBILE] [DESKTOP] | 01, 03, 04 | desktop/mobile list, overflow |
| `src/components/MemberProfileModal.tsx` | 있음 | [PILOT] [PROFILE] [MODAL] [OVERFLOW] | 01, 03, 04 | drawer, summary, timeline |
| `src/components/MembersPage.tsx` | 있음 | [PILOT] [MEMBERS] [BUTTON] [LAYOUT] | 03, 04 | page header/actions |
| `src/components/PageHeader.tsx` | 있음 | [SHARED] [CARD] [LAYOUT] | 02, 03 | shared header |
| `src/components/PublicInterviewPage.tsx` | 있음 | [OUT-OF-PILOT] [PUBLIC-PAGE] [FORM] | 05 | public form/panel |
| `src/components/SelectionDetailModal.tsx` | 있음 | [OUT-OF-PILOT] [MODAL] [DENSE-UI] | 05 | detail modal |
| `src/components/SelectionPanel.tsx` | 있음 | [OUT-OF-PILOT] [DENSE-UI] | 05 | selection panel |
| `src/components/SessionFormModal.tsx` | 있음 | [OUT-OF-PILOT] [MODAL] [FORM] | 05 | modal/form UI |
| `src/components/SessionList.tsx` | 있음 | [OUT-OF-PILOT] [TABLE] [CARD] | 05 | session list UI |
| `src/components/SessionsPage.tsx` | 있음 | [OUT-OF-PILOT] [RESPONSIVE] [BUTTON] | 05 | responsive actions |
| `src/components/SettingsAdminPanel.tsx` | 있음 | [OUT-OF-PILOT] [FORM] [TABLE] | 05 | admin form/table |
| `src/components/SettingsExportPanel.tsx` | 있음 | [OUT-OF-PILOT] [CARD] [BUTTON] | 05 | export cards/buttons |
| `src/components/SettingsPage.tsx` | 있음 | [OUT-OF-PILOT] [CARD] [FORM] | 05 | settings layout/toggle |
| `src/components/Sidebar.tsx` | 있음 | [SHARED] [NAV] [RESPONSIVE] [FIXED] | 01, 02, 03, 04 | fixed/sticky nav, ResizeObserver |
| `src/components/UnassignedPool.tsx` | 있음 | [OUT-OF-PILOT] [DENSE-UI] [OVERFLOW] | 05 | pool UI |
| `src/constants/economicWeights.ts` | 없음 | — | — | numeric constants only |
| `src/domain/attendance/attendanceHelpers.ts` | 없음 | — | — | attendance calculations |
| `src/domain/attendance/csvParser.ts` | 없음 | — | — | CSV parsing |
| `src/domain/interviews/applicantCsv.test.ts` | 없음 | — | — | test only |
| `src/domain/interviews/applicantCsv.ts` | 없음 | — | — | CSV/domain data |
| `src/domain/interviews/applicantMerge.test.ts` | 없음 | — | — | test only |
| `src/domain/interviews/applicantMerge.ts` | 없음 | — | — | merge logic |
| `src/domain/interviews/applicantSort.test.ts` | 없음 | — | — | test only |
| `src/domain/interviews/applicantSort.ts` | 없음 | — | — | sort logic |
| `src/domain/interviews/autoAssignment.test.ts` | 없음 | — | — | `fixed` is test data string, not CSS |
| `src/domain/interviews/autoAssignment.ts` | 없음 | — | — | `fixed` is domain state, not layout |
| `src/domain/interviews/availabilitySummary.test.ts` | 없음 | — | — | test only |
| `src/domain/interviews/availabilitySummary.ts` | 없음 | — | — | summary logic |
| `src/domain/interviews/interviewCompletion.test.ts` | 없음 | — | — | test only |
| `src/domain/interviews/interviewCompletion.ts` | 없음 | — | — | completion logic |
| `src/domain/interviews/interviewTransitions.test.ts` | 없음 | — | — | test only |
| `src/domain/interviews/interviewTransitions.ts` | 없음 | — | — | transition logic |
| `src/domain/interviews/interviewV3Policy.test.ts` | 없음 | — | — | test only |
| `src/domain/interviews/interviewV3Policy.ts` | 없음 | — | — | policy logic |
| `src/domain/interviews/messages.test.ts` | 없음 | — | — | test only |
| `src/domain/interviews/messages.ts` | 없음 | — | — | message logic |
| `src/domain/interviews/publicTimeWindow.test.ts` | 없음 | — | — | test only |
| `src/domain/interviews/publicTimeWindow.ts` | 없음 | — | — | time-window logic |
| `src/domain/interviews/reassignment.test.ts` | 없음 | — | — | test only |
| `src/domain/interviews/reassignment.ts` | 없음 | — | — | reassignment logic |
| `src/domain/interviews/scheduling.test.ts` | 없음 | — | — | test only |
| `src/domain/interviews/scheduling.ts` | 없음 | — | — | scheduling logic |
| `src/domain/matching/autoAssignAlgorithm.ts` | 없음 | — | — | matching algorithm |
| `src/domain/matching/getMemberFromAttendee.test.ts` | 없음 | — | — | test only |
| `src/domain/matching/getMemberFromAttendee.ts` | 없음 | — | — | lookup logic |
| `src/domain/matching/groupCostFunction.test.ts` | 없음 | — | — | test only |
| `src/domain/matching/groupCostFunction.ts` | 없음 | — | — | cost logic |
| `src/domain/matching/isSameName.test.ts` | 없음 | — | — | test only |
| `src/domain/matching/isSameName.ts` | 없음 | — | — | comparison logic |
| `src/domain/meeting/progressHelpers.ts` | 없음 | — | — | progress calculations |
| `src/domain/recommendation/recommendGames.test.ts` | 없음 | — | — | test only |
| `src/domain/recommendation/recommendGames.ts` | 없음 | — | — | recommendation logic |
| `src/domain/semester/getSemester.ts` | 없음 | — | — | semester helper |
| `src/domain/stats/getAttendanceRanking.ts` | 없음 | — | — | stats calculation |
| `src/domain/stats/getAttendanceTrend.ts` | 없음 | — | — | stats calculation |
| `src/domain/stats/getCorePlayers.ts` | 없음 | — | — | stats calculation |
| `src/domain/stats/getGameMmi.ts` | 없음 | — | — | stats calculation |
| `src/domain/stats/getNewcomerTrend.ts` | 없음 | — | — | stats calculation |
| `src/domain/stats/getPopularGames.ts` | 없음 | — | — | stats calculation |
| `src/domain/stats/getSemesterRosterCounts.test.ts` | 없음 | — | — | test only |
| `src/domain/stats/getSemesterRosterCounts.ts` | 없음 | — | — | stats calculation |
| `src/domain/stats/getStagnationIndex.ts` | 없음 | — | — | stats calculation |
| `src/hooks/useArchiveLogic.ts` | 없음 | — | — | state/data hook; no visual markup |
| `src/hooks/useAttendanceLogic.ts` | 없음 | — | — | state/data hook; no visual markup |
| `src/hooks/useFirestore.ts` | 없음 | — | — | Firebase hook |
| `src/hooks/useGamesLogic.ts` | 없음 | — | — | state/data hook |
| `src/hooks/useInterviewNoteLogic.ts` | 없음 | — | — | state/data hook |
| `src/hooks/useInterviewRoundLogic.ts` | 없음 | — | — | state/data hook |
| `src/hooks/useInterviewRoundsLogic.ts` | 없음 | — | — | state/data hook |
| `src/hooks/useMeetingProgressLogic.ts` | 없음 | — | — | state/data hook |
| `src/hooks/useMembersLogic.ts` | 없음 | — | — | member data/state; JSX is in components |
| `src/hooks/usePublicInterviewLogic.test.ts` | 없음 | — | — | test only |
| `src/hooks/usePublicInterviewLogic.ts` | 없음 | — | — | state/data hook |
| `src/hooks/useSessionsLogic.ts` | 없음 | — | — | state/data hook |
| `src/index.css` | 있음 | [FOUNDATION] [COLOR] [TYPE] [SPACING] | 01, 03 | global CSS and utility classes |
| `src/lib/chunkBatch.ts` | 없음 | — | — | utility logic |
| `src/lib/firebase.ts` | 없음 | — | — | Firebase setup |
| `src/lib/utils.ts` | 없음 | — | — | utility functions |
| `src/main.tsx` | 있음 | [FOUNDATION] [LAYOUT] | 01 | imports global CSS and mounts app |
| `src/services/attendeesService.test.ts` | 없음 | — | — | test only |
| `src/services/attendeesService.ts` | 없음 | — | — | service logic |
| `src/services/captureService.ts` | 없음 | — | — | capture/service logic |
| `src/services/interviewsService.ts` | 없음 | — | — | service logic |
| `src/services/publicInterviewService.ts` | 없음 | — | — | service logic |
| `src/tests/firestore.rules.test.ts` | 없음 | — | — | rules test |
| `src/types.ts` | 없음 | — | — | type declarations |

## 집계

- 전수 조사: 127개
- 시각 관련 있음: 58개
- 제외: 69개
- 미판정: 0개
- 문서화 완료: 58개
