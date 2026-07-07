<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Coins, Gift } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import RewardEffectOverlay from '@/components/rewards/RewardEffectOverlay.vue';
import {
  EFFECT_DURATIONS,
  EFFECT_OPTION_MAP,
  groupEffectsByTier,
} from '@/components/rewards/rewardEffects';
import type { RewardEffectKey } from '@/components/rewards/rewardEffects';
import type { CheckinWallet, CheckinWalletImportPayload, CheckinWalletSnapshot } from '@shared/types';

const CHECKIN_STORAGE_KEY = 'gitinsight:checkin-wallet';
const DAILY_CHECKIN_REWARD_MIN = 88888;
const DAILY_CHECKIN_REWARD_MAX = 888888;

const effectTierGroups = groupEffectsByTier();

const wallet = ref<CheckinWallet>({ coins: 0, lastCheckinDate: '', streak: 0, updatedAt: '' });
const todayKey = ref('');
const walletLoading = ref(false);
const checkinLoading = ref(false);
const spendingEffect = ref<RewardEffectKey | null>(null);
const activeEffect = ref<RewardEffectKey | null>(null);
const effectSeed = ref(0);
let effectTimer: number | null = null;
let effectFrame: number | null = null;
let unsubscribeWalletUpdated: (() => void) | null = null;

const checkedInToday = computed(() => wallet.value.lastCheckinDate === todayKey.value);
const checkinButtonText = computed(() =>
  checkedInToday.value ? '今日已签' : `签到随机 +${DAILY_CHECKIN_REWARD_MIN}-${DAILY_CHECKIN_REWARD_MAX}`
);
const walletStatusText = computed(() => {
  if (walletLoading.value) return '甲币状态读取中';
  return checkedInToday.value ? '今日已签到' : '今日待签到';
});

function normalizeLocalWallet(value: unknown): CheckinWalletImportPayload {
  if (!value || typeof value !== 'object') {
    return { coins: 0, lastCheckinDate: '', streak: 0 };
  }

  const source = value as Partial<CheckinWalletImportPayload>;
  return {
    coins: Number.isFinite(source.coins) ? Math.max(0, Math.floor(Number(source.coins))) : 0,
    lastCheckinDate: typeof source.lastCheckinDate === 'string' ? source.lastCheckinDate : '',
    streak: Number.isFinite(source.streak) ? Math.max(0, Math.floor(Number(source.streak))) : 0,
  };
}

function readLocalWalletForMigration() {
  try {
    const stored = window.localStorage.getItem(CHECKIN_STORAGE_KEY);
    return normalizeLocalWallet(stored ? JSON.parse(stored) : null);
  } catch {
    return { coins: 0, lastCheckinDate: '', streak: 0 };
  }
}

function hasImportableWallet(value: CheckinWalletImportPayload) {
  return value.coins > 0 || Boolean(value.lastCheckinDate) || value.streak > 0;
}

function clearMigratedLocalWallet() {
  try {
    window.localStorage.removeItem(CHECKIN_STORAGE_KEY);
  } catch {
    // The database wallet is authoritative even if old local cache cleanup fails.
  }
}

function applyWalletSnapshot(snapshot: CheckinWalletSnapshot) {
  wallet.value = snapshot.wallet;
  todayKey.value = snapshot.today;
}

async function loadWalletSnapshot() {
  walletLoading.value = true;
  try {
    const localWallet = readLocalWalletForMigration();
    if (hasImportableWallet(localWallet)) {
      applyWalletSnapshot(await window.api.importCheckinWallet(localWallet));
      clearMigratedLocalWallet();
    } else {
      applyWalletSnapshot(await window.api.getCheckinWalletSnapshot());
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '读取甲币钱包失败');
  } finally {
    walletLoading.value = false;
  }
}

function stopEffect() {
  if (effectTimer) {
    window.clearTimeout(effectTimer);
    effectTimer = null;
  }

  if (effectFrame) {
    window.cancelAnimationFrame(effectFrame);
    effectFrame = null;
  }

  activeEffect.value = null;
}

