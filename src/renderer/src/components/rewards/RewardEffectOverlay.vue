<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';
import AuroraEffect from '@/components/rewards/effects/AuroraEffect.vue';
import BirthdayEffect from '@/components/rewards/effects/BirthdayEffect.vue';
import BreathingUiEffect from '@/components/rewards/effects/BreathingUiEffect.vue';
import CockpitHudEffect from '@/components/rewards/effects/CockpitHudEffect.vue';
import CityScanEffect from '@/components/rewards/effects/CityScanEffect.vue';
import CodeMaterializeEffect from '@/components/rewards/effects/CodeMaterializeEffect.vue';
import CrownEffect from '@/components/rewards/effects/CrownEffect.vue';
import CyberDataFlowEffect from '@/components/rewards/effects/CyberDataFlowEffect.vue';
import DataStormEffect from '@/components/rewards/effects/DataStormEffect.vue';
import DroneFlyoverEffect from '@/components/rewards/effects/DroneFlyoverEffect.vue';
import EnergyRingEffect from '@/components/rewards/effects/EnergyRingEffect.vue';
import FireworksEffect from '@/components/rewards/effects/FireworksEffect.vue';
import FloatingHudEffect from '@/components/rewards/effects/FloatingHudEffect.vue';
import GlassRefractionEffect from '@/components/rewards/effects/GlassRefractionEffect.vue';
import HoloCoreEffect from '@/components/rewards/effects/HoloCoreEffect.vue';
import LaserGridEffect from '@/components/rewards/effects/LaserGridEffect.vue';
import MatrixEffect from '@/components/rewards/effects/MatrixEffect.vue';
import NeonDriveEffect from '@/components/rewards/effects/NeonDriveEffect.vue';
import NeuralThinkEffect from '@/components/rewards/effects/NeuralThinkEffect.vue';
import QuantumGateEffect from '@/components/rewards/effects/QuantumGateEffect.vue';
import QuantumFlickerEffect from '@/components/rewards/effects/QuantumFlickerEffect.vue';
import RainGlassEffect from '@/components/rewards/effects/RainGlassEffect.vue';
import SpaceJumpEffect from '@/components/rewards/effects/SpaceJumpEffect.vue';
import SparkleEffect from '@/components/rewards/effects/SparkleEffect.vue';
import TimeFoldEffect from '@/components/rewards/effects/TimeFoldEffect.vue';
import VelocityTrailEffect from '@/components/rewards/effects/VelocityTrailEffect.vue';
import WarpEffect from '@/components/rewards/effects/WarpEffect.vue';
import type { RewardEffectKey } from '@/components/rewards/rewardEffects';

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
};

const activeComponent = computed(() => (props.effect ? effectComponentMap[props.effect] : null));
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.effect && activeComponent"
      :key="`${props.effect}-${props.seed}`"
      class="reward-effect-overlay"
      :class="`is-${props.effect}`"
      aria-hidden="true"
    >
      <div class="reward-effect-backdrop" />
      <div class="reward-effect-bloom" />
      <span class="reward-effect-shockwave" />
      <span class="reward-effect-shockwave is-delayed" />
      <div class="reward-effect-grain" />
      <div class="reward-effect-scanlines" />
      <div class="reward-effect-vignette" />
      <div class="reward-effect-flash" />
      <component :is="activeComponent" class="reward-effect-content" />
    </div>
  </Teleport>
</template>

<style>
.reward-effect-overlay {
  --reward-accent: #60a5fa;
  --reward-secondary: #f472b6;
  position: fixed;
  inset: 0;
  z-index: 10000;
  pointer-events: none;
  overflow: hidden;
  isolation: isolate;
}

.reward-effect-backdrop,
.reward-effect-bloom,
.reward-effect-grain,
.reward-effect-scanlines,
.reward-effect-vignette,
.reward-effect-flash {
  position: absolute;
  inset: 0;
}

