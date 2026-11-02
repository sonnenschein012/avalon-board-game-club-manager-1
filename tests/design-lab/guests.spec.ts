import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
function readData() {
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { initializeApp } from 'firebase-admin/app';
    import { getFirestore } from 'firebase-admin/firestore';
    if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.GCLOUD_PROJECT !== 'demo-avalon-manager') throw new Error('Local emulator only');
    initializeApp({ projectId: 'demo-avalon-manager' });
    const db = getFirestore();
    const data = {};
    for (const name of ['attendees', 'members', 'sessions', 'DailyPlannings']) data[name] = (await db.collection(name).get()).docs.map(d => ({ ...d.data(), id: d.id }));
    console.log(JSON.stringify(data));
  `], { cwd: projectRoot, encoding: 'utf8', env: { ...process.env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', GCLOUD_PROJECT: 'demo-avalon-manager', GOOGLE_CLOUD_PROJECT: 'demo-avalon-manager' } }));
}

test('Google Form guests survive operating snapshots and become anonymous session counts', async ({ page }) => {
  test.setTimeout(90_000);
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  execFileSync(process.execPath, ['scripts/reset-demo.mjs'], { cwd: projectRoot, stdio: 'inherit' });
  const before = readData();
  const host = before.members.find((m: { status: string }) => m.status !== '휴면');
  await page.goto('/attendance');
  await expect(page.getByText('System Status: LOCAL DEMO')).toBeVisible();
  await page.getByRole('button', { name: '파일 업로드' }).click();
  await page.getByLabel('참석자 CSV 파일').setInputFiles({ name: 'guests.csv', mimeType: 'text/csv', buffer: Buffer.from(`이름,음료,뒤풀이,게스트 동반 여부,게스트 이름,게스트 희망 음료\n${host.name},물,아니오,예,초대게스트검증,차\n`) });
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: /기존 명단/ }).check();
  await dialog.getByRole('button', { name: '2명 명단 반영' }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  const pool = page.getByRole('region', { name: '미배정 출석 명단' });
  await expect(pool).toContainText('초대게스트검증');
  await expect(pool.locator('[data-attendee-id]').filter({ hasText: '초대게스트검증' })).toHaveAttribute('data-drag-enabled', 'true');
  const imported = readData();
  const guest = imported.attendees.find((a: { participantType?: string }) => a.participantType === 'guest');
  const inviter = imported.attendees.find((a: { id: string }) => a.id === guest.invitedByAttendeeId);
  expect(inviter.memberId).toBe(host.id);
  expect(guest.memberId).toBeNull();
  expect(imported.members.length).toBe(before.members.length);
  // An existing invitation does not remove the host from the selector.
  await page.getByRole('button', { name: '+ 명단 추가' }).click();
  await page.getByRole('radio', { name: '게스트', exact: true }).check();
  await expect(page.getByLabel('초대한 동아리원').locator(`option[value="${inviter.id}"]`)).toHaveCount(1);
  await page.locator('form').locator('..').getByRole('button').first().click();
  await page.getByRole('button', { name: '신규 팀 추가' }).click();
  for (const id of [inviter.id, guest.id]) {
    const card = pool.locator(`[data-attendee-id="${id}"]`);
    const target = page.locator('[data-group-dropzone]').first();
    await card.scrollIntoViewIfNeeded();
    const from = (await card.boundingBox())!, to = (await target.boundingBox())!;
    await page.mouse.move(from.x + 20, from.y + 20); await page.mouse.down();
    await page.mouse.move(from.x + 30, from.y + 30, { steps: 5 });
    await page.mouse.move(to.x + 40, to.y + 40, { steps: 10 }); await page.mouse.up();
    await expect(target.locator(`[data-attendee-id="${id}"]`)).toBeVisible();
  }
  await page.getByLabel('세션명', { exact: true }).fill('게스트 익명화 검증');
  await page.getByLabel('세션 날짜').fill('2026-10-02');
  await page.getByRole('button', { name: '오늘의 모임 시작' }).click();
  await expect.poll(() => readData().sessions.filter((s: { name: string }) => s.name === '게스트 익명화 검증').length, { timeout: 30_000 }).toBe(1);
  const saved = readData();
  const session = saved.sessions.find((s: { name: string }) => s.name === '게스트 익명화 검증');
  expect(session.groups[0]).toMatchObject({ memberIds: [host.id], guestCount: 1 });
  expect(JSON.stringify(session)).not.toContain('초대게스트검증');
  expect(JSON.stringify(session)).not.toContain('invitedByAttendeeId');
  const planning = saved.DailyPlannings.find((s: { name: string }) => s.name === '게스트 익명화 검증');
  expect(planning.attendees.find((a: { id: string }) => a.id === guest.id).name).toBe('초대게스트검증');
  await page.waitForURL('**/meeting');
  await page.locator('input[type="date"]').fill('2026-10-02');
  await expect(page.getByText('초대게스트검증', { exact: true })).toBeVisible();
  await expect(page.getByText('초대게스트검증 · 게스트', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '공지 이미지 생성', exact: true }).click();
  await expect(page.locator('li').filter({ hasText: /^초대게스트검증$/ })).toBeVisible();
  await expect(page.getByText('초대게스트검증 (게스트)', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '음료 주문 리스트', exact: true }).click();
  await expect(page.locator('li').filter({ hasText: /^차$/ })).toBeVisible();
});


test('manual guest addition uses an existing inviter and never creates a member', async ({ page }) => {
  test.setTimeout(60_000);
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  execFileSync(process.execPath, ['scripts/reset-demo.mjs'], { cwd: projectRoot, stdio: 'inherit' });
  const before = readData();
  await page.goto('/attendance');
  await page.getByRole('button', { name: '+ 명단 추가' }).click();
  const form = page.locator('form');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(form.getByRole('radio', { name: '동아리원', exact: true })).toBeChecked();
  await page.screenshot({ path: 'test-results/manual-add-member-segment.png', animations: 'disabled' });
  await form.getByRole('radio', { name: '게스트', exact: true }).check();
  await form.getByRole('radio', { name: '게스트', exact: true }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(form.getByRole('radio', { name: '동아리원', exact: true })).toBeChecked();
  await page.keyboard.press('ArrowRight');
  await expect(form.getByRole('radio', { name: '게스트', exact: true })).toBeChecked();
  await page.screenshot({ path: 'test-results/manual-add-guest-segment.png', animations: 'disabled' });
  await form.locator('select').last().selectOption('attendee-01');
  await form.getByPlaceholder('홍길동').fill('수동초대검증');
  await expect(form.getByPlaceholder('음료명 입력')).not.toHaveAttribute('required');
  await expect(form.getByPlaceholder('예: 25')).not.toBeVisible();
  await expect(form.getByText('뒤풀이 참석', { exact: true })).not.toBeVisible();
  await form.getByRole('button', { name: '추가하기', exact: true }).click();
  await expect(form).not.toBeVisible();
  await expect(page.getByRole('region', { name: '미배정 출석 명단' })).toContainText('수동초대검증');
  const saved = readData();
  expect(saved.members.length).toBe(before.members.length);
  const guest = saved.attendees.find((a: { name: string }) => a.name === '수동초대검증');
  expect(guest).toMatchObject({ participantType: 'guest', memberId: null, invitedByAttendeeId: 'attendee-01', drink: '' });
  expect(guest).not.toHaveProperty('studentIdPrefix');
  // Repeat the same name and inviter: identity comes from a fresh attendee ID.
  await page.getByRole('button', { name: '+ 명단 추가' }).click();
  await form.getByRole('radio', { name: '게스트', exact: true }).check();
  await form.getByLabel('초대한 동아리원').selectOption('attendee-01');
  await form.getByPlaceholder('홍길동').fill('수동초대검증');
  await form.getByRole('button', { name: '추가하기', exact: true }).click();
  await expect(form).not.toBeVisible();
  const multiple = readData();
  const invited = multiple.attendees.filter((a: { invitedByAttendeeId?: string }) => a.invitedByAttendeeId === 'attendee-01');
  expect(invited).toHaveLength(2);
  expect(new Set(invited.map((a: { id: string }) => a.id)).size).toBe(2);
  expect(invited.map((a: { name: string }) => a.name)).toEqual(['수동초대검증', '수동초대검증']);
  expect(multiple.members.length).toBe(before.members.length);

});


test('manual sessions persist repeated guest tags across groups and restore them for editing', async ({ page }) => {
  test.setTimeout(60_000);
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  execFileSync(process.execPath, ['scripts/reset-demo.mjs'], { cwd: projectRoot, stdio: 'inherit' });
  await page.goto('/sessions');
  await page.getByRole('button', { name: '신규 세션 생성' }).click();
  await page.getByLabel('세션 명칭', { exact: true }).fill('수동 게스트 기록 검증');
  await page.getByRole('button', { name: '신규 팀(조) 추가' }).click();
  await page.getByRole('button', { name: '신규 팀(조) 추가' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'TEAM 1에 게스트 추가', exact: true }).click();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'TEAM 2에 게스트 추가', exact: true }).click();
  await expect(page.getByRole('button', { name: '게스트 제거', exact: true })).toHaveCount(5);
  await page.getByRole('button', { name: '게스트 제거', exact: true }).first().click();
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByLabel('세션 명칭', { exact: true })).not.toBeVisible();
  await expect(page.getByText('게스트', { exact: true })).toHaveCount(4);
  await expect(page.getByText(/게스트 ×/)).toHaveCount(0);
  const saved = readData().sessions.find((s: { name: string }) => s.name === '수동 게스트 기록 검증');
  expect(saved.groups.map((g: { guestCount: number }) => g.guestCount)).toEqual([2, 2]);
  expect(saved.groups.flatMap((g: { memberIds: string[] }) => g.memberIds)).toEqual([]);
  await page.getByRole('button', { name: '세션 수정: 수동 게스트 기록 검증', exact: true }).click();
  await expect(page.getByRole('button', { name: '게스트 제거', exact: true })).toHaveCount(4);
  await page.getByRole('button', { name: 'TEAM 1에 게스트 추가', exact: true }).click();
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await expect(page.getByLabel('세션 명칭', { exact: true })).not.toBeVisible();
  expect(readData().sessions.find((s: { name: string }) => s.name === '수동 게스트 기록 검증').groups.map((g: { guestCount: number }) => g.guestCount)).toEqual([3, 2]);
});
