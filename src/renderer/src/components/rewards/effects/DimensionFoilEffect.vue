<script setup lang="ts">
import { Frame } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const TAU = Math.PI * 2;
/** 二维化前沿的推进窗口（对角扫过全屏） */
const FRONT_FROM = 1700;
const FRONT_TO = 5300;
/** 定格为平面星图的时刻 */
const SEAL_AT = 5620;

/** 压扁后的二维色块谱：冷银 + 紫 + 青 */
const FLAT_COLORS = ['#e2e8f0', '#c4b5fd', '#a78bfa', '#93c5fd', '#f0abfc', '#67e8f9'];

const scene: SceneFn = (api) => {
  api.setTrail(0.35);
  const w = api.width;
  const h = api.height;
  const diag = Math.hypot(w, h);
  // 前沿法向（自左上向右下斜扫）与切向
  const nl = Math.hypot(1, 0.62);
  const nx = 1 / nl;
  const ny = 0.62 / nl;
  const tx = -ny;
  const ty = nx;
  const span = w * nx + h * ny;
  let now = 0;
  api.onFrame((tMs) => {
    now = tMs;
  });

  const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  const frontC = (tMs: number) => -30 + ease((tMs - FRONT_FROM) / (FRONT_TO - FRONT_FROM)) * (span + 60);
  const proj = (x: number, y: number) => x * nx + y * ny;

  // ── 立体星野：带视差大小，箔片入场后开始不安抖动 ────────────
  for (let i = 0; i < 118; i += 1) {
    const depth = api.rng(); // 0 远 → 1 近
    const star = api.spawn({
      x: api.rng() * w,
      y: api.rng() * h,
      shape: 'dot',
      size: 0.8 + depth * 2.6,
      maxLife: 7.6,
      color: api.pick(['#f8fafc', '#e2e8f0', '#cbd5f5', '#bae6fd']),
      glow: 0.5 + depth * 0.9,
      opacity: 0.35 + depth * 0.6,
      twinkle: api.range(0.4, 1.6),
      fadeIn: 0.04,
      fadeOut: 0.09,
    });
    if (!star) continue;
    let crushed = false;
    let frozen = false;
    const drift = api.rng() > 0.5 ? 1 : -1;
    star.update = (p) => {
      if (!crushed) {
        if (now > 700) {
          const unrest = Math.min(1, (now - 700) / 1200) * (0.7 + depth);
          p.x += Math.sin(now / 130 + p.phase * 7) * 0.16 * unrest;
          p.y += Math.cos(now / 158 + p.phase * 5) * 0.14 * unrest;
        }
        if (now >= FRONT_FROM && proj(p.x, p.y) <= frontC(now)) {
          crushed = true;
          // 触及前沿：闪白 + 压扁涟漪
          api.spawn({
            x: p.x, y: p.y, shape: 'spark', size: 2.6 + depth * 3, maxLife: 0.34,
            color: '#ffffff', glow: 2, fadeOut: 0.7,
          });
          if (depth > 0.55) {
            api.spawn({
              x: p.x, y: p.y, shape: 'ring', size: 2, endSize: 16 + depth * 22, maxLife: 0.42,
              color: '#e2e8f0', opacity: 0.66, fadeOut: 0.6,
            });
          }
          // 三维星点 → 二维横向色块线条（vy 归零、streak 水平化）
          p.shape = 'streak';
          p.color = api.pick(FLAT_COLORS);
          p.vx = drift * (14 + depth * 34);
          p.vy = 0;
          p.stretch = 2.6;
          p.size = 0.9 + depth * 1.5;
          p.twinkle = 0;
          p.glow = 0.45;
        }
      } else {
        p.vy = 0; // 永远锁死在自己的平面刻线上
        if (!frozen && now >= SEAL_AT) {
          frozen = true;
          p.vx = drift * (7 + depth * 12);
          p.twinkle = 0.8; // 画卷定格后的微微波动
        }
      }
    };
  }

  // ── 箔片入场（0-1.5s）：边缘折射冷光碎闪 ─────────────────────
  api.every(70, () => {
    api.spawn({
      x: api.range(0.04, 0.32) * w,
      y: api.range(0.06, 0.36) * h,
      vx: api.range(-20, 20),
      vy: api.range(-20, 20),
      shape: 'spark',
      size: api.range(1, 2.2),
      maxLife: 0.6,
      color: api.pick(['#e2e8f0', '#f8fafc', '#c4b5fd']),
      glow: 1.4,
      fadeOut: 0.6,
    });
  }, { from: 480, until: 1560 });

  // ── 二维化前沿：发光斜线 + 已压扁区域微光薄膜 + 刻度须 ───────
  api.onFrame((tMs, _dt, ctx) => {
    if (tMs < FRONT_FROM - 120 || tMs > FRONT_TO + 260) return;
    const ramp = Math.min(1, (tMs - (FRONT_FROM - 120)) / 260) * Math.min(1, Math.max(0, (FRONT_TO + 260 - tMs) / 260));
    const c = frontC(tMs);
    ctx.translate(nx * c, ny * c);
    ctx.rotate(Math.atan2(ny, nx));
    // 前沿后方：被并入画卷的微光薄膜
    const veil = ctx.createLinearGradient(-160, 0, 0, 0);
    veil.addColorStop(0, 'rgba(167, 139, 250, 0)');
    veil.addColorStop(0.8, `rgba(167, 139, 250, ${0.07 * ramp})`);
    veil.addColorStop(1, `rgba(226, 232, 240, ${0.16 * ramp})`);
    ctx.fillStyle = veil;
    ctx.fillRect(-160, -diag, 160, diag * 2);
    // 前沿三层光线
    const layers: Array<[number, string]> = [
      [7, `rgba(167, 139, 250, ${0.3 * ramp})`],
      [3, `rgba(226, 232, 240, ${0.72 * ramp})`],
      [1.2, `rgba(255, 255, 255, ${0.95 * ramp})`],
    ];
    for (const [lw, color] of layers) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(0, -diag);
      ctx.lineTo(0, diag);
      ctx.stroke();
    }
    // 前沿刻度须（沿切向流动）
    ctx.strokeStyle = `rgba(226, 232, 240, ${0.5 * ramp})`;
    ctx.lineWidth = 1;
    for (let k = -8; k <= 8; k += 1) {
      const yy = k * (diag / 16) + ((tMs / 6) % (diag / 16));
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(10, yy);
      ctx.stroke();
    }
  });

  // 前沿掠过处的碎火花
  api.every(96, () => {
    if (now < FRONT_FROM || now > FRONT_TO) return;
    const c = frontC(now);
    for (let k = 0; k < 3; k += 1) {
      const along = api.range(-0.62, 0.62) * diag;
      const x = nx * c + tx * along;
      const y = ny * c + ty * along;
      if (x < -30 || x > w + 30 || y < -30 || y > h + 30) continue;
      api.spawn({
        x,
        y,
        vx: nx * api.range(30, 90) + tx * api.range(-40, 40),
        vy: ny * api.range(30, 90) + ty * api.range(-40, 40),
        shape: 'spark',
        size: api.range(1.2, 2.4),
        maxLife: api.range(0.4, 0.8),
        color: api.pick(['#e2e8f0', '#c4b5fd', '#ffffff']),
        glow: 1.2,
        drag: 0.5,
        fadeOut: 0.5,
      });
    }
  }, { from: FRONT_FROM, until: FRONT_TO });

  // 空间网格塌陷抖落的晶格碎屑
  api.every(230, () => {
    const c = frontC(now) - api.range(20, 160);
    if (c < 40) return;
    const along = api.range(-0.5, 0.5) * diag;
    const x = nx * c + tx * along;
    const y = ny * c + ty * along;
    if (x < 0 || x > w || y < 0 || y > h) return;
    api.spawn({
      x,
      y,
      vx: api.range(-14, 14),
      vy: api.range(8, 30),
      shape: 'rect',
      size: api.range(3, 7),
      maxLife: api.range(1, 1.8),
      color: api.pick(['#c4b5fd', '#e2e8f0', '#93c5fd']),
      glow: 0,
      opacity: 0.5,
      rotation: api.range(0, TAU),
      spin: api.range(-2.4, 2.4),
      flutter: api.range(1, 2.2),
      fadeOut: 0.4,
    });
  }, { from: FRONT_FROM + 300, until: FRONT_TO });

  // ── 终幕：全屏定格为一幅平面星图 ─────────────────────────────
  api.at(SEAL_AT, () => {
    api.spawn({
      x: w / 2, y: h / 2, shape: 'ring', size: 40, endSize: diag * 0.8, maxLife: 0.8,
      color: '#e2e8f0', opacity: 0.5, fadeOut: 0.7,
    });
  });
  // 画卷装裱微光：定格后沿画面横向掠过的细流光
  api.every(180, () => {
    api.spawn({
      x: -20,
      y: api.range(0.1, 0.9) * h,
      vx: api.range(520, 760),
      vy: 0,
      shape: 'streak',
      stretch: 0.16,
      size: 1,
      maxLife: (w + 80) / 520 + 0.3,
      color: 'rgba(226, 232, 240, 0.5)',
      glow: 0.4,
      opacity: 0.5,
      fadeIn: 0.05,
      fadeOut: 0.2,
    });
  }, { from: SEAL_AT + 120, until: 6400 });
};
</script>

