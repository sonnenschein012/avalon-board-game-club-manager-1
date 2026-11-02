# 게스트 기능 구현 결과 (2026-11-02)

기존 회원 중심 구조를 유지하면서 게스트의 당일 운영 참여와 익명 세션 기록을 추가했습니다. 구현 브랜치는 `codex/guest-attendance`이며 운영·staging 배포는 실행하지 않았습니다.

후속 변경: 회원당 게스트 1명 제한을 해제하고 동일 회원의 여러 게스트를 독립 ID로 지원합니다. 아래 최초 구현의 제한·검증 수치는 당시 기록입니다. 최신 UI와 데이터 계약은 `docs/guests.md`를 따릅니다.

## 기능별 변경

- 공통 모델: `participantType?: 'member' | 'guest'`, `invitedByAttendeeId?: string`, 세션 조의 `guestCount?: number`를 추가했습니다. 필드 부재는 기존 회원/게스트 0명으로 해석하며 기존 `memberId`의 undefined/null 차이를 유지합니다.
- 수동 출석: 참석 중인 등록 회원을 초대자로 선택하고 게스트 이름·음료만 받습니다. 최대 1명 제한과 트랜잭션 내 중복 확인을 적용합니다. 회원 생성·휴면 복원은 하지 않습니다. 초대자 삭제·결석·미등록은 경고하며 관계를 유지합니다.
- 조편성: 게스트를 정원·배정에 포함하고 초대 관계를 기존 동반 요청 평가에 추가했습니다. 기존 탐색 알고리즘·수동 고정·정원 정책은 유지합니다. 독립 드래그·관계 표식·분리 경고를 지원하며 저장을 막지 않습니다. 게스트에게 성별·학번·회원 이력을 만들지 않고 회원 효용의 보호 평균에서도 제외합니다.
- 운영/기록: DailyPlannings에는 게스트 참석자 ID·이름·음료·초대 관계 snapshot을 보존합니다. sessions에는 실제 회원 ID와 조별 익명 수만 보냅니다. 당일 대시보드·공지·음료 주문·게임 인원 추천도 게스트를 포함합니다. 회원 정보에 의존하는 평균은 회원만 사용합니다.
- 수동 세션: 미배정 영역의 게스트 항목을 반복 사용할 수 있습니다. 조마다 여러 카드로 추가·개별 제거·이동하며 저장 후 개수를 복원합니다. 별도 숫자 입력은 없습니다. 정규화·기존 조 단위 병합·게임만 수정하는 저장·감사 요약에서 수를 보존합니다.
- CSV: 기존 세션 열 구성과 회원/임원 표기를 유지하고 정확한 `게스트` 토큰만 반복 내보내기/가져오기 합니다. 모르는 이름을 게스트로 바꾸지 않습니다. 구글 폼의 선택 게스트 세 열과 미리보기·수정을 지원하며 초대자 미확인·필수값 누락·모순·중복이면 반영하지 않습니다. 회원 CSV에 게스트를 추가하지 않습니다.
- 통계: 기존 계산식을 수정하지 않았습니다. 게스트 수 변경에도 랭킹·참석률·신입/고착화·인기 게임·핵심 플레이어·MMI·회원 CSV 결과가 같음을 검증했습니다.

## 검증 결과

- TypeScript, ESLint: 통과.
- 단위/UI/서비스 테스트: 86개 파일, 421개 테스트 통과 (기존 403개에서 18개 추가).
- 조편성/개발환경 보조 스크립트: 58개 통과.
- Firestore Emulator 보안 규칙: 24개 통과.
- Chromium Emulator 화면 검증: 기존/게스트 흐름 12개 통과 후 수동 세션 다중 게스트 저장·재편집 1개 추가 통과. 총 13개 시나리오 확인.
- 운영/staging 빌드 및 각각의 Scenario Lab 혼입 방지 검사: 통과.
- `git diff --check`: 통과.

