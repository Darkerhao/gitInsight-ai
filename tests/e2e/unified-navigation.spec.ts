import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

const errorsByPage = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  errorsByPage.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(({ page }) => {
  expect(errorsByPage.get(page), '页面不应产生未捕获异常').toEqual([]);
});

async function loadActivity(page: Page, withSync = true) {
  await page.goto('/#/help');
  await expect(page.getByRole('heading', { name: '使用帮助', exact: true })).toBeVisible();
  await page.evaluate(includeSync => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const generatedAt = now.toISOString();
    window.api.listDailyReports = async () => [{
      id: 1, date, reporterName: '测试用户', repoNames: ['Project A'], repoPaths: ['/workspace/a'],
      report: '完成仓库整合并验证', status: 'success', commitsCount: 2, filesCount: 1, generatedAt, updatedAt: generatedAt,
    }];
    window.api.listSyncLogs = async () => includeSync ? [{ id: 21, reportId: 1, date, triggerType: 'scheduled', status: 'success', message: '已提交整合日报', ranAt: generatedAt }] : [];
    window.api.listErrorLogs = async () => [{ id: 31, scope: '网络连接', message: '连接超时', detail: '请检查当前连接', createdAt: generatedAt }];
  }, withSync);
  await page.getByRole('button', { name: '一键自检', exact: true }).click();
}

test('新旧导航均可访问，工作台生成入口复用当前编辑流程', async ({ page }) => {
  await page.goto('/#/dashboard');
  const entries = [
    ['仓库中心', 'repositories'], ['同步任务', 'sync'], ['消息中心', 'messages'], ['使用帮助', 'help'],
    ['素材日报', 'material'], ['写今日日报', 'generate'], ['批量补日报', 'weekly'],
    ['汇总本周工作', 'summary'], ['复盘项目问题', 'reflection'], ['历史日志', 'history'],
    ['时间长河', 'timeline'], ['日报配置', 'config'], ['AI 设置', 'ai'], ['系统设置', 'system'], ['关于', 'about'], ['工作台', 'dashboard'],
  ];
  for (const [label, route] of entries) {
    const item = page.getByRole('menuitem', { name: label, exact: true });
    if (!(await item.isVisible())) {
      await page.getByRole('menuitem', { name: '成长中心', exact: true }).click();
    }
    await item.click();
    await expect(page).toHaveURL(new RegExp(`#/${route}(?:\\?|$)`));
    await expect(item).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
    await expect(page.getByText(/is not a function/)).not.toBeVisible();
  }
  await page.getByRole('button', { name: '生成日报', exact: true }).first().click();
  await expect(page).toHaveURL(/#\/generate$/);
  expect(await page.evaluate(() => window.reportTest.generations)).toHaveLength(0);
});

test('仓库选择、置顶和显示名沿用现有仓库状态', async ({ page }) => {
  await page.goto('/#/repositories');
  await expect(page.getByRole('heading', { name: '仓库中心', exact: true })).toBeVisible();
  const repo = page.getByRole('button', { name: '选择仓库 Project A', exact: true });
  await expect(repo).toHaveAttribute('aria-pressed', 'true');
  await repo.click();
  await expect(repo).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '置顶 Project A', exact: true }).click();
  await expect(page.getByRole('button', { name: '取消置顶 Project A', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '重命名 Project A', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('整合项目');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByPlaceholder('搜索仓库名称或路径').fill('整合项目');
  await expect(page.getByRole('button', { name: '选择仓库 整合项目', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '选择仓库 Project B', exact: true })).not.toBeVisible();
  expect(await page.evaluate(() => window.reportTest.configSaves)).toBeGreaterThanOrEqual(3);
});

test('工作台分别统计生成与同步，消息阅读状态持久保存', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('gitinsight-message-read-ids')) localStorage.setItem('gitinsight-message-read-ids', JSON.stringify(['sync-older']));
  });
  await loadActivity(page);
  await page.getByRole('menuitem', { name: '工作台', exact: true }).click();
  await expect(page.locator('[data-stat="generated"] strong')).toHaveText('1');
  await expect(page.locator('[data-stat="published"] strong')).toHaveText('1');
  await expect(page.getByText('日报和日志分别展示最近最多 50 条记录，统计不代表全部历史。')).toBeVisible();
  await page.getByRole('menuitem', { name: '消息中心', exact: true }).click();
  await expect(page.locator('.message-unread-count')).toHaveText('未读 2');
  await page.getByRole('button').filter({ hasText: '已提交整合日报' }).click();
  await expect(page.getByRole('dialog', { name: '消息详情' })).toContainText('已提交整合日报');
  await expect(page.locator('.message-unread-count')).toHaveText('未读 1');
  await page.getByRole('button', { name: '关闭此对话框' }).click();
  await page.getByRole('button', { name: '全部已读', exact: true }).click();
  await expect(page.locator('.message-unread-count')).toHaveText('未读 0');
  const ids = await page.evaluate(() => JSON.parse(localStorage.getItem('gitinsight-message-read-ids') || '[]'));
  expect(ids).toEqual(expect.arrayContaining(['sync-older', 'sync-21', 'error-31']));
  await loadActivity(page);
  await page.getByRole('menuitem', { name: '消息中心', exact: true }).click();
  await expect(page.locator('.message-unread-count')).toHaveText('未读 0');
});

