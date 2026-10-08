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

for (const mode of ['hanging', 'failed']) {
  test(`飞书 ${mode} 时仍可读取本地仓库并生成日报`, async ({ page }) => {
    await page.goto(`/?feishu=${mode}#/generate`);
    const generate = page.getByRole('button', { name: '重新生成当前项目', exact: true });
    await expect(generate).toBeEnabled();
    expect(await page.evaluate(() => window.reportTest.configSaves)).toBe(0);
    await generate.click();
    await expect(page.locator('.editable-report textarea')).toHaveValue(/Project A/);
  });
}

test('配置加载失败展示错误并阻止默认配置写入，修复后可重试', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?configReadFailure=1#/config');
  await expect(page.getByText('无法加载本地数据', { exact: true })).toBeVisible();
  await expect(page.getByText('配置文件损坏，请修复 config.json', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '日报配置', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.reportTest.configSaves)).toBe(0);
  await page.evaluate(() => { window.reportTest.configReadFailure = false; });
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect(page.getByRole('heading', { name: '日报配置', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('后台运行通知保留任务名称、启停、新增与删除编辑', async ({ page }) => {
  await page.goto('/?autoSyncTask=1#/config');
  const names = page.getByPlaceholder('任务名称', { exact: true });
  await expect(names.first()).toHaveValue('已有任务');
  await names.first().fill('未保存的任务名称');
  await page.locator('.auto-sync-switch').click();
  await page.locator('.auto-sync-task-actions .el-switch').first().click();
  await page.getByRole('button', { name: '新增同步任务', exact: true }).click();
  await names.nth(1).fill('新任务草稿');
  const notify = () => page.evaluate(async () => {
    const state = await window.api.getAutoSyncState();
    state.tasks[0].lastStatus = 'success';
    state.tasks[0].lastMessage = '后台运行已结束';
    window.reportTest.emitAutoSync(state);
  });
  await notify();
  await expect(names).toHaveCount(2);
  await expect(names.first()).toHaveValue('未保存的任务名称');
  await expect(names.nth(1)).toHaveValue('新任务草稿');
  await expect(page.getByRole('switch', { name: '自动同步总开关', exact: true })).toBeChecked();
  await expect(page.getByRole('switch', { name: '启用任务 未保存的任务名称', exact: true })).not.toBeChecked();
  await expect(page.getByText('后台运行已结束', { exact: true })).toBeVisible();
  await page.locator('.auto-sync-task-card').first().getByRole('button', { name: '删除', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '删除', exact: true }).click();
  await notify();
  await expect(names).toHaveCount(1);
  await expect(names).toHaveValue('新任务草稿');
  expect(await page.evaluate(() => window.reportTest.configSaves)).toBe(0);
});

test('备份取消和错误可重试，保留未保存配置并反馈导出结果', async ({ page }) => {
  await page.goto('/#/system');
  await page.getByRole('tab', { name: '集成配置', exact: true }).click();
  await page.getByPlaceholder('请选择工作目录').fill('/workspace/unsaved');
  await page.getByRole('tab', { name: '安全设置', exact: true }).click();
  await expect(page.getByText(/备份包含全部本地数据库记录和已保存配置/)).toBeVisible();
  const exportBackup = page.getByRole('button', { name: '导出备份', exact: true });
  const restoreBackup = page.getByRole('button', { name: '恢复备份', exact: true });
  await exportBackup.click();
  await restoreBackup.click();
  await expect(restoreBackup).toBeEnabled();
  await expect(page.locator('.el-message')).toHaveCount(0);
  await page.evaluate(() => { window.reportTest.backupOutcome = 'error'; });
  await exportBackup.click();
  await expect(page.getByText('备份文件写入失败', { exact: true })).toBeVisible();
  await restoreBackup.click();
  await expect(page.getByText('备份文件无效，当前数据未更改', { exact: true })).toBeVisible();
  await expect(exportBackup).toBeEnabled();
  await expect(restoreBackup).toBeEnabled();
  await page.evaluate(() => { window.reportTest.backupOutcome = 'success'; });
  await exportBackup.click();
  await expect(page.getByText('备份已保存至 /backups/local-backup.json', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.reportTest.backupCalls)).toEqual(['export', 'restore', 'export', 'restore', 'export']);
  expect(await page.evaluate(() => window.reportTest.configSaves)).toBe(0);
  await page.getByRole('tab', { name: '集成配置', exact: true }).click();
  await expect(page.getByPlaceholder('请选择工作目录')).toHaveValue('/workspace/unsaved');
});
