<script setup lang="ts">
import { Zap } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

// 节拍表（总 5200ms = entry 600 + loop 3800 + exit 800）
const NITRO_BEATS = [1400, 2600, 3800]; // 氮气脉冲精确踩点
const TRAILS_UNTIL = 4400; // exit：尾流拉长驶离
const FINALE_AT = 4460; // 最后一波光轨冲出画面

const scene: SceneFn = (api) => {
  api.setTrail(0.14);
  const vpX = api.width / 2; // 消失点
  const vpY = api.height * 0.55;

  // 远景星尘：天幕上闪烁的暗星（纵深基底）
  for (let i = 0; i < 26; i += 1) {
    api.spawn({
      x: api.rng() * api.width,
      y: api.rng() * api.height * 0.42,
      shape: 'dot',
      size: api.range(0.6, 1.4),
      maxLife: 4.8,
      color: api.rng() > 0.7 ? '#67e8f9' : '#fbcfe8',
      glow: 0.7,
      opacity: api.range(0.16, 0.42),
      twinkle: api.range(0.5, 1.6),
      fadeIn: 0.08,
      fadeOut: 0.14,
    });
  }

  // 合成波落日：切片光球（上暖金 → 下品红，下半带百叶栅缝）+ 地平线光带
  api.onFrame((tMs, _dt, ctx) => {
    const t = tMs / 1000;
    const env = Math.min(1, t / 0.9) * Math.min(1, Math.max(0, (4900 - tMs) / 600));
    if (env <= 0.01) return;
    const radius = 88 + Math.sin(t * 1.3) * 7;
    const sunY = vpY - 24;
    const step = 7;
    for (let y = -radius; y < radius; y += step) {
      const k = (y + radius) / (2 * radius);
      const gap = y > 0 ? Math.min(4, 1 + y / 26) : 0;
      const sliceH = step - gap;
      if (sliceH <= 0.5) continue;
      const w = Math.sqrt(Math.max(0, radius * radius - y * y));
      const r = Math.round(253 - 9 * k);
      const g = Math.round(224 - 110 * k);
      const b = Math.round(148 + 34 * k);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(0.4 - 0.14 * k) * env})`;
      ctx.fillRect(vpX - w, sunY + y, w * 2, sliceH);
    }
    // 地平线：白热芯线 + 品红辉光
    const glow = ctx.createLinearGradient(vpX - api.width * 0.4, 0, vpX + api.width * 0.4, 0);
    glow.addColorStop(0, 'rgba(244, 114, 182, 0)');
    glow.addColorStop(0.5, `rgba(244, 114, 182, ${0.3 * env})`);
    glow.addColorStop(1, 'rgba(244, 114, 182, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(vpX - api.width * 0.4, vpY - 2.5, api.width * 0.8, 5);
    const core = ctx.createLinearGradient(vpX - api.width * 0.3, 0, vpX + api.width * 0.3, 0);
    core.addColorStop(0, 'rgba(255, 255, 255, 0)');
    core.addColorStop(0.5, `rgba(255, 241, 242, ${0.4 * env})`);
    core.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = core;
    ctx.fillRect(vpX - api.width * 0.3, vpY - 0.6, api.width * 0.6, 1.2);
  });

  // 霓虹光轨：自消失点透视加速飞出，离点越远越大越亮（近大远小）
  api.every(14, () => {
    const side = api.rng() < 0.5 ? -1 : 1;
    const angle = side > 0 ? api.range(-0.5, 0.5) : Math.PI + api.range(-0.5, 0.5);
    const pitch = api.rng() < 0.62 ? api.range(0.05, 0.5) : api.range(-0.3, 0.05);
    const roll = api.rng();
    api.spawn({
      x: vpX + Math.cos(angle) * 20,
      y: vpY + pitch * 30,
      vx: Math.cos(angle) * api.range(60, 130),
      vy: pitch * api.range(120, 260),
      shape: 'streak',
      stretch: 0.1,
      size: 1,
      maxLife: api.range(0.9, 1.5),
      color: roll < 0.5 ? '#f472b6' : roll < 0.88 ? '#22d3ee' : '#fff1f2',
      glow: 1.1,
      opacity: pitch < 0 ? 0.55 : 1,
      fadeIn: 0.14,
      fadeOut: 0.08,
      update: (p, dt) => {
        p.vx += (p.x - vpX) * 3.8 * dt;
        p.vy += (p.y - vpY) * 3.8 * dt;
        const dx = p.x - vpX;
        const dy = p.y - vpY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        p.size = Math.min(4.4, 1 + dist / 105);
        p.endSize = p.size;
      },
    });
  }, { until: TRAILS_UNTIL });

  // 路面氮气火花：底部向上蹿起（近景热浪）
  api.every(150, () => {
    api.spawn({
      x: vpX + api.range(-api.width * 0.2, api.width * 0.2),
      y: api.height + 6,
      vx: api.range(-40, 40),
      vy: api.range(-300, -160),
      ay: 260,
      shape: 'spark',
      size: api.range(1.4, 2.4),
      maxLife: api.range(0.8, 1.4),
      color: api.rng() < 0.55 ? '#f9a8d4' : '#67e8f9',
      twinkle: 8,
      glow: 1.2,
    });
  }, { from: 420, until: 4150 });

  // 氮气脉冲节拍：白热闪心 + 冲击环 + 回波 + 火花喷泉 + 风切速度线
  NITRO_BEATS.forEach((beat) => {
    api.at(beat, () => {
      api.spawn({ x: vpX, y: vpY, shape: 'dot', size: 22, endSize: 130, maxLife: 0.42, color: '#fff1f2', glow: 2, fadeOut: 0.85 });
      api.spawn({
        x: vpX, y: vpY, shape: 'ring', size: 16,
        endSize: Math.max(api.width, api.height) * 0.58, maxLife: 0.85,
        color: '#f472b6', opacity: 0.6, fadeOut: 0.72,
      });
      api.burst({
        x: vpX, y: api.height - 20, count: 20, speed: [180, 420],
        angle: [-Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5],
        base: { shape: 'spark', size: 1.7, maxLife: 0.7, color: '#f9a8d4', glow: 1.2, ay: 300, drag: 0.4, fadeOut: 0.45 },
        vary: (p, rng) => { if (rng() < 0.4) p.color = '#67e8f9'; },
      });
      for (let i = 0; i < 8; i += 1) {
        const fromLeft = api.rng() < 0.5;
        api.spawn({
          x: fromLeft ? -20 : api.width + 20,
          y: api.range(api.height * 0.2, api.height * 0.85),
          vx: (fromLeft ? 1 : -1) * api.range(1200, 1800),
          shape: 'streak',
          stretch: 0.12,
          size: 1.6,
          maxLife: 0.34,
          color: api.rng() < 0.6 ? '#fff1f2' : '#a5f3fc',
          glow: 0.9,
          opacity: 0.8,
          fadeIn: 0.08,
          fadeOut: 0.2,
        });
      }
    });
    api.at(beat + 150, () => {
      api.spawn({
        x: vpX, y: vpY, shape: 'ring', size: 60,
        endSize: Math.max(api.width, api.height) * 0.4, maxLife: 0.6,
        color: '#22d3ee', opacity: 0.28, fadeOut: 0.6,
      });
    });
  });

  // ── exit：最后一波光轨冲出画面 + 余烬落定 ──
  api.at(FINALE_AT, () => {
    for (let i = 0; i < 14; i += 1) {
      const side = api.rng() < 0.5 ? -1 : 1;
      const angle = side > 0 ? api.range(-0.4, 0.4) : Math.PI + api.range(-0.4, 0.4);
      const pitch = api.range(0, 0.45);
      api.spawn({
        x: vpX + Math.cos(angle) * 30,
        y: vpY + pitch * 40,
        vx: Math.cos(angle) * api.range(700, 1200),
        vy: pitch * api.range(300, 520),
        shape: 'streak',
        stretch: 0.14,
        size: 2.6,
        maxLife: 0.6,
        color: api.rng() < 0.55 ? '#f472b6' : '#22d3ee',
        glow: 1.3,
        fadeIn: 0.06,
        fadeOut: 0.25,
      });
    }
    api.spawn({ x: vpX, y: vpY, shape: 'ring', size: 30, endSize: 260, maxLife: 0.6, color: '#f472b6', opacity: 0.4, fadeOut: 0.65 });
  });
  api.every(70, () => {
    api.spawn({
      x: api.range(0, api.width), y: api.range(api.height * 0.5, api.height),
      shape: 'dot', size: api.range(0.7, 1.5), maxLife: api.range(0.4, 0.7),
      color: api.rng() < 0.6 ? '#f9a8d4' : '#67e8f9', glow: 0.9,
      wander: 26, twinkle: 5, fadeOut: 0.5,
    });
  }, { from: FINALE_AT + 100, until: 4950 });
};
</script>

<template>
  <div class="neon-drive-effect">
    <div class="neon-skyline">
      <span v-for="index in 18" :key="index" :style="{ '--tower': `${34 + (index % 6) * 18}px` }" />
    </div>
    <div class="neon-road">
      <span v-for="mark in 12" :key="mark" class="road-mark" :style="{ animationDelay: `${mark * 90}ms` }" />
    </div>
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.neonDrive" :scene="scene" />
    <div class="neon-dashboard">
      <small class="nd-code">NITRO HORIZON</small>
      <Zap :size="42" />
      <strong>霓虹疾驰</strong>
      <span class="nd-status">OVERDRIVE · 320 KM/H</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.neon-drive-effect {
  @include effect-stage(hidden);
  background:
    linear-gradient(180deg, transparent 0 52%, rgba(244, 114, 182, 0.12) 52% 100%),
    radial-gradient(circle at 50% 76%, rgba(34, 211, 238, 0.2), transparent 38%);
}

.neon-skyline {
  position: absolute;
  left: 8%;
  right: 8%;
  bottom: 44%;
  display: flex;
  align-items: end;
  justify-content: space-between;
  opacity: 0;
  animation: skyline-in 5.2s ease both;
}

.neon-skyline span {
  width: 3.4%;
  height: var(--tower);
  border: 1px solid rgba(34, 211, 238, 0.24);
  background:
    repeating-linear-gradient(180deg, rgba(244, 114, 182, 0.36) 0 2px, transparent 2px 8px),
    rgba(15, 23, 42, 0.42);
  box-shadow: 0 0 18px rgba(244, 114, 182, 0.2);
}

.neon-road {
  position: absolute;
  left: 50%;
  bottom: -12%;
  width: min(780px, 120vw);
  height: 58vh;
  transform: translateX(-50%) perspective(520px) rotateX(62deg);
  transform-origin: center bottom;
  background:
    linear-gradient(90deg, transparent 0 13%, rgba(34, 211, 238, 0.55) 13.4%, transparent 14%, transparent 86%, rgba(244, 114, 182, 0.55) 86.6%, transparent 87%),
    repeating-linear-gradient(90deg, transparent 0 64px, rgba(34, 211, 238, 0.22) 65px 66px),
    repeating-linear-gradient(0deg, transparent 0 42px, rgba(244, 114, 182, 0.24) 43px 44px);
  filter: drop-shadow(0 0 22px rgba(34, 211, 238, 0.32));
  animation: road-pulse 5.2s ease both;
}

.road-mark {
  position: absolute;
  left: 50%;
  top: 0;
  width: 8px;
  height: 74px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.56);
  opacity: 0;
  transform: translateX(-50%);
  animation: road-mark 760ms linear infinite;
}

.neon-dashboard {
  position: absolute;
  left: 50%;
  top: 48%;
  min-width: 212px;
  border: 1px solid rgba(244, 114, 182, 0.36);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.44);
  color: #fbcfe8;
  display: grid;
  gap: 7px;
  place-items: center;
  padding: 17px 28px 13px;
  text-align: center;
  box-shadow:
    inset 0 0 28px rgba(244, 114, 182, 0.12),
    0 24px 70px rgba(34, 211, 238, 0.16);
  transform: translate(-50%, -50%);
  animation: dashboard-pop 5.2s ease both;
}

.neon-dashboard svg {
  color: #f472b6;
  filter: drop-shadow(0 0 24px rgba(244, 114, 182, 0.64));
}

.neon-dashboard strong {
  font-size: 19px;
  letter-spacing: 0.12em;
}

.nd-code {
  color: rgba(251, 207, 232, 0.66);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.26em;
}

.nd-status {
  width: 100%;
  border-top: 1px solid rgba(244, 114, 182, 0.26);
  color: #67e8f9;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
  padding-top: 8px;
  animation: nd-status 5.2s ease both;
}

@keyframes skyline-in {
  0%,
  100% {
    opacity: 0;
    transform: translateY(18px);
  }
  16%,
  82% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes road-pulse {
  0%,
  100% {
    opacity: 0;
  }
  16%,
  84% {
    opacity: 1;
  }
}

@keyframes road-mark {
  0% {
    opacity: 0;
    transform: translate(-50%, -40px) scaleY(0.4);
  }
  24% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, 58vh) scaleY(1.5);
  }
}

@keyframes dashboard-pop {
  0%,
  28% {
    opacity: 0;
    transform: translate(-50%, -44%) scale(0.9);
  }
  38%,
  80% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -58%) scale(0.96);
  }
}

@keyframes nd-status {
  0%,
  54% {
    opacity: 0;
    transform: translateY(5px);
  }
  62%,
  84% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
  }
}
</style>