.reward-effect-backdrop {
  z-index: -4;
  opacity: 0;
  animation: reward-backdrop 4.2s ease both;
}

.reward-effect-bloom {
  z-index: -3;
  opacity: 0;
  background:
    radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--reward-accent) 34%, transparent), transparent 31%),
    radial-gradient(circle at 28% 28%, color-mix(in srgb, var(--reward-secondary) 18%, transparent), transparent 26%),
    radial-gradient(circle at 76% 72%, color-mix(in srgb, var(--reward-accent) 20%, transparent), transparent 30%);
  filter: blur(20px) saturate(1.18);
  mix-blend-mode: screen;
  transform: scale(0.82);
  animation: reward-bloom 4.8s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.reward-effect-content {
  z-index: 2;
}

.reward-effect-shockwave {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 1;
  width: 22vmin;
  height: 22vmin;
  border: 1px solid color-mix(in srgb, var(--reward-accent) 68%, rgba(255, 255, 255, 0.7));
  border-radius: 50%;
  box-shadow:
    inset 0 0 24px color-mix(in srgb, var(--reward-accent) 20%, transparent),
    0 0 42px color-mix(in srgb, var(--reward-accent) 36%, transparent);
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.22);
  animation: reward-shockwave 1.8s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.reward-effect-shockwave.is-delayed {
  animation-delay: 260ms;
}

.reward-effect-grain {
  z-index: 4;
  opacity: 0.1;
  background-image:
    radial-gradient(circle at 28% 24%, rgba(255, 255, 255, 0.2) 0 1px, transparent 1.5px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
    linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px);
  background-size: 18px 18px, 42px 42px, 42px 42px;
  mask-image: radial-gradient(circle at center, #000 0 62%, transparent 78%);
  mix-blend-mode: overlay;
  animation: reward-grain 4.2s ease both;
}

.reward-effect-scanlines {
  z-index: 5;
  opacity: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, transparent 0 48%, color-mix(in srgb, var(--reward-accent) 16%, transparent), transparent 52%);
  background-size: 100% 5px, 180px 100%;
  mix-blend-mode: soft-light;
  animation: reward-scanlines 4.8s ease both;
}

.reward-effect-vignette {
  z-index: 6;
  opacity: 0;
  background:
    radial-gradient(circle at center, transparent 0 46%, rgba(2, 6, 23, 0.18) 66%, rgba(2, 6, 23, 0.58) 100%),
    linear-gradient(90deg, color-mix(in srgb, var(--reward-secondary) 12%, transparent), transparent 26% 74%, color-mix(in srgb, var(--reward-accent) 12%, transparent));
  animation: reward-vignette 4.8s ease both;
}

.reward-effect-flash {
  z-index: 7;
  opacity: 0;
  background:
    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.92), color-mix(in srgb, var(--reward-accent) 36%, transparent) 22%, transparent 48%);
  mix-blend-mode: screen;
  animation: reward-flash 1.1s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.reward-effect-overlay.is-fireworks,
.reward-effect-overlay.is-sparkle {
  --reward-accent: #f59e0b;
  --reward-secondary: #60a5fa;
}

.reward-effect-overlay.is-birthday {
  --reward-accent: #ec4899;
  --reward-secondary: #fbbf24;
}

.reward-effect-overlay.is-aurora,
.reward-effect-overlay.is-breathingUi {
  --reward-accent: #22c55e;
  --reward-secondary: #38bdf8;
}

.reward-effect-overlay.is-warp,
.reward-effect-overlay.is-timeFold,
.reward-effect-overlay.is-energyRing {
  --reward-accent: #60a5fa;
  --reward-secondary: #2dd4bf;
}

.reward-effect-overlay.is-matrix,
.reward-effect-overlay.is-codeMaterialize,
.reward-effect-overlay.is-dataStorm {
  --reward-accent: #34d399;
  --reward-secondary: #22d3ee;
}

