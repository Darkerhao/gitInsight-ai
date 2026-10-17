import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const renderer = resolve(dirname(fileURLToPath(import.meta.url)), '../out/renderer');
const html = readFileSync(join(renderer, 'index.html'), 'utf8');
const initial = [...html.matchAll(/(?:src|href)="\.\/([^"?]+\.js)"/g)].map(match => join(renderer, match[1]));

function staticDependencies(entries) {
  const visited = new Set();
  const visit = file => {
    if (visited.has(file)) return;
    visited.add(file);
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      const target = statement.moduleSpecifier;
      if (target && ts.isStringLiteral(target) && target.text.startsWith('.')) visit(resolve(dirname(file), target.text));
    }
  };
  entries.forEach(visit);
  return [...visited];
}

const assets = join(renderer, 'assets');
const reportPage = readdirSync(assets).find(name => /^ReportGenerateView-.*\.js$/.test(name));
assert.ok(initial.length, 'Built HTML must reference an entry script');
assert.ok(reportPage, 'Default report page must have a separate lazy chunk');
const shell = staticDependencies(initial);
const defaultPage = staticDependencies([...initial, join(assets, reportPage)]);
assert.equal(defaultPage.some(file => /vendor-(echarts|3d)/.test(file)), false, 'Charts and 3D must stay outside the default page dependency graph');
const bytes = files => files.reduce((total, file) => total + statSync(file).size, 0);
console.log(JSON.stringify({
  metric: 'production JavaScript bytes on disk; not a startup duration',
  shellBytes: bytes(shell),
  defaultPageBytes: bytes(defaultPage),
  defaultPageChunks: defaultPage.map(file => file.slice(assets.length + 1)),
}, null, 2));
