# Avalon Manager — Google Workspace 정기모임 설문 생성 및 출석 명단 동기화 통합 개발 명세서 v1.0

## 1. 문서 목적

Avalon Manager의 정기모임 운영 과정에서 반복되는 Google Form 생성과 Google Sheet 응답 불러오기 작업을 하나의 흐름으로 단순화한다.

현재 운영 흐름은 대략 다음과 같다.

**설문 준비**

기존 Form 확인 또는 복제  
→ 제목 수정  
→ 응답 Sheet 연결  
→ 응답 링크 복사  
→ 공지

**모임 당일**

Google Form/Sheet 접근  
→ CSV 다운로드  
→ Avalon 접속  
→ CSV 업로드  
→ 조편성

최종 목표는 다음과 같다.

**설문 준비**

Avalon  
→ 정기모임 설문 생성  
→ 제목 입력  
→ 링크 복사  
→ 공지

**모임 당일**

Avalon  
→ 응답 불러오기  
→ 조편성

Google Form 편집기 자체를 Avalon 안에 구현하지 않는다.

---

## 2. 통합 후 핵심 개념

Google 연동 기능은 네 계층으로 분리한다.

### A. Google 연결

장기간 사용할 Google Workspace 계정을 연결한다.

### B. 설문 템플릿

설정에서 정기모임용 기본 Google Form을 하나 지정한다.

### C. 모임별 설문

기본 템플릿을 복제하여 매 모임마다 새로운 Google Form과 응답 Sheet를 생성한다.

### D. 출석 동기화

생성된 Sheet 또는 사용자가 수동 선택한 Sheet에서 응답을 읽어 기존 attendee import pipeline으로 전달한다.

구조적으로는 다음과 같다.

```text
Google 계정
    │
    ├─ 기본 Form 템플릿
    │       │
    │       └─ 정기모임 설문 생성
    │               │
    │               ├─ 새 Google Form
    │               └─ 새 응답 Google Sheet
    │                         │
    │                         ▼
    │                   Sheet Sync
    │                         │
    │                         ▼
    │                    attendees
    │
    └─ 수동 선택 Google Sheet ──→ Sheet Sync
                                      ▲
CSV fallback ─→ CSV Parser ────────────┘
```

---

## 3. 기존 Sheets 명세에서 변경되는 부분

기존 명세 대부분은 유지한다.

다만 다음 사항은 통합 기능에 맞게 변경한다.

### 3.1 지속적인 기본값

기존:

> 기본 Google Sheet

통합 후 핵심 기본값:

> **기본 정기모임 Google Form 템플릿**

정기모임마다 새로운 Sheet가 생성되므로 하나의 Sheet를 지속적으로 기본값으로 사용하는 것은 주 운영 흐름과 맞지 않는다.

따라서 `기본 Sheet`는 필수 기능에서 제외한다.

필요하다면 수동 Sheet 동기화를 자주 사용하는 운영을 위해 향후 선택 기능으로 추가할 수 있다.

### 3.2 현재 Sheet

현재 조편성에서 사용할 Sheet라는 개념은 유지한다.

다만 자동 생성된 정기모임 설문은 생성 성공과 동시에 해당 응답 Sheet를 현재 데이터 소스로 자동 연결한다.

### 3.3 수동 Sheet 선택

계속 지원한다.

자동 생성 기능을 사용하지 않은 특수 설문, 기존 설문, 행사 설문 등에 사용할 수 있다.

### 3.4 CSV

계속 지원한다.

Google API 장애나 인증 문제 발생 시 fallback이다.

---

## 4. 사용자에게 보이는 최종 구조

### 설정 화면

#### Google Workspace 연동

- 연결 계정
- 연결 상태
- 계정 연결
- 다시 연결
- 계정 변경
- 연결 해제

#### 정기모임 설문 템플릿

- 현재 지정된 Google Form
- 템플릿 변경

예:

```text
Google Workspace

연결됨
avalon@example.com

[계정 변경] [연결 해제]


정기모임 설문 템플릿

아발론 정기모임 참석 조사 TEMPLATE

[템플릿 변경]
```

질문을 수정할 필요가 있는 경우 Avalon에서 질문을 편집하지 않는다.

Google Forms에서 템플릿 자체를 수정하거나 새로운 Form을 만든 뒤 설정에서 새 템플릿을 선택한다.

---

## 5. 정기모임 설문 생성 화면

별도의 Operations 기능으로 제공한다.

