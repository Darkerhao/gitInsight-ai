<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { gsap } from 'gsap';
import { Cpu, Database, FastForward, FolderGit2, Sparkles } from 'lucide-vue-next';

type StageKey = 'core' | 'space' | 'system' | 'ready';

interface Particle {
  originX: number;
  originY: number;
  gatherX: number;
  gatherY: number;
  targetX: number;
  targetY: number;
  size: number;
  hueShift: number;
  drift: number;
}

interface WelcomeMetrics {
  loaded: boolean;
  repoCount: number;
  selectedRepoCount: number;
  reportCount: number;
  recentCommitCount: number;
  syncLogCount: number;
  successSyncLogCount: number;
  errorLogCount: number;
  latestReportDate: string;
  latestSyncAt: string;
  appVersion: string;
}

const props = withDefaults(
  defineProps<{
    metrics?: WelcomeMetrics;
  }>(),
  {
    metrics: () => ({
      loaded: false,
      repoCount: 0,
      selectedRepoCount: 0,
      reportCount: 0,
      recentCommitCount: 0,
      syncLogCount: 0,
      successSyncLogCount: 0,
      errorLogCount: 0,
      latestReportDate: '',
      latestSyncAt: '',
      appVersion: '',
    }),
  },
);

const emit = defineEmits<{
  (e: 'finished'): void;
}>();

const STORAGE_KEY = 'gitinsight:welcome-finished';
const FULL_DURATION_SECONDS = 5.8;
const COMPACT_TIME_SCALE = 1.58;
const ACCELERATED_TIME_SCALE = 3.35;

const rootRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const progress = ref(0);
const stageKey = ref<StageKey>('core');
const leaving = ref(false);
const compactRun = ref(false);
const accelerated = ref(false);
const fallbackLoading = ref(false);

const stageCopy: Record<StageKey, { title: string; detail: string }> = {
  core: {
    title: '能量聚合',
    detail: 'AI 核心正在吸附项目粒子',
  },
  space: {
    title: '空间展开',
    detail: '项目、工作台与数据面板正在生成',
  },
  system: {
    title: '系统生成',
    detail: '日报预览、同步通道与本地状态正在准备',
  },
  ready: {
    title: '工作台就绪',
    detail: '正在进入 AI 日报助手',
  },
};

const stageText = computed(() => {
  if (fallbackLoading.value) {
    return {
      title: '安全加载',
      detail: '动画通道降级，正在保持初始化进度',
    };
  }

  return stageCopy[stageKey.value];
});

const progressPercent = computed(() => Math.min(100, Math.round(progress.value * 100)));

const metricLoadingText = '读取中';

function metricText(value: number, unit = '') {
  return props.metrics.loaded ? `${value}${unit}` : metricLoadingText;
}

