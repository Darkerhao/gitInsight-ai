<script setup lang="ts">
import { CalendarDays, CircleAlert, RefreshCw, Save, Send, WandSparkles } from 'lucide-vue-next';
import type { RepoInfo, ReportResult, FeishuProjectOption } from '@shared/types';
import type { WeeklyReportDraft } from '@/composables/weeklyReportActions';
import type { WeeklyQualityResult } from '@shared/weeklyReportQuality';

type DraftGroup = { date: string; items: WeeklyReportDraft[] };

defineProps<{
  draftGroups: DraftGroup[];
  selectedRepos: RepoInfo[];
  activeDraft: WeeklyReportDraft | undefined;
  activeReportModel: string;
  templateKey: string;
  dirtyDrafts: WeeklyReportDraft[];
  projectOptions: FeishuProjectOption[];
  projectLoading: boolean;
  loading: boolean;
  pushing: boolean;
  activeQuality: WeeklyQualityResult | null;
  duplicateKeys: Set<string>;
  displayRepoName: (repo: RepoInfo) => string;
  formatDateLabel: (date: string) => string;
  getStatusLabel: (draft: WeeklyReportDraft) => string;
  getStatusType: (draft: WeeklyReportDraft) => string;
  getHoursSourceLabel: (source: WeeklyReportDraft['workHoursSource']) => string;
  countWeeklyReportFiles: (result: ReportResult | null) => number;
}>();

const emit = defineEmits<{
  (event: 'select-draft', key: string): void;
  (event: 'update:activeReportModel', value: string): void;
  (event: 'update:templateKey', value: string): void;
  (event: 'refresh-projects'): void;
  (event: 'update-project', key: string, value: string): void;
  (event: 'update-hours', key: string, value: number | null | undefined): void;
  (event: 'apply-template'): void;
  (event: 'show-supplement'): void;
  (event: 'show-evidence'): void;
  (event: 'generate-current'): void;
  (event: 'save-current'): void;
  (event: 'publish-current'): void;
}>();
</script>

