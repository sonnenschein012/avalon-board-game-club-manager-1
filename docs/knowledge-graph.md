# 코드 지식 그래프 운영

Understand-Anything은 기능 설명과 코드·테스트 관계를 찾는 로컬 보조 도구입니다. 현재 동작은 소스·테스트·Firestore 규칙으로 확인하고, 설계 이유와 운영 절차는 [개발 가이드](development.md)와 [운영 가이드](operations.md)에서 관리합니다. `agent_docs/`는 기존 판단을 보완하는 로컬 자료이며 삭제하거나 생성 설명으로 덮어쓰지 않습니다.

## 설치와 재현

검증 대상은 Egonex-AI/Understand-Anything 커밋 `5feed1f2ce4f9c368d860f4c0ebc36d98a4693fc`입니다. 자동 업데이트하지 않습니다. 새 버전을 채택하면 아래 검증을 반복합니다.

Windows에서는 공식 저장소의 `install.ps1`을 파일로 다운로드하고 검토한 뒤 `& ./install.ps1 codex`로 설치합니다. 도구 저장소는 `$HOME/.understand-anything/repo`, Codex 스킬은 `$HOME/.agents/skills/`, 공통 junction은 `$HOME/.understand-anything-plugin`입니다. 이미 존재하는 경로와 다른 도구 연결을 덮어쓰지 마세요. 도구 체크아웃에서 검증된 SHA를 선택하고, 루트 packageManager에 지정된 pnpm 10.6.2로 `pnpm install --frozen-lockfile`을 실행합니다. core 빌드는 설치의 prepare 단계가 수행합니다. 앱 의존성과 lockfile은 바꾸지 않습니다.

Node 22 이상, Git, pnpm 10 이상, 배치 병합용 Python 3이 필요합니다. 현재 Codex 모델·인증을 사용하며 별도 API 키를 추가하지 않습니다. 구조 추출·해시·검증은 로컬 계산이고, 설명·투어·업무 흐름·LLM 검토에는 Codex 사용량이 발생합니다. 정확한 소요량은 실행 결과로 기록합니다.

Codex 스킬 호출은 `$understand`처럼 채팅에서 합니다. PowerShell 명령이 아닙니다. 스킬 문서의 Bash 예제는 PowerShell로 변환하고 공식 Node/Python 스크립트를 실행합니다. junction 읽기가 제한되면 실제 플러그인 경로를 사용합니다. Windows ESM import는 `pathToFileURL`을 사용합니다. 실패 시 lockfile을 재작성하거나 새 분석기를 만들지 않습니다.

## 입력과 출력

`.ua/`는 Git 제외 산출물입니다. 기존 프로젝트 `.understand-anything/`가 있으면 공식 도구가 이를 우선하므로 두 디렉터리를 동시에 만들지 않습니다. `.ua/config.json`은 `{"autoUpdate":false,"outputLanguage":"ko"}`를 사용합니다. 커밋 훅이나 주기적 자동 분석은 설치하지 않습니다.

분석에는 `src/`, 모든 단위·통합·Playwright 테스트와 합성 fixture, `scripts/`, `docs/`, README, Firestore 규칙·인덱스, Firebase/Vite/TypeScript/ESLint/CI 설정을 포함합니다. 생성물, 의존성, 바이너리 이미지, 실제 업무 데이터, `.env*`, 인증 파일, 중복 백업과 과거 그래프는 제외합니다. `.ua/.understandignore`에 이를 기록하고 테스트 제외 제안을 활성화하지 않습니다. 초기 스캔의 파일 목록은 검증 스크립트의 독립 목록과 일치해야 합니다. 분석 범위를 바꾸면 두 목록을 함께 검토합니다.

`agent_docs/`는 Git 제외되어 공식 스캐너에서 빠질 수 있습니다. 필요한 원문을 직접 읽고 소스와 대조해 지속적인 결정만 기존 개발·운영 문서에 반영합니다. `AGENTS.md`, 분석 설정 및 `agent_docs/*.md`의 내용 해시는 별도로 감시합니다.

주요 산출물은 `knowledge-graph.json`, `domain-graph.json`, `fingerprints.json`, `meta.json`, `intermediate/scan-result.json`입니다. 이 묶음과 검증 상태를 함께 보관·복구합니다. 그래프의 노드 수는 정확성 점수가 아닙니다.

## 세션 작업 순서

1. `node scripts/knowledge-graph.mjs status`로 파일 내용·목록·설정·산출물의 상태를 확인합니다. 0은 검증된 동일 입력, 2는 갱신 필요, 3은 오류입니다. 동일 HEAD만으로 최신이라고 판단하지 않습니다.
2. 개발 가이드의 기능 시작점과 관련 규칙을 읽고 `$understand-chat`, `$understand-explain` 또는 JSON의 필요한 노드·관계만 조회합니다. 그래프 전체를 매번 읽지 않습니다.
3. 수정 전에 호출자, 저장·조회 경계, 공유 Firestore 컬렉션, 권한, 테스트를 확인합니다. 수정 후에는 기준 브랜치 대비 diff와 staged·unstaged·신규 파일의 합집합을 사용합니다. 삭제 항목은 이전 정상 그래프도 확인합니다.
4. `$understand-diff`는 기본 1-hop 후보입니다. 관련 화면까지 추가 추적하고 `DailyPlannings`, `sessions`, `members`, 면접 컬렉션의 모든 읽기·쓰기·구독 경로를 검색합니다. import가 없는 간접 소비자와 규칙 테스트를 확인합니다. 그래프 누락은 영향 없음의 근거가 아닙니다.
5. 변경 경계에 맞는 테스트를 실행합니다. 규칙·권한은 `npm run test:rules`, 앱 기본 검증은 `npm run check`, 화면 연결은 해당 Playwright 시나리오를 사용합니다. 운영 데이터를 검증용으로 바꾸지 않습니다.
6. 논리적 작업 완료 시 아래 정책으로 분석·검증하고 입력과 결과가 일치할 때만 정상 기준점을 갱신합니다.

