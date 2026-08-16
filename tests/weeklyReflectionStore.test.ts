import assert from 'node:assert/strict';
import test from 'node:test';
import initSqlJs from 'sql.js';
import type { DailyReportRecord, WeeklyReflectionMetadata } from '../src/shared/types.js';
import {
  ensureReflectionSchema,
  queryPreviousWeeklyReflection,
  queryWeeklyReflectionProjects,
  queryWeeklyReflectionSources,
  queryWeeklyReflections,
  updateWeeklyReflectionImprovementStatus,
  upsertWeeklyReflection,
} from '../electron/main/reflectionStore.js';

function mapDailyReport(row: Record<string, unknown>): DailyReportRecord {
  return {
    id: Number(row.id),
    date: String(row.date),
    reporterName: String(row.reporter_name),
    repoNames: JSON.parse(String(row.repo_names_json)) as string[],
    repoPaths: JSON.parse(String(row.repo_paths_json)) as string[],
    report: String(row.report),
    status: String(row.status) as DailyReportRecord['status'],
    commitsCount: Number(row.commits_count),
    filesCount: Number(row.files_count),
    generatedAt: String(row.generated_at),
    updatedAt: String(row.updated_at),
  };
}

const metadata: WeeklyReflectionMetadata = {
  title: '项目 A 周反思',
  overview: '完成核心功能。',
  strengths: [{ title: '交付完整', detail: '完成开发与验证。', evidenceRefs: ['R1'] }],
  problems: [],
  shortcomings: [],
  improvements: [{ action: '补充回归清单', reason: '减少遗漏', priority: 'high', expectedOutcome: '发布前完成验证', evidenceRefs: ['R1'] }],
  previousActionReviews: [],
  nextWeekFocus: ['执行回归清单'],
};

