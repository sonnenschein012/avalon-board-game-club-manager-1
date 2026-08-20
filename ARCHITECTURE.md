# Architecture

마지막 코드 대조일: 2026-08-20

이 문서는 Avalon Club Manager의 현재 코드 구조와 변경 규칙을 설명합니다. 설계 선택의 배경은 [ARCHITECTURE_RATIONALE.md](./ARCHITECTURE_RATIONALE.md)를 참고하세요.

## 1. 계층 구조

```text
React 화면 (`src/components/`)
  ↓
오케스트레이션 훅 (`src/hooks/`)
  ├─→ 순수 규칙 (`src/domain/`)
  └─→ 외부 I/O (`src/services/`)
```

- `components`: 화면 표시와 사용자 입력을 담당합니다. 외부 저장 작업은 훅을 통해 요청합니다.
- `hooks`: React 상태, 실시간 구독, 도메인 계산과 서비스 호출을 하나의 사용 흐름으로 연결합니다.
- `domain`: Firebase나 React에 의존하지 않는 계산·검증·변환 규칙을 둡니다.
- `services`: Firestore, 브라우저 저장소, 파일 캡처 같은 외부 I/O를 담당합니다.
- `lib`: Firebase 초기화나 여러 기능이 공유하는 기술 유틸리티를 둡니다.

## 2. 의존성 규칙

1. `domain`의 운영 코드는 `services`, `hooks`, `components`, Firebase를 가져오지 않습니다.
2. `components`는 서비스 값을 직접 호출하지 않습니다. 서비스 입력 타입만 가져오는 것은 허용합니다.
3. 재사용 가능한 업무 규칙은 컴포넌트나 훅에 숨기지 않고 `domain`으로 옮깁니다.
4. 서비스에는 재사용 알고리즘을 두지 않습니다. 단, 원자적 저장을 위해 최신 Firestore 문서를 읽고 다시 확인해야 하는 불변조건 검사는 트랜잭션 서비스가 담당합니다.
5. Repository·Controller 같은 추가 계층은 실제 반복 문제와 분명한 검증 이점이 있을 때만 도입합니다.

이 경계는 `eslint.config.js`의 `no-restricted-imports` 규칙으로 검사합니다. 도메인 테스트는 호환 Timestamp fixture를 만들기 위한 Firebase 값 import만 예외로 허용합니다.

## 3. 면접 V3 데이터 원칙

- Firestore가 회차·지원자·배정·평가·선발 데이터의 기준입니다.
- 지원 상태, 일정 상태, 면접 상태, 종합평가, 선발 상태는 독립적으로 저장합니다.
- `assignmentRevision`과 확정 안내의 revision이 같을 때만 현재 안내가 유효합니다.
- 자동배정은 빈자리를 먼저 사용하고, 필요할 때만 확정 안내 전 배정을 재조합합니다.
- 자동배정 초안을 반영할 때 지원자 상태, revision, 최신 가능시간, 변경 요청, 면접 진행 상태와 충돌 잠금을 트랜잭션에서 다시 확인합니다.
- 일정 초기화와 지원 철회는 현재 활성 배정을 해제하지만 지원서·평가·면접 기록과 이력 이벤트를 삭제하지 않습니다.
- 면접 완료는 최종 종합평가, 노트, 완료 상태와 기록 이벤트를 하나의 트랜잭션으로 저장합니다.
- 선발은 면접관 평가와 별개의 가역적 결정입니다.
- 공개 지원자 페이지는 token 문서만 조회하며 관리자용 지원자·면접 기록에는 접근하지 않습니다.

주요 컬렉션:

- `interviewRounds`, `interviewPublicRounds`
- `interviewApplicants`, `interviewApplicantKeys`, `interviewAccess`
- `interviewerProfiles`, `interviewRoundInterviewers`
- `interviewAssignmentLocks`, `interviewAssignmentEvents`
- `interviewNotes`, `interviewRecordEvents`, `interviewChangeRequests`

## 4. 날짜와 시간

- 면접 슬롯 ID는 `YYYY-MM-DD|HH:mm` 형식의 한국 로컬 값입니다.
- 슬롯 ID를 바로 `new Date()`에 넣지 않고 `src/domain/interviews/scheduling.ts`로 파싱합니다.
- Firestore에는 절대 시각 Timestamp와 로컬 슬롯 ID를 함께 보존합니다.
- 일일 모임 날짜는 UTC 변환이 아니라 기기 로컬 달력 날짜를 사용합니다.

## 5. 테스트 위치

- 순수 함수 테스트는 대상 파일 옆에 `*.test.ts`로 둡니다.
- 서비스 테스트는 해당 서비스 옆에 둡니다.
- Firestore Rules 테스트는 `src/tests/firestore.rules.test.ts`에 둡니다.
- 실제 버그를 고칠 때는 성공 경로뿐 아니라 실패·경계·재시도 상황을 재현하는 회귀 테스트를 추가합니다.

## 6. 검증 명령

- `npm run lint`: TypeScript·React·계층 경계·Firestore Rules 린트
- `npm run typecheck`: TypeScript 타입 검사
- `npm run test:unit`: Emulator가 필요 없는 단위·서비스 테스트
- `npm run test:rules`: Firestore Emulator 보안 규칙 테스트
- `npm run build`: 프로덕션 번들 생성

GitHub Actions는 `main` push와 pull request에서 위 검증을 모두 실행합니다. Rules 테스트를 위해 Node.js 22와 Java 21을 사용합니다.

`react-hooks/set-state-in-effect`는 실시간 외부 구독을 React 상태로 동기화하는 훅이 많아 비활성화합니다. 의존성 검사는 유지하며 `eslint-disable` 우회는 문서화된 예외 없이 사용하지 않습니다.
