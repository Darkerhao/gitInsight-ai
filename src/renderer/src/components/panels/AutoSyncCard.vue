<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessageBox } from 'element-plus';
import { CheckCircle2, Clock3, History, Plus, Sparkles, TimerReset, Trash2 } from 'lucide-vue-next';
import { DEFAULT_AUTO_SYNC_TASK_CONFIG } from '@shared/types';
import type { AutoSyncTaskConfig } from '@shared/types';
import { useAssistant } from '@/composables/useAssistant';
import { getAutoSyncStatusLabel, getAutoSyncStatusType } from '@/composables/assistant/autoSyncState';
import SectionTitle from '@/components/common/SectionTitle.vue';

const assistant = useAssistant();
const {
  config,
  selectedRepoPaths,
  sortedRepos,
  projectOptions,
  autoSyncRunning,
  autoSyncStatusType,
  autoSyncStatusLabel,
  getAutoSyncTaskState,
  getRepoDisplayName,
  formatDateTime,
  runAutoSyncNow,
} = assistant;

const pendingTaskId = ref('');

const repoOptions = computed(() => {
  const options = sortedRepos.value.map((repo) => ({ path: repo.path, label: getRepoDisplayName(repo) }));
  const knownKeys = new Set(options.map((option) => option.path.toLocaleLowerCase()));
  for (const task of config.autoSync.tasks) {
    for (const path of task.repoPaths) {
      const key = path.toLocaleLowerCase();
      if (knownKeys.has(key)) continue;
      knownKeys.add(key);
      options.push({ path, label: getRepoDisplayName({ name: path, path }) });
    }
  }
  return options;
});

