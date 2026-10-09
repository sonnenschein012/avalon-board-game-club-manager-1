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
- 자동 조 편성은 `domain/matching/groupSizing.mjs`로 정원을 먼저 결정하고 `personalUtility.ts`로 요청 → 운영진 → 개인 효용을 비교합니다. `autoAssignAlgorithm.ts` 탐색과 개인 점수 화면은 같은 평가기를 사용합니다. 이전 `groupCostFunction`/`groupCostContext`는 과거 모델의 비교용 코드이며 현재 편성·점수 화면에서 사용하지 않습니다.

일일 조 편성의 `편성 평가`는 `CostEvaluationModal`에서 조·조원을 선택하는 B 레이아웃으로 표시합니다. `attendanceButtonStyles`의 청회색 실행·투명 종료 버튼(②)을 실제 화면과 Scenario Lab이 공유합니다. 개인별 지표는 조별 값을 따로 보호하지 않고 `combineScores`로 전체 배치의 보호·완화 값을 계산합니다. 모달은 native dialog로 포커스를 제한하고 Esc/닫기 후 이전 버튼으로 돌려주며, 미배정·미등록·결석 인원과 조회 불가 상태를 안내합니다. 출석 카드·조 카드·배치 및 저장 계약은 이 디자인 변경의 대상이 아닙니다.

개인 관점의 자동 편성은 [조 인원 구성 모델](group-sizing-model.md)과 [개인 효용 모델](group-utility-model.md)을 따릅니다. 요청 완화·과거 이력 감쇠·환산 보호를 조정하고, 독립 수식 대조·오프라인 모의 편성·전체 화면 회귀 검증을 수행했습니다. 현재 파라미터는 초기 운영값이며 실제 만족도로 추정한 값은 아닙니다. 배포 여부와 검증된 소스는 [운영 이력](operations.md)을 확인하세요.

- `lib/runAutoAssignment`가 브라우저 Worker를 실행합니다. 명단·이력·날짜·조 설정 변경 또는 화면 종료 시 취소하며, 취소된 결과는 적용하지 않습니다. 출석 명단·회원 명부·세션 이력의 조회가 모두 완료되고 오류가 없을 때만 편성/내보내기를 실행합니다.
- 수동 배치는 고정합니다. 해당 조의 수동 인원수를 정원의 하한으로 반영한 뒤, 미배정 등록 참석자만 이동합니다. 결석자는 자동 대상에서 제외하며, 중복 회원이나 조 안의 미등록·결석 인원은 오류로 안내합니다.
- 한 명 교환에 더해, 함께 배치된 동반 요청 쌍을 다른 조의 이동 가능한 두 사람과 한 번에 교환합니다. 양쪽 요청 당사자 모두 미배정에서 편성된 경우만 이동하며, 수동 고정·정원·요청 → 운영진 → 전체 개인 효용 비교를 유지합니다. 시작 배치마다 쌍 교환 평가를 최대 2,000회로 제한하며 전역 최적성을 보장하지 않습니다.
- 동반 요청은 `companionRequests`의 공통 상대 해석을 사용합니다. 전체 이름과 세 글자 한글 이름의 성을 뺀 이름을 부분 문자열로 찾으며, 앞뒤 띄어쓰기나 조사·호칭 허용 목록은 사용하지 않습니다. 전체 이름이 나온 부분은 짧은 이름으로 다시 해석하지 않습니다. 다른 단어에 들어 있는 동일 글자도 후보로 잡힐 수 있습니다. 그날 참석 후보가 여러 명이면 해당 요청을 보류합니다. 알림을 누르면 기존 디자인의 별도 모달에서 운영진이 한 사람을 확정하거나 미확정으로 되돌립니다. 선택은 계정별 브라우저 편성 임시 저장에 보관하며 원문·후보 변경 시 다시 확인합니다. 확인된 불참 상대는 점수에서 제외하고 안내합니다. 미충족 요청은 관련 조에 표시하며 수동 조정 후 현재 배치로 다시 계산합니다. 인원 규칙 완화 안내는 마지막 자동 편성의 입력·결과가 유지되는 동안 화면 상단에 표시합니다.
- 성별 기타/미상과 학번 누락은 해당 개인과 다른 사람의 해당 항목 계산에서 제외합니다. 과거 이력은 편성 날짜보다 앞선 확정 세션만 사용하며 재회 비용의 감쇠는 개인별 실제 참석 순서입니다. 기존 재회 경고는 날짜 제한 후 전체 최근 3회 기준을 유지하는 별도 안내입니다.
- 시뮬레이션 JSON은 `personal-utility-v3-protect-then-attenuate-provisional` 형식입니다. 요청 곱은 문자열로 직렬화하고 운영진 공백·효용·사용 파라미터·채택 배치 기록을 분리합니다. 환산 보호는 완화 전 순효용과 완화 비중을 반영한 전체 평균 및 고정 척도를 사용합니다. 보호 후 기여분에 완화를 적용하고, 빠진 재회 비용은 별도 차감합니다. 보호 계수 1~2와 완화 이후 실제 개선 중요도를 구분합니다. 교환 후보 평가와 점수 창에서 조별 보호 점수를 합산하지 않고 전체 보호를 다시 계산합니다. 이전 v2와 점수식이 달라 같은 요청 배치의 점수를 직접 비교하지 않으며 무작위 표본으로 해석하지 않습니다. 저장 컬렉션/Rules/ID 변환 계약은 변경하지 않습니다.

## 개발 환경과 검증

환경별 연결 대상과 배포 명령은 [운영·인수인계](operations.md)를 참조하세요.

