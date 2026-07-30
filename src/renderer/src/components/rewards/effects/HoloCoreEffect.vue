<script setup lang="ts">
import { Cpu } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

// 节拍表（总 5400ms = entry 550 + loop 4000 + exit 850）
const IGNITE_AT = 380; // entry：上线瞬间紫色数据爆发
const ORBIT_FROM = 550; // loop：三层轨道通电环流
const RING_BEATS = [1250, 2050, 2850, 3650]; // 干涉环精确踩点
const WIND_DOWN = 4550; // exit：轨道逐层减速消隐

const HEX_TAGS = ['0x3F', '0xA7', 'SYNC', 'NODE', 'CORE', 'LINK'];

const scene: SceneFn = (api) => {
  api.setTrail(0.15);
  const cx = api.width / 2;
  const cy = api.height / 2;
  const squash = 0.34; // 透视压扁比

  // 远景星尘：极暗、闪烁、压在最深处（纵深基底）
  for (let i = 0; i < 36; i += 1) {
    api.spawn({
      x: api.rng() * api.width,
      y: api.rng() * api.height,
      shape: 'dot',
      size: api.range(0.6, 1.5),
      maxLife: 5.2,
      color: api.rng() > 0.72 ? '#22d3ee' : '#c4b5fd',
      glow: 0.7,
      opacity: api.range(0.16, 0.4),
      twinkle: api.range(0.5, 1.6),
      fadeIn: 0.08,
      fadeOut: 0.14,
    });
  }

  // ── 幕一（entry）：能量自四周汇入 → 白热点火 ──
  api.every(22, () => {
    const angle = api.range(0, Math.PI * 2);
    const r = api.range(170, 340);
    api.spawn({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r * 0.72,
      vx: -Math.cos(angle) * r * 2.7,
      vy: -Math.sin(angle) * r * 0.72 * 2.7,
      shape: 'streak',
      stretch: 0.06,
      size: 1.6,
      maxLife: 0.38,
      color: api.rng() < 0.7 ? '#c4b5fd' : '#67e8f9',
      glow: 1,
      fadeIn: 0.12,
      fadeOut: 0.24,
    });
  }, { until: IGNITE_AT - 40 });

  api.at(IGNITE_AT, () => {
    // 白热闪心 + 紫色数据爆发 + 十六进制标签迸出
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 46, endSize: 8, maxLife: 0.5, color: '#f5f3ff', glow: 2.4, fadeOut: 0.85 });
    api.burst({
      x: cx,
      y: cy,
      count: 72,
      speed: [90, 470],
      base: { shape: 'spark', size: 1.8, drag: 0.3, color: '#c4b5fd', twinkle: 7, glow: 1.2, fadeOut: 0.45 },
      vary: (p, rng) => {
        p.maxLife = 0.7 + rng() * 1;
        if (rng() < 0.28) p.color = '#67e8f9';
        else if (rng() < 0.1) p.color = '#f5f3ff';
      },
    });
    for (let i = 0; i < 6; i += 1) {
      api.spawn({
        x: cx + api.range(-90, 90),
        y: cy + api.range(-30, 40),
        vy: -api.range(26, 60),
        shape: 'glyph',
        glyph: api.pick(HEX_TAGS),
        size: 11,
        maxLife: api.range(0.8, 1.2),
        color: 'rgba(216, 204, 255, 0.85)',
        font: '600 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fadeIn: 0.12,
        fadeOut: 0.35,
      });
    }
  });
  api.at(500, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 30, endSize: 240, maxLife: 0.8, color: '#a78bfa', opacity: 0.6, fadeOut: 0.7 });
  });

  // ── 幕二（loop）：三层反向轨道 —— 近大远小 + 后侧压暗的遮挡立体感 ──
  const orbits = [
    { radius: 122, speed: 1.7, tint: '#c4b5fd', rgb: '196, 181, 253', yOffset: -6, scale: 1 },
    { radius: 186, speed: -1.15, tint: '#22d3ee', rgb: '34, 211, 238', yOffset: 8, scale: 1 },
    { radius: 250, speed: 0.85, tint: '#a78bfa', rgb: '167, 139, 250', yOffset: 22, scale: 1 },
  ];
  for (const orbit of orbits) {
    api.every(40, () => {
      let angle = api.range(0, Math.PI * 2);
      const base = api.range(1.5, 2.9);
      api.spawn({
        x: cx + Math.cos(angle) * orbit.radius,
        y: cy + orbit.yOffset + Math.sin(angle) * orbit.radius * squash,
        shape: 'spark',
        size: base,
        maxLife: api.range(1.1, 1.8),
        color: api.rng() < 0.1 ? '#f5f3ff' : orbit.tint,
        glow: 1.1,
        fadeIn: 0.12,
        update: (p, dt) => {
          angle += orbit.speed * orbit.scale * dt;
          const depth = (Math.sin(angle) + 1) / 2; // 1=前景近点 0=远景后侧
          p.x = cx + Math.cos(angle) * orbit.radius;
          p.y = cy + orbit.yOffset + Math.sin(angle) * orbit.radius * squash;
          p.size = base * (0.6 + 0.65 * depth);
          p.endSize = p.size;
          p.opacity = 0.28 + 0.72 * depth;
        },
      });
    }, { from: ORBIT_FROM, until: WIND_DOWN - 80 });
  }

  // 轨道导轨（onFrame）：远弧压暗、近弧提亮，带极缓进动
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < ORBIT_FROM - 80 || tMs > 4900) return;
    const ramp = Math.min(1, (tMs - ORBIT_FROM + 80) / 520) * Math.min(1, Math.max(0, (4900 - tMs) / 380));
    if (ramp <= 0.01) return;
    for (const orbit of orbits) {
      const wobble = Math.sin((tMs / 1000) * 0.6 + orbit.radius) * 0.045;
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${orbit.rgb}, ${0.09 * ramp})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy + orbit.yOffset, orbit.radius, orbit.radius * squash, wobble, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(${orbit.rgb}, ${0.26 * ramp})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy + orbit.yOffset, orbit.radius, orbit.radius * squash, wobble, 0, Math.PI);
      ctx.stroke();
    }
  });

  // 中轴能量柱：呼吸光带 + 盘旋上升光粒
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < 620 || tMs > 4680) return;
    const env = Math.min(1, (tMs - 620) / 420) * Math.min(1, Math.max(0, (4680 - tMs) / 380));
    if (env <= 0.01) return;
    const w = 30 + Math.sin((tMs / 1000) * 2.6) * 8;
    const grad = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
    grad.addColorStop(0, 'rgba(167, 139, 250, 0)');
    grad.addColorStop(0.5, `rgba(233, 213, 255, ${0.13 * env})`);
    grad.addColorStop(1, 'rgba(167, 139, 250, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - w, cy - 190, w * 2, 336);
  });
  api.every(24, () => {
    let angle = api.range(0, Math.PI * 2);
    const swirl = api.range(15, 42);
    api.spawn({
      x: cx + Math.cos(angle) * swirl,
      y: cy + api.range(70, 146),
      vy: -api.range(130, 230),
      shape: 'spark',
      size: api.range(1.3, 2.3),
      maxLife: api.range(0.9, 1.5),
      color: api.rng() < 0.55 ? '#e9d5ff' : '#67e8f9',
      glow: 1.2,
      twinkle: 8,
      fadeIn: 0.1,
      update: (p, dt) => {
        angle += 6.2 * dt;
        p.x = cx + Math.cos(angle) * swirl;
        p.opacity = 0.5 + 0.5 * ((Math.sin(angle) + 1) / 2);
      },
    });
  }, { from: 650, until: 4380 });

  // 干涉环节拍：主环 + 回波 + 二次噼啪
  RING_BEATS.forEach((beat, i) => {
    api.at(beat, () => {
      api.spawn({
        x: cx, y: cy, shape: 'ring', size: 44, endSize: 300 + i * 10,
        maxLife: 1.1, color: '#a78bfa', opacity: 0.5, fadeOut: 0.7,
      });
      api.burst({
        x: cx, y: cy, count: 10, speed: [90, 240],
        base: { shape: 'spark', size: 1.5, maxLife: 0.5, color: '#67e8f9', glow: 1.1, drag: 0.35, fadeOut: 0.5 },
      });
    });
    api.at(beat + 170, () => {
      api.spawn({
        x: cx, y: cy, shape: 'ring', size: 60, endSize: 210,
        maxLife: 0.7, color: '#22d3ee', opacity: 0.26, fadeOut: 0.6,
      });
    });
  });

  // ── 幕三（exit）：轨道逐层减速 → 收束坍缩 → 核心波光熄灭 ──
  orbits.forEach((orbit, i) => {
    api.at(WIND_DOWN + i * 140, () => { orbit.scale = 0.42; });
    api.at(WIND_DOWN + 320 + i * 140, () => { orbit.scale = 0.12; });
  });
  api.at(4650, () => {
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 240, endSize: 10, maxLife: 0.4, color: '#e9d5ff', opacity: 0.7, fadeIn: 0.06, fadeOut: 0.3 });
  });
  api.at(4780, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 26, endSize: 130, maxLife: 0.5, color: '#f5f3ff', glow: 2, fadeOut: 0.9 });
    api.burst({
      x: cx, y: cy, count: 30, speed: [20, 90],
      base: { shape: 'dot', size: 1.4, maxLife: 0.9, color: '#c4b5fd', glow: 1, wander: 34, twinkle: 3, fadeOut: 0.5 },
      vary: (p, rng) => { if (rng() < 0.3) p.color = '#67e8f9'; },
    });
  });
  api.every(70, () => {
    api.spawn({
      x: cx + api.range(-140, 140), y: cy + api.range(-100, 100),
      shape: 'dot', size: api.range(0.8, 1.6), maxLife: api.range(0.4, 0.7),
      color: '#c4b5fd', glow: 0.9, wander: 30, twinkle: 4, fadeOut: 0.5,
    });
  }, { from: 4820, until: 5200 });
};
</script>