정확한 메뉴명은 UI 구현 시 결정할 수 있으나 예시는 다음과 같다.

- 설문 관리
- 정기모임 설문
- 모임 준비

핵심 생성 UI는 의도적으로 단순하게 유지한다.

```text
정기모임 설문 생성

설문 제목
[ 아발론 5기 4회 정기모임 참석 조사 ]

[설문 생성]
```

사용자 입력값은 **하나만 요구한다.**

> 설문 제목

질문 구성, Sheet 이름, Form 파일명, Folder ID 등을 입력하게 하지 않는다.

---

## 6. Form 제목의 의미

사용자가 입력하는 `설문 제목`은 Google Drive에 보이는 파일 이름을 의미하지 않는다.

이는 **Google Form 내부에서 응답자에게 보이는 제목**을 의미한다.

Forms API 기준으로는 `info.title`이다.

Google Forms의 내부 제목과 Drive 문서 제목은 별개의 값이다.

따라서 사용자 UX에는 파일명 입력란을 제공하지 않는다.

필요하다면 시스템 내부에서 관리 편의를 위해 Drive 파일명도 같은 값으로 자동 설정할 수 있다.

예:

사용자 입력:

```text
아발론 5기 4회 정기모임 참석 조사
```

결과:

```text
Form 내부 제목:
아발론 5기 4회 정기모임 참석 조사

Drive 파일명:
아발론 5기 4회 정기모임 참석 조사

응답 Sheet 파일명:
아발론 5기 4회 정기모임 참석 조사 - 응답
```

단, 사용자에게 세 이름을 따로 입력시키지 않는다.

---

## 7. 템플릿 선택

설정에서 Google Form 파일을 선택한다.

URL이나 Form ID를 직접 입력하는 것은 기본 UX로 사용하지 않는다.

파일 선택 UI에서 가능한 한 Google Forms만 표시한다.

템플릿 선택 시 최소한 다음을 검증한다.

- 파일 존재
- 현재 연결 계정 접근 가능
- Google Form 파일인지 확인
- 복사 가능 여부
- 필요한 편집 권한 여부

검증 성공 후에만 템플릿으로 저장한다.

---

## 8. 템플릿 변경

질문을 추가하거나 수정할 때 Avalon 내부 설문 편집기는 만들지 않는다.

두 방식 모두 허용한다.

### 같은 템플릿을 직접 수정

Google Forms에서 현재 템플릿을 수정한다.

이후 생성되는 Form부터 변경 내용이 반영된다.

### 새로운 템플릿 생성

새 Form을 만든 뒤:

```text
설정
→ 정기모임 설문 템플릿
→ 템플릿 변경
→ 새 Form 선택
```

기존에 생성했던 정기모임 Form에는 영향을 주지 않는다.

---

## 9. 정기모임 설문 생성 처리

사용자가 `설문 생성`을 누르면 서버에서 하나의 생성 작업으로 처리한다.

논리적 처리 순서는 다음과 같다.

1. Google 연결 상태 확인
2. 기본 Form 템플릿 확인
3. 템플릿 접근 권한 확인
4. 템플릿 Form 복제
5. 복제된 Form의 내부 제목 변경
6. 필요하면 Drive 파일명 자동 변경
7. 새로운 Google Spreadsheet 생성
8. 새 Form의 응답 목적지를 해당 Spreadsheet로 연결
9. Form이 응답 가능한 게시 상태인지 확인
10. 응답자 링크 확보
11. 응답 Sheet/tab 식별
12. Avalon에 생성 결과 저장
13. 생성된 Sheet를 해당 설문의 동기화 source로 저장
14. 성공 결과를 사용자에게 표시

---

## 10. Google Form ↔ Sheet 연결

Google Forms REST API의 `linkedSheetId`는 output-only이므로 Forms REST API만으로 새로운 destination을 지정할 수 없다.

Google Apps Script Forms 서비스에는 다음 기능이 공식 제공된다.

```text
Form.setDestination(
    DestinationType.SPREADSHEET,
    spreadsheetId
)
```

따라서 Form 생성 기능에서 이 작업을 수행할 별도 Google 실행 계층이 필요하다.

### 권장안

배포된 Google Apps Script API executable을 Google OAuth 사용자의 권한으로 서버에서 호출한다.

Apps Script 함수 내부에서는 최소한 다음 작업을 담당할 수 있다.

