import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/tests/scenario-lab/fixtures/attendance-draft.html');
});

test('native card assignment, custom names, date and target size survive tab changes and reload', async ({ page }) => {
  const card = page.locator('[data-attendance-pool] [draggable="true"]').first();
  const attendeeId = await card.getAttribute('data-attendee-id');
  const target = page.locator('[data-group-dropzone="scenario-group-1"]');
  await card.dragTo(target);
  await expect(target.locator(`[data-attendee-id="${attendeeId}"]`)).toHaveCount(1);
  await page.getByLabel('세션명', { exact: true }).fill('계속 편성할 모임');
  await page.getByLabel('세션 날짜').fill('2026-09-12');
  await page.getByRole('button', { name: '자동 조편성', exact: true }).click();
  const group = page.locator('[data-group-id="scenario-group-1"]');
  await group.getByRole('spinbutton').fill('7');
  await group.getByText('1조', { exact: true }).click();
  await group.locator('input[type="text"]').fill('친구들');
  await group.locator('input[type="text"]').press('Enter');
  await page.getByRole('button', { name: '다른 탭', exact: true }).click();
  await expect(page.getByText('다른 페이지')).toBeVisible();
  await page.getByRole('button', { name: '일일 조편성 탭' }).click();
  for (let pass = 0; pass < 2; pass++) {
    await expect(page.getByLabel('세션명', { exact: true })).toHaveValue('계속 편성할 모임');
    await expect(page.getByLabel('세션 날짜')).toHaveValue('2026-09-12');
    await expect(group.getByRole('spinbutton')).toHaveValue('7');
    await expect(group.getByText('친구들', { exact: true })).toBeVisible();
    await expect(target.locator(`[data-attendee-id="${attendeeId}"]`)).toHaveCount(1);
    if (pass === 0) await page.reload();
  }
});

test('stationary native drag events scroll the page down and up, then stop on cancellation and drop', async ({ page }) => {
  const card = page.locator('[data-attendee-id][draggable="true"]').first();
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await card.dispatchEvent('dragstart', { dataTransfer: transfer });
  const edge = async (y: number) => page.evaluate(clientY => {
    document.elementFromPoint(1000, clientY)?.dispatchEvent(new DragEvent('dragover', { bubbles: true, clientX: 1000, clientY }));
  }, y);
  await edge(710);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(180);
  const down = await page.evaluate(() => window.scrollY);
  await edge(10);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(down - 80);
  await page.evaluate(() => document.dispatchEvent(new DragEvent('dragend', { bubbles: true })));
  const stopped = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.scrollY)).toBe(stopped);
  await edge(710);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.scrollY)).toBe(stopped);
  await card.dispatchEvent('dragstart', { dataTransfer: transfer });
  await edge(710);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(stopped + 40);
  await page.evaluate(() => document.dispatchEvent(new DragEvent('drop', { bubbles: true })));
  const dropped = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.scrollY)).toBe(dropped);
});

test('scrolls the nearest constrained group canvas and stops when the page is unmounted', async ({ page }) => {
  await page.addStyleTag({ content: '[data-attendance-canvas] { flex: none; height: 340px; }' });
  const canvas = page.locator('[data-attendance-canvas]');
  const bounds = (await canvas.boundingBox())!;
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await canvas.locator('[draggable="true"]').first().dispatchEvent('dragstart', { dataTransfer: transfer });
  await canvas.dispatchEvent('dragover', { clientX: bounds.x + 50, clientY: bounds.y + bounds.height - 8 });
  await expect.poll(() => canvas.evaluate(element => element.scrollTop)).toBeGreaterThan(100);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByRole('button', { name: '다른 탭', exact: true }).click();
  const stopped = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.scrollY)).toBe(stopped);
});

test('holding an actual mouse drag at the screen edge scrolls until released', async ({ page }) => {
  const card = page.locator('[data-attendance-pool] [draggable="true"]').first();
  await card.scrollIntoViewIfNeeded();
  const bounds = (await card.boundingBox())!;
  await page.mouse.move(bounds.x + 30, bounds.y + 20);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 40, bounds.y + 30, { steps: 5 });
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.move(1000, 710, { steps: 10 });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 100);
  const down = await page.evaluate(() => window.scrollY);
  await page.mouse.move(1000, 10, { steps: 10 });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(down - 50);
  await page.mouse.up();
  const stopped = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.scrollY)).toBe(stopped);
});
