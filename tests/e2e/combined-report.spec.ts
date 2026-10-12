import { test, expect } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/#/generate');
  await expect(page.getByRole('button', { name: '重新生成当前项目', exact: true })).toBeEnabled();
  await page.evaluate(async () => {
    const repos = await window.api.scanRepositories('/workspace');
    window.api.generateReport = async (payload) => {
      window.reportTest.generations.push(structuredClone(payload));
      const sources = repos.filter((repo) => payload.repoPaths.includes(repo.path));
      return {
        report: sources.map((repo) => `${repo.name} 完成列表查询与分页验证`).join('\n'),
        repos: sources, historyId: 201,
        commits: sources.map((repo, index) => ({ hash: `commit-${index}`, message: `${repo.name} 修复查询`, author: '测试用户', date: payload.date, files: [`${repo.path}/list.ts`] })),
        generatedAt: new Date().toISOString(),
        timeRange: { startDateTime: payload.startDateTime!, endDateTime: payload.endDateTime!, label: '测试范围' },
        rawInput: { gitLogs: '两个仓库的原始日志', files: 'a/list.ts\nb/list.ts', diff: '原始变更', manualWorkContent: payload.manualWorkContent },
      };
    };
  });
});

test('两仓库合篇只生成、保存和发布一篇，并保留完整来源', async ({ page }) => {
  await page.getByRole('button', { name: '合并生成一篇', exact: true }).click();
  const editor = page.locator('.editable-report textarea');
  await expect(editor).toHaveValue(/Project A.*\nProject B/);
  await expect(page.locator('.project-tabs [role=tab]')).toHaveCount(1);
  await expect(page.locator('.project-tabs [role=tab]')).toContainText('合并');
  await editor.fill('合并编辑后的工作记录');
  await page.getByRole('button', { name: '发布全部已生成项目', exact: true }).click();
  await page.getByRole('button', { name: '确认发布', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.reportTest.submissions.length)).toBe(1);
  const { generations, saves, submissions } = await page.evaluate(() => window.reportTest);
  expect(generations).toHaveLength(1);
  expect(generations[0].repoPaths).toEqual(['/workspace/a', '/workspace/b']);
  expect(saves).toHaveLength(1);
  expect(saves[0].repoPaths).toEqual(['/workspace/a', '/workspace/b']);
  expect(saves[0].repoNames).toEqual(['Project A', 'Project B']);
  expect(submissions[0].report).toBe('合并编辑后的工作记录');
  expect(submissions[0].reportId).toBe(saves[0].id);
  await expect(page.getByRole('button', { name: '发布全部已生成项目', exact: true })).toBeDisabled();
});

test('历史合篇继续编辑保留原始素材和统计，切回逐项目后分别生成', async ({ page }) => {
  await page.evaluate(() => {
    const record = {
      id: 44, date: '2026-10-12', reporterName: '测试用户', repoNames: ['Project A', 'Project B'],
      repoPaths: ['/workspace/a', '/workspace/b'], report: '历史合篇正文', status: 'success' as const,
      commitsCount: 4, filesCount: 7, generatedAt: '2026-10-12T09:00:00.000Z', updatedAt: '2026-10-12T09:00:00.000Z',
      rawInput: { gitLogs: '历史原始日志', files: 'a.ts\nb.ts', diff: '历史变更', manualWorkContent: '历史补充素材' },
    };
    window.api.listDailyReports = async () => [record];
    window.api.listHistoryProjects = async () => record.repoNames;
    window.api.queryHistoryLogs = async () => ({
      records: [{ id: 'report-44', numericId: 44, time: record.generatedAt, type: '日报生成', project: 'Project A、Project B', action: '合篇回归记录', status: 'success', duration: '-', operator: record.reporterName, trigger: '手动', detail: record.report, reportRecord: record }],
      total: 1, page: 1, pageSize: 10,
    });
  });
  await page.getByRole('button', { name: '生成记录', exact: true }).click();
  await page.getByText('合篇回归记录', { exact: true }).click();
  await page.getByRole('button', { name: '继续编辑', exact: true }).click();
  await expect(page.locator('.project-tabs [role=tab]')).toHaveCount(1);
  await expect(page.locator('.editable-report textarea')).toHaveValue('历史合篇正文');
  await expect(page.locator('.manual-work-field textarea')).toHaveValue('历史补充素材');
  await page.locator('.editable-report textarea').fill('历史合篇修改');
  await page.getByRole('button', { name: '保存当前', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.reportTest.saves.length)).toBe(1);
  const saved = await page.evaluate(() => window.reportTest.saves[0]);
  expect(saved.id).toBe(44);
  expect(saved.repoPaths).toEqual(['/workspace/a', '/workspace/b']);
  expect(saved.commitsCount).toBe(4);
  expect(saved.filesCount).toBe(7);
  expect(saved.rawInput).toEqual({ gitLogs: '历史原始日志', files: 'a.ts\nb.ts', diff: '历史变更', manualWorkContent: '历史补充素材' });
  await page.getByRole('button', { name: '按项目分别生成', exact: true }).click();
  await page.getByRole('button', { name: '确认切换', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.reportTest.generations.length)).toBe(2);
  expect(await page.evaluate(() => window.reportTest.generations.map((item) => item.repoPaths))).toEqual([['/workspace/a'], ['/workspace/b']]);
  await expect(page.locator('.project-tabs [role=tab]')).toHaveCount(2);
});

