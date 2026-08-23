<script setup lang="ts">
import { CalendarDays, Calculator, FileText, Send } from 'lucide-vue-next';
import type { RepoInfo } from '@shared/types';
import type { WeeklyReportDraft } from '@/composables/weeklyReportActions';

interface GenerationProgress {
  total: number;
  completed: number;
  failed: number;
}

defineProps<{
  dateRange: [string, string];
  dateRangeLabel: string;
  sortedRepos: RepoInfo[];
  selectedRepoPaths: string[];
  selectedRepos: RepoInfo[];
  recentRepos: RepoInfo[];
  drafts: WeeklyReportDraft[];
  generatedDrafts: WeeklyReportDraft[];
  generatedHoursTotal: number;
  loading: boolean;
  pushing: boolean;
  status: string;
  generationProgress: GenerationProgress;
  displayRepoName: (repo: RepoInfo) => string;
  formatStatusLabel: (draft: WeeklyReportDraft) => string;
}>();

const emit = defineEmits<{
  (event: 'update:dateRange', value: [string, string]): void;
  (event: 'update:selectedRepoPaths', value: string[]): void;
  (event: 'date-range-change', value: [string, string] | null): void;
  (event: 'reuse-last-config'): void;
  (event: 'recalculate-hours'): void;
  (event: 'generate-all'): void;
  (event: 'generate-and-publish'): void;
}>();
</script>

<template>
  <section class="surface-card weekly-setup-card" data-weekly-stage="scope">
    <div class="weekly-section-head">
      <div>
        <span class="eyebrow">01 · 批量范围</span>
        <h2>选择一周日期与项目</h2>
        <p>最多选择连续 7 天；每个日期和项目都会生成一份可以独立编辑的日报。</p>
      </div>
      <el-tag type="info" effect="plain">{{ dateRangeLabel }}</el-tag>
    </div>

    <div class="weekly-form-grid">
      <div class="field">
        <label>日期范围</label>
        <el-date-picker
          :model-value="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          :clearable="false"
          :disabled="loading || pushing"
          @update:model-value="(value: unknown) => emit('update:dateRange', value as [string, string])"
          @change="(value: unknown) => emit('date-range-change', value as [string, string] | null)"
        />
      </div>
      <div class="weekly-range-summary">
        <CalendarDays :size="20" />
        <div>
          <strong>{{ dateRangeLabel }}</strong>
          <span>生成后可在下方逐日补充和编辑工作内容</span>
        </div>
      </div>
    </div>

    <div class="weekly-project-picker">
      <div class="weekly-project-picker-head">
        <label>项目范围</label>
        <span>{{ selectedRepos.length }}/{{ sortedRepos.length }} 个项目已选择</span>
      </div>
      <el-checkbox-group
        :model-value="selectedRepoPaths"
        class="weekly-project-options"
        :disabled="loading || pushing"
        @update:model-value="(value: unknown) => emit('update:selectedRepoPaths', value as string[])"
      >
        <el-checkbox v-for="repo in sortedRepos" :key="repo.path" :label="repo.path" border>
          {{ displayRepoName(repo) }}
        </el-checkbox>
      </el-checkbox-group>
      <div v-if="recentRepos.length" class="weekly-recent-repos">
        <span>最近使用</span>
        <el-button
          v-for="repo in recentRepos"
          :key="repo.path"
          size="small"
          plain
          @click="emit('update:selectedRepoPaths', Array.from(new Set([...selectedRepoPaths, repo.path])))"
        >
          {{ displayRepoName(repo) }}
        </el-button>
      </div>
      <p v-if="!sortedRepos.length" class="muted-text">暂无已扫描项目，请先在日报配置中选择工作区。</p>
    </div>

    <div class="weekly-action-row">
      <div class="weekly-summary-metrics">
        <span><strong>{{ drafts.length }}</strong> 条草稿</span>
        <span><strong>{{ generatedDrafts.length }}</strong> 条已生成</span>
        <span><strong>{{ generatedHoursTotal.toFixed(1) }}h</strong> 已分配工时</span>
      </div>
      <div class="weekly-action-buttons">
        <el-button plain @click="emit('reuse-last-config')">沿用上次配置</el-button>
        <el-button :icon="Calculator" plain :disabled="!generatedDrafts.length" @click="emit('recalculate-hours')">按工作内容重算工时</el-button>
        <el-button :icon="FileText" type="primary" :loading="loading" :disabled="!selectedRepos.length" @click="emit('generate-all')">生成整周日报</el-button>
        <el-button :icon="Send" type="success" plain :loading="loading || pushing" :disabled="!selectedRepos.length" @click="emit('generate-and-publish')">生成并提交</el-button>
      </div>
    </div>
    <div v-if="generationProgress.total" class="weekly-generation-progress" aria-live="polite">
      <div class="weekly-generation-progress-head">
        <strong>项目日报生成进度</strong>
        <span>{{ generationProgress.completed }}/{{ generationProgress.total }} 条已完成</span>
      </div>
      <el-progress
        :percentage="Math.round((generationProgress.completed / generationProgress.total) * 100)"
        :status="generationProgress.failed ? 'exception' : generationProgress.completed === generationProgress.total ? 'success' : undefined"
        :show-text="false"
        :stroke-width="8"
      />
      <div class="weekly-generation-items">
        <div v-for="draft in drafts" :key="draft.key" class="weekly-generation-item">
          <span :class="`is-${draft.generateStatus}`" />
          <strong>{{ draft.date }} · {{ displayRepoName(draft.repo) }}</strong>
          <small>{{ formatStatusLabel(draft) }}</small>
        </div>
      </div>
    </div>
    <p v-if="status" class="muted-text weekly-status">{{ status }}</p>
  </section>
</template>
