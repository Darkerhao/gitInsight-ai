export type Rng = () => number;

/** mulberry32 种子随机，保证同一 seed 可复现、不同 seed 演出不同 */
export function createRng(seed: number): Rng {
  let state = (Math.floor(seed * 2654435761) ^ 0x9e3779b9) >>> 0;
  if (state === 0) state = 0x1f123bb5;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type ParticleShape = 'dot' | 'spark' | 'streak' | 'glyph' | 'ring' | 'rect';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  /** 每秒保留的速度比例，1 = 无阻力，0.2 = 强阻力 */
  drag: number;
  life: number;
  maxLife: number;
  size: number;
  endSize: number;
  color: string;
  shape: ParticleShape;
  /** 辉光强度（精灵直径倍率），0 关闭 */
  glow: number;
  opacity: number;
  fadeIn: number;
  fadeOut: number;
  /** 闪烁频率 Hz，0 关闭 */
  twinkle: number;
  /** 湍流漂移强度 px/s² */
  wander: number;
  /** streak：速度→长度系数 */
  stretch: number;
  glyph: string;
  font: string;
  rotation: number;
  spin: number;
  /** rect 纸屑的 3D 翻转频率 Hz */
  flutter: number;
  composite: GlobalCompositeOperation;
  phase: number;
  update?: (p: Particle, dt: number, api: SceneApi) => void;
  onDeath?: (p: Particle, api: SceneApi) => void;
}

export type ParticleInit = Partial<Particle> & { x: number; y: number };

export interface BurstOptions {
  x: number;
  y: number;
  count: number;
  speed: [number, number];
  /** 弧度范围，默认全向 */
  angle?: [number, number];
  spread?: number;
  base?: Partial<Particle>;
  /** 针对每颗粒子微调 */
  vary?: (p: Particle, rng: Rng, index: number) => void;
}

