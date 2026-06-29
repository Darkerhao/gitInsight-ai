<script setup lang="ts">
import { computed, ref } from 'vue';
import { CalendarDays, CheckCircle2, ClipboardCopy, Download, FileText, Pin, Plus, RotateCcw, Save, Search, Send, Sparkles, Trash2 } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useAssistant } from '@/composables/useAssistant';
import type { RepoInfo } from '@shared/types';

const assistant = useAssistant();
const {
  config,
  form,
  report,
  status,
  loading,
  pushing,
  sortedRepos,
  selectedRepoPaths,
  selectedRepos,
  projectOptions,
  lastReportResult,
  dailyReports,
  chooseWorkspace,
  generate,
  push,
  saveCurrentReport,
  toggleRepo,
  isRepoPinned,
  toggleRepoPin,
  removeRepo,
  selectFeishuProject,
  updateProjectWorkHours,
} = assistant;

const activePreviewTab = ref('report');
const dateShortcut = ref('today');
const repoKeyword = ref('');
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
const selectedRepoSummary = computed(() => {
  if (!selectedRepos.value.length) return '请选择要生成日报的仓库';
  if (selectedRepos.value.length === 1) return selectedRepos.value[0].name;
  return `已选择 ${selectedRepos.value.length} 个仓库`;
});
const filteredRepos = computed(() => {
  const keyword = repoKeyword.value.trim().toLocaleLowerCase();
  if (!keyword) return sortedRepos.value;
  return sortedRepos.value.filter((repo) => `${repo.name} ${repo.path}`.toLocaleLowerCase().includes(keyword));
});

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

async function confirmRemoveRepo(item: RepoInfo) {
  try {
    await ElMessageBox.confirm(`确定从仓库中心移除「${item.name}」吗？这不会删除本地仓库文件。`, '移除仓库', {
      confirmButtonText: '移除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await removeRepo(item.path);
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '移除仓库失败');
  }
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
            <div class="field field-span-3 repo-picker-field">
              <label>选择仓库</label>
              <el-popover placement="bottom-start" trigger="click" :width="620" popper-class="repo-picker-popper">
                <template #reference>
                  <button type="button" class="repo-picker-trigger">
                    <div>
                      <strong>{{ selectedRepoSummary }}</strong>
                      <span>{{ selectedRepos.length ? selectedRepos.map((repo) => repo.name).join('、') : '支持多仓库汇总生成日报' }}</span>
                    </div>
                    <small>{{ selectedRepoPaths.length }}/{{ sortedRepos.length }}</small>
                  </button>
                </template>

                <div class="repo-picker-panel">
                  <div class="repo-picker-head">
                    <div>
                      <strong>仓库选择</strong>
                      <span>当前日报会基于选中的仓库生成</span>
                    </div>
                    <el-button :icon="Plus" type="primary" plain @click="chooseWorkspace">添加仓库</el-button>
                  </div>

                  <el-input v-model="repoKeyword" :prefix-icon="Search" clearable placeholder="搜索仓库名称或路径" />

                  <div class="repo-picker-list">
                    <button v-if="!sortedRepos.length" type="button" class="repo-picker-empty" @click="chooseWorkspace">
                      暂无仓库，点击选择工作目录
                    </button>

                    <div
                      v-for="repo in filteredRepos"
                      :key="repo.path"
                      class="repo-picker-item"
                      :class="{ active: selectedRepoPaths.includes(repo.path), pinned: isRepoPinned(repo.path) }"
                    >
                      <button type="button" class="repo-picker-main" @click="toggleRepo(repo.path)">
                        <span class="repo-picker-check">
                          <CheckCircle2 v-if="selectedRepoPaths.includes(repo.path)" :size="16" />
                        </span>
                        <span class="repo-picker-copy">
                          <strong>{{ repo.name }}</strong>
                          <small>{{ repo.path }}</small>
                        </span>
                      </button>

                      <el-tooltip :content="isRepoPinned(repo.path) ? '取消置顶' : '置顶仓库'" placement="top">
                        <button
                          type="button"
                          class="repo-picker-icon"
                          :class="{ active: isRepoPinned(repo.path) }"
                          :aria-label="isRepoPinned(repo.path) ? `取消置顶 ${repo.name}` : `置顶 ${repo.name}`"
                          :aria-pressed="isRepoPinned(repo.path)"
                          @click.stop="toggleRepoPin(repo.path)"
                        >
                          <Pin :size="15" />
                        </button>
                      </el-tooltip>

                      <el-tooltip content="从列表移除" placement="top">
                        <button type="button" class="repo-picker-icon danger" :aria-label="`移除 ${repo.name}`" @click.stop="confirmRemoveRepo(repo)">
                          <Trash2 :size="15" />
                        </button>
                      </el-tooltip>
                    </div>

                    <div v-if="sortedRepos.length && !filteredRepos.length" class="repo-picker-empty">
                      未找到匹配仓库
                    </div>
                  </div>
                </div>
              </el-popover>
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
              :label="selectedRepos.length ? `将基于 ${selectedRepos.length} 个已选仓库生成日报` : '请先在当前仓库选择器中选择仓库'"
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