<template>
  <div class="holo-core-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.holoCore" :scene="scene" />
    <div class="holo-core">
      <small class="hc-code">HOLO NEXUS · TRI-ORBIT RIG</small>
      <Cpu :size="44" />
      <strong>全息中枢</strong>
      <span class="hc-status">CORE ONLINE · SYNC 100%</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.holo-core-effect {
  @include effect-stage(hidden);
  display: grid;
  place-items: center;
}

.holo-core {
  position: relative;
  min-width: 216px;
  border: 1px solid rgba(167, 139, 250, 0.38);
  border-radius: 10px;
  background: rgba(30, 27, 75, 0.5);
  color: #ede9fe;
  display: grid;
  gap: 8px;
  place-items: center;
  padding: 20px 30px 16px;
  text-align: center;
  box-shadow:
    inset 0 0 28px rgba(167, 139, 250, 0.14),
    0 0 70px rgba(167, 139, 250, 0.26);
  animation: holo-core 5.4s ease both;
}

.holo-core::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.28), transparent);
  opacity: 0;
  animation: holo-glint 1.7s ease-in-out infinite;
}

.holo-core svg,
.holo-core strong,
.holo-core small,
.holo-core span {
  position: relative;
}

.holo-core svg {
  color: #c4b5fd;
  filter: drop-shadow(0 0 24px rgba(167, 139, 250, 0.7));
}

.holo-core strong {
  font-size: 20px;
  letter-spacing: 0.14em;
}

.hc-code {
  color: rgba(196, 181, 253, 0.72);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.24em;
}

.hc-status {
  width: 100%;
  border-top: 1px solid rgba(167, 139, 250, 0.28);
  color: #67e8f9;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.18em;
  padding-top: 9px;
  animation: hc-status 5.4s ease both;
}

@keyframes holo-core {
  0% {
    opacity: 0;
    transform: translateY(24px) scale(0.86);
    filter: brightness(2.4);
  }
  9% {
    opacity: 1;
    transform: translateY(0) scale(1.02);
    filter: brightness(1.4);
  }
  15%,
  80% {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: brightness(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-16px) scale(0.94);
    filter: brightness(0.6);
  }
}

@keyframes hc-status {
  0%,
  52% {
    opacity: 0;
    transform: translateY(6px);
  }
  60%,
  86% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
  }
}

@keyframes holo-glint {
  0%,
  100% {
    opacity: 0;
    transform: translateX(-26%);
  }
  44% {
    opacity: 0.7;
    transform: translateX(26%);
  }
}
</style>
