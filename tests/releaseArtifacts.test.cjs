const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { expandMacro } = require('app-builder-lib/out/util/macroExpander');
const { load } = require('js-yaml');
const { minimatch } = require('minimatch');
const { version } = require('../package.json');

test('release assets have unique ASCII names and exclude unpacked executables', () => {
  const workflow = load(readFileSync(join(__dirname, '../.github/workflows/release.yml'), 'utf8'));
  const originalEdition = process.env.APP_EDITION;
  const allNames = new Set();
  try {
    for (const job of workflow.jobs.package.strategy.matrix.include) {
      process.env.APP_EDITION = job.edition;
      delete require.cache[require.resolve('../electron-builder.config.cjs')];
      const config = require('../electron-builder.config.cjs');
      const platform = { Windows: 'win', macOS: 'mac', Linux: 'linux' }[job.name];
      const info = { version, productName: config.productName, sanitizedProductName: config.productName };
      assert.match(config.productName, /^码迹 AI /);
      const patterns = job.paths.trim().split(/\s+/);
      const matches = file => patterns.some(pattern => minimatch(file, pattern));
      const base = `release/${version}/${job.edition}`;
      for (const target of config[platform].target) {
        for (const arch of target.arch) {
          const ext = { nsis: 'exe', portable: 'exe' }[target.target] || target.target;
          const pattern = config[target.target]?.artifactName || config[platform].artifactName || config.artifactName;
          const name = expandMacro(pattern, arch, info, { os: platform, ext });
          assert.match(name, /^[A-Za-z0-9.-]+$/);
          assert.ok(name.startsWith(`MajiAI-${job.editionLabel}-`), name);
          assert.ok(!allNames.has(name), `Duplicate release asset: ${name}`);
          allNames.add(name);
          assert.ok(matches(`${base}/${name}`), `Missing upload: ${name}`);
          assert.ok(!matches(`${base}/win-unpacked/${name}`));
        }
      }
      assert.ok(!matches(`${base}/win-unpacked/elevate.exe`));
      assert.ok(!matches(`${base}/win-unpacked/码迹 AI 标准版.exe`));
      assert.ok(!matches(`${base}/elevate.exe`));
      assert.ok(matches(`${base}/MajiAI-${job.editionLabel}-${version}-Windows-x64.exe.blockmap`));
    }
  } finally {
    if (originalEdition === undefined) delete process.env.APP_EDITION;
    else process.env.APP_EDITION = originalEdition;
    delete require.cache[require.resolve('../electron-builder.config.cjs')];
  }
});
