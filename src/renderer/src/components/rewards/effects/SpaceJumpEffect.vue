<script setup lang="ts">
import { Expand } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * 空间折跃 FOLD JUMP · 5s（camera: none —— 组件自带镜头，CSS 全程编排推拉与失焦）
 * 幕一 0-1450ms   外围能量双臂螺旋吸入，奇点充能核搏动，吸入涟漪内收
 * 幕二 1550ms     跃迁闪爆：白热核 + 裂隙光条 + 三重冲击环（0/110/240ms 踩点）
 * 幕三 1700ms+    星流透视全速外冲成穿越隧道（近亮大快/远暗小慢），周期速度环
 * 尾声 4300ms+    隧道流速衰减，舱体光环旋散，余尘落定
 */
const JUMP_COLORS = ['#c7d2fe', '#818cf8', '#22d3ee', '#f0abfc'];

const scene: SceneFn = (api) => {
  api.setTrail(0.2);
  const cx = api.width / 2;
  const cy = api.height / 2;

  // 远景星野：暗星微闪，为纵深垫底（爆点前被吸入感由螺旋承担）
  for (let i = 0; i < 46; i += 1) {
    api.spawn({
      x: api.rng() * api.width,
      y: api.rng() * api.height,
      shape: 'dot', size: api.range(0.7, 1.6), maxLife: api.range(1.2, 1.5),
      color: api.rng() > 0.72 ? '#a5b4fc' : '#e2e8f0',
      glow: 0.7, opacity: api.range(0.28, 0.7),
      twinkle: api.range(0.6, 1.6), fadeIn: 0.08, fadeOut: 0.3,
    });
  }

  // ── 幕一：能量双臂螺旋吸入（越近越快、色相渐亮）──
  api.every(15, (i) => {
    const arm = i % 2 === 0 ? 0 : Math.PI; // 双旋臂
    let radius = api.range(220, Math.max(api.width, api.height) * 0.55);
    let angle = arm + api.range(-0.5, 0.5);
    const angularSpeed = api.range(1.4, 2.6);
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      shape: 'spark', size: api.range(1.4, 2.6), maxLife: 1.5,
      color: api.pick(JUMP_COLORS),
      glow: 1.1, fadeIn: 0.12, fadeOut: 0.06,
      update: (p, dt) => {
        angle += angularSpeed * dt * (1 + (260 - Math.min(radius, 260)) / 90);
        radius -= (radius * 1.6 + 60) * dt;
        if (radius < 10) p.life = p.maxLife;
        if (radius < 90) p.color = '#e0e7ff'; // 接近奇点白热化
        p.x = cx + Math.cos(angle) * radius;
        p.y = cy + Math.sin(angle) * radius;
      },
    });
  }, { until: 1450 });

  // 奇点充能核：随吸入渐大渐亮，闪爆前一刻骤缩
  api.spawn({
    x: cx, y: cy, shape: 'dot', size: 4, maxLife: 1.52,
    color: '#c7d2fe', glow: 2, fadeIn: 0.14, fadeOut: 0.04,
    update: (p) => {
      const t = p.life / p.maxLife;
      p.size = t < 0.92 ? 4 + t * 18 + Math.sin(p.life * 14) * 2.4 : 22 - (t - 0.92) * 200;
      p.endSize = p.size;
    },
  });
  // 吸入涟漪：外圈收缩环踩点内收
  [260, 700, 1140].forEach((when) => {
    api.at(when, () => {
      api.spawn({
        x: cx, y: cy, shape: 'ring', size: 300, endSize: 24,
        maxLife: 0.62, color: '#818cf8', opacity: 0.4, fadeIn: 0.1, fadeOut: 0.4,
      });
    });
  });

  // ── 幕二：1550ms 跃迁闪爆 ──
  api.at(1550, () => {
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 16, endSize: 300, maxLife: 0.7, color: '#eef2ff', glow: 2.2, fadeOut: 0.9 });
    // 裂隙光条：闪爆瞬间全向短促光棘
    api.burst({
      x: cx, y: cy, count: 30, speed: [300, 700],
      base: { shape: 'streak', stretch: 0.09, size: 2.2, maxLife: 0.55, color: '#e0e7ff', glow: 1.2, drag: 0.4, fadeOut: 0.4 },
      vary: (p, rng) => {
        if (rng() < 0.3) p.color = '#22d3ee';
      },
    });
    [0, 110, 240].forEach((delay, i) => {
      api.at(1550 + delay, () => {
        api.spawn({
          x: cx, y: cy, shape: 'ring', size: 20,
          endSize: Math.max(api.width, api.height) * (0.5 + i * 0.18),
          maxLife: 1,
          color: i === 1 ? '#22d3ee' : '#a5b4fc',
          opacity: 0.9, fadeOut: 0.8,
        });
      });
    });
  });

  // ── 幕三：穿越隧道（near 亮大快 / far 暗小慢 → 透视纵深）──
  const spawnStream = (near: boolean) => {
    const angle = api.range(0, Math.PI * 2);
    const startRadius = api.range(4, 44);
    const boost = near ? 1 : 0.6;
    api.spawn({
      x: cx + Math.cos(angle) * startRadius,
      y: cy + Math.sin(angle) * startRadius,
      vx: Math.cos(angle) * api.range(60, 140) * boost,
      vy: Math.sin(angle) * api.range(60, 140) * boost,
      shape: 'streak',
      stretch: near ? 0.11 : 0.07,
      size: near ? api.range(1.8, 3) : api.range(1, 1.7),
      opacity: near ? 1 : 0.55,
      maxLife: api.range(0.8, 1.4),
      color: near ? api.pick(JUMP_COLORS) : '#818cf8',
      glow: near ? 1.05 : 0.6,
      fadeIn: 0.1, fadeOut: 0.08,
      update: (p, dt) => {
        const accel = near ? 4.6 : 3.2;
        p.vx += (p.x - cx) * accel * dt;
        p.vy += (p.y - cy) * accel * dt;
      },
    });
  };
  api.every(13, () => spawnStream(true), { from: 1700, until: api.duration - 650 });
  api.every(24, () => spawnStream(false), { from: 1820, until: api.duration - 760 });

  // 速度环：隧道巡航期周期推进的淡色环
  api.every(640, (i) => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: 30,
      endSize: Math.max(api.width, api.height) * 0.6,
      maxLife: 1, color: i % 2 === 0 ? '#a5b4fc' : '#22d3ee',
      opacity: 0.4, fadeIn: 0.06, fadeOut: 0.7,
    });
  }, { from: 1950, until: 3850 });

  // 舱体余尘：中心附近持续的微光噼啪（次级系统）
  api.every(110, () => {
    api.spawn({
      x: cx + api.range(-60, 60), y: cy + api.range(-60, 60),
      shape: 'spark', size: api.range(1, 1.9), maxLife: api.range(0.4, 0.8),
      color: api.pick(['#e0e7ff', '#c7d2fe', '#a5f3fc']),
      glow: 1, drag: 0.4, wander: 50, fadeOut: 0.5,
    });
  }, { from: 1900, until: 4050 });

  // ── 尾声：流速衰减确认 —— 一圈青色减速环 + 慢速余尘 ──
  api.at(4350, () => {
    api.spawn({
      x: cx, y: cy, shape: 'ring', size: 40, endSize: 260,
      maxLife: 0.9, color: '#22d3ee', opacity: 0.42, fadeOut: 0.7,
    });
  });
  api.every(80, () => {
    const angle = api.range(0, Math.PI * 2);
    const r = api.range(20, 160);
    api.spawn({
      x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r,
      vx: Math.cos(angle) * api.range(20, 60), vy: Math.sin(angle) * api.range(20, 60),
      shape: 'dot', size: api.range(0.8, 1.7), maxLife: api.range(0.5, 0.8),
      color: api.pick(['#c7d2fe', '#a5f3fc']), glow: 0.8, twinkle: 3, fadeOut: 0.5,
    });
  }, { from: 4380, until: 4700 });
};
</script>

