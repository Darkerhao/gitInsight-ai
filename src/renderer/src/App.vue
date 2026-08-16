<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAssistant } from '@/composables/useAssistant';
import AppSidebar from '@/components/AppSidebar.vue';
import AppTopbar from '@/components/AppTopbar.vue';
import WelcomeGate from '@/components/WelcomeGate.vue';
import ReportConfigView from '@/views/ReportConfigView.vue';
import ReportGenerateView from '@/views/ReportGenerateView.vue';
import WeeklyReportsView from '@/views/WeeklyReportsView.vue';
import HistoryLogsView from '@/views/HistoryLogsView.vue';
import JiaziTimelineView from '@/views/JiaziTimelineView.vue';
import SystemSettingsView from '@/views/SystemSettingsView.vue';
import { navKeys } from '@/router';
import type { NavKey } from '@/router';

type ThemeMode = 'light' | 'dark';
type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>;
  };
};

const assistant = useAssistant();
const THEME_STORAGE_KEY = 'gitinsight:theme-mode';
const WELCOME_STORAGE_KEY = 'gitinsight:welcome-finished';
const WELCOME_ANIMATION_ENABLED_KEY = 'gitinsight:welcome-animation-enabled';
const themeMode = ref<ThemeMode>(getInitialThemeMode());
const showWelcome = ref(shouldShowWelcomeOnLaunch());
const assistantReady = ref(false);
const appRoot = ref<HTMLElement | null>(null);
const appScroll = ref<HTMLElement | null>(null);
const route = useRoute();
const router = useRouter();
let scrollElement: HTMLElement | null = null;
let pointerFrame = 0;
const pointerTarget = { x: 50, y: 18 };
const pointerCurrent = { x: 50, y: 18 };
const pointerVelocity = { x: 0, y: 0 };
const legacyNavMap: Record<string, NavKey> = {
  dashboard: 'generate',
  repositories: 'config',
  sync: 'config',
  'sync:list': 'config',
  'sync:calendar': 'config',
  messages: 'history',
  help: 'system',
  about: 'system',
  farm: 'timeline',
};

const viewMap = {
  config: ReportConfigView,
  generate: ReportGenerateView,
  weekly: WeeklyReportsView,
  history: HistoryLogsView,
  timeline: JiaziTimelineView,
  ai: ReportConfigView,
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

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

function getInitialThemeMode(): ThemeMode {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeMode(storedTheme)) return storedTheme;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.classList.toggle('dark', mode === 'dark');
  root.style.colorScheme = mode;
}

function getThemeTransitionOrigin(event?: MouseEvent) {
  const fallbackX = window.innerWidth - 72;
  const fallbackY = 42;
  const x = event?.clientX ?? fallbackX;
  const y = event?.clientY ?? fallbackY;
  const endX = Math.max(x, window.innerWidth - x);
  const endY = Math.max(y, window.innerHeight - y);

  return {
    x,
    y,
    radius: Math.hypot(endX, endY),
  };
}

function setThemeTransitionVars(event: MouseEvent | undefined, nextMode: ThemeMode) {
  const root = document.documentElement;
  const { x, y, radius } = getThemeTransitionOrigin(event);
  root.style.setProperty('--theme-transition-x', `${x}px`);
  root.style.setProperty('--theme-transition-y', `${y}px`);
  root.style.setProperty('--theme-transition-radius', `${radius}px`);
  root.dataset.themeTransition = nextMode;
}

function clearThemeTransitionVars() {
  const root = document.documentElement;
  root.removeAttribute('data-theme-transition');
  root.style.removeProperty('--theme-transition-x');
  root.style.removeProperty('--theme-transition-y');
  root.style.removeProperty('--theme-transition-radius');
}

function runFallbackThemeTransition(nextMode: ThemeMode) {
  const root = document.documentElement;
  root.classList.add('theme-transition-fallback');
  themeMode.value = nextMode;
  window.setTimeout(() => {
    root.classList.remove('theme-transition-fallback');
    clearThemeTransitionVars();
  }, 420);
}

