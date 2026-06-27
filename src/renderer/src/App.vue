<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useAssistant } from '@/composables/useAssistant';
import AppSidebar from '@/components/AppSidebar.vue';
import AppTopbar from '@/components/AppTopbar.vue';
import WelcomeGate from '@/components/WelcomeGate.vue';
import ReportConfigView from '@/views/ReportConfigView.vue';
import ReportGenerateView from '@/views/ReportGenerateView.vue';
import SyncTasksView from '@/views/SyncTasksView.vue';
import HistoryLogsView from '@/views/HistoryLogsView.vue';
import SystemSettingsView from '@/views/SystemSettingsView.vue';

const assistant = useAssistant();
const activeNav = ref('system');
const showWelcome = ref(true);

const viewMap = {
  config: ReportConfigView,
  generate: ReportGenerateView,
  sync: SyncTasksView,
  history: HistoryLogsView,
  system: SystemSettingsView,
};

const activeView = computed(() => viewMap[activeNav.value as keyof typeof viewMap] ?? SystemSettingsView);

onMounted(async () => {
  await assistant.init();
});

onBeforeUnmount(() => {
  assistant.dispose();
});
</script>

<template>
  <WelcomeGate v-if="showWelcome" @finished="showWelcome = false" />

  <div class="app-layout">
    <AppSidebar v-model:active-nav="activeNav" />

    <main class="app-main">
      <AppTopbar />

      <div class="app-scroll">
        <component :is="activeView" />

        <footer class="app-footer">
          AI日报助手 v1.0.0 · 让技术日报生成更简单、更智能
        </footer>
      </div>
    </main>
  </div>
</template>
