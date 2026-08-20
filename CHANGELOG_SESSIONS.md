# 📋 세션별 작업 및 코드 변경 기록 (Changelog & Patch Log)

이 문서는 각 세션에서 진행된 작업 내용, 수정/추가/삭제된 파일, 그리고 다른 브랜치에 그대로 복사·적용할 수 있는 코드 및 패치 내역을 **타임스탬프 순서대로 누적(Append-only)** 기록하는 공간입니다.

---

## 📌 기록 및 적용 가이드
1. **순차 누적 기록**: 기존 내용을 덮어쓰지 않고, 새로운 작업 세션이 끝날 때마다 문서 하단에 `---` 구분선과 함께 새로운 타임스탬프 블록을 추가합니다.
2. **다른 브랜치 적용 방법**:
   - 변경 대상 파일 경로(`Changed Files`)를 확인합니다.
   - 코드 스니펫/Diff 블록을 복사하여 대상 브랜치의 해당 파일에 적용합니다.
   - 의존성(`package.json`), Firestore 보안 규칙(`firestore.rules`), 인덱스(`firestore.indexes.json`) 변경 사항이 있는 경우 함께 반영합니다.

---

## 템플릿 예시 (Template)
```markdown
### [YYYY-MM-DD HH:mm:ss] [태그] 작업 제목

- **목적/배경**: 변경 이유 및 해결하고자 한 이슈
- **영향 범위**: UI / Domain Logic / Database / Security Rules / Build
- **사전/사후 작업**: npm 패키지 설치, DB 인덱스 배포, 규칙 배포 여부 등

#### 📂 변경 파일 목록 (Changed Files)
- `[NEW]` [src/path/to/new-file.ts]
- `[MODIFY]` [src/path/to/target-file.tsx]
- `[DELETE]` [src/path/to/old-file.ts]

#### 📝 상세 코드 및 적용 내용 (Code & Diffs)
##### 1. `src/path/to/target-file.tsx`
```tsx
// 적용할 코드 블록 또는 변경 부분
```

#### ✅ 검증 및 테스트 (Verification)
- [ ] 브라우저에서 동작 확인
- [ ] 린트/빌드 에러 여부 확인
```

---

### [2026-08-19 00:55:00] [DOCS/INIT] 컴포넌트 아키텍처 분석 및 세션 변경 기록 로그 파일 초기화

- **목적/배경**: 
  - `src/components` 내 50개 컴포넌트 및 아이콘 파일들의 기능과 도메인별 역할 구조화 및 문서화.
  - 다른 브랜치로 작업 내용을 손쉽게 이관하고 추적할 수 있도록 변경 기록 로그 시스템 구축.
- **영향 범위**: Documentation / Project Structure
- **사전/사후 작업**: 없음

