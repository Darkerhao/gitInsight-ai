<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Coins,
  Droplets,
  Leaf,
  LockKeyhole,
  PackageCheck,
  RefreshCw,
  Sparkles,
  Sprout,
  Sun,
  Wheat,
  Zap,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import type { JiaziFarmPlot, JiaziFarmResourceType, JiaziFarmSnapshot, JiaziFarmTask } from '@shared/types';

const snapshot = ref<JiaziFarmSnapshot | null>(null);
const loading = ref(false);
const selectedSlot = ref(1);
// 统一的操作 loading key：task.key / water:<资源> / ripen / plant:<tier> / unlock-crop / unlock-plot / harvest
const actionLoadingKey = ref('');

const resourceMeta: Record<JiaziFarmResourceType, { label: string; icon: typeof Droplets; tone: string }> = {
  water: { label: '露水', icon: Droplets, tone: '#0ea5e9' },
  sunlight: { label: '阳光', icon: Sun, tone: '#d97706' },
  nutrient: { label: '养分', icon: Leaf, tone: '#16a34a' },
};

const resourceTypes: JiaziFarmResourceType[] = ['water', 'sunlight', 'nutrient'];

const coins = computed(() => snapshot.value?.coins ?? 0);

const selectedPlot = computed<JiaziFarmPlot | null>(() => {
  if (!snapshot.value) return null;
  return (
    snapshot.value.plots.find((plot) => plot.slot === selectedSlot.value) ?? snapshot.value.plots[0] ?? null
  );
});

const growthPercent = computed(() => {
  const plot = selectedPlot.value;
  if (!plot || plot.growthToHarvest <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((plot.growth / plot.growthToHarvest) * 100)));
});

const claimedTaskCount = computed(() => snapshot.value?.tasks.filter((task) => task.claimed).length ?? 0);
const availableTaskCount = computed(
  () => snapshot.value?.tasks.filter((task) => task.available && !task.claimed).length ?? 0,
);

const totalHarvests = computed(() =>
  (snapshot.value?.plots ?? []).reduce((sum, plot) => sum + plot.totalHarvests, 0),
);

const resourceCards = computed(() => {
  const plot = selectedPlot.value;
  return resourceTypes.map((key) => ({
    key,
    value: plot?.[key] ?? 0,
    ...resourceMeta[key],
  }));
});

const fieldRows = computed(() =>
  Array.from({ length: 12 }, (_, index) => ({
    key: index,
    active: growthPercent.value >= (index + 1) * (100 / 12),
  })),
);

const cropStageLabel = computed(() => {
  const growth = growthPercent.value;
  if (growth >= 100) return '成熟待收';
  if (growth >= 70) return '抽穗成形';
  if (growth >= 40) return '稳步生长';
  if (growth > 0) return '新芽出土';
  return '等待播种';
});

// 一键催熟当前地块的花费 = (收获线 − 当前成长) × 单价
const ripenCost = computed(() => {
  const plot = selectedPlot.value;
  if (!plot) return 0;
  const gap = Math.max(0, plot.growthToHarvest - plot.growth);
  return gap * (snapshot.value?.coinPerGrowth ?? 0);
});

const waterCost = computed(() => snapshot.value?.waterPack.cost ?? 0);

// 当前地块可切换种植的已解锁作物档次（排除正在种的）
const plantableCropTiers = computed(() => {
  const plot = selectedPlot.value;
  return (snapshot.value?.cropTiers ?? []).filter((tier) => tier.unlocked && tier.tier !== plot?.cropTier);
});

function formatCoins(value: number) {
  return new Intl.NumberFormat('zh-CN').format(Math.max(0, Math.floor(Number(value) || 0)));
}

function getTaskIcon(task: JiaziFarmTask) {
  if (task.claimed) return CheckCircle2;
  if (task.available) return PackageCheck;
  return CircleDashed;
}

