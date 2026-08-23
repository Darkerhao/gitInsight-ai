<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import * as echarts from 'echarts';
import { useRouter } from 'vue-router';
import { Activity, Award, ChevronLeft, ChevronRight, Filter, GitCommitHorizontal, Maximize2, Minimize2, PanelRightClose, PanelRightOpen, Pause, Play, RefreshCw, Sparkles, Star, Zap, ZoomIn, ZoomOut } from 'lucide-vue-next';
import { useTimeline, typeOptions } from '@/composables/useTimeline';
import { usePlayback } from '@/composables/usePlayback';
import { useFullscreen } from '@/composables/useFullscreen';
import { tone, formatDate, dayTitle, daySummary, displayTitle, detailSections } from '@/utils/timelineText';
import type { TimelineScale } from '@/composables/useTimeline';
import { usePageZoom } from '@/composables/usePageZoom';

const router = useRouter();
const timelineRoot = ref<HTMLElement | null>(null);

const {
  snapshot, loading, loadError, scale, activeType,
  viewYear, viewLabel, isCurrentPeriod, navigatePeriod, goToToday,
  records, days, selectedRecord, selectedDay, selectedDayIndex, selectedItems, timelineWindow,
  forceReload, representative, selectDay, distance, eventPosition, handleWheel,
} = useTimeline();

const { isPlaying, togglePlayback } = usePlayback(days, selectedDayIndex, selectDay);
const { isFullscreen, toggleFullscreen } = useFullscreen(timelineRoot);
const { zoomFactor, canZoomOut, canZoomIn, zoomIn, zoomOut, resetPageZoom } = usePageZoom();

const detailCollapsed = ref(false);
const isMergingToday = ref(false);

watch(detailCollapsed, async () => {
  await nextTick();
  heatChart?.resize();
});

/* ── 年度热力图(ECharts calendar + heatmap) ── */
const heatmapChart = ref<HTMLElement | null>(null);
let heatChart: ReturnType<typeof echarts.init> | null = null;

function disposeHeatChart() {
  heatChart?.dispose();
  heatChart = null;
}

function buildHeatmapOption() {
  const maxCommits = Math.max(4, ...days.value.map((day) => day.commitsCount));
  return {
    backgroundColor: 'transparent',
    tooltip: {
      confine: true,
      backgroundColor: 'rgba(10, 16, 28, 0.94)',
      borderColor: 'rgba(148, 163, 184, 0.24)',
      textStyle: { color: '#dbe6f5', fontSize: 12 },
      formatter: (params: any) => {
        const date = Array.isArray(params.value) ? String(params.value[0]) : '';
        const day = days.value.find((item) => item.date === date);
        if (!day) return date;
        const milestone = day.milestone ? '<br/><span style="color:#f2cc7e">里程碑</span>' : '';
        return `<strong>${date}</strong><br/>${day.itemCount} 项工作 · ${day.commitsCount} 次提交${milestone}`;
      },
    },
    visualMap: {
      show: false,
      min: 0,
      max: maxCommits,
      seriesIndex: 0,
      inRange: { color: ['rgba(110, 231, 249, 0.16)', 'rgba(110, 231, 249, 0.55)', 'rgba(110, 231, 249, 0.95)'] },
    },
    calendar: {
      top: 34,
      left: 36,
      right: 10,
      bottom: 6,
      range: String(viewYear.value),
      cellSize: ['auto', 16],
      splitLine: { show: true, lineStyle: { color: 'rgba(148, 163, 184, 0.2)', width: 1 } },
      itemStyle: { color: 'rgba(148, 163, 184, 0.08)', borderColor: '#0b101c', borderWidth: 3 },
      dayLabel: { firstDay: 1, nameMap: ['日', '一', '二', '三', '四', '五', '六'], color: '#5d6b82', fontSize: 10 },
      monthLabel: { nameMap: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'], color: '#93a1b7', fontSize: 11 },
      yearLabel: { show: false },
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: days.value.map((day) => {
          const isSelected = selectedDay.value?.date === day.date;
          const itemStyle = isSelected
            ? { borderColor: '#eaf6ff', borderWidth: 2 }
            : day.milestone
              ? { borderColor: 'rgba(246, 200, 96, 0.85)', borderWidth: 1.5 }
              : {};
          return { value: [day.date, day.commitsCount], itemStyle };
        }),
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(110, 231, 249, 0.5)' } },
      },
    ],
  };
}

function renderHeatChart() {
  const el = heatmapChart.value;
  if (!el) return;
  if (!heatChart) {
    heatChart = echarts.init(el);
    heatChart.on('click', (params: any) => {
      const date = Array.isArray(params.value) ? String(params.value[0]) : '';
      const day = days.value.find((item) => item.date === date);
      if (day) selectDay(day);
    });
  }
  heatChart.setOption(buildHeatmapOption(), true);
}

watch([scale, days, selectedDay, viewYear], async () => {
  if (scale.value !== 'year' || !records.value.length) {
    disposeHeatChart();
    return;
  }
  await nextTick();
  renderHeatChart();
});

