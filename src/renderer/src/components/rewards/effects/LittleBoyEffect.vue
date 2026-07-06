<script setup lang="ts">
import { Radiation } from 'lucide-vue-next';
import ParticleCanvas from '@/components/rewards/engine/ParticleCanvas.vue';
import { EFFECT_DURATIONS } from '@/components/rewards/rewardEffects';
import type { SceneFn } from '@/components/rewards/engine/particleEngine';

const props = defineProps<{ seed?: number }>();

const FLASH_AT = 1180;
const CLOUD_AT = 1450;
const CAP_AT = 2150;
const FALLOUT_CHARS = '01XWARN!'.split('');

const cloudLobes = Array.from({ length: 30 }, (_, index) => {
  const side = index % 2 === 0 ? -1 : 1;
  const row = Math.floor(index / 10);
  return {
    x: `${side * (8 + (index % 10) * 6.6)}%`,
    y: `${15 + row * 8 + ((index * 11) % 10)}%`,
    size: `${48 + ((index * 17) % 84)}px`,
    delay: `${1960 + index * 34}ms`,
    drift: `${side * (7 + (index % 6) * 4)}px`,
  };
});

const stemRibs = Array.from({ length: 12 }, (_, index) => {
  const side = index % 2 === 0 ? -1 : 1;
  const base = side * (8 + (index % 4) * 5);
  return {
    x: `${base}%`,
    midX: `${base * 1.8}%`,
    outX: `${base * 2.3}%`,
    delay: `${1540 + index * 62}ms`,
    height: `${58 + ((index * 13) % 34)}%`,
    opacity: `${0.2 + (index % 5) * 0.045}`,
  };
});

function towerTilt(tower: number, multiplier = 1) {
  const sign = tower % 2 === 0 ? -1 : 1;
  return `${sign * (14 + (tower % 6) * 7) * multiplier}deg`;
}

