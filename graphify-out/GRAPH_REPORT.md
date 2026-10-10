# Graph Report - avalon-board-game-club-manager  (2026-10-11)

## Corpus Check
- 335 files · ~166,500 words
- Verdict: corpus is large enough that graph structure adds value.
- Maintained input coverage is independently checked against scope.json; classifier gaps receive explicit semantic supplementation.

## Summary
- 1777 nodes · 5376 edges · 89 communities (80 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 107 edges (avg confidence: 0.91)
- Semantic token totals: unavailable in the current Codex host session.

## Graph Freshness
- Built from commit: `e7703624`
- Commit records provenance. Run `node scripts/graphify.mjs status` to check input and artifact content hashes.
- Official AST update is local computation; semantic extraction and six-case review are also required when business meaning changes.

## Community Hubs (Navigation)
- 학기 통계와 기록 필터
- 개인 편성 평가 모달
- 지원자 회원 등록
- 면접 훅의 미해결 참조
- 공개 면접과 시간 입력
- 합성 데이터 초기화
- 면접 일정 관리 화면
- 계획 기록과 이름 수정
- 회원 입력과 공통 UI
- 면접 완료와 지원자 진행
- 참석자 저장과 출석 요약
- 공유 컬렉션과 설정 내보내기
- 출석 통계 차트
- 낙관적 배정과 확인 정책
- 면접 일정 정책
- 개발 검증 실행 명령
- 출석 화면과 이동
- 면접 회차와 면접관 저장
- 면접 회차와 데이터 모델
- 패키지와 실행 환경
- 면접 선발 결과와 기록
- 출석 화면과 이동
- 지원자 회원 등록
- 과거 UA 검증 도구
- 면접 회차 작업 화면
- 개발 도구 의존성
- 출석 CSV 수정과 회원 선택
- 브라우저 시나리오 검증
- Graphify 최신성 검증기
- 운영 산출물과 권한 점검 도구
- 면접 일정 정책
- 면접 선발 결과와 기록
- 공유 컬렉션과 설정 내보내기
- 면접 자동 배정 알고리즘
- 조 효용 프로토타입
- 앱 라우팅과 공개 화면
- 면접 회차와 면접관 저장
- TypeScript 컴파일 설정
- 공유 컬렉션과 설정 내보내기
- 면접 선발 결과와 기록
- Scenario Lab과 출석 미리보기
- 면접 수정 충돌 검증
- 공식 Graphify 분석 파이프라인
- 공유 컬렉션과 설정 내보내기
- 앱 라우팅과 공개 화면
- 면접 일정 입력 폼
- 지원자 CSV 해석
- 면접 선발 결과와 기록
- 출석과 저장의 업무 계약
- 운영 앱 의존성
- 지원자 상세와 안내 메시지
- 면접 일정 변경과 감사
- 지원자 입력 병합
- 개발 설계와 운영 절차
- 지원자 CSV 가져오기 화면
- 모임 게임과 Firestore 조회
- 조 편성 설계와 동반 정책
- 세션 폼과 회원 이동
- 성별 효용 분석 도구
- 합성 면접 일정과 노트
- 명시적 회원 연결과 변환 검증
- Firestore 권한과 공개 접근
- Firebase 설정과 인덱스
- 면접 완료와 지원자 진행
- 앱 라우팅과 공개 화면
- Scenario Lab과 출석 미리보기
- 일별 세션과 도메인 검증
- 면접 일정 정책
- 조 정원 결정
- 회원 입력과 공통 UI
- 출석 명부 재검증과 선택 확인
- 앱 라우팅과 공개 화면
- Graphify 해시와 재사용 정책
- Firestore 보안 규칙 검증
- 지원자 회원 등록
- 면접 자동 배정 알고리즘
- 프로젝트 개요와 Design Lab
- 패키지와 실행 환경
- 앱 라우팅과 공개 화면
- 합성 데이터 초기화
- 합성 지원서와 메시지
- 조 정원 선언 타입
- 운영 HTML과 앱 매니페스트
- 출석 초안 HTML 자료
- 면접 일정 넘침 HTML 자료

## God Nodes (most connected - your core abstractions)
1. `react` - 113 edges
2. `Member` - 81 edges
3. `vitest` - 75 edges
4. `lucide-react` - 67 edges
5. `firebase` - 47 edges
6. `useInterviewRoundLogic()` - 42 edges
7. `useAttendanceLogic()` - 40 edges
8. `addAuditEventToTransaction()` - 40 edges
9. `Session` - 39 edges
10. `getInterviewProgressStatus()` - 37 edges

## Surprising Connections (you probably didn't know these)
- `SettingsPage()` --shares_data_with--> `Firestore games 컬렉션`  [INFERRED]
  src/components/SettingsPage.tsx → firestore.rules
- `SettingsPage()` --shares_data_with--> `Firestore members 컬렉션`  [INFERRED]
  src/components/SettingsPage.tsx → firestore.rules
- `SettingsPage()` --shares_data_with--> `Firestore sessions 컬렉션`  [INFERRED]
  src/components/SettingsPage.tsx → firestore.rules
- `useClubExports()` --shares_data_with--> `Firestore sessions 컬렉션`  [INFERRED]
  src/hooks/useClubExports.ts → firestore.rules
- `참석자 ID와 저장 회원 ID` --references--> `convertAttendeeIdsToMemberIds()`  [INFERRED]
  docs/development.md → src/domain/attendance/sessionGroups.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **공유 저장 경계를 유지하는 의미 계약** — docs_development_attendee_member_ids, docs_development_boardmemberids_absent_empty, docs_development_planning_confirmed_sessions, docs_development_shared_storage_consumers [EXTRACTED 1.00]
- **정원 결정과 사전식 개인 배치** — docs_group_sizing_model_group_size_policy, docs_group_utility_model_direct_companion_requests, docs_group_utility_model_personal_utility_policy, docs_group_utility_model_bounded_pair_swap_search [EXTRACTED 1.00]
- **후보·내용해시·독립 의미 검토** — docs_knowledge_graph_graphify_primary, docs_knowledge_graph_content_hash_freshness, docs_knowledge_graph_verified_candidate_workflow, docs_knowledge_graph_six_semantic_cases [EXTRACTED 1.00]
- **Selected member identity from review to persisted session and planning** — src_domain_attendance_csvparser_reviewed_csv_identity, src_services_attendeesservice_fresh_roster_atomic_import, src_hooks_useattendancelogic_selected_identity_meeting_snapshot, src_domain_attendance_sessiongroups_selected_identity_conversion [EXTRACTED 1.00]
- **Korea Design Lab calendar alignment** — docs_development_design_lab_korea_calendar, _github_workflows_ci_design_lab_process_timezone, playwright_config_korea_browser_timezone, scripts_seed_demo_korea_planning_seed, tests_design_lab_smoke_spec_nondefault_date_after_delete [INFERRED 0.95]

## Communities (89 total, 9 thin omitted)

### Community 0 - "학기 통계와 기록 필터"
Cohesion: 0.06
Nodes (62): ArchiveWidgetCorePlayersProps, ArchiveWidgetPopularGamesProps, ArchiveWidgetRankingProps, GameListProps, GroupGamesEditModalProps, MeetingDashboardTab(), MeetingDashboardTabProps, MemberProfileModalProps (+54 more)

### Community 1 - "개인 편성 평가 모달"
Cohesion: 0.06
Nodes (66): vitest, CostEvaluationModal(), CostEvaluationModalProps, detailedValues(), EvaluationDialog(), Metric(), ReadingGuide(), close (+58 more)

### Community 2 - "지원자 회원 등록"
Cohesion: 0.09
Nodes (40): MemberFormProps, MemberListProps, eligibleSelectedApplicant(), Field(), MemberRegistrationModal(), MemberRegistrationPanel(), Metric(), Props (+32 more)

### Community 3 - "면접 훅의 미해결 참조"
Cohesion: 0.05
Nodes (18): collectAuditChanges(), formatAuditValue(), useInterviewRoundLogic(), setInterviewApplicantArchived(), addRoundInterviewer(), INTERVIEWER_AUDIT_FIELDS, reactivateRoundInterviewer(), removeRoundInterviewer() (+10 more)

### Community 4 - "공개 면접과 시간 입력"
Cohesion: 0.08
Nodes (36): ApplicantFormModal(), applicantToDraft(), emptyDraft(), Props, addDaysToDateString(), calculateApplicantTimeWindow(), formatKoreanDate(), getKstDateString() (+28 more)

### Community 5 - "합성 데이터 초기화"
Cohesion: 0.05
Nodes (29): applicantDefinitions, applicantRecords, attendeeMembers, attendees, availabilityBySchedule, closedAvailability, closedDates, closedSlots (+21 more)

### Community 6 - "면접 일정 관리 화면"
Cohesion: 0.12
Nodes (28): formatRange(), InterviewScheduleAssignmentModal(), Props, formatDateRange(), InterviewScheduleManagement(), Props, scheduleLabel(), dateRange() (+20 more)

### Community 7 - "계획 기록과 이름 수정"
Cohesion: 0.11
Nodes (26): Firestore DailyPlannings 컬렉션, firebase, MeetingRecordsModal(), archivedLabel(), MeetingVersionsPanel(), DailyPlanning, calculateGridPositions(), generateDrinkOrderText() (+18 more)

### Community 8 - "회원 입력과 공통 UI"
Cohesion: 0.14
Nodes (24): lucide-react, motion, ConfirmDeleteModal(), ConfirmDeleteModalProps, GameFilters(), GameFiltersProps, GameForm(), GameList() (+16 more)

### Community 9 - "면접 완료와 지원자 진행"
Cohesion: 0.18
Nodes (31): prepareInterviewCompletion(), prepareInterviewReopen(), canAppearInInterviewProgress(), canAppearInSchedule(), canAppearInSelection(), getInterviewProgressStatus(), isActiveInterviewApplicant(), isAssignmentConfirmationCurrent() (+23 more)

### Community 10 - "참석자 저장과 출석 요약"
Cohesion: 0.13
Nodes (26): Firestore attendees 컬렉션, calculateGroupAverageAttendance(), calculateGroupAverageStudentId(), getReunionWarnings(), moveAttendee(), convertAttendeeIdsToMemberIds(), getSizingNotices(), getMemberFromAttendee() (+18 more)

### Community 11 - "공유 컬렉션과 설정 내보내기"
Cohesion: 0.14
Nodes (26): boardMemberIds 부재와 빈 배열, Firestore sessions 컬렉션, cleanString(), findMember(), ImportedSession, parseSessionCsvRows(), splitNames(), games (+18 more)

### Community 12 - "출석 통계 차트"
Cohesion: 0.18
Nodes (21): ArchiveLineChart(), AttendanceTrendChart(), chartPresentation, NewcomerTrendChart(), StagnationChart(), TrendChartProps, ArchiveExpandedChartModal(), ArchiveExpandedChartModalProps (+13 more)

### Community 13 - "낙관적 배정과 확인 정책"
Cohesion: 0.13
Nodes (17): filterInterviewApplicants(), getApplicantAssignmentRevision(), isActiveAssignment(), prepareScheduleResetTransition(), prepareWithdrawalTransition(), applyOptimisticAssignment(), assignmentIdentity(), rollbackOptimisticApplicant() (+9 more)

### Community 14 - "면접 일정 정책"
Cohesion: 0.14
Nodes (29): addDays(), addMinutesToSlot(), AffectedScheduleResponse, assertPositiveInteger(), AssignmentScheduleImpact, AssignmentScheduleImpactItem, assignmentsOverlap(), AvailabilityResponse (+21 more)

### Community 15 - "개발 검증 실행 명령"
Cohesion: 0.07
Nodes (30): scripts, build, build:staging, check, clean, demo, demo:reset, demo:seed (+22 more)

### Community 16 - "출석 화면과 이동"
Cohesion: 0.12
Nodes (23): attendanceButtonBase, attendanceButtonStyles, AttendanceDragAndDrop(), Visible pool collision and drag scroll confinement, AttendanceMemberRegistrationModal(), AttendancePage(), AttendancePageProps, CompanionRequestModal() (+15 more)

### Community 17 - "면접 회차와 면접관 저장"
Cohesion: 0.11
Nodes (18): addMinutesToTime(), InterviewRoundFormModal(), roundToDraft(), schedulesFromDraft(), timeToMinutes(), getRoundScheduleStatus(), getSurveyStatus(), InterviewRoundsPage() (+10 more)

### Community 18 - "면접 회차와 데이터 모델"
Cohesion: 0.12
Nodes (26): Props, AssignmentProposalWrite, CompleteInterviewInput, INTERVIEW_LINK_ORIGIN, InterviewRoundDraft, InterviewRoundExportRecords, InterviewScheduleDraft, createInterviewRound() (+18 more)

### Community 19 - "패키지와 실행 환경"
Cohesion: 0.08
Nodes (26): engines, node, name, private, type, version, clsx, eslint (+18 more)

### Community 20 - "면접 선발 결과와 기록"
Cohesion: 0.19
Nodes (24): ApplicantDetailModalProps, Props, reasonLabel, assignmentTime(), InterviewerDashboard(), isOperationalApplicant(), Metric(), Props (+16 more)

### Community 21 - "출석 화면과 이동"
Cohesion: 0.17
Nodes (19): @dnd-kit/core, AttendanceDraggableCard(), AttendanceDropZone(), CardProps, DropZoneProps, Disabled dragging preserves nested controls, Props, AttendanceNotice() (+11 more)

### Community 22 - "지원자 회원 등록"
Cohesion: 0.13
Nodes (20): sonner, GameFormProps, AuditFieldDefinition, GameCsvImport, parseGameCsv(), recommendedPlayerRange(), createGameFormData(), GameFormData (+12 more)

### Community 23 - "과거 UA 검증 도구"
Cohesion: 0.15
Nodes (19): artifactHashes(), artifactNames, atomic(), canonical(), controls, cosmeticReviewIssues(), fileTypes, freshness() (+11 more)

### Community 24 - "면접 회차 작업 화면"
Cohesion: 0.13
Nodes (18): ApplicantJourney(), InterviewRoundDeleteModal(), Props, ApplicantRow(), FILTERS, formatAssignment(), formatSlot(), InterviewRoundPage() (+10 more)

### Community 25 - "개발 도구 의존성"
Cohesion: 0.08
Nodes (24): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, firebase-admin, @firebase/eslint-plugin-security-rules, @firebase/rules-unit-testing, firebase-tools (+16 more)

### Community 26 - "출석 CSV 수정과 회원 선택"
Cohesion: 0.17
Nodes (21): AttendanceCsvImportModal(), partyLabel(), Props, RowStatus(), Summary(), aliases, AttendanceField, attendanceFields (+13 more)

### Community 27 - "브라우저 시나리오 검증"
Cohesion: 0.09
Nodes (7): Design Lab browser timezone, @playwright/test, projectRoot, projectRoot, preview(), startDrag(), scenarios

### Community 28 - "Graphify 최신성 검증기"
Cohesion: 0.17
Nodes (15): artifactHashes(), artifacts, atomic(), freshness(), git(), inputHash(), inventory(), walk() (+7 more)

### Community 29 - "운영 산출물과 권한 점검 도구"
Cohesion: 0.11
Nodes (17): findJava(), firebaseCli, normalizeJavaHome(), projectRoot, runEmulators(), baseline, current(), probe() (+9 more)

### Community 30 - "면접 일정 정책"
Cohesion: 0.16
Nodes (22): AutoAssignmentPanel(), slotLabel(), activeApplicant(), Bot(), CompactStatus(), confirmationCurrent(), DraggableScheduleCard(), DroppableScheduleCell() (+14 more)

### Community 31 - "면접 선발 결과와 기록"
Cohesion: 0.18
Nodes (16): round, DECISION_BUTTON_STYLES, getSelectionDecisionButtonClass(), SelectionDecision, copyText(), DecisionButton(), DecisionButtonProps, RATING_STYLES (+8 more)

### Community 32 - "공유 컬렉션과 설정 내보내기"
Cohesion: 0.17
Nodes (18): AuditRow(), AUDIT_ACTION_LABELS, AUDIT_CATEGORY_LABELS, AuditActionCode, AuditCategory, AuditChange, AuditEvent, AuditEventInput (+10 more)

### Community 33 - "면접 자동 배정 알고리즘"
Cohesion: 0.19
Nodes (22): addEdge(), AutoAssignmentApplicant, AutoAssignmentFailure, AutoAssignmentFailureReason, AutoAssignmentInput, AutoAssignmentInterviewer, AutoAssignmentMode, Candidate (+14 more)

### Community 34 - "조 효용 프로토타입"
Cohesion: 0.21
Nodes (16): compareAssignments(), evaluateAssignment(), EXAMPLE_PARAMETERS, key(), saturation(), stringOrder(), syntheticMembers(), evaluate() (+8 more)

### Community 35 - "앱 라우팅과 공개 화면"
Cohesion: 0.18
Nodes (19): App(), ArchivePage, AttendancePage, GamesPage, InterviewRoundPage, InterviewRoundsPage, MeetingProgressPage, MembersPage (+11 more)

### Community 36 - "면접 회차와 면접관 저장"
Cohesion: 0.16
Nodes (12): InterviewRoundData, useInterviewRoundData(), subscribeInterviewAccess(), subscribeInterviewApplicants(), subscribeInterviewChangeRequests(), subscribeRoundInterviewers(), subscribeRoundScheduleInterviewers(), getInterviewLink() (+4 more)

### Community 37 - "TypeScript 컴파일 설정"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, allowJs, exactOptionalPropertyTypes, experimentalDecorators, isolatedModules, jsx, lib (+12 more)

### Community 38 - "공유 컬렉션과 설정 내보내기"
Cohesion: 0.25
Nodes (14): CSV 이관과 복구 범위, Firestore games 컬렉션, Firestore members 컬렉션, buildGamesCsv(), buildMembersCsv(), buildSessionsCsv(), escapeCsv(), serializeCsv() (+6 more)

### Community 39 - "면접 선발 결과와 기록"
Cohesion: 0.19
Nodes (16): applicationValue(), ASSIGNMENT_STATUS_LABELS, assignmentColumns(), buildInterviewCsvRows(), CsvRow, formatRating(), formatSlot(), formatTimestamp() (+8 more)

### Community 40 - "Scenario Lab과 출석 미리보기"
Cohesion: 0.16
Nodes (16): react-router-dom, AttendanceScenarioState, InterviewScenarioState, MembersScenarioState, isScenarioPage(), pageDefinitions, SCENARIO_LAB_SENTINEL, ScenarioContent() (+8 more)

### Community 41 - "면접 수정 충돌 검증"
Cohesion: 0.25
Nodes (14): normalizeApplicantNumber(), assertExpectedRevision(), assertExpectedUpdatedAt(), InterviewRevisionConflictError, timestampMillis(), APPLICANT_AUDIT_FIELDS, applicantAuditView(), createInterviewApplicant() (+6 more)

### Community 42 - "공식 Graphify 분석 파이프라인"
Cohesion: 0.24
Nodes (7): ast(), build(), load(), portable(), save(), scan(), seal()

### Community 43 - "공유 컬렉션과 설정 내보내기"
Cohesion: 0.24
Nodes (11): SettingsAdminPanel(), SettingsAdminPanelProps, SettingsAuditPanel(), SettingsExportPanel(), SettingsExportPanelProps, SettingsPage(), useSettingsAdmins(), addAdminRecord() (+3 more)

### Community 44 - "앱 라우팅과 공개 화면"
Cohesion: 0.23
Nodes (12): AvailabilityGrid(), AvailabilityGridProps, formatDate(), getEndTime(), getEndTime(), PublicInterviewPage(), SlotSummary(), STATE_MESSAGES (+4 more)

### Community 45 - "면접 일정 입력 폼"
Cohesion: 0.28
Nodes (13): addDays(), dateFromKey(), datesInRange(), dateWeekName(), InterviewScheduleFormModal(), scheduleToDraft(), suggestedInterviewScheduleDraft(), SurveyDateTimeCard() (+5 more)

### Community 46 - "지원자 CSV 해석"
Cohesion: 0.19
Nodes (14): ApplicantCsvColumnMapping, ApplicantCsvField, ApplicantCsvPreview, ApplicantCsvPreviewRow, ApplicantCsvRowError, ApplicantCsvRowErrorCode, assertValidMapping(), duplicateError() (+6 more)

### Community 47 - "면접 선발 결과와 기록"
Cohesion: 0.18
Nodes (11): isInterviewRevisionConflict(), EMPTY_NOTE, NoteDraft, NoteSaveState, serialize(), Harness(), interviewer, { listeners, saveInterviewNote, subscribeInterviewNote } (+3 more)

### Community 48 - "출석과 저장의 업무 계약"
Cohesion: 0.26
Nodes (11): 참석자 ID와 저장 회원 ID, 미배정 명단의 제한된 내부 스크롤, 개발 가이드, 명시적 출석 회원 연결과 legacy fallback, 계획과 확정 세션, scheduleId의 세 가지 앱 의미, 과거 로컬 출석 개선의 선택적 복구 기록, 공유 저장소 간접 소비자 (+3 more)

### Community 49 - "운영 앱 의존성"
Cohesion: 0.13
Nodes (15): dependencies, clsx, @dnd-kit/core, @dnd-kit/utilities, firebase, html-to-image, lucide-react, motion (+7 more)

### Community 50 - "지원자 상세와 안내 메시지"
Cohesion: 0.22
Nodes (12): ApplicantDetailModal(), copyText(), formatTimestamp(), getAssignmentParts(), getStoredAssignmentParts(), DEFAULT_INTERVIEW_MESSAGE_TEMPLATES, InterviewMessagePlaceholder, InterviewMessagePlaceholders (+4 more)

### Community 51 - "면접 일정 변경과 감사"
Cohesion: 0.22
Nodes (13): applyConcreteInterviewScheduleChange(), assignRoundInterviewerToSchedule(), createInterviewSchedule(), deleteInterviewSchedule(), InterviewScheduleDeletionResult, migrateLegacyApplicantsToInterviewSchedule(), SCHEDULE_AUDIT_FIELDS, SCHEDULE_DELETE_BLOCKER_COLLECTIONS (+5 more)

### Community 52 - "지원자 입력 병합"
Cohesion: 0.22
Nodes (10): ParsedRow, ApplicantMergeAction, ApplicantMergePreviewItem, fieldsEqual(), MergeApplicantRecord, MergeApplicantRow, normalizePhone(), previewApplicantMerge() (+2 more)

### Community 53 - "개발 설계와 운영 절차"
Cohesion: 0.18
Nodes (9): Firebase 기본 프로젝트와 Hosting 대상, CI Design Lab process timezone, CI 검증, 현재 디자인 관찰 기록, 목표 디자인 기준, 역사 릴리스 기록 v1.0.0~v1.2.1, 운영 환경과 인수인계, 제품 완성 계획 (+1 more)

### Community 54 - "지원자 CSV 가져오기 화면"
Cohesion: 0.24
Nodes (9): papaparse, ApplicantCsvImportModal(), ApplicantCsvImportModalProps, Summary(), CsvColumnSelect(), CsvColumnSelectProps, ApplicantMergePreview, ApplicantImportRow (+1 more)

### Community 55 - "모임 게임과 Firestore 조회"
Cohesion: 0.35
Nodes (7): react, DiamondSvg(), RookSvg(), MeetingCanvasTab(), MeetingCanvasTabProps, MeetingCardStyleModal(), MeetingProgressPage()

### Community 56 - "조 편성 설계와 동반 정책"
Cohesion: 0.22
Nodes (10): 동반 후보 선택 임시 저장, 조 인원 구성 모델, 수동 배치와 정원 하한, 채택한 성별 초기 운영값, 제한된 개인·동반 쌍 교환 탐색, 동반 상대 이름 해석, 직접 동반 요청의 체감 효용, 개인 참석 순서 재회 감쇠 (+2 more)

### Community 57 - "세션 폼과 회원 이동"
Cohesion: 0.22
Nodes (9): @dnd-kit/utilities, DndHandlers, DraggableMember(), DroppablePool(), GroupActions, ModalControl, SessionData, SessionFormModal() (+1 more)

### Community 58 - "성별 효용 분석 도구"
Cohesion: 0.36
Nodes (9): evaluateGenderLayout(), GENDER_REVIEW_SIZES, genderUtility(), PREVIOUS_GENDER_PARAMETERS, REVIEW_CURVES, reviewCurve(), reviewGenderComposition(), reviewGenderSuite() (+1 more)

### Community 59 - "합성 면접 일정과 노트"
Cohesion: 0.20
Nodes (11): completedNotes, daySchedules(), interviewerProfiles, kstDate(), kstDateKey(), kstParts(), makeSchedule(), members (+3 more)

### Community 60 - "명시적 회원 연결과 변환 검증"
Cohesion: 0.20
Nodes (11): Attendee-to-member storage conversion, Direct conversion regression test, Explicit identity and legacy lookup boundary, Explicit ID and legacy-prefix fallback tests, Selected identity in active personal utility, Meeting start preserves selected identities, Scenario Lab mirrors identity without Firestore, Quick registration atomically links attendance (+3 more)

### Community 61 - "Firestore 권한과 공개 접근"
Cohesion: 0.24
Nodes (9): 합성 Demo Firebase 연결, Demo Emulator 구성, accessScheduleId, 감사 이벤트 추가 전용 정책, Firestore 권한 정책, 지원자 bearer 접근 문서, 점진적 저장 필드 검증, 활성 공개 설정 exact get (+1 more)

### Community 62 - "Firebase 설정과 인덱스"
Cohesion: 0.22
Nodes (10): 운영 Firebase 앱 연결, Staging Firebase 앱 연결, 운영 구성 내 Firestore Emulator 설정, 운영 Firebase 배포 구성, Staging Firebase 배포 구성, 지원자 회차·면접관·시각 인덱스, 지원자 회차·시작시각 인덱스, 지원자 회차·배정상태·시각 인덱스 (+2 more)

### Community 63 - "면접 완료와 지원자 진행"
Cohesion: 0.27
Nodes (7): BADGE_CLASS, APPLICANT_JOURNEY_STATIONS, ApplicantJourneyBadgeTone, ApplicantJourneyModel, getApplicantJourney(), JourneyApplicant, base

### Community 64 - "앱 라우팅과 공개 화면"
Cohesion: 0.31
Nodes (8): canScroll(), EdgeAutoScrollOptions, PointerPosition, scrollableAncestors(), ScrollTarget, supportsVerticalScroll(), useEdgeAutoScroll(), verticalEdgeSpeed()

### Community 65 - "Scenario Lab과 출석 미리보기"
Cohesion: 0.40
Nodes (9): createAttendanceFixture(), createInterviewFixture(), makeApplicant(), makeAttendee(), makeMember(), memberNames, slot(), slotsForDates() (+1 more)

### Community 66 - "일별 세션과 도메인 검증"
Cohesion: 0.33
Nodes (4): resolveDailySessionId(), ResolveDailySessionIdInput, isSingleDocumentId(), deleteInterviewRound()

### Community 67 - "면접 일정 정책"
Cohesion: 0.36
Nodes (7): candidatesForVacatedSlot(), ReassignmentApplicant, ReassignmentInterviewer, ReassignmentRecommendation, recommendReassignment(), slotMinutes(), parseSlotId()

### Community 68 - "조 정원 결정"
Cohesion: 0.32
Nodes (3): vite, makeGroups(), solve()

### Community 69 - "회원 입력과 공통 UI"
Cohesion: 0.29
Nodes (6): react-dom, button(), click(), mocks, Harness(), mocks

### Community 70 - "출석 명부 재검증과 선택 확인"
Cohesion: 0.29
Nodes (8): Confirmation binds the reviewed identity snapshot, CSV confirmation column and namesake list share semester labels, Reviewed CSV rows and namesake selection, Nickname and short join semester display, CSV review and forged identity tests, Fresh roster validation before atomic replacement, Service prewrite identity tests, Responsive short semester option selection

### Community 71 - "앱 라우팅과 공개 화면"
Cohesion: 0.39
Nodes (5): AvalonLogo(), LoginGate(), LoginGateProps, Sidebar(), SidebarProps

### Community 72 - "Graphify 해시와 재사용 정책"
Cohesion: 0.29
Nodes (6): Git 텍스트 LF 정규화, 입력·산출물 해시 최신성, Graphify 0.9.84 주 탐색 도구, 미지원 텍스트 의미 보완, 새 컴퓨터 재현, 고정 Graphify 공식 도구체인

### Community 73 - "Firestore 보안 규칙 검증"
Cohesion: 0.33
Nodes (4): @firebase/rules-unit-testing, InterviewFixtureOptions, seedInterviewFixture(), seedScheduledInterviewFixture()

### Community 74 - "지원자 회원 등록"
Cohesion: 0.52
Nodes (4): Info(), InterviewersPanel(), RosterInfo(), countActiveInterviewerSchedules()

### Community 75 - "면접 자동 배정 알고리즘"
Cohesion: 0.47
Nodes (4): AutoAssignmentExisting, generateAutoAssignment(), interviewer(), runFor()

### Community 76 - "프로젝트 개요와 Design Lab"
Cohesion: 0.40
Nodes (4): Scenario HTML 진입점, Avalon Club Manager, Emulator Design Lab, Scenario Lab

### Community 77 - "패키지와 실행 환경"
Cohesion: 0.40
Nodes (3): rollup-plugin-visualizer, @tailwindcss/vite, @vitejs/plugin-react

### Community 79 - "합성 데이터 초기화"
Cohesion: 0.50
Nodes (3): dailyPlanning, planningDateKey, todayKey

### Community 80 - "합성 지원서와 메시지"
Cohesion: 0.67
Nodes (3): applicantApplication(), buildApplicant(), sentMessage()

## Knowledge Gaps
- **378 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+373 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 520 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Firestore 권한 정책` connect `Firestore 권한과 공개 접근` to `출석과 저장의 업무 계약`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _378 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `학기 통계와 기록 필터` be split into smaller, more focused modules?**
  _Cohesion score 0.05709507883420927 - nodes in this community are weakly interconnected._
- **Why does `공유 저장소 간접 소비자` connect `출석과 저장의 업무 계약` to `학기 통계와 기록 필터`, `공유 컬렉션과 설정 내보내기`, `계획 기록과 이름 수정`, `회원 입력과 공통 UI`, `참석자 저장과 출석 요약`, `공유 컬렉션과 설정 내보내기`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **Should `개인 편성 평가 모달` be split into smaller, more focused modules?**
  _Cohesion score 0.056669339748730285 - nodes in this community are weakly interconnected._
- **Should `지원자 회원 등록` be split into smaller, more focused modules?**
  _Cohesion score 0.09059029807130334 - nodes in this community are weakly interconnected._
- **Should `면접 훅의 미해결 참조` be split into smaller, more focused modules?**
  _Cohesion score 0.05429864253393665 - nodes in this community are weakly interconnected._

## Project verification boundary

Semantic extraction used the current Codex session. Exact input/output token totals are unavailable; library counters of 0 do not mean no LLM cost. This graph contains current source relationships plus inferred document concepts. Source/tests/Rules remain authoritative.
