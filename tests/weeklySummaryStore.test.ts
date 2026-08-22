import assert from 'node:assert/strict';
import test from 'node:test';
import initSqlJs from 'sql.js';
import type { DailyReportRecord, WeeklySummaryMetadata } from '../src/shared/types.js';
import {
  ensureWeeklySummarySchema,
  queryWeeklySummaryRecords,
  queryWeeklySummarySources,
  saveWeeklySummaryContent,
  upsertWeeklySummary,
} from '../electron/main/weeklySummaryStore.js';

function mapDailyReport(row: Record<string, unknown>): DailyReportRecord {
  return {
    id: Number(row.id), date: String(row.date), reporterName: String(row.reporter_name),
    repoNames: JSON.parse(String(row.repo_names_json)), repoPaths: JSON.parse(String(row.repo_paths_json)),
    report: String(row.report), status: String(row.status) as DailyReportRecord['status'],
    commitsCount: Number(row.commits_count), filesCount: Number(row.files_count),
    generatedAt: String(row.generated_at), updatedAt: String(row.updated_at),
  };
}

const metadata: WeeklySummaryMetadata = {
  summary: '完成周报模块设计。',
  completed: [{ text: '完成设计', evidenceRefs: ['R1'] }],
  highlights: [{ text: '明确模块边界', evidenceRefs: ['R1'] }],
  blockers: [{ text: '暂无明显阻塞', evidenceRefs: [] }],
  nextWeek: [{ text: '实现周报模块', evidenceRefs: ['R1'] }],
};

async function database() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`CREATE TABLE daily_reports (
    id INTEGER PRIMARY KEY, date TEXT, reporter_name TEXT, repo_names_json TEXT, repo_paths_json TEXT,
    report TEXT, status TEXT, commits_count INTEGER, files_count INTEGER, generated_at TEXT, updated_at TEXT
  )`);
  db.run(`INSERT INTO daily_reports VALUES
    (1, '2026-08-17', '测试用户', '["项目 A"]', '["D:/repo-a"]', '完成设计', 'success', 2, 3,
     '2026-08-17T10:00:00.000Z', '2026-08-17T10:00:00.000Z')`);
  ensureWeeklySummarySchema(db);
  return db;
}

test('weekly summary store queries sources and upserts one record per range and scope', async () => {
  const db = await database();
  const params = { startDate: '2026-08-17', endDate: '2026-08-23' };
  const sources = queryWeeklySummarySources(db, params, mapDailyReport);
  assert.equal(sources[0]?.reportId, 1);
  const first = upsertWeeklySummary(db, {
    ...params, scopeType: 'all', projectName: '全部项目', sourceReports: sources,
    structuredJson: metadata, aiProfileId: 'default', generatedAt: '2026-08-23T10:00:00.000Z',
  });
  const second = upsertWeeklySummary(db, {
    ...params, scopeType: 'all', projectName: '全部项目', sourceReports: sources,
    structuredJson: { ...metadata, summary: '重新生成后的摘要。' }, aiProfileId: 'default', generatedAt: '2026-08-23T11:00:00.000Z',
  });
  assert.equal(first.id, second.id);
  assert.equal(queryWeeklySummaryRecords(db).length, 1);
  assert.match(second.content, /重新生成后的摘要/);
  db.close();
});

test('weekly summary store saves user edited markdown independently', async () => {
  const db = await database();
  const params = { startDate: '2026-08-17', endDate: '2026-08-23' };
  const sources = queryWeeklySummarySources(db, params, mapDailyReport);
  const record = upsertWeeklySummary(db, {
    ...params, scopeType: 'all', projectName: '全部项目', sourceReports: sources,
    structuredJson: metadata, aiProfileId: 'default', generatedAt: '2026-08-23T10:00:00.000Z',
  });
  const edited = saveWeeklySummaryContent(db, { id: record.id, content: '# 人工编辑周报\n\n完成核心工作。' });
  assert.match(edited.content, /人工编辑周报/);
  assert.throws(() => saveWeeklySummaryContent(db, { id: 999, content: '内容' }), /不存在/);
  db.close();
});