function toggleThemeMode(event?: MouseEvent) {
  const nextMode = themeMode.value === 'dark' ? 'light' : 'dark';
  const viewTransitionDocument = document as ViewTransitionDocument;

  setThemeTransitionVars(event, nextMode);

  if (
    !viewTransitionDocument.startViewTransition ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    runFallbackThemeTransition(nextMode);
    return;
  }

  const transition = viewTransitionDocument.startViewTransition(() => {
    themeMode.value = nextMode;
  });

  transition.finished.finally(clearThemeTransitionVars).catch(() => {
    clearThemeTransitionVars();
  });
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

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function handlePointerMove(event: PointerEvent) {
  const root = appRoot.value;
  if (!root) return;

  const bounds = root.getBoundingClientRect();
  pointerTarget.x = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * 100));
  pointerTarget.y = Math.max(0, Math.min(100, ((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * 100));
  root.style.setProperty('--pointer-alpha', '1');

  if (prefersReducedMotion()) {
    pointerCurrent.x = pointerTarget.x;
    pointerCurrent.y = pointerTarget.y;
    root.style.setProperty('--pointer-x', `${pointerCurrent.x}%`);
    root.style.setProperty('--pointer-y', `${pointerCurrent.y}%`);
    return;
  }

  if (!pointerFrame) pointerFrame = window.requestAnimationFrame(animatePointer);
}

function resetPointerLight() {
  appRoot.value?.style.setProperty('--pointer-alpha', '0');
}

function animatePointer() {
  const root = appRoot.value;
  if (!root) {
    pointerFrame = 0;
    return;
  }

  const deltaX = pointerTarget.x - pointerCurrent.x;
  const deltaY = pointerTarget.y - pointerCurrent.y;
  pointerVelocity.x = (pointerVelocity.x + deltaX * 0.14) * 0.72;
  pointerVelocity.y = (pointerVelocity.y + deltaY * 0.14) * 0.72;
  pointerCurrent.x += pointerVelocity.x;
  pointerCurrent.y += pointerVelocity.y;
  root.style.setProperty('--pointer-x', `${pointerCurrent.x}%`);
  root.style.setProperty('--pointer-y', `${pointerCurrent.y}%`);

  if (Math.abs(deltaX) + Math.abs(deltaY) + Math.abs(pointerVelocity.x) + Math.abs(pointerVelocity.y) > 0.08) {
    pointerFrame = window.requestAnimationFrame(animatePointer);
  } else {
    pointerFrame = 0;
  }
}

function handleScroll() {
  const node = scrollElement ?? appScroll.value;
  if (!node) return;

  const scrollableDistance = Math.max(node.scrollHeight - node.clientHeight, 0);
  const ratio = scrollableDistance ? node.scrollTop / scrollableDistance : 0;
  node.style.setProperty('--scroll-progress', `${Math.max(0, Math.min(1, ratio))}`);
}

watch(
  themeMode,
  (mode) => {
    applyThemeMode(mode);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Ignore storage failures; the in-memory theme still applies.
    }
  },
  { flush: 'sync', immediate: true },
);

onMounted(async () => {
  scrollElement = appScroll.value;
  scrollElement?.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  await assistant.init();
  assistantReady.value = true;
  if (needsOnboarding()) {
    showWelcome.value = true;
  }
});

onBeforeUnmount(() => {
  if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
  pointerFrame = 0;
  scrollElement?.removeEventListener('scroll', handleScroll);
  scrollElement = null;
  assistant.dispose();
});
</script>

<template>
  <WelcomeGate v-if="showWelcome" :metrics="welcomeMetrics" @finished="finishWelcome" />

  <div
    ref="appRoot"
    class="app-layout atelier-app"
    @pointermove="handlePointerMove"
    @pointerleave="resetPointerLight"
  >
    <div class="app-atmosphere" aria-hidden="true">
      <span class="app-atmosphere-grid" />
      <span class="app-atmosphere-orbit app-atmosphere-orbit-a" />
      <span class="app-atmosphere-orbit app-atmosphere-orbit-b" />
    </div>
    <AppSidebar v-model:active-nav="activeNav" />

    <main class="app-main">
      <AppTopbar :theme-mode="themeMode" @toggle-theme="toggleThemeMode" />

      <div ref="appScroll" class="app-scroll atelier-scroll" :class="{ 'is-immersive': activeNav === 'timeline' }">
        <Transition name="route-switch" mode="out-in">
          <component :is="activeView" :key="activeNav" :active-nav="activeNav" @navigate="handleNavigate" />
        </Transition>

        <footer v-if="activeNav !== 'timeline'" class="app-footer">
          AI日报助手{{ appVersionText }} · 让技术日报生成更简单、更智能
        </footer>
      </div>
    </main>
  </div>
</template>
