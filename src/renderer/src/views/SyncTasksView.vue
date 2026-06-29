<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import dayjs from 'dayjs';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock,
  Copy,
  Edit3,
  ListChecks,
  Loader,
  MoreHorizontal,
  Plus,
  Send,
  Trash2,
} from 'lucide-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useAssistant } from '@/composables/useAssistant';
import type { AutoSyncStatus, DailyReportRecord, RepoInfo, SyncLogRecord } from '@shared/types';

type ActiveTab = 'list' | 'calendar';
type SyncTaskStatus = 'running' | 'paused';
type SyncTaskType = 'feishu';
type BadgeStatus = 'success' | 'failed' | 'running' | 'pending' | 'info';
type CalendarFilter = 'all' | SyncTaskStatus;

interface SyncTask {
  id: string;
  repoPath: string;
  name: string;
  description: string;
  projectName: string;
  projectKey: string;
  projectColor: string;
  syncType: SyncTaskType;
  syncTypeLabel: string;
  frequencyLabel: string;
  time: string;
  timezone: string;
  status: SyncTaskStatus;
  enabled: boolean;
  weekdays: number[];
  lastRunAt: string;
  lastRunStatus: AutoSyncStatus;
  nextRunAt: string;
}

interface CalendarDay {
  key: string;
  date: dayjs.Dayjs;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  occurrences: CalendarOccurrence[];
}

interface CalendarOccurrence {
  id: string;
  task: SyncTask;
  date: string;
  time: string;
  kind: 'report' | 'sync';
  title: string;
  subtitle: string;
  status: BadgeStatus;
  statusLabel: string;
}

const assistant = useAssistant();
const {
  autoSyncRunning,
  autoSyncState,
  chooseWorkspace,
  config,
  dailyReports,
  runAutoSyncNow,
  saveSettings,
  selectedRepos,
  selectedRepoPaths,
  syncLogs,
} = assistant;

const props = defineProps<{
  initialTab?: ActiveTab;
}>();

const activeTab = ref<ActiveTab>(props.initialTab ?? 'list');
const currentMonth = ref(dayjs().startOf('month'));
const selectedDate = ref(dayjs());
const calendarFilter = ref<CalendarFilter>('all');
const calendarViewMode = ref('month');
const currentPage = ref(1);
const pageSize = ref(10);
const selectedTaskRows = ref<SyncTask[]>([]);
const taskDialogVisible = ref(false);
const editingTaskId = ref<string | null>(null);

const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
const taskColors = ['#22c55e', '#0f7bff', '#f59e0b', '#7c3aed', '#14b8a6', '#ef4444', '#64748b'];
const syncWeekdays = [0, 1, 2, 3, 4, 5, 6];
const weekLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const weekOptions = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 0 },
];

watch(
  () => props.initialTab,
  (value) => {
    if (value) activeTab.value = value;
  },
);

const draftTask = reactive({
  name: '',
  description: '',
  projectName: '',
  projectKey: '',
  projectColor: '#3b82f6',
  frequencyLabel: '每日',
  time: '09:30',
  status: 'running' as SyncTaskStatus,
  enabled: true,
  weekdays: [...syncWeekdays],
});

const latestSyncLog = computed(() => syncLogs.value[0] ?? null);

const tasks = computed<SyncTask[]>(() => selectedRepos.value.map((repo, index) => createTaskFromRepo(repo, index)));

const visibleTasks = computed(() => {
  if (calendarFilter.value === 'all') return tasks.value;
  return tasks.value.filter((task) => task.status === calendarFilter.value);
});

const pagedTasks = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return tasks.value.slice(start, start + pageSize.value);
});

const successCount = computed(() => syncLogs.value.filter((item) => item.status === 'success').length);
const failedCount = computed(() => syncLogs.value.filter((item) => item.status === 'failed').length);

const statusCards = computed(() => [
  {
    key: 'running',
    label: '执行中',
    value: autoSyncRunning.value ? tasks.value.length : 0,
    icon: Loader,
    tone: 'blue',
  },
  {
    key: 'enabled',
    label: '已启用',
    value: tasks.value.filter((item) => item.enabled).length,
    icon: CircleCheck,
    tone: 'green',
  },
  {
    key: 'success',
    label: '已完成',
    value: successCount.value,
    icon: Clock,
    tone: 'amber',
  },
  {
    key: 'failed',
    label: '失败',
    value: failedCount.value,
    icon: CircleX,
    tone: 'red',
  },
]);

const recentRuns = computed(() =>
  syncLogs.value.slice(0, 4).map((item) => ({
    id: `log-${item.id}`,
    taskName: getRunTaskName(),
    message: item.message,
    time: formatShortDateTime(item.ranAt),
    status: normalizeRunStatus(item.status),
  })),
);

