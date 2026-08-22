<script setup lang="ts">
import { CalendarDays, Clipboard, Download, FileText, History, RefreshCw, Save, Search, Sparkles } from 'lucide-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import { useWeeklySummary } from '@/composables/useWeeklySummary';

const emit = defineEmits<{ (event: 'navigate', value: string): void }>();
const {
  dateRange, projectPath, projectOptions, sources, history, current, content, loading, sourceLoading, saving,
  status, error, showSources, rangeLabel, sourceDays, sourceProjects, commits, files, dirty,
  shiftWeek, loadSources, selectHistory, generate, save, copy, exportMarkdown,
} = useWeeklySummary();
</script>

<template>
  <div class="view-stack weekly-summary-view atelier-page">
    <PageHeader title="周报" subtitle="选择工作周，快速生成周一会议汇报内容">
      <template #actions>
        <el-button :icon="FileText" plain @click="emit('navigate', 'generate')">日报生成</el-button>
        <el-button :icon="Sparkles" plain @click="emit('navigate', 'reflection')">项目周反思</el-button>
      </template>
    </PageHeader>

    <section class="surface-card weekly-summary-setup">
      <div class="weekly-summary-toolbar">
        <el-button-group>
          <el-button :icon="CalendarDays" @click="shiftWeek(-1)">上一周</el-button>
          <el-button @click="shiftWeek(0)">本周</el-button>
          <el-button @click="shiftWeek(1)">下一周</el-button>
        </el-button-group>
        <el-date-picker v-model="dateRange" type="daterange" value-format="YYYY-MM-DD" range-separator="至" :clearable="false" />
        <el-select v-model="projectPath" placeholder="全部项目" clearable>
          <el-option label="全部项目" value="" />
          <el-option v-for="project in projectOptions" :key="project.path" :label="project.name" :value="project.path" />
        </el-select>
        <el-button type="primary" :icon="Sparkles" :loading="loading" @click="generate">生成周报</el-button>
      </div>
      <div class="weekly-summary-range-line">
        <strong>{{ rangeLabel }}</strong>
        <span v-if="sourceLoading">正在读取日报...</span>
        <span v-else>已读取 {{ sourceDays }} 天日报 · {{ sourceProjects }} 个项目 · {{ commits }} 次提交 · {{ files }} 个影响文件</span>
      </div>
      <el-alert v-if="error" type="error" :closable="false" show-icon :title="error" />
      <el-alert v-if="status" type="success" :closable="false" show-icon :title="status" />
    </section>

    <section class="weekly-summary-workspace">
      <div class="surface-card weekly-summary-editor">
        <div class="weekly-summary-section-head">
          <div>
            <span class="eyebrow">周报正文</span>
            <h2>{{ current ? '可直接编辑并用于会议汇报' : '生成一份本周汇报' }}</h2>
          </div>
          <el-tag v-if="dirty" type="warning" effect="plain">有未保存修改</el-tag>
        </div>
        <el-input v-if="current" v-model="content" type="textarea" class="weekly-summary-textarea" :autosize="{ minRows: 22, maxRows: 36 }" />
        <div v-else class="weekly-summary-empty"><Sparkles :size="32" /><strong>选择周期后生成周报</strong><span>内容会依据有效日报自动压缩整理。</span></div>
        <div class="weekly-summary-actions">
          <el-button :icon="RefreshCw" plain :disabled="!current" @click="generate">重新生成</el-button>
          <el-button :icon="Save" type="primary" :loading="saving" :disabled="!current || !dirty" @click="save">保存周报</el-button>
          <el-button :icon="Clipboard" plain :disabled="!current" @click="copy('text')">复制汇报</el-button>
          <el-button :icon="FileText" plain :disabled="!current" @click="copy('markdown')">复制 Markdown</el-button>
          <el-button :icon="Download" plain :disabled="!current" @click="exportMarkdown">导出</el-button>
        </div>
      </div>

      <aside class="weekly-summary-side">
        <div class="surface-card weekly-summary-stats">
          <div class="weekly-summary-section-head compact"><div><span class="eyebrow">本周期数据</span><h2>来源概览</h2></div></div>
          <dl>
            <div><dt>有效日报</dt><dd>{{ sourceDays }} 天</dd></div>
            <div><dt>项目数</dt><dd>{{ sourceProjects }} 个</dd></div>
            <div><dt>提交数</dt><dd>{{ commits }}</dd></div>
            <div><dt>影响文件</dt><dd>{{ files }}</dd></div>
          </dl>
          <el-button :icon="Search" plain :disabled="!sources.length" @click="showSources = true">查看来源日报</el-button>
        </div>

        <div class="surface-card weekly-summary-history">
          <div class="weekly-summary-section-head compact"><div><span class="eyebrow">历史周报</span><h2>最近保存</h2></div><History :size="18" /></div>
          <button v-for="record in history" :key="record.id" type="button" class="weekly-summary-history-row" :class="{ active: current?.id === record.id }" @click="selectHistory(record)">
            <strong>{{ record.startDate }} 至 {{ record.endDate }}</strong><span>{{ record.projectName }}</span>
          </button>
          <p v-if="!history.length" class="muted-text">暂无已保存周报</p>
        </div>
      </aside>
    </section>

    <el-drawer v-model="showSources" title="来源日报" size="520px">
      <div class="weekly-summary-source-list">
        <article v-for="source in sources" :key="source.ref">
          <div><strong>{{ source.date }} · {{ source.projectName }}</strong><el-tag size="small" effect="plain">{{ source.ref }}</el-tag></div>
          <p>{{ source.report }}</p>
        </article>
      </div>
    </el-drawer>
  </div>
</template>
