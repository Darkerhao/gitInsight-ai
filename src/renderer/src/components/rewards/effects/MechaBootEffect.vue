<script setup lang="ts">
import { Bot } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const BOOT_LINES = [
  'PWR BUS ............ 48.2V OK',
  'REACTOR CORE ....... IGNITION',
  'SERVO MOTORS ....... 32/32 OK',
  'NEURAL LINK ........ SYNC 98%',
  'TARGETING ARRAY .... CALIBRATED',
];
// 节拍表（总 6000ms = entry 900 + loop 4200 + exit 900）
const CHARGE_AT = 1050; // 反应堆预充能
const EYES_AT = 2200; // 双目光缝点亮（左先右后）
const HUD_AT = 3400; // HUD 环序列展开
const SURGE_AT = 5150; // exit：上电涌流全屏微闪

const scene: SceneFn = (api) => {
  api.setTrail(0.35);
  const cx = api.width / 2;
  const cy = api.height / 2;
  const chest = { x: cx, y: cy + 66 }; // 反应堆位

  // ── 幕一：黑场自检 —— 字符碎屑双层纵深坠落 ──
  api.every(110, () => {
    api.spawn({
      x: api.rng() * api.width, y: -12, vy: api.range(70, 150),
      shape: 'glyph', glyph: api.pick('01<>#/\\'.split('')), size: api.range(11, 14),
      maxLife: 2, color: 'rgba(34, 211, 238, 0.6)', fadeIn: 0.1, fadeOut: 0.3,
    });
  }, { until: EYES_AT });
  api.every(150, () => {
    api.spawn({
      x: api.rng() * api.width, y: -8, vy: api.range(36, 70),
      shape: 'glyph', glyph: api.pick('01'.split('')), size: api.range(8, 10),
      maxLife: 2.4, color: 'rgba(45, 212, 191, 0.28)', fadeIn: 0.12, fadeOut: 0.3,
    });
  }, { until: EYES_AT });

  // 反应堆预充能：收缩环脉冲 + 环绕电荷（蓄势感）
  api.every(420, () => {
    api.spawn({
      x: chest.x, y: chest.y, shape: 'ring', size: 92, endSize: 8,
      maxLife: 0.5, color: '#22d3ee', opacity: 0.5, fadeIn: 0.08, fadeOut: 0.4,
    });
    api.burst({
      x: chest.x, y: chest.y, count: 5, speed: [30, 90],
      base: { shape: 'spark', size: 1.4, maxLife: 0.5, color: '#67e8f9', glow: 1.1, drag: 0.4, fadeOut: 0.5 },
    });
  }, { from: CHARGE_AT, until: EYES_AT - 160 });

  // ── 幕二：双目光缝 —— 左先右后点亮，白热芯线 + 青色辉光 + 微光残像 ──
  const eyes = [
    { x: cx - 105, ignite: EYES_AT },
    { x: cx + 105, ignite: EYES_AT + 150 },
  ];
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < EYES_AT || tMs > HUD_AT + 600) return;
    const fade = tMs > HUD_AT ? Math.max(0, 1 - (tMs - HUD_AT) / 600) : 1;
    for (const eye of eyes) {
      const open = Math.min(1, Math.max(0, (tMs - eye.ignite) / 480));
      if (open <= 0) continue;
      // 点亮初段抖闪，随后稳定
      const stutter = open < 0.55 ? 0.45 + 0.55 * Math.abs(Math.sin(tMs * 0.09 + eye.x)) : 1;
      const flick = (0.78 + 0.22 * Math.sin(tMs / 36)) * stutter;
      const eyeW = 150 * (0.2 + 0.8 * open);
      const layers = [
        { w: 9, color: `rgba(34, 211, 238, ${0.5 * fade * flick})` },
        { w: 4, color: `rgba(165, 243, 252, ${0.7 * fade * flick})` },
        { w: 1.6, color: `rgba(255, 255, 255, ${0.9 * fade * flick})` },
      ];
      for (const layer of layers) {
        const grad = ctx.createLinearGradient(eye.x - eyeW / 2, 0, eye.x + eyeW / 2, 0);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(0.5, layer.color);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = layer.w;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(eye.x - eyeW / 2, cy - 60);
        ctx.lineTo(eye.x + eyeW / 2, cy - 60);
        ctx.stroke();
      }
      // 目镜下缘的微弱反光（机体质感）
      ctx.strokeStyle = `rgba(34, 211, 238, ${0.12 * fade * open})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(eye.x - eyeW / 2.6, cy - 50);
      ctx.lineTo(eye.x + eyeW / 2.6, cy - 50);
      ctx.stroke();
    }
  });
  // 点睛瞬间：白闪 + 火花迸溅（逐眼）
  eyes.forEach((eye) => {
    api.at(eye.ignite + 60, () => {
      api.spawn({ x: eye.x, y: cy - 60, shape: 'dot', size: 16, endSize: 4, maxLife: 0.3, color: '#f0fdff', glow: 2 });
      api.burst({
        x: eye.x, y: cy - 60, count: 10, speed: [50, 220],
        base: { shape: 'spark', size: 1.5, maxLife: 0.45, color: '#67e8f9', glow: 1.2, drag: 0.35, fadeOut: 0.5 },
      });
    });
  });

  // 机体蒸汽：近层大而淡、远层小而慢（双层纵深）
  api.every(150, () => {
    api.spawn({
      x: cx + api.range(-220, 220), y: api.height + 14,
      vy: api.range(-46, -22), shape: 'dot', size: api.range(18, 32), endSize: api.range(44, 64),
      maxLife: api.range(1.6, 2.6), color: 'rgba(148, 163, 184, 0.5)', glow: 0,
      opacity: 0.15, wander: 24, fadeIn: 0.2, fadeOut: 0.4,
    });
  }, { from: EYES_AT, until: HUD_AT + 600 });
  api.every(220, () => {
    api.spawn({
      x: cx + api.range(-300, 300), y: api.height + 10,
      vy: api.range(-24, -12), shape: 'dot', size: api.range(8, 14), endSize: api.range(18, 26),
      maxLife: api.range(2, 3), color: 'rgba(100, 116, 139, 0.4)', glow: 0,
      opacity: 0.09, wander: 14, fadeIn: 0.25, fadeOut: 0.4,
    });
  }, { from: EYES_AT + 200, until: HUD_AT + 400 });

  // ── 幕三：HUD 环序列递次展开 + 刻度弧旋转 + 边缘电流 ──
  [70, 118, 168].forEach((r, i) => {
    api.at(HUD_AT + i * 150, () => {
      api.spawn({
        x: cx, y: cy - 40, shape: 'ring', size: 8, endSize: r,
        maxLife: 0.7 + i * 0.12, color: i === 1 ? '#2dd4bf' : '#22d3ee', opacity: 0.8, fadeOut: 0.5,
      });
    });
  });
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < HUD_AT + 300) return;
    const fade = Math.max(0, Math.min(1, (api.duration - 520 - tMs) / 500)) * Math.min(1, (tMs - HUD_AT - 300) / 400);
    if (fade <= 0.02) return;
    const spin = tMs / 1000;
    [88, 150].forEach((r, i) => {
      const dir = i === 0 ? 1 : -1;
      ctx.strokeStyle = `rgba(34, 211, 238, ${0.5 * fade})`;
      ctx.lineWidth = 2.2;
      for (let s = 0; s < 3; s += 1) {
        const a = dir * spin * (0.6 + i * 0.3) + (s / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy - 40, r, a, a + 0.7);
        ctx.stroke();
      }
    });
    // 外圈 12 格校准刻度（缓旋）
    ctx.strokeStyle = `rgba(45, 212, 191, ${0.34 * fade})`;
    ctx.lineWidth = 1;
    for (let k = 0; k < 12; k += 1) {
      const a = (k / 12) * Math.PI * 2 + spin * 0.2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 178, cy - 40 + Math.sin(a) * 178);
      ctx.lineTo(cx + Math.cos(a) * 186, cy - 40 + Math.sin(a) * 186);
      ctx.stroke();
    }
  });
  // HUD 确认微文案（画布内等宽字，随环序列浮现）
  api.at(HUD_AT + 700, () => {
    api.spawn({
      x: cx, y: cy + 150, vy: -12, shape: 'glyph', glyph: 'LINK ESTABLISHED',
      size: 11, maxLife: 1.2, color: 'rgba(165, 243, 252, 0.9)',
      font: '700 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fadeIn: 0.14, fadeOut: 0.3,
    });
  });
  api.every(130, () => {
    const edge = Math.floor(api.rng() * 4);
    const x = edge < 2 ? api.rng() * api.width : edge === 2 ? 12 : api.width - 12;
    const y = edge === 0 ? 12 : edge === 1 ? api.height - 12 : api.rng() * api.height;
    api.burst({
      x, y, count: 6, speed: [40, 160],
      base: { shape: 'spark', size: 1.6, maxLife: 0.4, color: '#67e8f9', glow: 1.2, drag: 0.4, fadeOut: 0.5 },
    });
  }, { from: HUD_AT, until: api.duration - 700 });

  // ── exit：上电涌流 —— 白热爆闪 + 垂直涌流带 + 回波环 ──
  api.at(SURGE_AT, () => {
    api.spawn({ x: cx, y: cy - 40, shape: 'dot', size: 20, endSize: 330, maxLife: 0.55, color: '#cffafe', glow: 2, fadeOut: 0.92 });
    api.spawn({ x: cx, y: cy - 40, shape: 'ring', size: 30, endSize: 320, maxLife: 0.7, color: '#22d3ee', opacity: 0.6, fadeOut: 0.65 });
  });
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < SURGE_AT || tMs > SURGE_AT + 420) return;
    const life = (tMs - SURGE_AT) / 420;
    const y = api.height * (1 - life);
    const grad = ctx.createLinearGradient(0, y - 30, 0, y + 30);
    grad.addColorStop(0, 'rgba(34, 211, 238, 0)');
    grad.addColorStop(0.5, `rgba(207, 250, 254, ${0.16 * Math.sin(life * Math.PI)})`);
    grad.addColorStop(1, 'rgba(34, 211, 238, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - 30, api.width, 60);
  });
  api.at(SURGE_AT + 200, () => {
    api.spawn({ x: cx, y: cy - 40, shape: 'ring', size: 90, endSize: 240, maxLife: 0.5, color: '#2dd4bf', opacity: 0.3, fadeOut: 0.6 });
  });
  api.every(80, () => {
    api.spawn({
      x: cx + api.range(-200, 200), y: cy + api.range(-160, 140),
      shape: 'dot', size: api.range(0.8, 1.5), maxLife: api.range(0.35, 0.6),
      color: '#67e8f9', glow: 0.9, wander: 26, twinkle: 5, fadeOut: 0.5,
    });
  }, { from: SURGE_AT + 250, until: 5750 });
};
</script>

<template>
  <div class="mecha-boot-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.mechaBoot" :scene="scene" />
    <div class="mecha-terminal">
      <span class="mt-head">NX-TITAN BOOTLOADER v9.4</span>
      <span v-for="(line, i) in BOOT_LINES" :key="line" class="mt-line" :style="{ animationDelay: `${300 + i * 320}ms` }">
        {{ line }}
      </span>
    </div>
    <div class="mecha-status">
      <Bot :size="28" />
      <div class="ms-text">
        <strong>机甲唤醒</strong>
        <small>ALL SYSTEMS NOMINAL</small>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.mecha-boot-effect {
  @include effect-stage(hidden);
}

.mecha-terminal {
  position: absolute;
  left: 8%;
  top: 12%;
  color: #67e8f9;
  display: grid;
  gap: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-shadow: 0 0 12px rgba(34, 211, 238, 0.55);
  animation: mecha-terminal 6s ease both;
}

.mt-head {
  color: rgba(165, 243, 252, 0.62);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.24em;
  border-bottom: 1px solid rgba(34, 211, 238, 0.3);
  padding-bottom: 6px;
  animation: mecha-line 0.3s steps(4) both;
}

.mt-line {
  opacity: 0;
  animation: mecha-line 0.36s steps(6) both;
}

.mecha-status {
  position: absolute;
  left: 50%;
  bottom: 12%;
  border: 1px solid rgba(34, 211, 238, 0.4);
  border-radius: 10px;
  background: rgba(4, 20, 30, 0.52);
  color: #cffafe;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 22px;
  backdrop-filter: blur(4px);
  transform: translateX(-50%);
  animation: mecha-status 6s ease both;
}

.mecha-status svg {
  filter: drop-shadow(0 0 16px rgba(34, 211, 238, 0.6));
}

.ms-text {
  display: grid;
  gap: 3px;
}

.ms-text strong {
  font-size: 15px;
  letter-spacing: 0.2em;
}

.ms-text small {
  color: #5eead4;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
}

@keyframes mecha-line {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes mecha-terminal {
  0%, 58% { opacity: 1; }
  72%, 100% { opacity: 0; }
}

@keyframes mecha-status {
  0%, 82% { opacity: 0; transform: translateX(-50%) translateY(14px); }
  87% { opacity: 1; transform: translateX(-50%) translateY(0); filter: brightness(1.7); }
  90%, 96% { opacity: 1; transform: translateX(-50%) translateY(0); filter: brightness(1); }
  100% { opacity: 0.9; }
}
</style>
