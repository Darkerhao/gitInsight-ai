import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

async function publishAll(page: Page, weekly: boolean) {
  await page.getByRole('button', { name: weekly ? '提交全部待提交日报' : '发布全部已生成项目', exact: true }).click();
  await page.getByRole('button', { name: weekly ? /确认提交 \d+ 条/ : '确认发布', exact: true }).click();
}

for (const weekly of [false, true]) {
  const label = weekly ? '批量补日报' : '写今日日报';
  const editor = weekly ? '.weekly-report-textarea textarea' : '.editable-report textarea';
  test.describe(label, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(weekly ? '/#/weekly' : '/#/generate');
      await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '重新生成当前项目', exact: true })).toBeEnabled();
    });

    test('生成失败可重试，失败不会覆盖编辑内容', async ({ page }) => {
      const generate = page.getByRole('button', { name: '重新生成当前项目', exact: true });
      await generate.click();
      await expect(page.locator(editor)).toHaveValue(/Project A/);
      await page.locator(editor).fill('保留我的人工修改');
      await page.evaluate(() => { window.reportTest.generateFailures = 1; });
      await generate.click();
      await expect(page.locator(weekly ? '.weekly-editor-message' : '.report-result-status').first()).toContainText('生成日报失败');
      await expect(page.locator(editor)).toHaveValue('保留我的人工修改');
      await generate.click();
      await expect(page.locator(editor)).toHaveValue(/Project A/);
      expect(await page.evaluate(() => window.reportTest.generations.length)).toBe(3);
    });

    test('编辑后发布保存最新内容，保存失败不能提交', async ({ page }) => {
      await page.getByRole('button', { name: '重新生成当前项目', exact: true }).click();
      await expect(page.locator(editor)).toHaveValue(/Project A/);
      await page.locator(editor).fill('编辑后的工作记录：验证列表分页与查询结果');
      if (weekly) await page.locator('.weekly-hours-control input').fill('4');
      await page.evaluate(() => { window.reportTest.saveFailure = true; });
      const publish = async () => {
        await page.getByRole('button', { name: weekly ? '单独提交飞书' : '仅发布当前项目', exact: true }).click();
        if (!weekly) await page.getByRole('button', { name: '确认发布', exact: true }).click();
      };
      await publish();
      await expect(page.getByText('保存日报失败，请稍后重试', { exact: true }).first()).toBeVisible();
      expect(await page.evaluate(() => window.reportTest.submissions.length)).toBe(0);
      await page.evaluate(() => { window.reportTest.saveFailure = false; });
      await publish();
      await expect.poll(() => page.evaluate(() => window.reportTest.submissions.length)).toBe(1);
      const { saves, submissions } = await page.evaluate(() => window.reportTest);
      expect(saves.at(-1)?.report).toBe('编辑后的工作记录：验证列表分页与查询结果');
      expect(submissions[0].report).toBe(saves.at(-1)?.report);
      expect(submissions[0].reportId).toBe(saves.at(-1)?.id);
    });

    test('部分发布成功后重试只提交失败项', async ({ page }) => {
      if (weekly) {
        // Generate only the first date's two drafts through the real project selector.
        await page.getByRole('button', { name: '重新生成当前项目', exact: true }).click();
        await expect(page.locator(editor)).toHaveValue(/Project A/);
        await page.locator('.weekly-draft-row').filter({ hasText: 'Project B' }).first().click();
        await page.getByRole('button', { name: '重新生成当前项目', exact: true }).click();
      } else {
        await page.getByRole('button', { name: '生成 2 个项目日报', exact: true }).click();
      }
      await expect.poll(() => page.evaluate(() => window.reportTest.generations.length)).toBe(2);
      await expect(page.getByRole('button', { name: '重新生成当前项目', exact: true })).toBeEnabled();
      await page.evaluate(() => { window.reportTest.publishFailures = 1; });
      await publishAll(page, weekly);
      await expect.poll(() => page.evaluate(() => window.reportTest.submissions.length)).toBe(2);
      await publishAll(page, weekly);
      await expect.poll(() => page.evaluate(() => window.reportTest.submissions.length)).toBe(3);
      const submissions = await page.evaluate(() => window.reportTest.submissions);
      expect(submissions.filter((item) => item.report.includes('Project A'))).toHaveLength(1);
      expect(submissions.filter((item) => item.report.includes('Project B'))).toHaveLength(2);
      await expect(page.getByRole('button', { name: weekly ? '提交全部待提交日报' : '发布全部已生成项目', exact: true })).toBeDisabled();
    });
  });
}

