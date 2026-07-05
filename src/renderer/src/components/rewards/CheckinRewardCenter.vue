<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { Coins, Gift } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import RewardEffectOverlay from '@/components/rewards/RewardEffectOverlay.vue';
import {
  EFFECT_DURATIONS,
  EFFECT_OPTION_MAP,
  groupEffectsByTier,
} from '@/components/rewards/rewardEffects';
import type { RewardEffectKey } from '@/components/rewards/rewardEffects';

type CheckinWallet = {
  coins: number;
  lastCheckinDate: string;
  streak: number;
};

const CHECKIN_STORAGE_KEY = 'gitinsight:checkin-wallet';
const DAILY_CHECKIN_REWARD_MIN = 1888;
const DAILY_CHECKIN_REWARD_MAX = 8888;
/** 能量注入充能动画时长：与舞台 entry 开幕并行，不阻塞特效启动 */
const CHARGE_MS = 720;

const effectTierGroups = groupEffectsByTier();

const wallet = ref<CheckinWallet>(loadWallet());
const activeEffect = ref<RewardEffectKey | null>(null);
const effectSeed = ref(0);
const chargingKey = ref<RewardEffectKey | null>(null);
let effectTimer: number | null = null;
let effectFrame: number | null = null;
let chargeTimer: number | null = null;

const todayKey = computed(() => getLocalDateKey(new Date()));
const checkedInToday = computed(() => wallet.value.lastCheckinDate === todayKey.value);
const checkinButtonText = computed(() =>
  checkedInToday.value ? '今日已签' : `签到随机 +${DAILY_CHECKIN_REWARD_MIN}-${DAILY_CHECKIN_REWARD_MAX}`
);
const walletStatusText = computed(() => (checkedInToday.value ? '今日已签到' : '今日待签到'));

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDateKey(dateKey: string, dayOffset: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return '';
  return getLocalDateKey(new Date(year, month - 1, day + dayOffset));
}

function getDailyCheckinReward() {
  return Math.floor(Math.random() * (DAILY_CHECKIN_REWARD_MAX - DAILY_CHECKIN_REWARD_MIN + 1)) + DAILY_CHECKIN_REWARD_MIN;
}

function normalizeWallet(value: unknown): CheckinWallet {
  if (!value || typeof value !== 'object') {
    return { coins: 0, lastCheckinDate: '', streak: 0 };
  }

  const source = value as Partial<CheckinWallet>;
  return {
    coins: Number.isFinite(source.coins) ? Math.max(0, Math.floor(Number(source.coins))) : 0,
    lastCheckinDate: typeof source.lastCheckinDate === 'string' ? source.lastCheckinDate : '',
    streak: Number.isFinite(source.streak) ? Math.max(0, Math.floor(Number(source.streak))) : 0,
  };
}

function loadWallet() {
  try {
    const stored = window.localStorage.getItem(CHECKIN_STORAGE_KEY);
    return normalizeWallet(stored ? JSON.parse(stored) : null);
  } catch {
    return { coins: 0, lastCheckinDate: '', streak: 0 };
  }
}