function resizeHeatChart() {
  heatChart?.resize();
}

window.addEventListener('resize', resizeHeatChart);
onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeHeatChart);
  disposeHeatChart();
});

function mergeToday() {
  isMergingToday.value = true;
  void forceReload(false).finally(() => window.setTimeout(() => { isMergingToday.value = false; }, 2200));
}

function openReport() {
  if (!selectedRecord.value) return;
  void router.push({ path: '/history', query: { id: selectedRecord.value.reportId } });
}

function onWheel(event: WheelEvent) {
  if (records.value.length) event.preventDefault();
  handleWheel(event);
}
</script>

<template>
  <div ref="timelineRoot" class="timeline-view" :class="{ fullscreen: isFullscreen, 'detail-collapsed': detailCollapsed }" @wheel="onWheel">
    <div class="stars"><i v-for="n in 38" :key="n" :style="{ '--x': `${(n * 37) % 100}%`, '--y': `${(n * 61) % 100}%`, '--delay': `${(n % 8) * -.7}s` }" /></div>
    <header>
      <div><span class="eyebrow"><Activity :size="15" /> DEVELOPMENT CHRONICLE · {{ viewLabel }}</span><h1>时间长河</h1><p>真实日报与 Git 提交，正在形成你的年度工程轨迹。</p></div>
      <div class="actions">
        <div class="period-nav" v-if="scale !== 'day'">
          <button @click="navigatePeriod(-1)" title="上一期"><ChevronLeft :size="15" /></button>
          <span>{{ viewLabel }}</span>
          <button @click="navigatePeriod(1)" title="下一期"><ChevronRight :size="15" /></button>
          <button v-if="!isCurrentPeriod" class="go-today" @click="goToToday">回到今天</button>
        </div>
        <div class="scale-switch"><button v-for="item in [{k:'year',l:'年度'},{k:'month',l:'月度'},{k:'day',l:'单日'}]" :key="item.k" :class="{ active: scale === item.k }" @click="scale = item.k as TimelineScale">{{ item.l }}</button></div>
        <button class="play" :class="{ active: isPlaying }" @click="togglePlayback"><Pause v-if="isPlaying" :size="15" /><Play v-else :size="15" />{{ isPlaying ? '暂停' : '轨迹回放' }}</button>
        <button class="refresh" :class="{ spinning: loading }" @click="forceReload()"><RefreshCw :size="16" /></button>
        <button class="detail-toggle" :title="detailCollapsed ? '展开详情' : '收起详情'" @click="detailCollapsed = !detailCollapsed"><PanelRightOpen v-if="detailCollapsed" :size="16" /><PanelRightClose v-else :size="16" /></button>
        <div class="timeline-zoom" aria-label="页面缩放">
          <button :disabled="!canZoomOut()" title="缩小（Ctrl/Cmd + -）" aria-label="缩小页面" @click="zoomOut"><ZoomOut :size="15" /></button>
          <button class="timeline-zoom-value" title="重置缩放（Ctrl/Cmd + 0）" @click="resetPageZoom">{{ Math.round(zoomFactor * 100) }}%</button>
          <button :disabled="!canZoomIn()" title="放大（Ctrl/Cmd + +）" aria-label="放大页面" @click="zoomIn"><ZoomIn :size="15" /></button>
        </div>
        <button class="fullscreen-button" :title="isFullscreen ? '退出全屏' : '全屏查看'" @click="toggleFullscreen"><Minimize2 v-if="isFullscreen" :size="16" /><Maximize2 v-else :size="16" /><span>{{ isFullscreen ? '退出全屏' : '全屏' }}</span></button>
      </div>
    </header>

    <div class="overview" v-if="snapshot"><strong>{{ snapshot.summary.totalCommits }}</strong> 次提交 <i /> <strong>{{ snapshot.summary.activeDays }}</strong> 个活跃日 <i /> <strong>{{ snapshot.total }}</strong> 项工作 <i /> <strong class="overview-milestone">{{ snapshot.summary.milestones }}</strong> 个里程碑 <i /> <strong>{{ snapshot.summary.projects.length }}</strong> 个活跃项目</div>
    <div class="filters"><Filter :size="14" /><button v-for="item in typeOptions" :key="item.label" :class="{ active: activeType === item.value }" @click="activeType = item.value">{{ item.label }}</button></div>

    <!-- 骨架屏加载态 -->
    <section v-if="loading && !snapshot" class="river skeleton">
      <div class="river-line" />
      <div v-for="n in 5" :key="n" class="skeleton-event">
        <div class="skeleton-copy"><div class="skeleton-line short" /><div class="skeleton-line" /><div class="skeleton-line medium" /></div>
        <div class="skeleton-node" />
        <div class="skeleton-date"><div class="skeleton-line tiny" /></div>
      </div>
    </section>

    <!-- 年度热力图 -->
    <section v-else-if="scale === 'year' && records.length" class="heatmap" aria-label="年度工作热力图">
      <div class="heatmap-canvas">
        <div ref="heatmapChart" class="heatmap-chart" aria-label="按提交密度着色的年度日历" />
        <div class="heatmap-foot">
          <div class="heatmap-legend"><span>少</span><i class="level-1" /><i class="level-2" /><i class="level-3" /><i class="level-4" /><span>多</span></div>
          <div class="heatmap-legend"><i class="milestone-demo" /><span>里程碑</span></div>
        </div>
      </div>
    </section>

    <section v-else-if="records.length" class="river" :class="`scale-${scale}`">
      <div class="aurora" /><div class="river-line"><i v-for="n in 14" :key="n" :style="{ '--delay': `${n * -.38}s` }" /></div>
      <article v-for="day in timelineWindow" :key="day.date" class="event" :class="[`distance-${distance(day)}`, { selected: selectedDay?.date === day.date, milestone: day.milestone }]" :style="eventPosition(day)" tabindex="0" @click="selectDay(day)" @keydown.enter="selectDay(day)">
        <div class="copy"><span :style="{ color: tone(representative(day).primaryType) }">{{ day.workTypes.join(' / ') }} · {{ day.projects.join(' / ') || '未识别项目' }}</span><h2>{{ dayTitle(day) }}</h2><p>{{ daySummary(day) }}</p></div>
        <button class="node" :aria-label="`${day.date}，${day.itemCount} 项工作${day.milestone ? '，里程碑' : ''}`" :style="{ '--tone': tone(representative(day).primaryType) }"><i /><b /><span v-if="day.milestone" class="node-milestone" aria-hidden="true"><Star :size="9" /></span><strong>{{ day.itemCount }}</strong><small>项工作</small></button>
        <time><b>{{ day.date === new Date().toISOString().slice(0, 10) ? 'TODAY' : day.date.slice(0, 4) }}</b>{{ formatDate(day.date) }}</time>
      </article>
      <div v-if="isMergingToday" class="merge"><span v-for="label in ['日报', '提交', '成果']" :key="label">{{ label }}</span><div><Sparkles :size="24" /></div><strong>真实数据正在汇入时间长河</strong></div>
    </section>

    <section v-else class="empty"><Sparkles :size="34" /><h2>{{ loadError ? '时间长河加载失败' : '这一段时间还没有成长记录' }}</h2><p>{{ loadError || '保存一篇日报后，系统会自动分析项目、工作类型、技术标签和提交证据。' }}</p><button v-if="loadError" @click="forceReload(false)">重新加载 <RefreshCw :size="15" /></button><button v-else @click="router.push('/generate')">去生成第一篇日报 <ChevronRight :size="15" /></button></section>

    <aside v-if="selectedRecord && selectedDay && !detailCollapsed" class="detail" :style="{ '--detail-tone': tone(selectedRecord.primaryType) }" @wheel.stop>
      <span><Award :size="17" /> {{ selectedDay.workTypes.join(' / ') }} · {{ selectedDay.date }}<em v-if="selectedDay.milestone" class="detail-milestone"><Star :size="11" /> 里程碑</em></span><h2>{{ dayTitle(selectedDay) }}</h2>
      <div class="detail-scroll">
        <section v-for="item in selectedItems" :key="item.id" class="detail-section"><h3>{{ displayTitle(item) }}</h3><ul><li v-for="content in detailSections(item)" :key="content">{{ content }}</li></ul></section>
        <section v-if="selectedDay.projects.length" class="detail-section"><h3>影响范围</h3><div class="tags"><span v-for="tag in [...new Set([...selectedDay.projects, ...selectedItems.flatMap(item => item.techTags)])]" :key="tag">{{ tag }}</span></div></section>
      </div>
      <div class="metrics"><div><small>提交次数</small><strong>{{ selectedDay.commitsCount }}</strong></div><div><small>变更文件</small><strong>{{ selectedDay.filesCount }}</strong></div><div><small>工作事项</small><strong>{{ selectedDay.itemCount }}</strong></div></div>
      <button @click="openReport">查看当日日报与提交证据 <ChevronRight :size="15" /></button>
    </aside>

    <div v-if="snapshot" class="footer"><GitCommitHorizontal :size="17" /><span>滚轮穿梭时间</span><i /><small>点击节点聚焦 · 回车键选择</small></div>
    <button class="merge-button" :disabled="loading || isMergingToday" @click="mergeToday"><Zap :size="16" />刷新今日轨迹</button>
  </div>
