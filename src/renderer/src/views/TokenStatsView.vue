<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { BarChart3, Database, Play, RefreshCw, Square, Zap } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import { useAssistant } from '@/composables/useAssistant';
import type { UsageFilter } from '@shared/types';

const assistant = useAssistant();
const {
  config,
  repos,
  tokenScans,
  scanProgress,
  scanning,
  proxyStatus,
  usageStats,
  runTokenScan,
  loadTokenScans,
  refreshProxyStatus,
  startProxy,
  stopProxy,
  loadUsageStats,
  saveSettings,
} = assistant;

const activeTab = ref('code');
const scanRepoPaths = ref<string[]>([]);
const usageTimeRange = ref<'today' | 'week' | 'month' | 'all'>('today');

const latestScans = computed(() => {
  const map = new Map<string, (typeof tokenScans.value)[0]>();
  for (const scan of tokenScans.value) {
    if (!map.has(scan.repoPath)) map.set(scan.repoPath, scan);
  }
  return [...map.values()].sort((a, b) => b.totalTokens - a.totalTokens);
});

const totalCodeTokens = computed(() => latestScans.value.reduce((sum, scan) => sum + scan.totalTokens, 0));

const aggregatedBreakdown = computed(() => {
  const merged: Record<string, number> = {};
  for (const scan of latestScans.value) {
    for (const [ext, tokens] of Object.entries(scan.breakdown)) {
      merged[ext] = (merged[ext] || 0) + tokens;
    }
  }
  return Object.entries(merged).sort((a, b) => b[1] - a[1]);
});

const totalCost = computed(() => Number.parseFloat(usageStats.value?.totalCostUsd || '0') || 0);
const cacheHitRate = computed(() => usageStats.value?.cacheHitRate ?? 0);

function getUsageFilter(): UsageFilter {
  const now = new Date();
  const filter: UsageFilter = {};
  if (usageTimeRange.value === 'today') {
    filter.startDate = `${now.toISOString().slice(0, 10)}T00:00:00`;
  } else if (usageTimeRange.value === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    filter.startDate = `${weekAgo.toISOString().slice(0, 10)}T00:00:00`;
  } else if (usageTimeRange.value === 'month') {
    const monthAgo = new Date(now.getTime() - 30 * 86_400_000);
    filter.startDate = `${monthAgo.toISOString().slice(0, 10)}T00:00:00`;
  }
  return filter;
}

