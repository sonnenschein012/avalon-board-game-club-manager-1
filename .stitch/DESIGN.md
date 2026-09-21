---
name: Avalon Club Manager — Current Implementation Snapshot
colors:
  background: '#FFFFFF'
  surface: '#FFFFFF'
  primary: '#0D1B2A'
  on-primary: '#FFFFFF'
  accent: '#C5A059'
  destructive: '#8E1616'
  logo-navy: '#092E47'
  logo-gold: '#F5A700'
  availability-highlight: '#FFD166'
  canvas-background: '#000000'
  chart-attendance: '#10B981'
  chart-adjusted: '#6366F1'
  chart-new-members: '#3B82F6'
  chart-existing-members: '#CBD5E1'
  chart-identity: '#F43F5E'
---

# Design System: Avalon Club Manager 현재 구현 추출

추출일: 2026-09-14. 이 문서는 **현재 구현의 관찰 기록이며, 승인된 디자인 규칙이나 개선안이 아니다.**

## 추출 범위와 해석

- React 19 / Vite / Tailwind CSS 4 기반 소스에서 실제 JSX의 클래스, 조건부 클래스, 인라인 스타일과 연결된 CSS를 읽었다.
- `src/main.tsx` → `src/App.tsx`의 관리자·공개 페이지 경로를 시작점으로 대표 UI와 업무 전용 컴포넌트를 조사했다. 테스트·Scenario fixture를 앱 디자인의 근거로 사용하지 않았다.
- 기존 디자인 문서, 주석의 의도, 과거 대화의 디자인 판단을 근거로 삼지 않았다. 공통 CSS는 JSX가 사용하는 스타일의 값을 해석할 때 확인했다.
- 브라우저 렌더링·computed style·접근성 대비 측정은 하지 않았다. 모든 화면·상태를 전수 검증한 결과는 아니다.
- px 환산은 기본 루트 글자 16px 기준이다. Tailwind 값은 설치된 `node_modules/tailwindcss/theme.css`에서 확인했다.
- YAML 색상 이름은 이번 추출용 식별자다. 코드에 동일 이름의 토큰이 존재한다는 뜻이 아니다. 비슷한 색을 합치지 않았다. Tailwind의 OKLCH 색은 임의의 hex로 바꾸지 않고 본문에 클래스 이름으로 보존한다.
- 현재 작업 트리의 미커밋 변경을 포함한다. 배포된 운영 사이트와 동일하다는 보장은 없다.

## 1. Visual Theme & Atmosphere

관리자 화면은 흰 바탕과 흰 패널, 어두운 네이비·Slate 제목, 연한 회색 보조 텍스트로 구성된다. 많은 버튼과 제목에 굵은 글씨를 사용한다. 패널 바깥 여백은 비교적 크지만 목록 안의 이름·보조 정보·필터 라벨은 9~14px로 조밀하게 배치되는 사례가 있다.

공개 면접 페이지는 연회색 바탕에 중앙 정렬된 흰 카드와 더 둥근 모서리를 사용한다. 모임 캔버스에는 검은 배경도 존재한다. 따라서 사이트 전체를 단일한 흰 카드 화면으로 일반화할 수 없다. 이는 소스 구조에 대한 묘사이며, 분위기 선호도나 디자인 의도에 관한 판단은 아니다.

## 2. Color Palette & Roles

### Primary Foundation

| 현재 값 | 확인한 사용처 | 근거 |
| --- | --- | --- |
| White `#FFFFFF` | 관리자 바탕, 헤더, 패널, 모달 | App, PageHeader, SettingsPage, ConfirmDeleteModal |
| Slate 50 | 게임 검색 배경, 회원 입력 배경, 공개 면접 바탕 | GameFilters, MemberForm → input-field, PublicInterviewPage |
| Slate 50 / 30~60% | 편성 캔버스 바탕, 비활성 시간 칸 | GroupsCanvas, AvailabilityGrid |
| Black `#000000` | 고정 폭 모임 캔버스 | MeetingCanvasTab |

### Accent & Interactive