.reward-effect-overlay.is-crown {
  --reward-accent: #facc15;
  --reward-secondary: #f97316;
}

.reward-effect-overlay.is-neonDrive {
  --reward-accent: #f472b6;
  --reward-secondary: #22d3ee;
}

.reward-effect-overlay.is-cockpit,
.reward-effect-overlay.is-floatingHud,
.reward-effect-overlay.is-cyberDataFlow,
.reward-effect-overlay.is-cityScan,
.reward-effect-overlay.is-rainGlass,
.reward-effect-overlay.is-droneFlyover,
.reward-effect-overlay.is-glassRefraction {
  --reward-accent: #22d3ee;
  --reward-secondary: #a78bfa;
}

.reward-effect-overlay.is-holoCore,
.reward-effect-overlay.is-quantumGate,
.reward-effect-overlay.is-neuralThink,
.reward-effect-overlay.is-quantumFlicker,
.reward-effect-overlay.is-spaceJump {
  --reward-accent: #a78bfa;
  --reward-secondary: #22d3ee;
}

.reward-effect-overlay.is-laserGrid,
.reward-effect-overlay.is-velocityTrail {
  --reward-accent: #2dd4bf;
  --reward-secondary: #f472b6;
}

.reward-effect-overlay.is-fireworks .reward-effect-backdrop {
  background:
    radial-gradient(circle at 50% 72%, rgba(59, 108, 246, 0.18), transparent 38%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.56), rgba(15, 23, 42, 0.18));
}

.reward-effect-overlay.is-birthday .reward-effect-backdrop {
  animation-duration: 4.6s;
  background:
    radial-gradient(circle at 50% 46%, rgba(236, 72, 153, 0.22), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.3), rgba(59, 108, 246, 0.1));
}

.reward-effect-overlay.is-sparkle .reward-effect-backdrop {
  background:
    radial-gradient(circle at 50% 48%, rgba(251, 191, 36, 0.18), transparent 36%),
    linear-gradient(120deg, rgba(255, 255, 255, 0.12), rgba(251, 191, 36, 0.1));
}

.reward-effect-overlay.is-aurora .reward-effect-backdrop {
  animation-duration: 5.2s;
  background:
    linear-gradient(180deg, rgba(2, 6, 23, 0.7), rgba(15, 23, 42, 0.22)),
    radial-gradient(circle at 50% 100%, rgba(34, 197, 94, 0.18), transparent 46%);
}

.reward-effect-overlay.is-warp .reward-effect-backdrop {
  background:
    radial-gradient(circle at center, rgba(96, 165, 250, 0.26), rgba(15, 23, 42, 0.5) 45%, rgba(15, 23, 42, 0.12));
}

.reward-effect-overlay.is-matrix .reward-effect-backdrop {
  background:
    linear-gradient(180deg, rgba(2, 6, 23, 0.66), rgba(6, 78, 59, 0.2)),
    radial-gradient(circle at center, rgba(52, 211, 153, 0.14), transparent 48%);
}

.reward-effect-overlay.is-crown .reward-effect-backdrop {
  animation-duration: 4.8s;
  background:
    radial-gradient(circle at 50% 44%, rgba(250, 204, 21, 0.22), transparent 36%),
    linear-gradient(180deg, rgba(66, 32, 6, 0.4), rgba(250, 204, 21, 0.08));
}

.reward-effect-overlay.is-neonDrive .reward-effect-backdrop {
  animation-duration: 5.2s;
  background:
    radial-gradient(circle at 50% 70%, rgba(244, 114, 182, 0.24), transparent 34%),
    linear-gradient(180deg, rgba(2, 6, 23, 0.72), rgba(76, 29, 149, 0.24));
}

.reward-effect-overlay.is-cockpit .reward-effect-backdrop {
  animation-duration: 5.2s;
  background:
    radial-gradient(circle at 50% 50%, rgba(34, 211, 238, 0.18), transparent 42%),
    linear-gradient(180deg, rgba(8, 47, 73, 0.56), rgba(2, 6, 23, 0.26));
}