for (const scale of [1, 1.25, 1.5]) {
  test(`1366×768 屏幕，${scale * 100}% 等效缩放可编辑和发布`, async ({ page }) => {
    // Reserve 68 physical pixels for the taskbar/window chrome; resize in CSS pixels.
    await page.setViewportSize({ width: Math.floor(1366 / scale), height: Math.floor(700 / scale) });
    await page.goto('/#/generate');
    await page.getByRole('button', { name: '重新生成当前项目', exact: true }).click();
    const editor = page.locator('.editable-report textarea');
    await expect(editor).toHaveValue(/Project A/);
    await editor.fill('小屏下编辑并发布');
    await page.getByRole('button', { name: '仅发布当前项目', exact: true }).click();
    await page.getByRole('button', { name: '确认发布', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.reportTest.submissions.length)).toBe(1);
    const result = page.locator('.publish-summary-card');
    await expect(result).toContainText('已提交飞书日报');
    await result.scrollIntoViewIfNeeded();
    await expect(result).toBeInViewport();
    const outside = await page.locator('.editable-report, .current-publish-btn, .batch-publish-btn').evaluateAll((elements) =>
      elements.some((element) => { const box = element.getBoundingClientRect(); return box.left < 0 || box.right > innerWidth; }));
    expect(outside).toBe(false);
    await page.screenshot({ path: `output/playwright/report-workflow/layout-${scale}.png` });
  });
}

test('发布配置保存失败有明确反馈，修正后可重试', async ({ page }) => {
  await page.goto('/#/generate');
  await page.getByRole('button', { name: '重新生成当前项目', exact: true }).click();
  await expect(page.locator('.editable-report textarea')).toHaveValue(/Project A/);
  await page.evaluate(() => { window.reportTest.configFailure = true; });
  const publish = async () => {
    await page.getByRole('button', { name: '仅发布当前项目', exact: true }).click();
    await page.getByRole('button', { name: '确认发布', exact: true }).click();
  };
  await publish();
  await expect(page.locator('.publish-summary-card')).toContainText('保存发布配置失败');
  expect(await page.evaluate(() => window.reportTest.submissions.length)).toBe(0);
  await page.evaluate(() => { window.reportTest.configFailure = false; });
  await publish();
  await expect(page.locator('.publish-summary-card')).toContainText('已提交飞书日报');
});

for (const scale of [1, 1.25, 1.5]) {
  test(`批量页 ${scale * 100}% 等效缩放可编辑和查看发布结果`, async ({ page }) => {
    await page.setViewportSize({ width: Math.floor(1366 / scale), height: Math.floor(700 / scale) });
    await page.goto('/#/weekly');
    await page.getByRole('button', { name: '重新生成当前项目', exact: true }).click();
    const editor = page.locator('.weekly-report-textarea textarea');
    await expect(editor).toHaveValue(/Project A/);
    await editor.fill('小屏下编辑批量日报');
    await page.locator('.weekly-hours-control input').fill('4');
    await page.getByRole('button', { name: '单独提交飞书', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.reportTest.submissions.length)).toBe(1);
    const result = page.locator('.weekly-publish-table-row').first();
    await result.scrollIntoViewIfNeeded();
    await expect(result).toContainText('已提交');
    await expect(result).toBeInViewport();
    const outside = await page.locator('.weekly-report-textarea, .weekly-editor-actions, .weekly-publish-table-row').evaluateAll((elements) =>
      elements.some((element) => { const box = element.getBoundingClientRect(); return box.left < 0 || box.right > innerWidth; }));
    expect(outside).toBe(false);
    await page.screenshot({ path: `output/playwright/report-workflow/weekly-layout-${scale}.png` });
  });
}

test('欢迎页显示真实配置进度，奖励渲染不在启动时加载', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.addInitScript(() => localStorage.setItem('gitinsight:welcome-animation-enabled', 'true'));
  await page.goto('/#/generate');
  await expect(page.getByText('配置进度：2/3 项已填写')).toBeVisible();
  await expect(page.getByText('待配置，可先用基础模板')).toBeVisible();
  expect(requests.some((url) => /RewardEffectOverlay|CinemaEnvironment/.test(url))).toBe(false);
  await page.getByRole('button', { name: '进入工作台', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
