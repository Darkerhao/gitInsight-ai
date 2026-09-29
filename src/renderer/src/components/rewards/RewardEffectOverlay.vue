<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { Component } from 'vue';
import AiAwakenEffect from '@/components/rewards/effects/AiAwakenEffect.vue';
import AuroraEffect from '@/components/rewards/effects/AuroraEffect.vue';
import BioScanEffect from '@/components/rewards/effects/BioScanEffect.vue';
import BirthdayEffect from '@/components/rewards/effects/BirthdayEffect.vue';
import BlackHoleEffect from '@/components/rewards/effects/BlackHoleEffect.vue';
import BreathingUiEffect from '@/components/rewards/effects/BreathingUiEffect.vue';
import CockpitHudEffect from '@/components/rewards/effects/CockpitHudEffect.vue';
import CityScanEffect from '@/components/rewards/effects/CityScanEffect.vue';
import CodeMaterializeEffect from '@/components/rewards/effects/CodeMaterializeEffect.vue';
import ColliderEffect from '@/components/rewards/effects/ColliderEffect.vue';
import CrownEffect from '@/components/rewards/effects/CrownEffect.vue';
import CyberDataFlowEffect from '@/components/rewards/effects/CyberDataFlowEffect.vue';
import DataStormEffect from '@/components/rewards/effects/DataStormEffect.vue';
import DeepSonarEffect from '@/components/rewards/effects/DeepSonarEffect.vue';
import DroneFlyoverEffect from '@/components/rewards/effects/DroneFlyoverEffect.vue';
import DysonRingEffect from '@/components/rewards/effects/DysonRingEffect.vue';
import EmpBlastEffect from '@/components/rewards/effects/EmpBlastEffect.vue';
import EnergyRingEffect from '@/components/rewards/effects/EnergyRingEffect.vue';
import EnergyShieldEffect from '@/components/rewards/effects/EnergyShieldEffect.vue';
import FireworksEffect from '@/components/rewards/effects/FireworksEffect.vue';
import FloatingHudEffect from '@/components/rewards/effects/FloatingHudEffect.vue';
import GalaxyMapEffect from '@/components/rewards/effects/GalaxyMapEffect.vue';
import GlassRefractionEffect from '@/components/rewards/effects/GlassRefractionEffect.vue';
import GravityWaveEffect from '@/components/rewards/effects/GravityWaveEffect.vue';
import HoloCoreEffect from '@/components/rewards/effects/HoloCoreEffect.vue';
import HoloDisassembleEffect from '@/components/rewards/effects/HoloDisassembleEffect.vue';
import LaserGridEffect from '@/components/rewards/effects/LaserGridEffect.vue';
import LittleBoyEffect from '@/components/rewards/effects/LittleBoyEffect.vue';
import MatrixEffect from '@/components/rewards/effects/MatrixEffect.vue';
import MechaBootEffect from '@/components/rewards/effects/MechaBootEffect.vue';
import NanoSwarmEffect from '@/components/rewards/effects/NanoSwarmEffect.vue';
import NeonDriveEffect from '@/components/rewards/effects/NeonDriveEffect.vue';
import NeuralThinkEffect from '@/components/rewards/effects/NeuralThinkEffect.vue';
import OrbitalStrikeEffect from '@/components/rewards/effects/OrbitalStrikeEffect.vue';
import QuantumGateEffect from '@/components/rewards/effects/QuantumGateEffect.vue';
import QuantumFlickerEffect from '@/components/rewards/effects/QuantumFlickerEffect.vue';
import RainGlassEffect from '@/components/rewards/effects/RainGlassEffect.vue';
import RiftTearEffect from '@/components/rewards/effects/RiftTearEffect.vue';
import RocketLaunchEffect from '@/components/rewards/effects/RocketLaunchEffect.vue';
import SatelliteSweepEffect from '@/components/rewards/effects/SatelliteSweepEffect.vue';
import SkyUplinkEffect from '@/components/rewards/effects/SkyUplinkEffect.vue';
import SolarFlareEffect from '@/components/rewards/effects/SolarFlareEffect.vue';
import SpaceJumpEffect from '@/components/rewards/effects/SpaceJumpEffect.vue';
import SparkleEffect from '@/components/rewards/effects/SparkleEffect.vue';
import SupernovaEffect from '@/components/rewards/effects/SupernovaEffect.vue';
import TimeFoldEffect from '@/components/rewards/effects/TimeFoldEffect.vue';
import VelocityTrailEffect from '@/components/rewards/effects/VelocityTrailEffect.vue';
import WarpEffect from '@/components/rewards/effects/WarpEffect.vue';
// 创世级 GENESIS（五期）
import CelestialThroneEffect from '@/components/rewards/effects/CelestialThroneEffect.vue';
import CosmicStringEffect from '@/components/rewards/effects/CosmicStringEffect.vue';
import DimensionFoilEffect from '@/components/rewards/effects/DimensionFoilEffect.vue';
import EntropyReversalEffect from '@/components/rewards/effects/EntropyReversalEffect.vue';
import EpochZeroEffect from '@/components/rewards/effects/EpochZeroEffect.vue';
import ExtinctionRainEffect from '@/components/rewards/effects/ExtinctionRainEffect.vue';
import GalaxyDevourEffect from '@/components/rewards/effects/GalaxyDevourEffect.vue';
import GammaLanceEffect from '@/components/rewards/effects/GammaLanceEffect.vue';
import GenesisBangEffect from '@/components/rewards/effects/GenesisBangEffect.vue';
import MagnetarSurgeEffect from '@/components/rewards/effects/MagnetarSurgeEffect.vue';
import OvermindEffect from '@/components/rewards/effects/OvermindEffect.vue';
import PlasmaDrakeEffect from '@/components/rewards/effects/PlasmaDrakeEffect.vue';
import StarForgeEffect from '@/components/rewards/effects/StarForgeEffect.vue';
import ThunderVerdictEffect from '@/components/rewards/effects/ThunderVerdictEffect.vue';
import VacuumDecayEffect from '@/components/rewards/effects/VacuumDecayEffect.vue';
import { EFFECT_OPTION_MAP, EFFECT_TIERS } from '@/components/rewards/rewardEffects';
import type { RewardEffectKey } from '@/components/rewards/rewardEffects';

