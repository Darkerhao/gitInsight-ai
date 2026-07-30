<script setup lang="ts">
import { Shield } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * PHASE AEGIS · 相位护盾（5400ms = 600 entry + 3950 loop + 850 exit）
 * 三幕：蜂窝盾面自中心逐圈通电（伪球面透视：边缘格缩小压暗）→ 三波弹头来袭，
 * 命中格高亮、涟漪沿蜂窝传播、火花迸溅 + 二次噼啪 + ABSORBED 确认微文案 →
 * 流光巡回一周 SHIELD 100%，呼吸微光淡出。
 * 配色：白热命中核心 + 荧绿主辉光（#4ade80 族）+ 黄绿辅点缀（#a3e635）+ 弹头警示红。
 */
const scene: SceneFn = (api) => {
  const cx = api.width / 2;
  const cy = api.height / 2;
  const shieldR = Math.min(api.width, api.height) * 0.34;
  const hexR = 24;
  const SWEEP_FROM = 4200;
  const SWEEP_DUR = 950;

  // 蜂窝网格：轴向坐标生成盾面内六边形；dome = 伪球面系数（边缘收缩压暗）
  type Hex = { x: number; y: number; dist: number; dome: number; bootAt: number };
  const hexes: Hex[] = [];
  const w = hexR * Math.sqrt(3);
  for (let row = -9; row <= 9; row += 1) {
    for (let col = -9; col <= 9; col += 1) {
      const x = cx + col * w + (row % 2 ? w / 2 : 0);
      const y = cy + row * hexR * 1.5;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist > shieldR) continue;
      const dome = Math.sqrt(Math.max(0.12, 1 - (dist / shieldR) ** 2));
      hexes.push({ x, y, dist, dome, bootAt: 220 + (dist / shieldR) * 1100 + api.range(0, 170) });
    }
  }

  // 承击波源（seed 决定落点，与来袭弹头一致）
  const impacts = [2150, 2950, 3700].map((at) => {
    const a = api.range(0, Math.PI * 2);
    const r = api.range(0, shieldR * 0.68);
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
    const fadeAll = Math.max(0, Math.min(1, (api.duration - 130 - tMs) / 450));
    if (fadeAll <= 0.02) return;
    // 幕三：流光巡回角度
    const sweepA = tMs > SWEEP_FROM ? ((tMs - SWEEP_FROM) / SWEEP_DUR) * Math.PI * 2 - Math.PI : 99;
    for (const hex of hexes) {
      if (tMs < hex.bootAt) continue;
      const boot = Math.min(1, (tMs - hex.bootAt) / 260);
      // 伪球面：边缘格更小、更暗（近大远小的球壳透视）
      const rim = 0.36 + hex.dome * 0.64;
      let alpha = 0.16 * boot * rim;
      let lineW = 1;
      // 承击涟漪：命中点向外的延迟点亮波，双波峰（主波 + 慢速回波）
      for (const imp of impacts) {
        if (tMs < imp.at) continue;
        const age = tMs - imp.at;
        const d = Math.hypot(hex.x - imp.x, hex.y - imp.y);
        const hit = Math.exp(-Math.abs(d - (age / 1000) * 340) / 38) * Math.max(0, 1 - age / 850);
        const echo = Math.exp(-Math.abs(d - (age / 1000) * 150) / 46) * Math.max(0, 1 - age / 1250) * 0.4;
        alpha += (hit + echo) * 0.85;
        lineW += hit * 1.7;
      }
      // 巡回流光
      const hexA = Math.atan2(hex.y - cy, hex.x - cx);
      const sweepGap = Math.abs(((hexA - sweepA + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (sweepGap < 0.55) alpha += (0.55 - sweepGap) * 1;
      ctx.strokeStyle = `rgba(74, 222, 128, ${Math.min(0.95, alpha) * fadeAll})`;
      ctx.lineWidth = lineW;
      drawHex(ctx, hex.x, hex.y, hexR * 0.92 * boot * rim);
      ctx.stroke();
    }
    // 盾缘双圈：主缘 + 外侧微光晕圈
    const rimIn = Math.min(1, tMs / 1400);
    ctx.strokeStyle = `rgba(134, 239, 172, ${0.42 * fadeAll * rimIn})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, shieldR + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(163, 230, 53, ${0.14 * fadeAll * rimIn})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, shieldR + 15, 0, Math.PI * 2);
    ctx.stroke();
  });

  // 幕一：通电波前火花 —— 沿点亮圈边缘迸出细碎荧光
  api.every(64, () => {
    const t = 260 + api.rng() * 1050;
    const bootR = Math.min(1, (t - 220) / 1100) * shieldR;
    const a = api.range(0, Math.PI * 2);
    api.spawn({
      x: cx + Math.cos(a) * bootR, y: cy + Math.sin(a) * bootR,
      vx: api.range(-20, 20), vy: api.range(-30, -6),
      shape: 'spark', size: api.range(1, 1.9), maxLife: api.range(0.4, 0.7),
      color: api.rng() > 0.7 ? '#a3e635' : '#86efac', glow: 1, opacity: 0.8, fadeOut: 0.5,
    });
  }, { from: 300, until: 1500 });

  // 盾内悬浮微尘：荧绿呼吸光点，撑起盾腔体积感
  api.every(85, () => {
    const a = api.range(0, Math.PI * 2);
    const r = api.range(0, shieldR * 0.9);
    api.spawn({
      x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r,
      vy: api.range(-16, -4), shape: 'dot',
      size: api.range(0.8, 1.7), maxLife: api.range(1.2, 2.2),
      color: '#86efac', glow: 0.9, opacity: api.range(0.25, 0.5),
      twinkle: api.range(2, 5), wander: 14, fadeIn: 0.2, fadeOut: 0.4,
    });
  }, { from: 900, until: api.duration - 1100 });

  // 幕二：来袭弹头 + 命中爆点 + 二次噼啪 + 确认微文案
  impacts.forEach((imp) => {
    const flightMs = 620;
    api.at(imp.at - flightMs, () => {
      const fromA = api.range(0, Math.PI * 2);
      const from = {
        x: imp.x + Math.cos(fromA) * Math.max(api.width, api.height) * 0.72,
        y: imp.y + Math.sin(fromA) * Math.max(api.width, api.height) * 0.72,
      };
      api.spawn({
        x: from.x, y: from.y,
        vx: (imp.x - from.x) / (flightMs / 1000), vy: (imp.y - from.y) / (flightMs / 1000),
        shape: 'streak', stretch: 0.1, size: 3.2, maxLife: flightMs / 1000,
        color: '#fca5a5', glow: 1.4, fadeIn: 0.06, fadeOut: 0.06,
        update: (p, dt, sceneApi) => {
          // 弹道摩擦碎屑
          if (sceneApi.rng() < dt * 18) {
            sceneApi.spawn({
              x: p.x, y: p.y, vx: sceneApi.range(-24, 24), vy: sceneApi.range(-24, 24),
              shape: 'spark', size: 1, maxLife: 0.3, color: '#fecaca', glow: 0.8, opacity: 0.7, fadeOut: 0.5,
            });
          }
        },
      });
    });
    api.at(imp.at, () => {
      // 白热闪心 + 主爆火花 + 冲击环
      api.spawn({ x: imp.x, y: imp.y, shape: 'dot', size: 9, endSize: 96, maxLife: 0.45, color: '#f0fdf4', glow: 2.1, fadeOut: 0.85 });
      api.spawn({ x: imp.x, y: imp.y, shape: 'ring', size: 8, endSize: 120, maxLife: 0.7, color: '#86efac', opacity: 0.85, fadeOut: 0.7 });
      api.burst({
        x: imp.x, y: imp.y, count: 30, speed: [90, 320],
        base: { shape: 'spark', size: 2, maxLife: 0.8, color: '#86efac', glow: 1.1, drag: 0.38, fadeOut: 0.4 },
        vary: (p, rng) => {
          const roll = rng();
          if (roll > 0.78) p.color = '#fca5a5';
          else if (roll > 0.62) p.color = '#a3e635';
          p.maxLife = 0.5 + rng() * 0.6;
        },
      });
    });
    // 二次噼啪：残余电荷在命中点附近碎闪
    api.at(imp.at + 210, () => {
      api.burst({
        x: imp.x + api.range(-14, 14), y: imp.y + api.range(-14, 14), count: 9, speed: [30, 130],
        base: { shape: 'spark', size: 1.4, maxLife: 0.45, color: '#bbf7d0', glow: 1, twinkle: 10, fadeOut: 0.5 },
      });
    });
    // HUD 确认微文案
    api.at(imp.at + 260, () => {
      api.spawn({
        x: imp.x, y: imp.y - 34, shape: 'glyph', glyph: 'ABSORBED',
        size: 10, maxLife: 0.8, color: 'rgba(187, 247, 208, 0.92)',
        font: '600 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fadeIn: 0.14, fadeOut: 0.4,
      });
    });
  });

  // 幕三：巡回流光头部火花 + 满盾确认脉冲
  api.every(45, (index) => {
    const a = ((index * 45) / SWEEP_DUR) * Math.PI * 2 - Math.PI;
    api.spawn({
      x: cx + Math.cos(a) * (shieldR + 8), y: cy + Math.sin(a) * (shieldR + 8),
      shape: 'spark', size: 2.2, maxLife: 0.5, color: '#bbf7d0', glow: 1.3, fadeOut: 0.55,
    });
  }, { from: SWEEP_FROM, until: SWEEP_FROM + SWEEP_DUR });
  api.at(SWEEP_FROM + SWEEP_DUR, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: shieldR * 0.5, endSize: shieldR + 12, maxLife: 0.55, color: '#a3e635', opacity: 0.6, fadeOut: 0.6 });
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 30, endSize: 4, maxLife: 0.4, color: '#f0fdf4', glow: 1.6, opacity: 0.8, fadeOut: 0.8 });
  });
};
</script>

<template>
  <div class="energy-shield-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.energyShield" :scene="scene" />
    <div class="shield-hud">
      <Shield :size="22" />
      <small>PHASE AEGIS · INTEGRITY 100%</small>
      <strong>相位护盾 · 蜂窝矩阵稳定</strong>
    </div>
  </div>
</template>

<style scoped lang="scss">
.energy-shield-effect {
  @include effect-stage(hidden);
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

.shield-hud small {
  color: rgba(163, 230, 53, 0.85);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.22em;
}

.shield-hud strong {
  font-size: 13px;
  letter-spacing: 0.14em;
}

@keyframes shield-hud {
  0%, 72% { opacity: 0; transform: translateX(-50%) translateY(14px); }
  80%, 95% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0.85; }
}

@keyframes shield-camera {
  0% { opacity: 0; transform: scale(1.08); }
  9% { opacity: 1; }
  28% { transform: scale(1); }
  39.5% { transform: translate(-3px, 2px) scale(1.005); }
  41.5% { transform: translate(3px, -2px) scale(1); }
  43.5% { transform: translate(0, 0) scale(1); }
  54.5% { transform: translate(-2px, 2px); }
  56.5% { transform: translate(2px, -1px); }
  58.5% { transform: translate(0, 0); }
  68.3% { transform: translate(-2px, 1px); }
  70.3% { transform: translate(0, 0); }
  100% { opacity: 0; transform: scale(1.04); }
}
</style>
