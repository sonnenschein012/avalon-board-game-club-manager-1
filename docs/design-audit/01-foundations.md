# 01. Foundations

### 전역 기본색과 글꼴
- 상태: 변경
- 태그: [FOUNDATION] [COLOR] [TYPE]
- 위치: `src/index.css:1-14`
- 현재 구현 근거: `@import url('https://fonts.googleapis.com/...Inter...')`, `@import "tailwindcss"`, `@theme`의 `--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif`, 그리고 `@layer base` 안의 `@apply bg-white text-navy font-sans antialiased`.
- 시각적 역할: 앱 전체의 흰 배경, navy 기본 글자색, sans 글꼴, antialiasing을 결정한다.
- 반응형 영향: 직접 breakpoint는 없지만 모든 화면의 기본 대비와 폭 계산에 전역 영향.
- 변경 방식: 스타일만
- 우선순위: P1
- 주의점: `text-navy`와 사용자 정의 색상 의존성이 높아 이름만 바꾸면 전 화면 회귀 가능.

### 핵심 색상 팔레트
- 상태: 공용화 후보
- 태그: [FOUNDATION] [COLOR]
- 위치: `src/index.css:4-9,25-30`, `src/components/MemberList.tsx:137-141`, `src/components/MemberForm.tsx:90-96`
- 현재 구현 근거: `src/index.css:6-8`의 `--color-navy: #0D1B2A`, `--color-gold: #C5A059`, `--color-crimson: #8E1616`; 사용처에는 `bg-navy`, `text-navy`, `bg-gold`, `hover:bg-gold`, `bg-crimson`, 그리고 멤버 성별의 `bg-blue-50 text-blue-600`/`bg-red-50 text-red-600`가 있다.
- 시각적 역할: 브랜드 강조, 상태, 성별, 선택 상태를 색으로 구분한다.
- 반응형 영향: 없음. 모바일/데스크톱 모두 같은 상태색을 사용한다.
- 변경 방식: 스타일만
- 우선순위: P0
- 주의점: 색상만으로 성별·활성·삭제를 표현하는 부분은 대비와 비색상 보조 표현을 함께 확인해야 한다.

### 패널·버튼·입력 토큰
- 상태: 변경
- 태그: [FOUNDATION] [SPACING] [RADIUS] [ELEVATION] [BUTTON] [INPUT]
- 위치: `src/index.css:17-43`
- 현재 구현 근거: `.glass-panel` = `bg-white shadow-sm rounded-2xl p-4 md:p-8`; `.nav-item` = `flex items-center gap-3 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300`; `.nav-item-active` = `bg-navy text-white shadow-md`; `.table-header` = `px-6 py-4 ... border-b`; `.input-field` = `w-full bg-slate-50 ... rounded-xl px-4 py-3 ... focus:ring-2`.
- 시각적 역할: 반복되는 카드, 주요 버튼, 목록 헤더, 입력창의 기본 규격을 제공한다.
- 반응형 영향: `.glass-panel`의 `md:p-8`만 데스크톱에서 여백을 키운다.
- 변경 방식: 스타일만
- 우선순위: P0
- 주의점: 파일럿 컴포넌트가 이 추상 클래스와 개별 Tailwind를 섞어 쓰므로 토큰 변경 후 시각적 불일치가 남을 수 있다.