import { ArrowLeft, Eye, EyeOff, Orbit, RotateCcw, X } from 'lucide-vue-next';
import { CinemaEnvironment } from './engine/CinemaEnvironment';

const props = defineProps<{ effect: RewardEffectKey | null; seed: number; canReplay?: boolean; replaying?: boolean; replayError?: string }>();
const emit = defineEmits<{ close: []; replay: [] }>();

const effectComponentMap: Record<RewardEffectKey, Component> = {
  fireworks: FireworksEffect,
  birthday: BirthdayEffect,
  sparkle: SparkleEffect,
  aurora: AuroraEffect,
  warp: WarpEffect,
  matrix: MatrixEffect,
  crown: CrownEffect,
  neonDrive: NeonDriveEffect,
  cockpit: CockpitHudEffect,
  holoCore: HoloCoreEffect,
  laserGrid: LaserGridEffect,
  quantumGate: QuantumGateEffect,
  cyberDataFlow: CyberDataFlowEffect,
  velocityTrail: VelocityTrailEffect,
  cityScan: CityScanEffect,
  floatingHud: FloatingHudEffect,
  neuralThink: NeuralThinkEffect,
  timeFold: TimeFoldEffect,
  rainGlass: RainGlassEffect,
  codeMaterialize: CodeMaterializeEffect,
  energyRing: EnergyRingEffect,
  droneFlyover: DroneFlyoverEffect,
  quantumFlicker: QuantumFlickerEffect,
  breathingUi: BreathingUiEffect,
  dataStorm: DataStormEffect,
  glassRefraction: GlassRefractionEffect,
  spaceJump: SpaceJumpEffect,
  blackHole: BlackHoleEffect,
  supernova: SupernovaEffect,
  gravityWave: GravityWaveEffect,
  riftTear: RiftTearEffect,
  aiAwaken: AiAwakenEffect,
  dysonRing: DysonRingEffect,
  collider: ColliderEffect,
  mechaBoot: MechaBootEffect,
  orbitalStrike: OrbitalStrikeEffect,
  galaxyMap: GalaxyMapEffect,
  solarFlare: SolarFlareEffect,
  nanoSwarm: NanoSwarmEffect,
  holoDisassemble: HoloDisassembleEffect,
  rocketLaunch: RocketLaunchEffect,
  bioScan: BioScanEffect,
  empBlast: EmpBlastEffect,
  littleBoy: LittleBoyEffect,
  satelliteSweep: SatelliteSweepEffect,
  energyShield: EnergyShieldEffect,
  deepSonar: DeepSonarEffect,
  skyUplink: SkyUplinkEffect,
  genesisBang: GenesisBangEffect,
  dimensionFoil: DimensionFoilEffect,
  gammaLance: GammaLanceEffect,
  magnetarSurge: MagnetarSurgeEffect,
  vacuumDecay: VacuumDecayEffect,
  starForge: StarForgeEffect,
  galaxyDevour: GalaxyDevourEffect,
  overmind: OvermindEffect,
  extinctionRain: ExtinctionRainEffect,
  thunderVerdict: ThunderVerdictEffect,
  plasmaDrake: PlasmaDrakeEffect,
  epochZero: EpochZeroEffect,
  cosmicString: CosmicStringEffect,
  entropyReversal: EntropyReversalEffect,
  celestialThrone: CelestialThroneEffect,
};