<template>
  <div class="space-jump-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.spaceJump" :scene="scene" />
    <div class="space-capsule">
      <Expand :size="50" />
      <strong>空间折跃</strong>
      <small>FOLD JUMP · Δ-SECTOR 07</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.space-jump-effect {
  @include effect-stage(hidden);
  animation: space-camera 5s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.space-jump-effect::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(620px, 82vw);
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    conic-gradient(from 0deg, rgba(129, 140, 248, 0), rgba(129, 140, 248, 0.44), rgba(34, 211, 238, 0.32), rgba(129, 140, 248, 0));
  filter: blur(18px);
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -50%);
  animation: space-lens 5s ease both;
}

.space-capsule {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 176px;
  height: 176px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(129, 140, 248, 0.28), rgba(2, 6, 23, 0.3) 68%, transparent);
  color: #e0e7ff;
  display: grid;
  gap: 7px;
  place-items: center;
  align-content: center;
  transform: translate(-50%, -50%);
  animation: space-capsule 5s cubic-bezier(0.33, 1, 0.68, 1) both;
}

.space-capsule::before {
  content: '';
  position: absolute;
  inset: -22px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent, rgba(129, 140, 248, 0.66), rgba(255, 255, 255, 0.6), transparent 45%);
  opacity: 0.74;
  animation: space-capsule-orbit 1.6s linear infinite;
}

.space-capsule svg,
.space-capsule strong,
.space-capsule small {
  position: relative;
  z-index: 1;
}

.space-capsule strong {
  font-size: 15px;
  letter-spacing: 0.14em;
}

.space-capsule small {
  color: rgba(199, 210, 254, 0.66);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.18em;
}

@keyframes space-lens {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.5) rotate(0deg); }
  26%, 74% { opacity: 1; }
  58% { transform: translate(-50%, -50%) scale(1.2) rotate(140deg); }
}

/* 组件自带镜头：吸入缓推 → 闪爆急胀失焦 → 隧道巡航回稳 → 驶离淡出 */
@keyframes space-camera {
  0% { filter: blur(0); transform: scale(1.14); }
  18% { filter: blur(0.5px); transform: scale(0.96); }
  29% { filter: blur(2.5px); transform: scale(0.78); }
  33% { filter: blur(5px); transform: scale(1.36); }
  44% { filter: blur(1px); transform: scale(1.16); }
  68% { filter: blur(0); transform: scale(1.02); }
  84% { filter: blur(0); transform: scale(0.99); }
  100% { filter: blur(7px); transform: scale(1.24); opacity: 0; }
}

@keyframes space-capsule {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.68); }
  16%, 26% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  30% { transform: translate(-50%, -50%) scale(0.7); }
  36% { transform: translate(-50%, -50%) scale(1.18); }
  46%, 78% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  92% { opacity: 0.5; transform: translate(-50%, -50%) scale(0.9) rotate(-8deg); }
}

@keyframes space-capsule-orbit {
  to { transform: rotate(360deg); }
}
</style>
