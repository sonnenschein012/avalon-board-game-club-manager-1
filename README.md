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

- Node.js 22 이상 및 npm (CI는 Node.js 22 사용)
- Emulator Design Lab과 규칙 테스트는 Java 21 이상
- 운영/staging 데이터에 연결할 때만 Firebase 프로젝트 접근 권한 필요

### 설치 및 실행

```bash
git clone https://github.com/sonnenschein012/avalon-board-game-club-manager-1.git
cd avalon-board-game-club-manager-1
npm.cmd ci
npm.cmd run dev
```

개발 서버는 기본적으로 `http://localhost:3000`에서 실행됩니다.

`dev`는 운영 Firebase에 연결합니다. UI 확인은 아래 Scenario Lab을, 데이터 변경을 포함한 로컬 개발은 Emulator Design Lab을 사용하세요. macOS/Linux에서는 `npm.cmd` 대신 `npm`을 사용합니다.

## 개발 안내

- [개발 가이드](docs/development.md): 기능별 코드 위치, 데이터 흐름, 확장 방법과 검증 선택
- [운영·인수인계](docs/operations.md): 환경별 Firebase 대상, 배포, 데이터 보관과 접근 권한

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
npm.cmd ci
npm.cmd run demo:setup       # Windows 최초 1회: 로컬 Java 21 런타임 준비
npm.cmd run design-lab       # http://127.0.0.1:3000
npm.cmd run design-lab:test  # Emulator 기동부터 Chromium 검증까지 자동 실행
```

관리자 화면은 로컬 가짜 관리자로 자동 로그인합니다. `/interview/:token` 공개 링크는 로그인하지 않은 상태로 실행되어 실제 공개 Firestore 규칙을 그대로 사용합니다. 테스트 중 데이터를 다시 초기화하려면 Design Lab이 실행 중인 상태에서 `npm.cmd run demo:reset`을 실행하세요.

### Firebase 설정

Firebase 연결 설정은 `firebase-applet-config.json`에 포함되어 있습니다. 별도의 `.env` 파일은 필요하지 않습니다.

마스터 관리자는 Firestore `admins` 컬렉션에서 정규화한 이메일을 문서 ID로 사용하고 `role: "master"`를 지정합니다. 일반 관리자는 앱의 설정 페이지에서 추가할 수 있습니다. 초기 운영자에 대한 bootstrap master 예외가 클라이언트와 보안 규칙에 함께 남아 있으므로 계정 이관 시 [운영·인수인계](docs/operations.md)를 확인하세요.

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

staging은 운영과 분리된 `avalon-manager-staging` 프로젝트를 사용합니다. `npm.cmd run deploy:staging`은 이 프로젝트의 기본 데이터베이스에 Rules/인덱스를, 같은 이름의 Hosting site에 정적 앱을 순서대로 배포합니다. 정확한 대상과 운영 배포 명령은 [운영·인수인계](docs/operations.md)에 정리되어 있습니다.

일반 및 staging 빌드는 `index.html`만 진입점으로 사용합니다. 빌드 후 검증 스크립트가 `design.html`, Scenario fixture, 가짜 사용자 식별자가 `dist`에 들어오면 배포 전에 실패시킵니다.
