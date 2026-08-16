import { ElMessage } from 'element-plus';
import type { useAssistant } from './useAssistant';
import { runWeeklyPublishBatch, type createWeeklyReportActions } from './weeklyReportActions';
import type { createWeeklyReportMutations, WeeklyReportState } from './useWeeklyReportState';

type Assistant = ReturnType<typeof useAssistant>;
type Actions = ReturnType<typeof createWeeklyReportActions>;
type Mutations = ReturnType<typeof createWeeklyReportMutations>;

interface WeeklyReportCommandContext {
  assistant: Assistant;
  state: WeeklyReportState;
  actions: Actions;
  mutations: Mutations;
}

async function generateAll(ctx: WeeklyReportCommandContext) {
  const { assistant, state, actions, mutations } = ctx;
  if (!state.availableDates.value.length) return ElMessage.warning('请选择有效日期范围');
  if (!state.selectedRepos.value.length) return ElMessage.warning('请至少选择一个项目');
  if (!assistant.config.reporterName.trim()) return ElMessage.warning('请先在日报配置中填写汇报人');
  state.loading.value = true;
  state.status.value = `正在生成 ${state.drafts.value.length} 条项目日报`;
  try {
    const results = await Promise.allSettled(state.drafts.value.map(actions.generateDraft));
    const successCount = results.filter((result) => result.status === 'fulfilled' && result.value).length;
    const failedCount = results.length - successCount;
    const allocation = mutations.recalculateWorkHours();
    await assistant.refreshLocalData();
    if (failedCount) {
      state.status.value = `已生成 ${successCount} 条，${failedCount} 条失败`;
      ElMessage.warning(state.status.value);
    } else if (allocation.capacityExceededDates.length) {
      state.status.value = `已生成 ${successCount} 条；${allocation.capacityExceededDates.join('、')} 需手动设置工时`;
      ElMessage.warning(state.status.value);
    } else {
      state.status.value = `已生成 ${successCount} 条一周日报`;
      ElMessage.success(state.status.value);
    }
  } finally {
    state.loading.value = false;
  }
}

async function saveCurrent(ctx: WeeklyReportCommandContext) {
  const draft = ctx.state.activeDraft.value;
  if (!draft) return;
  const saved = await ctx.actions.saveDraft(draft);
  if (saved) ElMessage.success(`${ctx.state.displayRepoName(draft.repo)} ${draft.date} 日报已保存`);
  else ElMessage.error(draft.message || '保存日报失败');
}

async function saveAll(ctx: WeeklyReportCommandContext) {
  const drafts = ctx.state.dirtyDrafts.value;
  if (!drafts.length) return ElMessage.info('没有需要保存的日报修改');
  let successCount = 0;
  for (const draft of drafts) {
    if (await ctx.actions.saveDraft(draft)) successCount += 1;
  }
  await ctx.assistant.refreshLocalData();
  ElMessage.success(`已保存 ${successCount} 条日报修改`);
}

async function publishCurrent(ctx: WeeklyReportCommandContext) {
  const draft = ctx.state.activeDraft.value;
  if (!draft) return;
  ctx.state.pushing.value = true;
  const success = await ctx.actions.publishDraft(draft);
  ctx.state.pushing.value = false;
  await ctx.assistant.refreshLocalData();
  if (success) ElMessage.success('当前日报已提交飞书');
  else ElMessage.error(draft.message || '提交飞书失败');
}

async function publishAll(ctx: WeeklyReportCommandContext) {
  const targets = ctx.state.pendingPublishDrafts.value;
  if (!targets.length) {
    return ElMessage.info(ctx.state.generatedDrafts.value.length ? '全部已生成日报均已提交成功' : '请先生成至少一条日报');
  }
  ctx.state.pushing.value = true;
  try {
    const result = await runWeeklyPublishBatch(targets, ctx.actions.publishDraft);
    await ctx.assistant.refreshLocalData();
    const message = result.failedCount ? `已提交 ${result.successCount} 条，${result.failedCount} 条失败` : `已提交 ${result.successCount} 条日报到飞书`;
    if (result.failedCount) ElMessage.warning(message);
    else ElMessage.success(message);
  } finally {
    ctx.state.pushing.value = false;
  }
}

export function createWeeklyReportCommands(ctx: WeeklyReportCommandContext) {
  return {
    generateAll: () => generateAll(ctx),
    saveCurrent: () => saveCurrent(ctx),
    saveAll: () => saveAll(ctx),
    publishCurrent: () => publishCurrent(ctx),
    publishAll: () => publishAll(ctx),
    openSubmissionRecords: () => ctx.assistant.openFeishuSubmissionRecords(ctx.state.activeDraft.value?.date ?? ctx.state.availableDates.value[0]),
  };
}
