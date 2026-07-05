<script setup lang="ts">
import { computed } from 'vue';
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
import { EFFECT_OPTION_MAP, EFFECT_TIERS } from '@/components/rewards/rewardEffects';
import type { RewardEffectKey } from '@/components/rewards/rewardEffects';

/**
 * NEXUS 统一电影舞台：所有特效在同一套「深空指挥舰桥」里演出。
 * 舞台按 rewardEffects.ts 的分级与镜头数据施加统一的
 * 开幕（光圈展开 + 能量注入）→ 相机运动 → 后期处理（扫描线/噪点/
 * 色差/暗角/电影黑边）→ 协议 HUD → 闭幕（世界回收）。
 * 特效组件只负责内容层，屏幕语言全部由舞台数据驱动。
 */

const props = defineProps<{
  effect: RewardEffectKey | null;
  seed: number;
}>();

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
  satelliteSweep: SatelliteSweepEffect,
  energyShield: EnergyShieldEffect,
  deepSonar: DeepSonarEffect,
  skyUplink: SkyUplinkEffect,
};

const activeComponent = computed(() => (props.effect ? effectComponentMap[props.effect] : null));
const option = computed(() => (props.effect ? EFFECT_OPTION_MAP[props.effect] : null));
const tierMeta = computed(() => (option.value ? EFFECT_TIERS[option.value.tier] : null));

const SHAKE_AMPLITUDES = ['0px', '2.5px', '4.5px'] as const;

const stageClasses = computed(() => {
  if (!option.value) return [];
  return [
    `is-${option.value.key}`,
    `fx-tier-${option.value.tier}`,
    `fx-cam-${option.value.camera}`,
    option.value.shake > 0 ? 'fx-has-shake' : '',
    option.value.apex ? 'fx-apex' : '',
  ].filter(Boolean);
});

const stageVars = computed(() => {
  if (!option.value) return {};
  const { phases, accent, secondary, shake } = option.value;
  const total = phases.entry + phases.loop + phases.exit;
  return {
    '--fx-accent': accent,
    '--fx-secondary': secondary,
    '--fx-ms': `${total}ms`,
    '--fx-entry-ms': `${phases.entry}ms`,
    '--fx-exit-ms': `${phases.exit}ms`,
    '--fx-exit-delay': `${total - phases.exit}ms`,
    '--fx-shake-amp': SHAKE_AMPLITUDES[shake],
  };
});

const seedLabel = computed(() => String(props.seed % 10000).padStart(4, '0'));
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.effect && activeComponent && option && tierMeta"
      :key="`${props.effect}-${props.seed}`"
      class="reward-effect-overlay"
      :class="stageClasses"
      :style="stageVars"
      aria-hidden="true"
    >
      <div class="fx-backdrop" :style="{ background: option.backdrop }" />

      <div class="fx-camera">
        <div class="fx-shake-rig">
          <div class="fx-bloom" />
          <span class="fx-shockwave" />
          <span class="fx-shockwave is-delayed" />
          <span class="fx-shockwave is-third" />
          <component :is="activeComponent" :seed="props.seed" class="fx-content" />
        </div>
      </div>

      <div class="fx-injectors">
        <span
          v-for="beam in 8"
          :key="beam"
          class="fx-injector"
          :style="{ '--beam-rotate': `${(beam - 1) * 45}deg`, animationDelay: `${(beam % 4) * 45}ms` }"
        />
      </div>

      <div class="fx-grain" />
      <div class="fx-scanlines" />
      <div class="fx-chroma" />
      <div class="fx-vignette" />
      <span class="fx-restore" />

      <div class="fx-cinebar is-top" />
      <div class="fx-cinebar is-bottom" />

      <div class="fx-hud">
        <span class="fx-hud-bracket is-tl" />
        <span class="fx-hud-bracket is-tr" />
        <span class="fx-hud-bracket is-bl" />
        <span class="fx-hud-bracket is-br" />
        <div class="fx-hud-protocol">
          <small>NEXUS · VISUAL PROTOCOL</small>
          <strong>{{ option.codename }}</strong>
          <span>
            {{ tierMeta.codename }} CLASS · {{ option.label }}
            <em v-if="option.apex">APEX EVENT</em>
          </span>
        </div>
        <div class="fx-hud-status">
          <span class="fx-hud-status-run">ENERGY −{{ option.cost }} ⬢ · SEED {{ seedLabel }} · RUNNING</span>
          <span class="fx-hud-status-done">PROTOCOL COMPLETE · SYSTEM RESTORED</span>
        </div>
      </div>

      <div class="fx-flash" />
    </div>
  </Teleport>
