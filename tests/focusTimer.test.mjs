import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { compileFunction } from 'node:vm';
import ts from 'typescript';
const exports = {};
compileFunction(ts.transpileModule(readFileSync(new URL('../src/shared/focusTimer.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, ['exports'])(exports);
const { FocusTimer } = exports;
test('deadline survives delayed ticks and completes only once', () => {
  const timer = new FocusTimer(); timer.start('focus', 1000);
  timer.tick(61000); assert.equal(timer.remainingMs, 24 * 60000);
  assert.equal(timer.tick(1600000), true); assert.equal(timer.status, 'completed');
  assert.equal(timer.tick(1700000), false);
});
test('pause freezes time; resume keeps remaining duration; end does not complete', () => {
  const timer = new FocusTimer(); timer.start('focus', 0); timer.pause(60000);
  timer.tick(600000); assert.equal(timer.remainingMs, 24 * 60000);
  timer.resume(600000); timer.tick(660000); assert.equal(timer.remainingMs, 23 * 60000);
  timer.end(); assert.equal(timer.tick(9999999), false); assert.equal(timer.status, 'idle');
});
test('late pause completes; break lasts five minutes; duplicate start cannot reset', () => {
  const timer = new FocusTimer(); timer.start('focus', 0);
  assert.equal(timer.pause(1500000), true);
  timer.start('break', 2000000); assert.equal(timer.remainingMs, 300000);
  timer.start('focus', 2100000); assert.equal(timer.phase, 'break');
  assert.equal(timer.tick(2300000), true);
});