| 현재 값 | 실제 역할 |
| --- | --- |
| Navy `#0D1B2A` | 주요 버튼 배경, 선택한 면접 탭, 데스크톱 활성 메뉴, 일부 텍스트 |
| Gold `#C5A059` | 주요 버튼 호버, 일정 배정 버튼 기본 배경, 필터 선택 테두리, 입력 포커스, 드래그 강조 |
| Logo navy `#092E47`, logo gold `#F5A700` | AvalonLogo 내부 SVG. 앱의 Navy/Gold와 별도 값 |
| Yellow `#FFD166` | AvailabilityGrid의 조건부 강조 상태. 일반 Gold와 구분 |
| Orange 500 → 600 | GroupsCanvas의 ‘조편성 시작’ 버튼 기본·호버 |

### Typography & Text Hierarchy

- 제목: Slate 800, Slate 900, Navy가 함께 사용된다.
- 설명·이름·본문: Slate 500~700 사례가 있다.
- 라벨·부가 정보: Slate 400, 드래그 빈 안내에는 Slate 300도 사용된다.
- 어두운 배경 버튼에는 White. 일정 배정의 Gold 배경에는 Navy.
- 서로 다른 회색을 하나로 합치거나 주·보조 텍스트의 승인된 색상으로 재정의하지 않았다.

### Functional States and Charts

- 삭제 확인: Crimson `#8E1616`, 호버 Red 700. 경고 아이콘은 Red 100 바탕 / Red 600 글자.
- 선발 결정: 합격 선택은 Emerald 600 / 호버 700, 불합격 선택은 Red 600 / 호버 700. 미선택은 흰 바탕과 Slate 테두리. `selectionDecisionStyles.ts`의 반환 클래스를 사용한다.
- 편성 경고: Orange 50 배경, Orange 600 텍스트, Orange 100 반투명 테두리.
- 차트는 독립적인 실제 hex를 쓴다: 출석 `#10B981`, 보정지수 `#6366F1`, 신입 `#3B82F6`, 기존 `#CBD5E1`, 정체성지수 `#F43F5E`.
- 차트 축 색 `#94A3B8` / `#64748B`, 격자 `#E2E8F0`, 툴팁 제목 `#1E293B`는 CSS의 Slate 색 이름과 별도로 보존한다.
- 모임 카드 기본 팔레트는 `#E11D48`, `#2563EB`, `#16A34A`, `#D97706`, `#9333EA`, `#C026D3`, `#0284C7`, `#0D9488`이다. `useMeetingProgressLogic`에서 전달되고 `MeetingCanvasTab`에서 조 순서에 따라 사용되며, 카드별 bgColor가 있으면 그 값이 우선한다. 고정 팔레트만으로 모든 카드의 실행 시 색을 단정할 수 없다.

## 3. Typography Rules — 관찰값

기본 글꼴 스택은 Inter, ui-sans-serif, system-ui, sans-serif이며 앱 진입점에서 로드하는 CSS가 body에 적용한다. 페이지 영어 부제는 `font-mono`다. 한글의 실제 선택 글꼴은 런타임 미확인이다. Google Fonts 요청은 Inter 300~700을 포함하지만 JSX에는 800·900 지정도 있어 실제 두꺼운 글꼴 표현은 브라우저 확인이 필요하다.

### Hierarchy & Weights

| 요소 | 크기 | 굵기·자간 / 행간 | 근거 |
| --- | --- | --- | --- |
| 일반 관리자 페이지 제목 | 20px → md 24px | 800, tight / 기본 28→32px | PageHeader |
| 설정 페이지 제목 | 24px 고정 | 800, tight / 32px | SettingsPage |
| 공개 면접 제목 | 20px → sm 30px | 900, tight / 28→36px | PublicInterviewPage |
| 설정 섹션 제목 | 18px | 700 / 28px | SettingsPage |
| 삭제 모달 제목 | 18px | 900 / 28px | ConfirmDeleteModal |
| 회원·면접 상단 버튼 | 12px | 회원 700, 면접 일부 900 / 16px | MembersPage, InterviewRoundPage |
| 삭제 확인 버튼 | 14px | 700 / 20px | ConfirmDeleteModal |
| 회원 입력 내용 | 14px | 상속 / 20px | MemberForm → input-field |
| 회원 폼 라벨 | 10px | 700, uppercase 지정 | MemberForm |
| 관리자 부제 | 10px → md 12px | mono, uppercase | PageHeader |
| 설정 부제 | 12px 고정 | mono, uppercase | SettingsPage |
| 모바일 메뉴 라벨 | 9px | 선택 900 / 일반 500 | Sidebar |
| 편성 카드 이름·보조 정보 | 11px / 9px | 주로 700 | GroupsCanvas |