const scene: SceneFn = (api) => {
  api.setTrail(0.16);
  const cx = api.width / 2;
  const groundY = api.height * 0.73;
  const capY = api.height * 0.34;
  const blastRadius = Math.max(api.width, api.height);

  api.onFrame((tMs, _dt, ctx) => {
    const blast = Math.min(1, Math.max(0, (tMs - FLASH_AT) / 2800));
    if (blast <= 0) return;

    const heat = Math.max(0, 1 - (tMs - FLASH_AT) / 2300);
    const glow = ctx.createRadialGradient(cx, groundY, 0, cx, groundY, blastRadius * 0.62);
    glow.addColorStop(0, `rgba(255, 255, 255, ${0.68 * heat})`);
    glow.addColorStop(0.18, `rgba(254, 215, 170, ${0.34 * heat})`);
    glow.addColorStop(0.46, `rgba(154, 52, 18, ${0.2 * heat})`);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, api.width, api.height);

    const shockOpacity = Math.max(0, 1 - blast * 1.2);
    const waveY = groundY + Math.sin(tMs / 120) * 4;
    const waveX = cx - blastRadius * blast * 0.76;
    const waveW = blastRadius * blast * 1.52;
    const shock = ctx.createLinearGradient(waveX, waveY, waveX + waveW, waveY);
    shock.addColorStop(0, 'rgba(255, 255, 255, 0)');
    shock.addColorStop(0.46, `rgba(255, 244, 214, ${0.64 * shockOpacity})`);
    shock.addColorStop(0.51, `rgba(251, 146, 60, ${0.4 * shockOpacity})`);
    shock.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = shock;
    ctx.fillRect(waveX, waveY - 12, waveW, 26);

    const condensation = Math.min(1, Math.max(0, (tMs - CAP_AT) / 1400));
    const fade = Math.max(0, 1 - (tMs - CAP_AT) / 3200);
    if (condensation > 0 && fade > 0) {
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = `rgba(229, 231, 235, ${0.28 * condensation * fade})`;
      ctx.lineWidth = 14 * (1 - condensation * 0.35);
      ctx.beginPath();
      ctx.ellipse(cx, capY + 34, 110 + condensation * 260, 26 + condensation * 42, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const smoke = Math.min(1, Math.max(0, (tMs - CLOUD_AT) / 1700));
    const smokeFade = Math.max(0, 1 - (tMs - CLOUD_AT) / 5600);
    if (smoke > 0 && smokeFade > 0) {
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 11; i += 1) {
        const p = i / 10;
        const y = groundY - p * (groundY - capY) * (0.9 + smoke * 0.12);
        const wobble = Math.sin(tMs / 380 + i * 1.7) * (10 + p * 22);
        const rx = 28 + p * 78 + Math.sin(i * 2.1) * 10;
        const ry = 30 + p * 18;
        const grad = ctx.createRadialGradient(cx + wobble, y, 0, cx + wobble, y, rx * 1.4);
        grad.addColorStop(0, `rgba(231, 229, 228, ${0.12 * smoke * smokeFade})`);
        grad.addColorStop(0.42, `rgba(120, 113, 108, ${0.16 * smoke * smokeFade})`);
        grad.addColorStop(1, 'rgba(41, 37, 36, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx + wobble, y, rx, ry, Math.sin(i) * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let i = 0; i < 9; i += 1) {
        const angle = (i / 9) * Math.PI * 2 + tMs / 1600;
        const x = cx + Math.cos(angle) * (130 + smoke * 160);
        const y = capY + Math.sin(angle) * (28 + smoke * 34);
        const grad = ctx.createRadialGradient(x, y, 0, x, y, 96);
        grad.addColorStop(0, `rgba(245, 245, 244, ${0.11 * smoke * smokeFade})`);
        grad.addColorStop(0.46, `rgba(87, 83, 78, ${0.2 * smoke * smokeFade})`);
        grad.addColorStop(1, 'rgba(41, 37, 36, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(x, y, 84, 46, angle * 0.24, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  api.at(FLASH_AT, () => {
    api.spawn({
      x: cx,
      y: groundY,
      shape: 'dot',
      size: 44,
      endSize: 560,
      maxLife: 0.74,
      color: '#fff7ed',
      glow: 2.8,
      fadeOut: 0.95,
    });
    api.burst({
      x: cx,
      y: groundY,
      count: 210,
      speed: [280, 920],
      angle: [Math.PI + 0.08, Math.PI * 2 - 0.08],
      base: {
        shape: 'spark',
        size: 2.8,
        maxLife: 1.28,
        color: '#fed7aa',
        glow: 1.55,
        ay: 380,
        drag: 0.4,
        fadeOut: 0.52,
      },
      vary: (p, rng) => {
        p.color = rng() > 0.64 ? '#fff7ed' : rng() > 0.3 ? '#fdba74' : '#fb7185';
        p.maxLife = 0.72 + rng() * 1.18;
        p.size = 1.7 + rng() * 3.8;
      },
    });
  });

  [0, 150, 360, 620].forEach((delay, index) => {
    api.at(FLASH_AT + delay, () => {
      api.spawn({
        x: cx,
        y: groundY,
        shape: 'ring',
        size: 28,
        endSize: blastRadius * (0.5 + index * 0.18),
        maxLife: 1.18 + index * 0.15,
        color: index % 2 === 0 ? '#fef3c7' : '#fb923c',
        opacity: 0.88 - index * 0.1,
        fadeOut: 0.74,
      });
    });
  });

  api.every(28, () => {
    const rise = api.range(0, 1);
    api.spawn({
      x: cx + api.range(-34, 34) * (1 + rise),
      y: groundY - api.range(0, 44),
      vx: api.range(-26, 26),
      vy: -api.range(210, 410),
      ax: api.range(-18, 18),
      ay: -api.range(10, 42),
      shape: 'dot',
      size: api.range(20, 48),
      endSize: api.range(70, 134),
      maxLife: api.range(1.7, 3),
      color: api.pick(['rgba(68, 64, 60, 0.82)', 'rgba(120, 113, 108, 0.66)', 'rgba(251, 146, 60, 0.34)', 'rgba(231, 229, 228, 0.24)']),
      glow: 0.16,
      opacity: api.range(0.18, 0.38),
      wander: 42,
      fadeIn: 0.12,
      fadeOut: 0.5,
    });
  }, { from: CLOUD_AT, until: 4300 });

  api.every(34, () => {
    const angle = api.range(Math.PI * 1.02, Math.PI * 1.98);
    const radius = api.range(90, 340);
    const vertical = api.range(0.22, 0.48);
    api.spawn({
      x: cx + Math.cos(angle) * radius,
      y: capY + Math.sin(angle) * radius * vertical,
      vx: Math.cos(angle) * api.range(34, 118),
      vy: api.range(-42, 22),
      shape: 'dot',
      size: api.range(28, 70),
      endSize: api.range(90, 185),
      maxLife: api.range(2, 3.6),
      color: api.pick(['rgba(231, 229, 228, 0.34)', 'rgba(168, 162, 158, 0.44)', 'rgba(87, 83, 78, 0.58)', 'rgba(253, 186, 116, 0.24)']),
      glow: 0,
      opacity: api.range(0.16, 0.32),
      wander: 68,
      fadeIn: 0.16,
      fadeOut: 0.5,
    });
  }, { from: CAP_AT, until: 5700 });

  api.every(42, () => {
    const side = api.rng() > 0.5 ? -1 : 1;
    api.spawn({
      x: cx + side * api.range(150, 430),
      y: groundY + api.range(-4, 34),
      vx: side * api.range(90, 240),
      vy: -api.range(10, 80),
      shape: 'dot',
      size: api.range(18, 44),
      endSize: api.range(70, 150),
      maxLife: api.range(1.4, 2.6),
      color: api.pick(['rgba(41, 37, 36, 0.58)', 'rgba(87, 83, 78, 0.48)', 'rgba(168, 162, 158, 0.28)']),
      glow: 0,
      opacity: api.range(0.12, 0.26),
      wander: 36,
      fadeIn: 0.14,
      fadeOut: 0.54,
    });
  }, { from: FLASH_AT + 380, until: 5000 });

  api.every(48, () => {
    api.spawn({
      x: api.range(api.width * 0.12, api.width * 0.88),
      y: groundY + api.range(-8, 28),
      vx: api.range(-90, 90),
      vy: -api.range(95, 280),
      ay: 380,
      shape: api.rng() > 0.72 ? 'rect' : 'spark',
      size: api.range(2.4, 7),
      maxLife: api.range(0.75, 1.4),
      color: api.pick(['#f97316', '#facc15', '#fef3c7', '#7f1d1d']),
      glow: 1.2,
      drag: 0.45,
      spin: api.range(-8, 8),
      fadeOut: 0.55,
    });
  }, { from: FLASH_AT + 120, until: 3800 });

  api.every(120, () => {
    api.spawn({
      x: api.range(api.width * 0.1, api.width * 0.9),
      y: api.range(api.height * 0.08, api.height * 0.45),
      vy: api.range(50, 120),
      vx: api.range(-22, 22),
      shape: 'glyph',
      glyph: api.pick(FALLOUT_CHARS),
      size: api.range(9, 15),
      maxLife: api.range(1.1, 1.9),
      color: 'rgba(254, 243, 199, 0.42)',
      fadeIn: 0.12,
      fadeOut: 0.5,
    });
  }, { from: 2600, until: 5900 });
};
</script>

<template>
  <div class="little-boy-effect">
    <ParticleCanvas :seed="props.seed" :duration="EFFECT_DURATIONS.littleBoy" :scene="scene" />
    <div class="lb-whiteout" />
    <div class="lb-condensation" aria-hidden="true">
      <span />
      <span />
    </div>
    <div class="lb-mushroom" aria-hidden="true">
      <span class="lb-column-glow" />
      <span class="lb-stem is-back" />
      <span class="lb-stem" />
      <span
        v-for="(rib, index) in stemRibs"
        :key="`rib-${index}`"
        class="lb-stem-rib"
        :style="{
          '--x': rib.x,
          '--mid-x': rib.midX,
          '--out-x': rib.outX,
          '--delay': rib.delay,
          '--rib-h': rib.height,
          '--rib-o': rib.opacity,
        }"
      />
      <span class="lb-cap-shadow" />
      <span class="lb-cap" />
      <span
        v-for="(lobe, index) in cloudLobes"
        :key="index"
        class="lb-lobe"
        :style="{
          '--x': lobe.x,
          '--y': lobe.y,
          '--size': lobe.size,
          '--delay': lobe.delay,
          '--drift': lobe.drift,
        }"
      />
      <span class="lb-rim" />
      <span class="lb-fireball" />
    </div>
    <div class="lb-dust-wall" aria-hidden="true">
      <span />
      <span />
    </div>
    <div class="lb-city" aria-hidden="true">
      <span
        v-for="tower in 38"
        :key="tower"
        class="lb-tower"
        :style="{
          '--h': `${34 + ((tower * 19) % 130)}px`,
          '--w': `${10 + ((tower * 7) % 26)}px`,
          '--tilt': towerTilt(tower),
          '--tilt-mid': towerTilt(tower, 1.24),
          '--tilt-out': towerTilt(tower, 1.38),
          '--delay': `${1300 + (tower % 10) * 58}ms`,
        }"
      />
    </div>
    <div class="lb-ground-wave" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
    <div class="lb-title">
      <Radiation :size="44" :stroke-width="1.4" />
      <strong>小男孩</strong>
      <small>LITTLE BOY / URBAN ZERO</small>
    </div>
  </div>
</template>

<style scoped>
.little-boy-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 68%, rgba(255, 247, 237, 0.16), transparent 28%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.08), rgba(69, 10, 10, 0.32));
  animation: lb-camera 6.6s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.lb-whiteout,
