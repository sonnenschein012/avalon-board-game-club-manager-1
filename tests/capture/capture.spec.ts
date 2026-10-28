import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Keep the real image renderer; isolate tests from third-party font availability.
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
});

for (const { tab, button, label } of [
  { tab: '공지 이미지 생성', button: '공지 이미지 추출', label: 'notice' },
  { tab: '음료 주문 리스트', button: '음료 리스트 이미지 추출', label: 'drinks' },
]) {
  test(`${label}: saves a populated PNG without navigating away`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', async dialog => {
      errors.push(dialog.message());
      await dialog.dismiss();
    });
    await page.goto('/tests/capture/harness.html');
    await page.getByRole('button', { name: tab, exact: true }).click();
    await expect(page.getByRole('heading', { name: '원탁 1조', exact: true })).toBeVisible();
    await expect(page.locator('#card-capture-group-1 li')).toHaveCount(3);
    // Wait for the existing entrance animation before capturing the actual board.
    await expect.poll(() => page.locator('#card-capture-group-1').evaluate(el => {
      const matrix = new DOMMatrix(getComputedStyle(el).transform);
      return [Math.round(matrix.m41), Math.round(matrix.m42)];
    })).toEqual([245, 165]);
    const date = '2026-10-28';
    const originalURL = page.url();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: button, exact: true }).click();
    const download = await downloadPromise;
    expect(download.url()).toMatch(/^blob:/);
    expect(download.suggestedFilename()).toBe(`AVALON_Notice_${date}.png`);
    const file = testInfo.outputPath(`${label}.png`);
    await download.saveAs(file);
    expect(await download.failure()).toBeNull();
    const png = await readFile(file);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(png.readUInt32BE(16)).toBe(3200);
    expect(png.readUInt32BE(20)).toBeGreaterThanOrEqual(1600);

    // Decode the downloaded bytes, not a DOM screenshot or a mocked renderer result.
    const content = await page.evaluate(async base64 => {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Downloaded PNG could not be decoded'));
        image.src = `data:image/png;base64,${base64}`;
      });
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 80;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let colored = 0;
      let light = 0;
      for (let i = 0; i < data.length; i += 4) {
        const [red = 0, green = 0, blue = 0, alpha = 0] = data.slice(i, i + 4);
        if (alpha > 0 && Math.max(red, green, blue) - Math.min(red, green, blue) > 40) colored++;
        if (alpha > 0 && Math.min(red, green, blue) > 180) light++;
      }
      return { colored: colored / (160 * 80), light: light / (160 * 80) };
    }, png.toString('base64'));
    expect(content.colored).toBeGreaterThan(0.1);
    expect(content.light).toBeGreaterThan(0.001);
    await expect(page).toHaveURL(originalURL);
    await expect(page.getByRole('button', { name: button, exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    await testInfo.attach(`${label}-download`, { path: file, contentType: 'image/png' });
  });
}
