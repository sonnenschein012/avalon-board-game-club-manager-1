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
- Vitest, ESLint

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
npm.cmd run check      # lint, typecheck, 단위 테스트, build 일괄 실행
```

Firestore 보안 규칙은 Emulator에서 검증합니다. Java 런타임을 준비한 뒤 실행하세요. Firebase CLI는 명령에 고정된 버전으로 임시 실행됩니다.

```bash
npm.cmd run test:rules
```

## 배포 전 확인

면접 기능을 변경하거나 배포할 때는 Hosting 빌드와 `firestore.rules`를 함께 검토하세요. 이 프로젝트는 기본 Firestore 데이터베이스가 아닌 named database를 사용합니다.