.lb-condensation,
.lb-mushroom,
.lb-dust-wall,
.lb-city,
.lb-ground-wave,
.lb-title {
  position: absolute;
}

.lb-whiteout {
  inset: 0;
  z-index: 5;
  background:
    radial-gradient(circle at 50% 72%, rgba(255, 255, 255, 1), rgba(255, 247, 237, 0.92) 16%, rgba(251, 146, 60, 0.32) 36%, transparent 60%);
  mix-blend-mode: screen;
  opacity: 0;
  animation: lb-whiteout 6.6s ease both;
}

.lb-condensation {
  left: 50%;
  top: 25%;
  z-index: 3;
  width: min(760px, 92vw);
  height: min(220px, 28vh);
  transform: translateX(-50%);
  pointer-events: none;
}

.lb-condensation span {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 32%;
  height: 28%;
  border: 2px solid rgba(229, 231, 235, 0.34);
  border-radius: 50%;
  filter: blur(2px);
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.38, 0.26);
  animation: lb-condensation 6.6s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.lb-condensation span:nth-child(2) {
  border-color: rgba(254, 243, 199, 0.24);
  animation-delay: 220ms;
}

.lb-mushroom {
  left: 50%;
  bottom: 19%;
  z-index: 4;
  width: min(620px, 78vw);
  height: min(560px, 70vh);
  transform: translateX(-50%);
  filter:
    drop-shadow(0 0 48px rgba(251, 146, 60, 0.38))
    drop-shadow(0 18px 42px rgba(12, 10, 9, 0.46));
  opacity: 0;
  animation: lb-cloud-show 6.6s ease both;
}

