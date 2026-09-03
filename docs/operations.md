# 운영·인수인계

## 환경과 연결 대상

아래 값은 저장소의 `.firebaserc`, `firebase*.json`, Vite 설정 기준입니다. 실제 배포 상태를 조회한 기록은 아닙니다.

| 환경 | 실행/빌드 | Firebase 프로젝트 | Firestore | Hosting |
| --- | --- | --- | --- | --- |
| 운영 | `dev`, `build` | `gen-lang-client-0205444206` | `ai-studio-cb68814f-9f80-4e46-95cd-4725aa93e8cb` | target `avalondgu-site` → site `avalondgu` |
| staging | `dev:staging`, `build:staging` | `avalon-manager-staging` | `(default)` | site `avalon-manager-staging` |
| Emulator Design Lab | `design-lab` | `demo-avalon-manager` | 로컬 127.0.0.1:8080 | 배포 없음 |
| Scenario Lab | `scenario-lab` | 연결 없음 | 연결 없음 | 배포 없음 |

Vite가 `@firebase-config`를 모드별 `firebase-applet-config*.json`에 연결합니다. 운영과 staging은 서로 다른 데이터베이스입니다. 일반 `npm run dev`로 데이터를 변경하면 운영에 쓰게 됩니다.

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

CI는 main push/PR에서 lint, 타입, 단위 테스트, 규칙 테스트, 운영 빌드를 실행합니다. CI가 자동 배포하지는 않습니다. 배포 후에는 변경한 관리 화면과 공개 면접 링크를 확인합니다. Hosting 이전 버전으로 되돌리는 작업은 Firestore 데이터/규칙을 되돌리지 않습니다.

## 데이터 보관과 복구

- 설정의 회원/게임/세션 CSV는 운영자가 읽고 일부 데이터를 다시 가져오기 위한 출력입니다. 문서 ID, 관리자, 계획, 이미지, 모든 면접 문서 등을 복원하는 전체 백업이 아닙니다.
- 면접 회차의 CSV는 지원자별 기록/이력을 포함하지만 자동 전체 복구 도구는 아닙니다. 공개 응답 링크는 bearer token이므로 로그나 공유 문서에 남기지 않습니다.
- 장기 보관이나 소유권 이전 전에 운영자는 실제 Firestore 데이터베이스 전체의 백업 방법, 저장 위치, 접근 권한과 복원 절차를 확인해야 합니다. 이 저장소는 운영 데이터 백업을 포함하지 않습니다.
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

### 이후 릴리스

릴리스는 검토된 커밋을 staging에 배포하고 주요 화면을 확인한 뒤 운영에 반영합니다. 운영 확인 후 package/lockfile의 버전, annotated tag, GitHub Release를 맞춥니다. 배포 이력과 Release가 같은 앱 소스를 가리키는지 확인하세요.

개발 재개는 README와 [개발 가이드](development.md)에서 시작합니다. 새 기능은 현재 main에서 별도 브랜치로 작업하고, 이전 개발 브랜치나 로컬 stash를 릴리스의 일부로 간주하지 않습니다. 데이터 백업과 계정 이관은 위 절차를 따르며, 저장소 공개 범위 변경은 별도로 결정합니다.
