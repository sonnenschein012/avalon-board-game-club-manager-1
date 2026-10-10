# Graph Report - avalon-board-game-club-manager  (2026-10-10)

## Corpus Check
- 333 files · ~163,403 words
- Verdict: corpus is large enough that graph structure adds value.
- Maintained input coverage is independently checked against scope.json; classifier gaps receive explicit semantic supplementation.

## Summary
- 1738 nodes · 5284 edges · 82 communities (73 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 95 edges (avg confidence: 0.9)
- Semantic token totals: unavailable in the current Codex host session.

## Graph Freshness
- Built from commit: `37b8e5a6`
- Commit records provenance. Run `node scripts/graphify.mjs status` to check input and artifact content hashes.
- Official AST update is local computation; semantic extraction and six-case review are also required when business meaning changes.

## Community Hubs (Navigation)
- 면접 선발 결과와 기록
- 조 편성과 개인 효용
- 지원자와 출석 CSV 입력
- 지원자 회원 등록
- 공개 면접과 시간 입력
- 합성 데이터 초기화
- 앱 라우팅과 공개 화면
- 확정 세션 저장과 조회
- 회원 입력과 공통 UI
- 면접 회차와 면접관 저장
- Scenario Lab과 출석 미리보기
- 출석 화면과 이동
- 공유 컬렉션과 설정 내보내기
- 출석 통계 차트
- 패키지와 실행 환경
- 면접 일정 변경과 감사
- 게임 입력과 감사 조회
- 참석자 저장과 출석 요약
- 개발 검증 실행 명령
- 면접 배정 상태와 저장
- 계획 기록과 이름 수정
- 면접 회차와 데이터 모델
- 면접 자동 배정 알고리즘
- 면접 일정 정책
- 면접 일정 관리 화면
- 과거 UA 검증 도구
- 개발 도구 의존성
- 모임 진행 데이터와 화면
- Graphify 최신성 검증기
- 면접 완료와 지원자 진행
- 모임 게임과 Firestore 조회
- 조 효용 프로토타입
- 학기 통계와 기록 필터
- 지원자 상세와 안내 메시지
- 면접 일정 배정 화면
- TypeScript 컴파일 설정
- 면접 회차 작업 화면
- 낙관적 배정과 확인 정책
- 운영 산출물과 권한 점검 도구
- 공식 Graphify 분석 파이프라인
- 세션 폼과 회원 이동
- 일별 세션과 도메인 검증
- 모임 기록과 회원 기록 조회
- 면접 수정 충돌 검증
- 브라우저 시나리오 검증
- 면접 배정 모달과 넘침 검증
- 운영 앱 의존성
- 면접 재배정과 자동 배정 화면
- 면접 일정 입력 폼
- 조 비용 평가와 문맥
- Firebase 런타임과 접근 권한
- 회원 참여 이력과 인원 통계
- Firebase 설정과 인덱스
- 조 편성 설계와 동반 정책
- 에뮬레이터 실행 환경
- 성별 효용 분석 도구
- 합성 면접 일정과 노트
- 출석 초안과 동반 선택
- 개발 설계와 운영 절차
- 모임 캔버스와 게임 아이콘
- 게임 기록과 핵심 참여자 통계
- 드래그 자동 스크롤
- 출석과 저장의 업무 계약
- Firestore 권한과 공개 접근
- 지원자 여정 상태 계산
- 면접 회차 입력 폼
- 면접 회차 진행 화면
- 지원자 정렬 기준
- Graphify 해시와 재사용 정책
- Firestore 보안 규칙 검증
- 면접관 참여 화면
- 프로젝트 개요와 Design Lab
- 합성 지원서와 메시지
- 조 정원 선언 타입
- 운영 HTML과 앱 매니페스트
- 출석 초안 HTML 자료
- 면접 일정 넘침 HTML 자료

## God Nodes (most connected - your core abstractions)
1. `react` - 113 edges
2. `Member` - 79 edges
3. `vitest` - 74 edges
4. `lucide-react` - 67 edges
5. `firebase` - 47 edges
6. `useInterviewRoundLogic()` - 42 edges
7. `addAuditEventToTransaction()` - 40 edges
8. `useAttendanceLogic()` - 39 edges
9. `Session` - 39 edges
10. `getInterviewProgressStatus()` - 37 edges

## Surprising Connections (you probably didn't know these)
- `SettingsPage()` --shares_data_with--> `Firestore sessions 컬렉션`  [INFERRED]
  src/components/SettingsPage.tsx → firestore.rules
- `useClubExports()` --shares_data_with--> `Firestore sessions 컬렉션`  [INFERRED]
  src/hooks/useClubExports.ts → firestore.rules
- `참석자 ID와 저장 회원 ID` --references--> `convertAttendeeIdsToMemberIds()`  [INFERRED]
  docs/development.md → src/domain/attendance/sessionGroups.ts
- `참석자 ID와 저장 회원 ID` --references--> `getMemberFromAttendee()`  [INFERRED]
  docs/development.md → src/domain/matching/getMemberFromAttendee.ts
- `참석자 ID와 저장 회원 ID` --references--> `isSameName()`  [INFERRED]
  docs/development.md → src/domain/matching/isSameName.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **공유 저장 경계를 유지하는 의미 계약** — docs_development_attendee_member_ids, docs_development_boardmemberids_absent_empty, docs_development_planning_confirmed_sessions, docs_development_shared_storage_consumers [EXTRACTED 1.00]
- **공유 저장 경계를 유지하는 의미 계약** — docs_development_attendee_member_ids, docs_development_boardmemberids_absent_empty, docs_development_planning_confirmed_sessions, docs_development_shared_storage_consumers [EXTRACTED 1.00]
- **정원 결정과 사전식 개인 배치** — docs_group_sizing_model_group_size_policy, docs_group_utility_model_direct_companion_requests, docs_group_utility_model_personal_utility_policy, docs_group_utility_model_bounded_pair_swap_search [EXTRACTED 1.00]
- **정원 결정과 사전식 개인 배치** — docs_group_sizing_model_group_size_policy, docs_group_utility_model_direct_companion_requests, docs_group_utility_model_personal_utility_policy, docs_group_utility_model_bounded_pair_swap_search [EXTRACTED 1.00]
- **후보·내용해시·독립 의미 검토** — docs_knowledge_graph_graphify_primary, docs_knowledge_graph_content_hash_freshness, docs_knowledge_graph_verified_candidate_workflow, docs_knowledge_graph_six_semantic_cases [EXTRACTED 1.00]

## Communities (82 total, 9 thin omitted)

### Community 0 - "면접 선발 결과와 기록"
Cohesion: 0.06
Nodes (63): ApplicantDetailModalProps, Props, assignmentTime(), InterviewerDashboard(), isOperationalApplicant(), Metric(), Props, Props (+55 more)

### Community 1 - "조 편성과 개인 효용"
Cohesion: 0.06
Nodes (57): makeGroups(), solve(), attendanceButtonBase, CostEvaluationModal(), CostEvaluationModalProps, detailedValues(), EvaluationDialog(), Metric() (+49 more)

### Community 2 - "지원자와 출석 CSV 입력"
Cohesion: 0.06
Nodes (48): papaparse, ApplicantCsvImportModalProps, partyLabel(), Props, Summary(), CsvColumnSelect(), CsvColumnSelectProps, aliases (+40 more)

### Community 3 - "지원자 회원 등록"
Cohesion: 0.10
Nodes (36): eligibleSelectedApplicant(), Field(), MemberRegistrationModal(), MemberRegistrationPanel(), Metric(), Props, RegistrationTab, TabButton() (+28 more)

### Community 4 - "공개 면접과 시간 입력"
Cohesion: 0.09
Nodes (34): ApplicantFormModal(), applicantToDraft(), emptyDraft(), addDaysToDateString(), calculateApplicantTimeWindow(), formatKoreanDate(), getKstDateString(), getSlotDate() (+26 more)

### Community 5 - "합성 데이터 초기화"
Cohesion: 0.04
Nodes (32): applicantDefinitions, applicantRecords, attendeeMembers, attendees, availabilityBySchedule, closedAvailability, closedDates, closedSlots (+24 more)

### Community 6 - "앱 라우팅과 공개 화면"
Cohesion: 0.09
Nodes (34): react-router-dom, App(), ArchivePage, AttendancePage, GamesPage, InterviewRoundPage, InterviewRoundsPage, MeetingProgressPage (+26 more)

### Community 7 - "확정 세션 저장과 조회"
Cohesion: 0.13
Nodes (28): Firestore sessions 컬렉션, firebase, getDefaultSessionName(), getLocalDateKey(), getTodaySessionMetadata(), AuditChange, cleanString(), findMember() (+20 more)

### Community 8 - "회원 입력과 공통 UI"
Cohesion: 0.14
Nodes (26): lucide-react, motion, react, ConfirmDeleteModal(), ConfirmDeleteModalProps, GameFilters(), GameFiltersProps, GameForm() (+18 more)

### Community 9 - "면접 회차와 면접관 저장"
Cohesion: 0.09
Nodes (20): useInterviewRoundData(), InterviewRoundCounts, useInterviewRoundsLogic(), subscribeAllInterviewAccess(), subscribeAllInterviewApplicants(), subscribeInterviewAccess(), subscribeInterviewApplicants(), INTERVIEWER_AUDIT_FIELDS (+12 more)

### Community 10 - "Scenario Lab과 출석 미리보기"
Cohesion: 0.11
Nodes (31): react-dom, resolveCompanionRequests(), buildUtilityContext(), AttendanceScenarioState, createAttendanceFixture(), createInterviewFixture(), createMembersFixture(), InterviewScenarioState (+23 more)

### Community 11 - "출석 화면과 이동"
Cohesion: 0.13
Nodes (26): attendanceButtonStyles, AttendanceCsvImportModal(), RowStatus(), AttendanceDragAndDrop(), AttendanceDraggableCard(), AttendanceDropZone(), CardProps, DropZoneProps (+18 more)

### Community 12 - "공유 컬렉션과 설정 내보내기"
Cohesion: 0.14
Nodes (24): CSV 이관과 복구 범위, Firestore games 컬렉션, Firestore members 컬렉션, SettingsAdminPanel(), SettingsAdminPanelProps, SettingsExportPanel(), SettingsExportPanelProps, SettingsPage() (+16 more)

### Community 13 - "출석 통계 차트"
Cohesion: 0.16
Nodes (24): ArchiveLineChart(), AttendanceTrendChart(), chartPresentation, NewcomerTrendChart(), StagnationChart(), TrendChartProps, ArchiveExpandedChartModal(), ArchiveExpandedChartModalProps (+16 more)

### Community 14 - "패키지와 실행 환경"
Cohesion: 0.07
Nodes (29): engines, node, name, private, type, version, clsx, eslint (+21 more)

### Community 15 - "면접 일정 변경과 감사"
Cohesion: 0.12
Nodes (29): getAssignmentScheduleImpact(), useInterviewRoundLogic(), addAuditEventToBatch(), AUDIT_TEXT_LIMITS, auditEventData(), createAuditEventOperation(), createAuditEventRef(), currentActorEmail() (+21 more)

### Community 16 - "게임 입력과 감사 조회"
Cohesion: 0.12
Nodes (23): GameFormProps, AuditRow(), SettingsAuditPanel(), AUDIT_ACTION_LABELS, AUDIT_CATEGORY_LABELS, AuditActionCode, AuditCategory, AuditEvent (+15 more)

### Community 18 - "참석자 저장과 출석 요약"
Cohesion: 0.15
Nodes (23): Firestore attendees 컬렉션, calculateGroupAverageAttendance(), calculateGroupAverageStudentId(), getReunionWarnings(), moveAttendee(), convertAttendeeIdsToMemberIds(), getSizingNotices(), isSameName() (+15 more)

### Community 19 - "개발 검증 실행 명령"
Cohesion: 0.07
Nodes (30): scripts, build, build:staging, check, clean, demo, demo:reset, demo:seed (+22 more)

### Community 20 - "면접 배정 상태와 저장"
Cohesion: 0.20
Nodes (25): filterInterviewApplicants(), isAssignmentConfirmationCurrent(), getApplicantAssignmentRevision(), isActiveAssignment(), prepareScheduleResetTransition(), prepareWithdrawalTransition(), useInterviewAssignmentLogic(), addAuditEventToTransaction() (+17 more)

### Community 21 - "계획 기록과 이름 수정"
Cohesion: 0.15
Nodes (19): Firestore DailyPlannings 컬렉션, MeetingRecordsModal(), button(), click(), mocks, archivedLabel(), MeetingVersionsPanel(), DailyPlanning (+11 more)

### Community 22 - "면접 회차와 데이터 모델"
Cohesion: 0.11
Nodes (27): Props, InterviewCsvExportInput, ApplicantDraft, AssignmentProposalWrite, CompleteInterviewInput, getInterviewLink(), INTERVIEW_LINK_ORIGIN, InterviewRoundDraft (+19 more)

### Community 23 - "면접 자동 배정 알고리즘"
Cohesion: 0.15
Nodes (26): addEdge(), AutoAssignmentApplicant, AutoAssignmentExisting, AutoAssignmentFailure, AutoAssignmentFailureReason, AutoAssignmentInput, AutoAssignmentInterviewer, AutoAssignmentMode (+18 more)

### Community 24 - "면접 일정 정책"
Cohesion: 0.14
Nodes (25): addDays(), addMinutesToSlot(), AffectedScheduleResponse, assertPositiveInteger(), AssignmentScheduleImpact, AssignmentScheduleImpactItem, assignmentsOverlap(), AvailabilityResponse (+17 more)

### Community 25 - "면접 일정 관리 화면"
Cohesion: 0.19
Nodes (18): formatDateRange(), InterviewScheduleManagement(), scheduleLabel(), dateRange(), InterviewScheduleSelector(), statusLabel(), activeApplicant(), dateRange() (+10 more)

### Community 26 - "과거 UA 검증 도구"
Cohesion: 0.15
Nodes (19): artifactHashes(), artifactNames, atomic(), canonical(), controls, cosmeticReviewIssues(), fileTypes, freshness() (+11 more)

### Community 27 - "개발 도구 의존성"
Cohesion: 0.08
Nodes (24): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, firebase-admin, @firebase/eslint-plugin-security-rules, @firebase/rules-unit-testing, firebase-tools (+16 more)

### Community 28 - "모임 진행 데이터와 화면"
Cohesion: 0.17
Nodes (15): MeetingCanvasTabProps, MeetingDashboardTabProps, UnassignedPoolProps, getMemberFromAttendee(), GroupCostContextInput, Reason, RecMode, Attendee (+7 more)

### Community 29 - "Graphify 최신성 검증기"
Cohesion: 0.17
Nodes (15): artifactHashes(), artifacts, atomic(), freshness(), git(), inputHash(), inventory(), walk() (+7 more)

### Community 30 - "면접 완료와 지원자 진행"
Cohesion: 0.24
Nodes (16): getApplicantJourney(), prepareInterviewCompletion(), prepareInterviewReopen(), canAppearInInterviewProgress(), canAppearInSchedule(), canAppearInSelection(), getInterviewProgressStatus(), isActiveInterviewApplicant() (+8 more)

### Community 31 - "모임 게임과 Firestore 조회"
Cohesion: 0.17
Nodes (15): html-to-image, sonner, calculateGridPositions(), generateDrinkOrderText(), getMemberPlayedGames(), prng(), recommendGames(), koreaDateKey() (+7 more)

### Community 32 - "조 효용 프로토타입"
Cohesion: 0.21
Nodes (16): compareAssignments(), evaluateAssignment(), EXAMPLE_PARAMETERS, key(), saturation(), stringOrder(), syntheticMembers(), evaluate() (+8 more)

### Community 33 - "학기 통계와 기록 필터"
Cohesion: 0.26
Nodes (12): getSemester(), getAvailableArchiveSemesters(), getAttendanceRanking(), getAttendanceTrend(), getGameMmi(), getNewcomerTrend(), getActiveMembersAtSemester(), getStagnationIndex() (+4 more)

### Community 34 - "지원자 상세와 안내 메시지"
Cohesion: 0.16
Nodes (16): ApplicantDetailModal(), copyText(), formatTimestamp(), getAssignmentParts(), getStoredAssignmentParts(), AvailabilitySummaryRow, minutesToTime(), summarizeAvailabilitySlots() (+8 more)

### Community 35 - "면접 일정 배정 화면"
Cohesion: 0.18
Nodes (20): activeApplicant(), Bot(), CompactStatus(), confirmationCurrent(), DraggableScheduleCard(), DroppableScheduleCell(), halfHourBucket(), INTERVIEWER_THEMES (+12 more)

### Community 36 - "TypeScript 컴파일 설정"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, allowJs, exactOptionalPropertyTypes, experimentalDecorators, isolatedModules, jsx, lib (+12 more)

### Community 37 - "면접 회차 작업 화면"
Cohesion: 0.15
Nodes (15): ApplicantCsvImportModal(), Summary(), ApplicantJourney(), InterviewRoundDeleteModal(), Props, ApplicantRow(), FILTERS, formatAssignment() (+7 more)

### Community 38 - "낙관적 배정과 확인 정책"
Cohesion: 0.14
Nodes (11): applyOptimisticAssignment(), assignmentIdentity(), rollbackOptimisticApplicant(), AssignmentData, Harness(), initialApplicant, interviewer, { saveInterviewAssignment } (+3 more)

### Community 39 - "운영 산출물과 권한 점검 도구"
Cohesion: 0.12
Nodes (12): baseline, current(), probe(), results, rules, distDirectory, forbiddenFiles, forbiddenMarkers (+4 more)

### Community 40 - "공식 Graphify 분석 파이프라인"
Cohesion: 0.24
Nodes (7): ast(), build(), load(), portable(), save(), scan(), seal()

### Community 41 - "세션 폼과 회원 이동"
Cohesion: 0.15
Nodes (12): @dnd-kit/core, @dnd-kit/utilities, DndHandlers, DraggableMember(), DroppablePool(), GroupActions, ModalControl, SessionData (+4 more)

### Community 42 - "일별 세션과 도메인 검증"
Cohesion: 0.18
Nodes (10): vitest, resolveDailySessionId(), ResolveDailySessionIdInput, attendee(), member(), session(), timestamp(), games (+2 more)

### Community 43 - "모임 기록과 회원 기록 조회"
Cohesion: 0.26
Nodes (13): ArchiveWidgetCorePlayersProps, GroupGamesEditModal(), GroupGamesEditModalProps, MemberProfileModal(), MemberProfileModalProps, CoreData, SessionList(), SessionListProps (+5 more)

### Community 44 - "면접 수정 충돌 검증"
Cohesion: 0.27
Nodes (13): normalizeApplicantNumber(), assertExpectedRevision(), assertExpectedUpdatedAt(), InterviewRevisionConflictError, timestampMillis(), APPLICANT_AUDIT_FIELDS, applicantAuditView(), createInterviewApplicant() (+5 more)

### Community 45 - "브라우저 시나리오 검증"
Cohesion: 0.13
Nodes (4): @playwright/test, preview(), startDrag(), scenarios

### Community 46 - "면접 배정 모달과 넘침 검증"
Cohesion: 0.19
Nodes (12): formatRange(), InterviewScheduleAssignmentModal(), Props, Props, Props, Props, Props, InterviewScheduleDraft (+4 more)

### Community 47 - "운영 앱 의존성"
Cohesion: 0.13
Nodes (15): dependencies, clsx, @dnd-kit/core, @dnd-kit/utilities, firebase, html-to-image, lucide-react, motion (+7 more)

### Community 48 - "면접 재배정과 자동 배정 화면"
Cohesion: 0.25
Nodes (12): AutoAssignmentPanel(), reasonLabel, slotLabel(), AutoAssignmentResult, candidatesForVacatedSlot(), ReassignmentApplicant, ReassignmentInterviewer, ReassignmentRecommendation (+4 more)

### Community 49 - "면접 일정 입력 폼"
Cohesion: 0.31
Nodes (13): addDays(), dateFromKey(), datesInRange(), dateWeekName(), InterviewScheduleFormModal(), scheduleToDraft(), suggestedInterviewScheduleDraft(), SurveyDateTimeCard() (+5 more)

### Community 50 - "조 비용 평가와 문맥"
Cohesion: 0.32
Nodes (11): buildGroupCostContext(), calculateAgeVarianceCost(), calculateGenderCost(), calculateMeanBalanceCost(), calculatePairEffects(), CostCalculationContext, getActivity(), getExperience() (+3 more)

### Community 51 - "Firebase 런타임과 접근 권한"
Cohesion: 0.15
Nodes (11): app, FirestoreErrorInfo, googleProvider, isDemoMode, OperationType, CREATE, DELETE, GET (+3 more)

### Community 52 - "회원 참여 이력과 인원 통계"
Cohesion: 0.24
Nodes (7): getParticipationHistory(), ParticipationHistory, compareSemesters(), getNewbieMembersAtSemester(), isMemberActiveAtSemester(), parseSemester(), members

### Community 53 - "Firebase 설정과 인덱스"
Cohesion: 0.18
Nodes (12): 합성 Demo Firebase 연결, 운영 Firebase 앱 연결, Staging Firebase 앱 연결, Demo Emulator 구성, 운영 구성 내 Firestore Emulator 설정, 운영 Firebase 배포 구성, Staging Firebase 배포 구성, 지원자 회차·면접관·시각 인덱스 (+4 more)

### Community 54 - "조 편성 설계와 동반 정책"
Cohesion: 0.22
Nodes (10): 동반 후보 선택 임시 저장, 조 인원 구성 모델, 수동 배치와 정원 하한, 채택한 성별 초기 운영값, 제한된 개인·동반 쌍 교환 탐색, 동반 상대 이름 해석, 직접 동반 요청의 체감 효용, 개인 참석 순서 재회 감쇠 (+2 more)

### Community 55 - "에뮬레이터 실행 환경"
Cohesion: 0.25
Nodes (6): findJava(), firebaseCli, normalizeJavaHome(), projectRoot, runEmulators(), projectRoot

### Community 56 - "성별 효용 분석 도구"
Cohesion: 0.36
Nodes (9): evaluateGenderLayout(), GENDER_REVIEW_SIZES, genderUtility(), PREVIOUS_GENDER_PARAMETERS, REVIEW_CURVES, reviewCurve(), reviewGenderComposition(), reviewGenderSuite() (+1 more)

### Community 57 - "합성 면접 일정과 노트"
Cohesion: 0.20
Nodes (11): completedNotes, daySchedules(), interviewerProfiles, kstDate(), kstDateKey(), kstParts(), makeSchedule(), members (+3 more)

### Community 58 - "출석 초안과 동반 선택"
Cohesion: 0.33
Nodes (10): isRequestSelections(), RequestSelections, AttendanceDraft, defaultDraft(), drafts, emptySelections, isDraft(), readDraft() (+2 more)

### Community 59 - "개발 설계와 운영 절차"
Cohesion: 0.22
Nodes (8): Firebase 기본 프로젝트와 Hosting 대상, CI 검증, 현재 디자인 관찰 기록, 목표 디자인 기준, 역사 릴리스 기록 v1.0.0~v1.2.1, 운영 환경과 인수인계, 제품 완성 계획, 공통 CSS 테마와 업무 클래스

### Community 60 - "모임 캔버스와 게임 아이콘"
Cohesion: 0.38
Nodes (6): DiamondSvg(), RookSvg(), MeetingCanvasTab(), MeetingCardStyleModal(), MeetingDashboardTab(), MeetingProgressPage()

### Community 61 - "게임 기록과 핵심 참여자 통계"
Cohesion: 0.36
Nodes (6): matchesArchiveGameFilters(), games, members, session, getCorePlayers(), getPopularGames()

### Community 62 - "드래그 자동 스크롤"
Cohesion: 0.31
Nodes (8): canScroll(), EdgeAutoScrollOptions, PointerPosition, scrollableAncestors(), ScrollTarget, supportsVerticalScroll(), useEdgeAutoScroll(), verticalEdgeSpeed()

### Community 63 - "출석과 저장의 업무 계약"
Cohesion: 0.39
Nodes (8): 참석자 ID와 저장 회원 ID, boardMemberIds 부재와 빈 배열, 개발 가이드, 계획과 확정 세션, scheduleId의 세 가지 앱 의미, 공유 저장소 간접 소비자, 편성 Worker와 취소, 필수 여섯 의미 검증 사례

### Community 64 - "Firestore 권한과 공개 접근"
Cohesion: 0.28
Nodes (8): accessScheduleId, 감사 이벤트 추가 전용 정책, Firestore 권한 정책, 지원자 bearer 접근 문서, 점진적 저장 필드 검증, 내부 공유 컬렉션 보호, 활성 공개 설정 exact get, 공개 응답 변경 검증

### Community 65 - "지원자 여정 상태 계산"
Cohesion: 0.28
Nodes (6): BADGE_CLASS, APPLICANT_JOURNEY_STATIONS, ApplicantJourneyBadgeTone, ApplicantJourneyModel, JourneyApplicant, base

### Community 66 - "면접 회차 입력 폼"
Cohesion: 0.42
Nodes (7): addMinutesToTime(), InterviewRoundFormModal(), roundToDraft(), schedulesFromDraft(), timeToMinutes(), resolveInterviewMessageTemplates(), generateAvailabilitySlotsForSchedules()

### Community 67 - "면접 회차 진행 화면"
Cohesion: 0.33
Nodes (7): getRoundScheduleStatus(), getSurveyStatus(), InterviewRoundsPage(), mocks, round, schedule(), stamp()

### Community 68 - "지원자 정렬 기준"
Cohesion: 0.33
Nodes (6): ApplicantSortKey, comparable(), SortableApplicant, sortInterviewApplicants(), toMillis(), valueFor()

### Community 69 - "Graphify 해시와 재사용 정책"
Cohesion: 0.29
Nodes (6): Git 텍스트 LF 정규화, 입력·산출물 해시 최신성, Graphify 0.9.84 주 탐색 도구, 미지원 텍스트 의미 보완, 새 컴퓨터 재현, 고정 Graphify 공식 도구체인

### Community 70 - "Firestore 보안 규칙 검증"
Cohesion: 0.33
Nodes (4): @firebase/rules-unit-testing, InterviewFixtureOptions, seedInterviewFixture(), seedScheduledInterviewFixture()

### Community 71 - "면접관 참여 화면"
Cohesion: 0.52
Nodes (4): Info(), InterviewersPanel(), RosterInfo(), countActiveInterviewerSchedules()

### Community 72 - "프로젝트 개요와 Design Lab"
Cohesion: 0.40
Nodes (4): Scenario HTML 진입점, Avalon Club Manager, Emulator Design Lab, Scenario Lab

### Community 73 - "합성 지원서와 메시지"
Cohesion: 0.67
Nodes (3): applicantApplication(), buildApplicant(), sentMessage()

## Knowledge Gaps
- **372 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+367 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 514 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `내부 공유 컬렉션 보호` connect `Firestore 권한과 공개 접근` to `출석과 저장의 업무 계약`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _372 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `면접 선발 결과와 기록` be split into smaller, more focused modules?**
  _Cohesion score 0.057911392405063294 - nodes in this community are weakly interconnected._
- **Why does `공유 저장소 간접 소비자` connect `출석과 저장의 업무 계약` to `학기 통계와 기록 필터`, `확정 세션 저장과 조회`, `모임 기록과 회원 기록 조회`, `공유 컬렉션과 설정 내보내기`, `참석자 저장과 출석 요약`, `모임 게임과 Firestore 조회`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **Should `조 편성과 개인 효용` be split into smaller, more focused modules?**
  _Cohesion score 0.06015037593984962 - nodes in this community are weakly interconnected._
- **Should `지원자와 출석 CSV 입력` be split into smaller, more focused modules?**
  _Cohesion score 0.05786090005844535 - nodes in this community are weakly interconnected._
- **Should `지원자 회원 등록` be split into smaller, more focused modules?**
  _Cohesion score 0.09993011879804332 - nodes in this community are weakly interconnected._

## Project verification boundary

Semantic extraction used the current Codex session. Exact input/output token totals are unavailable; library counters of 0 do not mean no LLM cost. This graph contains current source relationships plus inferred document concepts. Source/tests/Rules remain authoritative.
