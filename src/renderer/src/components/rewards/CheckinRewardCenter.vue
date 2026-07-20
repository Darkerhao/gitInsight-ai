<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Coins, Gift, Search, Sparkles, Zap } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import RewardEffectOverlay from '@/components/rewards/RewardEffectOverlay.vue';
import {
  EFFECT_DURATIONS,
  EFFECT_OPTION_MAP,
  EFFECT_OPTIONS,
  EFFECT_TIERS,
  groupEffectsByTier,
} from '@/components/rewards/rewardEffects';
import type { EffectTierKey, RewardEffectKey, RewardEffectOption } from '@/components/rewards/rewardEffects';
import type { CheckinWallet, CheckinWalletImportPayload, CheckinWalletSnapshot } from '@shared/types';

const CHECKIN_STORAGE_KEY = 'gitinsight:checkin-wallet';
const DAILY_CHECKIN_REWARD_MIN = 88888;
const DAILY_CHECKIN_REWARD_MAX = 888888;

const effectTierGroups = groupEffectsByTier();
type EffectTierFilter = 'all' | EffectTierKey;

const wallet = ref<CheckinWallet>({ coins: 0, lastCheckinDate: '', streak: 0, updatedAt: '' });
const todayKey = ref('');
const walletLoading = ref(false);
const checkinLoading = ref(false);
const coinPanelVisible = ref(false);
const spendingEffect = ref<RewardEffectKey | null>(null);
const activeEffect = ref<RewardEffectKey | null>(null);
const effectSeed = ref(0);
const effectQuery = ref('');
const activeTier = ref<EffectTierFilter>('all');
const inspectedEffectKey = ref<RewardEffectKey>(effectTierGroups[0]?.options[0]?.key ?? 'fireworks');
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
const tierFilters = computed(() => [
  { key: 'all' as const, label: '全部协议', count: EFFECT_OPTIONS.length },
  ...effectTierGroups.map((group) => ({
    key: group.meta.key,
    label: group.meta.label,
    count: group.options.length,
  })),
]);
const filteredEffectTierGroups = computed(() => {
  const query = effectQuery.value.trim().toLocaleLowerCase();
  return effectTierGroups
    .filter((group) => activeTier.value === 'all' || group.meta.key === activeTier.value)
    .map((group) => ({
      ...group,
      options: group.options.filter((effect) => {
        if (!query) return true;
        return [effect.label, effect.codename, effect.narrative]
          .some((value) => value.toLocaleLowerCase().includes(query));
      }),
    }))
    .filter((group) => group.options.length > 0);
});
const matchingEffectCount = computed(() =>
  filteredEffectTierGroups.value.reduce((total, group) => total + group.options.length, 0)
);
const inspectedEffect = computed<RewardEffectOption>(() =>
  EFFECT_OPTION_MAP[inspectedEffectKey.value] ?? EFFECT_OPTIONS[0]
);
const inspectedTierMeta = computed(() => EFFECT_TIERS[inspectedEffect.value.tier]);
const inspectedDuration = computed(() => {
  const { entry, loop, exit } = inspectedEffect.value.phases;
  return ((entry + loop + exit) / 1000).toFixed(1);
});
const canRunInspectedEffect = computed(() =>
  !walletLoading.value
  && !spendingEffect.value
  && wallet.value.coins >= inspectedEffect.value.cost
);

function inspectEffect(effect: RewardEffectOption) {
  inspectedEffectKey.value = effect.key;
}

function selectTier(tier: EffectTierFilter) {
  activeTier.value = tier;
  const firstMatch = filteredEffectTierGroups.value[0]?.options[0];
  if (firstMatch) inspectEffect(firstMatch);
}

function runInspectedEffect() {
  void playEffect(inspectedEffect.value.key);
}