function getTaskStatusText(task: JiaziFarmTask) {
  if (task.claimed) return '已领取';
  if (task.available) return '可领取';
  return '待达成';
}

function getTaskStatusType(task: JiaziFarmTask) {
  if (task.claimed) return 'success';
  if (task.available) return 'warning';
  return 'info';
}

function formatDateTime(value: string) {
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

function formatResources(resources: Partial<Record<JiaziFarmResourceType, number>>) {
  return (
    (Object.entries(resources) as Array<[JiaziFarmResourceType, number]>)
      .filter(([, value]) => Number(value) > 0)
      .map(([key, value]) => `${resourceMeta[key].label} ${value}`)
      .join('、') || '暂无资源'
  );
}

function applySnapshot(next: JiaziFarmSnapshot) {
  snapshot.value = next;
  // 若当前选中地块已不存在（理论上不会），回落到第一块
  if (!next.plots.some((plot) => plot.slot === selectedSlot.value)) {
    selectedSlot.value = next.plots[0]?.slot ?? 1;
  }
}

async function loadSnapshot(options: { silent?: boolean } = {}) {
  loading.value = true;
  try {
    applySnapshot(await window.api.getJiaziFarmSnapshot());
    if (!options.silent) ElMessage.success('甲子农场已刷新');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载甲子农场失败');
  } finally {
    loading.value = false;
  }
}

// 统一的操作包装：跑一次 window.api 调用，成功后套用新 snapshot，失败弹中文错误
async function runAction(key: string, action: () => Promise<JiaziFarmSnapshot>, successText?: string) {
  if (actionLoadingKey.value) return;
  actionLoadingKey.value = key;
  try {
    applySnapshot(await action());
    if (successText) ElMessage.success(successText);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败');
  } finally {
    actionLoadingKey.value = '';
  }
}

async function claimTask(task: JiaziFarmTask) {
  if (!snapshot.value || task.claimed || !task.available) return;
  await runAction(
    task.key,
    () =>
      window.api.claimJiaziFarmTask({
        date: snapshot.value!.date,
        plotSlot: selectedSlot.value,
        taskKey: task.key,
      }),
    `已领取 ${task.rewardAmount} ${resourceMeta[task.resourceType].label}`,
  );
}

async function water(resourceType: JiaziFarmResourceType) {
  if (!snapshot.value) return;
  await runAction(
    `water:${resourceType}`,
    () =>
      window.api.waterJiaziPlot({
        date: snapshot.value!.date,
        plotSlot: selectedSlot.value,
        resourceType,
      }),
    `已浇灌 ${resourceMeta[resourceType].label}`,
  );
}

async function quickRipen() {
  if (!snapshot.value || !selectedPlot.value) return;
  await runAction(
    'ripen',
    () => window.api.quickRipenJiaziPlot({ date: snapshot.value!.date, plotSlot: selectedSlot.value }),
    '作物已催熟到收获线',
  );
}

async function plant(cropTier: number) {
  if (!snapshot.value) return;
  await runAction(
    `plant:${cropTier}`,
    () =>
      window.api.plantJiaziCrop({ date: snapshot.value!.date, plotSlot: selectedSlot.value, cropTier }),
    '已改种新作物，成长重新开始',
  );
}

async function unlockCropTier(tierName: string) {
  if (!snapshot.value) return;
  await runAction(
    'unlock-crop',
    () => window.api.unlockJiaziCropTier(snapshot.value!.date),
    `已解锁作物「${tierName}」`,
  );
}

async function unlockPlot() {
  if (!snapshot.value) return;
  await runAction('unlock-plot', () => window.api.unlockJiaziPlot(snapshot.value!.date), '已解锁新地块');
}

async function harvest() {
  const plot = selectedPlot.value;
  if (!snapshot.value || !plot?.canHarvest) return;
  const reward = plot.harvestReward;
  await runAction(
    'harvest',
    () => window.api.harvestJiaziFarm({ date: snapshot.value!.date, plotSlot: selectedSlot.value }),
    `丰收完成，反哺 ${formatCoins(reward)} 甲币`,
  );
}

onMounted(() => {
  void loadSnapshot({ silent: true });
});
</script>

<template>
  <div class="view-stack jiazi-farm-view">
    <PageHeader title="甲子农场" subtitle="用甲币浇灌、催熟、解锁作物与地块，让工作沉淀成可持续经营的农场">
      <template #actions>
        <el-button :icon="RefreshCw" :loading="loading" plain @click="loadSnapshot()">刷新农场</el-button>
      </template>
    </PageHeader>

    <div v-if="snapshot" class="farm-summary-grid">
      <section class="surface-card farm-summary-card">
        <CalendarDays :size="20" />
        <span>今日干支</span>
        <strong>{{ snapshot.ganzhiName }}</strong>
        <small>第 {{ snapshot.cycleDay }} / 60 天 · {{ snapshot.seasonLabel }}</small>
      </section>
      <section class="surface-card farm-summary-card is-coin">
        <Coins :size="20" />
        <span>甲币余额</span>
        <strong>{{ formatCoins(coins) }}</strong>
        <small>浇灌 / 催熟 / 解锁均消耗甲币</small>
      </section>
      <section class="surface-card farm-summary-card">
        <Sprout :size="20" />
        <span>地块 / 作物</span>
        <strong>{{ snapshot.state.unlockedPlotCount }} 块 · {{ snapshot.state.unlockedCropTier }} 档</strong>
        <small>累计丰收 {{ totalHarvests }} 次</small>
      </section>
      <section class="surface-card farm-summary-card">
        <PackageCheck :size="20" />
        <span>今日农事</span>
        <strong>{{ claimedTaskCount }}/{{ snapshot.tasks.length }}</strong>
        <small>{{ availableTaskCount }} 项可领取</small>
      </section>
    </div>

    <!-- 地块选择区 -->
    <section v-if="snapshot" class="surface-card farm-plot-picker">
      <button
        v-for="plot in snapshot.plots"
        :key="plot.slot"
        class="farm-plot-chip"
        :class="{ active: plot.slot === selectedSlot }"
        type="button"
        @click="selectedSlot = plot.slot"
      >
        <span class="farm-plot-chip-head">
          <strong>地块 {{ plot.slot }}</strong>
          <em v-if="plot.canHarvest" class="ripe-dot">熟</em>
        </span>
        <small>{{ plot.cropName }} · Lv.{{ plot.level }}</small>
        <span class="farm-plot-chip-bar">
          <span :style="{ width: `${Math.min(100, Math.round((plot.growth / plot.growthToHarvest) * 100))}%` }" />
        </span>
      </button>
      <button
        v-if="!snapshot.plotUnlock.maxed"
        class="farm-plot-chip is-unlock"
        type="button"
        :disabled="!snapshot.plotUnlock.canAfford || actionLoadingKey === 'unlock-plot'"
        @click="unlockPlot"
      >
        <LockKeyhole :size="18" />
        <strong>解锁地块 {{ snapshot.plotUnlock.nextSlot }}</strong>
        <small>{{ formatCoins(snapshot.plotUnlock.cost) }} 甲币</small>
      </button>
    </section>

    <div v-if="snapshot && selectedPlot" class="content-grid has-right-panel farm-layout">
      <div class="view-stack">
        <section class="surface-card farm-field-card">
          <div class="farm-field-head">
            <div>
              <span>{{ snapshot.seasonLabel }} · {{ snapshot.ganzhiName }} · 地块 {{ selectedPlot.slot }}</span>
              <h2>{{ selectedPlot.cropName }}</h2>
              <p>{{ cropStageLabel }}，浇灌或完成今日农事推动成长，成熟后收获反哺甲币。</p>
            </div>
            <el-button
              type="primary"
              :icon="Wheat"
              :disabled="!selectedPlot.canHarvest"
              :loading="actionLoadingKey === 'harvest'"
              @click="harvest"
            >
              {{ selectedPlot.canHarvest ? `收获 +${formatCoins(selectedPlot.harvestReward)}` : '尚未成熟' }}
            </el-button>
          </div>

          <div class="farm-field-stage" :style="{ '--growth': `${growthPercent}%` }">
            <div class="farm-sun"><Sun :size="28" /></div>
            <div class="farm-ground">
              <span v-for="row in fieldRows" :key="row.key" :class="{ active: row.active }" />
            </div>
            <div class="farm-crop">
              <Sprout v-if="growthPercent < 40" :size="64" />
              <Leaf v-else-if="growthPercent < 100" :size="78" />
              <Wheat v-else :size="86" />
            </div>
          </div>

          <div class="farm-progress-row">
            <el-progress :percentage="growthPercent" :stroke-width="12" :show-text="false" />
            <small>{{ selectedPlot.growth }} / {{ selectedPlot.growthToHarvest }} 成长</small>
          </div>

          <div class="farm-resource-grid">
            <div
              v-for="resource in resourceCards"
              :key="resource.key"
              class="farm-resource-card"
              :style="{ '--resource-tone': resource.tone }"
            >
              <component :is="resource.icon" :size="18" />
              <span>{{ resource.label }}</span>
              <strong>{{ resource.value }}</strong>
            </div>
          </div>
        </section>

        <!-- 甲币操作区 -->
        <section class="surface-card farm-shop-card">
          <div class="panel-head">
            <div>
              <h3>甲币经营</h3>
              <p>针对地块 {{ selectedPlot.slot }} 的「{{ selectedPlot.cropName }}」，用甲币加速成长。</p>
            </div>
          </div>

          <div class="farm-shop-block">
            <div class="farm-shop-block-head">
              <Droplets :size="15" />
              <strong>浇灌</strong>
              <small>每次 {{ formatCoins(waterCost) }} 甲币 · +{{ snapshot.waterPack.resourceAmount }} 资源 +{{ snapshot.waterPack.growthAmount }} 成长</small>
            </div>
            <div class="farm-shop-actions">
              <button
                v-for="type in resourceTypes"
                :key="type"
                class="farm-shop-btn"
                type="button"
                :style="{ '--btn-tone': resourceMeta[type].tone }"
                :disabled="coins < waterCost || Boolean(actionLoadingKey)"
                @click="water(type)"
              >
                <component :is="resourceMeta[type].icon" :size="16" />
                <span>浇{{ resourceMeta[type].label }}</span>
              </button>
            </div>
          </div>

          <div class="farm-shop-block">
            <div class="farm-shop-block-head">
              <Zap :size="15" />
              <strong>一键催熟</strong>
              <small v-if="selectedPlot.canHarvest">作物已成熟</small>
              <small v-else>补满成长需 {{ formatCoins(ripenCost) }} 甲币</small>
            </div>
            <el-button
              class="farm-shop-wide-btn"
              type="warning"
              plain
              :icon="Zap"
              :disabled="selectedPlot.canHarvest || coins < ripenCost || Boolean(actionLoadingKey)"
              :loading="actionLoadingKey === 'ripen'"
              @click="quickRipen"
            >
              {{ selectedPlot.canHarvest ? '无需催熟' : `催熟至收获线（${formatCoins(ripenCost)} 甲币）` }}
            </el-button>
          </div>

          <div v-if="plantableCropTiers.length" class="farm-shop-block">
            <div class="farm-shop-block-head">
              <Sprout :size="15" />
              <strong>改种作物</strong>
              <small>切换到其它已解锁作物（成长重置）</small>
            </div>
            <div class="farm-shop-actions">
              <button
                v-for="tier in plantableCropTiers"
                :key="tier.tier"
                class="farm-shop-btn is-plant"
                type="button"
                :disabled="Boolean(actionLoadingKey)"
                @click="plant(tier.tier)"
              >
                <Sprout :size="16" />
                <span>{{ tier.name }}</span>
              </button>
            </div>
          </div>
        </section>

        <section class="surface-card farm-task-card">
          <div class="panel-head">
            <div>
              <h3>今日农事</h3>
              <p>领取的资源与成长会加到当前选中的地块 {{ selectedPlot.slot }}。</p>
            </div>
          </div>

          <div class="farm-task-list">
            <article v-for="task in snapshot.tasks" :key="task.key" class="farm-task-item">
              <div class="farm-task-icon" :class="{ done: task.claimed, ready: task.available && !task.claimed }">
                <component :is="getTaskIcon(task)" :size="18" />
              </div>
              <div class="farm-task-copy">
                <div>
                  <strong>{{ task.title }}</strong>
                  <el-tag size="small" :type="getTaskStatusType(task)" effect="light" round>
                    {{ getTaskStatusText(task) }}
                  </el-tag>
                </div>
                <p>{{ task.description }}</p>
                <small>
                  +{{ task.rewardAmount }} {{ resourceMeta[task.resourceType].label }} · +{{ task.growthAmount }} 成长
                </small>
              </div>
              <el-button
                class="farm-task-action"
                type="primary"
                plain
                :disabled="task.claimed || !task.available || Boolean(actionLoadingKey)"
                :loading="actionLoadingKey === task.key"
                @click="claimTask(task)"
              >
                {{ task.claimed ? '已领取' : '领取' }}
              </el-button>
            </article>
          </div>
        </section>
      </div>

      <aside class="view-stack">
        <!-- 作物图鉴 / 解锁 -->
        <section class="surface-card farm-crop-card">
          <div class="panel-head">
            <h3>作物图鉴</h3>
          </div>
          <div class="farm-crop-list">
            <article
              v-for="tier in snapshot.cropTiers"
              :key="tier.tier"
              class="farm-crop-item"
              :class="{ locked: !tier.unlocked }"
            >
              <div class="farm-crop-item-head">
                <strong>{{ tier.name }}</strong>
                <el-tag v-if="tier.unlocked" size="small" type="success" effect="light" round>已解锁</el-tag>
                <el-tag v-else size="small" type="info" effect="light" round>未解锁</el-tag>
              </div>
              <small>收获线 {{ tier.growthToHarvest }} 成长 · 反哺基准 {{ formatCoins(tier.harvestReward) }} 甲币/级</small>
              <el-button
                v-if="!tier.unlocked"
                class="farm-crop-unlock"
                size="small"
                type="primary"
                plain
                :icon="Sparkles"
                :disabled="!tier.canAfford || Boolean(actionLoadingKey)"
                :loading="actionLoadingKey === 'unlock-crop'"
                @click="unlockCropTier(tier.name)"
              >
                {{ tier.canAfford ? `解锁（${formatCoins(tier.unlockCost)} 甲币）` : `需 ${formatCoins(tier.unlockCost)} 甲币` }}
              </el-button>
            </article>
          </div>
        </section>

        <section class="surface-card farm-record-card">
          <div class="panel-head">
            <h3>丰收记录</h3>
          </div>
          <div v-if="snapshot.harvestRecords.length" class="farm-record-list">
            <article v-for="record in snapshot.harvestRecords" :key="record.id" class="farm-record-item">
              <div>
                <strong>{{ record.cropName }}</strong>
                <span>{{ record.ganzhiName }} · Lv.{{ record.level }}</span>
              </div>
              <small>{{ record.date }} · {{ formatDateTime(record.createdAt) }}</small>
              <p>{{ formatResources(record.resourcesSummary) }}</p>
            </article>
          </div>
          <div v-else class="farm-empty-record">
            <Wheat :size="28" />
            <strong>暂无丰收</strong>
            <span>成长达到收获线后即可收获第一批作物。</span>
          </div>
        </section>

        <section class="surface-card farm-guide-card">
          <div class="panel-head">
            <h3>甲子规则</h3>
          </div>
          <p>农场从首次打开当天进入甲子周期，60 天一轮。完成日报、同步飞书与代码提交会让作物持续成长。</p>
          <ul>
            <li><Coins :size="14" /> 浇灌 / 催熟消耗甲币，收获按作物档次 × 地块等级反哺甲币。</li>
            <li><Sprout :size="14" /> 解锁高阶作物收获线更高、反哺更多；最多经营 4 块地。</li>
            <li><Wheat :size="14" /> 同一天同一农事只能领取一次，资源进当前选中地块。</li>
          </ul>
        </section>
      </aside>
    </div>

    <section v-else class="surface-card farm-loading-card">
      <el-skeleton :rows="8" animated />
    </section>
  </div>
</template>

<style scoped>
.jiazi-farm-view {
  --farm-green: #2f7d57;
  --farm-green-soft: #e8f5ed;
  --farm-line: rgba(47, 125, 87, 0.18);
}

.farm-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.farm-summary-card {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 4px 10px;
  align-items: center;
  padding: 16px;
}

.farm-summary-card svg {
  grid-row: span 3;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  padding: 7px;
  background: var(--farm-green-soft);
  color: var(--farm-green);
}

.farm-summary-card.is-coin svg {
  background: #fff7e0;
  color: #b7791f;
}

.farm-summary-card span,
.farm-summary-card small {
  color: var(--c-text-faint);
  font-size: 12px;
}

.farm-summary-card strong {
  min-width: 0;
  color: var(--c-text);
  font-size: 22px;
  line-height: 1.15;
}

.farm-plot-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 14px 16px;
}

