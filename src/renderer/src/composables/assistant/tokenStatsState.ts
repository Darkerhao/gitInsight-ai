import { ref } from 'vue';
import type {
  TokenScanRecord,
  TokenScanProgress,
  TokenProxyStatus,
  UsageStats,
  UsageFilter,
} from '@shared/types';
import { normalizeRepoSelections } from './normalizers';

export function createTokenStatsState() {
  const tokenScans = ref<TokenScanRecord[]>([]);
  const scanProgress = ref<TokenScanProgress | null>(null);
  const scanning = ref(false);
  const proxyStatus = ref<TokenProxyStatus>({ running: false, port: 0, requestCount: 0 });
  const usageStats = ref<UsageStats | null>(null);
  const usageLoading = ref(false);

  let removeScanProgressListener: (() => void) | null = null;

  async function runTokenScan(repoPaths: string[]) {
    scanning.value = true;
    scanProgress.value = null;
    try {
      const scanTargets = normalizeRepoSelections([...repoPaths]);
      removeScanProgressListener = window.api.onTokenScanProgress((progress) => {
        scanProgress.value = progress;
      });
      const results = await window.api.runTokenScan(scanTargets);
      tokenScans.value = [...results, ...tokenScans.value];
      return results;
    } finally {
      scanning.value = false;
      scanProgress.value = null;
      removeScanProgressListener?.();
      removeScanProgressListener = null;
    }
  }

  async function loadTokenScans() {
    tokenScans.value = await window.api.listTokenScans(50);
  }

  async function refreshProxyStatus() {
    proxyStatus.value = await window.api.getTokenProxyStatus();
  }

  async function startProxy() {
    const config = await window.api.loadConfig();
    await window.api.startTokenProxy(config.tokenProxy);
    await refreshProxyStatus();
  }

  async function stopProxy() {
    await window.api.stopTokenProxy();
    await refreshProxyStatus();
  }

  async function loadUsageStats(filter?: UsageFilter) {
    usageLoading.value = true;
    try {
      usageStats.value = await window.api.getUsageStats(filter);
    } finally {
      usageLoading.value = false;
    }
  }

  function dispose() {
    removeScanProgressListener?.();
    removeScanProgressListener = null;
  }

  return {
    tokenScans,
    scanProgress,
    scanning,
    proxyStatus,
    usageStats,
    usageLoading,
    runTokenScan,
    loadTokenScans,
    refreshProxyStatus,
    startProxy,
    stopProxy,
    loadUsageStats,
    dispose,
  };
}