### Spacing Principles — 실제 지정

페이지 제목에 tight 자간, 부제·작은 라벨에 uppercase, 일부 라벨에는 넓은 자간을 사용한다. 공개 면접 영문 표식은 0.25em 자간이다. 공개 면접 설명에는 14px 글자와 24px 행간이 지정되어 있다. 모든 설명문이 이 행간을 쓰는 것은 아니다.

## 4. Component Stylings

### Buttons

| 사례 | 현재 조합 |
| --- | --- |
| 회원 추가 | Navy → Gold 호버, 흰 글자, 12px 글자/700, 모서리 12px, shadow-lg. 패딩 좌우 12→md 20px, 상하 8→md 10px |
| 회원 폼 저장 | Navy → Gold 호버, 흰 글자, 12px/700, 모서리 8px, shadow-lg, 패딩 좌우 24px·상하 8px |
| 면접 CSV 업로드 | Navy → Gold 호버, 흰 글자, 12px/900, 모서리 12px, 그림자 클래스 없음, 패딩 좌우 12px·상하 10px |
| 회원 일괄 추가 | 흰 배경, Slate 200 테두리, Navy 글자, 모서리 12px, shadow-sm |
| 삭제 확인 | Crimson → Red 700 호버, 14px/700, 모서리 12px, 작은 붉은 그림자 |
| 조편성 시작 | Orange 500 → 600 호버, 모서리 8px, 큰 그림자, animate-pulse |

처리 중 버튼에는 disabled와 opacity-50, Loader2 회전 아이콘을 함께 사용하는 사례가 있다. 모든 버튼의 비활성·포커스·처리 중 표현이 같다고 보지는 않는다.

### Cards & Containers

- PageHeader: 흰색, 16px 모서리, 작은 그림자, Slate 50 테두리, 패딩 16→md 24px.
- 설정 헤더: 흰색, 16px 모서리, 작은 그림자, 패딩 24px 고정, 테두리 클래스 없음.
- 공개 면접 헤더: 흰색, 24px 모서리, Slate 100 테두리, 작은 그림자, 패딩 20→sm 32px.
- 삭제 모달: 16px 모서리, shadow-xl, max-w-sm, 내부 24px. 오버레이는 Navy 20%와 배경 블러.
- 카드 스타일 모달: 24px 모서리, shadow-2xl, max-w-sm. 삭제 모달과 동일한 외형이 아니다.

### Navigation

데스크톱은 sticky 좌측 메뉴이며 펼침 256px / 접힘 80px이다. 활성 메뉴는 Navy 바탕, 흰 글자, 중간 그림자다. 모바일은 높이 64px의 하단 고정 가로 스크롤 메뉴이며 활성 항목은 Navy 텍스트다. 모바일의 활성 항목에 데스크톱의 채움색을 그대로 적용하지 않는다.

면접 내부 탭은 흰색 16px 모서리 컨테이너 안의 12px 모서리 버튼이며 가로 스크롤한다. 선택 버튼은 Navy 바탕과 흰 글자다.

### Inputs & Forms

| 사례 | 바탕·테두리 | 모서리·패딩 | 포커스 지정 |
| --- | --- | --- | --- |
| 회원 폼 input-field | Slate 50, 테두리 없음 | 12px, 좌우 16px·상하 12px | Gold 30%의 2px 링 |
| 게임 검색 | Slate 50, 테두리 없음 | 8px, 좌 40px·우 16px·상하 8px | Gold 20%의 2px 링 |
| 면접 검색 | 별도 불투명 바탕 지정 없음, Slate 100 테두리 | 12px, 좌 36px·우 12px·상하 8px | 해당 JSX에 별도 링 지정 없음 |
| 게임 필터 select | White, Slate 100 테두리 | 8px, 좌우 12px·상하 8px | outline-none |

