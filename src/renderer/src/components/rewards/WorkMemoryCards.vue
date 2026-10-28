<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElSkeleton } from 'element-plus';
import { COIN_SHOP_ITEMS } from '@shared/coinWorkshop';
import type { CoinShopItem } from '@shared/coinWorkshop';
import type { TimelineRecord } from '@shared/types';
import { formatLocalDate } from '@shared/localDate';
import { buildWorkMemoryCard, renderWorkMemoryCard } from '@shared/workMemoryCard';

const props = defineProps<{ ownedItemIds: readonly string[]; balance: number; pending: string }>();
const emit = defineEmits<{ purchase: [item: CoinShopItem] }>();
const cards = COIN_SHOP_ITEMS.filter(item => item.kind === 'card');
const selectedId = ref('card-paper');
const today = formatLocalDate();
const startDate = ref(`${today.slice(0, 4)}-01-01`);
const endDate = ref(today);
const project = ref('');
const records = ref<TimelineRecord[]>([]);
const loading = ref(false);
const error = ref('');
const projects = computed(() => [...new Set(records.value.flatMap(record => record.projects))].sort());
const invalidRange = computed(() => !startDate.value || !endDate.value || startDate.value > endDate.value);
const data = computed(() => buildWorkMemoryCard(records.value, { startDate: startDate.value, endDate: endDate.value, project: project.value }));
const ready = computed(() => !loading.value && !error.value && !invalidRange.value && data.value.reports > 0);
const svg = computed(() => ready.value ? renderWorkMemoryCard(data.value, selectedId.value) : '');
const previews = computed(() => Object.fromEntries(cards.map(item => [item.id, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderWorkMemoryCard(data.value, item.id))}`])));
const selectedCard = computed(() => cards.find(item => item.id === selectedId.value)!);
const unlocked = computed(() => props.ownedItemIds.includes(selectedId.value));

async function load() {
  loading.value = true;
  error.value = '';
  try { records.value = (await window.api.getTimelineSnapshot()).records; }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '纪念卡数据读取失败'; }
  finally { loading.value = false; }
}

function exportCard() {
  if (!ready.value || !unlocked.value) return;
  const url = URL.createObjectURL(new Blob([svg.value], { type: 'image/svg+xml;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `工作纪念卡-${startDate.value}-${endDate.value}-${selectedId.value}.svg`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  ElMessage.success('已发起 SVG 下载');
}
onMounted(load);
</script>

<template>
  <section class="memory-cards">
    <div class="memory-heading"><div><span class="memory-eyebrow">THE WORK COLLECTION / 工作收藏集</span><h2>为这一程，留一张纪念。</h2><p>用真实的工作足迹，制作一张属于你的收藏卡。</p></div><span class="memory-permanent">一次解锁 · 永久珍藏</span></div>
    <div class="memory-products">
      <article v-for="(item, index) in cards" :key="item.id" class="surface-card memory-product" :data-product="item.id" :class="{ selected: selectedId === item.id }">
        <button class="memory-select" :aria-pressed="selectedId === item.id" :aria-label="`预览${item.name}`" @click="selectedId = item.id">
          <span class="memory-thumb" :class="item.id"><img :src="previews[item.id]" :alt="`${item.name}卡面`" /><span class="memory-selected">{{ selectedId === item.id ? '正在预览' : '查看卡面' }}</span></span>
          <span class="memory-product-name"><span class="memory-number">0{{ index + 1 }}</span><strong>{{ item.name }}</strong><span v-if="ownedItemIds.includes(item.id)" class="memory-owned">已收藏</span></span>
        </button>
        <p>{{ item.description }}</p>
        <div class="memory-purchase"><span class="memory-price"><strong>{{ item.price / 10000 }}<small>万码币</small></strong><span>永久解锁 · 无限次导出</span></span><el-button type="primary" :plain="selectedId !== item.id" :loading="pending === `buy:${item.id}`" :disabled="Boolean(pending) || ownedItemIds.includes(item.id) || balance < item.price || !ready" @click="emit('purchase', item)">{{ ownedItemIds.includes(item.id) ? '已永久解锁' : balance < item.price ? `还差 ${(item.price - balance).toLocaleString('zh-CN')}` : '解锁卡面' }}</el-button></div>
      </article>
    </div>
    <div class="memory-editor surface-card">
      <div class="memory-editor-head"><div><span class="memory-eyebrow">MAKE IT YOURS</span><h3>装进你自己的故事</h3></div><el-button :loading="loading" @click="load">刷新数据</el-button></div>
      <div class="memory-filters">
        <label>开始日期<input v-model="startDate" type="date" aria-label="开始日期" /></label>
        <label>结束日期<input v-model="endDate" type="date" aria-label="结束日期" /></label>
        <label>项目<select v-model="project" aria-label="纪念卡项目"><option value="">全部项目</option><option v-for="name in projects" :key="name" :value="name">{{ name }}</option></select></label>
      </div>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <el-alert v-else-if="invalidRange" title="请选择有效的起止日期，开始日期不能晚于结束日期。" type="warning" :closable="false" />
      <el-skeleton v-else-if="loading" :rows="6" animated />
      <el-empty v-else-if="!data.reports" description="该范围暂无工作记录，保存日报后再来制作纪念卡。" />
      <div v-if="ready" class="memory-stage" :class="selectedId">
        <div class="memory-stage-caption"><span>{{ selectedCard.name }} / 成品预览</span><span>{{ unlocked ? '已解锁 · 可导出' : '免费预览 · 解锁后可导出' }}</span></div>
        <div class="memory-preview"><img :src="previews[selectedId]" alt="工作纪念卡预览" /></div>
      </div>
      <div class="memory-export"><div><strong>把这一程，保存下来。</strong><p>SVG 高清矢量原图 · 放大不失真 · 无外部素材</p></div><el-button type="primary" :disabled="!ready || !unlocked" @click="exportCard">导出 SVG</el-button></div>
    </div>
    <p class="memory-note">统计来源于已保存日报的时间长河记录；合篇日报按整份统计，不拆分各项目贡献。预览与导出内容一致。</p>
  </section>
</template>

<style scoped>
.memory-cards { display: grid; gap: 24px; }
.memory-heading, .memory-editor-head, .memory-export { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.memory-eyebrow { color: var(--c-text-faint); font-size: 10px; letter-spacing: 2px; }
.memory-heading h2 { margin: 10px 0; font-size: 25px; letter-spacing: -.5px; font-weight: 600; }
.memory-heading p, .memory-note, .memory-export p, .memory-product p { color: var(--c-text-muted); font-size: 12px; line-height: 1.7; }
.memory-heading p { margin: 0; }
.memory-permanent { padding: 8px 12px; border: 1px solid var(--c-border); border-radius: 20px; color: var(--c-text-muted); font-size: 11px; white-space: nowrap; }
.memory-products { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
.memory-product { min-width: 0; overflow: hidden; border: 1px solid var(--c-border); border-radius: 16px; transition: border-color .18s; }
.memory-product.selected { border-color: var(--c-primary); }
.memory-select { display: block; padding: 0; width: 100%; background: none; border: 0; color: var(--c-text); cursor: pointer; font: inherit; text-align: left; }
.memory-select:focus-visible { outline: 2px solid var(--c-primary); outline-offset: -3px; border-radius: 14px; }
.memory-thumb { display: block; position: relative; padding: 24px 19px; background: #e6e0d2; overflow: hidden; }
.memory-thumb.card-blueprint { background: #183b3e; }
.memory-thumb.card-orbit { background: #25273b; }
.memory-thumb img { display: block; width: 100%; border-radius: 5px; transform: rotate(-3deg); box-shadow: 0 12px 20px #0003; transition: transform .2s; }
.memory-select:hover img, .selected .memory-thumb img { transform: rotate(0); }
.memory-selected { position: absolute; right: 9px; bottom: 9px; padding: 4px 9px; border-radius: 4px; color: #fff; background: #111a; font-size: 10px; }
.memory-product-name { display: flex; align-items: center; gap: 10px; padding: 19px 18px 0; }
.memory-number { color: var(--c-text-faint); font: italic 18px Georgia, serif; }
.memory-product-name strong { font-size: 16px; font-weight: 600; }
.memory-owned { margin-left: auto; color: var(--c-primary); font-size: 11px; }
.memory-product p { margin: 9px 18px 19px; min-height: 40px; }
.memory-purchase { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 18px; padding: 16px 0; border-top: 1px solid var(--c-border); }
.memory-price { display: grid; gap: 5px; }
.memory-price strong { font: 26px Georgia, serif; }
.memory-price small { font: 11px sans-serif; margin-left: 5px; color: var(--c-text-muted); }
.memory-price > span { font-size: 9px; color: var(--c-text-faint); }
.memory-purchase .el-button { padding: 8px 11px; font-size: 12px; }
.memory-editor { padding: 24px; border-radius: 18px; display: grid; gap: 22px; }
.memory-editor-head h3 { margin: 7px 0 0; font-size: 17px; font-weight: 600; }
.memory-filters { display: flex; flex-wrap: wrap; gap: 16px; }
.memory-filters label { display: grid; gap: 8px; font-size: 12px; flex: 1; min-width: 170px; color: var(--c-text-muted); }
.memory-filters input, .memory-filters select { width: 100%; min-width: 0; box-sizing: border-box; height: 36px; padding: 0 10px; background: var(--c-surface); color: var(--c-text); border: 1px solid var(--c-border); border-radius: 8px; font: inherit; }
.memory-stage { padding: 22px 36px 38px; border-radius: 12px; background: radial-gradient(ellipse at 50% 10%, #eee8dc, #d7d0c2); }
.memory-stage.card-blueprint { background: radial-gradient(ellipse at 50% 10%, #385754, #172b2d); }
.memory-stage.card-orbit { background: radial-gradient(ellipse at 50% 10%, #42425b, #1b1d2b); }
.memory-stage-caption { display: flex; justify-content: space-between; gap: 12px; font-size: 11px; color: #686050; margin-bottom: 24px; }
.card-blueprint .memory-stage-caption, .card-orbit .memory-stage-caption { color: #c1c9d2; }
.memory-preview { max-width: 900px; margin: auto; }
.memory-preview img { display: block; width: 100%; border-radius: 2%; box-shadow: 0 20px 32px -10px #0006, 0 2px 5px #0002; }
.memory-export strong { font-size: 14px; font-weight: 500; }
.memory-export p { margin: 5px 0 0; font-size: 11px; }
.memory-note { margin: 0; font-size: 11px; }
@media (prefers-reduced-motion: reduce) { .memory-thumb img, .memory-product { transition: none; } }
@media (max-width: 1000px) { .memory-products { gap: 10px; } .memory-purchase { flex-wrap: wrap; } }
@media (max-width: 800px) { .memory-products { grid-template-columns: 1fr; } .memory-permanent { display: none; } .memory-editor { padding: 16px; } .memory-stage { padding: 14px 12px 24px; } .memory-stage-caption { font-size: 10px; } }
</style>
