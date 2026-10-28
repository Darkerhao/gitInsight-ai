<script setup lang="ts">
import { computed, defineAsyncComponent, h, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Component, VNode } from 'vue';
import { ElButton, ElEmpty, ElMessageBox, ElResult } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import { useAssistant } from '@/composables/useAssistant';
import AppSidebar from '@/components/AppSidebar.vue';
import AppTopbar from '@/components/AppTopbar.vue';
import WelcomeGate from '@/components/WelcomeGate.vue';
import { useAppUpdates } from '@/composables/useAppUpdates';
import { usePageZoom } from '@/composables/usePageZoom';
import { useCoinWorkshop } from '@/composables/useCoinWorkshop';
import { navKeys } from '@/router';
import type { NavKey } from '@/router';

type ThemeMode = 'light' | 'dark';
type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>;
  };
};

const assistant = useAssistant();
const appUpdates = useAppUpdates();
const coinWorkshop = useCoinWorkshop();
const THEME_STORAGE_KEY = 'gitinsight:theme-mode';
const WELCOME_STORAGE_KEY = 'gitinsight:welcome-finished';
const WELCOME_ANIMATION_ENABLED_KEY = 'gitinsight:welcome-animation-enabled';
const themeMode = ref<ThemeMode>(getInitialThemeMode());
const showWelcome = ref(shouldShowWelcomeOnLaunch());
const assistantReady = ref(false);
const initializationError = ref('');
const route = useRoute();
const router = useRouter();
const { zoomFactor, canZoomOut, canZoomIn, initializePageZoom, zoomIn, zoomOut, resetPageZoom } = usePageZoom();
const legacyNavMap: Record<string, NavKey> = {
  farm: 'timeline',
};

async function reloadApplication() {
  try {
    await ElMessageBox.confirm('重新加载会丢失尚未保存的修改，是否继续？', '重新加载应用', {
      confirmButtonText: '重新加载', cancelButtonText: '保留当前内容', type: 'warning',
    });
    window.location.reload();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') throw error;
  }
}

const pageLoadingView = { render: () => h(ElEmpty, { description: '正在加载页面…', 'data-page-pending': '' }) };
const pageErrorView = {
  render: () => h(ElResult, { icon: 'error', title: '页面加载失败', subTitle: '可继续使用其他页面，或重新加载应用后重试。', 'data-page-pending': '' }, {
    extra: () => h(ElButton, { type: 'primary', onClick: reloadApplication }, () => '重新加载应用'),
  }),
};

function lazyView(loader: () => Promise<{ default: Component }>) {
  return defineAsyncComponent({ loader, loadingComponent: pageLoadingView, errorComponent: pageErrorView, delay: 0 });
}

const reportConfigView = lazyView(() => import('@/views/ReportConfigView.vue'));
const viewMap: Record<NavKey, Component> = {
  dashboard: lazyView(() => import('@/views/DashboardView.vue')),
  repositories: lazyView(() => import('@/views/RepositoryCenterView.vue')),
  sync: lazyView(() => import('@/views/SyncTasksView.vue')),
  messages: lazyView(() => import('@/views/MessageCenterView.vue')),
  help: lazyView(() => import('@/views/UsageHelpView.vue')),
  material: lazyView(() => import('@/views/MaterialReportsView.vue')),
  config: reportConfigView,
  generate: lazyView(() => import('@/views/ReportGenerateView.vue')),
  weekly: lazyView(() => import('@/views/WeeklyReportsView.vue')),
  summary: lazyView(() => import('@/views/WeeklySummaryView.vue')),
  reflection: lazyView(() => import('@/views/WeeklyReflectionView.vue')),
  history: lazyView(() => import('@/views/HistoryLogsView.vue')),
  timeline: lazyView(() => import('@/views/JiaziTimelineView.vue')),
  coins: lazyView(() => import('@/views/CoinWorkshopView.vue')),
  ai: reportConfigView,
  system: lazyView(() => import('@/views/SystemSettingsView.vue')),
  about: lazyView(() => import('@/views/AboutView.vue')),
};

const routeNav = computed<NavKey>(() => {
  const value = Array.isArray(route.params.nav) ? route.params.nav[0] : route.params.nav;
  return navKeys.includes(value as NavKey) ? (value as NavKey) : 'generate';
});
const activeNav = computed({
  get: () => routeNav.value,
  set: (value: string) => handleNavigate(value),
});
const activeView = computed(() => viewMap[routeNav.value]);
watch(routeNav, () => performance.mark('gitinsight:page-requested'), { immediate: true });

