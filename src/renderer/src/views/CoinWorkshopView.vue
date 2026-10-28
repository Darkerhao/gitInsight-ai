<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ArrowDownLeft, ArrowUpRight, Check, Coins, Flower2, Palette, RefreshCw, ShoppingBag, Sprout } from 'lucide-vue-next';
import { ElMessage, ElMessageBox, ElSkeleton } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import GardenPlant from '@/components/rewards/GardenPlant.vue';
import WorkMemoryCards from '@/components/rewards/WorkMemoryCards.vue';
import { useCoinWorkshop } from '@/composables/useCoinWorkshop';
import { COIN_SHOP_ITEMS } from '@shared/coinWorkshop';
import type { CoinShopItem, CoinTransactionPage, CoinTransactionQuery } from '@shared/coinWorkshop';

const workshop = useCoinWorkshop();
const { snapshot, loading, error, pending } = workshop;
const tab = ref<'shop' | 'garden' | 'cards' | 'ledger'>('shop');
const themes = COIN_SHOP_ITEMS.filter(item => item.kind === 'theme');
const pots = COIN_SHOP_ITEMS.filter(item => item.kind === 'pot');
const seeds = COIN_SHOP_ITEMS.filter(item => item.kind === 'seed');
const growing = computed(() => snapshot.value?.plants.filter(plant => !plant.harvestedAt) ?? []);
const collection = computed(() => snapshot.value?.plants.filter(plant => plant.harvestedAt) ?? []);
const freeSlots = computed(() => 3 - growing.value.length);
const balance = computed(() => snapshot.value?.wallet.wallet.coins ?? 0);
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
    <PageHeader title="码币工坊" subtitle="把每天的积累，变成属于你的工作空间。">
      <template #actions><el-button :icon="RefreshCw" :loading="loading" :disabled="Boolean(pending)" @click="refresh">刷新工坊</el-button></template>
    </PageHeader>

    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" role="alert">
      <el-button link type="primary" :disabled="Boolean(pending)" @click="refresh">重新读取工坊</el-button>
    </el-alert>
    <el-skeleton v-if="loading && !snapshot" :rows="8" animated />

    <template v-if="snapshot">
      <section class="surface-card coin-balance-card" aria-label="我的码币">
        <div class="coin-balance-copy">
          <div class="coin-eyebrow"><Coins :size="16" /> 我的码币</div>
          <strong data-coin-balance>{{ amount(balance) }}<small>码币</small></strong>
          <p>每天签到积累，换一份看得见的喜欢。</p>
          <span class="coin-checkin-state">{{ snapshot.wallet.checkedInToday ? '今日已签到' : '今日待签到 · 点击顶部码币领取奖励' }}</span>
        </div>
        <div class="coin-balance-art" aria-hidden="true"><span class="coin-art-ring" /><GardenPlant seed-id="seed-clover" :pot-id="snapshot.equippedPotId" /><span class="coin-art-label">GROW AT YOUR OWN PACE</span></div>
      </section>

      <div class="coin-metrics" aria-label="码币收支统计">
        <div><span><ArrowDownLeft :size="14" /> 今日获得</span><strong data-coin-stat="today-income">+{{ amount(snapshot.summary.todayIncome) }}</strong><small>{{ snapshot.wallet.today }}</small></div>
        <div><span><ArrowUpRight :size="14" /> 今日消费</span><strong data-coin-stat="today-spent">{{ amount(snapshot.summary.todaySpent) }}</strong><small>每一笔都有记录</small></div>
        <div><span>累计收入</span><strong data-coin-stat="total-income">{{ amount(snapshot.summary.totalIncome) }}</strong><small>含签到、奖励与迁入</small></div>
        <div><span>累计消费</span><strong data-coin-stat="total-spent">{{ amount(snapshot.summary.totalSpent) }}</strong><small>装扮、种子与视觉特效</small></div>
      </div>

      <nav class="coin-tabs" role="tablist" aria-label="工坊内容">
        <button id="coin-shop-tab" role="tab" :aria-selected="tab === 'shop'" aria-controls="coin-shop-panel" @click="tab = 'shop'"><ShoppingBag :size="17" />装扮商店</button>
        <button id="coin-garden-tab" role="tab" :aria-selected="tab === 'garden'" aria-controls="coin-garden-panel" @click="tab = 'garden'"><Sprout :size="17" />代码花园<span>{{ growing.length }}/3</span></button>
        <button id="coin-cards-tab" role="tab" :aria-selected="tab === 'cards'" aria-controls="coin-cards-panel" @click="tab = 'cards'"><Palette :size="17" />工作纪念卡</button>
        <button id="coin-ledger-tab" role="tab" :aria-selected="tab === 'ledger'" aria-controls="coin-ledger-panel" @click="tab = 'ledger'"><Coins :size="17" />收支明细</button>
      </nav>

      <WorkMemoryCards v-if="tab === 'cards'" id="coin-cards-panel" role="tabpanel" aria-labelledby="coin-cards-tab" :owned-item-ids="snapshot.ownedItemIds" :balance="balance" :pending="pending" @purchase="purchase" />
      <section v-if="tab === 'shop'" id="coin-shop-panel" role="tabpanel" aria-labelledby="coin-shop-tab" class="coin-shop-panel">
        <div class="coin-section-head"><div><h2><Palette :size="20" /> 为工作台换一种心情</h2><p>一次购买，永久拥有。明亮与深色模式都能使用。</p></div><span class="coin-section-note">购买后点击使用，即刻切换配色</span></div>
        <div class="coin-theme-grid">
          <article v-for="item in themes" :key="item.id" class="surface-card coin-product" :class="{ 'is-equipped': equipped(item) }" :data-product="item.id" :style="{ '--item-accent': item.accent }">
            <div class="coin-theme-preview" aria-label="配色预览"><div class="preview-sidebar"><i /><i /><i /></div><div class="preview-main"><span /><div><i /><i /><i /></div><b /><em /></div><span v-if="equipped(item)" class="coin-owned-badge"><Check :size="12" />正在使用</span><span v-else-if="owned(item.id)" class="coin-owned-badge">已拥有</span></div>
            <div class="coin-product-copy"><h3>{{ item.name }}</h3><p>{{ item.description }}</p><strong class="coin-price">{{ item.price ? `${amount(item.price)} 码币` : '默认装扮 · 免费' }}</strong></div>
            <el-button :type="equipped(item) ? 'default' : 'primary'" :plain="!owned(item.id)" :disabled="Boolean(pending) || equipped(item) || (!owned(item.id) && balance < item.price)" :loading="pending === `buy:${item.id}` || pending === `equip:${item.id}`" @click="owned(item.id) ? useItem(item) : purchase(item)">{{ itemAction(item) }}</el-button>
          </article>
        </div>

        <div class="coin-section-head"><div><h2><Flower2 :size="20" /> 花盆，也有自己的风格</h2><p>给整个花园换上喜欢的花盆，收藏的植物也会一起换装。</p></div></div>
        <div class="coin-pot-grid">
          <article v-for="item in pots" :key="item.id" class="surface-card coin-pot-product" :class="{ 'is-equipped': equipped(item) }" :data-product="item.id">
            <GardenPlant seed-id="seed-clover" :pot-id="item.id" />
            <div><h3>{{ item.name }}</h3><p>{{ item.description }}</p><strong class="coin-price">{{ item.price ? `${amount(item.price)} 码币` : '默认花盆 · 免费' }}</strong><el-button :type="equipped(item) ? 'default' : 'primary'" plain :disabled="Boolean(pending) || equipped(item) || (!owned(item.id) && balance < item.price)" :loading="pending === `buy:${item.id}` || pending === `equip:${item.id}`" @click="owned(item.id) ? useItem(item) : purchase(item)">{{ itemAction(item) }}</el-button></div>
          </article>
        </div>
      </section>

      <section v-if="tab === 'garden'" id="coin-garden-panel" role="tabpanel" aria-labelledby="coin-garden-tab">
        <div class="coin-section-head"><div><h2><Sprout :size="20" /> 每一份日报，都在悄悄生长</h2><p>种下后保存有效日报，每个不同的工作日期提供一天成长。同日多份日报只计一次。</p></div><span class="coin-section-note">{{ freeSlots }} 个空闲生长位</span></div>
        <div class="coin-garden-grid">
          <article v-for="plant in growing" :key="plant.id" class="surface-card coin-plant-card" :data-plant="plant.id">
            <span class="coin-plant-status">{{ plant.growthDays >= plant.requiredDays ? '已成熟 · 可以收藏' : '生长中' }}</span>
            <GardenPlant :seed-id="plant.seedId" :progress="plant.growthDays / plant.requiredDays" :pot-id="snapshot.equippedPotId" />
            <h3>{{ itemFor(plant.seedId)?.name }}</h3>
            <p>{{ plant.growthDays >= plant.requiredDays ? '一段认真工作的时光，长成了新的收藏。' : `还需要 ${plant.requiredDays - plant.growthDays} 个工作日期的日报` }}</p>
            <el-progress :percentage="Math.min(100, Math.round(plant.growthDays / plant.requiredDays * 100))" :show-text="false" :stroke-width="6" />
            <div class="coin-plant-progress">成长 {{ Math.min(plant.growthDays, plant.requiredDays) }}/{{ plant.requiredDays }} 天<span>{{ new Date(plant.plantedAt).toLocaleDateString('zh-CN') }} 种下</span></div>
            <el-button :type="plant.growthDays >= plant.requiredDays ? 'primary' : 'default'" :disabled="Boolean(pending) || plant.growthDays < plant.requiredDays" :loading="pending === `harvest:${plant.id}`" @click="harvest(plant.id)">{{ plant.growthDays >= plant.requiredDays ? '收入图鉴' : '等待下一份日报' }}</el-button>
          </article>
          <article v-for="slot in freeSlots" :key="`empty-${slot}`" class="coin-plant-empty"><span class="coin-empty-soil"><Sprout :size="35" :stroke-width="1.3" /></span><h3>留给下一颗种子</h3><p>在下方选一株喜欢的植物<br />让工作与生活一起生长</p></article>
        </div>

        <div class="coin-section-head"><div><h2>选一颗种子，开始新的积累</h2><p>购买即种下，占用一个生长位；成熟收藏后即可重新种植。</p></div></div>
        <div class="coin-seed-grid">
          <article v-for="item in seeds" :key="item.id" class="surface-card coin-seed-card" :data-product="item.id">
            <GardenPlant :seed-id="item.id" :pot-id="snapshot.equippedPotId" />
            <div><h3>{{ item.name }}</h3><p>{{ item.description }}</p><span class="coin-seed-days">{{ item.growthDays }} 个工作日期成熟</span><strong class="coin-price">{{ amount(item.price) }} 码币</strong><el-button type="primary" plain :disabled="Boolean(pending) || freeSlots <= 0 || balance < item.price" :loading="pending === `buy:${item.id}`" @click="purchase(item)">{{ freeSlots <= 0 ? '生长位已满' : itemAction(item) }}</el-button></div>
          </article>
        </div>

        <div class="coin-section-head"><div><h2>我的植物图鉴 <span class="coin-count">{{ collection.length }}</span></h2><p>成熟植物会一直保留在这里，记录你曾经认真工作的日子。</p></div></div>
        <div v-if="collection.length" class="coin-collection-grid"><article v-for="plant in collection" :key="plant.id" class="coin-collection-item"><GardenPlant :seed-id="plant.seedId" :pot-id="snapshot.equippedPotId" /><h3>{{ itemFor(plant.seedId)?.name }}</h3><span>{{ new Date(plant.harvestedAt!).toLocaleDateString('zh-CN') }} 收藏</span></article></div>
        <div v-else class="coin-collection-empty"><Flower2 :size="24" /><span>第一株成熟的植物，会成为这本图鉴的开篇。</span></div>
      </section>

      <section v-if="tab === 'ledger'" id="coin-ledger-panel" role="tabpanel" aria-labelledby="coin-ledger-tab" class="surface-card coin-ledger-panel">
        <div class="coin-section-head"><div><h2>每一枚码币，都有来处</h2><p>完整保留签到、奖励与消费记录，按发生时间从新到旧排列。</p></div><div class="coin-ledger-filters" aria-label="收支筛选"><button v-for="filter in [{ id: 'all', label: '全部' }, { id: 'income', label: '收入' }, { id: 'spend', label: '支出' }] as const" :key="filter.id" :aria-pressed="ledgerType === filter.id" @click="setLedgerType(filter.id)">{{ filter.label }}</button></div></div>
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
.coin-workshop { max-width: 1440px; margin: 0 auto; width: 100%; }
.coin-balance-card { padding: 26px 32px; display: flex; justify-content: space-between; align-items: center; overflow: hidden; position: relative; }
.coin-balance-copy { z-index: 1; }
.coin-eyebrow { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--c-text-muted); }
.coin-balance-copy > strong { display: block; margin: 9px 0; font-size: clamp(30px, 3.3vw, 48px); letter-spacing: -.045em; font-variant-numeric: tabular-nums; line-height: 1.15; }
.coin-balance-copy strong small { margin-left: 12px; font-size: 13px; font-weight: 500; letter-spacing: 0; color: var(--c-text-faint); }
.coin-balance-copy p { color: var(--c-text-muted); margin: 0 0 15px; font-size: 13px; }
.coin-checkin-state { font-size: 12px; border: 1px solid var(--c-border); padding: 5px 10px; border-radius: 20px; color: var(--c-primary); background: var(--c-primary-soft); }
.coin-balance-art { width: 250px; height: 160px; display: grid; place-items: center; position: relative; }
.coin-balance-art .garden-plant { position: relative; width: 155px; height: 155px; transform: translateY(-6px); }
.coin-art-ring { width: 245px; height: 245px; border-radius: 50%; border: 1px solid color-mix(in srgb, var(--c-primary) 15%, transparent); background: radial-gradient(circle, var(--c-primary-soft), transparent 70%); position: absolute; top: -44px; }
.coin-art-ring::after { content: ''; position: absolute; inset: 22px; border: 1px dashed color-mix(in srgb, var(--c-primary) 20%, transparent); border-radius: inherit; }
.coin-art-label { position: absolute; bottom: -7px; font-size: 9px; letter-spacing: .16em; color: var(--c-text-faint); }
.coin-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid var(--c-border); border-radius: 16px; background: var(--c-surface-muted); }
.coin-metrics > div { min-width: 0; display: flex; flex-direction: column; gap: 9px; padding: 18px 22px; }
.coin-metrics > div + div { border-left: 1px solid var(--c-border); }
.coin-metrics span { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--c-text-muted); }
.coin-metrics strong { font-size: clamp(17px, 1.8vw, 25px); letter-spacing: -.035em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.coin-metrics small { font-size: 11px; color: var(--c-text-faint); }
.coin-tabs { display: flex; gap: 5px; border-bottom: 1px solid var(--c-border); margin-top: 6px; }
.coin-tabs button { display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--c-text-muted); background: transparent; border: 0; border-bottom: 2px solid transparent; padding: 15px 21px; font: inherit; font-size: 14px; }
.coin-tabs button[aria-selected='true'] { color: var(--c-primary); border-bottom-color: var(--c-primary); font-weight: 650; }
.coin-tabs button span { font-size: 10px; border: 1px solid var(--c-border); border-radius: 6px; padding: 1px 4px; }
.coin-section-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 8px 0 20px; }
.coin-section-head h2 { display: flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 650; margin: 0 0 8px; letter-spacing: -.025em; }
.coin-section-head h2 svg { color: var(--c-primary); }
.coin-section-head p { margin: 0; font-size: 12px; color: var(--c-text-muted); line-height: 1.65; }
.coin-section-note { font-size: 11px; color: var(--c-text-faint); flex-shrink: 0; }
.coin-theme-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 32px; }
.coin-product { min-width: 0; padding: 10px; border-radius: 16px; }
.coin-product.is-equipped, .coin-pot-product.is-equipped { border-color: var(--c-primary); }
.coin-theme-preview { height: 118px; display: flex; gap: 8px; background: #171b20; border-radius: 10px; padding: 13px; position: relative; overflow: hidden; }
.preview-sidebar { width: 22%; border-radius: 5px; background: #252b30; padding: 9px 5px; display: flex; flex-direction: column; gap: 9px; }
.preview-sidebar i { display: block; width: 100%; height: 3px; background: #545e67; border-radius: 2px; }
.preview-sidebar i:nth-child(2) { background: var(--item-accent); }
.preview-main { display: flex; flex-direction: column; gap: 10px; width: 78%; padding: 3px 0; }
.preview-main > span { height: 6px; width: 48%; border-radius: 2px; background: #c6cbd1; }
.preview-main > div { display: flex; gap: 5px; }
.preview-main i { flex: 1; height: 27px; border-radius: 4px; background: #2a3137; border-top: 2px solid color-mix(in srgb, var(--item-accent) 70%, transparent); }
.preview-main b { height: 3px; width: 83%; background: #444e56; border-radius: 2px; }
.preview-main em { height: 12px; width: 35%; background: var(--item-accent); border-radius: 3px; }
.coin-owned-badge { position: absolute; right: 6px; top: 6px; display: flex; align-items: center; gap: 3px; padding: 4px 6px; border-radius: 6px; font-size: 10px; color: #101a13; background: var(--item-accent); }
.coin-product-copy { padding: 16px 3px 14px; }
.coin-product h3, .coin-pot-product h3, .coin-seed-card h3, .coin-plant-card h3, .coin-plant-empty h3, .coin-collection-item h3 { font-size: 14px; margin: 0 0 7px; font-weight: 650; }
.coin-product p { color: var(--c-text-muted); font-size: 11px; line-height: 1.7; min-height: 38px; margin: 0 0 13px; }
.coin-price { font-size: 12px; color: var(--c-text); font-weight: 600; font-variant-numeric: tabular-nums; display: block; }
.coin-product > .el-button { width: 100%; margin: 0; font-size: 12px; }
.coin-pot-grid, .coin-seed-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 32px; }
.coin-pot-product, .coin-seed-card { display: flex; align-items: center; padding: 14px; border-radius: 16px; min-width: 0; gap: 9px; }
.coin-pot-product .garden-plant, .coin-seed-card .garden-plant { flex: 0 0 80px; width: 80px; height: 100px; }
.coin-pot-product p, .coin-seed-card p { font-size: 11px; color: var(--c-text-muted); line-height: 1.7; margin: 0 0 8px; }
.coin-pot-product .el-button, .coin-seed-card .el-button { margin: 12px 0 0; font-size: 11px; max-width: 100%; }
.coin-seed-days { display: block; margin-bottom: 10px; font-size: 11px; color: var(--c-text-faint); }
.coin-garden-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin-bottom: 32px; }
.coin-plant-card, .coin-plant-empty { min-width: 0; border-radius: 18px; min-height: 323px; padding: 20px; }
.coin-plant-card { display: flex; flex-direction: column; align-items: center; }
.coin-plant-status { font-size: 10px; color: var(--c-primary); background: var(--c-primary-soft); border-radius: 12px; padding: 4px 8px; }
.coin-plant-card .garden-plant { width: 145px; height: 150px; margin: 6px 0 0; }
.coin-plant-card p { color: var(--c-text-muted); font-size: 11px; text-align: center; line-height: 1.6; min-height: 18px; margin: 0 0 15px; }
.coin-plant-card .el-progress, .coin-plant-card .el-button { width: 100%; }
.coin-plant-progress { display: flex; justify-content: space-between; gap: 5px; width: 100%; font-size: 10px; color: var(--c-text-muted); margin: 8px 0 15px; }
.coin-plant-progress span { color: var(--c-text-faint); }
.coin-plant-empty { border: 1px dashed var(--c-border-strong); display: flex; flex-direction: column; justify-content: center; align-items: center; background: var(--c-surface-muted); }
.coin-empty-soil { color: var(--c-text-faint); border: 1px solid var(--c-border); width: 76px; height: 76px; border-radius: 50%; display: grid; place-items: center; margin-bottom: 25px; }
.coin-plant-empty h3 { color: var(--c-text-muted); font-weight: 500; }
.coin-plant-empty p { color: var(--c-text-faint); font-size: 11px; text-align: center; line-height: 1.9; margin: 5px 0 0; }
.coin-count { display: inline-flex; align-items: center; justify-content: center; font-size: 11px; background: var(--c-surface-inset); border-radius: 8px; min-width: 24px; height: 21px; }
.coin-collection-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 15px; }
.coin-collection-item { display: flex; flex-direction: column; align-items: center; background: var(--c-surface-muted); border: 1px solid var(--c-border); border-radius: 15px; padding: 12px; }
.coin-collection-item .garden-plant { width: 105px; height: 115px; }
.coin-collection-item span { color: var(--c-text-faint); font-size: 10px; }
.coin-collection-empty { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 35px 15px; border: 1px dashed var(--c-border); border-radius: 15px; color: var(--c-text-faint); font-size: 12px; }
.coin-ledger-panel { padding: 22px; border-radius: 18px; }
.coin-ledger-filters { display: flex; padding: 3px; background: var(--c-surface-inset); border-radius: 9px; flex-shrink: 0; }
.coin-ledger-filters button { border: 0; background: transparent; border-radius: 6px; padding: 7px 13px; color: var(--c-text-muted); cursor: pointer; font: inherit; font-size: 12px; }
.coin-ledger-filters button[aria-pressed='true'] { color: var(--c-primary); background: var(--c-surface); }
.coin-ledger-table { font-size: 12px; --el-table-bg-color: transparent; --el-table-tr-bg-color: transparent; --el-table-header-bg-color: var(--c-surface-muted); --el-table-border-color: var(--c-border); }
.coin-ledger-time { color: var(--c-text-muted); font-size: 11px; }
.coin-income { color: var(--c-primary); font-variant-numeric: tabular-nums; }
.coin-expense { color: var(--c-text); font-variant-numeric: tabular-nums; }
.coin-ledger-pagination { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 20px; }
.coin-ledger-pagination > span { font-size: 11px; color: var(--c-text-faint); }
@media (max-width: 1150px) { .coin-theme-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .coin-pot-product, .coin-seed-card { flex-direction: column; text-align: center; } .coin-section-note { display: none; } }
@media (max-width: 700px) { .coin-balance-card { padding: 22px; } .coin-balance-art { display: none; } .coin-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } .coin-metrics > div:nth-child(3) { border-left: 0; } .coin-metrics > div:nth-child(n+3) { border-top: 1px solid var(--c-border); } .coin-tabs button { padding: 13px 10px; font-size: 12px; } .coin-garden-grid, .coin-pot-grid, .coin-seed-grid { grid-template-columns: 1fr; } .coin-pot-product, .coin-seed-card { flex-direction: row; text-align: left; } .coin-collection-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .coin-section-head { align-items: flex-start; flex-direction: column; } .coin-ledger-panel { padding: 15px; } }
</style>
