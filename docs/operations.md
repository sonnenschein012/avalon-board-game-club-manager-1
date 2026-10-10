# 운영·인수인계

## 환경과 연결 대상

아래 값은 저장소의 `.firebaserc`, `firebase*.json`, Vite 설정 기준입니다. 실제 배포 상태를 조회한 기록은 아닙니다.

| 환경 | 실행/빌드 | Firebase 프로젝트 | Firestore | Hosting |
| --- | --- | --- | --- | --- |
| 운영 | `dev:prod`, `build` | `gen-lang-client-0205444206` | `ai-studio-cb68814f-9f80-4e46-95cd-4725aa93e8cb` | target `avalondgu-site` → site `avalondgu` |
| staging | `dev:staging`, `build:staging` | `avalon-manager-staging` | `(default)` | site `avalon-manager-staging` |
| Emulator Design Lab | `dev`, `design-lab` | `demo-avalon-manager` | 로컬 127.0.0.1:8080 | 배포 없음 |
| Scenario Lab | `scenario-lab` | 연결 없음 | 연결 없음 | 배포 없음 |

Vite가 `@firebase-config`를 모드별 `firebase-applet-config*.json`에 연결합니다. 운영과 staging은 서로 다른 데이터베이스입니다. `npm run dev`는 로컬 Emulator를 실행하고 합성 데이터를 초기화합니다. `npm run dev:prod`만 운영 Firebase에 연결합니다. Vite를 직접 실행해도 기본 development 모드는 로컬 Emulator에 연결되며 Emulator가 없으면 운영으로 우회하지 않습니다.

Design Lab의 Auth는 127.0.0.1:9099, Emulator UI는 127.0.0.1:4000입니다. 관리자는 로컬 계정으로 자동 로그인하고, 공개 면접 링크는 비로그인 상태로 실행합니다. seed/reset 스크립트는 고정된 로컬 프로젝트와 호스트만 허용합니다.

## 배포

Node.js 22와 저장소에 고정된 Firebase CLI를 사용합니다. Firebase 로그인/프로젝트 권한은 운영자가 별도로 준비합니다.

```bash
npm ci
npm run check
# 앱 코드만 변경한 경우
npm run build:staging
npm run deploy:staging:hosting
# 규칙/인덱스도 변경한 경우에는 위 두 명령 대신
# npm run deploy:staging
```