## 갱신과 검증

먼저 `node scripts/knowledge-graph.mjs begin`으로 입력 기준을 저장합니다. 최초, 미커밋·신규 파일이 있는 상태, 이전 정상본이 dirty 상태에서 생성된 경우에는 `$understand --full --review --language ko --no-auto-update`를 실행합니다. 깨끗한 커밋 기준점 이후의 작은 변경에만 공식 증분 `$understand`를 사용합니다. 분석을 위해 사용자 작업을 commit/stash/reset하지 않습니다.

이 버전의 증분 처리기는 관련 미커밋 변경을 거부합니다. 부분 갱신은 투어 문장을 유지합니다. 함수 시그니처가 같아도 조건·반환값·업무 의미가 달라지면 설명을 직접 확인하고, 의미·권한·공유 데이터 계약·투어가 달라지는 경우 전체 분석으로 승격합니다. 업무 흐름은 지식 그래프 갱신 후 `$understand-domain`으로 별도 생성합니다. 파일이 분석 중 바뀌면 정상 기준점으로 승인하지 않습니다.

공식 `incremental-plan.json`에 `cosmeticFiles`가 있으면 본문 의미 변경이 숨어 있을 수 있으므로 전체 분석으로 승격합니다. 프로젝트 승인 명령도 이 상태의 증분 승인을 거부합니다. 구조가 같은 코드의 의미 변경을 무비용 갱신으로 처리하지 않습니다.

`node scripts/knowledge-graph.mjs verify`는 독립 파일 목록, 전체 fingerprint, 그래프 참조·레이어·투어, 변경되지 않은 노드·관계 보존을 검사합니다. 공식 스키마 검증과 LLM 검토도 수행합니다. 설명의 의미 정확성은 기계 검사만으로 판정할 수 없습니다.

LLM 검토 결과를 `.ua/verification/semantic-review.json`에 기록합니다. `status: "passed"`, 현재 `inputDigest`, `graphHash`, `domainHash`와 아래 사례별 답변·코드·테스트 근거·누락·한계를 포함해야 합니다. 해시는 SHA-256입니다. 전체 분석은 `node scripts/knowledge-graph.mjs accept . --full`, 깨끗한 증분은 `node scripts/knowledge-graph.mjs accept`로 승인합니다. 검토 기록이 없거나 해시가 다르면 실패합니다. 이 명령은 의미 검토를 대신하지 않습니다.

검증 스크립트 테스트는 `node --test scripts/knowledge-graph.test.mjs`입니다. 도구 업그레이드는 독립 복제본에서 staged/unstaged/new/delete/rename, 한국어·공백 경로, 동일 시그니처의 의미 변경, 문서·제외 규칙·생성물만 변경, 부분·아키텍처 증분, 중단·손상·노드/관계 누락을 검증합니다. Git worktree를 사용한다면 `UNDERSTAND_NO_WORKTREE_REDIRECT=1`로 주 저장소 덮어쓰기를 막습니다.

## 필수 질의

- 출석자의 attendee ID를 저장 member ID로 바꾸는 이유, 이름·학번 접두사 매칭, 미매칭 fallback과 관련 테스트를 찾는가? 변환 함수 직접 테스트가 없는 경우 그 사실도 말하는가?
- `boardMemberIds` 부재는 현재 회원 fallback, 빈 배열은 당시 임원 없음이라는 차이를 CSV·저장·통계에서 유지하는가?
- 계획과 확정 기록을 구분하고 이름 수정이 게임·메모·다른 조를 덮어쓰지 않는 저장 경로와 테스트를 찾는가?
- 공유 Firestore 데이터로 연결된 출석·모임·세션·통계·내보내기를 찾는가?
- 공개 token과 관리자 권한, 규칙 테스트, `scheduleId`의 undefined/null/ID 및 기존 회차 fallback을 설명하는가?
- 의미 변경 뒤 설명이 오래되거나 유지해야 할 심볼·관계가 사라졌을 때 발견하는가?

최초에는 이전 대화가 없는 검토 작업자도 같은 질문에 답하게 합니다. 그래프에서 찾은 내용과 원문으로 보완한 내용을 구분하며, 테스트 존재와 실제 실행 성공도 구분합니다.

## 실패와 복구

갱신 전 정상 `.ua` 묶음을 프로젝트 밖에 백업합니다. 실패 결과는 진단용으로 남기되 정상본을 덮어쓰거나 최신으로 표시하지 않습니다. 정상본 복구 시 graph/domain/fingerprints/meta/scan과 verification-state를 함께 복구합니다. 다른 작업이 진행된 뒤에는 이전 백업으로 사용자 파일 전체를 덮어쓰지 않습니다.

이전 Graphify 통합과 산출물 백업은 사용자 홈의 `.codex/migration-backups/avalon-ua-20260910`에 있습니다. 전환 후 두 번의 실제 유지보수 세션이 성공할 때까지 보관합니다. 전역 Graphify CLI는 다른 프로젝트 사용 범위가 확인되지 않아 제거하지 않습니다. 이번 프로젝트는 UA를 사용하며 전역 CLI의 잔존은 병행 운영을 뜻하지 않습니다.