const monthTitle = computed(() => currentMonth.value.format('YYYY年M月'));

const calendarDays = computed<CalendarDay[]>(() => {
  const firstDay = currentMonth.value.startOf('month');
  const mondayOffset = (firstDay.day() + 6) % 7;
  const startDay = firstDay.subtract(mondayOffset, 'day');

  return Array.from({ length: 42 }, (_, index) => {
    const date = startDay.add(index, 'day');
    return {
      key: date.format('YYYY-MM-DD'),
      date,
      isCurrentMonth: date.month() === currentMonth.value.month(),
      isToday: date.isSame(dayjs(), 'day'),
      isSelected: date.isSame(selectedDate.value, 'day'),
      occurrences: getOccurrencesByDate(date),
    };
  });
});

const selectedDateOccurrences = computed(() => getOccurrencesByDate(selectedDate.value));
const legendTasks = computed(() => visibleTasks.value.slice(0, 6));
const selectedDateTitle = computed(() => `${selectedDate.value.format('YYYY-MM-DD')}（${weekLabels[selectedDate.value.day()]}）`);

function createTaskFromRepo(repo: RepoInfo, index: number): SyncTask {
  const enabled = Boolean(config.autoSync.enabled);
  const time = normalizeTime(config.autoSync.time);
  const lastRunAt = config.autoSync.lastRunAt || latestSyncLog.value?.ranAt || '';
  const lastRunStatus = autoSyncRunning.value ? 'running' : normalizeRunStatus(config.autoSync.lastStatus || latestSyncLog.value?.status);
  const nextRunAt = enabled ? normalizeDateTime(autoSyncState.value?.nextRunAt) || getNextRunAt({ time, weekdays: syncWeekdays }) : '';
  const projectName = config.feishuForm.projectName || repo.name;

  return {
    id: repo.path,
    repoPath: repo.path,
    name: `${repo.name} 日报同步`,
    description: enabled ? '按自动同步配置生成日报并同步到飞书' : '自动同步未启用，任务暂不进入执行队列',
    projectName,
    projectKey: repo.name,
    projectColor: getTaskColor(repo, index),
    syncType: 'feishu',
    syncTypeLabel: '飞书',
    frequencyLabel: '每日',
    time,
    timezone: localTimezone,
    status: enabled ? 'running' : 'paused',
    enabled,
    weekdays: syncWeekdays,
    lastRunAt,
    lastRunStatus,
    nextRunAt,
  };
}

function getTaskColor(repo: RepoInfo, index: number) {
  const seed = Array.from(repo.path || repo.name).reduce((sum, char) => sum + char.charCodeAt(0), index);
  return taskColors[seed % taskColors.length];
}

function normalizeTime(value?: string) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : '18:30';
}

function normalizeRunStatus(status?: AutoSyncStatus | 'success' | 'failed'): AutoSyncStatus {
  if (status === 'running' || status === 'success' || status === 'failed' || status === 'skipped' || status === 'idle') return status;
  return 'idle';
}

function normalizeDateTime(value?: string) {
  if (!value) return '';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : '';
}

function getNextRunAt(task: Pick<SyncTask, 'time' | 'weekdays'>) {
  const [hour, minute] = task.time.split(':').map(Number);

  for (let offset = 0; offset < 21; offset += 1) {
    const candidate = dayjs().add(offset, 'day').hour(hour).minute(minute).second(0);
    if (task.weekdays.includes(candidate.day()) && candidate.isAfter(dayjs())) {
      return candidate.format('YYYY-MM-DD HH:mm');
    }
  }

  return dayjs().add(1, 'day').hour(hour).minute(minute).second(0).format('YYYY-MM-DD HH:mm');
}

function getOccurrencesByDate(date: dayjs.Dayjs): CalendarOccurrence[] {
  const dateKey = date.format('YYYY-MM-DD');
  const reportOccurrences = dailyReports.value
    .filter((report) => report.date === dateKey)
    .flatMap((report) =>
      getReportTasks(report).map((task) => ({
        id: `report-${report.id}-${task.id}`,
        task,
        date: dateKey,
        time: formatRecordTime(report.generatedAt),
        kind: 'report' as const,
        title: `${task.projectKey} 日报生成`,
        subtitle: `日报 · ${task.projectKey}`,
        status: reportBadgeStatus(report.status),
        statusLabel: reportStatusLabel(report.status),
      })),
    );

  const syncOccurrences = syncLogs.value
    .filter((log) => log.date === dateKey || dayjs(log.ranAt).isSame(date, 'day'))
    .filter(() => shouldShowSyncLog())
    .map((log) => {
      const status = normalizeRunStatus(log.status);
      return {
        id: `sync-${log.id}`,
        task: createSyncLogTask(log),
        date: dateKey,
        time: formatRecordTime(log.ranAt),
        kind: 'sync' as const,
        title: getRunTaskName(),
        subtitle: `同步 · ${log.message}`,
        status: runBadgeStatus(status),
        statusLabel: runStatusLabel(status),
      };
    });

  return [...reportOccurrences, ...syncOccurrences].sort((a, b) => a.time.localeCompare(b.time));
}