<template>
  <div class="dimension-foil-effect">
    <div class="foil-grid"></div>
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.dimensionFoil" :scene="scene" />
    <div class="foil-sheet"></div>
    <div class="foil-badge">
      <Frame :size="42" />
      <strong>降维打击</strong>
      <small>DUAL-VECTOR FOIL · 2D LATTICE</small>
    </div>
    <div class="foil-seal">DIMENSION SEALED · THICKNESS = 0</div>
    <div class="foil-dim"></div>
  </div>
</template>

<style scoped lang="scss">
.dimension-foil-effect {
  @include effect-stage(hidden);
}

.foil-grid {
  position: absolute;
  inset: -12% -6%;
  background:
    repeating-linear-gradient(90deg, rgba(148, 163, 184, 0.16) 0 1px, transparent 1px 64px),
    repeating-linear-gradient(0deg, rgba(148, 163, 184, 0.13) 0 1px, transparent 1px 64px);
  opacity: 0;
  transform-origin: 50% 62%;
  animation: foil-grid 7.7s ease-in-out both;
}

.foil-sheet {
  position: absolute;
  left: 6%;
  top: 8%;
  width: 30%;
  height: 42%;
  border: 1px solid rgba(226, 232, 240, 0.55);
  border-radius: 4px;
  background:
    linear-gradient(118deg, rgba(226, 232, 240, 0.5), rgba(167, 139, 250, 0.32) 34%, rgba(103, 232, 249, 0.24) 58%, rgba(226, 232, 240, 0.42) 82%),
    linear-gradient(200deg, rgba(255, 255, 255, 0.3), rgba(148, 163, 184, 0.08));
  box-shadow: 0 0 46px rgba(196, 181, 253, 0.35), inset 0 0 30px rgba(255, 255, 255, 0.22);
  animation: foil-sheet 7.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.foil-badge {
  position: absolute;
  left: 50%;
  bottom: 11%;
  display: grid;
  gap: 6px;
  place-items: center;
  color: #e2e8f0;
  text-shadow: 0 0 18px rgba(196, 181, 253, 0.65);
  transform: translateX(-50%);
  animation: foil-badge 7.7s ease both;
}

.foil-badge strong {
  font-size: 18px;
  letter-spacing: 0.3em;
  text-indent: 0.3em;
}

.foil-badge small {
  color: rgba(196, 181, 253, 0.8);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.2em;
}

.foil-seal {
  position: absolute;
  left: 50%;
  top: 46%;
  border: 1px solid rgba(226, 232, 240, 0.5);
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.55);
  color: #f1f5f9;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  letter-spacing: 0.22em;
  padding: 10px 22px;
  white-space: nowrap;
  transform: translate(-50%, -50%);
  animation: foil-seal 7.7s ease both;
}

