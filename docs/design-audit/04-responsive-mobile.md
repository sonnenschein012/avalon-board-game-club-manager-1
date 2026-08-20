# 04. Responsive / Mobile

### 기준 breakpoint
- 상태: 유지
- 태그: [RESPONSIVE] [MOBILE] [TABLET] [DESKTOP]
- 위치: `src/App.tsx:136,176`, `src/components/Sidebar.tsx:56-123`, `src/components/MemberList.tsx:88-187`
- 현재 구현 근거: 명시적으로 `sm`, `md`가 사용되며 App은 `sm:p-6 md:p-12`, Sidebar와 목록 전환은 `md`, 버튼 label 축약은 `sm`이다. `lg`/`xl` breakpoint는 파일럿 핵심 코드에서 확인되지 않는다.
- 시각적 역할: 작은 화면에서 여백·텍스트·nav·목록 표현을 단계적으로 바꾼다.
- 반응형 영향: `sm`은 label/padding, `md`는 shell 방향과 desktop/mobile branch를 결정한다.
- 변경 방식: 스타일만
- 우선순위: P0
- 주의점: Tailwind 설정의 실제 breakpoint 값은 이 문서에서 추정하지 않으며, 클래스 사용 근거만 기록한다.

### 하단 네비게이션
- 상태: 변경
- 태그: [RESPONSIVE] [MOBILE] [FIXED] [SCROLL] [OVERFLOW]
- 위치: `src/components/Sidebar.tsx:55-78`, `src/App.tsx:136`
- 현재 구현 근거: `fixed bottom-0 left-0 right-0 z-50 h-16`; nav list `overflow-x-auto overscroll-x-contain scroll-smooth`; `min-w-max`; App `pb-16 md:pb-0`.
- 시각적 역할: 모바일에서 화면 하단에 항상 접근 가능한 메뉴를 제공한다.
- 반응형 영향: `md`에서 `sticky top-0 h-screen overflow-visible` 세로 nav로 바뀐다.
- 변경 방식: 레이아웃 변경
- 우선순위: P0
- 주의점: safe-area, modal 하단과의 겹침, 가로 swipe와 page vertical scroll의 제스처 충돌을 확인.

### 모바일 전용 메뉴 표시
- 상태: 유지
- 태그: [RESPONSIVE] [MOBILE] [NAV] [ICON]
- 위치: `src/components/Sidebar.tsx:112-123`
- 현재 구현 근거: desktop label `hidden md:inline`, mobile label `md:hidden ... text-[9px]`; icon `size-5 ... md:size-[18px]`; tile `w-[76px]`.
- 시각적 역할: 모바일에서는 아이콘 아래 짧은 label, desktop에서는 좌우 icon+label을 제공한다.
- 반응형 영향: 긴 label은 `max-w-[72px] truncate`; collapsed desktop은 label을 숨긴다.
- 변경 방식: 스타일만
- 우선순위: P1
- 주의점: `truncate`만으로는 번역/긴 탭명 의미가 사라질 수 있다.

### 멤버 목록 desktop→mobile 전환
- 상태: 변경
- 태그: [RESPONSIVE] [MOBILE] [DESKTOP] [TABLE] [OVERFLOW]
- 위치: `src/components/MemberList.tsx:88-110,186-223`
- 현재 구현 근거: desktop header/row `hidden md:flex`; mobile card `md:hidden`; outer `overflow-x-auto`, inner `md:min-w-[600px]`.
- 시각적 역할: desktop의 열 기반 목록과 mobile의 카드 기반 목록을 같은 데이터에 제공한다.
- 반응형 영향: `md` 미만에서는 table header와 row가 완전히 숨고 카드 branch만 표시된다.
- 변경 방식: 레이아웃 변경
- 우선순위: P0
- 주의점: 두 branch에 동일한 선택·수정·프로필·삭제 action이 모두 존재하는지 검증.