기본 브라우저 포커스의 실제 표시와 외부 CSS 우선순위는 렌더링 검증 대상이다. 여기서는 JSX와 연결된 CSS가 지정한 내용을 기록한다.

### Domain-Specific Components

- 조 편성: 흰색 16px 외곽 패널 안에 연회색 작업 바탕, 12px 조 카드, 작은 참석자 칩을 배치한다. 조 목록은 기본 1열, lg에서 2열이다.
- 드래그: 원본 opacity-30, 이동 미리보기 shadow-xl + Gold 60% 링, 드롭 영역 Gold 안쪽 링 + Amber 반투명 바탕.
- 면접 시간 격자: 16px 외곽 모서리, 연한 테두리, sticky 행·열 제목, 가로·세로 스크롤. compact 최소 행 높이 32px, 일반 44px. 날짜 열 최소 폭 compact 46px / 일반 68px.
- 통계: Recharts SVG를 사용하며 기본·확장 모드의 축 글자와 툴팁 스타일이 다르다. 별도 차트 팔레트를 보존한다.
- 모임 캔버스: 검은 바탕의 폭 1600px 영역과 2rem 모서리가 존재한다. 이 영역을 일반 반응형 목록 패널과 동일하게 취급하지 않는다.
- 모임 캔버스 제목은 32px/900의 흰 글씨, 넓은 자간과 텍스트 그림자를 사용한다. 일반 보기에서는 계산된 배율로 축소되고 전체 화면에서는 반응형 scale과 스크롤이 적용된다. 장식 SVG의 파란색 계열도 일반 UI·차트 팔레트와 별도다.

## 5. Layout Principles — 관찰값

### Grid & Structure

관리자 main은 flex-1로 남은 폭을 채우며 전체 콘텐츠에 단일 max-width를 두지 않는다. 공개 면접 콘텐츠는 max-w-5xl(64rem, 기본 1024px)로 중앙 정렬한다. 모달 폭은 유형별로 달라진다.

### Whitespace Strategy

- 관리자 바깥 패딩: 16px → sm 24px → md 48px.
- 회원·설정 페이지 주요 섹션 간격: 24px.
- 공개 면접 바깥: 좌우 12→sm 24px, 상하 24→sm 40px; 콘텐츠 섹션 간격 20px.
- 4px 계열 외에도 6·10px 등의 반 단위와 임의값이 사용된다. 엄격한 8px 규칙으로 추출하지 않는다.

### Alignment & Visual Balance

관리자 제목과 내용은 주로 왼쪽 정렬이다. 헤더 작업 버튼은 큰 화면에서 오른쪽에 배치하고 좁은 화면에서는 줄바꿈한다. 삭제 모달은 가운데 배치하며, 빈 상태나 접근 안내는 중앙 정렬 사례가 있다.

### Responsive Behavior & Touch

확인한 Tailwind 경계값: sm 640, md 768, lg 1024, xl 1280, 2xl 1536px(기본 루트 기준). 개별 컴포넌트가 이 경계를 모두 사용하는 것은 아니다.

일반 페이지 헤더는 md부터 가로 배치하고 제목·패딩이 커진다. 설정 헤더는 동일한 반응형 크기 변경이 없다. 작은 화면에서 버튼 문구를 짧게 바꾸는 사례가 있다. 모든 조작 요소에 공통 최소 터치 높이가 적용되어 있지는 않다.

## 6. Design System Notes for Stitch Generation

### Language to Use

재현용 설명: “한국어 동아리 운영 관리 화면. 흰 관리자 바탕, 어두운 네이비 제목과 버튼, 작은 회색 보조 정보, 둥근 카드와 약한 그림자. 목록 내부는 조밀하고 페이지 바깥은 넓은 여백. 골드는 작업·선택 강조에 사용된다.”

이는 현재 모습을 전달하는 설명이며 새 디자인 방향으로 승인된 문구가 아니다.

### Color References

