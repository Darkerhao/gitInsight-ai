<script setup lang="ts">
import { Hammer } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const MOLTEN = ['#fdba74', '#fb923c', '#fde68a', '#fff7ed'];
const COLD_DUST = ['#475569', '#64748b', '#38bdf8', '#7dd3fc', '#78716c'];
/** 三次递强引力锤击 → 入 loop 2.8s 处氢聚变点火（phases: 850 / 5450 / 1000，总 7300ms） */
const STRIKES = [1500, 2380, 3230];
const IGNITE_AT = 3650;

const scene: SceneFn = (api) => {
  api.setTrail(0.22);
  const cx = api.width / 2;
  const cy = api.height * 0.52;
  const maxR = Math.max(api.width, api.height) * 0.58;
  const state = { heat: 0.14, target: 0.14, ignited: false };

  // ── 幕一 · 蓄势：冷暗星云缓旋，被引力砧缓慢拉入 ──
  const spawnDust = (r0: number, slow: boolean) => {
    let radius = r0;
    let angle = api.range(0, Math.PI * 2);
    const w = api.range(0.14, 0.34) * (slow ? 0.7 : 1);
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * 0.78,
      shape: 'dot',
      size: api.range(0.9, 2.3),
      maxLife: api.range(3.2, 5.6),
      color: api.pick(COLD_DUST),
      glow: 0.55,
      opacity: api.range(0.22, 0.55),
      twinkle: api.range(0, 1.1),
      fadeIn: 0.16,
      fadeOut: 0.3,
      update: (p, dt) => {
        if (!state.ignited) {
          angle += w * dt;
          radius = Math.max(44, radius - (10 + radius * 0.07) * dt);
          p.x = cx + Math.cos(angle) * radius;
          p.y = cy + Math.sin(angle) * radius * 0.78;
        } else {
          // 点火后：星风把胎盘星云吹散
          const dx = p.x - cx;
          const dy = p.y - cy;
          const d = Math.hypot(dx, dy) || 1;
          p.vx += (dx / d) * 860 * dt;
          p.vy += (dy / d) * 860 * dt;
          p.life += dt * 1.6;
        }
      },
    });
  };
  for (let i = 0; i < 104; i += 1) spawnDust(api.range(80, maxR), true);
  api.every(48, () => spawnDust(maxR * api.range(0.5, 0.9), false), { until: 3200 });

  // 恒星核心：锤击逐档增亮，点火后转入呼吸脉动，退场余温冷却
  api.onFrame((tMs, dt, ctx) => {
    state.heat += (state.target - state.heat) * Math.min(1, dt * 6);
    const fade = Math.min(1, Math.max(0, (7300 - tMs) / 850));
    const breath = state.ignited ? 1 + Math.sin((tMs / 1000) * 3.1) * 0.07 : 1;
    const r = (30 + state.heat * 46) * breath;
    const a = Math.min(1, state.heat) * fade;
    if (a <= 0.02) return;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.6);
    g.addColorStop(0, `rgba(255, 247, 237, ${0.9 * a})`);
    g.addColorStop(0.22, `rgba(253, 186, 116, ${0.62 * a})`);
    g.addColorStop(0.55, `rgba(251, 146, 60, ${0.26 * a})`);
    g.addColorStop(1, 'rgba(251, 146, 60, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.6, 0, Math.PI * 2);
    ctx.fill();
  });

  // 锤击间隙：核心闷烧，零星熔滴上浮
  api.every(96, () => {
    api.spawn({
      x: cx + api.range(-26, 26), y: cy + api.range(-16, 16),
      vx: api.range(-14, 14), vy: -api.range(16, 42),
      shape: 'spark', size: api.range(1, 2), maxLife: api.range(0.5, 0.9),
      color: api.pick(MOLTEN), glow: 1, drag: 0.6, fadeOut: 0.5,
    });
  }, { from: 1600, until: 3550 });

  // ── 幕二 · 爆发：三次递强引力锤击 ──
  STRIKES.forEach((t, level) => {
    // 引力锤自穹顶压落（白炽压缩束）
    api.at(t - 130, () => {
      api.burst({
        x: cx + api.range(-10, 10), y: cy - 300, count: 10 + level * 5,
        speed: [720, 1080], angle: [Math.PI / 2 - 0.07, Math.PI / 2 + 0.07],
        base: { shape: 'streak', stretch: 0.1, size: 2.2, maxLife: 0.3, color: '#e0f2fe', glow: 1.1, fadeIn: 0.08, fadeOut: 0.3 },
      });
    });
    // 锤落：白闪 + 熔浆火花 + 双冲击环 + 核心增亮一档
    api.at(t, () => {
      state.target = 0.42 + level * 0.26;
      api.spawn({ x: cx, y: cy, shape: 'dot', size: 12 + level * 6, endSize: 170 + level * 95, maxLife: 0.4, color: '#fff7ed', glow: 2.1, fadeOut: 0.85 });
      api.burst({
        x: cx, y: cy, count: 44 + level * 22, speed: [130 + level * 55, 360 + level * 150],
        base: { shape: 'spark', size: 2 + level * 0.5, glow: 1.15, ay: 170, drag: 0.42, fadeOut: 0.4 },
        vary: (p, rng) => {
          p.color = MOLTEN[Math.floor(rng() * MOLTEN.length)];
          p.maxLife = 0.55 + rng() * 0.85;
          if (rng() > 0.72) {
            p.shape = 'streak';
            p.stretch = 0.07;
          }
        },
      });
      api.spawn({ x: cx, y: cy, shape: 'ring', size: 26, endSize: 230 + level * 130, maxLife: 0.72, color: level === 2 ? '#fff7ed' : '#fdba74', opacity: 0.85, fadeOut: 0.7 });
      api.spawn({ x: cx, y: cy, shape: 'ring', size: 18, endSize: 130 + level * 70, maxLife: 0.5, color: '#38bdf8', opacity: 0.5, fadeOut: 0.6 });
    });
  });

  // 聚变点火：全屏暖闪 + 星风外抛 + 三重冲击环
  api.at(IGNITE_AT, () => {
    state.ignited = true;
    state.target = 1.5;
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 26, endSize: Math.max(api.width, api.height) * 1.15, maxLife: 0.85, color: '#fff7ed', glow: 2.4, fadeOut: 0.94 });
    api.burst({
      x: cx, y: cy, count: 120, speed: [240, 760],
      base: { shape: 'streak', stretch: 0.09, size: 2.4, maxLife: 1.2, glow: 1.2, drag: 0.42, fadeOut: 0.45 },
      vary: (p, rng) => {
        p.color = rng() > 0.72 ? '#7dd3fc' : MOLTEN[Math.floor(rng() * MOLTEN.length)];
        p.maxLife = 0.7 + rng() * 0.9;
      },
    });
  });
  [0, 150, 330].forEach((delay, i) => {
    api.at(IGNITE_AT + delay, () => {
      api.spawn({
        x: cx, y: cy, shape: 'ring', size: 30,
        endSize: Math.max(api.width, api.height) * (0.44 + i * 0.22),
        maxLife: 1, color: i === 1 ? '#7dd3fc' : '#fdba74', opacity: 0.8, fadeOut: 0.75,
      });
    });
  });
  api.at(4450, () => {
    state.target = 1.02; // 光度校准，回落至主序
  });

  // ── 幕三 · 余韵：新星呼吸，日冕微粒与日珥弧 ──
  api.every(56, () => {
    const a = api.range(0, Math.PI * 2);
    const r = 52 + state.heat * 30;
    api.spawn({
      x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r,
      vx: Math.cos(a) * api.range(16, 54), vy: Math.sin(a) * api.range(16, 54),
      shape: 'spark', size: api.range(1.2, 2.4), maxLife: api.range(0.5, 1),
      color: api.pick(MOLTEN), glow: 1.1, drag: 0.5, fadeOut: 0.45,
    });
  }, { from: 4150, until: 6350 });
  api.every(700, () => {
    const a = api.range(0, Math.PI * 2);
    api.burst({
      x: cx + Math.cos(a) * 58, y: cy + Math.sin(a) * 58, count: 8,
      speed: [60, 150], angle: [a - 0.5, a + 0.5],
      base: {
        shape: 'streak', stretch: 0.12, size: 1.8, maxLife: 0.8, color: '#fde68a',
        glow: 1, drag: 0.4, ax: -Math.cos(a) * 120, ay: -Math.sin(a) * 120, fadeOut: 0.5,
      },
    });
  }, { from: 4500, until: 6200 });

  // 退场：炉架余温冷却，零星余烬
  api.every(110, () => {
    api.spawn({
      x: cx + api.range(-120, 120), y: cy + api.range(-100, 100),
      shape: 'dot', size: api.range(0.8, 1.8), maxLife: api.range(0.7, 1.2),
      color: api.pick(['#fdba74', '#7dd3fc', '#e2e8f0']), glow: 0.9, wander: 30, twinkle: 2, fadeOut: 0.5,
    });
  }, { from: 6350, until: 7000 });
};
</script>

