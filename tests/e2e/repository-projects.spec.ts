import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

for (const scenario of [
  { width: 1366, height: 768, theme: 'dark', adding: false },
  { width: 1024, height: 640, theme: 'light', adding: true },
  { width: 911, height: 512, theme: 'dark', adding: false },
]) {
  test(`仓库弹框不被导航遮挡 ${scenario.width}×${scenario.height} ${scenario.theme}`, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await openRepositories(page);
    await page.evaluate(({ theme }) => {
      document.documentElement.dataset.theme = theme;
      document.documentElement.classList.toggle('dark', theme === 'dark');
      const scroller = document.querySelector('.app-scroll')!;
      scroller.scrollTop = scroller.scrollHeight;
      window.api.selectDirectory = async () => '/workspace';
    }, scenario);
    await page.getByRole('button', { name: scenario.adding ? '添加仓库' : '关联飞书项目 Project A', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('.el-message')).toHaveCount(0);
    const header = dialog.locator('.el-dialog__header');
    await expect.poll(() => header.evaluate(element => {
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return element.contains(hit);
    }), { message: '弹框标题应显示在导航栏上方且可命中' }).toBe(true);
    const overlayCoversTopbar = await page.locator('.topbar').evaluate(element => {
      const box = element.getBoundingClientRect();
      // 窄屏滚动后顶栏可能离开视口，此时检查视口顶部的遮罩。
      const y = Math.max(1, Math.min(window.innerHeight - 1, box.y + box.height / 2));
      return Boolean(document.elementFromPoint(box.x + box.width / 2, y)?.closest('.el-overlay'));
    });
    expect(overlayCoversTopbar, '模态遮罩应覆盖导航栏').toBe(true);
    await dialog.getByRole('button', { name: '保存', exact: true }).click({ trial: true });
    const close = dialog.locator('.el-dialog__headerbtn');
    await close.click({ trial: true });
    await dialog.getByRole('combobox').first().click();
    await page.getByRole('option', { name: '教师发展平台', exact: true }).click();
    await expect(dialog).toContainText('教师发展平台');
    await page.getByRole('heading', { name: '仓库中心', exact: true }).dispatchEvent('mouseleave');
    await page.screenshot({ path: `output/playwright/repository-dialog-${scenario.width}-${scenario.theme}.png` });
    await close.click();
    await expect(dialog).not.toBeVisible();
  });
}

async function openRepositories(page: Page) {
  await page.goto('/#/repositories');
  await expect(page.getByRole('heading', { name: '仓库中心', exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.api.listFeishuProjects = async () => [
      { id: 'target', name: '测试项目' }, { id: 'linked', name: '教师发展平台' }, { id: 'other', name: '业务财务系统' },
    ];
  });
}

async function linkRepository(page: Page) {
  await page.getByRole('button', { name: '关联飞书项目 Project A', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: '教师发展平台', exact: true }).click();
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: '关联飞书项目 Project A', exact: true })).toContainText('教师发展平台');
}

for (const weekly of [false, true]) {
  test(`仓库关联自动用于${weekly ? '批量补日报' : '今日日报'}的实际提交参数`, async ({ page }) => {
    await openRepositories(page);
    await linkRepository(page);
    await page.getByRole('menuitem', { name: weekly ? '批量补日报' : '写今日日报', exact: true }).click();
    await page.getByRole('button', { name: '重新生成当前项目', exact: true }).click();
    await expect(page.locator(weekly ? '.weekly-report-textarea textarea' : '.editable-report textarea')).toHaveValue(/Project A/);
    await page.getByRole('button', { name: weekly ? '单独提交飞书' : '仅发布当前项目', exact: true }).click();
    if (!weekly) await page.getByRole('button', { name: '确认发布', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.reportTest.submissions.length)).toBe(1);
    const submission = await page.evaluate(() => window.reportTest.submissions[0]);
    expect(submission.config.projectOptionId).toBe('linked');
    expect(submission.config.projectName).toBe('教师发展平台');
  });
}

test('添加目录后逐仓库关联，可搜索项目；保存失败保留输入并可重试', async ({ page }) => {
  await openRepositories(page);
  await page.evaluate(() => {
    window.api.selectDirectory = async () => '/workspace';
  });
  await page.getByRole('button', { name: '添加仓库', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('仓库已添加');
  await expect(dialog.getByRole('combobox')).toHaveCount(2);
  await dialog.getByRole('combobox').first().fill('教师');
  await page.getByRole('option', { name: '教师发展平台', exact: true }).click();
  await page.evaluate(() => { window.reportTest.configFailure = true; });
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('教师发展平台');
  await expect(page.getByRole('button', { name: '关联飞书项目 Project A', exact: true })).not.toContainText('教师发展平台');
  await page.evaluate(() => { window.reportTest.configFailure = false; });
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('textbox', { name: '搜索仓库' }).fill('教师发展');
  await expect(page.getByRole('button', { name: '选择仓库 Project A', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '选择仓库 Project B', exact: true })).not.toBeVisible();
});

test('清除关联恢复默认项目，并保留浅深主题下的仓库布局', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await openRepositories(page);
  await linkRepository(page);
  await page.getByRole('button', { name: '置顶 Project A', exact: true }).click();
  await page.getByRole('heading', { name: '仓库中心', exact: true }).hover();
  await expect(page.locator('.el-message')).toHaveCount(0);
  for (const theme of ['dark', 'light']) {
    await page.evaluate(value => { document.documentElement.dataset.theme = value; document.documentElement.classList.toggle('dark', value === 'dark'); }, theme);
    const overflow = await page.locator('.repo-center-item').evaluateAll(rows => rows.some(row => row.scrollWidth > row.clientWidth));
    expect(overflow).toBe(false);
    await page.screenshot({ path: `output/playwright/repository-projects-${theme}.png` });
  }
  await page.getByRole('button', { name: '关联飞书项目 Project A', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('.el-select').hover();
  await dialog.locator('.el-select__clear').click();
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: '关联飞书项目 Project A', exact: true })).toContainText('关联飞书项目');
  await page.getByRole('menuitem', { name: '写今日日报', exact: true }).click();
  await page.getByRole('button', { name: '重新生成当前项目', exact: true }).click();
  await expect(page.locator('.publish-summary-card')).toContainText('测试项目');
});