const activeComponent = computed(() => props.effect ? effectComponentMap[props.effect] : null);
const option = computed(() => props.effect ? EFFECT_OPTION_MAP[props.effect] : null);
const tierMeta = computed(() => option.value ? EFFECT_TIERS[option.value.tier] : null);
const duration = computed(() => {
  const phases = option.value?.phases;
  return phases ? phases.entry + phases.loop + phases.exit : 0;
});
const stageVars = computed(() => ({
  '--fx-accent': option.value?.accent,
  '--fx-secondary': option.value?.secondary,
  '--fx-ms': `${duration.value}ms`,
  '--fx-entry-ms': `${option.value?.phases.entry ?? 0}ms`,
  '--fx-exit-ms': `${option.value?.phases.exit ?? 0}ms`,
  '--fx-exit-delay': `${duration.value - (option.value?.phases.exit ?? 0)}ms`,
}));

const stageRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const elapsed = ref(0);
const finished = ref(false);
const immersive = ref(false);
const reducedMotion = ref(false);
const phaseLabel = computed(() => {
  if (finished.value) return '演出完成';
  if (reducedMotion.value) return '静态欣赏';
  if (elapsed.value < (option.value?.phases.entry ?? 0)) return '正在入场';
  if (elapsed.value >= duration.value - (option.value?.phases.exit ?? 0)) return '余韵';
  return '正在演出';
});
const progress = computed(() => duration.value ? Math.min(100, elapsed.value / duration.value * 100) : 0);
const remaining = computed(() => `${Math.max(0, (duration.value - elapsed.value) / 1000).toFixed(1)}s`);
let environment: CinemaEnvironment | null = null;
let frame = 0;
let restoreFocus: HTMLElement | null = null;
let previousOverflow = '';
let appWasInert = false;
let playerOpen = false;

function stopScene() {
  window.cancelAnimationFrame(frame);
  frame = 0;
  environment?.dispose();
  environment = null;
}

function releasePlayer() {
  stopScene();
  if (!playerOpen) return;
  playerOpen = false;
  document.body.style.overflow = previousOverflow;
  const app = document.getElementById('app');
  if (app) app.inert = appWasInert;
  window.removeEventListener('keydown', handleKeydown);
  if (restoreFocus?.isConnected) restoreFocus.focus({ preventScroll: true });
  restoreFocus = null;
}