<template>
  <div class="star-forge-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.starForge" :scene="scene" />
    <div class="sf-frame">
      <span class="sf-arc is-left" />
      <span class="sf-arc is-right" />
      <span class="sf-rail" />
      <span class="sf-ticks"><i class="t1" /><i class="t2" /><i class="t3" /></span>
    </div>
    <div class="sf-badge">
      <Hammer :size="38" />
      <strong>铸星熔炉 · 主序星点火</strong>
      <small>STELLAR FOUNDRY // STAR ONLINE</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.star-forge-effect {
  @include effect-stage(hidden);
}

.sf-frame {
  position: absolute;
  left: 50%;
  top: 52%;
  width: 300px;
  height: 300px;
  transform: translate(-50%, -50%);
  animation: sf-frame 7.3s ease both;
}

.sf-arc {
  position: absolute;
  inset: 10px;
  border: 2px solid transparent;
  border-radius: 50%;
  filter: drop-shadow(0 0 10px rgba(56, 189, 248, 0.55));
}

.sf-arc.is-left {
  border-left-color: rgba(56, 189, 248, 0.8);
  border-top-color: rgba(56, 189, 248, 0.3);
  animation: sf-arc-left 7.3s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.sf-arc.is-right {
  border-right-color: rgba(56, 189, 248, 0.8);
  border-bottom-color: rgba(56, 189, 248, 0.3);
  animation: sf-arc-right 7.3s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.sf-rail {
  position: absolute;
  inset: -14px;
  border: 1px dashed rgba(125, 211, 252, 0.42);
  border-radius: 50%;
  animation: sf-rail 7.3s linear both;
}

.sf-ticks {
  position: absolute;
  left: 50%;
  top: -32px;
  display: flex;
  gap: 9px;
  transform: translateX(-50%);
}

.sf-ticks i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fb923c;
  box-shadow: 0 0 10px rgba(251, 146, 60, 0.8);
  opacity: 0.14;
}

.sf-ticks .t1 { animation: sf-t1 7.3s ease both; }
.sf-ticks .t2 { animation: sf-t2 7.3s ease both; }
.sf-ticks .t3 { animation: sf-t3 7.3s ease both; }

.sf-badge {
  position: absolute;
  left: 50%;
  bottom: 12%;
  display: grid;
  gap: 6px;
  place-items: center;
  color: #fed7aa;
  text-shadow: 0 0 18px rgba(251, 146, 60, 0.6);
  transform: translateX(-50%);
  animation: sf-badge 7.3s ease both;
}

.sf-badge strong {
  font-size: 16px;
  letter-spacing: 0.12em;
}

.sf-badge small {
  color: rgba(254, 215, 170, 0.72);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.24em;
}

@keyframes sf-frame {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(1.24); }
  11% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  84% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  94%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.14); }
}

