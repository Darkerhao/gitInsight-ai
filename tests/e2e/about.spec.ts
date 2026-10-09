import { test, expect } from './fixtures';

test('关于入口显示运行版本，并可手动检查和打开固定链接', async ({ page }) => {
  await page.goto('/#/generate');
  await page.getByRole('menuitem', { name: '关于', exact: true }).click();
  await expect(page.getByRole('heading', { name: '关于', exact: true })).toBeVisible();
  await expect(page.getByText('版本 v3.8.8', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '检查更新', exact: true }).click();
  await expect(page.getByRole('heading', { name: '当前已是最新版本' })).toBeVisible();
  await page.getByRole('button', { name: '项目主页', exact: true }).click();
  await page.getByRole('button', { name: '更新日志', exact: true }).click();
  expect(await page.evaluate(() => window.reportTest.openedLinks)).toEqual(['home', 'releases']);
  expect(await page.evaluate(() => window.reportTest.updateChecks)).toBe(1);
});

test('下载进度、更新说明和重启安装完整可用，切换页面保留状态', async ({ page }) => {
  await page.goto('/#/about');
  await expect(page.getByText('版本 v3.8.8')).toBeVisible();
  await page.evaluate(() => window.reportTest.emitUpdate({
    status: 'available', latestVersion: '3.8.9',
    releaseNotes: '<h2>更新内容</h2><p>修复日报导出</p><script>window.badRelease = true</script>',
  }));
  await expect(page.getByRole('heading', { name: '发现新版本 v3.8.9' })).toBeVisible();
  await expect(page.locator('.app-about-notes')).toContainText('修复日报导出');
  await expect(page.locator('.app-about-notes')).not.toContainText('<h2>');
  await expect(page.locator('.app-about-notes')).not.toContainText('badRelease');
  await page.getByRole('button', { name: '下载更新', exact: true }).click();
  await expect(page.getByRole('button', { name: '检查更新', exact: true })).toBeDisabled();
  await expect(page.locator('.app-about-progress')).toContainText('37%');
  await page.getByRole('menuitem', { name: '系统设置', exact: true }).click();
  await page.evaluate(() => window.reportTest.emitUpdate({ status: 'downloaded', progress: null }));
  await page.getByRole('menuitem', { name: '关于', exact: true }).click();
  await expect(page.getByRole('heading', { name: '新版本 v3.8.9 已准备就绪' })).toBeVisible();
  await page.getByRole('button', { name: '重启安装', exact: true }).click();
  await page.getByRole('button', { name: '稍后', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '重启更新' })).not.toBeVisible();
  expect(await page.evaluate(() => window.reportTest.updateInstalls)).toBe(0);
  await page.getByRole('button', { name: '重启安装', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '重启安装', exact: true }).click();
  expect(await page.evaluate(() => window.reportTest.updateInstalls)).toBe(1);
  expect(await page.evaluate(() => window.reportTest.updateDownloads)).toBe(1);
});

test('自动开关独立保存，失败保留原值，检查失败可重试', async ({ page }) => {
  await page.goto('/#/about');
  const automatic = page.getByRole('switch', { name: '自动更新' });
  const automaticControl = page.locator('.app-about-automatic .el-switch');
  await expect(automatic).not.toBeChecked();
  await page.evaluate(() => { window.reportTest.updatePreferenceFailure = true; });
  await automaticControl.click();
  await expect(page.getByText('无法保存更新设置', { exact: true })).toBeVisible();
  await expect(automatic).not.toBeChecked();
  await page.evaluate(() => { window.reportTest.updatePreferenceFailure = false; });
  await automaticControl.click();
  await expect(automatic).toBeChecked();
  expect(await page.evaluate(() => window.reportTest.configSaves)).toBe(0);
  await page.evaluate(() => { window.reportTest.updateFailure = true; });
  await page.getByRole('button', { name: '检查更新', exact: true }).click();
  await expect(page.getByText('无法连接更新服务，请重试', { exact: true })).toBeVisible();
  await page.evaluate(() => { window.reportTest.updateFailure = false; });
  await page.getByRole('button', { name: '检查更新', exact: true }).click();
  await expect(page.getByRole('heading', { name: '当前已是最新版本' })).toBeVisible();
});

test('不支持的安装方式给出说明并禁用自动更新操作', async ({ page }) => {
  await page.goto('/#/about');
  await expect(page.getByText('版本 v3.8.8')).toBeVisible();
  await page.evaluate(() => window.reportTest.emitUpdate({ status: 'unsupported', supported: false, message: '当前为免安装版本，请使用 Windows 安装版。' }));
  await expect(page.getByText('当前为免安装版本，请使用 Windows 安装版。', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '检查更新', exact: true })).toBeDisabled();
  await expect(page.getByRole('switch', { name: '自动更新' })).toBeDisabled();
});

test('较早的检查响应不会覆盖后台推送的下载完成状态', async ({ page }) => {
  await page.goto('/#/about');
  await expect(page.getByText('版本 v3.8.8')).toBeVisible();
  await page.evaluate(() => {
    window.api.checkForAppUpdates = async () => {
      const older = { ...window.reportTest.updateState };
      window.reportTest.emitUpdate({ status: 'downloaded', latestVersion: '3.8.9' });
      return older;
    };
  });
  await page.getByRole('button', { name: '检查更新', exact: true }).click();
  await expect(page.getByRole('heading', { name: '新版本 v3.8.9 已准备就绪' })).toBeVisible();
  await expect(page.getByRole('button', { name: '重启安装', exact: true })).toBeVisible();
});

for (const theme of ['light', 'dark']) {
  for (const width of [900, 1366]) {
    test(`${theme} 主题在 ${width}px 下更新卡片和操作可见且无横向溢出`, async ({ page }) => {
      await page.setViewportSize({ width, height: 850 });
      await page.addInitScript(value => localStorage.setItem('gitinsight:theme-mode', value), theme);
      await page.goto('/#/about');
      await expect(page.getByText('版本 v3.8.8')).toBeVisible();
      await page.evaluate(() => window.reportTest.emitUpdate({
        status: 'downloaded', latestVersion: '3.8.9', autoUpdate: true,
        releaseNotes: '<p>新增应用内更新</p><ul><li>支持后台下载与退出安装</li><li>轻量版和标准版分别更新</li></ul>',
      }));
      await expect(page.getByRole('button', { name: '重启安装', exact: true })).toBeVisible();
      const layout = await page.locator('.app-about-view').evaluate(element => ({
        width: element.clientWidth, scroll: element.scrollWidth,
        viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth,
      }));
      expect(layout.scroll).toBeLessThanOrEqual(layout.width + 1);
      expect(layout.page).toBeLessThanOrEqual(layout.viewport + 1);
      await page.screenshot({ path: `output/playwright/about-updates/about-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
    });
  }
}