```text
templateFormId
title
        ↓
template copy
        ↓
Form title update
        ↓
Spreadsheet create
        ↓
Form.setDestination()
        ↓
publish check
        ↓
formId
spreadsheetId
response URL
```

이 부분은 구현 전 작은 기술 검증 단계에서 먼저 확인한다.

---

## 11. 템플릿의 기존 응답 Sheet 재사용 금지

템플릿 자체에 이미 응답 Sheet가 연결되어 있더라도 새로운 모임 Form이 그 Sheet를 그대로 사용해서는 안 된다.

각 모임 설문에는 **독립적인 새 Spreadsheet**를 만든다.

목표:

```text
1주차 Form → 1주차 Sheet

2주차 Form → 2주차 Sheet

3주차 Form → 3주차 Sheet
```

다음과 같은 상태를 허용하지 않는다.

```text
1주차 Form ─┐
2주차 Form ─┼→ TEMPLATE 응답 Sheet
3주차 Form ─┘
```

생성 과정에서 destination 상태를 명시적으로 검증한다.

---

## 12. 생성 성공 화면

생성 완료 후 최소한 다음을 표시한다.

```text
설문이 생성되었습니다.

아발론 5기 4회 정기모임 참석 조사

[응답 링크 복사]
[Google Form 열기]
[응답 Sheet 열기]
```

핵심 목적상 **응답 링크 복사**는 필수 기능이다.

사용자가 Google Forms에 들어가 URL을 다시 찾을 필요가 없어야 한다.

`공지문 전체 복사` 등의 기능은 향후 선택 기능으로 둔다.

---

## 13. 생성된 설문 기록

Avalon은 생성된 Form과 Sheet의 관계를 기억한다.

논리적으로 다음 정보가 필요하다.

```text
Survey / Meeting Form

id
title

templateFormId

formId
formResponderUrl

spreadsheetId
responseSheetId 또는 tab 식별정보
responseSheetName

googleAccountId

createdAt
createdBy

status
```

정확한 Firestore collection명과 field명은 구현 단계에서 확정한다.

---

## 14. 생성된 Sheet와 조편성 연결

새 설문 생성 성공 후 해당 Sheet를 동기화 기능이 바로 사용할 수 있어야 한다.

즉:

```text
정기모임 설문 생성
        ↓
Form + Sheet 생성
        ↓
Avalon에 연결 정보 저장
        ↓
조편성 화면
        ↓
해당 설문의 응답 불러오기
```

사용자는 생성 직후 해당 Sheet를 Google Picker에서 다시 찾지 않아야 한다.

---

## 15. 조편성 화면

기본 화면 예:

```text
참석자 데이터

5기 4회 정기모임 참석 조사

Google Sheets
아발론 5기 4회 정기모임 참석 조사 - 응답

마지막 동기화
17:42 · 37명

[응답 불러오기] [다른 Sheet 선택]

CSV 파일 업로드
```

정기모임 Form 생성 기능으로 생성된 Sheet라면 자동 선택한다.

사용자가 필요하면 `다른 Sheet 선택`으로 override할 수 있다.

---

## 16. Sheet 수동 선택

자동 Form 생성 기능과 독립적으로 기존 Google Sheet를 선택할 수 있다.

사용 사례:

- 기존에 직접 만든 Form
- 개강총회
- MT
- 아발론의 밤
- 임시 참석 조사
- 자동 생성 기능 사용 전 설문

수동 Sheet 선택은 Google 연결을 다시 요구하지 않는다.

파일 선택과 실제 동기화는 분리한다.

```text
다른 Sheet 선택
→ source만 변경

응답 불러오기
→ attendee 변경
```

Sheet를 고른 것만으로 현재 attendee를 변경하지 않는다.

---

## 17. Spreadsheet 내부 tab

Spreadsheet와 내부 Sheet/tab은 별개로 취급한다.

### 자동 생성 Form

Avalon이 Form과 Spreadsheet를 모두 생성했으므로 가능한 한 응답 tab도 자동 식별하여 저장한다.

사용자에게 tab 선택을 요구하지 않는 것을 목표로 한다.

### 수동 Sheet

tab이 하나라면 자동 선택할 수 있다.

tab이 여러 개라면 목록을 표시한다.

기존 저장 tab이 사라졌다면 임의의 다른 tab을 사용하지 않는다.

재선택을 요구한다.

---

## 18. Google 계정 연결

Avalon 로그인용 Firebase Google 계정과 Google Workspace 데이터 계정은 별개다.

