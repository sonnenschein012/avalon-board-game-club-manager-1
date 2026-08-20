# 05. Out of Pilot

파일럿 밖의 시각 코드는 공통 토큰·모달·반응형 규칙을 바꿀 때 영향받는 부분만 간결히 기록한다.

### 출석 관리
- 상태: 파일럿 제외
- 태그: [OUT-OF-PILOT] [DENSE-UI] [TABLE] [RESPONSIVE]
- 위치: `src/components/AttendancePage.tsx`, `src/components/AvailabilityGrid.tsx:1-200`
- 현재 구현 근거: `grid`, `overflow-x-auto`, 날짜/시간 cell의 고정 폭과 상태색 클래스가 사용된다.
- 시각적 역할: 출석·가능 시간의 밀집 그리드와 상태 표시.
- 반응형 영향: 좁은 화면의 가로 스크롤과 cell 밀도에 영향.
- 변경 방식: 스타일만
- 우선순위: P2
- 주의점: 파일럿 공통 색상 토큰 변경 시 상태색 의미를 보존.

### 모임 진행 캔버스
- 상태: 파일럿 제외
- 태그: [OUT-OF-PILOT] [CANVAS] [DENSE-UI] [OVERFLOW]
- 위치: `src/components/MeetingCanvasTab.tsx`, `src/components/GroupsCanvas.tsx`, `src/components/MeetingProgressPage.tsx`
- 현재 구현 근거: canvas/그룹 영역의 absolute 배치, drag 관련 className, overflow 컨테이너가 사용된다.
- 시각적 역할: 조 편성·게임 진행을 공간 배치로 보여준다.
- 반응형 영향: 고정 캔버스 크기와 overflow가 viewport에 영향.
- 변경 방식: 레이아웃 변경
- 우선순위: P2
- 주의점: 공통 토큰을 변경할 때 canvas의 시각적 좌표·layer 보존 여부는 레퍼런스 조사 후 결정해야 한다.

### 세션·게임 목록
- 상태: 파일럿 제외
- 태그: [OUT-OF-PILOT] [CARD] [TABLE] [RESPONSIVE]
- 위치: `src/components/SessionsPage.tsx:50-77`, `src/components/SessionList.tsx`, `src/components/GamesPage.tsx`, `src/components/GameList.tsx`, `src/components/GameFilters.tsx`
- 현재 구현 근거: `space-y-6`, `flex-wrap`, `md:*`, `overflow-x-auto`, `rounded-xl`, `bg-navy hover:bg-gold`, `hidden sm:inline`이 반복된다.
- 시각적 역할: 세션/게임의 목록, 필터, CSV 업로드, 생성 액션.
- 반응형 영향: 세션 action label 축약, filter wrap, 목록 가로 overflow.
- 변경 방식: 공용 컴포넌트 추출
- 우선순위: P2
- 주의점: Members의 PageHeader/Button/Filter 토큰을 공유할 후보지만 파일럿에서 직접 수정하지 않는다.

### 아카이브·차트
- 상태: 파일럿 제외
- 태그: [OUT-OF-PILOT] [CHART] [CARD] [MODAL]
- 위치: `src/components/ArchivePage.tsx`, `src/components/ArchiveWidgetCharts.tsx`, `src/components/ArchiveWidgetRanking.tsx`, `src/components/ArchiveWidgetCorePlayers.tsx`, `src/components/ArchiveWidgetPopularGames.tsx`, `src/components/ArchiveExpandedChartModal.tsx`, `src/components/ArchiveFormulaModal.tsx`
- 현재 구현 근거: chart widget 카드, `grid` 배치, `fixed inset-0 z-50`, `max-h-[92vh] overflow-*`, `shadow-2xl` modal 패턴.
- 시각적 역할: 통계 카드·차트·확대 설명 모달.
- 반응형 영향: grid 열 수, chart 최소 폭, modal 내부 scroll.
- 변경 방식: 스타일만
- 우선순위: P2
- 주의점: chart 색상은 foundation palette와 연결되지만 데이터 의미를 색상만으로 바꾸지 않는다.

