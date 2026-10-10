import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
function emulatorData(action: 'seed' | 'read') {
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { initializeApp } from 'firebase-admin/app';
    import { getFirestore, Timestamp } from 'firebase-admin/firestore';
    if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.GCLOUD_PROJECT !== 'demo-avalon-manager') throw new Error('Local emulator only');
    initializeApp({ projectId: 'demo-avalon-manager' });
    const db = getFirestore();
    if (process.argv[1] === 'seed') {
      const batch = db.batch();
      for (const [id, nickname, studentId] of [['review-first', '별검증', '20230001'], ['review-second', '달검증', '20230002']]) {
        batch.set(db.collection('members').doc(id), { name: '동명이인검증', nickname, studentId, phone: '', gender: '기타', semester: '2023-1', preferredGenre: [], status: '활동', createdAt: Timestamp.now() });
      }
      await batch.commit();
      console.log('{}');
    } else {
      const attendees = (await db.collection('attendees').get()).docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sessions = (await db.collection('sessions').where('name', '==', '회원 연결 검증 모임').get()).docs.map(doc => doc.data());
      const plans = (await db.collection('DailyPlannings').where('name', '==', '회원 연결 검증 모임').get()).docs.map(doc => doc.data());
      console.log(JSON.stringify({ attendees, sessions, plans }));
    }
  `, action], {
    cwd: projectRoot, encoding: 'utf8',
    env: { ...process.env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', GCLOUD_PROJECT: 'demo-avalon-manager', GOOGLE_CLOUD_PROJECT: 'demo-avalon-manager', FIREBASE_CONFIG: '{"projectId":"demo-avalon-manager"}' },
  }));
}

test('selected namesakes survive Firestore reload and meeting/session conversion', async ({ page }) => {
  test.setTimeout(60_000);
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  execFileSync(process.execPath, ['scripts/reset-demo.mjs'], { cwd: projectRoot, stdio: 'inherit' });
  emulatorData('seed');
  await page.goto('/attendance');
  await expect(page.getByText('System Status: LOCAL DEMO')).toBeVisible();
  await page.getByRole('button', { name: '파일 업로드' }).click();
  await page.getByLabel('참석자 CSV 파일').setInputFiles({ name: 'review.csv', mimeType: 'text/csv', buffer: Buffer.from('이름,음료,뒤풀이\n23 동명이인검증,차,네\n23 동명이인검증,물,아니오\n26 미등록검증,차,네\n') });
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('2행 회원 선택').filter({ visible: true }).selectOption('review-second');
  await dialog.getByLabel('3행 회원 선택').filter({ visible: true }).selectOption('review-first');
  await dialog.getByRole('checkbox', { name: /미등록 상태로/ }).check();
  await dialog.getByRole('checkbox', { name: /기존 명단/ }).check();
  await dialog.getByRole('button', { name: '3명 명단 반영' }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  const pool = page.getByRole('region', { name: '미배정 출석 명단' });
  await expect(pool).toContainText('달검증');
  await expect(pool).toContainText('별검증');
  const saved = emulatorData('read');
  expect(saved.attendees.map((row: { memberId: string | null }) => row.memberId).sort()).toEqual(['review-first', 'review-second', null].sort());
  await expect(pool.locator('[data-attendee-id]').filter({ hasText: '미등록검증' })).toHaveAttribute('data-drag-enabled', 'false');
  await page.getByRole('button', { name: '신규 팀 추가' }).click();
  for (const nickname of ['달검증', '별검증']) {
    const card = pool.locator('[data-attendee-id]').filter({ hasText: nickname });
    await card.scrollIntoViewIfNeeded();
    const from = (await card.boundingBox())!;
    const to = (await page.locator('[data-group-dropzone]').first().boundingBox())!;
    await page.mouse.move(from.x + 20, from.y + 20);
    await page.mouse.down();
    await page.mouse.move(from.x + 30, from.y + 30, { steps: 5 });
    await page.mouse.move(to.x + 40, to.y + 40, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator('[data-group-dropzone]').first()).toContainText(nickname);
  }
  await page.getByLabel('세션명', { exact: true }).fill('회원 연결 검증 모임');
  await page.getByLabel('세션 날짜').fill('2026-09-15');
  await page.getByRole('button', { name: '오늘의 모임 시작' }).click();
  await expect.poll(() => emulatorData('read').sessions.length).toBe(1);
  const result = emulatorData('read');
  expect(result.sessions[0].groups[0].memberIds.sort()).toEqual(['review-first', 'review-second']);
  expect(result.plans[0].attendees.map((row: { memberId: string }) => row.memberId).sort()).toEqual(['review-first', 'review-second']);
});