실제 화면 검증은 합성 데이터와 로컬 Auth/Firestore Emulator만 사용했습니다. CSV에서 초대 관계 생성, 게스트 드래그, 회원 명부 불변, 당일 snapshot, 익명 세션, 음료 표시, 수동 세션 복원까지 확인했습니다. 기존 출석 브라우저 테스트는 이 환경에서 관리 SDK 조회가 느려 비동기 저장 확인 대기 시간을 5초에서 30초로 늘렸으며 검증 내용은 유지했습니다.

## 호환성과 남은 제약

- 기존 모임 재시작은 운영 계획을 갱신하지만 이미 연결된 확정 세션은 덮어쓰지 않는 동작을 유지합니다. 확정 기록의 게스트 수를 바꾸려면 세션 편집을 사용합니다.
- 다중 관리자 편집은 기존 조 단위 병합 정책을 유지합니다. 동일 조를 동시에 바꿀 때 필드별 병합을 새로 도입하지 않았습니다.
- `게스트`는 세션 CSV에서 익명 인원을 나타내는 예약 토큰입니다. 기존 회원의 실제 이름/닉네임이 정확히 이 토큰인 경우 CSV 형식상 구분할 수 없습니다.
- 공유 Graphify 자료는 기존 묶음을 보존했습니다. status는 stale이며 고정 Graphify 런타임 미설치로 query/그래프 갱신은 완료하지 못했습니다. 소스·호출자·공유 저장 소비자와 테스트를 직접 확인했으며 앱 검증을 그래프 최신성 승인으로 취급하지 않습니다.
- staging/운영 배포는 하지 않았습니다. 현재 환경에는 Firebase 배포 인증이 없습니다. 배포 전 staging 인증을 구성하고 환경별로 다시 빌드한 뒤 변경 화면·실제 운영 계정 접근을 확인해야 합니다. Rules/인덱스 변경은 없습니다.

## 변경 파일

- `docs/development.md`
- `docs/guests.md`
- `src/components/AttendanceCsvImportModal.tsx`
- `src/components/AttendancePage.tsx`
- `src/components/CostEvaluationModal.tsx`
- `src/components/GroupsCanvas.tsx`
- `src/components/ManualAddModal.tsx`
- `src/components/MeetingCanvasTab.tsx`
- `src/components/MeetingDashboardTab.tsx`
- `src/components/MeetingVersionsPanel.tsx`
- `src/components/SessionFormModal.test.tsx`
- `src/components/SessionFormModal.tsx`
- `src/components/SessionList.tsx`
- `src/components/UnassignedPool.tsx`
- `src/domain/attendance/attendanceHelpers.ts`
- `src/domain/attendance/csvParser.ts`
- `src/domain/attendance/dailyPlanning.ts`
- `src/domain/attendance/guests.test.ts`
- `src/domain/attendance/guests.ts`
- `src/domain/attendance/sessionGroups.ts`
- `src/domain/exports/clubCsv.ts`
- `src/domain/matching/assignmentDiagnostics.ts`
- `src/domain/matching/companionRequests.ts`
- `src/domain/matching/personalUtility.ts`
- `src/domain/meeting/progressHelpers.ts`
- `src/domain/recommendation/recommendGames.ts`
- `src/domain/sessions/sessionCsv.ts`
- `src/domain/sessions/sessionGroups.ts`
- `src/domain/stats/guestCompatibility.test.ts`
- `src/hooks/useAttendanceLogic.ts`
- `src/hooks/useMeetingProgressLogic.ts`
- `src/services/attendeesService.test.ts`
- `src/services/attendeesService.ts`
- `src/services/sessionsService.test.ts`
- `src/services/sessionsService.ts`
- `src/types.ts`
- `tests/design-lab/attendance-import.spec.ts`
- `tests/design-lab/guests.spec.ts`
- `docs/guest-implementation-report.md` (이 보고서)