.lb-column-glow,
.lb-stem,
.lb-stem-rib,
.lb-cap,
.lb-cap-shadow,
.lb-lobe,
.lb-rim,
.lb-fireball {
  position: absolute;
  left: 50%;
}

.lb-column-glow {
  bottom: 3%;
  width: 30%;
  height: 76%;
  border-radius: 50%;
  background: linear-gradient(90deg, transparent, rgba(255, 247, 237, 0.36), transparent);
  filter: blur(18px);
  opacity: 0;
  transform: translateX(-50%) scaleY(0.15);
  animation: lb-column-glow 6.6s ease both;
}

.lb-stem {
  bottom: 0;
  width: 24%;
  height: 77%;
  border-radius: 46% 46% 26% 26%;
  background:
    radial-gradient(ellipse at 50% 20%, rgba(255, 247, 237, 0.58), rgba(251, 146, 60, 0.3) 24%, rgba(87, 83, 78, 0.46) 62%, transparent 76%),
    repeating-linear-gradient(90deg, transparent 0 18px, rgba(255, 247, 237, 0.08) 19px 22px, transparent 23px 42px);
  filter: blur(4px);
  opacity: 0;
  transform: translateX(-50%) scaleY(0.12);
  animation: lb-stem 6.6s ease both;
}

