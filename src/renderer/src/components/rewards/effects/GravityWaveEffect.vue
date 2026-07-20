<script setup lang="ts">
import { Waves } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const MERGE_AT = 2600;

const scene: SceneFn = (api) => {
  api.setTrail(0.2);
  const cx = api.width / 2;
  const cy = api.height / 2;

  // 星野
  for (let i = 0; i < 70; i += 1) {
    api.spawn({
      x: api.rng() * api.width, y: api.rng() * api.height,
      shape: 'dot', size: api.range(0.7, 1.7), maxLife: 6.2,
      color: api.rng() > 0.75 ? '#bfdbfe' : '#e2e8f0', glow: 0.8,
      opacity: api.range(0.3, 0.75), twinkle: api.range(0.5, 1.6), fadeOut: 0.1,
    });
  }

  // 幕一：双中子星互绕 —— 轨道衰减、转速递增，拖出双螺旋光圈
  const phase0 = api.range(0, Math.PI * 2);
  api.every(16, (index) => {
    const t = index * 0.016;
    const progress = Math.min(1, (t * 1000) / MERGE_AT);
    const radius = 150 * (1 - progress * 0.94);
    const angle = phase0 + t * (2.2 + progress * 16);
    [0, Math.PI].forEach((offset, star) => {
      api.spawn({
        x: cx + Math.cos(angle + offset) * radius,
        y: cy + Math.sin(angle + offset) * radius * 0.86,
        shape: 'spark', size: 3.4 - progress, maxLife: 0.5,
        color: star === 0 ? '#bfdbfe' : '#c4b5fd', glow: 1.5, fadeIn: 0.05, fadeOut: 0.45,
      });
    });
  }, { until: MERGE_AT - 20 });

  // 幕二：合并 —— 白闪 + 千新星抛射
  api.at(MERGE_AT, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 16, endSize: 360, maxLife: 0.6, color: '#f8fafc', glow: 2.4, fadeOut: 0.92 });
    api.burst({
      x: cx, y: cy, count: 150, speed: [120, 520],
      base: { shape: 'spark', size: 2.4, maxLife: 1.6, glow: 1.1, ay: 46, drag: 0.34, fadeOut: 0.45 },
      vary: (p, rng) => {
        p.color = rng() > 0.5 ? '#fbbf24' : rng() > 0.5 ? '#f87171' : '#fde68a';
        p.maxLife = 0.9 + rng() * 1.2;
      },
    });
  });

  // 幕三：时空涟漪 —— 极坐标网格被径向波扰动，三波渐弱
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < MERGE_AT + 120) return;
    const t = (tMs - MERGE_AT - 120) / 1000;
    const fade = Math.min(1, t / 0.4) * Math.max(0, 1 - (tMs - MERGE_AT) / (api.duration - MERGE_AT));
    const maxR = Math.max(api.width, api.height) * 0.72;
    const waveFront = t * 480;
    const distort = (r: number) => {
      const lag = r - waveFront;
      return 13 * Math.exp(-Math.abs(lag) / 130) * Math.sin(r / 26 - t * 11);
    };
    ctx.strokeStyle = `rgba(147, 197, 253, ${0.3 * fade})`;
    ctx.lineWidth = 1;
    // 同心圆环（径向正弦扰动）
    for (let ring = 1; ring <= 8; ring += 1) {
      const base = ring * (maxR / 8);
      ctx.beginPath();
      for (let s = 0; s <= 52; s += 1) {
        const a = (s / 52) * Math.PI * 2;
        const r = base + distort(base);
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r * 0.86;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // 辐射线
    ctx.strokeStyle = `rgba(147, 197, 253, ${0.16 * fade})`;
    for (let l = 0; l < 12; l += 1) {
      const a = (l / 12) * Math.PI * 2;
      ctx.beginPath();
      for (let s = 1; s <= 16; s += 1) {
        const base = (s / 16) * maxR;
        const r = base + distort(base);
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r * 0.86;
        if (s === 1) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  });

  // 涟漪波前上的微光
  api.every(60, () => {
    const angle = api.range(0, Math.PI * 2);
    const radius = api.range(60, 300);
    api.spawn({
      x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius * 0.86,
      shape: 'dot', size: api.range(0.9, 1.8), maxLife: api.range(0.8, 1.4),
      color: '#bfdbfe', glow: 1, twinkle: 3, wander: 20, fadeOut: 0.5,
    });
  }, { from: MERGE_AT + 300, until: api.duration - 700 });
};
</script>

<template>
  <div class="gravity-wave-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.gravityWave" :scene="scene" />
    <div class="gw-hud">
      <Waves :size="30" />
      <strong>引力波事件 GW-260705</strong>
      <small>CHIRP MASS 2.7 M☉ · SNR 24.1</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.gravity-wave-effect {
  @include effect-stage(hidden);
  animation: gw-camera 6.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.gw-hud {
  position: absolute;
  left: 50%;
  bottom: 12%;
  border: 1px solid rgba(147, 197, 253, 0.34);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.4);
  color: #dbeafe;
  display: grid;
  gap: 5px;
  place-items: center;
  padding: 12px 22px;
  backdrop-filter: blur(4px);
  transform: translateX(-50%);
  animation: gw-hud 6.2s ease both;
}

.gw-hud strong {
  font-size: 14px;
  letter-spacing: 0.1em;
}

.gw-hud small {
  color: rgba(191, 219, 254, 0.72);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.18em;
}

@keyframes gw-hud {
  0%, 48% { opacity: 0; transform: translateX(-50%) translateY(16px); }
  58%, 88% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; }
}

@keyframes gw-camera {
  0% { transform: scale(1.08); }
  38% { transform: scale(1); }
  42% { transform: scale(0.96); }
  48% { transform: scale(1.07); }
  56% { transform: scale(1.01); }
  100% { transform: scale(1.06); opacity: 0; }
}
</style>
