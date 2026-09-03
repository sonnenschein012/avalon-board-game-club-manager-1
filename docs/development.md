# 개발 가이드

## 구조와 책임

React/Vite 단일 페이지 앱입니다. `src/main.tsx`가 앱을 시작하고 `src/App.tsx`가 인증, 관리자 화면 틀, lazy route를 구성합니다. `/interview/:token`은 공개 지원자 페이지이며 나머지 화면은 관리자 인증을 거칩니다.

| 위치 | 책임 |
| --- | --- |
| `src/components/` | 페이지, 패널, 폼, 모달. 기능 이름으로 검색할 수 있습니다. |
| `src/hooks/` | 화면 상태, 사용자 작업, 구독 수명과 알림 |
| `src/domain/` | Firebase와 UI에 의존하지 않는 계산, 정책, CSV 변환 |
| `src/services/` | Firestore 읽기/쓰기, 트랜잭션, 외부 I/O |
| `src/types.ts` | 저장 문서와 주요 도메인 타입 |
| `src/lib/` | Firebase 초기화, 배치 쓰기, CSV 다운로드, 표시 유틸리티 |
| `src/scenario-lab/` | Firebase 없이 실제 UI 컴포넌트를 렌더링하는 fixture 앱 |
| `scripts/`, `tests/` | Emulator 실행/seed/reset, 번들 검사, Playwright 시나리오 |

일반적인 변경은 페이지 → 해당 hook → domain/service 순서로 따라가면 됩니다. 기존의 간단한 CRUD는 hook에 남아 있으며, 여러 문서를 다루거나 여러 화면에서 쓰는 데이터 작업은 service가 소유합니다. 모든 기능에 새 계층을 만들 필요는 없습니다.

## 기능별 시작점

| 기능 | 화면과 상태 | 핵심 규칙/데이터 작업 |
| --- | --- | --- |
| 회원 | `MembersPage`, `useMembersLogic`, `MemberProfileModal` | `domain/members/`: 폼, CSV, 이름·학번·연락처 규칙 |
| 게임 | `GamesPage`, `useGamesLogic` | `domain/games/`: 장르 목록, 폼, CSV |
| 출석·조 편성 | `AttendancePage`, `useAttendanceLogic` | `domain/attendance/`, `domain/matching/`, `attendeesService` |
| 모임 진행·추천 | `MeetingProgressPage`, `useMeetingProgressLogic` | `domain/meeting/`, `domain/recommendation/` |
| 세션 기록 | `SessionsPage`, `useSessionsLogic` | `domain/sessions/`: CSV·그룹 병합·미배정 목록, `sessionsService` |
| 통계 | `ArchivePage`, `useArchiveLogic`, `ArchiveCharts` | `domain/stats/`, `domain/semester/` |
| 면접 운영 | `InterviewRoundPage`, `useInterviewRoundLogic` | `hooks/interviews/`, `domain/interviews/`, `services/interviews/` |
| 공개 면접 응답 | `PublicInterviewPage`, `usePublicInterviewLogic` | `publicInterviewService`, `publicTimeWindow` |
| 설정·내보내기 | `SettingsPage`, `useSettingsAdmins`, `useClubExports` | `settingsService`, `domain/exports/clubCsv` |

면접의 구독과 문서 결합은 `useInterviewRoundData`, 수동/자동 배정과 낙관적 갱신은 `useInterviewAssignmentLogic`에 있습니다. 상위 `useInterviewRoundLogic`은 회차·일정·지원자·면접관 작업을 연결합니다. `useInterviewNoteLogic`은 노트 자동 저장과 revision 충돌을 별도로 관리합니다. `interviewPolicy`가 활동 상태, 진행 상태와 현재 확정 안내의 유효성을 판정합니다.

면접 서비스는 회차(`roundsService`), 일정(`schedulesService`), 실제 배정(`schedulingService`), 지원자, 면접관, 기록, 회원 등록으로 나뉩니다. `interviewsService.ts`는 이 공개 API를 모아 내보내는 진입점입니다. 배정 변경은 잠금·접근 문서·이력도 함께 바꾸므로 기존 트랜잭션 경로를 재사용하세요.

## 데이터에서 유지해야 할 구분

