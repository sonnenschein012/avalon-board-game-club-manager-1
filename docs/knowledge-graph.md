# 코드 지식 그래프 운영

현재 프로젝트의 코드 탐색 도구는 Graphify입니다. 소스·테스트·Firestore 규칙은 최종 근거이며 그래프는 탐색 후보와 연결을 찾는 보조 자료입니다. 유지되는 설계·운영 결정은 docs/에 기록하고 agent_docs/는 선택적인 과거 기록으로 보존합니다.

## 설치와 재현

2026-10-10 확인한 공식 최신 릴리스 Graphify-Labs/graphify v0.9.84를 채택했습니다. PyPI 패키지 이름은 graphifyy이며 graphify-toolchain.json에 버전을 고정합니다. 최근 변경에는 TypeScript 호출 해석, 경로·줄바꿈에 따른 결과 차이 감소, 증분 갱신과 정확한 파일::심볼 조회 보정이 포함됩니다. 공식 릴리스: https://github.com/Graphify-Labs/graphify/releases/tag/v0.9.84 . 새 버전 채택 시 아래 검증을 반복합니다.

Node.js 22 이상, Git, Python 3.10 이상과 uv가 필요합니다. 이 환경에서는 Python 3.12.10을 검증합니다. 저장소 전용 런타임을 설치하며 다른 프로젝트의 전역 Graphify와 앱 npm 의존성을 바꾸지 않습니다.

```powershell
uv venv .graphify-runtime --python 3.12
uv pip install --python .graphify-runtime/Scripts/python.exe "graphifyy==0.9.84"
node scripts/graphify.mjs --version
node scripts/graphify.mjs install --project --platform codex
```

macOS/Linux에서는 Python 경로가 .graphify-runtime/bin/python입니다. wrapper는 운영체제별 경로와 고정 버전을 확인합니다. 공식 설치는 프로젝트의 .codex/skills/graphify/SKILL.md와 references/ 및 AGENTS.md 안내를 생성합니다. .codex/는 로컬 전용입니다. 설치가 덧붙인 일반 안내와 프로젝트 규칙이 겹치면 이 문서와 유지된 AGENTS.md의 후보 분석·검증 정책을 따릅니다. 개인 Codex 설정·모델·인증을 변경하거나 새 API 키를 추가하지 않습니다. 코드 AST는 로컬 계산, 문서 의미 분석은 현재 Codex 세션 사용량이며 정확한 토큰 합계가 노출되지 않으면 미측정으로 기록합니다.

## 범위와 공유 묶음

src/, 모든 단위·규칙·Playwright 테스트와 합성 fixture, scripts/, docs/, .github/, .stitch/DESIGN.md, README, Firestore 규칙·인덱스, Firebase/Vite/TypeScript/ESLint 설정을 포함합니다. .mts/.cts 및 Python 운영 스크립트도 포함합니다. 실제 업무 자료·CSV/TSV, 인증/.env, 의존성·빌드·로그·이미지, agent_docs/, .ua/, .codex/, 도구 런타임·캐시와 로컬 배포 산출물은 .graphifyignore로 제외합니다. AGENTS.md는 그래프 노드 대신 최신성 제어 입력입니다.

공식 detect와 독립 목록의 차이를 확인합니다. Graphify가 분류하지 못하는 유지된 텍스트(예: Firestore Rules·CSS·webmanifest·확장자 없는 설정)와 AST가 노드로 표현하지 않는 Firebase·인덱스·도구 버전 JSON 설정은 의미 분석 대상으로 명시하여 source_file 근거를 남깁니다. 이를 AST 추출 성공으로 표현하지 않습니다. 민감 파일로 표시된 항목은 자동 강제 포함하지 않습니다.

Git 공유 허용 목록은 graphify-out/graph.json, graph.html, GRAPH_REPORT.md, manifest.json, scope.json, semantic-review.json, verification-state.json입니다. interpreter/root 절대 경로, cache, 분석 중간 파일, work memory, 토큰 누계 파일은 공유하지 않습니다. manifest는 공식 Graphify가 생성한 저장소 상대 경로 목록입니다. 그래프는 방향을 보존하며 각 관계의 EXTRACTED/INFERRED/AMBIGUOUS와 신뢰도를 유지합니다.

## 일상적인 탐색과 갱신

```powershell
node scripts/graphify.mjs status
node scripts/graphify.mjs query "DailyPlannings sessions renameDailyPlanningGroup"
node scripts/graphify.mjs path "convertAttendeeIdsToMemberIds" "getMemberFromAttendee"
node scripts/graphify.mjs explain "src/services/dailyPlanningService.ts::renameDailyPlanningGroup"
node scripts/graphify.mjs affected "renameDailyPlanningGroup"
```

query는 그래프 어휘를 함께 사용하고 필요하면 --budget로 범위를 제한합니다. path는 방향 있는 경로를 찾으므로 경로 부재를 기능·영향 부재로 해석하지 않습니다. 직접 import가 없는 공유 Firestore 소비자를 소스에서 추가 검색하고 삭제 심볼은 직전 정상 그래프와 diff를 함께 확인합니다. 그래프 전체나 보고서를 매 세션 읽지 않습니다.

편집 중에는 stale을 허용합니다. 완료된 작업이나 사용자 요청 이정표에 갱신합니다. node scripts/graphify.mjs update .는 공식 AST 갱신을 .graphify-work/update-candidate에 실행하여 정상 공유 묶음을 보존합니다. 문서·Rules·업무 의미 변경은 공식 스킬의 의미 분석 및 검토도 필요합니다. AST 모양과 동일 함수 시그니처만으로 의미가 같다고 판단하지 않습니다. 자동 watcher, post-commit hook, Cloud 업로드와 운영 DB 분석은 사용하지 않습니다.

