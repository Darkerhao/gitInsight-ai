<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Activity, Award, ChevronRight, Filter, GitCommitHorizontal, Maximize2, Minimize2, Pause, Play, RefreshCw, Sparkles, Zap } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import type { TimelineDayGroup, TimelineQuery, TimelineRecord, TimelineSnapshot, TimelineWorkType } from '@shared/types';

type TimelineScale = 'year' | 'month' | 'day';

const router = useRouter();
const timelineRoot = ref<HTMLElement | null>(null);
const snapshot = ref<TimelineSnapshot | null>(null);
const loading = ref(false);
const loadError = ref('');
const scale = ref<TimelineScale>('month');
const activeType = ref<TimelineWorkType | ''>('');
const selectedId = ref(0);
const isPlaying = ref(false);
const isMergingToday = ref(false);
const isFullscreen = ref(false);
let playbackTimer: number | undefined;

const typeOptions: Array<{ label: string; value: TimelineWorkType | '' }> = [
  { label: '全部', value: '' },
  { label: '功能开发', value: '功能开发' },
  { label: 'Bug 修复', value: 'Bug 修复' },
  { label: '重构优化', value: '重构优化' },
  { label: '性能优化', value: '性能优化' },
  { label: '工程优化', value: '工程优化' },
];

const records = computed(() => snapshot.value?.records ?? []);
const days = computed(() => snapshot.value?.days ?? []);
const selectedRecord = computed(() => records.value.find((item) => item.id === selectedId.value) ?? records.value.at(-1) ?? null);
const selectedDay = computed(() => days.value.find((item) => item.recordIds.includes(selectedId.value)) ?? days.value.at(-1) ?? null);
const selectedItems = computed(() => selectedDay.value?.records ?? (selectedRecord.value ? [selectedRecord.value] : []));
const timelineWindow = computed(() => {
  if (scale.value === 'year') return days.value;
  if (scale.value === 'day') return selectedDay.value ? [selectedDay.value] : [];
  const focusIndex = Math.max(0, days.value.findIndex((item) => item.date === selectedDay.value?.date));
  return days.value.slice(Math.max(0, focusIndex - 3), Math.min(days.value.length, focusIndex + 4));
});
const year = new Date().getFullYear();
const month = String(new Date().getMonth() + 1).padStart(2, '0');

function buildQuery(): TimelineQuery {
  const query: TimelineQuery = {};
  if (scale.value === 'year') {
    query.startDate = `${year}-01-01`;
    query.endDate = `${year}-12-31`;
  } else if (scale.value === 'month') {
    const lastDay = new Date(year, Number(month), 0).getDate();
    query.startDate = `${year}-${month}-01`;
    query.endDate = `${year}-${month}-${lastDay}`;
  } else if (selectedRecord.value) {
    query.startDate = selectedRecord.value.date;
    query.endDate = selectedRecord.value.date;
  }
  if (activeType.value) query.type = activeType.value;
  return query;
}

async function loadTimeline(keepSelection = true) {
  loading.value = true;
  loadError.value = '';
  const previousId = keepSelection ? selectedId.value : 0;
  try {
    if (typeof window.api.getTimelineSnapshot !== 'function') {
      throw new Error('时间长河接口尚未加载，请完全重启应用后重试');
    }
    snapshot.value = await window.api.getTimelineSnapshot(buildQuery());
    selectedId.value = records.value.some((item) => item.id === previousId) ? previousId : records.value.at(-1)?.id ?? 0;
  } catch (error) {
    snapshot.value = null;
    loadError.value = error instanceof Error ? error.message : '时间长河数据加载失败';
    ElMessage.error(loadError.value);
  } finally {
    loading.value = false;
  }
}

