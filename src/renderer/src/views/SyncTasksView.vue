<script setup lang="ts">
import { computed, ref } from 'vue';
import { CalendarPlus, CircleCheck, CircleX, Clock, Loader, Plus, Save, Send } from 'lucide-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useAssistant } from '@/composables/useAssistant';

const assistant = useAssistant();
const {
  config,
  selectedRepos,
  projectOptions,
  autoSyncRunning,
  autoSyncStatusLabel,
  autoSyncStatusType,
  autoSyncState,
  formatDateTime,
  runAutoSyncNow,
  saveSettings,
} = assistant;

const activeTab = ref('list');
const syncTarget = ref('group');
const frequency = ref('daily');
const retryOnFail = ref(true);
const syncAfterGenerate = ref(true);
const skipHoliday = ref(false);

const currentProjectName = computed(() => selectedRepos.value[0]?.name || 'integrated-platform-web');
const selectedConfigName = computed(() => {
  const selected = projectOptions.value.find((item) => item.id === config.feishuForm.projectOptionId);
  return selected?.name || '默认配置（8号）';
});

const statusCards = computed(() => [
  { label: '启用中', value: config.autoSync.enabled ? 2 : 0, icon: Clock, tone: 'blue' },
  { label: '执行中', value: autoSyncRunning.value ? 1 : 3, icon: Loader, tone: 'green' },
  { label: '已完成', value: 12, icon: CircleCheck, tone: 'amber' },
  { label: '失败', value: autoSyncStatusType.value === 'danger' ? 1 : 0, icon: CircleX, tone: 'red' },
]);

const recentRuns = computed(() => [
  {
    title: '集成平台项目日报同步',
    time: formatDateTime(autoSyncState.value?.lastRunAt || config.autoSync.lastRunAt) || '06/27 14:30',
    status: config.autoSync.lastStatus === 'failed' ? 'failed' : 'success',
  },
  { title: '集成平台项目日报同步', time: '06/27 14:20', status: 'success' },
  { title: '集成平台项目日报同步', time: '06/27 14:10', status: 'success' },
  { title: '集成平台项目日报同步', time: '06/27 14:00', status: 'failed' },
  { title: '集成平台项目日报同步', time: '06/27 13:50', status: 'success' },
]);

const guideSteps = [
  { title: '创建任务', desc: '选择项目和日报配置，设置同步目标' },
  { title: '配置执行规则', desc: '设置执行频率、时间和重试策略' },
  { title: '启用任务', desc: '保存并启用后，系统将按计划自动执行' },
  { title: '查看结果', desc: '在历史日志中查看执行详情和同步结果' },
];
</script>

