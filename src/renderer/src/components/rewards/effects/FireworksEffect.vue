<script setup lang="ts">
import { PartyPopper } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneApi, SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * ORBITAL SALVO · 轨道礼焰（4200ms = 500 entry + 3000 loop + 700 exit）
 * 三幕：首箭升空压暗夜空 → 近/远两景多波次齐射（白热闪心 + 主色冲击环 + 重力火花球 +
 * 蓝色回波环 + 余烬二次噼啪）→ 终场三连齐射后余星闪灭。
 * 配色：白热核心 + 金焰主色（accent #f59e0b 族）+ 深空蓝辅色（secondary #60a5fa 族）点缀。
 */
const GOLDS = ['#fde68a', '#fbbf24', '#f59e0b'];
const BLUE = '#93c5fd';

function explode(api: SceneApi, x: number, y: number, scale: number, depth: number) {
  const dim = 1 - depth * 0.55; // 远景压暗：近大远小、近亮远暗
  const near = depth < 0.5;

  // 白热闪心 + 主色冲击环
  api.spawn({
    x, y, shape: 'dot', size: 26 * scale * (1 - depth * 0.4), endSize: 2,
    maxLife: 0.3, color: '#fffdf5', glow: 2.3 * dim, opacity: dim, fadeOut: 0.9,
  });
  api.spawn({
    x, y, shape: 'ring', size: 7, endSize: 195 * scale * (1 - depth * 0.45),
    maxLife: 0.78, color: '#fbbf24', opacity: 0.82 * dim, fadeOut: 0.82,
  });
  // 蓝色回波环：fadeIn 延迟浮现，如同声后的余响
  if (near) {
    api.spawn({
      x, y, shape: 'ring', size: 30 * scale, endSize: 250 * scale,
      maxLife: 1.05, color: BLUE, opacity: 0.4, fadeIn: 0.34, fadeOut: 0.5,
    });
  }

  // 主爆裂：带重力与空气阻力的金色火花球
  api.burst({
    x, y,
    count: Math.round((near ? 96 : 42) * scale),
    speed: [26, 400 * scale * (1 - depth * 0.35)],
    base: {
      shape: 'spark', size: 2.3 * (1 - depth * 0.4), ay: 205, drag: 0.3,
      color: '#fbbf24', twinkle: 7, glow: 1.1 * dim, opacity: Math.min(1, 0.35 + dim),
      fadeOut: 0.52,
    },
    vary: (p, rng) => {
      p.maxLife = 1.05 + rng() * 1.15;
      const roll = rng();
      if (roll < 0.42) p.color = GOLDS[Math.floor(rng() * GOLDS.length)];
      else if (roll < 0.54) p.color = '#fff7e6'; // 白热少数派
      else if (roll < 0.66) p.color = BLUE; // 辅色点缀
    },
  });

  // 近景专属：长拖尾流光臂，撑开爆点的纵深骨架
  if (near) {
    api.burst({
      x, y, count: Math.round(12 * scale), speed: [220 * scale, 360 * scale],
      base: {
        shape: 'streak', stretch: 0.085, size: 2 * scale, ay: 150, drag: 0.34,
        color: '#fde68a', glow: 1.2, maxLife: 0.9, fadeOut: 0.4,
      },
      vary: (p, rng) => {
        if (rng() > 0.72) p.color = BLUE;
        p.maxLife = 0.65 + rng() * 0.5;
      },
    });
    // 慢速余烬：长寿命金星坠落，熄灭时二次噼啪
    api.burst({
      x, y, count: Math.round(13 * scale), speed: [36, 175 * scale],
      base: { shape: 'spark', size: 2.5, ay: 150, drag: 0.42, color: '#fde68a', twinkle: 3.4, glow: 1.35, fadeOut: 0.24 },
      vary: (p, rng) => {
        p.maxLife = 1.5 + rng() * 0.85;
        p.onDeath = (dead, sceneApi) => {
          sceneApi.burst({
            x: dead.x, y: dead.y, count: 5, speed: [12, 85],
            base: { shape: 'spark', size: 1.3, maxLife: 0.45, ay: 130, color: '#ffe9a8', glow: 1, twinkle: 11, fadeOut: 0.5 },
          });
        };
      },
    });
  }
}

function launchRocket(api: SceneApi, depth: number, scale: number, xFrac?: number) {
  const dim = 1 - depth * 0.55;
  const x = api.width * (xFrac ?? api.range(0.14, 0.86));
  const targetY = api.height * (0.14 + depth * 0.12 + api.range(0, 0.2));
  const flight = api.range(0.62, 0.95);
  api.spawn({
    x, y: api.height + 14,
    vx: api.range(-32, 32),
    vy: -(api.height + 14 - targetY) / flight,
    shape: 'streak', stretch: 0.05, size: 2.3 * (1 - depth * 0.4),
    maxLife: flight, color: '#fde68a', glow: 1.35 * dim, opacity: Math.min(1, 0.4 + dim),
    fadeIn: 0, fadeOut: 0.07,
    update: (p, dt, sceneApi) => {
      // 尾焰余屑：沿升空轨迹洒落的微火
      if (sceneApi.rng() < dt * 24) {
        sceneApi.spawn({
          x: p.x, y: p.y, vx: sceneApi.range(-16, 16), vy: sceneApi.range(12, 55),
          shape: 'spark', size: 1.1, maxLife: 0.42, color: '#f59e0b',
          glow: 0.8 * dim, opacity: 0.7 * dim, fadeOut: 0.5,
        });
      }
    },
    onDeath: (p, sceneApi) => explode(sceneApi, p.x, p.y, scale, depth),
  });
}