function representative(day: TimelineDayGroup) { return day.records.at(-1) as TimelineRecord; }
function selectDay(day: TimelineDayGroup) { selectedId.value = representative(day).id; }
function distance(day: TimelineDayGroup) {
  const focus = days.value.findIndex((entry) => entry.date === selectedDay.value?.date);
  return Math.min(3, Math.abs(days.value.findIndex((entry) => entry.date === day.date) - focus));
}
function eventPosition(day: TimelineDayGroup) {
  if (scale.value !== 'month') return undefined;
  const itemIndex = days.value.findIndex((entry) => entry.date === day.date);
  const focusIndex = days.value.findIndex((entry) => entry.date === selectedDay.value?.date);
  return { top: `${(3 + itemIndex - focusIndex) * (100 / 7)}%` };
}
function tone(type: TimelineWorkType) {
  return ({ '功能开发': '#67e6bd', 'Bug 修复': '#f0b86d', '重构优化': '#bd9aff', '性能优化': '#f1d36f', '工程优化': '#70dff4', '日常开发': '#8ea3bb' } as const)[type];
}
function formatDate(value: string) { return value.slice(5).replace('-', '.'); }
function extractAchievements(value: string) {
  const cleaned = value
    .replace(/#{1,6}\s*/g, '')
    .replace(/(?:今日工作内容|今日工作|工作成果|明日计划)\s*[：:]?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = cleaned
    .split(/(?=\d+[.、）)]\s*)|[；;]/)
    .map((item) => item.replace(/^\d+[.、）)]\s*/, '').trim())
    .filter((item) => item.length >= 6 && !item.startsWith('明日'));
  return parts.length ? parts : cleaned ? [cleaned] : [];
}
function compactSummary(item: TimelineRecord) {
  const text = extractAchievements(item.summary).slice(0, 2).join('；');
  return text.length > 96 ? `${text.slice(0, 96)}…` : text;
}
function displayTitle(item: TimelineRecord) {
  const generic = /^(今日工作内容|今日工作|工作成果)[：:]?$/.test(item.title.trim());
  if (!generic) return item.title;
  const achievement = extractAchievements(item.summary)[0] || `${item.primaryType}成果`;
  return achievement.length > 28 ? `${achievement.slice(0, 28)}…` : achievement;
}
function dayTitle(day: TimelineDayGroup) {
  if (day.itemCount === 1) return displayTitle(representative(day));
  const project = day.projects[0] || '工程工作';
  return `${project} · ${day.itemCount} 项工作沉淀`;
}
function daySummary(day: TimelineDayGroup) {
  return day.records.map((item) => displayTitle(item)).slice(0, 2).join('；');
}
function detailSections(item: TimelineRecord) {
  const achievements = extractAchievements(item.summary);
  return achievements.length ? achievements : [compactSummary(item)].filter(Boolean);
}
function openReport() {
  if (!selectedRecord.value) return;
  void router.push({ path: '/history', query: { id: selectedRecord.value.reportId } });
}
function handleWheel(event: WheelEvent) {
  if (!days.value.length) return;
  const current = Math.max(0, days.value.findIndex((item) => item.date === selectedDay.value?.date));
  const next = Math.max(0, Math.min(days.value.length - 1, current + (event.deltaY > 0 ? 1 : -1)));
  selectDay(days.value[next]);
}
function togglePlayback() {
  isPlaying.value = !isPlaying.value;
  window.clearInterval(playbackTimer);
  if (!isPlaying.value || !days.value.length) return;
  playbackTimer = window.setInterval(() => {
    const index = days.value.findIndex((item) => item.date === selectedDay.value?.date);
    selectDay(days.value[(index + 1) % days.value.length]);
  }, 1800);
}
function mergeToday() {
  isMergingToday.value = true;
  void loadTimeline(false).finally(() => window.setTimeout(() => { isMergingToday.value = false; }, 2200));
}

async function toggleFullscreen() {
  if (!timelineRoot.value) return;
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await timelineRoot.value.requestFullscreen();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '无法切换全屏模式');
  }
}

function syncFullscreenState() {
  isFullscreen.value = document.fullscreenElement === timelineRoot.value;
}

watch([scale, activeType], () => void loadTimeline(false));
onMounted(() => {
  document.addEventListener('fullscreenchange', syncFullscreenState);
  void loadTimeline(false);
});
onBeforeUnmount(() => {
  window.clearInterval(playbackTimer);
  document.removeEventListener('fullscreenchange', syncFullscreenState);
});
</script>