@keyframes sf-arc-left {
  0% { opacity: 0; transform: translateX(-56px) rotate(140deg); }
  4% { opacity: 0.5; }
  12%, 86% { opacity: 1; transform: translateX(0) rotate(45deg); }
  100% { opacity: 0; transform: translateX(-32px) rotate(90deg); }
}

@keyframes sf-arc-right {
  0% { opacity: 0; transform: translateX(56px) rotate(-140deg); }
  4% { opacity: 0.5; }
  12%, 86% { opacity: 1; transform: translateX(0) rotate(-45deg); }
  100% { opacity: 0; transform: translateX(32px) rotate(-90deg); }
}

@keyframes sf-rail {
  0% { opacity: 0; transform: rotate(0deg); }
  10% { opacity: 1; }
  86% { opacity: 0.9; transform: rotate(164deg); }
  100% { opacity: 0; transform: rotate(200deg); }
}

@keyframes sf-t1 {
  0%, 20% { opacity: 0.14; }
  22%, 84% { opacity: 1; }
  100% { opacity: 0; }
}

@keyframes sf-t2 {
  0%, 32% { opacity: 0.14; }
  34%, 84% { opacity: 1; }
  100% { opacity: 0; }
}

@keyframes sf-t3 {
  0%, 43.5% { opacity: 0.14; }
  45.5%, 84% { opacity: 1; }
  100% { opacity: 0; }
}

@keyframes sf-badge {
  0%, 62% { opacity: 0; transform: translateX(-50%) translateY(16px); }
  68%, 91% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
}
</style>