const scene: SceneFn = (api) => {
  api.setTrail(0.18); // 长拖尾：升空轨迹与火花坠落弧线

  // 深空底噪：远景微星，把夜幕撑出层次
  for (let i = 0; i < 24; i += 1) {
    api.spawn({
      x: api.rng() * api.width, y: api.rng() * api.height * 0.7,
      shape: 'dot', size: api.range(0.6, 1.3), maxLife: api.range(3.4, 4.1),
      color: api.rng() > 0.7 ? BLUE : '#e2e8f0', glow: 0.7,
      opacity: api.range(0.2, 0.5), twinkle: api.range(0.5, 1.6), fadeIn: 0.1, fadeOut: 0.2,
    });
  }

  // 幕一（entry 0-500）：首箭升空，远景僚箭跟进
  api.at(80, () => launchRocket(api, 0.1, 1.05, 0.5));
  api.at(330, () => launchRocket(api, 0.75, 0.8, 0.24));

  // 幕二（loop）：近/远两景交替齐射，节拍精确踩点
  api.at(700, () => launchRocket(api, 0.7, 0.75, 0.7));
  api.at(1000, () => launchRocket(api, 0.15, 1, 0.34));
  api.at(1320, () => launchRocket(api, 0.8, 0.7, 0.56));
  api.at(1580, () => {
    launchRocket(api, 0.2, 0.95, 0.68);
    launchRocket(api, 0.65, 0.7, 0.16);
  });
  api.at(2020, () => launchRocket(api, 0.75, 0.72, 0.42));
  api.at(2280, () => launchRocket(api, 0.1, 1.15, 0.5));

  // 余烬尘幕：爆点之后缓缓坠落的金尘
  api.every(95, () => {
    api.spawn({
      x: api.rng() * api.width, y: api.height * api.range(0.2, 0.5),
      vx: api.range(-12, 12), vy: api.range(26, 60),
      shape: 'dot', size: api.range(0.8, 1.6), maxLife: api.range(1, 1.9),
      color: api.rng() > 0.8 ? BLUE : '#fbbf24', glow: 0.8,
      opacity: api.range(0.3, 0.6), twinkle: api.range(2, 5), fadeOut: 0.5,
    });
  }, { from: 1150, until: 3400 });

  // 幕三（exit 3500-4200）：终场三连齐射 → 余星闪灭
  api.at(2860, () => launchRocket(api, 0.05, 1.25, 0.5));
  api.at(2970, () => launchRocket(api, 0.3, 0.95, 0.28));
  api.at(3080, () => launchRocket(api, 0.35, 0.9, 0.74));
  api.every(120, () => {
    api.spawn({
      x: api.rng() * api.width, y: api.rng() * api.height * 0.6,
      shape: 'spark', size: api.range(1, 1.8), maxLife: api.range(0.4, 0.7),
      color: api.pick(['#fde68a', '#fff7e6', BLUE]), glow: 1,
      twinkle: 9, fadeIn: 0.1, fadeOut: 0.55,
    });
  }, { from: 3650, until: 4080 });
};
</script>

<template>
  <div class="fireworks-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.fireworks" :scene="scene" />
    <div class="fw-badge">
      <PartyPopper :size="26" />
      <div class="fw-badge-text">
        <small>ORBITAL SALVO · WAVE 03/03</small>
        <strong>轨道礼焰</strong>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.fireworks-effect {
  @include effect-stage(hidden);
}

.fw-badge {
  position: absolute;
  left: 50%;
  bottom: 12%;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid rgba(245, 158, 11, 0.36);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.52);
  color: #fef3c7;
  padding: 10px 20px;
  transform: translateX(-50%);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.3), 0 0 32px rgba(245, 158, 11, 0.14);
  backdrop-filter: blur(4px);
  animation: fw-badge 4.2s ease both;
}

.fw-badge-text {
  display: grid;
  gap: 3px;
}

.fw-badge-text small {
  color: rgba(253, 230, 138, 0.68);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.24em;
}

.fw-badge-text strong {
  font-size: 16px;
  letter-spacing: 0.2em;
}

@keyframes fw-badge {
  0%, 26% {
    opacity: 0;
    transform: translate(-50%, 16px) scale(0.94);
  }
  36%, 80% {
    opacity: 1;
    transform: translate(-50%, 0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -10px) scale(0.98);
  }
}
</style>