watch(effectQuery, () => {
  const firstMatch = filteredEffectTierGroups.value[0]?.options[0];
  if (firstMatch) inspectEffect(firstMatch);
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
  coinPanelVisible.value = false;

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
  <el-popover
    v-model:visible="coinPanelVisible"
    placement="bottom-end"
    trigger="click"
    :width="540"
    popper-class="coin-popover"
  >
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
          <span>{{ walletStatusText }} · NEXUS 视觉协议库</span>
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

      <section
        class="effect-inspector"
        :class="[`tier-${inspectedEffect.tier}`, { 'is-apex': inspectedEffect.apex }]"
        :style="{ '--effect-tone': inspectedEffect.tone }"
      >
        <div class="effect-inspector-orb" aria-hidden="true">
          <span class="effect-inspector-orbit is-outer" />
          <span class="effect-inspector-orbit is-inner" />
          <component :is="inspectedEffect.icon" :size="24" />
        </div>
        <div class="effect-inspector-copy">
          <div class="effect-inspector-kicker">
            <span>{{ inspectedTierMeta.codename }} CLASS</span>
            <em v-if="inspectedEffect.apex">APEX</em>
          </div>
          <strong>{{ inspectedEffect.label }}</strong>
          <code>{{ inspectedEffect.codename }}</code>
          <p>{{ inspectedEffect.narrative }}</p>
        </div>
        <div class="effect-inspector-stats">
          <span><b>{{ inspectedEffect.cost }}</b> 甲币</span>
          <span><b>{{ inspectedDuration }}</b> 秒</span>
          <span><b>{{ inspectedTierMeta.grade }}</b> 级压制</span>
        </div>
        <el-button
          class="effect-launch-btn"
          type="primary"
          :icon="Zap"
          :loading="spendingEffect === inspectedEffect.key"
          :disabled="!canRunInspectedEffect"
          @click="runInspectedEffect"
        >
          {{ wallet.coins < inspectedEffect.cost ? `还差 ${inspectedEffect.cost - wallet.coins} 甲币` : '启动视觉协议' }}
        </el-button>
      </section>

      <div class="effect-shop-toolbar">
        <label class="effect-search">
          <Search :size="15" aria-hidden="true" />
          <input
            v-model="effectQuery"
            type="search"
            aria-label="搜索视觉协议"
            placeholder="搜索名称、代号或事件叙事"
          />
          <span>{{ matchingEffectCount }}</span>
        </label>
        <div class="effect-tier-filters" aria-label="特效等级筛选">
          <button
            v-for="filter in tierFilters"
            :key="filter.key"
            type="button"
            :class="{ 'is-active': activeTier === filter.key }"
            @click="selectTier(filter.key)"
          >
            {{ filter.label }} <small>{{ filter.count }}</small>
          </button>
        </div>
      </div>

      <div class="effect-shop">
        <template v-for="group in filteredEffectTierGroups" :key="group.meta.key">
          <div class="effect-tier-head" :class="`tier-${group.meta.key}`">
            <div>
              <strong>{{ group.meta.label }}</strong>
              <span>{{ group.meta.codename }}</span>
            </div>
            <small>{{ group.meta.costRange[0] }}-{{ group.meta.costRange[1] }} 甲币 · {{ group.options.length }} 项</small>
          </div>
          <button
            v-for="effect in group.options"
            :key="effect.key"
            class="effect-shop-item"
            :class="[
              `tier-${effect.tier}`,
              {
                'is-apex': effect.apex,
                'is-selected': inspectedEffect.key === effect.key,
                'is-unaffordable': wallet.coins < effect.cost,
              },
            ]"
            type="button"
            :disabled="walletLoading || Boolean(spendingEffect)"
            :style="{ '--effect-tone': effect.tone }"
            :title="`${effect.codename} - ${effect.narrative}`"
            :aria-pressed="inspectedEffect.key === effect.key"
            @click="inspectEffect(effect)"
          >
            <span class="effect-shop-icon">
              <component :is="effect.icon" :size="18" />
            </span>
            <span class="effect-shop-copy">
              <strong>
                {{ effect.label }}
                <em v-if="effect.apex">APEX</em>
              </strong>
              <code>{{ effect.codename }}</code>
              <small>
                <span>{{ effect.cost }} 甲币</span>
                <span v-if="wallet.coins < effect.cost">余额不足</span>
              </small>
            </span>
          </button>
        </template>
        <div v-if="matchingEffectCount === 0" class="effect-empty">
          <Sparkles :size="24" />
          <strong>未检索到视觉协议</strong>
          <span>尝试输入中文名、英文代号或切换等级。</span>
        </div>
      </div>
    </div>
  </el-popover>

  <RewardEffectOverlay :effect="activeEffect" :seed="effectSeed" @close="stopEffect" />
</template>

<style lang="scss">
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

/* ── NEXUS Protocol Console · 四期协议库 ── */
.coin-popover.el-popper {
  max-width: calc(100vw - 24px);
}

.coin-panel {
  max-height: min(760px, calc(100vh - 96px));
  gap: 12px;
}

.effect-inspector {
  --effect-tone: #60a5fa;
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr) auto;
  grid-template-areas:
    'orb copy stats'
    'orb copy action';
  align-items: center;
  gap: 8px 14px;
  min-height: 132px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--effect-tone) 30%, rgba(203, 213, 225, 0.82));
  border-radius: 14px;
  background:
    radial-gradient(circle at 9% 50%, color-mix(in srgb, var(--effect-tone) 22%, transparent), transparent 30%),
    linear-gradient(135deg, color-mix(in srgb, var(--effect-tone) 8%, #fff), rgba(248, 250, 252, 0.96));
  padding: 14px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.8),
    0 14px 30px color-mix(in srgb, var(--effect-tone) 10%, transparent);
}

