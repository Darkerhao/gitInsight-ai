<script setup lang="ts">
import { Satellite } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

/**
 * 卫星过境 SATCOM PASS · 5600ms（entry 650 / loop 4100 / exit 850）
 * 三幕：地球弧线/星野显影 → 卫星抛物线过境（波束脉冲 + 数据双向握手 + 太阳翼耀闪）→ 同步完成驶出留余光
 */
const PASS_FROM = 750;
const PASS_TO = 4250;
const BEAM_FROM = 2000;
const BEAM_TO = 3800;

const scene: SceneFn = (api) => {
  api.setTrail(0.3);
  const W = api.width;
  const H = api.height;
  // 卫星抛物线轨迹（与 DOM sat-fly 同参数）
  const satPos = (tMs: number) => {
    const k = Math.min(1, Math.max(0, (tMs - PASS_FROM) / (PASS_TO - PASS_FROM)));
    return {
      x: W * (-0.06 + k * 1.12),
      y: H * (0.34 - Math.sin(k * Math.PI) * 0.16),
    };
  };
  const earthTop = H * 0.86;
  const ground = { x: W * 0.56, y: earthTop };

  // ── 星野：远/近双层（近层缓移 → 横移视差），一颗流星偶发 ──
  for (let i = 0; i < 40; i += 1) {
    api.spawn({
      x: api.rng() * W, y: api.rng() * earthTop * 0.88,
      shape: 'dot', size: api.range(0.6, 1.2), maxLife: 5.6,
      color: '#e2e8f0', glow: 0.6, opacity: api.range(0.2, 0.5),
      twinkle: api.range(0.4, 1.2), fadeIn: 0.08, fadeOut: 0.12,
    });
  }
  for (let i = 0; i < 18; i += 1) {
    api.spawn({
      x: api.rng() * W, y: api.rng() * earthTop * 0.8,
      vx: -9, shape: 'dot', size: api.range(1.2, 2), maxLife: 5.6,
      color: api.rng() > 0.7 ? '#a5f3fc' : '#f1f5f9', glow: 0.8,
      opacity: api.range(0.4, 0.75), twinkle: api.range(0.6, 1.5), fadeIn: 0.08, fadeOut: 0.12,
    });
  }
  api.at(1200, () => {
    api.spawn({
      x: api.range(W * 0.55, W * 0.8), y: api.range(H * 0.06, H * 0.16),
      vx: -api.range(500, 700), vy: api.range(120, 190),
      shape: 'streak', stretch: 0.08, size: 1.4, maxLife: 0.5,
      color: '#e0f2fe', glow: 0.9, opacity: 0.7, fadeIn: 0.06, fadeOut: 0.35,
    });
  });

  // ── 地球弧线 + 大气辉光 + 城市灯火 + 微光极光带 ──
  const cityLights = Array.from({ length: 12 }, () => ({
    a: api.range(Math.PI * 1.28, Math.PI * 1.72),
    tw: api.range(1, 3),
  }));
  api.onFrame((tMs, _dt, ctx) => {
    const fade = Math.min(1, tMs / 550) * Math.max(0, Math.min(1, (api.duration - 400 - tMs) / 500));
    if (fade <= 0.02) return;
    const r = W * 1.4;
    const cyE = earthTop + r;
    // 大气外晕（远景压暗的宽光带）
    ctx.strokeStyle = `rgba(125, 211, 252, ${0.14 * fade})`;
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.arc(W / 2, cyE, r + 13, Math.PI * 1.24, Math.PI * 1.76);
    ctx.stroke();
    // 极光带：地平线一段淡青绿弧
    ctx.strokeStyle = `rgba(45, 212, 191, ${0.2 * fade})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(W / 2, cyE, r + 26, Math.PI * 1.3, Math.PI * 1.48);
    ctx.stroke();
    // 地表亮缘
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.55 * fade})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W / 2, cyE, r, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    // 城市灯火：沿弧线闪烁的暖白微点
    for (const c of cityLights) {
      const lx = W / 2 + Math.cos(c.a) * r;
      const ly = cyE + Math.sin(c.a) * r;
      const blink = 0.5 + 0.5 * Math.sin(tMs / 1000 * c.tw * Math.PI * 2);
      ctx.fillStyle = `rgba(254, 243, 199, ${(0.25 + 0.4 * blink) * fade})`;
      ctx.beginPath();
      ctx.arc(lx, ly + 3, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // 地面站：桅杆 + 朝天碟面 + 呼吸状态灯
    ctx.strokeStyle = `rgba(125, 211, 252, ${0.7 * fade})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(ground.x, ground.y + 2);
    ctx.lineTo(ground.x, ground.y - 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ground.x, ground.y - 21, 8, Math.PI * 0.15, Math.PI * 0.85, true);
    ctx.stroke();
    const blink = Math.sin(tMs / 210) > 0 ? 0.9 : 0.24;
    ctx.fillStyle = `rgba(45, 212, 191, ${blink * fade})`;
    ctx.beginPath();
    ctx.arc(ground.x + 4, ground.y - 5, 1.6, 0, Math.PI * 2);
    ctx.fill();
  });

  // ── 卫星尾迹（跟随 DOM 轨迹）+ 两次太阳翼镜面耀闪 ──
  api.every(24, (index) => {
    const tMs = PASS_FROM + index * 24;
    if (tMs > PASS_TO) return;
    const pos = satPos(tMs);
    api.spawn({
      x: pos.x, y: pos.y, shape: 'spark', size: 1.8, maxLife: 0.9,
      color: '#7dd3fc', glow: 1, fadeIn: 0.05, fadeOut: 0.6,
    });
  }, { from: PASS_FROM, until: PASS_TO });
  [1800, 3300].forEach((when) => {
    api.at(when, () => {
      const pos = satPos(when);
      api.spawn({ x: pos.x, y: pos.y, shape: 'dot', size: 7, endSize: 2, maxLife: 0.36, color: '#f8fafc', glow: 2.2, fadeIn: 0, fadeOut: 0.7 });
      [[170, 0], [-170, 0], [0, 120], [0, -120]].forEach(([vx, vy]) => {
        api.spawn({
          x: pos.x, y: pos.y, vx, vy, shape: 'streak', stretch: 0.1,
          size: 1.2, maxLife: 0.3, color: '#e0f2fe', glow: 0.9, drag: 0.2, fadeOut: 0.4,
        });
      });
    });
  });

  // ── 通讯波束：三角渐变扇面 + 沿束下行的扩张脉冲环 ──
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < BEAM_FROM || tMs > BEAM_TO + 200) return;
    const ramp = Math.min(1, (tMs - BEAM_FROM) / 300) * Math.max(0, Math.min(1, (BEAM_TO + 200 - tMs) / 260));
    const pos = satPos(tMs);
    const sway = 1 + 0.06 * Math.sin(tMs / 150);
    const grad = ctx.createLinearGradient(pos.x, pos.y, ground.x, ground.y);
    grad.addColorStop(0, `rgba(125, 211, 252, ${0.5 * ramp})`);
    grad.addColorStop(1, 'rgba(125, 211, 252, 0.02)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(ground.x - 46 * sway, ground.y);
    ctx.lineTo(ground.x + 46 * sway, ground.y);
    ctx.closePath();
    ctx.fill();
  });
  api.every(320, (index) => {
    const tMs = BEAM_FROM + index * 320;
    if (tMs > BEAM_TO) return;
    const pos = satPos(tMs);
    const dx = ground.x - pos.x;
    const dy = ground.y - pos.y;
    const len = Math.hypot(dx, dy) || 1;
    api.spawn({
      x: pos.x, y: pos.y, vx: (dx / len) * 520, vy: (dy / len) * 520,
      shape: 'ring', size: 4, endSize: 34, maxLife: len / 520,
      color: '#7dd3fc', opacity: 0.45, fadeIn: 0.06, fadeOut: 0.25,
    });
  }, { from: BEAM_FROM, until: BEAM_TO });

  // 数据下行：字符沿束坠向地面站（每四包一枚白热引导包）
  api.every(70, (index) => {
    const tMs = BEAM_FROM + index * 70;
    if (tMs > BEAM_TO) return;
    const pos = satPos(tMs);
    const dx = ground.x - pos.x;
    const dy = ground.y - pos.y;
    const len = Math.hypot(dx, dy) || 1;
    const lead = index % 4 === 0;
    api.spawn({
      x: pos.x, y: pos.y, vx: (dx / len) * 340, vy: (dy / len) * 340,
      shape: 'glyph', glyph: api.pick('0101┊▾▾'.split('')), size: lead ? api.range(12, 15) : api.range(10, 14),
      maxLife: len / 340, color: lead ? '#f0f9ff' : '#bae6fd', opacity: lead ? 1 : 0.8,
      fadeIn: 0.08, fadeOut: 0.16,
    });
  }, { from: BEAM_FROM, until: BEAM_TO });
  // 数据上行：地面站应答包逆束爬升（双向握手）
  api.every(430, (index) => {
    const tMs = 2500 + index * 430;
    if (tMs > 3700) return;
    const pos = satPos(tMs + 400);
    const dx = pos.x - ground.x;
    const dy = pos.y - ground.y;
    const len = Math.hypot(dx, dy) || 1;
    api.spawn({
      x: ground.x, y: ground.y - 10, vx: (dx / len) * 390, vy: (dy / len) * 390,
      shape: 'glyph', glyph: api.pick(['1', '0', '▴']), size: api.range(9, 12),
      maxLife: len / 390, color: '#5eead4', opacity: 0.85, fadeIn: 0.08, fadeOut: 0.2,
    });
  }, { from: 2500, until: 3700 });

  // 地面站应答：上行冲击环 + 半圆火花
  api.every(420, () => {
    api.spawn({
      x: ground.x, y: ground.y, shape: 'ring', size: 8, endSize: 90,
      maxLife: 0.8, color: '#38bdf8', opacity: 0.75, fadeOut: 0.6,
    });
    api.burst({
      x: ground.x, y: ground.y, count: 8, speed: [60, 170],
      angle: [Math.PI * 1.15, Math.PI * 1.85],
      base: { shape: 'spark', size: 1.6, maxLife: 0.6, color: '#7dd3fc', glow: 1, drag: 0.4, fadeOut: 0.4 },
    });
  }, { from: 2200, until: 4100 });

  // ── 尾声：4350ms 同步完成 —— 白闪 + 主辅双环齐贺；卫星驶出留轨迹余光 ──
  api.at(4350, () => {
    api.spawn({ x: ground.x, y: ground.y - 8, shape: 'dot', size: 10, endSize: 70, maxLife: 0.4, color: '#f0f9ff', glow: 2, fadeOut: 0.8 });
    api.spawn({ x: ground.x, y: ground.y, shape: 'ring', size: 12, endSize: 170, maxLife: 0.7, color: '#22d3ee', opacity: 0.7, fadeOut: 0.65 });
    api.burst({
      x: ground.x, y: ground.y - 4, count: 14, speed: [70, 220],
      angle: [Math.PI * 1.1, Math.PI * 1.9],
      base: { shape: 'spark', size: 1.7, maxLife: 0.7, glow: 1.1, drag: 0.4, fadeOut: 0.4 },
      vary: (p, rng) => {
        p.color = rng() < 0.4 ? '#5eead4' : '#7dd3fc';
      },
    });
  });
  api.at(4470, () => {
    api.spawn({ x: ground.x, y: ground.y, shape: 'ring', size: 20, endSize: 230, maxLife: 0.6, color: '#2dd4bf', opacity: 0.4, fadeOut: 0.7 });
  });
  api.at(4300, () => {
    // 轨迹余光：出境路径上驻留的渐灭光珠
    for (let i = 0; i < 8; i += 1) {
      const pos = satPos(4230 - i * 90);
      api.spawn({
        x: pos.x, y: pos.y, shape: 'dot', size: 1.6, maxLife: 0.5 + i * 0.06,
        color: '#7dd3fc', glow: 0.9, opacity: 0.6 - i * 0.05, twinkle: 3, fadeOut: 0.5,
      });
    }
  });
};
</script>

