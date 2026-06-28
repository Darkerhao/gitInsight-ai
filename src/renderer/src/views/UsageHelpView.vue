<script setup lang="ts">
import { computed, ref } from 'vue';
import { CheckCircle2, CircleAlert, RefreshCw } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useAssistant } from '@/composables/useAssistant';

const emit = defineEmits<{
  (e: 'navigate', value: string): void;
}>();

const assistant = useAssistant();
const { config, repos, refreshLocalData } = assistant;

const activeNames = ref(['intro', 'modules', 'faq']);

const checklist = computed(() => {
  const rows = [
    {
      key: 'workspace',
      label: '已选择工作目录',
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
      ok: Boolean(config.aiBaseUrl && config.aiModel && config.aiApiKey),
      detail: config.aiModel ? `${config.aiBaseUrl} / ${config.aiModel}` : 'AI 配置不完整',
      action: 'config',
    },
    {
      key: 'feishu',
      label: '飞书同步已配置',
      ok: Boolean(config.feishuForm.shareToken && config.feishuForm.cookie && config.feishuForm.csrfToken),
      detail: config.feishuForm.projectName || '飞书表单配置不完整',
      action: 'config',
    },
    {
      key: 'scan',
      label: '仓库已扫描',
      ok: repos.value.length > 0,
      detail: repos.value.length ? `已识别 ${repos.value.length} 个仓库` : '尚未扫描到仓库',
      action: 'config',
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
  },
  {
    key: 'generate',
    title: '日报生成',
    desc: '从选中的仓库提取 Git 记录，生成日报正文并支持编辑。',
    action: 'generate',
  },
  {
    key: 'sync',
    title: '同步任务',
    desc: '配置飞书字段和自动同步时间，按计划推送日报。',
    action: 'sync',
  },
  {
    key: 'history',
    title: '历史日志',
    desc: '查看日报、同步与错误记录，定位失败原因。',
    action: 'history',
  },
];

const faqItems = [
  {
    q: '如何接入 AI？',
    a: '在日报配置页补齐 AI Base URL、API Key 和模型名称后即可生成日报。',
  },
  {
    q: '为什么消息中心没有数据？',
    a: '消息中心只展示真实日志。若尚未执行生成、同步或系统没有错误，就不会出现伪造消息。',
  },
  {
    q: '自动同步为什么没有触发？',
    a: '自动同步仅在应用运行中生效，请确认开启了自动同步并且飞书配置完整。',
  },
];

async function runHealthCheck() {
  await refreshLocalData();
  const failed = checklist.value.filter((item) => !item.ok);
  if (!failed.length) {
    ElMessage.success('自检通过，当前配置可用于主要流程');
    return;
  }
  ElMessage.warning(`发现 ${failed.length} 项待完善配置`);
}
</script>

<template>
  <div class="view-stack">
    <PageHeader title="使用帮助" subtitle="结合当前真实配置状态，快速检查接入情况和操作路径。">
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
          <button type="button" @click="emit('navigate', item.action)">去处理</button>
        </div>
      </div>
    </section>

    <el-collapse v-model="activeNames" class="help-collapse">
      <el-collapse-item title="新手入门" name="intro">
        <div class="help-card-grid">
          <button v-for="item in quickStarts" :key="item.key" class="help-module-card" @click="emit('navigate', item.action)">
            <strong>{{ item.title }}</strong>
            <span>{{ item.desc }}</span>
          </button>
        </div>
      </el-collapse-item>

      <el-collapse-item title="功能指南" name="modules">
        <div class="help-action-list">
          <button class="help-list-item" @click="emit('navigate', 'config')">
            <strong>日报配置</strong>
            <span>配置工作区、汇报人、AI 接入与飞书字段</span>
          </button>
          <button class="help-list-item" @click="emit('navigate', 'generate')">
            <strong>日报生成</strong>
            <span>生成日报正文，查看提交记录与影响文件</span>
          </button>
          <button class="help-list-item" @click="emit('navigate', 'sync')">
            <strong>同步任务</strong>
            <span>查看同步计划、执行记录和任务日历</span>
          </button>
        </div>
      </el-collapse-item>

      <el-collapse-item title="常见问题" name="faq">
        <div class="help-faq-list">
          <div v-for="item in faqItems" :key="item.q" class="help-faq-item">
            <strong>{{ item.q }}</strong>
            <span>{{ item.a }}</span>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>
