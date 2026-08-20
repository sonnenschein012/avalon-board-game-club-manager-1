# 02. Shared Components

### Sidebar / 앱 내비게이션
- 상태: 공용화 후보
- 태그: [SHARED] [NAV] [ICON] [RESPONSIVE] [FIXED] [SCROLL]
- 위치: `src/components/Sidebar.tsx:55-152`
- 현재 구현 근거: `fixed bottom-0 ... z-50 md:sticky md:top-0`; `md:w-20`/`md:w-64`; 모바일 `h-16 overflow-x-auto ... scroll-smooth`; 활성 메뉴 `md:bg-navy md:text-white md:shadow-md`; `ResizeObserver`로 scroll edge를 갱신한다.
- 시각적 역할: 데스크톱 세로 사이드바와 모바일 하단 가로 메뉴, collapsed 상태, 사용자 영역을 제공한다.
- 반응형 영향: `md`에서 fixed 하단→sticky 좌측, 아이콘+텍스트, `h-screen`; 모바일은 76px 메뉴 타일과 좌우 fade를 사용한다.
- 변경 방식: 컴포넌트 추출
- 우선순위: P0
- 주의점: `z-50`, `overflow-x-auto`, `min-w-max`가 페이지/모달 stacking 및 터치 스크롤에 직접 영향.

### PageHeader
- 상태: 공용화 후보
- 태그: [SHARED] [CARD] [ICON] [LAYOUT]
- 위치: `src/components/PageHeader.tsx:20-38`
- 현재 구현 근거: `flex flex-col md:flex-row ... bg-white p-4 md:p-6 rounded-2xl shadow-sm`; 제목 `text-xl md:text-2xl`; stats는 `md:border-r`; actions wrapper `w-full md:w-auto`.
- 시각적 역할: 제목·subtitle·통계·페이지 액션을 한 패널에 묶는다.
- 반응형 영향: 모바일 세로 쌓임, 데스크톱 양끝 정렬; 통계 구분선은 `md` 이상에서만 표시.
- 변경 방식: 컴포넌트 추출
- 우선순위: P1
- 주의점: 버튼 수가 늘면 `flex-wrap`과 `justify-between`로 헤더 높이가 예측보다 커질 수 있다.

### 공용 패널/입력 규칙
- 상태: 공용화 후보
- 태그: [SHARED] [CARD] [INPUT] [ELEVATION]
- 위치: `src/index.css:17-43`, `src/components/SettingsAdminPanel.tsx:38-58`, `src/components/SettingsExportPanel.tsx:22-63`
- 현재 구현 근거: `glass-panel`, `input-field`, `rounded-xl`, `bg-slate-50`, `border-slate-100`, `shadow-sm`가 설정·멤버·게임 화면에 반복된다.
- 시각적 역할: 화면 간 카드 표면, 입력 높이, border/shadow의 공통 언어다.
- 반응형 영향: 패널 padding은 `md`에서 증가하며, 설정 표는 별도 overflow 없이 width에 의존한다.
- 변경 방식: 컴포넌트 추출
- 우선순위: P1
- 주의점: 공용 클래스와 개별 클래스의 우선순위가 섞여 있다.

### 버튼과 아이콘 액션
- 상태: 공용화 후보
- 태그: [SHARED] [BUTTON] [ICON]
- 위치: `src/components/MembersPage.tsx:49-71`, `src/components/MemberList.tsx:144-179`, `src/components/ConfirmDeleteModal.tsx:32-42`
- 현재 구현 근거: 주요 버튼 `bg-navy hover:bg-gold ... rounded-xl shadow-lg`; 보조 버튼 `bg-white ... border ... shadow-sm`; 행 액션은 `p-1.5 ... rounded border ...`.
- 시각적 역할: 생성·업로드·수정·삭제의 hierarchy와 상태를 전달한다.
- 반응형 영향: MembersPage는 `hidden sm:inline`/`sm:hidden`으로 레이블을 축약한다.
- 변경 방식: 컴포넌트 추출
- 우선순위: P1
- 주의점: 아이콘-only 액션의 aria-label/title과 44px에 가까운 터치 영역을 별도로 검증해야 한다.

### ConfirmDeleteModal
- 상태: 공용화 후보
- 태그: [SHARED] [MODAL] [BUTTON]
- 위치: `src/components/ConfirmDeleteModal.tsx:17-42`
- 현재 구현 근거: `fixed inset-0 z-[100] ... bg-navy/20 backdrop-blur-sm`; `w-full max-w-sm overflow-hidden rounded-2xl shadow-xl`; 취소/삭제 버튼의 `flex-1`.
- 시각적 역할: 파괴적 작업 확인을 화면 중앙의 짧은 modal로 강조한다.
- 반응형 영향: `p-4`로 모바일 viewport 여백을 확보하고 modal은 `max-w-sm`로 제한.
- 변경 방식: 스타일만
- 우선순위: P2
- 주의점: `z-[100]`은 다른 modal의 `z-50`보다 높아 stacking 의도가 공용 규칙으로 남아야 한다.

### AvalonLogo와 SVG 아이콘
- 상태: 유지
- 태그: [SHARED] [ICON]
- 위치: `src/components/AvalonLogo.tsx:10-20`, `src/components/icons/DiamondSvg.tsx`, `src/components/icons/RookSvg.tsx`
- 현재 구현 근거: SVG `viewBox` 기반 컴포넌트, 부모가 전달하는 `className`; 외부 아이콘은 lucide 계열 `size={14..40}`.
- 시각적 역할: 브랜드와 기능 아이콘의 공통 삽입 지점.
- 반응형 영향: 부모 크기와 Sidebar breakpoint에 종속.
- 변경 방식: 컴포넌트 추출
- 우선순위: P2
- 주의점: SVG fill/stroke와 Tailwind text color 전달 방식이 아이콘마다 다를 수 있다.

### 반복 모달 골격
- 상태: 공용화 후보
- 태그: [SHARED] [MODAL] [OVERFLOW] [FIXED]
- 위치: `src/components/ApplicantFormModal.tsx:34-47`, `src/components/ApplicantDetailModal.tsx:108-111`, `src/components/SessionFormModal.tsx`, `src/components/SelectionDetailModal.tsx:45-51`
- 현재 구현 근거: `fixed inset-0 z-50`, `bg-slate-950/60 backdrop-blur-sm`, `max-h-[92vh]`, `overflow-y-auto`, `rounded-3xl bg-white shadow-2xl`가 반복된다.
- 시각적 역할: 긴 폼/상세 콘텐츠를 viewport 안에서 독립 스크롤시키는 modal shell.
- 반응형 영향: `p-3/p-4`, `sm:p-6`, `md:grid-cols-2` 등 내부 콘텐츠만 breakpoint별 변경.
- 변경 방식: 컴포넌트 추출
- 우선순위: P1
- 주의점: body scroll lock·focus trap은 이 시각 조사에서 구현 근거가 확인되지 않았으므로 기능 논의가 필요할 수 있다.
