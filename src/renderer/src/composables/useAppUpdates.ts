import { computed, readonly, shallowRef, ref } from 'vue';
import type { AppUpdateState } from '@shared/appUpdate';

const state = shallowRef<AppUpdateState | null>(null);
const requestError = ref('');
let unsubscribe: (() => void) | undefined;
let revision = 0;

async function run(operation: () => Promise<AppUpdateState>): Promise<void> {
  requestError.value = '';
  const before = revision;
  try {
    const snapshot = await operation();
    // A pushed event can arrive before an older invoke response.
    if (revision === before) state.value = snapshot;
  } catch (error) {
    requestError.value = error instanceof Error ? error.message : '无法读取更新状态，请重试。';
  }
}

export function useAppUpdates() {
  async function initialize() {
    if (!unsubscribe) {
      unsubscribe = window.api.onAppUpdateState(snapshot => {
        revision++;
        state.value = snapshot;
      });
    }
    await run(() => window.api.getAppUpdateState());
  }

  function dispose() {
    unsubscribe?.();
    unsubscribe = undefined;
  }

  return {
    state: readonly(state), requestError: readonly(requestError), initialize, dispose,
    hasUpdate: computed(() => Boolean(state.value?.latestVersion)),
    refresh: () => run(() => window.api.getAppUpdateState()),
    check: () => run(() => window.api.checkForAppUpdates()),
    download: () => run(() => window.api.downloadAppUpdate()),
    setAutomatic: (enabled: boolean) => run(() => window.api.setAutomaticUpdates(enabled)),
  };
}
