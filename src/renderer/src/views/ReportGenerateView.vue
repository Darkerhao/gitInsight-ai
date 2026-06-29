<script setup lang="ts">
import { computed, ref } from 'vue';
import { CalendarDays, ClipboardCopy, Download, FileText, RotateCcw, Save, Send, Sparkles } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useAssistant } from '@/composables/useAssistant';

const assistant = useAssistant();
const {
  config,
  form,
  repos,
  report,
  status,
  loading,
  pushing,
  selectedRepoPaths,
  selectedRepos,
  projectOptions,
  lastReportResult,
  dailyReports,
  generate,
  push,
  saveCurrentReport,
  selectFeishuProject,
  updateProjectWorkHours,
} = assistant;

const activePreviewTab = ref('report');
const dateShortcut = ref('today');
const workHourPresets = [1, 2, 4, 6, 7, 7.5, 8];
const workHourOptions = Array.from({ length: 48 }, (_, index) => (index + 1) * 0.5);

const selectedProjectText = computed(() => {
  if (!selectedRepos.value.length) return '未选择项目';
  return selectedRepos.value.map((repo) => repo.name).join('、');
});

const selectedConfigName = computed(() => {
  const selected = projectOptions.value.find((item) => item.id === config.feishuForm.projectOptionId);
  return selected?.name || `默认配置（${config.feishuForm.defaultWorkHours || 8}小时）`;
});

const generatedAtText = computed(() => formatDateTime(lastReportResult.value?.generatedAt || dailyReports.value[0]?.generatedAt));
const commitCount = computed(() => lastReportResult.value?.commits.length ?? 0);
const touchedFiles = computed(() => Array.from(new Set(lastReportResult.value?.commits.flatMap((commit) => commit.files) ?? [])));
const reportLineCount = computed(() => report.value.split(/\r?\n/).filter((line) => line.trim()).length);

const metrics = computed(() => [
  { label: '选中仓库', value: selectedRepos.value.length },
  { label: '提交记录', value: commitCount.value },
  { label: '影响文件', value: touchedFiles.value.length },
  { label: '日报行数', value: report.value ? reportLineCount.value : 0 },
]);

const generationRecords = computed(() => dailyReports.value.slice(0, 5));

