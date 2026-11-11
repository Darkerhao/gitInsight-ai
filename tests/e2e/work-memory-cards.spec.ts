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
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openCards(page);
  await expect(page.getByRole('img', { name: '工作纪念卡预览' })).toBeVisible();
  await expect(page.getByRole('button', { name: '导出 SVG' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '导出 PNG' })).toBeDisabled();
  await page.locator('[data-product="card-paper"]').getByRole('button', { name: '解锁卡面' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认购买', exact: true }).click();
  await expect(page.locator('[data-coin-balance]')).toContainText('9,500,000');
  await page.getByLabel('纪念卡项目').selectOption('Alpha');
  await page.locator('.memory-preview').hover({ position: { x: 30, y: 30 } });
  await expect(page.locator('.memory-preview')).toHaveAttribute('data-tilting', '');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 SVG' }).click();
  const download = await downloadPromise;
  const svg = await readFile((await download.path())!, 'utf8');
  expect(svg).toContain('Alpha'); expect(svg).not.toContain('Beta'); expect(svg).toContain('发布首个版本');
  expect(svg).not.toMatch(/card-tilt|card-shine|data-tilting/);
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

test('三款大预览倾斜、离开和切卡复位，操作栏保持固定', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openCards(page);
  const preview = page.locator('.memory-preview');
  for (const id of ['card-paper', 'card-blueprint', 'card-orbit']) {
    await page.locator(`[data-product="${id}"] .memory-select`).click();
    await expect(preview).not.toHaveAttribute('data-tilting');
    await preview.scrollIntoViewIfNeeded();
    const before = await page.locator('.memory-export').boundingBox();
    await preview.hover({ position: { x: 30, y: 30 } });
    await expect(preview).toHaveAttribute('data-tilting', '');
    const angles = await preview.evaluate(element => ['--card-tilt-x', '--card-tilt-y'].map(name => Number.parseFloat((element as HTMLElement).style.getPropertyValue(name))));
    expect(angles.some(angle => Math.abs(angle) > 1)).toBe(true);
    expect(angles.every(angle => Math.abs(angle) <= 5)).toBe(true);
    expect(await page.locator('.memory-export').boundingBox()).toEqual(before);
    await preview.dispatchEvent('pointercancel', { pointerType: 'mouse' });
    await expect(preview).not.toHaveAttribute('data-tilting');
    await preview.dispatchEvent('pointermove', { pointerType: 'touch', clientX: 100, clientY: 100 });
    await expect(preview).not.toHaveAttribute('data-tilting');
  }
  await preview.hover({ position: { x: 30, y: 30 } });
  await expect(preview).toHaveAttribute('data-tilting', '');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(preview).not.toHaveAttribute('data-tilting');
  await expect(page.locator('.memory-card-surface')).toHaveCSS('transform', 'none');
  await preview.dispatchEvent('pointermove', { pointerType: 'mouse', clientX: 100, clientY: 100 });
  await expect(preview).not.toHaveAttribute('data-tilting');
  await page.locator('[data-product="card-paper"] .memory-select').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.memory-card-surface')).toHaveAttribute('data-card-id', 'card-paper');
});

test('纪念卡卸载会取消待执行的指针帧，不污染下一页', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openCards(page);
  const cleanup = await page.evaluate(async () => {
    const preview = document.querySelector<HTMLElement>('.memory-preview')!;
    const originalFrame = window.requestAnimationFrame;
    const originalCancel = window.cancelAnimationFrame;
    let captured: FrameRequestCallback | undefined;
    let cancelled = false;
    window.requestAnimationFrame = callback => { captured = callback; return 999999; };
    window.cancelAnimationFrame = id => { if (id === 999999) cancelled = true; else originalCancel(id); };
    try {
      const rect = preview.getBoundingClientRect();
      preview.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: rect.left + 20, clientY: rect.top + 20 }));
      window.requestAnimationFrame = originalFrame;
      location.hash = '#/history';
      for (let attempt = 0; preview.isConnected && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 10));
      captured?.(performance.now());
      return { queued: Boolean(captured), cancelled, removed: !preview.isConnected, residualAngle: preview.style.getPropertyValue('--card-tilt-x') };
    } finally {
      window.requestAnimationFrame = originalFrame;
      window.cancelAnimationFrame = originalCancel;
    }
  });
  expect(cleanup).toEqual({ queued: true, cancelled: true, removed: true, residualAngle: '' });
  await expect(page.getByRole('heading', { name: '历史日志', exact: true })).toBeVisible();
});

test('纪念卡和工坊在目标窗口与深浅主题下清晰展示', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openCards(page);
  await mkdir('output/playwright/motion', { recursive: true });
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1024, height: 640 }]) {
    await page.setViewportSize(viewport);
    for (const mode of ['dark', 'light']) {
      const current = await page.locator('html').getAttribute('data-theme');
      if (current !== mode) await page.getByRole('button', { name: mode === 'dark' ? '切换深色模式' : '切换浅色模式', exact: true }).click();
      await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition');
      await page.locator('.app-scroll').evaluate(element => { element.scrollTop = 0; });
      await expect.poll(() => page.locator('.app-scroll').evaluate(element => element.scrollTop)).toBe(0);
      expect(await page.locator('.app-scroll').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.screenshot({ path: `output/playwright/motion/workshop-${viewport.width}-${mode}.png`, animations: 'disabled' });
      const id = mode === 'dark' ? 'card-orbit' : 'card-paper';
      await page.locator(`[data-product="${id}"] .memory-select`).click();
      await page.locator('.memory-preview').scrollIntoViewIfNeeded();
      await page.locator('.memory-preview').hover({ position: { x: 30, y: 30 } });
      await expect(page.locator('.memory-preview')).toHaveAttribute('data-tilting', '');
      await page.locator('.memory-stage').screenshot({ path: `output/playwright/motion/card-${viewport.width}-${mode}.png`, animations: 'disabled' });
      await page.getByRole('button', { name: '导出 SVG', exact: true }).scrollIntoViewIfNeeded();
      await expect(page.getByRole('button', { name: '导出 PNG', exact: true })).toBeVisible();
    }
  }
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
