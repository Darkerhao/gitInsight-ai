<script setup lang="ts">
import { computed, ref } from 'vue';
import { Search, X } from 'lucide-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useAssistant } from '@/composables/useAssistant';

type LogStatus = 'success' | 'failed';
type LogType = '日报生成' | '手动同步' | '同步任务';

interface HistoryLog {
  id: number;
  time: string;
  type: LogType;
  project: string;
  action: string;
  status: LogStatus;
  duration: string;
  operator: string;
  trigger: string;
  file?: string;
}

const assistant = useAssistant();
const { selectedRepos, config } = assistant;

const keyword = ref('');
const selectedType = ref('全部类型');
const selectedStatus = ref('全部状态');
const selectedLog = ref<HistoryLog | null>(null);

const projectName = computed(() => selectedRepos.value[0]?.name || 'integrated-platform-web');

const logs = computed<HistoryLog[]>(() => [
  {
    id: 1,
    time: '2024-06-27 15:30:45',
    type: '日报生成',
    project: projectName.value,
    action: '生成 2024-06-27 日报',
    status: 'success',
    duration: '30-60秒',
    operator: config.reporterName || '贾浩特',
    trigger: '手动触发',
    file: '项目日报-2024-06-27.md',
  },
  {
    id: 2,
    time: '2024-06-27 15:29:12',
    type: '手动同步',
    project: projectName.value,
    action: '执行代码同步',
    status: 'success',
    duration: '14:41',
    operator: config.reporterName || '贾浩特',
    trigger: '手动触发',
  },
  {
    id: 3,
    time: '2024-06-27 14:20:33',
    type: '日报生成',
    project: projectName.value,
    action: '生成 2024-06-27 日报',
    status: 'success',
    duration: '28秒',
    operator: config.reporterName || '贾浩特',
    trigger: '手动触发',
    file: '项目日报-2024-06-27.md',
  },
  {
    id: 4,
    time: '2024-06-27 08:30:11',
    type: '日报生成',
    project: projectName.value,
    action: '生成 2024-06-27 日报',
    status: 'failed',
    duration: '45秒',
    operator: config.reporterName || '贾浩特',
    trigger: '手动触发',
  },
  {
    id: 5,
    time: '2024-06-24 10:10:05',
    type: '同步任务',
    project: projectName.value,
    action: '自动同步执行',
    status: 'success',
    duration: '12:05',
    operator: '系统',
    trigger: '自动触发',
  },
]);

const filteredLogs = computed(() => {
  return logs.value.filter((item) => {
    const matchKeyword = !keyword.value || `${item.action}${item.project}${item.type}`.includes(keyword.value);
    const matchType = selectedType.value === '全部类型' || item.type === selectedType.value;
    const matchStatus =
      selectedStatus.value === '全部状态' ||
      (selectedStatus.value === '成功' && item.status === 'success') ||
      (selectedStatus.value === '失败' && item.status === 'failed');
    return matchKeyword && matchType && matchStatus;
  });
});

const activeLog = computed(() => selectedLog.value || filteredLogs.value[0]);

function resetFilters() {
  keyword.value = '';
  selectedType.value = '全部类型';
  selectedStatus.value = '全部状态';
}
</script>

<template>
  <div class="view-stack">
    <PageHeader title="历史日志" subtitle="查看所有日报生成、同步及相关操作的历史记录" />

    <div class="content-grid history-layout">
      <div class="view-stack">
        <section class="surface-card filter-panel">
          <div class="field-grid">
            <div class="field">
              <label>项目</label>
              <el-select :model-value="projectName">
                <el-option :label="projectName" :value="projectName" />
              </el-select>
            </div>
            <div class="field">
              <label>日志类型</label>
              <el-select v-model="selectedType">
                <el-option label="全部类型" value="全部类型" />
                <el-option label="日报生成" value="日报生成" />
                <el-option label="手动同步" value="手动同步" />
                <el-option label="同步任务" value="同步任务" />
              </el-select>
            </div>
            <div class="field">
              <label>状态</label>
              <el-select v-model="selectedStatus">
                <el-option label="全部状态" value="全部状态" />
                <el-option label="成功" value="成功" />
                <el-option label="失败" value="失败" />
              </el-select>
            </div>
            <div class="field">
              <label>时间范围</label>
              <el-date-picker type="daterange" start-placeholder="2024-06-20" end-placeholder="2024-06-27" />
            </div>
          </div>
          <div class="filter-actions">
            <el-input v-model="keyword" :prefix-icon="Search" placeholder="请输入操作内容、文件名或其他关键词" />
            <el-button @click="resetFilters">重置</el-button>
            <el-button type="primary">查询</el-button>
          </div>
        </section>

        <section class="surface-card log-table-card">
          <div class="table-summary">共 {{ filteredLogs.length }} 条日志</div>
          <el-table :data="filteredLogs" class="log-table" @row-click="(row: HistoryLog) => (selectedLog = row)">
            <el-table-column prop="time" label="时间" min-width="150" />
            <el-table-column prop="type" label="日志类型" width="120" />
            <el-table-column prop="project" label="项目" min-width="160" />
            <el-table-column prop="action" label="操作内容" min-width="180" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <StatusBadge :status="row.status" :label="row.status === 'success' ? '成功' : '失败'" />
              </template>
            </el-table-column>
            <el-table-column prop="duration" label="耗时" width="110" />
            <el-table-column prop="operator" label="操作人" width="110" />
          </el-table>
          <div class="pagination-row">
            <el-pagination layout="prev, pager, next, sizes, total" :total="28" :page-size="10" />
          </div>
        </section>
      </div>

      <aside class="surface-card detail-panel" v-if="activeLog">
        <div class="panel-head">
          <h3>日志详情</h3>
          <el-button :icon="X" link @click="selectedLog = null" />
        </div>
        <StatusBadge :status="activeLog.status" :label="activeLog.status === 'success' ? '成功' : '失败'" />
        <dl class="detail-list">
          <dt>日志类型</dt>
          <dd>{{ activeLog.type }}</dd>
          <dt>操作内容</dt>
          <dd>{{ activeLog.action }}</dd>
          <dt>项目</dt>
          <dd>{{ activeLog.project }}</dd>
          <dt>执行时间</dt>
          <dd>{{ activeLog.time }}</dd>
          <dt>执行时长</dt>
          <dd>{{ activeLog.duration }}</dd>
          <dt>操作人</dt>
          <dd>{{ activeLog.operator }}</dd>
          <dt>触发方式</dt>
          <dd>{{ activeLog.trigger }}</dd>
          <dt>生成文件</dt>
          <dd>{{ activeLog.file || '-' }}</dd>
        </dl>
        <div class="process-list">
          <h4>执行过程</h4>
          <div v-for="item in ['开始生成日报', '数据收集与分析', '内容生成', '格式转换', '文件保存', '生成完成']" :key="item">
            <StatusBadge status="success" :label="item" />
          </div>
        </div>
        <el-button class="full-width" plain>查看生成结果</el-button>
      </aside>
    </div>
  </div>
</template>
