<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import {
  Activity,
  Atom,
  Bike,
  BrainCircuit,
  Building2,
  Cake,
  CircleDashed,
  CircuitBoard,
  Clock3,
  CloudRain,
  Code2,
  Coins,
  Cpu,
  Crown,
  DatabaseZap,
  Expand,
  Gauge,
  Gem,
  Gift,
  Layers,
  Orbit,
  PartyPopper,
  Plane,
  Radar,
  Rocket,
  ScanLine,
  Sparkles,
  Zap,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import RewardEffectOverlay from '@/components/rewards/RewardEffectOverlay.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { RewardEffectKey } from '@/components/rewards/rewardEffects';

type CheckinWallet = {
  coins: number;
  lastCheckinDate: string;
  streak: number;
};

const CHECKIN_STORAGE_KEY = 'gitinsight:checkin-wallet';
const DAILY_CHECKIN_REWARD_MIN = 188;
const DAILY_CHECKIN_REWARD_MAX = 1888;
const effectOptions = [
  { key: 'fireworks', label: '臻彩烟花', cost: 4, icon: PartyPopper, tone: '#f59e0b' },
  { key: 'birthday', label: '生日舞台', cost: 5, icon: Cake, tone: '#ec4899' },
  { key: 'sparkle', label: '鎏金流光', cost: 4, icon: Sparkles, tone: '#fbbf24' },
  { key: 'aurora', label: '极光天幕', cost: 6, icon: Gem, tone: '#22c55e' },
  { key: 'warp', label: '星际跃迁', cost: 7, icon: Rocket, tone: '#60a5fa' },
  { key: 'matrix', label: '代码矩阵', cost: 5, icon: ScanLine, tone: '#34d399' },
  { key: 'crown', label: '荣耀加冕', cost: 8, icon: Crown, tone: '#eab308' },
  { key: 'neonDrive', label: '霓虹疾驰', cost: 9, icon: Zap, tone: '#f472b6', tier: '特级' },
  { key: 'cockpit', label: '驾驶舱 HUD', cost: 10, icon: Gauge, tone: '#22d3ee', tier: '特级' },
  { key: 'holoCore', label: '全息核心', cost: 11, icon: Cpu, tone: '#a78bfa', tier: '特级' },
  { key: 'laserGrid', label: '激光网格', cost: 9, icon: CircuitBoard, tone: '#2dd4bf', tier: '特级' },
  { key: 'quantumGate', label: '量子虫洞', cost: 12, icon: Orbit, tone: '#818cf8', tier: '特级' },
  { key: 'cyberDataFlow', label: '赛博霓虹数据流', cost: 10, icon: CircuitBoard, tone: '#22d3ee', tier: '特级' },
  { key: 'velocityTrail', label: '骑行速度光轨', cost: 9, icon: Bike, tone: '#38bdf8', tier: '特级' },
  { key: 'cityScan', label: '城市扫描线', cost: 8, icon: Building2, tone: '#2dd4bf', tier: '特级' },
  { key: 'floatingHud', label: '驾驶舱 HUD 浮层', cost: 10, icon: Radar, tone: '#67e8f9', tier: '特级' },
  { key: 'neuralThink', label: '神经网络思考', cost: 11, icon: BrainCircuit, tone: '#a78bfa', tier: '特级' },
  { key: 'timeFold', label: '时间折叠过渡', cost: 10, icon: Clock3, tone: '#93c5fd', tier: '特级' },
  { key: 'rainGlass', label: '雨夜玻璃 UI', cost: 9, icon: CloudRain, tone: '#38bdf8', tier: '特级' },
  { key: 'codeMaterialize', label: '代码实体化', cost: 10, icon: Code2, tone: '#22c55e', tier: '特级' },
  { key: 'energyRing', label: '能量加载环', cost: 8, icon: CircleDashed, tone: '#60a5fa', tier: '特级' },
  { key: 'droneFlyover', label: '无人机飞行视角', cost: 11, icon: Plane, tone: '#14b8a6', tier: '特级' },
  { key: 'quantumFlicker', label: '量子闪烁', cost: 12, icon: Atom, tone: '#c4b5fd', tier: '特级' },
  { key: 'breathingUi', label: '呼吸 UI', cost: 8, icon: Activity, tone: '#22c55e', tier: '特级' },
  { key: 'dataStorm', label: '数据风暴', cost: 11, icon: DatabaseZap, tone: '#2dd4bf', tier: '特级' },
  { key: 'glassRefraction', label: '玻璃折射层', cost: 10, icon: Layers, tone: '#7dd3fc', tier: '特级' },
  { key: 'spaceJump', label: '空间跃迁', cost: 12, icon: Expand, tone: '#818cf8', tier: '特级' },
] as const;
const wallet = ref<CheckinWallet>(loadWallet());
const activeEffect = ref<RewardEffectKey | null>(null);
const effectSeed = ref(0);
let effectTimer: number | null = null;

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

function startEffect(effect: RewardEffectKey) {
  if (effectTimer) {
    window.clearTimeout(effectTimer);
    effectTimer = null;
  }

  activeEffect.value = null;
  effectSeed.value += 1;
  window.requestAnimationFrame(() => {
    activeEffect.value = effect;
  });

  effectTimer = window.setTimeout(() => {
    activeEffect.value = null;
    effectTimer = null;
  }, EFFECT_DURATIONS[effect]);
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
  const option = effectOptions.find((item) => item.key === effect);
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
  startEffect(effect);
  ElMessage.success(`已使用 ${option.cost} 甲币播放${option.label}`);
}

onBeforeUnmount(() => {
  if (effectTimer) {
    window.clearTimeout(effectTimer);
  }
});
</script>

<template>
  <el-popover placement="bottom-end" trigger="click" :width="410" popper-class="coin-popover">
    <template #reference>
      <el-button class="topbar-coin-btn" :icon="Coins" aria-label="甲币签到">
        <span>{{ wallet.coins }}</span>
        <small>甲币</small>
      </el-button>
    </template>

    <div class="coin-panel">
      <div class="coin-panel-head">
        <div>
          <strong>{{ wallet.coins }} 甲币</strong>
          <span>{{ walletStatusText }}</span>
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
        <button
          v-for="effect in effectOptions"
          :key="effect.key"
          class="effect-shop-item"
          type="button"
          :disabled="wallet.coins < effect.cost"
          :style="{ '--effect-tone': effect.tone }"
          @click="playEffect(effect.key)"
        >
          <span class="effect-shop-icon">
            <component :is="effect.icon" :size="18" />
          </span>
          <span class="effect-shop-copy">
            <strong>
              {{ effect.label }}
              <em v-if="'tier' in effect">{{ effect.tier }}</em>
            </strong>
            <small>{{ effect.cost }} 甲币</small>
          </span>
        </button>
      </div>
    </div>
  </el-popover>

  <RewardEffectOverlay :effect="activeEffect" :seed="effectSeed" />
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
  max-height: 360px;
  overflow-y: auto;
  padding-right: 2px;
  scrollbar-gutter: stable;
  mask-image: linear-gradient(180deg, transparent 0, #000 10px calc(100% - 18px), transparent 100%);
}

.effect-shop-item {
  --effect-tone: var(--tone-amber);
  position: relative;
  isolation: isolate;
  min-width: 0;
  min-height: 68px;
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

.effect-shop-item:has(em) {
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--effect-tone) 20%, transparent), transparent 46%),
    radial-gradient(circle at 100% 0, color-mix(in srgb, var(--effect-tone) 24%, transparent), transparent 42%),
    var(--c-surface-muted);
}

.effect-shop-item:has(em) .effect-shop-icon {
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--effect-tone) 38%, transparent),
    0 10px 22px color-mix(in srgb, var(--effect-tone) 22%, transparent),
    0 0 24px color-mix(in srgb, var(--effect-tone) 18%, transparent);
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
  gap: 5px;
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
  height: 17px;
  margin-left: 4px;
  border: 1px solid color-mix(in srgb, var(--effect-tone) 42%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--effect-tone) 13%, transparent);
  color: var(--effect-tone);
  font-size: 10px;
  font-style: normal;
  font-weight: 800;
  padding: 0 5px;
  vertical-align: 1px;
}

.effect-shop-copy small {
  color: var(--c-text-faint);
  font-size: 11px;
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

@keyframes effect-icon-orbit {
  to {
    transform: rotate(360deg);
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