.lb-stem.is-back {
  width: 36%;
  filter: blur(18px);
  background: radial-gradient(ellipse at center, rgba(120, 113, 108, 0.52), rgba(68, 64, 60, 0.18) 64%, transparent 78%);
  animation-delay: 120ms;
}

.lb-stem-rib {
  bottom: 7%;
  width: 8%;
  height: var(--rib-h);
  border-radius: 50%;
  background:
    linear-gradient(180deg, rgba(245, 245, 244, 0), rgba(245, 245, 244, var(--rib-o)) 18%, rgba(68, 64, 60, 0.28) 54%, transparent 100%);
  filter: blur(7px);
  opacity: 0;
  transform: translateX(calc(-50% + var(--x))) translateY(80px) scaleY(0.16);
  animation: lb-stem-rib 6.6s ease var(--delay) both;
}

.lb-cap {
  top: 5%;
  width: 74%;
  height: 31%;
  border-radius: 54% 54% 42% 42%;
  background:
    radial-gradient(ellipse at 50% 34%, rgba(255, 247, 237, 0.72), rgba(253, 186, 116, 0.36) 26%, rgba(120, 113, 108, 0.58) 58%, rgba(41, 37, 36, 0.16) 100%),
    radial-gradient(circle at 20% 62%, rgba(214, 211, 209, 0.36), transparent 38%),
    radial-gradient(circle at 78% 66%, rgba(87, 83, 78, 0.48), transparent 42%);
  box-shadow:
    inset 0 -34px 54px rgba(41, 37, 36, 0.38),
    inset 0 18px 38px rgba(255, 247, 237, 0.18),
    0 0 58px rgba(251, 146, 60, 0.2);
  opacity: 0;
  transform: translateX(-50%) translateY(142px) scale(0.26);
  animation: lb-cap 6.6s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.lb-cap::before,
.lb-cap::after {
  content: '';
  position: absolute;
  inset: 4% 5%;
  border-radius: inherit;
  pointer-events: none;
}

.lb-cap::before {
  background:
    radial-gradient(circle at 18% 54%, rgba(245, 245, 244, 0.34), transparent 17%),
    radial-gradient(circle at 34% 28%, rgba(214, 211, 209, 0.28), transparent 18%),
    radial-gradient(circle at 52% 64%, rgba(87, 83, 78, 0.35), transparent 21%),
    radial-gradient(circle at 72% 38%, rgba(245, 245, 244, 0.3), transparent 18%),
    radial-gradient(circle at 86% 62%, rgba(68, 64, 60, 0.38), transparent 17%);
  filter: blur(5px);
  opacity: 0.9;
  mix-blend-mode: screen;
}

.lb-cap::after {
  inset: 18% 2% 2%;
  background:
    repeating-radial-gradient(ellipse at center, rgba(41, 37, 36, 0.22) 0 6px, rgba(245, 245, 244, 0.08) 7px 13px, transparent 14px 26px);
  filter: blur(7px);
  opacity: 0.62;
  mix-blend-mode: multiply;
}

.lb-cap-shadow {
  top: 28%;
  width: 92%;
  height: 16%;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(28, 25, 23, 0.56), rgba(68, 64, 60, 0.2) 48%, transparent 72%);
  filter: blur(9px);
  opacity: 0;
  transform: translateX(-50%) scale(0.42, 0.28);
  animation: lb-cap-shadow 6.6s ease both;
}