function getReportTasks(report: DailyReportRecord) {
  const repoPaths = new Set(report.repoPaths);
  const repoNames = new Set(report.repoNames);
  const matchedTasks = visibleTasks.value.filter(
    (task) => repoPaths.has(task.repoPath) || repoNames.has(task.projectKey) || repoNames.has(task.projectName),
  );

  if (matchedTasks.length) return matchedTasks;
  if (visibleTasks.value.length) return report.repoPaths.length || report.repoNames.length ? [] : visibleTasks.value.slice(0, 1);

  const fallbackNames = report.repoNames.length ? report.repoNames : ['日报记录'];
  return fallbackNames.map((name, index) => createRecordTask(`report-${report.id}-${index}`, name, index));
}

function shouldShowSyncLog() {
  if (!tasks.value.length) return calendarFilter.value === 'all';
  if (calendarFilter.value === 'all') return true;
  return tasks.value.some((task) => task.status === calendarFilter.value);
}

function createRecordTask(id: string, name: string, index: number): SyncTask {
  const time = normalizeTime(config.autoSync.time);
  return {
    id,
    repoPath: '',
    name: `${name} 日报记录`,
    description: '历史日报记录',
    projectName: name,
    projectKey: name,
    projectColor: taskColors[index % taskColors.length],
    syncType: 'feishu',
    syncTypeLabel: '日报',
    frequencyLabel: '真实记录',
    time,
    timezone: localTimezone,
    status: 'running',
    enabled: true,
    weekdays: [],
    lastRunAt: '',
    lastRunStatus: 'idle',
    nextRunAt: '',
  };
}

function createSyncLogTask(log: SyncLogRecord): SyncTask {
  const baseTask = tasks.value[0] ?? createRecordTask(`sync-${log.id}`, '自动同步', 0);
  return {
    ...baseTask,
    id: `sync-${log.id}`,
    name: getRunTaskName(),
    projectKey: tasks.value.length > 1 ? `${tasks.value.length} 个项目` : baseTask.projectKey,
    syncTypeLabel: '同步',
    time: formatRecordTime(log.ranAt),
  };
}

function reportBadgeStatus(status: DailyReportRecord['status']): BadgeStatus {
  if (status === 'success') return 'success';
  if (status === 'failed') return 'failed';
  return 'info';
}

function reportStatusLabel(status: DailyReportRecord['status']) {
  if (status === 'success') return '已生成';
  if (status === 'failed') return '失败';
  return '草稿';
}

function taskBadgeStatus(task: SyncTask): BadgeStatus {
  if (!task.enabled || task.status === 'paused') return 'info';
  return autoSyncRunning.value ? 'running' : 'success';
}

function taskStatusLabel(task: SyncTask) {
  if (!task.enabled || task.status === 'paused') return '已暂停';
  return autoSyncRunning.value ? '执行中' : '已启用';
}

function runStatusLabel(status: AutoSyncStatus | BadgeStatus) {
  const labels: Record<string, string> = {
    idle: '未执行',
    running: '执行中',
    success: '成功',
    failed: '失败',
    skipped: '已跳过',
    pending: '待执行',
    info: '未记录',
  };
  return labels[status] || status;
}

function runBadgeStatus(status: AutoSyncStatus | BadgeStatus): BadgeStatus {
  if (status === 'success') return 'success';
  if (status === 'failed') return 'failed';
  if (status === 'running') return 'running';
  if (status === 'pending') return 'pending';
  return 'info';
}

function formatFullDateTime(value?: string) {
  if (!value) return '-';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : '-';
}

function formatShortDateTime(value?: string) {
  if (!value) return '-';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('MM/DD HH:mm') : '-';
}

function formatRecordTime(value?: string) {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('HH:mm') : normalizeTime(config.autoSync.time);
}

function getRunTaskName() {
  if (!tasks.value.length) return '自动同步任务';
  if (tasks.value.length === 1) return tasks.value[0].name;
  return `自动同步任务（${tasks.value.length} 个项目）`;
}

function selectCalendarDay(day: CalendarDay) {
  selectedDate.value = day.date;
}

function prevMonth() {
  currentMonth.value = currentMonth.value.subtract(1, 'month');
}

function nextMonth() {
  currentMonth.value = currentMonth.value.add(1, 'month');
}