예:

```text
Avalon 로그인:
officer-personal@gmail.com

Google Workspace 연동:
avalon.club@gmail.com
```

이 구조를 허용한다.

최초 연결:

```text
설정
→ Google 계정 연결
→ 계정 선택
→ 권한 승인
→ 서버에서 장기 credential 확보
→ 연결 완료
```

이후 정상적인 사용에서 매번 Google 인증 창이 나타나서는 안 된다.

---

## 19. 신뢰 백엔드 계층

현재 Avalon Manager는 클라이언트 중심 구조이므로 Google 연동을 위해 서버 측 계층을 추가한다.

이 서버는 최소 다음 책임을 갖는다.

- OAuth authorization code 처리
- refresh token 안전 보관
- access token refresh
- Google API 호출
- Apps Script 호출
- Form 생성
- Sheet 생성/연결
- Sheet 데이터 읽기
- Google 연결 상태 검사
- credential revocation 처리

### 권장 방향

현재 Firebase 기반과의 운영 일관성을 고려하여 Firebase Functions 또는 동등한 Google Cloud 서버 계층을 우선 검토한다.

이는 구현 제안이며 제품 요구사항은 아니다.

---

## 20. 브라우저에 두지 않을 정보

다음 정보는 일반 브라우저 JavaScript에서 직접 읽을 수 있는 곳에 평문 보관하지 않는다.

- refresh token
- OAuth client secret
- 장기 Google credential
- Apps Script 실행을 위한 민감 정보

`localStorage`에 refresh token을 저장하는 구현은 금지한다.

---

## 21. Google 계정 연결 수명

정상 상황에서는 다음 흐름을 목표로 한다.

```text
최초 1회 연결
        ↓
여러 주/수개월 사용
        ↓
Form 생성
Sheet 읽기
Form 생성
Sheet 읽기
...
```

매 모임 재인증을 요구하지 않는다.

Google이 credential을 취소하거나 무효화한 경우에만 재연결한다.

---

## 22. 재인증

인증 오류와 일반 네트워크 오류를 구분한다.

예:

```text
Google 연결을 다시 확인해야 합니다.

연결 계정
avalon@example.com

[다시 연결]
```

재연결 성공 후 기존 템플릿 및 Sheet 접근 가능 여부를 검사한다.

접근 가능하면 설정을 그대로 유지한다.

접근할 수 없을 때만 재선택을 요구한다.

---

## 23. 계정 변경

설정에서 Google Workspace 계정을 변경할 수 있다.

새 계정 연결이 완전히 성공하기 전에 기존 정상 credential을 삭제하지 않는다.

절차:

```text
새 계정 OAuth
→ credential 확보
→ 기본 template 접근 검사
→ 기존 생성 Sheet 접근 검사
→ 정상 확인
→ active Google connection 교체
```

새 계정에서 기존 템플릿 접근이 불가능하면:

```text
새 계정이 현재 설문 템플릿에 접근할 수 없습니다.

[새 템플릿 선택]
```

을 표시한다.

---

## 24. 계정 연결 권한

Google 계정 자체를 바꾸는 작업은 운영 전체에 영향을 미친다.

권장 정책:

- Form 생성: 일반 운영진 가능
- 응답 동기화: 일반 운영진 가능
- Sheet 변경: 일반 운영진 가능
- Google 계정 연결/변경/해제: Master Admin
- 기본 Form 템플릿 변경: Master Admin

정확한 권한 정책은 구현 전에 최종 확정한다.

---

## 25. Sheet 동기화 파이프라인

기존 CSV와 Google Sheet가 동일한 attendee 생성 로직을 사용해야 한다.

목표 구조:

```text
CSV File
   ↓
CSV row reader
   ↓
Record<string,string>[]
                         ↘
                           normalizeAttendeeRows()
                         ↗
Google Sheet API
   ↓
Sheet row reader
   ↓
Record<string,string>[]
```

이후:

```text
normalize
→ validation
→ replacement plan
→ safe Firestore replacement
```

하나의 공통 pipeline을 사용한다.

---

## 26. 기존 코드 리팩터링

현재 `importAttendeesFile()`에는 다음 책임이 섞여 있다.

- CSV parse
- attendee normalize
- 기존 attendee 삭제
- 새 attendee 생성
- 휴면 상태 해제
- toast/UI 완료 처리

이를 분리한다.

권장 책임 구조:

```text
parseCsvFile()
readGoogleSheet()

normalizeAttendeeRows()

validateNormalizedAttendees()

replaceAttendeesSafely()

applyMemberWakeupSideEffects()
```

CSV와 Sheet가 서로 다른 member matching 규칙을 갖게 해서는 안 된다.

---

## 27. 동기화 의미

Google Sheet는 snapshot source다.

따라서 merge하지 않는다.

예:

```text
현재 attendee
A B C

Sheet
A B D
```

동기화 결과:

```text
A B D
```

이어야 한다.

---

## 28. 반복 동기화

동일 Sheet를 반복해서 불러와도 attendee가 누적되어서는 안 된다.

```text
Sheet 30명
→ sync
→ 30명

같은 Sheet
→ sync
→ 30명
```

Sheet에 한 명이 추가되었다면:

```text
31명
```

이 되어야 한다.

---

## 29. 안전한 replacement

Google API 호출 전에 현재 attendee를 삭제하지 않는다.

필수 순서:

```text
Google read
→ parsing
→ normalization
→ validation
→ 전체 replacement 준비
→ Firestore 적용
```

Google read 또는 validation 단계가 실패하면 기존 attendee는 그대로 유지한다.

---

## 30. Firestore 부분 실패 방지

다음 상태를 허용하지 않는다.

```text
기존 35명 삭제
→ 새 38명 중 18명 저장
→ 오류
→ 현재 명단 18명
```

atomic batch가 안전하게 가능한 규모라면 이를 사용한다.

그렇지 않다면 generation/staging 방식 등을 사용한다.

정확한 구현은 현재 데이터 규모와 Firestore batch 조건을 확인한 뒤 결정한다.

---

## 31. 수동 attendee 변경과 재동기화

Google sync 이후 운영진이 attendee를 수동으로 추가하거나 삭제할 수 있다.

그 후 다시 동기화하면 Google Sheet snapshot이 기준이므로 수동 변경은 사라진다.

따라서 수동 변경이 감지된 경우 재동기화 전 다음과 같은 경고를 권장한다.

```text
현재 명단에 수동 변경 사항이 있습니다.

다시 불러오면 Google Sheet 응답 기준으로 명단이 교체됩니다.

[취소] [다시 불러오기]
```

---

## 32. 0명 동기화

현재 attendee가 존재하는 상태에서 결과가 0명이라면 즉시 비우지 않는다.

```text
Sheet에서 가져올 참석자가 없습니다.

현재 34명의 참석자 명단을 비우시겠습니까?

[취소] [명단 비우기]
```

명시적 확인을 요구한다.

---

## 33. 일부 응답 오류

명확한 공백 row는 무시할 수 있다.

하지만 중요한 필드 오류 때문에 사람이 누락되는 경우 조용히 넘어가지 않는다.

예:

```text
38개 응답

정상: 36
확인 필요: 2

[문제 확인]
```

대량 누락 가능성이 있으면 import 자체를 중단하는 것을 기본 안전 정책으로 한다.

---

## 34. Form 생성의 원자성

Form 생성은 Google Drive/Form/Sheet 등 여러 외부 리소스를 만드는 작업이므로 완전한 database transaction으로 묶을 수 없다.

따라서 생성 작업에는 상태를 둔다.

예:

```text
creating
ready
failed
```

생성 중 실패 시:

- 완성되지 않은 설문을 정상 설문 목록에 표시하지 않는다.
- 생성된 외부 리소스 ID를 가능한 범위에서 기록한다.
- 안전한 경우 새로 만든 orphan Form/Sheet를 정리한다.
- 정리가 불확실하면 숨기지 말고 복구 가능한 실패 상태로 남긴다.

---

## 35. 중복 Form 생성 방지

사용자가 생성 버튼을 연속으로 두 번 눌러 Form이 두 개 만들어지는 것을 방지한다.

생성 중:

```text
[설문 생성 중...]
```

으로 버튼을 disable한다.

서버 측에도 request identifier/idempotency 보호를 둔다.

클라이언트 버튼 disable만으로 중복 생성을 방지한다고 가정하지 않는다.

---

## 36. 생성 후 자동 source 지정

Form 생성 성공 시 응답 Sheet를 조편성용 source 후보로 자동 연결한다.

단, 생성 즉시 현재 attendees를 동기화하지 않는다.

즉:

```text
Form 생성
→ Sheet source 지정
```

까지만 자동이다.

실제 attendee 교체는 사용자가:

```text
응답 불러오기
```

를 눌렀을 때만 발생한다.

---

## 37. 여러 정기모임 설문 관리

생성된 설문 기록을 최소한 최근 항목 기준으로 볼 수 있어야 한다.

예:

```text
최근 설문

5기 4회 정기모임
응답 37명
[링크 복사] [Form] [Sheet]

5기 3회 정기모임
[링크 복사] [Form] [Sheet]
```

복잡한 Form 관리 시스템은 만들지 않는다.

목적은 최근 생성된 설문의 링크와 연결된 Sheet를 다시 찾을 수 있게 하는 것이다.

---

## 38. 삭제 기능

V1에서 Google Form 자체 삭제 기능은 필수로 하지 않는다.

Avalon에서 삭제 버튼 하나가 Google Drive Form과 Sheet까지 영구 삭제하는 것은 위험하다.

필요하면 Avalon 기록에서 `숨기기/보관` 정도를 향후 추가한다.

Google 리소스 삭제는 Non-goal로 둔다.

---

## 39. 오류 유형

사용자 오류 메시지는 최소 다음으로 구분한다.

### Google 연결 없음
`Google 계정을 연결해주세요.`

### 재인증 필요
`Google 연결을 다시 확인해야 합니다.`

### 템플릿 접근 불가
`현재 계정으로 설문 템플릿에 접근할 수 없습니다.`

### 템플릿 삭제
`설정된 설문 템플릿을 찾을 수 없습니다.`

### Form 복제 실패
`설문을 생성하지 못했습니다.`

### Sheet 연결 실패
`설문은 생성했지만 응답 Sheet 연결을 완료하지 못했습니다.`

### Sheet 접근 불가
`현재 계정으로 이 응답 Sheet에 접근할 수 없습니다.`

### 데이터 형식 오류
`참석자 정보를 읽을 수 없는 응답이 있습니다.`

### Google 일시 장애
`Google 서비스에 일시적으로 연결할 수 없습니다.`

### Avalon 저장 실패
`응답은 읽었지만 Avalon 명단을 갱신하지 못했습니다.`

기술적인 API 오류 본문을 그대로 사용자에게 노출하지 않는다.

---

## 40. 현재 CSV fallback

기존 CSV 업로드는 유지한다.

최종적으로 다음 두 입력 경로를 지원한다.

```text
Google Sheet
[응답 불러오기]

또는

CSV
[파일 업로드]
```

어느 경로를 사용하더라도 최종 attendee 결과는 동일해야 한다.

---

## 41. 테스트 요구사항 — Google 연결

최소 다음을 테스트한다.

- 최초 계정 연결
- 브라우저 재접속 후 재사용
- access token 만료 후 refresh
- refresh token 취소 상태
- 재인증 성공
- 계정 변경 성공
- 계정 변경 실패 시 기존 연결 유지
- 연결 해제
- 다른 Avalon 로그인 계정에서 공용 Google 연결 사용 정책

---

## 42. 테스트 요구사항 — Form 생성

- 정상 템플릿 복제
- 질문 구조 보존
- 내부 Form 제목 정상 변경
- Drive 파일명 자동 처리
- 새 Spreadsheet 생성
- 새 Form과 새 Spreadsheet 연결
- 템플릿 Sheet 재사용하지 않음
- 응답 링크 정상 획득
- Form 게시/응답 가능 상태
- 생성 결과 Firestore 기록
- 연속 클릭 시 중복 Form 생성 방지
- 중간 실패 시 incomplete 설문이 정상 상태로 표시되지 않음

---

## 43. 테스트 요구사항 — Sheet 동기화

기존 Sheets 명세의 테스트를 유지한다.

특히:

- CSV와 Sheet 동일 fixture 결과 동일
- 반복 sync 중복 없음
- 30명 → 31명 정상 갱신
- 삭제된 응답 정상 반영
- Google read 실패 시 기존 attendees 유지
- parse 실패 시 기존 attendees 유지
- Firestore write 실패 시 partial list 방지
- 0명 import 확인
- 수동 수정 후 재동기화 경고
- 다른 Sheet override 정상 작동

---

## 44. End-to-End 핵심 시나리오

완료 후 다음 흐름이 가능해야 한다.

### 최초 설정

```text
Avalon 로그인
→ 설정
→ Google 계정 연결
→ 정기모임 Form 템플릿 선택
```

### 첫 모임 준비