.lb-lobe {
  top: var(--y);
  width: var(--size);
  aspect-ratio: 1.38;
  border-radius: 50%;
  background:
    radial-gradient(circle at 44% 34%, rgba(245, 245, 244, 0.48), rgba(168, 162, 158, 0.38) 36%, rgba(68, 64, 60, 0.28) 78%, transparent 100%);
  filter: blur(2.5px);
  opacity: 0;
  transform: translateX(calc(-50% + var(--x))) translateY(100px) scale(0.28);
  animation: lb-lobe 6.6s cubic-bezier(0.16, 1, 0.3, 1) var(--delay) both;
}

.lb-rim {
  top: 25%;
  width: 100%;
  height: 18%;
  border-radius: 50%;
  border-bottom: 18px solid rgba(87, 83, 78, 0.44);
  border-left: 18px solid transparent;
  border-right: 18px solid transparent;
  filter: blur(5px);
  opacity: 0;
  transform: translateX(-50%) scale(0.36, 0.28);
  animation: lb-rim 6.6s ease both;
}

.lb-fireball {
  bottom: 0;
  width: 33%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, #fff 0 14%, #fef3c7 27%, #fb923c 48%, rgba(127, 29, 29, 0.5) 72%, transparent 100%);
  mix-blend-mode: screen;
  opacity: 0;
  transform: translateX(-50%) scale(0.2);
  animation: lb-fireball 6.6s ease both;
}

.lb-dust-wall {
  left: 50%;
  bottom: 16%;
  z-index: 2;
  width: min(980px, 110vw);
  height: 170px;
  transform: translateX(-50%);
  pointer-events: none;
}

