<script setup lang="ts">
import { Globe } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const BUILD_FROM = 1200;
const ONLINE_AT = 4300;

const scene: SceneFn = (api) => {
  api.setTrail(0.26);
  const cx = api.width / 2;
  const cy = api.height / 2;
  const rx = Math.min(api.width, api.height) * 0.4;
  const ry = rx * 0.3;

  // 中央恒星：核心辉光脉动 + 表面对流
  api.spawn({
    x: cx, y: cy, shape: 'dot', size: 30, maxLife: api.duration / 1000,
    color: '#fcd34d', glow: 2, fadeIn: 0.05, fadeOut: 0.12,
    update: (p) => {
      p.size = 30 + Math.sin(p.life * 3.4) * 4;
      p.endSize = p.size;
    },
  });
  api.every(60, () => {
    const angle = api.range(0, Math.PI * 2);
    api.spawn({
      x: cx + Math.cos(angle) * 32, y: cy + Math.sin(angle) * 32,
      vx: Math.cos(angle) * api.range(12, 40), vy: Math.sin(angle) * api.range(12, 40),
      shape: 'spark', size: api.range(1.2, 2.4), maxLife: api.range(0.4, 0.9),
      color: api.pick(['#fde68a', '#fb923c', '#fef9c3']), glow: 1.1, drag: 0.4, fadeOut: 0.4,
    });
  }, { until: api.duration - 800 });

  // 星环分段：seed 打乱点亮次序
  const SEG_COUNT = 36;
  const order: number[] = Array.from({ length: SEG_COUNT }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(api.rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const bootAt = (seg: number) => BUILD_FROM + (order.indexOf(seg) / SEG_COUNT) * (ONLINE_AT - BUILD_FROM - 300);
  const segPos = (seg: number) => {
    const a = (seg / SEG_COUNT) * Math.PI * 2;
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, front: Math.sin(a) > 0, a };
  };

  // 环带构件逐段点亮（近大远小、近亮远暗的伪 3D）
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < BUILD_FROM) return;
    const online = tMs > ONLINE_AT ? Math.min(1, (tMs - ONLINE_AT) / 300) : 0;
    const fadeOutAll = Math.max(0, Math.min(1, (api.duration - 300 - tMs) / 500));
    const segSpan = (Math.PI * 2) / SEG_COUNT;
    for (let seg = 0; seg < SEG_COUNT; seg += 1) {
      const boot = Math.min(1, Math.max(0, (tMs - bootAt(seg)) / 240));
      if (boot <= 0) continue;
      const { front, a } = segPos(seg);
      const depth = front ? 1 : 0.45;
      const alpha = (0.28 + boot * 0.5) * depth * fadeOutAll + online * 0.3 * depth;
      ctx.strokeStyle = `rgba(250, 204, 21, ${Math.min(0.95, alpha)})`;
      ctx.lineWidth = (front ? 6 : 3.2) * (0.6 + boot * 0.4) + online * 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, a + segSpan * 0.09, a + segSpan * 0.86);
      ctx.stroke();
    }
  });

  // 施工无人机：恒星 ↔ 下一个待建段之间穿梭拖尾
  api.every(190, (index) => {
    const seg = order[Math.min(SEG_COUNT - 1, index % SEG_COUNT)];
    const target = segPos(seg);
    api.spawn({
      x: cx + api.range(-20, 20), y: cy + api.range(-20, 20),
      shape: 'streak', stretch: 0.08, size: 1.8, maxLife: 0.9,
      color: '#a5f3fc', glow: 1, fadeIn: 0.1, fadeOut: 0.24,
      update: (p, dt) => {
        p.vx += (target.x - p.x) * 5.4 * dt;
        p.vy += (target.y - p.y) * 5.4 * dt;
      },
    });
  }, { from: BUILD_FROM, until: ONLINE_AT - 400 });

  // 合拢供能：全环泛白 + 能量光束向两侧扫过
  api.at(ONLINE_AT, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: rx * 0.94, endSize: rx * 1.5, maxLife: 0.9, color: '#fef9c3', opacity: 0.95, fadeOut: 0.7 });
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 26, endSize: 200, maxLife: 0.55, color: '#fffbeb', glow: 2.2, fadeOut: 0.9 });
    [-1, 1].forEach((dir) => {
      api.burst({
        x: cx + dir * rx * 0.9, y: cy, count: 46,
        speed: [220, 620], angle: [dir > 0 ? -0.3 : Math.PI - 0.3, dir > 0 ? 0.3 : Math.PI + 0.3],
        base: { shape: 'streak', stretch: 0.1, size: 2, maxLife: 1, color: '#fde047', glow: 1.1, drag: 0.55, fadeOut: 0.4 },
      });
    });
  });
};
</script>

<template>
  <div class="dyson-ring-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.dysonRing" :scene="scene" />
    <div class="dyson-hud">
      <Globe :size="26" />
      <strong>MEGASTRUCTURE ONLINE</strong>
      <small>戴森星环 · 输出功率 3.8×10²⁶ W</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dyson-ring-effect {
  @include effect-stage(hidden);
  animation: dyson-camera 5.8s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.dyson-hud {
  position: absolute;
  left: 50%;
  bottom: 12%;
  border: 1px solid rgba(250, 204, 21, 0.36);
  border-radius: 10px;
  background: rgba(30, 20, 2, 0.42);
  color: #fef3c7;
  display: grid;
  gap: 5px;
  place-items: center;
  padding: 12px 24px;
  backdrop-filter: blur(4px);
  transform: translateX(-50%);
  animation: dyson-hud 5.8s ease both;
}

.dyson-hud strong {
  font-size: 13px;
  letter-spacing: 0.2em;
}

.dyson-hud small {
  color: rgba(254, 243, 199, 0.7);
  font-size: 11px;
}

@keyframes dyson-hud {
  0%, 70% { opacity: 0; transform: translateX(-50%) translateY(16px); }
  78%, 92% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; }
}

@keyframes dyson-camera {
  0% { transform: scale(1.1); }
  30%, 66% { transform: scale(1); }
  72% { transform: scale(1.06); }
  80% { transform: scale(1.01); }
  100% { transform: scale(1.05); opacity: 0; }
}
</style>