function createTaskId() {
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function addAutoSyncTask() {
  const task: AutoSyncTaskConfig = {
    ...DEFAULT_AUTO_SYNC_TASK_CONFIG,
    id: createTaskId(),
    name: `任务${config.autoSync.tasks.length + 1}`,
    repoPaths: [...selectedRepoPaths.value],
  };
  config.autoSync.tasks.push(task);
}

async function removeAutoSyncTask(task: AutoSyncTaskConfig) {
  try {
    await ElMessageBox.confirm(`确定删除同步任务「${task.name || '未命名任务'}」吗？保存配置后生效。`, '删除同步任务', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  config.autoSync.tasks = config.autoSync.tasks.filter((item) => item.id !== task.id);
}

function onTaskProjectChange(task: AutoSyncTaskConfig, optionId: string) {
  task.projectOptionId = optionId ?? '';
  task.projectName = projectOptions.value.find((item) => item.id === task.projectOptionId)?.name ?? '';
}

function onTaskWorkHoursChange(task: AutoSyncTaskConfig, value: number | null | undefined) {
  task.workHours = typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function isTaskRunning(taskId: string) {
  return pendingTaskId.value === taskId || Boolean(getAutoSyncTaskState(taskId)?.isRunning);
}

async function runTaskNow(task: AutoSyncTaskConfig) {
  pendingTaskId.value = task.id;
  try {
    await runAutoSyncNow(task.id);
  } finally {
    pendingTaskId.value = '';
  }
}

function getTaskStatusItems(task: AutoSyncTaskConfig) {
  const taskState = getAutoSyncTaskState(task.id);
  return [
    { key: 'nextRun', label: '下次执行', value: formatDateTime(taskState?.nextRunAt), icon: Clock3 },
    { key: 'lastRun', label: '上次执行', value: formatDateTime(taskState?.lastRunAt || task.lastRunAt), icon: History },
    { key: 'lastSuccess', label: '上次成功', value: formatDateTime(taskState?.lastSuccessAt || task.lastSuccessAt), icon: CheckCircle2 },
  ];
}

function getTaskStatus(task: AutoSyncTaskConfig) {
  return getAutoSyncTaskState(task.id)?.lastStatus ?? task.lastStatus;
}

function getTaskMessage(task: AutoSyncTaskConfig) {
  return getAutoSyncTaskState(task.id)?.lastMessage || task.lastMessage;
}
</script>

<template>
  <div class="config-block">
    <SectionTitle title="自动同步配置" subtitle="按任务配置仓库集合、飞书项目与执行窗口">
      <template #extra>
        <el-tag :type="autoSyncStatusType" effect="light" round>{{ autoSyncStatusLabel }}</el-tag>
      </template>
    </SectionTitle>
    <div class="auto-sync-config">
      <div class="auto-sync-main">
        <div class="auto-sync-main-head">
          <div class="auto-sync-toggle-card" :class="{ active: config.autoSync.enabled }">
            <div>
              <strong>{{ config.autoSync.enabled ? '自动同步已启用' : '自动同步已关闭' }}</strong>
              <span>{{ config.autoSync.enabled ? '应用打开期间会按各任务计划提交日报' : '总开关关闭后不会触发任何定时任务' }}</span>
            </div>
            <div class="state-switch-wrap" :class="{ active: config.autoSync.enabled }">
              <el-switch v-model="config.autoSync.enabled" class="state-switch auto-sync-switch" aria-label="自动同步总开关" />
              <span class="state-switch-label">{{ config.autoSync.enabled ? '开启' : '关闭' }}</span>
            </div>
          </div>

          <el-button
            class="auto-sync-run-btn"
            :icon="Sparkles"
            type="primary"
            plain
            :loading="autoSyncRunning"
            :disabled="!config.autoSync.tasks.length"
            @click="runAutoSyncNow()"
          >
            立即执行全部
          </el-button>
        </div>
      </div>

      <div v-if="!config.autoSync.tasks.length" class="auto-sync-empty">
        <span>还没有同步任务，新增一个任务即可把指定仓库的日报提交到对应飞书项目。</span>
        <el-button type="primary" plain :icon="Plus" @click="addAutoSyncTask">新增同步任务</el-button>
      </div>

      <div v-for="task in config.autoSync.tasks" :key="task.id" class="auto-sync-task-card">
        <div class="auto-sync-task-head">
          <div class="auto-sync-task-title">
            <el-input v-model="task.name" class="auto-sync-task-name" placeholder="任务名称" />
            <el-tag :type="getAutoSyncStatusType(getTaskStatus(task))" effect="light" round>
              {{ getAutoSyncStatusLabel(getTaskStatus(task)) }}
            </el-tag>
          </div>
          <div class="auto-sync-task-actions">
            <div class="state-switch-wrap" :class="{ active: task.enabled }">
              <el-switch v-model="task.enabled" class="state-switch" :aria-label="`启用任务 ${task.name}`" />
              <span class="state-switch-label">{{ task.enabled ? '启用' : '停用' }}</span>
            </div>
            <el-button
              :icon="Sparkles"
              type="primary"
              plain
              :loading="isTaskRunning(task.id)"
              :disabled="autoSyncRunning && !isTaskRunning(task.id)"
              @click="runTaskNow(task)"
            >
              立即执行一次
            </el-button>
            <el-button :icon="Trash2" type="danger" plain @click="removeAutoSyncTask(task)">删除</el-button>
          </div>
        </div>

        <div class="auto-sync-control-grid">
          <div class="auto-sync-field">
            <span class="auto-sync-time-label">执行时间</span>
            <el-time-picker
              v-model="task.time"
              format="HH:mm"
              value-format="HH:mm"
              :clearable="false"
              placeholder="同步时间"
            />
          </div>
          <div class="auto-sync-field">
            <span class="auto-sync-time-label">统计窗口</span>
            <el-select v-model="task.timeWindowMode" placeholder="选择统计窗口">
              <el-option label="日报日期全天" value="full-day" />
              <el-option label="昨日固定时间至执行时刻" value="yesterday-start-to-run" />
            </el-select>
          </div>
          <div v-if="task.timeWindowMode === 'yesterday-start-to-run'" class="auto-sync-field">
            <span class="auto-sync-time-label">窗口开始</span>
            <el-time-picker
              v-model="task.windowStartTime"
              format="HH:mm"
              value-format="HH:mm"
              :clearable="false"
              placeholder="开始时间"
            />
          </div>
          <div class="auto-sync-field">
            <span class="auto-sync-time-label">飞书所属项目</span>
            <el-select
              :model-value="task.projectOptionId"
              filterable
              allow-create
              default-first-option
              clearable
              placeholder="选择项目或手填选项 ID"
              no-match-text="未找到匹配项目"
              no-data-text="暂无项目选项，可手动输入选项 ID"
              @change="(value: string) => onTaskProjectChange(task, value)"
            >
              <el-option v-for="option in projectOptions" :key="option.id" :label="option.name" :value="option.id" />
            </el-select>
          </div>
          <div class="auto-sync-field">
            <span class="auto-sync-time-label">统计仓库</span>
            <el-select
              v-model="task.repoPaths"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              placeholder="选择要统计的仓库"
              no-data-text="请先在基础配置中扫描仓库"
            >
              <el-option v-for="option in repoOptions" :key="option.path" :label="option.label" :value="option.path" />
            </el-select>
          </div>
          <div class="auto-sync-field">
            <span class="auto-sync-time-label">工时覆盖</span>
            <el-input-number
              :model-value="task.workHours ?? undefined"
              :min="0.5"
              :max="24"
              :step="0.5"
              :precision="1"
              controls-position="right"
              placeholder="留空=按项目默认工时"
              @update:model-value="(value: number | null | undefined) => onTaskWorkHoursChange(task, value)"
            />
          </div>
        </div>

        <div class="auto-sync-status-grid">
          <div v-for="item in getTaskStatusItems(task)" :key="item.key" class="status-cell">
            <component :is="item.icon" :size="16" />
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
          <div class="status-cell status-cell-compact">
            <TimerReset :size="16" />
            <span>状态</span>
            <el-tag :type="getAutoSyncStatusType(getTaskStatus(task))" effect="light" round>
              {{ getAutoSyncStatusLabel(getTaskStatus(task)) }}
            </el-tag>
          </div>
        </div>
        <div v-if="getTaskMessage(task)" class="auto-sync-message">{{ getTaskMessage(task) }}</div>
      </div>

      <div v-if="config.autoSync.tasks.length" class="auto-sync-task-footer">
        <el-button type="primary" plain :icon="Plus" @click="addAutoSyncTask">新增同步任务</el-button>
      </div>

      <div class="auto-sync-note">仅在应用打开时生效，关闭应用不会自动提交；任务修改需保存配置后生效。</div>
    </div>
  </div>
</template>
