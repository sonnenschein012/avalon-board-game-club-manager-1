import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import { initializeTestEnvironment, RulesTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

let testEnv: RulesTestEnvironment | undefined;

const REGULAR_ADMIN_EMAIL = 'regular@example.com';
const BOOTSTRAP_MASTER_EMAIL = 'eunchangyang1@gmail.com';
const ALLOWED_SLOT_A = '2026-08-25|18:00';
const ALLOWED_SLOT_B = '2026-08-25|18:30';

interface InterviewFixtureOptions {
  roundId?: string;
  token?: string;
  applicantId?: string;
  roundActive?: boolean;
  tokenActive?: boolean;
  status?: string;
  surveyOpensAt?: Date;
  surveyClosesAt?: Date;
}

async function seedRegularAdmin(email = REGULAR_ADMIN_EMAIL) {
  if (!testEnv) throw new Error('testEnv not initialized');
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'admins', email), {
      email,
      role: 'admin',
      createdAt: new Date(),
    });
  });
}

async function seedInterviewFixture(options: InterviewFixtureOptions = {}) {
  if (!testEnv) throw new Error('testEnv not initialized');

  const now = Date.now();
  const roundId = options.roundId ?? 'round-1';
  const token = options.token ?? 'secure-token-1';
  const applicantId = options.applicantId ?? 'applicant-1';

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'interviewRounds', roundId), {
      name: '2026-2 전화 면접',
      status: options.status ?? 'collecting',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(db, 'interviewPublicRounds', roundId), {
      name: '2026-2 전화 면접',
      surveyOpensAt: options.surveyOpensAt ?? new Date(now - 60 * 60 * 1000),
      surveyClosesAt: options.surveyClosesAt ?? new Date(now + 60 * 60 * 1000),
      interviewDates: ['2026-08-25'],
      dayStartTime: '18:00',
      dayEndTime: '20:00',
      availabilitySlotMinutes: 30,
      status: options.status ?? 'collecting',
      instructions: '가능한 시간을 모두 선택해 주세요.',
      allowedSlots: [ALLOWED_SLOT_A, ALLOWED_SLOT_B],
      active: options.roundActive ?? true,
      schemaVersion: 1,
      updatedAt: new Date(),
    });
    await setDoc(doc(db, 'interviewApplicants', applicantId), {
      roundId,
      applicantNumber: '001',
      name: '지원자',
      phone: '01000000000',
      accessToken: token,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(db, 'interviewAccess', token), {
      roundId,
      applicantId,
      displayName: '지원자',
      availability: [],
      submittedAt: null,
      updatedAt: null,
      responseUpdatedAt: null,
      active: options.tokenActive ?? true,
      createdAt: new Date(),
    });
  });

  return { roundId, token, applicantId };
}

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
      throw new Error('Firestore emulator must be running to test security rules.', { cause: e });
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
      await setDoc(doc(db, 'admins', 'regular@example.com'), { role: 'admin' });
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
    await assertSucceeds(getDoc(doc(authedDb, 'admins', 'regular@example.com')));
    await assertFails(getDoc(doc(authedDb, 'admins', 'other@example.com')));
    await assertFails(setDoc(doc(authedDb, 'admins', 'newadmin@example.com'), {}));
  });

  it('마스터 관리자 → admins 쓰기 허용', async () => {
    if (!testEnv) throw new Error('testEnv not initialized');
    const masterDb = testEnv.authenticatedContext('master-user', { email: BOOTSTRAP_MASTER_EMAIL }).firestore();

    await assertSucceeds(setDoc(doc(masterDb, 'admins', BOOTSTRAP_MASTER_EMAIL), { role: 'master' }));
    await assertSucceeds(setDoc(doc(masterDb, 'admins', 'newuser@example.com'), {}));
    await assertSucceeds(getDoc(doc(masterDb, 'admins', 'newuser@example.com')));
  });

  it('DailyPlannings createdAt 정상 생성 성공 및 클라이언트 임의 시간 거부', async () => {
    if (!testEnv) throw new Error('testEnv not initialized');
    // Setup regular admin
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'admins', 'regular@example.com'), { role: 'admin' });
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

  it('저장된 master role 관리자도 admins 컬렉션을 관리할 수 있다', async () => {
    if (!testEnv) throw new Error('testEnv not initialized');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'admins', 'master@example.com'), {
        email: 'master@example.com',
        role: 'master',
      });
    });

    const masterDb = testEnv.authenticatedContext('master-2', { email: 'master@example.com' }).firestore();
    await assertSucceeds(setDoc(doc(masterDb, 'admins', 'added@example.com'), { role: 'admin' }));
    await assertSucceeds(getDocs(collection(masterDb, 'admins')));
  });

  it('일반 관리자는 면접 비공개 데이터와 공개 컬렉션 전체를 관리할 수 있다', async () => {
    if (!testEnv) throw new Error('testEnv not initialized');
    await seedRegularAdmin();
    const { roundId, token, applicantId } = await seedInterviewFixture();
    const adminDb = testEnv.authenticatedContext('admin-user', { email: REGULAR_ADMIN_EMAIL }).firestore();

    await assertSucceeds(getDoc(doc(adminDb, 'interviewRounds', roundId)));
    await assertSucceeds(updateDoc(doc(adminDb, 'interviewRounds', roundId), { status: 'closed' }));
    await assertSucceeds(getDoc(doc(adminDb, 'interviewApplicants', applicantId)));
    await assertSucceeds(updateDoc(doc(adminDb, 'interviewApplicants', applicantId), { phone: '01011112222' }));
    await assertSucceeds(updateDoc(doc(adminDb, 'interviewApplicants', applicantId), {
      'reminderMessage.firstMarkedSentAt': serverTimestamp(),
      'reminderMessage.lastMarkedSentAt': serverTimestamp(),
    }));
    await assertSucceeds(getDocs(collection(adminDb, 'interviewPublicRounds')));
    await assertSucceeds(getDocs(collection(adminDb, 'interviewAccess')));
    await assertSucceeds(updateDoc(doc(adminDb, 'interviewAccess', token), { displayName: '관리자 수정' }));
    await assertSucceeds(setDoc(doc(adminDb, 'interviewAccess', 'admin-created-token'), { active: false }));
    await assertSucceeds(deleteDoc(doc(adminDb, 'interviewAccess', 'admin-created-token')));
    const lockRef = doc(adminDb, 'interviewAssignmentLocks', 'round__default__slot');
    await assertSucceeds(setDoc(lockRef, { roundId, applicantId, interviewerId: 'default' }));
    await assertSucceeds(getDoc(lockRef));
    await assertSucceeds(deleteDoc(lockRef));
    const noteRef = doc(adminDb, 'interviewNotes', `${roundId}__${applicantId}`);
    await assertSucceeds(setDoc(noteRef, {
      roundId,
      applicantId,
      interviewerId: 'default',
      interviewerName: '기본 면접관',
      generalNotes: '관리자 내부 기록',
      answers: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    await assertSucceeds(getDoc(noteRef));
  });

  it('로그인했지만 관리자가 아닌 사용자는 면접 비공개 데이터에 접근할 수 없다', async () => {
    if (!testEnv) throw new Error('testEnv not initialized');
    const { roundId, applicantId } = await seedInterviewFixture();
    const userDb = testEnv.authenticatedContext('ordinary-user', { email: 'ordinary@example.com' }).firestore();

    await assertFails(getDoc(doc(userDb, 'interviewRounds', roundId)));
    await assertFails(getDoc(doc(userDb, 'interviewApplicants', applicantId)));
    await assertFails(getDocs(collection(userDb, 'interviewRounds')));
    await assertFails(getDocs(collection(userDb, 'interviewApplicants')));
    await assertFails(getDocs(collection(userDb, 'interviewAssignmentLocks')));
    await assertFails(getDoc(doc(userDb, 'interviewNotes', `${roundId}__${applicantId}`)));
    await assertFails(setDoc(doc(userDb, 'interviewNotes', `${roundId}__${applicantId}`), { generalNotes: '볼 수 없어야 함' }));
    await assertFails(setDoc(doc(userDb, 'interviewRounds', 'new-round'), { name: '공격자가 만든 회차' }));

    // 기존 컬렉션의 signed-in read 정책은 이번 변경에서 그대로 유지한다.
    await assertSucceeds(getDocs(collection(userDb, 'members')));
    await assertFails(setDoc(doc(userDb, 'members', 'not-allowed'), { name: '쓰기 시도' }));
  });

  it('공개 사용자는 활성 public round와 token 문서를 정확한 경로로만 조회할 수 있다', async () => {
    if (!testEnv) throw new Error('testEnv not initialized');
    const { roundId, token } = await seedInterviewFixture();
    await seedInterviewFixture({
      roundId: 'inactive-round',
      token: 'inactive-token',
      applicantId: 'inactive-applicant',
      roundActive: false,
      tokenActive: false,
    });
    const publicDb = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(publicDb, 'interviewPublicRounds', roundId)));
    await assertSucceeds(getDoc(doc(publicDb, 'interviewAccess', token)));
    await assertFails(getDoc(doc(publicDb, 'interviewNotes', `${roundId}__applicant-1`)));
    await assertSucceeds(getDoc(doc(publicDb, 'interviewAccess', 'missing-token')));
    await assertFails(getDoc(doc(publicDb, 'interviewPublicRounds', 'inactive-round')));
    await assertFails(getDoc(doc(publicDb, 'interviewAccess', 'inactive-token')));
    await assertFails(getDocs(collection(publicDb, 'interviewPublicRounds')));
    await assertFails(getDocs(collection(publicDb, 'interviewAccess')));
    await assertFails(
      getDocs(query(collection(publicDb, 'interviewAccess'), where('applicantId', '==', 'applicant-1')))
    );
  });

  it('공개 사용자는 token 문서를 생성하거나 삭제할 수 없다', async () => {
    if (!testEnv) throw new Error('testEnv not initialized');
    const { token } = await seedInterviewFixture();
    const publicDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(setDoc(doc(publicDb, 'interviewAccess', 'forged-token'), {
      active: true,
      roundId: 'round-1',
    }));
    await assertFails(deleteDoc(doc(publicDb, 'interviewAccess', token)));
    await assertFails(setDoc(doc(publicDb, 'interviewPublicRounds', 'forged-round'), { active: true }));
  });

  it('공개 사용자는 조사 기간 중 허용된 availability를 서버 시각으로 최초 제출하고 다시 수정할 수 있다', async () => {
    if (!testEnv) throw new Error('testEnv not initialized');
    const { token } = await seedInterviewFixture();
    const publicDb = testEnv.unauthenticatedContext().firestore();
    const accessRef = doc(publicDb, 'interviewAccess', token);

    await assertSucceeds(updateDoc(accessRef, {
      availability: [ALLOWED_SLOT_A],
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      responseUpdatedAt: serverTimestamp(),
    }));

    const submittedSnapshot = await getDoc(accessRef);
    const submittedAt = submittedSnapshot.data()?.submittedAt;
    if (!submittedAt) throw new Error('submittedAt was not stored');

    await assertSucceeds(updateDoc(accessRef, {
      availability: [ALLOWED_SLOT_A, ALLOWED_SLOT_B],
      submittedAt,
      updatedAt: serverTimestamp(),
      responseUpdatedAt: serverTimestamp(),
    }));
  });

  it('공개 availability는 허용 slot의 중복 없는 부분집합이어야 한다', async () => {
    if (!testEnv) throw new Error('testEnv not initialized');
    const { token } = await seedInterviewFixture();
    const publicDb = testEnv.unauthenticatedContext().firestore();
    const accessRef = doc(publicDb, 'interviewAccess', token);

    await assertFails(updateDoc(accessRef, {
      availability: [ALLOWED_SLOT_A, ALLOWED_SLOT_A],
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(accessRef, {
      availability: ['2026-08-25|23:30'],
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(accessRef, {
      availability: ALLOWED_SLOT_A,
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
  });

  it('공개 응답은 submittedAt과 updatedAt에 클라이언트 임의 시각을 사용할 수 없다', async () => {
    if (!testEnv) throw new Error('testEnv not initialized');
    const { token } = await seedInterviewFixture();
    const publicDb = testEnv.unauthenticatedContext().firestore();
    const accessRef = doc(publicDb, 'interviewAccess', token);

    await assertFails(updateDoc(accessRef, {
      availability: [ALLOWED_SLOT_A],
      submittedAt: new Date('2020-01-01T00:00:00Z'),
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(accessRef, {
      availability: [ALLOWED_SLOT_A],
      submittedAt: serverTimestamp(),
      updatedAt: new Date('2020-01-01T00:00:00Z'),
    }));
    await assertFails(updateDoc(accessRef, {
      availability: [ALLOWED_SLOT_A],
      submittedAt: null,
      updatedAt: serverTimestamp(),
    }));

    await assertSucceeds(updateDoc(accessRef, {
      availability: [ALLOWED_SLOT_A],
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      responseUpdatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(accessRef, {
      availability: [ALLOWED_SLOT_B],
      submittedAt: new Date('2020-01-01T00:00:00Z'),
      updatedAt: serverTimestamp(),
    }));
  });

  it('공개 사용자는 token의 식별자와 관리자 전용 필드를 바꿀 수 없다', async () => {
    if (!testEnv) throw new Error('testEnv not initialized');
    const { token } = await seedInterviewFixture();
    const publicDb = testEnv.unauthenticatedContext().firestore();
    const accessRef = doc(publicDb, 'interviewAccess', token);
    const validResponse = {
      availability: [ALLOWED_SLOT_A],
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      responseUpdatedAt: serverTimestamp(),
    };

    await assertFails(updateDoc(accessRef, { ...validResponse, roundId: 'other-round' }));
    await assertFails(updateDoc(accessRef, { ...validResponse, applicantId: 'other-applicant' }));
    await assertFails(updateDoc(accessRef, { ...validResponse, displayName: '변조된 이름' }));
    await assertFails(updateDoc(accessRef, { ...validResponse, active: false }));
    await assertFails(updateDoc(accessRef, { ...validResponse, assignment: { startsAt: new Date() } }));
    await assertFails(updateDoc(accessRef, { ...validResponse, phone: '01099999999' }));
  });

  it('공개 응답은 상태값이 아니라 조사 시작·마감 시각으로만 허용한다', async () => {
    if (!testEnv) throw new Error('testEnv not initialized');
    const now = Date.now();
    await seedInterviewFixture({
      roundId: 'future-round',
      token: 'future-token',
      applicantId: 'future-applicant',
      surveyOpensAt: new Date(now + 60 * 60 * 1000),
      surveyClosesAt: new Date(now + 2 * 60 * 60 * 1000),
    });
    await seedInterviewFixture({
      roundId: 'past-round',
      token: 'past-token',
      applicantId: 'past-applicant',
      surveyOpensAt: new Date(now - 2 * 60 * 60 * 1000),
      surveyClosesAt: new Date(now - 60 * 60 * 1000),
    });
    await seedInterviewFixture({
      roundId: 'legacy-draft-round',
      token: 'legacy-draft-token',
      applicantId: 'legacy-draft-applicant',
      status: 'draft',
    });
    const publicDb = testEnv.unauthenticatedContext().firestore();

    for (const token of ['future-token', 'past-token']) {
      await assertFails(updateDoc(doc(publicDb, 'interviewAccess', token), {
        availability: [ALLOWED_SLOT_A],
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        responseUpdatedAt: serverTimestamp(),
      }));
    }

    // 기존 초안 상태 문서도 조사 기간 안이면 응답할 수 있다.
    await assertSucceeds(updateDoc(doc(publicDb, 'interviewAccess', 'legacy-draft-token'), {
      availability: [ALLOWED_SLOT_A],
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      responseUpdatedAt: serverTimestamp(),
    }));

    // 기간 밖에도 활성 token의 기존 응답 조회는 가능하지만 수정만 차단한다.
    await assertSucceeds(getDoc(doc(publicDb, 'interviewAccess', 'past-token')));
  });

  it('비활성 round 또는 비활성 token으로는 공개 응답을 수정할 수 없다', async () => {
    if (!testEnv) throw new Error('testEnv not initialized');
    await seedInterviewFixture({
      roundId: 'inactive-public-round',
      token: 'round-inactive-token',
      applicantId: 'round-inactive-applicant',
      roundActive: false,
    });
    await seedInterviewFixture({
      roundId: 'active-round',
      token: 'token-inactive',
      applicantId: 'token-inactive-applicant',
      tokenActive: false,
    });
    const publicDb = testEnv.unauthenticatedContext().firestore();

    for (const token of ['round-inactive-token', 'token-inactive']) {
      await assertFails(updateDoc(doc(publicDb, 'interviewAccess', token), {
        availability: [ALLOWED_SLOT_A],
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));
    }
  });

  it('공개 사용자는 자신의 token으로 일정 변경 요청만 만들 수 있다', async () => {
    if (!testEnv) throw new Error('testEnv not initialized');
    const { token, roundId, applicantId } = await seedInterviewFixture();
    const publicDb = testEnv.unauthenticatedContext().firestore();
    const batch = writeBatch(publicDb);
    batch.set(doc(publicDb, 'interviewChangeRequests', token), {
      roundId,
      applicantId,
      applicantName: '지원자',
      status: 'open',
      reason: '다른 시간 요청',
      requestedAt: serverTimestamp(),
      resolvedAt: null,
      resolvedBy: null,
    });
    batch.update(doc(publicDb, 'interviewAccess', token), { changeRequestStatus: 'open' });
    await assertSucceeds(batch.commit());

    await assertFails(setDoc(doc(publicDb, 'interviewChangeRequests', 'forged-token'), {
      roundId,
      applicantId,
      applicantName: '지원자',
      status: 'open',
      reason: '위조 요청',
      requestedAt: serverTimestamp(),
      resolvedAt: null,
      resolvedBy: null,
    }));
    await assertFails(updateDoc(doc(publicDb, 'interviewAccess', token), { assignmentSummary: null }));
  });
});
