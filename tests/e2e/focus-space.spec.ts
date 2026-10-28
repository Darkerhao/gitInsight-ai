import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

async function openFocus(page: Page) {
  await page.goto('/?coinsBalance=10000000#/coins');
  await page.getByRole('tab', { name: '专注空间' }).click();
}
test('免费专注跨页连续、暂停继续、结束与完成休息提醒', async ({ page }) => {
  await openFocus(page);
  await page.clock.install();
  await page.getByLabel('完成提示音').uncheck();
  await page.getByRole('button', { name: '开始专注', exact: true }).click();
  await page.clock.fastForward(60000);
  await expect(page.locator('[data-focus-time]')).toHaveText('24:00');
  await page.evaluate(() => { location.hash = '#/history'; });
  await expect(page.locator('[data-focus-time]')).toHaveCount(0);
  await page.clock.fastForward(60000);
  await page.evaluate(() => { location.hash = '#/coins'; });
  await page.getByRole('tab', { name: '专注空间' }).click();
  await expect(page.locator('[data-focus-time]')).toHaveText('23:00');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.clock.fastForward(600000);
  await expect(page.locator('[data-focus-time]')).toHaveText('23:00');
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.clock.fastForward(60000);
  await expect(page.locator('[data-focus-time]')).toHaveText('22:00');
  await page.getByRole('button', { name: '结束', exact: true }).click();
  await expect(page.locator('[data-focus-time]')).toHaveText('25:00');
  await expect(page.locator('.el-notification')).toHaveCount(0);
  await page.getByRole('button', { name: '开始专注', exact: true }).click();
  await page.evaluate(() => { location.hash = '#/history'; });
  await page.clock.fastForward(1500000);
  await expect(page.locator('.el-notification')).toContainText('专注完成');
  await page.clock.fastForward(60000);
  await expect(page.locator('.el-notification')).toHaveCount(1);
  await page.evaluate(() => { location.hash = '#/coins'; });
  await page.getByRole('tab', { name: '专注空间' }).click();
  await page.getByRole('button', { name: '开始休息 · 5 分钟' }).click();
  await expect(page.locator('[data-focus-time]')).toHaveText('05:00');
  await page.clock.fastForward(300000);
  await expect(page.getByText('休息结束', { exact: true })).toBeVisible();
});

test('场景预览、取消与失败、永久购买、使用和收支明细', async ({ page }) => {
  await openFocus(page);
  const rain = page.locator('[data-product="scene-rain"]');
  await rain.getByRole('button', { name: '预览场景', exact: true }).click();
  await expect(page.locator('.focus-stage')).toHaveAttribute('data-scene', 'scene-rain');
  await expect(page.locator('.focus-preview-note')).toContainText('简洁书桌');
  await rain.getByRole('button', { name: '解锁场景' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '再想想' }).click();
  await expect(page.locator('[data-coin-balance]')).toContainText('10,000,000');
  await page.evaluate(() => { window.reportTest.coinFailure = true; });
  await rain.getByRole('button', { name: '解锁场景' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认购买', exact: true }).click();
  await expect(page.locator('[data-coin-balance]')).toContainText('10,000,000');
  await page.evaluate(() => { window.reportTest.coinFailure = false; });
  await rain.getByRole('button', { name: '解锁场景' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认购买', exact: true }).click();
  await expect(rain).toContainText('已永久解锁');
  await rain.getByRole('button', { name: '使用场景' }).click();
  await expect(rain).toContainText('正在使用');
  await expect(page.locator('[data-coin-balance]')).toContainText('9,000,000');
  await page.getByRole('tab', { name: '收支明细' }).click();
  await expect(page.locator('.coin-ledger-table')).toContainText('购买雨夜');
  await page.reload();
  await page.getByRole('tab', { name: '专注空间' }).click();
  await expect(rain).toContainText('已永久解锁');
});

test('余额不足可预览且禁止购买；四种场景截图', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 1800 });
  await page.goto('/?coinsBalance=100#/coins');
  await page.getByRole('tab', { name: '专注空间' }).click();
  for (const id of ['scene-desk', 'scene-rain', 'scene-cafe', 'scene-space']) {
    await page.locator(`[data-product="${id}"] .focus-scene-select`).click();
    if (id !== 'scene-desk') await expect(page.locator(`[data-product="${id}"]`).getByRole('button', { name: /还差/ })).toBeDisabled();
    if (id !== 'scene-desk') await expect(page.locator('.focus-art')).toHaveCSS('opacity', '1');
    await page.locator('.focus-space').screenshot({ path: `output/playwright/focus-space/${id}.png` });
  }
});

test('完成提示音开启时播放，关闭后不播放且仍提醒', async ({ page }) => {
  await openFocus(page);
  await page.clock.install();
  await page.evaluate(() => {
    const RealAudioContext = window.AudioContext;
    let plays = 0;
    Object.defineProperty(window, '__focusSoundPlays', { get: () => plays });
    window.AudioContext = class extends RealAudioContext {
      createOscillator() {
        const oscillator = super.createOscillator();
        const start = oscillator.start.bind(oscillator);
        oscillator.start = (when?: number) => { plays++; start(when); };
        return oscillator;
      }
    };
  });
  await page.getByRole('button', { name: '开始专注', exact: true }).click();
  await page.clock.fastForward(1500000);
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__focusSoundPlays'))).toBe(1);
  await page.getByLabel('完成提示音').uncheck();
  await page.getByRole('button', { name: '开始休息 · 5 分钟' }).click();
  await page.clock.fastForward(300000);
  await expect(page.getByText('休息结束', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, '__focusSoundPlays'))).toBe(1);
});

test('三款付费插画实际播放动画并响应减少动态效果', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 1800 });
  await openFocus(page);
  for (const id of ['scene-rain', 'scene-cafe', 'scene-space']) {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator(`[data-product="${id}"] .focus-scene-select`).click();
    const art = page.locator('.focus-art');
    await expect(art.locator('svg')).toBeVisible();
    await page.waitForTimeout(900);
    const before = await art.screenshot({ animations: 'allow' });
    await page.waitForTimeout(700);
    const after = await art.screenshot({ animations: 'allow' });
    expect(before.equals(after), `${id} 应持续变化`).toBe(false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(200);
    const still = await art.screenshot({ animations: 'allow' });
    await page.waitForTimeout(400);
    expect(still.equals(await art.screenshot({ animations: 'allow' })), `${id} 减少动态时应静止`).toBe(true);
  }
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; document.documentElement.classList.add('dark'); });
  await page.locator('.focus-space').screenshot({ path: 'output/playwright/focus-space/space-dark.png' });
});
