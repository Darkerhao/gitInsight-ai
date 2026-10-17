import { test, expect } from './fixtures';

test('仓库扫描未完成时可编辑和切换页面，发现结果不恢复已取消的选择', async ({ page }) => {
  await page.goto('/?repos=hanging#/repositories');
  await expect(page.getByRole('heading', { name: '仓库中心', exact: true })).toBeVisible();
  const repo = page.getByRole('button', { name: '选择仓库 a', exact: true });
  await expect(repo).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '添加仓库', exact: true })).toBeEnabled();
  await repo.click();
  await expect(repo).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('menuitem', { name: '写今日日报', exact: true }).click();
  await expect(page.locator('[data-page="report-generate"]')).toBeVisible();
  await expect(page.locator('[data-page="report-generate"] [inert]')).toHaveCount(0);
  await page.evaluate(() => window.reportTest.finishRepositoryScan());
  await page.getByRole('menuitem', { name: '仓库中心', exact: true }).click();
  await expect(page.getByRole('button', { name: '选择仓库 Project A', exact: true })).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => window.reportTest.configSaves)).toBe(1);
});

test('首屏只加载当前业务页，并记录当前页面挂载时间', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/#/generate');
  await expect(page.locator('[data-page="report-generate"]')).toBeVisible();
  expect(requests.some(url => /JiaziTimelineView|DashboardView|vendor-echarts|vendor-3d/.test(url))).toBe(false);
  expect(await page.evaluate(() => performance.getEntriesByName('gitinsight:first-page-ready').length)).toBe(1);
  await page.getByRole('menuitem', { name: '关于', exact: true }).click();
  await expect(page.getByRole('heading', { name: '关于', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '关于', exact: true })).toBeVisible();
});

test('业务页加载失败不影响其他页面，确认后重新加载可恢复', async ({ page }) => {
  let failed = false;
  await page.route('**/views/AboutView.vue', async route => {
    if (!failed) { failed = true; await route.abort(); }
    else await route.continue();
  });
  await page.goto('/#/generate');
  await expect(page.locator('[data-page="report-generate"]')).toBeVisible();
  await page.getByRole('menuitem', { name: '关于', exact: true }).click();
  await expect(page.getByText('页面加载失败', { exact: true })).toBeVisible();
  await page.getByRole('menuitem', { name: '写今日日报', exact: true }).click();
  await expect(page.locator('[data-page="report-generate"]')).toBeVisible();
  await page.getByRole('menuitem', { name: '关于', exact: true }).click();
  await page.getByRole('button', { name: '重新加载应用', exact: true }).click();
  await page.getByRole('button', { name: '保留当前内容', exact: true }).click();
  await expect(page.getByText('页面加载失败', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重新加载应用', exact: true }).click();
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect(page.getByRole('heading', { name: '关于', exact: true })).toBeVisible();
  await page.getByRole('menuitem', { name: '写今日日报', exact: true }).click();
  await expect(page.locator('[data-page="report-generate"]')).toBeVisible();
});

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`切换首帧移除旧页面，不把新页面挤出视口（${reducedMotion}）`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/#/about');
    await expect(page.getByRole('heading', { name: '关于', exact: true })).toBeVisible();
    await page.getByRole('menuitem', { name: '写今日日报', exact: true }).click();
    await expect(page.locator('[data-page="report-generate"]')).toBeVisible();
    await expect(page.locator('.route-switch-enter-active')).toHaveCount(0);

    const layout = await page.getByRole('menuitem', { name: '关于', exact: true }).evaluate(async element => {
      const requestFrame = window.requestAnimationFrame;
      const pending: FrameRequestCallback[] = [];
      // Hold animation frames while inspecting the first completed Vue DOM update.
      window.requestAnimationFrame = callback => -pending.push(callback);
      try {
        (element as HTMLElement).click();
        await new Promise(resolve => window.setTimeout(resolve, 0));
        const about = document.querySelector('.app-about-view')!.getBoundingClientRect();
        const viewport = document.querySelector('.app-scroll')!.getBoundingClientRect();
        return {
          oldPagePresent: Boolean(document.querySelector('[data-page="report-generate"]')),
          pageInViewport: about.top >= viewport.top && about.top < viewport.bottom,
        };
      } finally {
        window.requestAnimationFrame = requestFrame;
        pending.forEach(callback => requestFrame.call(window, callback));
      }
    });
    expect(layout.oldPagePresent).toBe(false);
    expect(layout.pageInViewport).toBe(true);
  });
}