UI 개선 시 [목표 디자인 기준](design-guidelines.md)을 참고하세요. 현재 구현의 추출 기록과 후속 시안용 제안값을 구분하며, 이 기준안 자체는 앱 적용이나 시각 검증 완료를 의미하지 않습니다.

- 빠른 화면 확인: `npm run scenario-lab` → `http://127.0.0.1:5174/design.html`. fixture 상태는 `fixtures.ts`, 화면 구성은 `ScenarioPages.tsx`, 선택기는 `ScenarioLabApp.tsx`에 있습니다. 상태를 추가하면 `tests/scenario-lab/scenario.spec.ts`도 확인합니다.
- 실제 hook/service/규칙 확인: `npm run design-lab`. Java 21을 `JAVA_HOME`에 설정하거나 Windows에서 `npm run demo:setup`을 한 번 실행합니다. 시작할 때 데이터가 초기화되며, 실행 중에는 `npm run demo:reset`으로 다시 seed할 수 있습니다.
- 기본 확인: `npm run check`는 lint, 타입, 단위 테스트, 운영 빌드를 실행합니다. Vitest는 `src/**/*.test.{ts,tsx}`를 대상으로 하며 `test:unit`은 Emulator 규칙 테스트를 제외합니다.
- Firestore 규칙/권한 변경: `npm run test:rules`. UI 연결 변경: `npm run design-lab:test`. fixture UI/반응형 변경: `npm run scenario-lab:test`. Playwright를 처음 쓸 때 `npx playwright install chromium`이 필요할 수 있습니다.
- `scripts/emulator-runtime.mjs`가 Design Lab과 규칙 테스트의 Java 탐색 및 Firebase CLI 실행을 함께 담당합니다. `seed-demo.mjs`의 프로젝트/호스트 검사는 로컬 데이터 초기화를 보호하므로 유지합니다.

도메인 테스트는 구현 옆에 둡니다. CSV나 데이터 변환을 바꾸면 정상 입력뿐 아니라 기존 저장 형식과 빈 값의 의미를 확인하세요. JSX 이동만을 확인하는 테스트는 추가하지 않습니다.

## 나중에 다시 시작할 때

1. `npm ci` 후 변경할 기능의 위 시작점을 읽습니다.
2. 현재 동작은 Scenario Lab 또는 Design Lab에서 확인합니다.
3. [코드 지식 그래프 운영](knowledge-graph.md)에 따라 `node scripts/knowledge-graph.mjs status`로 최신성을 확인하고 Understand-Anything의 조회·설명으로 연결을 좁힌 후 소스를 확인합니다. 일반 미커밋 작업은 오래된 그래프와 실제 diff를 함께 검토하며, 깨끗한 커밋에서는 공식 증분 갱신을 사용합니다. 주요 업무·권한 변경은 전체 분석과 업무 흐름 갱신 대상으로 검토합니다.
4. 변경한 경계에 맞는 검증을 선택하고, 구조나 운영 방법이 달라졌을 때 이 가이드를 갱신합니다.

Understand-Anything의 검증된 `.ua/` 묶음은 Git에 공유하며 설치 경로와 임시 산출물은 제외합니다. `agent_docs/`는 Git 제외된 선택적 과거 기록입니다. 새 clone에서 필요한 개발·운영 정보는 이 `docs/`와 README를 기준으로 합니다.

## 출석 등록·세션 삭제와 조회 오류

- 출석 카드의 멤버 추가는 확인 폼을 열며 저장 전에는 쓰지 않습니다. 성별은 직접 선택하고 학번 미입력 시 임의 값을 만들지 않습니다. 등록 서비스는 현재 명부와 중복을 확인하고, 회원 생성과 정정한 출석 이름·학번을 같은 배치에 저장합니다. 가입 학기는 일반 회원 등록과 같은 3월/9월 기준이며 면접 등록의 2월/8월 기준은 유지합니다.
- 모임 시작은 실제 조에 들어간 참석자만 편성됨으로 변경합니다. 미배정자의 대기·결석 상태는 유지합니다.
- 세션 삭제는 해당 sessionId를 참조하는 DailyPlannings의 연결 필드만 함께 제거합니다. 모임의 조·음료·요청·이전 버전은 유지하며, 버전 복원은 현재 연결만 사용하므로 삭제된 연결을 되살리지 않습니다. 연결 조회 실패나 배치 실패는 삭제 성공으로 처리하지 않습니다.
- 모임 진행 기록 관리에서 이전 버전 선택은 같은 모달의 상세 화면으로 전환합니다. 버전 요약과 복원/확인 버튼은 스크롤 밖에 두고 조·참석자 상세만 스크롤합니다. 버전 목록으로 돌아가면 목록 위치와 선택 항목의 포커스를 복구하며, Esc는 복원 확인 취소 → 버전 목록 → 기록 목록 순서로 돌아갑니다.
- useFirestore는 error와 retry를 제공하고 조회 실패 시 지속되는 알림과 다시 시도 버튼을 표시합니다. 재구독할 때 로딩과 데이터를 초기화합니다.
- members/games/sessions Rules는 새 문서의 핵심 필드·타입·enum을 검사합니다. 기존 문서는 변경한 필드만 검사하므로 누락된 과거 필드를 한꺼번에 채우지 않아도 휴면 전환 등의 작업이 가능합니다. 중첩 배열 항목 전체의 도메인 검증이나 모든 legacy 문서의 자동 이관을 의미하지 않습니다.
- 기본 개발 명령은 npm run dev(Emulator Design Lab)이며 운영 연결은 npm run dev:prod로 명시합니다. 이번 변경은 세션 동시 편집 병합, export, 보관 정책 및 개인정보 로그 보존 정책을 바꾸지 않습니다.
