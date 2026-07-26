<script setup lang="ts">
import { computed } from 'vue';
import {
  CheckCircle2,
  CircleAlert,
  ClipboardCopy,
  Download,
  FileText,
  RefreshCw,
  Save,
} from 'lucide-vue-next';

type GenerationCheckAction = '' | 'config' | 'ai';
type DraftGenerateStatus = 'idle' | 'generating' | 'success' | 'failed';
type DraftPublishStatus = 'idle' | 'publishing' | 'success' | 'failed';

interface GenerationCheck {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
  action: GenerationCheckAction;
  required: boolean;
}

interface MetricItem {
  label: string;
  value: number;
}

interface ProjectReportDraft {
  key: string;
  repoName: string;
  repoPath: string;
  report: string;
  hasReport: boolean;
  hasLastReportResult: boolean;
  dirty: boolean;
  generateStatus: DraftGenerateStatus;
  publishStatus: DraftPublishStatus;
  reportTitle: string;
  reportSubtitle: string;
  generatedAtText: string;
}

const props = defineProps<{
  drafts: ProjectReportDraft[];
  activeDraftKey: string;
  manualWorkContent: string;
  status: string;
  setupReady: boolean;
  readinessDetail: string;
  generateButtonLabel: string;
  loading: boolean;
  generationChecks: GenerationCheck[];
  metrics: MetricItem[];
  activeHasReport: boolean;
  activeHasLastReportResult: boolean;
  canSaveAll: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:active-draft-key', value: string): void;
  (e: 'update-draft-report', key: string, value: string): void;
  (e: 'update:manual-work-content', value: string): void;
  (e: 'generate-all'): void;
  (e: 'generate-current'): void;
  (e: 'save-current'): void;
  (e: 'save-all'): void;
  (e: 'copy-current'): void;
  (e: 'export-current'): void;
  (e: 'navigate', value: string): void;
}>();

const activeDraft = computed(() => props.drafts.find((item) => item.key === props.activeDraftKey) ?? props.drafts[0]);

const activeKeyModel = computed({
  get: () => props.activeDraftKey,
  set: (value: string) => emit('update:active-draft-key', value),
});

const reportModel = computed({
  get: () => activeDraft.value?.report ?? '',
  set: (value: string) => {
    if (activeDraft.value) emit('update-draft-report', activeDraft.value.key, value);
  },
});

function getTabStatusLabel(item: ProjectReportDraft) {
  if (item.generateStatus === 'generating') return '生成中';
  if (item.publishStatus === 'publishing') return '发布中';
  if (item.publishStatus === 'success') return '已发布';
  if (item.publishStatus === 'failed') return '发布失败';
  if (item.generateStatus === 'failed') return '生成失败';
  if (item.dirty) return '未保存';
  if (item.hasReport) return '已生成';
  return '待生成';
}

function getTabStatusType(item: ProjectReportDraft) {
  if (item.publishStatus === 'success') return 'success';
  if (item.publishStatus === 'failed' || item.generateStatus === 'failed') return 'danger';
  if (item.generateStatus === 'generating' || item.publishStatus === 'publishing') return 'warning';
  if (item.dirty) return 'warning';
  if (item.hasReport) return 'success';
  return 'info';
}
</script>