.lb-dust-wall span {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 30%;
  height: 54%;
  border-radius: 50% 50% 8% 8%;
  background: radial-gradient(ellipse at center, rgba(168, 162, 158, 0.4), rgba(68, 64, 60, 0.36) 46%, transparent 72%);
  filter: blur(12px);
  opacity: 0;
  transform: translateX(-50%) scale(0.2, 0.38);
  animation: lb-dust-wall 6.6s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.lb-dust-wall span:nth-child(2) {
  bottom: 12px;
  background: radial-gradient(ellipse at center, rgba(251, 146, 60, 0.18), rgba(41, 37, 36, 0.38) 58%, transparent 78%);
  animation-delay: 160ms;
}

.lb-city {
  left: 50%;
  bottom: 8%;
  z-index: 1;
  width: min(900px, 94vw);
  height: 198px;
  display: flex;
  align-items: end;
  justify-content: center;
  gap: 4px;
  transform: translateX(-50%) perspective(640px) rotateX(50deg);
  transform-origin: center bottom;
  mask-image: linear-gradient(90deg, transparent, #000 8% 92%, transparent);
}

.lb-city::before {
  content: '';
  position: absolute;
  left: -8%;
  right: -8%;
  bottom: 0;
  height: 40px;
  background: linear-gradient(180deg, rgba(120, 53, 15, 0.22), rgba(12, 10, 9, 0.86));
  box-shadow: 0 0 38px rgba(251, 146, 60, 0.18);
}

.lb-tower {
  position: relative;
  z-index: 1;
  width: var(--w);
  height: var(--h);
  border: 1px solid rgba(251, 191, 36, 0.14);
  border-radius: 2px 2px 0 0;
  background:
    repeating-linear-gradient(180deg, rgba(254, 243, 199, 0.22) 0 2px, transparent 2px 11px),
    linear-gradient(180deg, rgba(68, 64, 60, 0.84), rgba(12, 10, 9, 0.95));
  box-shadow:
    inset 0 0 16px rgba(251, 146, 60, 0.08),
    0 0 16px rgba(12, 10, 9, 0.42);
  transform-origin: center bottom;
  animation: lb-tower-collapse 6.6s cubic-bezier(0.7, 0, 0.3, 1) var(--delay) both;
}

.lb-ground-wave {
  left: 50%;
  bottom: 17%;
  z-index: 3;
  width: 1px;
  height: 1px;
  transform: translateX(-50%);
}

.lb-ground-wave span {
  position: absolute;
  left: 0;
  top: 0;
  width: 18vmin;
  height: 18vmin;
  border: 2px solid rgba(254, 243, 199, 0.76);
  border-radius: 50%;
  box-shadow: 0 0 34px rgba(251, 146, 60, 0.48);
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.18);
  animation: lb-ground-wave 6.6s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.lb-ground-wave span:nth-child(2) {
  border-color: rgba(251, 146, 60, 0.72);
  animation-delay: 140ms;
}

.lb-ground-wave span:nth-child(3) {
  border-color: rgba(248, 113, 113, 0.58);
  animation-delay: 340ms;
}

.lb-title {
  left: 50%;
  top: 14%;
  z-index: 6;
  display: grid;
  place-items: center;
  gap: 6px;
  color: #ffedd5;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-shadow: 0 0 22px rgba(251, 146, 60, 0.72);
  transform: translateX(-50%);
  animation: lb-title 6.6s ease both;
}

.lb-title strong {
  color: #fff7ed;
  font-size: 26px;
  letter-spacing: 0.22em;
}

.lb-title small {
  color: rgba(255, 237, 213, 0.74);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.26em;
  white-space: nowrap;
}

@keyframes lb-whiteout {
  0%, 16% { opacity: 0; transform: scale(0.76); }
  19% { opacity: 1; transform: scale(1.05); }
  24% { opacity: 0.6; }
  35%, 100% { opacity: 0; transform: scale(1.86); }
}

@keyframes lb-condensation {
  0%, 29% { opacity: 0; transform: translate(-50%, -50%) scale(0.38, 0.26); }
  39% { opacity: 0.84; }
  74%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(2.2, 0.78); }
}

@keyframes lb-cloud-show {
  0%, 20%, 100% { opacity: 0; }
  28%, 88% { opacity: 1; }
}

@keyframes lb-column-glow {
  0%, 20% { opacity: 0; transform: translateX(-50%) scaleY(0.15); }
  34% { opacity: 0.82; transform: translateX(-50%) scaleY(1); }
  76% { opacity: 0.38; transform: translateX(-50%) scale(1.26, 1.08); }
  100% { opacity: 0; transform: translateX(-50%) scale(1.42, 1.16); }
}

@keyframes lb-stem {
  0%, 20% { opacity: 0; transform: translateX(-50%) scaleY(0.12); }
  36% { opacity: 0.86; transform: translateX(-50%) scaleY(1); }
  82% { opacity: 0.58; transform: translateX(-50%) scale(1.28, 1.06); }
  100% { opacity: 0; transform: translateX(-50%) scale(1.42, 1.12); }
}

@keyframes lb-stem-rib {
  0% { opacity: 0; transform: translateX(calc(-50% + var(--x))) translateY(80px) scaleY(0.16); }
  24% { opacity: 0.78; transform: translateX(calc(-50% + var(--x))) translateY(16px) scaleY(0.86); }
  70% { opacity: 0.42; transform: translateX(calc(-50% + var(--mid-x))) translateY(-20px) scale(1.18, 1.08); }
  100% { opacity: 0; transform: translateX(calc(-50% + var(--out-x))) translateY(-42px) scale(1.34, 1.12); }
}

@keyframes lb-cap {
  0%, 25% { opacity: 0; transform: translateX(-50%) translateY(142px) scale(0.26); }
  44% { opacity: 0.98; transform: translateX(-50%) translateY(0) scale(1.04, 0.92); }
  82% { opacity: 0.84; transform: translateX(-50%) translateY(-22px) scale(1.22, 1.04); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-44px) scale(1.42, 1.1); }
}