function persistWallet() {
  try {
    window.localStorage.setItem(CHECKIN_STORAGE_KEY, JSON.stringify(wallet.value));
  } catch {
    ElMessage.warning('甲币状态暂时无法保存');
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

/** 消耗甲币 = 能量注入：卡片充能微动效与舞台开幕并行播放 */
function chargeCard(effect: RewardEffectKey) {
  if (chargeTimer) {
    window.clearTimeout(chargeTimer);
  }
  chargingKey.value = effect;
  chargeTimer = window.setTimeout(() => {
    chargingKey.value = null;
    chargeTimer = null;
  }, CHARGE_MS);
}

function runDailyCheckin() {
  if (checkedInToday.value) {
    ElMessage.info('今天已经签到过了');
    return;
  }

  const yesterdayKey = shiftDateKey(todayKey.value, -1);
  const nextStreak = wallet.value.lastCheckinDate === yesterdayKey ? wallet.value.streak + 1 : 1;
  const rewardCoins = getDailyCheckinReward();
  wallet.value = {
    coins: wallet.value.coins + rewardCoins,
    lastCheckinDate: todayKey.value,
    streak: nextStreak,
  };
  persistWallet();
  startEffect('sparkle');
  ElMessage.success(`签到成功，获得 ${rewardCoins} 甲币`);
}

function playEffect(effect: RewardEffectKey) {
  const option = EFFECT_OPTION_MAP[effect];
  if (!option) return;

  if (wallet.value.coins < option.cost) {
    ElMessage.warning(`甲币不足，还差 ${option.cost - wallet.value.coins}`);
    return;
  }

  wallet.value = {
    ...wallet.value,
    coins: wallet.value.coins - option.cost,
  };
  persistWallet();
  chargeCard(effect);
  startEffect(effect);
  ElMessage.success(`已注入 ${option.cost} 甲币，「${option.label}」协议启动`);
}

onBeforeUnmount(() => {
  stopEffect();
  if (chargeTimer) {
    window.clearTimeout(chargeTimer);
  }
});
</script>

<template>
  <el-popover placement="bottom-end" trigger="click" :width="410" popper-class="coin-popover">
    <template #reference>
      <el-button class="topbar-coin-btn" :icon="Coins" aria-label="甲币签到">
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
        :disabled="checkedInToday"
        @click="runDailyCheckin"
      >
        {{ checkinButtonText }}
      </el-button>

      <div class="effect-shop">
        <template v-for="group in effectTierGroups" :key="group.meta.key">
          <div class="effect-tier-head" :class="`tier-${group.meta.key}`">
            <strong>{{ group.meta.label }}</strong>
            <span>{{ group.meta.codename }}</span>
            <small>{{ group.meta.costRange[0] }}-{{ group.meta.costRange[1] }} 甲币 · {{ group.options.length }} 项</small>
          </div>
          <button
            v-for="effect in group.options"
            :key="effect.key"
            class="effect-shop-item"
            :class="[
              `tier-${effect.tier}`,
              { 'is-apex': effect.apex, 'is-charging': chargingKey === effect.key },
            ]"
            type="button"
            :disabled="wallet.coins < effect.cost"
            :style="{ '--effect-tone': effect.tone }"
            :title="`${effect.codename} — ${effect.narrative}`"
            @click="playEffect(effect.key)"
          >
            <i v-if="effect.tier === 'singularity'" class="effect-card-halo" aria-hidden="true" />
            <span class="effect-shop-icon">
              <component :is="effect.icon" :size="18" />
            </span>
            <span class="effect-shop-copy">
              <strong>
                {{ effect.label }}
                <em v-if="effect.apex">APEX</em>
              </strong>
              <small class="effect-shop-codename">{{ effect.codename }}</small>
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
  border-color: rgba(217, 138, 9, 0.28);
  border-radius: 9px;
  background:
    linear-gradient(115deg, transparent 0 34%, rgba(255, 255, 255, 0.78) 45%, transparent 56%),
    linear-gradient(180deg, #fff8e8 0%, #ffffff 100%);
  background-size: 230% 100%, 100% 100%;
  color: #9a5f08;
  font-weight: 700;
  padding-inline: 12px;
  transition: background-position 0.38s ease, border-color 0.16s ease, color 0.16s ease;
}

.topbar-coin-btn.el-button:hover,
.topbar-coin-btn.el-button:focus-visible {
  border-color: rgba(217, 138, 9, 0.52);
  background-position: 100% 0, 0 0;
  color: #8a5100;
}

.topbar-coin-btn.el-button span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.topbar-coin-btn.el-button small {
  color: var(--tone-amber);
  font-size: 11px;
  font-weight: 700;
}

/* 甲币数额变动时的能量脉冲 */
.coin-amount {
  animation: coin-pop 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.coin-popover.el-popper {
  border: 1px solid var(--c-border);
  border-radius: 10px;
  background:
    radial-gradient(circle at 100% 0, rgba(250, 204, 21, 0.08), transparent 34%),
    radial-gradient(circle at 0 100%, rgba(59, 130, 246, 0.08), transparent 32%),
    var(--c-surface);
  box-shadow:
    0 24px 58px rgba(17, 24, 39, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.68);
  overflow: hidden;
}

.coin-popover.el-popper .el-popper__arrow::before {
  border-color: var(--c-border);
  background: var(--c-surface);
}

.coin-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px;
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
  font-size: 19px;
  line-height: 1.15;
}

.coin-panel-head span {
  color: var(--c-text-faint);
  font-size: 12px;
}

.coin-streak-tag.el-tag {
  flex: 0 0 auto;
  font-weight: 700;
}

.coin-checkin-btn.el-button {
  width: 100%;
  min-height: 38px;
  border-radius: 8px;
  font-weight: 700;
}

.effect-shop {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
  max-height: 380px;
  overflow-y: auto;
  padding-right: 2px;
  scrollbar-gutter: stable;
  mask-image: linear-gradient(180deg, transparent 0, #000 10px calc(100% - 18px), transparent 100%);
}

/* ── 分级区头 ── */
.effect-tier-head {
  --tier-tone: var(--tone-amber);
  grid-column: 1 / -1;
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 4px;
  padding: 5px 2px 4px;
  border-bottom: 1px solid color-mix(in srgb, var(--tier-tone) 32%, transparent);
}

.effect-tier-head:first-child {
  margin-top: 0;
}

.effect-tier-head strong {
  color: color-mix(in srgb, var(--tier-tone) 72%, var(--c-text));
  font-size: 13px;
}

.effect-tier-head span {
  color: color-mix(in srgb, var(--tier-tone) 62%, var(--c-text-faint));
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.22em;
}

.effect-tier-head small {
  margin-left: auto;
  color: var(--c-text-faint);
  font-size: 10px;
}

.effect-tier-head.tier-singularity {
  --tier-tone: #a855f7;
}

.effect-tier-head.tier-tactical {
  --tier-tone: #0ea5e9;
}

.effect-tier-head.tier-signal {
  --tier-tone: #f59e0b;
}

/* ── 特效卡片（信标级基线） ── */
.effect-shop-item {
  --effect-tone: var(--tone-amber);
  position: relative;
  isolation: isolate;
  min-width: 0;
  min-height: 72px;
  border: 1px solid var(--c-border);
  border-radius: 8px;
  background:
    radial-gradient(circle at 100% 0, color-mix(in srgb, var(--effect-tone) 16%, transparent), transparent 38%),
    var(--c-surface-muted);
  color: var(--c-text);
  cursor: pointer;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 10px;
  text-align: left;
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s, background 0.15s;
}

.effect-shop-item::before {
  content: '';
  position: absolute;
  inset: -1px;
  z-index: -1;
  background:
    linear-gradient(115deg, transparent 0 36%, rgba(255, 255, 255, 0.42) 46%, transparent 56%),
    radial-gradient(circle at 12% 18%, color-mix(in srgb, var(--effect-tone) 24%, transparent), transparent 34%);
  opacity: 0;
  transform: translateX(-42%);
  transition: opacity 0.18s ease, transform 0.42s ease;
}

.effect-shop-item::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    linear-gradient(90deg, transparent, color-mix(in srgb, var(--effect-tone) 30%, transparent), transparent),
    linear-gradient(180deg, rgba(255, 255, 255, 0.2), transparent 38%);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}

.effect-shop-item:hover,
.effect-shop-item:focus-visible {
  border-color: color-mix(in srgb, var(--effect-tone) 56%, var(--c-primary));
  background:
    radial-gradient(circle at 100% 0, color-mix(in srgb, var(--effect-tone) 24%, transparent), transparent 42%),
    var(--c-primary-soft);
  box-shadow: 0 12px 22px rgba(17, 24, 39, 0.1);
  outline: none;
  transform: translateY(-1px);
}

.effect-shop-item:hover::before,
.effect-shop-item:focus-visible::before {
  opacity: 1;
  transform: translateX(36%);
}

.effect-shop-item:hover::after,
.effect-shop-item:focus-visible::after {
  opacity: 1;
}

/* ── 战术级：强调色描边 + 扫描氛围 ── */
.effect-shop-item.tier-tactical {
  border-color: color-mix(in srgb, var(--effect-tone) 34%, var(--c-border));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--effect-tone) 14%, transparent), transparent 46%),
    radial-gradient(circle at 100% 0, color-mix(in srgb, var(--effect-tone) 22%, transparent), transparent 42%),
    var(--c-surface-muted);
}

