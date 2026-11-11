import { test, expect } from './fixtures';

test('生成与发布的动效只跟随真实执行状态，失败保留正文', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#/generate');
  await expect(page.locator('.report-editor-card')).toBeVisible();
  await page.evaluate(() => {
    const original = window.api.generateReport;
    window.api.generateReport = payload => new Promise(resolve => {
      Reflect.set(window, 'finishMotionGeneration', () => resolve(original(payload)));
    });
  });
  await page.getByRole('button', { name: '重新生成当前项目', exact: true }).click();
  await expect(page.locator('.report-editor-card')).toHaveAttribute('data-motion-state', 'running');
  await expect(page.getByRole('button', { name: '取消生成', exact: true })).toBeEnabled();
  expect(await page.locator('.report-editor-card').evaluate(element => getComputedStyle(element, '::after').animationName)).toBe('motion-edge-sweep');
  await page.evaluate(() => Reflect.get(window, 'finishMotionGeneration')());
  await expect(page.locator('.report-editor-card')).toHaveAttribute('data-motion-state', 'success');
  const editor = page.locator('.editable-report textarea');
  await expect(editor).toHaveValue(/Project A/);
  await editor.fill('人工校对后的正文');
  await page.evaluate(() => {
    window.api.syncFeishuDaily = () => new Promise((_resolve, reject) => {
      Reflect.set(window, 'failMotionPublication', () => reject(new Error('远端不可用')));
    });
  });
  await page.getByRole('button', { name: '仅发布当前项目', exact: true }).click();
  await page.getByRole('button', { name: '确认发布', exact: true }).click();
  await expect(page.locator('.publish-panel')).toHaveAttribute('data-motion-state', 'running');
  await expect(page.locator('.report-editor-card')).not.toHaveAttribute('data-motion-state', 'running');
  await page.evaluate(() => Reflect.get(window, 'failMotionPublication')());
  await expect(page.locator('.publish-panel')).toHaveAttribute('data-motion-state', 'failed');
  await expect(editor).toHaveValue('人工校对后的正文');
  expect(await page.locator('.publish-panel').evaluate(element => getComputedStyle(element, '::after').animationName)).toBe('none');
});

test('取消生成立即停止流光，减少动态效果时继续提供状态与取消操作', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/generate');
  await expect(page.locator('.report-editor-card')).toBeVisible();
  await page.evaluate(() => {
    let rejectGeneration: (error: Error) => void;
    window.api.generateReport = () => new Promise((_resolve, reject) => { rejectGeneration = reject; });
    window.api.cancelReportGeneration = async () => { rejectGeneration(new Error('已取消生成')); };
  });
  await page.getByRole('button', { name: '重新生成当前项目', exact: true }).click();
  await expect(page.locator('.report-editor-card')).toHaveAttribute('data-motion-state', 'running');
  expect(await page.locator('.report-editor-card').evaluate(element => getComputedStyle(element, '::after').display)).toBe('none');
  await page.getByRole('button', { name: '取消生成', exact: true }).click();
  await expect(page.locator('.report-editor-card')).not.toHaveAttribute('data-motion-state', 'running');
  await expect(page.getByRole('button', { name: '重新生成当前项目', exact: true })).toBeEnabled();
  await expect(page.locator('.report-context-deck')).not.toHaveAttribute('data-tilting');
});

test('欢迎页入场不阻止进入，减少动态效果立即显示完整标题', async ({ page }) => {
  await page.goto('/?welcome#/generate');
  await expect(page.locator('#welcome-title')).toHaveText('开始今天的工作记录');
  await expect(page.getByRole('button', { name: '进入工作台', exact: true })).toBeEnabled();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#welcome-title span').first()).toHaveCSS('animation-name', 'none');
  await page.getByRole('button', { name: '进入工作台', exact: true }).click();
  await expect(page.locator('.welcome-gate')).toHaveCount(0);
  await expect(page.locator('.app-layout')).not.toHaveAttribute('inert');
});

test('隐藏专注画面时装饰暂停，真实计时继续且显示后恢复', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?coinsBalance=10000000#/coins');
  await page.getByRole('tab', { name: '专注空间' }).click();
  await page.getByLabel('完成提示音').uncheck();
  const rain = page.locator('[data-product="scene-rain"]');
  await rain.getByRole('button', { name: '预览场景', exact: true }).click();
  await rain.getByRole('button', { name: '解锁场景' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认购买', exact: true }).click();
  await rain.getByRole('button', { name: '使用场景' }).click();
  await page.clock.install();
  await page.getByRole('button', { name: '开始专注', exact: true }).click();
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('html')).toHaveAttribute('data-motion-paused', '');
  expect(await page.locator('.focus-art svg *').evaluateAll(elements => elements.filter(element => getComputedStyle(element).animationName !== 'none').every(element => getComputedStyle(element).animationPlayState === 'paused'))).toBe(true);
  await page.clock.fastForward(60000);
  await expect(page.locator('[data-focus-time]')).toHaveText('24:00');
  await page.evaluate(() => { Reflect.deleteProperty(document, 'hidden'); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('html')).not.toHaveAttribute('data-motion-paused');
  await expect(page.locator('[data-focus-time]')).toHaveText('24:00');
});

test('真实新增消息一次淡入，筛选和整批刷新不重播', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#/messages');
  await expect(page.getByRole('heading', { name: '消息中心', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const original = Element.prototype.animate;
    const animated: string[] = [];
    Reflect.set(window, 'motionMessageAnimations', animated);
    Element.prototype.animate = function (keyframes, options) {
      if (this.hasAttribute('data-message-id')) animated.push(this.getAttribute('data-message-id')!);
      return original.call(this, keyframes, options);
    };
  });
  const refresh = async (count: number) => page.evaluate(async count => {
    window.api.listSyncLogs = async () => Array.from({ length: count }, (_, index) => ({
      id: index + 1, reportId: index + 1, triggerType: 'manual' as const, status: 'success' as const,
      message: `真实消息 ${index + 1}`, ranAt: new Date().toISOString(),
    }));
    const source = '/src/composables/useAssistant.ts';
    await (await import(source)).useAssistant().refreshLocalData();
  }, count);
  await refresh(1);
  await expect(page.locator('.message-card')).toHaveCount(1);
  expect(await page.evaluate(() => Reflect.get(window, 'motionMessageAnimations'))).toEqual(['sync-1']);
  await page.getByPlaceholder('搜索消息内容').fill('不存在');
  await expect(page.locator('.message-card')).toHaveCount(0);
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await expect(page.locator('.message-card')).toHaveCount(1);
  await refresh(3);
  await expect(page.locator('.message-card')).toHaveCount(3);
  expect(await page.evaluate(() => Reflect.get(window, 'motionMessageAnimations'))).toEqual(['sync-1']);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await refresh(4);
  await expect(page.locator('.message-card')).toHaveCount(4);
  expect(await page.evaluate(() => Reflect.get(window, 'motionMessageAnimations'))).toEqual(['sync-1']);
});