function movePointer(event: PointerEvent) {
  if (reducedMotion.value) return;
  environment?.setPointer(event.clientX / window.innerWidth * 2 - 1, 1 - event.clientY / window.innerHeight * 2);
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopImmediatePropagation();
    emit('close');
  } else if (event.key.toLowerCase() === 'h' && !event.ctrlKey && !event.metaKey && !event.altKey && !finished.value) {
    immersive.value = !immersive.value;
  } else if (event.key === 'Tab') {
    const buttons = Array.from(stageRef.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    if (!buttons.length) return;
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    event.preventDefault();
    const next = index < 0 ? (event.shiftKey ? buttons.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
    buttons[next].focus();
  }
}

watch([() => props.effect, () => props.seed], async ([effect, seed], _old, onCleanup) => {
  let cancelled = false;
  onCleanup(() => { cancelled = true; stopScene(); });
  stopScene();
  if (!effect) { releasePlayer(); return; }
  if (!playerOpen) {
    restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    previousOverflow = document.body.style.overflow;
    const app = document.getElementById('app');
    appWasInert = app?.inert ?? false;
    if (app) app.inert = true;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeydown);
    playerOpen = true;
  }
  finished.value = false;
  elapsed.value = 0;
  reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  await nextTick();
  if (cancelled || !canvasRef.value || !option.value) return;
  stageRef.value?.focus({ preventScroll: true });
  try {
    if (!reducedMotion.value) environment = new CinemaEnvironment(canvasRef.value, option.value, seed);
  } catch (error) {
    console.warn('[Rewards] Depth layer unavailable:', error);
  }
  const startedAt = performance.now();
  let previousAt = startedAt;
  const render = (now: number) => {
    elapsed.value = Math.min(duration.value, now - startedAt);
    environment?.render(elapsed.value, Math.min(64, now - previousAt));
    previousAt = now;
    if (elapsed.value >= duration.value) {
      finished.value = true;
      stopScene();
      void nextTick(() => stageRef.value?.querySelector<HTMLButtonElement>('.cinema-return')?.focus({ preventScroll: true }));
      return;
    }
    frame = window.requestAnimationFrame(render);
  };
  frame = window.requestAnimationFrame(render);
}, { immediate: true });

onBeforeUnmount(releasePlayer);
</script>

<template>
  <Teleport to="body">
    <section
      v-if="option && activeComponent && tierMeta"
      :key="`${props.effect}-${props.seed}`"
      ref="stageRef"
      class="reward-effect-overlay"
      :class="[{ 'is-immersive': immersive && !finished, 'is-finished': finished }, `is-${option.key}`]"
      :style="stageVars"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      :aria-label="`${option.label} · 特效剧场`"
      @pointermove="movePointer"
      @pointerleave="environment?.setPointer(0, 0)"
    >
      <div class="cinema-atmosphere" :style="{ background: option.backdrop }" aria-hidden="true" />
      <template v-if="!finished">
        <div v-if="!reducedMotion" class="cinema-scene" :class="`camera-${option.camera}`" aria-hidden="true">
          <component :is="activeComponent" :seed="props.seed" class="cinema-content" />
        </div>
        <div v-else class="cinema-still" aria-hidden="true">
          <component :is="option.icon" :size="64" :stroke-width="1" />
          <span>{{ option.codename }}</span>
          <strong>{{ option.label }}</strong>
        </div>
        <canvas ref="canvasRef" class="cinema-depth" aria-hidden="true" />
        <div class="cinema-lens" aria-hidden="true" />
        <div class="cinema-curtain" aria-hidden="true" />
        <div class="cinema-intro" aria-hidden="true">
          <span>{{ tierMeta.label }} / {{ option.codename }}</span>
          <strong>{{ option.label }}</strong>
          <i />
        </div>
      </template>

      <header class="cinema-header">
        <div class="cinema-identity">
          <span class="cinema-mark"><Orbit :size="21" :stroke-width="1.25" /></span>
          <div><span>NEXUS <b>THEATER</b></span><small>{{ option.label }}<i />{{ tierMeta.label }}</small></div>
        </div>
        <div class="cinema-actions">
          <button v-if="!finished" type="button" class="cinema-tool" :aria-pressed="immersive" :aria-label="immersive ? '显示播放信息' : '隐藏播放信息'" @click="immersive = !immersive">
            <component :is="immersive ? Eye : EyeOff" :size="16" /><span>{{ immersive ? '显示信息' : '沉浸观看' }}</span><kbd>H</kbd>
          </button>
          <button type="button" class="cinema-tool cinema-close" aria-label="关闭特效，返回特效库" @click="emit('close')">
            <X :size="17" /><span>退出</span><kbd>Esc</kbd>
          </button>
        </div>
      </header>

      <div v-if="finished" class="cinema-finale">
        <span class="cinema-finale-orbit" aria-hidden="true" />
        <span class="cinema-finale-icon"><component :is="option.icon" :size="38" :stroke-width="1.25" /></span>
        <span class="cinema-eyebrow">{{ option.codename }}</span>
        <h2>{{ option.label }}</h2>
        <p>{{ option.narrative }}</p>
        <div class="cinema-finale-meta"><span>{{ tierMeta.label }}</span><i /><span>{{ (duration / 1000).toFixed(1) }} 秒演出</span><i /><span>演出完成</span></div>
        <div class="cinema-finale-actions">
          <button type="button" class="cinema-return" @click="emit('close')"><ArrowLeft :size="17" />返回特效库</button>
          <button type="button" class="cinema-replay" :disabled="!props.canReplay || props.replaying" @click="emit('replay')">
            <RotateCcw :size="16" />{{ props.replaying ? '正在启动…' : '再看一次' }}<span>{{ option.cost }} 甲币</span>
          </button>
        </div>
        <span v-if="props.replayError" class="cinema-error" role="alert">{{ props.replayError }}</span>
        <small v-else-if="!props.canReplay && !props.replaying" class="cinema-replay-hint">甲币不足，签到后再来观看</small>
      </div>

      <footer v-else class="cinema-footer">
        <div class="cinema-caption"><span>{{ option.codename }}</span><strong>{{ option.narrative }}</strong></div>
        <div class="cinema-timing"><span><i />{{ phaseLabel }}</span><time>{{ remaining }}</time></div>
        <div class="cinema-progress" role="progressbar" aria-label="播放进度" :aria-valuenow="Math.round(progress)" :aria-valuemin="0" :aria-valuemax="100">
          <span :style="{ transform: `scaleX(${progress / 100})` }" />
        </div>
      </footer>
    </section>
  </Teleport>
