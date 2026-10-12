<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  FileText,
  History,
  RefreshCw,
  Rocket,
  Settings2,
  Sparkles,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useAssistant } from '@/composables/useAssistant';

const emit = defineEmits<{
  (e: 'navigate', value: string): void;
}>();

const assistant = useAssistant();
const { config, repos, activeAiProfile, refreshLocalData } = assistant;

const activeNames = ref(['intro', 'modules', 'faq']);

const checklist = computed(() => {
  const rows = [
    {
      key: 'workspace',
      label: 'Git 日报：已选择工作目录',
      ok: Boolean(config.workspaceDir || config.workspaceDirs?.length),
      detail: config.workspaceDir || config.workspaceDirs?.[0] || '未配置工作目录',
      action: 'config',
    },
    {
      key: 'reporter',
      label: '已设置汇报人',
      ok: Boolean(config.reporterName),
      detail: config.reporterName || '未配置汇报人',
      action: 'config',
    },
    {
      key: 'ai',
      label: 'AI 接入已配置',
      ok: Boolean(activeAiProfile.value.enabled && activeAiProfile.value.baseUrl && activeAiProfile.value.model && activeAiProfile.value.apiKey),
      detail: activeAiProfile.value.enabled ? activeAiProfile.value.model || 'AI 配置不完整' : 'AI 未启用；Git 日报仍可生成本地摘要',
      action: 'ai',
    },
    {
      key: 'feishu',
      label: '飞书同步已配置',
      ok: Boolean(config.feishuForm.shareToken && config.feishuForm.cookie && config.feishuForm.csrfToken
        && config.feishuForm.reporterUserId && config.feishuForm.projectOptionId && config.feishuForm.questionId
        && config.feishuForm.dateFieldId && config.feishuForm.userFieldId && config.feishuForm.projectFieldId
        && config.feishuForm.hoursFieldId && config.feishuForm.contentFieldId),
      detail: config.feishuForm.projectName || '飞书表单配置不完整',
      action: 'config',
    },
    {
      key: 'scan',
      label: 'Git 日报：仓库已扫描',
      ok: repos.value.length > 0,
      detail: repos.value.length ? `已识别 ${repos.value.length} 个仓库` : '尚未扫描到仓库',
      action: 'repositories',
    },
  ];
  return rows;
});

const readyCount = computed(() => checklist.value.filter((item) => item.ok).length);

const quickStarts = [
  {
    key: 'start',
    title: '快速开始',
    desc: '先配置工作目录、汇报人和 AI，再生成第一份日报。',
    action: 'config',
    icon: Rocket,
  },
  {
    key: 'generate',
    title: '日报生成',
    desc: '研发可按项目分别生成，或将多个仓库合并为一篇日报，编辑后保存或发布。',
    action: 'generate',
    icon: Sparkles,
  },
  {
    key: 'material',
    title: '素材日报',
    desc: '项目经理、产品经理按角色和日期填写素材，无需 Git 仓库即可生成、保存和发布。',
    action: 'material',
    icon: FileText,
  },
  {
    key: 'sync',
    title: '同步任务',
    desc: '按任务选择仓库、飞书项目、工时和时间窗口，手动执行或定时发布。',
    action: 'sync',
    icon: CalendarClock,
  },
  {
    key: 'history',
    title: '历史日志',
    desc: '查看日报、同步与错误记录，定位失败原因。',
    action: 'history',
    icon: History,
  },
];

const moduleGuides = [
  {
    title: '日报配置',
    desc: '配置工作区、汇报人、AI 接入与飞书字段',
    action: 'config',
    icon: Settings2,
  },
  {
    title: '日报生成',
    desc: '按项目或合并多仓库生成，编辑、保存、导出和发布，可查看提交与影响文件',
    action: 'generate',
    icon: FileText,
  },
  { title: '素材日报', desc: '按角色和日期保存工作素材，生成后可从历史记录继续编辑', action: 'material', icon: FileText },
  { title: '批量补日报', desc: '按日期和仓库批量生成，逐日校对后发布', action: 'weekly', icon: ClipboardCheck },
  { title: '汇总本周工作', desc: '从已有日报整理周报，保留来源并编辑保存', action: 'summary', icon: BookOpen },
  { title: '复盘项目问题', desc: '从历史日报分析问题并跟踪改进事项', action: 'reflection', icon: CircleAlert },
  { title: '时间长河与签到', desc: '按时间查看工作记录，在顶部签到中心查看奖励', action: 'timeline', icon: History },
  { title: '关于与更新', desc: '查看当前发行版本、更新说明，检查下载和安装更新', action: 'about', icon: RefreshCw },
  { title: '备份与恢复', desc: '在系统设置备份日报、素材与日志；恢复前按提示确认', action: 'system', icon: Settings2 },
  {
    title: '同步任务',
    desc: '查看同步计划、执行记录和任务日历',
    action: 'sync',
    icon: ClipboardCheck,
  },
];

