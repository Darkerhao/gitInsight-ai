<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Radiation } from 'lucide-vue-next';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import { Explosion } from './Explosion/Explosion';

const props = defineProps<{ seed?: number }>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const webglFailed = ref(false);
let explosion: Explosion | null = null;

function cleanup() {
  explosion?.dispose();
  explosion = null;
}

function initExplosion() {
  cleanup();
  const canvas = canvasRef.value;
  if (!canvas) return;

  try {
    webglFailed.value = false;
    explosion = new Explosion({
      canvas,
      seed: props.seed ?? 1,
      durationMs: EFFECT_DURATIONS.littleBoy,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      quality: 'high',
    });
    explosion.start();
  } catch (error) {
    console.error('LittleBoyEffect Three.js fallback:', error);
    webglFailed.value = true;
    cleanup();
  }
}

onMounted(initExplosion);
watch(() => props.seed, initExplosion);
onBeforeUnmount(cleanup);
</script>

<template>
  <div class="little-boy-effect">
    <canvas ref="canvasRef" class="lb-three-canvas" aria-hidden="true" />
    <div class="lb-heat-haze" aria-hidden="true" />
    <div class="lb-whiteout" aria-hidden="true" />
    <div class="lb-annihilation-front" aria-hidden="true" />
    <div class="lb-ground-burn" aria-hidden="true" />
    <div class="lb-cityline" aria-hidden="true" />
    <div class="lb-scanlines" aria-hidden="true" />
    <div class="lb-vignette" aria-hidden="true" />

    <div v-if="webglFailed" class="lb-fallback-cloud" aria-hidden="true">
      <span v-for="puff in 18" :key="puff" />
    </div>

    <div class="lb-hud" aria-hidden="true">
      <span class="lb-hud-corner is-left-top" />
      <span class="lb-hud-corner is-right-top" />
      <span class="lb-hud-corner is-left-bottom" />
      <span class="lb-hud-corner is-right-bottom" />
      <span class="lb-reticle" />
      <span class="lb-readout is-left">THERMAL BLOOM</span>
      <span class="lb-readout is-right">SHOCK FRONT</span>
    </div>

    <div class="lb-alert-band is-top" aria-hidden="true"><span>⚠ AIRBURST PROTOCOL ENGAGED · SHOCKFRONT INBOUND</span></div>
    <div class="lb-alert-band is-bottom" aria-hidden="true"><span>EVACUATION WINDOW CLOSED · T-00:00:01</span></div>

    <div class="lb-telemetry" aria-hidden="true">
      <span>YIELD ....... 15 KT</span>
      <span>DET ALT ..... 580 M</span>
      <span>SHOCK ....... MACH 3.1</span>
    </div>

    <div class="lb-title">
      <Radiation :size="44" :stroke-width="1.35" />
      <strong>小男孩</strong>
      <small>LITTLE BOY · MK-I AIRBURST DELIVERY</small>
    </div>

    <div class="lb-destruction-status" aria-hidden="true">
      <strong>TOTAL ANNIHILATION</strong>
      <span>STRUCTURAL SURVIVAL 0% · THERMAL FRONT COMPLETE</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.little-boy-effect {
  @include effect-stage(hidden);
  background:
    radial-gradient(circle at 50% 66%, rgba(255, 247, 237, 0.18), transparent 28%),
    radial-gradient(circle at 50% 24%, rgba(14, 165, 233, 0.08), transparent 36%),
    linear-gradient(180deg, rgba(2, 6, 23, 0.28), rgba(69, 10, 10, 0.42));
  animation: lb-camera 6.6s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.lb-three-canvas {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: block;
  /* 末段淡出，作为残帧防线：RAF 停止后即便画面冻结也会随 overlay 消失而不可见 */
  animation: lb-canvas-fade 6.6s ease both;
}

@keyframes lb-canvas-fade {
  0%, 86% { opacity: 1; }
  100% { opacity: 0; }
}

.lb-heat-haze,
.lb-whiteout,
.lb-annihilation-front,
.lb-ground-burn,
.lb-cityline,
.lb-scanlines,
.lb-vignette,
.lb-hud,
.lb-alert-band,
.lb-telemetry,
.lb-title,
.lb-fallback-cloud {
  position: absolute;
  pointer-events: none;
}

/* 地景剪影：城市天际线 —— 白闪过曝 → 冲击掀翻 → 坍缩抹除 */
.lb-cityline {
  left: -2%;
  right: -2%;
  bottom: 27%;
  height: 13vh;
  z-index: 2;
  clip-path: polygon(
    0 100%, 0 58%, 4% 58%, 4% 34%, 8% 34%, 8% 60%, 12% 60%, 12% 22%, 16% 22%, 16% 52%,
    21% 52%, 21% 38%, 26% 38%, 26% 64%, 31% 64%, 31% 16%, 35% 16%, 35% 48%, 40% 48%, 40% 30%,
    45% 30%, 45% 58%, 50% 58%, 50% 10%, 54% 10%, 54% 44%, 59% 44%, 59% 26%, 64% 26%, 64% 56%,
    69% 56%, 69% 20%, 73% 20%, 73% 50%, 78% 50%, 78% 34%, 83% 34%, 83% 62%, 88% 62%, 88% 28%,
    92% 28%, 92% 54%, 96% 54%, 96% 40%, 100% 40%, 100% 100%
  );
  background:
    repeating-linear-gradient(0deg, rgba(254, 215, 170, 0.07) 0 2px, transparent 2px 9px),
    repeating-linear-gradient(90deg, rgba(2, 6, 23, 0.2) 0 3px, transparent 3px 26px),
    linear-gradient(180deg, rgba(2, 6, 23, 0.86), rgba(12, 10, 9, 0.96));
  transform-origin: 50% 100%;
  animation: lb-cityline 6.6s ease both;
}

/* 警示条：上下双轨危险纹，爆闪期频闪告警后被冲击吹散 */
.lb-alert-band {
  left: 0;
  right: 0;
  height: 24px;
  z-index: 9;
  display: grid;
  place-items: center;
  border-top: 1px solid rgba(254, 215, 170, 0.32);
  border-bottom: 1px solid rgba(254, 215, 170, 0.32);
  background: repeating-linear-gradient(45deg, rgba(251, 146, 60, 0.2) 0 14px, rgba(2, 6, 23, 0.55) 14px 28px);
}

.lb-alert-band span {
  color: #fed7aa;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.3em;
  text-shadow: 0 0 12px rgba(249, 115, 22, 0.66);
  white-space: nowrap;
}

.lb-alert-band.is-top {
  top: 3.2%;
  animation: lb-alert-top 6.6s ease both;
}

.lb-alert-band.is-bottom {
  bottom: 3.2%;
  animation: lb-alert-bottom 6.6s ease both;
}

/* 侧栏遥测：等宽微文案，爆后读数驻留 */
.lb-telemetry {
  left: 6%;
  bottom: 19%;
  z-index: 9;
  display: grid;
  gap: 5px;
  color: rgba(255, 237, 213, 0.78);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-shadow: 0 0 14px rgba(249, 115, 22, 0.5);
  animation: lb-telemetry 6.6s ease both;
}

.lb-annihilation-front {
  left: 50%;
  top: 70%;
  z-index: 3;
  width: 24vmin;
  aspect-ratio: 1;
  border: 1px solid rgba(255, 190, 118, 0.62);
  border-radius: 50%;
  box-shadow:
    0 0 8px rgba(255, 237, 213, 0.34),
    0 0 18px rgba(249, 115, 22, 0.3),
    inset 0 0 12px rgba(255, 247, 237, 0.12);
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.08);
  animation: lb-annihilation-front 6.6s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.lb-ground-burn {
  inset: 48% -12% -20%;
  z-index: 3;
  background:
    radial-gradient(ellipse at 50% 82%, rgba(255, 237, 213, 0.28), rgba(249, 115, 22, 0.18) 18%, rgba(127, 29, 29, 0.22) 34%, rgba(2, 6, 23, 0.76) 68%, transparent 76%),
    repeating-linear-gradient(104deg, transparent 0 38px, rgba(255, 105, 40, 0.09) 40px 42px, transparent 44px 86px);
  mix-blend-mode: screen;
  filter: blur(4px);
  opacity: 0;
  transform-origin: 50% 82%;
  animation: lb-ground-burn 6.6s ease both;
}

.lb-heat-haze {
  inset: -8%;
  z-index: 2;
  background:
    radial-gradient(circle at 50% 70%, rgba(255, 255, 255, 0.16), rgba(251, 146, 60, 0.12) 12%, transparent 34%),
    repeating-linear-gradient(90deg, transparent 0 22px, rgba(255, 237, 213, 0.035) 24px 30px, transparent 32px 58px);
  mix-blend-mode: screen;
  filter: blur(10px);
  opacity: 0;
  animation: lb-heat-haze 2800ms ease both;
}

.lb-whiteout {
  inset: 0;
  z-index: 5;
  background:
    radial-gradient(circle at 50% 70%, rgba(255, 255, 255, 0.38), rgba(255, 247, 237, 0.22) 14%, rgba(251, 146, 60, 0.12) 30%, transparent 58%);
  mix-blend-mode: screen;
  opacity: 0;
  animation: lb-whiteout 980ms ease-out both;
}

.lb-scanlines {
  inset: 0;
  z-index: 7;
  background:
    repeating-linear-gradient(180deg, rgba(255, 237, 213, 0.08) 0 1px, transparent 1px 5px),
    linear-gradient(90deg, transparent, rgba(255, 247, 237, 0.08), transparent);
  mix-blend-mode: overlay;
  opacity: 0;
  animation: lb-scanlines 6.6s ease both;
}

.lb-vignette {
  inset: 0;
  z-index: 8;
  background:
    radial-gradient(circle at 50% 48%, transparent 44%, rgba(12, 10, 9, 0.44) 78%, rgba(2, 6, 23, 0.86) 100%);
  opacity: 0.68;
}

.lb-hud {
  inset: 7%;
  z-index: 9;
  border: 1px solid rgba(254, 243, 199, 0.14);
  animation: lb-hud 6.6s ease both;
}

.lb-hud::before,
.lb-hud::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(54vw, 560px);
  height: min(24vh, 210px);
  border: 1px solid rgba(254, 215, 170, 0.18);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 28px rgba(251, 146, 60, 0.16);
}