</template>

<style>
.reward-effect-overlay {
  --fx-accent: #60a5fa;
  --fx-secondary: #f472b6;
  --fx-ms: 5000ms;
  --fx-entry-ms: 600ms;
  --fx-exit-ms: 800ms;
  --fx-exit-delay: 4200ms;
  --fx-shake-amp: 0px;
  /* 分级压制系数：默认 = 信标级，战术/奇点级逐级抬升 */
  --fx-grain-o: 0.08;
  --fx-scanline-o: 0.16;
  --fx-vignette-o: 0.62;
  position: fixed;
  inset: 0;
  z-index: 10000;
  pointer-events: none;
  overflow: hidden;
  isolation: isolate;
}

.fx-backdrop,
.fx-camera,
.fx-shake-rig,
.fx-bloom,
.fx-content,
.fx-grain,
.fx-scanlines,
.fx-chroma,
.fx-vignette,
.fx-flash {
  position: absolute;
  inset: 0;
}

/* ── 背景幕：特效专属氛围（数据驱动），T3 附加环境熔化 ── */
.fx-backdrop {
  z-index: -4;
  opacity: 0;
  animation: fx-backdrop var(--fx-ms) ease both;
}

.fx-tier-singularity .fx-backdrop {
  backdrop-filter: blur(3px) saturate(1.12);
}

/* ── 相机 rig：镜头预设作用于内容 + 辉光 + 冲击波 ── */
.fx-camera {
  z-index: 1;
  will-change: transform;
  transform-origin: 50% 50%;
}

.fx-cam-still .fx-camera {
  animation: fx-cam-still var(--fx-ms) ease both;
}

.fx-cam-drift .fx-camera {
  animation: fx-cam-drift var(--fx-ms) ease-in-out both;
}

.fx-cam-dolly .fx-camera {
  animation: fx-cam-dolly var(--fx-ms) cubic-bezier(0.16, 1, 0.3, 1) both;
}

.fx-cam-sweep .fx-camera {
  animation: fx-cam-sweep var(--fx-ms) ease-in-out both;
}

.fx-cam-ascend .fx-camera {
  animation: fx-cam-ascend var(--fx-ms) cubic-bezier(0.22, 1, 0.36, 1) both;
}

.fx-cam-warp .fx-camera {
  animation: fx-cam-warp var(--fx-ms) ease-in-out both;
}

.fx-cam-punch .fx-camera {
  animation: fx-cam-punch var(--fx-ms) cubic-bezier(0.16, 1, 0.3, 1) both;
}

.fx-cam-collapse .fx-camera {
  animation: fx-cam-collapse var(--fx-ms) cubic-bezier(0.4, 0, 0.6, 1) both;
}

.fx-has-shake .fx-shake-rig {
  animation: fx-shake var(--fx-ms) steps(2, jump-none) both;
}

/* ── 内容与辉光 ── */
.fx-content {
  z-index: 2;
}

.fx-bloom {
  z-index: -1;
  opacity: 0;
  background:
    radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--fx-accent) 34%, transparent), transparent 31%),
    radial-gradient(circle at 28% 28%, color-mix(in srgb, var(--fx-secondary) 18%, transparent), transparent 26%),
    radial-gradient(circle at 76% 72%, color-mix(in srgb, var(--fx-accent) 20%, transparent), transparent 30%);
  filter: blur(20px) saturate(1.18);
  mix-blend-mode: screen;
  transform: scale(0.82);
  animation: fx-bloom var(--fx-ms) cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* ── 开幕光圈：冲击波三连（第三道仅奇点级） ── */