function backToday() {
  currentMonth.value = dayjs().startOf('month');
  selectedDate.value = dayjs();
}

function onSelectionChange(rows: SyncTask[]) {
  selectedTaskRows.value = rows;
}

async function runTask(task?: SyncTask) {
  if (!tasks.value.length) {
    ElMessage.warning('请先在左侧项目列表选择需要同步的项目');
    return;
  }
  if (task && (!task.enabled || task.status === 'paused')) {
    ElMessage.warning('请先启用自动同步后再执行任务');
    return;
  }

  await runAutoSyncNow();
}

async function toggleTask(task: SyncTask) {
  const previousEnabled = config.autoSync.enabled;
  config.autoSync.enabled = Boolean(task.enabled);
  try {
    await saveSettings();
  } catch {
    config.autoSync.enabled = previousEnabled;
  }
}

function openTaskDialog(task?: SyncTask) {
  const targetTask = task ?? tasks.value[0];
  if (!targetTask) {
    ElMessage.warning('请先在左侧项目列表选择需要同步的项目');
    return;
  }

  editingTaskId.value = targetTask.id;
  Object.assign(draftTask, {
    name: targetTask.name,
    description: targetTask.description,
    projectName: targetTask.projectName,
    projectKey: targetTask.projectKey,
    projectColor: targetTask.projectColor,
    frequencyLabel: targetTask.frequencyLabel,
    time: targetTask.time,
    status: targetTask.status,
    enabled: targetTask.enabled,
    weekdays: [...targetTask.weekdays],
  });
  taskDialogVisible.value = true;
}

async function saveTask() {
  if (!selectedRepos.value.length) {
    ElMessage.warning('请先选择需要同步的项目');
    return;
  }

  config.autoSync.time = normalizeTime(draftTask.time);
  config.autoSync.enabled = draftTask.enabled && draftTask.status === 'running';
  try {
    await saveSettings();
    taskDialogVisible.value = false;
  } catch {
    // saveSettings 已展示具体错误，这里保持弹窗打开，便于继续调整。
  }
}

function copyTask() {
  ElMessage.info('同步任务来自真实项目配置，当前版本不创建本地临时副本');
}

async function confirmDeleteTask(task: SyncTask) {
  try {
    await ElMessageBox.confirm(`确定从同步任务中移除「${task.projectKey}」吗？这不会删除本地项目文件。`, '移除同步任务', {
      confirmButtonText: '移除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    selectedRepoPaths.value = selectedRepoPaths.value.filter((path) => path !== task.repoPath);
    config.selectedRepoPaths = [...selectedRepoPaths.value];
    if (!selectedRepoPaths.value.length) config.autoSync.enabled = false;
    await saveSettings();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error('移除任务失败');
    }
  }
}

async function handleBatchCommand(command: string) {
  const targetRows = selectedTaskRows.value;

  if (command === 'run') {
    if (!targetRows.length) {
      ElMessage.warning('请先选择需要执行的任务');
      return;
    }
    await runTask(targetRows[0]);
    return;
  }

  if (command === 'enable' || command === 'pause') {
    if (!tasks.value.length) {
      ElMessage.warning('请先选择需要同步的项目');
      return;
    }
    config.autoSync.enabled = command === 'enable';
    await saveSettings();
    return;
  }

  if (command === 'delete') {
    if (!targetRows.length) {
      ElMessage.warning('请先选择需要移除的任务');
      return;
    }
    try {
      await ElMessageBox.confirm(`确定移除选中的 ${targetRows.length} 个同步任务吗？`, '批量移除任务', {
        confirmButtonText: '移除',
        cancelButtonText: '取消',
        type: 'warning',
      });
      const selectedPaths = new Set(targetRows.map((task) => task.repoPath));
      selectedRepoPaths.value = selectedRepoPaths.value.filter((path) => !selectedPaths.has(path));
      config.selectedRepoPaths = [...selectedRepoPaths.value];
      if (!selectedRepoPaths.value.length) config.autoSync.enabled = false;
      selectedTaskRows.value = [];
      await saveSettings();
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') {
        ElMessage.error('批量移除失败');
      }
    }
  }
}
</script>

