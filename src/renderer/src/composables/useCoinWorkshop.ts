import { computed, readonly, ref, shallowRef } from 'vue';
import { COIN_SHOP_ITEMS } from '@shared/coinWorkshop';
import type { CoinWorkshopSnapshot } from '@shared/coinWorkshop';

const snapshot = shallowRef<CoinWorkshopSnapshot | null>(null);
const loading = ref(false);
const error = ref('');
const pending = ref('');
let revision = 0;
let unsubscribe: (() => void) | undefined;

async function refresh() {
  const request = ++revision;
  loading.value = true;
  error.value = '';
  try {
    const result = await window.api.getCoinWorkshop();
    if (request === revision) snapshot.value = result;
  } catch (cause) {
    if (request === revision) error.value = cause instanceof Error ? cause.message : '工坊暂时无法读取，请重试。';
  } finally {
    if (request === revision) loading.value = false;
  }
}

async function mutate(key: string, operation: () => Promise<CoinWorkshopSnapshot>) {
  if (pending.value) return false;
  pending.value = key;
  error.value = '';
  ++revision;
  try {
    const result = await operation();
    ++revision;
    snapshot.value = result;
    return true;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '操作未完成，请重试。';
    return false;
  } finally {
    loading.value = false;
    pending.value = '';
  }
}

export function useCoinWorkshop() {
  return {
    snapshot: readonly(snapshot), loading: readonly(loading), error: readonly(error), pending: readonly(pending), refresh,
    theme: computed(() => COIN_SHOP_ITEMS.find(item => item.id === snapshot.value?.equippedThemeId)),
    initialize() {
      if (!unsubscribe) unsubscribe = window.api.onCheckinWalletUpdated(() => {
        if (!pending.value) void refresh();
      });
      return refresh();
    },
    dispose() { unsubscribe?.(); unsubscribe = undefined; ++revision; },
    purchase: (id: string) => mutate(`buy:${id}`, () => window.api.purchaseCoinItem(id)),
    equip: (id: string) => mutate(`equip:${id}`, () => window.api.equipCoinItem(id)),
    harvest: (id: number) => mutate(`harvest:${id}`, () => window.api.harvestCoinPlant(id)),
  };
}