.fx-shockwave {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 1;
  width: 22vmin;
  height: 22vmin;
  border: 1px solid color-mix(in srgb, var(--fx-accent) 68%, rgba(255, 255, 255, 0.7));
  border-radius: 50%;
  box-shadow:
    inset 0 0 24px color-mix(in srgb, var(--fx-accent) 20%, transparent),
    0 0 42px color-mix(in srgb, var(--fx-accent) 36%, transparent);
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.22);
  animation: fx-shockwave 1.8s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.fx-shockwave.is-delayed {
  animation-delay: 260ms;
}

.fx-shockwave.is-third {
  display: none;
  border-color: color-mix(in srgb, var(--fx-secondary) 66%, rgba(255, 255, 255, 0.6));
  animation-delay: 520ms;
}

.fx-tier-singularity .fx-shockwave.is-third {
  display: block;
}

/* ── 能量注入：甲币能量自屏幕边缘汇入舞台中心（entry 阶段） ── */
.fx-injectors {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: none;
}

.fx-tier-tactical .fx-injectors,
.fx-tier-singularity .fx-injectors {
  display: block;
}

.fx-injector {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 56vmax;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--fx-accent) 88%, #fff) 0, color-mix(in srgb, var(--fx-accent) 40%, transparent) 42%, transparent);
  box-shadow: 0 0 14px color-mix(in srgb, var(--fx-accent) 46%, transparent);
  opacity: 0;
  transform: rotate(var(--beam-rotate)) scaleX(1);
  transform-origin: left center;
  animation: fx-inject var(--fx-entry-ms) cubic-bezier(0.7, 0, 0.3, 1) both;
}

/* 战术级只保留正交四束，奇点级八向全开 */
.fx-tier-tactical .fx-injector:nth-child(even) {
  display: none;
}

/* ── 后期处理层（屏幕空间，不随相机运动） ── */
.fx-grain {
  z-index: 4;
  opacity: 0;
  background-image:
    radial-gradient(circle at 28% 24%, rgba(255, 255, 255, 0.2) 0 1px, transparent 1.5px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
    linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px);
  background-size: 18px 18px, 42px 42px, 42px 42px;
  mask-image: radial-gradient(circle at center, #000 0 62%, transparent 78%);
  mix-blend-mode: overlay;
  animation: fx-grain var(--fx-ms) ease both;
}

.fx-scanlines {
  z-index: 5;
  opacity: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, transparent 0 48%, color-mix(in srgb, var(--fx-accent) 16%, transparent), transparent 52%);
  background-size: 100% 5px, 180px 100%;
  mix-blend-mode: soft-light;
  animation: fx-scanlines var(--fx-ms) ease both;
}

/* 色差撕裂：仅奇点级，左品红右青的边缘色散 + 脉冲 */
.fx-chroma {
  z-index: 5;
  display: none;
  opacity: 0;
  background:
    linear-gradient(90deg, rgba(244, 62, 156, 0.16), transparent 12% 88%, rgba(34, 211, 238, 0.16)),
    linear-gradient(0deg, rgba(34, 211, 238, 0.07), transparent 16% 84%, rgba(244, 62, 156, 0.07));
  mix-blend-mode: screen;
  animation: fx-chroma var(--fx-ms) ease both;
}

.fx-tier-singularity .fx-chroma {
  display: block;
}

.fx-vignette {
  z-index: 6;
  opacity: 0;
  background:
    radial-gradient(circle at center, transparent 0 46%, rgba(2, 6, 23, 0.18) 66%, rgba(2, 6, 23, 0.58) 100%),
    linear-gradient(90deg, color-mix(in srgb, var(--fx-secondary) 12%, transparent), transparent 26% 74%, color-mix(in srgb, var(--fx-accent) 12%, transparent));
  animation: fx-vignette var(--fx-ms) ease both;
}

/* ── 世界回收：exit 阶段一道向心收束环 ── */
.fx-restore {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 6;
  width: 120vmin;
  height: 120vmin;
  border: 1px solid color-mix(in srgb, var(--fx-accent) 54%, rgba(255, 255, 255, 0.6));
  border-radius: 50%;
  opacity: 0;
  transform: translate(-50%, -50%) scale(1.1);
  animation: fx-restore var(--fx-exit-ms) cubic-bezier(0.7, 0, 0.84, 0) var(--fx-exit-delay) both;
}

