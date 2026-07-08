<script setup lang="ts">
import { computed } from 'vue';
import { ExternalLink, Send } from 'lucide-vue-next';
import StatusBadge from '@/components/common/StatusBadge.vue';
import type { DailyReportRecord, FeishuProjectOption } from '@shared/types';

type RecordStatus = 'success' | 'failed' | 'pending';
type DraftPublishStatus = 'idle' | 'publishing' | 'success' | 'failed';

interface ProjectPublishDraft {
  key: string;
  repoName: string;
  hasReport: boolean;
  projectOptionId: string;
  workHours: number;
  publishStatus: DraftPublishStatus;
  publishMessage: string;
}

const props = defineProps<{
  activeDraft?: ProjectPublishDraft;
  drafts: ProjectPublishDraft[];
  projectOptions: FeishuProjectOption[];
  generationRecords: DailyReportRecord[];
  canPublishActive: boolean;
  canPublishAll: boolean;
  publishableCount: number;
  totalDraftCount: number;
  pushing: boolean;
  feishuLoading: boolean;
  workHourPresets: number[];
  formatDateTime: (value?: string) => string;
  getRecordStatus: (item: DailyReportRecord) => { status: RecordStatus; label: string };
}>();

const emit = defineEmits<{
  (e: 'navigate', value: string): void;
  (e: 'update-draft-project', key: string, value: string): void;
  (e: 'update-draft-hours', key: string, value: number | undefined): void;
  (e: 'commit-draft-hours', key: string, value: number | undefined): void;
  (e: 'publish-current'): void;
  (e: 'publish-all'): void;
  (e: 'open-submission-records'): void;
}>();

const activeProjectOptionId = computed({
  get: () => props.activeDraft?.projectOptionId ?? '',
  set: (value: string) => {
    if (props.activeDraft) emit('update-draft-project', props.activeDraft.key, value);
  },
});

const activeWorkHours = computed({
  get: () => props.activeDraft?.workHours ?? 8,
  set: (value: number | null | undefined) => {
    if (props.activeDraft) emit('update-draft-hours', props.activeDraft.key, typeof value === 'number' ? value : undefined);
  },
});

const publishStatusTitle = computed(() => {
  const draft = props.activeDraft;
  if (!draft) return '等待选择项目';
  if (!draft.hasReport) return '等待日报正文';
  if (!draft.projectOptionId) return '请选择飞书目标';
  if (draft.publishStatus === 'publishing') return '正在发布当前项目';
  if (draft.publishStatus === 'success') return '当前项目已发布';
  if (draft.publishStatus === 'failed') return '当前项目发布失败';
  return '可发布到飞书';
});

const publishStatusDetail = computed(() => {
  const draft = props.activeDraft;
  if (!draft) return '先在左侧选择或生成一个项目日报';
  if (!draft.hasReport) return '先在左侧生成或编辑当前项目的日报内容';
  if (!draft.projectOptionId) return '选择当前项目的飞书所属项目后即可发布';
  if (draft.publishMessage) return draft.publishMessage;
  const projectName = props.projectOptions.find((item) => item.id === draft.projectOptionId)?.name || '已选择项目';
  return `${draft.repoName} 将发布到 ${projectName}，工作时长 ${Number(draft.workHours).toFixed(1)} 小时`;
});

function normalizeHourInput(value: number | null | undefined) {
  return typeof value === 'number' ? value : undefined;
}

function updateDraftHours(key: string, value: number | null | undefined) {
  emit('update-draft-hours', key, normalizeHourInput(value));
}

function commitDraftHours(key: string, value: number | null | undefined) {
  emit('commit-draft-hours', key, normalizeHourInput(value));
}

function applyPresetHours(key: string, value: number) {
  emit('update-draft-hours', key, value);
  emit('commit-draft-hours', key, value);
}
</script>

