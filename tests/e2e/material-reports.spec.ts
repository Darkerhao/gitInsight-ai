import { test, expect } from './fixtures';
import type { DailyReportRecord, GenerateFromMaterialParams, RoleMaterialPayload, SaveDailyReportPayload, SyncFeishuDailyPayload } from '../../src/shared/types';

declare global {
  interface Window {
    materialTest: {
      failGenerate: boolean;
      failSave: boolean;
      holdGenerate: boolean;
      finishGenerate: () => void;
      gitCalls: number;
      materials: Record<string, RoleMaterialPayload>;
      reports: DailyReportRecord[];
      generations: GenerateFromMaterialParams[];
      saves: SaveDailyReportPayload[];
      submissions: SyncFeishuDailyPayload[];
    };
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const oldMaterial: RoleMaterialPayload = { role: 'projectManager', date: '2026-10-12',
      sections: [{ key: 'progress', label: '今日推进事项', content: '旧版项目推进素材' }], extraNotes: '旧版会议结论' };
    const productMaterial: RoleMaterialPayload = { role: 'productManager', date: '2026-10-13',
      sections: [{ key: 'requirement', label: '需求进展', content: '已确认产品需求' }], extraNotes: '' };
    const state: Window['materialTest'] = window.materialTest = {
      failGenerate: false, failSave: false, holdGenerate: false, finishGenerate: () => {}, gitCalls: 0,
      materials: { 'projectManager:2026-10-12': oldMaterial, 'productManager:2026-10-13': productMaterial },
      reports: [{ id: 301, date: '2026-10-13', reporterName: '测试用户', repoNames: ['产品经理'], repoPaths: [],
        report: '产品历史正文', materialRole: 'productManager', material: productMaterial, status: 'draft',
        commitsCount: 0, filesCount: 0, generatedAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z' }],
      generations: [], saves: [], submissions: [],
    };
    function install(api: Window['api']) {
      const loadConfig = api.loadConfig;
      Object.assign(api, {
        loadConfig: async () => ({ ...await loadConfig(), workspaceDir: '', workspaceDirs: [], selectedRepoPaths: [] }),
        scanRepositories: async () => { state.gitCalls++; throw new Error('不应扫描 Git'); },
        generateReport: async () => { state.gitCalls++; throw new Error('不应从 Git 生成'); },
        loadRoleMaterial: async (role: string, date: string) => structuredClone(state.materials[`${role}:${date}`] ?? null),
        loadMaterialReport: async (role: string, date: string) => structuredClone(state.reports.find(item => item.materialRole === role && item.date === date) ?? null),
        getDailyReport: async (id: number) => structuredClone(state.reports.find(item => item.id === id) ?? null),
        saveRoleMaterial: async (payload: RoleMaterialPayload) => {
          state.materials[`${payload.role}:${payload.date}`] = structuredClone(payload);
          return { ...payload, updatedAt: new Date().toISOString() };
        },
        generateReportFromMaterial: async (payload: GenerateFromMaterialParams) => {
          structuredClone(payload);
          state.generations.push(payload);
          if (state.holdGenerate) await new Promise<void>(resolve => { state.finishGenerate = resolve; });
          if (state.failGenerate) throw new Error('素材生成失败，请重试');
          return { role: payload.role, date: payload.date, generatedAt: new Date().toISOString(),
            report: `素材日报：${payload.sections.filter(item => item.content).map(item => item.content).join('；')}` };
        },
        saveDailyReport: async (payload: SaveDailyReportPayload) => {
          structuredClone(payload);
          if (state.failSave) throw new Error('保存日报失败，请稍后重试');
          state.saves.push(payload);
          const record = { ...payload, id: payload.id ?? 302 + state.reports.length, materialRole: payload.rawInput?.materialRole,
            material: payload.rawInput?.material, published: false, generatedAt: payload.generatedAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() };
          state.reports = [...state.reports.filter(item => item.id !== record.id), record];
          return record;
        },
        syncFeishuDaily: async (payload: SyncFeishuDailyPayload) => {
          structuredClone(payload); state.submissions.push(payload);
          state.reports.find(item => item.id === payload.reportId)!.published = true;
          return { success: true };
        },
        listDailyReports: async () => structuredClone(state.reports),
        listHistoryProjects: async () => ['项目经理', '产品经理'],
        queryHistoryLogs: async () => ({ total: state.reports.length, page: 1, pageSize: 10,
          records: state.reports.map(record => ({ id: `report-${record.id}`, numericId: record.id, time: record.generatedAt,
            type: '日报生成', project: record.repoNames.join('、'), action: `生成 ${record.date} 日报`, status: 'success', duration: '—',
            operator: record.reporterName, trigger: '手动', detail: record.report, reportRecord: structuredClone(record) })) }),
      });
      return api;
    }
    // Init-script ordering is unspecified; support either order with the shared fixture.
    let api = window.api;
    if (api) install(api);
    else Object.defineProperty(window, 'api', { configurable: true, get: () => api, set: value => { api = install(value); } });
  });
  await page.goto('/#/material?date=2026-10-12');
  await expect(page.getByRole('heading', { name: '素材日报', exact: true })).toBeVisible();
  await expect(page.getByLabel('今日推进事项', { exact: true })).toHaveValue('旧版项目推进素材');
});

