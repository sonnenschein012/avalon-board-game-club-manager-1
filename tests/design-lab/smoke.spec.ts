import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, expect, devices } from '@playwright/test';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));

test.beforeEach(() => {
  execFileSync(process.execPath, ['scripts/reset-demo.mjs'], {
    cwd: projectRoot,
    stdio: 'inherit',
  });
});

test('관리자 UI는 Mock 데이터와 가짜 관리자 인증으로 열린다', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('System Status: LOCAL DEMO')).toBeVisible();
  await expect(page.getByText('로컬 데모 관리자')).toBeVisible();
  await expect(page.getByRole('heading', { name: '동아리원 관리' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '김민준 👑' })).toBeVisible();
});

test('공개 면접 링크는 관리자 인증 없이 공개 규칙으로 열린다', async ({ page }) => {
  await page.goto('/interview/demo-edit');

  await expect(page.getByText('김도윤 님')).toBeVisible();
  await expect(page.getByRole('heading', { name: '면접 가능한 시간을 모두 선택해주세요' })).toBeVisible();
  await expect(page.getByText('로컬 데모 관리자')).toHaveCount(0);
});

test('출석 부원 등록은 확인 전에는 저장하지 않고 선택한 정보로 등록한다', async ({ page, request }, testInfo) => {
  const root = 'http://127.0.0.1:8080/v1/projects/demo-avalon-manager/databases/(default)/documents';
  const headers = { Authorization: 'Bearer owner' }; // Fixed local emulator only.
  await page.goto('/attendance');
  await page.getByRole('button', { name: '+ 멤버 추가', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '출석 부원 등록' });
  await expect(dialog.getByLabel('성별')).toHaveValue('');
  await page.screenshot({ path: testInfo.outputPath('registration-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('registration-mobile.png') });
  const before = await (await request.get(`${root}/members?pageSize=100`, { headers })).json();
  expect(before.documents.some((item: { fields: { name: { stringValue: string } } }) => item.fields.name.stringValue === '문하늘')).toBe(false);
  await dialog.getByLabel('성별').selectOption('여');
  await dialog.getByLabel('가입 학기').fill('2026-2');
  await dialog.getByRole('button', { name: '부원 등록', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '+ 멤버 추가', exact: true })).toHaveCount(0);
  const after = await (await request.get(`${root}/members?pageSize=100`, { headers })).json();
  const member = after.documents.find((item: { fields: { name: { stringValue: string } } }) => item.fields.name.stringValue === '문하늘');
  expect(member.fields.gender.stringValue).toBe('여');
  expect(member.fields.semester.stringValue).toBe('2026-2');
  expect(member.fields.phone.stringValue).toBe('');
  expect(member.fields.preferredGenre).toHaveProperty('arrayValue');
});

test('미배정 상태를 보존하고 세션 삭제 후에도 모임 조 이름을 수정한다', async ({ page, request }) => {
  const root = 'http://127.0.0.1:8080/v1/projects/demo-avalon-manager/databases/(default)/documents';
  const headers = { Authorization: 'Bearer owner' };
  const absent = await request.patch(`${root}/attendees/attendee-09?updateMask.fieldPaths=status`, { headers, data: { fields: { status: { stringValue: '결석' } } } });
  expect(absent.ok()).toBe(true);
  await page.goto('/attendance');
  await expect(page.getByLabel('세션명')).toBeVisible();
  const date = await page.getByLabel('세션 날짜').inputValue();
  // Load a persisted one-person draft through the same reload path as an operator.
  await page.evaluate(date => {
    const key = Object.keys(sessionStorage).find(key => key.startsWith('avalon:attendance-draft:v1:'));
    if (!key) throw new Error('Attendance draft was not initialized');
    sessionStorage.setItem(key, JSON.stringify({ sessionName: '삭제 연결 회귀 모임', sessionDate: date,
      isSessionNameCustom: true, isAutoMode: false,
      groups: [{ id: 'regression-group', name: '회귀 조', memberIds: ['attendee-03'], gameIds: [], targetSize: 4, notes: '' }] }));
  }, date);
  await page.reload();
  await page.getByRole('button', { name: '오늘의 모임 시작' }).click();
  await expect(page).toHaveURL(/\/meeting$/);
  const status = async (id: string) => (await (await request.get(`${root}/attendees/${id}`, { headers })).json()).fields.status.stringValue;
  expect(await status('attendee-03')).toBe('편성됨');
  expect(await status('attendee-04')).toBe('대기');
  expect(await status('attendee-09')).toBe('결석');
  await page.goto('/sessions');
  const heading = page.getByRole('heading', { name: '삭제 연결 회귀 모임', exact: true });
  await heading.locator('..').locator('..').getByRole('button').nth(1).click();
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(heading).toHaveCount(0);
  await expect(page.getByText('세션 기록이 삭제되었습니다.', { exact: true })).toBeVisible();
  const planning = await (await request.get(`${root}/DailyPlannings/${date}`, { headers })).json();
  expect(planning.fields).not.toHaveProperty('sessionId');
  expect(planning.fields.groups.arrayValue.values).toHaveLength(1);
  await page.goto('/meeting');
  await page.getByRole('heading', { name: '회귀 조', exact: true }).click();
  const nameInput = page.getByLabel('조 이름', { exact: true });
  await nameInput.fill('삭제 후 변경한 조');
  await nameInput.press('Enter');
  await expect(page.getByRole('heading', { name: '삭제 후 변경한 조', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '삭제 후 변경한 조', exact: true })).toBeVisible();
});

test('모바일 공개 링크는 느린 응답에서도 열리고 한 번의 탭으로 선택된다', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
  await page.route('**/*', async route => {
    if (route.request().resourceType() === 'document' || route.request().resourceType() === 'script') {
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    await route.continue();
  });

  await page.goto('/interview/demo-edit');
  await expect(page.getByText('김도윤 님')).toBeVisible();
  await page.getByRole('button', { name: '수정하기' }).click();
  const firstSlot = page.locator('[data-slot-id]').first();
  await firstSlot.click();
  await expect(firstSlot).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await context.close();
});

test('두 운영진이 같은 면접 기록을 수정하면 한쪽 입력을 보존하고 충돌을 알린다', async ({ browser }) => {
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  await Promise.all([
    firstPage.goto('/interviews/demo-round'),
    secondPage.goto('/interviews/demo-round'),
  ]);
  await Promise.all([
    firstPage.getByRole('button', { name: '면접 진행' }).click(),
    secondPage.getByRole('button', { name: '면접 진행' }).click(),
  ]);
  const openWorkspace = async (page: typeof firstPage) => {
    const card = page.locator('article').filter({ hasText: '오수빈' });
    await card.getByRole('button', { name: '면접 열기' }).click();
    await expect(page.getByPlaceholder('질문 외 추가 메모, 후속 확인 사항 등을 자유롭게 기록하세요.')).toBeVisible();
  };
  await Promise.all([openWorkspace(firstPage), openWorkspace(secondPage)]);

  await Promise.all([
    firstPage.getByPlaceholder('질문 외 추가 메모, 후속 확인 사항 등을 자유롭게 기록하세요.').fill('첫 번째 운영진 입력'),
    secondPage.getByPlaceholder('질문 외 추가 메모, 후속 확인 사항 등을 자유롭게 기록하세요.').fill('두 번째 운영진 입력'),
  ]);

  await expect.poll(async () => (
    await firstPage.getByText('다른 운영진이 이 면접 기록을 수정했습니다.').count()
    + await secondPage.getByText('다른 운영진이 이 면접 기록을 수정했습니다.').count()
  )).toBeGreaterThan(0);

  const conflictedPage = await firstPage.getByText('다른 운영진이 이 면접 기록을 수정했습니다.').count() ? firstPage : secondPage;
  const preservedValue = await conflictedPage.getByPlaceholder('질문 외 추가 메모, 후속 확인 사항 등을 자유롭게 기록하세요.').inputValue();
  expect(['첫 번째 운영진 입력', '두 번째 운영진 입력']).toContain(preservedValue);

  await firstContext.close();
  await secondContext.close();
});
