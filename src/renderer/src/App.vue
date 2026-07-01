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
const WELCOME_STORAGE_KEY = 'gitinsight:welcome-finished';
const syncInitialTab = ref<'list' | 'calendar'>('list');
const showWelcome = ref(!window.localStorage.getItem(WELCOME_STORAGE_KEY));
const assistantReady = ref(false);
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
const welcomeMetrics = computed(() => {
  const reports = assistant.dailyReports.value;
  const syncLogs = assistant.syncLogs.value;

  return {
    loaded: assistantReady.value,
    repoCount: assistant.repos.value.length,
    selectedRepoCount: assistant.selectedRepos.value.length,
    reportCount: assistant.storageInfo.value?.reportsCount ?? reports.length,
    recentCommitCount: reports.reduce((total, item) => total + item.commitsCount, 0),
    syncLogCount: assistant.storageInfo.value?.syncLogsCount ?? syncLogs.length,
    successSyncLogCount: syncLogs.filter((item) => item.status === 'success').length,
    errorLogCount: assistant.storageInfo.value?.errorLogsCount ?? assistant.errorLogs.value.length,
    latestReportDate: reports[0]?.date ?? '',
    latestSyncAt: syncLogs[0]?.ranAt ?? '',
    appVersion: assistant.storageInfo.value?.appVersion ?? '',
  };
});

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
  try {
    window.localStorage.setItem(WELCOME_STORAGE_KEY, 'true');
  } catch {
    // localStorage 不可用时仍允许进入主工作台。
  }
  showWelcome.value = false;
}

onMounted(async () => {
  if (routeNav.value === 'sync' && (route.query.tab === 'list' || route.query.tab === 'calendar')) {
    syncInitialTab.value = route.query.tab;
  }
  await assistant.init();
  assistantReady.value = true;
  if (needsOnboarding()) {
    showWelcome.value = true;
  }
});

onBeforeUnmount(() => {
  assistant.dispose();
});
</script>

<template>
  <WelcomeGate v-if="showWelcome" :metrics="welcomeMetrics" @finished="finishWelcome" />

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