### 필터 wrapping
- 상태: 변경
- 태그: [RESPONSIVE] [MOBILE] [FILTER] [OVERFLOW]
- 위치: `src/components/MemberFilters.tsx:57-91`
- 현재 구현 근거: `flex flex-wrap gap-4`; search `flex-1 min-w-[200px]`; controls `flex flex-wrap gap-2`.
- 시각적 역할: 검색과 select 필터를 한 패널 안에서 폭에 따라 재배열한다.
- 반응형 영향: 명시 breakpoint 없이 available width에 따라 wrap; `min-w-[200px]`가 최소 폭을 만든다.
- 변경 방식: 스타일만
- 우선순위: P0
- 주의점: select native UI와 가로 overflow 발생 여부를 실제 좁은 viewport에서 확인.

### 프로필 모달 모바일 폭과 스크롤
- 상태: 변경
- 태그: [RESPONSIVE] [MOBILE] [DESKTOP] [MODAL] [SCROLL] [OVERFLOW]
- 위치: `src/components/MemberProfileModal.tsx:43-61`
- 현재 구현 근거: panel `w-full max-w-2xl h-full ... overflow-y-auto p-4 md:p-8`; backdrop full inset.
- 시각적 역할: 모바일 full-screen, desktop right drawer를 만든다.
- 반응형 영향: `w-full`은 모든 폭에서 full basis지만 `max-w-2xl`이 desktop panel을 제한한다.
- 변경 방식: 레이아웃 변경
- 우선순위: P0
- 주의점: backdrop와 panel의 click boundary, scroll chaining, keyboard viewport를 확인.

### 터치 타깃
- 상태: 변경
- 태그: [RESPONSIVE] [MOBILE] [BUTTON] [ICON]
- 위치: `src/components/MemberList.tsx:144-179,226-258`, `src/components/MembersPage.tsx:61-71`, `src/components/Sidebar.tsx:112-123`
- 현재 구현 근거: 목록 action `p-1.5`, page action `px-3 py-2`, nav tile `w-[76px] py-2`; close button modal `p-2`.
- 시각적 역할: 작은 화면에서 조작 가능한 표면을 제공한다.
- 반응형 영향: page action text가 축약되고 nav tile 폭이 고정된다.
- 변경 방식: 스타일만
- 우선순위: P1
- 주의점: icon-only controls의 실제 hit area와 인접 action 간 간격을 별도 검증.

### fixed / sticky / z-index inventory
- 상태: 공용화 후보
- 태그: [RESPONSIVE] [FIXED] [MODAL] [OVERFLOW]
- 위치: `src/components/Sidebar.tsx:56`, `src/components/MemberProfileModal.tsx:43,55`, `src/components/ConfirmDeleteModal.tsx:17`, `src/components/ApplicantDetailModal.tsx:108`
- 현재 구현 근거: Sidebar `z-50`, profile `z-50`, confirm `z-[100]`; applicant detail 내부 header `sticky top-0 z-10`.
- 시각적 역할: overlay, drawer, sticky header의 stacking 순서를 결정한다.
- 반응형 영향: Sidebar만 mobile fixed/desktop sticky로 변경.
- 변경 방식: 컴포넌트 추출
- 우선순위: P1
- 주의점: 동일 z-index 모달과 navigation의 DOM stacking context, backdrop 클릭 영역을 회귀 테스트.

### ResizeObserver와 scroll edge 표시
- 상태: 유지
- 태그: [RESPONSIVE] [MOBILE] [SCROLL] [OVERFLOW]
- 위치: `src/components/Sidebar.tsx:28-51,63-69`
- 현재 구현 근거: `ResizeObserver(updateScrollEdges)`와 `scrollWidth > clientWidth`; 좌우 `bg-gradient-to-r/l ... md:hidden` fade, `ChevronLeft/Right`.
- 시각적 역할: 모바일 메뉴가 더 넓을 때 좌우 스크롤 가능성을 시각적으로 알린다.
- 반응형 영향: fade/chevron은 `md:hidden`, desktop에는 표시하지 않는다.
- 변경 방식: 스타일만
- 우선순위: P2
- 주의점: observer cleanup과 scroll event, scrollbar 숨김 class가 navigation 접근성을 해치지 않는지 확인.