YAML의 hex는 직접 지정된 값을 유지한다. 로고·UI·시간 격자의 서로 다른 Gold를 합치지 않는다. Slate 등 Tailwind 팔레트는 정확한 재현이 필요하면 설치 버전의 OKLCH 및 투명도를 함께 전달한다.

### Component Prompts

1. “현재 회원 관리 화면을 재현한다. 제목과 우측 작업, 검색·필터, 회원 목록의 순서를 유지한다. 회원 추가 버튼은 12px 모서리의 네이비 채움과 큰 그림자다. 실제 회원 개인정보 대신 합성 데이터를 쓴다.”
2. “현재 공개 면접 화면을 재현한다. 연회색 바탕, 중앙 최대 1024px, 24px 모서리 흰 헤더와 시간 선택 격자를 사용한다. 관리자 사이드바는 넣지 않는다.”
3. “현재 조 편성 패널을 재현한다. 연회색 작업 영역 안에 흰 조 카드와 작은 참석자 칩을 배치하고 드래그 위치를 골드 링으로 표시한다.”

### Incremental Iteration

이 추출본으로 생성한 시안을 기존 화면과 비교한 다음, 변경할 기준을 별도 합의한다. 기존 변형을 자동 통일하지 않는다. Stitch 업로드·API 연동은 이번 추출에서 실행하지 않았다.

## 7. 확인된 차이와 미확인 사항

| 비교 대상 | 그대로 보존한 차이 |
| --- | --- |
| 로고 vs UI | Navy·Gold의 hex가 각각 다름 |
| 회원 vs 설정 헤더 | 모바일 제목 20/24px, 패딩 16/24px, 테두리 유무 |
| 게임 vs 면접 검색 | 8/12px 모서리, 회색 채움/연한 테두리, 포커스 지정 |
| 회원 추가 vs 회원 저장 | 모서리 12/8px |
| 회원 추가 vs 면접 업로드 | 굵기 700/900, 큰 그림자/그림자 지정 없음 |
| 관리자 vs 공개 면접 | 흰색/연회색 바탕, 유동 폭/제한 폭, 헤더 모서리 16/24px |

미확인: 브라우저의 실제 한글 글꼴, 모든 상태의 대비와 가독성, CSS 충돌의 최종 승자, 라이브러리 기본 UI의 세부 스타일, 실제 모바일 터치 사용성. 특히 GroupsCanvas의 모임 시작 버튼처럼 `shadow-lg shadow-sm`가 함께 있는 경우 최종 그림자를 클래스 나열 순서로 단정하지 않는다.

## 8. Source Map

경로는 저장소 루트 기준이며 각 파일의 JSX 또는 실행 시 사용되는 스타일을 근거로 삼았다.

- 앱 연결·바깥 틀: `src/main.tsx`, `src/App.tsx`
- 공통 클래스의 실제 값 해석: `src/index.css`, `node_modules/tailwindcss/theme.css`
- 헤더·탐색·로고: `src/components/PageHeader.tsx`, `Sidebar.tsx`, `AvalonLogo.tsx`
- 회원 버튼·입력: `src/components/MembersPage.tsx`, `MemberForm.tsx`
- 검색 비교: `src/components/GameFilters.tsx`, `InterviewRoundPage.tsx`
- 설정: `src/components/SettingsPage.tsx`
- 모달: `src/components/ConfirmDeleteModal.tsx`, `MeetingCardStyleModal.tsx`
- 면접 공개 화면·시간표: `src/components/PublicInterviewPage.tsx`, `AvailabilityGrid.tsx`
- 선발 상태: `src/components/selectionDecisionStyles.ts`
- 조 편성·모임: `src/components/GroupsCanvas.tsx`, `AttendanceDragAndDrop.tsx`, `MeetingCanvasTab.tsx`
- 모임 카드 동적 색상: `src/hooks/useMeetingProgressLogic.ts`
- 통계: `src/components/ArchiveCharts.tsx`, `ArchiveWidgetRanking.tsx`

추출 형식 참고: https://github.com/google-labs-code/stitch-skills/blob/main/plugins/stitch-design/skills/extract-design-md/SKILL.md

사용자 요청에 따라 해당 절차의 의도 추정·유사 색상 통합은 수행하지 않고 실제 구현의 차이를 보존했다.
