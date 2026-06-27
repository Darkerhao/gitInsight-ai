<script setup lang="ts">
import PageHeader from '@/components/common/PageHeader.vue';
import BasicConfigCard from '@/components/panels/BasicConfigCard.vue';
import AdvancedConfigPanels from '@/components/panels/AdvancedConfigPanels.vue';
import AutoSyncCard from '@/components/panels/AutoSyncCard.vue';
import ReportPreviewCard from '@/components/panels/ReportPreviewCard.vue';
import TodayStatusCards from '@/components/aside/TodayStatusCards.vue';
import SyncLogFeed from '@/components/aside/SyncLogFeed.vue';
import UsageGuide from '@/components/aside/UsageGuide.vue';
</script>

<template>
  <div class="view-stack">
    <PageHeader title="日报配置" subtitle="配置日报生成规则、AI 接入与同步设置" />

    <div class="main-grid">
      <div class="main-center">
        <section class="surface-card config-surface">
          <BasicConfigCard />
          <AdvancedConfigPanels />
          <AutoSyncCard />
          <ReportPreviewCard />
        </section>
      </div>

      <aside class="main-aside">
        <TodayStatusCards />
        <SyncLogFeed />
        <UsageGuide />
      </aside>
    </div>
  </div>
</template>
