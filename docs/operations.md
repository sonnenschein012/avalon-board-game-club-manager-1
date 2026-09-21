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

### 이후 릴리스

릴리스는 검토된 커밋을 staging에 배포하고 주요 화면을 확인한 뒤 운영에 반영합니다. 운영 확인 후 package/lockfile의 버전, annotated tag, GitHub Release를 맞춥니다. 배포 이력과 Release가 같은 앱 소스를 가리키는지 확인하세요.

개발 재개는 README와 [개발 가이드](development.md)에서 시작합니다. 새 기능은 현재 main에서 별도 브랜치로 작업하고, 이전 개발 브랜치나 로컬 stash를 릴리스의 일부로 간주하지 않습니다. 데이터 백업과 계정 이관은 위 절차를 따르며, 저장소 공개 범위 변경은 별도로 결정합니다.
