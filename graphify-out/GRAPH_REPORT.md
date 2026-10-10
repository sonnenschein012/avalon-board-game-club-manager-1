# Graph Report - avalon-board-game-club-manager  (2026-10-11)

## Corpus Check
- 335 files · ~166,440 words
- Verdict: corpus is large enough that graph structure adds value.
- Maintained input coverage is independently checked against scope.json; classifier gaps receive explicit semantic supplementation.

## Summary
- 1772 nodes · 5361 edges · 101 communities (93 shown, 8 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 97 edges (avg confidence: 0.9)
- Semantic token totals: unavailable in the current Codex host session.

## Graph Freshness
- Built from commit: `4f05122b`
- Commit records provenance. Run `node scripts/graphify.mjs status` to check input and artifact content hashes.
- Official AST update is local computation; semantic extraction and six-case review are also required when business meaning changes.

## Community Hubs (Navigation)
- 앱 라우팅과 공개 화면
- 합성 데이터 초기화
- 출석 화면과 이동
- 낙관적 배정과 확인 정책
- 지원자 회원 등록
- 지원자 회원 등록
- Scenario Lab과 출석 미리보기
- 면접 훅의 미해결 참조
- 공개 면접과 시간 입력
- 참석자 저장과 출석 요약
- 출석 통계 차트
- 면접 회차와 면접관 저장
- 개발 검증 실행 명령
- 면접 자동 배정 알고리즘
- 패키지와 실행 환경
- 출석 CSV 수정과 회원 선택
- 면접 일정 정책
- 회원 입력과 공통 UI
- 면접 완료와 지원자 진행
- 공유 컬렉션과 설정 내보내기
- 과거 UA 검증 도구
- 계획 기록과 이름 수정
- 개발 도구 의존성
- 면접 선발 결과와 기록
- Graphify 최신성 검증기
- 조 효용 프로토타입
- 면접 일정 정책
- 개인 편성 평가 모달
- 모임 게임과 Firestore 조회
- 공유 컬렉션과 설정 내보내기
- 브라우저 시나리오 검증
- 면접 일정 관리 화면
- 명시적 회원 연결과 변환 검증
- 학기 통계와 기록 필터
- TypeScript 컴파일 설정
- 면접 회차 작업 화면
- 출석 초안과 동반 선택
- 회원 참여 이력과 인원 통계
- 면접 일정 관리 화면
- 면접 수정 충돌 검증
- 면접 선발 결과와 기록
- 면접 일정 변경과 감사
- 조 비용 평가와 문맥
- 운영 산출물과 권한 점검 도구
- 회원 입력과 공통 UI
- 면접 일정 입력 폼
- 모임 게임과 Firestore 조회
- 공식 Graphify 분석 파이프라인
- 세션 폼과 회원 이동
- 자동 편성 탐색과 Worker
- 면접 일정 변경과 감사
- 공유 컬렉션과 설정 내보내기
- 일별 세션과 도메인 검증
- 지원자 CSV 해석
- 공유 컬렉션과 설정 내보내기
- 운영 앱 의존성
- 조 정원 결정
- 지원자 상세와 안내 메시지
- 면접 선발 결과와 기록
- 모임 기록과 회원 기록 조회
- 면접 선발 결과와 기록
- 조 편성과 개인 효용
- 출석과 저장의 업무 계약
- 게임 기록과 핵심 참여자 통계
- 지원자 입력 병합
- 지원자 회원 등록
- Firebase 설정과 인덱스
- 면접 회차와 데이터 모델
- 조 편성 설계와 동반 정책
- 합성 면접 일정과 노트
- 공개 면접과 시간 입력
- 개발 설계와 운영 절차
- 성별 효용 분석 도구
- 면접 완료와 지원자 진행
- 확정 세션 저장과 조회
- 앱 라우팅과 공개 화면
- Firestore 권한과 공개 접근
- 게임 입력과 감사 조회
- 지원자 상세와 안내 메시지
- 면접 일정 정책
- 에뮬레이터 실행 환경
- 지원자 CSV 가져오기 화면
- 출석 명부 재검증과 선택 확인
- 지원자 정렬 기준
- Graphify 해시와 재사용 정책
- Firestore 보안 규칙 검증
- 패키지와 실행 환경
- 면접 선발 결과와 기록
- 앱 라우팅과 공개 화면
- 프로젝트 개요와 Design Lab
- 공개 면접과 시간 입력
- 면접 선발 결과와 기록
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
- **Selected member identity from review to persisted session and planning** — src_domain_attendance_csvparser_reviewed_csv_identity, src_services_attendeesservice_fresh_roster_atomic_import, src_hooks_useattendancelogic_selected_identity_meeting_snapshot, src_domain_attendance_sessiongroups_selected_identity_conversion [EXTRACTED 1.00]

## Communities (101 total, 8 thin omitted)

### Community 0 - "앱 라우팅과 공개 화면"
Cohesion: 0.09
Nodes (36): react, react-router-dom, App(), ArchivePage, AttendancePage, GamesPage, InterviewRoundPage, InterviewRoundsPage (+28 more)

### Community 1 - "합성 데이터 초기화"
Cohesion: 0.04
Nodes (32): applicantDefinitions, applicantRecords, attendeeMembers, attendees, availabilityBySchedule, closedAvailability, closedDates, closedSlots (+24 more)

### Community 2 - "출석 화면과 이동"
Cohesion: 0.10
Nodes (33): @dnd-kit/core, attendanceButtonBase, attendanceButtonStyles, AttendanceDragAndDrop(), AttendanceDraggableCard(), AttendanceDropZone(), CardProps, DropZoneProps (+25 more)

### Community 3 - "낙관적 배정과 확인 정책"
Cohesion: 0.12
Nodes (26): filterInterviewApplicants(), isAssignmentConfirmationCurrent(), getApplicantAssignmentRevision(), isActiveAssignment(), prepareScheduleResetTransition(), prepareWithdrawalTransition(), applyOptimisticAssignment(), assignmentIdentity() (+18 more)

### Community 4 - "지원자 회원 등록"
Cohesion: 0.15
Nodes (29): Info(), InterviewersPanel(), Props, RosterInfo(), eligibleSelectedApplicant(), Field(), MemberRegistrationModal(), MemberRegistrationPanel() (+21 more)

### Community 5 - "지원자 회원 등록"
Cohesion: 0.12
Nodes (24): firebase, papaparse, sonner, AuditActionCode, AuditFieldDefinition, collectAuditChanges(), formatAuditValue(), createGameFormData() (+16 more)

### Community 6 - "Scenario Lab과 출석 미리보기"
Cohesion: 0.12
Nodes (32): PageHeader(), resolveCompanionRequests(), EvaluationProposal(), AttendanceScenarioState, createAttendanceFixture(), createInterviewFixture(), createMembersFixture(), InterviewScenarioState (+24 more)

### Community 7 - "면접 훅의 미해결 참조"
Cohesion: 0.06
Nodes (3): Props, ApplicantDraft, deleteInterviewSchedule()

### Community 8 - "공개 면접과 시간 입력"
Cohesion: 0.13
Nodes (25): addDaysToDateString(), calculateApplicantTimeWindow(), formatKoreanDate(), getKstDateString(), getSlotDate(), isValidDateString(), isValidTimeString(), PublicTimeWindowResult (+17 more)

### Community 9 - "참석자 저장과 출석 요약"
Cohesion: 0.13
Nodes (27): Firestore attendees 컬렉션, Firestore members 컬렉션, calculateGroupAverageAttendance(), calculateGroupAverageStudentId(), getReunionWarnings(), moveAttendee(), AttendanceMemberDraft, Harness() (+19 more)

### Community 10 - "출석 통계 차트"
Cohesion: 0.17
Nodes (23): ArchiveLineChart(), AttendanceTrendChart(), chartPresentation, NewcomerTrendChart(), StagnationChart(), TrendChartProps, ArchiveExpandedChartModal(), ArchiveExpandedChartModalProps (+15 more)

### Community 11 - "면접 회차와 면접관 저장"
Cohesion: 0.10
Nodes (17): InterviewRoundData, useInterviewRoundData(), InterviewRoundCounts, useInterviewRoundsLogic(), subscribeAllInterviewAccess(), subscribeAllInterviewApplicants(), subscribeInterviewAccess(), subscribeInterviewApplicants() (+9 more)

### Community 12 - "개발 검증 실행 명령"
Cohesion: 0.07
Nodes (30): scripts, build, build:staging, check, clean, demo, demo:reset, demo:seed (+22 more)

### Community 13 - "면접 자동 배정 알고리즘"
Cohesion: 0.15
Nodes (26): addEdge(), AutoAssignmentApplicant, AutoAssignmentExisting, AutoAssignmentFailure, AutoAssignmentFailureReason, AutoAssignmentInput, AutoAssignmentInterviewer, AutoAssignmentMode (+18 more)

### Community 14 - "패키지와 실행 환경"
Cohesion: 0.08
Nodes (26): engines, node, name, private, type, version, clsx, eslint (+18 more)

### Community 15 - "출석 CSV 수정과 회원 선택"
Cohesion: 0.15
Nodes (23): AttendanceCsvImportModal(), partyLabel(), Props, RowStatus(), Summary(), CsvColumnSelect(), CsvColumnSelectProps, aliases (+15 more)

### Community 16 - "면접 일정 정책"
Cohesion: 0.14
Nodes (25): addDays(), addMinutesToSlot(), AffectedScheduleResponse, assertPositiveInteger(), AssignmentScheduleImpact, AssignmentScheduleImpactItem, assignmentsOverlap(), AvailabilityResponse (+17 more)

### Community 17 - "회원 입력과 공통 UI"
Cohesion: 0.18
Nodes (16): lucide-react, motion, GameFiltersProps, MemberFilters(), MemberFiltersProps, MemberForm(), MemberFormProps, MemberList() (+8 more)

### Community 18 - "면접 완료와 지원자 진행"
Cohesion: 0.23
Nodes (19): prepareInterviewCompletion(), prepareInterviewReopen(), canAppearInInterviewProgress(), canAppearInSchedule(), canAppearInSelection(), getInterviewProgressStatus(), isActiveInterviewApplicant(), completeInterviewAtomically() (+11 more)

### Community 19 - "공유 컬렉션과 설정 내보내기"
Cohesion: 0.20
Nodes (18): Firestore games 컬렉션, Firestore sessions 컬렉션, AuditChange, mergeSessionGroups(), normalizeSessionGroup(), Harness(), useSessionsLogic(), createSessionRecord() (+10 more)

### Community 20 - "과거 UA 검증 도구"
Cohesion: 0.15
Nodes (19): artifactHashes(), artifactNames, atomic(), canonical(), controls, cosmeticReviewIssues(), fileTypes, freshness() (+11 more)

### Community 21 - "계획 기록과 이름 수정"
Cohesion: 0.15
Nodes (17): Firestore DailyPlannings 컬렉션, archivedLabel(), MeetingVersionsPanel(), MeetingRecord, useMeetingVersions(), app, auth, db (+9 more)

### Community 22 - "개발 도구 의존성"
Cohesion: 0.08
Nodes (24): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, firebase-admin, @firebase/eslint-plugin-security-rules, @firebase/rules-unit-testing, firebase-tools (+16 more)

### Community 23 - "면접 선발 결과와 기록"
Cohesion: 0.17
Nodes (17): round, DECISION_BUTTON_STYLES, getSelectionDecisionButtonClass(), SelectionDecision, copyText(), DecisionButton(), DecisionButtonProps, RATING_STYLES (+9 more)

### Community 24 - "Graphify 최신성 검증기"
Cohesion: 0.17
Nodes (15): artifactHashes(), artifacts, atomic(), freshness(), git(), inputHash(), inventory(), walk() (+7 more)

### Community 25 - "조 효용 프로토타입"
Cohesion: 0.21
Nodes (17): compareAssignments(), evaluateAssignment(), EXAMPLE_PARAMETERS, key(), protectUtilities(), saturation(), stringOrder(), syntheticMembers() (+9 more)

### Community 26 - "면접 일정 정책"
Cohesion: 0.16
Nodes (22): AutoAssignmentPanel(), slotLabel(), activeApplicant(), Bot(), CompactStatus(), confirmationCurrent(), DraggableScheduleCard(), DroppableScheduleCell() (+14 more)

### Community 27 - "개인 편성 평가 모달"
Cohesion: 0.16
Nodes (18): CostEvaluationModalProps, detailedValues(), EvaluationDialog(), Metric(), ReadingGuide(), close, context, dialogDescriptors (+10 more)

### Community 28 - "모임 게임과 Firestore 조회"
Cohesion: 0.19
Nodes (16): DiamondSvg(), RookSvg(), MeetingCanvasTab(), MeetingCanvasTabProps, MeetingCardStyleModal(), MeetingCardStyleModalProps, MeetingDashboardTab(), MeetingDashboardTabProps (+8 more)

### Community 29 - "공유 컬렉션과 설정 내보내기"
Cohesion: 0.16
Nodes (19): AuditRow(), SettingsAuditPanel(), AUDIT_ACTION_LABELS, AUDIT_CATEGORY_LABELS, AuditCategory, AuditEvent, AuditEventInput, useAuditEvents() (+11 more)

### Community 30 - "브라우저 시나리오 검증"
Cohesion: 0.10
Nodes (6): @playwright/test, projectRoot, projectRoot, preview(), startDrag(), scenarios

### Community 31 - "면접 일정 관리 화면"
Cohesion: 0.17
Nodes (15): react-dom, formatRange(), InterviewScheduleAssignmentModal(), Props, Props, dateRange(), InterviewScheduleSelector(), Props (+7 more)

### Community 32 - "명시적 회원 연결과 변환 검증"
Cohesion: 0.14
Nodes (16): vitest, convertAttendeeIdsToMemberIds(), Attendee-to-member storage conversion, Direct conversion regression test, Explicit identity and legacy lookup boundary, getMemberFromAttendee(), Explicit ID and legacy-prefix fallback tests, isSameName() (+8 more)

### Community 33 - "학기 통계와 기록 필터"
Cohesion: 0.26
Nodes (12): getSemester(), getAvailableArchiveSemesters(), getAttendanceRanking(), getAttendanceTrend(), getGameMmi(), getNewcomerTrend(), getActiveMembersAtSemester(), getStagnationIndex() (+4 more)

### Community 34 - "TypeScript 컴파일 설정"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, allowJs, exactOptionalPropertyTypes, experimentalDecorators, isolatedModules, jsx, lib (+12 more)

### Community 35 - "면접 회차 작업 화면"
Cohesion: 0.16
Nodes (14): ApplicantJourney(), InterviewRoundDeleteModal(), Props, ApplicantRow(), FILTERS, formatAssignment(), formatSlot(), InterviewRoundPage() (+6 more)

### Community 36 - "출석 초안과 동반 선택"
Cohesion: 0.21
Nodes (14): getDefaultSessionName(), getLocalDateKey(), getTodaySessionMetadata(), isRequestSelections(), RequestCandidate, RequestSelections, AttendanceDraft, defaultDraft() (+6 more)

### Community 37 - "회원 참여 이력과 인원 통계"
Cohesion: 0.15
Nodes (13): getParticipationHistory(), ParticipationHistory, compareSemesters(), getNewbieMembersAtSemester(), isMemberActiveAtSemester(), parseSemester(), members, AttendeeId (+5 more)

### Community 38 - "면접 일정 관리 화면"
Cohesion: 0.25
Nodes (14): formatDateRange(), InterviewScheduleManagement(), scheduleLabel(), activeApplicant(), dateRange(), InterviewSchedulesOverview(), scheduleStatusLabel(), todayInKorea() (+6 more)

### Community 39 - "면접 수정 충돌 검증"
Cohesion: 0.23
Nodes (15): normalizeApplicantNumber(), assertExpectedRevision(), assertExpectedUpdatedAt(), InterviewRevisionConflictError, timestampMillis(), APPLICANT_AUDIT_FIELDS, applicantAuditView(), createInterviewApplicant() (+7 more)

### Community 40 - "면접 선발 결과와 기록"
Cohesion: 0.19
Nodes (16): applicationValue(), ASSIGNMENT_STATUS_LABELS, assignmentColumns(), buildInterviewCsvRows(), CsvRow, formatRating(), formatSlot(), formatTimestamp() (+8 more)

### Community 41 - "면접 일정 변경과 감사"
Cohesion: 0.20
Nodes (17): getAssignmentScheduleImpact(), createInterviewRound(), applyConcreteInterviewScheduleChange(), assignApplicantsToInterviewSchedule(), createInterviewSchedule(), InterviewScheduleDeletionResult, SCHEDULE_AUDIT_FIELDS, SCHEDULE_DELETE_BLOCKER_COLLECTIONS (+9 more)

### Community 42 - "조 비용 평가와 문맥"
Cohesion: 0.22
Nodes (15): buildGroupCostContext(), attendee(), member(), session(), timestamp(), calculateAgeVarianceCost(), calculateGenderCost(), calculateMeanBalanceCost() (+7 more)

### Community 43 - "운영 산출물과 권한 점검 도구"
Cohesion: 0.12
Nodes (12): baseline, current(), probe(), results, rules, distDirectory, forbiddenFiles, forbiddenMarkers (+4 more)

### Community 44 - "회원 입력과 공통 UI"
Cohesion: 0.18
Nodes (13): ConfirmDeleteModal(), ConfirmDeleteModalProps, GameFilters(), GameForm(), GameList(), GameListProps, GamesPage(), GamesPageProps (+5 more)

### Community 45 - "면접 일정 입력 폼"
Cohesion: 0.25
Nodes (16): addDays(), dateFromKey(), datesInRange(), dateWeekName(), InterviewScheduleFormModal(), Props, scheduleToDraft(), suggestedInterviewScheduleDraft() (+8 more)

### Community 46 - "모임 게임과 Firestore 조회"
Cohesion: 0.23
Nodes (10): calculateGridPositions(), generateDrinkOrderText(), getMemberPlayedGames(), prng(), recommendGames(), koreaDateKey(), Harness(), mocks (+2 more)

### Community 47 - "공식 Graphify 분석 파이프라인"
Cohesion: 0.24
Nodes (7): ast(), build(), load(), portable(), save(), scan(), seal()

### Community 48 - "세션 폼과 회원 이동"
Cohesion: 0.15
Nodes (12): @dnd-kit/utilities, CoreData, DndHandlers, DraggableMember(), DroppablePool(), GroupActions, ModalControl, SessionData (+4 more)

### Community 49 - "자동 편성 탐색과 Worker"
Cohesion: 0.18
Nodes (11): AutoAssignInput, AutoAssignResult, getSizingNotices(), simulateAutoAssign(), SimulationSample, evaluate(), AssignmentScore, compareUtility() (+3 more)

### Community 50 - "면접 일정 변경과 감사"
Cohesion: 0.22
Nodes (16): useInterviewRoundLogic(), addAuditEventToTransaction(), markInterviewMessageSent(), addRoundInterviewer(), INTERVIEWER_AUDIT_FIELDS, reactivateRoundInterviewer(), removeRoundInterviewer(), removeScheduleInterviewer() (+8 more)

### Community 51 - "공유 컬렉션과 설정 내보내기"
Cohesion: 0.26
Nodes (10): SettingsAdminPanel(), SettingsAdminPanelProps, SettingsExportPanel(), SettingsExportPanelProps, SettingsPage(), useSettingsAdmins(), addAdminRecord(), listAdmins() (+2 more)

### Community 52 - "일별 세션과 도메인 검증"
Cohesion: 0.20
Nodes (10): resolveDailySessionId(), ResolveDailySessionIdInput, isSingleDocumentId(), deleteInterviewRound(), hasInterviewRoundNotes(), InterviewRoundDeletionResult, MESSAGE_TEMPLATE_AUDIT_FIELDS, ROUND_SCOPED_COLLECTIONS (+2 more)

### Community 53 - "지원자 CSV 해석"
Cohesion: 0.19
Nodes (14): ApplicantCsvColumnMapping, ApplicantCsvField, ApplicantCsvPreview, ApplicantCsvPreviewRow, ApplicantCsvRowError, ApplicantCsvRowErrorCode, assertValidMapping(), duplicateError() (+6 more)

### Community 54 - "공유 컬렉션과 설정 내보내기"
Cohesion: 0.32
Nodes (10): CSV 이관과 복구 범위, buildGamesCsv(), buildMembersCsv(), buildSessionsCsv(), escapeCsv(), serializeCsv(), getTodayStr(), useClubExports() (+2 more)

### Community 55 - "운영 앱 의존성"
Cohesion: 0.13
Nodes (15): dependencies, clsx, @dnd-kit/core, @dnd-kit/utilities, firebase, html-to-image, lucide-react, motion (+7 more)

### Community 56 - "조 정원 결정"
Cohesion: 0.27
Nodes (11): makeGroups(), solve(), compare(), compareIds(), compositions(), matchMinimums(), visit(), matchTargets() (+3 more)

### Community 57 - "지원자 상세와 안내 메시지"
Cohesion: 0.21
Nodes (12): ApplicantDetailModal(), copyText(), formatTimestamp(), getAssignmentParts(), getStoredAssignmentParts(), DEFAULT_INTERVIEW_MESSAGE_TEMPLATES, InterviewMessagePlaceholder, InterviewMessagePlaceholders (+4 more)

### Community 58 - "면접 선발 결과와 기록"
Cohesion: 0.30
Nodes (13): ApplicantDetailModalProps, Props, reasonLabel, Props, InterviewRoundFormModalProps, Props, Props, Props (+5 more)

### Community 59 - "모임 기록과 회원 기록 조회"
Cohesion: 0.30
Nodes (11): GroupGamesEditModal(), GroupGamesEditModalProps, MemberProfileModal(), SessionList(), SessionListProps, SessionsPage(), SessionsPageProps, formatTimestamp() (+3 more)

### Community 60 - "면접 선발 결과와 기록"
Cohesion: 0.20
Nodes (10): isInterviewRevisionConflict(), EMPTY_NOTE, NoteSaveState, serialize(), Harness(), interviewer, { listeners, saveInterviewNote, subscribeInterviewNote }, toDraft() (+2 more)

### Community 61 - "조 편성과 개인 효용"
Cohesion: 0.21
Nodes (12): buildUtilityContext(), getRequestNotices(), PersonScore, PersonUtility, relativeProtection(), saturation(), date(), fixture() (+4 more)

### Community 62 - "출석과 저장의 업무 계약"
Cohesion: 0.29
Nodes (11): 참석자 ID와 저장 회원 ID, boardMemberIds 부재와 빈 배열, 미배정 명단의 제한된 내부 스크롤, 개발 가이드, 명시적 출석 회원 연결과 legacy fallback, 계획과 확정 세션, scheduleId의 세 가지 앱 의미, 과거 로컬 출석 개선의 선택적 복구 기록 (+3 more)

### Community 63 - "게임 기록과 핵심 참여자 통계"
Cohesion: 0.25
Nodes (10): ArchiveWidgetCorePlayersProps, MemberProfileModalProps, ARCHIVE_DIFFICULTY_RANGES, matchesArchiveGameFilters(), games, members, session, getCorePlayers() (+2 more)

### Community 64 - "지원자 입력 병합"
Cohesion: 0.22
Nodes (10): ParsedRow, ApplicantMergeAction, ApplicantMergePreviewItem, fieldsEqual(), MergeApplicantRecord, MergeApplicantRow, normalizePhone(), previewApplicantMerge() (+2 more)

### Community 65 - "지원자 회원 등록"
Cohesion: 0.27
Nodes (6): useMemberRegistrationLogic(), assertSelectedApplicant(), clearApplicantMemberRegistration(), createMemberFromSelectedApplicant(), InterviewMemberRegistrationDraft, linkSelectedApplicantToMember()

### Community 66 - "Firebase 설정과 인덱스"
Cohesion: 0.18
Nodes (12): 합성 Demo Firebase 연결, 운영 Firebase 앱 연결, Staging Firebase 앱 연결, Demo Emulator 구성, 운영 구성 내 Firestore Emulator 설정, 운영 Firebase 배포 구성, Staging Firebase 배포 구성, 지원자 회차·면접관·시각 인덱스 (+4 more)

### Community 67 - "면접 회차와 데이터 모델"
Cohesion: 0.29
Nodes (11): InterviewCsvExportInput, AssignmentProposalWrite, INTERVIEW_LINK_ORIGIN, InterviewRoundDraft, InterviewRoundExportRecords, InterviewAssignmentEvent, InterviewAssignmentStatus, InterviewChangeRequest (+3 more)

### Community 68 - "조 편성 설계와 동반 정책"
Cohesion: 0.22
Nodes (10): 동반 후보 선택 임시 저장, 조 인원 구성 모델, 수동 배치와 정원 하한, 채택한 성별 초기 운영값, 제한된 개인·동반 쌍 교환 탐색, 동반 상대 이름 해석, 직접 동반 요청의 체감 효용, 개인 참석 순서 재회 감쇠 (+2 more)

### Community 69 - "합성 면접 일정과 노트"
Cohesion: 0.20
Nodes (11): completedNotes, daySchedules(), interviewerProfiles, kstDate(), kstDateKey(), kstParts(), makeSchedule(), members (+3 more)

### Community 70 - "공개 면접과 시간 입력"
Cohesion: 0.25
Nodes (8): getRoundScheduleStatus(), getSurveyStatus(), InterviewRoundsPage(), mocks, round, schedule(), stamp(), PageHeaderProps

### Community 71 - "개발 설계와 운영 절차"
Cohesion: 0.22
Nodes (8): Firebase 기본 프로젝트와 Hosting 대상, CI 검증, 현재 디자인 관찰 기록, 목표 디자인 기준, 역사 릴리스 기록 v1.0.0~v1.2.1, 운영 환경과 인수인계, 제품 완성 계획, 공통 CSS 테마와 업무 클래스

### Community 72 - "성별 효용 분석 도구"
Cohesion: 0.40
Nodes (8): evaluateGenderLayout(), GENDER_REVIEW_SIZES, genderUtility(), PREVIOUS_GENDER_PARAMETERS, REVIEW_CURVES, reviewCurve(), reviewGenderComposition(), reviewGenderSuite()

### Community 73 - "면접 완료와 지원자 진행"
Cohesion: 0.27
Nodes (7): BADGE_CLASS, APPLICANT_JOURNEY_STATIONS, ApplicantJourneyBadgeTone, ApplicantJourneyModel, getApplicantJourney(), JourneyApplicant, base

### Community 74 - "확정 세션 저장과 조회"
Cohesion: 0.31
Nodes (7): cleanString(), findMember(), ImportedSession, parseSessionCsvRows(), splitNames(), games, members

### Community 75 - "앱 라우팅과 공개 화면"
Cohesion: 0.31
Nodes (8): canScroll(), EdgeAutoScrollOptions, PointerPosition, scrollableAncestors(), ScrollTarget, supportsVerticalScroll(), useEdgeAutoScroll(), verticalEdgeSpeed()

### Community 76 - "Firestore 권한과 공개 접근"
Cohesion: 0.28
Nodes (8): accessScheduleId, 감사 이벤트 추가 전용 정책, Firestore 권한 정책, 지원자 bearer 접근 문서, 점진적 저장 필드 검증, 내부 공유 컬렉션 보호, 활성 공개 설정 exact get, 공개 응답 변경 검증

### Community 77 - "게임 입력과 감사 조회"
Cohesion: 0.39
Nodes (5): GameFormProps, GameCsvImport, parseGameCsv(), recommendedPlayerRange(), GameFormData

### Community 78 - "지원자 상세와 안내 메시지"
Cohesion: 0.42
Nodes (7): addMinutesToTime(), InterviewRoundFormModal(), roundToDraft(), schedulesFromDraft(), timeToMinutes(), resolveInterviewMessageTemplates(), generateAvailabilitySlotsForSchedules()

### Community 79 - "면접 일정 정책"
Cohesion: 0.36
Nodes (7): candidatesForVacatedSlot(), ReassignmentApplicant, ReassignmentInterviewer, ReassignmentRecommendation, recommendReassignment(), slotMinutes(), parseSlotId()

### Community 80 - "에뮬레이터 실행 환경"
Cohesion: 0.39
Nodes (5): findJava(), firebaseCli, normalizeJavaHome(), projectRoot, runEmulators()

### Community 81 - "지원자 CSV 가져오기 화면"
Cohesion: 0.36
Nodes (6): ApplicantCsvImportModal(), ApplicantCsvImportModalProps, Summary(), ApplicantMergePreview, ApplicantImportRow, ApplicantMergeCommitItem

### Community 82 - "출석 명부 재검증과 선택 확인"
Cohesion: 0.29
Nodes (8): Confirmation binds the reviewed identity snapshot, CSV confirmation column and namesake list share semester labels, Reviewed CSV rows and namesake selection, Nickname and short join semester display, CSV review and forged identity tests, Fresh roster validation before atomic replacement, Service prewrite identity tests, Responsive short semester option selection

### Community 83 - "지원자 정렬 기준"
Cohesion: 0.39
Nodes (5): ApplicantSortKey, comparable(), sortInterviewApplicants(), toMillis(), valueFor()

### Community 84 - "Graphify 해시와 재사용 정책"
Cohesion: 0.29
Nodes (6): Git 텍스트 LF 정규화, 입력·산출물 해시 최신성, Graphify 0.9.84 주 탐색 도구, 미지원 텍스트 의미 보완, 새 컴퓨터 재현, 고정 Graphify 공식 도구체인

### Community 85 - "Firestore 보안 규칙 검증"
Cohesion: 0.33
Nodes (4): @firebase/rules-unit-testing, InterviewFixtureOptions, seedInterviewFixture(), seedScheduledInterviewFixture()

### Community 86 - "패키지와 실행 환경"
Cohesion: 0.33
Nodes (4): rollup-plugin-visualizer, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 87 - "면접 선발 결과와 기록"
Cohesion: 0.60
Nodes (5): assignmentTime(), InterviewerDashboard(), isOperationalApplicant(), Metric(), InterviewWorkspaceModal()

### Community 88 - "앱 라우팅과 공개 화면"
Cohesion: 0.53
Nodes (4): AvailabilitySummaryRow, minutesToTime(), summarizeAvailabilitySlots(), timeToMinutes()

### Community 89 - "프로젝트 개요와 Design Lab"
Cohesion: 0.40
Nodes (4): Scenario HTML 진입점, Avalon Club Manager, Emulator Design Lab, Scenario Lab

### Community 90 - "공개 면접과 시간 입력"
Cohesion: 0.70
Nodes (3): ApplicantFormModal(), applicantToDraft(), emptyDraft()

### Community 91 - "면접 선발 결과와 기록"
Cohesion: 0.50
Nodes (4): InterviewCompletionDraft, NoteDraft, CompleteInterviewInput, InterviewOverallRating

### Community 92 - "합성 지원서와 메시지"
Cohesion: 0.67
Nodes (3): applicantApplication(), buildApplicant(), sentMessage()

## Knowledge Gaps
- **382 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+377 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 525 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `내부 공유 컬렉션 보호` connect `Firestore 권한과 공개 접근` to `출석과 저장의 업무 계약`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _382 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `앱 라우팅과 공개 화면` be split into smaller, more focused modules?**
  _Cohesion score 0.08503401360544217 - nodes in this community are weakly interconnected._
- **Why does `공유 저장소 간접 소비자` connect `출석과 저장의 업무 계약` to `학기 통계와 기록 필터`, `참석자 저장과 출석 요약`, `모임 게임과 Firestore 조회`, `공유 컬렉션과 설정 내보내기`, `공유 컬렉션과 설정 내보내기`, `모임 기록과 회원 기록 조회`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **Should `합성 데이터 초기화` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `출석 화면과 이동` be split into smaller, more focused modules?**
  _Cohesion score 0.09619450317124736 - nodes in this community are weakly interconnected._
- **Should `낙관적 배정과 확인 정책` be split into smaller, more focused modules?**
  _Cohesion score 0.11794871794871795 - nodes in this community are weakly interconnected._

## Project verification boundary

Semantic extraction used the current Codex session. Exact input/output token totals are unavailable; library counters of 0 do not mean no LLM cost. This graph contains current source relationships plus inferred document concepts. Source/tests/Rules remain authoritative.