/* ── 电影黑边：仅奇点级 ── */
.fx-cinebar {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 7;
  height: 7vh;
  display: none;
  background: linear-gradient(180deg, rgba(1, 3, 10, 0.96), rgba(1, 3, 10, 0.88));
}

.fx-tier-singularity .fx-cinebar {
  display: block;
}

.fx-cinebar.is-top {
  top: 0;
  transform-origin: center top;
  animation: fx-cinebar var(--fx-ms) ease both;
}

.fx-cinebar.is-bottom {
  bottom: 0;
  transform-origin: center bottom;
  animation: fx-cinebar var(--fx-ms) ease both;
}

/* ── 协议 HUD：战术级起显示，奇点级强化 ── */
.fx-hud {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: none;
  color: color-mix(in srgb, var(--fx-accent) 76%, #fff);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.fx-tier-tactical .fx-hud,
.fx-tier-singularity .fx-hud {
  display: block;
}

.fx-hud-bracket {
  position: absolute;
  width: 34px;
  height: 34px;
  border: 2px solid color-mix(in srgb, var(--fx-accent) 62%, transparent);
  opacity: 0;
  animation: fx-hud-in var(--fx-ms) ease both;
}

.fx-hud-bracket.is-tl {
  left: 3.2%;
  top: 4.4%;
  border-right: 0;
  border-bottom: 0;
}

.fx-hud-bracket.is-tr {
  right: 3.2%;
  top: 4.4%;
  border-left: 0;
  border-bottom: 0;
}

.fx-hud-bracket.is-bl {
  left: 3.2%;
  bottom: 4.4%;
  border-right: 0;
  border-top: 0;
}

.fx-hud-bracket.is-br {
  right: 3.2%;
  bottom: 4.4%;
  border-left: 0;
  border-top: 0;
}

.fx-tier-singularity .fx-hud-bracket.is-tl,
.fx-tier-singularity .fx-hud-bracket.is-tr {
  top: calc(7vh + 2.2%);
}

.fx-tier-singularity .fx-hud-bracket.is-bl,
.fx-tier-singularity .fx-hud-bracket.is-br {
  bottom: calc(7vh + 2.2%);
}

.fx-hud-protocol {
  position: absolute;
  left: 4.6%;
  top: 6.4%;
  display: grid;
  gap: 4px;
  text-shadow: 0 0 18px color-mix(in srgb, var(--fx-accent) 42%, transparent);
  opacity: 0;
  animation: fx-hud-in var(--fx-ms) ease both;
}

.fx-tier-singularity .fx-hud-protocol {
  top: calc(7vh + 3.6%);
}

.fx-hud-protocol small {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.34em;
  opacity: 0.78;
}

.fx-hud-protocol strong {
  font-size: 21px;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: #fff;
  text-shadow:
    0 0 22px color-mix(in srgb, var(--fx-accent) 66%, transparent),
    0 0 46px color-mix(in srgb, var(--fx-secondary) 36%, transparent);
}

.fx-apex .fx-hud-protocol strong {
  background: linear-gradient(92deg, #fff 0%, color-mix(in srgb, var(--fx-accent) 74%, #fff) 46%, color-mix(in srgb, var(--fx-secondary) 76%, #fff) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.fx-hud-protocol span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  opacity: 0.85;
}

.fx-hud-protocol em {
  border: 1px solid color-mix(in srgb, var(--fx-secondary) 62%, transparent);
  border-radius: 3px;
  background: color-mix(in srgb, var(--fx-secondary) 16%, transparent);
  color: color-mix(in srgb, var(--fx-secondary) 78%, #fff);
  font-size: 9px;
  font-style: normal;
  letter-spacing: 0.3em;
  padding: 2px 6px 2px 8px;
  animation: fx-apex-pulse 1.4s ease-in-out infinite;
}

.fx-hud-status {
  position: absolute;
  right: 4.6%;
  bottom: 6.2%;
  display: grid;
  justify-items: end;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.26em;
  text-shadow: 0 0 16px color-mix(in srgb, var(--fx-accent) 40%, transparent);
}

.fx-tier-singularity .fx-hud-status {
  bottom: calc(7vh + 3.2%);
}

.fx-hud-status span {
  grid-area: 1 / 1;
}

.fx-hud-status-run {
  opacity: 0;
  animation: fx-status-run var(--fx-ms) ease both;
}

.fx-hud-status-done {
  color: #fff;
  opacity: 0;
  animation: fx-status-done var(--fx-exit-ms) ease var(--fx-exit-delay) both;
}

/* ── 起幕白闪 ── */
.fx-flash {
  z-index: 9;
  opacity: 0;
  background:
    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.92), color-mix(in srgb, var(--fx-accent) 36%, transparent) 22%, transparent 48%);
  mix-blend-mode: screen;
  animation: fx-flash 1.1s cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* ── 分级压制系数 ── */
.fx-tier-tactical {
  --fx-grain-o: 0.12;
  --fx-scanline-o: 0.3;
  --fx-vignette-o: 0.84;
}

.fx-tier-singularity {
  --fx-grain-o: 0.17;
  --fx-scanline-o: 0.38;
  --fx-vignette-o: 1;
}

/* ── 关键帧 ── */
@keyframes fx-backdrop {
  0%,
  100% {
    opacity: 0;
  }
  10%,
  84% {
    opacity: 1;
  }
}

@keyframes fx-bloom {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.82) rotate(0deg);
  }
  16%,
  82% {
    opacity: 1;
  }
  54% {
    transform: scale(1.14) rotate(10deg);
  }
}

@keyframes fx-shockwave {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.22);
  }
  14% {
    opacity: 0.92;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(5.6);
  }
}

