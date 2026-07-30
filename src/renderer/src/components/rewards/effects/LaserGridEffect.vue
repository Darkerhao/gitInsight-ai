<script setup lang="ts">
import { CircuitBoard } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

// 节拍表（总 5000ms = entry 550 + loop 3650 + exit 800）
const H_IGNITE = [150, 330, 510]; // 横梁依次通电
const V_IGNITE = [240, 420, 600]; // 纵梁依次通电
const H_CUT = [4250, 4390, 4530]; // 逐一断电
const V_CUT = [4320, 4460, 4600];
const CONFIRM_AT = 4180; // 巡扫确认脉冲

interface BeamSpec {
  speed: number;
  phase: number;
  rgb: string;
  on: number;
  off: number;
}

const scene: SceneFn = (api) => {
  api.setTrail(0.28);
  const duration = api.duration / 1000;

  // 三横三纵光束：正弦往复巡扫；配色克制 —— 主青绿 + 单缕品红点缀
  const hBeams: BeamSpec[] = H_IGNITE.map((on, i) => ({
    speed: api.range(0.3, 0.62) * (api.rng() < 0.5 ? 1 : -1),
    phase: api.range(0, Math.PI * 2),
    rgb: i === 1 ? '244, 114, 182' : '45, 212, 191',
    on,
    off: H_CUT[i],
  }));
  const vBeams: BeamSpec[] = V_IGNITE.map((on, i) => ({
    speed: api.range(0.3, 0.62) * (api.rng() < 0.5 ? 1 : -1),
    phase: api.range(0, Math.PI * 2),
    rgb: i === 0 ? '34, 211, 238' : '45, 212, 191',
    on,
    off: V_CUT[i],
  }));
  const beamY = (beam: BeamSpec, t: number) => api.height * (0.5 + 0.4 * Math.sin(t * beam.speed * 2 + beam.phase));
  const beamX = (beam: BeamSpec, t: number) => api.width * (0.5 + 0.42 * Math.sin(t * beam.speed * 2 + beam.phase));
  // 通电 / 断电包络：上电抖闪、断电残闪
  const beamEnv = (beam: BeamSpec, tMs: number) => {
    const up = Math.min(1, Math.max(0, (tMs - beam.on) / 240));
    const down = Math.min(1, Math.max(0, (beam.off - tMs) / 200));
    let env = Math.min(up, down);
    if (up > 0 && up < 1) env *= 0.5 + 0.5 * Math.abs(Math.sin(tMs * 0.11 + beam.phase * 9));
    if (down > 0 && down < 1) env *= 0.45 + 0.55 * Math.abs(Math.sin(tMs * 0.13 + beam.phase * 7));
    return Math.max(0, env);
  };

  // 地面辉光：栅格空间的底部反光（远景压暗对应的近地提亮）
  api.onFrame((tMs, _dt, ctx) => {
    const env = Math.min(1, tMs / 700) * Math.min(1, Math.max(0, (4700 - tMs) / 500));
    if (env <= 0.01) return;
    const grad = ctx.createLinearGradient(0, api.height * 0.66, 0, api.height);
    grad.addColorStop(0, 'rgba(45, 212, 191, 0)');
    grad.addColorStop(1, `rgba(45, 212, 191, ${0.09 * env})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, api.height * 0.66, api.width, api.height * 0.34);
  });

  // 光束绘制：彩色辉光带 + 白热芯线 + 两端发射器节点
  api.onFrame((tMs, _dt, ctx) => {
    const t = tMs / 1000;
    for (const beam of hBeams) {
      const env = beamEnv(beam, tMs);
      if (env <= 0.01) continue;
      const y = beamY(beam, t);
      const gradient = ctx.createLinearGradient(0, y - 9, 0, y + 9);
      gradient.addColorStop(0, `rgba(${beam.rgb}, 0)`);
      gradient.addColorStop(0.5, `rgba(${beam.rgb}, ${0.5 * env})`);
      gradient.addColorStop(1, `rgba(${beam.rgb}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, y - 9, api.width, 18);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.55 * env})`;
      ctx.fillRect(0, y - 0.7, api.width, 1.4);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * env})`;
      ctx.beginPath();
      ctx.arc(4, y, 2.6, 0, Math.PI * 2);
      ctx.arc(api.width - 4, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const beam of vBeams) {
      const env = beamEnv(beam, tMs);
      if (env <= 0.01) continue;
      const x = beamX(beam, t);
      const gradient = ctx.createLinearGradient(x - 9, 0, x + 9, 0);
      gradient.addColorStop(0, `rgba(${beam.rgb}, 0)`);
      gradient.addColorStop(0.5, `rgba(${beam.rgb}, ${0.5 * env})`);
      gradient.addColorStop(1, `rgba(${beam.rgb}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(x - 9, 0, 18, api.height);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.55 * env})`;
      ctx.fillRect(x - 0.7, 0, 1.4, api.height);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * env})`;
      ctx.beginPath();
      ctx.arc(x, 4, 2.6, 0, Math.PI * 2);
      ctx.arc(x, api.height - 4, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // 通电瞬间：沿束身迸出细小电火花
  hBeams.forEach((beam) => {
    api.at(beam.on + 70, () => {
      const y = beamY(beam, (beam.on + 70) / 1000);
      api.burst({
        x: api.range(api.width * 0.2, api.width * 0.8), y, count: 8, speed: [40, 190],
        base: { shape: 'spark', size: 1.5, maxLife: 0.45, color: '#99f6e4', glow: 1.1, drag: 0.35, fadeOut: 0.5 },
      });
    });
  });
  vBeams.forEach((beam) => {
    api.at(beam.on + 70, () => {
      const x = beamX(beam, (beam.on + 70) / 1000);
      api.burst({
        x, y: api.range(api.height * 0.2, api.height * 0.8), count: 8, speed: [40, 190],
        base: { shape: 'spark', size: 1.5, maxLife: 0.45, color: '#a5f3fc', glow: 1.1, drag: 0.35, fadeOut: 0.5 },
      });
    });
  });

  // 交点命中：白热闪心 + 双层扩散环 + 火花迸溅 + 延迟余尘（二次噼啪）
  let nowMs = 0;
  api.onFrame((tMs) => {
    nowMs = tMs;
  });
  api.every(250, () => {
    const hBeam = api.pick(hBeams);
    const vBeam = api.pick(vBeams);
    if (beamEnv(hBeam, nowMs) < 0.4 || beamEnv(vBeam, nowMs) < 0.4) return;
    const t = nowMs / 1000;
    const x = beamX(vBeam, t);
    const y = beamY(hBeam, t);
    api.spawn({ x, y, shape: 'dot', size: 13, endSize: 2, maxLife: 0.28, color: '#ffffff', glow: 1.9 });
    api.spawn({ x, y, shape: 'ring', size: 4, endSize: 64, maxLife: 0.5, color: '#5eead4', opacity: 0.85, fadeOut: 0.6 });
    api.burst({
      x, y, count: 12, speed: [60, 300],
      base: { shape: 'spark', size: 1.6, drag: 0.3, color: '#5eead4', twinkle: 10, glow: 1.1 },
      vary: (p, rng) => {
        p.maxLife = 0.4 + rng() * 0.5;
        if (rng() < 0.3) p.color = '#99f6e4';
        else if (rng() < 0.12) p.color = '#f9a8d4';
      },
    });
    api.at(nowMs + 140, () => {
      api.spawn({ x, y, shape: 'ring', size: 30, endSize: 92, maxLife: 0.45, color: '#2dd4bf', opacity: 0.26, fadeOut: 0.55 });
      api.burst({
        x, y, count: 4, speed: [10, 50],
        base: { shape: 'dot', size: 1.2, maxLife: 0.8, color: '#99f6e4', glow: 0.9, wander: 30, twinkle: 4, fadeOut: 0.55 },
      });
    });
  }, { from: 760, until: 4120 });

  // 网格粉尘：近尘大而亮、远尘小而暗（两层纵深）
  api.every(120, () => {
    api.spawn({
      x: api.range(0, api.width), y: api.range(api.height * 0.6, api.height),
      vy: api.range(-56, -24), shape: 'dot', size: api.range(1.4, 2.2),
      maxLife: api.range(1, 1.8), color: '#2dd4bf', twinkle: api.range(4, 9), glow: 1.1, fadeOut: 0.4,
    });
  }, { from: 200, until: 4200 });
  api.every(150, () => {
    api.spawn({
      x: api.range(0, api.width), y: api.range(api.height * 0.4, api.height * 0.8),
      vy: api.range(-30, -12), shape: 'dot', size: api.range(0.6, 1.1),
      maxLife: api.range(1.2, 2), color: '#0d9488', opacity: 0.5, twinkle: api.range(2, 5), glow: 0.7, fadeOut: 0.4,
    });
  }, { from: 300, until: 4100 });

  // 巡扫确认：全场白环 + 青绿回波，随后光束逐一断电
  api.at(CONFIRM_AT, () => {
    const cx = api.width / 2;
    const cy = api.height / 2;
    api.spawn({ x: cx, y: cy, shape: 'ring', size: 30, endSize: Math.max(api.width, api.height) * 0.55, maxLife: 0.8, color: '#f0fdfa', opacity: 0.55, fadeOut: 0.7 });
    api.spawn({ x: cx, y: cy, shape: 'dot', size: 20, endSize: 90, maxLife: 0.4, color: '#ccfbf1', glow: 1.8, fadeOut: 0.85 });
  });
  api.at(CONFIRM_AT + 180, () => {
    api.spawn({
      x: api.width / 2, y: api.height / 2, shape: 'ring', size: 70,
      endSize: Math.max(api.width, api.height) * 0.4, maxLife: 0.6, color: '#2dd4bf', opacity: 0.3, fadeOut: 0.6,
    });
  });

  // 尾声：断电后的残余微光落定
  api.every(90, () => {
    api.spawn({
      x: api.range(0, api.width), y: api.range(api.height * 0.3, api.height * 0.9),
      shape: 'dot', size: api.range(0.7, 1.4), maxLife: api.range(0.4, 0.7),
      color: '#5eead4', glow: 0.8, wander: 24, twinkle: 5, fadeOut: 0.5,
    });
  }, { from: 4550, until: duration * 1000 - 240 });
};
</script>

<template>
  <div class="laser-grid-effect">
    <div class="laser-floor" />
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.laserGrid" :scene="scene" />
    <div class="laser-console">
      <small class="lg-code">LASER LATTICE</small>
      <CircuitBoard :size="42" />
      <strong>激光栅格</strong>
      <span class="lg-status">SWEEP 6/6 · 交点校验通过</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.laser-grid-effect {
  @include effect-stage(hidden);
}

.laser-floor {
  position: absolute;
  left: 50%;
  bottom: -20%;
  width: min(900px, 130vw);
  height: 68vh;
  transform: translateX(-50%) perspective(560px) rotateX(64deg);
  transform-origin: center bottom;
  background:
    repeating-linear-gradient(90deg, transparent 0 52px, rgba(45, 212, 191, 0.3) 53px 54px),
    repeating-linear-gradient(0deg, transparent 0 42px, rgba(34, 211, 238, 0.24) 43px 44px);
  filter: drop-shadow(0 0 28px rgba(45, 212, 191, 0.32));
  opacity: 0;
  animation: floor-in 5s ease both;
}

.laser-console {
  position: absolute;
  left: 50%;
  top: 48%;
  min-width: 198px;
  border: 1px solid rgba(45, 212, 191, 0.36);
  border-radius: 10px;
  background: rgba(6, 78, 59, 0.42);
  color: #ccfbf1;
  display: grid;
  gap: 8px;
  place-items: center;
  padding: 18px 28px 14px;
  box-shadow:
    inset 0 0 26px rgba(45, 212, 191, 0.12),
    0 24px 70px rgba(45, 212, 191, 0.16);
  transform: translate(-50%, -50%);
  animation: console-in 5s ease both;
}

.laser-console svg {
  color: #2dd4bf;
  filter: drop-shadow(0 0 22px rgba(45, 212, 191, 0.62));
}

.laser-console strong {
  font-size: 19px;
  letter-spacing: 0.12em;
}

.lg-code {
  color: rgba(153, 246, 228, 0.7);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.26em;
}

.lg-status {
  width: 100%;
  border-top: 1px solid rgba(45, 212, 191, 0.26);
  color: #99f6e4;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-align: center;
  padding-top: 8px;
  animation: lg-status 5s ease both;
}

@keyframes floor-in {
  0%,
  100% {
    opacity: 0;
    transform: translateX(-50%) perspective(560px) rotateX(64deg) translateY(40px);
  }
  14%,
  84% {
    opacity: 1;
    transform: translateX(-50%) perspective(560px) rotateX(64deg) translateY(0);
  }
}

@keyframes console-in {
  0%,
  30% {
    opacity: 0;
    transform: translate(-50%, -44%) scale(0.92);
  }
  40%,
  84% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -58%) scale(0.95);
  }
}

@keyframes lg-status {
  0%,
  58% {
    opacity: 0;
    transform: translateY(5px);
  }
  66%,
  88% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
  }
}
</style>