<template>
  <aside class="view-stack">
    <section class="surface-card publish-panel">
      <div class="step-title with-action">
        <div>
          <span>3</span>
          <strong>发布与同步</strong>
        </div>
        <StatusBadge :status="canPublishActive ? 'success' : 'pending'" :label="canPublishActive ? '可发布' : '待准备'" />
      </div>

      <div class="publish-summary-card" :class="{ ready: canPublishActive }">
        <Send :size="18" />
        <div>
          <strong>{{ publishStatusTitle }}</strong>
          <span>{{ publishStatusDetail }}</span>
        </div>
      </div>

      <div class="publish-hint">
        <span>自动同步、字段映射与定时配置统一在日报配置页维护。</span>
        <el-button link type="primary" @click="emit('navigate', 'config')">去配置</el-button>
      </div>

      <div class="field">
        <label>当前项目</label>
        <div class="active-project-card">
          <strong>{{ activeDraft?.repoName || '暂无项目' }}</strong>
          <span>{{ publishableCount }}/{{ totalDraftCount }} 个项目可发布</span>
        </div>
      </div>

      <div class="field">
        <label>选择目标</label>
        <el-select
          v-model="activeProjectOptionId"
          :disabled="!activeDraft"
          filterable
          placeholder="请先获取飞书项目选项"
          no-match-text="未找到匹配项目"
          no-data-text="暂无飞书项目选项"
        >
          <el-option v-for="item in projectOptions" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
      </div>
      <div class="field">
        <label>工作时长</label>
        <div class="hour-field">
          <el-input-number
            v-model="activeWorkHours"
            :disabled="!activeDraft"
            :min="0.5"
            :max="24"
            :step="0.5"
            :precision="1"
            controls-position="right"
            @change="(value: number | null | undefined) => activeDraft && commitDraftHours(activeDraft.key, value)"
          />
          <span>小时</span>
        </div>
        <div class="hour-presets">
          <el-button
            v-for="hours in workHourPresets"
            :key="hours"
            class="hour-preset-btn"
            :class="{ active: Number(activeDraft?.workHours) === hours }"
            :disabled="!activeDraft"
            plain
            size="small"
            @click="activeDraft && applyPresetHours(activeDraft.key, hours)"
          >
            {{ hours }}h
          </el-button>
        </div>
      </div>

      <div class="current-publish-action">
        <el-button class="current-publish-btn" :icon="Send" type="primary" :loading="pushing" :disabled="!canPublishActive" @click="emit('publish-current')">
          仅发布当前项目
        </el-button>
      </div>

      <div class="batch-publish-panel">
        <div class="batch-publish-head">
          <div>
            <strong>批量发布项目</strong>
            <span>发布全部时会按下方每个项目的目标和工时逐条提交</span>
          </div>
          <small>{{ publishableCount }}/{{ totalDraftCount }}</small>
        </div>

        <div class="batch-publish-list">
          <div v-if="!drafts.length" class="empty-state">暂无可配置项目</div>
          <div
            v-for="item in drafts"
            :key="item.key"
            class="batch-publish-item"
            :class="{ disabled: !item.hasReport, success: item.publishStatus === 'success', failed: item.publishStatus === 'failed' }"
          >
            <div class="batch-publish-item-head">
              <strong>{{ item.repoName }}</strong>
              <el-tag v-if="!item.hasReport" type="info" size="small" effect="plain">待生成</el-tag>
              <el-tag v-else-if="!item.projectOptionId" type="warning" size="small" effect="plain">待选目标</el-tag>
              <el-tag v-else-if="item.publishStatus === 'success'" type="success" size="small" effect="plain">已发布</el-tag>
              <el-tag v-else-if="item.publishStatus === 'failed'" type="danger" size="small" effect="plain">失败</el-tag>
              <el-tag v-else type="success" size="small" effect="plain">可发布</el-tag>
            </div>

            <el-select
              :model-value="item.projectOptionId"
              :disabled="!item.hasReport"
              filterable
              size="small"
              placeholder="飞书目标"
              no-match-text="未找到匹配项目"
              no-data-text="暂无飞书项目选项"
              @change="(value: string) => emit('update-draft-project', item.key, value)"
            >
              <el-option v-for="option in projectOptions" :key="option.id" :label="option.name" :value="option.id" />
            </el-select>

            <div class="batch-hour-row">
              <el-input-number
                :model-value="item.workHours"
                :disabled="!item.hasReport"
                :min="0.5"
                :max="24"
                :step="0.5"
                :precision="1"
                size="small"
                controls-position="right"
                @update:model-value="(value: number | null | undefined) => updateDraftHours(item.key, value)"
                @change="(value: number | null | undefined) => commitDraftHours(item.key, value)"
              />
              <span>小时</span>
            </div>
          </div>
        </div>

        <div class="batch-publish-footer">
          <el-button class="batch-publish-btn" :icon="Send" plain :loading="pushing" :disabled="!canPublishAll" @click="emit('publish-all')">
            发布全部已生成项目
          </el-button>
        </div>
      </div>

      <el-button class="submission-record-btn" :icon="ExternalLink" plain :loading="feishuLoading" @click="emit('open-submission-records')">
        查看日报提交记录
      </el-button>
    </section>

    <section class="surface-card record-panel">
      <div class="panel-head">
        <div>
          <h3>生成记录</h3>
          <small>最近 5 条</small>
        </div>
        <el-button link type="primary" @click="emit('navigate', 'history')">查看全部</el-button>
      </div>
      <div class="record-list">
        <div v-if="!generationRecords.length" class="empty-state">暂无生成记录</div>
        <div v-for="item in generationRecords" :key="item.id" class="record-item">
          <StatusBadge :status="getRecordStatus(item).status" :label="getRecordStatus(item).label" />
          <div>
            <strong>{{ item.date }} 日报</strong>
            <span>{{ item.repoNames.join('、') || '未记录项目' }} · {{ formatDateTime(item.generatedAt) }}</span>
          </div>
        </div>
      </div>
    </section>
  </aside>
</template>
