<script setup lang="ts">
import { Radio } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const SONAR_FROM = 1400;
const WHALE_FROM = 3400;

const scene: SceneFn = (api) => {
  api.setTrail(0.3);
  const sx = api.width / 2;
  const sy = api.height * 0.6;

  // 幕一：气泡上浮 + 探照灯锥形光摆动
  api.every(70, () => {
    api.spawn({
      x: api.rng() * api.width, y: api.height + 8,
      vy: api.range(-70, -30), shape: 'dot', size: api.range(1.2, 3),
      maxLife: api.range(2, 3.4), color: 'rgba(103, 232, 249, 0.7)', glow: 0.8,
      opacity: 0.5, wander: 26, fadeIn: 0.08, fadeOut: 0.2,
    });
  }, { until: api.duration - 800 });
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs > SONAR_FROM + 300) return;
    const fade = Math.min(1, tMs / 400) * Math.max(0, Math.min(1, (SONAR_FROM + 300 - tMs) / 260));
    const swing = Math.sin(tMs / 900) * 0.4;
    const grad = ctx.createLinearGradient(0, 0, api.width * 0.4, api.height * 0.5);
    grad.addColorStop(0, `rgba(165, 243, 252, ${0.22 * fade})`);
    grad.addColorStop(1, 'rgba(165, 243, 252, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-20, -20);
    ctx.lineTo(api.width * (0.34 + swing * 0.2), api.height);
    ctx.lineTo(api.width * (0.62 + swing * 0.2), api.height);
    ctx.closePath();
    ctx.fill();
  });

  // 幕二：声呐扫描 —— 旋转扫描臂（扇形余辉）+ 脉冲环 + 回波光点
  const ARM_W = 1.9; // rad/s
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < SONAR_FROM) return;
    const fade = Math.min(1, (tMs - SONAR_FROM) / 400) * Math.max(0, Math.min(1, (api.duration - 500 - tMs) / 600));
    if (fade <= 0.02) return;
    const angle = ((tMs - SONAR_FROM) / 1000) * ARM_W;
    const armR = Math.min(api.width, api.height) * 0.42;
    for (let trail = 0; trail < 10; trail += 1) {
      const a = angle - trail * 0.09;
      ctx.strokeStyle = `rgba(34, 211, 238, ${(0.5 - trail * 0.05) * fade})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(a) * armR, sy + Math.sin(a) * armR * 0.8);
      ctx.stroke();
    }
    // 表盘刻度环
    ctx.strokeStyle = `rgba(34, 211, 238, ${0.24 * fade})`;
    ctx.lineWidth = 1;
    [0.33, 0.66, 1].forEach((k) => {
      ctx.beginPath();
      ctx.ellipse(sx, sy, armR * k, armR * k * 0.8, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
  });
  api.every(900, () => {
    api.spawn({
      x: sx, y: sy, shape: 'ring', size: 14,
      endSize: Math.min(api.width, api.height) * 0.44, maxLife: 1.3,
      color: '#22d3ee', opacity: 0.6, fadeOut: 0.6,
    });
  }, { from: SONAR_FROM, until: api.duration - 1400 });
  // 回波生物光点：扫描臂扫过对应方位时点亮
  const blips = Array.from({ length: 7 }, () => {
    const a = api.range(0, Math.PI * 2);
    const r = api.range(70, Math.min(api.width, api.height) * 0.38);
    return { x: sx + Math.cos(a) * r, y: sy + Math.sin(a) * r * 0.8, angle: a };
  });
  blips.forEach((blip) => {
    const lap = ((blip.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    [0, 1].forEach((round) => {
      api.at(SONAR_FROM + ((lap + round * Math.PI * 2) / ARM_W) * 1000, () => {
        for (let i = 0; i < 4; i += 1) {
          api.spawn({
            x: blip.x + api.range(-10, 10), y: blip.y + api.range(-8, 8),
            shape: 'dot', size: api.range(1.6, 2.8), maxLife: api.range(1, 1.8),
            color: api.pick(['#67e8f9', '#a5f3fc', '#5eead4']), glow: 1.2,
            twinkle: 2.4, wander: 14, fadeIn: 0.06, fadeOut: 0.4,
          });
        }
      });
    });
  });

  // 幕三：鲸形暗影横越 + 轮廓光点 + 尾流
  const whaleY = api.height * 0.78;
  const whaleX = (tMs: number) => api.width * (1.18 - ((tMs - WHALE_FROM) / 1700) * 1.4);
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < WHALE_FROM || tMs > WHALE_FROM + 1700) return;
    const x = whaleX(tMs);
    const bob = Math.sin(tMs / 300) * 8;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(2, 10, 24, 0.66)';
    ctx.beginPath();
    ctx.moveTo(x - 170, whaleY + bob);
    ctx.quadraticCurveTo(x - 40, whaleY - 66 + bob, x + 90, whaleY - 14 + bob);
    ctx.quadraticCurveTo(x + 150, whaleY - 40 + bob, x + 190, whaleY - 56 + bob);
    ctx.quadraticCurveTo(x + 160, whaleY - 6 + bob, x + 190, whaleY + 36 + bob);
    ctx.quadraticCurveTo(x + 150, whaleY + 22 + bob, x + 90, whaleY + 26 + bob);
    ctx.quadraticCurveTo(x - 40, whaleY + 58 + bob, x - 170, whaleY + bob);
    ctx.fill();
  });
  api.every(60, (index) => {
    const tMs = WHALE_FROM + index * 60;
    if (tMs > WHALE_FROM + 1600) return;
    const x = whaleX(tMs);
    api.spawn({
      x: x + api.range(-150, 170), y: whaleY + api.range(-40, 40),
      shape: 'dot', size: api.range(1, 1.8), maxLife: 1,
      color: '#67e8f9', glow: 1, twinkle: 3, fadeOut: 0.5,
    });
    api.spawn({
      x: x + 180, y: whaleY + api.range(-20, 30),
      vx: api.range(20, 60), vy: api.range(-14, 14),
      shape: 'dot', size: api.range(2, 4), maxLife: 1.4,
      color: 'rgba(103, 232, 249, 0.5)', glow: 0.7, opacity: 0.4, wander: 30, fadeOut: 0.4,
    });
  }, { from: WHALE_FROM, until: WHALE_FROM + 1600 });
};
</script>

<template>
  <div class="deep-sonar-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.deepSonar" :scene="scene" />
    <div class="sonar-hud">
      <Radio :size="24" />
      <strong>CONTACT CONFIRMED</strong>
      <small>深度 -3800m · 目标体长 24m</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.deep-sonar-effect {
  @include effect-stage(hidden);
}

.sonar-hud {
  position: absolute;
  left: 50%;
  top: 12%;
  border: 1px solid rgba(34, 211, 238, 0.4);
  border-radius: 10px;
  background: rgba(3, 22, 38, 0.56);
  color: #cffafe;
  display: grid;
  gap: 5px;
  place-items: center;
  padding: 12px 24px;
  backdrop-filter: blur(4px);
  transform: translateX(-50%);
  animation: sonar-hud 5.4s ease both;
}

.sonar-hud strong {
  font-size: 13px;
  letter-spacing: 0.2em;
}

.sonar-hud small {
  color: rgba(165, 243, 252, 0.7);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
}

@keyframes sonar-hud {
  0%, 78% { opacity: 0; transform: translateX(-50%) translateY(-12px); }
  85%, 96% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0.9; }
}
</style>