.reward-effect-overlay.is-holoCore .reward-effect-backdrop {
  animation-duration: 5.4s;
  background:
    radial-gradient(circle at 50% 50%, rgba(167, 139, 250, 0.24), transparent 36%),
    linear-gradient(180deg, rgba(30, 27, 75, 0.58), rgba(2, 6, 23, 0.22));
}

.reward-effect-overlay.is-laserGrid .reward-effect-backdrop {
  animation-duration: 5s;
  background:
    radial-gradient(circle at 50% 62%, rgba(45, 212, 191, 0.2), transparent 38%),
    linear-gradient(180deg, rgba(6, 78, 59, 0.42), rgba(2, 6, 23, 0.2));
}

.reward-effect-overlay.is-quantumGate .reward-effect-backdrop {
  animation-duration: 5.6s;
  background:
    radial-gradient(circle at center, rgba(129, 140, 248, 0.3), transparent 32%),
    linear-gradient(180deg, rgba(49, 46, 129, 0.62), rgba(2, 6, 23, 0.22));
}

.reward-effect-overlay.is-cyberDataFlow .reward-effect-backdrop {
  animation-duration: 4.8s;
  background:
    radial-gradient(circle at 50% 50%, rgba(34, 211, 238, 0.22), transparent 42%),
    linear-gradient(135deg, rgba(2, 6, 23, 0.78), rgba(76, 29, 149, 0.22));
}

.reward-effect-overlay.is-velocityTrail .reward-effect-backdrop {
  animation-duration: 4.8s;
  background:
    radial-gradient(circle at 52% 68%, rgba(14, 165, 233, 0.24), transparent 36%),
    linear-gradient(180deg, rgba(2, 6, 23, 0.72), rgba(12, 74, 110, 0.22));
}

.reward-effect-overlay.is-cityScan .reward-effect-backdrop {
  animation-duration: 4.8s;
  background:
    linear-gradient(180deg, rgba(8, 47, 73, 0.68), rgba(2, 6, 23, 0.18)),
    radial-gradient(circle at 50% 80%, rgba(45, 212, 191, 0.2), transparent 44%);
}

.reward-effect-overlay.is-floatingHud .reward-effect-backdrop {
  animation-duration: 5.2s;
  background:
    radial-gradient(circle at center, rgba(34, 211, 238, 0.2), transparent 46%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.62), rgba(8, 47, 73, 0.22));
}

.reward-effect-overlay.is-neuralThink .reward-effect-backdrop {
  animation-duration: 5.2s;
  background:
    radial-gradient(circle at 50% 45%, rgba(167, 139, 250, 0.24), transparent 40%),
    linear-gradient(180deg, rgba(30, 27, 75, 0.64), rgba(2, 6, 23, 0.2));
}

.reward-effect-overlay.is-timeFold .reward-effect-backdrop {
  animation-duration: 4.9s;
  background:
    radial-gradient(circle at center, rgba(147, 197, 253, 0.22), transparent 38%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.64), rgba(30, 64, 175, 0.16));
}

.reward-effect-overlay.is-rainGlass .reward-effect-backdrop {
  animation-duration: 5.4s;
  background:
    radial-gradient(circle at 30% 20%, rgba(56, 189, 248, 0.2), transparent 34%),
    linear-gradient(180deg, rgba(2, 6, 23, 0.78), rgba(30, 41, 59, 0.34));
}

.reward-effect-overlay.is-codeMaterialize .reward-effect-backdrop {
  animation-duration: 5s;
  background:
    radial-gradient(circle at 62% 62%, rgba(34, 197, 94, 0.2), transparent 40%),
    linear-gradient(180deg, rgba(2, 6, 23, 0.7), rgba(20, 83, 45, 0.18));
}

