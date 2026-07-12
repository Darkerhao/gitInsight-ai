import assert from 'node:assert/strict';
import test from 'node:test';
import initSqlJs from 'sql.js';
import { aggregateTimelineRecords, ensureTimelineSchema, getTimelineSnapshot, upsertTimelineSnapshot } from '../electron/main/timeline.js';

async function createDatabase() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE daily_reports (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      reporter_name TEXT NOT NULL,
      repo_names_json TEXT NOT NULL,
      repo_paths_json TEXT NOT NULL,
      report TEXT NOT NULL,
      status TEXT NOT NULL,
      commits_count INTEGER NOT NULL,
      files_count INTEGER NOT NULL,
      generated_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      raw_input_json TEXT
    );
  `);
  ensureTimelineSchema(db);
  return db;
}

function insertReport(db: import('sql.js').Database, input: { id: number; date: string; report: string; commits: number }) {
  db.run(
    `INSERT INTO daily_reports
      (id, date, reporter_name, repo_names_json, repo_paths_json, report, status, commits_count, files_count, generated_at, updated_at, raw_input_json)
     VALUES (?, ?, '张三', '["GitInsight AI"]', '["D:/repo"]', ?, 'success', ?, 4, ?, ?, ?)`,
    [
      input.id,
      input.date,
      input.report,
      input.commits,
      `${input.date}T18:00:00.000Z`,
      `${input.date}T18:00:00.000Z`,
      JSON.stringify({ gitLogs: 'abc123 fix: 修复同步失败\ndef456 feat: 增加诊断', files: 'src/sync.ts\nsrc/ipc.ts', diff: '' }),
    ],
  );
}

test('upsertTimelineSnapshot 从日报生成快照并在重复处理时幂等更新', async () => {
  const db = await createDatabase();
  insertReport(db, { id: 1, date: '2026-07-11', report: '## 今日工作\n- 修复飞书同步失败\n- 增加错误诊断', commits: 2 });

  const first = await upsertTimelineSnapshot(1, db);
  assert.equal(first.reportId, 1);
  assert.equal(first.date, '2026-07-11');
  assert.equal(first.primaryType, 'Bug 修复');
  assert.deepEqual(first.projects, ['GitInsight AI']);

  db.run('UPDATE daily_reports SET commits_count = 5, report = ? WHERE id = 1', ['## 今日工作\n- 重构同步状态管理']);
  const second = await upsertTimelineSnapshot(1, db);
  const count = Number(db.exec('SELECT COUNT(*) FROM timeline_snapshots WHERE report_id = 1')[0]?.values[0]?.[0]);

  assert.equal(count, 1);
  assert.equal(second.commitsCount, 5);
  assert.equal(second.primaryType, '重构优化');
});

test('getTimelineSnapshot 按日期范围与工作类型返回真实快照', async () => {
  const db = await createDatabase();
  insertReport(db, { id: 1, date: '2026-07-09', report: '- 完成日报历史编辑功能', commits: 3 });
  insertReport(db, { id: 2, date: '2026-07-10', report: '- 修复同步异常与崩溃问题', commits: 4 });
  insertReport(db, { id: 3, date: '2026-07-11', report: '- 重构 TypeScript 类型定义', commits: 6 });
  await upsertTimelineSnapshot(1, db);
  await upsertTimelineSnapshot(2, db);
  await upsertTimelineSnapshot(3, db);

  const result = await getTimelineSnapshot(
    { startDate: '2026-07-10', endDate: '2026-07-11', type: 'Bug 修复' },
    db,
  );

  assert.equal(result.total, 1);
  assert.equal(result.records[0]?.date, '2026-07-10');
  assert.equal(result.records[0]?.primaryType, 'Bug 修复');
  assert.equal(result.summary.totalCommits, 4);
  assert.equal(result.days.length, 1);
  assert.deepEqual(result.days[0]?.recordIds, [2]);
});

test('aggregateTimelineRecords 将同日事项聚合并保留项目、类型和统计信息', async () => {
  const db = await createDatabase();
  insertReport(db, { id: 1, date: '2026-07-11', report: '- 完成资产看板 API 开发', commits: 3 });
  insertReport(db, { id: 2, date: '2026-07-11', report: '- 修复资产列表状态展示错误', commits: 2 });
  insertReport(db, { id: 3, date: '2026-07-10', report: '- 重构 TypeScript 类型定义', commits: 4 });
  await upsertTimelineSnapshot(1, db);
  await upsertTimelineSnapshot(2, db);
  await upsertTimelineSnapshot(3, db);

  const snapshot = await getTimelineSnapshot({}, db);
  const days = aggregateTimelineRecords(snapshot.records);

  assert.equal(days.length, 2);
  assert.equal(days[1]?.date, '2026-07-11');
  assert.deepEqual(days[1]?.recordIds, [1, 2]);
  assert.deepEqual(days[1]?.projects, ['GitInsight AI']);
  assert.deepEqual(days[1]?.workTypes, ['功能开发', 'Bug 修复']);
  assert.equal(days[1]?.commitsCount, 5);
  assert.equal(days[1]?.filesCount, 8);
  assert.equal(days[1]?.itemCount, 2);
});