<template>
  <div class="satellite-sweep-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.satelliteSweep" :scene="scene" />
    <div class="sat-body">
      <span class="sat-panel is-left" />
      <Satellite :size="30" />
      <span class="sat-panel is-right" />
      <span class="sat-nav" />
    </div>
    <div class="sat-pass-tag">SATCOM PASS · NORAD 43217 · AOS 14° ELEV</div>
    <div class="sat-hud">
      <strong>卫星过境</strong>
      <small>UPLINK 100% · SYNC COMPLETE</small>
    </div>
  </div>
</template>

<style scoped lang="scss">
.satellite-sweep-effect {
  @include effect-stage(hidden);
}

.sat-body {
  position: absolute;
  left: 0;
  top: 0;
  color: #bae6fd;
  display: flex;
  align-items: center;
  gap: 5px;
  filter: drop-shadow(0 0 12px rgba(56, 189, 248, 0.7));
  animation: sat-fly 5.6s linear both;
}

.sat-panel {
  width: 26px;
  height: 12px;
  border: 1px solid rgba(125, 211, 252, 0.8);
  background:
    repeating-linear-gradient(90deg, rgba(56, 189, 248, 0.5) 0 5px, rgba(8, 47, 73, 0.6) 5px 7px);
  transform: scaleX(0);
  animation: sat-unfold 5.6s ease both;
}

