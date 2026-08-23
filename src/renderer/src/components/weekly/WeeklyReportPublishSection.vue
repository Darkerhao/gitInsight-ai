<script setup lang="ts">
import { RefreshCw, Save, Send } from 'lucide-vue-next';
import type { FeishuProjectOption, RepoInfo, ReportResult } from '@shared/types';
import type { WeeklyReportDraft } from '@/composables/weeklyReportActions';

defineProps<{
  publishableDrafts: WeeklyReportDraft[];
  generatedDrafts: WeeklyReportDraft[];
  dirtyDrafts: WeeklyReportDraft[];
  pendingPublishDrafts: WeeklyReportDraft[];
  drafts: WeeklyReportDraft[];
  projectOptions: FeishuProjectOption[];
  pushing: boolean;
  publishCheckVisible: boolean;
  publishCheckStats: { publishable: number; total: number; totalHours: number };
  publishIssues: string[];
  activeDraft: WeeklyReportDraft | undefined;
  showEvidence: boolean;
  showSupplement: boolean;
  supplementText: string;
  displayRepoName: (repo: RepoInfo) => string;
  getHoursSourceLabel: (source: WeeklyReportDraft['workHoursSource']) => string;
  getStatusType: (draft: WeeklyReportDraft) => string;
  getStatusLabel: (draft: WeeklyReportDraft) => string;
  countWeeklyReportFiles: (result: ReportResult | null) => number;
}>();

const emit = defineEmits<{
  (event: 'update:publishCheckVisible', value: boolean): void;
  (event: 'update:showEvidence', value: boolean): void;
  (event: 'update:showSupplement', value: boolean): void;
  (event: 'update:supplementText', value: string): void;
  (event: 'recalculate-hours'): void;
  (event: 'save-all'): void;
  (event: 'retry-failed'): void;
  (event: 'open-publish-check'): void;
  (event: 'select-draft', key: string): void;
  (event: 'update-project', key: string, value: string): void;
  (event: 'confirm-publish-all'): void;
  (event: 'append-supplement'): void;
}>();
</script>

<template>
  <section class="surface-card weekly-publish-panel" data-weekly-stage="publish">
    <div class="weekly-section-head compact">
      <div>
        <span class="eyebrow">04 · 批量提交</span>
        <h2>一次提交整周已生成日报</h2>
        <p>系统会按日期升序逐条提交；某条失败不会影响其他已成功的提交。</p>
      </div>
      <div class="weekly-publish-summary"><strong>{{ publishableDrafts.length }}</strong><span>条可提交</span></div>
    </div>
    <div class="weekly-publish-actions">
      <el-button :icon="RefreshCw" plain :disabled="!generatedDrafts.length" @click="emit('recalculate-hours')">重新估算全部工时</el-button>
      <el-button :icon="Save" plain :disabled="!dirtyDrafts.length" @click="emit('save-all')">保存全部修改</el-button>
      <el-button :icon="RefreshCw" plain :disabled="!drafts.some((draft) => draft.generateStatus === 'failed')" @click="emit('retry-failed')">仅重试失败项</el-button>
      <el-button :icon="Send" type="primary" :loading="pushing" :disabled="!pendingPublishDrafts.length" @click="emit('open-publish-check')">提交全部待提交日报</el-button>
    </div>
    <div v-if="generatedDrafts.length" class="weekly-publish-table">
      <div v-for="draft in generatedDrafts" :key="draft.key" class="weekly-publish-table-row">
        <div>
          <strong>{{ draft.date }} · {{ displayRepoName(draft.repo) }}</strong>
          <small>{{ getHoursSourceLabel(draft.workHoursSource) }} · {{ draft.workHours.toFixed(1) }}h</small>
        </div>
        <el-select :model-value="draft.projectOptionId" size="small" filterable placeholder="飞书项目" :disabled="!projectOptions.length" @update:model-value="(value: string) => emit('update-project', draft.key, value)">
          <el-option v-for="option in projectOptions" :key="option.id" :label="option.name" :value="option.id" />
        </el-select>
        <el-tag :type="getStatusType(draft)" size="small" effect="plain">{{ getStatusLabel(draft) }}</el-tag>
        <el-button link type="primary" @click="emit('select-draft', draft.key)">编辑</el-button>
      </div>
    </div>
    <div v-else class="weekly-empty-inline">生成日报后，这里会列出每条提交状态。</div>
  </section>

  <el-dialog :model-value="publishCheckVisible" title="发布前检查" width="480px" append-to-body @update:model-value="(value: boolean) => emit('update:publishCheckVisible', value)">
    <div class="weekly-publish-check">
      <div class="weekly-publish-check-stats">
        <div><strong>{{ publishCheckStats.publishable }}</strong><span>可发布</span></div>
        <div><strong>{{ publishCheckStats.totalHours.toFixed(1) }}</strong><span>总工时</span></div>
        <div><strong>{{ publishCheckStats.total }}</strong><span>已生成</span></div>
      </div>
      <div v-if="publishIssues.length" class="weekly-publish-check-issues"><strong>提交前需要注意</strong><p v-for="issue in publishIssues" :key="issue">{{ issue }}</p></div>
      <p v-else class="weekly-publish-check-ready">检查通过，将按日期顺序提交可发布日报。</p>
    </div>
    <template #footer>
      <el-button @click="emit('update:publishCheckVisible', false)">返回修改</el-button>
      <el-button type="primary" :loading="pushing" @click="emit('confirm-publish-all')">确认提交 {{ publishCheckStats.publishable }} 条</el-button>
    </template>
  </el-dialog>

  <el-drawer :model-value="showEvidence" title="提交记录依据" size="520px" @update:model-value="(value: boolean) => emit('update:showEvidence', value)">
    <div v-if="activeDraft?.result" class="weekly-evidence-drawer">
      <div class="weekly-evidence-summary"><strong>{{ activeDraft.date }} · {{ displayRepoName(activeDraft.repo) }}</strong><span>{{ activeDraft.result.commits.length }} 次提交 · {{ countWeeklyReportFiles(activeDraft.result) }} 个影响文件</span></div>
      <article v-for="commit in activeDraft.result.commits" :key="commit.hash" class="weekly-evidence-commit"><strong>{{ commit.message }}</strong><small>{{ commit.author }} · {{ commit.date }}</small><p>{{ commit.files.join('、') || '暂无文件明细' }}</p></article>
    </div>
    <el-empty v-else description="当前日报暂无提交依据" />
  </el-drawer>

  <el-dialog :model-value="showSupplement" title="局部补写当前日报" width="520px" @update:model-value="(value: boolean) => emit('update:showSupplement', value)">
    <el-input :model-value="supplementText" type="textarea" :rows="6" maxlength="1000" show-word-limit placeholder="只补充需要追加的工作、结果或协作内容，每行一项。" @update:model-value="(value: string) => emit('update:supplementText', value)" />
    <template #footer>
      <el-button @click="emit('update:showSupplement', false)">取消</el-button>
      <el-button type="primary" :disabled="!supplementText.trim()" @click="emit('append-supplement')">追加到日报</el-button>
    </template>
  </el-dialog>
</template>