test('日报生成成功但没有同步日志时，同步成功次数为零', async ({ page }) => {
  await loadActivity(page, false);
  await page.getByRole('menuitem', { name: '工作台', exact: true }).click();
  await expect(page.locator('[data-stat="generated"] strong')).toHaveText('1');
  await expect(page.locator('[data-stat="published"] strong')).toHaveText('0');
  await expect(page.locator('.dashboard-table')).toContainText('生成成功');
});

test('任务列表执行指定任务，日历区分任务计划与无归属日志并兼容旧地址', async ({ page }) => {
  await page.goto('/?autoSyncTask#/sync:list');
  await expect(page.getByRole('heading', { name: '同步任务', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/#\/sync\?tab=list$/);
  await page.getByRole('button', { name: '新增同步任务', exact: true }).click();
  await page.locator('.auto-sync-task-card').nth(1).getByPlaceholder('任务名称').fill('产品同步');
  await page.evaluate(() => {
    window.api.validateAutoSync = async () => ({ valid: true, message: '', results: [] });
    window.api.runAutoSyncNow = async (config, taskId) => {
      const task = config.autoSync.tasks.find(item => item.id === taskId)!;
      const taskState = { ...task, lastStatus: 'success' as const, lastMessage: `已执行任务 ${task.name}`, lastRunAt: new Date().toISOString(), nextRunAt: '', isRunning: false };
      window.api.getAutoSyncState = async () => ({ enabled: false, tasks: config.autoSync.tasks.map(item => item.id === taskId ? taskState : { ...item, nextRunAt: '', isRunning: false }), isRunning: false, runningTaskId: '', nextRunAt: '', nextRunTaskId: '' });
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const date = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      window.api.listSyncLogs = async () => [{ id: 41, date, triggerType: 'manual', status: 'success', message: '补发昨日日报', ranAt: taskState.lastRunAt }];
      return { status: 'success', message: taskState.lastMessage, ranAt: taskState.lastRunAt, nextRunAt: '', taskResults: [{ taskId: taskState.id, taskName: taskState.name, status: 'success', message: taskState.lastMessage }] };
    };
  });
  await page.locator('.auto-sync-task-card').nth(1).getByRole('button', { name: '立即执行一次', exact: true }).click();
  await expect(page.locator('.auto-sync-task-card').nth(1).locator('.auto-sync-message')).toContainText('已执行任务 产品同步');
  await expect(page.locator('.auto-sync-task-card').nth(0).locator('.auto-sync-message')).toHaveCount(0);
  await page.getByRole('tab', { name: '任务日历', exact: true }).click();
  await expect(page).toHaveURL(/#\/sync\?tab=calendar$/);
  await expect(page.getByRole('heading', { name: '当日任务计划', exact: true })).toBeVisible();
  await expect(page.locator('.sync-day-plans')).toContainText('已有任务');
  await expect(page.locator('.sync-day-plans')).toContainText('产品同步');
  await expect(page.locator('.sync-day-plans')).toContainText('总开关已关闭');
  await expect(page.locator('.sync-day-logs')).toContainText('补发昨日日报');
  await expect(page.locator('.sync-day-logs')).toContainText('以下记录不归属到具体任务');
  const yesterday = await page.evaluate(() => {
    const date = new Date(); date.setDate(date.getDate() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  await page.getByRole('button', { name: `查看 ${yesterday} 的计划和记录`, exact: true }).click();
  await expect(page.locator('.sync-day-plans')).toContainText('历史日期只展示执行记录');
  await expect(page.locator('.sync-day-logs')).not.toContainText('补发昨日日报');
  await page.getByRole('menuitem', { name: '消息中心', exact: true }).click();
  await expect(page.getByRole('button').filter({ hasText: '自动同步：产品同步' })).toContainText('已执行任务 产品同步');
  await page.goto('/?autoSyncTask#/sync:calendar');
  await expect(page).toHaveURL(/#\/sync\?tab=calendar$/);
  await expect(page.getByRole('tab', { name: '任务日历', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('系统设置可复制真实本地数据目录', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/#/system');
  await expect(page.getByRole('heading', { name: '系统设置', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const original = window.api.getStorageInfo;
    window.api.getStorageInfo = async () => ({ ...await original(), userDataPath: 'D:\\GitInsight\\本地数据' });
  });
  await page.getByRole('button', { name: '刷新状态', exact: true }).click();
  await page.getByRole('button', { name: '复制目录', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('D:\\GitInsight\\本地数据');
});

test('生成来源按当前草稿展示提交、文件与原始摘要', async ({ page }) => {
  await page.goto('/#/generate');
  await expect(page.getByRole('button', { name: '重新生成当前项目', exact: true })).toBeEnabled();
  await page.evaluate(() => {
    const generate = window.api.generateReport;
    window.api.generateReport = async payload => {
      const result = await generate(payload);
      return { ...result, rawInput: { gitLogs: '提交原始日志', files: 'list.ts', diff: '分页差异摘要' } };
    };
  });
  await page.getByRole('button', { name: '重新生成当前项目', exact: true }).click();
  await expect(page.locator('.editable-report textarea')).toHaveValue(/Project A/);
  await page.getByRole('button', { name: '查看生成来源', exact: true }).click();
  await expect(page.locator('.report-source-details')).toContainText('修复列表查询');
  await page.getByRole('tab', { name: '影响文件（1）', exact: true }).click();
  await expect(page.locator('.report-source-files')).toHaveText('list.ts');
  await page.getByRole('tab', { name: '原始摘要', exact: true }).click();
  await expect(page.getByText('分页差异摘要', { exact: true })).toBeVisible();
  await page.getByRole('tab').filter({ hasText: 'Project B' }).first().click();
  await expect(page.locator('.report-source-details')).not.toBeVisible();
});

for (const theme of ['light', 'dark']) {
  for (const width of [900, 1366]) {
    test(`恢复页面在 ${theme} ${width}px 下可阅读且无页面横向溢出`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(value => localStorage.setItem('gitinsight:theme-mode', value), theme);
      await loadActivity(page);
      for (const [route, heading] of [['dashboard', '工作台'], ['repositories', '仓库中心'], ['messages', '消息中心'], ['help', '使用帮助'], ['sync?tab=calendar', '同步任务']]) {
        await page.evaluate(value => { location.hash = `/${value}`; }, route);
        await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
        if (route === 'repositories') await expect(page.locator('.repo-center-copy strong').first()).toBeVisible();
        const layout = await page.locator('.app-scroll').evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth, viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
        expect(layout.scroll, route).toBeLessThanOrEqual(layout.width + 1);
        expect(layout.page, route).toBeLessThanOrEqual(layout.viewport + 1);
        await page.screenshot({ path: `output/playwright/unified-pages/${route.split('?')[0]}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
      }
    });
  }
}
