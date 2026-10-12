import { computed, ref } from 'vue';
import type { AppConfig, DailyReportRecord, MaterialRole, RoleMaterialPayload } from '@shared/types';
import { emptyMaterial, MATERIAL_ROLE_LABELS } from '@shared/materialReport';

interface MaterialDraft extends RoleMaterialPayload {
  report: string;
  reportId?: number;
  reporterName: string;
  generatedAt?: string;
}

interface MaterialContext {
  api: Pick<Window['api'], 'loadRoleMaterial' | 'saveRoleMaterial' | 'loadMaterialReport' | 'getDailyReport'
    | 'generateReportFromMaterial' | 'saveDailyReport' | 'syncFeishuDaily'>;
  config: AppConfig;
  persistConfig: () => Promise<unknown>;
  confirmDiscard: () => Promise<boolean>;
}

export function createMaterialReports(ctx: MaterialContext, date: string) {
  const draft = ref<MaterialDraft>({ ...emptyMaterial('projectManager', date), report: '', reporterName: ctx.config.reporterName });
  const busy = ref(false);
  const message = ref('');
  const error = ref('');
  const savedMaterial = ref(JSON.stringify(materialPayload()));
  const savedReport = ref('');
  const publishedReport = ref('');
  const dirty = computed(() => JSON.stringify(materialPayload()) !== savedMaterial.value || draft.value.report !== savedReport.value);
  const published = computed(() => Boolean(draft.value.report.trim()) && draft.value.report === publishedReport.value);

  function materialPayload(): RoleMaterialPayload {
    const { role, date, sections, extraNotes } = draft.value;
    return { role, date, sections: sections.map(section => ({ ...section })), extraNotes };
  }

  function reporterName() {
    const name = draft.value.reporterName.trim() || ctx.config.reporterName.trim();
    if (!name) throw new Error('请先填写汇报人');
    return name;
  }

  async function canLeave() {
    return !busy.value && (!dirty.value || await ctx.confirmDiscard());
  }

  async function run(action: () => Promise<void>) {
    if (busy.value) return false;
    busy.value = true;
    message.value = '';
    error.value = '';
    try { await action(); return true; }
    catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause); return false; }
    finally { busy.value = false; }
  }

  async function load(role: MaterialRole, date: string, reportId?: number) {
    if (!await canLeave()) return false;
    return run(async () => {
      const [material, report] = await Promise.all([
        ctx.api.loadRoleMaterial(role, date),
        reportId ? ctx.api.getDailyReport(reportId) : ctx.api.loadMaterialReport(role, date),
      ]);
      if (reportId && (!report || report.materialRole !== role || report.date !== date)) throw new Error('历史日报角色或日期不匹配');
      // A history link restores the material captured with that report, not a newer unrelated draft.
      const input = (reportId ? report?.material : material) ?? material ?? report?.material ?? emptyMaterial(role, date);
      draft.value = { ...emptyMaterial(role, date), ...input, role, date,
        sections: emptyMaterial(role, date).sections.map(section => ({ ...section,
          content: input.sections.find(item => item.key === section.key)?.content ?? '' })),
        report: report?.report ?? '', reportId: report?.id, generatedAt: report?.generatedAt,
        reporterName: report?.reporterName || ctx.config.reporterName };
      savedMaterial.value = JSON.stringify(materialPayload());
      savedReport.value = draft.value.report;
      publishedReport.value = report?.published ? report.report : '';
    });
  }

  async function persistMaterial() {
    const payload = materialPayload();
    await ctx.api.saveRoleMaterial(payload);
    savedMaterial.value = JSON.stringify(payload);
  }

  const saveMaterial = () => run(async () => { await persistMaterial(); message.value = '素材已保存'; });

  const generate = () => run(async () => {
    const name = reporterName();
    await ctx.persistConfig();
    await persistMaterial();
    const result = await ctx.api.generateReportFromMaterial({ ...materialPayload(),
      reporterName: name, aiProfileId: ctx.config.activeAiProfileId });
    draft.value.report = result.report;
    draft.value.generatedAt = result.generatedAt;
    message.value = '已生成，请核对后保存日报';
  });

  async function persistReport(): Promise<DailyReportRecord> {
    const name = reporterName();
    if (!draft.value.report.trim()) throw new Error('请先填写或生成日报正文');
    if (!dirty.value && draft.value.reportId) {
      const record = await ctx.api.getDailyReport(draft.value.reportId);
      if (!record) throw new Error('日报记录不存在');
      return record;
    }
    await persistMaterial();
    const input = materialPayload();
    const record = await ctx.api.saveDailyReport({ id: draft.value.reportId, date: input.date,
      reporterName: name, repoNames: [MATERIAL_ROLE_LABELS[input.role]], repoPaths: [],
      report: draft.value.report, status: draft.value.generatedAt ? 'success' : 'draft', commitsCount: 0, filesCount: 0,
      generatedAt: draft.value.generatedAt,
      rawInput: { gitLogs: '', files: '', diff: '', materialRole: input.role, material: input },
    });
    draft.value.reportId = record.id;
    draft.value.generatedAt = record.generatedAt;
    savedReport.value = record.report;
    return record;
  }

  const saveReport = () => run(async () => { await persistReport(); message.value = '日报已保存到历史日志'; });

  const publish = () => run(async () => {
    if (published.value) throw new Error('这份日报已提交飞书，请勿重复提交');
    await ctx.persistConfig();
    // Saving must succeed before a request can reach the shared publication guard.
    const record = await persistReport();
    const result = await ctx.api.syncFeishuDaily({ config: JSON.parse(JSON.stringify(ctx.config.feishuForm)),
      report: record.report, date: record.date, reporterName: record.reporterName,
      workHours: ctx.config.feishuForm.defaultWorkHours, reportId: record.id, triggerType: 'manual' });
    publishedReport.value = record.report;
    message.value = result.warning || '已提交飞书日报';
  });

  return { draft, busy, message, error, dirty, published, load, canLeave, saveMaterial, generate, saveReport, publish };
}