### 면접 운영·공개 페이지
- 상태: 파일럿 제외
- 태그: [OUT-OF-PILOT] [PUBLIC-PAGE] [DENSE-UI] [MODAL]
- 위치: `src/components/InterviewRoundPage.tsx`, `src/components/InterviewRoundsPage.tsx`, `src/components/InterviewersPanel.tsx`, `src/components/InterviewSchedulePanel.tsx`, `src/components/InterviewWorkspaceModal.tsx`, `src/components/InterviewRoundFormModal.tsx`, `src/components/InterviewerDashboard.tsx`, `src/components/PublicInterviewPage.tsx`, `src/components/ApplicantDetailModal.tsx`, `src/components/ApplicantFormModal.tsx`, `src/components/ApplicantCsvImportModal.tsx`, `src/components/SelectionPanel.tsx`, `src/components/SelectionDetailModal.tsx`
- 현재 구현 근거: 지원자/면접 modal의 `fixed`, `max-h-[92vh]`, `overflow-y-auto`, `grid sm:grid-cols-*`, status badge 색, 공개 입력 페이지의 panel/label classes.
- 시각적 역할: 면접 스케줄·평가·지원자 입력을 밀도 높은 업무 UI로 표현.
- 반응형 영향: sm grid 전환, modal full-width/max-width, preview table `overflow-x-auto`.
- 변경 방식: 공용 컴포넌트 추출
- 우선순위: P2
- 주의점: 공개 페이지는 관리자 셸과 다른 사용자 맥락이므로 foundation 변경의 대비·focus를 별도로 확인.

### 설정·로그인
- 상태: 파일럿 제외
- 태그: [OUT-OF-PILOT] [SHARED] [FORM] [CARD]
- 위치: `src/components/SettingsPage.tsx`, `src/components/SettingsAdminPanel.tsx`, `src/components/SettingsExportPanel.tsx`, `src/components/LoginGate.tsx`
- 현재 구현 근거: `glass-panel`, `input-field`, `bg-white p-6 rounded-2xl shadow-sm`, toggle `h-6 w-11 rounded-full transition-colors`, export rows `bg-slate-50/50 rounded-xl`.
- 시각적 역할: 관리자 설정, export, 로그인 gate의 카드·폼·toggle.
- 반응형 영향: 설정 카드 padding과 admin table width, 로그인 화면 중앙 정렬에 영향.
- 변경 방식: 스타일만
- 우선순위: P2
- 주의점: 공용 input/button 토큰을 변경할 때 관리자 권한·로그인 상태를 시각적으로 혼동시키지 않는다.

### 아이콘/특수 패널
- 상태: 파일럿 제외
- 태그: [OUT-OF-PILOT] [ICON] [CANVAS] [DENSE-UI]
- 위치: `src/components/CostEvaluationModal.tsx`, `src/components/GroupGamesEditModal.tsx`, `src/components/AutoAssignmentPanel.tsx`, `src/components/UnassignedPool.tsx`, `src/components/ManualAddModal.tsx`, `src/components/FilterPills.tsx`, `src/components/MeetingCardStyleModal.tsx`, `src/components/SelectionPanel.tsx`
- 현재 구현 근거: panel/modal `rounded-*`, `shadow-*`, status pill, drag/drop 또는 선택 목록의 overflow와 icon size classes.
- 시각적 역할: 조 편성·평가·선택 상태를 조작 가능한 dense panel로 제공.
- 반응형 영향: modal max-height/overflow와 작은 화면의 flex wrap.
- 변경 방식: 스타일만
- 우선순위: P2
- 주의점: 파일럿에서 직접 변경하지 않고 공용 modal/pill 토큰을 적용할 때만 영향 추적.
