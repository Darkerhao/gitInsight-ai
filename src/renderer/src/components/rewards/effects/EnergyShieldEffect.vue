<script setup lang="ts">
import { Shield } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const scene: SceneFn = (api) => {
  const cx = api.width / 2;
  const cy = api.height / 2;
  const shieldR = Math.min(api.width, api.height) * 0.34;
  const hexR = 26;

  // 蜂窝网格：轴向坐标生成盾面内六边形，激活时间随离心距离 + 抖动
  type Hex = { x: number; y: number; dist: number; bootAt: number };
  const hexes: Hex[] = [];
  const w = hexR * Math.sqrt(3);
  for (let row = -9; row <= 9; row += 1) {
    for (let col = -9; col <= 9; col += 1) {
      const x = cx + col * w + (row % 2 ? w / 2 : 0);
      const y = cy + row * hexR * 1.5;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist > shieldR) continue;
      hexes.push({ x, y, dist, bootAt: 200 + (dist / shieldR) * 1150 + api.range(0, 190) });
    }
  }

  // 承击波源（seed 决定落点，与来袭弹头一致）
  const impacts = [2200, 2900, 3500].map((at) => {
    const a = api.range(0, Math.PI * 2);
    const r = api.range(0, shieldR * 0.72);
    return { at, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });

  const drawHex = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  api.onFrame((tMs, _dt, ctx) => {
    const fadeAll = Math.max(0, Math.min(1, (api.duration - 500 - tMs) / 600));
    if (fadeAll <= 0.02) return;
    // 幕三：稳定期巡回流光角度
    const sweepA = tMs > 3900 ? ((tMs - 3900) / 1100) * Math.PI * 2 - Math.PI : 99;
    for (const hex of hexes) {
      if (tMs < hex.bootAt) continue;
      const boot = Math.min(1, (tMs - hex.bootAt) / 260);
      const rim = 1 - (hex.dist / shieldR) * 0.6;
      let alpha = 0.15 * boot * rim;
      let lineW = 1;
      // 承击涟漪：命中点向外的延迟点亮波
      for (const imp of impacts) {
        if (tMs < imp.at) continue;
        const wave = (tMs - imp.at) / 1000 * 340;
        const d = Math.hypot(hex.x - imp.x, hex.y - imp.y);
        const hit = Math.exp(-Math.abs(d - wave) / 40) * Math.max(0, 1 - (tMs - imp.at) / 900);
        alpha += hit * 0.85;
        lineW += hit * 1.6;
      }
      // 巡回流光
      const hexA = Math.atan2(hex.y - cy, hex.x - cx);
      const sweepGap = Math.abs(((hexA - sweepA + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (sweepGap < 0.5) alpha += (0.5 - sweepGap) * 0.9;
      ctx.strokeStyle = `rgba(74, 222, 128, ${Math.min(0.95, alpha) * fadeAll})`;
      ctx.lineWidth = lineW;
      drawHex(ctx, hex.x, hex.y, hexR * 0.92 * boot);
      ctx.stroke();
    }
    // 盾缘
    ctx.strokeStyle = `rgba(134, 239, 172, ${0.4 * fadeAll * Math.min(1, tMs / 1500)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, shieldR + 8, 0, Math.PI * 2);
    ctx.stroke();
  });

  // 来袭弹头 + 命中爆点
  impacts.forEach((imp) => {
    const flightMs = 600;
    api.at(imp.at - flightMs, () => {
      const fromA = api.range(0, Math.PI * 2);
      const from = {
        x: imp.x + Math.cos(fromA) * Math.max(api.width, api.height) * 0.7,
        y: imp.y + Math.sin(fromA) * Math.max(api.width, api.height) * 0.7,
      };
      api.spawn({
        x: from.x, y: from.y,
        vx: (imp.x - from.x) / (flightMs / 1000), vy: (imp.y - from.y) / (flightMs / 1000),
        shape: 'streak', stretch: 0.09, size: 3.2, maxLife: flightMs / 1000,
        color: '#fca5a5', glow: 1.4, fadeIn: 0.06, fadeOut: 0.08,
      });
    });
    api.at(imp.at, () => {
      api.spawn({ x: imp.x, y: imp.y, shape: 'dot', size: 8, endSize: 90, maxLife: 0.5, color: '#f0fdf4', glow: 2, fadeOut: 0.85 });
      api.burst({
        x: imp.x, y: imp.y, count: 26, speed: [80, 300],
        base: { shape: 'spark', size: 2, maxLife: 0.8, color: '#86efac', glow: 1.1, drag: 0.4, fadeOut: 0.4 },
        vary: (p, rng) => {
          if (rng() > 0.7) p.color = '#fca5a5';
        },
      });
    });
  });
};
</script>

<template>
  <div class="energy-shield-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.energyShield" :scene="scene" />
    <div class="shield-hud">
      <Shield :size="24" />
      <strong>SHIELD INTEGRITY 100%</strong>
      <small>相位护盾 · 蜂窝矩阵稳定</small>
    </div>
  </div>
</template>

<style scoped>
.energy-shield-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
  animation: shield-camera 5.4s ease both;
}

.shield-hud {
  position: absolute;
  left: 50%;
  bottom: 11%;
  border: 1px solid rgba(74, 222, 128, 0.42);
  border-radius: 10px;
  background: rgba(5, 46, 22, 0.5);
  color: #dcfce7;
  display: grid;
  gap: 5px;
  place-items: center;
  padding: 12px 24px;
  backdrop-filter: blur(4px);
  transform: translateX(-50%);
  animation: shield-hud 5.4s ease both;
}

.shield-hud strong {
  font-size: 13px;
  letter-spacing: 0.18em;
}

.shield-hud small {
  color: rgba(187, 247, 208, 0.7);
  font-size: 11px;
}

@keyframes shield-hud {
  0%, 70% { opacity: 0; transform: translateX(-50%) translateY(14px); }
  78%, 94% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0.9; }
}

@keyframes shield-camera {
  0% { opacity: 0; transform: scale(1.08); }
  9% { opacity: 1; }
  30% { transform: scale(1); }
  41% { transform: translate(-3px, 2px) scale(1); }
  43% { transform: translate(3px, -2px) scale(1); }
  45% { transform: translate(0, 0) scale(1); }
  54% { transform: translate(-2px, 2px); }
  56% { transform: translate(2px, -1px); }
  58% { transform: translate(0, 0); }
  65% { transform: translate(-2px, 1px); }
  67% { transform: translate(0, 0); }
  100% { opacity: 0; transform: scale(1.04); }
}
</style>