const faqItems = [
  {
    q: '如何接入 AI？',
    a: '在 AI 设置页选择并启用当前方案，填写 Base URL、API Key 和模型名称。素材日报需要 AI；研发日报在未启用 AI 时可以使用本地摘要。',
  },
  {
    q: '三种日报角色有什么区别？数据来源一样吗？',
    a: '研发日报基于所选仓库的 Git 提交和补充工作内容；项目经理、产品经理在素材日报页填写推进事项、里程碑、需求进展、评审验收等。素材按角色和日期分别保存，生成结果可编辑、发布并从历史续编。',
  },
  {
    q: '为什么消息中心没有数据？',
    a: '消息中心只展示真实日志。若尚未执行生成、同步或系统没有错误，就不会出现伪造消息。',
  },
  {
    q: '自动同步为什么没有触发？',
    a: '自动同步仅在应用运行中生效。请同时开启总开关和对应任务，配置仓库及飞书项目，并保存配置。日历中的计划不代表实际执行；执行结果以日志为准。',
  },
];

async function runHealthCheck() {
  await refreshLocalData();
  const failed = checklist.value.filter((item) => !item.ok);
  if (!failed.length) {
    ElMessage.success('配置检查通过，服务连通性需通过实际生成或同步验证');
    return;
  }
  ElMessage.warning(`发现 ${failed.length} 项待完善配置`);
}
</script>

<template>
  <div class="view-stack">
    <PageHeader title="使用帮助" subtitle="检查当前本地配置，按需进入 Git 日报或素材日报流程；配置检查不测试远端连通性。">
      <template #actions>
        <el-button :icon="RefreshCw" plain @click="runHealthCheck">一键自检</el-button>
      </template>
    </PageHeader>

    <section class="surface-card help-summary">
      <div class="help-summary-head">
        <div>
          <strong>{{ readyCount }}/{{ checklist.length }}</strong>
          <span>项配置已就绪</span>
        </div>
        <StatusBadge :status="readyCount === checklist.length ? 'success' : 'pending'" :label="readyCount === checklist.length ? '可执行' : '待完善'" />
      </div>

      <div class="help-check-grid">
        <div v-for="item in checklist" :key="item.key" class="help-check-card" :class="{ danger: !item.ok }">
          <div class="help-check-top">
            <component :is="item.ok ? CheckCircle2 : CircleAlert" :size="18" />
            <strong>{{ item.label }}</strong>
          </div>
          <span>{{ item.detail }}</span>
          <el-button link type="primary" @click="emit('navigate', item.action)">去处理</el-button>
        </div>
      </div>
    </section>

    <el-collapse v-model="activeNames" class="help-collapse">
      <el-collapse-item name="intro">
        <template #title>
          <div class="help-section-title">
            <span><BookOpen :size="16" /></span>
            <div>
              <strong>新手入门</strong>
              <small>从配置到第一份日报的最短路径</small>
            </div>
          </div>
        </template>
        <div class="help-card-grid">
          <el-button v-for="item in quickStarts" :key="item.key" class="help-module-card" @click="emit('navigate', item.action)">
            <span class="help-card-icon"><component :is="item.icon" :size="18" /></span>
            <span class="help-card-copy">
              <strong>{{ item.title }}</strong>
              <span>{{ item.desc }}</span>
            </span>
          </el-button>
        </div>
      </el-collapse-item>

      <el-collapse-item name="modules">
        <template #title>
          <div class="help-section-title">
            <span><Settings2 :size="16" /></span>
            <div>
              <strong>功能指南</strong>
              <small>按模块进入对应功能页处理</small>
            </div>
          </div>
        </template>
        <div class="help-action-list">
          <el-button v-for="item in moduleGuides" :key="item.title" class="help-list-item" @click="emit('navigate', item.action)">
            <span class="help-card-icon"><component :is="item.icon" :size="18" /></span>
            <span class="help-card-copy">
              <strong>{{ item.title }}</strong>
              <span>{{ item.desc }}</span>
            </span>
          </el-button>
        </div>
      </el-collapse-item>

      <el-collapse-item name="faq">
        <template #title>
          <div class="help-section-title">
            <span><CircleAlert :size="16" /></span>
            <div>
              <strong>常见问题</strong>
              <small>常见配置和运行状态说明</small>
            </div>
          </div>
        </template>
        <div class="help-faq-list">
          <div v-for="item in faqItems" :key="item.q" class="help-faq-item">
            <span>Q</span>
            <div>
              <strong>{{ item.q }}</strong>
              <span>{{ item.a }}</span>
            </div>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>