```text
설문 관리
→ 설문 제목 입력
→ 생성
→ 응답 링크 복사
→ 공지
```

### 모임 당일

```text
조편성
→ 생성된 설문 확인
→ 응답 불러오기
→ attendee 갱신
→ 조편성
```

### 다음 모임

```text
설문 관리
→ 새 제목
→ 생성
→ 링크 복사
```

Google 계정 재인증 없음.

모임 당일:

```text
응답 불러오기
→ 조편성
```

이 흐름이 반복된다.

---

## 45. 구현 단계

### Phase 0 — 현재 조편성 코드 안정화

현재 진행 중인 조편성 비용/활동성 변경을 테스트까지 마무리한다.

Google 기능과 동시에 해당 알고리즘을 수정하지 않는다.

### Phase 1 — Google Backend / OAuth 기반

가장 먼저 구현한다.

- trusted backend 추가
- OAuth callback
- offline credential
- secure token storage
- Google connection status API
- reconnect
- disconnect
- account change

완료 조건:

> 브라우저를 닫고 다시 접속해도 서버가 연결된 Google 계정을 이용해 API 호출 가능.

### Phase 2 — Google 파일 선택

- Picker 또는 동등 UX
- Google Sheet 선택
- Google Form 선택
- 파일 유형 검증
- template 저장
- manual current Sheet 저장

완료 조건:

> URL/ID 입력 없이 Form과 Sheet 선택 가능.

### Phase 3 — Sheet Sync

- CSV importer 리팩터링
- common normalization
- Sheets reader
- tab handling
- safe replacement
- sync UI
- last-sync metadata

완료 조건:

> 기존 Form의 응답 Sheet를 Avalon에서 직접 불러와 조편성 가능.

이 단계까지만 완성돼도 CSV 다운로드 작업은 제거된다.

### Phase 4 — Form Template 설정

- 설정 Google integration panel
- 기본 정기모임 Form 선택
- template validation
- template change

완료 조건:

> 설정에서 현재 정기모임 템플릿 확인·변경 가능.

### Phase 5 — Form + Sheet 자동 생성

- template copy
- internal title update
- Spreadsheet create
- response destination 연결
- responder link 획득
- result persistence
- idempotency
- failure recovery

완료 조건:

> 제목 하나만 입력해서 Form + 응답 Sheet 생성 가능.

### Phase 6 — 자동 연결

- 생성된 survey와 Sheet Sync 연결
- generated response Sheet를 current source로 지정
- 조편성 화면에서 해당 설문 표시
- 다른 Sheet override

완료 조건:

> Form 생성 후 Google Drive에 다시 들어갈 필요 없이 모임 당일 응답을 바로 불러올 수 있음.

---

## 46. 확정 요구사항

다음은 제품 요구사항으로 확정한다.

- Google 계정을 장기간 한 번 연결해서 재사용한다.
- Avalon 로그인 계정과 Google Workspace 계정은 달라도 된다.
- URL 또는 ID 수동 입력을 기본 UX로 하지 않는다.
- 설정에서 정기모임 Form 템플릿을 지정한다.
- 템플릿을 간단히 변경할 수 있다.
- Avalon 내부 Google Form 질문 편집기는 만들지 않는다.
- 정기모임 설문 생성 시 사용자는 Form 내부 제목만 입력한다.
- Form Drive 파일명은 별도 입력받지 않는다.
- 템플릿을 복제하여 새 Form을 만든다.
- 각 새 Form에는 독립적인 새 Google Sheet를 연결한다.
- 응답 링크를 Avalon에서 바로 복사할 수 있다.
- 생성된 Form과 Sheet 관계를 Avalon이 기억한다.
- 생성된 Sheet를 조편성 Sheet Sync가 그대로 사용한다.
- Form 생성 직후 attendee를 자동 동기화하지 않는다.
- 동기화는 사용자가 명시적으로 실행한다.
- Sheet 선택과 attendee 변경은 별개다.
- 수동 Google Sheet 선택을 계속 지원한다.
- 매 모임 다른 Sheet를 사용할 수 있다.
- Google Sheet와 CSV는 동일 attendee pipeline을 사용한다.
- Sheet sync는 merge가 아닌 snapshot replacement다.
- 반복 sync로 attendee가 누적되지 않는다.
- Google API/parse 실패 시 기존 attendee를 보존한다.
- Firestore 부분 실패로 반쪽짜리 명단이 활성화되지 않게 한다.
- CSV 업로드는 fallback으로 유지한다.
- 민감한 장기 credential을 브라우저에 저장하지 않는다.
- Google 연동용 서버 계층을 둔다.
- 특정 Google 이메일/Form ID/Sheet ID를 코드에 하드코딩하지 않는다.

