# 새 컴퓨터에서 시작하기

완료된 대화, agent_docs/, 개인 Codex 워크플로, node_modules/, dist/와 로컬 캐시는 가져오지 않아도 됩니다. 저장소의 AGENTS.md, README와 docs/를 새 작업 세션의 기준으로 사용합니다. 소스·테스트·Firestore 규칙이 최종 근거입니다.

## 최초 설치

Git과 Node.js 22를 설치합니다. Graphify를 직접 실행할 때는 Python 3.10 이상(이 환경의 검증 버전은 3.12.10)과 uv도 필요합니다. 아래는 PowerShell 예시입니다(macOS/Linux에서는 npm.cmd 대신 npm).

```powershell
git clone https://github.com/sonnenschein012/avalon-board-game-club-manager-1.git
cd avalon-board-game-club-manager-1
npm.cmd ci
node scripts/graphify.mjs status
npm.cmd run check
```

Firebase 연결 설정은 저장소에 있으며 별도 .env가 필요하지 않습니다. npm ci가 고정된 Firebase CLI를 함께 설치합니다. status의 current는 분석 입력과 검증된 묶음의 해시가 일치한다는 뜻이며 모든 제품 기능 테스트의 성공을 뜻하지 않습니다.

## 지식 그래프 재사용

clone에 graphify-out/의 검증된 graph.json·HTML·보고서·공식 manifest·범위·의미 검토·검증 상태가 포함됩니다. status는 Node와 Git만으로 내용 해시를 확인합니다. JSON 범위 조회도 Graphify 설치 없이 가능합니다. 이전 .ua/는 역사 자료입니다. 개인 interpreter/root 절대 경로와 인증 파일을 복사하지 않습니다.

- current: 같은 내용의 검증 결과를 재사용합니다. HEAD 이동만으로 무효화되지 않습니다.
- stale: 소스·문서·제어 입력이나 파일 목록이 달라졌습니다. 정상 그래프와 실제 diff를 함께 확인합니다.
- artifact-drift: 산출물 변경/누락입니다. 작업을 보존하고 같은 정상 커밋의 묶음으로 복구합니다.
- unverified/invalid: 정상 묶음이 없거나 검증에 실패했습니다.

query·path·explain·affected 또는 갱신이 필요하면 고정 프로젝트 런타임을 설치합니다.

```powershell
uv venv .graphify-runtime --python 3.12
uv pip install --python .graphify-runtime/Scripts/python.exe "graphifyy==0.9.84"
node scripts/graphify.mjs install --project --platform codex
node scripts/graphify.mjs query "members sessions"
node scripts/graphify.mjs verify
```

macOS/Linux의 가상환경 Python 경로는 .graphify-runtime/bin/python이며 wrapper가 이를 선택합니다. 설치가 AGENTS.md에 일반 안내를 덧붙이면 유지된 프로젝트 지침의 분석 시점·후보·검증 정책을 따릅니다. source/tests/rules가 최종 근거입니다. 새 분석과 복구는 [지식 그래프 운영](knowledge-graph.md)의 공식 스킬 및 6개 검증 사례를 따릅니다. 자동 hook·watcher·Cloud 연결은 설치하지 않습니다.

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
