import { expect, test } from '@playwright/test';

const fixture = '/tests/scenario-lab/fixtures/settings-admin.html';
const email = 'administrator.with.a.very.long.email.address@example.com';

for (const width of [320, 390, 768, 1440]) {
  test(`admin deletion remains reachable with long emails at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
    await page.goto(fixture);
    const remove = page.getByRole('button', { name: `${email} 관리자 권한 삭제`, exact: true });
    await expect(remove).toBeVisible();
    const box = (await remove.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await remove.click();
    await expect(page.getByLabel('삭제 대상')).toHaveText(email);
    await page.screenshot({ path: `test-results/settings-admin-${width}.png` });
    await page.goto(`${fixture}?role=admin`);
    await expect(page.getByRole('button', { name: /관리자 권한 삭제/ })).toHaveCount(0);
  });
}
