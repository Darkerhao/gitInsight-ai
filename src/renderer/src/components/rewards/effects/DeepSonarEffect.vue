<script setup lang="ts">
import { Radio } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const SONAR_FROM = 1300;
const WHALE_FROM = 3750;
const CONTACT_AT = 4500;

const scene: SceneFn = (api) => {
  api.setTrail(0.26);
  const TAU = Math.PI * 2;
  const sx = api.width / 2;
  const sy = api.height * 0.6;
  const armR = Math.min(api.width, api.height) * 0.42;
  const ARM_W = 1.9; // rad/s

  // ── 幕一（entry）：下潜 —— 海雪缓沉 + 双层气泡上浮 + 探照灯锥光缓摆
  api.every(120, () => {
    api.spawn({
      x: api.rng() * api.width, y: -6,
      vy: api.range(14, 34), shape: 'dot', size: api.range(0.6, 1.3),
      maxLife: api.range(2.6, 4), color: 'rgba(148, 210, 226, 0.5)', glow: 0.4,
      opacity: api.range(0.18, 0.4), wander: 10, fadeIn: 0.14, fadeOut: 0.2,
    });
  }, { until: api.duration - 1100 });
  api.every(80, () => {
    const near = api.rng() < 0.45;
    api.spawn({
      x: api.rng() * api.width, y: api.height + 8,
      vy: near ? api.range(-90, -46) : api.range(-44, -22),
      shape: 'dot', size: near ? api.range(2, 3.4) : api.range(1, 1.7),
      maxLife: api.range(2, 3.4), color: 'rgba(103, 232, 249, 0.7)', glow: near ? 0.9 : 0.5,
      opacity: near ? 0.55 : 0.3, wander: near ? 30 : 14, fadeIn: 0.08, fadeOut: 0.2,
    });
  }, { until: api.duration - 900 });
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs > SONAR_FROM + 300) return;
    const fade = Math.min(1, tMs / 420) * Math.max(0, Math.min(1, (SONAR_FROM + 300 - tMs) / 260));
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

  // ── 幕二：声呐上线 —— 扇形余辉扫描臂 + 刻度表盘 + 方位刻线
  api.at(SONAR_FROM, () => {
    api.spawn({ x: sx, y: sy, shape: 'dot', size: 10, endSize: 3, maxLife: 0.5, color: '#cffafe', glow: 1.8, fadeOut: 0.7 });
    api.spawn({ x: sx, y: sy, shape: 'ring', size: 8, endSize: 90, maxLife: 0.55, color: '#22d3ee', opacity: 0.8, fadeOut: 0.6 });
  });
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < SONAR_FROM) return;
    const fade = Math.min(1, (tMs - SONAR_FROM) / 400) * Math.max(0, Math.min(1, (api.duration - 420 - tMs) / 620));
    if (fade <= 0.02) return;
    const angle = ((tMs - SONAR_FROM) / 1000) * ARM_W;
    // 扇形余辉：以填充楔片衰减而非线束
    for (let trail = 0; trail < 12; trail += 1) {
      const a0 = angle - (trail + 1) * 0.085;
      const a1 = angle - trail * 0.085;
      ctx.fillStyle = `rgba(34, 211, 238, ${(0.16 - trail * 0.013) * fade})`;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.ellipse(sx, sy, armR, armR * 0.8, 0, a0, a1);
      ctx.closePath();
      ctx.fill();
    }
    // 臂前缘亮线
    ctx.strokeStyle = `rgba(165, 243, 252, ${0.72 * fade})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(angle) * armR, sy + Math.sin(angle) * armR * 0.8);
    ctx.stroke();
    // 表盘：三圈刻度环 + 24 道方位刻线
    ctx.strokeStyle = `rgba(34, 211, 238, ${0.22 * fade})`;
    ctx.lineWidth = 1;
    [0.33, 0.66, 1].forEach((k) => {
      ctx.beginPath();
      ctx.ellipse(sx, sy, armR * k, armR * k * 0.8, 0, 0, TAU);
      ctx.stroke();
    });
    for (let i = 0; i < 24; i += 1) {
      const a = (i / 24) * TAU;
      const long = i % 6 === 0;
      const r0 = armR * (long ? 0.93 : 0.965);
      ctx.strokeStyle = `rgba(94, 234, 212, ${(long ? 0.34 : 0.2) * fade})`;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * r0, sy + Math.sin(a) * r0 * 0.8);
      ctx.lineTo(sx + Math.cos(a) * armR, sy + Math.sin(a) * armR * 0.8);
      ctx.stroke();
    }
  });

  // 同心探测脉冲：外扩声波环
  const PULSES = [SONAR_FROM, SONAR_FROM + 950, SONAR_FROM + 1900];
  PULSES.forEach((t0) => {
    api.at(t0, () => {
      api.spawn({
        x: sx, y: sy, shape: 'ring', size: 14, endSize: armR, maxLife: 1.3,
        color: '#22d3ee', opacity: 0.55, fadeOut: 0.6,
      });
    });
  });

  // 生物光点群：三簇回波，扫描臂扫过点亮，脉冲抵达时回波增亮
  const clusters = Array.from({ length: 3 }, () => {
    const a = api.range(0, TAU);
    const r = api.range(80, armR * 0.86);
    return {
      a, r,
      dots: Array.from({ length: 3 }, () => ({
        x: sx + Math.cos(a) * r + api.range(-26, 26),
        y: sy + Math.sin(a) * r * 0.8 + api.range(-18, 18),
      })),
    };
  });
  clusters.forEach((cluster) => {
    const lap = ((cluster.a % TAU) + TAU) % TAU;
    [0, 1].forEach((round) => {
      const passAt = SONAR_FROM + ((lap + round * TAU) / ARM_W) * 1000;
      if (passAt > 4450) return;
      api.at(passAt, () => {
        cluster.dots.forEach((dot, i) => {
          api.spawn({
            x: dot.x, y: dot.y, shape: 'dot', size: api.range(1.8, 3), maxLife: api.range(1.2, 1.9),
            color: api.pick(['#67e8f9', '#a5f3fc', '#5eead4']), glow: 1.3,
            twinkle: 2.4, wander: 12, fadeIn: 0.06, fadeOut: 0.4,
          });
          if (i === 0) {
            api.spawn({ x: dot.x, y: dot.y, shape: 'ring', size: 3, endSize: 30, maxLife: 0.5, color: '#5eead4', opacity: 0.6, fadeOut: 0.6 });
          }
        });
      });
    });
    // 声波抵达回波：脉冲环扫过该簇时的增亮应答
    PULSES.forEach((t0) => {
      const arrive = t0 + (cluster.r / armR) * 1300;
      api.at(arrive, () => {
        cluster.dots.forEach((dot) => {
          api.spawn({
            x: dot.x, y: dot.y, shape: 'dot', size: 2.4, endSize: 1, maxLife: 0.5,
            color: '#a5f3fc', glow: 1.1, opacity: 0.7, fadeOut: 0.5,
          });
        });
      });
    });
  });

  // ── 幕三：巨鲸暗影横越 —— 脊线轮廓光点 + 尾流 + 鲸歌声环
  const whaleY = api.height * 0.78;
  const whaleX = (tMs: number) => api.width * (1.15 - ((tMs - WHALE_FROM) / 1500) * 1.4);
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < WHALE_FROM || tMs > WHALE_FROM + 1520) return;
    const seen = Math.min(1, (tMs - WHALE_FROM) / 240) * Math.max(0, Math.min(1, (WHALE_FROM + 1520 - tMs) / 240));
    const x = whaleX(tMs);
    const bob = Math.sin(tMs / 300) * 8;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(2, 10, 24, ${0.68 * seen})`;
    ctx.beginPath();
    ctx.moveTo(x - 170, whaleY + bob);
    ctx.quadraticCurveTo(x - 40, whaleY - 66 + bob, x + 90, whaleY - 14 + bob);
    ctx.quadraticCurveTo(x + 150, whaleY - 40 + bob, x + 190, whaleY - 56 + bob);
    ctx.quadraticCurveTo(x + 160, whaleY - 6 + bob, x + 190, whaleY + 36 + bob);
    ctx.quadraticCurveTo(x + 150, whaleY + 22 + bob, x + 90, whaleY + 26 + bob);
    ctx.quadraticCurveTo(x - 40, whaleY + 58 + bob, x - 170, whaleY + bob);
    ctx.fill();
  });
  api.every(70, (index) => {
    const tMs = WHALE_FROM + index * 70;
    if (tMs > WHALE_FROM + 1450) return;
    const x = whaleX(tMs);
    // 脊线轮廓微光
    api.spawn({
      x: x + api.range(-150, 170), y: whaleY - 30 + api.range(-16, 12),
      shape: 'dot', size: api.range(0.9, 1.7), maxLife: 1,
      color: '#67e8f9', glow: 1, twinkle: 3, opacity: 0.8, fadeOut: 0.5,
    });
    // 尾流气泡
    api.spawn({
      x: x + 180, y: whaleY + api.range(-20, 30),
      vx: api.range(20, 60), vy: api.range(-16, 12),
      shape: 'dot', size: api.range(2, 4), maxLife: 1.4,
      color: 'rgba(103, 232, 249, 0.5)', glow: 0.7, opacity: 0.4, wander: 30, fadeOut: 0.4,
    });
  }, { from: WHALE_FROM, until: WHALE_FROM + 1450 });
  // 鲸歌：自鲸体荡开的低频声环
  [4150, 4780].forEach((t0) => {
    api.at(t0, () => {
      api.spawn({
        x: whaleX(t0) + 30, y: whaleY - 10, shape: 'ring', size: 20, endSize: 190,
        maxLife: 1.2, color: '#2dd4bf', opacity: 0.34, fadeOut: 0.7,
      });
    });
  });

  // CONTACT 确认：目标标记环收缩锁定 + 白芯确认闪
  api.at(CONTACT_AT, () => {
    const x = whaleX(CONTACT_AT) + 20;
    api.spawn({ x, y: whaleY - 12, shape: 'ring', size: 96, endSize: 40, maxLife: 0.55, color: '#a5f3fc', opacity: 0.9, fadeOut: 0.4 });
    api.spawn({ x, y: whaleY - 12, shape: 'dot', size: 12, endSize: 2, maxLife: 0.45, color: '#ecfeff', glow: 1.8, fadeOut: 0.6 });
    api.spawn({
      x, y: whaleY - 12, shape: 'glyph', glyph: '⌖', size: 30, maxLife: 0.9,
      color: '#cffafe', fadeIn: 0.1, fadeOut: 0.4,
    });
  });
  api.at(CONTACT_AT + 180, () => {
    api.spawn({ x: sx, y: sy, shape: 'ring', size: 14, endSize: armR * 0.8, maxLife: 0.9, color: '#5eead4', opacity: 0.4, fadeOut: 0.7 });
  });

  // ── 退场（exit）：声呐熄灭，残余浮游微光归于深暗
  api.every(110, () => {
    api.spawn({
      x: sx + api.range(-armR, armR), y: sy + api.range(-armR * 0.6, armR * 0.6),
      shape: 'dot', size: api.range(0.8, 1.5), maxLife: api.range(0.6, 1),
      color: 'rgba(103, 232, 249, 0.4)', glow: 0.5, opacity: 0.4, wander: 18, twinkle: 2, fadeOut: 0.5,
    });
  }, { from: 4900, until: api.duration - 260 });
};
</script>

<template>
  <div class="deep-sonar-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.deepSonar" :scene="scene" />
    <div class="sonar-hud">
      <small class="hud-code">ABYSS SONAR · BRG 214°</small>
      <span class="hud-main">
        <Radio :size="20" />
        <strong>深渊回波 · 目标确认</strong>
      </span>
      <small class="hud-meta">DEPTH -3800M · LENGTH 24M · CONTACT</small>
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
  background: rgba(3, 22, 38, 0.58);
  color: #cffafe;
  display: grid;
  gap: 6px;
  place-items: center;
  padding: 12px 26px;
  backdrop-filter: blur(4px);
  transform: translateX(-50%);
  animation: sonar-hud 5.4s ease both;
}

.hud-main {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.sonar-hud strong {
  font-size: 14px;
  letter-spacing: 0.16em;
}

.sonar-hud small {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.16em;
}

.hud-code {
  color: rgba(94, 234, 212, 0.76);
  font-size: 9px;
}

.hud-meta {
  color: rgba(165, 243, 252, 0.68);
  font-size: 10px;
}

@keyframes sonar-hud {
  0%, 79% { opacity: 0; transform: translateX(-50%) translateY(-12px); }
  85%, 96% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0.88; }
}
</style>
