<script setup lang="ts">
import { computed } from 'vue';
import { CheckCircle2, Clock3, History, Sparkles, TimerReset } from 'lucide-vue-next';
import { useAssistant } from '@/composables/useAssistant';
import SectionTitle from '@/components/common/SectionTitle.vue';

const assistant = useAssistant();
const {
  config,
  autoSyncState,
  autoSyncRunning,
  autoSyncStatusType,
  autoSyncStatusLabel,
  formatDateTime,
  runAutoSyncNow,
} = assistant;

const autoSyncStatusItems = computed(() => [
  {
    key: 'nextRun',
    label: '下次执行',
    value: formatDateTime(autoSyncState.value?.nextRunAt),
    icon: Clock3,
  },
  {
    key: 'lastRun',
    label: '上次执行',
    value: formatDateTime(autoSyncState.value?.lastRunAt || config.autoSync.lastRunAt),
    icon: History,
  },
  {
    key: 'lastSuccess',
    label: '上次成功',
    value: formatDateTime(autoSyncState.value?.lastSuccessAt || config.autoSync.lastSuccessAt),
    icon: CheckCircle2,
  },
]);
</script>

<template>
  <div class="config-block">
    <SectionTitle title="自动同步配置" subtitle="设置执行窗口并查看调度状态">
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
              <span>{{ config.autoSync.enabled ? '应用打开期间会按计划提交日报' : '关闭后不会触发定时提交' }}</span>
            </div>
            <el-switch v-model="config.autoSync.enabled" aria-label="自动同步开关" />
          </div>

          <el-button class="auto-sync-run-btn" :icon="Sparkles" type="primary" plain :loading="autoSyncRunning" @click="runAutoSyncNow">
            立即执行一次
          </el-button>
        </div>

        <div class="auto-sync-control-grid">
          <div class="auto-sync-field">
            <span class="auto-sync-time-label">执行时间</span>
            <el-time-picker
              v-model="config.autoSync.time"
              format="HH:mm"
              value-format="HH:mm"
              :clearable="false"
              placeholder="同步时间"
            />
          </div>
          <div class="auto-sync-field">
            <span class="auto-sync-time-label">统计窗口</span>
            <el-select v-model="config.autoSync.timeWindowMode" placeholder="选择统计窗口">
              <el-option label="日报日期全天" value="full-day" />
              <el-option label="昨日固定时间至执行时刻" value="yesterday-start-to-run" />
            </el-select>
          </div>
          <div v-if="config.autoSync.timeWindowMode === 'yesterday-start-to-run'" class="auto-sync-field">
            <span class="auto-sync-time-label">窗口开始</span>
            <el-time-picker
              v-model="config.autoSync.windowStartTime"
              format="HH:mm"
              value-format="HH:mm"
              :clearable="false"
              placeholder="开始时间"
            />
          </div>
        </div>
      </div>

      <div class="auto-sync-status-grid">
        <div v-for="item in autoSyncStatusItems" :key="item.key" class="status-cell">
          <component :is="item.icon" :size="16" />
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
        <div class="status-cell status-cell-compact">
          <TimerReset :size="16" />
          <span>状态</span>
          <el-tag :type="autoSyncStatusType" effect="light" round>{{ autoSyncStatusLabel }}</el-tag>
        </div>
      </div>

      <div class="auto-sync-note">仅在应用打开时生效，关闭应用不会自动提交。</div>
      <div v-if="autoSyncState?.lastMessage || config.autoSync.lastMessage" class="auto-sync-message">
        {{ autoSyncState?.lastMessage || config.autoSync.lastMessage }}
      </div>
    </div>
  </div>
</template>
