import { mkdir } from 'node:fs/promises';
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const output = 'output/playwright/coin-workshop';

async function openWorkshop(page: Page, query = 'coinsBalance=10000000') {
  await page.goto(`/?${query}#/coins`);
  await expect(page.getByRole('heading', { name: '码币工坊', exact: true })).toBeVisible();
  await expect(page.locator('[data-coin-balance]')).toBeVisible();
}

async function buy(page: Page, id: string) {
  await page.locator(`[data-product="${id}"]`).getByRole('button').click();
  await page.getByRole('dialog').getByRole('button', { name: '确认购买', exact: true }).click();
}

test('装扮购买扣币、装备切换及重载均保留，默认装扮恢复原配色', async ({ page }) => {
  await openWorkshop(page);
  await expect(page.locator('.topbar-coin-btn')).toContainText('10,000,000');
  const originalColor = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c-primary'));
  await buy(page, 'theme-ocean');
  await expect(page.locator('[data-coin-balance]')).toContainText('9,000,000');
  await expect(page.locator('.topbar-coin-btn')).toContainText('9,000,000');
  await expect(page.locator('[data-product="theme-ocean"]')).toContainText('已拥有');
  await page.locator('[data-product="theme-ocean"]').getByRole('button', { name: '使用装扮' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-coin-theme', 'theme-ocean');
  await expect(page.locator('[data-product="theme-ocean"] button')).toBeDisabled();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c-primary'))).not.toBe(originalColor);
  expect(await page.evaluate(() => window.reportTest.coinPurchases)).toEqual(['theme-ocean']);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-coin-theme', 'theme-ocean');
  await expect(page.locator('[data-coin-balance]')).toContainText('9,000,000');
  const mode = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button', { name: mode === 'dark' ? '切换浅色模式' : '切换深色模式' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', mode === 'dark' ? 'light' : 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-coin-theme', 'theme-ocean');
  await page.locator('[data-product="theme-default"]').getByRole('button', { name: '使用装扮' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-coin-theme');
  await page.getByRole('button', { name: mode === 'dark' ? '切换深色模式' : '切换浅色模式' }).click();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c-primary'))).toBe(originalColor);
  expect(await page.evaluate(() => window.reportTest.coinPurchases)).toEqual([]);
});

test('余额不足不发出购买，保存失败保留余额与拥有状态并允许重试', async ({ page }) => {
  await openWorkshop(page, 'coinsBalance=500000');
  await expect(page.locator('[data-product="theme-ocean"] button')).toBeDisabled();
  await expect(page.locator('[data-product="theme-ocean"]')).toContainText('还差 500,000');
  expect(await page.evaluate(() => window.reportTest.coinPurchases)).toEqual([]);
  await page.getByRole('tab', { name: /代码花园/ }).click();
  await page.evaluate(() => { window.reportTest.coinFailure = true; });
  await buy(page, 'seed-clover');
  await expect(page.getByRole('alert').filter({ hasText: '购买保存失败，请重试' })).toBeVisible();
  await expect(page.locator('[data-coin-balance]')).toContainText('500,000');
  await expect(page.locator('[data-plant]')).toHaveCount(0);
  await page.evaluate(() => { window.reportTest.coinFailure = false; });
  await buy(page, 'seed-clover');
  await expect(page.locator('[data-plant]')).toHaveCount(1);
  await expect(page.locator('[data-coin-balance]')).toContainText('300,000');
});

test('种植三槽、花盆换装、成熟收藏释放槽位且不额外发币', async ({ page }) => {
  await openWorkshop(page);
  await buy(page, 'pot-ceramic');
  await page.locator('[data-product="pot-ceramic"]').getByRole('button', { name: '使用装扮' }).click();
  await page.getByRole('tab', { name: /代码花园/ }).click();
  for (const id of ['seed-clover', 'seed-sunflower', 'seed-pine']) await buy(page, id);
  await expect(page.locator('[data-plant]')).toHaveCount(3);
  await expect(page.locator('[data-product="seed-clover"] button')).toBeDisabled();
  await expect(page.locator('[data-product="seed-clover"]')).toContainText('生长位已满');
  await expect(page.locator('[data-plant] .pot-ceramic')).toHaveCount(3);
  await expect(page.locator('[data-plant]').first()).toContainText('成长 0/3 天');
  await expect(page.locator('[data-plant]').first().getByRole('button')).toBeDisabled();
  const before = await page.locator('[data-coin-balance]').textContent();
  await page.evaluate(() => window.reportTest.maturePlants());
  await page.locator('[data-plant]').first().getByRole('button', { name: '收入图鉴' }).click();
  await expect(page.locator('[data-plant]')).toHaveCount(2);
  await expect(page.locator('.coin-collection-item')).toHaveCount(1);
  await expect(page.locator('.coin-collection-item .pot-ceramic')).toHaveCount(1);
  await expect(page.locator('[data-product="seed-clover"] button')).toBeEnabled();
  await expect(page.locator('[data-coin-balance]')).toHaveText(before!);
  await page.reload();
  await page.getByRole('tab', { name: /代码花园/ }).click();
  await expect(page.locator('[data-plant]')).toHaveCount(2);
  await expect(page.locator('.coin-collection-item')).toHaveCount(1);
});

test('收支明细分页、筛选、统计与错误重试', async ({ page }) => {
  await openWorkshop(page, 'coinsBalance=10000000&coinHistory');
  await buy(page, 'theme-ocean');
  await expect(page.locator('[data-coin-stat="total-spent"]')).toHaveText('1,000,280');
  await page.getByRole('tab', { name: '收支明细' }).click();
  await expect(page.locator('.coin-ledger-panel')).toContainText('共 16 笔记录');
  await expect(page.locator('.coin-ledger-table .el-table__body tbody tr')).toHaveCount(10);
  await page.getByRole('button', { name: '下一页' }).click();
  await expect(page.locator('.coin-ledger-table .el-table__body tbody tr')).toHaveCount(6);
  await page.getByRole('button', { name: '支出', exact: true }).click();
  await expect(page.locator('.coin-ledger-panel')).toContainText('共 8 笔记录');
  await expect(page.locator('.coin-income')).toHaveCount(0);
  await page.getByRole('button', { name: '收入', exact: true }).click();
  await expect(page.locator('.coin-expense')).toHaveCount(0);
  await page.evaluate(() => { window.reportTest.coinReadFailure = true; });
  await page.getByRole('button', { name: '全部', exact: true }).click();
  await expect(page.getByText('收支明细读取失败', { exact: true })).toBeVisible();
  await page.evaluate(() => { window.reportTest.coinReadFailure = false; });
  await page.getByRole('button', { name: '重新读取明细' }).click();
  await expect(page.locator('.coin-ledger-panel')).toContainText('共 16 笔记录');
});

test('顶栏入口可导航工坊，打开签到面板时刷新跨天状态', async ({ page }) => {
  await openWorkshop(page);
  await page.getByRole('menuitem', { name: '写今日日报', exact: true }).click();
  await page.evaluate(() => {
    const getSnapshot = window.api.getCheckinWalletSnapshot;
    window.api.getCheckinWalletSnapshot = async () => {
      const snapshot = await getSnapshot();
      snapshot.wallet.lastCheckinDate = '2026-10-27';
      snapshot.today = '2026-10-28';
      snapshot.checkedInToday = false;
      return snapshot;
    };
  });
  await page.getByRole('button', { name: '码币签到', exact: true }).click();
  await expect(page.getByRole('button', { name: '签到随机 +88888-888888' })).toBeEnabled();
  await page.getByRole('button', { name: '前往码币工坊 · 装扮、花园与收支' }).click();
  await expect(page).toHaveURL(/#\/coins$/);
  await expect(page.getByRole('heading', { name: '码币工坊', exact: true })).toBeVisible();
});

test('工坊深浅主题与花园在1366px下完整展示', async ({ page }) => {
  await mkdir(output, { recursive: true });
  await page.setViewportSize({ width: 1366, height: 950 });
  await openWorkshop(page);
  for (const mode of ['light', 'dark']) {
    const current = await page.locator('html').getAttribute('data-theme');
    if (current !== mode) await page.getByRole('button', { name: mode === 'dark' ? '切换深色模式' : '切换浅色模式' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.el-message').waitFor({ state: 'hidden' });
    await page.locator('.app-scroll').evaluate(element => { element.scrollTop = 0; });
    await expect.poll(() => page.locator('.app-scroll').evaluate(element => element.scrollTop)).toBe(0);
    await page.screenshot({ path: `${output}/shop-${mode}.png`, fullPage: true, animations: 'disabled' });
  }
  await page.getByRole('tab', { name: /代码花园/ }).click();
  await buy(page, 'seed-sunflower');
  await buy(page, 'seed-clover');
  await page.locator('.el-message').last().waitFor({ state: 'hidden' });
  await page.locator('.app-scroll').evaluate(element => { element.scrollTop = 0; });
  await expect.poll(() => page.locator('.app-scroll').evaluate(element => element.scrollTop)).toBe(0);
  await page.screenshot({ path: `${output}/garden-dark.png`, fullPage: true, animations: 'disabled' });
  await page.locator('.coin-garden-grid').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/garden-detail-dark.png`, fullPage: true, animations: 'disabled' });
});