.lb-hud::after {
  width: min(38vw, 380px);
  height: min(16vh, 140px);
  border-color: rgba(125, 211, 252, 0.18);
}

.lb-hud-corner {
  position: absolute;
  width: 58px;
  height: 58px;
  border-color: rgba(254, 215, 170, 0.72);
  border-style: solid;
  filter: drop-shadow(0 0 12px rgba(251, 146, 60, 0.42));
}

.is-left-top {
  left: -1px;
  top: -1px;
  border-width: 2px 0 0 2px;
}

.is-right-top {
  right: -1px;
  top: -1px;
  border-width: 2px 2px 0 0;
}

.is-left-bottom {
  left: -1px;
  bottom: -1px;
  border-width: 0 0 2px 2px;
}

.is-right-bottom {
  right: -1px;
  bottom: -1px;
  border-width: 0 2px 2px 0;
}

.lb-reticle {
  position: absolute;
  left: 50%;
  top: 68%;
  width: 13vmin;
  aspect-ratio: 1;
  border: 1px solid rgba(254, 243, 199, 0.62);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow:
    inset 0 0 22px rgba(251, 146, 60, 0.2),
    0 0 28px rgba(251, 146, 60, 0.28);
  animation: lb-reticle 1.4s linear infinite;
}

.lb-reticle::before,
.lb-reticle::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  background: rgba(254, 243, 199, 0.68);
  transform: translate(-50%, -50%);
}

