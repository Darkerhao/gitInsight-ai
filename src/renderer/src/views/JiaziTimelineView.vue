<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Activity, Award, ChevronLeft, ChevronRight, Filter, GitCommitHorizontal, Maximize2, Minimize2, PanelRightClose, PanelRightOpen, Pause, Play, RefreshCw, Sparkles, Zap } from 'lucide-vue-next';
import { useTimeline, typeOptions } from '@/composables/useTimeline';
import { usePlayback } from '@/composables/usePlayback';
import { useFullscreen } from '@/composables/useFullscreen';
import { tone, formatDate, dayTitle, daySummary, displayTitle, detailSections } from '@/utils/timelineText';
import type { TimelineScale } from '@/composables/useTimeline';

const router = useRouter();
const timelineRoot = ref<HTMLElement | null>(null);

const {
  snapshot, loading, loadError, scale, activeType,
  viewLabel, isCurrentPeriod, navigatePeriod, goToToday,
  records, days, selectedRecord, selectedDay, selectedDayIndex, selectedItems, timelineWindow,
  forceReload, representative, selectDay, distance, eventPosition, handleWheel,
} = useTimeline();

const { isPlaying, togglePlayback } = usePlayback(days, selectedDayIndex, selectDay);
const { isFullscreen, toggleFullscreen } = useFullscreen(timelineRoot);

const detailCollapsed = ref(false);
const isMergingToday = ref(false);

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
        <button class="fullscreen-button" :title="isFullscreen ? '退出全屏' : '全屏查看'" @click="toggleFullscreen"><Minimize2 v-if="isFullscreen" :size="16" /><Maximize2 v-else :size="16" /><span>{{ isFullscreen ? '退出全屏' : '全屏' }}</span></button>
      </div>
    </header>

    <div class="overview" v-if="snapshot"><strong>{{ snapshot.summary.totalCommits }}</strong> 次提交 <i /> <strong>{{ snapshot.summary.activeDays }}</strong> 个活跃日 <i /> <strong>{{ snapshot.total }}</strong> 项工作 <i /> <strong>{{ snapshot.summary.projects.length }}</strong> 个活跃项目</div>
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

    <section v-else-if="records.length" class="river" :class="`scale-${scale}`">
      <div class="aurora" /><div class="river-line"><i v-for="n in 14" :key="n" :style="{ '--delay': `${n * -.38}s` }" /></div>
      <article v-for="day in timelineWindow" :key="day.date" class="event" :class="[`distance-${distance(day)}`, { selected: selectedDay?.date === day.date }]" :style="eventPosition(day)" tabindex="0" @click="selectDay(day)" @keydown.enter="selectDay(day)">
        <div class="copy"><span :style="{ color: tone(representative(day).primaryType) }">{{ day.workTypes.join(' / ') }} · {{ day.projects.join(' / ') || '未识别项目' }}</span><h2>{{ dayTitle(day) }}</h2><p>{{ daySummary(day) }}</p></div>
        <button class="node" :aria-label="`${day.date}，${day.itemCount} 项工作`" :style="{ '--tone': tone(representative(day).primaryType) }"><i /><b /><strong>{{ day.itemCount }}</strong><small>项工作</small></button>
        <time><b>{{ day.date === new Date().toISOString().slice(0, 10) ? 'TODAY' : day.date.slice(0, 4) }}</b>{{ formatDate(day.date) }}</time>
      </article>
      <div v-if="isMergingToday" class="merge"><span v-for="label in ['日报', '提交', '成果']" :key="label">{{ label }}</span><div><Sparkles :size="24" /></div><strong>真实数据正在汇入时间长河</strong></div>
    </section>

    <section v-else class="empty"><Sparkles :size="34" /><h2>{{ loadError ? '时间长河加载失败' : '这一段时间还没有成长记录' }}</h2><p>{{ loadError || '保存一篇日报后，系统会自动分析项目、工作类型、技术标签和提交证据。' }}</p><button v-if="loadError" @click="forceReload(false)">重新加载 <RefreshCw :size="15" /></button><button v-else @click="router.push('/generate')">去生成第一篇日报 <ChevronRight :size="15" /></button></section>

    <aside v-if="selectedRecord && selectedDay && !detailCollapsed" class="detail" :style="{ '--detail-tone': tone(selectedRecord.primaryType) }" @wheel.stop>
      <span><Award :size="17" /> {{ selectedDay.workTypes.join(' / ') }} · {{ selectedDay.date }}</span><h2>{{ dayTitle(selectedDay) }}</h2>
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

