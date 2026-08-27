import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

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