<template>
  <section class="weekly-workspace-grid" data-weekly-stage="generate">
    <div class="surface-card weekly-draft-list">
      <div class="weekly-section-head compact">
        <div>
          <span class="eyebrow">02 · 日报草稿</span>
          <h2>按日期查看</h2>
        </div>
        <el-tag type="info" effect="plain">{{ dirtyDrafts.length }} 条待保存</el-tag>
      </div>
      <div v-if="!draftGroups.length || !selectedRepos.length" class="weekly-empty-state">
        <CalendarDays :size="28" />
        <strong>先选择日期和项目</strong>
        <span>生成后，每个项目每天会出现在这里。</span>
      </div>
      <div v-else class="weekly-date-groups">
        <div v-for="group in draftGroups" :key="group.date" class="weekly-date-group">
          <div class="weekly-date-heading">
            <strong>{{ formatDateLabel(group.date) }}</strong>
            <span>{{ group.date }}</span>
          </div>
          <button
            v-for="draft in group.items"
            :key="draft.key"
            type="button"
            class="weekly-draft-row"
            :class="{ active: activeDraft?.key === draft.key }"
            @click="emit('select-draft', draft.key)"
          >
            <span class="weekly-draft-row-main">
              <strong>{{ displayRepoName(draft.repo) }}</strong>
              <small>{{ draft.workHours.toFixed(1) }}h · {{ getHoursSourceLabel(draft.workHoursSource) }}</small>
            </span>
            <el-tag :type="getStatusType(draft)" size="small" effect="plain">{{ getStatusLabel(draft) }}</el-tag>
          </button>
        </div>
      </div>
    </div>

    <div class="surface-card weekly-editor-panel">
      <div class="weekly-section-head compact">
        <div>
          <span class="eyebrow">03 · 编辑与单独提交</span>
          <h2>{{ activeDraft ? `${displayRepoName(activeDraft.repo)} · ${activeDraft.date}` : '选择一条日报' }}</h2>
        </div>
        <el-tag v-if="activeDraft" :type="getStatusType(activeDraft)" effect="plain">{{ getStatusLabel(activeDraft) }}</el-tag>
      </div>
      <div v-if="activeDraft" class="weekly-editor-content">
        <div class="weekly-editor-meta">
          <span>提交记录：{{ activeDraft.result?.commits.length ?? 0 }}</span>
          <span>影响文件：{{ countWeeklyReportFiles(activeDraft.result) }}</span>
          <span v-if="activeDraft.message" class="weekly-editor-message">{{ activeDraft.message }}</span>
          <el-tag v-if="activeQuality" :type="activeQuality.score === 'good' ? 'success' : activeQuality.score === 'empty' ? 'info' : 'warning'" size="small" effect="plain">质量：{{ activeQuality.label }}</el-tag>
          <el-tag v-if="duplicateKeys.has(activeDraft.key)" type="warning" size="small" effect="plain">内容重复</el-tag>
        </div>
        <div v-if="activeDraft.report.trim() && activeDraft.result && !activeDraft.result.commits.length" class="weekly-no-commits-guide">
          <CircleAlert :size="18" />
          <span>当前日期没有匹配到提交记录，请扩大日期范围，或直接补充本日手动工作后保存。</span>
        </div>
        <el-input
          :model-value="activeReportModel"
          class="weekly-report-textarea"
          type="textarea"
          :autosize="{ minRows: 18, maxRows: 32 }"
          resize="vertical"
          placeholder="生成后的日报正文会显示在这里，可直接编辑后保存或提交飞书"
          @update:model-value="(value: string) => emit('update:activeReportModel', value)"
        />
        <div class="weekly-editor-fields">
          <div class="field">
            <div class="weekly-field-label">
              <label>飞书所属项目</label>
              <el-button link type="primary" :loading="projectLoading" @click="emit('refresh-projects')">刷新项目</el-button>
            </div>
            <el-select :model-value="activeDraft.projectOptionId" filterable placeholder="请先获取飞书项目选项" :disabled="!projectOptions.length" @update:model-value="(value: string) => emit('update-project', activeDraft!.key, value)">
              <el-option v-for="option in projectOptions" :key="option.id" :label="option.name" :value="option.id" />
            </el-select>
            <small v-if="!projectOptions.length" class="field-hint">{{ projectLoading ? '正在获取飞书项目…' : '请先在日报配置中解析飞书项目选项' }}</small>
          </div>
          <div class="field">
            <label>工作时长</label>
            <div class="weekly-hours-control">
              <el-input-number :model-value="activeDraft.workHours" :min="0" :max="24" :step="0.5" :precision="1" controls-position="right" @update:model-value="(value: number | null | undefined) => emit('update-hours', activeDraft!.key, value)" />
              <span>小时 · {{ getHoursSourceLabel(activeDraft.workHoursSource) }}</span>
            </div>
          </div>
        </div>
        <div class="weekly-editor-tools">
          <el-select :model-value="templateKey" size="small" @update:model-value="(value: string) => emit('update:templateKey', value)">
            <el-option label="标准模板" value="standard" />
            <el-option label="简洁模板" value="concise" />
            <el-option label="详细模板" value="detailed" />
          </el-select>
          <el-button size="small" plain @click="emit('apply-template')">插入模板</el-button>
          <el-button size="small" plain @click="emit('show-supplement')">局部补写</el-button>
          <el-button size="small" plain :disabled="!activeDraft.result" @click="emit('show-evidence')">查看提交依据</el-button>
          <span class="weekly-shortcut-hint">Ctrl+S 保存 · Ctrl+Enter 提交当前</span>
        </div>
        <div v-if="activeQuality?.issues.length" class="weekly-quality-issues"><span v-for="issue in activeQuality.issues" :key="issue">{{ issue }}</span></div>
        <div class="weekly-editor-actions">
          <el-button :icon="RefreshCw" plain :loading="activeDraft.generateStatus === 'generating'" :disabled="loading || pushing" @click="emit('generate-current')">重新生成当前项目</el-button>
          <el-button :icon="Save" plain :disabled="!activeDraft.report.trim()" @click="emit('save-current')">保存当前日报</el-button>
          <el-button :icon="Send" type="primary" :loading="pushing" :disabled="!activeDraft.report.trim()" @click="emit('publish-current')">单独提交飞书</el-button>
        </div>
      </div>
      <div v-else class="weekly-empty-state editor-empty">
        <WandSparkles :size="30" />
        <strong>等待生成日报</strong>
        <span>选择项目后点击“生成整周日报”，再逐日编辑内容。</span>
      </div>
    </div>
  </section>
</template>
