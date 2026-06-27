<script setup lang="ts">
import { computed } from 'vue';
import { ElMessage } from 'element-plus';
import { CircleCheck, CircleX, Clock } from 'lucide-vue-next';
import { useAssistant } from '@/composables/useAssistant';

const assistant = useAssistant();
const { autoSyncState, config, formatDateTime } = assistant;

// 后端只持久化最近一次同步状态，没有历史数组，这里据此派生单条真实记录。
const latestLog = computed(() => {
  const status = autoSyncState.value?.lastStatus ?? config.autoSync.lastStatus;
  const runAt = autoSyncState.value?.lastRunAt || config.autoSync.lastRunAt;
  if (status === 'idle' || !runAt) return null;
  const titleMap: Record<string, string> = {
    success: '日报同步成功',
    failed: '日报同步失败',
    running: '日报同步执行中',
    skipped: '日报同步已跳过',
  };
  return {
    status,
    title: titleMap[status] ?? '日报同步',
    time: formatDateTime(runAt),
    project: config.feishuForm.projectName || '自动同步任务',
  };
});

function iconOf(status: string) {
  if (status === 'success') return CircleCheck;
  if (status === 'failed') return CircleX;
  return Clock;
}
</script>

<template>
  <section class="aside-card">
    <div class="aside-card-head">
      <h3>最近同步日志</h3>
      <el-button link type="primary" size="small" @click="ElMessage.info('敬请期待')">查看全部</el-button>
    </div>

    <div v-if="latestLog" class="sync-log-list">
      <div class="sync-log-item">
        <component :is="iconOf(latestLog.status)" :size="18" class="sync-log-icon" :class="`tone-${latestLog.status}`" />
        <div class="sync-log-body">
          <strong>{{ latestLog.title }}</strong>
          <span>{{ latestLog.project }}</span>
        </div>
        <span class="sync-log-time">{{ latestLog.time }}</span>
      </div>
    </div>
    <div v-else class="sync-log-empty">暂无同步记录</div>

    <p class="aside-card-note">历史记录尚未持久化，仅展示最近一次</p>
  </section>
</template>