<template>
  <div class="view-stack task-calendar-view">
    <PageHeader title="同步任务模块" subtitle="定时将配置的项目日报自动生成并同步到飞书">
      <template #actions>
        <el-dropdown trigger="click" @command="handleBatchCommand">
          <el-button plain :icon="MoreHorizontal">
            批量操作
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="run">立即执行选中任务</el-dropdown-item>
              <el-dropdown-item command="enable">启用自动同步</el-dropdown-item>
              <el-dropdown-item command="pause">暂停自动同步</el-dropdown-item>
              <el-dropdown-item divided command="delete">移除选中任务</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button type="primary" :icon="Plus" @click="openTaskDialog()">
          配置同步任务
        </el-button>
      </template>
    </PageHeader>

    <div class="task-module-layout">
      <section class="surface-card task-module-main">
        <el-tabs v-model="activeTab" class="clean-tabs task-tabs">
          <el-tab-pane label="任务列表" name="list" />
          <el-tab-pane label="任务日历" name="calendar" />
        </el-tabs>

        <div v-if="activeTab === 'list'" class="task-list-panel">
          <el-table :data="pagedTasks" class="task-table" empty-text="暂无真实同步任务，请先选择项目" @selection-change="onSelectionChange">
            <el-table-column type="selection" width="46" />
            <el-table-column label="任务名称" min-width="260">
              <template #default="{ row }">
                <div class="task-name-cell">
                  <span class="task-icon" :style="{ color: row.projectColor, backgroundColor: `${row.projectColor}16` }">
                    <ListChecks :size="18" />
                  </span>
                  <div>
                    <strong>{{ row.name }}</strong>
                    <span>{{ row.description }}</span>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="关联项目" min-width="180">
              <template #default="{ row }">
                <span class="project-chip">
                  <i :style="{ backgroundColor: row.projectColor }" />
                  {{ row.projectKey }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="syncTypeLabel" label="同步类型" width="96" />
            <el-table-column label="执行配置" min-width="150">
              <template #default="{ row }">
                <div class="task-time-cell">
                  <strong>{{ row.frequencyLabel }} {{ row.time }}</strong>
                  <span>{{ row.timezone }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="112">
              <template #default="{ row }">
                <StatusBadge :status="taskBadgeStatus(row)" :label="taskStatusLabel(row)" />
              </template>
            </el-table-column>
            <el-table-column label="最近执行时间" min-width="150">
              <template #default="{ row }">
                <div class="task-time-cell">
                  <strong>{{ formatFullDateTime(row.lastRunAt) }}</strong>
                  <span :class="`run-${runBadgeStatus(row.lastRunStatus)}`">● {{ runStatusLabel(row.lastRunStatus) }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="下次执行时间" min-width="150">
              <template #default="{ row }">
                <span>{{ row.nextRunAt ? formatFullDateTime(row.nextRunAt) : '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="164" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-tooltip content="编辑配置" placement="top">
                    <el-button :icon="Edit3" link type="primary" @click="openTaskDialog(row)" />
                  </el-tooltip>
                  <el-tooltip content="复制" placement="top">
                    <el-button :icon="Copy" link @click="copyTask" />
                  </el-tooltip>
                  <el-tooltip content="立即执行" placement="top">
                    <el-button :icon="Send" link :loading="autoSyncRunning" @click="runTask(row)" />
                  </el-tooltip>
                  <el-switch v-model="row.enabled" size="small" @change="toggleTask(row)" />
                  <el-tooltip content="移除" placement="top">
                    <el-button :icon="Trash2" link type="danger" @click="confirmDeleteTask(row)" />
                  </el-tooltip>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <div v-if="!tasks.length" class="task-empty-state">
            <span>当前没有可展示的真实同步任务。</span>
            <el-button type="primary" plain @click="chooseWorkspace">选择项目</el-button>
          </div>

          <div class="task-table-footer">
            <span>共 {{ tasks.length }} 条任务</span>
            <el-pagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              layout="prev, pager, next, sizes"
              :page-sizes="[10, 20, 50]"
              :total="tasks.length"
            />
          </div>
        </div>

        <div v-else class="task-calendar-panel">
          <div class="calendar-toolbar">
            <div class="calendar-nav">
              <el-button :icon="ChevronLeft" @click="prevMonth" />
              <el-button :icon="ChevronRight" @click="nextMonth" />
              <el-button plain @click="backToday">今天</el-button>
            </div>
            <h2>{{ monthTitle }}</h2>
            <div class="calendar-filters">
              <el-select v-model="calendarFilter">
                <el-option label="全部任务" value="all" />
                <el-option label="执行中" value="running" />
                <el-option label="已暂停" value="paused" />
              </el-select>
              <el-select v-model="calendarViewMode">
                <el-option label="月视图" value="month" />
              </el-select>
            </div>
          </div>

          <div class="calendar-board">
            <div class="calendar-grid calendar-weekdays">
              <span>周一</span>
              <span>周二</span>
              <span>周三</span>
              <span>周四</span>
              <span>周五</span>
              <span>周六</span>
              <span>周日</span>
            </div>
            <div class="calendar-grid calendar-days">
              <button
                v-for="day in calendarDays"
                :key="day.key"
                type="button"
                class="calendar-cell"
                :class="{ muted: !day.isCurrentMonth, today: day.isToday, selected: day.isSelected }"
                @click="selectCalendarDay(day)"
              >
                <span class="calendar-date">{{ day.date.date() }}</span>
                <span
                  v-for="item in day.occurrences.slice(0, 3)"
                  :key="item.id"
                  class="calendar-event"
                  :class="[`is-${item.kind}`, `is-${item.status}`]"
                >
                  <i :style="{ backgroundColor: item.task.projectColor }" />
                  <span>{{ item.time }}</span>
                  <strong>{{ item.title }}</strong>
                  <em>{{ item.statusLabel }}</em>
                </span>
                <em v-if="day.occurrences.length > 3">+{{ day.occurrences.length - 3 }}</em>
              </button>
            </div>
          </div>

          <div v-if="!tasks.length" class="task-empty-state calendar-empty-state">
            <span>暂无真实同步任务，日历不会展示示例数据。</span>
            <el-button type="primary" plain @click="chooseWorkspace">选择项目</el-button>
          </div>
        </div>
      </section>

      <aside v-if="activeTab === 'list'" class="task-side">
        <section class="surface-card task-side-card">
          <div class="panel-head">
            <h3>任务状态概览</h3>
          </div>
          <div class="task-status-grid">
            <div v-for="card in statusCards" :key="card.key" class="task-status-card" :class="`tone-${card.tone}`">
              <component :is="card.icon" :size="18" />
              <strong>{{ card.value }}</strong>
              <span>{{ card.label }}</span>
            </div>
          </div>
        </section>

        <section class="surface-card task-side-card">
          <div class="panel-head">
            <h3>近期执行记录</h3>
            <el-button link type="primary">查看全部</el-button>
          </div>
          <div class="recent-run-list">
            <div v-if="!recentRuns.length" class="empty-state">暂无同步执行记录</div>
            <div v-for="item in recentRuns" :key="item.id" class="recent-run-item">
              <StatusBadge :status="runBadgeStatus(item.status)" :label="runStatusLabel(item.status)" />
              <div>
                <strong>{{ item.taskName }}</strong>
                <span>{{ item.time }} · {{ item.message }}</span>
              </div>
            </div>
          </div>
        </section>
      </aside>

      <aside v-else class="task-side">
        <section class="surface-card task-side-card">
          <div class="panel-head">
            <h3>任务图例</h3>
          </div>
          <div class="calendar-legend">
            <div v-if="!legendTasks.length" class="empty-state">暂无真实任务</div>
            <span v-for="task in legendTasks" :key="task.id">
              <i :style="{ backgroundColor: task.projectColor }" />
              {{ task.name }}
            </span>
          </div>
        </section>

        <section class="surface-card task-side-card day-detail-card">
          <div class="panel-head">
            <h3>日程详情</h3>
            <CalendarDays :size="18" />
          </div>
          <strong class="day-detail-date">{{ selectedDateTitle }}</strong>
          <div class="day-task-list">
            <div v-if="!selectedDateOccurrences.length" class="empty-state">当天暂无同步任务</div>
            <div v-for="item in selectedDateOccurrences.slice(0, 4)" :key="item.id" class="day-task-item" :class="[`is-${item.kind}`, `is-${item.status}`]">
              <time>{{ item.time }}</time>
              <div>
                <strong>
                  <span class="day-task-kind">{{ item.kind === 'sync' ? '同步' : '日报' }}</span>
                  {{ item.title }}
                </strong>
                <span>{{ item.subtitle }}</span>
              </div>
              <StatusBadge :status="item.status" :label="item.statusLabel" />
            </div>
          </div>
          <button v-if="selectedDateOccurrences.length > 4" type="button" class="more-day-task">
            还有 {{ selectedDateOccurrences.length - 4 }} 个任务在当天执行
          </button>
        </section>
      </aside>
    </div>

    <el-dialog v-model="taskDialogVisible" title="同步任务配置" width="620px">
      <div class="task-dialog-form">
        <div class="field-grid two-columns">
          <div class="field">
            <label>任务名称</label>
            <el-input v-model="draftTask.name" disabled />
          </div>
          <div class="field">
            <label>关联项目</label>
            <el-input v-model="draftTask.projectName" disabled />
          </div>
          <div class="field">
            <label>项目标识</label>
            <el-input v-model="draftTask.projectKey" disabled />
          </div>
          <div class="field">
            <label>标识色</label>
            <el-color-picker v-model="draftTask.projectColor" disabled />
          </div>
          <div class="field">
            <label>同步类型</label>
            <el-select model-value="feishu" disabled>
              <el-option label="飞书" value="feishu" />
            </el-select>
          </div>
          <div class="field">
            <label>执行时间</label>
            <el-time-picker v-model="draftTask.time" format="HH:mm" value-format="HH:mm" :clearable="false" />
          </div>
          <div class="field">
            <label>执行频率</label>
            <el-select v-model="draftTask.frequencyLabel" disabled>
              <el-option label="每日" value="每日" />
            </el-select>
          </div>
          <div class="field">
            <label>任务状态</label>
            <el-radio-group v-model="draftTask.status">
              <el-radio label="running">启用</el-radio>
              <el-radio label="paused">暂停</el-radio>
            </el-radio-group>
          </div>
          <div class="field field-span-2">
            <label>执行日期</label>
            <el-checkbox-group v-model="draftTask.weekdays" disabled>
              <el-checkbox v-for="item in weekOptions" :key="item.value" :label="item.value">
                {{ item.label }}
              </el-checkbox>
            </el-checkbox-group>
          </div>
          <div class="field field-span-2">
            <label>任务说明</label>
            <el-input v-model="draftTask.description" type="textarea" :rows="3" disabled />
          </div>
        </div>
        <div class="switch-line">
          <span>启用自动同步</span>
          <el-switch v-model="draftTask.enabled" />
        </div>
      </div>
      <template #footer>
        <div class="button-row end">
          <el-button @click="taskDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveTask">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.task-calendar-view {
  min-width: 0;
}

.task-module-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  align-items: start;
}

.task-module-main,
.task-side-card {
  min-width: 0;
}

.task-tabs {
  margin: -4px 0 12px;
}

.task-list-panel,
.task-calendar-panel,
.task-side {
  min-width: 0;
}

.task-name-cell {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
}

.task-name-cell strong,
.task-name-cell span,
.task-time-cell strong,
.task-time-cell span,
.recent-run-item strong,
.recent-run-item span,
.day-task-item strong,
.day-task-item span {
  display: block;
  min-width: 0;
}

.task-name-cell strong,
.recent-run-item strong,
.day-task-item strong {
  color: var(--c-text);
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-name-cell span,
.task-time-cell span,
.recent-run-item span,
.day-task-item span {
  margin-top: 4px;
  color: var(--c-text-faint);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-icon {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  display: grid;
  place-items: center;
}

.project-chip {
  max-width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--c-border-strong);
  border-radius: 6px;
  padding: 5px 9px;
  color: var(--c-text);
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-chip i,
.calendar-event i,
.calendar-legend i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: 0 0 auto;
}

.task-time-cell strong {
  color: var(--c-text);
  font-size: 13px;
  font-weight: 600;
}

.run-success {
  color: var(--tone-green) !important;
}

.run-failed {
  color: var(--tone-red) !important;
}

.run-running,
.run-pending {
  color: var(--tone-blue) !important;
}

.run-info {
  color: var(--c-text-faint) !important;
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.task-table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 16px;
  color: var(--c-text-muted);
  font-size: 13px;
}

.task-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 96px;
  border: 1px dashed var(--c-border-strong);
  border-radius: 8px;
  margin-top: 14px;
  padding: 18px;
  color: var(--c-text-muted);
  font-size: 13px;
  text-align: center;
}

.task-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.task-status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.task-status-card {
  min-height: 88px;
  border-radius: 8px;
  padding: 14px;
  display: grid;
  gap: 4px;
}

.task-status-card svg {
  justify-self: start;
}

.task-status-card strong {
  font-size: 24px;
  line-height: 1;
}

.task-status-card span {
  color: var(--c-text-muted);
  font-size: 12px;
}

.task-status-card.tone-blue {
  color: #0f7bff;
  background: #eff6ff;
}

.task-status-card.tone-green {
  color: var(--tone-green);
  background: var(--tone-green-bg);
}

.task-status-card.tone-amber {
  color: #f59e0b;
  background: #fff7ed;
}

.task-status-card.tone-red {
  color: var(--tone-red);
  background: var(--tone-red-bg);
}

.recent-run-list,
.calendar-legend,
.day-task-list,
.task-dialog-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recent-run-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}

.calendar-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.calendar-toolbar h2 {
  flex: 1 1 128px;
  min-width: 112px;
  margin: 0;
  text-align: center;
  color: var(--c-text);
  font-size: 18px;
  font-weight: 700;
  white-space: nowrap;
}

.calendar-nav,
.calendar-filters {
  display: flex;
  align-items: center;
  gap: 8px;
}

.calendar-nav,
.calendar-filters {
  flex: 0 0 auto;
}

.calendar-filters {
  justify-content: flex-end;
}

.calendar-filters .el-select {
  width: 108px;
}

.calendar-board {
  width: 100%;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-gutter: stable;
}

.calendar-grid {
  min-width: 840px;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.calendar-weekdays {
  border: 1px solid var(--c-border-strong);
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
  overflow: hidden;
  background: #fbfcff;
}

.calendar-weekdays span {
  padding: 10px;
  text-align: center;
  color: var(--c-text-muted);
  font-size: 12px;
  font-weight: 700;
}

.calendar-days {
  border-left: 1px solid var(--c-border-strong);
  border-top: 1px solid var(--c-border-strong);
}

.calendar-cell {
  position: relative;
  min-height: 108px;
  border: 0;
  border-right: 1px solid var(--c-border-strong);
  border-bottom: 1px solid var(--c-border-strong);
  background: #fff;
  color: var(--c-text);
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  text-align: left;
  cursor: pointer;
}

.calendar-cell:hover,
.calendar-cell.selected {
  background: #f2f7ff;
}

.calendar-cell.muted {
  color: var(--c-text-faint);
  background: #fbfcff;
}

.calendar-cell.today .calendar-date {
  color: #fff;
  background: var(--c-primary);
}

.calendar-date {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: inherit;
  font-size: 13px;
  font-weight: 700;
}

.calendar-event {
  display: grid;
  grid-template-columns: 8px auto minmax(0, 1fr) auto;
  gap: 5px;
  align-items: center;
  min-width: 0;
  color: var(--c-text-muted);
  font-size: 11px;
  border-radius: 6px;
  padding: 2px 4px;
  border-left: 2px solid transparent;
}

.calendar-event strong {
  min-width: 0;
  color: var(--c-text);
  font-size: 11px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.calendar-event em {
  color: inherit;
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
  white-space: nowrap;
}

.calendar-event.is-sync {
  border-left-color: var(--tone-blue);
}

.calendar-event.is-report {
  border-left-color: var(--tone-green);
}

.calendar-event.is-success {
  color: var(--tone-green);
  background: var(--tone-green-bg);
}

.calendar-event.is-failed {
  color: var(--tone-red);
  background: var(--tone-red-bg);
}

.calendar-event.is-running,
.calendar-event.is-pending {
  color: var(--tone-blue);
  background: var(--tone-blue-bg);
}

.calendar-event.is-info {
  color: var(--c-text-muted);
  background: #f4f6fb;
}

.calendar-cell > em {
  color: var(--c-text-faint);
  font-size: 11px;
  font-style: normal;
}

.calendar-empty-state {
  margin-top: 12px;
}

.calendar-legend span {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--c-text);
  font-size: 13px;
  line-height: 1.4;
}

.day-detail-card {
  gap: 14px;
}

.day-detail-date {
  color: var(--c-primary);
  font-size: 14px;
}

.day-task-item {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--c-border);
}

.day-task-item.is-sync {
  border-left: 3px solid var(--tone-blue);
  padding-left: 8px;
}

.day-task-item.is-report {
  border-left: 3px solid var(--tone-green);
  padding-left: 8px;
}

.day-task-item:last-child {
  border-bottom: 0;
}

.day-task-item time {
  color: var(--c-text);
  font-size: 12px;
  font-weight: 700;
}

.day-task-kind {
  display: inline-flex;
  align-items: center;
  height: 18px;
  margin-right: 6px;
  border-radius: 999px;
  background: var(--tone-blue-bg);
  color: var(--tone-blue);
  padding: 0 7px;
  font-size: 11px;
  font-weight: 700;
}

.day-task-item.is-report .day-task-kind {
  background: var(--tone-green-bg);
  color: var(--tone-green);
}

.more-day-task {
  width: 100%;
  border: 0;
  border-top: 1px solid var(--c-border);
  background: transparent;
  color: var(--c-primary);
  padding: 12px 0 0;
  text-align: left;
  cursor: pointer;
}

.task-dialog-form :deep(.el-color-picker) {
  width: 100%;
}

.task-dialog-form :deep(.el-color-picker__trigger) {
  width: 100%;
}

@media (max-width: 1320px) {
  .task-module-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .task-side {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}

@media (max-width: 860px) {
  .calendar-toolbar {
    align-items: flex-start;
  }

  .calendar-toolbar h2 {
    flex-basis: 100%;
    order: -1;
    text-align: left;
  }

  .calendar-filters {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .task-side {
    grid-template-columns: minmax(0, 1fr);
  }

  .task-table-footer,
  .task-empty-state {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (max-width: 720px) {
  .task-status-grid,
  .field-grid.two-columns {
    grid-template-columns: minmax(0, 1fr);
  }

  .calendar-grid {
    min-width: 760px;
  }

  .calendar-cell {
    min-height: 96px;
    padding: 8px;
  }

  .day-task-item {
    grid-template-columns: 42px minmax(0, 1fr);
  }

  .day-task-item .status-badge {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