function startEffect(effect: RewardEffectKey) {
  stopEffect();

  effectSeed.value += 1;
  effectFrame = window.requestAnimationFrame(() => {
    activeEffect.value = effect;
    effectFrame = null;
  });

  effectTimer = window.setTimeout(stopEffect, EFFECT_DURATIONS[effect]);
}

async function runDailyCheckin() {
  if (checkedInToday.value) {
    ElMessage.info('今天已经签到过了');
    return;
  }

  checkinLoading.value = true;
  try {
    const result = await window.api.runDailyCheckin();
    applyWalletSnapshot(result);
    if (result.rewardCoins > 0) {
      ElMessage.success(`签到成功，获得 ${result.rewardCoins} 甲币`);
    } else {
      ElMessage.info('今天已经签到过了');
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '签到失败');
  } finally {
    checkinLoading.value = false;
  }
}

async function playEffect(effect: RewardEffectKey) {
  const option = EFFECT_OPTION_MAP[effect];
  if (!option) return;

  if (wallet.value.coins < option.cost) {
    ElMessage.warning(`甲币不足，还差 ${option.cost - wallet.value.coins}`);
    return;
  }

  spendingEffect.value = effect;
  try {
    applyWalletSnapshot(await window.api.spendCheckinCoins({
      amount: option.cost,
      reason: `使用轻量效果：${option.label}`,
      refKey: effect,
    }));
    startEffect(effect);
    ElMessage.success(`已使用 ${option.cost} 甲币，已启用「${option.label}」`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '甲币消费失败');
  } finally {
    spendingEffect.value = null;
  }
}

onMounted(() => {
  void loadWalletSnapshot();
  // 农场花币/收获反哺后主进程会广播钱包快照，顶栏余额随之实时刷新
  unsubscribeWalletUpdated = window.api.onCheckinWalletUpdated((snapshot) => {
    applyWalletSnapshot(snapshot);
  });
});

onBeforeUnmount(() => {
  stopEffect();
  unsubscribeWalletUpdated?.();
  unsubscribeWalletUpdated = null;
});
</script>

<template>
  <el-popover placement="bottom-end" trigger="click" :width="410" popper-class="coin-popover">
    <template #reference>
      <el-button class="topbar-coin-btn" :icon="Coins" :loading="walletLoading" aria-label="甲币签到">
        <span :key="wallet.coins" class="coin-amount">{{ wallet.coins }}</span>
        <small>甲币</small>
      </el-button>
    </template>

    <div class="coin-panel">
      <div class="coin-panel-head">
        <div>
          <strong :key="wallet.coins" class="coin-amount">{{ wallet.coins }} 甲币</strong>
          <span>{{ walletStatusText }} · 轻量效果店</span>
        </div>
        <el-tag class="coin-streak-tag" type="warning" effect="light" round>
          连续 {{ wallet.streak }} 天
        </el-tag>
      </div>

      <el-button
        class="coin-checkin-btn"
        type="primary"
        :icon="Gift"
        :disabled="checkedInToday || walletLoading"
        :loading="checkinLoading"
        @click="runDailyCheckin"
      >
        {{ checkinButtonText }}
      </el-button>

      <div class="effect-shop">
        <template v-for="group in effectTierGroups" :key="group.meta.key">
          <div class="effect-tier-head" :class="`tier-${group.meta.key}`">
            <strong>{{ group.meta.label }}</strong>
            <small>{{ group.meta.costRange[0] }}-{{ group.meta.costRange[1] }} 甲币 · {{ group.options.length }} 项</small>
          </div>
          <button
            v-for="effect in group.options"
            :key="effect.key"
            class="effect-shop-item"
            :class="[
              `tier-${effect.tier}`,
              { 'is-apex': effect.apex },
            ]"
            type="button"
            :disabled="walletLoading || Boolean(spendingEffect) || wallet.coins < effect.cost"
            :style="{ '--effect-tone': effect.tone }"
            :title="`${effect.codename} - ${effect.narrative}`"
            @click="playEffect(effect.key)"
          >
            <span class="effect-shop-icon">
              <component :is="effect.icon" :size="18" />
            </span>
            <span class="effect-shop-copy">
              <strong>
                {{ effect.label }}
                <em v-if="effect.apex">精选</em>
              </strong>
              <small>{{ effect.cost }} 甲币</small>
            </span>
          </button>
        </template>
      </div>
    </div>
  </el-popover>

  <RewardEffectOverlay :effect="activeEffect" :seed="effectSeed" @close="stopEffect" />