.foil-dim {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 50%, rgba(2, 6, 23, 0.24), rgba(2, 6, 23, 0.9));
  opacity: 0;
  pointer-events: none;
  animation: foil-dim 7.7s linear both;
}

@keyframes foil-grid {
  0% { opacity: 0; transform: perspective(900px) rotateX(0deg) scaleY(1); }
  10%, 22% { opacity: 0.6; transform: perspective(900px) rotateX(0deg) scaleY(1); }
  46% { opacity: 0.44; transform: perspective(900px) rotateX(38deg) scaleY(0.72); }
  68% { opacity: 0.22; transform: perspective(900px) rotateX(74deg) scaleY(0.1); }
  76%, 100% { opacity: 0; transform: perspective(900px) rotateX(88deg) scaleY(0.02); }
}

@keyframes foil-sheet {
  0% { opacity: 0; transform: translate(-70%, -80%) rotate(-32deg) perspective(700px) rotateY(70deg); }
  8% { opacity: 1; }
  20% { transform: translate(0, 0) rotate(-16deg) perspective(700px) rotateY(26deg); }
  40% { transform: translate(4%, 3%) rotate(-14deg) perspective(700px) rotateY(18deg); }
  62% { transform: translate(9%, 7%) rotate(-15deg) perspective(700px) rotateY(24deg); }
  76% { opacity: 1; transform: translate(13%, 10%) rotate(-13deg) perspective(700px) rotateY(30deg); }
  92%, 100% { opacity: 0; transform: translate(30%, 20%) rotate(-8deg) perspective(700px) rotateY(78deg) scale(0.8); }
}

@keyframes foil-badge {
  0%, 44% { opacity: 0; transform: translateX(-50%) translateY(14px); }
  50%, 84% { opacity: 1; transform: translateX(-50%) translateY(0); }
  92%, 100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
}

@keyframes foil-seal {
  0%, 71% { opacity: 0; transform: translate(-50%, -50%) scaleY(2.6); filter: blur(6px); }
  74.5% { opacity: 1; transform: translate(-50%, -50%) scaleY(1); filter: blur(0); }
  86% { opacity: 1; }
  93%, 100% { opacity: 0; transform: translate(-50%, -50%) scaleY(0.9); }
}

@keyframes foil-dim {
  0%, 86% { opacity: 0; }
  100% { opacity: 0.85; }
}
</style>