.farm-plot-chip {
  flex: 1 1 150px;
  min-width: 140px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  background: #fbfdff;
  padding: 10px 12px;
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease,
    background 0.18s ease;
}

.farm-plot-chip:hover {
  border-color: color-mix(in srgb, var(--farm-green) 40%, var(--c-border));
  transform: translateY(-1px);
}

.farm-plot-chip.active {
  border-color: var(--farm-green);
  background: var(--farm-green-soft);
  box-shadow: 0 8px 18px rgba(47, 125, 87, 0.12);
}

.farm-plot-chip-head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.farm-plot-chip-head strong {
  color: var(--c-text);
  font-size: 14px;
}

.farm-plot-chip .ripe-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #f59e0b;
  color: #fff;
  font-size: 10px;
  font-style: normal;
  font-weight: 800;
}

.farm-plot-chip small {
  color: var(--c-text-faint);
  font-size: 12px;
}

.farm-plot-chip-bar {
  height: 5px;
  border-radius: 999px;
  background: rgba(47, 125, 87, 0.14);
  overflow: hidden;
}

.farm-plot-chip-bar span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--farm-green);
  transition: width 0.24s ease;
}

.farm-plot-chip.is-unlock {
  align-items: center;
  justify-content: center;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 6px;
  border-style: dashed;
  color: var(--c-text-muted);
}

