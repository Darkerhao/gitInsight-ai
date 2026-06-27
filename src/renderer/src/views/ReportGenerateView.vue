<script setup lang="ts">
import { computed, ref } from 'vue';
import { CalendarDays, ClipboardCopy, Download, FileText, RotateCcw, Send, Sparkles } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useAssistant } from '@/composables/useAssistant';

const assistant = useAssistant();
const { config, form, report, status, loading, pushing, selectedRepos, projectOptions, generate, push } = assistant;

const activePreviewTab = ref('report');
const dateShortcut = ref('today');

const selectedProjectName = computed(() => selectedRepos.value[0]?.name || 'integrated-platform-web');
const selectedConfigName = computed(() => {
  const selected = projectOptions.value.find((item) => item.id === config.feishuForm.projectOptionId);
  return selected?.name || '默认配置（8号）';
});

const reportContent = computed(() => {
  return (
    report.value ||
    `集成平台项目组 ${form.date} 日报

一、工作概览
今日团队整体进展顺利，各项开发任务按计划推进。

二、主要工作内容
- 完成用户中心模块接口开发及联调
- 修复了登录态失效问题
- 优化了列表页加载性能
- 编写单元测试用例 15 条

三、问题与风险
- 第三方接口偶发超时，已联系相关团队排查

四、明日计划
- 继续完善用户中心相关功能
- 处理接口超时问题
- 进行版本自测`
  );
});

const metrics = computed(() => [
  { label: '提交次数', value: 23, trend: '+12%' },
  { label: '合并请求', value: 8, trend: '+5%' },
  { label: '新增代码行', value: '1,286', trend: '+18%' },
  { label: '问题&缺陷', value: 3, trend: '+25%' },
]);

const generationRecords = [
  { date: '2024-06-27', time: '15:30:45', status: 'success' as const },
  { date: '2024-06-26', time: '14:25:18', status: 'success' as const },
  { date: '2024-06-25', time: '09:15:32', status: 'success' as const },
  { date: '2024-06-24', time: '18:45:06', status: 'failed' as const },
  { date: '2024-06-23', time: '18:30:20', status: 'success' as const },
];

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
  await navigator.clipboard.writeText(reportContent.value);
  ElMessage.success('日报内容已复制');
}

function exportMarkdown() {
  const blob = new Blob([reportContent.value], { type: 'text/markdown;charset=utf-8' });
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
    <PageHeader title="日报生成" subtitle="基于配置自动生成日报，支持预览、导出和同步飞书">
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
              <el-select :model-value="selectedProjectName" placeholder="选择项目">
                <el-option v-for="repo in selectedRepos" :key="repo.path" :label="repo.name" :value="repo.name" />
                <el-option v-if="!selectedRepos.length" label="integrated-platform-web" value="integrated-platform-web" />
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
              <strong>生成预览</strong>
            </div>
            <el-button :icon="Sparkles" type="primary" :loading="loading" @click="generate">开始生成</el-button>
          </div>
          <div class="notice-line">
            <StatusBadge status="success" label="预计生成 1 份日报，耗时约 30-60 秒" />
          </div>
          <div class="metric-grid">
            <div v-for="item in metrics" :key="item.label" class="metric-card">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
              <small>较昨日 {{ item.trend }}</small>
            </div>
          </div>
          <el-tabs v-model="activePreviewTab" class="clean-tabs">
            <el-tab-pane label="日报预览" name="report" />
            <el-tab-pane label="提交记录 (23)" name="commits" />
            <el-tab-pane label="合并请求 (8)" name="mrs" />
            <el-tab-pane label="问题&缺陷 (3)" name="issues" />
          </el-tabs>
          <article class="report-preview">
            <div class="report-preview-head">
              <h2>集成平台项目组 {{ form.date }} 日报</h2>
              <span>生成时间：2024-06-27 15:30:45</span>
            </div>
            <pre>{{ reportContent }}</pre>
          </article>
          <div class="button-row between">
            <el-button :icon="RotateCcw" plain :loading="loading" @click="generate">重新生成</el-button>
            <div class="button-row">
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
            <el-select v-model="config.feishuForm.projectOptionId" placeholder="项目日报群">
              <el-option v-for="item in projectOptions" :key="item.id" :label="item.name" :value="item.id" />
              <el-option label="项目日报群（#integrated-platform）" value="default-group" />
            </el-select>
          </div>
          <el-button :icon="Send" type="primary" :loading="pushing" @click="push">立即发布到飞书</el-button>
          <el-button plain>仅保存日报</el-button>
        </section>

        <section class="surface-card">
          <div class="panel-head">
            <h3>生成记录</h3>
            <el-button link type="primary">查看全部</el-button>
          </div>
          <div class="record-list">
            <div v-for="item in generationRecords" :key="`${item.date}-${item.time}`" class="record-item">
              <StatusBadge :status="item.status" :label="item.status === 'success' ? '成功' : '失败'" />
              <div>
                <strong>{{ item.date }} 日报</strong>
                <span>{{ selectedProjectName }} · {{ item.time }}</span>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>
