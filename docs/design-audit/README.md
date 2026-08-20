# 시각 코드 인벤토리

## 목차

- [조사 범위와 제외 범위](#조사-범위와-제외-범위)
- [분류 태그 사전](#분류-태그-사전)
- [파일럿 우선 변경 요약](#파일럿-우선-변경-요약)
- [판단 기준](#판단-기준)
- [문서](#문서)
- [파일럿 실행 백로그](#파일럿-실행-백로그)
- [누락 점검 결과](#누락-점검-결과)

## 조사 범위와 제외 범위

`src` 아래의 모든 `.tsx`, `.ts`, `.css` 127개를 파일 단위로 확인했다. Tailwind `className`, 인라인 `style`, CSS, SVG, 아이콘 크기·색, 모션, breakpoint, 조건부 표시, z-index, overflow/scroll, fixed/sticky, 화면 전환을 시각 코드로 집계했다. 파일럿은 동아리원 관리 화면과 그 직접 연결 컴포넌트이며, 공용 셸과 공용 모달은 함께 기록했다.

제외한 것은 Firebase·서비스·도메인 규칙·상태 계산 자체다. 다만 JSX의 표시 조건이나 레이아웃을 결정하는 표현은 포함했다. 테스트 파일의 `fixed` 같은 일반 문자열은 시각 코드로 세지 않았다.

## 분류 태그 사전

`[FOUNDATION]` 전역 토큰/기초 스타일 · `[COLOR]` 색 · `[TYPE]` 글꼴/문자 크기 · `[SPACING]` 간격 · `[RADIUS]` radius · `[ELEVATION]` border/shadow · `[MOTION]` 전환/애니메이션 · `[SHARED]` 반복 UI · `[BUTTON]` 버튼 · `[INPUT]` 입력 · `[CARD]` 카드/패널 · `[MODAL]` 모달 · `[NAV]` 내비게이션 · `[ICON]` 아이콘/SVG · `[PILOT]` 파일럿 · `[MEMBERS]` 동아리원 · `[LAYOUT]` 레이아웃 · `[TABLE]` 목록/테이블 · `[FILTER]` 필터 · `[FORM]` 폼 · `[PROFILE]` 프로필 · `[RESPONSIVE]` 반응형 · `[MOBILE]` 모바일 · `[TABLET]` 태블릿 · `[DESKTOP]` 데스크톱 · `[SCROLL]` 스크롤 · `[OVERFLOW]` overflow · `[FIXED]` fixed/sticky · `[OUT-OF-PILOT]` 파일럿 외 · `[DENSE-UI]` 밀도 높은 UI · `[CHART]` 차트 · `[CANVAS]` 캔버스 · `[PUBLIC-PAGE]` 공개 페이지.

## 파일럿 우선 변경 요약

현재 파일럿은 `md`에서 데스크톱 행 목록, `md:hidden`에서 모바일 카드 목록을 별도 렌더링한다. 우선 확인할 것은 (1) 앱 셸의 여백·하단 고정 네비게이션, (2) 페이지 헤더와 액션 버튼의 시각 계층, (3) 필터 패널과 탭의 밀도, (4) 목록의 데스크톱/모바일 정보 구조, (5) 우측 프로필 drawer의 모달 경계와 스크롤이다. 이 문서는 변경안을 구현하지 않고 판단 재료만 제공한다.

## 판단 기준

- **유지**: 현재 구조가 파일럿 요구와 직접 충돌하지 않고, 공용 스타일 토큰으로 재사용할 수 있는 것.
- **변경**: 파일럿의 정보 계층·밀도·반응형 동작에 직접 영향을 주며 CSS/레이아웃 교체로 조정 가능한 것.
- **공용화 후보**: 다른 화면에도 같은 구조·상태·시각 패턴이 반복되어 추출 효과가 있는 것.
- **파일럿 제외**: 파일럿 화면에 직접 렌더링되지 않고, 공통 토큰 변경 때 영향만 추적하면 되는 것.

## 문서

- [01-foundations.md](./01-foundations.md)
- [02-shared-components.md](./02-shared-components.md)
- [03-members-pilot.md](./03-members-pilot.md)
- [04-responsive-mobile.md](./04-responsive-mobile.md)
- [05-out-of-pilot.md](./05-out-of-pilot.md)
- [coverage.md](./coverage.md)

## 파일럿 실행 백로그

| 순서 | 대상 | 예상 변경 파일 | 변경 방식 |
|---|---|---|---|
| P0 | 앱 셸·하단 네비게이션과 콘텐츠 여백 | `src/App.tsx`, `src/components/Sidebar.tsx`, `src/index.css` | 레이아웃 변경 + 스타일만 |
| P0 | 멤버 목록의 데스크톱/모바일 정보 계층 | `src/components/MemberList.tsx` | 레이아웃 변경 |
| P0 | 프로필 drawer의 폭·헤더·스크롤 | `src/components/MemberProfileModal.tsx` | 스타일만 + 레이아웃 변경 |
| P0 | 필터/탭/검색 입력의 밀도와 계층 | `src/components/MemberFilters.tsx` | 스타일만 |
| P1 | 헤더·액션 버튼의 공통 계층 | `src/components/PageHeader.tsx`, `src/components/MembersPage.tsx` | 공용 컴포넌트 추출 가능 |
| P1 | 추가 폼 필드 그리드와 선택 pill | `src/components/MemberForm.tsx` | 레이아웃 변경 |
| P1 | 색·radius·shadow·input 토큰 | `src/index.css` | 스타일만 |
| P2 | 삭제 확인 모달과 공용 아이콘 규격 | `src/components/ConfirmDeleteModal.tsx`, `src/components/AvalonLogo.tsx` | 공용화 후보 |

## 누락 점검 결과

| 항목 | 수 |
|---|---:|
| 전수 조사 파일 | 127 |
| 시각 관련 파일 | 58 |
| 문서화 완료 | 58 |
| 제외 파일 | 69 |
| 미판정 파일 | 0 |

수치는 `coverage.md`의 행 수와 문서 링크를 기준으로 작성했다.

## 수정 후 검증 결과

- 실제로 재검증한 파일 수: `src` 대상 127개를 다시 열어 경로·확장자·coverage 표와 대조했으며, 핵심 파일 12개는 줄 단위로 재확인했다.
- 수정한 잘못된 근거:
  - Tailwind v4 실제 구조와 다르게 기록된 구버전 전역 지시문을 `@import "tailwindcss"`, `@theme` 근거로 교체.
  - 존재하지 않는 설정 파일·버튼 토큰 언급을 실제 `@theme`, `.nav-item`, `.nav-item-active` 근거로 교체.
  - `AvalonLogo`의 잘못된 SVG viewBox를 `viewBox="-10 -20 120 170"`으로 수정하고 실제 색상 `#f5a700`, `#092e47` 반영.
  - 확정적으로 표현된 특정 레퍼런스 방향을 제거하고 `디자인 방향 미결정`·`레퍼런스 조사 후 결정`으로 수정. 협업 도구 레퍼런스나 적용 후보는 기록하지 않았다.
- 남아 있는 디자인 미결정 항목: 페이지 헤더의 평면화·밀도, 데스크톱 행과 모바일 카드의 관계, 목록 가로 스크롤 유지 여부, 공통 토큰의 최종 색·간격·radius, canvas와 dense UI에 공통 토큰을 적용할 범위.
- 코드 수정 여부: 없음.
