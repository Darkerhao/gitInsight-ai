<script setup lang="ts">
import { Plane } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const CITY_COLORS = ['#5eead4', '#99f6e4', '#a5f3fc', '#67e8f9'];
const LOCK_BEATS = [1400, 2300, 3200];

const scene: SceneFn = (api) => {
  api.setTrail(0.18);
  const vpX = api.width / 2; // 地平线消失点
  const vpY = api.height * 0.34;

  // ── 远景层：地平线辉光 + 消失点脉动 + 高空星点
  api.onFrame((tMs, _dt, ctx) => {
    const ramp = Math.min(1, tMs / 650) * Math.max(0, Math.min(1, (api.duration - 500 - tMs) / 700));
    if (ramp <= 0.02) return;
    const grad = ctx.createLinearGradient(0, vpY - 40, 0, vpY + 60);
    grad.addColorStop(0, 'rgba(45, 212, 191, 0)');
    grad.addColorStop(0.5, `rgba(45, 212, 191, ${0.14 * ramp})`);
    grad.addColorStop(1, 'rgba(45, 212, 191, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, vpY - 40, api.width, 100);
    const pulse = 0.6 + 0.4 * Math.sin(tMs / 300);
    const core = ctx.createRadialGradient(vpX, vpY, 0, vpX, vpY, 46);
    core.addColorStop(0, `rgba(204, 251, 241, ${0.3 * pulse * ramp})`);
    core.addColorStop(1, 'rgba(204, 251, 241, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(vpX, vpY, 46, 0, Math.PI * 2);
    ctx.fill();
  });
  for (let i = 0; i < 18; i += 1) {
    api.spawn({
      x: api.rng() * api.width, y: api.rng() * vpY * 0.8,
      vx: api.range(-6, -2), shape: 'dot', size: api.range(0.6, 1.3),
      maxLife: api.range(3.2, 4.6), color: '#e0f2fe', glow: 0.5,
      opacity: api.range(0.16, 0.4), twinkle: api.range(0.6, 1.6), fadeIn: 0.14, fadeOut: 0.22,
    });
  }

  // ── 城市灯光：自消失点向两侧透视加速飞掠（近层拖影 + 远层微移暗光）
  api.every(17, () => {
    const angle = api.range(Math.PI * 0.12, Math.PI * 0.88); // 下半平面
    const startRadius = api.range(8, 50);
    api.spawn({
      x: vpX + Math.cos(angle) * startRadius,
      y: vpY + Math.sin(angle) * startRadius * 0.7,
      vx: Math.cos(angle) * api.range(40, 90),
      vy: Math.sin(angle) * api.range(40, 90),
      shape: 'streak',
      stretch: 0.09,
      size: api.range(1.2, 2.6),
      maxLife: api.range(1.1, 1.9),
      color: api.rng() < 0.09 ? '#fde68a' : api.pick(CITY_COLORS),
      glow: 1,
      fadeIn: 0.18,
      fadeOut: 0.1,
      update: (p, dt) => {
        p.vx += (p.x - vpX) * 2.7 * dt;
        p.vy += (p.y - vpY) * 2.7 * dt;
      },
    });
  }, { until: api.duration - 850 });
  api.every(46, () => {
    const angle = api.range(Math.PI * 0.16, Math.PI * 0.84);
    const r = api.range(10, 60);
    api.spawn({
      x: vpX + Math.cos(angle) * r,
      y: vpY + Math.sin(angle) * r * 0.7,
      vx: Math.cos(angle) * api.range(8, 22),
      vy: Math.sin(angle) * api.range(8, 22),
      shape: 'dot', size: api.range(0.7, 1.3), maxLife: api.range(1.4, 2.2),
      color: 'rgba(94, 234, 212, 0.6)', glow: 0.5, opacity: 0.4,
      fadeIn: 0.24, fadeOut: 0.2,
    });
  }, { from: 200, until: api.duration - 1000 });

  // ── 航空信标：红绿双闪导航灯（成对频闪）
  api.every(430, () => {
    const x = api.range(api.width * 0.12, api.width * 0.88);
    const y = api.range(api.height * 0.44, api.height * 0.82);
    [0, 1].forEach((side) => {
      api.spawn({
        x: x + side * 12 - 6, y,
        shape: 'dot', size: api.range(2.2, 3.2),
        maxLife: api.range(0.9, 1.5),
        color: side === 0 ? '#f87171' : '#4ade80',
        glow: 1.5, twinkle: 4.5, fadeIn: 0.16, fadeOut: 0.3,
      });
    });
  }, { from: 480, until: api.duration - 1100 });

  // ── HUD 锁定节拍：括号环收缩 → 准星落定 → 确认微爆
  LOCK_BEATS.forEach((beat) => {
    const x = api.range(api.width * 0.22, api.width * 0.78);
    const y = api.range(api.height * 0.42, api.height * 0.76);
    api.at(beat, () => {
      api.spawn({ x, y, shape: 'ring', size: 58, endSize: 16, maxLife: 0.45, color: '#a5f3fc', opacity: 0.9, fadeOut: 0.35 });
      api.spawn({
        x, y, shape: 'glyph', glyph: '⌖', size: 27, maxLife: 1,
        color: '#e0f2fe', fadeIn: 0.2, fadeOut: 0.35,
      });
    });
    api.at(beat + 320, () => {
      api.spawn({ x, y, shape: 'dot', size: 8, endSize: 2, maxLife: 0.3, color: '#ecfeff', glow: 1.7 });
      api.burst({
        x, y, count: 6, speed: [50, 150],
        base: { shape: 'spark', size: 1.3, maxLife: 0.4, color: '#67e8f9', glow: 1.1, drag: 0.3, fadeOut: 0.5 },
      });
    });
  });

  // ── 风切速度线：掠航侧风的白色细拖影
  api.every(260, () => {
    const y = api.range(api.height * 0.14, api.height * 0.9);
    const fromLeft = api.rng() < 0.5;
    api.spawn({
      x: fromLeft ? -20 : api.width + 20, y,
      vx: (fromLeft ? 1 : -1) * api.range(900, 1400),
      shape: 'streak', stretch: 0.08, size: 1.1, maxLife: 0.55,
      color: 'rgba(224, 242, 254, 0.6)', glow: 0.4, opacity: 0.6, fadeOut: 0.4,
    });
  }, { from: 700, until: api.duration - 950 });

  // ── 螺旋桨气流：底部两侧持续卷起
  api.every(44, () => {
    const onLeft = api.rng() < 0.5;
    api.spawn({
      x: api.width * (onLeft ? api.range(0.06, 0.24) : api.range(0.76, 0.94)),
      y: api.height + 8,
      vx: (onLeft ? 1 : -1) * api.range(20, 70),
      vy: -api.range(90, 220),
      drag: 0.6,
      shape: 'dot',
      size: api.range(1, 2),
      maxLife: api.range(1, 2),
      color: '#99f6e4',
      twinkle: api.range(4, 8),
      wander: 60,
      glow: 0.9,
    });
  }, { until: api.duration - 900 });

  // ── 终幕（exit）：掠过城市上空 —— 消失点光矢齐射 + 地平线余晖
  api.at(4480, () => {
    api.spawn({ x: vpX, y: vpY, shape: 'dot', size: 16, endSize: 90, maxLife: 0.5, color: '#ccfbf1', glow: 1.8, fadeOut: 0.8 });
    api.burst({
      x: vpX, y: vpY, count: 26, speed: [300, 760],
      angle: [Math.PI * 0.1, Math.PI * 0.9],
      base: { shape: 'streak', stretch: 0.1, size: 1.8, maxLife: 0.9, color: '#5eead4', glow: 1, drag: 0.6, fadeOut: 0.4 },
      vary: (p, rng) => {
        if (rng() < 0.3) p.color = '#a5f3fc';
        p.maxLife = 0.6 + rng() * 0.5;
      },
    });
  });
  api.at(4700, () => {
    api.spawn({ x: vpX, y: vpY, shape: 'ring', size: 14, endSize: 200, maxLife: 0.8, color: '#2dd4bf', opacity: 0.4, fadeOut: 0.7 });
  });
};
</script>

<template>
  <div class="drone-flyover-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.droneFlyover" :scene="scene" />
    <div class="drone-city">
      <span
        v-for="tower in 36"
        :key="tower"
        class="drone-tower"
        :style="{ height: `${18 + ((tower * 17) % 78)}px`, animationDelay: `${(tower % 8) * 52}ms` }"
      />
    </div>
    <div class="drone-hud">
      <span class="hud-corner tl" />
      <span class="hud-corner tr" />
      <span class="hud-corner bl" />
      <span class="hud-corner br" />
    </div>
    <div class="drone-camera">
      <small class="camera-code">SKYLINE RUN · ALT 120M</small>
      <Plane :size="48" />
      <strong>掠城航线</strong>
      <small class="camera-meta">WAYPOINT 04/04 · ALL TARGETS LOCKED</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.drone-flyover-effect {
  @include effect-stage(hidden);
  perspective: 800px;
}

.drone-city {
  position: absolute;
  left: 50%;
  top: 58%;
  width: min(820px, 92vw);
  height: min(440px, 64vh);
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  align-items: end;
  gap: 9px;
  padding: 24px;
  transform: translate(-50%, -50%) rotateX(62deg) translateZ(-80px);
  transform-origin: center bottom;
  animation: drone-city 5.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.drone-city::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(45, 212, 191, 0.18) 1px, transparent 1px),
    linear-gradient(90deg, rgba(45, 212, 191, 0.18) 1px, transparent 1px);
  background-size: 44px 44px;
}

.drone-tower {
  position: relative;
  z-index: 1;
  border: 1px solid rgba(45, 212, 191, 0.28);
  border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, rgba(45, 212, 191, 0.36), rgba(14, 165, 233, 0.08));
  box-shadow: 0 0 22px rgba(45, 212, 191, 0.14);
  opacity: 0;
  transform-origin: center bottom;
  animation: drone-tower 3.6s ease both;
}