`deploy:staging`은 staging 빌드 → staging Rules/인덱스 → staging Hosting 순서입니다. 확인 주소는 [staging 앱](https://avalon-manager-staging.web.app)입니다. 기존 `avalon-manager-stg-260813` 사이트는 현재 설정의 대상이 아닙니다.

운영 배포는 검토한 변경 범위에 따라 명시적으로 실행합니다.

```bash
npm run build
npx firebase deploy --project gen-lang-client-0205444206 --config firebase.json --only hosting:avalondgu-site
# 규칙/인덱스를 변경했을 때
npm run test:rules
npx firebase deploy --project gen-lang-client-0205444206 --config firebase.json --only firestore
```

각 빌드는 같은 `dist/`를 사용하므로 배포 직전에 해당 환경으로 다시 빌드하세요. 면접 데이터 계약이나 공개 접근을 바꾸면 앱과 `firestore.rules`를 함께 검토합니다. `firebase.json`의 named database를 기본 데이터베이스로 잘못 바꾸지 마세요.

일반 빌드는 `index.html`만 포함합니다. `demo`/`scenario` 빌드는 Vite에서 거부하며, 빌드 뒤 `verify:production-bundle`은 Scenario Lab 진입점·fixture·가짜 사용자 표식이 운영 번들에 없는지 검사합니다.

CI는 main push/PR에서 lint, 타입, 단위 테스트, 규칙 테스트, 운영 빌드와 Emulator Design Lab의 Playwright 시나리오를 실행합니다. CI가 자동 배포하지는 않습니다. 배포 후에는 변경한 관리 화면과 공개 면접 링크를 확인합니다. Hosting 이전 버전으로 되돌리는 작업은 Firestore 데이터/규칙을 되돌리지 않습니다.

## 데이터 보관과 복구

- 설정의 회원/게임/세션 CSV는 AI와 대화할 때 분석·정리할 자료를 제공하고, 새 사이트 등으로 필요한 업무 정보를 이전하기 위한 출력입니다. 문서 ID, 관리자, 계획, 모든 면접 문서까지 복원하는 전체 백업은 현재 기능의 목적이 아닙니다.
- 이전할 때는 회원과 게임을 먼저 가져온 뒤 세션을 가져옵니다. 세션은 대상 명부의 이름·닉네임과 게임명을 이용해 연결을 다시 구성합니다. 현재 운영에서 회원은 학번을 입력해 등록하며, 게임 이미지를 입력하거나 표시하는 UI는 없습니다.
- 면접은 보통 2주 이내, 길어야 3주 정도 사용하는 업무입니다. 진행 중인 면접 상태의 사이트 간 이전·전체 복구와 과거 면접 상세 기록의 앱 내 재사용은 현재 요구 범위에 포함하지 않습니다. 지원서 원본은 외부에서 관리하며, 선발 기록은 면접 상세 기록과 별개로 취급합니다.
- 면접 회차의 CSV는 분석·정리에 활용할 지원자별 기록/이력을 포함하지만 자동 전체 복구 도구는 아닙니다. 공개 응답 링크는 bearer token이므로 로그나 공유 문서에 남기지 않습니다.
- 원본 데이터 전체의 복원이 별도로 필요해지면 보존 범위, 대상 데이터베이스, 접근 권한과 복원 절차를 정합니다. 원본 export/import는 별도 기능으로 검토하며, 현재 CSV의 완성 조건으로 요구하지 않습니다. 이 저장소는 운영 데이터 백업을 포함하지 않습니다.
- Emulator seed 데이터는 합성 데이터입니다. `demo:reset`은 로컬 데이터를 지우고 다시 구성하며, 운영 데이터 이관 용도로 사용하지 않습니다.

## 접근 권한을 넘길 때

1. Firebase 프로젝트/Hosting, GitHub 저장소, Google 로그인 설정의 관리자를 확인합니다. 접근 권한은 각 서비스에서 부여하며 비밀 값을 저장소에 기록하지 않습니다.
2. 새 운영자의 정규화한 이메일을 `admins` 문서 ID로 등록하고 `role: "master"`를 지정한 뒤 로그인을 확인합니다.
3. 초기 운영자에 대한 bootstrap master 예외가 `src/lib/firebase.ts`의 `checkAdminStatus`와 `firestore.rules`의 `isBootstrapMaster`에 있습니다. 제거/교체는 두 경계를 함께 검토하고 새 master 접근을 확인한 뒤 별도 변경으로 처리합니다.
4. 화면의 관리자 편집 모드 토글은 UI 조작 방지 장치입니다. 실제 접근 권한은 Firebase Authentication과 Firestore 규칙이 결정합니다.

설정 화면의 관리자 추가는 새 이메일에만 일반 운영자 권한을 생성합니다. 이미 등록된 이메일은 중복 안내 후 저장하지 않으므로 마스터/일반 운영자의 기존 권한과 생성 시각을 유지합니다. 서버 트랜잭션에서 기존 문서를 확인하며 동시에 추가해도 덮어쓰지 않습니다. 마스터 권한 지정은 위 인수인계 절차를 따릅니다.

## 릴리스와 개발 재개

### v1.0.0 기준 (2026-09-03)

- 검토된 앱 소스를 staging에 배포한 뒤 [운영 앱](https://avalondgu.web.app)에 배포했습니다. 두 환경 모두 Hosting만 변경했으며 Firestore 규칙·인덱스와 named database 설정은 유지했습니다.
- staging에서 Google 관리자 로그인, 주요 관리 화면, 조 삭제 후 미배정 회원 복구, 조 이름 변경 시 독립된 세션 기록 보존, 비로그인 공개 면접 응답 저장과 관리자 반영을 확인했습니다. 임시 테스트 문서 15개는 모두 제거했습니다.
- 운영에서는 로그인과 주요 관리 화면을 확인했으며 업무 데이터를 수정하지 않았습니다. `v1.0.0` 태그와 GitHub Release를 이 기준의 소스 및 인수인계 시작점으로 사용하세요.
- 버전을 `1.0.0`으로 맞춘 뒤 다시 빌드한 54개 파일은 배포된 운영 빌드와 SHA-256 기준으로 모두 동일했습니다.

### v1.0.1 (2026-09-21)

- 앱 소스 `36797ea`를 staging 확인 후 운영에 배포했다. 두 환경 모두 Hosting과 Firestore 규칙·인덱스를 배포했으며 운영의 named database 대상은 유지했다. 인덱스 정의 자체는 변경하지 않았다.
- 출석 명단의 멤버 추가를 확인 폼으로 바꾸고, 미배정 출석 상태 보존·세션 삭제 시 계획 연결 해제·조회 오류 재시도·회원/게임/세션 필드 검증을 반영했다. 기본 개발 실행은 로컬 Emulator로 변경했다.
- lint, TypeScript, 단위 테스트 280개, 개발 환경 테스트 3개, 그래프 검증 도구 테스트 9개, 보안 규칙 테스트 24개, 운영 빌드·번들 검사를 통과했다. 로컬 통합 테스트는 첫 실행의 초기 로딩 시간 초과 후 Node 22.23.2에서 6개 모두 통과했다. [앱 소스 CI](https://github.com/sonnenschein012/avalon-board-game-club-manager-1/actions/runs/35593010559)도 전체 성공했다.
- staging의 회원 명부·일일 조 편성·세션 기록과 운영의 일일 조 편성·세션 기록을 기존 로그인으로 조회했다. 운영 공개 면접 경로는 비로그인 상태에서 잘못된 링크 안내를 확인했다. 실제 지원자 응답의 저장은 로컬 Emulator에서 검증했으며 staging/운영 업무 데이터는 수정하지 않았다.
- staging과 운영의 배포 파일 각각 60개를 해당 환경의 로컬 빌드와 SHA-256으로 비교해 모두 일치함을 확인했다. 태그의 후속 문서 변경은 배포된 앱 소스를 바꾸지 않는다.
- 공유 `.ua` 그래프는 이번 소스 변경에 대해 stale 상태다. 배포 성공이나 커밋·푸시를 그래프 최신성 승인으로 취급하지 않으며, 후속 분석 전까지 소스·테스트와 변경 내역을 함께 확인한다.

### v1.0.2 (2026-09-22)

- 앱 소스 `2d7241f`를 staging 확인 후 운영에 배포했다. 두 환경 모두 Hosting만 변경했으며 Firestore 규칙·인덱스·데이터는 변경하지 않았다. 배포 빌드와 Firebase CLI는 Node 22.23.2에서 실행했다.
- 모임 진행 기록 관리의 버전 선택을 같은 모달 안의 상세 화면 전환으로 바꾸고, 상단 요약과 하단 복원 버튼을 고정했다. 목록 복귀 시 위치·포커스 복구와 단계별 Esc 이동을 추가했다.
- lint, TypeScript, 단위 테스트 281개, 개발 환경 테스트 3개, 운영·staging 빌드와 번들 검사를 통과했다. 합성 데이터(버전 20개·참석자 30명)로 390×844, 390×600, 1440×900에서 상세 스크롤·복원/확인 버튼 고정·목록 위치 복구를 확인했다.
- staging은 로그인·모임 진행·빈 기록 모달을 확인했다. 운영은 기존 기록의 버전 목록 → 상세 전환과 스크롤 중 요약·버튼 고정을 조회로 확인했으며 실제 복원을 실행하지 않았다.
- staging·운영 각각 배포 파일 60개의 SHA-256이 해당 환경의 로컬 빌드와 모두 일치했다. 공유 지식 그래프는 기존 stale 상태를 유지하며, 배포 완료를 그래프 최신성 승인으로 취급하지 않는다.

### v1.1.0 (2026-10-08)

- 앱 소스 `c6fdc24`를 커밋·푸시하고 staging 확인 후 [운영 앱](https://avalondgu.web.app)에 배포했다. 배포 당시 기능 브랜치와 main은 같은 소스 커밋을 가리켰다. 두 환경 모두 Hosting만 배포했으며 Firestore 규칙·인덱스·데이터는 변경하지 않았다. 빌드와 Firebase CLI는 Node 22.23.2에서 실행했다.
- 자동 편성을 개인 관점의 효용·비용 평가로 변경했다. 정원을 먼저 하나로 결정한 뒤 수동 배치를 유지하면서 동반 요청 → 운영진 → 개인 효용 순으로 후보를 비교한다. 요청/불참/정원 조정 안내, 전체 평균에 따른 환산 보호와 1~2배 개선 중요도, 브라우저 Worker 실행·입력 변경 시 취소를 추가했다. 통계 수식은 이번 릴리스의 변경 범위에 포함하지 않았다.
- 로컬에서 lint·TypeScript, 앱 단위 테스트 301개, 환경·정원·독립 효용 검토 테스트 50개, Emulator Design Lab 화면 회귀 7개, 운영/staging 빌드와 번들 분리 검사를 통과했다. 사용자가 제공한 CSV는 비공개 오프라인 모의 비교에만 사용했으며 저장소나 운영 DB에 가져오지 않았다. 수식 대조·요청 충돌의 소규모 완전 비교·26~80명 규모 점검 결과와 한계는 [개인 효용 모델](group-utility-model.md)에 기록했다.
- staging과 운영에서 기존 로그인으로 일일 조 편성·새 개인 효용 평가 창을 확인하고, 운영 세션 기록을 조회했다. 실제 업무 명단으로 편성 실행·모임 시작·기록 저장을 수행하지 않았다. 운영 공개 면접 경로는 잘못된 링크 안내를 확인했다.
- staging과 운영 각각 배포 파일 61개의 SHA-256이 해당 환경의 로컬 빌드와 모두 일치했다. 새 편성 Worker 파일도 대조에 포함했다. package/lockfile 버전과 릴리스 태그는 `1.1.0`이며 태그는 배포 소스 `c6fdc24`를 가리킨다. 후속 인수인계 문서 커밋은 앱 빌드를 바꾸지 않는다.
- [배포 소스 CI](https://github.com/sonnenschein012/avalon-board-game-club-manager-1/actions/runs/37742564541)도 전체 성공했다. 보안 규칙·그래프 검증 도구·로컬 통합 시나리오를 포함한다. 공유 `.ua` 그래프는 기존 stale 상태를 유지하며, 배포 완료를 그래프 최신성 승인으로 취급하지 않는다. 파라미터는 초기 운영값으로 실제 만족도에 따른 보정은 후속 운영 사례에서 판단한다.

### v1.2.0 (2026-10-09)

- 앱 소스 `47f43eb6500c250bf8483bc7ee57b2d82f6c3ca6`을 커밋·푸시하고 main에 반영한 뒤 staging 확인 후 [운영 앱](https://avalondgu.web.app)에 배포했다. 두 환경은 각각 새로 빌드했으며 Hosting만 배포했다. Firestore 규칙·인덱스·업무 데이터와 운영의 named database 설정은 변경하지 않았다. 빌드와 Firebase CLI는 Node 22.23.2에서 실행했다.
- 동반 요청에서 성을 생략한 이름을 인식하고, 여러 후보는 일일 조 편성 알림을 눌러 모달에서 확인하도록 했다. 확인 결과는 같은 계정·해당 세션의 sessionStorage에 보존하며 자동·수동 편성과 안내가 공유한다. 일일 조 편성의 인라인 안내 스타일도 통일했다. 보호 이후 요청 완화·재회 비용 전액 반영, 첫 동성/이성 효용 0.9/0.25와 강화한 체감, 요청 쌍 교환 탐색을 적용했다. 전체 우선순위·수동 고정·정원 조건은 유지한다.
- 로컬 lint·TypeScript, 앱 단위 테스트 330개, 검토 스크립트 58개와 운영/staging 빌드 및 번들 분리 검사를 통과했다. 실제 Worker 편성과 복수 동반 후보 모달의 자동·수동 평가를 합성 Emulator 시나리오 2개로 확인했다. [배포 소스 CI](https://github.com/sonnenschein012/avalon-board-game-club-manager-1/actions/runs/37918207995)도 보안 규칙·그래프 검증 도구·전체 Emulator 화면 시나리오를 포함해 성공했다. 사용자가 제공한 자료는 비공개 오프라인 모의 비교에만 사용했다.
- staging과 운영에서 기존 로그인으로 일일 조 편성 및 개인 효용 평가 창의 새 보호·완화 설명을 조회했다. 확인 시 명단은 미배정 상태여서 실제 개인별 행·후보 선택·자동 편성은 운영 업무 자료로 실행하지 않았으며, 해당 동작은 위 합성 Emulator에서 검증했다. 운영 공개 면접 경로의 잘못된 링크 안내도 확인했다. 조회 과정에서 업무 데이터를 수정하지 않았다.
- staging과 운영 각각 배포 파일 62개를 해당 환경의 로컬 빌드와 SHA-256으로 대조해 모두 일치했다. 편성 Worker도 포함한다. package/lockfile 버전과 annotated tag 및 [GitHub Release](https://github.com/sonnenschein012/avalon-board-game-club-manager-1/releases/tag/v1.2.0)는 `1.2.0`이며 태그는 배포 소스 `47f43eb`을 가리킨다. 후속 문서 커밋은 앱 빌드를 바꾸지 않는다.
- 초기 운영값의 검증과 한계는 [개인 효용 모델](group-utility-model.md)에 기록했다. 모든 모임의 성별 고립 방지나 전역 최적성을 보장하지 않는다. 공유 `.ua` 그래프는 기존 stale 상태를 유지하며, 배포 완료나 CI의 그래프 도구 테스트 성공을 그래프 최신성 승인으로 취급하지 않는다.

### v1.2.1 (2026-10-10)

- 앱 소스 `fd980f1dbb1568bb84120ff5b823129bbde84148`을 main과 `codex/attendance-design-proposals`에 커밋·푸시하고 staging 대조 후 [운영 앱](https://avalondgu.web.app)에 배포했다. 각 환경을 새로 빌드했으며 Hosting만 배포했다. Firestore 규칙·인덱스·업무 데이터와 named database 설정은 변경하지 않았다. 빌드·배포는 Node 22.23.2에서 실행했다.
- 선택한 B 평가 모달과 버튼 ②를 실제 일일 조 편성에 적용했다. 실행 버튼은 청회색, 자동 모드 종료는 투명 보조 버튼이며 평가 버튼은 `편성 평가`로 표시한다. 조·조원 선택, 전체 배치 기준 개인 평가, 접을 수 있는 지표 설명·계산 예시, 모바일 조원 선택과 Esc/닫기·포커스 복귀를 제공한다. 출석 명단·조 카드 디자인과 자동 편성 수식·파라미터·저장 계약은 유지한다. Scenario Lab 두 비교 경로는 실제 모달과 선택된 버튼 스타일을 재사용한다.
- 로컬 lint·TypeScript, 앱 단위 테스트 334개, 검토 스크립트 58개, 운영·staging 빌드와 번들 분리 검사를 통과했다. [배포 소스 CI](https://github.com/sonnenschein012/avalon-board-game-club-manager-1/actions/runs/37947502024)는 보안 규칙·그래프 검증 도구와 합성 Emulator 화면 시나리오 8개를 포함해 전체 성공했다. 새 모달 회귀 검증은 전체 편성 기준 점수·요청 충족·부분 명단·자료 부재·조/조원 선택과 모바일·Esc·포커스 복귀를 포함한다.
- staging과 운영의 배포 파일 각각 62개를 해당 환경의 로컬 빌드와 SHA-256으로 대조해 모두 일치했다. 로그인된 운영 화면을 직접 열어 조작하는 점검은 수행하지 않았으며 실제 화면 동작은 위 CI 합성 데이터로 검증했다. package/lockfile, annotated tag 및 [GitHub Release](https://github.com/sonnenschein012/avalon-board-game-club-manager-1/releases/tag/v1.2.1)는 `1.2.1`이고 태그는 배포 소스 `fd980f1`을 가리킨다. 후속 운영 기록 커밋은 앱 빌드를 바꾸지 않는다.
- 다음 세션은 main의 README·개발 가이드에서 시작한다. B 모달·버튼 ②는 더 이상 미확정 시안이 아니라 적용된 선택이다. 공유 `.ua` 그래프는 기존 stale 상태를 유지하며 배포·CI 성공을 그래프 최신성 승인으로 취급하지 않는다.

### 이후 릴리스 절차

릴리스는 검토된 커밋을 staging에 배포하고 주요 화면을 확인한 뒤 운영에 반영합니다. 운영 확인 후 package/lockfile의 버전, annotated tag, GitHub Release를 맞춥니다. 배포 이력과 Release가 같은 앱 소스를 가리키는지 확인하세요.

개발 재개는 README와 [개발 가이드](development.md)에서 시작합니다. 새 기능은 현재 main에서 별도 브랜치로 작업하고, 이전 개발 브랜치나 로컬 stash를 릴리스의 일부로 간주하지 않습니다. 데이터 백업과 계정 이관은 위 절차를 따르며, 저장소 공개 범위 변경은 별도로 결정합니다.