</template>

<style>
.topbar-coin-btn.el-button {
  min-height: 34px;
  border-color: rgba(217, 119, 6, 0.22);
  border-radius: 10px;
  background: #fffbf1;
  color: #9a5f08;
  font-weight: 700;
  padding-inline: 12px;
  box-shadow: none;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.topbar-coin-btn.el-button:hover,
.topbar-coin-btn.el-button:focus-visible {
  border-color: rgba(217, 119, 6, 0.34);
  background: #fff6de;
  box-shadow: 0 8px 18px rgba(146, 64, 14, 0.08);
  color: #854d0e;
  transform: translateY(-1px);
}

.topbar-coin-btn.el-button span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.topbar-coin-btn.el-button small {
  color: #b7791f;
  font-size: 11px;
  font-weight: 700;
}

.coin-popover.el-popper {
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.12);
  overflow: hidden;
}

.coin-popover.el-popper .el-popper__arrow::before {
  border-color: rgba(226, 232, 240, 0.9);
  background: #fff;
}

.coin-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 6px;
}

.coin-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.coin-panel-head div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.coin-panel-head strong {
  color: var(--c-text);
  font-size: 18px;
  line-height: 1.15;
}

.coin-panel-head span {
  color: var(--c-text-faint);
  font-size: 12px;
}

.coin-streak-tag.el-tag {
  flex: 0 0 auto;
  border-color: rgba(217, 119, 6, 0.16);
  background: #fff7e6;
  color: #9a5f08;
  font-weight: 700;
}

.coin-checkin-btn.el-button {
  width: 100%;
  min-height: 38px;
  border-color: #8fa8f6;
  border-radius: 9px;
  background: #8fa8f6;
  font-weight: 700;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.coin-checkin-btn.el-button:hover:not(.is-disabled),
.coin-checkin-btn.el-button:focus-visible:not(.is-disabled) {
  border-color: #7895ef;
  background: #7895ef;
  box-shadow: 0 10px 22px rgba(79, 112, 211, 0.16);
  transform: translateY(-1px);
}

.effect-shop {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  max-height: 380px;
  overflow-y: auto;
  padding-right: 2px;
  scrollbar-gutter: stable;
}

.effect-tier-head {
  --tier-tone: #94a3b8;
  grid-column: 1 / -1;
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 6px;
  padding: 6px 2px 5px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.9);
}

.effect-tier-head:first-child {
  margin-top: 0;
}

.effect-tier-head strong {
  color: var(--c-text);
  font-size: 13px;
}

.effect-tier-head small {
  margin-left: auto;
  color: var(--c-text-faint);
  font-size: 10px;
}

.effect-shop-item {
  --effect-tone: #64748b;
  position: relative;
  isolation: isolate;
  min-width: 0;
  min-height: 70px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 8px;
  background: #fbfdff;
  color: var(--c-text);
  cursor: pointer;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 10px;
  text-align: left;
  overflow: hidden;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease,
    background 0.18s ease;
}

.effect-shop-item::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: color-mix(in srgb, var(--effect-tone) 7%, transparent);
  opacity: 0;
  transition: opacity 0.18s ease;
}

