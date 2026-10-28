import { readFile, mkdir } from 'node:fs/promises';
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

async function openCards(page: Page, empty = false) {
  await page.goto('/?coinsBalance=10000000#/coins');
  await expect(page.locator('[data-coin-balance]')).toBeVisible();
  await page.evaluate(empty => {
    window.api.getTimelineSnapshot = async () => ({ records: empty ? [] : [
      { id: 1, reportId: 1, date: '2026-10-01', title: '发布首个版本', summary: '', primaryType: '功能开发', workTypes: [], projects: ['Alpha'], repoPaths: [], techTags: ['Vue', 'TypeScript'], commitHashes: [], commitsCount: 12, filesCount: 24, milestone: true, createdAt: '', updatedAt: '' },
      { id: 2, reportId: 2, date: '2026-10-02', title: '性能优化', summary: '', primaryType: '性能优化', workTypes: [], projects: ['Beta'], repoPaths: [], techTags: ['SQL'], commitHashes: [], commitsCount: 2, filesCount: 4, milestone: false, createdAt: '', updatedAt: '' },
    ], days: [], total: empty ? 0 : 2, summary: { activeDays: 2, totalCommits: 14, totalFiles: 28, milestones: 1, projects: ['Alpha', 'Beta'] } });
  }, empty);
  await page.getByRole('tab', { name: '工作纪念卡' }).click();
  await page.getByLabel('开始日期', { exact: true }).fill('2026-10-01');
  await page.getByLabel('结束日期', { exact: true }).fill('2026-10-28');
}

test('纪念卡预览、购买、筛选、SVG导出、账本及永久解锁', async ({ page }) => {
  await openCards(page);
  await expect(page.getByRole('img', { name: '工作纪念卡预览' })).toBeVisible();
  await expect(page.getByRole('button', { name: '导出 SVG' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '导出 PNG' })).toBeDisabled();
  await page.locator('[data-product="card-paper"]').getByRole('button', { name: '解锁卡面' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认购买', exact: true }).click();
  await expect(page.locator('[data-coin-balance]')).toContainText('9,500,000');
  await page.getByLabel('纪念卡项目').selectOption('Alpha');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 SVG' }).click();
  const download = await downloadPromise;
  const svg = await readFile((await download.path())!, 'utf8');
  expect(svg).toContain('Alpha'); expect(svg).not.toContain('Beta'); expect(svg).toContain('发布首个版本');
  const pngDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 PNG' }).click();
  const pngDownload = await pngDownloadPromise;
  expect(pngDownload.suggestedFilename()).toBe('工作纪念卡-2026-10-01-2026-10-28-card-paper.png');
  const png = await readFile((await pngDownload.path())!);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.readUInt32BE(16)).toBe(2400);
  expect(png.readUInt32BE(20)).toBe(1640);
  await expect(page.locator('[data-coin-balance]')).toContainText('9,500,000');
  await mkdir('output/playwright/work-memory-cards', { recursive: true });
  await page.locator('.memory-products').screenshot({ path: 'output/playwright/work-memory-cards/shop.png' });
  await page.locator('.memory-preview').screenshot({ path: 'output/playwright/work-memory-cards/paper.png' });
  for (const id of ['card-blueprint', 'card-orbit']) {
    await page.locator(`[data-product="${id}"] .memory-select`).click();
    await expect(page.getByRole('button', { name: '导出 SVG' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '导出 PNG' })).toBeDisabled();
    await page.locator('.memory-preview').screenshot({ path: `output/playwright/work-memory-cards/${id}.png` });
  }
  await page.getByRole('tab', { name: '收支明细' }).click();
  await expect(page.locator('.coin-ledger-table')).toContainText('购买时光纸笺');
  await page.reload();
  await page.getByRole('tab', { name: '工作纪念卡' }).click();
  await expect(page.locator('[data-product="card-paper"]')).toContainText('已永久解锁');
});

test('空数据、日期倒置和读取错误禁止导出且可重试', async ({ page }) => {
  await openCards(page, true);
  await expect(page.getByText('该范围暂无工作记录，保存日报后再来制作纪念卡。')).toBeVisible();
  await expect(page.getByRole('button', { name: '导出 SVG' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '导出 PNG' })).toBeDisabled();
  await page.getByLabel('开始日期', { exact: true }).fill('2027-01-01');
  await expect(page.getByText('请选择有效的起止日期，开始日期不能晚于结束日期。')).toBeVisible();
  await page.evaluate(() => { window.api.getTimelineSnapshot = async () => { throw new Error('数据暂不可用'); }; });
  await page.getByRole('button', { name: '刷新数据' }).click();
  await expect(page.getByText('数据暂不可用')).toBeVisible();
  await page.evaluate(() => { window.api.getTimelineSnapshot = async () => ({ records: [], days: [], total: 0, summary: { activeDays: 0, totalCommits: 0, totalFiles: 0, milestones: 0, projects: [] } }); });
  await page.getByLabel('开始日期', { exact: true }).fill('2026-01-01');
  await page.getByRole('button', { name: '刷新数据' }).click();
  await expect(page.getByText('该范围暂无工作记录，保存日报后再来制作纪念卡。')).toBeVisible();
});

test('PNG 生成失败后可重试导出', async ({ page }) => {
  await openCards(page);
  await page.locator('[data-product="card-paper"]').getByRole('button', { name: '解锁卡面' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认购买', exact: true }).click();
  await expect(page.getByRole('button', { name: '导出 PNG' })).toBeEnabled();
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      HTMLCanvasElement.prototype.toBlob = original;
      callback(null);
    };
  });
  await page.getByRole('button', { name: '导出 PNG' }).click();
  await expect(page.getByText('PNG 生成失败，请重试')).toBeVisible();
  await expect(page.getByRole('button', { name: '导出 PNG' })).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 PNG' }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/\.png$/);
});