.reward-effect-overlay.is-energyRing .reward-effect-backdrop {
  animation-duration: 4.8s;
  background:
    radial-gradient(circle at center, rgba(96, 165, 250, 0.28), transparent 36%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.62), rgba(45, 212, 191, 0.14));
}

.reward-effect-overlay.is-droneFlyover .reward-effect-backdrop {
  animation-duration: 5.2s;
  background:
    radial-gradient(circle at 50% 78%, rgba(45, 212, 191, 0.2), transparent 42%),
    linear-gradient(180deg, rgba(12, 74, 110, 0.58), rgba(2, 6, 23, 0.24));
}

.reward-effect-overlay.is-quantumFlicker .reward-effect-backdrop {
  animation-duration: 4.8s;
  background:
    radial-gradient(circle at 50% 50%, rgba(196, 181, 253, 0.28), transparent 34%),
    linear-gradient(180deg, rgba(49, 46, 129, 0.62), rgba(2, 6, 23, 0.22));
}

.reward-effect-overlay.is-breathingUi .reward-effect-backdrop {
  animation-duration: 5.6s;
  background:
    radial-gradient(circle at center, rgba(34, 197, 94, 0.2), transparent 42%),
    linear-gradient(180deg, rgba(20, 83, 45, 0.48), rgba(2, 6, 23, 0.18));
}

.reward-effect-overlay.is-dataStorm .reward-effect-backdrop {
  animation-duration: 5s;
  background:
    radial-gradient(circle at 50% 62%, rgba(45, 212, 191, 0.24), transparent 40%),
    linear-gradient(180deg, rgba(6, 78, 59, 0.46), rgba(2, 6, 23, 0.24));
}

.reward-effect-overlay.is-glassRefraction .reward-effect-backdrop {
  animation-duration: 5.2s;
  background:
    radial-gradient(circle at 30% 24%, rgba(125, 249, 255, 0.16), transparent 34%),
    radial-gradient(circle at 72% 78%, rgba(244, 114, 182, 0.14), transparent 34%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.52), rgba(2, 6, 23, 0.18));
}

.reward-effect-overlay.is-spaceJump .reward-effect-backdrop {
  animation-duration: 5s;
  background:
    radial-gradient(circle at center, rgba(129, 140, 248, 0.3), rgba(15, 23, 42, 0.56) 42%, rgba(15, 23, 42, 0.14)),
    linear-gradient(180deg, rgba(30, 27, 75, 0.58), rgba(2, 6, 23, 0.24));
}

@keyframes reward-backdrop {
  0%,
  100% {
    opacity: 0;
  }
  10%,
  84% {
    opacity: 1;
  }
}

@keyframes reward-bloom {
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

@keyframes reward-shockwave {
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

@keyframes reward-grain {
  0%,
  100% {
    opacity: 0;
    transform: scale(1);
  }
  22%,
  78% {
    opacity: 0.16;
    transform: scale(1.02);
  }
}

@keyframes reward-scanlines {
  0%,
  100% {
    opacity: 0;
    background-position: 0 0, -120px 0;
  }
  18%,
  82% {
    opacity: 0.34;
  }
  100% {
    background-position: 0 42px, 220px 0;
  }
}

@keyframes reward-vignette {
  0%,
  100% {
    opacity: 0;
  }
  14%,
  86% {
    opacity: 1;
  }
}

@keyframes reward-flash {
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

@media (prefers-reduced-motion: reduce) {
  .reward-effect-backdrop,
  .reward-effect-bloom,
  .reward-effect-shockwave,
  .reward-effect-grain,
  .reward-effect-scanlines,
  .reward-effect-vignette,
  .reward-effect-flash,
  .reward-effect-overlay *,
  .reward-effect-overlay *::before,
  .reward-effect-overlay *::after {
    animation-duration: 1ms !important;
    animation-delay: 0ms !important;
  }
}
</style>
