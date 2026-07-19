<script setup lang="ts">
import { computed } from 'vue';
import { Calculator, CalendarDays, ExternalLink, Send } from 'lucide-vue-next';
import StatusBadge from '@/components/common/StatusBadge.vue';
import type { DailyReportRecord, FeishuProjectOption } from '@shared/types';

type DateShortcut = 'today' | 'yesterday' | 'rolling' | 'custom';
type RecordStatus = 'success' | 'failed' | 'pending';
type DraftPublishStatus = 'idle' | 'publishing' | 'success' | 'failed';
type DraftWorkHoursSource = 'default' | 'estimated' | 'manual';

interface ProjectPublishDraft {
  key: string;
  repoName: string;
  hasReport: boolean;
  projectOptionId: string;
  workHours: number;
  workHoursSource: DraftWorkHoursSource;
  commitsCount: number;
  filesCount: number;
  publishStatus: DraftPublishStatus;
  publishMessage: string;
}

const props = defineProps<{
  activeDraft?: ProjectPublishDraft;
  drafts: ProjectPublishDraft[];
  projectOptions: FeishuProjectOption[];
  generationRecords: DailyReportRecord[];
  reportDate: string;
  reportRangeLabel: string;
  dateShortcut: DateShortcut;
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
  (e: 'recalculate-hours'): void;
  (e: 'report-date-change', value: string): void;
  (e: 'set-date-shortcut', value: DateShortcut): void;
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

const canRecalculateHours = computed(() => props.drafts.some((item) => item.commitsCount > 0));
const generatedWorkHoursTotal = computed(() =>
  props.drafts
    .filter((item) => item.hasReport)
    .reduce((sum, item) => sum + Number(item.workHours || 0), 0),
);

function getWorkHoursSourceLabel(source: DraftWorkHoursSource) {
  if (source === 'estimated') return '自动分配';
  if (source === 'manual') return '手动调整';
  return '默认工时';
}

function getWorkHoursSourceType(source: DraftWorkHoursSource) {
  if (source === 'estimated') return 'success';
  if (source === 'manual') return 'warning';
  return 'info';
}

function getWorkHoursEvidence(item?: ProjectPublishDraft) {
  if (!item) return '生成日报后可按提交活跃度自动分配';
  if (item.workHoursSource === 'estimated') {
    return `依据 ${item.commitsCount} 次提交、${item.filesCount} 个影响文件自动分配，可继续手动调整`;
  }
  if (item.workHoursSource === 'manual') return '当前工时已手动调整，重新生成时会优先保留';
  return item.commitsCount ? '当前使用默认工时，可点击重新计算按提交占比分配' : '当前提交范围内暂无可计算记录';
}

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
  <aside class="view-stack publish-sidebar">
    <section class="surface-card publish-panel">
      <div class="step-title with-action">
        <div>
          <span>3</span>
          <strong>发布与同步</strong>
        </div>
        <StatusBadge :status="canPublishActive ? 'success' : 'pending'" :label="canPublishActive ? '可发布' : '待准备'" />
      </div>

      <div class="publish-control-section publish-status-section">
        <div class="publish-summary-card" :class="{ ready: canPublishActive }">
          <Send :size="18" />
          <div>
            <strong>{{ publishStatusTitle }}</strong>
            <span>{{ publishStatusDetail }}，发布日期 {{ reportDate || '未选择' }}</span>
          </div>
        </div>

        <div class="publish-hint">
          <span>自动同步、字段映射与定时配置统一在日报配置页维护。</span>
          <el-button link type="primary" @click="emit('navigate', 'config')">去配置</el-button>
        </div>
      </div>

      <div class="publish-control-section current-publish-section">
        <div class="field">
          <label>当前项目</label>
          <div class="active-project-card">
            <strong>{{ activeDraft?.repoName || '暂无项目' }}</strong>
            <span>{{ publishableCount }}/{{ totalDraftCount }} 个项目可发布</span>
          </div>
        </div>

        <div class="field publish-date-field">
          <label>发布日期</label>
          <el-date-picker
            :model-value="reportDate"
            type="date"
            value-format="YYYY-MM-DD"
            :clearable="false"
            placeholder="选择发布日期"
            @change="(value: string) => emit('report-date-change', value)"
          />
          <div class="publish-date-shortcuts">
            <el-button
              class="publish-date-shortcut-btn"
              :class="{ active: dateShortcut === 'today' }"
              :icon="CalendarDays"
              plain
              size="small"
              @click="emit('set-date-shortcut', 'today')"
            >
              今天
            </el-button>
            <el-button
              class="publish-date-shortcut-btn"
              :class="{ active: dateShortcut === 'yesterday' }"
              :icon="CalendarDays"
              plain
              size="small"
              @click="emit('set-date-shortcut', 'yesterday')"
            >
              昨天
            </el-button>
          </div>
          <small class="field-hint">同步飞书会使用此日期；当前提交范围：{{ reportRangeLabel }}</small>
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
          <div class="work-hour-label">
            <label>工作时长</label>
            <el-tag v-if="activeDraft" :type="getWorkHoursSourceType(activeDraft.workHoursSource)" size="small" effect="plain">
              {{ getWorkHoursSourceLabel(activeDraft.workHoursSource) }}
            </el-tag>
          </div>
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
          <small class="field-hint">{{ getWorkHoursEvidence(activeDraft) }}</small>
        </div>

        <div class="current-publish-action">
          <el-button class="current-publish-btn" :icon="Send" type="primary" :loading="pushing" :disabled="!canPublishActive" @click="emit('publish-current')">
            仅发布当前项目
          </el-button>
        </div>
      </div>

      <div class="publish-control-section batch-publish-section">
        <div class="batch-publish-panel">
          <div class="batch-publish-head">
            <div>
              <strong>批量发布项目</strong>
              <span>发布全部时会按下方每个项目的目标和工时逐条提交</span>
            </div>
            <div class="batch-publish-head-actions">
              <small>{{ publishableCount }}/{{ totalDraftCount }} · {{ generatedWorkHoursTotal.toFixed(1) }}h</small>
              <el-tooltip content="覆盖手动工时并按当前提交记录重新分配" placement="top">
                <el-button
                  :icon="Calculator"
                  :disabled="!canRecalculateHours"
                  plain
                  size="small"
                  aria-label="重新计算项目工时"
                  @click="emit('recalculate-hours')"
                />
              </el-tooltip>
            </div>
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
              <small class="batch-hour-source">
                {{ getWorkHoursSourceLabel(item.workHoursSource) }} · {{ item.commitsCount }} 次提交 / {{ item.filesCount }} 个文件
              </small>
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
      </div>
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