@keyframes fx-inject {
  0% {
    opacity: 0;
    transform: rotate(var(--beam-rotate)) scaleX(1.04);
  }
  22% {
    opacity: 0.95;
  }
  100% {
    opacity: 0;
    transform: rotate(var(--beam-rotate)) scaleX(0.02);
  }
}

@keyframes fx-grain {
  0%,
  100% {
    opacity: 0;
    transform: scale(1);
  }
  22%,
  78% {
    opacity: var(--fx-grain-o);
    transform: scale(1.02);
  }
}

@keyframes fx-scanlines {
  0% {
    opacity: 0;
    background-position: 0 0, -120px 0;
  }
  18%,
  82% {
    opacity: var(--fx-scanline-o);
  }
  100% {
    opacity: 0;
    background-position: 0 42px, 220px 0;
  }
}

@keyframes fx-chroma {
  0%,
  100% {
    opacity: 0;
    transform: translateX(0);
  }
  8% {
    opacity: 0.85;
    transform: translateX(-2px);
  }
  12% {
    opacity: 0.3;
    transform: translateX(2px);
  }
  16%,
  50% {
    opacity: 0.22;
    transform: translateX(0);
  }
  56% {
    opacity: 0.8;
    transform: translateX(2px);
  }
  60% {
    opacity: 0.28;
    transform: translateX(-1px);
  }
  64%,
  84% {
    opacity: 0.2;
    transform: translateX(0);
  }
}

@keyframes fx-vignette {
  0%,
  100% {
    opacity: 0;
  }
  14%,
  86% {
    opacity: var(--fx-vignette-o);
  }
}

@keyframes fx-restore {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.1);
  }
  18% {
    opacity: 0.8;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.06);
  }
}

@keyframes fx-cinebar {
  0% {
    transform: scaleY(0);
  }
  9%,
  82% {
    transform: scaleY(1);
  }
  100% {
    transform: scaleY(0);
  }
}

@keyframes fx-hud-in {
  0% {
    opacity: 0;
    transform: translateY(6px);
  }
  10%,
  84% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-4px);
  }
}

@keyframes fx-apex-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--fx-secondary) 34%, transparent);
  }
  50% {
    box-shadow: 0 0 14px 1px color-mix(in srgb, var(--fx-secondary) 44%, transparent);
  }
}

@keyframes fx-status-run {
  0%,
  6% {
    opacity: 0;
  }
  12%,
  80% {
    opacity: 0.9;
  }
  84%,
  100% {
    opacity: 0;
  }
}

@keyframes fx-status-done {
  0%,
  30% {
    opacity: 0;
    transform: translateY(4px);
  }
  44%,
  88% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
  }
}

@keyframes fx-flash {
  0% {
    opacity: 0;
    transform: scale(0.6);
  }
  8% {
    opacity: 0.9;
  }
  100% {
    opacity: 0;
    transform: scale(1.7);
  }
}