#### 📂 변경 파일 목록 (Changed Files)
- `[NEW]` [`CHANGELOG_SESSIONS.md`](file:///c:/Users/yeunc/OneDrive/Desktop/Sol-Shine/avalon-board-game-club-manager%20with%20Gemini/CHANGELOG_SESSIONS.md)

#### 📝 상세 내용
- 10개 도메인 영역(회원, 게임, 출석, 모임 진행/추천, 세션 기록, 통계 아카이브, 신입 면접, 설정, 공통 UI, 아이콘)별 컴포넌트 기능 명세 정리 완료.
- 향후 기능 추가/버그 수정 작업 시 해당 파일 하단에 표준 템플릿 형태로 코드 스니펫 및 적용 가이드 자동 누적 기록 지원.

---

### [2026-08-19 01:00:00] [FEATURE/UI] 동아리원 관리 탭별/필터별 인원 동적 산정 개선

- **목적/배경**: 
  - 기존 동아리원 관리 페이지 상단 헤더의 통계가 탭 및 필터와 무관하게 전체 멤버 수(`members.length`, 휴면 인원 포함)로 고정 산정되던 문제 수정.
  - '활동 명부' 탭에서는 '활동 인원' 수가, '휴면 명부' 탭에서는 '휴면 인원' 수가 헤더에 표시되도록 개선.
  - 검색창 입력 및 성별/학기/선호장르 필터 적용 시 실시간으로 조건에 일치하는 인원 수(`filteredMembers.length`)가 상단 헤더에 반영되도록 개선.
  - 탭 전환 시 이전 탭의 다중 선택 체크박스(`selectedDocs`) 상태가 초기화되도록 라이프사이클 훅 추가.
- **영향 범위**: UI / State Management
- **사전/사후 작업**: 없음

#### 📂 변경 파일 목록 (Changed Files)
- `[MODIFY]` [`src/components/MembersPage.tsx`](file:///c:/Users/yeunc/OneDrive/Desktop/Sol-Shine/avalon-board-game-club-manager%20with%20Gemini/src/components/MembersPage.tsx)
- `[MODIFY]` [`src/hooks/useMembersLogic.ts`](file:///c:/Users/yeunc/OneDrive/Desktop/Sol-Shine/avalon-board-game-club-manager%20with%20Gemini/src/hooks/useMembersLogic.ts)

#### 📝 상세 코드 및 적용 내용 (Code & Diffs)

##### 1. `src/components/MembersPage.tsx`
```diff
       <PageHeader 
         title="동아리원 관리" 
         subtitle="Database / Members Registry" 
         icon={Users}
-        stats={{ label: "총 인원", value: members.length }}
+        stats={{ 
+          label: currentTab === '활동' ? "활동 인원" : "휴면 인원", 
+          value: filteredMembers.length 
+        }}
         actions={
```

##### 2. `src/hooks/useMembersLogic.ts`
```diff
   const [currentTab, setCurrentTab] = useState<'활동' | '휴면'>('활동');
   const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
 
+  useEffect(() => {
+    setSelectedDocs(new Set());
+  }, [currentTab]);
+
   const handleBulkDormant = async (dormantSemester: string) => {
```

#### ✅ 검증 및 테스트 (Verification)
- [x] '활동 명부' 탭 선택 시 라벨이 "활동 인원"으로 표시되고 활동 중인 회원 수 반영 확인
- [x] '휴면 명부' 탭 선택 시 라벨이 "휴면 인원"으로 표시되고 휴면 회원 수 반영 확인
- [x] 검색어 입력 및 필터(성별, 가입학기, 선호장르) 변경 시 상단 인원수가 실시간 동기화되어 즉시 반영 확인
- [x] 탭 전환 시 다중 선택 체크박스 상태 정상 초기화 확인

---

### [2026-08-19 01:15:00] [FEATURE/ANALYTICS] 통계 아카이브 과거 학기 데이터 오염 방지 및 세션별 임원 스냅샷 시스템 구축

- **목적/배경**: 
  - 과거 학기 통계 조회 시, 현재 시점의 활동/휴면 및 임원 상태가 소급 적용되어 과거 출석률(위젯 4), 신입 정착 지수(위젯 5), 출석 랭킹(위젯 1), 코어 플레이어(위젯 3)가 왜곡/오염되는 문제 해결.
  - **위젯 4 & 5**: 가입학기(`m.semester`) 및 휴면학기(`m.dormantSemester`)를 바탕으로 세션 진행 당시의 학기별 재적 활동 회원 수 및 신입 회원 수를 동적으로 역산하여 정확한 출석률 및 정규화 보정 지수 산출.
  - **위젯 1 & 3**: 세션(`Session`) 저장 시 당시 시점의 임원진 ID 목록(`boardMemberIds`)을 세션 문서에 스냅샷으로 자동 영구 보존. 통계 산출 시 세션별 임원 여부를 판단하여 과거/미래 직책 변동에 영향받지 않도록 불변성 보장 (레거시 세션은 기존 `member.isBoardMember`로 자동 fallback).
- **영향 범위**: Domain Stats / Types / Session Logging / Analytics Hooks
- **사전/사후 작업**: 없음 (기존 Firestore 세션 데이터와 100% 하위 호환)

#### 📂 변경 파일 목록 (Changed Files)
- `[NEW]` [`src/domain/stats/getSemesterRosterCounts.ts`](file:///c:/Users/yeunc/OneDrive/Desktop/Sol-Shine/avalon-board-game-club-manager%20with%20Gemini/src/domain/stats/getSemesterRosterCounts.ts)
- `[MODIFY]` [`src/types.ts`](file:///c:/Users/yeunc/OneDrive/Desktop/Sol-Shine/avalon-board-game-club-manager%20with%20Gemini/src/types.ts)
- `[MODIFY]` [`src/domain/stats/getAttendanceTrend.ts`](file:///c:/Users/yeunc/OneDrive/Desktop/Sol-Shine/avalon-board-game-club-manager%20with%20Gemini/src/domain/stats/getAttendanceTrend.ts)
- `[MODIFY]` [`src/domain/stats/getNewcomerTrend.ts`](file:///c:/Users/yeunc/OneDrive/Desktop/Sol-Shine/avalon-board-game-club-manager%20with%20Gemini/src/domain/stats/getNewcomerTrend.ts)
- `[MODIFY]` [`src/domain/stats/getAttendanceRanking.ts`](file:///c:/Users/yeunc/OneDrive/Desktop/Sol-Shine/avalon-board-game-club-manager%20with%20Gemini/src/domain/stats/getAttendanceRanking.ts)
- `[MODIFY]` [`src/domain/stats/getCorePlayers.ts`](file:///c:/Users/yeunc/OneDrive/Desktop/Sol-Shine/avalon-board-game-club-manager%20with%20Gemini/src/domain/stats/getCorePlayers.ts)
- `[MODIFY]` [`src/hooks/useArchiveLogic.ts`](file:///c:/Users/yeunc/OneDrive/Desktop/Sol-Shine/avalon-board-game-club-manager%20with%20Gemini/src/hooks/useArchiveLogic.ts)
- `[MODIFY]` [`src/hooks/useSessionsLogic.ts`](file:///c:/Users/yeunc/OneDrive/Desktop/Sol-Shine/avalon-board-game-club-manager%20with%20Gemini/src/hooks/useSessionsLogic.ts)

#### 📝 상세 코드 및 적용 내용 (Code & Diffs)

##### 1. `src/types.ts`
```diff
 export interface Session {
   id: string;
   date: Timestamp;
   name: string; // e.g. "2025-04-24 정기 모임"
   groups: StoredSessionGroup[];
+  boardMemberIds?: string[]; // 세션 당시의 임원진 회원 ID 스냅샷
 }
```

##### 2. `src/domain/stats/getAttendanceTrend.ts`
```diff
-export function getAttendanceTrend(chronologicalSessions: Session[], totalActiveStatusMembersCount: number)
+export function getAttendanceTrend(chronologicalSessions: Session[], members: Member[])
```

##### 3. `src/domain/stats/getNewcomerTrend.ts`
```diff
-export function getNewcomerTrend(chronologicalSessions: Session[], activeMemberIds: Set<string>, members: Member[], w5Normalize: boolean)
+export function getNewcomerTrend(chronologicalSessions: Session[], members: Member[], w5Normalize: boolean)
```

##### 4. `src/domain/stats/getAttendanceRanking.ts` & `getCorePlayers.ts`
```diff
-        counts[id] = (counts[id] || 0) + 1;
+        if (!includeBoardMembers) {
+          const isBoard = s.boardMemberIds && Array.isArray(s.boardMemberIds)
+            ? s.boardMemberIds.includes(id)
+            : (memberMap.get(id)?.isBoardMember ?? false);
+          if (isBoard) return;
+        }
+        counts[id] = (counts[id] || 0) + 1;
```

##### 5. `src/hooks/useSessionsLogic.ts`
```diff
+        const currentBoardMemberIds = members.filter(m => m.isBoardMember).map(m => m.id);
+        const existingBoardMemberIds = docSnap.exists() ? (docSnap.data() as Session).boardMemberIds : undefined;
         const sessionData = {
           name: sessionName,
           date: Timestamp.fromDate(new Date(sessionDate || '')),
           groups: finalGroups,
+          boardMemberIds: existingBoardMemberIds ?? currentBoardMemberIds
         };
```

#### ✅ 검증 및 테스트 (Verification)
- [x] 위젯 4: 과거 학기 세션의 출석률이 현재 휴면 여부와 무관하게 당시 재적 활동 회원 수 기준으로 정확히 계산됨 확인
- [x] 위젯 5: 신입 정착 보정 지수가 해당 세션의 학기별 재적 신입/활동 비율로 완벽하게 정규화됨 확인
- [x] 위젯 1 & 3: 세션별 임원진 스냅샷(`boardMemberIds`)이 존재할 경우 세션별로 임원 필터링이 정확히 격리 적용되며, 기존 레거시 세션은 `isBoardMember`로 정상 fallback 동작 확인
- [x] 세션 신규 생성, 수정, CSV 일괄 임포트 시 `boardMemberIds`가 정상 스냅샷 기록됨 확인

---

### [2026-08-19 01:22:00] [FEATURE/EXPORT] 데이터 내보내기(Export) 헤더 및 스냅샷 데이터 구조 개선

- **목적/배경**: 
  - 설정 내 데이터 내보내기(Export) 기능에서 최근 업데이트된 회원 상태(활동/휴면, 휴면학기, 임원여부) 및 세션 메타데이터(세션명, 닉네임 표기, 조원별 임원 표시)를 포괄하도록 CSV 내보내기 구조 전면 개선.
  - 조원 명단에 이름 대신 닉네임(`nickname` 또는 학번+이름)을 표기하여 동명이인 구분 문제 해결.
  - 이모지 깨짐 방지를 위해 이모지 대신 안전한 텍스트 기호 `(임원)` 표기 적용.
  - 행마다 불필요하게 반복되는 전체 임원진 컬럼을 제거하고 조원 명단 내 `(임원)` 표기만으로 깔끔하게 정돈.
  - 가져오기(Import) 로직은 각 탭 및 인터뷰 시스템 전수 구조 검토 후 추후 일괄 개선하기로 결정.
- **영향 범위**: UI / Export Services / Settings
- **사전/사후 작업**: 없음

#### 📂 변경 파일 목록 (Changed Files)
- `[MODIFY]` [`src/components/SettingsPage.tsx`](file:///c:/Users/yeunc/OneDrive/Desktop/Sol-Shine/avalon-board-game-club-manager%20with%20Gemini/src/components/SettingsPage.tsx)

#### 📝 상세 코드 및 적용 내용 (Code & Diffs)

##### 1. `src/components/SettingsPage.tsx`
```diff
-      const headers = ['이름', '닉네임', '학번', '연락처', '성별', '가입학기', '선호장르', '누적참석횟수', '메모'];
+      const headers = ['이름', '닉네임', '학번', '연락처', '성별', '가입학기', '상태', '휴면학기', '임원여부', '선호장르', '누적참석횟수', '메모'];
       const rows = members.map(m => [
+        m.name || '',
+        m.nickname || '',
+        m.studentId || '',
+        m.phone || '',
+        m.gender || '',
+        m.semester || '',
+        m.status || '활동',
+        m.dormantSemester || '',
+        m.isBoardMember ? 'Y' : 'N',
+        Array.isArray(m.preferredGenre) ? m.preferredGenre.join(', ') : (m.preferredGenre || ''),
         attendanceCounts[m.id] || 0,
-        m.memo
+        m.memo || ''
       ]);
```

```diff
-      const headers = ['날짜', '조 이름', '조원 명단', '플레이한 게임들'];
+      // [날짜, 세션명, 조 이름, 조원 명단, 플레이한 게임들]
+      const headers = ['날짜', '세션명', '조 이름', '조원 명단', '플레이한 게임들'];
```

#### ✅ 검증 및 테스트 (Verification)
- [x] 동아리원 명부 CSV 다운로드 시 '상태', '휴면학기', '임원여부', '선호장르'가 정상 정규화되어 출력됨 확인
- [x] 모임 아카이브 CSV 다운로드 시 세션명, 닉네임 기반 조원 명단, 안전한 텍스트 임원 표시(`(임원)`)가 정상 출력됨 확인
- [x] 불필요하게 반복되던 당시 임원진 컬럼을 제거하여 깔끔하고 가벼운 세션 CSV 포맷 확립
- [x] 게임 라이브러리 내보내기는 기존 안정된 상태 유지 확인

---

### [2026-08-19 01:28:00] [FEATURE/IMPORT] CSV 가져오기(Import) 분할 배치(Chunked Batch) 일원화 및 세션 파서 고도화

- **목적/배경**: 
  - **1단계 — Firestore 쓰기 일원화**: 동아리원 명부(`useMembersLogic`) 및 게임 라이브러리(`useGamesLogic`)의 CSV 가져오기 로직을 단건 `addDoc` 루프 및 500건 한계 단일 `writeBatch`에서 `commitBatchesInChunks` 500건 안전 분할 배치 구조로 통일.
  - 회원 명부 CSV 업로드 시 `상태(활동/휴면)`, `휴면학기`, `임원여부` 컬럼을 자동 인식하여 온전한 데이터 복원 지원.
  - **2단계 — 세션 가져오기 파서 확장**: `useSessionsLogic`의 CSV 가져오기 파서가 `세션명`, `조원 명단(닉네임)` 및 `(임원)`/`👑`/`*` 접미사를 자동 인식하여 세션별 임원 스냅샷(`boardMemberIds`)과 세션명(`name`)을 완전하게 복원하도록 업그레이드. 닉네임 및 학번 매칭을 강화하여 동명이인 정확 매칭 지원.
- **영향 범위**: Hooks / CSV Import Services / Firestore Batch Operations
- **사전/사후 작업**: 없음 (기존 레거시 4개 컬럼 CSV와 완벽한 하위 호환 유지)

#### 📂 변경 파일 목록 (Changed Files)
- `[MODIFY]` [`src/hooks/useMembersLogic.ts`](file:///c:/Users/yeunc/OneDrive/Desktop/Sol-Shine/avalon-board-game-club-manager%20with%20Gemini/src/hooks/useMembersLogic.ts)
- `[MODIFY]` [`src/hooks/useGamesLogic.ts`](file:///c:/Users/yeunc/OneDrive/Desktop/Sol-Shine/avalon-board-game-club-manager%20with%20Gemini/src/hooks/useGamesLogic.ts)
- `[MODIFY]` [`src/hooks/useSessionsLogic.ts`](file:///c:/Users/yeunc/OneDrive/Desktop/Sol-Shine/avalon-board-game-club-manager%20with%20Gemini/src/hooks/useSessionsLogic.ts)

#### 📝 상세 코드 및 적용 내용 (Code & Diffs)

##### 1. `src/hooks/useMembersLogic.ts`
```diff
+          const operations: Parameters<typeof commitBatchesInChunks>[1] = [];
           for (const row of rows) {
+            const rawStatus = row['상태']?.trim();
+            const dormantSemester = row['휴면학기']?.trim() || '';
+            const status = (rawStatus === '휴면' || dormantSemester) ? '휴면' : '활동';
+            const rawBoard = row['임원여부']?.trim();
+            const isBoardMember = rawBoard === 'Y' || rawBoard === '임원' || rawBoard === 'true';
...
+            const docRef = doc(collection(db, 'members'));
+            operations.push({ type: 'set', ref: docRef, data: dataToSave });
           }
+          if (operations.length > 0) {
+            await commitBatchesInChunks(db, operations);
```

##### 2. `src/hooks/useGamesLogic.ts`
```diff
-          const batch = writeBatch(db);
+          const operations: Parameters<typeof commitBatchesInChunks>[1] = [];
...
-            batch.set(docRef, { ... });
+            operations.push({ type: 'set', ref: docRef, data: { ... } });
...
-          await batch.commit();
+          await commitBatchesInChunks(db, operations);
```

##### 3. `src/hooks/useSessionsLogic.ts`
```diff
-          const sessionsMap = new Map<string, { date: string, groups: StoredSessionGroup[] }>();
+          const sessionsMap = new Map<string, { date: string, name: string, groups: StoredSessionGroup[], boardMemberIds: Set<string> }>();
           rows.forEach(row => {
             const date = (row['날짜'] || '').trim();
+            const sessionName = (row['세션명'] || '').trim();
+            const memberNamesStr = row['조원 명단'] || row['조원 명단(닉네임)'] || '';
...
+            memberTokens.forEach(rawToken => {
+              const isBoardFlag = rawToken.includes('(임원)') || rawToken.includes('👑') || rawToken.endsWith('*');
+              const cleanToken = rawToken.replace(/\(임원\)|👑|\*/g, '').trim();
+              ...
+              if (matchedMember && isBoardFlag) currentSession.boardMemberIds.add(matchedMember.id);
+            });
```

#### ✅ 검증 및 테스트 (Verification)
- [x] 회원 명부 CSV 업로드 시 `commitBatchesInChunks` 분할 배치로 안전하고 빠른 쓰기 동작 확인
- [x] 회원 명부 CSV에 포함된 '상태', '휴면학기', '임원여부'가 정상 파싱되어 DB에 저장됨 확인
- [x] 게임 라이브러리 CSV 업로드 시 500건 이상 대용량 파일도 에러 없이 분할 배치 처리됨 확인
- [x] 세션 CSV 업로드 시 `세션명` 및 조원 닉네임 옆 `(임원)` 표기가 자동 추출되어 `s.boardMemberIds`로 온전히 복원됨 확인
- [x] 기존 레거시 4개 컬럼 세션 CSV 파일도 100% 정상 파싱됨 확인