.lb-reticle::before {
  width: 146%;
  height: 1px;
}

.lb-reticle::after {
  width: 1px;
  height: 146%;
}

.lb-readout {
  position: absolute;
  top: 50%;
  color: rgba(255, 237, 213, 0.74);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-shadow: 0 0 16px rgba(251, 146, 60, 0.5);
  writing-mode: vertical-rl;
}

.lb-readout.is-left {
  left: 18px;
}

.lb-readout.is-right {
  right: 18px;
}

.lb-title {
  left: 50%;
  top: 12%;
  z-index: 10;
  display: grid;
  place-items: center;
  gap: 6px;
  color: #ffedd5;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-shadow:
    0 0 22px rgba(251, 146, 60, 0.76),
    0 0 48px rgba(255, 255, 255, 0.28);
  transform: translateX(-50%);
  animation: lb-title 6.6s ease both;
}

.lb-title strong {
  color: #fff7ed;
  font-size: clamp(22px, 3vw, 32px);
  font-weight: 900;
  letter-spacing: 0.2em;
}

.lb-title small {
  color: rgba(255, 237, 213, 0.78);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-align: center;
  white-space: nowrap;
}

.lb-destruction-status {
  position: absolute;
  left: 50%;
  bottom: 11.5%;
  z-index: 10;
  display: grid;
  justify-items: center;
  gap: 4px;
  color: #fed7aa;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-align: center;
  text-shadow: 0 0 18px rgba(249, 115, 22, 0.72);
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
  animation: lb-destruction-status 6.6s ease both;
}

