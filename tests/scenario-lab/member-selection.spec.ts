import { expect, test } from '@playwright/test';

test('PC name and padding select once; action buttons and mobile names do not select', async ({ page }) => {
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await page.goto('/design.html#/members/default?viewport=1440');
  const preview = page.frameLocator('iframe[title="Scenario preview"]');
  const checkbox = preview.getByRole('checkbox', { name: / 선택$/ }).first();
  const target = preview.locator('label').filter({ has: preview.getByRole('checkbox', { name: / 선택$/ }) }).first();
  await target.getByRole('heading').click();
  await expect(checkbox).toBeChecked();
  const bounds = (await target.boundingBox())!;
  await target.click({ position: { x: bounds.width - 8, y: bounds.height / 2 } });
  await expect(checkbox).not.toBeChecked();
  await checkbox.click();
  await expect(checkbox).toBeChecked();
  await checkbox.press('Space');
  await expect(checkbox).not.toBeChecked();
  await preview.getByRole('button', { name: '상세 기록' }).filter({ visible: true }).first().click();
  await expect(checkbox).not.toBeChecked();
  const row = target.locator('..');
  await row.getByRole('button').nth(1).click();
  await expect(checkbox).not.toBeChecked();
  await expect(preview.getByRole('button', { name: '정보 수정', exact: true })).toBeVisible();

  await page.goto('/design.html#/members/default?viewport=390');
  const mobile = preview.getByRole('checkbox').filter({ visible: true }).first();
  await preview.getByRole('heading', { level: 3 }).filter({ visible: true }).first().click();
  await expect(mobile).not.toBeChecked();
  await mobile.click();
  await expect(mobile).toBeChecked();
});