@keyframes lb-cap-shadow {
  0%, 30% { opacity: 0; transform: translateX(-50%) scale(0.42, 0.28); }
  46%, 82% { opacity: 0.82; transform: translateX(-50%) scale(1, 1); }
  100% { opacity: 0; transform: translateX(-50%) scale(1.2, 0.96); }
}

@keyframes lb-lobe {
  0% { opacity: 0; transform: translateX(calc(-50% + var(--x))) translateY(100px) scale(0.28); }
  18% { opacity: 0.84; }
  70% { opacity: 0.7; transform: translateX(calc(-50% + var(--x) + var(--drift))) translateY(-12px) scale(1.06); }
  100% { opacity: 0; transform: translateX(calc(-50% + var(--x) + var(--drift))) translateY(-34px) scale(1.22); }
}

@keyframes lb-rim {
  0%, 31% { opacity: 0; transform: translateX(-50%) scale(0.36, 0.28); }
  48%, 82% { opacity: 0.72; transform: translateX(-50%) scale(1, 0.76); }
  100% { opacity: 0; transform: translateX(-50%) scale(1.18, 0.82); }
}

@keyframes lb-fireball {
  0%, 16% { opacity: 0; transform: translateX(-50%) scale(0.2); }
  20% { opacity: 1; transform: translateX(-50%) scale(1.95); }
  34% { opacity: 0.56; transform: translateX(-50%) scale(2.78); }
  49%, 100% { opacity: 0; transform: translateX(-50%) scale(3.28); }
}

@keyframes lb-dust-wall {
  0%, 20% { opacity: 0; transform: translateX(-50%) scale(0.2, 0.38); }
  36% { opacity: 0.82; }
  76%, 100% { opacity: 0; transform: translateX(-50%) scale(2.9, 0.78); }
}

@keyframes lb-tower-collapse {
  0%, 15% { opacity: 1; transform: rotate(0deg) translateY(0); filter: brightness(1); }
  20% { filter: brightness(3); }
  36% { opacity: 0.86; transform: rotate(var(--tilt)) translateY(20px); filter: brightness(0.88); }
  64% { opacity: 0.42; transform: rotate(var(--tilt-mid)) translateY(62px) scaleY(0.35); }
  100% { opacity: 0; transform: rotate(var(--tilt-out)) translateY(92px) scaleY(0.18); }
}

@keyframes lb-ground-wave {
  0%, 17% { opacity: 0; transform: translate(-50%, -50%) scale(0.18); }
  20% { opacity: 0.96; }
  59%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(8.8, 2.12); }
}

@keyframes lb-title {
  0%, 18% { opacity: 0; transform: translateX(-50%) translateY(-10px) scale(0.92); }
  23%, 72% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  86%, 100% { opacity: 0; transform: translateX(-50%) translateY(-8px) scale(0.96); }
}

@keyframes lb-camera {
  0% { transform: scale(1.02); filter: saturate(1); }
  18% { transform: scale(1); filter: saturate(1.1); }
  21% { transform: scale(1.17); filter: saturate(1.72) contrast(1.2); }
  27% { transform: translate(-8px, 5px) scale(1.08); }
  31% { transform: translate(7px, -5px) scale(1.04); }
  37% { transform: translate(-4px, 3px) scale(1.02); }
  58% { transform: scale(1.06); filter: saturate(0.88) contrast(1.05); }
  100% { transform: scale(1.1); filter: saturate(0.72); }
}

@media (max-width: 720px) {
  .lb-mushroom {
    width: 88vw;
    height: 58vh;
    bottom: 21%;
  }

  .lb-title {
    top: 16%;
  }

  .lb-title strong {
    font-size: 22px;
  }

  .lb-title small {
    max-width: 82vw;
    overflow-wrap: anywhere;
    text-align: center;
    white-space: normal;
  }
}
</style>