function formatTokens(value: number) {
  const n = Number(value) || 0;
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)} 亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)} 万`;
  return n.toLocaleString();
}

function formatCost(value: number | string) {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (!Number.isFinite(n) || n <= 0) return '$0.0000';
  return `$${n.toFixed(n < 0.0001 ? 6 : 4)}`;
}

async function handleScan() {
  if (!scanRepoPaths.value.length) {
    ElMessage.warning('请先选择要扫描的仓库');
    return;
  }
  try {
    await runTokenScan(scanRepoPaths.value);
    ElMessage.success('扫描完成');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '扫描失败');
  }
}

async function handleToggleProxy() {
  try {
    if (proxyStatus.value.running) {
      await stopProxy();
      ElMessage.success('代理已停止');
    } else {
      await startProxy();
      ElMessage.success(`代理已启动，端口：${proxyStatus.value.port}`);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败');
  }
}

function handleAddTarget() {
  config.tokenProxy.targets.push({
    id: crypto.randomUUID(),
    name: '',
    targetBaseUrl: '',
    apiKey: '',
    pathPrefix: '',
  });
}

function handleRemoveTarget(index: number) {
  config.tokenProxy.targets.splice(index, 1);
}

watch(usageTimeRange, () => {
  void loadUsageStats(getUsageFilter());
});

onMounted(async () => {
  await loadTokenScans();
  await refreshProxyStatus();
  await loadUsageStats(getUsageFilter());
});
</script>

<template>
  <div class="token-stats-view">
    <PageHeader title="Token 统计" description="查看项目代码 Token 量与 AI 使用消耗统计" />

    <el-tabs v-model="activeTab" class="token-stats-tabs">
      <el-tab-pane label="代码 Token" name="code">
        <div class="token-scan-toolbar">
          <el-select
            v-model="scanRepoPaths"
            multiple
            placeholder="选择要扫描的仓库"
            style="flex: 1"
            collapse-tags
            collapse-tags-tooltip
          >
            <el-option
              v-for="repo in repos"
              :key="repo.path"
              :label="repo.name"
              :value="repo.path"
            />
          </el-select>
          <el-button type="primary" :loading="scanning" @click="handleScan">
            <Database :size="16" style="margin-right: 4px" />
            开始扫描
          </el-button>
        </div>

        <el-progress
          v-if="scanning && scanProgress"
          :percentage="Math.round((scanProgress.scannedFiles / Math.max(scanProgress.totalFiles, 1)) * 100)"
          :format="() => `${scanProgress!.repoName}: ${scanProgress!.scannedFiles}/${scanProgress!.totalFiles} 文件，${formatTokens(scanProgress!.currentTokens)} tokens`"
          style="margin-bottom: 16px"
        />

        <div v-if="latestScans.length" class="token-stats-cards">
          <el-card shadow="never" class="token-stat-card">
            <div class="stat-label">项目总 Token 量</div>
            <div class="stat-value">{{ formatTokens(totalCodeTokens) }}</div>
          </el-card>
          <el-card shadow="never" class="token-stat-card">
            <div class="stat-label">已扫描项目</div>
            <div class="stat-value">{{ latestScans.length }}</div>
          </el-card>
        </div>

        <el-table v-if="latestScans.length" :data="latestScans" stripe style="margin-top: 16px">
          <el-table-column prop="repoName" label="项目" />
          <el-table-column label="Token 量" align="right">
            <template #default="{ row }">{{ formatTokens(row.totalTokens) }}</template>
          </el-table-column>
          <el-table-column prop="totalFiles" label="文件数" align="right" />
          <el-table-column label="扫描时间">
            <template #default="{ row }">{{ row.scannedAt.slice(0, 16).replace('T', ' ') }}</template>
          </el-table-column>
        </el-table>

        <el-card v-if="aggregatedBreakdown.length" shadow="never" style="margin-top: 16px">
          <template #header>文件类型分布</template>
          <div class="breakdown-list">
            <div v-for="[ext, tokens] in aggregatedBreakdown" :key="ext" class="breakdown-item">
              <span class="breakdown-ext">.{{ ext }}</span>
              <el-progress
                :percentage="Math.round((tokens / Math.max(totalCodeTokens, 1)) * 100)"
                :stroke-width="14"
                :show-text="false"
                style="flex: 1; margin: 0 12px"
              />
              <span class="breakdown-tokens">{{ formatTokens(tokens) }}</span>
            </div>
          </div>
        </el-card>

        <el-empty v-if="!latestScans.length && !scanning" description="暂无扫描记录，选择仓库后点击扫描" />
      </el-tab-pane>

      <el-tab-pane label="AI 消耗" name="usage">
        <div class="token-scan-toolbar">
          <el-radio-group v-model="usageTimeRange" size="default">
            <el-radio-button value="today">当天</el-radio-button>
            <el-radio-button value="week">近 7 天</el-radio-button>
            <el-radio-button value="month">近 30 天</el-radio-button>
            <el-radio-button value="all">全部</el-radio-button>
          </el-radio-group>
          <el-button :icon="RefreshCw" @click="loadUsageStats(getUsageFilter())">刷新</el-button>
        </div>

        <div v-if="usageStats" class="token-stats-cards">
          <el-card shadow="never" class="token-stat-card">
            <div class="stat-label">
              <Zap :size="14" /> 真实消耗 Tokens
            </div>
            <div class="stat-value">{{ formatTokens(usageStats.totalTokens) }}</div>
          </el-card>
          <el-card shadow="never" class="token-stat-card">
            <div class="stat-label">总请求数</div>
            <div class="stat-value">{{ usageStats.requestCount }}</div>
          </el-card>
          <el-card shadow="never" class="token-stat-card">
            <div class="stat-label">缓存命中率</div>
            <div class="stat-value">{{ cacheHitRate.toFixed(1) }}%</div>
          </el-card>
          <el-card shadow="never" class="token-stat-card">
            <div class="stat-label">估算费用</div>
            <div class="stat-value">{{ formatCost(totalCost) }}</div>
          </el-card>
        </div>

        <div v-if="usageStats" style="display: flex; gap: 16px; margin-top: 16px">
          <el-card shadow="never" style="flex: 1">
            <template #header>Token 明细</template>
            <div class="breakdown-list">
              <div class="breakdown-item">
                <span class="breakdown-ext">新增输入</span>
                <span class="breakdown-tokens">{{ formatTokens(usageStats.inputTokens) }}</span>
              </div>
              <div class="breakdown-item">
                <span class="breakdown-ext">输出</span>
                <span class="breakdown-tokens">{{ formatTokens(usageStats.outputTokens) }}</span>
              </div>
              <div class="breakdown-item">
                <span class="breakdown-ext">缓存读取</span>
                <span class="breakdown-tokens">{{ formatTokens(usageStats.cacheReadTokens) }}</span>
              </div>
              <div class="breakdown-item">
                <span class="breakdown-ext">缓存写入</span>
                <span class="breakdown-tokens">{{ formatTokens(usageStats.cacheCreationTokens) }}</span>
              </div>
            </div>
          </el-card>
        </div>

        <el-table v-if="usageStats?.byProject?.length" :data="usageStats.byProject" stripe style="margin-top: 16px">
          <el-table-column prop="projectName" label="项目" />
          <el-table-column label="消耗 Tokens" align="right">
            <template #default="{ row }">{{ formatTokens(row.totalTokens) }}</template>
          </el-table-column>
          <el-table-column label="费用" align="right">
            <template #default="{ row }">{{ formatCost(row.totalCostUsd) }}</template>
          </el-table-column>
          <el-table-column prop="requestCount" label="请求数" align="right" />
        </el-table>

        <el-table v-if="usageStats?.byModel?.length" :data="usageStats.byModel" stripe style="margin-top: 16px">
          <el-table-column prop="model" label="模型" />
          <el-table-column label="消耗 Tokens" align="right">
            <template #default="{ row }">{{ formatTokens(row.totalTokens) }}</template>
          </el-table-column>
          <el-table-column label="费用" align="right">
            <template #default="{ row }">{{ formatCost(row.totalCostUsd) }}</template>
          </el-table-column>
          <el-table-column prop="requestCount" label="请求数" align="right" />
        </el-table>

        <el-table v-if="usageStats?.byDate?.length" :data="usageStats.byDate" stripe style="margin-top: 16px">
          <el-table-column prop="date" label="日期" />
          <el-table-column label="消耗 Tokens" align="right">
            <template #default="{ row }">{{ formatTokens(row.totalTokens) }}</template>
          </el-table-column>
          <el-table-column label="费用" align="right">
            <template #default="{ row }">{{ formatCost(row.totalCostUsd) }}</template>
          </el-table-column>
          <el-table-column prop="requestCount" label="请求数" align="right" />
        </el-table>

        <el-empty v-if="!usageStats?.requestCount" description="暂无 AI 使用记录" />
      </el-tab-pane>

      <el-tab-pane label="代理设置" name="proxy">
        <el-card shadow="never">
          <template #header>代理状态</template>
          <div class="proxy-status-bar">
            <el-tag :type="proxyStatus.running ? 'success' : 'info'" size="large">
              {{ proxyStatus.running ? '● 运行中' : '● 已停止' }}
            </el-tag>
            <span v-if="proxyStatus.running" style="margin-left: 12px; color: var(--el-text-color-secondary)">
              端口：{{ proxyStatus.port }} · 已处理 {{ proxyStatus.requestCount }} 次请求
            </span>
            <el-button
              :type="proxyStatus.running ? 'danger' : 'success'"
              style="margin-left: auto"
              @click="handleToggleProxy"
            >
              <component :is="proxyStatus.running ? Square : Play" :size="14" style="margin-right: 4px" />
              {{ proxyStatus.running ? '停止' : '启动' }}
            </el-button>
          </div>
        </el-card>

        <el-card shadow="never" style="margin-top: 16px">
          <template #header>
            <div style="display: flex; align-items: center; justify-content: space-between">
              <span>转发规则</span>
              <el-button size="small" @click="handleAddTarget">+ 添加规则</el-button>
            </div>
          </template>

          <div v-for="(target, index) in config.tokenProxy.targets" :key="target.id" class="proxy-target-row">
            <el-input v-model="target.name" placeholder="名称（如 OpenAI）" style="width: 120px" />
            <el-input v-model="target.pathPrefix" placeholder="路径前缀（如 /openai）" style="width: 150px" />
            <el-input v-model="target.targetBaseUrl" placeholder="目标地址（如 https://api.openai.com/v1）" style="flex: 1" />
            <el-input v-model="target.apiKey" placeholder="API Key（可选）" type="password" show-password style="width: 200px" />
            <el-button type="danger" text @click="handleRemoveTarget(index)">删除</el-button>
          </div>

          <el-empty v-if="!config.tokenProxy.targets.length" description="暂无转发规则，点击上方添加" :image-size="60" />

          <div style="margin-top: 12px; text-align: right">
            <el-button type="primary" @click="saveSettings">保存设置</el-button>
          </div>
        </el-card>

        <el-card shadow="never" style="margin-top: 16px">
          <template #header>端口设置</template>
          <el-form label-width="100px">
            <el-form-item label="代理端口">
              <el-input-number v-model="config.tokenProxy.port" :min="1024" :max="65535" :step="1" />
            </el-form-item>
            <el-form-item label="自动启动">
              <el-switch v-model="config.tokenProxy.enabled" />
            </el-form-item>
          </el-form>
          <div style="text-align: right">
            <el-button type="primary" @click="saveSettings">保存设置</el-button>
          </div>
        </el-card>

        <el-card shadow="never" style="margin-top: 16px">
          <template #header>使用说明</template>
          <div class="proxy-usage-guide">
            <p>将 AI 工具的 API Base URL 改为本地代理地址即可开始记录 Token 消耗：</p>
            <div v-for="target in config.tokenProxy.targets" :key="target.id" class="proxy-url-example">
              <strong>{{ target.name || '未命名' }}：</strong>
              <code>http://localhost:{{ config.tokenProxy.port }}{{ target.pathPrefix }}/v1</code>
            </div>
            <p v-if="!config.tokenProxy.targets.length" style="color: var(--el-text-color-secondary)">
              请先添加转发规则
            </p>
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