.lb-destruction-status strong {
  color: #fff7ed;
  font-size: clamp(12px, 1.5vw, 17px);
  letter-spacing: 0.28em;
  white-space: nowrap;
}

.lb-destruction-status span {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.18em;
  white-space: nowrap;
}

.lb-fallback-cloud {
  left: 50%;
  bottom: 18%;
  z-index: 4;
  width: min(620px, 82vw);
  height: min(560px, 62vh);
  transform: translateX(-50%);
  filter: drop-shadow(0 0 46px rgba(251, 146, 60, 0.42));
}

.lb-fallback-cloud span {
  position: absolute;
  left: calc(50% + (var(--x, 0) * 1px));
  top: calc(20% + (var(--y, 0) * 1px));
  width: 88px;
  aspect-ratio: 1.3;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(245, 245, 244, 0.56), rgba(87, 83, 78, 0.38) 58%, transparent 74%);
  animation: lb-fallback-puff 4s ease both;
}

.lb-fallback-cloud span:nth-child(3n) {
  width: 128px;
  transform: translate(60px, 20px);
}

.lb-fallback-cloud span:nth-child(3n + 1) {
  width: 108px;
  transform: translate(-100px, 70px);
}

@keyframes lb-whiteout {
  0%, 10% { opacity: 0; transform: scale(0.72); }
  22% { opacity: 0.42; transform: scale(1.02); }
  42% { opacity: 0.12; }
  100% { opacity: 0; transform: scale(1.55); }
}

@keyframes lb-annihilation-front {
  0%, 16% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.08);
  }
  18% {
    opacity: 1;
  }
  42% {
    opacity: 0.12;
    transform: translate(-50%, -50%) scale(9.5);
  }
  58%, 100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(13);
  }
}

@keyframes lb-ground-burn {
  0%, 17% { opacity: 0; transform: scale(0.62); }
  24% { opacity: 0.42; transform: scale(1.08); }
  52% { opacity: 0.2; transform: scale(1.22); }
  84%, 100% { opacity: 0; transform: scale(1.34); }
}

@keyframes lb-destruction-status {
  0%, 35% { opacity: 0; transform: translateX(-50%) translateY(10px); }
  43%, 78% { opacity: 0.94; transform: translateX(-50%) translateY(0); }
  92%, 100% { opacity: 0; transform: translateX(-50%) translateY(-6px); }
}

@keyframes lb-cityline {
  0%, 15% { opacity: 1; transform: scaleY(1); filter: brightness(1); }
  18% { opacity: 1; transform: scaleY(1); filter: brightness(4.4) saturate(0.4); }
  21% { opacity: 1; transform: scaleY(0.98); filter: brightness(2.1); }
  26% { opacity: 0.9; transform: scaleY(0.9) skewX(1.5deg); filter: brightness(0.8) saturate(0.7); }
  36% { opacity: 0.72; transform: scaleY(0.62) skewX(-2.5deg); filter: brightness(0.5); }
  50% { opacity: 0.4; transform: scaleY(0.26) skewX(2deg); filter: brightness(0.34); }
  64%, 100% { opacity: 0; transform: scaleY(0.04); filter: brightness(0.2); }
}