.effect-shop-item:hover,
.effect-shop-item:focus-visible {
  border-color: color-mix(in srgb, var(--effect-tone) 34%, #cbd5e1);
  background: #fff;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
  outline: none;
  transform: translateY(-2px);
}

.effect-shop-item:hover::before,
.effect-shop-item:focus-visible::before {
  opacity: 1;
}

.effect-shop-item:disabled {
  cursor: not-allowed;
  opacity: 0.48;
  transform: none;
  box-shadow: none;
}

.effect-shop-icon {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--effect-tone) 9%, #fff);
  color: var(--effect-tone);
  display: grid;
  place-items: center;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--effect-tone) 14%, transparent);
  overflow: hidden;
  transition:
    background 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.effect-shop-icon svg {
  position: relative;
  z-index: 1;
}

.effect-shop-item:hover .effect-shop-icon,
.effect-shop-item:focus-visible .effect-shop-icon {
  background: color-mix(in srgb, var(--effect-tone) 14%, #fff);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--effect-tone) 24%, transparent);
  transform: translateY(-1px);
}

.effect-shop-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.effect-shop-copy strong {
  max-width: 100%;
  color: var(--c-text);
  font-size: 13px;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.effect-shop-copy em {
  display: inline-flex;
  align-items: center;
  height: 15px;
  margin-left: 4px;
  border: 1px solid color-mix(in srgb, var(--effect-tone) 22%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--effect-tone) 8%, transparent);
  color: color-mix(in srgb, var(--effect-tone) 66%, var(--c-text));
  font-size: 8.5px;
  font-style: normal;
  font-weight: 800;
  letter-spacing: 0.1em;
  padding: 0 4px 0 6px;
  vertical-align: 1px;
}

.effect-shop-copy small {
  color: var(--c-text-faint);
  font-size: 10.5px;
  line-height: 1.2;
}

:root[data-theme='dark'] .topbar-coin-btn.el-button {
  border-color: rgba(251, 191, 36, 0.22);
  background: rgba(251, 191, 36, 0.1);
  color: #facc15;
}

:root[data-theme='dark'] .topbar-coin-btn.el-button:hover,
:root[data-theme='dark'] .topbar-coin-btn.el-button:focus-visible {
  border-color: rgba(251, 191, 36, 0.34);
  background: rgba(251, 191, 36, 0.15);
  color: #fde68a;
}

:root[data-theme='dark'] .coin-popover.el-popper {
  border-color: rgba(51, 65, 85, 0.96);
  background: rgba(15, 23, 42, 0.98);
  box-shadow: 0 20px 46px rgba(0, 0, 0, 0.32);
}

:root[data-theme='dark'] .coin-popover.el-popper .el-popper__arrow::before {
  border-color: rgba(51, 65, 85, 0.96);
  background: #0f172a;
}

:root[data-theme='dark'] .coin-streak-tag.el-tag {
  border-color: rgba(251, 191, 36, 0.22);
  background: rgba(251, 191, 36, 0.1);
  color: #fde68a;
}

:root[data-theme='dark'] .effect-tier-head {
  border-bottom-color: rgba(51, 65, 85, 0.9);
}

:root[data-theme='dark'] .effect-shop-item {
  border-color: color-mix(in srgb, var(--effect-tone) 18%, rgba(51, 65, 85, 0.9));
  background: color-mix(in srgb, var(--effect-tone) 7%, var(--c-surface-muted));
}

:root[data-theme='dark'] .effect-shop-item:hover,
:root[data-theme='dark'] .effect-shop-item:focus-visible {
  border-color: color-mix(in srgb, var(--effect-tone) 30%, rgba(71, 85, 105, 1));
  background: color-mix(in srgb, var(--effect-tone) 11%, var(--c-surface));
  box-shadow: 0 14px 26px rgba(0, 0, 0, 0.22);
}

:root[data-theme='dark'] .effect-shop-icon {
  background: color-mix(in srgb, var(--effect-tone) 12%, var(--c-surface-inset));
}

@media (max-width: 720px) {
  .topbar-coin-btn.el-button small {
    display: none;
  }

  .topbar-coin-btn.el-button {
    padding-inline: 10px;
  }
}
</style>
