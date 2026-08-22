# Google Workspace 연동 운영 환경 설정 가이드 (Setup Guide)

본 문서는 아발론 보드게임 동아리 매니저의 **Google Workspace 연동 기능(Phase 1 ~ Phase 5)**을 실제 Firebase 및 Google Cloud Platform(GCP) 운영 환경에 배포하고 설정하는 단계별 표준 가이드입니다.

---

## 1. Google Cloud Platform (GCP) 프로젝트 설정

### 1.1 GCP 프로젝트 생성 및 API 활성화
1. [Google Cloud Console](https://console.cloud.google.com/)에 접속하여 프로젝트를 선택하거나 새로 생성합니다.
2. **API 및 서비스 > 라이브러리**로 이동하여 다음 5개 API를 검색하여 모두 **[사용 설정(Enable)]**합니다:
   - **Google Drive API**
   - **Google Forms API**
   - **Google Sheets API**
   - **Google Picker API**
   - **Google Apps Script API**

---

### 1.2 OAuth 동의 화면 구성 (OAuth Consent Screen)
1. **API 및 서비스 > OAuth 동의 화면**으로 이동합니다.
2. **User Type** 선택:
   - Google Workspace 조직 계정을 사용하는 경우: **[내부 (Internal)]** 권장
   - 일반 개인 Gmail을 사용하는 경우: **[외부 (External)]** 선택
3. **앱 정보 및 개발자 연락처** 입력 후 저장합니다.
4. **OAuth Scopes (범위) 추가**:
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/drive.file`
   *(현재 기능에서 사용하지 않는 `userinfo.profile`은 제외합니다.)*
5. ⚠️ **OAuth 게시 상태 (Publishing Status) 및 장기 Refresh Token 관리**:
   - User Type이 **외부 (External)**인 경우, 앱이 **테스트 (Testing)** 상태이면 발급된 Refresh Token이 **7일 후 자동 만료**됩니다.
   - 실제 운영 환경에서는 **[앱 게시 (Publish App)]**를 클릭하여 게시 상태를 **운영 (In Production)**으로 변경하거나, **내부 (Internal)** 앱으로 구성해야 무기한 장기 Refresh Token이 안정적으로 유지됩니다.

---

### 1.3 OAuth 2.0 클라이언트 ID 생성
1. **API 및 서비스 > 사용자 인증 정보 > 사용자 인증 정보 만들기 > OAuth 클라이언트 ID**를 클릭합니다.
2. 애플리케이션 유형: **[웹 애플리케이션 (Web application)]**
3. **승인된 자바스크립트 원본 (Authorized JavaScript origins)** 추가:
   - `https://<YOUR-FIREBASE-APP>.web.app`
   - `https://<YOUR-FIREBASE-APP>.firebaseapp.com`
   - `http://localhost:5173` (로컬 개발용)
4. **승인된 리디렉션 URI (Authorized redirect URIs)** 추가:
   - `https://<YOUR-FIREBASE-APP>.web.app`
   - `http://localhost:5173` (로컬 개발용)
5. 생성 완료 후 **클라이언트 ID(Client ID)**와 **클라이언트 보안 비밀(Client Secret)**을 복사하여 안전하게 보관합니다.

---

### 1.4 Google Picker API Key 생성 (프론트엔드 브라우저용)
1. **API 및 서비스 > 사용자 인증 정보 > 사용자 인증 정보 만들기 > API 키**를 클릭합니다.
2. 키 제한(Restriction) 설정:
   - **애플리케이션 제한사항**: **[웹사이트 (HTTP 리퍼러)]** 선택 후 서비스 도메인 등록
   - **API 제한사항**: **[Google Picker API]**만 선택하여 보안을 강화합니다.
3. 생성된 API 키를 복사합니다.

---

## 2. Google Apps Script API Executable 운영 설정 (Phase 5 Destination 바인딩)

Google Forms의 응답 스프레드시트 바인딩(`Form.setDestination`)을 서버에서 원격 실행하기 위한 Apps Script 설정입니다.

### 2.1 Apps Script 프로젝트 생성
1. [Google Apps Script 대시보드](https://script.google.com/)에서 **[새 프로젝트]**를 생성합니다.
2. 프로젝트 이름을 `Avalon-Form-Destination-Linker`로 지정합니다.
3. `Code.gs`에 다음 코드를 입력하고 저장합니다:
   ```javascript
   function linkFormToSpreadsheet(formId, spreadsheetId) {
     var form = FormApp.openById(formId);
     form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheetId);
     return { success: true };
   }
   ```

### 2.2 동일 GCP 프로젝트 연결
1. 좌측 메뉴 **프로젝트 설정(톱니바퀴 아이콘)**으로 이동합니다.
2. **Google Cloud Platform (GCP) 프로젝트** 항목에서 **[프로젝트 변경]**을 클릭합니다.
3. 위 1단계에서 사용한 GCP 프로젝트의 **프로젝트 번호(Project Number)**를 입력하고 연결합니다.

### 2.3 API Executable로 배포
1. 우측 상단 **[배포] > [새 배포]**를 클릭합니다.
2. 유형 선택(톱니바퀴): **[API 실행 파일 (API Executable)]** 선택.
3. 액세스 권한: **[나만]** 또는 **[모든 사용자]** 선택 후 **[배포]**를 클릭합니다.
4. 배포 완료 후 화면에 표시되는 **배포 ID / Script ID**를 복사합니다.

### 2.4 OAuth Scope 확인
Apps Script의 `appsscript.json` 매니페스트에 요구되는 scope(`https://www.googleapis.com/auth/forms` 등)가 포함되어 있는지 확인하고, 필요 시 GCP OAuth 동의 화면에 해당 scope를 일치시킵니다.

---

## 3. Firebase Cloud Functions 환경 변수 및 Secrets 설정

Firebase CLI를 통해 민감 정보를 Cloud Secret Manager에 안전하게 등록합니다.

```bash
# 1. Google OAuth Client ID 설정
firebase functions:secrets:set GOOGLE_CLIENT_ID
# 프롬프트에 GCP OAuth 클라이언트 ID 입력

# 2. Google OAuth Client Secret 설정
firebase functions:secrets:set GOOGLE_CLIENT_SECRET
# 프롬프트에 GCP OAuth 클라이언트 보안 비밀 입력

# 3. Google Apps Script ID 설정 (선택 사항)
firebase functions:secrets:set GOOGLE_APPS_SCRIPT_ID
# 프롬프트에 배포한 Apps Script ID 입력
```

---

## 4. 프론트엔드 환경 변수 설정 (`.env.production`)

프론트엔드 루트 디렉터리의 `.env.production` 파일에 다음 환경 변수를 입력하고 빌드/배포합니다:

```env
# Google Picker API Key (Browser용)
VITE_GOOGLE_PICKER_API_KEY=AIzaSy...YourPickerApiKey

# Google Cloud Project Number (Picker 연동용)
VITE_GOOGLE_PROJECT_NUMBER=123456789012
```

---

## 5. Master Admin 계정 시딩 및 최초 연결 절차

1. **마스터 관리자 권한 부여**:
   - Firebase Console Firestore Database로 이동합니다.
   - `admins/{adminEmail}` 문서(예: `admins/master@avalon.club`)를 생성하고 다음 필드를 설정합니다:
     ```json
     {
       "email": "master@avalon.club",
       "role": "master",
       "name": "총괄 관리자",
       "createdAt": "2026-08-22T00:00:00.000Z"
     }
     ```
2. **웹 앱 접속 및 Google 계정 연결**:
   - Master Admin 계정으로 웹 앱에 로그인합니다.
   - **환경 설정 (SettingsPage)** 화면으로 이동합니다.
   - 최상단 Google Workspace 연동 패널에서 **[Google 계정 연결]** 버튼을 클릭합니다.
   - Google 로그인 및 동의 화면을 완료하면 `google_workspace_public` 문서가 `connected` 상태로 자동 전환됩니다.
3. **기본 Form 템플릿 지정**:
   - [템플릿 변경] 버튼을 눌러 정기모임 설문 양식으로 사용할 원본 Google Form을 선택합니다.
