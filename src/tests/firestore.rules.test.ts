import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import * as fs from 'fs';
import { initializeTestEnvironment, RulesTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { setDoc, getDoc, doc, collection, getDocs, serverTimestamp } from 'firebase/firestore';

let testEnv: RulesTestEnvironment | undefined;

describe('Firestore Security Rules', () => {
  beforeAll(async () => {
    // Read the firestore.rules file
    const rules = fs.readFileSync('firestore.rules', 'utf8');
    try {
      testEnv = await initializeTestEnvironment({
        projectId: 'test-project-1234',
        firestore: { rules, host: '127.0.0.1', port: 8080 },
      });
    } catch (e) {
      console.warn('Firestore emulator is not running, failing test setup.', e);
      throw new Error('Firestore emulator must be running to test security rules.');
    }
  });

  afterAll(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  beforeEach(async () => {
    if (testEnv) await testEnv.clearFirestore();
  });

  it('비로그인 → 모든 컬렉션 거부', async () => {
    if (!testEnv) throw new Error('testEnv not initialized');
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDocs(collection(unauthedDb, 'members')));
    await assertFails(setDoc(doc(unauthedDb, 'members', 'm1'), { name: 'test' }));
  });

  it('일반 관리자 → members 및 attendees 읽기 쓰기 허용, admins 쓰기 거부', async () => {
    if (!testEnv) throw new Error('testEnv not initialized');
    // Setup regular admin (not master)
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'admins', 'regular@example.com'), { roles: ['admin'] });
      await setDoc(doc(db, 'members', 'm1'), { name: 'Member 1' });
    });

    const authedDb = testEnv.authenticatedContext('user-1', { email: 'regular@example.com' }).firestore();
    
    // members 읽기/쓰기 허용
    await assertSucceeds(getDoc(doc(authedDb, 'members', 'm1')));
    await assertSucceeds(setDoc(doc(authedDb, 'members', 'm2'), { name: 'Member 2' }));

    // attendees 쓰기 쓰키마 검증
    await assertSucceeds(setDoc(doc(authedDb, 'attendees', 'a1'), { name: 'Att', importDate: serverTimestamp(), status: '대기' }));
    await assertFails(setDoc(doc(authedDb, 'attendees', 'a2'), { name: 'Att2' })); // Missing status, importDate
    
    // admins 쓰기 거부 (마스터가 아니므로)
    await assertFails(setDoc(doc(authedDb, 'admins', 'newadmin@example.com'), {}));
  });

  it('마스터 관리자 → admins 쓰기 허용', async () => {
    if (!testEnv) throw new Error('testEnv not initialized');
    const masterDb = testEnv.authenticatedContext('master-user', { email: 'eunchangyang1@gmail.com' }).firestore();
    
    await assertSucceeds(setDoc(doc(masterDb, 'admins', 'newuser@example.com'), {}));
    await assertSucceeds(getDoc(doc(masterDb, 'admins', 'newuser@example.com')));
  });

  it('DailyPlannings createdAt 정상 생성 성공 및 클라이언트 임의 시간 거부', async () => {
    if (!testEnv) throw new Error('testEnv not initialized');
    // Setup regular admin
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'admins', 'regular@example.com'), { roles: ['admin'] });
    });

    const authedDb = testEnv.authenticatedContext('user-1', { email: 'regular@example.com' }).firestore();

    // 정상: serverTimestamp() 사용
    await assertSucceeds(
      setDoc(doc(authedDb, 'DailyPlannings', 'dp1'), {
        date: '2024-01-01',
        groups: [],
        createdAt: serverTimestamp()
      })
    );

    // 실패: 과거/미래 날짜 클라이언트 임의 삽입 불가
    await assertFails(
      setDoc(doc(authedDb, 'DailyPlannings', 'dp2'), {
        date: '2024-01-01',
        groups: [],
        createdAt: new Date('2020-01-01')
      })
    );
  });
});
