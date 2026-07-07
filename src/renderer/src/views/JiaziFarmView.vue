<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Droplets,
  Leaf,
  Loader2,
  PackageCheck,
  RefreshCw,
  Sprout,
  Sun,
  Wheat,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import type { JiaziFarmResourceType, JiaziFarmSnapshot, JiaziFarmTask } from '@shared/types';

const snapshot = ref<JiaziFarmSnapshot | null>(null);
const loading = ref(false);
const actionLoadingKey = ref('');
const harvesting = ref(false);

const resourceMeta: Record<JiaziFarmResourceType, { label: string; icon: typeof Droplets; tone: string }> = {
  water: { label: '露水', icon: Droplets, tone: '#0ea5e9' },
  sunlight: { label: '阳光', icon: Sun, tone: '#d97706' },
  nutrient: { label: '养分', icon: Leaf, tone: '#16a34a' },
};

const growthPercent = computed(() => Math.min(100, Math.max(0, snapshot.value?.state.growth ?? 0)));
const claimedTaskCount = computed(() => snapshot.value?.tasks.filter((task) => task.claimed).length ?? 0);
const availableTaskCount = computed(() => snapshot.value?.tasks.filter((task) => task.available && !task.claimed).length ?? 0);
const resourceCards = computed(() => {
  const state = snapshot.value?.state;
  return [
    { key: 'water' as const, value: state?.water ?? 0 },
    { key: 'sunlight' as const, value: state?.sunlight ?? 0 },
    { key: 'nutrient' as const, value: state?.nutrient ?? 0 },
  ].map((item) => ({
    ...item,
    ...resourceMeta[item.key],
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
  return (Object.entries(resources) as Array<[JiaziFarmResourceType, number]>)
    .filter(([, value]) => Number(value) > 0)
    .map(([key, value]) => `${resourceMeta[key].label} ${value}`)
    .join('、') || '暂无资源';
}

async function loadSnapshot(options: { silent?: boolean } = {}) {
  loading.value = true;
  try {
    snapshot.value = await window.api.getJiaziFarmSnapshot();
    if (!options.silent) ElMessage.success('甲子农场已刷新');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载甲子农场失败');
  } finally {
    loading.value = false;
  }
}

async function claimTask(task: JiaziFarmTask) {
  if (!snapshot.value || task.claimed || !task.available) return;
  actionLoadingKey.value = task.key;
  try {
    snapshot.value = await window.api.claimJiaziFarmTask({
      date: snapshot.value.date,
      taskKey: task.key,
    });
    ElMessage.success(`已领取 ${task.rewardAmount} ${resourceMeta[task.resourceType].label}`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '领取农事奖励失败');
  } finally {
    actionLoadingKey.value = '';
  }
}

async function harvestCrop() {
  if (!snapshot.value?.canHarvest) return;
  harvesting.value = true;
  try {
    snapshot.value = await window.api.harvestJiaziFarm({ date: snapshot.value.date });
    ElMessage.success('丰收完成，新的作物已经播下');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '收获失败');
  } finally {
    harvesting.value = false;
  }
}

onMounted(() => {
  void loadSnapshot({ silent: true });
});
</script>

<template>
  <div class="view-stack jiazi-farm-view">
    <PageHeader title="甲子农场" subtitle="把日报、同步与代码提交沉淀成可持续成长的工作农场">
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
      <section class="surface-card farm-summary-card">
        <Sprout :size="20" />
        <span>农场等级</span>
        <strong>Lv.{{ snapshot.state.level }}</strong>
        <small>累计丰收 {{ snapshot.state.totalHarvests }} 次</small>
      </section>
      <section class="surface-card farm-summary-card">
        <Wheat :size="20" />
        <span>成熟进度</span>
        <strong>{{ snapshot.state.growth }}/100</strong>
        <small>{{ cropStageLabel }}</small>
      </section>
      <section class="surface-card farm-summary-card">
        <PackageCheck :size="20" />
        <span>今日农事</span>
        <strong>{{ claimedTaskCount }}/{{ snapshot.tasks.length }}</strong>
        <small>{{ availableTaskCount }} 项可领取</small>
      </section>
    </div>

    <div v-if="snapshot" class="content-grid has-right-panel farm-layout">
      <div class="view-stack">
        <section class="surface-card farm-field-card">
          <div class="farm-field-head">
            <div>
              <span>{{ snapshot.seasonLabel }} · {{ snapshot.ganzhiName }}</span>
              <h2>{{ snapshot.cropName }}</h2>
              <p>{{ cropStageLabel }}，继续完成今日农事即可推动作物成熟。</p>
            </div>
            <el-button
              type="primary"
              :icon="Wheat"
              :disabled="!snapshot.canHarvest"
              :loading="harvesting"
              @click="harvestCrop"
            >
              {{ snapshot.canHarvest ? '收获作物' : '尚未成熟' }}
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

          <el-progress :percentage="growthPercent" :stroke-width="12" :show-text="false" />

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

        <section class="surface-card farm-task-card">
          <div class="panel-head">
            <div>
              <h3>今日农事</h3>
              <p>任务状态来自今日日报、飞书同步与提交记录。</p>
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
                :disabled="task.claimed || !task.available"
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
            <span>成长值达到 100 后即可收获第一批作物。</span>
          </div>
        </section>

        <section class="surface-card farm-guide-card">
          <div class="panel-head">
            <h3>甲子规则</h3>
          </div>
          <p>农场从首次打开当天进入甲子周期，60 天一轮。完成日报、同步飞书与代码提交会让作物持续成长。</p>
          <ul>
            <li><Loader2 :size="14" /> 每 100 成长可收获一次。</li>
            <li><Loader2 :size="14" /> 同一天同一任务只能领取一次。</li>
            <li><Loader2 :size="14" /> 丰收后保留资源，农场等级提升。</li>
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

.farm-layout.content-grid.has-right-panel {
  grid-template-columns: minmax(0, 1fr) 330px;
}

.farm-field-card,
.farm-task-card,
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

.farm-task-list,
.farm-record-list {
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

:global(:root[data-theme='dark']) .farm-task-item,
:global(:root[data-theme='dark']) .farm-record-item {
  background: var(--c-surface-muted);
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