test('取消合篇仓库范围变更保留手动修改与原来源', async ({ page }) => {
  await page.getByRole('button', { name: '合并生成一篇', exact: true }).click();
  await expect(page.locator('.editable-report textarea')).toHaveValue(/Project A/);
  await page.locator('.editable-report textarea').fill('保留我的合篇修改');
  await page.locator('.repo-picker-trigger').click();
  await page.locator('.repo-picker-main').filter({ hasText: 'Project B' }).click();
  await page.getByRole('button', { name: '保留当前日报', exact: true }).click();
  await expect(page.locator('.editable-report textarea')).toHaveValue('保留我的合篇修改');
  await expect(page.locator('.repo-picker-item.active')).toHaveCount(2);
  await expect(page.locator('.project-tabs [role=tab]')).toHaveCount(1);
});

for (const combined of [false, true]) {
  test(`${combined ? '合篇切到单篇' : '逐项目切到合篇'}历史续编先确认，取消保留草稿与范围`, async ({ page }) => {
    if (combined) {
      await page.getByRole('button', { name: '合并生成一篇', exact: true }).click();
    } else {
      await page.getByRole('button', { name: '重新生成当前项目', exact: true }).click();
    }
    const editor = page.locator('.editable-report textarea');
    const material = page.locator('.manual-work-field textarea');
    const date = page.locator('.report-setup-card .field').filter({ has: page.locator('label', { hasText: /^日报日期$/ }) }).locator('input');
    await expect(editor).toHaveValue(/Project A/);
    await editor.fill('尚未保存的正文');
    await material.fill('尚未保存的补充素材');
    const originalDate = await date.inputValue();
    const originalStart = await page.getByPlaceholder('开始时间', { exact: true }).inputValue();
    const originalEnd = await page.getByPlaceholder('结束时间', { exact: true }).inputValue();
    await page.evaluate(singleHistory => {
      const record = {
        id: 45, date: '2026-09-01', reporterName: '历史汇报人',
        repoNames: singleHistory ? ['Project C'] : ['Project C', 'Project D'],
        repoPaths: singleHistory ? ['/workspace/c'] : ['/workspace/c', '/workspace/d'],
        report: '需要恢复的历史正文', status: 'success' as const, commitsCount: 1, filesCount: 1,
        generatedAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-01T09:00:00.000Z',
      };
      window.api.listDailyReports = async () => [record];
      window.api.listHistoryProjects = async () => record.repoNames;
      window.api.queryHistoryLogs = async () => ({
        records: [{ id: 'report-45', numericId: 45, time: record.generatedAt, type: '日报生成', project: record.repoNames.join('、'), action: '覆盖保护回归记录', status: 'success', duration: '-', operator: record.reporterName, trigger: '手动', detail: record.report, reportRecord: record }],
        total: 1, page: 1, pageSize: 10,
      });
    }, combined);
    await page.getByRole('button', { name: '生成记录', exact: true }).click();
    await page.getByText('覆盖保护回归记录', { exact: true }).click();
    await page.getByRole('button', { name: '继续编辑', exact: true }).click();
    await page.getByRole('button', { name: '保留当前日报', exact: true }).click();
    await expect(page).toHaveURL(/#\/history$/);
    await page.locator('.history-detail-drawer .panel-head button').click();
    await page.getByRole('menuitem', { name: '写今日日报', exact: true }).click();
    await expect(editor).toHaveValue('尚未保存的正文');
    await expect(material).toHaveValue('尚未保存的补充素材');
    await expect(date).toHaveValue(originalDate);
    await expect(page.getByPlaceholder('开始时间', { exact: true })).toHaveValue(originalStart);
    await expect(page.getByPlaceholder('结束时间', { exact: true })).toHaveValue(originalEnd);
    await page.getByRole('button', { name: '保存当前', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.reportTest.saves.length)).toBe(1);
    expect(await page.evaluate(() => window.reportTest.saves[0].reporterName)).toBe('测试用户');
    expect(await page.evaluate(() => window.reportTest.saves[0].repoPaths)).toEqual(combined ? ['/workspace/a', '/workspace/b'] : ['/workspace/a']);

    await editor.fill('确认放弃的正文');
    await page.getByRole('button', { name: '生成记录', exact: true }).click();
    await page.getByText('覆盖保护回归记录', { exact: true }).click();
    await page.getByRole('button', { name: '继续编辑', exact: true }).click();
    await page.getByRole('button', { name: '加载历史日报', exact: true }).click();
    await expect(editor).toHaveValue('需要恢复的历史正文');
    await expect(date).toHaveValue('2026-09-01');
    await expect(page.locator('.project-tabs [role=tab]')).toHaveCount(combined ? 3 : 1);
  });
}
