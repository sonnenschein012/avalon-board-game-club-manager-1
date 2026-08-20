# 03. Members Pilot

### 앱 셸
- 상태: 변경
- 태그: [PILOT] [MEMBERS] [LAYOUT] [RESPONSIVE] [FIXED] [OVERFLOW]
- 위치: `src/App.tsx:136-184`, `src/components/Sidebar.tsx:55-78`
- 현재 구현 근거: App `min-h-screen flex flex-col md:flex-row ... pb-16 md:pb-0`; `main.flex-1 overflow-auto`; 콘텐츠 `p-4 sm:p-6 md:p-12`; Sidebar `fixed bottom-0 ... md:sticky`, 모바일 `h-16 overflow-x-auto`.
- 시각적 역할: 멤버 화면을 포함한 모든 페이지의 좌측/하단 navigation, viewport 높이, 콘텐츠 여백, 스크롤 소유권을 정한다.
- 반응형 영향: 모바일 하단 네비게이션 때문에 App에 `pb-16`, desktop에서는 제거; `md`부터 좌측 sidebar와 큰 content padding.
- 변경 방식: 레이아웃 변경
- 우선순위: P0
- 주의점: `z-50` 하단 nav와 modal `z-50`의 충돌, nested overflow, safe-area inset을 확인해야 한다. 기능 로직 변경 없이 CSS/구조 조정 가능.

### 페이지 헤더
- 상태: 변경
- 태그: [PILOT] [MEMBERS] [LAYOUT] [SHARED] [CARD]
- 위치: `src/components/MembersPage.tsx:39-47`, `src/components/PageHeader.tsx:20-38`
- 현재 구현 근거: MembersPage `space-y-6`; PageHeader `bg-white p-4 md:p-6 rounded-2xl shadow-sm border`; title `text-xl md:text-2xl`; subtitle `font-mono uppercase`.
- 시각적 역할: “동아리원 관리” 제목, 부제, 총원 통계, 작업 버튼을 페이지 최상단에 배치한다.
- 반응형 영향: header content는 모바일 세로, desktop 가로; action wrapper가 `w-full`에서 `md:w-auto`로 바뀐다.
- 변경 방식: 스타일만
- 우선순위: P0
- 주의점: 페이지 헤더의 평면화·밀도·stats/action 위치는 디자인 방향 미결정 항목이며, 레퍼런스 조사 후 결정해야 한다.

### 액션 영역
- 상태: 변경
- 태그: [PILOT] [MEMBERS] [BUTTON] [ICON]
- 위치: `src/components/MembersPage.tsx:49-71`
- 현재 구현 근거: 버튼 wrapper `flex flex-wrap gap-2 md:gap-3 ... justify-end`; 일괄 추가 `bg-white text-navy ... border ... shadow-sm`; 멤버 추가 `bg-navy hover:bg-gold ... shadow-lg`; label은 `hidden sm:inline`/`sm:hidden`.
- 시각적 역할: CSV 일괄 추가와 개별 추가의 보조/주요 우선순위를 보여준다.
- 반응형 영향: 작은 화면에서 “일괄 추가→업로드”, “멤버 추가→추가”로 축약되고 버튼은 wrap 가능.
- 변경 방식: 스타일만
- 우선순위: P0
- 주의점: label 축약은 기능 변경이 아니지만 아이콘만 남는 breakpoint에서 의미 전달과 터치 크기를 확인해야 한다.

### 필터 탭
- 상태: 변경
- 태그: [PILOT] [MEMBERS] [FILTER] [BUTTON]
- 위치: `src/components/MemberFilters.tsx:34-55`
- 현재 구현 근거: 탭 wrapper `flex border-b border-slate-200`; 각 탭 `px-6 py-3 text-sm font-bold border-b-2 transition-colors`; active `border-navy text-navy`, inactive `border-transparent text-slate-400`.
- 시각적 역할: 활동/휴면 목록을 탭과 하단 border로 구분한다.
- 반응형 영향: 명시적 breakpoint 없음. `px-6`가 좁은 viewport에서 필터 폭을 소비한다.
- 변경 방식: 스타일만
- 우선순위: P0
- 주의점: 현재 tab은 상태 전환 기능과 연결되므로 시각 변경은 active/inactive 조건을 보존해야 한다.