</template>

<style lang="scss">
.reward-effect-overlay {
  --fx-accent: #93c5fd;
  --fx-secondary: #c4b5fd;
  position: fixed;
  inset: 0;
  z-index: 10000;
  overflow: hidden;
  isolation: isolate;
  background: #03050c;
  color: #f1f5f9;
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
  outline: none;
  animation: cinema-open 260ms ease-out both;

  button { font: inherit; cursor: pointer; }
  button:disabled { opacity: 0.42; cursor: not-allowed; }
  button:focus-visible { outline: 2px solid var(--fx-accent); outline-offset: 5px; }
  kbd { font: 10px ui-monospace, monospace; opacity: 0.5; border: 1px solid #ffffff24; border-radius: 4px; padding: 2px 4px; }
}

.cinema-atmosphere, .cinema-scene, .cinema-depth, .cinema-content, .cinema-lens, .cinema-curtain { position: absolute; inset: 0; }
.cinema-atmosphere { opacity: 0.65; transition: opacity 1s; }
.cinema-scene { z-index: 1; transform-origin: center; animation: cinema-settle var(--fx-ms) ease-out both; }
.cinema-scene.camera-none, .is-littleBoy .cinema-scene { animation: none; }
.cinema-scene.camera-drift { animation-name: cinema-drift; }
.cinema-scene.camera-sweep { animation-name: cinema-sweep; }
.cinema-scene.camera-ascend { animation-name: cinema-ascend; }
.cinema-depth {
  z-index: 2;
  width: 100%;
  height: 100%;
  pointer-events: none;
  mask-image: radial-gradient(ellipse at center, transparent 12%, #0008 42%, #000 75%);
}
.is-littleBoy .cinema-depth { opacity: 0.28; }
.cinema-lens {
  z-index: 3;
  pointer-events: none;
  background: linear-gradient(180deg, #03050cd9, transparent 17% 76%, #03050cf0), radial-gradient(ellipse, transparent 35%, #03050c88);
}
.cinema-curtain {
  z-index: 4;
  background: #03050c;
  pointer-events: none;
  animation: cinema-curtain var(--fx-ms) linear both;
}
.cinema-intro {
  position: absolute;
  z-index: 5;
  top: 38%;
  left: 50%;
  width: 85%;
  display: grid;
  justify-items: center;
  gap: 20px;
  text-align: center;
  transform: translate(-50%, -50%);
  pointer-events: none;
  animation: cinema-intro 1250ms ease both;
  span { color: var(--fx-accent); font: 10px ui-monospace, monospace; letter-spacing: 0.3em; }
  strong { font-size: clamp(26px, 3.4vw, 52px); font-weight: 300; letter-spacing: 0.24em; text-shadow: 0 0 36px #000; }
  i { width: 48px; height: 1px; background: var(--fx-accent); box-shadow: 0 0 18px var(--fx-accent); }
}
.cinema-header {
  position: absolute;
  z-index: 8;
  top: 0;
  inset-inline: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 28px 36px;
}
.cinema-identity { display: flex; align-items: center; gap: 12px; transition: opacity 250ms; }
.cinema-mark { display: grid; place-items: center; width: 40px; height: 40px; border: 1px solid #ffffff24; border-radius: 50%; color: var(--fx-accent); }
.cinema-identity > div { display: grid; gap: 7px; }
.cinema-identity > div > span { font: 11px ui-monospace, monospace; letter-spacing: 0.2em; }
.cinema-identity b { font-weight: 400; opacity: 0.42; margin-left: 7px; }
.cinema-identity small { display: flex; align-items: center; gap: 8px; font-size: 10px; color: #a4aebb; }
.cinema-identity i, .cinema-finale-meta i { width: 3px; height: 3px; border-radius: 50%; background: currentColor; }
.cinema-actions { display: flex; gap: 8px; }
.cinema-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 36px;
  padding: 8px 12px;
  border: 1px solid #ffffff1a;
  border-radius: 7px;
  color: #cbd5e1;
  background: #090e1980;
  backdrop-filter: blur(10px);
  transition: background 180ms, border-color 180ms;
  span { font-size: 11px; }
  &:hover { background: #ffffff14; border-color: #ffffff44; }
}
.cinema-footer {
  position: absolute;
  z-index: 7;
  bottom: 0;
  inset-inline: 0;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: end;
  gap: 18px 36px;
  padding: 32px 38px;
  transition: opacity 250ms, transform 250ms;
}
.cinema-caption { display: grid; gap: 9px; }
.cinema-caption > span { font: 10px ui-monospace, monospace; color: var(--fx-accent); letter-spacing: 0.22em; }
.cinema-caption strong { font-size: 12px; font-weight: 400; line-height: 1.6; color: #9aa6b6; max-width: 680px; }
.cinema-timing { display: flex; align-items: center; gap: 22px; font-size: 10px; color: #9ba8b8; white-space: nowrap; }
.cinema-timing > span { display: flex; align-items: center; gap: 7px; }
.cinema-timing i { width: 4px; height: 4px; border-radius: 50%; background: var(--fx-accent); box-shadow: 0 0 8px var(--fx-accent); }
.cinema-timing time { font: 12px ui-monospace, monospace; font-variant-numeric: tabular-nums; min-width: 40px; text-align: right; color: #e2e8f0; }
.cinema-progress { grid-column: 1 / -1; height: 2px; background: #ffffff15; overflow: hidden; }
.cinema-progress > span { display: block; width: 100%; height: 100%; transform-origin: left; background: linear-gradient(90deg, var(--fx-secondary), var(--fx-accent)); }
.is-immersive .cinema-identity { opacity: 0; }
.is-immersive .cinema-footer { opacity: 0; transform: translateY(12px); pointer-events: none; }
.is-finished .cinema-atmosphere { opacity: 0.32; }
.cinema-still { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px; color: var(--fx-accent); }
.cinema-still span { font: 11px ui-monospace, monospace; letter-spacing: 0.25em; }
.cinema-still strong { color: #e2e8f0; font-size: clamp(30px, 4vw, 54px); font-weight: 300; letter-spacing: 0.14em; }
.cinema-finale {
  position: absolute;
  z-index: 6;
  inset: 80px 20px 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  animation: cinema-finale 650ms ease-out both;
  h2 { margin: 18px 0 14px; font-size: clamp(30px, 4vw, 54px); font-weight: 300; letter-spacing: 0.12em; }
  p { max-width: 460px; margin: 0; color: #9aa7b8; font-size: 13px; line-height: 1.9; }
}
.cinema-finale-orbit { position: absolute; z-index: -1; width: min(68vw, 520px); aspect-ratio: 1; border-radius: 50%; border: 1px solid color-mix(in srgb, var(--fx-accent) 10%, transparent); box-shadow: 0 0 100px color-mix(in srgb, var(--fx-accent) 6%, transparent), inset 0 0 80px color-mix(in srgb, var(--fx-accent) 4%, transparent); transform: translateY(-35px); }
.cinema-finale-icon { display: grid; place-items: center; width: 78px; height: 78px; margin-bottom: 26px; color: var(--fx-accent); border: 1px solid color-mix(in srgb, var(--fx-accent) 24%, transparent); border-radius: 50%; background: color-mix(in srgb, var(--fx-accent) 5%, transparent); }
.cinema-eyebrow { font: 10px ui-monospace, monospace; color: var(--fx-accent); letter-spacing: 0.3em; }
.cinema-finale-meta { display: flex; align-items: center; gap: 12px; margin-top: 22px; color: #708097; font-size: 10px; }
.cinema-finale-actions { display: flex; justify-content: center; gap: 12px; margin-top: 38px; }
.cinema-finale-actions button { display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-height: 44px; padding: 12px 20px; border-radius: 8px; font-size: 12px; transition: background 180ms; }
.cinema-return { background: #e2e8f0; color: #101927; border: 1px solid #e2e8f0; &:hover { background: #fff; } }
.cinema-replay { background: #ffffff06; color: #cbd5e1; border: 1px solid #ffffff26; span { color: var(--fx-accent); font-size: 10px; padding-left: 9px; border-left: 1px solid #ffffff24; } &:hover:not(:disabled) { background: #ffffff10; } }
.cinema-error, .cinema-replay-hint { font-size: 12px; margin-top: 18px; color: #fca5a5; }
.cinema-replay-hint { color: #8190a4; }

@keyframes cinema-open { from { opacity: 0; } to { opacity: 1; } }
@keyframes cinema-curtain { 0% { opacity: 0.85; } 16%, 84% { opacity: 0; } 100% { opacity: 1; } }
@keyframes cinema-intro { 0% { opacity: 0; filter: blur(8px); } 22%, 48% { opacity: 1; filter: blur(0); } 100% { opacity: 0; filter: blur(5px); transform: translate(-50%, -55%); } }
@keyframes cinema-settle { 0% { transform: scale(1.045); } 30%, 85% { transform: scale(1); } 100% { transform: scale(1.015); } }
@keyframes cinema-drift { 0% { transform: scale(1.025) translateX(-0.5%); } 100% { transform: scale(1.04) translateX(0.5%); } }
@keyframes cinema-sweep { 0% { transform: scale(1.035) translateX(1%); } 100% { transform: scale(1.035) translateX(-1%); } }
@keyframes cinema-ascend { 0% { transform: scale(1.03) translateY(0.7%); } 100% { transform: scale(1.03) translateY(-0.7%); } }
@keyframes cinema-finale { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

@media (max-width: 720px) {
  .cinema-header { padding: 18px; gap: 10px; }
  .cinema-tool { padding: 8px; }
  .cinema-tool kbd, .cinema-tool span, .cinema-identity b { display: none; }
  .cinema-footer { padding: 24px 20px; gap: 14px; }
  .cinema-caption strong { display: none; }
  .cinema-timing { gap: 12px; }
  .cinema-finale-actions { gap: 8px; }
  .cinema-finale-actions button { padding: 12px; }
}
@media (max-height: 580px) {
  .cinema-finale-icon { width: 48px; height: 48px; margin-bottom: 12px; }
  .cinema-finale h2 { font-size: 28px; margin: 12px 0; }
  .cinema-finale-actions { margin-top: 20px; }
  .cinema-finale-meta { margin-top: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .reward-effect-overlay, .reward-effect-overlay *, .reward-effect-overlay *::before, .reward-effect-overlay *::after { animation: none !important; transition: none !important; }
  .cinema-curtain, .cinema-intro { display: none; }
  .cinema-lens { opacity: 0.42; }
}
</style>