@keyframes lb-alert-top {
  0% { opacity: 0; transform: translateY(-10px); }
  4%, 12% { opacity: 0.92; transform: translateY(0); }
  14% { opacity: 0.3; }
  15.5% { opacity: 0.95; }
  17% { opacity: 0.35; }
  18.5% { opacity: 0.9; }
  26%, 100% { opacity: 0; transform: translateY(-8px); filter: blur(3px); }
}

@keyframes lb-alert-bottom {
  0% { opacity: 0; transform: translateY(10px); }
  4%, 12% { opacity: 0.92; transform: translateY(0); }
  14% { opacity: 0.3; }
  15.5% { opacity: 0.95; }
  17% { opacity: 0.35; }
  18.5% { opacity: 0.9; }
  26%, 100% { opacity: 0; transform: translateY(8px); filter: blur(3px); }
}

@keyframes lb-telemetry {
  0%, 25% { opacity: 0; transform: translateY(8px); }
  32%, 76% { opacity: 0.92; transform: translateY(0); }
  90%, 100% { opacity: 0; transform: translateY(-4px); }
}

@keyframes lb-heat-haze {
  0%, 15% { opacity: 0; transform: scale(0.98) translateY(0); }
  19% { opacity: 0.38; transform: scale(1.04) translateY(-1%); }
  42% { opacity: 0.22; transform: scale(1.12) translateY(-3%); }
  86%, 100% { opacity: 0; transform: scale(1.24) translateY(-5%); }
}

@keyframes lb-scanlines {
  0%, 14% { opacity: 0; transform: translateY(-2%); }
  19% { opacity: 0.55; }
  64% { opacity: 0.24; transform: translateY(2%); }
  100% { opacity: 0; transform: translateY(4%); }
}

@keyframes lb-hud {
  0%, 16% { opacity: 0; transform: scale(0.98); }
  22%, 74% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.02); }
}

@keyframes lb-reticle {
  to { rotate: 360deg; }
}

@keyframes lb-title {
  0%, 16% { opacity: 0; transform: translateX(-50%) translateY(-12px) scale(0.92); }
  23%, 72% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  88%, 100% { opacity: 0; transform: translateX(-50%) translateY(-8px) scale(0.96); }
}

@keyframes lb-camera {
  0% { transform: scale(1.02); filter: saturate(1); }
  18% { transform: scale(1); filter: saturate(1.12); }
  21% { transform: scale(1.14); filter: saturate(1.72) contrast(1.2); }
  27% { transform: translate(-7px, 5px) scale(1.08); }
  31% { transform: translate(6px, -5px) scale(1.04); }
  40% { transform: translate(-3px, 2px) scale(1.02); }
  62% { transform: scale(1.05); filter: saturate(0.9) contrast(1.05); }
  100% { transform: scale(1.1); filter: saturate(0.76); }
}

@keyframes lb-fallback-puff {
  from { opacity: 0; scale: 0.26; }
  40%, 80% { opacity: 0.8; }
  to { opacity: 0; scale: 1.28; translate: 0 -60px; }
}

@media (max-width: 720px) {
  .lb-hud {
    inset: 5%;
  }

  .lb-readout,
  .lb-telemetry {
    display: none;
  }

  .lb-alert-band span {
    letter-spacing: 0.16em;
  }

  .lb-reticle {
    top: 70%;
    width: 18vmin;
  }

  .lb-title {
    top: 13%;
    width: min(88vw, 360px);
  }

  .lb-destruction-status {
    bottom: 12.5%;
    width: 88vw;
  }

  .lb-destruction-status span {
    max-width: 86vw;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .lb-title small {
    max-width: 82vw;
    overflow-wrap: anywhere;
    white-space: normal;
  }
}

@media (prefers-reduced-motion: reduce) {
  .little-boy-effect,
  .lb-heat-haze,
  .lb-whiteout,
  .lb-annihilation-front,
  .lb-ground-burn,
  .lb-cityline,
  .lb-scanlines,
  .lb-hud,
  .lb-alert-band,
  .lb-telemetry,
  .lb-title,
  .lb-reticle,
  .lb-destruction-status,
  .lb-fallback-cloud span {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
