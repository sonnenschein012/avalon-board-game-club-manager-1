import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });
test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await page.goto('/tests/scenario-lab/fixtures/attendance-draft.html');
});

const preview = (page: Page) => page.locator('[data-attendance-drag-preview]');
const poolCard = (page: Page) => page.locator('[data-attendance-pool] [data-drag-enabled="true"]').first();
async function startDrag(page: Page, card: Locator) {
  await card.scrollIntoViewIfNeeded();
  const bounds = (await card.boundingBox())!;
  await page.mouse.move(bounds.x + 20, bounds.y + 20);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 30, bounds.y + 30, { steps: 5 });
  await expect(preview(page)).toBeVisible();
}
async function moveTo(page: Page, target: Locator) {
  const bounds = (await target.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { steps: 10 });
}

test('card assignment, custom names, date and target size survive tab changes and reload', async ({ page }) => {
  const card = poolCard(page);
  const attendeeId = await card.getAttribute('data-attendee-id');
  const target = page.locator('[data-group-dropzone="scenario-group-1"]');
  await startDrag(page, card);
  await moveTo(page, target);
  await page.mouse.up();
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

test('holding a card allows wheel scrolling both ways and dropping into a newly visible group', async ({ page }) => {
  const card = poolCard(page);
  const attendeeId = await card.getAttribute('data-attendee-id');
  await startDrag(page, card);
  await page.mouse.move(1000, 360, { steps: 10 });
  const overlayBefore = (await preview(page).boundingBox())!;
  await page.mouse.wheel(0, 350);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(250);
  await expect(preview(page)).toBeVisible();
  expect(Math.abs((await preview(page).boundingBox())!.y - overlayBefore.y)).toBeLessThan(2);
  const down = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, -120);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(down - 80);
  const target = page.locator('[data-group-dropzone="scenario-group-5"]');
  await moveTo(page, target);
  await page.mouse.up();
  await expect(preview(page)).toHaveCount(0);
  await expect(target.locator(`[data-attendee-id="${attendeeId}"]`)).toHaveCount(1);
  await expect(page.locator('[data-attendance-pool]').locator(`[data-attendee-id="${attendeeId}"]`)).toHaveCount(0);
});

test('stationary edge dragging scrolls both ways and stops on cancellation or release', async ({ page }) => {
  await startDrag(page, poolCard(page));
  await page.mouse.move(1000, 710, { steps: 10 });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(180);
  const down = await page.evaluate(() => window.scrollY);
  await page.mouse.move(1000, 10, { steps: 10 });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(down - 80);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(preview(page)).toHaveCount(0);
  const stopped = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.scrollY)).toBe(stopped);
  await startDrag(page, poolCard(page));
  await page.mouse.move(1000, 710, { steps: 10 });
  const before = await page.evaluate(() => window.scrollY);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 40);
  await page.mouse.up();
  await expect(preview(page)).toHaveCount(0);
  const released = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.scrollY)).toBe(released);
});

test('wheel and edge scrolling use the constrained canvas and stop on unmount', async ({ page }) => {
  await page.addStyleTag({ content: '[data-attendance-canvas] { flex: none; height: 340px; }' });
  const canvas = page.locator('[data-attendance-canvas]');
  const bounds = (await canvas.boundingBox())!;
  await startDrag(page, canvas.locator('[data-drag-enabled="true"]').first());
  await page.mouse.move(bounds.x + 50, bounds.y + bounds.height / 2, { steps: 10 });
  await page.mouse.wheel(0, 120);
  await expect.poll(() => canvas.evaluate(element => element.scrollTop)).toBeGreaterThan(80);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const before = await canvas.evaluate(element => element.scrollTop);
  await page.mouse.move(bounds.x + 50, bounds.y + bounds.height - 8, { steps: 10 });
  await expect.poll(() => canvas.evaluate(element => element.scrollTop)).toBeGreaterThan(before + 50);
  // Programmatic navigation verifies cleanup even while a mouse drag is held.
  await page.getByRole('button', { name: '다른 탭', exact: true }).evaluate(button => (button as HTMLButtonElement).click());
  await page.mouse.up();
  await expect(preview(page)).toHaveCount(0);
  const stopped = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.scrollY)).toBe(stopped);
});

test('moving between groups and back to the pool never duplicates a card; buttons still work', async ({ page }) => {
  const source = page.locator('[data-group-dropzone="scenario-group-1"] [data-attendee-id]').first();
  const attendeeId = await source.getAttribute('data-attendee-id');
  const target = page.locator('[data-group-dropzone="scenario-group-2"]');
  await startDrag(page, source);
  await moveTo(page, target);
  await page.mouse.up();
  await expect(target.locator(`[data-attendee-id="${attendeeId}"]`)).toHaveCount(1);
  await expect(page.locator(`[data-attendee-id="${attendeeId}"]`)).toHaveCount(1);
  await startDrag(page, target.locator(`[data-attendee-id="${attendeeId}"]`));
  const pool = page.locator('[data-attendance-pool]');
  await page.mouse.move((await pool.boundingBox())!.x + 40, 350, { steps: 10 });
  await page.mouse.up();
  await expect(pool.locator(`[data-attendee-id="${attendeeId}"]`)).toHaveCount(1);
  await pool.locator(`[data-attendee-id="${attendeeId}"]`).getByRole('button').click();
  await expect(page.locator(`[data-attendee-id="${attendeeId}"]`)).toHaveCount(0);
  await expect(preview(page)).toHaveCount(0);
});

test.describe('touch cards', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('long press renders only the card and can move it to another group', async ({ page }) => {
    const firstGroup = page.locator('[data-group-id="scenario-group-1"]');
    await firstGroup.evaluate(element => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 100));
    const card = firstGroup.locator('[data-attendee-id]').first();
    const attendeeId = await card.getAttribute('data-attendee-id');
    const cardText = (await card.textContent())!;
    const bounds = (await card.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + 15, y: bounds.y + 15 }] });
    await expect(preview(page)).toBeVisible();
    await expect(preview(page)).toHaveText(cardText);
    const previewBounds = (await preview(page).boundingBox())!;
    expect(Math.abs(previewBounds.width - bounds.width)).toBeLessThan(2);
    expect(Math.abs(previewBounds.height - bounds.height)).toBeLessThan(2);
    const target = page.locator('[data-group-dropzone="scenario-group-2"]');
    const targetBounds = (await target.boundingBox())!;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: targetBounds.x + 30, y: targetBounds.y + 30 }] });
    await page.screenshot({ path: 'test-results/attendance-mobile-drag.png' });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(preview(page)).toHaveCount(0);
    await expect(target.locator(`[data-attendee-id="${attendeeId}"]`)).toHaveCount(1);
    await cdp.detach();
  });

  test('an ordinary swipe on a card scrolls without picking it up', async ({ page }) => {
    const bounds = (await poolCard(page).boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const x = bounds.x + 30;
    const y = bounds.y + 35;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (const delta of [25, 60, 95, 130]) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - delta }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(40);
    await expect(preview(page)).toHaveCount(0);
    await cdp.detach();
  });
});