const params = {
  projectPath: 'D:/repo-a',
  startDate: '2026-08-10',
  endDate: '2026-08-16',
} as const;

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
      updated_at TEXT NOT NULL
    );
    CREATE TABLE sync_logs (report_id INTEGER, status TEXT NOT NULL);
  `);
  ensureReflectionSchema(db);
  db.run(
    `INSERT INTO daily_reports VALUES
     (1, '2026-08-10', '测试用户', '["项目 A"]', '["D:/repo-a"]', '完成核心功能', 'success', 3, 4,
      '2026-08-10T10:00:00.000Z', '2026-08-10T10:00:00.000Z')`,
  );
  db.run("INSERT INTO sync_logs VALUES (1, 'success')");
  return db;
}

test('reflection store queries projects and sources from daily report data', async () => {
  const db = await createDatabase();
  const projects = queryWeeklyReflectionProjects(db, mapDailyReport);
  assert.deepEqual(projects, [{ path: 'D:/repo-a', name: '项目 A', reportCount: 1, publishedCount: 1 }]);
  const sources = queryWeeklyReflectionSources(
    db,
    { projectPath: 'D:/repo-a', startDate: '2026-08-10', endDate: '2026-08-16', sourceScope: 'published' },
    mapDailyReport,
  );
  assert.equal(sources[0]?.reportId, 1);
  db.close();
});

test('reflection store upserts one record for the same project, range and source scope', async () => {
  const db = await createDatabase();
  const sources = queryWeeklyReflectionSources(
    db,
    { projectPath: 'D:/repo-a', startDate: '2026-08-10', endDate: '2026-08-16' },
    mapDailyReport,
  );
  const first = upsertWeeklyReflection(db, {
    projectPath: 'D:/repo-a', projectName: '项目 A', startDate: '2026-08-10', endDate: '2026-08-16',
    sourceScope: 'all', sourceReports: sources, structuredJson: metadata, aiProfileId: 'default', generatedAt: '2026-08-16T10:00:00.000Z',
  });
  const second = upsertWeeklyReflection(db, {
    projectPath: 'D:/repo-a', projectName: '项目 A', startDate: '2026-08-10', endDate: '2026-08-16',
    sourceScope: 'all', sourceReports: sources, structuredJson: { ...metadata, overview: '重新生成后的概览。' }, aiProfileId: 'default', generatedAt: '2026-08-16T11:00:00.000Z',
  });
  assert.equal(first.id, second.id);
  assert.equal(queryWeeklyReflections(db).length, 1);
  assert.match(second.content, /重新生成后的概览/);
  assert.equal(second.actionStates[0]?.status, 'pending');
  db.close();
});

test('reflection store migrates and keeps user action status across exact-action regeneration', async () => {
  const SQL = await initSqlJs();
  const legacyDb = new SQL.Database();
  legacyDb.run(`
    CREATE TABLE project_reflections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_type TEXT NOT NULL,
      project_path TEXT NOT NULL,
      project_name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      source_scope TEXT NOT NULL,
      source_report_ids_json TEXT NOT NULL,
      source_snapshot_json TEXT NOT NULL,
      structured_json TEXT NOT NULL,
      ai_profile_id TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  ensureReflectionSchema(legacyDb);
  const columns = legacyDb.exec('PRAGMA table_info(project_reflections)')[0]?.values.map((row) => row[1]);
  assert.ok(columns?.includes('action_state_json'));
  legacyDb.close();

  const db = await createDatabase();
  const sources = queryWeeklyReflectionSources(db, params, mapDailyReport);
  const first = upsertWeeklyReflection(db, {
    ...params, projectName: '项目 A', sourceScope: 'all', sourceReports: sources,
    structuredJson: metadata, aiProfileId: 'default', generatedAt: '2026-08-16T10:00:00.000Z',
  });
  const completed = updateWeeklyReflectionImprovementStatus(db, {
    reflectionId: first.id,
    action: '补充回归清单',
    status: 'completed',
  });
  assert.equal(completed.actionStates[0]?.status, 'completed');
  assert.throws(
    () => updateWeeklyReflectionImprovementStatus(db, {
      reflectionId: first.id,
      action: '不存在的动作',
      status: 'not_completed',
    }),
    /改进动作不存在/,
  );

  const regenerated = upsertWeeklyReflection(db, {
    ...params, projectName: '项目 A', sourceScope: 'all', sourceReports: sources,
    structuredJson: { ...metadata, improvements: [...metadata.improvements, { action: '增加冒烟验证', reason: '尽早发现问题', priority: 'medium', expectedOutcome: '提交前发现问题', evidenceRefs: ['R1'] }] },
    aiProfileId: 'default', generatedAt: '2026-08-16T11:00:00.000Z',
  });
  assert.deepEqual(regenerated.actionStates.map((item) => [item.action, item.status]), [
    ['补充回归清单', 'completed'],
    ['增加冒烟验证', 'pending'],
  ]);
  db.run("UPDATE project_reflections SET action_state_json = 'not-json' WHERE id = ?", [first.id]);
  assert.throws(() => queryWeeklyReflections(db), /动作状态数据损坏/);
  db.close();
});

test('previous reflection query only returns the nearest earlier matching scope', async () => {
  const db = await createDatabase();
  const sources = queryWeeklyReflectionSources(db, params, mapDailyReport);
  const save = (startDate: string, endDate: string, sourceScope: 'all' | 'published') => upsertWeeklyReflection(db, {
    projectPath: 'D:/repo-a', projectName: '项目 A', startDate, endDate, sourceScope,
    sourceReports: sources, structuredJson: metadata, aiProfileId: 'default', generatedAt: `${endDate}T10:00:00.000Z`,
  });
  save('2026-07-20', '2026-07-26', 'all');
  save('2026-07-27', '2026-08-02', 'all');
  save('2026-08-03', '2026-08-09', 'published');

  const previous = queryPreviousWeeklyReflection(db, {
    projectPath: 'D:/repo-a', startDate: '2026-08-10', endDate: '2026-08-16', sourceScope: 'all',
  });
  assert.equal(previous?.endDate, '2026-08-02');
  db.close();
});
