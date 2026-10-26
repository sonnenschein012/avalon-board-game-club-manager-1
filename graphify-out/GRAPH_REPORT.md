# Graph Report - avalon-board-game-club-manager  (2026-10-26)

## Corpus Check
- 353 files · ~176,228 words
- Verdict: corpus is large enough that graph structure adds value.
- Maintained input coverage is independently checked against scope.json; classifier gaps receive explicit semantic supplementation.

## Summary
- 1867 nodes · 5547 edges · 95 communities (77 shown, 18 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 63 edges (avg confidence: 0.87)
- Semantic token totals: unavailable in the current Codex host session.

## Graph Freshness
- Built from commit: `34755ee8`
- Commit records provenance. Run `node scripts/graphify.mjs status` to check input and artifact content hashes.
- Official AST update is local computation; semantic extraction and six-case review are also required when business meaning changes.

## Community Hubs (Navigation)
- 학기 출석 통계
- 회원 등록과 명부
- 공개 면접 응답
- 모임 기록과 계획
- 게임 관리와 감사
- 로컬 합성 데이터
- 개발 운영 업무 계약
- 세션 양식과 프로필
- 공통 화면 표시
- Scenario Lab 화면
- 면접 일정과 감사
- 출석 CSV 확인
- 개인 효용과 점수
- 면접 배정과 revision
- 출석 화면과 이동
- 개발 도구 설정
- 지원자 CSV 병합
- 면접 회차 데이터
- 세션 저장과 CSV
- 개발 검증 명령
- 면접 가능 시간 계산
- 자동 편성과 진단
- 면접 자동 배정
- 면접 작업과 감사
- 회원 게임 페이지
- 인증과 앱 라우팅
- 이전 지식 그래프 검증
- 개발 의존성
- 면접 노트 저장
- 모임 참가자 모델
- 면접 시간표 패널
- 면접 진행 정책
- Graphify 최신성 검증
- 개인 효용 모의 검증
- 선발 결정 화면
- Firebase 규칙과 환경
- 지원자 상세 안내
- 일정 선택과 배정
- 출석 저장과 편성
- TypeScript 컴파일 설정
- 면접 회차 화면
- 면접 일정 관리
- 면접 기록 CSV
- 동아리 CSV 내보내기
- 보안 번들 검사
- 면접 저장 타입
- 면접 일정 폼
- Graphify 분석 파이프라인
- 지원자 수정 충돌
- 조 인원 구성
- 면접 업무 화면 타입
- 출석 초안과 날짜
- Firebase 인증 초기화
- 앱 실행 의존성
- 브라우저 시나리오 검사
- 로컬 Emulator 실행
- 가능 시간 드래그
- 설정 관리자 화면
- 관리자 계정 작업
- 회원 메모 직접 수정
- 출석 식별자와 스크롤
- 참석자 회원 ID 변환
- 성별 효용 모의 검증
- 합성 한국 날짜
- 면접 회차 목록
- 지원자 여정 표시
- 면접 기록 작업창
- 지원자 정렬
- 면접 재배정 추천
- Graphify 운영 계약
- 면접 회차 폼
- Firestore 규칙 검사
- 면접관 참여 관리
- 공개 면접 화면
- 디자인 기준과 접근성
- 화면 오류 복구
- 실제 편성 실행 진단
- 출석 목록 드래그 검사
- 한국 날짜 seed
- 조 정원 정책
- 지원자 합성 fixture
- 조 인원 타입 선언
- CI 시간대와 검증
- 운영 HTML과 manifest
- Firebase 프로젝트 대상
- 출석 공유 컬렉션
- 출석 저장 전 검증
- 로컬 출석 ID 왕복
- 출석 초안 fixture
- 면접 시간표 fixture

## God Nodes (most connected - your core abstractions)
1. `react` - 119 edges
2. `vitest` - 84 edges
3. `Member` - 82 edges
4. `lucide-react` - 67 edges
5. `firebase` - 54 edges
6. `addAuditEventToTransaction()` - 45 edges
7. `useInterviewRoundLogic()` - 42 edges
8. `Session` - 39 edges
9. `Game` - 38 edges
10. `getInterviewProgressStatus()` - 37 edges

## Surprising Connections (you probably didn't know these)
- `useClubExports()` --shares_data_with--> `Firestore members 컬렉션`  [INFERRED]
  src/hooks/useClubExports.ts → firestore.rules
- `useClubExports()` --shares_data_with--> `Firestore sessions 컬렉션`  [INFERRED]
  src/hooks/useClubExports.ts → firestore.rules
- `Accepted transactional administrator duplicate rejection` --references--> `addAdminRecord()`  [EXTRACTED]
  docs/code-review-2026-10-11.md → src/services/settingsService.ts
- `Applied B evaluation modal and button style ②` --references--> `combineScores()`  [EXTRACTED]
  docs/development.md → src/domain/matching/personalUtility.ts
- `Cancel stale assignment Worker results` --references--> `runAutoAssignment()`  [EXTRACTED]
  docs/development.md → src/lib/runAutoAssignment.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **후보·내용해시·독립 의미 검토** — docs_knowledge_graph_graphify_primary, docs_knowledge_graph_content_hash_freshness, docs_knowledge_graph_verified_candidate_workflow, docs_knowledge_graph_six_semantic_cases [EXTRACTED 1.00]
- **Actual-run diagnostic export with privacy and valid comparison** — docs_group_utility_model_assignment_diagnostics, docs_group_utility_model_diagnostic_privacy_comparability, docs_group_utility_model_bounded_pair_search [EXTRACTED 1.00]

## Communities (95 total, 18 thin omitted)

### Community 0 - "학기 출석 통계"
Cohesion: 0.07
Nodes (51): resolveDailySessionId(), ResolveDailySessionIdInput, buildGroupCostContext(), GroupCostContextInput, attendee(), member(), session(), timestamp() (+43 more)

### Community 1 - "회원 등록과 명부"
Cohesion: 0.09
Nodes (40): Firestore members 컬렉션, sonner, eligibleSelectedApplicant(), Field(), MemberRegistrationModal(), MemberRegistrationPanel(), Metric(), RegistrationTab (+32 more)

### Community 2 - "공개 면접 응답"
Cohesion: 0.08
Nodes (36): ApplicantFormModal(), applicantToDraft(), emptyDraft(), Props, addDaysToDateString(), calculateApplicantTimeWindow(), formatKoreanDate(), getKstDateString() (+28 more)

### Community 3 - "모임 기록과 계획"
Cohesion: 0.09
Nodes (31): Firestore DailyPlannings 컬렉션, react-dom, MeetingRecordsModal(), button(), click(), mocks, archivedLabel(), MeetingVersionsPanel() (+23 more)

### Community 4 - "게임 관리와 감사"
Cohesion: 0.09
Nodes (29): GameFormProps, AuditRow(), SettingsAuditPanel(), AUDIT_ACTION_LABELS, AUDIT_CATEGORY_LABELS, AuditActionCode, AuditCategory, AuditChange (+21 more)

### Community 5 - "로컬 합성 데이터"
Cohesion: 0.05
Nodes (29): applicantDefinitions, applicantRecords, attendeeMembers, attendees, availabilityBySchedule, closedAvailability, closedDates, closedSlots (+21 more)

### Community 6 - "개발 운영 업무 계약"
Cohesion: 0.06
Nodes (20): Scenario HTML 진입점, Administrator removal confirmation and retry, Applied B evaluation modal and button style ②, Current personal utility model versus historical group-cost comparison, Development guide, Dormancy start semester, Member memo direct editing with optimistic conflict check, Adopted provisional initial operating parameters (+12 more)

### Community 7 - "세션 양식과 프로필"
Cohesion: 0.09
Nodes (31): @dnd-kit/utilities, ArchiveWidgetCorePlayersProps, ArchiveWidgetPopularGamesProps, GameListProps, GroupGamesEditModal(), GroupGamesEditModalProps, MemberProfileContent(), MemberProfileModal() (+23 more)

### Community 8 - "공통 화면 표시"
Cohesion: 0.15
Nodes (26): lucide-react, react, ArchiveLineChart(), AttendanceTrendChart(), chartPresentation, NewcomerTrendChart(), StagnationChart(), TrendChartProps (+18 more)

### Community 9 - "Scenario Lab 화면"
Cohesion: 0.10
Nodes (34): CostEvaluationModal(), render(), resolveCompanionRequests(), AttendanceButtonProposal, attendanceButtonProposals, EvaluationProposal(), AttendanceScenarioState, createAttendanceFixture() (+26 more)

### Community 10 - "면접 일정과 감사"
Cohesion: 0.10
Nodes (32): isSingleDocumentId(), commitBatchesInChunks(), addAuditEventToBatch(), AUDIT_TEXT_LIMITS, auditEventData(), createAuditEventOperation(), createAuditEventRef(), currentActorEmail() (+24 more)

### Community 11 - "출석 CSV 확인"
Cohesion: 0.10
Nodes (32): papaparse, AttendanceCsvImportModal(), Confirmation binds the reviewed identity snapshot, CSV confirmation column and namesake list share semester labels, partyLabel(), Props, RowStatus(), Summary() (+24 more)

### Community 12 - "개인 효용과 점수"
Cohesion: 0.11
Nodes (28): vitest, detailedValues(), EvaluationDialog(), Metric(), ReadingGuide(), close, context, dialogDescriptors (+20 more)

### Community 13 - "면접 배정과 revision"
Cohesion: 0.13
Nodes (24): filterInterviewApplicants(), isAssignmentConfirmationCurrent(), getApplicantAssignmentRevision(), isActiveAssignment(), prepareScheduleResetTransition(), prepareWithdrawalTransition(), applyOptimisticAssignment(), assignmentIdentity() (+16 more)

### Community 14 - "출석 화면과 이동"
Cohesion: 0.12
Nodes (26): @dnd-kit/core, attendanceButtonBase, attendanceButtonStyles, AttendanceDragAndDrop(), AttendanceDraggableCard(), AttendanceDropZone(), CardProps, DropZoneProps (+18 more)

### Community 15 - "개발 도구 설정"
Cohesion: 0.07
Nodes (30): engines, node, name, private, type, version, clsx, eslint (+22 more)

### Community 16 - "지원자 CSV 병합"
Cohesion: 0.10
Nodes (27): ApplicantCsvImportModalProps, ApplicantCsvColumnMapping, ApplicantCsvField, ApplicantCsvPreview, ApplicantCsvPreviewRow, ApplicantCsvRowError, ApplicantCsvRowErrorCode, assertValidMapping() (+19 more)

### Community 17 - "면접 회차 데이터"
Cohesion: 0.09
Nodes (17): InterviewRoundData, useInterviewRoundData(), InterviewRoundCounts, useInterviewRoundsLogic(), subscribeAllInterviewAccess(), subscribeAllInterviewApplicants(), subscribeInterviewAccess(), subscribeInterviewApplicants() (+9 more)

### Community 18 - "세션 저장과 CSV"
Cohesion: 0.15
Nodes (22): Firestore sessions 컬렉션, cleanString(), findMember(), ImportedSession, parseSessionCsvRows(), splitNames(), games, members (+14 more)

### Community 20 - "개발 검증 명령"
Cohesion: 0.07
Nodes (30): scripts, build, build:staging, check, clean, demo, demo:reset, demo:seed (+22 more)

### Community 21 - "면접 가능 시간 계산"
Cohesion: 0.14
Nodes (28): addDays(), addMinutesToSlot(), AffectedScheduleResponse, assertPositiveInteger(), AssignmentScheduleImpact, AssignmentScheduleImpactItem, assignmentsOverlap(), AvailabilityResponse (+20 more)

### Community 22 - "자동 편성과 진단"
Cohesion: 0.14
Nodes (18): AssignmentDiagnosticRun, contextKey(), createAssignmentDiagnosticReport(), distribution(), sortedEntries(), summary(), fixture(), AutoAssignInput (+10 more)

### Community 23 - "면접 자동 배정"
Cohesion: 0.15
Nodes (26): addEdge(), AutoAssignmentApplicant, AutoAssignmentExisting, AutoAssignmentFailure, AutoAssignmentFailureReason, AutoAssignmentInput, AutoAssignmentInterviewer, AutoAssignmentMode (+18 more)

### Community 24 - "면접 작업과 감사"
Cohesion: 0.17
Nodes (28): useInterviewRoundLogic(), addAuditEventToTransaction(), markInterviewMessageSent(), addRoundInterviewer(), INTERVIEWER_AUDIT_FIELDS, reactivateRoundInterviewer(), removeRoundInterviewer(), removeScheduleInterviewer() (+20 more)

### Community 25 - "회원 게임 페이지"
Cohesion: 0.16
Nodes (21): motion, ConfirmDeleteModal(), ConfirmDeleteModalProps, GameFilters(), GameForm(), GameList(), GamesPage(), GamesPageProps (+13 more)

### Community 26 - "인증과 앱 라우팅"
Cohesion: 0.15
Nodes (22): App(), ArchivePage, AttendancePage, GamesPage, InterviewRoundPage, InterviewRoundsPage, MeetingProgressPage, MembersPage (+14 more)

### Community 27 - "이전 지식 그래프 검증"
Cohesion: 0.15
Nodes (19): artifactHashes(), artifactNames, atomic(), canonical(), controls, cosmeticReviewIssues(), fileTypes, freshness() (+11 more)

### Community 28 - "개발 의존성"
Cohesion: 0.08
Nodes (24): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, firebase-admin, @firebase/eslint-plugin-security-rules, @firebase/rules-unit-testing, firebase-tools (+16 more)

### Community 29 - "면접 노트 저장"
Cohesion: 0.11
Nodes (13): Historical explicitly deferred risks, 2026-10-11 review scope and decisions, EMPTY_NOTE, NoteDraft, NoteSaveState, serialize(), Tests delayed failed applicant A saves and stale subscriptions cannot alter B, Harness() (+5 more)

### Community 30 - "모임 참가자 모델"
Cohesion: 0.19
Nodes (16): ArchiveWidgetRankingProps, GroupsCanvasProps, DiamondSvg(), RookSvg(), MeetingCanvasTab(), MeetingCanvasTabProps, MeetingCardStyleModal(), MeetingCardStyleModalProps (+8 more)

### Community 31 - "면접 시간표 패널"
Cohesion: 0.16
Nodes (22): AutoAssignmentPanel(), slotLabel(), activeApplicant(), Bot(), CompactStatus(), confirmationCurrent(), DraggableScheduleCard(), DroppableScheduleCell() (+14 more)

### Community 32 - "면접 진행 정책"
Cohesion: 0.23
Nodes (15): prepareInterviewCompletion(), prepareInterviewReopen(), canAppearInInterviewProgress(), canAppearInSchedule(), canAppearInSelection(), getInterviewProgressStatus(), isActiveInterviewApplicant(), INTERVIEW_RATING_LABELS (+7 more)

### Community 33 - "Graphify 최신성 검증"
Cohesion: 0.18
Nodes (15): artifactHashes(), artifacts, atomic(), freshness(), git(), inputHash(), inventory(), walk() (+7 more)

### Community 34 - "개인 효용 모의 검증"
Cohesion: 0.21
Nodes (16): compareAssignments(), evaluateAssignment(), EXAMPLE_PARAMETERS, key(), saturation(), stringOrder(), syntheticMembers(), evaluate() (+8 more)

### Community 35 - "선발 결정 화면"
Cohesion: 0.18
Nodes (16): round, DECISION_BUTTON_STYLES, getSelectionDecisionButtonClass(), SelectionDecision, copyText(), DecisionButton(), DecisionButtonProps, RATING_STYLES (+8 more)

### Community 36 - "Firebase 규칙과 환경"
Cohesion: 0.12
Nodes (20): 합성 Demo Firebase 연결, 운영 Firebase 앱 연결, Staging Firebase 앱 연결, Demo Emulator 구성, 운영 구성 내 Firestore Emulator 설정, 운영 Firebase 배포 구성, Staging Firebase 배포 구성, accessScheduleId (+12 more)

### Community 37 - "지원자 상세 안내"
Cohesion: 0.16
Nodes (16): ApplicantDetailModal(), copyText(), formatTimestamp(), getAssignmentParts(), getStoredAssignmentParts(), AvailabilitySummaryRow, minutesToTime(), summarizeAvailabilitySlots() (+8 more)

### Community 38 - "일정 선택과 배정"
Cohesion: 0.17
Nodes (14): formatRange(), InterviewScheduleAssignmentModal(), Props, Props, dateRange(), InterviewScheduleSelector(), Props, statusLabel() (+6 more)

### Community 39 - "출석 저장과 편성"
Cohesion: 0.23
Nodes (16): calculateGroupAverageAttendance(), calculateGroupAverageStudentId(), getReunionWarnings(), moveAttendee(), getSizingNotices(), getRequestNotices(), AttendanceMemberDraft, useAttendanceLogic() (+8 more)

### Community 40 - "TypeScript 컴파일 설정"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, allowJs, exactOptionalPropertyTypes, experimentalDecorators, isolatedModules, jsx, lib (+12 more)

### Community 41 - "면접 회차 화면"
Cohesion: 0.15
Nodes (15): ApplicantCsvImportModal(), Summary(), ApplicantJourney(), InterviewRoundDeleteModal(), Props, ApplicantRow(), FILTERS, formatAssignment() (+7 more)

### Community 42 - "면접 일정 관리"
Cohesion: 0.25
Nodes (14): formatDateRange(), InterviewScheduleManagement(), scheduleLabel(), activeApplicant(), dateRange(), InterviewSchedulesOverview(), scheduleStatusLabel(), todayInKorea() (+6 more)

### Community 43 - "면접 기록 CSV"
Cohesion: 0.19
Nodes (16): applicationValue(), ASSIGNMENT_STATUS_LABELS, assignmentColumns(), buildInterviewCsvRows(), CsvRow, formatRating(), formatSlot(), formatTimestamp() (+8 more)

### Community 44 - "동아리 CSV 내보내기"
Cohesion: 0.24
Nodes (12): Firestore games 컬렉션, buildGamesCsv(), buildMembersCsv(), buildSessionsCsv(), escapeCsv(), serializeCsv(), getTodayStr(), useClubExports() (+4 more)

### Community 45 - "보안 번들 검사"
Cohesion: 0.12
Nodes (12): baseline, current(), probe(), results, rules, distDirectory, forbiddenFiles, forbiddenMarkers (+4 more)

### Community 46 - "면접 저장 타입"
Cohesion: 0.18
Nodes (17): Props, InterviewRoundFormModalProps, InterviewCompletionDraft, InterviewCsvExportInput, AssignmentProposalWrite, CompleteInterviewInput, INTERVIEW_LINK_ORIGIN, InterviewRoundDraft (+9 more)

### Community 47 - "면접 일정 폼"
Cohesion: 0.25
Nodes (16): addDays(), dateFromKey(), datesInRange(), dateWeekName(), InterviewScheduleFormModal(), Props, scheduleToDraft(), suggestedInterviewScheduleDraft() (+8 more)

### Community 48 - "Graphify 분석 파이프라인"
Cohesion: 0.24
Nodes (7): ast(), build(), load(), portable(), save(), scan(), seal()

### Community 49 - "지원자 수정 충돌"
Cohesion: 0.27
Nodes (13): normalizeApplicantNumber(), assertExpectedRevision(), assertExpectedUpdatedAt(), InterviewRevisionConflictError, timestampMillis(), APPLICANT_AUDIT_FIELDS, applicantAuditView(), createInterviewApplicant() (+5 more)

### Community 50 - "조 인원 구성"
Cohesion: 0.25
Nodes (12): makeGroups(), solve(), compare(), compareIds(), compositions(), evaluate(), matchMinimums(), visit() (+4 more)

### Community 51 - "면접 업무 화면 타입"
Cohesion: 0.28
Nodes (13): ApplicantDetailModalProps, Props, reasonLabel, Props, Props, Props, { flush }, Props (+5 more)

### Community 52 - "출석 초안과 날짜"
Cohesion: 0.27
Nodes (13): getDefaultSessionName(), getLocalDateKey(), getTodaySessionMetadata(), isRequestSelections(), RequestSelections, AttendanceDraft, defaultDraft(), drafts (+5 more)

### Community 53 - "Firebase 인증 초기화"
Cohesion: 0.14
Nodes (13): app, FirestoreErrorInfo, googleProvider, initializeDemoSession(), isDemoMode, OperationType, CREATE, DELETE (+5 more)

### Community 54 - "앱 실행 의존성"
Cohesion: 0.13
Nodes (15): dependencies, clsx, @dnd-kit/core, @dnd-kit/utilities, firebase, html-to-image, lucide-react, motion (+7 more)

### Community 55 - "브라우저 시나리오 검사"
Cohesion: 0.13
Nodes (3): Design Lab browser timezone, @playwright/test, scenarios

### Community 56 - "로컬 Emulator 실행"
Cohesion: 0.19
Nodes (7): findJava(), firebaseCli, normalizeJavaHome(), projectRoot, runEmulators(), projectRoot, projectRoot

### Community 57 - "가능 시간 드래그"
Cohesion: 0.22
Nodes (12): AvailabilityGrid(), AvailabilityGridProps, formatDate(), getEndTime(), canScroll(), EdgeAutoScrollOptions, PointerPosition, scrollableAncestors() (+4 more)

### Community 58 - "설정 관리자 화면"
Cohesion: 0.22
Nodes (8): SettingsAdminPanel(), SettingsAdminPanelProps, SettingsExportPanel(), SettingsExportPanelProps, SettingsPage(), Admin, Settings admin fixture HTML entry, Browser contract: admin delete remains reachable with long emails across viewport widths

### Community 59 - "관리자 계정 작업"
Cohesion: 0.27
Nodes (8): Tests cancel does not delete, confirmed email deletes once while busy, and failure can retry, useSettingsAdmins(), addAdminRecord(), AdminAlreadyExistsError, listAdmins(), removeAdminRecord(), addAuditEventToTransaction, transaction

### Community 60 - "회원 메모 직접 수정"
Cohesion: 0.27
Nodes (6): firebase, original, MemberMemoConflictError, transaction, Tests memo-only atomic audit, deleted members, retries, conflicts and idempotent writes, updateMemberMemo()

### Community 61 - "출석 식별자와 스크롤"
Cohesion: 0.17
Nodes (11): Visible pool collision and drag scroll confinement, Bounded keyboard-accessible roster scroll region, Attendee-to-member storage conversion, Direct conversion regression test, Explicit identity and legacy lookup boundary, Explicit ID and legacy-prefix fallback tests, Selected identity in active personal utility, Scenario Lab mirrors identity without Firestore (+3 more)

### Community 62 - "참석자 회원 ID 변환"
Cohesion: 0.29
Nodes (5): CostEvaluationModalProps, convertAttendeeIdsToMemberIds(), getMemberFromAttendee(), isSameName(), SessionGroup

### Community 63 - "성별 효용 모의 검증"
Cohesion: 0.36
Nodes (9): evaluateGenderLayout(), GENDER_REVIEW_SIZES, genderUtility(), PREVIOUS_GENDER_PARAMETERS, REVIEW_CURVES, reviewCurve(), reviewGenderComposition(), reviewGenderSuite() (+1 more)

### Community 64 - "합성 한국 날짜"
Cohesion: 0.20
Nodes (11): completedNotes, daySchedules(), interviewerProfiles, kstDate(), kstDateKey(), kstParts(), makeSchedule(), members (+3 more)

### Community 65 - "면접 회차 목록"
Cohesion: 0.31
Nodes (8): react-router-dom, getRoundScheduleStatus(), getSurveyStatus(), InterviewRoundsPage(), mocks, round, schedule(), stamp()

### Community 66 - "지원자 여정 표시"
Cohesion: 0.27
Nodes (7): BADGE_CLASS, APPLICANT_JOURNEY_STATIONS, ApplicantJourneyBadgeTone, ApplicantJourneyModel, getApplicantJourney(), JourneyApplicant, base

### Community 67 - "면접 기록 작업창"
Cohesion: 0.29
Nodes (7): assignmentTime(), InterviewerDashboard(), isOperationalApplicant(), Metric(), InterviewWorkspaceModal(), Tests pending flush locks close and failure retains notes and blocks action-needed transition, auth

### Community 68 - "지원자 정렬"
Cohesion: 0.33
Nodes (6): ApplicantSortKey, comparable(), SortableApplicant, sortInterviewApplicants(), toMillis(), valueFor()

### Community 69 - "면접 재배정 추천"
Cohesion: 0.36
Nodes (7): candidatesForVacatedSlot(), ReassignmentApplicant, ReassignmentInterviewer, ReassignmentRecommendation, recommendReassignment(), slotMinutes(), parseSlotId()

### Community 70 - "Graphify 운영 계약"
Cohesion: 0.25
Nodes (7): Git 텍스트 LF 정규화, 입력·산출물 해시 최신성, Graphify 0.9.84 주 탐색 도구, 필수 여섯 의미 검증 사례, 미지원 텍스트 의미 보완, 새 컴퓨터 재현, 고정 Graphify 공식 도구체인

### Community 71 - "면접 회차 폼"
Cohesion: 0.46
Nodes (6): addMinutesToTime(), InterviewRoundFormModal(), roundToDraft(), schedulesFromDraft(), timeToMinutes(), generateAvailabilitySlotsForSchedules()

### Community 72 - "Firestore 규칙 검사"
Cohesion: 0.33
Nodes (4): @firebase/rules-unit-testing, InterviewFixtureOptions, seedInterviewFixture(), seedScheduledInterviewFixture()

### Community 73 - "면접관 참여 관리"
Cohesion: 0.52
Nodes (4): Info(), InterviewersPanel(), RosterInfo(), countActiveInterviewerSchedules()

### Community 74 - "공개 면접 화면"
Cohesion: 0.53
Nodes (5): getEndTime(), PublicInterviewPage(), SlotSummary(), STATE_MESSAGES, formatDateTime()

### Community 75 - "디자인 기준과 접근성"
Cohesion: 0.50
Nodes (4): 현재 디자인 관찰 기록, 목표 디자인 기준, 제품 완성 계획, 공통 CSS 테마와 업무 클래스

### Community 79 - "한국 날짜 seed"
Cohesion: 0.50
Nodes (3): dailyPlanning, planningDateKey, todayKey

### Community 81 - "지원자 합성 fixture"
Cohesion: 0.67
Nodes (3): applicantApplication(), buildApplicant(), sentMessage()

## Knowledge Gaps
- **409 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+404 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 573 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Assignment diagnostic export records actual execution` connect `개발 운영 업무 계약` to `자동 편성과 진단`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _409 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `학기 출석 통계` be split into smaller, more focused modules?**
  _Cohesion score 0.06653683868873743 - nodes in this community are weakly interconnected._
- **Why does `useGamesLogic()` connect `게임 관리와 감사` to `회원 등록과 명부`, `공개 면접 응답`, `면접 일정과 감사`, `출석 저장과 편성`?**
  _High betweenness centrality (0.000) - this node is a cross-community bridge._
- **Should `회원 등록과 명부` be split into smaller, more focused modules?**
  _Cohesion score 0.08983050847457627 - nodes in this community are weakly interconnected._
- **Should `공개 면접 응답` be split into smaller, more focused modules?**
  _Cohesion score 0.0824829931972789 - nodes in this community are weakly interconnected._
- **Should `모임 기록과 계획` be split into smaller, more focused modules?**
  _Cohesion score 0.0851063829787234 - nodes in this community are weakly interconnected._

## Project verification boundary

Semantic extraction used the current Codex session. Exact input/output token totals are unavailable; library counters of 0 do not mean no LLM cost. This graph contains current source relationships plus inferred document concepts. Source/tests/Rules remain authoritative.

## Extraction diagnostics and review limits

The official extraction diagnostic reports 100 pre-build endpoint references not declared as extraction nodes (51 external references), 8 self-loop candidates, and 150 directed same-endpoint candidate collapses. These are extractor/build diagnostics, not a claim of perfect relationship recovery. The official build/export resolves reference nodes and retains the original relation records. The final shared candidate has no dangling edges, and structural comparison found no missing unchanged-source symbols or relationships against the previous verified bundle. Source/tests/Rules remain authoritative; absence of a graph edge does not prove no dependency.

Semantic code supplements are stored in the reviewed graph with source hash receipts; the document-only official semantic cache intentionally does not cache those code supplements. Exact semantic token totals are unavailable in the host session.
