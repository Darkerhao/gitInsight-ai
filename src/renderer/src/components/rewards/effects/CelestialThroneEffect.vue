<script setup lang="ts">
import { Crown } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * 星神王座 · CELESTIAL THRONE（创世级 666）
 * 幕一 0-1000ms    星幕分开垂下光瀑，王座基座自星云中升起
 * 幕二 1000-6600ms 光铸王座逐层拼合（基座 1.5s → 扶手 2.5s → 冠冕背板 3.4s，
 *                  每层拼合闪光），十二星辰 3.7s 起列阵环绕连线成阵，
 *                  4.9s 神辉光柱贯通天地 + 金雨洒落
 * 幕三 6600-7800ms 加冕定格 DEITY CROWNED，星辰归位、光瀑收拢
 * 鎏金基调：白热核心 #fffbeb + 琥珀辉光 #f59e0b + 紫罗兰点缀 #c4b5fd
 */
const TAU = Math.PI * 2;
const GILT_COLORS = ['#fffbeb', '#fde68a', '#fcd34d', '#f59e0b'] as const;

const scene: SceneFn = (api) => {
  api.setTrail(0.26);
  const W = api.width;
  const H = api.height;
  const minDim = Math.min(W, H);
  const cx = W / 2;
  const ocy = H * 0.5; // 星辰轨道中心（与王座 DOM 对位）

  let nowT = 0;
  api.onFrame((tMs) => { nowT = tMs; });

  // ---------- 远景星野（暖白 + 紫罗兰点缀） ----------
  for (let i = 0; i < 48; i += 1) {
    api.spawn({
      x: api.rng() * W, y: api.rng() * H,
      shape: 'dot', size: api.range(0.7, 1.8), maxLife: 7.6,
      color: api.rng() > 0.8 ? '#c4b5fd' : '#fef3c7', glow: 0.7,
      opacity: api.range(0.25, 0.65), twinkle: api.range(0.4, 1.3), fadeIn: 0.05, fadeOut: 0.1,
    });
  }

  // ---------- 幕一：星幕分开，垂下光瀑（顶部粒子帘向两侧让道） ----------
  api.every(12, (idx) => {
    const t = 60 + idx * 12;
    const off = 20 + Math.min(1, t / 1400) * W * 0.22;
    for (const dir of [-1, 1]) {
      api.spawn({
        x: cx + dir * (off + api.range(-22, 22)), y: -12,
        vy: api.range(360, 560), shape: 'streak', stretch: 0.32,
        size: api.range(1.3, 2.4), maxLife: api.range(0.9, 1.4),
        color: api.rng() > 0.8 ? '#c4b5fd' : api.rng() > 0.4 ? '#fde68a' : '#fffbeb',
        glow: 0.9, opacity: 0.7, fadeIn: 0.08, fadeOut: 0.3,
      });
    }
  }, { from: 60, until: 1400 });
  // 分开后的两条光瀑常驻涓流
  api.every(70, () => {
    for (const dir of [-1, 1]) {
      api.spawn({
        x: cx + dir * (W * 0.24 + api.range(-16, 16)), y: -12,
        vy: api.range(300, 460), shape: 'streak', stretch: 0.3,
        size: 1.6, maxLife: 1.3, color: '#fde68a', glow: 0.7, opacity: 0.45, fadeOut: 0.3,
      });
    }
  }, { from: 1400, until: 6300 });

  // ---------- 幕二：王座逐层拼合的闪光节拍（DOM 入场 + 粒子沿层缝迸射） ----------
  const pieceFlash = (t0: number, y: number, wSpread: number) => {
    api.at(t0, () => {
      api.spawn({ x: cx, y, shape: 'ring', size: 12, endSize: 150, maxLife: 0.6, color: '#fde68a', opacity: 0.7, fadeOut: 0.6 });
      api.burst({
        x: cx, y, count: 34, speed: [60, 260],
        base: { shape: 'spark', size: 1.9, maxLife: 0.8, glow: 1.2, drag: 0.4, fadeOut: 0.4 },
        vary: (p, rng) => {
          p.color = rng() > 0.8 ? '#c4b5fd' : rng() > 0.4 ? '#fde68a' : '#fffbeb';
          p.vx *= 1.6; // 沿层缝横向迸射
          p.x += (rng() - 0.5) * wSpread;
        },
      });
    });
  };
  pieceFlash(1620, H * 0.66, 150);  // 基座落成
  pieceFlash(2620, H * 0.585, 120); // 扶手拼合
  pieceFlash(3520, H * 0.5, 110);   // 冠冕背板

  // ---------- 十二星辰列阵环绕（椭圆轨道 + onFrame 连线成阵） ----------
  const starPos: Array<{ x: number; y: number } | null> = Array.from({ length: 12 }, () => null);
  const Rx = minDim * 0.36;
  const Ry = minDim * 0.23;
  for (let i = 0; i < 12; i += 1) {
    api.at(3700 + i * 110, () => {
      let ang = -Math.PI / 2 + (i * TAU) / 12;
      let locked = false;
      api.spawn({
        x: cx + Math.cos(ang) * Rx, y: ocy + Math.sin(ang) * Ry,
        shape: 'dot', size: 2.8, maxLife: (api.duration - 3700 - i * 110) / 1000,
        color: i % 4 === 0 ? '#c4b5fd' : '#fde68a', glow: 1.7,
        twinkle: 1.3, fadeIn: 0.08, fadeOut: 0.1,
        update: (p, dt) => {
          const settle = nowT < 6600 ? 1 : Math.max(0, 1 - (nowT - 6600) / 700); // 加冕后星辰归位
          ang += 0.42 * settle * dt;
          p.x = cx + Math.cos(ang) * Rx;
          p.y = ocy + Math.sin(ang) * Ry;
          starPos[i] = { x: p.x, y: p.y };
          if (!locked && nowT > 6600) {
            locked = true;
            p.size = 3.6;
            p.endSize = 3.6;
            p.twinkle = 0.8;
          }
        },
      });
    });
  }
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < 4650) return;
    const ramp = Math.min(1, (tMs - 4650) / 600);
    const fade = Math.min(1, Math.max(0, (7650 - tMs) / 360));
    const a = ramp * fade * (0.24 + 0.08 * Math.sin(tMs / 260));
    if (a <= 0.01) return;
    ctx.strokeStyle = `rgba(253, 230, 138, ${a})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i += 1) {
      const p0 = starPos[i];
      const p1 = starPos[(i + 1) % 12];
      if (!p0 || !p1) continue;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
  });

  // ---------- 神辉光柱贯通天地（白热核心 + 琥珀辉光 + 紫罗兰缘线） ----------
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < 4900 || tMs > 6500) return;
    const ramp = Math.min(1, (tMs - 4900) / 180) * Math.min(1, Math.max(0, (6500 - tMs) / 320));
    if (ramp <= 0.01) return;
    const w = (11 + Math.sin(tMs / 52) * 3.5) * ramp;
    const grad = ctx.createLinearGradient(cx - w * 2.6, 0, cx + w * 2.6, 0);
    grad.addColorStop(0, 'rgba(245, 158, 11, 0)');
    grad.addColorStop(0.3, `rgba(245, 158, 11, ${0.34 * ramp})`);
    grad.addColorStop(0.5, `rgba(255, 251, 235, ${0.92 * ramp})`);
    grad.addColorStop(0.7, `rgba(245, 158, 11, ${0.34 * ramp})`);
    grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - w * 2.6, 0, w * 5.2, H);
    ctx.fillStyle = `rgba(196, 181, 253, ${0.22 * ramp})`;
    ctx.fillRect(cx - w * 3.4, 0, 1.6, H);
    ctx.fillRect(cx + w * 3.4, 0, 1.6, H);
  });
  api.at(4900, () => {
    api.spawn({ x: cx, y: ocy, shape: 'dot', size: 16, endSize: 220, maxLife: 0.6, color: '#fffbeb', glow: 2.2, fadeOut: 0.9 });
    [0, 170].forEach((d, i) => {
      api.at(4900 + d, () => {
        api.spawn({
          x: cx, y: ocy, shape: 'ring', size: 24,
          endSize: minDim * (0.4 + i * 0.2), maxLife: 0.9,
          color: i === 0 ? '#fde68a' : '#c4b5fd', opacity: 0.75, fadeOut: 0.72,
        });
      });
    });
  });
  // 光柱内升腾的辉尘
  api.every(46, () => {
    api.spawn({
      x: cx + api.range(-18, 18), y: H * api.range(0.25, 0.9),
      vy: -api.range(60, 140), shape: 'spark', size: api.range(1, 2),
      maxLife: 0.8, color: api.pick(GILT_COLORS), glow: 1.1, fadeOut: 0.4,
    });
  }, { from: 4950, until: 6350 });

  // ---------- 金雨洒落（鎏金箔片 + 白热光屑） ----------
  api.every(26, () => {
    api.spawn({
      x: api.rng() * W, y: -14, vy: api.range(130, 240), vx: api.range(-24, 24),
      shape: 'rect', size: api.range(2.6, 4.6), maxLife: api.range(1.6, 2.4),
      color: api.rng() > 0.88 ? '#c4b5fd' : api.pick(GILT_COLORS),
      ay: 70, spin: api.range(-3, 3), flutter: api.range(1.5, 3.5),
      opacity: 0.9, fadeOut: 0.2,
    });
    if (api.rng() > 0.5) {
      api.spawn({
        x: api.rng() * W, y: -10, vy: api.range(160, 280),
        shape: 'spark', size: 1.6, maxLife: 1.6, color: '#fffbeb',
        glow: 1.1, ay: 60, twinkle: 3, fadeOut: 0.3,
      });
    }
  }, { from: 5000, until: 6450 });

  // ---------- 幕三：加冕定格 —— 冕环冲拍 + 紫金星火，光瀑收拢 ----------
  api.at(6600, () => {
    api.spawn({ x: cx, y: ocy, shape: 'dot', size: 18, endSize: 260, maxLife: 0.55, color: '#fffbeb', glow: 2.4, fadeOut: 0.9 });
    api.spawn({ x: cx, y: ocy, shape: 'ring', size: 30, endSize: minDim * 0.62, maxLife: 1, color: '#fde68a', opacity: 0.8, fadeOut: 0.72 });
    api.burst({
      x: cx, y: ocy, count: 40, speed: [90, 320],
      base: { shape: 'spark', size: 1.9, maxLife: 1, glow: 1.3, drag: 0.4, fadeOut: 0.4 },
      vary: (p, rng) => { p.color = rng() > 0.7 ? '#c4b5fd' : rng() > 0.4 ? '#fde68a' : '#fffbeb'; },
    });
  });
  // 光瀑收拢：帘位升腾回卷
  api.every(16, () => {
    for (const dir of [-1, 1]) {
      api.spawn({
        x: cx + dir * (W * 0.24 + api.range(-14, 14)), y: H * api.range(0.5, 0.95),
        vy: -api.range(320, 520), shape: 'streak', stretch: 0.3,
        size: 1.6, maxLife: 0.7, color: '#fde68a', glow: 0.8, opacity: 0.6, fadeOut: 0.35,
      });
    }
  }, { from: 6700, until: 7240 });
};
</script>

<template>
  <div class="celestial-throne-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.celestialThrone" :scene="scene" />
    <div class="ct-throne">
      <span class="tp-halo" />
      <span class="tp-back" />
      <span class="tp-arm left" />
      <span class="tp-arm right" />
      <span class="tp-seat" />
      <span class="tp-step1" />
      <span class="tp-step2" />
      <span class="tp-flash" />
    </div>
    <div class="ct-badge">
      <Crown :size="38" />
      <strong>星神王座</strong>
      <small>CELESTIAL THRONE · RITE 666</small>
    </div>
    <div class="ct-caption">
      <strong>DEITY CROWNED</strong>
      <small>诸天让道 · 神格加冕</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.celestial-throne-effect {
  @include effect-stage(hidden);
  animation: ct-camera 7.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}

// ---------- 光铸王座（分层拼合升起） ----------
.ct-throne {
  position: absolute;
  left: 50%;
  top: 56%;
  width: 180px;
  height: 230px;
  filter: drop-shadow(0 0 26px rgba(245, 158, 11, 0.45));
  transform: translate(-50%, -52%);
  animation: ct-throne 7.8s ease both;
}

.ct-throne span {
  position: absolute;
  display: block;
}

.tp-halo {
  left: 50%;
  top: 34%;
  width: 210px;
  height: 210px;
  margin: -105px 0 0 -105px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(253, 230, 138, 0.3) 0 16%, rgba(196, 181, 253, 0.18) 42%, transparent 68%);
  animation: ct-halo 7.8s ease both;
}

.tp-back {
  left: 50%;
  bottom: 92px;
  width: 104px;
  height: 128px;
  margin-left: -52px;
  clip-path: polygon(0 100%, 0 24%, 16% 24%, 28% 0, 50% 18%, 72% 0, 84% 24%, 100% 24%, 100% 100%);
  background: linear-gradient(180deg, #fffbeb 0%, #fde68a 26%, #f59e0b 62%, #92400e 100%);
  animation: ct-piece-back 7.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.tp-arm {
  bottom: 88px;
  width: 20px;
  height: 66px;
  border-radius: 8px 8px 3px 3px;
  background: linear-gradient(180deg, #fffbeb, #f59e0b 68%, #92400e);
  animation: ct-piece-arm 7.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.tp-arm.left { left: 22px; }
.tp-arm.right { right: 22px; }

.tp-seat {
  left: 50%;
  bottom: 72px;
  width: 116px;
  height: 26px;
  margin-left: -58px;
  border-radius: 4px;
  background: linear-gradient(180deg, #fde68a, #b45309);
  animation: ct-piece-arm 7.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.tp-step1 {
  left: 50%;
  bottom: 40px;
  width: 142px;
  height: 24px;
  margin-left: -71px;
  clip-path: polygon(6% 0, 94% 0, 100% 100%, 0 100%);
  background: linear-gradient(180deg, #fcd34d, #92400e);
  animation: ct-piece-base 7.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.tp-step2 {
  left: 50%;
  bottom: 10px;
  width: 176px;
  height: 22px;
  margin-left: -88px;
  clip-path: polygon(5% 0, 95% 0, 100% 100%, 0 100%);
  background: linear-gradient(180deg, #f59e0b, #78350f);
  animation: ct-piece-base 7.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}

// 拼合闪光：三层落位 + 加冕各闪一拍
.tp-flash {
  inset: -20px;
  background: radial-gradient(circle at 50% 60%, rgba(255, 251, 235, 0.9), transparent 60%);
  opacity: 0;
  animation: ct-flash 7.8s linear both;
}

.ct-badge {
  position: absolute;
  left: 50%;
  bottom: 9%;
  color: #fef3c7;
  display: grid;
  gap: 6px;
  place-items: center;
  text-shadow: 0 0 18px rgba(245, 158, 11, 0.65);
  transform: translateX(-50%);
  animation: ct-badge 7.8s ease both;
}

.ct-badge strong {
  font-size: 17px;
  letter-spacing: 0.14em;
}

.ct-badge small {
  color: rgba(254, 243, 199, 0.72);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.22em;
}

.ct-caption {
  position: absolute;
  left: 50%;
  top: 17%;
  color: #fffbeb;
  display: grid;
  gap: 5px;
  place-items: center;
  text-shadow: 0 0 24px rgba(253, 230, 138, 0.85);
  transform: translateX(-50%);
  animation: ct-caption 7.8s ease both;
}

.ct-caption strong {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 20px;
  letter-spacing: 0.32em;
}

.ct-caption small {
  color: rgba(196, 181, 253, 0.9);
  font-size: 11px;
  letter-spacing: 0.3em;
}

// 整座王座自星云中缓缓升起，尾声轻微悬浮
@keyframes ct-throne {
  0% { opacity: 0; transform: translate(-50%, -44%) scale(0.96); }
  14% { opacity: 1; }
  58% { transform: translate(-50%, -52%) scale(1); }
  100% { opacity: 1; transform: translate(-50%, -52.8%) scale(1.006); }
}

@keyframes ct-halo {
  0%, 42% { opacity: 0; transform: scale(0.7); }
  50%, 92% { opacity: 1; transform: scale(1); }
  100% { opacity: 0.7; transform: scale(1.04); }
}

@keyframes ct-piece-base {
  0%, 19.2% { opacity: 0; transform: translateY(46px); }
  22.2% { opacity: 1; transform: translateY(-4px); }
  24.6%, 100% { opacity: 1; transform: translateY(0); }
}

@keyframes ct-piece-arm {
  0%, 32% { opacity: 0; transform: translateY(40px); }
  35% { opacity: 1; transform: translateY(-3px); }
  37.4%, 100% { opacity: 1; transform: translateY(0); }
}

@keyframes ct-piece-back {
  0%, 43.6% { opacity: 0; transform: translateY(44px); }
  46.6% { opacity: 1; transform: translateY(-4px); }
  49%, 100% { opacity: 1; transform: translateY(0); }
}

@keyframes ct-flash {
  0%, 20% { opacity: 0; }
  21.4% { opacity: 0.75; }
  23.4% { opacity: 0; }
  33.2% { opacity: 0.7; }
  35.2% { opacity: 0; }
  44.8% { opacity: 0.7; }
  46.8% { opacity: 0; }
  84.6% { opacity: 0.85; }
  87.2%, 100% { opacity: 0; }
}

@keyframes ct-badge {
  0%, 32% { opacity: 0; transform: translateX(-50%) translateY(16px); }
  38%, 80% { opacity: 1; transform: translateX(-50%) translateY(0); }
  87%, 100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
}

@keyframes ct-caption {
  0%, 86% { opacity: 0; transform: translateX(-50%) scale(0.94); }
  90%, 98% { opacity: 1; transform: translateX(-50%) scale(1); }
  100% { opacity: 0; transform: translateX(-50%) scale(1.01); }
}

@keyframes ct-camera {
  0% { transform: scale(1.08) translateY(1.2%); }
  20% { transform: scale(1.04) translateY(0.6%); }
  62% { transform: scale(1.01) translateY(0); }
  84% { transform: scale(1) translateY(0); }
  86.5% { transform: scale(1.025) translateY(-0.3%); }
  92% { transform: scale(1.01) translateY(0); }
  100% { transform: scale(1.02) translateY(0); opacity: 0; }
}
</style>
