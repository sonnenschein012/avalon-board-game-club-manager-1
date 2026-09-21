# 새 컴퓨터에서 시작하기

완료된 대화, agent_docs/, 개인 Codex 워크플로, node_modules/, dist/와 로컬 캐시는 가져오지 않아도 됩니다. 저장소의 AGENTS.md, README와 docs/를 새 작업 세션의 기준으로 사용합니다. 소스·테스트·Firestore 규칙이 최종 근거입니다.

## 최초 설치

Git과 Node.js 22를 설치합니다. UA 재분석은 검증된 Node 22.23.2를 사용합니다. 아래는 PowerShell 예시입니다(macOS/Linux에서는 npm.cmd 대신 npm).

```powershell
git clone https://github.com/sonnenschein012/avalon-board-game-club-manager-1.git
cd avalon-board-game-club-manager-1
npm.cmd ci
node scripts/knowledge-graph.mjs status
npm.cmd run check
```

Firebase 연결 설정은 저장소에 있으며 별도 .env가 필요하지 않습니다. npm ci가 고정된 Firebase CLI를 함께 설치합니다. status의 current는 분석 입력과 검증된 묶음의 해시가 일치한다는 뜻이며 모든 제품 기능 테스트의 성공을 뜻하지 않습니다.

## 지식 그래프 재사용

clone에 .ua/의 검증된 그래프·fingerprints·스캔 목록·검토·설정이 포함됩니다. status와 JSON의 범위 조회에는 UA 설치가 필요 없습니다. 기존 컴퓨터의 installation.json이나 인증 파일을 복사하지 않습니다.

- current: 기존 분석 결과를 재사용합니다. 후속 그래프 커밋으로 HEAD가 달라도 입력 해시가 같으면 유효합니다.
- stale: 소스·문서·설정이나 파일 목록이 다릅니다. 마지막 정상 그래프와 실제 diff를 함께 읽고, 필요 시 공식 갱신을 수행합니다.
- artifact-drift: 공유 산출물이 변경되거나 빠졌습니다. 수정 작업을 보존한 뒤 같은 정상 커밋의 묶음 전체로 복구합니다.
- unverified 또는 invalid: 정상 묶음이 없거나 읽을 수 없습니다. 검증된 Git 버전을 확인하거나 공식 분석을 수행합니다.

전체 스키마 재검증, 그래프 갱신 또는 UA 대시보드/스킬이 필요할 때만 [지식 그래프 운영](knowledge-graph.md)의 설치 절차를 수행합니다. 고정 버전은 .ua/toolchain.json에 있습니다. 도구 저장소를 사용자 홈의 .understand-anything/repo에 설치하고 지정 커밋을 checkout한 뒤 고정 pnpm으로 빌드합니다. 이후 `node scripts/knowledge-graph.mjs verify`를 실행할 수 있습니다. 공유 검증은 로컬 pending-input.json을 요구하지 않습니다.

새 분석은 깨끗한 소스 커밋 → begin → 공식 UA 분석과 의미 검토 → accept → 산출물 커밋·push 순서입니다. 커밋·push만으로 검증 상태를 새로 작성하지 않습니다. 실패한 분석 결과를 정상 묶음으로 올리지 않습니다.

## 로컬 실행과 테스트

```powershell
npm.cmd run scenario-lab
# Windows 최초 1회: Java 21 준비
npm.cmd run demo:setup
npm.cmd run design-lab
```

Scenario Lab은 fixture UI를 사용하고, Design Lab은 로컬 Auth/Firestore Emulator를 실행하며 합성 데이터를 구성합니다. macOS/Linux에서는 Java 21을 설치하고 JAVA_HOME을 설정합니다. 최초 실행은 런타임·Emulator 다운로드를 위해 인터넷 연결이 필요합니다.

브라우저 테스트는 최초 `npx playwright install chromium` 후 실행합니다. `npm run check`와 별도로 규칙은 `npm run test:rules`, UI 연결은 `npm run design-lab:test` 또는 `npm run scenario-lab:test`로 검사합니다. `npm run dev`는 Design Lab을 실행합니다(Java 21 필요). 운영 연결은 명시적인 `npm run dev:prod`에서만 사용합니다.

## Firebase 배포

```powershell
npx firebase login
```

배포 계정의 프로젝트 접근 권한이 필요합니다. 새 컴퓨터에서 재로그인한 뒤 [운영·인수인계](operations.md)의 staging/운영 명령을 따릅니다. 환경별 연결 파일과 Hosting 대상은 이미 Git에 있으며, 배포 직전에 해당 환경으로 빌드합니다. 계정 로그인 성공만으로 프로젝트 배포 권한까지 보장되지는 않습니다.

운영 데이터는 Firestore에 있으므로 개발 폴더 이전과 함께 복사하지 않습니다. main push의 CI는 검사만 수행하며 자동 앱 배포는 없습니다. 문서·개발 도구·그래프만 변경한 경우 앱 배포는 필요 없습니다.
