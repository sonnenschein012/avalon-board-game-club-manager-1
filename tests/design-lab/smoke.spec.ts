import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, expect, devices } from '@playwright/test';

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

test('출석 부원 등록은 확인 전에는 저장하지 않고 선택한 정보로 등록한다', async ({ page, request }, testInfo) => {
  const root = 'http://127.0.0.1:8080/v1/projects/demo-avalon-manager/databases/(default)/documents';
  const headers = { Authorization: 'Bearer owner' }; // Fixed local emulator only.
  await page.goto('/attendance');
  await page.getByRole('button', { name: '+ 멤버 추가', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '출석 부원 등록' });
  await expect(dialog.getByLabel('성별')).toHaveValue('');
  await page.screenshot({ path: testInfo.outputPath('registration-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('registration-mobile.png') });
  const before = await (await request.get(`${root}/members?pageSize=100`, { headers })).json();
  expect(before.documents.some((item: { fields: { name: { stringValue: string } } }) => item.fields.name.stringValue === '문하늘')).toBe(false);
  await dialog.getByLabel('성별').selectOption('여');
  await dialog.getByLabel('가입 학기').fill('2026-2');
  await dialog.getByRole('button', { name: '부원 등록', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '+ 멤버 추가', exact: true })).toHaveCount(0);
  const after = await (await request.get(`${root}/members?pageSize=100`, { headers })).json();
  const member = after.documents.find((item: { fields: { name: { stringValue: string } } }) => item.fields.name.stringValue === '문하늘');
  expect(member.fields.gender.stringValue).toBe('여');
  expect(member.fields.semester.stringValue).toBe('2026-2');
  expect(member.fields.phone.stringValue).toBe('');
  expect(member.fields.preferredGenre).toHaveProperty('arrayValue');
});

test('미배정 상태를 보존하고 세션 삭제 후에도 모임 조 이름을 수정한다', async ({ page, request }) => {
  const root = 'http://127.0.0.1:8080/v1/projects/demo-avalon-manager/databases/(default)/documents';
  const headers = { Authorization: 'Bearer owner' };
  const absent = await request.patch(`${root}/attendees/attendee-09?updateMask.fieldPaths=status`, { headers, data: { fields: { status: { stringValue: '결석' } } } });
  expect(absent.ok()).toBe(true);
  await page.goto('/attendance');
  await expect(page.getByLabel('세션명')).toBeVisible();
  const date = await page.getByLabel('세션 날짜').inputValue();
  // Load a persisted one-person draft through the same reload path as an operator.
  await page.evaluate(date => {
    const key = Object.keys(sessionStorage).find(key => key.startsWith('avalon:attendance-draft:v1:'));
    if (!key) throw new Error('Attendance draft was not initialized');
    sessionStorage.setItem(key, JSON.stringify({ sessionName: '삭제 연결 회귀 모임', sessionDate: date,
      isSessionNameCustom: true, isAutoMode: false,
      groups: [{ id: 'regression-group', name: '회귀 조', memberIds: ['attendee-03'], gameIds: [], targetSize: 4, notes: '' }] }));
  }, date);
  await page.reload();
  await page.getByRole('button', { name: '오늘의 모임 시작' }).click();
  await expect(page).toHaveURL(/\/meeting$/);
  const status = async (id: string) => (await (await request.get(`${root}/attendees/${id}`, { headers })).json()).fields.status.stringValue;
  expect(await status('attendee-03')).toBe('편성됨');
  expect(await status('attendee-04')).toBe('대기');
  expect(await status('attendee-09')).toBe('결석');
  await page.goto('/sessions');
  const heading = page.getByRole('heading', { name: '삭제 연결 회귀 모임', exact: true });
  await heading.locator('..').locator('..').getByRole('button').nth(1).click();
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(heading).toHaveCount(0);
  await expect(page.getByText('세션 기록이 삭제되었습니다.', { exact: true })).toBeVisible();
  const planning = await (await request.get(`${root}/DailyPlannings/${date}`, { headers })).json();
  expect(planning.fields).not.toHaveProperty('sessionId');
  expect(planning.fields.groups.arrayValue.values).toHaveLength(1);
  await page.goto('/meeting');
  await page.getByRole('heading', { name: '회귀 조', exact: true }).click();
  const nameInput = page.getByLabel('조 이름', { exact: true });
  await nameInput.fill('삭제 후 변경한 조');
  await nameInput.press('Enter');
  await expect(page.getByRole('heading', { name: '삭제 후 변경한 조', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '삭제 후 변경한 조', exact: true })).toBeVisible();
});

test('모바일 공개 링크는 느린 응답에서도 열리고 한 번의 탭으로 선택된다', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
  await page.route('**/*', async route => {
    if (route.request().resourceType() === 'document' || route.request().resourceType() === 'script') {
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    await route.continue();
  });

  await page.goto('/interview/demo-edit');
  await expect(page.getByText('김도윤 님')).toBeVisible();
  await page.getByRole('button', { name: '수정하기' }).click();
  const firstSlot = page.locator('[data-slot-id]').first();
  await firstSlot.click();
  await expect(firstSlot).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await context.close();
});

test('두 운영진이 같은 면접 기록을 수정하면 한쪽 입력을 보존하고 충돌을 알린다', async ({ browser }) => {
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  await Promise.all([
    firstPage.goto('/interviews/demo-round'),
    secondPage.goto('/interviews/demo-round'),
  ]);
  await Promise.all([
    firstPage.getByRole('button', { name: '면접 진행' }).click(),
    secondPage.getByRole('button', { name: '면접 진행' }).click(),
  ]);
  const openWorkspace = async (page: typeof firstPage) => {
    const card = page.locator('article').filter({ hasText: '오수빈' });
    await card.getByRole('button', { name: '면접 열기' }).click();
    await expect(page.getByPlaceholder('질문 외 추가 메모, 후속 확인 사항 등을 자유롭게 기록하세요.')).toBeVisible();
  };
  await Promise.all([openWorkspace(firstPage), openWorkspace(secondPage)]);

  await Promise.all([
    firstPage.getByPlaceholder('질문 외 추가 메모, 후속 확인 사항 등을 자유롭게 기록하세요.').fill('첫 번째 운영진 입력'),
    secondPage.getByPlaceholder('질문 외 추가 메모, 후속 확인 사항 등을 자유롭게 기록하세요.').fill('두 번째 운영진 입력'),
  ]);

  await expect.poll(async () => (
    await firstPage.getByText('다른 운영진이 이 면접 기록을 수정했습니다.').count()
    + await secondPage.getByText('다른 운영진이 이 면접 기록을 수정했습니다.').count()
  )).toBeGreaterThan(0);

  const conflictedPage = await firstPage.getByText('다른 운영진이 이 면접 기록을 수정했습니다.').count() ? firstPage : secondPage;
  const preservedValue = await conflictedPage.getByPlaceholder('질문 외 추가 메모, 후속 확인 사항 등을 자유롭게 기록하세요.').inputValue();
  expect(['첫 번째 운영진 입력', '두 번째 운영진 입력']).toContain(preservedValue);

  await firstContext.close();
  await secondContext.close();
});

test('개인 효용 자동 편성은 수동 배치와 정원을 유지하고 안내를 표시한다', async ({ page, request }, testInfo) => {
  const root = 'http://127.0.0.1:8080/v1/projects/demo-avalon-manager/databases/(default)/documents';
  const headers = { Authorization: 'Bearer owner' };
  const response = await request.patch(`${root}/attendees/attendee-01?updateMask.fieldPaths=request`, {
    headers, data: { fields: { request: { stringValue: '이서윤 장예린과 함께 하고 싶어요.' } } },
  });
  expect(response.ok()).toBe(true);
  await page.goto('/attendance');
  await expect(page.getByLabel('세션명')).toBeVisible();
  const date = await page.getByLabel('세션 날짜').inputValue();
  await page.evaluate(date => {
    const key = Object.keys(sessionStorage).find(key => key.startsWith('avalon:attendance-draft:v1:'));
    if (!key) throw new Error('Missing draft');
    sessionStorage.setItem(key, JSON.stringify({ sessionName: '효용 연결 확인', sessionDate: date,
      isSessionNameCustom: true, isAutoMode: true, groups: [
        { id: 'utility-one', name: '고정 1조', memberIds: ['attendee-01'], gameIds: [], targetSize: 4, notes: '수동 유지' },
        { id: 'utility-two', name: '고정 2조', memberIds: ['attendee-02'], gameIds: [], targetSize: 4 },
      ] }));
  }, date);
  await page.reload();
  await page.getByRole('button', { name: '조편성 시작', exact: true }).click();
  await expect(page.getByText('자동 편성되었습니다. 요청 및 인원 조정 안내를 확인해주세요.', { exact: true })).toBeVisible();
  await expect(page.getByText(/설정 인원을 4명에서 5명으로 조정/)).toBeVisible();
  await expect(page.getByText(/수동 배치를 유지하여 서로 다른 조/)).toHaveCount(2);
  await expect(page.getByText(/장예린님은 불참하여/)).toHaveCount(1);
  const saved = await page.evaluate(() => {
    const key = Object.keys(sessionStorage).find(key => key.startsWith('avalon:attendance-draft:v1:'))!;
    return JSON.parse(sessionStorage.getItem(key)!) as { groups: { id: string; memberIds: string[]; targetSize: number; notes?: string }[] };
  });
  expect(saved.groups.map(g => g.memberIds.length).sort()).toEqual([4, 5]);
  expect(saved.groups.every(g => g.memberIds.length === g.targetSize)).toBe(true);
  expect(saved.groups[0]!.memberIds).toContain('attendee-01');
  expect(saved.groups[1]!.memberIds).toContain('attendee-02');
  expect(saved.groups[0]!.notes).toBe('수동 유지');
  expect(new Set(saved.groups.flatMap(g => g.memberIds)).size).toBe(9);
  await expect(page.getByRole('button', { name: /자동 조편성/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '조편성 시작', exact: true })).toHaveCount(0);
  await expect(page.getByText(/수동 배치를 유지하여 서로 다른 조/)).toHaveCount(2);
  await expect(page.getByText(/장예린님은 불참하여/)).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('attendance-notices-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('[data-attendance-canvas]').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('attendance-notices-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: /비용평가지표/ }).click();
  const dialog = page.getByRole('dialog', { name: '개인 효용 평가' });
  await expect(dialog.getByText('개인 순효용 합:', { exact: false })).toBeVisible();
  await expect(dialog.getByRole('columnheader', { name: '환산 순효용', exact: true })).toHaveCount(2);
  await expect(dialog.getByRole('columnheader', { name: '개선 중요도', exact: true })).toHaveCount(2);
  await expect(dialog.getByRole('row')).toHaveCount(11);
  await page.screenshot({ path: testInfo.outputPath('utility-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('utility-mobile.png') });
});

test('복수 동반 후보는 알림에서 모달로 선택하고 자동·수동 평가에 같은 상대를 사용한다', async ({ page, request }, testInfo) => {
  const root = 'http://127.0.0.1:8080/v1/projects/demo-avalon-manager/databases/(default)/documents';
  const headers = { Authorization: 'Bearer owner' }; // Synthetic local emulator only.
  const raw = '민수와 함께 하고 싶어요.\n처음 참석하는 친구와 함께 신청했습니다. 같은 조에서 게임 규칙을 배울 수 있도록 부탁드립니다.\n어떤 분을 말하는지는 운영진에게 따로 전달했습니다.\n가능하면 처음 하는 게임은 설명을 들으면서 천천히 배우고 싶습니다.\n게임 종류는 조원들과 함께 정하겠습니다.';
  const changes = [
    ['members/member-03', { name: { stringValue: '김민수' } }],
    ['members/member-08', { name: { stringValue: '박민수' } }],
    ['attendees/attendee-03', { name: { stringValue: '김민수' } }],
    ['attendees/attendee-08', { name: { stringValue: '박민수' } }],
    ['attendees/attendee-01', { request: { stringValue: raw } }],
  ] as const;
  for (const [path, fields] of changes) {
    const response = await request.patch(`${root}/${path}?updateMask.fieldPaths=${Object.keys(fields).join(',')}`, { headers, data: { fields } });
    expect(response.ok()).toBe(true);
  }
  await page.goto('/attendance');
  const pending = page.getByRole('button', { name: /상대 확인 필요: 김민준/ });
  await expect(pending).toHaveCount(1);
  await pending.click();
  const dialog = page.getByRole('dialog', { name: '동반 상대 선택' });
  await expect(dialog.getByRole('radio', { name: '상대 미확정', exact: true })).toBeChecked();
  await dialog.getByRole('radio', { name: /김민수.*22학번/ }).check();
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await pending.click();
  await expect(dialog.getByRole('radio', { name: '상대 미확정', exact: true })).toBeChecked();
  const excerpt = dialog.locator('summary > span').first();
  const collapsedHeight = await excerpt.evaluate(element => element.clientHeight);
  await dialog.getByText('원문 전체 보기', { exact: true }).click();
  expect(await excerpt.evaluate(element => element.clientHeight)).toBeGreaterThan(collapsedHeight);
  await dialog.getByText('원문 접기', { exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('companion-modal-desktop.png') });
  await page.setViewportSize({ width: 390, height: 600 });
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.getByRole('radio', { name: /박민수.*24학번/ }).check();
  await expect(dialog.getByRole('radio', { name: /박민수.*24학번/ })).toBeChecked();
  await dialog.getByRole('radio', { name: /김민수.*22학번/ }).check();
  const confirm = dialog.getByRole('button', { name: '선택 반영', exact: true });
  const box = (await confirm.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(600);
  await page.screenshot({ path: testInfo.outputPath('companion-modal-mobile.png') });
  await confirm.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: /동반 상대 확인: 김민준.*김민수/ })).toHaveCount(1);
  const date = await page.getByLabel('세션 날짜').inputValue();
  await page.evaluate(date => {
    const key = Object.keys(sessionStorage).find(key => key.startsWith('avalon:attendance-draft:v1:'))!;
    const draft = JSON.parse(sessionStorage.getItem(key)!);
    draft.groups = [
      { id: 'choice-one', name: '요청자 조', memberIds: ['attendee-01'], gameIds: [] },
      { id: 'choice-two', name: '다른 조', memberIds: ['attendee-02'], gameIds: [] },
    ];
    draft.sessionDate = date;
    draft.isAutoMode = true;
    sessionStorage.setItem(key, JSON.stringify(draft));
  }, date);
  await page.reload();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.getByRole('button', { name: /동반 상대 확인: 김민준.*김민수/ })).toHaveCount(1);
  await page.getByRole('button', { name: '조편성 시작', exact: true }).click();
  await expect(page.getByText('자동 편성되었습니다. 요청 및 인원 조정 안내를 확인해주세요.', { exact: true })).toBeVisible();
  const firstGroup = page.locator('[data-group-id="choice-one"]');
  await expect(firstGroup.locator('[data-attendee-id="attendee-03"]')).toBeVisible();
  await expect(page.getByText(/동반 요청 미충족: 김민준님과 김민수님/)).toHaveCount(0);
  await firstGroup.locator('[data-attendee-id="attendee-03"]').getByRole('button').click();
  await expect(firstGroup.getByText(/동반 요청 미충족: 김민준님과 김민수님/)).toBeVisible();
  await firstGroup.getByRole('button', { name: /동반 상대 확인/ }).click();
  await expect(dialog.getByRole('radio', { name: /김민수.*22학번/ })).toBeChecked();
  await dialog.getByRole('radio', { name: /박민수.*24학번/ }).check();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(firstGroup.getByRole('button', { name: /동반 상대 확인/ })).toBeFocused();
  await firstGroup.getByRole('button', { name: /동반 상대 확인/ }).click();
  await expect(dialog.getByRole('radio', { name: /김민수.*22학번/ })).toBeChecked();
  await dialog.getByRole('radio', { name: '상대 미확정', exact: true }).check();
  await dialog.getByRole('button', { name: '선택 반영', exact: true }).click();
  await expect(pending).toHaveCount(1);
  await expect(firstGroup.getByText(/동반 요청 미충족: 김민준님과 김민수님/)).toHaveCount(0);
  await pending.click();
  await dialog.getByRole('radio', { name: /박민수.*24학번/ }).check();
  await dialog.getByRole('button', { name: '선택 반영', exact: true }).click();
  await expect(firstGroup.getByRole('button', { name: /동반 상대 확인: 김민준.*박민수/ })).toHaveCount(1);
  const attendee = await (await request.get(`${root}/attendees/attendee-01`, { headers })).json();
  expect(attendee.fields.request.stringValue).toBe(raw);
});