<template>
  <div ref="timelineRoot" class="timeline-view" :class="{ fullscreen: isFullscreen }" @wheel.prevent="handleWheel">
    <div class="stars"><i v-for="n in 38" :key="n" :style="{ '--x': `${(n * 37) % 100}%`, '--y': `${(n * 61) % 100}%`, '--delay': `${(n % 8) * -.7}s` }" /></div>
    <header>
      <div><span class="eyebrow"><Activity :size="15" /> DEVELOPMENT CHRONICLE · {{ year }}</span><h1>时间长河</h1><p>真实日报与 Git 提交，正在形成你的年度工程轨迹。</p></div>
      <div class="actions">
        <div class="scale-switch"><button v-for="item in [{k:'year',l:'年度'},{k:'month',l:'月度'},{k:'day',l:'单日'}]" :key="item.k" :class="{ active: scale === item.k }" @click="scale = item.k as TimelineScale">{{ item.l }}</button></div>
        <button class="play" :class="{ active: isPlaying }" @click="togglePlayback"><Pause v-if="isPlaying" :size="15" /><Play v-else :size="15" />{{ isPlaying ? '暂停' : '轨迹回放' }}</button>
        <button class="refresh" :class="{ spinning: loading }" @click="loadTimeline()"><RefreshCw :size="16" /></button>
        <button class="fullscreen-button" :title="isFullscreen ? '退出全屏' : '全屏查看'" @click="toggleFullscreen"><Minimize2 v-if="isFullscreen" :size="16" /><Maximize2 v-else :size="16" /><span>{{ isFullscreen ? '退出全屏' : '全屏' }}</span></button>
      </div>
    </header>

    <div class="overview" v-if="snapshot"><strong>{{ snapshot.summary.totalCommits }}</strong> 次提交 <i /> <strong>{{ snapshot.summary.activeDays }}</strong> 个活跃日 <i /> <strong>{{ snapshot.total }}</strong> 项工作 <i /> <strong>{{ snapshot.summary.projects.length }}</strong> 个活跃项目</div>
    <div class="filters"><Filter :size="14" /><button v-for="item in typeOptions" :key="item.label" :class="{ active: activeType === item.value }" @click="activeType = item.value">{{ item.label }}</button></div>

    <section v-if="records.length" class="river" :class="`scale-${scale}`">
      <div class="aurora" /><div class="river-line"><i v-for="n in 14" :key="n" :style="{ '--delay': `${n * -.38}s` }" /></div>
      <article v-for="day in timelineWindow" :key="day.date" class="event" :class="[`distance-${distance(day)}`, { selected: selectedDay?.date === day.date }]" :style="eventPosition(day)" tabindex="0" @click="selectDay(day)" @keydown.enter="selectDay(day)">
        <div class="copy"><span :style="{ color: tone(representative(day).primaryType) }">{{ day.workTypes.join(' / ') }} · {{ day.projects.join(' / ') || '未识别项目' }}</span><h2>{{ dayTitle(day) }}</h2><p>{{ daySummary(day) }}</p></div>
        <button class="node" :aria-label="`${day.date}，${day.itemCount} 项工作`" :style="{ '--tone': tone(representative(day).primaryType) }"><i /><b /><strong>{{ day.itemCount }}</strong><small>项工作</small></button>
        <time><b>{{ day.date === new Date().toISOString().slice(0, 10) ? 'TODAY' : day.date.slice(0, 4) }}</b>{{ formatDate(day.date) }}</time>
      </article>
      <div v-if="isMergingToday" class="merge"><span v-for="label in ['日报', '提交', '成果']" :key="label">{{ label }}</span><div><Sparkles :size="24" /></div><strong>真实数据正在汇入时间长河</strong></div>
    </section>

    <section v-else class="empty"><Sparkles :size="34" /><h2>{{ loading ? '正在读取工程轨迹' : loadError ? '时间长河加载失败' : '这一段时间还没有成长记录' }}</h2><p>{{ loadError || '保存一篇日报后，系统会自动分析项目、工作类型、技术标签和提交证据。' }}</p><button v-if="loadError" @click="loadTimeline(false)">重新加载 <RefreshCw :size="15" /></button><button v-else @click="router.push('/generate')">去生成第一篇日报 <ChevronRight :size="15" /></button></section>

    <aside v-if="selectedRecord && selectedDay" class="detail" :style="{ '--detail-tone': tone(selectedRecord.primaryType) }" @wheel.stop>
      <span><Award :size="17" /> {{ selectedDay.workTypes.join(' / ') }} · {{ selectedDay.date }}</span><h2>{{ dayTitle(selectedDay) }}</h2>
      <div class="detail-scroll">
        <section v-for="item in selectedItems" :key="item.id" class="detail-section"><h3>{{ displayTitle(item) }}</h3><ul><li v-for="content in detailSections(item)" :key="content">{{ content }}</li></ul></section>
        <section v-if="selectedDay.projects.length" class="detail-section"><h3>影响范围</h3><div class="tags"><span v-for="tag in [...selectedDay.projects, ...selectedItems.flatMap(item => item.techTags)]" :key="tag">{{ tag }}</span></div></section>
      </div>
      <div class="metrics"><div><small>提交次数</small><strong>{{ selectedDay.commitsCount }}</strong></div><div><small>变更文件</small><strong>{{ selectedDay.filesCount }}</strong></div><div><small>工作事项</small><strong>{{ selectedDay.itemCount }}</strong></div></div>
      <button @click="openReport">查看当日日报与提交证据 <ChevronRight :size="15" /></button>
    </aside>

    <div v-if="snapshot" class="footer"><GitCommitHorizontal :size="17" /><span>滚轮穿梭时间</span><i /><small>点击节点聚焦 · 回车键选择</small></div>
    <button class="merge-button" :disabled="loading || isMergingToday" @click="mergeToday"><Zap :size="16" />刷新今日轨迹</button>
  </div>