---

## 47. 제안 구현

다음은 제품 요구사항이 아니라 권장 구현이다.

- Firebase Functions 또는 Cloud Run 기반 Google backend
- OAuth Authorization Code + offline access
- 서버 측 refresh token 저장
- Picker 기반 Form/Sheet 선택
- `drive.file` 중심 최소 권한 검토
- Drive API를 통한 파일 metadata/copy
- Sheets API를 통한 응답 read
- Apps Script API executable을 통한 Form destination 설정
- Form 생성 작업을 서버 단일 command로 캡슐화
- 생성 request idempotency key
- generated survey state `creating / ready / failed`
- normalized attendee common import layer
- Firestore generation/staging 또는 atomic replacement
- Master Admin만 Google 연결·template 변경 허용
- 생성 Form Drive 이름과 내부 제목을 자동으로 동일하게 맞춤

---

## 48. 비범위

V1에서는 다음을 구현하지 않는다.

- Avalon 내부 Form 질문 편집기
- 질문 추가/삭제 UI
- 조건부 질문 편집
- Google Forms와 동일한 설문 제작 UI
- Form 응답 실시간 감시
- webhook
- polling
- 자동 attendee sync
- Google Sheet 편집기
- Sheet row 수정/삭제
- Google Drive 전체 파일 관리
- 여러 Sheet 자동 병합
- CSV 제거
- Google Form 응답을 Forms Responses API에서 직접 attendee로 가져오는 별도 pipeline
- Avalon에서 Google Form/Sheet 영구 삭제
- 복잡한 설문 아카이브 시스템
- 공지 채널 자동 전송

---

## 49. 남은 결정 사항

구현 전에 다음만 결정하면 된다.

1. Google 연결/템플릿 변경 권한을 Master Admin으로 제한할지
2. 새 설문 화면의 최종 메뉴명
3. 생성된 설문 목록을 몇 개까지 표시할지
4. 수동 Sheet용 지속 기본 Sheet 기능을 완전히 제거할지 선택 기능으로 남길지
5. 일부 row 오류 시 전체 중단 기준
6. 수동 attendee 변경 감지 방식
7. 동시 동기화 충돌 정책
8. OAuth token의 실제 secret storage 방식
9. Firebase Functions와 Cloud Run 중 서버 환경
10. Apps Script API executable 방식에 대한 사전 기술 검증 결과
11. 자동 생성 Form의 response tab을 식별·저장하는 구체적 방법
12. 생성 실패 후 orphan Form/Sheet cleanup 정책

---

## 50. 최종 완료 기준

다음 시나리오가 모두 가능하면 통합 기능 완료로 본다.

1. 운영진이 Google 계정을 한 번 연결한다.
2. 설정에서 정기모임 Form 템플릿을 선택한다.
3. 브라우저를 닫았다가 다시 열어도 연결이 유지된다.
4. 운영진이 정기모임 설문 생성 화면을 연다.
5. Form 내부 제목 하나만 입력한다.
6. 버튼 한 번으로 템플릿 복제본이 만들어진다.
7. 새 Form에 새로운 응답 Sheet가 자동 연결된다.
8. Avalon에서 응답 링크를 바로 복사할 수 있다.
9. Form과 Sheet 관계가 Avalon에 저장된다.
10. 며칠 뒤 조편성 화면을 연다.
11. 별도 Google 로그인 없이 해당 설문의 응답을 불러온다.
12. attendee 명단이 정확하게 교체된다.
13. 같은 Sheet를 다시 불러와도 중복되지 않는다.
14. 다음 모임에는 새 제목만 넣어 새 설문을 만든다.
15. 새 Sheet가 자동으로 새 설문과 연결된다.
16. 특별한 경우 운영진이 다른 기존 Sheet를 직접 선택할 수 있다.
17. Google API 장애 시 기존 attendee가 보존된다.
18. 필요하면 CSV 업로드를 사용해 동일한 결과를 만들 수 있다.
19. 질문이 바뀌면 Google Form 템플릿만 수정하거나 설정에서 다른 템플릿을 선택하면 된다.
20. 일반적인 매주 운영 과정에서 Google Drive에 직접 들어가야 하는 단계가 사라진다.