export interface SceneApi {
  readonly width: number;
  readonly height: number;
  readonly duration: number;
  readonly rng: Rng;
  spawn(init: ParticleInit): Particle | null;
  burst(options: BurstOptions): void;
  at(timeMs: number, fn: () => void): void;
  every(intervalMs: number, fn: (index: number) => void, options?: { from?: number; until?: number; leading?: boolean }): void;
  /** 每帧回调，可直接用 ctx 画丝带/网格/闪电等自定义图形（在粒子层之下） */
  onFrame(fn: (tMs: number, dt: number, ctx: CanvasRenderingContext2D) => void): void;
  /** 每帧擦除比例 0-1（60fps 基准），越小拖尾越长；默认 1 不留拖尾 */
  setTrail(fadePerFrame: number): void;
  range(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
}

const MAX_PARTICLES = 1400;
const MAX_DPR = 1.75;
const TAU = Math.PI * 2;

const PARTICLE_DEFAULTS: Omit<Particle, 'x' | 'y'> = {
  vx: 0,
  vy: 0,
  ax: 0,
  ay: 0,
  drag: 1,
  life: 0,
  maxLife: 1.2,
  size: 3,
  endSize: -1,
  color: '#ffffff',
  shape: 'dot',
  glow: 1,
  opacity: 1,
  fadeIn: 0.04,
  fadeOut: 0.35,
  twinkle: 0,
  wander: 0,
  stretch: 0.05,
  glyph: '',
  font: '',
  rotation: 0,
  spin: 0,
  flutter: 0,
  composite: 'lighter',
  phase: 0,
};

const spriteCache = new Map<string, HTMLCanvasElement>();

/** 预渲染"白热核心 + 彩色辉光"的光点精灵，避免每帧 shadowBlur */
function getGlowSprite(color: string): HTMLCanvasElement {
  const cached = spriteCache.get(color);
  if (cached) return cached;

  const size = 64;
  const sprite = document.createElement('canvas');
  sprite.width = size;
  sprite.height = size;
  const ctx = sprite.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    gradient.addColorStop(0.16, color);
    gradient.addColorStop(0.4, colorWithAlpha(color, 0.32));
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  if (spriteCache.size > 96) spriteCache.clear();
  spriteCache.set(color, sprite);
  return sprite;
}

function colorWithAlpha(color: string, alpha: number): string {
  if (color.startsWith('hsl(')) return color.replace('hsl(', 'hsla(').replace(')', `, ${alpha})`);
  if (color.startsWith('rgb')) {
    const nums = color.match(/[\d.]+/g);
    if (nums && nums.length >= 3) return `rgba(${nums[0]}, ${nums[1]}, ${nums[2]}, ${alpha})`;
    return color;
  }
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

interface TimelineTask {
  time: number;
  fn: () => void;
}

interface RepeatTask {
  interval: number;
  next: number;
  until: number;
  index: number;
  fn: (index: number) => void;
}

export type SceneFn = (api: SceneApi) => void;

export interface EngineHandle {
  destroy(): void;
}

export function startParticleEngine(
  canvas: HTMLCanvasElement,
  options: { seed: number; duration: number; scene: SceneFn }
): EngineHandle {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { destroy: () => undefined };

  const rng = createRng(options.seed || 1);
  const particles: Particle[] = [];
  const timeline: TimelineTask[] = [];
  const repeats: RepeatTask[] = [];
  const frameHooks: Array<(tMs: number, dt: number, ctx: CanvasRenderingContext2D) => void> = [];
  let trailFade = 1;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let rafId = 0;
  let startTime = -1;
  let lastTime = 0;
  let destroyed = false;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const api: SceneApi = {
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    duration: options.duration,
    rng,
    spawn(init) {
      if (particles.length >= MAX_PARTICLES) return null;
      const particle: Particle = { ...PARTICLE_DEFAULTS, phase: rng() * TAU, ...init };
      if (particle.endSize < 0) particle.endSize = particle.size;
      particles.push(particle);
      return particle;
    },
    burst({ x, y, count, speed, angle, spread, base, vary }) {
      const [angleFrom, angleTo] = angle ?? [0, TAU];
      for (let i = 0; i < count; i += 1) {
        const theta = angleFrom + rng() * (angleTo - angleFrom) + (spread ? (rng() - 0.5) * spread : 0);
        const velocity = speed[0] + rng() * (speed[1] - speed[0]);
        const particle = api.spawn({
          x,
          y,
          vx: Math.cos(theta) * velocity,
          vy: Math.sin(theta) * velocity,
          ...base,
        });
        if (particle && vary) vary(particle, rng, i);
      }
    },
    at(timeMs, fn) {
      timeline.push({ time: timeMs, fn });
      timeline.sort((a, b) => a.time - b.time);
    },
    every(intervalMs, fn, opts) {
      repeats.push({
        interval: intervalMs,
        next: (opts?.from ?? 0) + (opts?.leading === false ? intervalMs : 0),
        until: opts?.until ?? options.duration,
        index: 0,
        fn,
      });
    },
    onFrame(fn) {
      frameHooks.push(fn);
    },
    setTrail(fadePerFrame) {
      trailFade = Math.min(1, Math.max(0.02, fadePerFrame));
    },
    range(min, max) {
      return min + rng() * (max - min);
    },
    pick(items) {
      return items[Math.floor(rng() * items.length)] as (typeof items)[number];
    },
  };

  function updateParticle(p: Particle, dt: number) {
    p.life += dt;
    const damp = p.drag === 1 ? 1 : Math.pow(p.drag, dt);
    p.vx = p.vx * damp + p.ax * dt;
    p.vy = p.vy * damp + p.ay * dt;
    if (p.wander > 0) {
      const t = p.life * 3 + p.phase;
      p.vx += Math.sin(t * 1.7) * p.wander * dt;
      p.vy += Math.cos(t * 1.3) * p.wander * dt;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rotation += p.spin * dt;
    p.update?.(p, dt, api);
  }

  function particleAlpha(p: Particle, tSeconds: number): number {
    const lifeRatio = p.life / p.maxLife;
    let alpha = p.opacity;
    if (p.fadeIn > 0 && lifeRatio < p.fadeIn) alpha *= lifeRatio / p.fadeIn;
    if (p.fadeOut > 0 && lifeRatio > 1 - p.fadeOut) alpha *= Math.max(0, (1 - lifeRatio) / p.fadeOut);
    if (p.twinkle > 0) alpha *= 0.55 + 0.45 * Math.sin(tSeconds * p.twinkle * TAU + p.phase * 5);
    return Math.max(0, Math.min(1, alpha));
  }

  function drawParticle(p: Particle, tSeconds: number) {
    if (!ctx) return;
    const alpha = particleAlpha(p, tSeconds);
    if (alpha <= 0.004) return;
    const lifeRatio = Math.min(1, p.life / p.maxLife);
    const size = p.size + (p.endSize - p.size) * lifeRatio;
    if (size <= 0.05) return;

    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = p.composite;

    switch (p.shape) {
      case 'dot':
      case 'spark': {
        if (p.glow > 0) {
          const glowSize = size * 3.4 * p.glow + (p.shape === 'spark' ? 4 : 0);
          ctx.drawImage(getGlowSprite(p.color), p.x - glowSize / 2, p.y - glowSize / 2, glowSize, glowSize);
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'streak': {
        const tailX = p.x - p.vx * p.stretch;
        const tailY = p.y - p.vy * p.stretch;
        const gradient = ctx.createLinearGradient(tailX, tailY, p.x, p.y);
        gradient.addColorStop(0, colorWithAlpha(p.color, 0));
        gradient.addColorStop(1, p.color);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        if (p.glow > 0) {
          const glowSize = size * 4 * p.glow;
          ctx.drawImage(getGlowSprite(p.color), p.x - glowSize / 2, p.y - glowSize / 2, glowSize, glowSize);
        }
        break;
      }
      case 'glyph': {
        ctx.font = p.font || `700 ${Math.round(size)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
        ctx.fillStyle = p.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (p.rotation !== 0) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillText(p.glyph, 0, 0);
          ctx.restore();
        } else {
          ctx.fillText(p.glyph, p.x, p.y);
        }
        break;
      }
      case 'ring': {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, 2.4 * (1 - lifeRatio) + 0.6);
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, TAU);
        ctx.stroke();
        break;
      }
      case 'rect': {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        if (p.flutter > 0) {
          ctx.scale(1, 0.15 + Math.abs(Math.sin(p.life * p.flutter * TAU + p.phase)) * 0.85);
        }
        ctx.fillStyle = p.color;
        ctx.fillRect(-size / 2, -size * 0.7, size, size * 1.4);
        ctx.restore();
        break;
      }
    }
  }

  function frame(now: number) {
    if (destroyed) return;
    if (startTime < 0) {
      startTime = now;
      lastTime = now;
    }
    const tMs = now - startTime;
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;

    // 半透明擦除上一帧 → 运动拖尾；trailFade=1 时完全清屏
    if (trailFade >= 1) {
      ctx!.clearRect(0, 0, width, height);
    } else {
      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = 'destination-out';
      ctx!.fillStyle = `rgba(0, 0, 0, ${Math.min(1, trailFade * (dt * 60))})`;
      ctx!.fillRect(0, 0, width, height);
    }

    while (timeline.length > 0 && timeline[0].time <= tMs) {
      timeline.shift()!.fn();
    }
    for (const task of repeats) {
      while (task.next <= tMs && task.next <= task.until) {
        task.fn(task.index);
        task.index += 1;
        task.next += task.interval;
      }
    }

    ctx!.globalCompositeOperation = 'lighter';
    for (const hook of frameHooks) {
      ctx!.save();
      hook(tMs, dt, ctx!);
      ctx!.restore();
    }

    const tSeconds = tMs / 1000;
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      updateParticle(p, dt);
      if (p.life >= p.maxLife) {
        particles.splice(i, 1);
        p.onDeath?.(p, api);
        continue;
      }
      drawParticle(p, tSeconds);
    }

    ctx!.globalAlpha = 1;
    ctx!.globalCompositeOperation = 'source-over';
    rafId = window.requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  options.scene(api);
  rafId = window.requestAnimationFrame(frame);

  return {
    destroy() {
      destroyed = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      particles.length = 0;
      timeline.length = 0;
      repeats.length = 0;
      frameHooks.length = 0;
    },
  };
}