.farm-plot-chip.is-unlock strong {
  font-size: 13px;
}

.farm-plot-chip.is-unlock small {
  flex-basis: 100%;
  text-align: center;
}

.farm-plot-chip:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  transform: none;
}

.farm-layout.content-grid.has-right-panel {
  grid-template-columns: minmax(0, 1fr) 330px;
}

.farm-field-card,
.farm-shop-card,
.farm-task-card,
.farm-crop-card,
.farm-record-card,
.farm-guide-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.farm-field-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.farm-field-head span {
  color: var(--farm-green);
  font-size: 12px;
  font-weight: 800;
}

.farm-field-head h2 {
  margin: 5px 0 6px;
  color: var(--c-text);
  font-size: 26px;
  line-height: 1.15;
}

.farm-field-head p,
.farm-task-card .panel-head p,
.farm-shop-card .panel-head p,
.farm-guide-card p {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 13px;
  line-height: 1.7;
}

.farm-field-stage {
  --growth: 0%;
  position: relative;
  min-height: 280px;
  border: 1px solid var(--farm-line);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(224, 242, 254, 0.72), rgba(240, 253, 244, 0.66) 48%, rgba(236, 252, 203, 0.72)),
    #f8fbf6;
  overflow: hidden;
}

.farm-sun {
  position: absolute;
  top: 22px;
  right: 24px;
  width: 58px;
  height: 58px;
  border-radius: 50%;
  background: #fff7c2;
  color: #ca8a04;
  display: grid;
  place-items: center;
  box-shadow: 0 10px 30px rgba(202, 138, 4, 0.16);
}

