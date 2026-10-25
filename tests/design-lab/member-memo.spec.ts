import { expect, test } from '@playwright/test';

test('mobile profile memo can be saved and reopened at 320px and 390px', async ({ page }, testInfo) => {
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: '상세 기록', exact: true }).filter({ visible: true }).first().click();
    await page.getByRole('button', { name: '메모 수정', exact: true }).click();
    const input = page.getByLabel('메모', { exact: true });
    const value = `모바일 메모 확인 ${width}px\n줄바꿈 저장 확인`;
    await input.fill(value);
    const save = page.getByRole('button', { name: '메모 저장', exact: true });
    await save.scrollIntoViewIfNeeded();
    const box = (await save.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(await input.evaluate(el => Number.parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    const panel = page.locator('div.fixed.inset-0.z-50');
    expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`member-memo-${width}.png`) });
    await save.click();
    await expect(input).toHaveCount(0);
    await expect(panel.getByText(value, { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: '상세 기록', exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByText(value, { exact: true })).toBeVisible();
  }
});
