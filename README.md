# Avalon Club Manager

Avalon 보드게임 동아리를 위한 종합 운영 및 관리 웹 애플리케이션입니다. 

> [!NOTE]  
> 이 문서는 애플리케이션 사용법 및 실행 방법을 안내합니다.
> 상세한 아키텍처, 디렉터리 설계, 파일 명명 규칙 등은 [ARCHITECTURE.md](./ARCHITECTURE.md)를 참조하세요.

## 🚀 프로젝트 개요
Avalon 보드게임 동아리의 원활한 현장 모임 진행과 장기적인 데이터 관리를 위해 개발되었습니다. 
현장 모임을 위한 출석 임포트와 조 편성부터 모임 대시보드 운영과 전후 데이터 통계까지 동아리 매니지먼트에 필요한 프로세스를 통합 제공합니다.

## ⚙️ 운영 흐름 
1. **멤버 등록**: 신규 동아리원 정보 등록 (`/`)
2. **게임 등록**: 보유 중인 보드게임 제원 등록 (`/games`)
3. **출석 CSV 임포트**: 폼으로 조사한 참석자 명단을 업로드 (`/attendance` -> 출석 임포트)
4. **자동 조 편성**: 몬테카를로 기반 지역 탐색 알고리즘이 성비/만남이력 등을 고려하여 조를 생성 (`/attendance`)
5. **추천 게임 확인**: 각 조별 인원/경험자수/인기 등을 종합하여 맞춤 게임 및 사유 확인 (`/meeting` 대시보드 안)
6. **모임 보드 운영**: 타이머, 조별 공지 현황 등을 전체 화면 빔프로젝터 등에 띄움 (`/meeting` -> 보드 모드)
7. **세션 기록 저장**: 모임이 끝나면 진행했던 게임과 인원을 영구 기록 (`/sessions` 로 전송)
8. **아카이브 확인**: 학기별 통계, 인기 게임 차트, 멤버간 MMI(다양성 지수) 등 조회 (`/archive`, `/sessions`)

## 📋 핵심 주요 기능
- **자동 조 편성 알고리즘**: 과거 세션 기록, 성비, 학번 분산도를 고려한 휴리스틱 편성을 브라우저상에서 즉시 산출.
- **게임 맞춤 추천 & 사유 표시**: 현장 구성원의 인원수 및 플레이 이력(Firebase 기반)을 실시간으로 분석해 '인원 적합, 숨겨진 꿀잼, 모두 미경험' 등의 추천 사유와 함께 게임 3종씩 제시.
- **데이터 시각화**: Firebase Firestore에 누적된 출석, 게임 배정 데이터를 기반으로 대시보드형 시각화(Recharts) 제공.

## 🛠 기술 스택
- **프론트엔드:** React 19, Vite, TypeScript, Tailwind CSS, react-router-dom, motion
- **백엔드/데이터베이스:** Firebase (Auth, Firestore)
- **로직:** 몬테카를로 기반 커스텀 최적화 알고리즘 기반 자동배정 및 규칙 기반 로컬 게임 추천 엔진 

## 📦 데이터베이스 컬렉션 구성 (Firestore)
- `admins`: 시스템 접근 가능한 일반 관리자 이메일 목록
- `members`: 전체 동아리원 정보
- `games`: 동아리 보유 게임 정보
- `attendees`: 특정 일자(모임일)에 참석 응답한 임시 대기 명단
- `DailyPlannings`: 조 편성중이거나 진행 중인 현장 모임의 임시 저장 상태 데이터
- `sessions`: 완전히 종료되어 아카이브된 과거 정기 모임 기록

## 💻 로컬 개발 환경 설정

1. **레포지토리 클론 및 설치**
   ```bash
   git clone <repository-url>
   cd avalon-board-game-club-manager
   npm install
   ```

2. **Firebase 설정**
   Firebase 연결 정보는 `firebase-applet-config.json`에 이미 포함되어 있어 별도의 `.env` 환경 변수 설정이 필요 없습니다.
   - 최고(마스터) 관리자는 Firestore `admins` 컬렉션에 관리자 이메일을 문서 ID로 만들고 `role: "master"` 필드를 지정하여 부여합니다.
   - 이후 일반 관리자는 앱의 **설정** 페이지에서 이메일로 추가할 수 있습니다.

3. **로컬 실행**
   ```bash
   npm run dev
   ```

## 🧪 검증 및 테스트 가이드

### 타입스크립트 및 린트 검증
코드 수정 후, 빌드 무결성을 확인하기 위해서는 아래 스크립트를 사용합니다.
```bash
npm run typecheck  # 타입스크립트 에러 검색
npm run lint       # ESLint 규칙 검사
npm run check      # lint, typecheck, test, build 일괄 검증
```

### Firestore Security Rules 테스트
앱의 보안 규칙(`firestore.rules`)은 테스트 환경의 Emulator를 통해서만 제대로 검증할 수 있습니다. 
Firestore Emulator를 실행하지 않은 상태에서는 테스트가 강제 실패합니다.

> 사전 준비물: [Firebase CLI](https://firebase.google.com/docs/cli)(`npm i -g firebase-tools`)와 Java 런타임(Emulator 구동용)이 필요합니다.

**실행 방법:**
```bash
# Emulator를 띄우면서 동시에 Vitest Rules 테스트 스크립트를 수행합니다.
npm run test:rules
```
