# Avalon Club Manager

Avalon 보드게임 동아리의 회원, 게임, 정기 모임, 면접을 관리하는 웹 애플리케이션입니다.

## 주요 기능

- 회원과 보유 게임 관리
- CSV 출석 가져오기와 자동 조 편성
- 조별 게임 추천, 현장 모임 대시보드, 세션 기록
- 모임 아카이브와 통계 조회
- 신입 부원 면접의 가능시간 조사, 일정 배정, 평가와 선발 관리

## 기술 구성

- React 19, TypeScript, Vite, Tailwind CSS
- Firebase Authentication, Firestore, Hosting
- Vitest, Playwright, ESLint

## 시작하기

### 요구 사항

- Node.js 및 npm
- Firebase 프로젝트 접근 권한

### 설치 및 실행

```bash
git clone <repository-url>
cd avalon-board-game-club-manager
npm.cmd install
npm.cmd run dev
```

개발 서버는 기본적으로 `http://localhost:3000`에서 실행됩니다.

### Scenario Lab

Scenario Lab은 디자인과 반응형 UI를 빠르게 확인하는 로컬 전용 실행환경입니다. 별도 `design.html` 진입점에서 fixture와 가짜 master 사용자만 사용하며 Firebase Authentication과 Firestore에 연결하지 않습니다.

```bash
npm.cmd run scenario-lab       # http://127.0.0.1:5174/design.html
npm.cmd run scenario-lab:test  # canonical scenario와 390/768/1440px 검증
```

예: `/design.html#/members/crowded`, `/design.html#/interview/mobile-heavy`, `/design.html#/attendance/empty`. 상단의 Page, State, Viewport 선택기로 같은 상태를 즉시 전환할 수 있습니다.

### Emulator Design Lab

Emulator Design Lab은 실제 앱 UI와 hook/service를 그대로 사용하면서 Authentication과 Firestore를 로컬 Emulator에만 연결합니다. 실제 Firebase 프로젝트 접근 권한 없이 통합 동작과 보안 규칙을 검증할 수 있으며, 시작할 때 Mock 데이터를 새로 구성합니다.

```bash
npm.cmd install
npm.cmd run demo:setup       # 최초 1회: 로컬 Java 21 런타임 준비
npm.cmd run design-lab       # http://127.0.0.1:3000
npm.cmd run design-lab:test  # Emulator 기동부터 Chromium 검증까지 자동 실행
```

관리자 화면은 로컬 가짜 관리자로 자동 로그인합니다. `/interview/:token` 공개 링크는 로그인하지 않은 상태로 실행되어 실제 공개 Firestore 규칙을 그대로 사용합니다. 테스트 중 데이터를 다시 초기화하려면 Design Lab이 실행 중인 상태에서 `npm.cmd run demo:reset`을 실행하세요.

### Firebase 설정

Firebase 연결 설정은 `firebase-applet-config.json`에 포함되어 있습니다. 별도의 `.env` 파일은 필요하지 않습니다.

최초 마스터 관리자는 Firestore `admins` 컬렉션에서 이메일을 문서 ID로 생성하고 `role: "master"`를 지정합니다. 이후 일반 관리자는 앱의 설정 페이지에서 추가할 수 있습니다.

## 검증

```bash
npm.cmd run lint       # ESLint 검사
npm.cmd run typecheck  # TypeScript 검사
npm.cmd run test       # 단위 테스트
npm.cmd run test:rules # Firestore 보안 규칙 테스트
npm.cmd run build      # 프로덕션 빌드
npm.cmd run verify:production-bundle # Scenario Lab 코드의 운영 번들 혼입 검사
npm.cmd run check      # lint, typecheck, 단위 테스트, build 일괄 실행
```

Firestore 보안 규칙은 Emulator에서 검증합니다. Java 런타임을 준비한 뒤 실행하세요. Firebase CLI는 개발 의존성의 고정 버전을 사용합니다.

```bash
npm.cmd run test:rules
```

## 배포 전 확인

면접 기능을 변경하거나 배포할 때는 Hosting 빌드와 `firestore.rules`를 함께 검토하세요. 이 프로젝트는 기본 Firestore 데이터베이스가 아닌 named database를 사용합니다.

staging은 backend와 Hosting 대상이 분리되어 있습니다. `npm.cmd run deploy:staging`은 Rules를 `avalon-manager-staging`에, 정적 앱을 `avalon-manager-stg-260813` Hosting site에 순서대로 배포합니다.

일반 및 staging 빌드는 `index.html`만 진입점으로 사용합니다. 빌드 후 검증 스크립트가 `design.html`, Scenario fixture, 가짜 사용자 식별자가 `dist`에 들어오면 배포 전에 실패시킵니다.