### 검색·필터 패널
- 상태: 변경
- 태그: [PILOT] [MEMBERS] [FILTER] [INPUT] [CARD]
- 위치: `src/components/MemberFilters.tsx:57-91`
- 현재 구현 근거: `glass-panel p-4 flex flex-wrap gap-4 items-center`; search `relative flex-1 min-w-[200px]`, icon `absolute left-3 top-1/2`, input `bg-slate-50 rounded-lg pl-10 pr-4 py-2`; select `bg-white border border-slate-100 rounded-lg px-3 py-2 text-xs`.
- 시각적 역할: 이름 검색과 가입학기·성별·정렬 필터의 입력 영역.
- 반응형 영향: `flex-wrap`과 `min-w-[200px]`로 좁은 화면에서 select들이 다음 줄로 이동한다. 명시적 sm/md는 없다.
- 변경 방식: 스타일만
- 우선순위: P0
- 주의점: `glass-panel`의 md padding과 search min-width가 모바일 가로 overflow의 원인이 될 수 있다. select 순서와 검색 focus ring은 보존.

### 목록 표면과 선택 바
- 상태: 변경
- 태그: [PILOT] [MEMBERS] [TABLE] [CARD] [OVERFLOW] [MOTION]
- 위치: `src/components/MemberList.tsx:62-86`
- 현재 구현 근거: outer `glass-panel overflow-hidden border ... p-0`; inner `overflow-x-auto min-w-full`; selection bar `bg-navy p-4 ... animate-in slide-in-from-top-2`; bulk input `w-36`.
- 시각적 역할: 목록 전체 표면, 다중 선택 시 나타나는 일괄 작업 bar, 가로 overflow 컨테이너를 제공한다.
- 반응형 영향: 컨테이너가 가로 스크롤을 허용하고 내부가 `md:min-w-[600px]`; 선택 bar는 작은 폭에서 input과 button이 압축될 수 있다.
- 변경 방식: 레이아웃 변경
- 우선순위: P0
- 주의점: overflow를 제거하면 좁은 화면에서 row가 잘릴 수 있다. 데스크톱 행과 모바일 카드의 관계 및 가로 스크롤 유지 여부는 현재 구조상 변경 후보이며 디자인 방향 미결정이다. 선택 기능은 기능 변경 대상이 아님.

### 목록-데스크톱
- 상태: 변경
- 태그: [PILOT] [MEMBERS] [TABLE] [DESKTOP] [LAYOUT]
- 위치: `src/components/MemberList.tsx:88-184`
- 현재 구현 근거: header `hidden md:flex bg-slate-50`; columns `w-12`, `flex-1`, `w-32`, `w-40`; row `hidden md:flex items-center hover:bg-slate-50/80`; avatar `w-8 h-8 rounded-full bg-indigo-50`; actions use `p-1.5` icon buttons.
- 시각적 역할: 번호, 기본정보, 성별/학기, 작업을 한 행에 정렬하는 desktop table-like layout.
- 반응형 영향: `md:flex`에서만 존재하며, columns는 고정 폭과 flex 혼합이다.
- 변경 방식: 레이아웃 변경
- 우선순위: P0
- 주의점: 실제 `<table>`이 아니라 flex row이므로 열 폭과 long name truncation을 교체 시 보존해야 한다. `hover`는 keyboard focus 대체가 아니다.

### 목록-모바일
- 상태: 변경
- 태그: [PILOT] [MEMBERS] [TABLE] [MOBILE] [LAYOUT]
- 위치: `src/components/MemberList.tsx:186-264`
- 현재 구현 근거: `md:hidden flex flex-col ... p-4`; 상단 checkbox/번호/성별/학기; 본문 avatar·name; 하단 `pt-3 border-t` action row.
- 시각적 역할: 같은 멤버 데이터를 카드형 세로 구조로 재배치한다.
- 반응형 영향: desktop row/header와 별도 branch이며 `md:hidden`으로 전환; action bar는 카드 하단으로 내려간다.
- 변경 방식: 레이아웃 변경
- 우선순위: P0
- 주의점: desktop/mobile JSX가 중복되어 한쪽만 수정하면 정보·action parity가 깨진다. `p-1.5` 아이콘 버튼의 터치 영역을 검증.

### 빈 상태
- 상태: 유지
- 태그: [PILOT] [MEMBERS] [TABLE] [ICON]
- 위치: `src/components/MemberList.tsx:281-285`
- 현재 구현 근거: `p-20 text-center text-slate-300`, `Search size={40} className="mx-auto mb-4 opacity-10"`, `text-sm font-bold`.
- 시각적 역할: 필터 결과가 없을 때 목록 영역의 시각적 종료점을 제공한다.
- 반응형 영향: 고정 `p-20`이라 모바일에서 빈 공간이 크게 보일 수 있다.
- 변경 방식: 스타일만
- 우선순위: P2
- 주의점: 검색 결과 없음과 데이터 없음의 의미가 같은지 텍스트 조건을 기능 담당과 확인할 필요.

