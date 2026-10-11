# Graph Report - avalon-board-game-club-manager  (2026-10-11)

## Corpus Check
- 336 files · ~166,860 words
- Verdict: corpus is large enough that graph structure adds value.
- Maintained input coverage is independently checked against scope.json; classifier gaps receive explicit semantic supplementation.

## Summary
- 1795 nodes · 5394 edges · 73 communities (63 shown, 10 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 99 edges (avg confidence: 0.9)
- Semantic token totals: unavailable in the current Codex host session.

## Graph Freshness
- Built from commit: `4d2f8130`
- Commit records provenance. Run `node scripts/graphify.mjs status` to check input and artifact content hashes.
- Official AST update is local computation; semantic extraction and six-case review are also required when business meaning changes.

## Community Hubs (Navigation)
- 학기 통계와 기록 필터
- 개인 편성 평가 모달
- 면접 일정 관리 화면
- 앱 라우팅과 공개 화면
- 출석 CSV 수정과 회원 선택
- 면접 훅의 미해결 참조
- 지원자 회원 등록
- 합성 데이터 초기화
- 조 편성 설계와 동반 정책
- 면접 회차 작업 화면
- 지원자 회원 등록
- 회원 입력과 공통 UI
- 공유 컬렉션과 설정 내보내기
- 공유 컬렉션과 설정 내보내기
- Scenario Lab과 출석 미리보기
- 출석 통계 차트
- 공개 면접과 시간 입력
- 개발 설계와 운영 절차
- 개발 검증 실행 명령
- 회원 입력과 공통 UI
- 면접 자동 배정 알고리즘
- 패키지와 실행 환경
- 계획 기록과 이름 수정
- 면접 일정 정책
- 참석자 저장과 출석 요약
- 과거 UA 검증 도구
- 공유 컬렉션과 설정 내보내기
- 면접 선발 결과와 기록
- 면접 완료와 지원자 진행
- 개발 도구 의존성
- 출석 화면과 이동
- 면접 선발 결과와 기록
- 면접 일정 변경과 감사
- 면접 완료와 지원자 진행
- 조 효용 프로토타입
- 지원자 입력 병합
- 출석 화면과 이동
- 낙관적 배정과 확인 정책
- 계획 기록과 이름 수정
- Graphify 최신성 검증기
- 지원자 상세와 안내 메시지
- TypeScript 컴파일 설정
- 면접 일정 정책
- 면접 회차와 면접관 저장
- 운영 산출물과 권한 점검 도구
- 면접 선발 결과와 기록
- 면접 수정 충돌 검증
- 공식 Graphify 분석 파이프라인
- 지원자 CSV 해석
- 운영 앱 의존성
- 운영 산출물과 권한 점검 도구
- 면접 일정 입력 폼
- 일별 세션과 도메인 검증
- 면접 일정 정책
- 면접 선발 결과와 기록
- 면접 선발 결과와 기록
- 성별 효용 분석 도구
- 합성 면접 일정과 노트
- 브라우저 시나리오 검증
- 합성 데이터 초기화
- Firestore 보안 규칙 검증
- 패키지와 실행 환경
- 프로젝트 개요와 Design Lab
- 브라우저 시나리오 검증
- 합성 지원서와 메시지
- 조 정원 선언 타입
- 운영 HTML과 앱 매니페스트
- 출석 초안 HTML 자료
- 면접 일정 넘침 HTML 자료

## God Nodes (most connected - your core abstractions)
1. `react` - 113 edges
2. `Member` - 81 edges
3. `vitest` - 76 edges
4. `lucide-react` - 67 edges
5. `firebase` - 48 edges
6. `useInterviewRoundLogic()` - 42 edges
7. `addAuditEventToTransaction()` - 42 edges
8. `Session` - 39 edges
9. `useAttendanceLogic()` - 38 edges
10. `getInterviewProgressStatus()` - 37 edges

## Surprising Connections (you probably didn't know these)
- `SettingsPage()` --shares_data_with--> `Firestore games 컬렉션`  [INFERRED]
  src/components/SettingsPage.tsx → firestore.rules
- `SettingsPage()` --shares_data_with--> `Firestore members 컬렉션`  [INFERRED]
  src/components/SettingsPage.tsx → firestore.rules
- `SettingsPage()` --shares_data_with--> `Firestore sessions 컬렉션`  [INFERRED]
  src/components/SettingsPage.tsx → firestore.rules
- `useClubExports()` --shares_data_with--> `Firestore games 컬렉션`  [INFERRED]
  src/hooks/useClubExports.ts → firestore.rules
- `useClubExports()` --shares_data_with--> `Firestore members 컬렉션`  [INFERRED]
  src/hooks/useClubExports.ts → firestore.rules

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **공유 저장 경계를 유지하는 의미 계약** — docs_development_attendee_member_ids, docs_development_boardmemberids_absent_empty, docs_development_planning_confirmed_sessions, docs_development_shared_storage_consumers [EXTRACTED 1.00]
- **정원 결정과 사전식 개인 배치** — docs_group_sizing_model_group_size_policy, docs_group_utility_model_direct_companion_requests, docs_group_utility_model_personal_utility_policy, docs_group_utility_model_bounded_pair_swap_search [EXTRACTED 1.00]
- **후보·내용해시·독립 의미 검토** — docs_knowledge_graph_graphify_primary, docs_knowledge_graph_content_hash_freshness, docs_knowledge_graph_verified_candidate_workflow, docs_knowledge_graph_six_semantic_cases [EXTRACTED 1.00]
- **Korea Design Lab calendar alignment** — docs_development_design_lab_korea_calendar, _github_workflows_ci_design_lab_process_timezone, playwright_config_korea_browser_timezone, scripts_seed_demo_korea_planning_seed, tests_design_lab_smoke_spec_nondefault_date_after_delete [INFERRED 0.95]

## Communities (73 total, 10 thin omitted)

### Community 0 - "학기 통계와 기록 필터"
Cohesion: 0.05
Nodes (76): ArchiveWidgetCorePlayersProps, ArchiveWidgetPopularGamesProps, ArchiveWidgetRankingProps, GameListProps, DiamondSvg(), RookSvg(), MeetingCanvasTab(), MeetingCanvasTabProps (+68 more)

### Community 1 - "개인 편성 평가 모달"
Cohesion: 0.05
Nodes (66): vitest, makeGroups(), solve(), CostEvaluationModalProps, detailedValues(), EvaluationDialog(), Metric(), ReadingGuide() (+58 more)

### Community 2 - "면접 일정 관리 화면"
Cohesion: 0.06
Nodes (51): addMinutesToTime(), InterviewRoundFormModal(), roundToDraft(), schedulesFromDraft(), timeToMinutes(), getRoundScheduleStatus(), getSurveyStatus(), InterviewRoundsPage() (+43 more)

### Community 3 - "앱 라우팅과 공개 화면"
Cohesion: 0.07
Nodes (44): react-router-dom, App(), ArchivePage, AttendancePage, GamesPage, InterviewRoundPage, InterviewRoundsPage, MeetingProgressPage (+36 more)

### Community 4 - "출석 CSV 수정과 회원 선택"
Cohesion: 0.07
Nodes (43): AttendanceCsvImportModal(), Confirmation binds the reviewed identity snapshot, CSV confirmation column and namesake list share semester labels, partyLabel(), Props, RowStatus(), Summary(), CsvColumnSelect() (+35 more)

### Community 5 - "면접 훅의 미해결 참조"
Cohesion: 0.06
Nodes (15): filterInterviewApplicants(), InterviewApplicantFilter, useInterviewRoundLogic(), addRoundInterviewer(), INTERVIEWER_AUDIT_FIELDS, reactivateRoundInterviewer(), removeRoundInterviewer(), removeScheduleInterviewer() (+7 more)

### Community 6 - "지원자 회원 등록"
Cohesion: 0.08
Nodes (33): papaparse, sonner, GameFormProps, collectAuditChanges(), GameCsvImport, parseGameCsv(), recommendedPlayerRange(), createGameFormData() (+25 more)

### Community 7 - "합성 데이터 초기화"
Cohesion: 0.05
Nodes (29): applicantDefinitions, applicantRecords, attendeeMembers, attendees, availabilityBySchedule, closedAvailability, closedDates, closedSlots (+21 more)

### Community 8 - "조 편성 설계와 동반 정책"
Cohesion: 0.07
Nodes (37): 참석자 ID와 저장 회원 ID, 미배정 명단의 제한된 내부 스크롤, 동반 후보 선택 임시 저장, 개발 가이드, 명시적 출석 회원 연결과 legacy fallback, scheduleId의 세 가지 앱 의미, 과거 로컬 출석 개선의 선택적 복구 기록, 편성 Worker와 취소 (+29 more)

### Community 9 - "면접 회차 작업 화면"
Cohesion: 0.09
Nodes (28): ApplicantFormModal(), applicantToDraft(), emptyDraft(), Props, ApplicantJourney(), BADGE_CLASS, InterviewRoundDeleteModal(), ApplicantRow() (+20 more)

### Community 10 - "지원자 회원 등록"
Cohesion: 0.14
Nodes (28): eligibleSelectedApplicant(), Field(), MemberRegistrationModal(), MemberRegistrationPanel(), Metric(), RegistrationTab, TabButton(), applicationValue() (+20 more)

### Community 11 - "회원 입력과 공통 UI"
Cohesion: 0.14
Nodes (25): lucide-react, motion, react, ConfirmDeleteModal(), ConfirmDeleteModalProps, GameFilters(), GameFiltersProps, GameForm() (+17 more)

### Community 12 - "공유 컬렉션과 설정 내보내기"
Cohesion: 0.12
Nodes (24): SettingsAdminPanel(), SettingsAdminPanelProps, SettingsExportPanel(), SettingsExportPanelProps, SettingsPage(), buildGamesCsv(), buildMembersCsv(), buildSessionsCsv() (+16 more)

### Community 13 - "공유 컬렉션과 설정 내보내기"
Cohesion: 0.13
Nodes (25): boardMemberIds 부재와 빈 배열, Firestore sessions 컬렉션, react-dom, cleanString(), findMember(), ImportedSession, parseSessionCsvRows(), splitNames() (+17 more)

### Community 14 - "Scenario Lab과 출석 미리보기"
Cohesion: 0.11
Nodes (30): moveAttendee(), resolveCompanionRequests(), AttendanceScenarioState, createAttendanceFixture(), createInterviewFixture(), createMembersFixture(), InterviewScenarioState, makeApplicant() (+22 more)

### Community 15 - "출석 통계 차트"
Cohesion: 0.16
Nodes (23): ArchiveLineChart(), AttendanceTrendChart(), chartPresentation, NewcomerTrendChart(), StagnationChart(), TrendChartProps, ArchiveExpandedChartModal(), ArchiveExpandedChartModalProps (+15 more)

### Community 16 - "공개 면접과 시간 입력"
Cohesion: 0.13
Nodes (25): addDaysToDateString(), calculateApplicantTimeWindow(), formatKoreanDate(), getKstDateString(), getSlotDate(), isValidDateString(), isValidTimeString(), PublicTimeWindowResult (+17 more)

### Community 17 - "개발 설계와 운영 절차"
Cohesion: 0.09
Nodes (22): Firebase 기본 프로젝트와 Hosting 대상, Git 텍스트 LF 정규화, 현재 디자인 관찰 기록, 목표 디자인 기준, 입력·산출물 해시 최신성, Graphify 0.9.84 주 탐색 도구, 미지원 텍스트 의미 보완, 새 컴퓨터 재현 (+14 more)

### Community 18 - "개발 검증 실행 명령"
Cohesion: 0.07
Nodes (30): scripts, build, build:staging, check, clean, demo, demo:reset, demo:seed (+22 more)

### Community 19 - "회원 입력과 공통 UI"
Cohesion: 0.12
Nodes (21): GroupGamesEditModal(), GroupGamesEditModalProps, MemberProfileModal(), CoreData, DndHandlers, DraggableMember(), DroppablePool(), GroupActions (+13 more)

### Community 20 - "면접 자동 배정 알고리즘"
Cohesion: 0.14
Nodes (27): addEdge(), AutoAssignmentApplicant, AutoAssignmentExisting, AutoAssignmentFailure, AutoAssignmentFailureReason, AutoAssignmentInput, AutoAssignmentInterviewer, AutoAssignmentMode (+19 more)

### Community 21 - "패키지와 실행 환경"
Cohesion: 0.08
Nodes (27): engines, node, name, private, type, version, clsx, @dnd-kit/utilities (+19 more)

### Community 22 - "계획 기록과 이름 수정"
Cohesion: 0.13
Nodes (20): firebase, MeetingRecordsModal(), button(), click(), mocks, archivedLabel(), MeetingVersionsPanel(), MeetingRecord (+12 more)

### Community 23 - "면접 일정 정책"
Cohesion: 0.14
Nodes (27): addDays(), addMinutesToSlot(), AffectedScheduleResponse, assertPositiveInteger(), AssignmentScheduleImpact, AssignmentScheduleImpactItem, assignmentsOverlap(), AvailabilityResponse (+19 more)

### Community 24 - "참석자 저장과 출석 요약"
Cohesion: 0.19
Nodes (22): Firestore attendees 컬렉션, Firestore members 컬렉션, calculateGroupAverageAttendance(), calculateGroupAverageStudentId(), getReunionWarnings(), getSizingNotices(), AttendanceMemberDraft, Harness() (+14 more)

### Community 25 - "과거 UA 검증 도구"
Cohesion: 0.14
Nodes (19): artifactHashes(), artifactNames, atomic(), canonical(), controls, cosmeticReviewIssues(), fileTypes, freshness() (+11 more)

### Community 26 - "공유 컬렉션과 설정 내보내기"
Cohesion: 0.14
Nodes (20): AuditRow(), SettingsAuditPanel(), AUDIT_ACTION_LABELS, AUDIT_CATEGORY_LABELS, AuditActionCode, AuditCategory, AuditChange, AuditEvent (+12 more)

### Community 27 - "면접 선발 결과와 기록"
Cohesion: 0.17
Nodes (18): round, DECISION_BUTTON_STYLES, getSelectionDecisionButtonClass(), SelectionDecision, copyText(), DecisionButton(), DecisionButtonProps, RATING_STYLES (+10 more)

### Community 28 - "면접 완료와 지원자 진행"
Cohesion: 0.25
Nodes (21): isAssignmentConfirmationCurrent(), getApplicantAssignmentRevision(), isActiveAssignment(), prepareScheduleResetTransition(), prepareWithdrawalTransition(), addAuditEventToTransaction(), markInterviewMessageSent(), completeInterviewAtomically() (+13 more)

### Community 29 - "개발 도구 의존성"
Cohesion: 0.08
Nodes (24): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, firebase-admin, @firebase/eslint-plugin-security-rules, @firebase/rules-unit-testing, firebase-tools (+16 more)

### Community 30 - "출석 화면과 이동"
Cohesion: 0.18
Nodes (17): @dnd-kit/core, AttendanceDraggableCard(), AttendanceDropZone(), CardProps, DropZoneProps, Disabled dragging preserves nested controls, Props, AttendanceNotice() (+9 more)

### Community 31 - "면접 선발 결과와 기록"
Cohesion: 0.15
Nodes (21): applicationValue(), ASSIGNMENT_STATUS_LABELS, assignmentColumns(), buildInterviewCsvRows(), CsvRow, formatRating(), formatSlot(), formatTimestamp() (+13 more)

### Community 32 - "면접 일정 변경과 감사"
Cohesion: 0.15
Nodes (21): AssignmentProposalWrite, CompleteInterviewInput, INTERVIEW_LINK_ORIGIN, InterviewRoundDraft, InterviewScheduleDraft, RoundInterviewerDraft, applyConcreteInterviewScheduleChange(), assignRoundInterviewerToSchedule() (+13 more)

### Community 33 - "면접 완료와 지원자 진행"
Cohesion: 0.25
Nodes (16): prepareInterviewCompletion(), prepareInterviewReopen(), canAppearInInterviewProgress(), canAppearInSchedule(), canAppearInSelection(), getInterviewProgressStatus(), isActiveInterviewApplicant(), restoreScheduledInterview() (+8 more)

### Community 34 - "조 효용 프로토타입"
Cohesion: 0.21
Nodes (16): compareAssignments(), evaluateAssignment(), EXAMPLE_PARAMETERS, key(), saturation(), stringOrder(), syntheticMembers(), evaluate() (+8 more)

### Community 35 - "지원자 입력 병합"
Cohesion: 0.13
Nodes (16): ApplicantCsvImportModal(), ApplicantCsvImportModalProps, Summary(), ParsedRow, ApplicantMergeAction, ApplicantMergePreview, ApplicantMergePreviewItem, fieldsEqual() (+8 more)

### Community 36 - "출석 화면과 이동"
Cohesion: 0.15
Nodes (17): attendanceButtonBase, attendanceButtonStyles, AttendanceDragAndDrop(), Visible pool collision and drag scroll confinement, AttendanceMemberRegistrationModal(), AttendancePage(), AttendancePageProps, CompanionRequestModal() (+9 more)

### Community 37 - "낙관적 배정과 확인 정책"
Cohesion: 0.14
Nodes (13): applyOptimisticAssignment(), assignmentIdentity(), rollbackOptimisticApplicant(), isInterviewRevisionConflict(), AssignmentData, Harness(), initialApplicant, interviewer (+5 more)

### Community 38 - "계획 기록과 이름 수정"
Cohesion: 0.18
Nodes (13): 계획과 확정 세션, 공유 저장소 간접 소비자, 필수 여섯 의미 검증 사례, Firestore DailyPlannings 컬렉션, Firestore games 컬렉션, calculateGridPositions(), generateDrinkOrderText(), koreaDateKey() (+5 more)

### Community 39 - "Graphify 최신성 검증기"
Cohesion: 0.19
Nodes (15): artifactHashes(), artifacts, atomic(), freshness(), git(), inputHash(), inventory(), walk() (+7 more)

### Community 40 - "지원자 상세와 안내 메시지"
Cohesion: 0.16
Nodes (16): ApplicantDetailModal(), copyText(), formatTimestamp(), getAssignmentParts(), getStoredAssignmentParts(), AvailabilitySummaryRow, minutesToTime(), summarizeAvailabilitySlots() (+8 more)

### Community 41 - "TypeScript 컴파일 설정"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, allowJs, exactOptionalPropertyTypes, experimentalDecorators, isolatedModules, jsx, lib (+12 more)

### Community 42 - "면접 일정 정책"
Cohesion: 0.19
Nodes (19): activeApplicant(), Bot(), CompactStatus(), confirmationCurrent(), DraggableScheduleCard(), DroppableScheduleCell(), halfHourBucket(), INTERVIEWER_THEMES (+11 more)

### Community 43 - "면접 회차와 면접관 저장"
Cohesion: 0.17
Nodes (11): useInterviewRoundData(), subscribeInterviewAccess(), subscribeInterviewApplicants(), subscribeInterviewChangeRequests(), subscribeRoundInterviewers(), subscribeRoundScheduleInterviewers(), getInterviewLink(), getInterviewRoundExportRecords() (+3 more)

### Community 44 - "운영 산출물과 권한 점검 도구"
Cohesion: 0.12
Nodes (12): baseline, current(), probe(), results, rules, distDirectory, forbiddenFiles, forbiddenMarkers (+4 more)

### Community 45 - "면접 선발 결과와 기록"
Cohesion: 0.20
Nodes (15): ApplicantDetailModalProps, Props, Info(), InterviewersPanel(), Props, RosterInfo(), Props, InterviewRoundFormModalProps (+7 more)

### Community 46 - "면접 수정 충돌 검증"
Cohesion: 0.25
Nodes (14): normalizeApplicantNumber(), assertExpectedRevision(), assertExpectedUpdatedAt(), InterviewRevisionConflictError, timestampMillis(), APPLICANT_AUDIT_FIELDS, applicantAuditView(), createInterviewApplicant() (+6 more)

### Community 47 - "공식 Graphify 분석 파이프라인"
Cohesion: 0.24
Nodes (7): ast(), build(), load(), portable(), save(), scan(), seal()

### Community 48 - "지원자 CSV 해석"
Cohesion: 0.19
Nodes (14): ApplicantCsvColumnMapping, ApplicantCsvField, ApplicantCsvPreview, ApplicantCsvPreviewRow, ApplicantCsvRowError, ApplicantCsvRowErrorCode, assertValidMapping(), duplicateError() (+6 more)

### Community 49 - "운영 앱 의존성"
Cohesion: 0.13
Nodes (15): dependencies, clsx, @dnd-kit/core, @dnd-kit/utilities, firebase, html-to-image, lucide-react, motion (+7 more)

### Community 50 - "운영 산출물과 권한 점검 도구"
Cohesion: 0.19
Nodes (7): findJava(), firebaseCli, normalizeJavaHome(), projectRoot, runEmulators(), projectRoot, projectRoot

### Community 51 - "면접 일정 입력 폼"
Cohesion: 0.31
Nodes (13): addDays(), dateFromKey(), datesInRange(), dateWeekName(), InterviewScheduleFormModal(), scheduleToDraft(), suggestedInterviewScheduleDraft(), SurveyDateTimeCard() (+5 more)

### Community 52 - "일별 세션과 도메인 검증"
Cohesion: 0.22
Nodes (9): resolveDailySessionId(), getLocalDateKey(), isSingleDocumentId(), deleteInterviewRound(), hasInterviewRoundNotes(), InterviewRoundDeletionResult, MESSAGE_TEMPLATE_AUDIT_FIELDS, ROUND_SCOPED_COLLECTIONS (+1 more)

### Community 53 - "면접 일정 정책"
Cohesion: 0.27
Nodes (11): AutoAssignmentPanel(), reasonLabel, slotLabel(), candidatesForVacatedSlot(), ReassignmentApplicant, ReassignmentInterviewer, ReassignmentRecommendation, recommendReassignment() (+3 more)

### Community 54 - "면접 선발 결과와 기록"
Cohesion: 0.26
Nodes (12): assignmentTime(), InterviewerDashboard(), isOperationalApplicant(), Metric(), Props, InterviewWorkspaceModal(), Props, Props (+4 more)

### Community 55 - "면접 선발 결과와 기록"
Cohesion: 0.21
Nodes (9): EMPTY_NOTE, NoteSaveState, serialize(), Harness(), interviewer, { listeners, saveInterviewNote, subscribeInterviewNote }, toDraft(), useInterviewNoteLogic() (+1 more)

### Community 56 - "성별 효용 분석 도구"
Cohesion: 0.36
Nodes (9): evaluateGenderLayout(), GENDER_REVIEW_SIZES, genderUtility(), PREVIOUS_GENDER_PARAMETERS, REVIEW_CURVES, reviewCurve(), reviewGenderComposition(), reviewGenderSuite() (+1 more)

### Community 57 - "합성 면접 일정과 노트"
Cohesion: 0.20
Nodes (11): completedNotes, daySchedules(), interviewerProfiles, kstDate(), kstDateKey(), kstParts(), makeSchedule(), members (+3 more)

### Community 59 - "합성 데이터 초기화"
Cohesion: 0.22
Nodes (6): CI Design Lab process timezone, CI 검증, Design Lab browser timezone, dailyPlanning, planningDateKey, todayKey

### Community 60 - "Firestore 보안 규칙 검증"
Cohesion: 0.33
Nodes (4): @firebase/rules-unit-testing, InterviewFixtureOptions, seedInterviewFixture(), seedScheduledInterviewFixture()

### Community 61 - "패키지와 실행 환경"
Cohesion: 0.33
Nodes (4): rollup-plugin-visualizer, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 62 - "프로젝트 개요와 Design Lab"
Cohesion: 0.40
Nodes (4): Scenario HTML 진입점, Avalon Club Manager, Emulator Design Lab, Scenario Lab

### Community 64 - "합성 지원서와 메시지"
Cohesion: 0.67
Nodes (3): applicantApplication(), buildApplicant(), sentMessage()

## Knowledge Gaps
- **382 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+377 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 525 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `공유 저장소 간접 소비자` connect `계획 기록과 이름 수정` to `학기 통계와 기록 필터`, `공유 컬렉션과 설정 내보내기`, `공유 컬렉션과 설정 내보내기`, `회원 입력과 공통 UI`, `참석자 저장과 출석 요약`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _382 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `학기 통계와 기록 필터` be split into smaller, more focused modules?**
  _Cohesion score 0.050458003415618694 - nodes in this community are weakly interconnected._
- **Why does `useAttendanceLogic()` connect `참석자 저장과 출석 요약` to `학기 통계와 기록 필터`, `개인 편성 평가 모달`, `출석 CSV 수정과 회원 선택`, `계획 기록과 이름 수정`, `지원자 회원 등록`, `공유 컬렉션과 설정 내보내기`, `Scenario Lab과 출석 미리보기`, `회원 입력과 공통 UI`, `일별 세션과 도메인 검증`, `면접 완료와 지원자 진행`?**
  _High betweenness centrality (0.000) - this node is a cross-community bridge._
- **Should `개인 편성 평가 모달` be split into smaller, more focused modules?**
  _Cohesion score 0.05318352059925094 - nodes in this community are weakly interconnected._
- **Should `면접 일정 관리 화면` be split into smaller, more focused modules?**
  _Cohesion score 0.056576576576576575 - nodes in this community are weakly interconnected._
- **Should `앱 라우팅과 공개 화면` be split into smaller, more focused modules?**
  _Cohesion score 0.06766917293233082 - nodes in this community are weakly interconnected._

## Project verification boundary

Semantic extraction used the current Codex session. Exact input/output token totals are unavailable; library counters of 0 do not mean no LLM cost. This graph contains current source relationships plus inferred document concepts. Source/tests/Rules remain authoritative.
