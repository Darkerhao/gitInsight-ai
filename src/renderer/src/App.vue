<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAssistant } from '@/composables/useAssistant';
import AppSidebar from '@/components/AppSidebar.vue';
import AppTopbar from '@/components/AppTopbar.vue';
import WelcomeGate from '@/components/WelcomeGate.vue';
import ReportConfigView from '@/views/ReportConfigView.vue';
import ReportGenerateView from '@/views/ReportGenerateView.vue';
import HistoryLogsView from '@/views/HistoryLogsView.vue';
import SystemSettingsView from '@/views/SystemSettingsView.vue';
import { navKeys } from '@/router';
import type { NavKey } from '@/router';

const assistant = useAssistant();
const WELCOME_STORAGE_KEY = 'gitinsight:welcome-finished';
const WELCOME_ANIMATION_ENABLED_KEY = 'gitinsight:welcome-animation-enabled';
const showWelcome = ref(shouldShowWelcomeOnLaunch());
const assistantReady = ref(false);
const route = useRoute();
const router = useRouter();
const legacyNavMap: Record<string, NavKey> = {
  dashboard: 'generate',
  repositories: 'config',
  sync: 'config',
  'sync:list': 'config',
  'sync:calendar': 'config',
  messages: 'history',
  help: 'system',
  about: 'system',
};

const viewMap = {
  config: ReportConfigView,
  generate: ReportGenerateView,
  history: HistoryLogsView,
  system: SystemSettingsView,
};

const routeNav = computed<NavKey>(() => {
  const value = Array.isArray(route.params.nav) ? route.params.nav[0] : route.params.nav;
  return navKeys.includes(value as NavKey) ? (value as NavKey) : 'generate';
});
const activeNav = computed({
  get: () => routeNav.value,
  set: (value: string) => handleNavigate(value),
});
const activeView = computed(() => viewMap[activeNav.value as keyof typeof viewMap] ?? ReportGenerateView);
const appVersionText = computed(() => {
  const info = assistant.storageInfo.value;
  if (!info?.appVersion) return '';
  return ` ${info.appEditionLabel} v${info.appVersion}`;
});
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

function handleNavigate(value: string) {
  const target = navKeys.includes(value as NavKey) ? (value as NavKey) : legacyNavMap[value];
  if (!target) return;
  void router.push({ path: `/${target}` });
}

function needsOnboarding() {
  return !assistant.config.workspaceDirs.length || !assistant.config.reporterName;
}

function shouldShowWelcomeOnLaunch() {
  try {
    const animationPreference = window.localStorage.getItem(WELCOME_ANIMATION_ENABLED_KEY);
    if (animationPreference === 'true') return true;
    if (animationPreference === 'false') return false;
    return !window.localStorage.getItem(WELCOME_STORAGE_KEY);
  } catch {
    return false;
  }
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
      <AppTopbar />

      <div class="app-scroll">
        <component :is="activeView" @navigate="handleNavigate" />

        <footer class="app-footer">
          AI日报助手{{ appVersionText }} · 让技术日报生成更简单、更智能
        </footer>
      </div>
    </main>
  </div>
</template>