.farm-ground {
  position: absolute;
  inset: auto 24px 24px;
  height: 94px;
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 7px;
  align-items: end;
}

.farm-ground span {
  height: 58px;
  border-radius: 8px 8px 4px 4px;
  background: rgba(132, 90, 52, 0.22);
  box-shadow: inset 0 -12px 0 rgba(132, 90, 52, 0.12);
}

.farm-ground span.active {
  background: linear-gradient(180deg, #a7f3d0, #86efac 42%, #a16207 43%, #854d0e);
}

.farm-crop {
  position: absolute;
  left: 50%;
  bottom: 86px;
  width: 132px;
  height: 132px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--farm-green) calc(var(--growth) * 0.12), rgba(255, 255, 255, 0.72));
  color: var(--farm-green);
  box-shadow: 0 18px 42px rgba(47, 125, 87, 0.16);
  transform: translateX(-50%) scale(calc(0.72 + (var(--growth) / 100) * 0.28));
  transform-origin: bottom center;
  transition: transform 0.24s ease;
}

.farm-progress-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.farm-progress-row .el-progress {
  flex: 1 1 auto;
}

.farm-progress-row small {
  flex: 0 0 auto;
  color: var(--c-text-faint);
  font-size: 12px;
}

.farm-resource-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.farm-resource-card {
  --resource-tone: #64748b;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  gap: 2px 9px;
  align-items: center;
  min-height: 64px;
  border: 1px solid color-mix(in srgb, var(--resource-tone) 18%, var(--c-border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--resource-tone) 6%, var(--c-surface));
  padding: 10px 12px;
}

