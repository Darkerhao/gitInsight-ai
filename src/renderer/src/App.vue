<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useAssistant } from '@/composables/useAssistant';
import AppSidebar from '@/components/AppSidebar.vue';
import AppTopbar from '@/components/AppTopbar.vue';
import WelcomeGate from '@/components/WelcomeGate.vue';
import DashboardView from '@/views/DashboardView.vue';
import RepositoryCenterView from '@/views/RepositoryCenterView.vue';
import ReportConfigView from '@/views/ReportConfigView.vue';
import ReportGenerateView from '@/views/ReportGenerateView.vue';
import SyncTasksView from '@/views/SyncTasksView.vue';
import HistoryLogsView from '@/views/HistoryLogsView.vue';
import SystemSettingsView from '@/views/SystemSettingsView.vue';
import AboutUsView from '@/views/AboutUsView.vue';
import UsageHelpView from '@/views/UsageHelpView.vue';
import MessageCenterView from '@/views/MessageCenterView.vue';

const assistant = useAssistant();
const activeNav = ref('dashboard');
const syncInitialTab = ref<'list' | 'calendar'>('list');
const showWelcome = ref(true);

const viewMap = {
  dashboard: DashboardView,
  repositories: RepositoryCenterView,
  about: AboutUsView,
  help: UsageHelpView,
  config: ReportConfigView,
  generate: ReportGenerateView,
  messages: MessageCenterView,
  sync: SyncTasksView,
  history: HistoryLogsView,
  system: SystemSettingsView,
};

const activeView = computed(() => viewMap[activeNav.value as keyof typeof viewMap] ?? DashboardView);
const appVersionText = computed(() => (assistant.storageInfo.value?.appVersion ? ` v${assistant.storageInfo.value.appVersion}` : ''));

function handleNavigate(value: string) {
  const [targetNav, targetTab] = value.split(':');
  if (targetNav === 'sync' && (targetTab === 'list' || targetTab === 'calendar')) {
    syncInitialTab.value = targetTab;
  }
  activeNav.value = targetNav;
}

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
      <AppTopbar @navigate="handleNavigate" />

      <div class="app-scroll">
        <component :is="activeView" :initial-tab="activeNav === 'sync' ? syncInitialTab : undefined" @navigate="handleNavigate" />

        <footer class="app-footer">
          AI日报助手{{ appVersionText }} · 让技术日报生成更简单、更智能
        </footer>
      </div>
    </main>
  </div>
</template>
