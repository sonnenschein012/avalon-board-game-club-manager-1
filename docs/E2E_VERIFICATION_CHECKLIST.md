# E2E 통합 검증 체크리스트 및 릴리즈 게이트 (Release Gate Checklist)

본 문서는 Google Workspace 연동 기능의 실제 운영 배포 전 수행해야 하는 **필수 릴리즈 게이트(Release Gate)** 및 **E2E 통합 검증 시나리오 체크리스트**입니다.

---

## ⚠️ 릴리즈 게이트 (Release Gate) 원칙

> [!IMPORTANT]
> **코드 작성 및 단위 테스트(Mock) 통과만으로는 프로젝트 전체를 운영 준비 완료(Production-Ready)로 판정하지 않습니다.**
> 다음 **두 가지 필수 릴리즈 게이트**가 실제 환경에서 모두 **PASS**되어야 최종 운영 승인으로 판정합니다:
> 1. **Firestore Security Rules Emulator 실제 실행 및 통과**
> 2. **실제 Google Cloud 환경 전체 E2E 통합 시나리오 검증**

---

## 1. 릴리즈 게이트 1: Firestore Security Rules Emulator 검증

로컬 Java Runtime(JRE 11+)이 설치된 환경에서 다음 절차로 보안 규칙을 검증합니다:

```bash
# Firestore Rules 단위 테스트 실행
npm run test:rules
```

### 필수 확인 항목:
- [ ] 일반 Admin 및 비인가 사용자가 `system_settings/google_workspace_private` 또는 `oauth_tokens`를 직접 읽거나 쓰지 못하는지 확인
- [ ] 일반 Admin이 `system_settings/google_workspace_public` 및 `current_meeting_source`를 안전하게 읽고 업데이트할 수 있는지 확인
- [ ] Master Admin 전용 문서에 대한 RBAC 권한 제어가 규칙 수준에서 100% 차단되는지 확인

---

## 2. 릴리즈 게이트 2: 실제 Google Cloud 환경 E2E 검증 시나리오

### 시나리오 1: Master Admin OAuth 2.0 계정 연결
- [ ] **진입**: Master Admin 계정으로 로그인 후 `환경 설정` 진입
- [ ] **동작**: [Google 계정 연결] 클릭 → Google 로그인 팝업 및 동의 화면 완료
- [ ] **검증**:
  - `system_settings/google_workspace_public`의 `state`가 `connected`로 변경됨
  - 연결된 Google 계정 이메일이 UI에 정상 표시됨
  - CSRF state 토큰이 일회용으로 정상 소비됨

---

### 시나리오 2: Form 템플릿 선택 및 검증 (Google Picker)
- [ ] **진입**: Google Workspace 연동 패널에서 [템플릿 변경] 클릭
- [ ] **동작**: Google Picker 모달에서 동아리 설문 템플릿(Google Form) 선택
- [ ] **검증**:
  - 선택한 폼의 ID 및 제목이 `google_workspace_public.templateFormId`에 저장됨
  - Form이 아닌 다른 파일(예: Sheets, Docs) 선택 시 유효성 검사 오류 토스트 노출

---

### 시나리오 3: 일일 모임 설문 원클릭 생성 & Destination 바인딩
- [ ] **진입**: `일일 조 편성(AttendancePage)` 화면 상단 [오늘 모임 설문 생성] 클릭
- [ ] **동작**: 설문 제목(예: `2026-08-22 정기모임 참석 조사`) 확인 후 [생성 및 연결] 클릭
- [ ] **검증**:
  - Google Drive에 새 Form 파일이 복제됨
  - 새 Google Spreadsheet 파일이 자동 생성됨
  - Apps Script를 통해 Form의 응답 대상이 새 Spreadsheet로 실제 바인딩됨
  - 생성된 Form의 응답자 화면 내부 제목이 지정된 제목으로 변경됨
  - `system_settings/current_meeting_source`가 새로 생성된 Sheet 및 실제 응답 Tab으로 자동 갱신됨
  - 모달에서 [설문 링크 복사], [Form 열기], [응답 Sheet 열기] 링크가 정상 동작함

---

### 시나리오 4: 실제 설문 응답 제출 및 원클릭 Sheet 동기화
- [ ] **동작 1**: 복사한 설문 링크로 브라우저에서 참석 응답 2~3건 제출 (이름, 음료, 뒷풀이 등)
- [ ] **동작 2**: `AttendancePage`에서 [Google Sheet 동기화] 버튼 클릭
- [ ] **검증**:
  - Google Sheet의 응답 데이터가 파싱되어 출석 대기자 목록에 즉시 반영됨
  - 기존 동아리 명단(`members`)과 자동 매칭 및 신규 멤버 등록 정상 처리
  - 휴면 상태인 회원이 설문 제출 시 active로 자동 복귀됨

---

### 시나리오 5: 안전 보호 플로우 검증 (Zero-Loss Pipeline)
- [ ] **조편성 진행 보호**: 대기자를 조에 편성(`status === '편성됨'`)한 후 다시 [Sheet 동기화] 클릭 시, "이미 조편성이 진행된 상태입니다" 경고 팝업 발생 확인 → 취소 시 기존 데이터 100% 보존
- [ ] **수동 변경 감지**: 대기자 목록에서 임의 인원을 수동 삭제/수정한 후 Sheet 동기화 시 수동 변경 감지 다이얼로그 발생 확인
- [ ] **0명 보호**: 빈 Sheet를 동기화 시도할 때 전체 삭제 방지 경고 발생 확인
- [ ] **중복 요청 멱등성**: [설문 생성] 버튼 연속 광클 시 동일 `clientRequestId`로 인해 중복 파일이 생성되지 않고 1건만 안전하게 처리됨 확인

---

### 시나리오 6: 토큰 재인증(`reauth_required`) 및 계정 변경 / 연동 해제
- [ ] **토큰 만료/철회 시**: Google 계정 보안 설정에서 액세스 권한 삭제 후 웹 앱 새로고침 시 `reauth_required` 주황색 배너 및 [Google 계정 다시 연결(재인증)] 버튼 노출 확인
- [ ] **계정 변경**: [계정 변경] 버튼을 눌러 다른 Google 계정으로 교체 성공 확인
- [ ] **연동 해제**: [연동 해제] 클릭 시 Google 토큰이 정상 revoke되고 `google_workspace_public` 및 `google_workspace_private`가 안전하게 초기화됨 확인

---

## 3. 최종 완료 판정 승인표

| 게이트 | 검증 항목 | 검증 담당 | 판정 (PASS / FAIL) | 일시 |
| :--- | :--- | :---: | :---: | :---: |
| **Gate 1** | Firestore Security Rules Emulator | 배포 엔지니어 | [ ] | |
| **Gate 2** | 실제 Google Cloud OAuth & Picker 플로우 | 운영 총괄 관리자 | [ ] | |
| **Gate 2** | 일일 설문 생성 & Apps Script Destination 바인딩 | 운영 총괄 관리자 | [ ] | |
| **Gate 2** | 실제 설문 응답 제출 & 원클릭 동기화 | 운영 총괄 관리자 | [ ] | |
| **Gate 2** | 안전 보호 플로우 (조편성/수동수정/0명/멱등성) | 운영 총괄 관리자 | [ ] | |
