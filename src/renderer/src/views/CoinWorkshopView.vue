<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check, Coins, Flower2, Palette, RefreshCw, ShoppingBag, Sparkles, Sprout, Timer } from 'lucide-vue-next';
import { ElMessage, ElMessageBox, ElSkeleton } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import GardenPlant from '@/components/rewards/GardenPlant.vue';
import CoinThemePreview from '@/components/rewards/CoinThemePreview.vue';
import FocusSpace from '@/components/rewards/FocusSpace.vue';
import WorkMemoryCards from '@/components/rewards/WorkMemoryCards.vue';
import { useCoinWorkshop } from '@/composables/useCoinWorkshop';
import { COIN_SHOP_ITEMS } from '@shared/coinWorkshop';
import type { CoinShopItem, CoinTransactionPage, CoinTransactionQuery } from '@shared/coinWorkshop';

const workshop = useCoinWorkshop();
const { snapshot, loading, error, pending } = workshop;
const tabs = [
  { id: 'shop', label: '装扮商店', caption: '给日常换个颜色', icon: ShoppingBag },
  { id: 'garden', label: '代码花园', caption: '让坚持慢慢生长', icon: Sprout },
  { id: 'cards', label: '工作纪念卡', caption: '收藏认真走过的路', icon: Palette },
  { id: 'focus', label: '专注空间', caption: '留一点时间给自己', icon: Timer },
  { id: 'ledger', label: '收支明细', caption: '每一份积累有迹可循', icon: Coins },
] as const;
const tab = ref<(typeof tabs)[number]['id']>('shop');
const themes = COIN_SHOP_ITEMS.filter(item => item.kind === 'theme');
const pots = COIN_SHOP_ITEMS.filter(item => item.kind === 'pot');
const seeds = COIN_SHOP_ITEMS.filter(item => item.kind === 'seed');
const growing = computed(() => snapshot.value?.plants.filter(plant => !plant.harvestedAt) ?? []);
const collection = computed(() => snapshot.value?.plants.filter(plant => plant.harvestedAt) ?? []);
const freeSlots = computed(() => 3 - growing.value.length);
const balance = computed(() => snapshot.value?.wallet.wallet.coins ?? 0);
const equippedTheme = computed(() => themes.find(item => item.id === snapshot.value?.equippedThemeId));
const ownedDressings = computed(() => [...themes, ...pots].filter(item => owned(item.id)).length);
const ledger = ref<CoinTransactionPage | null>(null);
const ledgerLoading = ref(false);
const ledgerError = ref('');
const ledgerType = ref<NonNullable<CoinTransactionQuery['type']>>('all');
const ledgerPage = ref(1);
let ledgerRequest = 0;

function amount(value: number) { return value.toLocaleString('zh-CN'); }
function itemFor(id: string) { return COIN_SHOP_ITEMS.find(item => item.id === id); }
function owned(id: string) { return snapshot.value?.ownedItemIds.includes(id) || itemFor(id)?.price === 0; }
function equipped(item: CoinShopItem) {
  return item.kind === 'theme' ? snapshot.value?.equippedThemeId === item.id : snapshot.value?.equippedPotId === item.id;
}
function itemAction(item: CoinShopItem) {
  if (equipped(item)) return '正在使用';
  if (owned(item.id)) return '使用装扮';
  if (balance.value < item.price) return `还差 ${amount(item.price - balance.value)}`;
  return item.kind === 'seed' ? '购买并种下' : '购买装扮';
}
function dateTime(value: string) { return new Date(value).toLocaleString('zh-CN', { hour12: false }); }

function navigateTabs(event: KeyboardEvent, index: number) {
  let next = index;
  if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
  else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = tabs.length - 1;
  else return;
  event.preventDefault();
  tab.value = tabs[next].id;
  const buttons = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  buttons?.[next].focus();
}

async function purchase(item: CoinShopItem) {
  if (pending.value) return;
  try {
    await ElMessageBox.confirm(
      `花费 ${amount(item.price)} 码币${item.kind === 'seed' ? '种下' : '购买'}「${item.name}」？${item.kind === 'seed' ? '保存日报让它慢慢成长。' : '购买后永久拥有，切换使用不再扣币。'}`,
      '确认购买', { confirmButtonText: '确认购买', cancelButtonText: '再想想', type: 'info' },
    );
    if (await workshop.purchase(item.id)) ElMessage.success(item.kind === 'seed' ? '已种下，下一份日报就是新的养分。' : '购买成功，已永久解锁。');
  } catch (cause) {
    if (cause !== 'cancel' && cause !== 'close') ElMessage.error(cause instanceof Error ? cause.message : '购买未完成');
  }
}

async function useItem(item: CoinShopItem) {
  if (await workshop.equip(item.id)) ElMessage.success(`已使用${item.name}`);
}

async function harvest(id: number) {
  if (await workshop.harvest(id)) ElMessage.success('植物已收入图鉴，空出的生长位可以迎接新种子。');
}

async function loadLedger() {
  const request = ++ledgerRequest;
  ledgerLoading.value = true;
  ledgerError.value = '';
  try {
    const result = await window.api.listCoinTransactions({ page: ledgerPage.value, pageSize: 10, type: ledgerType.value });
    if (request === ledgerRequest) ledger.value = result;
  } catch (cause) {
    if (request === ledgerRequest) ledgerError.value = cause instanceof Error ? cause.message : '收支明细读取失败，请重试。';
  } finally {
    if (request === ledgerRequest) ledgerLoading.value = false;
  }
}

function setLedgerType(type: NonNullable<CoinTransactionQuery['type']>) {
  ledgerType.value = type;
  ledgerPage.value = 1;
  void loadLedger();
}
function setLedgerPage(page: number) { ledgerPage.value = page; void loadLedger(); }
async function refresh() { await workshop.refresh(); if (tab.value === 'ledger') await loadLedger(); }
watch(tab, value => { if (value === 'ledger') void loadLedger(); });
watch(snapshot, () => { if (tab.value === 'ledger') void loadLedger(); });
onMounted(() => { void workshop.refresh(); });
</script>

