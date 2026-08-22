<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { CalendarDays, Calculator, CircleAlert, ExternalLink, FileText, RefreshCw, Save, Send, WandSparkles } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import { useWeeklyReports } from '@/composables/useWeeklyReports';

const emit = defineEmits<{
  (event: 'navigate', value: string): void;
}>();

const {
  sortedRepos, projectOptions, projectLoading, feishuLoading, dateRange, selectedRepoPaths, drafts,
  activeDraftKey, loading, pushing, status, selectedRepos, activeDraft, activeReportModel, draftGroups,
  generatedDrafts, dirtyDrafts, pendingPublishDrafts, publishableDrafts, generatedHoursTotal, dateRangeLabel,
  displayRepoName, handleDateRangeChange, formatDateLabel, getStatusLabel, getStatusType, getHoursSourceLabel,
  updateDraftProject, updateDraftHours, recalculateWorkHours, generateAll, generateCurrent, saveCurrent, saveAll, publishCurrent,
  publishAll, openSubmissionRecords, loadFeishuProjects, countWeeklyReportFiles,
} = useWeeklyReports();

type WorkflowStage = 'scope' | 'generate' | 'publish';
const activeStage = ref<WorkflowStage>('scope');
const publishCheckVisible = ref(false);
const autoSaveTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const workflowStages = [
  { key: 'scope' as const, index: '01', label: '范围' },
  { key: 'generate' as const, index: '02', label: '生成' },
  { key: 'publish' as const, index: '03', label: '发布' },
];
const generationProgress = computed(() => ({
  total: drafts.value.length,
  completed: drafts.value.filter((draft) => draft.generateStatus === 'success' || draft.generateStatus === 'failed').length,
  success: drafts.value.filter((draft) => draft.generateStatus === 'success').length,
  failed: drafts.value.filter((draft) => draft.generateStatus === 'failed').length,
  generating: drafts.value.filter((draft) => draft.generateStatus === 'generating').length,
}));
const workflowState = computed(() => ({
  scope: selectedRepos.value.length && dateRangeLabel.value !== '请选择有效日期范围' ? 'done' : 'current',
  generate: generationProgress.value.generating ? 'current' : generationProgress.value.completed === generationProgress.value.total && generationProgress.value.total ? (generationProgress.value.failed ? 'warning' : 'done') : 'current',
  publish: generatedDrafts.value.length && pendingPublishDrafts.value.length === 0 ? 'done' : generatedDrafts.value.length ? 'current' : 'pending',
} as Record<WorkflowStage, 'done' | 'current' | 'warning' | 'pending'>));
const publishCheckStats = computed(() => ({
  publishable: publishableDrafts.value.length,
  total: generatedDrafts.value.length,
  dirty: dirtyDrafts.value.length,
  missingTarget: generatedDrafts.value.filter((draft) => !draft.projectOptionId.trim()).length,
  unresolvedHours: generatedDrafts.value.filter((draft) => draft.workHoursSource === 'unresolved').length,
  totalHours: publishableDrafts.value.reduce((sum, draft) => sum + draft.workHours, 0),
}));
const publishIssues = computed(() => [
  publishCheckStats.value.missingTarget ? `${publishCheckStats.value.missingTarget} 条日报未选择飞书项目` : '',
  publishCheckStats.value.unresolvedHours ? `${publishCheckStats.value.unresolvedHours} 条日报需要确认工作时长` : '',
  publishCheckStats.value.dirty ? `${publishCheckStats.value.dirty} 条日报有未保存修改，发布前会自动保存` : '',
].filter(Boolean));

function stageLabel(stage: WorkflowStage) {
  const state = workflowState.value[stage];
  if (stage === 'scope') return state === 'done' ? '已完成' : '待完善';
  if (stage === 'generate') return generationProgress.value.total ? `${generationProgress.value.success}/${generationProgress.value.total} 已生成` : '待生成';
  return pendingPublishDrafts.value.length ? `${publishableDrafts.value.length} 条可发布` : generatedDrafts.value.length ? '已完成' : '待发布';
}