## 전체 분석과 승인

1. 정상 묶음을 프로젝트 밖에 백업하고 node scripts/graphify.mjs begin으로 입력 SHA-256을 저장합니다. 분석을 위해 사용자 작업을 commit/stash/reset하지 않습니다.
2. .graphify-runtime/Scripts/python.exe scripts/graphify_pipeline.py scan으로 공식 detect/semantic cache 및 독립 목록을 대조합니다. 이어 ast로 공식 구조 추출을 실행합니다.
3. 공식 Graphify Codex 스킬의 Part B와 references/extraction-spec.md를 읽고 문서·보완 텍스트를 최대 두 동시 작업자로 분석합니다. 결과는 .graphify-work/candidate/semantic-chunk-*.json에 저장합니다. 현재 세션 인증을 사용하며 실제 토큰 합계를 모르면 0원/0토큰으로 주장하지 않습니다.
4. 완료된 의미 분석의 현재 소스 근거를 확인한 뒤 pipeline의 seal로 chunk와 근거 파일의 해시 영수증을 기록합니다. 오래된 chunk를 다시 봉인해 현재 분석으로 취급하지 않습니다. build는 영수증과 현재 소스를 대조하고 공식 build/cluster/analyze/report/export/diagnostics/save_manifest를 실행합니다. 추출기나 클러스터링을 재구현하지 않습니다. 커뮤니티 이름을 후보 community-labels.json에 작성하고 build를 다시 실행해 보고서와 graph.json에 반영합니다. 5,000개 초과 시 HTML의 집계 표시를 알리고 공식 export html을 실행합니다.
5. 이전 대화 없는 독립 검토자가 아래 6개 사례를 현재 소스·테스트와 대조합니다. 그래프에서 찾은 내용과 원문 보완, 존재하는 테스트와 실제 실행 결과, 누락·한계를 구분합니다. graphHash/inputDigest에 연결된 semantic-review.json을 작성합니다.
6. 완전히 검토한 후보의 공유 허용 목록만 graphify-out/로 옮기고 node scripts/graphify.mjs accept 및 verify를 실행합니다. 분석 중 입력 해시가 바뀌면 승인하지 않습니다. 실패·빈 그래프·누락된 의미 분석은 정상 묶음을 대체하지 않습니다.

status의 0/current는 같은 입력·제어·산출물 내용 해시이며 2/stale·artifact-drift·unverified는 갱신/복구 필요, 3/invalid는 읽기·검증 오류입니다. UTF-8 입력·제어 텍스트는 CRLF를 LF로 정규화하여 SHA-256을 계산합니다. 공유 산출물은 .gitattributes의 eol=lf에 맞춰 pipeline의 portable로 LF 저장하고 바이트 해시를 검사합니다. HEAD가 같아도 내용 변경은 stale, 그래프만 커밋한 뒤 HEAD가 달라도 같은 내용이면 current입니다. verify는 구조·경로 커버리지·버전·의미 검토·산출물 무결성을 확인하며 문장 의미를 자동 증명하지 않습니다.

검증 도구 테스트는 node --test scripts/graphify.test.mjs입니다. 도구 업그레이드는 별도 합성 복제본으로 body-only/staged/new/delete/rename, 한국어·공백 경로, 문서·제외 규칙 변경, warm/cold·줄바꿈·경로 차이, 정상 묶음 손상·중단, 유지해야 할 심볼·관계 누락을 확인합니다. 공식 update 결과와 의미 갱신 필요 플래그도 대조합니다.

## 필수 6개 사례

- attendee ID를 저장 member ID로 바꾸는 이유, 이름·학번 접두사 매칭, 미매칭 fallback을 찾는가? 직접 변환 테스트와 접두사 fallback 전용 테스트가 없으면 그 사실을 구분하는가?
- boardMemberIds 부재는 현재 회원 fallback, 빈 배열은 당시 임원 없음이라는 차이를 CSV·저장·통계에서 유지하는가?
- 계획/확정 기록을 구분하고 이름 수정이 게임·메모·다른 조를 덮어쓰지 않는 경로·테스트와 동시성 한계를 설명하는가?
- 공유 Firestore로 연결된 출석·모임·세션·통계·내보내기와 간접 소비자를 찾는가?
- 공개 token/관리자 권한, 규칙 테스트, scheduleId undefined/null/ID와 legacy 회차 fallback, 클라이언트/Rules 차이를 설명하는가?
- body-only 의미 변경과 오래된 설명, 유지할 심볼·관계 소실, 입력/산출물 손상을 발견하는가?

## 이전 도구와 복구

2026-10-10 사용자 요청으로 UA에서 최신 Graphify 기준으로 전환했습니다. 기존 .ua/ 공유 묶음은 과거 검증 자료로 그대로 보존하며 현재 그래프라고 사용하지 않습니다. 과거 node scripts/knowledge-graph.mjs와 테스트는 UA 역사 묶음 검증 용도로 남깁니다. 개인 UA 스킬·전역 Graphify는 다른 프로젝트 사용 범위를 모르므로 제거/덮어쓰기하지 않습니다. 이전 Graphify→UA 백업과 이번 UA→Graphify 백업 모두 로컬 보존하며 실제 업무 자료는 이동하지 않습니다.

복구는 같은 정상 커밋의 Graphify 허용 목록 묶음 전체로 수행합니다. 다른 작업 뒤에 사용자 파일 전체를 백업으로 덮어쓰지 않습니다. 새 컴퓨터는 docs/new-computer.md를 따릅니다. source/tests/docs와 그래프는 별도 커밋으로 공유할 수 있으나 commit/push는 최신성 검증을 대체하지 않습니다. 도구·문서·그래프 변경은 앱 배포를 요구하지 않습니다.