/* ── 相机预设 ── */
@keyframes fx-cam-still {
  0% {
    transform: scale(1.015);
  }
  14%,
  100% {
    transform: scale(1);
  }
}

@keyframes fx-cam-drift {
  0% {
    transform: scale(1) translateY(0);
  }
  55% {
    transform: scale(1.045) translateY(-0.4%);
  }
  100% {
    transform: scale(1.06) translateY(-0.7%);
  }
}

@keyframes fx-cam-dolly {
  0% {
    transform: scale(1.09);
  }
  18% {
    transform: scale(1);
  }
  74% {
    transform: scale(1.025);
  }
  100% {
    transform: scale(1.07);
  }
}

@keyframes fx-cam-sweep {
  0% {
    transform: scale(1.08) translateX(-1.6%);
  }
  22% {
    transform: scale(1.03) translateX(-0.6%);
  }
  76% {
    transform: scale(1.03) translateX(0.8%);
  }
  100% {
    transform: scale(1.09) translateX(1.8%);
  }
}

@keyframes fx-cam-ascend {
  0% {
    transform: scale(1.06) translateY(1.8%);
  }
  20% {
    transform: scale(1.01) translateY(0.6%);
  }
  72% {
    transform: scale(1.03) translateY(-1%);
  }
  100% {
    transform: scale(1.1) translateY(-2.6%);
  }
}

@keyframes fx-cam-warp {
  0% {
    transform: scale(1.14);
    filter: blur(0);
  }
  24% {
    transform: scale(0.96);
    filter: blur(1.5px);
  }
  46% {
    transform: scale(1.08);
    filter: blur(0);
  }
  66% {
    transform: scale(0.98);
    filter: blur(2.5px);
  }
  84% {
    transform: scale(1.04);
    filter: blur(0);
  }
  100% {
    transform: scale(1.16);
    filter: blur(3px);
  }
}

@keyframes fx-cam-punch {
  0% {
    transform: scale(1.04);
  }
  12% {
    transform: scale(1);
  }
  30% {
    transform: scale(1.005);
  }
  38% {
    transform: scale(1.11);
  }
  46% {
    transform: scale(1.035);
  }
  58% {
    transform: scale(1.085);
  }
  72% {
    transform: scale(1.03);
  }
  100% {
    transform: scale(1.08);
  }
}

@keyframes fx-cam-collapse {
  0% {
    transform: scale(1);
  }
  42% {
    transform: scale(1.09);
  }
  58% {
    transform: scale(1.2);
  }
  64% {
    transform: scale(0.94);
  }
  74% {
    transform: scale(1.06);
  }
  100% {
    transform: scale(1.12);
  }
}

@keyframes fx-shake {
  0%,
  13%,
  31%,
  51%,
  77%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  16% {
    transform: translate3d(var(--fx-shake-amp), calc(var(--fx-shake-amp) * -0.7), 0);
  }
  19% {
    transform: translate3d(calc(var(--fx-shake-amp) * -0.8), var(--fx-shake-amp), 0);
  }
  23% {
    transform: translate3d(calc(var(--fx-shake-amp) * 0.6), calc(var(--fx-shake-amp) * 0.5), 0);
  }
  27% {
    transform: translate3d(calc(var(--fx-shake-amp) * -0.4), calc(var(--fx-shake-amp) * -0.3), 0);
  }
  55% {
    transform: translate3d(calc(var(--fx-shake-amp) * -0.9), calc(var(--fx-shake-amp) * 0.6), 0);
  }
  59% {
    transform: translate3d(var(--fx-shake-amp), calc(var(--fx-shake-amp) * -0.5), 0);
  }
  64% {
    transform: translate3d(calc(var(--fx-shake-amp) * -0.5), calc(var(--fx-shake-amp) * -0.6), 0);
  }
  69% {
    transform: translate3d(calc(var(--fx-shake-amp) * 0.3), calc(var(--fx-shake-amp) * 0.4), 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .reward-effect-overlay,
  .reward-effect-overlay *,
  .reward-effect-overlay *::before,
  .reward-effect-overlay *::after {
    animation-duration: 1ms !important;
    animation-delay: 0ms !important;
  }
}
</style>