</template>

<style scoped lang="scss">
/* ── 设计令牌:深空底 + 单一冰蓝主光 ── */
.timeline-view {
  --tl-accent: #6ee7f9;
  --tl-text: #e9eef8;
  --tl-muted: #93a1b7;
  --tl-faint: #5d6b82;
  --tl-line: rgba(148, 163, 184, 0.14);
  --tl-line-strong: rgba(148, 163, 184, 0.26);
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: 32px 40px 72px;
  color: var(--tl-text);
  background:
    radial-gradient(ellipse at 18% -8%, rgba(59, 92, 199, 0.16), transparent 52%),
    radial-gradient(ellipse at 86% 112%, rgba(45, 191, 226, 0.1), transparent 46%),
    linear-gradient(180deg, #05070d, #080c17 56%, #05070e);
}
.timeline-view.fullscreen { height: 100vh; padding: 38px 48px 76px; }
* { box-sizing: border-box; }

/* ── 星空背景:小而克制 ── */
.stars { position: absolute; inset: 0; pointer-events: none; }
.stars i {
  position: absolute; left: var(--x); top: var(--y);
  width: 2px; height: 2px; border-radius: 50%;
  background: #cfe9ff; box-shadow: 0 0 4px rgba(143, 213, 255, 0.55);
  opacity: 0.7;
  animation: twinkle 5s var(--delay) infinite;
}

/* ── 页头 ── */
header { position: relative; z-index: 4; display: flex; justify-content: space-between; }
.eyebrow {
  display: flex; align-items: center; gap: 8px;
  color: var(--tl-accent); opacity: 0.85;
  font-size: 11px; font-weight: 600; letter-spacing: 0.24em;
}
h1 { margin: 8px 0 5px; font-size: 34px; font-weight: 600; letter-spacing: 0.04em; }
header p { margin: 0; color: var(--tl-muted); font-size: 13.5px; }
.actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* ── 月份/年份导航 ── */
.period-nav {
  display: flex; align-items: center; gap: 4px;
  padding: 3px; border: 1px solid var(--tl-line); border-radius: 9px;
  background: rgba(148, 163, 184, 0.05);
}
.period-nav button {
  width: 28px; height: 28px; border: 0; border-radius: 7px;
  display: grid; place-items: center;
  color: var(--tl-faint); background: transparent; cursor: pointer;
}
.period-nav button:hover { color: #dffaff; background: rgba(110, 231, 249, 0.1); }
.period-nav span { padding: 0 6px; color: var(--tl-muted); font-size: 12px; white-space: nowrap; }
.period-nav .go-today {
  width: auto; padding: 0 10px; margin-left: 2px;
  border: 1px solid rgba(110, 231, 249, 0.32); border-radius: 7px;
  color: var(--tl-accent); font-size: 11px;
}

/* ── 视图切换 & 操作按钮 ── */
.scale-switch {
  display: flex; padding: 3px;
  border: 1px solid var(--tl-line); border-radius: 9px;
  background: rgba(148, 163, 184, 0.05);
}
.scale-switch button,
.play,
.refresh { border: 0; color: var(--tl-faint); background: transparent; cursor: pointer; }
.scale-switch button { padding: 7px 12px; border-radius: 7px; font-size: 12px; }
.scale-switch button:hover { color: #dffaff; }
.scale-switch button.active { color: #dffaff; background: rgba(110, 231, 249, 0.12); }
.play {
  height: 34px; padding: 0 13px;
  border: 1px solid var(--tl-line); border-radius: 9px;
  background: rgba(148, 163, 184, 0.05);
  display: flex; align-items: center; gap: 7px; font-size: 12px;
}
.play:hover { color: #dffaff; border-color: rgba(110, 231, 249, 0.4); }
.play.active { color: var(--tl-accent); border-color: rgba(110, 231, 249, 0.4); }
.refresh {
  width: 34px; height: 34px;
  border: 1px solid var(--tl-line); border-radius: 9px;
  background: rgba(148, 163, 184, 0.05);
}
.refresh:hover { color: #dffaff; border-color: rgba(110, 231, 249, 0.4); }
.spinning svg { animation: spin 1s linear infinite; }
.fullscreen-button {
  height: 34px; padding: 0 12px;
  border: 1px solid var(--tl-line); border-radius: 9px;
  display: flex; align-items: center; gap: 7px;
  color: var(--tl-faint); background: rgba(148, 163, 184, 0.05);
  font-size: 12px; cursor: pointer;
}
.fullscreen-button:hover { color: #dffaff; border-color: rgba(110, 231, 249, 0.4); background: rgba(110, 231, 249, 0.07); }
.timeline-zoom {
  height: 34px; display: flex; align-items: center;
  border: 1px solid var(--tl-line); border-radius: 9px;
  background: rgba(148, 163, 184, 0.05); overflow: hidden;
}
.timeline-zoom button {
  height: 100%; min-width: 32px; padding: 0 8px; border: 0;
  display: grid; place-items: center; color: var(--tl-faint); background: transparent; cursor: pointer;
}
.timeline-zoom button:hover:not(:disabled) { color: #dffaff; background: rgba(110, 231, 249, 0.1); }
.timeline-zoom button:disabled { opacity: 0.35; cursor: default; }
.timeline-zoom .timeline-zoom-value { min-width: 48px; border-inline: 1px solid var(--tl-line); font-size: 11px; }

/* ── 概览统计 ── */
.overview {
  position: relative; z-index: 4; display: flex; align-items: center; gap: 11px;
  margin-top: 20px; color: var(--tl-muted); font-size: 12.5px;
}
.overview strong { color: #f4f8ff; font-size: 19px; font-weight: 650; letter-spacing: 0.01em; }
.overview i { width: 1px; height: 15px; background: var(--tl-line-strong); }

/* ── 类型筛选 ── */
.filters {
  position: relative; z-index: 4; display: flex; align-items: center; gap: 6px;
  margin-top: 13px; color: var(--tl-faint);
}
.filters button {
  padding: 6px 13px; border: 1px solid transparent; border-radius: 999px;
  color: var(--tl-faint); background: transparent; font-size: 12px; cursor: pointer;
}
.filters button:hover { color: var(--tl-muted); }
.filters button.active {
  border-color: rgba(110, 231, 249, 0.38);
  color: #dffaff; background: rgba(110, 231, 249, 0.08);
}

/* ── 时间长河主区域 ── */
.river {
  position: absolute; left: 3%; right: clamp(400px, 29vw, 470px); top: 205px; bottom: 104px;
}
.aurora {
  position: absolute; left: 37%; top: -10%; width: 26%; height: 120%;
  background: linear-gradient(90deg, transparent, rgba(84, 118, 214, 0.1), rgba(58, 196, 217, 0.07), transparent);
  filter: blur(18px); opacity: 0.65;
}
.river-line {
  position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; border-radius: 2px;
  background: linear-gradient(transparent, rgba(94, 164, 244, 0.5) 10%, rgba(110, 231, 249, 0.72) 80%, transparent);
  box-shadow: 0 0 12px rgba(96, 196, 240, 0.32);
}
.river-line > i {
  position: absolute; left: -2px; top: -10px; width: 5px; height: 13px; border-radius: 50%;
  background: #c4f1ff; box-shadow: 0 0 9px rgba(98, 220, 255, 0.75);
  animation: flow 6s var(--delay) linear infinite;
}

/* ── 事件节点 ── */
.event {
  position: relative; display: grid; align-items: center; outline: none;
  grid-template-columns: minmax(280px, 1fr) 96px minmax(280px, 1fr);
  height: 20%; cursor: pointer;
  transition: top 0.48s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.34s, transform 0.4s, filter 0.3s;
}
.event:focus-visible { border-radius: 16px; box-shadow: 0 0 0 2px rgba(110, 231, 249, 0.5); }

/* 文本区:按距离渐进披露,杜绝重叠 */
.copy { text-align: right; padding-right: 36px; min-width: 0; }
.copy span {
  display: block; max-width: 420px;
  color: var(--tl-muted);
  font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  opacity: 0.9;
}
.copy h2 {
  max-width: 420px; margin: 6px 0 5px;
  color: #dbe6f5; font-size: 15px; font-weight: 600; line-height: 1.4;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 1; line-clamp: 1;
  overflow: hidden; text-overflow: ellipsis;
}
.copy p {
  max-width: 420px; margin: 0;
  color: var(--tl-muted); font-size: 12.5px; line-height: 1.6;
  display: none;
  -webkit-box-orient: vertical; -webkit-line-clamp: 1; line-clamp: 1;
  overflow: hidden;
}
.event:nth-child(odd) .copy span,
.event:nth-child(odd) .copy h2,
.event:nth-child(odd) .copy p { margin-left: auto; }
.event:nth-child(even) .copy { grid-column: 3; text-align: left; padding: 0 0 0 36px; }
.event:nth-child(even) .node { grid-column: 2; grid-row: 1; }
.event:nth-child(even) time { grid-column: 1; grid-row: 1; text-align: right; padding: 0 30px 0 0; align-items: flex-end; }

/* 圆形节点 */
.node {
  grid-column: 2; justify-self: center; position: relative;
  width: 56px; height: 56px;
  border: 1px solid color-mix(in srgb, var(--tone) 62%, transparent);
  border-radius: 50%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: #f2f7ff;
  background: radial-gradient(circle at 32% 28%, rgba(27, 37, 61, 0.92), rgba(8, 12, 22, 0.96));
  cursor: pointer;
}
.node i {
  position: absolute; inset: 5px;
  border: 1px solid rgba(148, 163, 184, 0.12); border-radius: 50%;
}
.node b {
  position: absolute; inset: -8px;
  border: 1px solid color-mix(in srgb, var(--tone) 22%, transparent); border-radius: 50%;
  animation: orbit 9s linear infinite;
}
.node b::after {
  content: ""; position: absolute; left: 50%; top: -2px;
  width: 4px; height: 4px; border-radius: 50%;
  background: var(--tone); box-shadow: 0 0 8px var(--tone);
}
.node strong { font: 600 16px/1 ui-monospace, SFMono-Regular, Consolas, monospace; }
.node small { margin-top: 2px; font-size: 9px; color: var(--tl-faint); letter-spacing: 0.05em; }

/* 日期标签 */
.event time {
  display: flex; flex-direction: column; gap: 4px; padding-left: 30px;
  color: var(--tl-faint); font: 11px ui-monospace, SFMono-Regular, Consolas, monospace;
}
.event time b { color: var(--tl-accent); font-size: 9px; letter-spacing: 0.12em; opacity: 0.8; }

/* ── 距离衰减:近处展开,远处收敛 ── */
.distance-0 { opacity: 1; }
.distance-0 .copy h2 { font-size: 17px; -webkit-line-clamp: 2; line-clamp: 2; color: #fff; }
.distance-0 .copy p { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; }
.distance-1 { opacity: 0.78; transform: scale(0.97); }
.distance-1 .copy p { display: -webkit-box; }
.distance-2 { opacity: 0.5; transform: scale(0.93); filter: saturate(0.8); }
.distance-3 { opacity: 0.4; transform: scale(0.9); filter: saturate(0.75); }
.selected { transform: scale(1.03); }
.selected .node {
  border-color: var(--tone);
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--tone) 13%, transparent),
    0 0 26px color-mix(in srgb, var(--tone) 28%, transparent);
}

/* ── 里程碑标识 ── */
.node-milestone {
  position: absolute; top: -7px; right: -7px;
  width: 19px; height: 19px; border-radius: 50%;
  display: grid; place-items: center;
  color: #221805;
  background: linear-gradient(135deg, #f8d786, #e8a94e);
  border: 1px solid rgba(255, 244, 214, 0.5);
  box-shadow: 0 0 12px rgba(246, 200, 96, 0.45);
}
.event.milestone .node b { border-color: rgba(246, 200, 96, 0.32); }
.event.milestone .node b::after { background: #f6c860; box-shadow: 0 0 8px #f6c860; }
.overview-milestone { color: #f2cc7e; }
.detail-milestone {
  display: inline-flex; align-items: center; gap: 4px;
  flex: 0 0 auto; align-self: flex-start;
  margin-left: auto; padding: 3px 9px;
  border: 1px solid rgba(246, 200, 96, 0.4); border-radius: 999px;
  color: #f2cc7e; background: rgba(246, 200, 96, 0.08);
  font-size: 10px; font-style: normal; letter-spacing: 0.04em;
  white-space: nowrap;
}

/* ── 视图缩放变体 ── */
.scale-month .event { position: absolute; width: 100%; height: 20%; left: 0; }
.scale-month .event.distance-3 { pointer-events: auto; }
.scale-day .event { height: 100%; opacity: 1; }
.scale-day .copy h2 { font-size: 22px; -webkit-line-clamp: 3; line-clamp: 3; }
.scale-day .copy p { display: -webkit-box; font-size: 13.5px; -webkit-line-clamp: 3; line-clamp: 3; }

/* ── 年度热力图 ── */
.heatmap {
  position: absolute; left: 3%; right: clamp(400px, 29vw, 470px); top: 205px; bottom: 104px;
  display: flex; align-items: center; justify-content: center;
}
.heatmap-canvas {
  width: min(100%, 980px);
  padding: 20px 22px 14px;
  border: 1px solid var(--tl-line); border-radius: 16px;
  background: rgba(10, 15, 27, 0.55);
  backdrop-filter: blur(8px);
}
.heatmap-chart { width: 100%; height: 176px; }
.heatmap-foot { display: flex; align-items: center; justify-content: space-between; margin: 10px 4px 0 36px; }
.heatmap-legend { display: flex; align-items: center; gap: 4px; color: var(--tl-faint); font-size: 10px; }
.heatmap-legend i { width: 11px; height: 11px; border-radius: 3px; background: rgba(148, 163, 184, 0.08); }
.heatmap-legend i.level-1 { background: rgba(110, 231, 249, 0.2); }
.heatmap-legend i.level-2 { background: rgba(110, 231, 249, 0.38); }
.heatmap-legend i.level-3 { background: rgba(110, 231, 249, 0.6); }
.heatmap-legend i.level-4 { background: rgba(110, 231, 249, 0.88); }
.heatmap-legend i.milestone-demo { background: rgba(148, 163, 184, 0.12); box-shadow: 0 0 0 1.5px rgba(246, 200, 96, 0.75); margin-right: 3px; }
.heatmap-legend span { margin: 0 3px; }
.detail-collapsed .heatmap { right: 28px; }

/* ── 右侧详情面板 ── */
.detail {
  position: absolute; right: 24px; top: 205px; bottom: 72px;
  width: clamp(360px, 24vw, 440px); padding: 24px;
  border: 1px solid var(--tl-line);
  border-left: 2px solid color-mix(in srgb, var(--detail-tone, var(--tl-accent)) 75%, transparent);
  border-radius: 16px;
  background: linear-gradient(165deg, rgba(15, 22, 38, 0.94), rgba(7, 11, 21, 0.9));
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(20px);
  display: flex; flex-direction: column; max-height: none; overflow: hidden;
}
.detail > span {
  display: flex; align-items: center; gap: 8px;
  color: color-mix(in srgb, var(--detail-tone, var(--tl-accent)) 85%, #fff);
  font-size: 12px; flex: 0 0 auto;
}
.detail > h2 { margin: 14px 0; font-size: 20px; font-weight: 600; line-height: 1.4; flex: 0 0 auto; }
.detail > .tags,
.detail > .metrics,
.detail > button { flex: 0 0 auto; }

/* 详情滚动区 */
.detail-scroll {
  flex: 1; min-height: 0; overflow-y: auto; padding-right: 8px;
  scrollbar-width: thin; scrollbar-color: #4a5568 rgba(255, 255, 255, 0.05);
  overscroll-behavior: contain;
}
.detail-section { padding: 14px 0; border-top: 1px solid var(--tl-line); }
.detail-section:first-child { border-top: 0; padding-top: 0; }
.detail-section h3 { margin: 0 0 8px; color: #dbe6f5; font-size: 13.5px; font-weight: 600; }
.detail-section ul { margin: 0; padding-left: 18px; }
.detail-section li { margin: 0 0 7px; color: #9fadc2; font-size: 12.5px; line-height: 1.65; }
.detail .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 3px; }
.tags span {
  padding: 5px 9px; border: 1px solid var(--tl-line-strong); border-radius: 6px;
  color: var(--tl-muted); background: rgba(148, 163, 184, 0.06); font-size: 10.5px;
}

/* 详情指标 */
.metrics {
  display: grid; grid-template-columns: repeat(3, 1fr);
  margin: 14px 0; border-top: 1px solid var(--tl-line); padding-top: 14px;
}
.metrics small,
.metrics strong { display: block; text-align: center; }
.metrics small { color: var(--tl-faint); font-size: 11px; }
.metrics strong { margin-top: 5px; font-size: 20px; font-weight: 650; }

/* 详情按钮 & 空状态按钮 */
.detail > button,
.empty button {
  width: 100%; padding: 10px; border: 1px solid rgba(110, 231, 249, 0.28); border-radius: 9px;
  display: flex; justify-content: center; align-items: center; gap: 7px;
  color: #bfeef8; background: rgba(110, 231, 249, 0.07); font-size: 12px; cursor: pointer;
}
.detail > button:hover,
.empty button:hover { background: rgba(110, 231, 249, 0.14); }

/* ── 空状态 ── */
.empty {
  position: absolute; inset: 190px 25% 120px 6%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: var(--tl-muted);
}
.empty h2 { color: #dce8f5; }
.empty p { font-size: 13px; }
.empty button { width: auto; margin-top: 14px; }

/* ── 底部提示 ── */
.footer {
  position: absolute; left: 40px; right: clamp(400px, 29vw, 470px); bottom: 29px;
  display: flex; align-items: center; gap: 14px;
  color: var(--tl-faint); font: 10px ui-monospace, SFMono-Regular, Consolas, monospace;
}
.footer i { height: 1px; flex: 1; background: var(--tl-line); }
.footer small { margin-left: auto; }

/* ── 刷新今日按钮 ── */
.merge-button {
  position: absolute; right: 3%; bottom: 20px;
  padding: 9px 14px; border: 1px solid rgba(110, 231, 249, 0.3); border-radius: 9px;
  display: flex; align-items: center; gap: 7px;
  color: #a9e8f5; background: rgba(110, 231, 249, 0.08); font-size: 12px; cursor: pointer;
}
.merge-button:hover { background: rgba(110, 231, 249, 0.15); }
.merge-button:disabled { opacity: 0.5; cursor: default; }

/* ── 汇入动画 ── */
.merge { position: absolute; z-index: 8; inset: 0; display: grid; place-items: center; pointer-events: none; }
.merge span {
  position: absolute; padding: 6px 10px;
  border: 1px solid rgba(110, 231, 249, 0.3); border-radius: 15px;
  color: #cfeefb; background: #0b1626; animation: merge 2s forwards;
}
.merge span:nth-child(1) { --sx: -160px; --sy: -80px; }
.merge span:nth-child(2) { --sx: 170px; --sy: -30px; }
.merge span:nth-child(3) { --sx: -100px; --sy: 110px; }
.merge div {
  width: 72px; height: 72px; border: 1px solid var(--tl-accent); border-radius: 50%;
  display: grid; place-items: center; color: #8ceef9; background: #0c2334;
  box-shadow: 0 0 60px rgba(80, 222, 240, 0.5);
}
.merge strong { position: absolute; margin-top: 125px; }

/* ── 详情面板收起 ── */
.detail-toggle {
  width: 34px; height: 34px; border: 1px solid var(--tl-line); border-radius: 9px;
  display: grid; place-items: center;
  color: var(--tl-faint); background: rgba(148, 163, 184, 0.05); cursor: pointer;
}
.detail-toggle:hover { color: #dffaff; border-color: rgba(110, 231, 249, 0.4); background: rgba(110, 231, 249, 0.07); }
.detail-collapsed .river { right: 28px; }
.detail-collapsed .footer { right: 28px; }

/* ── 骨架屏加载态 ── */
.skeleton { display: flex; flex-direction: column; align-items: center; gap: 18px; padding-top: 40px; }
.skeleton .river-line { opacity: 0.3; }
.skeleton-event {
  display: grid; grid-template-columns: 1fr 96px 1fr; align-items: center;
  width: 100%; max-width: 700px;
}
.skeleton-copy { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; padding-right: 36px; }
.skeleton-event:nth-child(even) .skeleton-copy { align-items: flex-start; grid-column: 3; padding: 0 0 0 36px; }
.skeleton-event:nth-child(even) .skeleton-node { grid-column: 2; grid-row: 1; }
.skeleton-event:nth-child(even) .skeleton-date { grid-column: 1; grid-row: 1; text-align: right; padding-right: 36px; }
.skeleton-line {
  height: 12px; width: 180px; border-radius: 6px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04));
  background-size: 200% 100%;
  animation: shimmer 1.8s ease-in-out infinite;
}
.skeleton-line.short { width: 100px; }
.skeleton-line.medium { width: 140px; }
.skeleton-line.tiny { width: 60px; }
.skeleton-node {
  width: 56px; height: 56px; border-radius: 50%; justify-self: center;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.03));
  background-size: 200% 100%;
  animation: shimmer 1.8s ease-in-out infinite;
}
.skeleton-date { padding-left: 36px; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* ── 全屏适配 ── */
.timeline-view:fullscreen { width: 100vw; height: 100vh; }
.timeline-view:fullscreen .river { top: 170px; bottom: 92px; }
.timeline-view:fullscreen .detail { top: 178px; bottom: 76px; width: clamp(390px, 25vw, 460px); }
.timeline-view:fullscreen .river { right: 36%; }
.timeline-view:fullscreen .merge-button { bottom: 20px; }

/* ── 关键帧 ── */
@keyframes twinkle { 50% { opacity: 0.15; transform: scale(0.5); } }
@keyframes flow { from { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } to { transform: translateY(520px); opacity: 0; } }
@keyframes orbit { to { transform: rotate(360deg); } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes merge {
  0% { transform: translate(var(--sx), var(--sy)); opacity: 0; }
  20% { opacity: 1; }
  100% { transform: translate(0, 0) scale(0.2); opacity: 0; }
}

/* ── 响应式 ── */

/* 中等屏：缩小间距和详情面板 */
@media (max-width: 1440px) {
  .timeline-view { padding-left: 28px; padding-right: 28px; }
  .river { left: 2%; right: clamp(360px, 26vw, 420px); }
  .heatmap { left: 2%; right: clamp(360px, 26vw, 420px); }
  .detail { right: 18px; width: clamp(340px, 24vw, 400px); }
  .event { grid-template-columns: minmax(200px, 1fr) 84px minmax(200px, 1fr); }
  .copy span, .copy h2, .copy p { max-width: 320px; }
  .footer { right: clamp(360px, 26vw, 420px); }
}

/* 小屏：操作栏折行、文字进一步收窄 */
@media (max-width: 1280px) {
  header { flex-wrap: wrap; gap: 10px; }
  .actions { flex-wrap: wrap; gap: 6px; }
  h1 { font-size: 28px; }
  .river { left: 1%; right: 340px; }
  .heatmap { left: 1%; right: 340px; }
  .heatmap-canvas { padding: 14px 14px 10px; }
  .heatmap-chart { height: 156px; }
  .detail { right: 14px; width: 320px; }
  .event { grid-template-columns: minmax(160px, 1fr) 72px minmax(160px, 1fr); }
  .copy { padding-right: 22px; }
  .event:nth-child(even) .copy { padding-left: 22px; }
  .copy span { font-size: 10px; }
  .copy span, .copy h2, .copy p { max-width: 260px; }
  .copy h2 { font-size: 14px; }
  .distance-0 .copy h2 { font-size: 15px; -webkit-line-clamp: 1; line-clamp: 1; }
  .distance-0 .copy p { -webkit-line-clamp: 1; line-clamp: 1; }
  .node { width: 50px; height: 50px; }
  .node strong { font-size: 14px; }
  .node small { font-size: 8px; }
  .footer { right: 340px; }
  .overview { flex-wrap: wrap; font-size: 12px; }
  .overview strong { font-size: 16px; }
  .filters { flex-wrap: wrap; }
  .play span { display: none; }
  .fullscreen-button span { display: none; }
}

/* 窄屏：详情面板覆盖式抽屉、时间轴全宽 */
@media (max-width: 1024px) {
  .river { right: 28px; }
  .heatmap { right: 28px; }
  .detail {
    z-index: 12; right: 0; top: 0; bottom: 0; width: min(420px, 85vw);
    border-radius: 0;
    border-left: 2px solid color-mix(in srgb, var(--detail-tone, var(--tl-accent)) 75%, transparent);
    box-shadow: -12px 0 60px rgba(0, 0, 0, 0.7);
  }
  .event { grid-template-columns: minmax(140px, 1fr) 64px minmax(140px, 1fr); }
  .copy span, .copy h2, .copy p { max-width: 220px; }
  .copy h2 { font-size: 13px; }
  .copy p { display: none !important; }
  .footer { right: 28px; }
  .period-nav span { font-size: 11px; }
  .scale-switch button { padding: 6px 9px; font-size: 11px; }
}

@media (prefers-reduced-motion: reduce) {
  .stars i, .river-line > i, .node b, .merge span { animation: none !important; }
  .event { transition: none; }
}
</style>