</template>

<style scoped>
.timeline-view{position:relative;min-height:calc(100vh - 72px);overflow:hidden;padding:32px 40px 96px;color:#eef5ff;background:radial-gradient(circle at 44% 44%,rgba(74,82,190,.2),transparent 31%),radial-gradient(circle at 70% 75%,rgba(33,173,193,.1),transparent 25%),linear-gradient(155deg,#070a13,#0a1020 58%,#070913)}*{box-sizing:border-box}.stars{position:absolute;inset:0;pointer-events:none}.stars i{position:absolute;left:var(--x);top:var(--y);width:2px;height:2px;border-radius:50%;background:#d9f7ff;box-shadow:0 0 8px #8fefff;animation:twinkle 4s var(--delay) infinite}header{position:relative;z-index:4;display:flex;justify-content:space-between}.eyebrow{display:flex;align-items:center;gap:8px;color:#75dce9;font-size:12px;letter-spacing:.18em}h1{margin:7px 0 4px;font-size:38px;letter-spacing:.06em}header p{margin:0;color:#9aa9bd;font-size:14px}.actions{display:flex;align-items:flex-start;gap:9px}.scale-switch{display:flex;padding:3px;border:1px solid #26304a;border-radius:10px;background:#0b1020}.scale-switch button,.play,.refresh{border:0;color:#77859b;background:transparent;cursor:pointer}.scale-switch button{padding:8px 12px;border-radius:7px;font-size:12px}.scale-switch button.active{color:#eef7ff;background:#24304a}.play{height:37px;padding:0 13px;border:1px solid #2d3854;border-radius:9px;display:flex;align-items:center;gap:7px;font-size:12px}.play.active{color:#72e7f4}.refresh{width:37px;height:37px;border:1px solid #2d3854;border-radius:9px}.spinning svg{animation:spin 1s linear infinite}.filters{position:relative;z-index:4;display:flex;align-items:center;gap:7px;margin-top:21px;color:#65748b}.filters button{padding:7px 12px;border:1px solid transparent;border-radius:16px;color:#76859b;background:transparent;font-size:12px;cursor:pointer}.filters button.active{border-color:#514978;color:#c7b7f3;background:rgba(93,70,155,.18)}.river{position:absolute;left:5%;right:33%;top:162px;bottom:104px}.aurora{position:absolute;left:37%;top:-10%;width:26%;height:120%;background:linear-gradient(90deg,transparent,rgba(104,83,201,.12),rgba(58,196,217,.09),transparent);filter:blur(16px)}.river-line{position:absolute;left:50%;top:0;bottom:0;width:3px;border-radius:50%;background:linear-gradient(transparent,#7457bb 8%,#59d8e8 78%,transparent);box-shadow:0 0 9px #7790e9,0 0 36px rgba(82,202,232,.36)}.river-line>i{position:absolute;left:-2px;top:-10px;width:7px;height:18px;border-radius:50%;background:#c4f9ff;box-shadow:0 0 14px #62e8ff;animation:flow 5.2s var(--delay) linear infinite}.event{position:relative;display:grid;grid-template-columns:1fr 80px 1fr;align-items:center;height:14.285%;cursor:pointer;transition:opacity .3s,transform .36s,filter .3s}.copy{text-align:right;padding-right:29px}.event:nth-child(even) .copy{grid-column:3;text-align:left;padding:0 0 0 29px}.event:nth-child(even) .node{grid-column:2;grid-row:1}.event:nth-child(even) time{grid-column:1;grid-row:1;text-align:right;padding:0 29px 0 0}.copy span{font-size:11px;font-weight:600;letter-spacing:.1em}.copy h2{margin:6px 0;font-size:17px}.copy p{display:inline-block;max-width:390px;margin:0;color:#91a0b4;font-size:12px;line-height:1.65}.event:nth-child(even) .copy p{display:block}.node{grid-column:2;justify-self:center;position:relative;width:56px;height:56px;border:1px solid var(--tone);border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#ddecff;background:radial-gradient(circle,#191b32,#0c1020);cursor:pointer}.node i{position:absolute;inset:9px;border:1px dashed color-mix(in srgb,var(--tone) 55%,transparent);border-radius:50%}.node b{position:absolute;inset:-8px;border:1px solid color-mix(in srgb,var(--tone) 28%,transparent);border-radius:50%;animation:orbit 7s linear infinite}.node b:after{content:"";position:absolute;left:50%;top:-3px;width:5px;height:5px;border-radius:50%;background:var(--tone);box-shadow:0 0 9px var(--tone)}.node strong{font:15px monospace}.node small{font-size:9px;color:#8996aa}.event time{display:flex;flex-direction:column;gap:4px;padding-left:29px;color:#8593a8;font:12px monospace}.event time b{color:#8173a9;font-size:9px}.distance-0{opacity:1;transform:scale(1.07)}.distance-1{opacity:.78;transform:scale(.94)}.distance-2{opacity:.48;transform:scale(.82);filter:saturate(.72)}.distance-3{opacity:.22;transform:scale(.7);filter:saturate(.4)}.distance-2 .copy p,.distance-3 .copy p{display:none}.selected .node{box-shadow:0 0 36px color-mix(in srgb,var(--tone) 48%,transparent)}.scale-year .event{height:min(10%,70px)}.scale-year .copy p{display:none}.scale-year .copy h2{font-size:12px;margin:2px}.scale-year .copy span{font-size:8px}.scale-year .node{transform:scale(.7)}.scale-day .event{height:100%;opacity:1;transform:scale(1.08)}.scale-day .copy h2{font-size:25px}.scale-day .copy p{font-size:14px}.detail{position:absolute;right:3%;top:170px;width:302px;padding:25px;border:1px solid rgba(113,90,177,.35);border-left:2px solid #795abd;border-radius:0 14px 14px 0;background:linear-gradient(135deg,rgba(25,22,49,.88),rgba(8,14,27,.76));box-shadow:0 24px 70px rgba(0,0,0,.32);backdrop-filter:blur(18px)}.detail>span{display:flex;align-items:center;gap:8px;color:#b8a0ee;font-size:11px}.detail h2{font-size:24px;line-height:1.45}.detail p{color:#9aa8bb;font-size:13px;line-height:1.8;max-height:150px;overflow:auto}.tags{display:flex;flex-wrap:wrap;gap:6px}.tags span{padding:6px 8px;border:1px solid #303553;border-radius:5px;color:#9b91bb;background:#17192e;font-size:10px}.metrics{display:grid;grid-template-columns:repeat(3,1fr);margin:20px 0;border-top:1px solid #292c45;padding-top:16px}.metrics small,.metrics strong{display:block;text-align:center}.metrics small{color:#6f7b90;font-size:10px}.metrics strong{margin-top:5px;font-size:18px}.detail>button,.empty button{width:100%;padding:10px;border:1px solid #444d78;border-radius:8px;display:flex;justify-content:center;align-items:center;gap:7px;color:#b8ade1;background:rgba(56,52,104,.3);font-size:11px;cursor:pointer}.empty{position:absolute;inset:190px 25% 120px 6%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#8391a8}.empty h2{color:#dce8f5}.empty p{font-size:13px}.empty button{width:auto;margin-top:14px}.footer{position:absolute;left:40px;right:40px;bottom:29px;display:flex;align-items:center;gap:14px;color:#718097;font:10px monospace}.footer i{height:1px;flex:1;background:#232c43}.footer small{margin-left:auto}.merge-button{position:absolute;right:3%;bottom:72px;padding:9px 13px;border:1px solid #5b4c8c;border-radius:9px;display:flex;align-items:center;gap:7px;color:#bca8ee;background:rgba(56,40,95,.38);font-size:11px;cursor:pointer}.merge{position:absolute;z-index:8;inset:0;display:grid;place-items:center;pointer-events:none}.merge span{position:absolute;padding:6px 10px;border:1px solid #625b96;border-radius:15px;background:#19182f;animation:merge 2s forwards}.merge span:nth-child(1){--sx:-160px;--sy:-80px}.merge span:nth-child(2){--sx:170px;--sy:-30px}.merge span:nth-child(3){--sx:-100px;--sy:110px}.merge div{width:72px;height:72px;border:1px solid #75ddea;border-radius:50%;display:grid;place-items:center;color:#8ceef9;background:#10263a;box-shadow:0 0 60px rgba(80,222,240,.55)}.merge strong{position:absolute;margin-top:125px}@keyframes twinkle{50%{opacity:.2;transform:scale(.5)}}@keyframes flow{from{transform:translateY(0);opacity:0}15%{opacity:1}to{transform:translateY(520px);opacity:0}}@keyframes orbit{to{transform:rotate(360deg)}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes merge{0%{transform:translate(var(--sx),var(--sy));opacity:0}20%{opacity:1}100%{transform:translate(0,0) scale(.2);opacity:0}}@media(max-width:1100px){.detail{width:250px}.river{right:30%}.actions{gap:4px}}
.timeline-view{width:100%;height:100%;min-height:0;padding:32px 40px 72px}.timeline-view.fullscreen{height:100vh;padding:38px 48px 76px}.fullscreen-button{height:37px;padding:0 12px;border:1px solid #2d3854;border-radius:9px;display:flex;align-items:center;gap:7px;color:#8e9db2;background:transparent;font-size:12px;cursor:pointer}.fullscreen-button:hover{color:#dff8ff;border-color:#4f8296;background:rgba(54,116,139,.16)}.detail p{scrollbar-width:none}.detail p::-webkit-scrollbar{display:none}.timeline-view:fullscreen{width:100vw;height:100vh}.timeline-view:fullscreen .river{top:170px;bottom:92px}.timeline-view:fullscreen .detail{top:178px}.timeline-view:fullscreen .merge-button{bottom:68px}
.scale-month .event{position:absolute;width:100%;height:14.285%;left:0}.detail{bottom:72px;display:flex;flex-direction:column;max-height:none;overflow:hidden}.detail>span,.detail>h2,.detail>.tags,.detail>.metrics,.detail>button{flex:0 0 auto}.detail>h2{margin:20px 0 12px}.detail p{flex:1 1 auto;min-height:100px;max-height:none;margin:0 0 14px;padding-right:10px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#66738d rgba(255,255,255,.06)}.detail p::-webkit-scrollbar{display:block;width:6px}.detail p::-webkit-scrollbar-track{border-radius:6px;background:rgba(255,255,255,.05)}.detail p::-webkit-scrollbar-thumb{border-radius:6px;background:#66738d}.merge-button{bottom:20px}.timeline-view:fullscreen .detail{bottom:76px}.timeline-view:fullscreen .merge-button{bottom:20px}.scale-month .event.distance-3{pointer-events:auto}
.copy{min-width:0}.copy h2{max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.event:nth-child(odd) .copy h2{margin-left:auto}.copy p{display:-webkit-box;max-width:360px;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2}.event:nth-child(odd) .copy p{margin-left:auto}.distance-1 .copy h2{font-size:15px}.distance-2 .copy h2,.distance-3 .copy h2{font-size:13px;opacity:.78}.scale-year .copy h2{max-width:280px}
.detail{width:clamp(360px,27vw,430px)}.river{right:38%}.timeline-view:fullscreen .detail{width:clamp(390px,25vw,460px)}.timeline-view:fullscreen .river{right:36%}@media(max-width:1200px){.detail{width:330px}.river{right:35%}}@media(max-width:980px){.detail{width:290px}.river{right:34%}}
.overview{position:relative;z-index:4;display:flex;align-items:center;gap:9px;margin-top:18px;color:#91a2b9;font-size:13px}.overview strong{color:#eef6ff;font-size:16px}.overview i{width:1px;height:14px;background:#34405a}.filters{margin-top:12px}.river{left:3%;right:clamp(400px,29vw,470px);top:205px}.aurora{opacity:.7}.river-line{box-shadow:0 0 7px #7790e9,0 0 22px rgba(82,202,232,.24)}.event{grid-template-columns:minmax(280px,1fr) 82px minmax(280px,1fr);outline:none}.event:focus-visible{border-radius:16px;box-shadow:0 0 0 2px rgba(125,229,244,.55)}.copy{padding-right:34px}.event:nth-child(even) .copy{padding-left:34px}.copy span{font-size:12px;letter-spacing:.06em}.copy h2{max-width:420px;margin:7px 0;font-size:17px;line-height:1.4;white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2}.copy p{max-width:420px;color:#aab7c9;font-size:13px;line-height:1.65}.distance-1{opacity:.82;transform:scale(.96)}.distance-2{opacity:.64;transform:scale(.9);filter:saturate(.82)}.distance-3{opacity:.58;transform:scale(.86);filter:saturate(.75)}.distance-2 .copy p,.distance-3 .copy p{display:-webkit-box}.distance-2 .copy h2,.distance-3 .copy h2{font-size:15px;opacity:1}.selected{transform:scale(1.1)}.selected .copy h2{color:#fff}.selected .node{box-shadow:0 0 22px color-mix(in srgb,var(--tone) 44%,transparent)}.node{width:62px;height:62px}.node strong{font-size:17px}.node small{margin-top:1px;font-size:9px}.detail{right:24px;top:205px;bottom:72px;width:clamp(360px,24vw,440px);padding:24px;border-left-color:var(--detail-tone);background:linear-gradient(145deg,rgba(25,22,49,.96),rgba(8,14,27,.91))}.detail>span{color:var(--detail-tone);font-size:12px}.detail>h2{margin:16px 0;font-size:22px}.detail-scroll{flex:1;min-height:0;overflow-y:auto;padding-right:8px;scrollbar-width:thin;scrollbar-color:#66738d rgba(255,255,255,.06)}.detail-section{padding:15px 0;border-top:1px solid rgba(117,130,158,.18)}.detail-section:first-child{border-top:0;padding-top:0}.detail-section h3{margin:0 0 9px;color:#eef5ff;font-size:14px}.detail-section ul{margin:0;padding-left:19px}.detail-section li{margin:0 0 7px;color:#aeb9ca;font-size:13px;line-height:1.65}.detail .tags{margin-top:3px}.metrics{margin:14px 0;padding-top:14px}.metrics small{font-size:11px}.footer{right:clamp(400px,29vw,470px)}@media(max-width:1280px){.timeline-view{padding-left:28px;padding-right:28px}.river{left:1%;right:370px}.detail{right:18px;width:340px}.event{grid-template-columns:minmax(220px,1fr) 76px minmax(220px,1fr)}.copy h2,.copy p{max-width:330px}.footer{right:370px}}@media(max-width:1024px){.river{right:28px}.detail{z-index:12;right:18px;width:min(420px,calc(100% - 36px));box-shadow:0 24px 80px rgba(0,0,0,.62)}.copy h2,.copy p{max-width:300px}.overview{font-size:12px}.footer{right:28px}}@media(prefers-reduced-motion:reduce){.stars i,.river-line>i,.node b,.merge span{animation:none!important}.event{transition:none}}
.detail-scroll{overscroll-behavior:contain}
</style>