test('无需仓库完成素材保存、生成、手改、复制导出与发布，失败保留正文', async ({ page }) => {
  await page.getByLabel('今日推进事项', { exact: true }).fill('完成项目里程碑评审');
  await page.getByRole('button', { name: '保存素材', exact: true }).click();
  await expect(page.locator('.material-status')).toHaveText('素材已保存');
  await page.getByRole('button', { name: '生成素材日报', exact: true }).click();
  await expect(page.getByLabel('日报正文', { exact: true })).toHaveValue('素材日报：完成项目里程碑评审');
  await page.getByLabel('日报正文', { exact: true }).fill('手改正文：推进里程碑，明确后续安排');
  await page.evaluate(() => { window.materialTest.failGenerate = true; });
  await page.getByRole('button', { name: '生成素材日报', exact: true }).click();
  await expect(page.locator('.material-error')).toContainText('素材生成失败');
  await expect(page.getByLabel('日报正文', { exact: true })).toHaveValue('手改正文：推进里程碑，明确后续安排');
  await page.evaluate(() => { window.materialTest.failSave = true; });
  const publish = async () => {
    await page.getByRole('button', { name: '发布素材日报', exact: true }).click();
    await page.getByRole('button', { name: '确认发布', exact: true }).click();
  };
  await publish();
  await expect(page.locator('.material-error')).toContainText('保存日报失败');
  expect(await page.evaluate(() => window.materialTest.submissions.length)).toBe(0);
  await page.evaluate(() => { window.materialTest.failSave = false; });
  await page.getByRole('button', { name: '复制', exact: true }).click();
  await expect(page.getByText('日报已复制', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 Markdown', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('2026-10-12-项目经理日报.md');
  await publish();
  await expect(page.getByRole('button', { name: '已提交飞书', exact: true })).toBeDisabled();
  const state = await page.evaluate(() => window.materialTest);
  expect(state.gitCalls).toBe(0);
  expect(state.submissions).toHaveLength(1);
  expect(state.submissions[0].report).toBe('手改正文：推进里程碑，明确后续安排');
  expect(state.saves.at(-1)?.rawInput?.materialRole).toBe('projectManager');
  expect(state.saves.at(-1)?.repoPaths).toEqual([]);
  await page.getByRole('button', { name: '产品经理', exact: true }).click();
  await expect(page.getByLabel('日报正文', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: '项目经理', exact: true }).click();
  await expect(page.getByRole('button', { name: '已提交飞书', exact: true })).toBeDisabled();
  await page.getByLabel('日报正文', { exact: true }).fill('发布后的后续编辑');
  await expect(page.getByRole('button', { name: '发布素材日报', exact: true })).toBeEnabled();
});

test('角色日期切换保护未保存内容，操作期间不串用上下文，历史恢复角色日期及记录 ID', async ({ page }) => {
  const report = page.getByLabel('日报正文', { exact: true });
  await report.fill('项目经理 12 日手改内容');
  await page.getByRole('button', { name: '产品经理', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '未保存的修改' })).toBeVisible();
  await page.getByRole('button', { name: '继续编辑', exact: true }).click();
  await expect(report).toHaveValue('项目经理 12 日手改内容');
  await page.getByRole('button', { name: '保存日报', exact: true }).click();
  await expect(page.locator('.material-status')).toHaveText('日报已保存到历史日志');
  await page.getByRole('button', { name: '产品经理', exact: true }).click();
  await expect(report).toHaveValue('');
  await expect(page.getByLabel('需求进展', { exact: true })).toHaveValue('');
  await page.getByLabel('需求进展', { exact: true }).fill('产品 12 日需求进展');
  await report.fill('产品 12 日正文');
  await page.getByRole('button', { name: '保存日报', exact: true }).click();
  await expect(page.locator('.material-status')).toHaveText('日报已保存到历史日志');
  await page.getByLabel('日报日期', { exact: true }).fill('2026-10-13');
  await expect(report).toHaveValue('产品历史正文');
  await expect(page.getByLabel('需求进展', { exact: true })).toHaveValue('已确认产品需求');
  await page.evaluate(() => { window.materialTest.holdGenerate = true; });
  await page.getByRole('button', { name: '生成素材日报', exact: true }).click();
  await expect(page.getByRole('button', { name: '项目经理', exact: true })).toBeDisabled();
  await expect(page.getByLabel('日报日期', { exact: true })).toBeDisabled();
  await page.evaluate(() => window.materialTest.finishGenerate());
  await expect(report).toHaveValue('素材日报：已确认产品需求');
  await page.getByRole('button', { name: '保存日报', exact: true }).click();
  await expect(page.locator('.material-status')).toHaveText('日报已保存到历史日志');
  await page.getByRole('button', { name: '历史日志', exact: true }).click();
  await expect(page.getByRole('heading', { name: '历史日志', exact: true })).toBeVisible();
  await page.locator('tbody tr').filter({ hasText: '2026-10-13' }).first().click();
  await page.getByRole('button', { name: '继续编辑', exact: true }).click();
  await expect(page).toHaveURL(/material\?role=productManager&date=2026-10-13&reportId=301/);
  await expect(page.getByLabel('日报日期', { exact: true })).toHaveValue('2026-10-13');
  await expect(report).toHaveValue('素材日报：已确认产品需求');
  await report.fill('历史续编后的产品正文');
  await page.getByRole('button', { name: '保存日报', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.materialTest.saves.at(-1)?.report)).toBe('历史续编后的产品正文');
  const saves = await page.evaluate(() => window.materialTest.saves);
  expect(saves.at(-1)?.id).toBe(301);
  expect(saves.at(-1)?.repoPaths).toEqual([]);
  expect(saves.at(-1)?.rawInput?.materialRole).toBe('productManager');
});
