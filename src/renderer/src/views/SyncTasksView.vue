<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Save } from 'lucide-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import AutoSyncCard from '@/components/panels/AutoSyncCard.vue';
import { useAssistant } from '@/composables/useAssistant';
import { formatLocalDate } from '@/composables/assistant/dateUtils';
import { getAutoSyncStatusLabel, getAutoSyncStatusType } from '@/composables/assistant/autoSyncState';

const { config, syncLogs, isConfigDirty, saveSettings, getRepoDisplayName, sortedRepos } = useAssistant();
const route = useRoute();
const router = useRouter();
const activeTab = computed({
  get: () => route.query.tab === 'calendar' ? 'calendar' : 'list',
  set: (tab: string) => { void router.replace({ path: '/sync', query: { tab } }); },
});
const calendarDate = ref(new Date());
const selectedDate = computed(() => formatLocalDate(calendarDate.value));
const today = formatLocalDate(new Date());
const selectedPlans = computed(() => selectedDate.value < today ? [] : config.autoSync.tasks);
const activePlanCount = computed(() => config.autoSync.enabled ? config.autoSync.tasks.filter((task) => task.enabled).length : 0);
const logsByDate = computed(() => {
  const rows = new Map<string, typeof syncLogs.value>();
  for (const log of syncLogs.value) {
    const ranAt = new Date(log.ranAt);
    if (Number.isNaN(ranAt.getTime())) continue;
    const date = formatLocalDate(ranAt);
    rows.set(date, [...(rows.get(date) ?? []), log]);
  }
  return rows;
});
const selectedLogs = computed(() => logsByDate.value.get(selectedDate.value) ?? []);

function repoNames(paths: string[]) {
  return paths.map((path) => {
    const repo = sortedRepos.value.find((item) => item.path === path);
    return repo ? getRepoDisplayName(repo) : path;
  }).join('、') || '未选择仓库';
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
  <div class="view-stack sync-tasks-view">
    <PageHeader title="同步任务" subtitle="按任务管理仓库、飞书项目与执行窗口；定时同步仅在应用打开期间生效。">
      <template #actions>
        <el-button :icon="Save" type="primary" :disabled="!isConfigDirty" @click="saveSettings">保存任务配置</el-button>
      </template>
    </PageHeader>

    <el-tabs v-model="activeTab" class="clean-tabs">
      <el-tab-pane label="任务列表" name="list" />
      <el-tab-pane label="任务日历" name="calendar" />
    </el-tabs>

    <AutoSyncCard v-if="activeTab === 'list'" />

    <template v-else>
      <p class="muted-text">日历按本地执行日期展示最近最多 50 条同步日志。今日及未来计划依据当前配置，保存后生效；计划不代表已经执行。</p>
      <section class="surface-card sync-calendar-panel">
        <el-calendar v-model="calendarDate">
          <template #date-cell="{ data }">
            <button type="button" class="sync-calendar-day" :aria-label="`查看 ${data.day} 的计划和记录`" :aria-pressed="data.isSelected" @click.stop="calendarDate = data.date">
              <span>{{ data.day.slice(8) }}</span>
              <small v-if="data.day >= today && activePlanCount">计划 {{ activePlanCount }}</small>
              <strong v-if="logsByDate.get(data.day)?.length">记录 {{ logsByDate.get(data.day)?.length }}</strong>
            </button>
          </template>
        </el-calendar>
      </section>

      <section class="surface-card sync-day-plans">
        <div class="panel-head"><h3>当日任务计划</h3><span>{{ selectedDate }}</span></div>
        <el-table v-if="selectedPlans.length" :data="selectedPlans">
          <el-table-column prop="name" label="任务" min-width="150" />
          <el-table-column prop="time" label="计划时间" width="100" />
          <el-table-column label="仓库" min-width="180">
            <template #default="{ row }">{{ repoNames(row.repoPaths) }}</template>
          </el-table-column>
          <el-table-column label="飞书项目" min-width="130">
            <template #default="{ row }">{{ row.projectName || row.projectOptionId || '未配置' }}</template>
          </el-table-column>
          <el-table-column label="调度状态" min-width="145">
            <template #default="{ row }">
              <el-tag :type="config.autoSync.enabled && row.enabled ? 'success' : 'info'">
                {{ !config.autoSync.enabled ? '总开关已关闭' : row.enabled ? '已启用' : '任务已停用' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else :description="selectedDate < today ? '历史日期只展示执行记录，不推测过去的任务计划' : '尚未配置同步任务'" />
      </section>

      <section class="surface-card sync-day-logs">
        <div class="panel-head"><h3>当日执行记录</h3><span>{{ selectedLogs.length }} 条</span></div>
        <p class="muted-text">现有日志未记录任务标识，以下记录不归属到具体任务。</p>
        <el-table v-if="selectedLogs.length" :data="selectedLogs">
          <el-table-column label="执行时间" width="110"><template #default="{ row }">{{ formatTime(row.ranAt) }}</template></el-table-column>
          <el-table-column prop="date" label="日报日期" width="125" />
          <el-table-column label="触发方式" width="110"><template #default="{ row }">{{ row.triggerType === 'scheduled' ? '定时' : '手动' }}</template></el-table-column>
          <el-table-column label="结果" width="100">
            <template #default="{ row }"><el-tag :type="getAutoSyncStatusType(row.status)">{{ getAutoSyncStatusLabel(row.status) }}</el-tag></template>
          </el-table-column>
          <el-table-column prop="message" label="执行详情" min-width="240" />
        </el-table>
        <el-empty v-else description="该日期暂无已加载的执行记录" />
      </section>
    </template>
  </div>
</template>

<style scoped>
.sync-calendar-panel { padding: 6px; }
.sync-calendar-day { display: flex; flex-direction: column; gap: 5px; width: 100%; height: 100%; padding: 0; border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }
.sync-calendar-day small { color: var(--c-text-muted); }
.sync-calendar-day strong { color: var(--c-primary); font-size: 12px; }
.sync-calendar-panel :deep(.el-calendar) { --el-calendar-cell-width: 88px; background: transparent; }
.sync-day-plans .muted-text, .sync-day-logs .muted-text { margin-top: 0; }
</style>
