<script setup lang="ts">
import { computed } from 'vue';
import { KeyRound, Save, ShieldCheck, Workflow } from 'lucide-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import BasicConfigCard from '@/components/panels/BasicConfigCard.vue';
import AdvancedConfigPanels from '@/components/panels/AdvancedConfigPanels.vue';
import TodayStatusCards from '@/components/aside/TodayStatusCards.vue';
import SyncLogFeed from '@/components/aside/SyncLogFeed.vue';

const props = defineProps<{
  activeNav?: string;
}>();

const isAiSettings = computed(() => props.activeNav === 'ai');
const pageTitle = computed(() => (isAiSettings.value ? 'AI 设置' : '日报配置'));
const pageSubtitle = computed(() =>
  isAiSettings.value ? '集中维护模型接口、模型名称与 API Key' : '配置 Git 提交采集、汇报人和飞书表单映射',
);

const aiSettingNotes = [
  {
    icon: KeyRound,
    title: '连接配置集中维护',
    desc: '接口地址、模型名称和 API Key 保存为全局配置，日报生成等能力直接复用。',
  },
  {
    icon: Workflow,
    title: '场景接入保持清晰',
    desc: '在这里维护多套 AI 档案，生成页面可以选择当前所需的配置。',
  },
  {
    icon: ShieldCheck,
    title: '敏感信息本机保护',
    desc: 'API Key 仍通过 Electron safeStorage 加密保存，不写入明文配置。',
  },
] as const;
</script>

<template>
  <div class="view-stack report-config-view">
    <PageHeader :title="pageTitle" :subtitle="pageSubtitle" />

    <div v-if="isAiSettings" class="content-grid has-right-panel">
      <section class="main-center">
        <section class="config-surface" aria-label="AI 配置表单">
          <AdvancedConfigPanels mode="ai" />
        </section>
      </section>

      <aside class="view-stack">
        <section class="surface-card">
          <h3>AI 配置说明</h3>
          <p class="muted-text">这里维护的是统一连接能力，业务页面只负责选择或复用这些能力。</p>
          <div class="settings-note-list">
            <div v-for="item in aiSettingNotes" :key="item.title" class="settings-note-item">
              <component :is="item.icon" :size="18" />
              <div>
                <strong>{{ item.title }}</strong>
                <span>{{ item.desc }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="surface-card help-card">
          <Save :size="18" />
          <div>
            <strong>保存与连接测试</strong>
            <span>修改可在顶栏保存，生成日报或解析飞书字段也会先保存配置。测试连接使用当前表单值。</span>
          </div>
        </section>
      </aside>
    </div>

    <div v-else class="main-grid config-layout">
      <section class="main-center">
        <section class="config-surface" aria-label="日报配置表单">
          <BasicConfigCard />
          <AdvancedConfigPanels mode="feishu" />
        </section>
      </section>

      <aside class="main-aside">
        <TodayStatusCards />
        <SyncLogFeed />
      </aside>
    </div>
  </div>
</template>