<template>
  <div class="view-stack">
    <PageHeader title="同步任务" subtitle="定时将配置的项目日报自动生成并同步到飞书">
      <template #actions>
        <el-button plain>批量操作</el-button>
        <el-button :icon="Plus" type="primary">新建同步任务</el-button>
      </template>
    </PageHeader>

    <div class="content-grid has-right-panel">
      <section class="surface-card task-form">
        <el-tabs v-model="activeTab" class="clean-tabs">
          <el-tab-pane label="任务列表" name="list" />
          <el-tab-pane label="任务日历" name="calendar" />
        </el-tabs>

        <div class="step-section">
          <div class="step-title">
            <span>1</span>
            <strong>基础信息</strong>
          </div>
          <div class="field-grid">
            <div class="field">
              <label>任务名称 *</label>
              <el-input model-value="集成平台项目日报同步" />
            </div>
            <div class="field">
              <label>关联项目 *</label>
              <el-select :model-value="currentProjectName">
                <el-option :label="currentProjectName" :value="currentProjectName" />
              </el-select>
            </div>
            <div class="field">
              <label>日报配置 *</label>
              <el-select :model-value="selectedConfigName">
                <el-option :label="selectedConfigName" :value="selectedConfigName" />
              </el-select>
            </div>
            <div class="field">
              <label>负责人</label>
              <el-input v-model="config.reporterName" placeholder="负责人" />
            </div>
            <div class="field field-span-2">
              <label>任务描述</label>
              <el-input model-value="每天生成项目日报并同步到飞书群" type="textarea" :rows="2" />
            </div>
          </div>
        </div>

        <div class="step-section">
          <div class="step-title">
            <span>2</span>
            <strong>同步目标（飞书）</strong>
          </div>
          <div class="radio-line">
            <el-radio v-model="syncTarget" label="group">群聊</el-radio>
            <el-radio v-model="syncTarget" label="channel">频道</el-radio>
          </div>
          <div class="field-grid align-end">
            <div class="field field-span-2">
              <label>选择群聊 *</label>
              <el-select v-model="config.feishuForm.projectOptionId" filterable>
                <el-option label="项目日报群（#integrated-platform）" value="default-group" />
                <el-option v-for="item in projectOptions" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </div>
            <div class="field">
              <label>卡片展示方式</label>
              <el-select model-value="summary">
                <el-option label="将卡片消息格式发送到群飞书群" value="summary" />
              </el-select>
            </div>
          </div>
        </div>

        <div class="step-section">
          <div class="step-title">
            <span>3</span>
            <strong>执行配置</strong>
          </div>
          <div class="switch-line compact">
            <span>应用自动同步</span>
            <el-switch v-model="config.autoSync.enabled" />
          </div>
          <div class="field-grid">
            <div class="field field-span-3">
              <label>执行频率</label>
              <el-radio-group v-model="frequency">
                <el-radio label="daily">每日</el-radio>
                <el-radio label="workday">工作日</el-radio>
                <el-radio label="custom">自定义</el-radio>
              </el-radio-group>
            </div>
            <div class="field">
              <label>执行时间 *</label>
              <el-time-picker v-model="config.autoSync.time" format="HH:mm" value-format="HH:mm" :clearable="false" />
            </div>
            <div class="field field-span-2">
              <label>时区</label>
              <el-select model-value="UTC+08:00">
                <el-option label="(UTC+08:00) 北京、上海、香港" value="UTC+08:00" />
              </el-select>
            </div>
          </div>
          <div class="field-grid">
            <div class="field">
              <label>重试机制</label>
              <el-checkbox v-model="retryOnFail">同步失败时自动重试</el-checkbox>
              <el-checkbox v-model="syncAfterGenerate">仅在日报生成成功时同步</el-checkbox>
            </div>
            <div class="field">
              <label>重试次数</label>
              <el-input-number :model-value="3" :min="0" :max="10" controls-position="right" />
            </div>
            <div class="field">
              <label>其他规则</label>
              <el-checkbox v-model="skipHoliday">跳过非工作日</el-checkbox>
            </div>
          </div>
        </div>

        <div class="step-section">
          <div class="step-title">
            <span>4</span>
            <strong>高级设置（可选）</strong>
          </div>
          <div class="field-grid">
            <div class="field">
              <label>同步内容范围</label>
              <el-select model-value="full">
                <el-option label="完整日报（包含详情）" value="full" />
              </el-select>
            </div>
            <div class="field">
              <label>失败通知</label>
              <el-switch model-value />
            </div>
            <div class="field">
              <label>通知方式</label>
              <el-checkbox model-value>飞书消息</el-checkbox>
              <el-checkbox>邮件</el-checkbox>
            </div>
          </div>
        </div>

        <div class="button-row end">
          <el-button>取消</el-button>
          <el-button :icon="Send" :loading="autoSyncRunning" @click="runAutoSyncNow">立即执行</el-button>
          <el-button :icon="Save" type="primary" @click="saveSettings">保存并启用</el-button>
        </div>
      </section>

      <aside class="view-stack">
        <section class="surface-card">
          <div class="panel-head">
            <h3>任务状态概览</h3>
          </div>
          <div class="status-cards-grid">
            <div v-for="card in statusCards" :key="card.label" class="status-card" :class="`tone-${card.tone}`">
              <component :is="card.icon" :size="18" class="status-card-icon" />
              <strong class="status-card-value">{{ card.value }}</strong>
              <span class="status-card-label">{{ card.label }}</span>
            </div>
          </div>
        </section>

        <section class="surface-card">
          <div class="panel-head">
            <h3>近期执行记录</h3>
            <el-button link type="primary">查看全部</el-button>
          </div>
          <div class="record-list">
            <div v-for="item in recentRuns" :key="`${item.title}-${item.time}`" class="record-item">
              <StatusBadge :status="item.status === 'success' ? 'success' : 'failed'" :label="item.status === 'success' ? '成功' : '失败'" />
              <div>
                <strong>{{ item.title }}</strong>
                <span>{{ item.time }}</span>
              </div>
            </div>
          </div>
          <p class="muted-text">当前状态：{{ autoSyncStatusLabel }}</p>
        </section>

        <section class="surface-card">
          <div class="panel-head">
            <h3>使用指南</h3>
          </div>
          <ol class="usage-guide-list">
            <li v-for="(step, index) in guideSteps" :key="step.title" class="usage-guide-item">
              <span class="usage-guide-index">{{ index + 1 }}</span>
              <div class="usage-guide-body">
                <strong>{{ step.title }}</strong>
                <span>{{ step.desc }}</span>
              </div>
            </li>
          </ol>
          <el-button :icon="CalendarPlus" class="full-width" plain>查看详细教程</el-button>
        </section>
      </aside>
    </div>
  </div>
</template>