### 멤버 추가 폼
- 상태: 변경
- 태그: [PILOT] [MEMBERS] [FORM] [INPUT] [LAYOUT]
- 위치: `src/components/MemberForm.tsx:27-105`
- 현재 구현 근거: outer `glass-panel p-6 border-transparent bg-slate-50/30`; fields `grid grid-cols-1 md:grid-cols-4 gap-4`; inputs `input-field`; genres `flex flex-wrap gap-2`와 `rounded-full`; footer `flex justify-end gap-3`.
- 시각적 역할: 기본 정보, 휴면/임원 상태, 메모, 선호 장르를 입력하는 인라인 폼.
- 반응형 영향: 모바일 1열, `md`에서 4열; genre pills는 wrap; form footer는 right aligned.
- 변경 방식: 레이아웃 변경
- 우선순위: P1
- 주의점: `md:col-span-4` 필드와 checkbox의 시각적 alignment를 바꾸어도 입력 순서/label association은 유지해야 한다.

### 프로필 모달 shell
- 상태: 변경
- 태그: [PILOT] [MEMBERS] [PROFILE] [MODAL] [FIXED] [OVERFLOW]
- 위치: `src/components/MemberProfileModal.tsx:43-61`
- 현재 구현 근거: `fixed inset-0 z-50 flex justify-end`; backdrop `absolute inset-0 bg-slate-900/40 backdrop-blur-sm`; panel `relative w-full max-w-2xl bg-white h-full shadow-2xl ... p-4 md:p-8 overflow-y-auto`; close `absolute ... z-10`.
- 시각적 역할: 선택한 멤버의 상세를 우측 drawer로 표시한다.
- 반응형 영향: 모바일은 full width, desktop은 `max-w-2xl`; padding은 `p-4`→`md:p-8`; panel 자체 세로 스크롤.
- 변경 방식: 스타일만
- 우선순위: P0
- 주의점: `h-full overflow-y-auto`와 backdrop 클릭, close button stacking, mobile keyboard viewport를 함께 확인.

### 프로필 헤더·요약 카드
- 상태: 변경
- 태그: [PILOT] [MEMBERS] [PROFILE] [CARD] [TYPE]
- 위치: `src/components/MemberProfileModal.tsx:63-106`
- 현재 구현 근거: avatar `w-16 h-16 md:w-20 md:h-20 ... rounded-3xl ... shadow-xl`; name `text-3xl font-black`; summary `grid grid-cols-2 md:grid-cols-4 gap-4`; cards `p-4 bg-slate-50 rounded-xl`; memo `col-span-2 md:col-span-4`.
- 시각적 역할: identity와 성별·가입학기·참석·장르·메모를 요약한다.
- 반응형 영향: 2열→4열, memo는 항상 전체 span; name은 `break-all`로 긴 이름을 강제 줄바꿈한다.
- 변경 방식: 스타일만
- 우선순위: P1
- 주의점: `break-all`은 한글/영문 모두 시각적으로 거칠 수 있고, summary card 수가 늘면 모바일 높이가 증가한다.

### 프로필 활동 타임라인
- 상태: 유지
- 태그: [PILOT] [MEMBERS] [PROFILE] [DENSE-UI]
- 위치: `src/components/MemberProfileModal.tsx:111-183`
- 현재 구현 근거: `border-l-2 ... pl-4`; marker `absolute ... w-3 h-3 ... border-2 border-indigo-500 rounded-full`; session card `p-4 bg-slate-50 ... rounded-xl`; game/teammate pills.
- 시각적 역할: 플레이 게임과 세션 이력을 시간축과 작은 pill로 표현한다.
- 반응형 영향: panel 폭에 따라 `flex-wrap`으로 게임/조원 pill이 여러 줄로 흐른다.
- 변경 방식: 스타일만
- 우선순위: P1
- 주의점: 긴 게임명·조원명, timeline marker의 `-left` 위치, nested pill overflow를 확인.

### 삭제 확인 상태
- 상태: 공용화 후보
- 태그: [PILOT] [MEMBERS] [MODAL] [BUTTON]
- 위치: `src/components/MemberList.tsx:179,258`, `src/components/ConfirmDeleteModal.tsx:17-42`
- 현재 구현 근거: 목록 삭제 action `hover:text-red-500`; modal destructive button `bg-crimson text-white ... shadow-red-200`.
- 시각적 역할: 즉시 삭제 action과 최종 확인 상태를 분리해 위험도를 전달한다.
- 반응형 영향: modal은 `max-w-sm`, 목록 action은 desktop/mobile 모두 아이콘 버튼.
- 변경 방식: 컴포넌트 추출
- 우선순위: P2
- 주의점: 삭제 기능 로직은 범위 밖이며, 시각 변경은 확인 modal 호출/취소 상태를 건드리지 않아야 한다.