<style scoped>
/* ── 基础布局 ── */
.timeline-view {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: 32px 40px 72px;
  color: #eef5ff;
  background:
    radial-gradient(circle at 44% 44%, rgba(74, 82, 190, .2), transparent 31%),
    radial-gradient(circle at 70% 75%, rgba(33, 173, 193, .1), transparent 25%),
    linear-gradient(155deg, #070a13, #0a1020 58%, #070913);
}
.timeline-view.fullscreen { height: 100vh; padding: 38px 48px 76px; }
* { box-sizing: border-box; }

/* ── 星空背景 ── */
.stars { position: absolute; inset: 0; pointer-events: none; }
.stars i {
  position: absolute; left: var(--x); top: var(--y);
  width: 2px; height: 2px; border-radius: 50%;
  background: #d9f7ff; box-shadow: 0 0 8px #8fefff;
  animation: twinkle 4s var(--delay) infinite;
}

/* ── 页头 ── */
header { position: relative; z-index: 4; display: flex; justify-content: space-between; }
.eyebrow { display: flex; align-items: center; gap: 8px; color: #75dce9; font-size: 12px; letter-spacing: .18em; }
h1 { margin: 7px 0 4px; font-size: 38px; letter-spacing: .06em; }
header p { margin: 0; color: #9aa9bd; font-size: 14px; }
.actions { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }

/* ── 月份/年份导航 ── */
.period-nav {
  display: flex; align-items: center; gap: 4px;
  padding: 3px; border: 1px solid #26304a; border-radius: 10px; background: #0b1020;
}
.period-nav button {
  width: 30px; height: 30px; border: 0; border-radius: 7px;
  display: grid; place-items: center;
  color: #77859b; background: transparent; cursor: pointer;
}
.period-nav button:hover { color: #dff8ff; background: rgba(54, 116, 139, .16); }
.period-nav span { padding: 0 6px; color: #b4c6da; font-size: 12px; white-space: nowrap; }
.period-nav .go-today {
  width: auto; padding: 0 10px; margin-left: 2px;
  border: 1px solid #3d4a6a; border-radius: 7px;
  color: #72e7f4; font-size: 11px;
}

/* ── 视图切换 & 操作按钮 ── */
.scale-switch { display: flex; padding: 3px; border: 1px solid #26304a; border-radius: 10px; background: #0b1020; }
.scale-switch button,
.play,
.refresh { border: 0; color: #77859b; background: transparent; cursor: pointer; }
.scale-switch button { padding: 8px 12px; border-radius: 7px; font-size: 12px; }
.scale-switch button.active { color: #eef7ff; background: #24304a; }
.play {
  height: 37px; padding: 0 13px; border: 1px solid #2d3854; border-radius: 9px;
  display: flex; align-items: center; gap: 7px; font-size: 12px;
}
.play.active { color: #72e7f4; }
.refresh { width: 37px; height: 37px; border: 1px solid #2d3854; border-radius: 9px; }
.spinning svg { animation: spin 1s linear infinite; }
.fullscreen-button {
  height: 37px; padding: 0 12px; border: 1px solid #2d3854; border-radius: 9px;
  display: flex; align-items: center; gap: 7px;
  color: #8e9db2; background: transparent; font-size: 12px; cursor: pointer;
}
.fullscreen-button:hover { color: #dff8ff; border-color: #4f8296; background: rgba(54, 116, 139, .16); }

/* ── 概览统计 ── */
.overview {
  position: relative; z-index: 4; display: flex; align-items: center; gap: 9px;
  margin-top: 18px; color: #91a2b9; font-size: 13px;
}
.overview strong { color: #eef6ff; font-size: 16px; }
.overview i { width: 1px; height: 14px; background: #34405a; }

/* ── 类型筛选 ── */
.filters {
  position: relative; z-index: 4; display: flex; align-items: center; gap: 7px;
  margin-top: 12px; color: #65748b;
}
.filters button {
  padding: 7px 12px; border: 1px solid transparent; border-radius: 16px;
  color: #76859b; background: transparent; font-size: 12px; cursor: pointer;
}
.filters button.active { border-color: #514978; color: #c7b7f3; background: rgba(93, 70, 155, .18); }

/* ── 时间长河主区域 ── */
.river {
  position: absolute; left: 3%; right: clamp(400px, 29vw, 470px); top: 205px; bottom: 104px;
}
.aurora {
  position: absolute; left: 37%; top: -10%; width: 26%; height: 120%;
  background: linear-gradient(90deg, transparent, rgba(104, 83, 201, .12), rgba(58, 196, 217, .09), transparent);
  filter: blur(16px); opacity: .7;
}
.river-line {
  position: absolute; left: 50%; top: 0; bottom: 0; width: 3px; border-radius: 50%;
  background: linear-gradient(transparent, #7457bb 8%, #59d8e8 78%, transparent);
  box-shadow: 0 0 7px #7790e9, 0 0 22px rgba(82, 202, 232, .24);
}
.river-line > i {
  position: absolute; left: -2px; top: -10px; width: 7px; height: 18px; border-radius: 50%;
  background: #c4f9ff; box-shadow: 0 0 14px #62e8ff;
  animation: flow 5.2s var(--delay) linear infinite;
}

/* ── 事件节点 ── */
.event {
  position: relative; display: grid; align-items: center; outline: none;
  grid-template-columns: minmax(280px, 1fr) 82px minmax(280px, 1fr);
  height: 14.285%; cursor: pointer;
  transition: opacity .3s, transform .36s, filter .3s;
}
.event:focus-visible { border-radius: 16px; box-shadow: 0 0 0 2px rgba(125, 229, 244, .55); }

/* 文本区 */
.copy { text-align: right; padding-right: 34px; min-width: 0; }
.copy span { font-size: 12px; font-weight: 600; letter-spacing: .06em; }
.copy h2 {
  max-width: 420px; margin: 7px 0; font-size: 17px; line-height: 1.4;
  white-space: normal; display: -webkit-box;
  -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2;
  overflow: hidden; text-overflow: ellipsis;
}
.copy p {
  max-width: 420px; margin: 0; color: #aab7c9; font-size: 13px; line-height: 1.65;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2;
  overflow: hidden;
}
.event:nth-child(odd) .copy h2,
.event:nth-child(odd) .copy p { margin-left: auto; }
.event:nth-child(even) .copy { grid-column: 3; text-align: left; padding: 0 0 0 34px; }
.event:nth-child(even) .node { grid-column: 2; grid-row: 1; }
.event:nth-child(even) time { grid-column: 1; grid-row: 1; text-align: right; padding: 0 29px 0 0; }

/* 圆形节点 */
.node {
  grid-column: 2; justify-self: center; position: relative;
  width: 62px; height: 62px;
  border: 1px solid var(--tone); border-radius: 50%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: #ddecff; background: radial-gradient(circle, #191b32, #0c1020); cursor: pointer;
}
.node i { position: absolute; inset: 9px; border: 1px dashed color-mix(in srgb, var(--tone) 55%, transparent); border-radius: 50%; }
.node b {
  position: absolute; inset: -8px;
  border: 1px solid color-mix(in srgb, var(--tone) 28%, transparent); border-radius: 50%;
  animation: orbit 7s linear infinite;
}
.node b::after {
  content: ""; position: absolute; left: 50%; top: -3px;
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--tone); box-shadow: 0 0 9px var(--tone);
}
.node strong { font: 17px monospace; }
.node small { margin-top: 1px; font-size: 9px; color: #8996aa; }

/* 日期标签 */
.event time { display: flex; flex-direction: column; gap: 4px; padding-left: 29px; color: #8593a8; font: 12px monospace; }
.event time b { color: #8173a9; font-size: 9px; }

/* ── 距离衰减 ── */
.distance-0 { opacity: 1; transform: scale(1.07); }
.distance-1 { opacity: .82; transform: scale(.96); }
.distance-1 .copy h2 { font-size: 15px; }
.distance-2 { opacity: .64; transform: scale(.9); filter: saturate(.82); }
.distance-2 .copy p,
.distance-3 .copy p { display: -webkit-box; }
.distance-2 .copy h2,
.distance-3 .copy h2 { font-size: 15px; opacity: 1; }
.distance-3 { opacity: .58; transform: scale(.86); filter: saturate(.75); }
.selected { transform: scale(1.1); }
.selected .copy h2 { color: #fff; }
.selected .node { box-shadow: 0 0 22px color-mix(in srgb, var(--tone) 44%, transparent); }

/* ── 视图缩放变体 ── */
.scale-month .event { position: absolute; width: 100%; height: 14.285%; left: 0; }
.scale-month .event.distance-3 { pointer-events: auto; }
.scale-year .event { height: min(10%, 70px); }
.scale-year .copy p { display: none; }
.scale-year .copy h2 { max-width: 280px; font-size: 12px; margin: 2px; }
.scale-year .copy span { font-size: 8px; }
.scale-year .node { transform: scale(.7); }
.scale-day .event { height: 100%; opacity: 1; transform: scale(1.08); }
.scale-day .copy h2 { font-size: 25px; }
.scale-day .copy p { font-size: 14px; }

/* ── 右侧详情面板 ── */
.detail {
  position: absolute; right: 24px; top: 205px; bottom: 72px;
  width: clamp(360px, 24vw, 440px); padding: 24px;
  border: 1px solid rgba(113, 90, 177, .35);
  border-left: 2px solid var(--detail-tone, #795abd);
  border-radius: 0 14px 14px 0;
  background: linear-gradient(145deg, rgba(25, 22, 49, .96), rgba(8, 14, 27, .91));
  box-shadow: 0 24px 70px rgba(0, 0, 0, .32); backdrop-filter: blur(18px);
  display: flex; flex-direction: column; max-height: none; overflow: hidden;
}
.detail > span { display: flex; align-items: center; gap: 8px; color: var(--detail-tone, #b8a0ee); font-size: 12px; flex: 0 0 auto; }
.detail > h2 { margin: 16px 0; font-size: 22px; flex: 0 0 auto; }
.detail > .tags,
.detail > .metrics,
.detail > button { flex: 0 0 auto; }

/* 详情滚动区 */
.detail-scroll {
  flex: 1; min-height: 0; overflow-y: auto; padding-right: 8px;
  scrollbar-width: thin; scrollbar-color: #66738d rgba(255, 255, 255, .06);
  overscroll-behavior: contain;
}
.detail-section { padding: 15px 0; border-top: 1px solid rgba(117, 130, 158, .18); }
.detail-section:first-child { border-top: 0; padding-top: 0; }
.detail-section h3 { margin: 0 0 9px; color: #eef5ff; font-size: 14px; }
.detail-section ul { margin: 0; padding-left: 19px; }
.detail-section li { margin: 0 0 7px; color: #aeb9ca; font-size: 13px; line-height: 1.65; }
.detail .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 3px; }
.tags span {
  padding: 6px 8px; border: 1px solid #303553; border-radius: 5px;
  color: #9b91bb; background: #17192e; font-size: 10px;
}

/* 详情指标 */
.metrics {
  display: grid; grid-template-columns: repeat(3, 1fr);
  margin: 14px 0; border-top: 1px solid #292c45; padding-top: 14px;
}
.metrics small,
.metrics strong { display: block; text-align: center; }
.metrics small { color: #6f7b90; font-size: 11px; }
.metrics strong { margin-top: 5px; font-size: 18px; }

/* 详情按钮 & 空状态按钮 */
.detail > button,
.empty button {
  width: 100%; padding: 10px; border: 1px solid #444d78; border-radius: 8px;
  display: flex; justify-content: center; align-items: center; gap: 7px;
  color: #b8ade1; background: rgba(56, 52, 104, .3); font-size: 11px; cursor: pointer;
}

/* ── 空状态 ── */
.empty {
  position: absolute; inset: 190px 25% 120px 6%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: #8391a8;
}
.empty h2 { color: #dce8f5; }
.empty p { font-size: 13px; }
.empty button { width: auto; margin-top: 14px; }

/* ── 底部提示 ── */
.footer {
  position: absolute; left: 40px; right: clamp(400px, 29vw, 470px); bottom: 29px;
  display: flex; align-items: center; gap: 14px; color: #718097; font: 10px monospace;
}
.footer i { height: 1px; flex: 1; background: #232c43; }
.footer small { margin-left: auto; }

/* ── 刷新今日按钮 ── */
.merge-button {
  position: absolute; right: 3%; bottom: 20px;
  padding: 9px 13px; border: 1px solid #5b4c8c; border-radius: 9px;
  display: flex; align-items: center; gap: 7px;
  color: #bca8ee; background: rgba(56, 40, 95, .38); font-size: 11px; cursor: pointer;
}

/* ── 汇入动画 ── */
.merge { position: absolute; z-index: 8; inset: 0; display: grid; place-items: center; pointer-events: none; }
.merge span {
  position: absolute; padding: 6px 10px; border: 1px solid #625b96; border-radius: 15px;
  background: #19182f; animation: merge 2s forwards;
}
.merge span:nth-child(1) { --sx: -160px; --sy: -80px; }
.merge span:nth-child(2) { --sx: 170px; --sy: -30px; }
.merge span:nth-child(3) { --sx: -100px; --sy: 110px; }
.merge div {
  width: 72px; height: 72px; border: 1px solid #75ddea; border-radius: 50%;
  display: grid; place-items: center; color: #8ceef9; background: #10263a;
  box-shadow: 0 0 60px rgba(80, 222, 240, .55);
}
.merge strong { position: absolute; margin-top: 125px; }

/* ── 详情面板收起 ── */
.detail-toggle {
  width: 37px; height: 37px; border: 1px solid #2d3854; border-radius: 9px;
  display: grid; place-items: center;
  color: #77859b; background: transparent; cursor: pointer;
}
.detail-toggle:hover { color: #dff8ff; border-color: #4f8296; background: rgba(54, 116, 139, .16); }
.detail-collapsed .river { right: 28px; }
.detail-collapsed .footer { right: 28px; }

/* ── 骨架屏加载态 ── */
.skeleton { display: flex; flex-direction: column; align-items: center; gap: 18px; padding-top: 40px; }
.skeleton .river-line { opacity: .3; }
.skeleton-event {
  display: grid; grid-template-columns: 1fr 82px 1fr; align-items: center;
  width: 100%; max-width: 700px;
}
.skeleton-copy { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; padding-right: 34px; }
.skeleton-event:nth-child(even) .skeleton-copy { align-items: flex-start; grid-column: 3; padding: 0 0 0 34px; }
.skeleton-event:nth-child(even) .skeleton-node { grid-column: 2; grid-row: 1; }
.skeleton-event:nth-child(even) .skeleton-date { grid-column: 1; grid-row: 1; text-align: right; padding-right: 34px; }
.skeleton-line {
  height: 12px; width: 180px; border-radius: 6px;
  background: linear-gradient(90deg, rgba(255, 255, 255, .04), rgba(255, 255, 255, .08), rgba(255, 255, 255, .04));
  background-size: 200% 100%;
  animation: shimmer 1.8s ease-in-out infinite;
}
.skeleton-line.short { width: 100px; }
.skeleton-line.medium { width: 140px; }
.skeleton-line.tiny { width: 60px; }
.skeleton-node {
  width: 56px; height: 56px; border-radius: 50%; justify-self: center;
  border: 1px solid rgba(255, 255, 255, .08);
  background: linear-gradient(90deg, rgba(255, 255, 255, .03), rgba(255, 255, 255, .07), rgba(255, 255, 255, .03));
  background-size: 200% 100%;
  animation: shimmer 1.8s ease-in-out infinite;
}
.skeleton-date { padding-left: 34px; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* ── 全屏适配 ── */
.timeline-view:fullscreen { width: 100vw; height: 100vh; }
.timeline-view:fullscreen .river { top: 170px; bottom: 92px; }
.timeline-view:fullscreen .detail { top: 178px; bottom: 76px; width: clamp(390px, 25vw, 460px); }
.timeline-view:fullscreen .river { right: 36%; }
.timeline-view:fullscreen .merge-button { bottom: 20px; }

/* ── 关键帧 ── */
@keyframes twinkle { 50% { opacity: .2; transform: scale(.5); } }
@keyframes flow { from { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } to { transform: translateY(520px); opacity: 0; } }
@keyframes orbit { to { transform: rotate(360deg); } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes merge {
  0% { transform: translate(var(--sx), var(--sy)); opacity: 0; }
  20% { opacity: 1; }
  100% { transform: translate(0, 0) scale(.2); opacity: 0; }
}

/* ── 响应式 ── */

/* 中等屏：缩小间距和详情面板 */
@media (max-width: 1440px) {
  .timeline-view { padding-left: 28px; padding-right: 28px; }
  .river { left: 2%; right: clamp(360px, 26vw, 420px); }
  .detail { right: 18px; width: clamp(340px, 24vw, 400px); }
  .event { grid-template-columns: minmax(200px, 1fr) 76px minmax(200px, 1fr); }
  .copy h2, .copy p { max-width: 320px; }
  .footer { right: clamp(360px, 26vw, 420px); }
}

/* 小屏：操作栏折行、文字进一步收窄 */
@media (max-width: 1280px) {
  header { flex-wrap: wrap; gap: 10px; }
  .actions { flex-wrap: wrap; gap: 6px; }
  h1 { font-size: 30px; }
  .river { left: 1%; right: 340px; }
  .detail { right: 14px; width: 320px; }
  .event { grid-template-columns: minmax(160px, 1fr) 70px minmax(160px, 1fr); }
  .copy { padding-right: 20px; }
  .event:nth-child(even) .copy { padding-left: 20px; }
  .copy span { font-size: 10px; }
  .copy h2 { max-width: 260px; font-size: 14px; -webkit-line-clamp: 1; line-clamp: 1; }
  .copy p { max-width: 260px; font-size: 12px; -webkit-line-clamp: 1; line-clamp: 1; }
  .node { width: 52px; height: 52px; }
  .node strong { font-size: 14px; }
  .node small { font-size: 8px; }
  .footer { right: 340px; }
  .overview { flex-wrap: wrap; font-size: 12px; }
  .filters { flex-wrap: wrap; }
  .play span { display: none; }
  .fullscreen-button span { display: none; }
}

/* 窄屏：详情面板覆盖式抽屉、时间轴全宽、左右交替改单侧 */
@media (max-width: 1024px) {
  .river { right: 28px; }
  .detail {
    z-index: 12; right: 0; top: 0; bottom: 0; width: min(420px, 85vw);
    border-radius: 0; border-left: 2px solid var(--detail-tone, #795abd);
    box-shadow: -12px 0 60px rgba(0, 0, 0, .7);
  }
  .event { grid-template-columns: minmax(140px, 1fr) 64px minmax(140px, 1fr); }
  .copy h2 { max-width: 220px; font-size: 13px; }
  .copy p { max-width: 220px; display: none; }
  .footer { right: 28px; }
  .period-nav span { font-size: 11px; }
  .scale-switch button { padding: 6px 9px; font-size: 11px; }
}

@media (prefers-reduced-motion: reduce) {
  .stars i, .river-line > i, .node b, .merge span { animation: none !important; }
  .event { transition: none; }
}
</style>
