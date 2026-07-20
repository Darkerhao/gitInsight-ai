<script setup lang="ts">
import { Building2 } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const SCAN_MS = 3700; // 与 CSS 扫描线动画时长一致

const scene: SceneFn = (api) => {
  api.setTrail(0.28);

  // 扫描前沿的"识别"反馈：光环 + 识别码，跟随扫描线位置
  const scanProgress = (tMs: number) => {
    const t = Math.min(1, tMs / SCAN_MS);
    return 1 - Math.pow(1 - t, 3); // 近似 CSS 的 ease-out 扫描
  };
  let sceneTime = 0;
  api.onFrame((tMs) => {
    sceneTime = tMs;
  });

  api.every(130, () => {
    if (sceneTime > SCAN_MS) return;
    const y = scanProgress(sceneTime) * api.height;
    const x = api.range(api.width * 0.08, api.width * 0.92);
    api.spawn({ x, y, shape: 'ring', size: 4, endSize: 44, maxLife: 0.55, color: '#67e8f9', opacity: 0.85 });
    api.spawn({ x, y, shape: 'dot', size: 3, maxLife: 0.9, color: '#a5f3fc', glow: 1.4, twinkle: 8, fadeIn: 0.1 });
    if (api.rng() < 0.4) {
      api.spawn({
        x: x + api.range(-20, 20),
        y: y - api.range(10, 30),
        shape: 'glyph',
        glyph: `${Math.floor(api.range(0, 255)).toString(16).toUpperCase().padStart(2, '0')}`,
        size: 12,
        maxLife: 0.8,
        color: 'rgba(165, 243, 252, 0.9)',
        vy: -30,
        fadeIn: 0.15,
        fadeOut: 0.4,
      });
    }
  }, { until: SCAN_MS });

  // 建筑数据上传：城市区域升起的数据光条
  api.every(70, () => {
    api.spawn({
      x: api.range(api.width * 0.12, api.width * 0.88),
      y: api.height * api.range(0.62, 0.9),
      vy: -api.range(160, 380),
      shape: 'streak',
      stretch: 0.07,
      size: api.range(1.2, 2.2),
      maxLife: api.range(0.7, 1.3),
      color: api.rng() < 0.7 ? '#22d3ee' : '#5eead4',
      glow: 1,
      fadeIn: 0.1,
      fadeOut: 0.25,
    });
  }, { from: 800, until: api.duration - 900 });

  // 扫描完成：全城点亮脉冲
  api.at(SCAN_MS + 100, () => {
    const cx = api.width / 2;
    const cy = api.height * 0.6;
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 40, endSize: Math.max(api.width, api.height) * 0.6, maxLife: 1, color: '#67e8f9', opacity: 0.8 });
    api.burst({
      x: cx,
      y: cy,
      count: 46,
      speed: [80, 420],
      angle: [Math.PI, Math.PI * 2],
      base: { shape: 'spark', size: 1.8, drag: 0.4, color: '#a5f3fc', twinkle: 8, glow: 1.1 },
      vary: (p, rng) => {
        p.maxLife = 0.7 + rng() * 0.8;
      },
    });
  });
};
</script>

<template>
  <div class="city-scan-effect">
    <div class="city-map">
      <span
        v-for="block in 42"
        :key="block"
        class="city-block"
        :style="{ height: `${22 + ((block * 13) % 86)}px`, animationDelay: `${(block % 7) * 90}ms` }"
      />
    </div>
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.cityScan" :scene="scene" />
    <div class="city-scan-line" />
    <div class="city-scan-label">
      <Building2 :size="46" />
      <strong>城市扫描线</strong>
    </div>
  </div>
</template>

<style scoped lang="scss">
.city-scan-effect {
  @include effect-stage(hidden);
}

.city-map {
  position: absolute;
  left: 50%;
  bottom: 14%;
  width: min(760px, 88vw);
  height: min(390px, 62vh);
  display: grid;
  grid-template-columns: repeat(14, minmax(0, 1fr));
  align-items: end;
  gap: 10px;
  padding: 22px;
  transform: translateX(-50%) perspective(700px) rotateX(52deg);
  transform-origin: center bottom;
  mask-image: linear-gradient(180deg, transparent 0, #000 14% 88%, transparent 100%);
}

.city-map::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(34, 211, 238, 0.18) 1px, transparent 1px),
    linear-gradient(90deg, rgba(34, 211, 238, 0.18) 1px, transparent 1px);
  background-size: 42px 42px;
  opacity: 0;
  animation: city-grid 4.8s ease both;
}

.city-block {
  position: relative;
  z-index: 1;
  min-height: 16px;
  border: 1px solid rgba(34, 211, 238, 0.32);
  border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, rgba(34, 211, 238, 0.32), rgba(59, 130, 246, 0.1));
  box-shadow: inset 0 0 18px rgba(34, 211, 238, 0.12);
  opacity: 0;
  transform: scaleY(0.18);
  transform-origin: center bottom;
  animation: city-block 3.6s ease both;
}

.city-scan-line {
  position: absolute;
  left: 0;
  right: 0;
  top: -18%;
  height: 18vh;
  background: linear-gradient(180deg, transparent, rgba(34, 211, 238, 0.36), rgba(255, 255, 255, 0.82), transparent);
  box-shadow: 0 0 42px rgba(34, 211, 238, 0.46);
  opacity: 0;
  animation: city-scan 3.7s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.city-scan-label {
  position: absolute;
  left: 50%;
  top: 42%;
  display: grid;
  gap: 10px;
  place-items: center;
  color: #cffafe;
  transform: translate(-50%, -50%);
  animation: city-label 4.8s ease both;
}

.city-scan-label strong {
  font-size: 16px;
}

@keyframes city-grid {
  0%, 100% { opacity: 0; }
  18%, 78% { opacity: 1; }
}

@keyframes city-block {
  0% { opacity: 0; transform: scaleY(0.18); filter: brightness(0.8); }
  32%, 78% { opacity: 1; transform: scaleY(1); filter: brightness(1.42); }
  100% { opacity: 0; transform: scaleY(0.92); filter: brightness(0.9); }
}

@keyframes city-scan {
  0% { opacity: 0; transform: translateY(0); }
  12% { opacity: 1; }
  88% { opacity: 1; }
  100% { opacity: 0; transform: translateY(126vh); }
}

@keyframes city-label {
  0%, 100% { opacity: 0; transform: translate(-50%, -42%) scale(0.9); }
  20%, 76% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
</style>