function scrollToStage(stage: WorkflowStage) {
  activeStage.value = stage;
  document.querySelector<HTMLElement>(`[data-weekly-stage="${stage}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function selectDraft(key: string) {
  if (key === activeDraftKey.value) return;
  const current = activeDraft.value;
  if (!current?.dirty) {
    activeDraftKey.value = key;
    return;
  }
  void ElMessageBox.confirm('当前日报有未保存修改，切换前先保存吗？', '未保存修改', {
    confirmButtonText: '保存并切换', cancelButtonText: '暂不切换', type: 'warning',
  }).then(async () => {
    await saveCurrent();
    activeDraftKey.value = key;
  }).catch(() => undefined);
}

function scheduleAutoSave() {
  if (!activeDraft.value?.dirty || !activeDraft.value.report.trim()) return;
  if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value);
  autoSaveTimer.value = setTimeout(async () => {
    autoSaveTimer.value = null;
    if (!activeDraft.value?.dirty) return;
    await saveCurrent();
    status.value = `${displayRepoName(activeDraft.value.repo)} ${activeDraft.value.date} 已自动保存`;
  }, 900);
}

function openPublishCheck() {
  if (!publishableDrafts.value.length) {
    ElMessage.warning('没有可发布的日报，请先生成内容并补齐目标和工时');
    return;
  }
  publishCheckVisible.value = true;
}

function confirmPublishAll() {
  publishCheckVisible.value = false;
  void publishAll();
}

watch(activeReportModel, scheduleAutoSave);
onMounted(() => window.addEventListener('beforeunload', handleBeforeUnload));
onBeforeUnmount(() => window.removeEventListener('beforeunload', handleBeforeUnload));
function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirtyDrafts.value.length) return;
  event.preventDefault();
  event.returnValue = '';
}
</script>

<template>
  <div class="view-stack weekly-reports-view atelier-page">
    <PageHeader title="一周日报" subtitle="按日期与项目批量生成、编辑和提交研发日报">
      <template #actions>
        <el-button :icon="ExternalLink" plain :loading="feishuLoading" @click="openSubmissionRecords">查看飞书记录</el-button>
        <el-button :icon="CalendarDays" plain @click="emit('navigate', 'config')">日报配置</el-button>
      </template>
    </PageHeader>

    <nav class="weekly-workflow-rail" aria-label="一周日报工作流">
      <button
        v-for="stage in workflowStages"
        :key="stage.key"
        type="button"
        class="weekly-workflow-step"
        :class="[{ active: activeStage === stage.key }, `is-${workflowState[stage.key]}`]"
        @click="scrollToStage(stage.key)"
      >
        <span>{{ stage.index }}</span>
        <strong>{{ stage.label }}</strong>
        <small>{{ stageLabel(stage.key) }}</small>
      </button>
    </nav>

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
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            :clearable="false"
            :disabled="loading || pushing"
            @change="handleDateRangeChange"
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
        <el-checkbox-group v-model="selectedRepoPaths" class="weekly-project-options" :disabled="loading || pushing">
          <el-checkbox v-for="repo in sortedRepos" :key="repo.path" :label="repo.path" border>
            {{ displayRepoName(repo) }}
          </el-checkbox>
        </el-checkbox-group>
        <p v-if="!sortedRepos.length" class="muted-text">暂无已扫描项目，请先在日报配置中选择工作区。</p>
      </div>

      <div class="weekly-action-row">
        <div class="weekly-summary-metrics">
          <span><strong>{{ drafts.length }}</strong> 条草稿</span>
          <span><strong>{{ generatedDrafts.length }}</strong> 条已生成</span>
          <span><strong>{{ generatedHoursTotal.toFixed(1) }}h</strong> 已分配工时</span>
        </div>
        <div class="weekly-action-buttons">
          <el-button :icon="Calculator" plain :disabled="!generatedDrafts.length" @click="recalculateWorkHours(true)">按工作内容重算工时</el-button>
          <el-button :icon="FileText" type="primary" :loading="loading" :disabled="!selectedRepos.length" @click="generateAll">生成整周日报</el-button>
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
            <small>{{ getStatusLabel(draft) }}</small>
          </div>
        </div>
      </div>
      <p v-if="status" class="muted-text weekly-status">{{ status }}</p>
    </section>

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
              @click="selectDraft(draft.key)"
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
          </div>
          <div v-if="activeDraft.report.trim() && activeDraft.result && !activeDraft.result.commits.length" class="weekly-no-commits-guide">
            <CircleAlert :size="18" />
            <span>当前日期没有匹配到提交记录，请扩大日期范围，或直接补充本日手动工作后保存。</span>
          </div>
          <el-input
            v-model="activeReportModel"
            class="weekly-report-textarea"
            type="textarea"
            :autosize="{ minRows: 18, maxRows: 32 }"
            resize="vertical"
            placeholder="生成后的日报正文会显示在这里，可直接编辑后保存或提交飞书"
          />
          <div class="weekly-editor-fields">
            <div class="field">
              <div class="weekly-field-label">
                <label>飞书所属项目</label>
                <el-button link type="primary" :loading="projectLoading" @click="loadFeishuProjects()">刷新项目</el-button>
              </div>
              <el-select
                :model-value="activeDraft.projectOptionId"
                filterable
                placeholder="请先获取飞书项目选项"
                :disabled="!projectOptions.length"
                @update:model-value="(value: string) => updateDraftProject(activeDraft.key, value)"
              >
                <el-option v-for="option in projectOptions" :key="option.id" :label="option.name" :value="option.id" />
              </el-select>
              <small v-if="!projectOptions.length" class="field-hint">{{ projectLoading ? '正在获取飞书项目…' : '请先在日报配置中解析飞书项目选项' }}</small>
            </div>
            <div class="field">
              <label>工作时长</label>
              <div class="weekly-hours-control">
                <el-input-number
                  :model-value="activeDraft.workHours"
                  :min="0"
                  :max="24"
                  :step="0.5"
                  :precision="1"
                  controls-position="right"
                  @update:model-value="(value: number | null | undefined) => updateDraftHours(activeDraft.key, value)"
                />
                <span>小时 · {{ getHoursSourceLabel(activeDraft.workHoursSource) }}</span>
              </div>
            </div>
          </div>
          <div class="weekly-editor-actions">
            <el-button
              :icon="RefreshCw"
              plain
              :loading="activeDraft.generateStatus === 'generating'"
              :disabled="loading || pushing"
              @click="generateCurrent"
            >
              重新生成当前项目
            </el-button>
            <el-button :icon="Save" plain :disabled="!activeDraft.report.trim()" @click="saveCurrent">保存当前日报</el-button>
            <el-button :icon="Send" type="primary" :loading="pushing" :disabled="!activeDraft.report.trim()" @click="publishCurrent">单独提交飞书</el-button>
          </div>
        </div>
        <div v-else class="weekly-empty-state editor-empty">
          <WandSparkles :size="30" />
          <strong>等待生成日报</strong>
          <span>选择项目后点击“生成整周日报”，再逐日编辑内容。</span>
        </div>
      </div>
    </section>

    <section class="surface-card weekly-publish-panel" data-weekly-stage="publish">
      <div class="weekly-section-head compact">
        <div>
          <span class="eyebrow">04 · 批量提交</span>
          <h2>一次提交整周已生成日报</h2>
          <p>系统会按日期升序逐条提交；某条失败不会影响其他已成功的提交。</p>
        </div>
        <div class="weekly-publish-summary">
          <strong>{{ publishableDrafts.length }}</strong>
          <span>条可提交</span>
        </div>
      </div>
      <div class="weekly-publish-actions">
        <el-button :icon="RefreshCw" plain :disabled="!generatedDrafts.length" @click="recalculateWorkHours(true)">重新估算全部工时</el-button>
        <el-button :icon="Save" plain :disabled="!dirtyDrafts.length" @click="saveAll">保存全部修改</el-button>
        <el-button :icon="Send" type="primary" :loading="pushing" :disabled="!pendingPublishDrafts.length" @click="openPublishCheck">提交全部待提交日报</el-button>
      </div>
      <div v-if="generatedDrafts.length" class="weekly-publish-table">
        <div v-for="draft in generatedDrafts" :key="draft.key" class="weekly-publish-table-row">
          <div>
            <strong>{{ draft.date }} · {{ displayRepoName(draft.repo) }}</strong>
            <small>{{ getHoursSourceLabel(draft.workHoursSource) }} · {{ draft.workHours.toFixed(1) }}h</small>
          </div>
          <el-select
            :model-value="draft.projectOptionId"
            size="small"
            filterable
            placeholder="飞书项目"
            :disabled="!projectOptions.length"
            @update:model-value="(value: string) => updateDraftProject(draft.key, value)"
          >
            <el-option v-for="option in projectOptions" :key="option.id" :label="option.name" :value="option.id" />
          </el-select>
          <el-tag :type="getStatusType(draft)" size="small" effect="plain">{{ getStatusLabel(draft) }}</el-tag>
          <el-button link type="primary" @click="selectDraft(draft.key)">编辑</el-button>
        </div>
      </div>
      <div v-else class="weekly-empty-inline">生成日报后，这里会列出每条提交状态。</div>
    </section>

    <el-dialog v-model="publishCheckVisible" title="发布前检查" width="480px" append-to-body>
      <div class="weekly-publish-check">
        <div class="weekly-publish-check-stats">
          <div><strong>{{ publishCheckStats.publishable }}</strong><span>可发布</span></div>
          <div><strong>{{ publishCheckStats.totalHours.toFixed(1) }}</strong><span>总工时</span></div>
          <div><strong>{{ publishCheckStats.total }}</strong><span>已生成</span></div>
        </div>
        <div v-if="publishIssues.length" class="weekly-publish-check-issues">
          <strong>提交前需要注意</strong>
          <p v-for="issue in publishIssues" :key="issue">{{ issue }}</p>
        </div>
        <p v-else class="weekly-publish-check-ready">检查通过，将按日期顺序提交可发布日报。</p>
      </div>
      <template #footer>
        <el-button @click="publishCheckVisible = false">返回修改</el-button>
        <el-button type="primary" :loading="pushing" @click="confirmPublishAll">确认提交 {{ publishCheckStats.publishable }} 条</el-button>
      </template>
    </el-dialog>
  </div>
</template>
