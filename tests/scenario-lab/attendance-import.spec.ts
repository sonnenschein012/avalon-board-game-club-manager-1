import { expect, test, type Page } from '@playwright/test';

const csv = '타임스탬프,학번 및 이름,주문할 음료,개강총회에 참석하시나요?,뒤풀이에 참석하시나요?,희망사항\n'
  + 'date,23 업로드테스트,복숭아 아이스티,아니오,네,\n'
  + 'date,26 신규테스트,캐모마일,네,아니오,전략 게임\n';
const upload = (page: Page, content = csv) => page.getByLabel('참석자 CSV 파일').setInputFiles({ name: 'survey.csv', mimeType: 'text/csv', buffer: Buffer.from(content) });

test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await page.goto('/tests/scenario-lab/fixtures/attendance-draft.html');
});

for (const width of [390, 1280]) test(`reviews and replaces the roster at ${width}px without horizontal overflow`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 844 });
  const originalCount = await page.locator('[data-attendee-id]').count();
  await page.getByRole('button', { name: '파일 업로드' }).click();
  const dialog = page.getByRole('dialog', { name: '참석자 파일 등록' });
  await upload(page);
  await expect(dialog.getByLabel('음료', { exact: true })).toHaveValue('2');
  await expect(dialog.getByLabel('뒤풀이 참석 여부', { exact: true })).toHaveValue('4');
  await expect(dialog.getByText('뒤풀이 불참 1명', { exact: false })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '2명 명단 반영' })).toBeDisabled();
  expect(await page.locator('[data-attendee-id]').count()).toBe(originalCount);
  const checkbox = dialog.getByRole('checkbox', { name: /기존 명단/ });
  await checkbox.check();
  const button = dialog.getByRole('button', { name: '2명 명단 반영' });
  await expect(button).toBeEnabled();
  const box = (await button.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  if (width === 390) {
    await dialog.getByRole('article').first().scrollIntoViewIfNeeded();
    await expect(dialog.getByRole('article').first()).toBeVisible();
  } else await expect(dialog.getByRole('table')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`attendance-import-${width}.png`) });
  await button.click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('[data-attendee-id]')).toHaveCount(2);
  await expect(page.locator('[data-attendance-pool]')).toContainText('복숭아 아이스티');
  await expect(page.locator('[data-attendance-pool]')).toContainText('뒷풀이참석');
  await expect(page.locator('[data-group-dropzone]')).toHaveCount(0);
});

test('manual mapping handles changed questions and requires renewed confirmation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '파일 업로드' }).click();
  await upload(page, '이번 모임에서 마실 메뉴를 골라주세요 (매장 사정에 따라 변경될 수 있어요),성함을 알려주세요,파티 참석\n차,23 업로드테스트,네\n');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: '0명 명단 반영' })).toBeDisabled();
  await dialog.getByLabel('이름 또는 학번 및 이름', { exact: true }).selectOption('1');
  await dialog.getByLabel('음료', { exact: true }).selectOption('0');
  await dialog.getByLabel('뒤풀이 참석 여부', { exact: true }).selectOption('2');
  await dialog.getByRole('checkbox', { name: /기존 명단/ }).check();
  await expect(dialog.getByRole('button', { name: '1명 명단 반영' })).toBeEnabled();
  await dialog.getByLabel('뒤풀이 참석 여부', { exact: true }).selectOption('-2');
  await expect(dialog.getByRole('checkbox', { name: /기존 명단/ })).not.toBeChecked();
  await expect(dialog.getByRole('button', { name: '1명 명단 반영' })).toBeDisabled();
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: '파일 업로드' })).toBeFocused();
});

test('duplicate, unknown response and empty uploads preserve the roster; reopened dialog is fresh', async ({ page }) => {
  const originalCount = await page.locator('[data-attendee-id]').count();
  await page.getByRole('button', { name: '파일 업로드' }).click();
  await upload(page, '이름,음료,뒤풀이\n23 업로드테스트,차,아마도\n23 업로드테스트,차,네\n');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: '2명 명단 반영' })).toBeDisabled();
  await expect(dialog.getByRole('table')).toContainText('해석할 수 없습니다');
  await expect(dialog.getByRole('table')).toContainText('중복되었습니다');
  await upload(page, '이름,음료,뒤풀이\n');
  await expect(dialog.getByText('가져올 응답이 없습니다.', { exact: false })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '0명 명단 반영' })).toBeDisabled();
  await dialog.getByRole('button', { name: '취소' }).click();
  expect(await page.locator('[data-attendee-id]').count()).toBe(originalCount);
  await page.getByRole('button', { name: '파일 업로드' }).click();
  await expect(dialog.getByText('CSV 파일 선택', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('음료', { exact: true })).toHaveCount(0);
});
