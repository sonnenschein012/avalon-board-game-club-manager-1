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