.sat-panel.is-left { transform-origin: right; }
.sat-panel.is-right { transform-origin: left; }

.sat-nav {
  position: absolute;
  right: -6px;
  top: -4px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #2dd4bf;
  box-shadow: 0 0 8px rgba(45, 212, 191, 0.9);
  animation: sat-nav 0.8s ease infinite;
}

.sat-pass-tag {
  position: absolute;
  left: 8%;
  top: 9%;
  border: 1px solid rgba(56, 189, 248, 0.4);
  border-radius: 6px;
  background: rgba(8, 47, 73, 0.5);
  color: rgba(186, 230, 253, 0.85);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.18em;
  padding: 6px 12px;
  animation: sat-pass-tag 5.6s step-end both;
}

.sat-hud {
  position: absolute;
  left: 56%;
  bottom: 8%;
  border: 1px solid rgba(56, 189, 248, 0.44);
  border-radius: 7px;
  background: rgba(8, 47, 73, 0.52);
  color: #e0f2fe;
  display: grid;
  gap: 4px;
  place-items: center;
  padding: 9px 18px;
  transform: translateX(-50%);
  animation: sat-hud 5.6s ease both;
}

.sat-hud strong {
  font-size: 15px;
  letter-spacing: 0.18em;
  text-shadow: 0 0 14px rgba(56, 189, 248, 0.6);
}

.sat-hud small {
  color: rgba(94, 234, 212, 0.9);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
}

/* 与 canvas satPos() 同步：13%-76% 时间段抛物线过境 */
@keyframes sat-fly {
  0%, 13% { opacity: 0; transform: translate(-6vw, 34vh); }
  15% { opacity: 1; }
  32% { transform: translate(24vw, 22vh); }
  45% { transform: translate(48vw, 18vh); }
  60% { transform: translate(76vw, 23vh); }
  73% { opacity: 1; }
  76%, 100% { opacity: 0; transform: translate(106vw, 34vh); }
}

@keyframes sat-unfold {
  0%, 15% { transform: scaleX(0); }
  23%, 100% { transform: scaleX(1); }
}

@keyframes sat-nav {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}

@keyframes sat-pass-tag {
  0%, 14% { opacity: 0; }
  16% { opacity: 1; }
  19% { opacity: 0.3; }
  22%, 64% { opacity: 1; }
  70%, 100% { opacity: 0; }
}

@keyframes sat-hud {
  0%, 74% { opacity: 0; transform: translateX(-50%) translateY(10px); }
  80%, 93% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; }
}
</style>