function formatMetricDate(value: string) {
  if (!props.metrics.loaded) return metricLoadingText;
  if (!value) return '暂无';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

const repoMetricText = computed(() => metricText(props.metrics.repoCount));
const reportMetricText = computed(() => metricText(props.metrics.reportCount));
const syncMetricText = computed(() => metricText(props.metrics.syncLogCount));

const structureSpaces = [
  {
    key: 'projects',
    title: '项目空间',
    label: 'Repository Graph',
    icon: FolderGit2,
    items: ['Git Diff 采样', 'Commit 语义聚类', '模块影响面识别'],
  },
  {
    key: 'workbench',
    title: '工作台核心',
    label: 'AI Daily Engine',
    icon: Sparkles,
    items: ['日报生成管线', '上下文压缩', '质量规则校验'],
  },
  {
    key: 'data',
    title: '数据空间',
    label: 'Insight Telemetry',
    icon: Database,
    items: ['任务状态聚合', '团队同步指标', '历史趋势回放'],
  },
];

const activityRows = computed(() => [
  { name: '已选仓库', state: metricText(props.metrics.selectedRepoCount, ' 个'), tone: 'blue' },
  { name: '历史日报', state: metricText(props.metrics.reportCount, ' 条'), tone: 'green' },
  { name: '近期提交', state: metricText(props.metrics.recentCommitCount, ' 条'), tone: 'violet' },
]);

const readinessRows = computed(() => [
  { name: '同步日志', state: metricText(props.metrics.syncLogCount, ' 条'), tone: 'blue' },
  { name: '成功同步', state: metricText(props.metrics.successSyncLogCount, ' 次'), tone: 'green' },
  { name: '错误日志', state: metricText(props.metrics.errorLogCount, ' 条'), tone: 'violet' },
]);

let timeline: gsap.core.Timeline | null = null;
let gsapContext: ReturnType<typeof gsap.context> | null = null;
let finishTimer = 0;
let fallbackTimer = 0;
let fallbackRaf = 0;
let canvasRaf = 0;
let canvasContext: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let canvasWidth = 0;
let canvasHeight = 0;
let pixelRatio = 1;
let timelineProgress = 0;
let hasFinished = false;
let reduceMotion = false;

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function easeInOutCubic(value: number) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function updateStage(value: number) {
  if (value < 0.3) {
    stageKey.value = 'core';
  } else if (value < 0.7) {
    stageKey.value = 'space';
  } else if (value < 0.96) {
    stageKey.value = 'system';
  } else {
    stageKey.value = 'ready';
  }
}

function syncProgress(value: number) {
  const nextProgress = clamp(value);
  timelineProgress = nextProgress;
  progress.value = nextProgress;
  updateStage(nextProgress);
  rootRef.value?.style.setProperty('--opening-progress', nextProgress.toFixed(3));
}

function createParticles() {
  if (!canvasRef.value) return;

  const rect = canvasRef.value.getBoundingClientRect();
  canvasWidth = Math.max(1, Math.floor(rect.width));
  canvasHeight = Math.max(1, Math.floor(rect.height));
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  canvasRef.value.width = Math.floor(canvasWidth * pixelRatio);
  canvasRef.value.height = Math.floor(canvasHeight * pixelRatio);
  canvasContext = canvasRef.value.getContext('2d');
  canvasContext?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight * 0.46;
  const count = reduceMotion ? 90 : Math.min(210, Math.max(120, Math.floor((canvasWidth * canvasHeight) / 7200)));
  const panelCenters = [
    { x: canvasWidth * 0.24, y: canvasHeight * 0.54 },
    { x: canvasWidth * 0.5, y: canvasHeight * 0.48 },
    { x: canvasWidth * 0.76, y: canvasHeight * 0.54 },
  ];

  particles = Array.from({ length: count }, (_, index) => {
    const side = index % 4;
    const margin = 70;
    const originX =
      side === 0 ? -margin : side === 1 ? canvasWidth + margin : Math.random() * canvasWidth;
    const originY =
      side === 2 ? -margin : side === 3 ? canvasHeight + margin : Math.random() * canvasHeight;
    const ring = 8 + Math.random() * 42;
    const angle = Math.random() * Math.PI * 2;
    const panel = panelCenters[index % panelCenters.length];

    return {
      originX,
      originY,
      gatherX: centerX + Math.cos(angle) * ring,
      gatherY: centerY + Math.sin(angle) * ring,
      targetX: panel.x + (Math.random() - 0.5) * canvasWidth * 0.18,
      targetY: panel.y + (Math.random() - 0.5) * canvasHeight * 0.34,
      size: 0.8 + Math.random() * 1.8,
      hueShift: Math.random(),
      drift: Math.random() * Math.PI * 2,
    };
  });
}

function drawCore(ctx: CanvasRenderingContext2D, value: number, time: number) {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight * 0.46;
  const phaseOne = clamp(value / 0.3);
  const phaseTwo = clamp((value - 0.3) / 0.4);
  const phaseThree = clamp((value - 0.7) / 0.3);
  const pulse = 0.5 + Math.sin(time / 280) * 0.5;
  const coreRadius = lerp(10, 34, easeOutCubic(phaseOne)) + pulse * 3 - phaseTwo * 10;
  const flashRadius = lerp(20, Math.max(canvasWidth, canvasHeight) * 0.42, easeOutCubic(phaseTwo));
  const glowOpacity = Math.max(0.08, 0.58 - phaseThree * 0.32);

  const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(160, flashRadius));
  glow.addColorStop(0, `rgba(79, 140, 255, ${glowOpacity})`);
  glow.addColorStop(0.32, `rgba(124, 92, 255, ${glowOpacity * 0.42})`);
  glow.addColorStop(1, 'rgba(11, 18, 32, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  if (phaseTwo > 0.03 && phaseTwo < 0.92) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, flashRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(120, 180, 255, ${0.34 * (1 - phaseTwo)})`;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(centerX, centerY, Math.max(4, coreRadius), 0, Math.PI * 2);
  ctx.fillStyle = `rgba(185, 215, 255, ${0.88 - phaseThree * 0.26})`;
  ctx.shadowBlur = 34;
  ctx.shadowColor = 'rgba(120, 180, 255, 0.72)';
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawParticles(time: number) {
  if (!canvasContext || !canvasRef.value) return;

  const ctx = canvasContext;
  const value = timelineProgress;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  drawCore(ctx, value, time);

  particles.forEach((particle, index) => {
    let x = particle.originX;
    let y = particle.originY;
    let opacity = 0.72;

    if (value < 0.3) {
      const local = easeOutCubic(clamp(value / 0.3 + (index % 9) * 0.006));
      x = lerp(particle.originX, particle.gatherX, local);
      y = lerp(particle.originY, particle.gatherY, local);
      opacity = 0.18 + local * 0.72;
    } else if (value < 0.7) {
      const local = easeOutCubic((value - 0.3) / 0.4);
      const flare = Math.sin(local * Math.PI);
      x = lerp(particle.gatherX, particle.targetX, local) + Math.cos(particle.drift) * flare * 20;
      y = lerp(particle.gatherY, particle.targetY, local) + Math.sin(particle.drift) * flare * 16;
      opacity = 0.9 - local * 0.18;
    } else {
      const local = easeInOutCubic((value - 0.7) / 0.3);
      x = particle.targetX + Math.cos(time / 900 + particle.drift) * (4 + local * 7);
      y = particle.targetY + Math.sin(time / 760 + particle.drift) * (3 + local * 5);
      opacity = 0.72 - local * 0.16;
    }

    const blue = particle.hueShift > 0.44 ? '124, 92, 255' : particle.hueShift > 0.22 ? '80, 220, 190' : '120, 180, 255';
    ctx.beginPath();
    ctx.arc(x, y, particle.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${blue}, ${opacity})`;
    ctx.fill();

    if (index % 8 === 0 && value > 0.12) {
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight * 0.46;
      const lineOpacity = value < 0.58 ? 0.12 * (1 - clamp((value - 0.3) / 0.38)) : 0.02;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(centerX, centerY);
      ctx.strokeStyle = `rgba(120, 180, 255, ${lineOpacity})`;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  });

  canvasRaf = window.requestAnimationFrame(drawParticles);
}

function setupCanvas() {
  createParticles();
  canvasRaf = window.requestAnimationFrame(drawParticles);
  window.addEventListener('resize', createParticles);
}

function finish() {
  if (hasFinished) return;

  hasFinished = true;
  stageKey.value = 'ready';
  syncProgress(1);

  try {
    window.localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // localStorage 不可用时不影响进入主工作台。
  }

  leaving.value = true;
  finishTimer = window.setTimeout(() => {
    emit('finished');
  }, 460);
}

function setupTimeline() {
  if (!rootRef.value) return;

  const runTimeScale = compactRun.value ? COMPACT_TIME_SCALE : 1;
  const narrowViewport = window.matchMedia('(max-width: 820px)').matches;
  const brandSpaceState = narrowViewport
    ? { y: -104, scale: 0.56, opacity: 0.28, duration: 0.74, ease: 'expo.inOut' }
    : { y: -124, scale: 0.74, opacity: 1, duration: 0.74, ease: 'expo.inOut' };
  const brandReadyState = narrowViewport
    ? { y: -108, scale: 0.48, opacity: 0.16, duration: 0.28 }
    : { y: -132, scale: 0.68, opacity: 1, duration: 0.28 };

  gsapContext = gsap.context(() => {
    gsap.set('.opening-structure, .opening-workspace, .boot-strip', { opacity: 0 });
    gsap.set('.structure-panel', {
      opacity: 0,
      scaleX: 0.12,
      scale: 0.86,
      rotateY: (index: number) => (index === 0 ? 42 : index === 2 ? -42 : 0),
      x: (index: number) => (index === 0 ? 160 : index === 2 ? -160 : 0),
      transformOrigin: (index: number) => (index === 0 ? '100% 50%' : index === 2 ? '0% 50%' : '50% 50%'),
      filter: 'blur(18px)',
    });
    gsap.set('.content-card', { opacity: 0, y: 26, scale: 0.94, filter: 'blur(18px)' });
    gsap.set('.skeleton-line, .structure-rail', { scaleX: 0, transformOrigin: '0% 50%' });
    gsap.set('.trend-line', { strokeDasharray: 360, strokeDashoffset: 360 });
    gsap.set('.donut-progress', { strokeDasharray: 260, strokeDashoffset: 260 });
    gsap.set('.ready-signal', { opacity: 0, y: 8 });

    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onUpdate: () => syncProgress(tl.progress()),
      onComplete: finish,
    });

    timeline = tl;

    tl.from('.brand-mark', {
      opacity: 0,
      scale: 0.32,
      filter: 'blur(14px)',
      duration: 0.52,
      ease: 'back.out(1.55)',
    })
      .from('.brand-copy > *', { opacity: 0, y: 14, duration: 0.48, stagger: 0.08 }, 0.18)
      .fromTo(
        '.energy-ring',
        { opacity: 0, scale: 0.38 },
        { opacity: 0.72, scale: 1.48, duration: 1.25, stagger: 0.16 },
        0.08,
      )
      .fromTo('.phase-orbit', { opacity: 0, rotate: -18 }, { opacity: 1, rotate: 0, duration: 1.2 }, 0.22)
      .to('.brand-mark', { scale: 1.08, duration: 0.62, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0.58)
      .to('.opening-structure', { opacity: 1, duration: 0.3 }, 1.54)
      .addLabel('space', 1.74)
      .to('.core-flash', { opacity: 0, scale: 5.2, duration: 0.88, ease: 'expo.out' }, 'space')
      .to('.brand-copy', { opacity: 0, y: -18, duration: 0.36 }, 'space+=0.02')
      .to('.brand-mark', brandSpaceState, 'space+=0.02')
      .to(
        '.structure-panel',
        {
          opacity: 1,
          scaleX: 1,
          scale: 1,
          rotateY: 0,
          x: 0,
          filter: 'blur(0px)',
          duration: 1.12,
          stagger: { each: 0.16, from: 'center' },
          ease: 'expo.out',
        },
        'space+=0.12',
      )
      .to('.structure-rail', { scaleX: 1, opacity: 1, duration: 0.62, stagger: 0.06 }, 'space+=0.32')
      .from('.space-node', { opacity: 0, scale: 0.5, duration: 0.48, stagger: 0.04 }, 'space+=0.48')
      .fromTo(
        '.light-sweep',
        { opacity: 0, xPercent: -135 },
        { opacity: 1, xPercent: 135, duration: 1.18, stagger: 0.12, ease: 'power2.inOut' },
        'space+=0.58',
      )
      .to('.opening-workspace', { opacity: 1, duration: 0.24 }, 3.76)
      .to('.boot-strip', { opacity: 1, y: 0, duration: 0.34 }, 3.86)
      .addLabel('system', 3.92)
      .to('.structure-panel', { opacity: 0.42, scale: 0.985, duration: 0.5 }, 'system')
      .to(
        '.content-card',
        {
          opacity: 1,
          y: 0,
          scale: 1,
          filter: 'blur(0px)',
          duration: 0.72,
          stagger: 0.12,
          ease: 'power3.out',
        },
        'system+=0.02',
      )
      .to('.skeleton-line', { scaleX: 1, duration: 0.46, stagger: 0.025 }, 'system+=0.14')
      .to('.trend-line', { strokeDashoffset: 0, duration: 1.04, ease: 'power2.inOut' }, 'system+=0.34')
      .from('.activity-row', { opacity: 0, x: -12, duration: 0.42, stagger: 0.08 }, 'system+=0.56')
      .addLabel('ready', 5.22)
      .to('.ready-signal', { opacity: 1, y: 0, duration: 0.34 }, 'ready')
      .to('.brand-mark', brandReadyState, 'ready')
      .to({}, { duration: 0.24 });

    tl.timeScale(reduceMotion ? Math.max(runTimeScale, 2.1) : runTimeScale);
  }, rootRef.value);
}

function runFallbackProgress() {
  const duration = compactRun.value ? 2100 : 3200;
  const start = performance.now();

  const tick = (time: number) => {
    const nextProgress = clamp((time - start) / duration);
    syncProgress(nextProgress);

    if (nextProgress < 1 && !hasFinished) {
      fallbackRaf = window.requestAnimationFrame(tick);
      return;
    }

    finish();
  };

  fallbackRaf = window.requestAnimationFrame(tick);
}

function accelerate() {
  if (hasFinished) return;

  accelerated.value = true;

  if (timeline) {
    timeline.timeScale(Math.max(timeline.timeScale(), ACCELERATED_TIME_SCALE));
    return;
  }

  if (fallbackLoading.value) {
    syncProgress(Math.max(timelineProgress, 0.72));
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault();
    accelerate();
  }
}

onMounted(async () => {
  try {
    compactRun.value = Boolean(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    compactRun.value = false;
  }

  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  await nextTick();
  rootRef.value?.focus({ preventScroll: true });
  setupCanvas();

  try {
    setupTimeline();
  } catch (error) {
    console.error('WelcomeGate animation fallback:', error);
    fallbackLoading.value = true;
    runFallbackProgress();
  }

  const safetyDuration = (FULL_DURATION_SECONDS / (compactRun.value ? COMPACT_TIME_SCALE : 1)) * 1000 + 2600;
  fallbackTimer = window.setTimeout(() => {
    if (!hasFinished) {
      fallbackLoading.value = true;
      finish();
    }
  }, safetyDuration);
});

onBeforeUnmount(() => {
  window.clearTimeout(finishTimer);
  window.clearTimeout(fallbackTimer);
  window.cancelAnimationFrame(canvasRaf);
  window.cancelAnimationFrame(fallbackRaf);
  window.removeEventListener('resize', createParticles);
  gsapContext?.revert();
  timeline = null;
});
</script>

<template>
  <section
    ref="rootRef"
    class="ai-welcome"
    :class="{ 'is-leaving': leaving, 'is-compact': compactRun, 'is-accelerated': accelerated }"
    tabindex="0"
    role="dialog"
    aria-label="AI日报助手开屏动画"
    @keydown="handleKeydown"
    @pointerdown.self="accelerate"
  >
    <canvas ref="canvasRef" class="opening-particles" aria-hidden="true" />

    <div class="space-layer" aria-hidden="true">
      <div class="space-grid" />
      <div class="depth-plane depth-plane-left" />
      <div class="depth-plane depth-plane-right" />
    </div>

    <div class="opening-core" aria-hidden="true">
      <div class="energy-ring energy-ring-one" />
      <div class="energy-ring energy-ring-two" />
      <div class="energy-ring energy-ring-three" />
      <div class="phase-orbit">
        <span />
        <span />
        <span />
      </div>
      <div class="core-flash" />
    </div>

    <div class="brand-cluster">
      <div class="brand-mark">
        <Cpu :size="34" stroke-width="1.8" />
      </div>
      <div class="brand-copy">
        <p>AI Daily Workspace</p>
        <h1>AI日报助手</h1>
        <span>智能生成，高效同步</span>
      </div>
    </div>

    <div class="opening-structure" aria-hidden="true">
      <div class="structure-rail rail-left" />
      <div class="structure-rail rail-right" />
      <article
        v-for="space in structureSpaces"
        :key="space.key"
        class="structure-panel"
        :class="`structure-panel-${space.key}`"
      >
        <div class="light-sweep" />
        <header>
          <component :is="space.icon" :size="16" stroke-width="1.8" />
          <div>
            <strong>{{ space.title }}</strong>
            <span>{{ space.label }}</span>
          </div>
        </header>
        <ul>
          <li v-for="item in space.items" :key="item">
            <span class="space-node" />
            {{ item }}
          </li>
        </ul>
      </article>
    </div>

    <div class="opening-workspace">
      <section class="content-card project-console">
        <header>
          <span>仓库总数</span>
          <strong>{{ repoMetricText }}</strong>
        </header>
        <div class="repo-stack">
          <div v-for="row in activityRows" :key="row.name" class="activity-row" :class="`tone-${row.tone}`">
            <span />
            <p>{{ row.name }}</p>
            <em>{{ row.state }}</em>
          </div>
        </div>
        <div class="skeleton-group">
          <i class="skeleton-line wide" />
          <i class="skeleton-line medium" />
          <i class="skeleton-line short" />
        </div>
      </section>

      <section class="content-card workbench-console">
        <header>
          <span>历史日报</span>
          <strong>{{ reportMetricText }}</strong>
        </header>
        <div class="report-frame">
          <div class="report-toolbar">
            <span class="skeleton-line" />
            <span class="skeleton-line" />
            <span class="skeleton-line" />
          </div>
          <svg class="trend-chart" viewBox="0 0 360 148" role="img" aria-label="日报生成预览骨架">
            <defs>
              <linearGradient id="trendFill" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stop-color="#4f8cff" />
                <stop offset="52%" stop-color="#50dcbe" />
                <stop offset="100%" stop-color="#7c5cff" />
              </linearGradient>
            </defs>
            <path
              class="trend-line"
              d="M16 116 C58 84 76 95 112 66 C151 34 181 54 214 44 C260 30 287 66 344 28"
              fill="none"
              stroke="url(#trendFill)"
              stroke-linecap="round"
              stroke-width="5"
            />
          </svg>
        </div>
        <div class="ready-signal">
          <Sparkles :size="14" />
          <span>最近日报 {{ metrics.loaded ? metrics.latestReportDate || '暂无' : '读取中' }}</span>
        </div>
      </section>

      <section class="content-card data-console">
        <header>
          <span>同步日志</span>
          <strong>{{ syncMetricText }}</strong>
        </header>
        <div class="repo-stack">
          <div v-for="row in readinessRows" :key="row.name" class="activity-row" :class="`tone-${row.tone}`">
            <span />
            <p>{{ row.name }}</p>
            <em>{{ row.state }}</em>
          </div>
        </div>
        <div class="data-footer">
          <div>
            <span>最近同步</span>
            <strong>{{ formatMetricDate(metrics.latestSyncAt) }}</strong>
          </div>
        </div>
      </section>
    </div>

    <footer class="boot-strip">
      <div class="boot-copy">
        <span class="stage-dot" />
        <div>
          <strong>{{ stageText.title }}</strong>
          <p>{{ stageText.detail }}</p>
        </div>
      </div>

      <div class="progress-track" aria-hidden="true">
        <span :style="{ width: `${progressPercent}%` }" />
      </div>

      <button class="accelerate-btn" type="button" :aria-pressed="accelerated" @click.stop="accelerate">
        <FastForward :size="15" stroke-width="2" />
        <span>{{ accelerated ? '加速中' : '加速构建' }}</span>
      </button>
    </footer>
  </section>
</template>

<style scoped>
.ai-welcome {
  --opening-progress: 0;
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: #eaf2ff;
  background:
    radial-gradient(circle at 50% 46%, rgba(79, 140, 255, 0.18), transparent 27%),
    linear-gradient(135deg, #070d18 0%, #0b1220 46%, #0d1629 100%);
  perspective: 1600px;
  outline: none;
  opacity: 1;
  transition: opacity 0.46s ease, filter 0.46s ease;
}

.ai-welcome.is-leaving {
  opacity: 0;
  filter: blur(10px);
}

.opening-particles,
.space-layer,
.opening-core,
.brand-cluster,
.opening-structure,
.opening-workspace,
.boot-strip {
  position: absolute;
}

.opening-particles {
  inset: 0;
  width: 100%;
  height: 100%;
}

.space-layer {
  inset: 0;
  overflow: hidden;
}

.space-layer::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(120, 180, 255, 0.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(120, 180, 255, 0.055) 1px, transparent 1px);
  background-size: 54px 54px;
  mask-image: radial-gradient(circle at 50% 46%, rgba(0, 0, 0, 0.88), transparent 70%);
  transform: translateY(calc(var(--opening-progress) * -18px)) scale(1.04);
}

.space-grid {
  position: absolute;
  inset: 8% 7%;
  border: 1px solid rgba(120, 180, 255, 0.12);
  border-radius: 8px;
  transform: rotateX(58deg) translateY(18%) scale(1.16);
  transform-origin: 50% 100%;
  background:
    linear-gradient(rgba(79, 140, 255, 0.14) 1px, transparent 1px),
    linear-gradient(90deg, rgba(79, 140, 255, 0.14) 1px, transparent 1px);
  background-size: 74px 74px;
  opacity: calc(0.16 + var(--opening-progress) * 0.34);
  box-shadow: 0 0 80px rgba(79, 140, 255, 0.16);
}

.depth-plane {
  position: absolute;
  top: 12%;
  bottom: 12%;
  width: 28%;
  border: 1px solid rgba(120, 180, 255, 0.12);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(79, 140, 255, 0.07), rgba(11, 18, 32, 0.02));
  opacity: 0.5;
}

.depth-plane-left {
  left: -8%;
  transform: rotateY(58deg);
}

.depth-plane-right {
  right: -8%;
  transform: rotateY(-58deg);
}

.opening-core {
  left: 50%;
  top: 46%;
  width: 220px;
  height: 220px;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.energy-ring,
.phase-orbit,
.core-flash {
  position: absolute;
  inset: 0;
  border-radius: 50%;
}

.energy-ring {
  border: 1px solid rgba(120, 180, 255, 0.42);
  box-shadow: inset 0 0 28px rgba(79, 140, 255, 0.16), 0 0 38px rgba(79, 140, 255, 0.2);
}

.energy-ring-two {
  inset: 18px;
  border-color: rgba(124, 92, 255, 0.36);
}

.energy-ring-three {
  inset: 38px;
  border-color: rgba(80, 220, 190, 0.28);
}

.phase-orbit {
  inset: 34px;
  border: 1px dashed rgba(200, 225, 255, 0.22);
  animation: orbit-spin 8s linear infinite;
}

.phase-orbit span {
  position: absolute;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #78b4ff;
  box-shadow: 0 0 18px rgba(120, 180, 255, 0.86);
}

.phase-orbit span:nth-child(1) {
  left: 50%;
  top: -4px;
}

.phase-orbit span:nth-child(2) {
  right: 7%;
  bottom: 16%;
  background: #50dcbe;
}

.phase-orbit span:nth-child(3) {
  left: 8%;
  bottom: 18%;
  background: #7c5cff;
}

.core-flash {
  inset: 68px;
  background: radial-gradient(circle, rgba(235, 246, 255, 0.96), rgba(79, 140, 255, 0.2) 54%, transparent 70%);
  box-shadow: 0 0 52px rgba(120, 180, 255, 0.7);
}

.brand-cluster {
  left: 50%;
  top: 46%;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: min(460px, calc(100vw - 48px));
  text-align: center;
  transform: translate(-50%, -50%);
}

.brand-mark {
  position: relative;
  display: grid;
  place-items: center;
  width: 82px;
  height: 82px;
  border: 1px solid rgba(200, 225, 255, 0.34);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(79, 140, 255, 0.95), rgba(124, 92, 255, 0.9)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.3), transparent);
  box-shadow: 0 0 0 12px rgba(79, 140, 255, 0.1), 0 22px 70px rgba(79, 140, 255, 0.46);
}

.brand-mark::after {
  content: '';
  position: absolute;
  inset: 8px;
  border: 1px solid rgba(255, 255, 255, 0.26);
  border-radius: 6px;
}

.brand-copy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
}

.brand-copy p,
.brand-copy h1,
.brand-copy span {
  margin: 0;
}

.brand-copy p {
  color: #78b4ff;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.brand-copy h1 {
  color: #f7fbff;
  font-size: 34px;
  font-weight: 800;
  line-height: 1.12;
}

.brand-copy span {
  color: rgba(218, 232, 255, 0.72);
  font-size: 14px;
}

.opening-structure {
  inset: 9% 7% 15%;
  z-index: 3;
  display: grid;
  grid-template-columns: minmax(180px, 0.86fr) minmax(240px, 1fr) minmax(180px, 0.86fr);
  gap: 18px;
  align-items: center;
  transform-style: preserve-3d;
  pointer-events: none;
}

.structure-rail {
  position: absolute;
  top: 50%;
  width: 29%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(120, 180, 255, 0.72), transparent);
  opacity: 0;
}

.rail-left {
  left: 20%;
}

.rail-right {
  right: 20%;
}

.structure-panel {
  position: relative;
  min-height: 390px;
  overflow: hidden;
  border: 1px solid rgba(120, 180, 255, 0.24);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(17, 29, 52, 0.72), rgba(10, 18, 34, 0.54)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    inset 0 0 48px rgba(79, 140, 255, 0.09),
    0 26px 90px rgba(0, 0, 0, 0.26);
  backdrop-filter: blur(18px);
  transform-style: preserve-3d;
}

.structure-panel::before {
  content: '';
  position: absolute;
  inset: 16px;
  border: 1px solid rgba(120, 180, 255, 0.14);
  border-radius: 8px;
}

.structure-panel-workbench {
  min-height: 470px;
  transform: translateZ(62px);
}

.structure-panel header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 22px;
}

.structure-panel header svg {
  color: #9dc2ff;
}

.structure-panel strong,
.structure-panel span {
  display: block;
}

.structure-panel strong {
  color: #f2f7ff;
  font-size: 15px;
}

.structure-panel header span {
  margin-top: 4px;
  color: rgba(218, 232, 255, 0.52);
  font-size: 12px;
}

.structure-panel ul {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 24px 22px 22px;
  list-style: none;
}

.structure-panel li {
  display: flex;
  align-items: center;
  gap: 10px;
  color: rgba(234, 242, 255, 0.74);
  font-size: 13px;
}

.space-node {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #78b4ff;
  box-shadow: 0 0 16px rgba(120, 180, 255, 0.8);
}

.light-sweep {
  position: absolute;
  top: -22%;
  bottom: -22%;
  width: 34%;
  background: linear-gradient(90deg, transparent, rgba(225, 241, 255, 0.24), transparent);
  transform: skewX(-18deg);
  opacity: 0;
}

.opening-workspace {
  inset: 13% 8% 16%;
  z-index: 4;
  display: grid;
  grid-template-columns: minmax(220px, 0.86fr) minmax(320px, 1.2fr) minmax(220px, 0.86fr);
  gap: 18px;
  align-items: end;
  pointer-events: none;
}

.content-card {
  position: relative;
  overflow: hidden;
  min-height: 286px;
  border: 1px solid rgba(151, 191, 255, 0.24);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(20, 34, 60, 0.82), rgba(9, 17, 32, 0.72)),
    linear-gradient(135deg, rgba(79, 140, 255, 0.14), transparent 48%);
  box-shadow: 0 22px 70px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(22px);
}

.content-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(120deg, rgba(255, 255, 255, 0.12), transparent 28%, rgba(79, 140, 255, 0.08));
  pointer-events: none;
}

.content-card header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 0;
}

.content-card header span,
.data-footer span {
  color: rgba(218, 232, 255, 0.62);
  font-size: 12px;
}

.content-card header strong {
  color: #f7fbff;
  font-size: 28px;
  line-height: 1;
}

.project-console,
.data-console {
  margin-bottom: 42px;
}

.workbench-console {
  min-height: 388px;
}

.repo-stack {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 10px;
  padding: 24px 18px 12px;
}

.activity-row {
  display: grid;
  grid-template-columns: 9px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  min-height: 42px;
  padding: 10px 12px;
  border: 1px solid rgba(151, 191, 255, 0.14);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.045);
}

.activity-row span {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #78b4ff;
  box-shadow: 0 0 14px rgba(120, 180, 255, 0.72);
}

.activity-row.tone-green span {
  background: #50dcbe;
}

.activity-row.tone-violet span {
  background: #9a83ff;
}

.activity-row p,
.activity-row em {
  margin: 0;
  overflow: hidden;
  color: rgba(235, 246, 255, 0.82);
  font-size: 12px;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-row em {
  color: rgba(218, 232, 255, 0.5);
}

.skeleton-group,
.report-toolbar {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 8px;
}

.skeleton-group {
  padding: 4px 18px 20px;
}

.skeleton-line {
  display: block;
  height: 7px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(120, 180, 255, 0.54), rgba(80, 220, 190, 0.24), transparent);
}

.skeleton-line.wide {
  width: 86%;
}

.skeleton-line.medium {
  width: 66%;
}

.skeleton-line.short {
  width: 44%;
}

.report-frame {
  position: relative;
  z-index: 1;
  margin: 28px 18px 18px;
  border: 1px solid rgba(151, 191, 255, 0.14);
  border-radius: 8px;
  background: rgba(8, 16, 30, 0.48);
}

.report-toolbar {
  grid-template-columns: 1fr 0.64fr 0.42fr;
  padding: 16px 16px 0;
}

.trend-chart {
  display: block;
  width: 100%;
  height: 164px;
  padding: 12px 12px 18px;
}

.ready-signal {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 18px 18px;
  padding: 8px 10px;
  border: 1px solid rgba(80, 220, 190, 0.22);
  border-radius: 8px;
  color: #b9fff0;
  background: rgba(80, 220, 190, 0.08);
  font-size: 12px;
}

.bar-chart {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  gap: 10px;
  height: 142px;
  padding: 28px 18px 12px;
}

.chart-bar {
  width: 100%;
  height: var(--bar-height);
  min-height: 18px;
  border-radius: 6px 6px 2px 2px;
  background: linear-gradient(180deg, #78b4ff, rgba(124, 92, 255, 0.62));
  box-shadow: 0 0 18px rgba(79, 140, 255, 0.22);
}

.data-footer {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 18px 18px;
}

.donut-chart {
  width: 64px;
  height: 64px;
  flex: 0 0 auto;
  transform: rotate(-90deg);
}

.donut-chart circle {
  fill: none;
  stroke: rgba(151, 191, 255, 0.16);
  stroke-width: 9;
}

.donut-chart .donut-progress {
  stroke: #50dcbe;
  stroke-linecap: round;
}

.data-footer strong {
  display: block;
  margin-top: 5px;
  color: #f7fbff;
  font-size: 14px;
}

.boot-strip {
  left: 50%;
  bottom: 28px;
  z-index: 8;
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(160px, 280px) auto;
  gap: 18px;
  align-items: center;
  width: min(940px, calc(100vw - 48px));
  padding: 12px 12px 12px 16px;
  border: 1px solid rgba(151, 191, 255, 0.22);
  border-radius: 8px;
  background: rgba(8, 16, 30, 0.72);
  box-shadow: 0 16px 52px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(18px);
  transform: translateX(-50%) translateY(10px);
}

.boot-copy {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.stage-dot {
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #50dcbe;
  box-shadow: 0 0 20px rgba(80, 220, 190, 0.78);
}

.boot-copy strong,
.boot-copy p {
  margin: 0;
}

.boot-copy strong {
  display: block;
  color: #f7fbff;
  font-size: 13px;
}

.boot-copy p {
  margin-top: 3px;
  overflow: hidden;
  color: rgba(218, 232, 255, 0.58);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(151, 191, 255, 0.12);
}

.progress-track span {
  display: block;
  width: 0;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #4f8cff, #50dcbe, #7c5cff);
  box-shadow: 0 0 18px rgba(120, 180, 255, 0.42);
  transition: width 0.12s linear;
}

.accelerate-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 112px;
  height: 38px;
  border: 1px solid rgba(151, 191, 255, 0.3);
  border-radius: 8px;
  color: #f7fbff;
  background: rgba(79, 140, 255, 0.18);
  cursor: pointer;
  pointer-events: auto;
  transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}

.accelerate-btn:hover {
  border-color: rgba(120, 180, 255, 0.62);
  background: rgba(79, 140, 255, 0.28);
  transform: translateY(-1px);
}

.accelerate-btn:focus-visible {
  outline: 2px solid rgba(120, 180, 255, 0.82);
  outline-offset: 2px;
}

.accelerate-btn span {
  font-size: 12px;
  font-weight: 700;
}

@keyframes orbit-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1100px) {
  .opening-structure,
  .opening-workspace {
    inset-inline: 4%;
    gap: 12px;
  }

  .structure-panel {
    min-height: 330px;
  }

  .structure-panel-workbench,
  .workbench-console {
    min-height: 368px;
  }
}

@media (max-width: 820px) {
  .opening-structure,
  .opening-workspace {
    grid-template-columns: minmax(0, 1fr);
    inset: 10% 18px 18%;
  }

  .structure-panel {
    min-height: 128px;
  }

  .structure-panel-workbench {
    min-height: 148px;
  }

  .structure-panel ul {
    display: none;
  }

  .project-console,
  .data-console {
    margin-bottom: 0;
  }

  .content-card {
    min-height: 152px;
  }

  .workbench-console {
    min-height: 216px;
  }

  .report-frame,
  .bar-chart,
  .data-footer {
    display: none;
  }

  .boot-strip {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    bottom: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .phase-orbit {
    animation-duration: 18s;
  }

  .ai-welcome {
    transition-duration: 0.28s;
  }
}
</style>