.effect-shop-item.tier-tactical .effect-shop-icon {
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--effect-tone) 34%, transparent),
    0 8px 18px color-mix(in srgb, var(--effect-tone) 20%, transparent);
}

/* ── 奇点级：深空底 + 旋转能量描边 + 辉光图标 ── */
.effect-shop-item.tier-singularity {
  border-color: color-mix(in srgb, var(--effect-tone) 46%, var(--c-border));
  background:
    radial-gradient(circle at 82% 12%, color-mix(in srgb, var(--effect-tone) 30%, transparent), transparent 40%),
    radial-gradient(circle at 14% 86%, color-mix(in srgb, var(--effect-tone) 14%, transparent), transparent 36%),
    linear-gradient(160deg, rgba(10, 14, 30, 0.92), rgba(15, 23, 42, 0.86));
  color: #e2e8f0;
}

.effect-shop-item.tier-singularity .effect-shop-copy strong {
  color: #f1f5f9;
}

.effect-shop-item.tier-singularity .effect-shop-copy small {
  color: rgba(226, 232, 240, 0.62);
}

.effect-shop-item.tier-singularity .effect-shop-icon {
  background: color-mix(in srgb, var(--effect-tone) 22%, rgba(2, 6, 23, 0.7));
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--effect-tone) 44%, transparent),
    0 10px 22px color-mix(in srgb, var(--effect-tone) 26%, transparent),
    0 0 26px color-mix(in srgb, var(--effect-tone) 22%, transparent);
}

