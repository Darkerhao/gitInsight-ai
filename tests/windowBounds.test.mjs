import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { compileFunction } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../electron/main/windows.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const require = createRequire(import.meta.url);

for (const workArea of [
  { x: 0, y: 0, width: 1366, height: 728 },
  { x: 0, y: 0, width: 910, height: 485 },
  { x: -1920, y: 0, width: 1920, height: 1040 },
]) {
  test(`main window and minimum bounds fit the selected display ${JSON.stringify(workArea)}`, () => {
    let options;
    class BrowserWindow {
      webContents = { once() {}, openDevTools() {} };
      constructor(value) { options = value; }
      once(event, callback) { if (event === 'ready-to-show') callback(); }
      on() {}
      loadFile() {}
      isDestroyed() { return false; }
      isVisible() { return false; }
      show() {}
    }
    const exports = {};
    const electron = { BrowserWindow, screen: { getCursorScreenPoint: () => ({ x: workArea.x, y: workArea.y }), getDisplayNearestPoint: () => ({ workArea }) } };
    compileFunction(outputText, ['require', 'exports', '__dirname', 'process'])(
      (name) => name === 'electron' ? electron : require(name), exports, '/app/main',
      { platform: 'win32', cwd: () => '/app', resourcesPath: '/app/resources', env: {} },
    );
    exports.createMainWindow();
    assert.ok(options.width >= options.minWidth);
    assert.ok(options.height >= options.minHeight);
    assert.ok(options.x >= workArea.x && options.x + options.width <= workArea.x + workArea.width);
    assert.ok(options.y >= workArea.y && options.y + options.height <= workArea.y + workArea.height);
  });
}