<template>
  <section class="surface-card step-card report-editor-card atelier-stage-card" data-card-stage="生成" aria-label="日报生成">
    <div class="step-title">
      <span>2</span>
      <strong>生成与编辑</strong>
    </div>

    <div class="field manual-work-field">
      <label>补充工作内容（可选）</label>
      <el-input
        :model-value="manualWorkContent"
        type="textarea"
        :rows="4"
        :maxlength="2000"
        show-word-limit
        resize="vertical"
        placeholder="填写 Git 提交中无法体现的工作，每行一项。例如：完成教师发展平台网页测试；上线课程管理功能；参与需求评审。"
        @update:model-value="(value: string) => emit('update:manual-work-content', value)"
      />
    </div>

    <div class="generation-toolbar">
      <div class="generation-toolbar-copy">
        <strong>{{ setupReady ? '准备就绪，可以生成' : '生成条件未完成' }}</strong>
        <span>{{ readinessDetail }}</span>
      </div>
      <el-button class="generate-cta" :icon="FileText" type="primary" size="large" :loading="loading" @click="emit('generate-all')">
        {{ generateButtonLabel }}
      </el-button>
    </div>

    <div class="generation-check-strip">
      <el-button
        v-for="item in generationChecks"
        :key="item.key"
        class="generation-check-chip"
        :class="{ ready: item.ok, warning: item.required && !item.ok, optional: !item.required && !item.ok }"
        :disabled="!item.action"
        plain
        @click="item.action && emit('navigate', item.action)"
      >
        <CheckCircle2 v-if="item.ok" :size="16" />
        <CircleAlert v-else :size="16" />
        <span class="generation-check-copy">
          <strong>{{ item.label }}</strong>
          <small>{{ item.ok ? '已就绪' : item.detail }}</small>
        </span>
      </el-button>
    </div>

    <div v-if="drafts.length" class="project-report-tabs">
      <el-tabs v-model="activeKeyModel" class="project-tabs">
        <el-tab-pane v-for="item in drafts" :key="item.key" :name="item.key">
          <template #label>
            <span class="project-tab-label">
              <strong>{{ item.repoName }}</strong>
              <el-tag class="project-tab-status" :type="getTabStatusType(item)" size="small" effect="plain">
                {{ getTabStatusLabel(item) }}
              </el-tag>
            </span>
          </template>
        </el-tab-pane>
      </el-tabs>
    </div>

    <div v-if="activeHasLastReportResult" class="metric-grid">
      <div v-for="item in metrics" :key="item.label" class="metric-card">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </div>

    <article class="report-preview" :class="{ 'is-empty': !activeHasReport }">
      <div class="report-preview-head">
        <div>
          <h2>{{ activeDraft?.reportTitle || '请选择项目生成日报' }}</h2>
          <span>{{ activeDraft?.reportSubtitle || '选择仓库后会在这里展示项目日报' }}</span>
        </div>
        <div class="report-preview-actions">
          <small>生成时间：{{ activeDraft?.generatedAtText || '暂无' }}</small>
          <el-button
            v-if="activeDraft"
            :icon="RefreshCw"
            :loading="activeDraft.generateStatus === 'generating'"
            :disabled="loading"
            plain
            size="small"
            @click="emit('generate-current')"
          >
            重新生成当前项目
          </el-button>
        </div>
      </div>

      <div v-if="!activeHasReport" class="report-empty-panel">
        <FileText :size="30" />
        <strong>等待生成日报正文</strong>
        <span>选择仓库和时间范围后，点击“生成全部日报”，也可以只重新生成当前项目。</span>
      </div>

      <el-input
        v-else
        v-model="reportModel"
        class="editable-report"
        type="textarea"
        :autosize="{ minRows: 16, maxRows: 28 }"
        resize="vertical"
        placeholder="生成后的研发日报会显示在这里，可直接修改后保存"
      />
    </article>

    <div class="button-row end">
      <el-button :icon="Save" :disabled="!activeHasReport" plain @click="emit('save-current')">保存当前</el-button>
      <el-button :icon="Save" :disabled="!canSaveAll" plain @click="emit('save-all')">保存全部修改</el-button>
      <el-button :icon="ClipboardCopy" :disabled="!activeHasReport" plain @click="emit('copy-current')">复制内容</el-button>
      <el-button :icon="Download" :disabled="!activeHasReport" type="primary" plain @click="emit('export-current')">导出 Markdown</el-button>
    </div>
    <p v-if="status" class="muted-text">{{ status }}</p>
  </section>
</template>
