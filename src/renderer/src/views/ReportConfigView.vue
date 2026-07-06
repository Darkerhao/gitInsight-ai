<script setup lang="ts">
import { computed } from 'vue';
import { BrainCog, KeyRound, ShieldCheck, Workflow } from 'lucide-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import BasicConfigCard from '@/components/panels/BasicConfigCard.vue';
import AdvancedConfigPanels from '@/components/panels/AdvancedConfigPanels.vue';
import AutoSyncCard from '@/components/panels/AutoSyncCard.vue';
import TodayStatusCards from '@/components/aside/TodayStatusCards.vue';
import SyncLogFeed from '@/components/aside/SyncLogFeed.vue';

const props = defineProps<{
  activeNav?: string;
}>();

const isAiSettings = computed(() => props.activeNav === 'ai');
const pageTitle = computed(() => (isAiSettings.value ? 'AI 设置' : '日报配置'));
const pageSubtitle = computed(() =>
  isAiSettings.value ? '集中维护模型接口、模型名称与 API Key' : '配置日报生成规则、AI 接入与同步设置',
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
    desc: '当前日报生成使用这套 AI 连接；后续可扩展为多配置档案和场景覆盖。',
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
      <main class="main-center">
        <section class="config-surface" aria-label="AI 配置表单">
          <AdvancedConfigPanels mode="ai" />
        </section>
      </main>

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
          <BrainCog :size="18" />
          <div>
            <strong>后续扩展方向</strong>
            <span>可以继续升级为“配置档案库 + 场景接入选择”，让不同 AI 场景选用不同模型。</span>
          </div>
        </section>
      </aside>
    </div>

    <div v-else class="main-grid config-layout">
      <main class="main-center">
        <section class="config-surface" aria-label="日报配置表单">
          <BasicConfigCard />
          <AdvancedConfigPanels />
          <AutoSyncCard />
        </section>
      </main>

      <aside class="main-aside">
        <TodayStatusCards />
        <SyncLogFeed />
      </aside>
    </div>
  </div>
</template>