### 반복 하드코딩 값
- 상태: 공용화 후보
- 태그: [FOUNDATION] [COLOR] [TYPE] [SPACING] [RADIUS] [ELEVATION]
- 위치: `src/components/MemberList.tsx:62-285`, `src/components/MemberProfileModal.tsx:51-183`, `src/components/MemberForm.tsx:27-105`
- 현재 구현 근거: `src`의 `.tsx/.css` 전체 텍스트를 기준으로 `rounded-xl` 182회, `rounded-2xl` 60회, `rounded-3xl` 30회, `shadow-sm` 94회, `p-4` 143회, `gap-2` 157회, `text-xs` 238회, `md:` 282회가 출현한다. 파일럿 핵심 파일에서도 `rounded-xl`, `bg-slate-50`, `text-xs`, `p-4`가 반복된다.
- 시각적 역할: 컴포넌트별로 카드 밀도, 라벨 계층, 행 간격, 상태 pill을 구성한다.
- 반응형 영향: `md:p-8`, `md:gap-*`, `md:w-*`와 조합되어 모바일/데스크톱 밀도가 달라진다.
- 변경 방식: 컴포넌트 추출
- 우선순위: P1
- 주의점: 반복 횟수는 정적 클래스 출현 기준이며, 조건부 branch가 같은 스타일을 중복 렌더링하므로 일괄 치환 시 desktop/mobile 양쪽을 확인해야 한다.

### 아이콘·SVG·고정 크기
- 상태: 공용화 후보
- 태그: [FOUNDATION] [ICON]
- 위치: `src/components/AvalonLogo.tsx:10-20`, `src/components/MemberList.tsx:76-284`, `src/components/MemberProfileModal.tsx:58-155`
- 현재 구현 근거: `AvalonLogo`는 `<svg width={width} height={height} viewBox="-10 -20 120 170" ... className={className}>`이며 내부 색은 `gold = "#f5a700"`, `navy = "#092e47"`이다. 멤버 목록의 빈 상태는 `Search size={40}`, 목록 액션은 `Info/Edit2/Trash2 size={16}`을 사용한다.
- 시각적 역할: 브랜드 표시, 검색 빈 상태, 액션 affordance를 크기와 색으로 전달한다.
- 반응형 영향: 아이콘 자체 크기는 대체로 고정이고, Sidebar만 `size-5`/`md:size-[18px]`로 달라진다.
- 변경 방식: 컴포넌트 추출
- 우선순위: P2
- 주의점: 클릭 가능한 아이콘 버튼은 시각 크기와 실제 터치 영역(`p-1.5` 등)이 함께 유지되어야 한다.

### 모션
- 상태: 변경
- 태그: [FOUNDATION] [MOTION]
- 위치: `src/App.tsx:113`, `src/index.css:22`, `src/components/MemberList.tsx:66,108,187`, `src/components/MemberProfileModal.tsx:55,155-156`
- 현재 구현 근거: `animate-pulse`, `transition-all duration-300`, `animate-in slide-in-from-top-2`, `transition-transform`, `transition-colors`.
- 시각적 역할: 부팅/로딩, 행 등장, hover, 모달 닫기 버튼, 타임라인 marker의 상태 전환을 표현한다.
- 반응형 영향: 모션 자체의 breakpoint는 없고 모바일에서도 동일하다.
- 변경 방식: 스타일만
- 우선순위: P2
- 주의점: `prefers-reduced-motion` 대응이 이 범위에서 확인되지 않았으므로 도입 시 전역·개별 transition을 함께 점검해야 한다.

### 전역 애니메이션·화면 전환 경계
- 상태: 유지
- 태그: [FOUNDATION] [MOTION] [LAYOUT]
- 위치: `src/main.tsx:1-8`, `src/App.tsx:136-184`
- 현재 구현 근거: `main.tsx`가 `index.css`를 import하고, App은 `min-h-screen flex flex-col md:flex-row`, `main.flex-1 overflow-auto`, route별 `<div className="h-full">`를 사용한다.
- 시각적 역할: 전역 스타일을 로드하고 화면 전환 시 동일한 셸과 스크롤 컨테이너를 유지한다.
- 반응형 영향: `md:flex-row`, `md:pb-0`, `md:w-auto`, 콘텐츠 padding `p-4 sm:p-6 md:p-12`가 핵심 breakpoint다.
- 변경 방식: 레이아웃 변경
- 우선순위: P0
- 주의점: `main`의 독립 스크롤과 Sidebar의 fixed/sticky 조합은 모달·가로 스크롤과 충돌할 수 있다.