function onPageMounted(vnode: VNode) {
  // Async wrappers also mount their placeholder; only time the real page element.
  const element = vnode.el as HTMLElement | null;
  if (!element || element.nodeType !== Node.ELEMENT_NODE || element.hasAttribute('data-page-pending')) return;
  performance.mark('gitinsight:page-ready');
  performance.measure('gitinsight:page-load', 'gitinsight:page-requested', 'gitinsight:page-ready');
  if (!performance.getEntriesByName('gitinsight:first-page-ready').length) {
    performance.mark('gitinsight:first-page-ready');
    performance.measure('gitinsight:first-page', { start: 0, end: performance.now() });
  }
}
const appVersionText = computed(() => {
  const info = assistant.storageInfo.value;
  if (!info?.appVersion) return '';
  return ` v${info.appVersion}`;
});
const welcomeMetrics = computed(() => ({
  loaded: assistantReady.value,
  selectedRepoCount: assistant.selectedRepos.value.length,
  reporterName: assistant.config.reporterName,
  aiReady: Boolean(assistant.activeAiProfile.value.enabled && assistant.activeAiProfile.value.baseUrl
    && assistant.activeAiProfile.value.model && assistant.activeAiProfile.value.apiKey),
}));

function handleNavigate(value: string) {
  if (value === 'sync:list' || value === 'sync:calendar') {
    void router.push({ path: '/sync', query: { tab: value.split(':')[1] } });
    return;
  }
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

function handlePageZoomShortcut(event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return;

  if (event.code === 'Equal' || event.code === 'NumpadAdd' || event.key === '+') {
    event.preventDefault();
    void zoomIn();
    return;
  }

  if (event.code === 'Minus' || event.code === 'NumpadSubtract' || event.key === '-') {
    event.preventDefault();
    void zoomOut();
    return;
  }

  if (event.code === 'Digit0' || event.code === 'Numpad0') {
    event.preventDefault();
    void resetPageZoom();
  }
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

watch(coinWorkshop.theme, (theme) => {
  const root = document.documentElement;
  if (theme?.accent && theme.id !== 'theme-default') {
    root.dataset.coinTheme = theme.id;
    root.style.setProperty('--coin-accent', theme.accent);
  } else {
    root.removeAttribute('data-coin-theme');
    root.style.removeProperty('--coin-accent');
  }
}, { immediate: true });

async function initializeAssistant() {
  initializationError.value = '';
  try {
    await assistant.init();
    assistantReady.value = true;
  } catch (error) {
    initializationError.value = error instanceof Error ? error.message : '本地数据加载失败';
  }
}

onMounted(() => {
  window.addEventListener('keydown', handlePageZoomShortcut, true);
  void initializePageZoom();
  void initializeAssistant();
  void appUpdates.initialize();
  void coinWorkshop.initialize();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handlePageZoomShortcut, true);
  assistant.dispose();
  appUpdates.dispose();
  coinWorkshop.dispose();
});
</script>

<template>
  <WelcomeGate v-if="showWelcome && !initializationError" :metrics="welcomeMetrics" @finished="finishWelcome" @navigate="handleNavigate" />

  <div class="app-layout atelier-app" :inert="(showWelcome && !initializationError) || undefined">
    <AppSidebar v-model:active-nav="activeNav" />

    <main class="app-main">
      <AppTopbar
        :theme-mode="themeMode"
        :zoom-factor="zoomFactor"
        :can-zoom-out="canZoomOut()"
        :can-zoom-in="canZoomIn()"
        @toggle-theme="toggleThemeMode"
        @zoom-out="zoomOut"
        @zoom-in="zoomIn"
        @reset-zoom="resetPageZoom"
        @navigate="handleNavigate"
      />

      <div class="app-scroll atelier-scroll" :class="{ 'is-immersive': activeNav === 'timeline' }">
        <el-result v-if="initializationError" icon="error" title="无法加载本地数据" :sub-title="initializationError">
          <template #extra>
            <p>请检查本地配置文件或磁盘状态，修复后重新加载。</p>
            <el-button type="primary" @click="initializeAssistant">重新加载</el-button>
          </template>
        </el-result>
        <el-empty v-else-if="!assistantReady" description="正在加载本地数据…" />
        <Transition v-else name="route-switch" @leave="(_element, done) => done()">
          <component :is="activeView" :key="activeNav" :active-nav="activeNav" @navigate="handleNavigate" @vue:mounted="onPageMounted" />
        </Transition>

        <footer v-if="activeNav !== 'timeline'" class="app-footer">
          码迹AI{{ appVersionText }} · 让每一次提交，都成为看得见的成果
        </footer>
      </div>
    </main>
  </div>
</template>
