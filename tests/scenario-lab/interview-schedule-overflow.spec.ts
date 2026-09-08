import { expect, test, type Locator } from '@playwright/test';

const fixture = '/tests/scenario-lab/fixtures/interview-schedule-overflow.html';

test.beforeEach(async ({ page }) => {
  // Keep layout checks independent of external font availability and late font swaps.
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
});

async function expectInsideViewport(locator: Locator, height: number) {
  await expect(async () => {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height);
  }).toPass();
}

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 568, height: 320 }, { width: 1280, height: 600 }]) {
  for (const count of [0, 2, 20]) {
    test(`assignment ${count} schedules at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`${fixture}?count=${count}`);
      await page.getByRole('button', { name: '지정 모달 열기' }).click();
      const dialog = page.getByRole('dialog');
      const heading = dialog.getByRole('heading', { name: '면접 일정 지정' });
      const assign = dialog.getByRole('button', { name: '선택한 일정에 지정' });
      await expectInsideViewport(dialog, viewport.height);
      await expectInsideViewport(heading, viewport.height);
      await expectInsideViewport(assign, viewport.height);
      const initialButton = await assign.boundingBox();
      const initialHeading = await heading.boundingBox();
      if (count) {
        await dialog.locator('label').last().click();
        await expectInsideViewport(dialog.locator('label').last(), viewport.height);
        expect(await assign.boundingBox()).toEqual(initialButton);
        expect(await heading.boundingBox()).toEqual(initialHeading);
        if (count === 20) {
          expect(await dialog.locator('label').last().evaluate(element => element.parentElement!.scrollTop)).toBeGreaterThan(0);
          if (viewport.width === 390) await page.screenshot({ path: 'test-results/interview-assignment-mobile.png' });
        }
        await assign.click();
        await expect(page.getByLabel('결과')).toHaveText(`schedule-${count}`);
      } else {
        await expect(assign).toBeDisabled();
        await dialog.getByRole('button', { name: '새 면접 일정 만들기' }).click();
        await expect(page.getByLabel('결과')).toHaveText('create');
      }
      await expect(dialog).toHaveCount(0);
      await page.getByRole('button', { name: '지정 모달 열기' }).click();
      await dialog.getByRole('button', { name: '새 면접 일정 만들기' }).click();
      await expect(page.getByLabel('결과')).toHaveText('create');
      await expect(dialog).toHaveCount(0);
      await page.getByRole('button', { name: '지정 모달 열기' }).click();
      await dialog.getByRole('button', { name: '취소', exact: true }).click();
      await expect(dialog).toHaveCount(0);
    });
  }

  for (const position of ['top', 'bottom']) {
    test(`selector ${position} at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`${fixture}?position=${position}`);
      const trigger = page.locator('button[aria-haspopup="listbox"]');
      await trigger.click();
      const menu = page.getByRole('listbox');
      await expectInsideViewport(menu, viewport.height);
      const menuBox = (await menu.boundingBox())!;
      const triggerBox = (await trigger.boundingBox())!;
      if (position === 'bottom') expect(menuBox.y + menuBox.height).toBeLessThan(triggerBox.y);
      else expect(menuBox.y).toBeGreaterThan(triggerBox.y + triggerBox.height);
      await menu.getByRole('option').last().click();
      await expect(page.getByLabel('결과')).toHaveText('schedule-20');
      await expect(menu).toHaveCount(0);
      await trigger.click();
      await page.setViewportSize({ width: viewport.width, height: viewport.height + 100 });
      await expectInsideViewport(menu, viewport.height + 100);
      await page.evaluate(() => window.scrollBy(0, 40));
      await expectInsideViewport(menu, viewport.height + 100);
      await page.getByRole('button', { name: '지정 모달 열기' }).click();
      await expect(menu).toHaveCount(0);
    });
  }
}