.drone-hud {
  position: absolute;
  inset: 12% 16%;
  pointer-events: none;
  animation: drone-hud 5.2s ease both;
}

.hud-corner {
  position: absolute;
  width: 34px;
  height: 34px;
  border-color: rgba(165, 243, 252, 0.6);
}

.hud-corner.tl { left: 0; top: 0; border-left: 2px solid; border-top: 2px solid; }
.hud-corner.tr { right: 0; top: 0; border-right: 2px solid; border-top: 2px solid; }
.hud-corner.bl { left: 0; bottom: 0; border-left: 2px solid; border-bottom: 2px solid; }
.hud-corner.br { right: 0; bottom: 0; border-right: 2px solid; border-bottom: 2px solid; }

.drone-camera {
  position: absolute;
  left: 50%;
  top: 38%;
  display: grid;
  gap: 7px;
  place-items: center;
  color: #ccfbf1;
  transform: translate(-50%, -50%);
  animation: drone-camera 5.2s ease both;
}

.drone-camera strong {
  font-size: 16px;
  letter-spacing: 0.16em;
}

.drone-camera small {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.22em;
  color: rgba(153, 246, 228, 0.66);
}

.camera-meta {
  color: rgba(165, 243, 252, 0.74);
}

@keyframes drone-city {
  0% { opacity: 0; transform: translate(-50%, -8%) rotateX(62deg) translateZ(-260px) scale(1.42); }
  16%, 82% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -74%) rotateX(62deg) translateZ(100px) scale(0.76); }
}

@keyframes drone-tower {
  0% { opacity: 0; transform: scaleY(0.18); }
  22%, 86% { opacity: 1; transform: scaleY(1); }
  100% { opacity: 0; transform: scaleY(0.86); }
}

@keyframes drone-hud {
  0%, 10% { opacity: 0; transform: scale(1.06); }
  16%, 84% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.98); }
}

@keyframes drone-camera {
  0%, 100% { opacity: 0; transform: translate(-50%, -40%) scale(0.82); }
  14%, 84% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
</style>
