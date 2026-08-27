import { expect, test, type Page } from '@playwright/test';

const scenarios = [
  ['members', 'default'], ['members', 'empty'], ['members', 'crowded'], ['members', 'long-names'],
  ['interview', 'default'], ['interview', 'mobile-heavy'], ['interview', 'change-needed'],
  ['attendance', 'default'], ['attendance', 'empty'], ['attendance', 'crowded'],
] as const;

function recordBackendRequests(page: Page) {
  const requests: string[] = [];
  page.on('request', request => {
    const url = request.url();
    if (/firestore\.googleapis\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com|firebaseio\.com|firebaseapp\.com/i.test(url)) {
      requests.push(url);
    }
  });
  return requests;
}

function recordForbiddenProductionModules(page: Page) {
  const requests: string[] = [];
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (/\/src\/(?:lib\/firebase|services\/|hooks\/use(?:Members|Attendance|Firestore))/.test(pathname)) requests.push(pathname);
  });
  return requests;
}

test('모든 canonical scenario URL이 fixture 화면으로 직접 열린다', async ({ page }) => {
  const backendRequests = recordBackendRequests(page);
  const forbiddenProductionModules = recordForbiddenProductionModules(page);
  for (const [scenarioPage, state] of scenarios) {
    await page.goto(`/design.html#/${scenarioPage}/${state}?viewport=1440`);
    const preview = page.frameLocator('iframe[title="Scenario preview"]');
    await expect(preview.locator(`[data-scenario-page="${scenarioPage}"]`)).toBeVisible();
    await expect(preview.locator('[data-scenario-sentinel="AVALON_SCENARIO_LAB"]')).toBeVisible();
  }
  expect(backendRequests).toEqual([]);
  expect(forbiddenProductionModules).toEqual([]);
});

test('Page, State, Viewport 선택은 URL 및 실제 iframe viewport와 동기화된다', async ({ page }) => {
  await page.goto('/design.html#/members/default?viewport=1440');
  await page.getByLabel('Scenario page').selectOption('interview');
  await expect(page).toHaveURL(/#\/interview\/default\?viewport=1440$/);
  await page.getByLabel('Scenario state').selectOption('mobile-heavy');
  await expect(page).toHaveURL(/#\/interview\/mobile-heavy\?viewport=1440$/);
  await page.getByLabel('Scenario viewport').selectOption('390');
  await expect(page).toHaveURL(/viewport=390$/);
  await expect(page.locator('iframe[title="Scenario preview"]')).toHaveCSS('width', '390px');
  await expect(page.frameLocator('iframe[title="Scenario preview"]').locator('[data-scenario-page="interview"]')).toBeVisible();
});

for (const viewport of [390, 768, 1440] as const) {
  test(`${viewport}px preview가 해당 너비에서 렌더링된다`, async ({ page }) => {
    await page.goto(`/design.html#/members/long-names?viewport=${viewport}`);
    const frame = page.locator('iframe[title="Scenario preview"]');
    await expect(frame).toHaveCSS('width', `${viewport}px`);
    await expect(page.frameLocator('iframe[title="Scenario preview"]').getByRole('heading', { name: /아주긴이름을가진아발론회원/ }).first()).toBeVisible();
  });
}

test('fixture 상호작용은 메모리에서만 바뀌고 새로고침하면 복원된다', async ({ page }) => {
  const backendRequests = recordBackendRequests(page);
  await page.goto('/design.html#/members/default?viewport=768');
  const preview = page.frameLocator('iframe[title="Scenario preview"]');
  const search = preview.getByPlaceholder('이름, 학번, 닉네임 검색...');
  await search.fill('존재하지않는회원');
  await expect(preview.getByText('검색 결과가 없습니다.')).toBeVisible();
  await page.locator('iframe[title="Scenario preview"]').evaluate((element: HTMLIFrameElement) => element.contentWindow?.location.reload());
  await expect(preview.getByRole('heading', { name: /김민준/ }).first()).toBeVisible();
  expect(backendRequests).toEqual([]);
});

test('모바일 대용량 면접 목록은 나눠 렌더링하고 버튼 입력을 유지한다', async ({ page }) => {
  await page.goto('/design.html#/interview/mobile-heavy?viewport=390');
  const preview = page.frameLocator('iframe[title="Scenario preview"]');

  await expect(preview.getByText('180', { exact: true })).toBeVisible();
  const loadMore = preview.getByRole('button', { name: /면접 일정 더 보기/ });
  await expect(loadMore).toContainText('60/177건');
  await loadMore.click();
  await expect(loadMore).toContainText('120/177건');

  const autoAssign = preview.getByRole('button', { name: '자동배정', exact: true }).first();
  await autoAssign.click();
  await expect(preview.getByText('배정 대기 지원자').locator('..').locator('..').getByText('A-178')).toHaveCount(0);
});

test('느린 정적 리소스 응답에서도 모바일 면접 화면이 한 번의 입력으로 열린다', async ({ page }) => {
  await page.route('**/*', async route => {
    if (route.request().resourceType() === 'document' || route.request().resourceType() === 'script') {
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    await route.continue();
  });

  await page.goto('/design.html#/interview/change-needed?viewport=390');
  const preview = page.frameLocator('iframe[title="Scenario preview"]');
  await expect(preview.getByRole('heading', { name: '전체 면접 시간표' })).toBeVisible();
  await preview.getByRole('button', { name: '자동배정' }).first().click();
  await expect(preview.getByRole('button', { name: '자동배정' }).first()).toBeVisible();
});