- `SessionGroup`은 조 편성 중의 **attendee ID**, `StoredSessionGroup`은 저장된 **member ID**를 담습니다. 변환은 `domain/attendance/sessionGroups`에서 합니다. `DailyPlannings`의 저장 타입은 `domain/attendance/dailyPlanning`에 있습니다.
- 모임 계획(`DailyPlannings`)과 확정 기록(`sessions`)은 별도 문서입니다. 현장 화면과 기록 화면이 함께 사용하므로 이름 변경이 게임 기록 같은 다른 필드를 덮어쓰지 않아야 합니다.
- `Session.boardMemberIds`가 없으면 과거 형식의 데이터이며 현재 회원 정보로 보완합니다. `[]`는 당시 임원이 없었다는 명시적 기록입니다. CSV 변환과 통계에서 이 차이를 유지합니다.
- 오래된 세션에는 game ID 대신 게임명이 들어 있을 수 있습니다. 현재 조회와 내보내기의 fallback은 유지합니다.
- 면접 지원자의 `scheduleId`는 `undefined`(기존 회차 기반 데이터), `null`(미배정), 실제 ID(일정 배정)를 구분합니다. 실제로 사용되는 이관 경로와 공개 응답 fallback을 일괄 삭제하지 마세요.
- 통계 학기 경계는 3월/9월, 면접 후 회원 등록 기본 학기는 2월/8월 기준입니다. 게임 목록과 통계의 난이도 구간도 다릅니다. 이름이 비슷하다는 이유만으로 합치지 않습니다.
- 조 편성 점수와 진단 화면은 `groupCostFunction`과 `groupCostContext`를 공유합니다. 가중치/판정 변경은 이 도메인부터 시작합니다.

## 개발 환경과 검증

환경별 연결 대상과 배포 명령은 [운영·인수인계](operations.md)를 참조하세요.

- 빠른 화면 확인: `npm run scenario-lab` → `http://127.0.0.1:5174/design.html`. fixture 상태는 `fixtures.ts`, 화면 구성은 `ScenarioPages.tsx`, 선택기는 `ScenarioLabApp.tsx`에 있습니다. 상태를 추가하면 `tests/scenario-lab/scenario.spec.ts`도 확인합니다.
- 실제 hook/service/규칙 확인: `npm run design-lab`. Java 21을 `JAVA_HOME`에 설정하거나 Windows에서 `npm run demo:setup`을 한 번 실행합니다. 시작할 때 데이터가 초기화되며, 실행 중에는 `npm run demo:reset`으로 다시 seed할 수 있습니다.
- 기본 확인: `npm run check`는 lint, 타입, 단위 테스트, 운영 빌드를 실행합니다. Vitest는 `src/**/*.test.{ts,tsx}`를 대상으로 하며 `test:unit`은 Emulator 규칙 테스트를 제외합니다.
- Firestore 규칙/권한 변경: `npm run test:rules`. UI 연결 변경: `npm run design-lab:test`. fixture UI/반응형 변경: `npm run scenario-lab:test`. Playwright를 처음 쓸 때 `npx playwright install chromium`이 필요할 수 있습니다.
- `scripts/emulator-runtime.mjs`가 Design Lab과 규칙 테스트의 Java 탐색 및 Firebase CLI 실행을 함께 담당합니다. `seed-demo.mjs`의 프로젝트/호스트 검사는 로컬 데이터 초기화를 보호하므로 유지합니다.

도메인 테스트는 구현 옆에 둡니다. CSV나 데이터 변환을 바꾸면 정상 입력뿐 아니라 기존 저장 형식과 빈 값의 의미를 확인하세요. JSX 이동만을 확인하는 테스트는 추가하지 않습니다.

## 나중에 다시 시작할 때

1. `npm ci` 후 변경할 기능의 위 시작점을 읽습니다.
2. 현재 동작은 Scenario Lab 또는 Design Lab에서 확인합니다.
3. Graphify가 설치되어 있고 로컬 `graphify-out/graph.json`이 있다면 `graphify query "질문"`, `graphify explain "함수명"`, `graphify path "A" "B"`로 연결을 좁힌 후 소스를 확인합니다. 코드 수정 후에는 `graphify update .`를 실행합니다.
4. 변경한 경계에 맞는 검증을 선택하고, 구조나 운영 방법이 달라졌을 때 이 가이드를 갱신합니다.

Graphify 산출물과 `agent_docs/`는 로컬 보조 자료이며 Git에서 제외됩니다. 새 clone에서 필요한 개발·운영 정보는 이 `docs/`와 README를 기준으로 합니다.
