<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useAssistant } from '@/composables/useAssistant';
import AppSidebar from '@/components/AppSidebar.vue';
import AppTopbar from '@/components/AppTopbar.vue';
import SectionTitle from '@/components/common/SectionTitle.vue';
import BasicConfigCard from '@/components/panels/BasicConfigCard.vue';
import AdvancedConfigPanels from '@/components/panels/AdvancedConfigPanels.vue';
import AutoSyncCard from '@/components/panels/AutoSyncCard.vue';
import ReportPreviewCard from '@/components/panels/ReportPreviewCard.vue';
import TodayStatusCards from '@/components/aside/TodayStatusCards.vue';
import SyncLogFeed from '@/components/aside/SyncLogFeed.vue';
import UsageGuide from '@/components/aside/UsageGuide.vue';

const assistant = useAssistant();
const activeNav = ref('config');

onMounted(async () => {
  await assistant.init();
});

onBeforeUnmount(() => {
  assistant.dispose();
});
</script>

<template>
  <div class="app-layout">
    <AppSidebar v-model:active-nav="activeNav" />

    <main class="app-main">
      <AppTopbar />

      <div class="app-scroll">
        <div class="main-grid">
          <div class="main-center">
            <section class="surface-card config-surface">
              <SectionTitle title="日报配置" subtitle="配置日报生成规则与同步设置" />
              <BasicConfigCard />
              <AdvancedConfigPanels />
              <AutoSyncCard />
              <ReportPreviewCard />
            </section>
          </div>

          <div class="main-aside">
            <TodayStatusCards />
            <SyncLogFeed />
            <UsageGuide />
          </div>
        </div>

        <footer class="app-footer">
          AI日报助手 v1.0.0 · 让技术日报生成更简单、更智能
        </footer>
      </div>
    </main>
  </div>
</template>