function formatDateTime(value?: string) {
  if (!value) return '暂无';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function setDateShortcut(value: string) {
  dateShortcut.value = value;
  const date = new Date();
  if (value === 'yesterday') date.setDate(date.getDate() - 1);
  if (value === 'week') date.setDate(date.getDate() - 6);
  if (value === 'month') date.setDate(date.getDate() - 29);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  form.date = `${year}-${month}-${day}`;
}

async function copyReport() {
  if (!report.value.trim()) {
    ElMessage.warning('当前没有可复制的日报内容');
    return;
  }
  await navigator.clipboard.writeText(report.value);
  ElMessage.success('日报内容已复制');
}

function exportMarkdown() {
  if (!report.value.trim()) {
    ElMessage.warning('当前没有可导出的日报内容');
    return;
  }
  const blob = new Blob([report.value], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `项目日报-${form.date}.md`;
  link.click();
  URL.revokeObjectURL(link.href);
  ElMessage.success('Markdown 已导出');
}
</script>

<template>
  <div class="view-stack">
    <PageHeader title="日报生成" subtitle="基于当前仓库和配置生成日报，支持直接修改、保存、导出和同步飞书">
      <template #actions>
        <el-button :icon="FileText" plain>生成记录</el-button>
        <el-button :icon="CalendarDays" plain>批量生成</el-button>
      </template>
    </PageHeader>

    <div class="content-grid has-right-panel">
      <div class="view-stack">
        <section class="surface-card step-card">
          <div class="step-title">
            <span>1</span>
            <strong>选择生成范围</strong>
          </div>
          <div class="field-grid">
            <div class="field">
              <label>选择项目</label>
              <el-select v-model="selectedRepoPaths" multiple collapse-tags collapse-tags-tooltip placeholder="选择项目">
                <el-option v-for="repo in repos" :key="repo.path" :label="repo.name" :value="repo.path" />
              </el-select>
            </div>
            <div class="field">
              <label>选择日期</label>
              <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" />
            </div>
            <div class="field">
              <label>选择配置</label>
              <el-select :model-value="selectedConfigName">
                <el-option :label="selectedConfigName" :value="selectedConfigName" />
              </el-select>
            </div>
          </div>
          <div class="segmented-actions">
            <button :class="{ active: dateShortcut === 'today' }" @click="setDateShortcut('today')">今天</button>
            <button :class="{ active: dateShortcut === 'yesterday' }" @click="setDateShortcut('yesterday')">昨天</button>
            <button :class="{ active: dateShortcut === 'week' }" @click="setDateShortcut('week')">近7天</button>
            <button :class="{ active: dateShortcut === 'month' }" @click="setDateShortcut('month')">近30天</button>
            <button :class="{ active: dateShortcut === 'custom' }" @click="dateShortcut = 'custom'">自定义日期</button>
          </div>
        </section>

        <section class="surface-card step-card">
          <div class="step-title with-action">
            <div>
              <span>2</span>
              <strong>生成与编辑</strong>
            </div>
            <el-button :icon="Sparkles" type="primary" :loading="loading" @click="generate">开始生成</el-button>
          </div>
          <div class="notice-line">
            <StatusBadge
              status="info"
              :label="selectedRepos.length ? `将基于 ${selectedRepos.length} 个已选仓库生成日报` : '请先在左侧项目列表或当前下拉框选择仓库'"
            />
          </div>
          <div class="metric-grid">
            <div v-for="item in metrics" :key="item.label" class="metric-card">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
          <el-tabs v-model="activePreviewTab" class="clean-tabs">
            <el-tab-pane label="日报正文" name="report" />
            <el-tab-pane :label="`提交记录 (${commitCount})`" name="commits" />
            <el-tab-pane :label="`影响文件 (${touchedFiles.length})`" name="files" />
            <el-tab-pane label="原始摘要" name="raw" />
          </el-tabs>

          <article class="report-preview">
            <div class="report-preview-head">
              <h2>{{ selectedProjectText }} {{ form.date }} 日报</h2>
              <span>生成时间：{{ generatedAtText }}</span>
            </div>

            <el-input
              v-if="activePreviewTab === 'report'"
              v-model="report"
              class="editable-report"
              type="textarea"
              :rows="18"
              resize="vertical"
              placeholder="生成后的日报会显示在这里，可直接修改后保存"
            />

            <div v-else-if="activePreviewTab === 'commits'" class="data-list">
              <div v-if="!lastReportResult?.commits.length" class="empty-state">暂无提交记录</div>
              <div v-for="commit in lastReportResult?.commits" :key="commit.hash" class="data-list-item">
                <strong>{{ commit.message }}</strong>
                <span>{{ commit.author }} · {{ formatDateTime(commit.date) }} · {{ commit.hash.slice(0, 8) }}</span>
              </div>
            </div>

            <div v-else-if="activePreviewTab === 'files'" class="data-list">
              <div v-if="!touchedFiles.length" class="empty-state">暂无影响文件</div>
              <div v-for="file in touchedFiles" :key="file" class="data-list-item">
                <strong>{{ file }}</strong>
              </div>
            </div>

            <pre v-else>{{ lastReportResult?.rawInput.gitLogs || '暂无原始摘要' }}</pre>
          </article>

          <div class="button-row between">
            <el-button :icon="RotateCcw" plain :loading="loading" @click="generate">重新生成</el-button>
            <div class="button-row">
              <el-button :icon="Save" plain @click="saveCurrentReport">保存修改</el-button>
              <el-button :icon="ClipboardCopy" plain @click="copyReport">复制内容</el-button>
              <el-button :icon="Download" type="primary" plain @click="exportMarkdown">导出为 Markdown</el-button>
            </div>
          </div>
          <p v-if="status" class="muted-text">{{ status }}</p>
        </section>
      </div>

      <aside class="view-stack">
        <section class="surface-card publish-panel">
          <div class="step-title">
            <span>3</span>
            <strong>发布与同步</strong>
          </div>
          <h3>发布到飞书</h3>
          <div class="switch-line">
            <span>启用飞书同步</span>
            <el-switch v-model="config.autoSync.enabled" />
          </div>
          <div class="field">
            <label>选择目标</label>
            <el-select v-model="config.feishuForm.projectOptionId" placeholder="请先获取飞书项目选项" @change="selectFeishuProject">
              <el-option v-for="item in projectOptions" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </div>
          <div class="field">
            <label>工作时长</label>
            <div class="hour-field">
              <el-input-number
                v-model="config.feishuForm.defaultWorkHours"
                :min="0.5"
                :max="24"
                :step="0.5"
                :precision="1"
                controls-position="right"
                @change="updateProjectWorkHours"
              />
              <span>小时</span>
            </div>
            <el-select
              :model-value="Number(config.feishuForm.defaultWorkHours)"
              placeholder="选择工作时长"
              @change="updateProjectWorkHours"
            >
              <el-option
                v-for="hours in workHourOptions"
                :key="hours"
                :label="`${hours}h`"
                :value="hours"
              />
            </el-select>
            <div class="hour-presets">
              <button
                v-for="hours in workHourPresets"
                :key="hours"
                type="button"
                :class="{ active: Number(config.feishuForm.defaultWorkHours) === hours }"
                @click="updateProjectWorkHours(hours)"
              >
                {{ hours }}h
              </button>
            </div>
          </div>
          <el-button :icon="Send" type="primary" :loading="pushing" :disabled="!report.trim()" @click="push">立即发布到飞书</el-button>
          <el-button plain :icon="Save" :disabled="!report.trim()" @click="saveCurrentReport">仅保存日报</el-button>
        </section>

        <section class="surface-card">
          <div class="panel-head">
            <h3>生成记录</h3>
            <el-button link type="primary">查看全部</el-button>
          </div>
          <div class="record-list">
            <div v-if="!generationRecords.length" class="empty-state">暂无生成记录</div>
            <div v-for="item in generationRecords" :key="item.id" class="record-item">
              <StatusBadge :status="item.status === 'failed' ? 'failed' : 'success'" :label="item.status === 'draft' ? '草稿' : item.status === 'success' ? '成功' : '失败'" />
              <div>
                <strong>{{ item.date }} 日报</strong>
                <span>{{ item.repoNames.join('、') || '未记录项目' }} · {{ formatDateTime(item.generatedAt) }}</span>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>