<template>
  <div class="view-stack coin-workshop">
    <PageHeader title="码币工坊" subtitle="一点积累，一点喜欢。给工作留一处自己的空间。">
      <template #actions><el-button :icon="RefreshCw" :loading="loading" :disabled="Boolean(pending)" @click="refresh">刷新工坊</el-button></template>
    </PageHeader>

    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" role="alert">
      <el-button link type="primary" :disabled="Boolean(pending)" @click="refresh">重新读取工坊</el-button>
    </el-alert>
    <el-skeleton v-if="loading && !snapshot" :rows="8" animated />

    <template v-if="snapshot">
      <div class="coin-intro">
        <section class="coin-studio" aria-label="我的工坊">
          <div class="coin-studio-copy">
            <span class="coin-eyebrow"><span /> THE EVERYDAY ATELIER</span>
            <h2>把努力，<br />兑换成<span>喜欢。</span></h2>
            <p>一抹新的颜色，一株慢慢长大的植物。<br />认真度过的日常，值得一点小小的奖励。</p>
            <button class="coin-studio-link" @click="tab = 'garden'">去花园看看 <ArrowUpRight :size="15" /></button>
          </div>
          <div class="coin-studio-scene" aria-hidden="true">
            <span class="studio-orbit" /><Sparkles class="studio-spark" :size="22" :stroke-width="1" />
            <div class="studio-print"><span>MAKE ROOM<br />FOR JOY.</span><i /></div>
            <div class="studio-monitor"><CoinThemePreview :theme-id="snapshot.equippedThemeId" /><span class="studio-monitor-neck" /></div>
            <div class="studio-desk" /><div class="studio-notebook" /><div class="studio-cup" />
            <GardenPlant seed-id="seed-clover" :pot-id="snapshot.equippedPotId" />
            <span class="studio-palette-label"><i :style="{ background: equippedTheme?.accent }" />{{ equippedTheme?.name }} · 当前装扮</span>
          </div>
          <div class="coin-studio-footer"><span><Palette :size="13" />已拥有 {{ ownedDressings }} 款装扮</span><span><Sprout :size="13" />{{ growing.length }} 株生长中</span><span class="studio-footer-note">慢慢积累，自成风景。</span></div>
        </section>

        <section class="coin-wallet" aria-label="我的码币">
          <div class="coin-wallet-heading"><span><Coins :size="16" />我的码币</span><button aria-label="查看收支明细" @click="tab = 'ledger'"><ArrowUpRight :size="18" /></button></div>
          <strong class="coin-balance" data-coin-balance>{{ amount(balance) }}<small>码币</small></strong>
          <span class="coin-checkin-state"><Check v-if="snapshot.wallet.checkedInToday" :size="12" /><span v-else class="coin-status-dot" />{{ snapshot.wallet.checkedInToday ? '今日已签到 · 又积累了一份喜欢' : '今日待签到 · 点击顶部码币领取' }}</span>
          <div class="coin-metrics" aria-label="码币收支统计">
            <div><span><ArrowDownLeft :size="12" /> 今日获得</span><strong data-coin-stat="today-income">+{{ amount(snapshot.summary.todayIncome) }}</strong></div>
            <div><span><ArrowUpRight :size="12" /> 今日消费</span><strong data-coin-stat="today-spent">{{ amount(snapshot.summary.todaySpent) }}</strong></div>
            <div><span>累计收入</span><strong data-coin-stat="total-income">{{ amount(snapshot.summary.totalIncome) }}</strong></div>
            <div><span>累计消费</span><strong data-coin-stat="total-spent">{{ amount(snapshot.summary.totalSpent) }}</strong></div>
          </div>
        </section>
      </div>

      <nav class="coin-tabs" role="tablist" aria-label="工坊内容">
        <button v-for="(entry, index) in tabs" :id="`coin-${entry.id}-tab`" :key="entry.id" role="tab" :aria-label="entry.label" :aria-selected="tab === entry.id" :aria-controls="`coin-${entry.id}-panel`" :tabindex="tab === entry.id ? 0 : -1" @click="tab = entry.id" @keydown="navigateTabs($event, index)">
          <span class="coin-tab-icon"><component :is="entry.icon" :size="19" :stroke-width="1.7" /></span>
          <span class="coin-tab-copy"><strong>{{ entry.label }}<small v-if="entry.id === 'garden'">{{ growing.length }}/3</small></strong><span>{{ entry.caption }}</span></span>
        </button>
      </nav>

      <FocusSpace v-if="tab === 'focus'" id="coin-focus-panel" role="tabpanel" aria-labelledby="coin-focus-tab" :owned-item-ids="snapshot.ownedItemIds" :balance="balance" :pending="pending" @purchase="purchase" />
      <WorkMemoryCards v-if="tab === 'cards'" id="coin-cards-panel" role="tabpanel" aria-labelledby="coin-cards-tab" :owned-item-ids="snapshot.ownedItemIds" :balance="balance" :pending="pending" @purchase="purchase" />
      <section v-if="tab === 'shop'" id="coin-shop-panel" role="tabpanel" aria-labelledby="coin-shop-tab" class="coin-shop-panel">
        <div class="coin-section-head"><div><span class="coin-section-eyebrow">01 / PERSONAL PALETTES</span><h2>让工作台，有你的颜色。</h2><p>把喜欢的风景，藏进每天使用的配色里。</p></div><span class="coin-section-note"><span class="coin-palette-dots"><i v-for="item in themes" :key="item.id" :style="{ background: item.accent }" /></span>一次解锁，深浅模式随心切换</span></div>
        <div class="coin-theme-grid">
          <article v-for="(item, index) in themes" :key="item.id" class="coin-product" :class="{ 'is-equipped': equipped(item) }" :data-product="item.id" :style="{ '--item-accent': item.accent }">
            <div class="coin-theme-art" role="img" :aria-label="`${item.name}配色示意`"><CoinThemePreview :theme-id="item.id" /><span class="coin-edition">PALETTE / 0{{ index + 1 }}</span><span v-if="equipped(item)" class="coin-owned-badge"><Check :size="11" />正在使用</span><span v-else-if="owned(item.id)" class="coin-owned-badge">已拥有</span></div>
            <div class="coin-product-copy"><div class="coin-product-title"><h3>{{ item.name }}</h3><span class="coin-color-swatch" aria-hidden="true" /></div><p>{{ item.description }}</p></div>
            <div class="coin-product-footer"><strong class="coin-price">{{ item.price ? amount(item.price / 10000) : '免费' }}<small v-if="item.price">万码币</small></strong><el-button :type="equipped(item) ? 'default' : 'primary'" :plain="!owned(item.id)" :disabled="Boolean(pending) || equipped(item) || (!owned(item.id) && balance < item.price)" :loading="pending === `buy:${item.id}` || pending === `equip:${item.id}`" @click="owned(item.id) ? useItem(item) : purchase(item)">{{ itemAction(item) }}</el-button></div>
          </article>
        </div>
        <p class="coin-preview-note"><Palette :size="12" />风景是配色灵感，装扮会改变工作台的按钮与高亮颜色。</p>

        <div class="coin-section-head"><div><span class="coin-section-eyebrow">02 / LITTLE OBJECTS</span><h2>小小花盆，盛放日常。</h2><p>给整个花园换上喜欢的花盆，收藏的植物也会一起换装。</p></div><button class="coin-text-link" @click="tab = 'garden'">看看我的花园 <ArrowRight :size="14" /></button></div>
        <div class="coin-pot-grid">
          <article v-for="(item, index) in pots" :key="item.id" class="coin-pot-product" :class="{ 'is-equipped': equipped(item) }" :data-product="item.id">
            <div class="coin-pot-display" :class="item.id"><span>OBJECT / 0{{ index + 1 }}</span><GardenPlant seed-id="seed-clover" :pot-id="item.id" /><i /></div>
            <div class="coin-pot-copy"><h3>{{ item.name }}</h3><p>{{ item.description }}</p><strong class="coin-price">{{ item.price ? `${amount(item.price / 10000)} 万码币` : '免费 · 默认花盆' }}</strong><el-button :type="equipped(item) ? 'default' : 'primary'" plain :disabled="Boolean(pending) || equipped(item) || (!owned(item.id) && balance < item.price)" :loading="pending === `buy:${item.id}` || pending === `equip:${item.id}`" @click="owned(item.id) ? useItem(item) : purchase(item)">{{ itemAction(item) }}</el-button></div>
          </article>
        </div>
        <div class="coin-discover">
          <div><Sparkles :size="18" /><span>日常的奖励，不止一种。</span></div>
          <button @click="tab = 'cards'"><Palette :size="16" />制作一张工作纪念卡 <ArrowUpRight :size="14" /></button>
          <button @click="tab = 'focus'"><Timer :size="16" />留给自己 25 分钟 <ArrowUpRight :size="14" /></button>
        </div>
      </section>

      <section v-if="tab === 'garden'" id="coin-garden-panel" role="tabpanel" aria-labelledby="coin-garden-tab">
        <div class="coin-section-head"><div><span class="coin-section-eyebrow">THE SLOW GARDEN / 你的生长记录</span><h2>每一份日报，都在悄悄生长。</h2><p>种下后保存有效日报，每个不同的工作日期提供一天成长。同日多份日报只计一次。</p></div><span class="coin-garden-capacity"><Sprout :size="15" />{{ freeSlots }} 个空闲生长位</span></div>
        <div class="coin-garden-grid">
          <article v-for="(plant, index) in growing" :key="plant.id" class="coin-plant-card" :data-plant="plant.id" :class="{ 'is-mature': plant.growthDays >= plant.requiredDays }">
            <div class="coin-plant-heading"><span>GROWING / 0{{ index + 1 }}</span><span class="coin-plant-status">{{ plant.growthDays >= plant.requiredDays ? '已成熟 · 可以收藏' : '生长中' }}</span></div>
            <div class="coin-plant-stage"><span /><GardenPlant :seed-id="plant.seedId" :progress="plant.growthDays / plant.requiredDays" :pot-id="snapshot.equippedPotId" /></div>
            <h3>{{ itemFor(plant.seedId)?.name }}</h3>
            <p>{{ plant.growthDays >= plant.requiredDays ? '一段认真工作的时光，长成了新的收藏。' : `还需要 ${plant.requiredDays - plant.growthDays} 个工作日期的日报` }}</p>
            <el-progress :percentage="Math.min(100, Math.round(plant.growthDays / plant.requiredDays * 100))" :show-text="false" :stroke-width="6" />
            <div class="coin-plant-progress">成长 {{ Math.min(plant.growthDays, plant.requiredDays) }}/{{ plant.requiredDays }} 天<span>{{ new Date(plant.plantedAt).toLocaleDateString('zh-CN') }} 种下</span></div>
            <el-button :type="plant.growthDays >= plant.requiredDays ? 'primary' : 'default'" :disabled="Boolean(pending) || plant.growthDays < plant.requiredDays" :loading="pending === `harvest:${plant.id}`" @click="harvest(plant.id)">{{ plant.growthDays >= plant.requiredDays ? '收入图鉴' : '等待下一份日报' }}</el-button>
          </article>
          <article v-for="slot in freeSlots" :key="`empty-${slot}`" class="coin-plant-empty"><span class="coin-empty-number">PLOT / 0{{ growing.length + slot }}</span><span class="coin-empty-soil"><Sprout :size="35" :stroke-width="1.3" /></span><h3>留给下一颗种子</h3><p>在下方选一株喜欢的植物<br />让工作与生活一起生长</p><span class="coin-empty-caption">GOOD THINGS TAKE TIME</span></article>
        </div>

        <div class="coin-section-head"><div><h2>选一颗种子，开始新的积累</h2><p>购买即种下，占用一个生长位；成熟收藏后即可重新种植。</p></div></div>
        <div class="coin-seed-grid">
          <article v-for="item in seeds" :key="item.id" class="coin-seed-card" :data-product="item.id">
            <GardenPlant :seed-id="item.id" :pot-id="snapshot.equippedPotId" />
            <div><h3>{{ item.name }}</h3><p>{{ item.description }}</p><span class="coin-seed-days">{{ item.growthDays }} 个工作日期成熟</span><strong class="coin-price">{{ amount(item.price) }} 码币</strong><el-button type="primary" plain :disabled="Boolean(pending) || freeSlots <= 0 || balance < item.price" :loading="pending === `buy:${item.id}`" @click="purchase(item)">{{ freeSlots <= 0 ? '生长位已满' : itemAction(item) }}</el-button></div>
          </article>
        </div>

        <div class="coin-section-head"><div><h2>我的植物图鉴 <span class="coin-count">{{ collection.length }}</span></h2><p>成熟植物会一直保留在这里，记录你曾经认真工作的日子。</p></div></div>
        <div v-if="collection.length" class="coin-collection-grid"><article v-for="plant in collection" :key="plant.id" class="coin-collection-item"><GardenPlant :seed-id="plant.seedId" :pot-id="snapshot.equippedPotId" /><h3>{{ itemFor(plant.seedId)?.name }}</h3><span>{{ new Date(plant.harvestedAt!).toLocaleDateString('zh-CN') }} 收藏</span></article></div>
        <div v-else class="coin-collection-empty"><Flower2 :size="24" /><span>第一株成熟的植物，会成为这本图鉴的开篇。</span></div>
      </section>

      <section v-if="tab === 'ledger'" id="coin-ledger-panel" role="tabpanel" aria-labelledby="coin-ledger-tab" class="coin-ledger-panel">
        <div class="coin-section-head"><div><span class="coin-section-eyebrow">THE DAILY LEDGER / 日常账本</span><h2>每一枚码币，都有来处。</h2><p>完整保留签到、奖励与消费记录，按发生时间从新到旧排列。</p></div><div class="coin-ledger-filters" aria-label="收支筛选"><button v-for="filter in [{ id: 'all', label: '全部' }, { id: 'income', label: '收入' }, { id: 'spend', label: '支出' }] as const" :key="filter.id" :aria-pressed="ledgerType === filter.id" @click="setLedgerType(filter.id)">{{ filter.label }}</button></div></div>
        <el-alert v-if="ledgerError" :title="ledgerError" type="error" show-icon :closable="false"><el-button link type="primary" @click="loadLedger">重新读取明细</el-button></el-alert>
        <el-skeleton v-if="ledgerLoading && !ledger" :rows="5" animated />
        <el-table v-if="ledger" :data="ledger.records" :aria-busy="ledgerLoading" empty-text="暂无这类收支记录" class="coin-ledger-table">
          <el-table-column label="时间" min-width="155"><template #default="{ row }"><span class="coin-ledger-time">{{ dateTime(row.createdAt) }}</span></template></el-table-column>
          <el-table-column prop="reason" label="事项" min-width="210" />
          <el-table-column label="收支" align="right" min-width="120"><template #default="{ row }"><strong :class="row.amount > 0 ? 'coin-income' : 'coin-expense'">{{ row.amount > 0 ? '+' : '' }}{{ amount(row.amount) }}</strong></template></el-table-column>
          <el-table-column label="余额" align="right" min-width="130"><template #default="{ row }">{{ amount(row.balanceAfter) }}</template></el-table-column>
        </el-table>
        <div v-if="ledger" class="coin-ledger-pagination"><span>共 {{ amount(ledger.total) }} 笔记录</span><el-pagination background layout="prev, pager, next" :total="ledger.total" :page-size="10" :current-page="ledgerPage" :disabled="ledgerLoading" @current-change="setLedgerPage" /></div>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.coin-workshop { --studio-paper: #f2f0e7; --studio-ink: #314a3a; --studio-muted: #6e7b6a; max-width: 1440px; margin: 0 auto; width: 100%; gap: 24px; }
.coin-intro { display: grid; grid-template-columns: minmax(0, 1.85fr) minmax(290px, 1fr); gap: 18px; }
.coin-studio { position: relative; min-width: 0; min-height: 280px; padding: 24px 30px 60px; overflow: hidden; isolation: isolate; background: var(--studio-paper); color: var(--studio-ink); border: 1px solid color-mix(in srgb, var(--studio-ink) 14%, transparent); border-radius: 22px; }
.coin-studio::before { content: ''; position: absolute; width: 315px; height: 315px; right: -55px; top: -80px; border-radius: 50%; background: color-mix(in srgb, var(--studio-ink) 5%, transparent); z-index: -1; }
.coin-studio-copy { position: relative; z-index: 2; width: 57%; }
.coin-eyebrow { display: flex; align-items: center; gap: 8px; font-size: 8px; letter-spacing: 2px; color: var(--studio-muted); }
.coin-eyebrow > span { height: 5px; width: 5px; border-radius: 50%; background: var(--studio-muted); }
.coin-studio h2 { font-size: clamp(29px, 2.65vw, 40px); line-height: 1.23; font-weight: 650; letter-spacing: -1.5px; margin: 14px 0 10px; }
.coin-studio h2 > span { position: relative; white-space: nowrap; }
.coin-studio h2 > span::after { content: ''; position: absolute; inset: auto -2px -3px; height: 5px; border-top: 2px solid #bd9d69; border-radius: 50%; transform: rotate(-4deg); }
.coin-studio-copy p { margin: 0; font-size: 11px; line-height: 1.8; color: var(--studio-muted); }
.coin-studio-link { display: inline-flex; align-items: center; gap: 15px; margin-top: 14px; padding: 0 0 5px; border: 0; border-bottom: 1px solid color-mix(in srgb, var(--studio-ink) 30%, transparent); background: transparent; color: var(--studio-ink); font: inherit; font-size: 12px; cursor: pointer; }
.coin-studio-scene { position: absolute; width: 45%; right: 10px; top: 12px; bottom: 51px; }
.studio-orbit { position: absolute; width: 215px; height: 215px; border: 1px solid color-mix(in srgb, var(--studio-ink) 12%, transparent); border-radius: 50%; left: 5%; top: 14px; }
.studio-orbit::after { content: ''; position: absolute; inset: 13px; border: 1px dashed color-mix(in srgb, var(--studio-ink) 8%, transparent); border-radius: inherit; }
.studio-spark { position: absolute; right: 19px; top: 32px; color: #b28d57; transform: rotate(10deg); }
.studio-print { position: absolute; top: 29px; left: 14px; width: 69px; height: 86px; padding: 12px 10px; border: 4px solid #e0d7bf; background: #fcf8eb; box-shadow: 2px 5px 8px #263d3110; transform: rotate(-9deg); }
.studio-print span { display: block; font: 9px/1.5 Georgia, serif; color: #59644e; }
.studio-print i { display: block; width: 23px; height: 23px; margin: 8px 0 0 16px; border-radius: 50%; background: #d6aa69; }
.studio-monitor { position: absolute; width: 185px; height: 132px; left: 44px; bottom: 54px; border: 7px solid #35483f; border-bottom-width: 13px; border-radius: 10px; box-shadow: 4px 9px 14px #20362a25; transform: rotate(-5deg); z-index: 2; }
.studio-monitor :deep(.theme-preview) { min-height: 0; border-radius: 3px; }
.studio-monitor :deep(.preview-window) { transform: none; top: 17%; height: 74%; }
.studio-monitor-neck { position: absolute; bottom: -40px; left: 43%; width: 20px; height: 28px; background: #43584b; }
.studio-monitor-neck::after { content: ''; position: absolute; bottom: 0; left: -19px; width: 58px; height: 5px; border-radius: 50%; background: #35483f; }
.studio-desk { position: absolute; bottom: 31px; left: 0; width: 100%; height: 20px; background: #d6c5a6; border-bottom: 6px solid #b4a187; border-radius: 50%; box-shadow: 0 15px 20px #1e382515; transform: rotate(-4deg); z-index: 1; }
.coin-studio-scene .garden-plant { position: absolute; width: 104px; height: 123px; right: -15px; bottom: 34px; transform: rotate(5deg); z-index: 3; filter: drop-shadow(2px 5px 2px #243e2518); }
.studio-notebook { position: absolute; bottom: 43px; left: 45px; width: 58px; height: 13px; background: #7e9172; border-bottom: 4px solid #ece4d2; transform: rotate(-10deg) skewX(25deg); border-radius: 2px; z-index: 3; }
.studio-cup { position: absolute; bottom: 48px; left: 10px; width: 24px; height: 28px; background: #eee7d9; border-radius: 3px 3px 10px 10px; border-top: 3px solid #a1957b; box-shadow: inset -5px 0 #d7cebd; z-index: 3; }
.studio-cup::after { content: ''; position: absolute; right: -7px; top: 4px; width: 8px; height: 12px; border: 3px solid #d7cebd; border-left: 0; border-radius: 0 8px 8px 0; }
.studio-palette-label { position: absolute; bottom: 0; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; color: var(--studio-muted); font-size: 9px; letter-spacing: 1px; }
.studio-palette-label i { width: 6px; height: 6px; border-radius: 50%; box-shadow: 0 0 0 3px #899c7e20; }
.coin-studio-footer { position: absolute; bottom: 0; left: 0; right: 0; display: flex; align-items: center; gap: 23px; padding: 14px 25px; border-top: 1px solid color-mix(in srgb, var(--studio-ink) 10%, transparent); font-size: 10px; color: var(--studio-muted); }
.coin-studio-footer > span { display: flex; align-items: center; gap: 6px; }
.studio-footer-note { margin-left: auto; font-size: 9px; letter-spacing: 1px; }
.coin-wallet { min-width: 0; padding: 23px 25px; border-radius: 22px; background: linear-gradient(125deg, #344b3d, #1d3028); color: #f2f0db; position: relative; overflow: hidden; }
.coin-wallet::after { content: ''; position: absolute; width: 140px; height: 140px; right: -70px; top: -75px; border: 20px double #eddfb70a; border-radius: 50%; pointer-events: none; }
.coin-wallet-heading, .coin-wallet-heading > span { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; }
.coin-wallet-heading > span > svg { color: #dcc99b; }
.coin-wallet-heading button { display: grid; place-items: center; width: 27px; height: 27px; border-radius: 50%; border: 1px solid #e8efd127; background: transparent; color: #e5ead8; cursor: pointer; }
.coin-wallet-heading button:hover { background: #e8efd115; }
.coin-balance { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; margin: 15px 0 10px; font-size: clamp(26px, 2.5vw, 38px); font-weight: 500; letter-spacing: -1.5px; font-variant-numeric: tabular-nums; line-height: 1.15; overflow-wrap: anywhere; }
.coin-balance small { color: #c2cdbd; font-size: 10px; font-weight: 400; letter-spacing: 0; }
.coin-checkin-state { display: flex; align-items: center; gap: 6px; color: #d8d9b6; font-size: 10px; line-height: 1.7; }
.coin-status-dot { width: 4px; height: 4px; border-radius: 50%; background: #dcc99b; flex-shrink: 0; }
.coin-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 20px; row-gap: 15px; border-top: 1px solid #f1efd81c; padding-top: 16px; margin-top: 17px; }
.coin-metrics > div { display: flex; min-width: 0; flex-direction: column; gap: 6px; }
.coin-metrics span { display: flex; align-items: center; gap: 3px; font-size: 10px; color: #b6c3b4; }
.coin-metrics strong { font-size: 15px; font-weight: 500; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; letter-spacing: -.2px; }
.coin-metrics [data-coin-stat='today-income'] { color: #d4e6ab; }
.coin-tabs { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 5px; padding: 6px; border: 1px solid var(--c-border); border-radius: 16px; background: var(--c-surface); }
.coin-tabs > button { min-width: 0; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid transparent; border-radius: 11px; color: var(--c-text-muted); background: transparent; font: inherit; text-align: left; cursor: pointer; transition: background-color .18s, border-color .18s, color .18s; }
.coin-tabs > button:hover { background: var(--c-surface-muted); }
.coin-tabs > button[aria-selected='true'] { background: var(--c-primary-soft); border-color: color-mix(in srgb, var(--c-primary) 20%, transparent); color: var(--c-primary); }
.coin-tab-icon { display: grid; place-items: center; flex-shrink: 0; }
.coin-tab-copy { display: grid; gap: 6px; min-width: 0; }
.coin-tab-copy strong { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 550; white-space: nowrap; }
.coin-tab-copy > span { font-size: 9px; color: var(--c-text-faint); white-space: nowrap; }
.coin-tab-copy small { padding: 1px 3px; font-size: 9px; font-weight: 400; border: 1px solid var(--c-border); border-radius: 4px; }
.coin-section-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 6px 0 20px; }
.coin-section-eyebrow { display: block; margin-bottom: 9px; font-size: 9px; letter-spacing: 1.6px; color: var(--c-text-faint); }
.coin-section-head h2 { display: flex; align-items: center; gap: 8px; font-size: 22px; font-weight: 600; margin: 0 0 9px; letter-spacing: -.6px; }
.coin-section-head p { margin: 0; font-size: 12px; color: var(--c-text-muted); line-height: 1.75; }
.coin-section-note { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; font-size: 10px; color: var(--c-text-faint); flex-shrink: 0; }
.coin-palette-dots { display: flex; padding-right: 3px; }
.coin-palette-dots i { width: 19px; height: 19px; border: 3px solid var(--c-page-bg); margin-right: -3px; border-radius: 50%; }
.coin-theme-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.coin-product { min-width: 0; border: 1px solid var(--c-border); border-radius: 16px; padding: 6px; background: var(--c-surface); transition: border-color .18s, box-shadow .18s; }
.coin-product:hover { border-color: var(--c-border-strong); box-shadow: 0 6px 20px #17291d0a; }
.coin-product.is-equipped, .coin-pot-product.is-equipped { border-color: var(--c-primary); }
.coin-theme-art { height: 170px; position: relative; overflow: hidden; border-radius: 10px; }
.coin-edition { position: absolute; top: 13px; left: 12px; font-size: 7px; letter-spacing: 1.4px; color: #31443e; }
.coin-owned-badge { position: absolute; top: 10px; right: 9px; display: flex; align-items: center; gap: 3px; padding: 4px 7px; border-radius: 20px; font-size: 9px; color: #294333; background: #f5f8e9e8; border: 1px solid #ffffff80; }
.coin-product-copy { padding: 17px 10px 13px; }
.coin-product-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.coin-product h3, .coin-pot-product h3, .coin-seed-card h3, .coin-plant-card h3, .coin-plant-empty h3, .coin-collection-item h3 { font-size: 15px; margin: 0 0 7px; font-weight: 600; }
.coin-product-title h3 { margin: 0; font-size: 16px; }
.coin-color-swatch { width: 10px; height: 10px; flex-shrink: 0; border-radius: 50%; background: var(--item-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--item-accent) 18%, transparent); }
.coin-product p { color: var(--c-text-muted); font-size: 11px; line-height: 1.8; min-height: 39px; margin: 9px 0 0; }
.coin-product-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding: 13px 0 8px; margin: 0 10px; border-top: 1px solid var(--c-border); }
.coin-price { display: block; color: var(--c-text); font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
.coin-product-footer .coin-price { font-size: 21px; font-weight: 500; letter-spacing: -.5px; }
.coin-price small { margin-left: 4px; font-size: 9px; color: var(--c-text-faint); font-weight: 400; letter-spacing: 0; }
.coin-product-footer > .el-button { height: 30px; padding: 0 10px; margin: 0; font-size: 11px; border-radius: 8px; }
.coin-product-footer > .el-button.is-disabled { background: var(--c-surface-muted); border-color: var(--c-border); color: var(--c-text-faint); }
.coin-preview-note { display: flex; align-items: center; gap: 6px; color: var(--c-text-faint); font-size: 10px; line-height: 1.6; margin: 14px 0 32px; }
.coin-text-link { display: inline-flex; align-items: center; gap: 9px; flex-shrink: 0; border: 0; padding: 5px 0; background: transparent; color: var(--c-primary); font: inherit; font-size: 11px; cursor: pointer; }
.coin-pot-grid, .coin-seed-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 30px; }
.coin-pot-product, .coin-seed-card { display: flex; align-items: center; border: 1px solid var(--c-border); background: var(--c-surface); border-radius: 16px; min-width: 0; gap: 14px; overflow: hidden; }
.coin-pot-display { align-self: stretch; position: relative; flex: 0 0 38%; min-height: 190px; display: grid; place-items: center; background: #e9e1d3; isolation: isolate; }
.coin-pot-display::before { content: ''; position: absolute; top: 30px; bottom: 30px; left: 12%; right: 12%; border-radius: 70px 70px 0 0; border: 1px solid #a994712e; background: #ffffff20; z-index: -1; }
.coin-pot-display.pot-ceramic { background: #dfe8e2; }
.coin-pot-display.pot-orbit { background: #dce3ed; }
.coin-pot-display > span { position: absolute; left: 10px; top: 12px; font-size: 6px; letter-spacing: 1px; color: #4f5d57; }
.coin-pot-display .garden-plant { position: relative; width: 110px; max-width: 100%; height: 130px; z-index: 1; filter: drop-shadow(3px 6px 2px #253b2910); }
.coin-pot-display > i { position: absolute; bottom: 29px; left: 12%; right: 12%; height: 10px; border-radius: 50%; background: #c1b59d; box-shadow: 0 5px 0 #b0a58f; }
.pot-ceramic > i { background: #b7c8b9; box-shadow: 0 5px 0 #a5b5a8; }
.pot-orbit > i { background: #b8c4d4; box-shadow: 0 5px 0 #a1aec0; }
.coin-pot-copy { min-width: 0; padding: 19px 12px 19px 0; }
.coin-pot-product p, .coin-seed-card p { font-size: 11px; color: var(--c-text-muted); line-height: 1.8; margin: 0 0 12px; }
.coin-pot-product .el-button, .coin-seed-card .el-button { margin: 13px 0 0; padding: 0 10px; height: 30px; font-size: 11px; max-width: 100%; }
.coin-discover { display: flex; align-items: center; gap: 20px; padding: 20px 24px; border-top: 1px solid var(--c-border); border-bottom: 1px solid var(--c-border); }
.coin-discover > div { display: flex; align-items: center; gap: 10px; margin-right: auto; color: var(--c-text-muted); font-size: 12px; }
.coin-discover > div svg { color: var(--c-primary); }
.coin-discover button { display: flex; align-items: center; gap: 8px; padding: 0; border: 0; background: transparent; font: inherit; color: var(--c-text); font-size: 11px; cursor: pointer; }
.coin-discover button:hover { color: var(--c-primary); }
.coin-garden-capacity { display: flex; align-items: center; gap: 7px; flex-shrink: 0; padding: 8px 12px; border: 1px solid var(--c-border); border-radius: 20px; color: var(--c-primary); font-size: 11px; }
.coin-garden-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin-bottom: 36px; }
.coin-plant-card, .coin-plant-empty { position: relative; min-width: 0; border-radius: 18px; min-height: 355px; padding: 20px; }
.coin-plant-card { display: flex; flex-direction: column; align-items: center; border: 1px solid var(--c-border); background: var(--c-surface); }
.coin-plant-card.is-mature { border-color: var(--c-primary); }
.coin-plant-heading { display: flex; align-items: center; justify-content: space-between; gap: 5px; width: 100%; }
.coin-plant-heading > span:first-child, .coin-empty-number { color: var(--c-text-faint); font-size: 8px; letter-spacing: 1px; }
.coin-plant-status { font-size: 10px; color: var(--c-primary); background: var(--c-primary-soft); border-radius: 12px; padding: 4px 8px; }
.coin-plant-stage { width: 100%; display: grid; place-items: center; position: relative; isolation: isolate; height: 166px; }
.coin-plant-stage > span { position: absolute; width: 126px; height: 126px; top: 17px; border-radius: 50%; background: color-mix(in srgb, var(--c-primary) 6%, var(--c-surface)); z-index: -1; }
.coin-plant-stage .garden-plant { width: 145px; height: 152px; }
.coin-plant-card p { color: var(--c-text-muted); font-size: 11px; text-align: center; line-height: 1.7; min-height: 18px; margin: 0 0 18px; }
.coin-plant-card .el-progress, .coin-plant-card .el-button { width: 100%; }
.coin-plant-card .el-button { margin-top: auto; }
.coin-plant-progress { display: flex; justify-content: space-between; gap: 5px; width: 100%; font-size: 10px; color: var(--c-text-muted); margin: 8px 0 16px; }
.coin-plant-progress span { color: var(--c-text-faint); }
.coin-plant-empty { border: 1px dashed var(--c-border-strong); display: flex; flex-direction: column; justify-content: center; align-items: center; background: color-mix(in srgb, var(--c-surface) 40%, transparent); }
.coin-empty-number { position: absolute; top: 23px; left: 20px; }
.coin-empty-soil { position: relative; color: var(--c-text-faint); border: 1px solid var(--c-border); width: 90px; height: 105px; border-radius: 50px 50px 15px 15px; display: grid; place-items: center; margin-bottom: 25px; }
.coin-empty-soil::after { content: ''; position: absolute; bottom: 22px; left: 20px; right: 20px; height: 5px; border-bottom: 1px solid var(--c-border-strong); border-radius: 50%; }
.coin-plant-empty h3 { color: var(--c-text-muted); font-size: 14px; font-weight: 500; }
.coin-plant-empty p { color: var(--c-text-faint); font-size: 11px; text-align: center; line-height: 1.9; margin: 5px 0 0; }
.coin-empty-caption { font-size: 7px; letter-spacing: 1.5px; color: var(--c-text-faint); margin-top: 25px; }
.coin-seed-card { padding: 18px 14px; }
.coin-seed-card .garden-plant { flex: 0 0 84px; width: 84px; height: 110px; }
.coin-seed-days { display: block; margin-bottom: 10px; font-size: 11px; color: var(--c-text-faint); }
.coin-count { display: inline-flex; align-items: center; justify-content: center; font-size: 11px; background: var(--c-surface-inset); border-radius: 8px; min-width: 24px; height: 21px; }
.coin-collection-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 15px; }
.coin-collection-item { display: flex; flex-direction: column; align-items: center; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 15px; padding: 16px 12px; }
.coin-collection-item .garden-plant { width: 105px; height: 115px; }
.coin-collection-item span { color: var(--c-text-faint); font-size: 10px; }
.coin-collection-empty { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 35px 15px; border: 1px dashed var(--c-border); border-radius: 15px; color: var(--c-text-faint); font-size: 12px; }
.coin-ledger-panel { padding: 26px; border: 1px solid var(--c-border); background: var(--c-surface); border-radius: 18px; }
.coin-ledger-filters { display: flex; padding: 3px; background: var(--c-surface-inset); border-radius: 9px; flex-shrink: 0; }
.coin-ledger-filters button { border: 0; background: transparent; border-radius: 6px; padding: 7px 13px; color: var(--c-text-muted); cursor: pointer; font: inherit; font-size: 12px; }
.coin-ledger-filters button[aria-pressed='true'] { color: var(--c-primary); background: var(--c-surface); }
.coin-ledger-table { font-size: 12px; --el-table-bg-color: transparent; --el-table-tr-bg-color: transparent; --el-table-header-bg-color: var(--c-surface-muted); --el-table-border-color: var(--c-border); }
.coin-ledger-time { color: var(--c-text-muted); font-size: 11px; }
.coin-income { color: var(--c-primary); font-variant-numeric: tabular-nums; }
.coin-expense { color: var(--c-text); font-variant-numeric: tabular-nums; }
.coin-ledger-pagination { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 20px; }
.coin-ledger-pagination > span { font-size: 11px; color: var(--c-text-faint); }
.coin-workshop button:focus-visible { outline: 2px solid var(--c-primary); outline-offset: 4px; }
.coin-wallet button:focus-visible { outline-color: #dce7b4; }
html[data-theme='dark'] .coin-workshop { --studio-paper: #232d27; --studio-ink: #e1e6cf; --studio-muted: #b4bea8; }
html[data-theme='dark'] .coin-wallet { border: 1px solid #4c6146; background: linear-gradient(125deg, #304034, #1b2b23); }
html[data-theme='dark'] .coin-theme-art { filter: brightness(.88); }
html[data-theme='dark'] .coin-pot-display { filter: brightness(.78); }
@media (max-width: 1200px) {
  .coin-intro { grid-template-columns: minmax(0, 1.5fr) minmax(265px, 1fr); gap: 14px; }
  .coin-studio { padding-left: 23px; padding-right: 23px; }
  .coin-studio-copy { width: 62%; }
  .coin-studio-scene { width: 250px; right: 20px; top: 35px; transform: scale(.66); transform-origin: right center; }
  .coin-studio-footer { padding-inline: 20px; gap: 16px; }
  .studio-footer-note { display: none !important; }
  .coin-wallet { padding-inline: 20px; }
  .coin-tabs > button { padding: 12px 9px; gap: 7px; }
  .coin-tab-copy > span { font-size: 8px; }
  .coin-theme-grid { gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .coin-theme-art { height: 195px; }
  .coin-product p { min-height: 20px; }
  .coin-pot-grid, .coin-seed-grid { gap: 12px; }
  .coin-pot-product { flex-direction: column; gap: 0; }
  .coin-pot-display { width: 100%; min-height: 165px; flex-basis: auto; }
  .coin-pot-copy { width: 100%; padding: 18px; }
  .coin-pot-display > i { width: 95px; left: calc(50% - 47px); right: auto; bottom: 16px; }
  .coin-pot-display::before { width: 116px; left: calc(50% - 58px); right: auto; top: 20px; bottom: 15px; }
  .coin-seed-card { flex-direction: column; text-align: center; gap: 8px; }
  .coin-seed-card .garden-plant { flex-basis: auto; }
}
@media (max-width: 1000px) {
  .coin-intro { grid-template-columns: minmax(0, 1fr); }
  .coin-studio { min-height: 290px; }
  .coin-studio-copy { width: 60%; }
  .coin-studio h2 { font-size: 36px; }
  .coin-studio-scene { width: 290px; right: 5%; top: 10px; transform: none; }
  .coin-wallet { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); column-gap: 24px; padding: 20px 24px; }
  .coin-balance { margin-top: 8px; font-size: 30px; }
  .coin-wallet-heading, .coin-balance, .coin-checkin-state { grid-column: 1; }
  .coin-metrics { grid-column: 2; grid-row: 1 / 4; border-top: 0; border-left: 1px solid #f1efd81c; margin: 0; padding: 0 0 0 22px; align-content: center; }
  .coin-tab-copy > span { display: none; }
  .coin-tabs > button { justify-content: center; padding: 13px 8px; }
  .coin-tab-copy strong { font-size: 11px; }
  .coin-discover { flex-wrap: wrap; gap: 18px; }
  .coin-discover > div { width: 100%; }
  .coin-plant-card, .coin-plant-empty { padding: 15px; }
  .coin-plant-heading > span:first-child { display: none; }
  .coin-plant-heading { justify-content: center; }
  .coin-plant-progress { flex-direction: column; text-align: center; }
}
@media (max-width: 700px) {
  .coin-workshop { gap: 20px; }
  .coin-studio { padding: 24px 22px 67px; }
  .coin-studio-copy { width: 62%; }
  .coin-studio h2 { font-size: 32px; }
  .coin-studio-copy p { font-size: 10px; }
  .coin-studio-scene { width: 230px; right: -28px; top: 20px; transform: scale(.8); transform-origin: right center; }
  .coin-eyebrow { font-size: 7px; letter-spacing: 1.4px; }
  .coin-wallet { padding: 20px; column-gap: 15px; }
  .coin-balance { font-size: 25px; }
  .coin-metrics { column-gap: 10px; padding-left: 15px; }
  .coin-metrics strong { font-size: 12px; }
  .coin-checkin-state { font-size: 9px; }
  .coin-tabs { display: flex; overflow-x: auto; }
  .coin-tabs > button { flex: 0 0 auto; padding: 12px; }
  .coin-tab-copy strong { font-size: 12px; }
  .coin-section-head { align-items: flex-start; flex-direction: column; gap: 10px; }
  .coin-section-head h2 { font-size: 20px; }
  .coin-section-note { display: none; }
  .coin-theme-art { height: 165px; }
  .coin-product-footer .coin-price { font-size: 18px; }
  .coin-product-copy { padding-inline: 7px; }
  .coin-product p { min-height: 40px; }
  .coin-product-footer { margin-inline: 7px; }
  .coin-garden-grid, .coin-pot-grid, .coin-seed-grid { grid-template-columns: 1fr; }
  .coin-pot-product, .coin-seed-card { flex-direction: row; text-align: left; }
  .coin-pot-display { width: 130px; flex: 0 0 130px; min-height: 185px; }
  .coin-pot-copy { padding-left: 18px; }
  .coin-seed-card { padding: 20px; gap: 20px; }
  .coin-collection-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .coin-plant-progress { flex-direction: row; }
  .coin-plant-empty { min-height: 300px; }
  .coin-ledger-panel { padding: 18px; }
  .coin-ledger-pagination { flex-wrap: wrap; }
}
@media (max-width: 460px) {
  .coin-studio-scene { opacity: .3; right: -65px; z-index: -1; }
  .coin-studio-copy { width: 100%; }
  .coin-wallet { display: block; }
  .coin-metrics { border-left: 0; border-top: 1px solid #f1efd81c; margin-top: 20px; padding: 18px 0 0; }
  .coin-theme-grid { grid-template-columns: 1fr; }
  .coin-theme-art { height: 200px; }
  .coin-product p { min-height: 0; }
}
@media (prefers-reduced-motion: reduce) { .coin-tabs > button, .coin-product { transition: none; } }
</style>
