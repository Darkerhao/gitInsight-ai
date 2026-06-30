<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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
import { navKeys } from '@/router';
import type { NavKey } from '@/router';

const assistant = useAssistant();
const syncInitialTab = ref<'list' | 'calendar'>('list');
const showWelcome = ref(!window.localStorage.getItem('gitinsight:welcome-finished'));
const route = useRoute();
const router = useRouter();

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

const routeNav = computed<NavKey>(() => {
  const value = Array.isArray(route.params.nav) ? route.params.nav[0] : route.params.nav;
  return navKeys.includes(value as NavKey) ? (value as NavKey) : 'dashboard';
});
const activeNav = computed({
  get: () => routeNav.value,
  set: (value: string) => handleNavigate(value),
});
const activeView = computed(() => viewMap[activeNav.value as keyof typeof viewMap] ?? DashboardView);
const appVersionText = computed(() => (assistant.storageInfo.value?.appVersion ? ` v${assistant.storageInfo.value.appVersion}` : ''));

watch(
  () => route.query.tab,
  (value) => {
    if (routeNav.value === 'sync' && (value === 'list' || value === 'calendar')) {
      syncInitialTab.value = value;
    }
  },
);

function handleNavigate(value: string) {
  const [targetNav, targetTab] = value.split(':');
  if (targetNav === 'sync' && (targetTab === 'list' || targetTab === 'calendar')) {
    syncInitialTab.value = targetTab;
  }
  const nextQuery = targetNav === 'sync' && (targetTab === 'list' || targetTab === 'calendar') ? { tab: targetTab } : {};
  void router.push({ path: `/${targetNav}`, query: nextQuery });
}

function needsOnboarding() {
  return !assistant.config.workspaceDirs.length || !assistant.config.reporterName;
}

function finishWelcome() {
  showWelcome.value = false;
}

onMounted(async () => {
  if (routeNav.value === 'sync' && (route.query.tab === 'list' || route.query.tab === 'calendar')) {
    syncInitialTab.value = route.query.tab;
  }
  await assistant.init();
  if (needsOnboarding()) {
    showWelcome.value = true;
  }
});

onBeforeUnmount(() => {
  assistant.dispose();
});
</script>

<template>
  <WelcomeGate v-if="showWelcome" @finished="finishWelcome" />

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
