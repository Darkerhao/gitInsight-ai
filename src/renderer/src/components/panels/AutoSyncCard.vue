<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next';
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
</script>

<template>
  <div class="config-block">
    <SectionTitle title="自动同步配置" />
    <div class="auto-sync-config">
      <div class="auto-sync-main">
        <el-switch v-model="config.autoSync.enabled" active-text="启用自动同步" inactive-text="关闭自动同步" />
        <div class="auto-sync-time">
          <span class="auto-sync-time-label">执行时间</span>
          <el-time-picker
            v-model="config.autoSync.time"
            format="HH:mm"
            value-format="HH:mm"
            :clearable="false"
            placeholder="同步时间"
          />
        </div>
        <div class="auto-sync-time">
          <span class="auto-sync-time-label">统计窗口</span>
          <el-select v-model="config.autoSync.timeWindowMode" placeholder="选择统计窗口">
            <el-option label="日报日期全天" value="full-day" />
            <el-option label="昨日固定时间至执行时刻" value="yesterday-start-to-run" />
          </el-select>
        </div>
        <div v-if="config.autoSync.timeWindowMode === 'yesterday-start-to-run'" class="auto-sync-time">
          <span class="auto-sync-time-label">窗口开始</span>
          <el-time-picker
            v-model="config.autoSync.windowStartTime"
            format="HH:mm"
            value-format="HH:mm"
            :clearable="false"
            placeholder="开始时间"
          />
        </div>
        <el-button :icon="Sparkles" type="primary" plain :loading="autoSyncRunning" @click="runAutoSyncNow">
          立即执行一次
        </el-button>
      </div>

      <div class="auto-sync-status-grid">
        <div class="status-cell">
          <span>下次执行</span>
          <strong>{{ formatDateTime(autoSyncState?.nextRunAt) }}</strong>
        </div>
        <div class="status-cell">
          <span>上次执行</span>
          <strong>{{ formatDateTime(autoSyncState?.lastRunAt || config.autoSync.lastRunAt) }}</strong>
        </div>
        <div class="status-cell">
          <span>上次成功</span>
          <strong>{{ formatDateTime(autoSyncState?.lastSuccessAt || config.autoSync.lastSuccessAt) }}</strong>
        </div>
        <div class="status-cell">
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