.effect-inspector::before,
.effect-inspector::after {
  content: '';
  position: absolute;
  pointer-events: none;
}

.effect-inspector::before {
  inset: 0;
  z-index: -1;
  background:
    linear-gradient(90deg, transparent 0 49.8%, color-mix(in srgb, var(--effect-tone) 10%, transparent) 50%, transparent 50.2%),
    linear-gradient(transparent 0 49.8%, color-mix(in srgb, var(--effect-tone) 8%, transparent) 50%, transparent 50.2%);
  background-size: 34px 34px;
  mask-image: linear-gradient(90deg, #000, transparent 72%);
}

.effect-inspector::after {
  top: -60%;
  bottom: -60%;
  width: 34%;
  left: -42%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.78), transparent);
  transform: skewX(-18deg);
  animation: protocol-inspector-scan 5.6s ease-in-out infinite;
}

.effect-inspector.is-apex {
  border-color: color-mix(in srgb, var(--effect-tone) 52%, #fbbf24);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.88),
    0 16px 34px color-mix(in srgb, var(--effect-tone) 17%, transparent),
    0 0 0 1px color-mix(in srgb, #fbbf24 14%, transparent);
}

.effect-inspector-orb {
  grid-area: orb;
  position: relative;
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--effect-tone);
  background:
    radial-gradient(circle, color-mix(in srgb, var(--effect-tone) 24%, #fff) 0 18%, transparent 19%),
    radial-gradient(circle, color-mix(in srgb, var(--effect-tone) 18%, transparent), transparent 66%);
  filter: drop-shadow(0 0 12px color-mix(in srgb, var(--effect-tone) 34%, transparent));
}

.effect-inspector-orb > svg {
  position: relative;
  z-index: 2;
  filter: drop-shadow(0 0 8px color-mix(in srgb, var(--effect-tone) 50%, transparent));
}

.effect-inspector-orbit {
  position: absolute;
  inset: 4px;
  border: 1px solid color-mix(in srgb, var(--effect-tone) 42%, transparent);
  border-radius: 50%;
  border-left-color: transparent;
  animation: protocol-orbit 6s linear infinite;
}

.effect-inspector-orbit.is-inner {
  inset: 12px;
  border-color: color-mix(in srgb, var(--effect-tone) 30%, transparent);
  border-right-color: transparent;
  animation-duration: 3.8s;
  animation-direction: reverse;
}

.effect-inspector-copy {
  grid-area: copy;
  min-width: 0;
  display: grid;
  align-content: center;
  gap: 3px;
}

.effect-inspector-kicker {
  display: flex;
  align-items: center;
  gap: 7px;
  color: color-mix(in srgb, var(--effect-tone) 70%, var(--c-text));
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.16em;
}

.effect-inspector-kicker em {
  border: 1px solid color-mix(in srgb, #f59e0b 36%, transparent);
  border-radius: 999px;
  background: rgba(245, 158, 11, 0.1);
  color: #b45309;
  font-size: 8px;
  font-style: normal;
  letter-spacing: 0.13em;
  padding: 2px 5px 2px 6px;
}

.effect-inspector-copy > strong {
  color: var(--c-text);
  font-size: 18px;
  line-height: 1.15;
}

.effect-inspector-copy > code {
  overflow: hidden;
  color: var(--effect-tone);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.effect-inspector-copy > p {
  display: -webkit-box;
  overflow: hidden;
  margin: 3px 0 0;
  color: var(--c-text-faint);
  font-size: 11px;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.effect-inspector-stats {
  grid-area: stats;
  display: flex;
  justify-content: flex-end;
  gap: 5px;
  align-self: end;
}

.effect-inspector-stats span {
  border: 1px solid color-mix(in srgb, var(--effect-tone) 16%, rgba(203, 213, 225, 0.8));
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.62);
  color: var(--c-text-faint);
  font-size: 9px;
  white-space: nowrap;
  padding: 4px 6px;
}

.effect-inspector-stats b {
  color: color-mix(in srgb, var(--effect-tone) 72%, var(--c-text));
  font-size: 10px;
}

.effect-launch-btn.el-button {
  grid-area: action;
  justify-self: end;
  align-self: start;
  min-width: 132px;
  border-color: color-mix(in srgb, var(--effect-tone) 76%, #4f46e5);
  border-radius: 8px;
  background: linear-gradient(110deg, color-mix(in srgb, var(--effect-tone) 82%, #4f46e5), color-mix(in srgb, var(--effect-tone) 54%, #6366f1));
  box-shadow: 0 8px 18px color-mix(in srgb, var(--effect-tone) 22%, transparent);
  font-size: 11px;
  font-weight: 800;
}

.effect-shop-toolbar {
  display: grid;
  gap: 8px;
}

.effect-search {
  min-height: 34px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(203, 213, 225, 0.86);
  border-radius: 9px;
  background: rgba(248, 250, 252, 0.86);
  color: var(--c-text-faint);
  padding: 0 10px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.effect-search:focus-within {
  border-color: rgba(99, 102, 241, 0.46);
  background: #fff;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.09);
}

.effect-search input {
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--c-text);
  font: inherit;
  font-size: 12px;
}

.effect-search input::placeholder {
  color: var(--c-text-faint);
}

.effect-search > span {
  min-width: 22px;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.09);
  color: #6366f1;
  font-size: 9px;
  font-weight: 800;
  line-height: 20px;
  text-align: center;
}

.effect-tier-filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.effect-tier-filters button {
  min-width: 0;
  height: 28px;
  border: 1px solid rgba(203, 213, 225, 0.76);
  border-radius: 7px;
  background: #fff;
  color: var(--c-text-faint);
  cursor: pointer;
  font-size: 10px;
  font-weight: 700;
  transition: border-color 0.16s ease, background 0.16s ease, color 0.16s ease, transform 0.16s ease;
}

.effect-tier-filters button:hover,
.effect-tier-filters button:focus-visible {
  border-color: rgba(99, 102, 241, 0.36);
  color: #4f46e5;
  outline: none;
  transform: translateY(-1px);
}

.effect-tier-filters button.is-active {
  border-color: rgba(99, 102, 241, 0.28);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.13), rgba(59, 130, 246, 0.08));
  color: #4f46e5;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.56);
}

.effect-tier-filters small {
  opacity: 0.64;
  font-size: 8px;
}

.effect-shop {
  max-height: min(330px, calc(100vh - 470px));
  min-height: 170px;
  align-content: start;
  padding: 0 4px 8px 0;
}

.effect-tier-head {
  position: sticky;
  top: 0;
  z-index: 4;
  align-items: center;
  min-height: 35px;
  margin-top: 0;
  border-bottom: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 74%, rgba(255, 255, 255, 0.84));
  backdrop-filter: blur(10px);
}

.effect-tier-head > div {
  display: flex;
  align-items: baseline;
  gap: 7px;
}

.effect-tier-head span {
  color: var(--c-text-faint);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.effect-shop-item {
  min-height: 74px;
  grid-template-columns: 38px minmax(0, 1fr);
  border-radius: 10px;
  padding: 9px;
}

.effect-shop-item.is-selected {
  border-color: color-mix(in srgb, var(--effect-tone) 58%, #94a3b8);
  background: color-mix(in srgb, var(--effect-tone) 9%, #fff);
  box-shadow:
    0 10px 22px color-mix(in srgb, var(--effect-tone) 12%, transparent),
    inset 3px 0 0 var(--effect-tone);
  transform: translateY(-1px);
}

.effect-shop-item.is-unaffordable:not(.is-selected) {
  filter: saturate(0.62);
}

.effect-shop-item.is-unaffordable:not(.is-selected)::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 3;
  background: linear-gradient(120deg, transparent 55%, rgba(148, 163, 184, 0.08));
  pointer-events: none;
}

.effect-shop-copy {
  gap: 2px;
}

.effect-shop-copy > code {
  overflow: hidden;
  color: color-mix(in srgb, var(--effect-tone) 68%, var(--c-text-faint));
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.effect-shop-copy small {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 5px;
}

.effect-shop-copy small span:last-child:not(:first-child) {
  color: #b45309;
  font-size: 8px;
}

.effect-empty {
  grid-column: 1 / -1;
  min-height: 164px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 6px;
  color: #94a3b8;
  text-align: center;
}

.effect-empty strong {
  color: var(--c-text);
  font-size: 13px;
}

.effect-empty span {
  font-size: 11px;
}

.coin-amount {
  animation: coin-amount-pop 0.46s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes protocol-orbit {
  to { transform: rotate(360deg); }
}

@keyframes protocol-inspector-scan {
  0%, 18% { left: -42%; opacity: 0; }
  26% { opacity: 0.72; }
  54%, 100% { left: 112%; opacity: 0; }
}

@keyframes coin-amount-pop {
  0% { transform: translateY(3px) scale(0.92); opacity: 0.4; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
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

:root[data-theme='dark'] .effect-inspector {
  border-color: color-mix(in srgb, var(--effect-tone) 34%, rgba(51, 65, 85, 0.92));
  background:
    radial-gradient(circle at 9% 50%, color-mix(in srgb, var(--effect-tone) 26%, transparent), transparent 31%),
    linear-gradient(135deg, color-mix(in srgb, var(--effect-tone) 9%, #0f172a), rgba(2, 6, 23, 0.96));
  box-shadow: 0 18px 38px rgba(0, 0, 0, 0.3);
}

:root[data-theme='dark'] .effect-inspector-stats span {
  border-color: color-mix(in srgb, var(--effect-tone) 18%, rgba(71, 85, 105, 0.8));
  background: rgba(15, 23, 42, 0.7);
}

:root[data-theme='dark'] .effect-inspector-kicker em {
  color: #fbbf24;
}

:root[data-theme='dark'] .effect-search {
  border-color: rgba(71, 85, 105, 0.82);
  background: rgba(15, 23, 42, 0.72);
}

:root[data-theme='dark'] .effect-search:focus-within {
  border-color: rgba(129, 140, 248, 0.52);
  background: rgba(15, 23, 42, 0.94);
}

:root[data-theme='dark'] .effect-tier-filters button {
  border-color: rgba(71, 85, 105, 0.78);
  background: rgba(15, 23, 42, 0.7);
}

:root[data-theme='dark'] .effect-tier-filters button.is-active {
  border-color: rgba(129, 140, 248, 0.36);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.24), rgba(14, 165, 233, 0.1));
  color: #c7d2fe;
}

:root[data-theme='dark'] .effect-tier-head {
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.98) 74%, rgba(15, 23, 42, 0.86));
}

:root[data-theme='dark'] .effect-shop-item.is-selected {
  border-color: color-mix(in srgb, var(--effect-tone) 58%, #64748b);
  background: color-mix(in srgb, var(--effect-tone) 14%, #0f172a);
}

@media (max-width: 720px) {
  .topbar-coin-btn.el-button small {
    display: none;
  }

  .topbar-coin-btn.el-button {
    padding-inline: 10px;
  }

  .effect-inspector {
    grid-template-columns: 54px minmax(0, 1fr);
    grid-template-areas:
      'orb copy'
      'stats stats'
      'action action';
  }

  .effect-inspector-orb {
    width: 52px;
    height: 52px;
  }

  .effect-inspector-stats {
    justify-content: flex-start;
  }

  .effect-launch-btn.el-button {
    width: 100%;
    justify-self: stretch;
  }
}
</style>