.effect-card-halo {
  position: absolute;
  inset: -1px;
  z-index: -2;
  border-radius: inherit;
  background: conic-gradient(
    from 0deg,
    transparent 0 12%,
    color-mix(in srgb, var(--effect-tone) 66%, #fff) 22%,
    transparent 34% 58%,
    color-mix(in srgb, var(--effect-tone) 44%, transparent) 70%,
    transparent 82%
  );
  opacity: 0.5;
  animation: effect-halo-spin 3.4s linear infinite;
}

.effect-shop-item.tier-singularity:hover .effect-card-halo,
.effect-shop-item.tier-singularity:focus-visible .effect-card-halo {
  opacity: 0.9;
}

.effect-shop-item.is-apex {
  box-shadow: 0 0 22px color-mix(in srgb, var(--effect-tone) 18%, transparent);
}

/* ── 能量注入：点击消耗甲币的充能反馈 ── */
.effect-shop-item.is-charging {
  border-color: color-mix(in srgb, var(--effect-tone) 78%, #fff);
  transform: translateY(-1px) scale(1.015);
}

.effect-shop-item.is-charging::after {
  opacity: 1;
  animation: effect-charge-sweep 0.72s cubic-bezier(0.22, 1, 0.36, 1);
}

.effect-shop-item.is-charging .effect-shop-icon {
  animation: effect-charge-icon 0.72s ease;
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
  background: color-mix(in srgb, var(--effect-tone) 14%, #fff);
  color: var(--effect-tone);
  display: grid;
  place-items: center;
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--effect-tone) 22%, transparent),
    0 8px 18px color-mix(in srgb, var(--effect-tone) 16%, transparent);
  overflow: hidden;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.effect-shop-icon::before {
  content: '';
  position: absolute;
  inset: -45%;
  background: conic-gradient(from 0deg, transparent, color-mix(in srgb, var(--effect-tone) 46%, transparent), transparent 42%);
  opacity: 0;
  animation: effect-icon-orbit 1.8s linear infinite;
  transition: opacity 0.18s ease;
}

.effect-shop-icon svg {
  position: relative;
  z-index: 1;
}

.effect-shop-item:hover .effect-shop-icon,
.effect-shop-item:focus-visible .effect-shop-icon {
  transform: translateY(-1px) scale(1.05);
}

.effect-shop-item:hover .effect-shop-icon::before,
.effect-shop-item:focus-visible .effect-shop-icon::before {
  opacity: 1;
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
  border: 1px solid color-mix(in srgb, var(--effect-tone) 52%, transparent);
  border-radius: 3px;
  background: color-mix(in srgb, var(--effect-tone) 16%, transparent);
  color: color-mix(in srgb, var(--effect-tone) 82%, #fff);
  font-size: 8.5px;
  font-style: normal;
  font-weight: 800;
  letter-spacing: 0.22em;
  padding: 0 4px 0 6px;
  vertical-align: 1px;
}

.effect-shop-codename {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: color-mix(in srgb, var(--effect-tone) 58%, var(--c-text-faint));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.effect-shop-copy small {
  color: var(--c-text-faint);
  font-size: 10.5px;
  line-height: 1.2;
}

:root[data-theme='dark'] .topbar-coin-btn.el-button {
  border-color: rgba(251, 191, 36, 0.28);
  background:
    linear-gradient(115deg, transparent 0 34%, rgba(255, 255, 255, 0.16) 45%, transparent 56%),
    rgba(251, 191, 36, 0.12);
  color: #fbbf24;
}

:root[data-theme='dark'] .topbar-coin-btn.el-button:hover,
:root[data-theme='dark'] .topbar-coin-btn.el-button:focus-visible {
  border-color: rgba(251, 191, 36, 0.48);
  color: #fde68a;
}

:root[data-theme='dark'] .effect-shop-icon {
  background: color-mix(in srgb, var(--effect-tone) 16%, var(--c-surface-inset));
}

:root[data-theme='dark'] .effect-shop-item.tier-singularity {
  background:
    radial-gradient(circle at 82% 12%, color-mix(in srgb, var(--effect-tone) 26%, transparent), transparent 40%),
    radial-gradient(circle at 14% 86%, color-mix(in srgb, var(--effect-tone) 12%, transparent), transparent 36%),
    linear-gradient(160deg, rgba(5, 8, 20, 0.96), rgba(10, 16, 32, 0.9));
}

@keyframes effect-icon-orbit {
  to {
    transform: rotate(360deg);
  }
}

@keyframes effect-halo-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes effect-charge-sweep {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

@keyframes effect-charge-icon {
  0% {
    transform: scale(1);
  }
  32% {
    transform: scale(1.18);
    box-shadow: 0 0 26px color-mix(in srgb, var(--effect-tone) 56%, transparent);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes coin-pop {
  0% {
    transform: scale(1);
  }
  36% {
    transform: scale(1.14);
  }
  100% {
    transform: scale(1);
  }
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