.farm-resource-card svg {
  grid-row: span 2;
  color: var(--resource-tone);
}

.farm-resource-card span {
  color: var(--c-text-faint);
  font-size: 12px;
}

.farm-resource-card strong {
  color: var(--c-text);
  font-size: 18px;
}

.farm-shop-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid var(--c-border);
  border-radius: 8px;
  background: #fbfdff;
  padding: 12px;
}

.farm-shop-block-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.farm-shop-block-head svg {
  color: var(--farm-green);
}

.farm-shop-block-head strong {
  color: var(--c-text);
  font-size: 13px;
}

.farm-shop-block-head small {
  margin-left: auto;
  color: var(--c-text-faint);
  font-size: 11px;
}

.farm-shop-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.farm-shop-btn {
  --btn-tone: #2f7d57;
  flex: 1 1 90px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 38px;
  border: 1px solid color-mix(in srgb, var(--btn-tone) 26%, var(--c-border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--btn-tone) 8%, var(--c-surface));
  color: color-mix(in srgb, var(--btn-tone) 72%, var(--c-text));
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease;
}

.farm-shop-btn:hover:not(:disabled) {
  border-color: var(--btn-tone);
  background: color-mix(in srgb, var(--btn-tone) 14%, var(--c-surface));
  transform: translateY(-1px);
}

.farm-shop-btn.is-plant {
  --btn-tone: #2f7d57;
}

.farm-shop-btn:disabled {
  cursor: not-allowed;
  opacity: 0.48;
  transform: none;
}

.farm-shop-wide-btn.el-button {
  width: 100%;
}

.farm-task-list,
.farm-record-list,
.farm-crop-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.farm-task-item {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  border: 1px solid var(--c-border);
  border-radius: 8px;
  background: #fbfdff;
  padding: 12px;
}

.farm-task-icon {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: #f1f5f9;
  color: var(--c-text-faint);
}

.farm-task-icon.ready {
  background: #fff7ed;
  color: #d97706;
}

.farm-task-icon.done {
  background: var(--farm-green-soft);
  color: var(--farm-green);
}

.farm-task-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.farm-task-copy div {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.farm-task-copy strong {
  color: var(--c-text);
  font-size: 14px;
}

.farm-task-copy p,
.farm-task-copy small {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.farm-task-action {
  min-width: 78px;
}

.farm-crop-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid var(--c-border);
  border-radius: 8px;
  background: #fbfdff;
  padding: 12px;
}

.farm-crop-item.locked {
  background: color-mix(in srgb, var(--c-text-faint) 4%, var(--c-surface));
}

.farm-crop-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.farm-crop-item-head strong {
  color: var(--c-text);
  font-size: 14px;
}

.farm-crop-item small {
  color: var(--c-text-faint);
  font-size: 12px;
  line-height: 1.5;
}

.farm-crop-unlock {
  align-self: flex-start;
  margin-top: 2px;
}

.farm-record-item {
  border: 1px solid var(--c-border);
  border-radius: 8px;
  background: #fbfdff;
  padding: 12px;
}

.farm-record-item div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.farm-record-item strong {
  color: var(--c-text);
  font-size: 14px;
}

.farm-record-item span,
.farm-record-item small,
.farm-record-item p,
.farm-empty-record span {
  color: var(--c-text-faint);
  font-size: 12px;
}

.farm-record-item p {
  margin: 8px 0 0;
}

.farm-empty-record {
  min-height: 160px;
  border: 1px dashed var(--c-border);
  border-radius: 8px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  text-align: center;
  color: var(--c-text-faint);
}

.farm-empty-record strong {
  color: var(--c-text);
}

.farm-guide-card ul {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.farm-guide-card li {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--c-text-muted);
  font-size: 12px;
}

.farm-loading-card {
  min-height: 420px;
}

:global(:root[data-theme='dark']) .farm-field-stage {
  background:
    linear-gradient(180deg, rgba(14, 116, 144, 0.22), rgba(22, 101, 52, 0.18) 48%, rgba(63, 98, 18, 0.24)),
    var(--c-surface-muted);
}

:global(:root[data-theme='dark']) .farm-summary-card svg,
:global(:root[data-theme='dark']) .farm-task-icon.done {
  background: rgba(34, 197, 94, 0.1);
}

:global(:root[data-theme='dark']) .farm-summary-card.is-coin svg {
  background: rgba(251, 191, 36, 0.12);
  color: #facc15;
}

:global(:root[data-theme='dark']) .farm-plot-chip,
:global(:root[data-theme='dark']) .farm-shop-block,
:global(:root[data-theme='dark']) .farm-task-item,
:global(:root[data-theme='dark']) .farm-crop-item,
:global(:root[data-theme='dark']) .farm-record-item {
  background: var(--c-surface-muted);
}

:global(:root[data-theme='dark']) .farm-plot-chip.active {
  background: rgba(34, 197, 94, 0.12);
}

@media (max-width: 1100px) {
  .farm-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .farm-layout.content-grid.has-right-panel {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 720px) {
  .farm-summary-grid,
  .farm-resource-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .farm-field-head,
  .farm-record-item div {
    flex-direction: column;
    align-items: flex-start;
  }

  .farm-task-item {
    grid-template-columns: 38px minmax(0, 1fr);
  }

  .farm-task-action {
    grid-column: 1 / -1;
    width: 100%;
  }

  .farm-field-stage {
    min-height: 240px;
  }
}
</style>
