<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Copy, Search } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useAssistant } from '@/composables/useAssistant';
import type { AutoSyncStatus } from '@shared/types';

type MessageType = 'system' | 'sync' | 'error';
type MessageStatus = 'success' | 'failed' | 'running' | 'pending' | 'info';

interface MessageItem {
  id: string;
  type: MessageType;
  title: string;
  content: string;
  createdAt: string;
  status: MessageStatus;
}

const READ_STORAGE_KEY = 'gitinsight-message-read-ids';

const assistant = useAssistant();
const { syncLogs, errorLogs, autoSyncState } = assistant;

const keyword = ref('');
const typeFilter = ref<'all' | MessageType>('all');
const statusFilter = ref<'all' | MessageStatus>('all');
const timeRange = ref<[string, string] | null>(null);
const activeMessage = ref<MessageItem | null>(null);
const drawerVisible = ref(false);
const readIds = ref<string[]>(loadReadIds());

const systemMessages = computed<MessageItem[]>(() => {
  const items: MessageItem[] = [];
  if (autoSyncState.value?.lastMessage) {
    items.push({
      id: `system-auto-sync-${autoSyncState.value.lastRunAt || autoSyncState.value.lastStatus}`,
      type: 'system',
      title: '自动同步状态',
      content: autoSyncState.value.lastMessage,
      createdAt: autoSyncState.value.lastRunAt || new Date().toISOString(),
      status: normalizeStatus(autoSyncState.value.lastStatus),
    });
  }
  return items;
});

const messageItems = computed<MessageItem[]>(() => {
  const syncItems = syncLogs.value.map<MessageItem>((item) => ({
    id: `sync-${item.id}`,
    type: 'sync',
    title: item.triggerType === 'scheduled' ? '定时同步通知' : '手动同步通知',
    content: item.message,
    createdAt: item.ranAt,
    status: normalizeStatus(item.status),
  }));

  const errorItems = errorLogs.value.map<MessageItem>((item) => ({
    id: `error-${item.id}`,
    type: 'error',
    title: item.scope || '系统异常',
    content: item.detail || item.message,
    createdAt: item.createdAt,
    status: 'failed',
  }));

  return [...systemMessages.value, ...syncItems, ...errorItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
});

const unreadCount = computed(() => messageItems.value.filter((item) => !readIds.value.includes(item.id)).length);

const filteredMessages = computed(() => {
  return messageItems.value.filter((item) => {
    const matchKeyword = !keyword.value || `${item.title}${item.content}`.toLowerCase().includes(keyword.value.toLowerCase());
    const matchType = typeFilter.value === 'all' || item.type === typeFilter.value;
    const matchStatus = statusFilter.value === 'all' || item.status === statusFilter.value;
    const itemTime = new Date(item.createdAt).getTime();
    const matchTime =
      !timeRange.value ||
      (!Number.isNaN(itemTime) &&
        itemTime >= new Date(timeRange.value[0]).getTime() &&
        itemTime <= new Date(`${timeRange.value[1]} 23:59:59`).getTime());
    return matchKeyword && matchType && matchStatus && matchTime;
  });
});

watch(
  filteredMessages,
  (items) => {
    if (!items.length) {
      activeMessage.value = null;
      drawerVisible.value = false;
      return;
    }
    if (!activeMessage.value || !items.some((item) => item.id === activeMessage.value?.id)) {
      activeMessage.value = items[0];
    }
  },
  { immediate: true },
);

function normalizeStatus(status?: AutoSyncStatus | 'success' | 'failed'): MessageStatus {
  if (status === 'success') return 'success';
  if (status === 'failed') return 'failed';
  if (status === 'running') return 'running';
  if (status === 'skipped') return 'pending';
  return 'info';
}

function loadReadIds() {
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function persistReadIds() {
  localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(readIds.value));
}

function isRead(id: string) {
  return readIds.value.includes(id);
}

function markAsRead(id: string) {
  if (isRead(id)) return;
  readIds.value = [...readIds.value, id];
  persistReadIds();
}

function markAllAsRead() {
  readIds.value = messageItems.value.map((item) => item.id);
  persistReadIds();
  ElMessage.success('全部消息已标记为已读');
}

function openDetail(item: MessageItem) {
  activeMessage.value = item;
  drawerVisible.value = true;
  markAsRead(item.id);
}

async function copyMessage(item?: MessageItem | null) {
  if (!item) {
    ElMessage.warning('暂无可复制的消息');
    return;
  }
  await navigator.clipboard.writeText(`${item.title}\n${item.content}`);
  ElMessage.success('消息内容已复制');
}

function resetFilters() {
  keyword.value = '';
  typeFilter.value = 'all';
  statusFilter.value = 'all';
  timeRange.value = null;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function typeLabel(type: MessageType) {
  if (type === 'sync') return '任务通知';
  if (type === 'error') return '系统通知';
  return '提醒';
}

function statusLabel(status: MessageStatus) {
  if (status === 'success') return '成功';
  if (status === 'failed') return '失败';
  if (status === 'running') return '进行中';
  if (status === 'pending') return '提醒';
  return '信息';
}
</script>

<template>
  <div class="view-stack">
    <PageHeader title="消息中心" subtitle="聚合同步日志、错误日志与系统状态消息，支持真实数据筛选与阅读状态管理。">
      <template #actions>
        <el-button plain @click="markAllAsRead">全部已读</el-button>
      </template>
    </PageHeader>

    <section class="surface-card message-toolbar-card">
      <div class="message-toolbar-grid">
        <el-input v-model="keyword" :prefix-icon="Search" placeholder="搜索消息内容" />
        <el-select v-model="typeFilter">
          <el-option label="全部类型" value="all" />
          <el-option label="任务通知" value="sync" />
          <el-option label="系统通知" value="error" />
          <el-option label="提醒" value="system" />
        </el-select>
        <el-select v-model="statusFilter">
          <el-option label="全部状态" value="all" />
          <el-option label="成功" value="success" />
          <el-option label="失败" value="failed" />
          <el-option label="进行中" value="running" />
          <el-option label="提醒" value="pending" />
          <el-option label="信息" value="info" />
        </el-select>
        <el-date-picker
          v-model="timeRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
        />
        <el-button @click="resetFilters">重置</el-button>
      </div>
    </section>

    <div class="content-grid history-layout">
      <section class="surface-card">
        <div class="panel-head">
          <h3>消息列表</h3>
          <span class="message-unread-count">未读 {{ unreadCount }}</span>
        </div>

        <div class="message-list">
          <button
            v-for="item in filteredMessages"
            :key="item.id"
            type="button"
            class="message-card"
            :class="{ unread: !isRead(item.id) }"
            @click="openDetail(item)"
          >
            <div class="message-card-head">
              <strong>{{ item.title }}</strong>
              <StatusBadge :status="item.status" :label="statusLabel(item.status)" />
            </div>
            <span class="message-card-meta">{{ typeLabel(item.type) }} · {{ formatDateTime(item.createdAt) }}</span>
            <p>{{ item.content }}</p>
          </button>

          <div v-if="!filteredMessages.length" class="empty-state">暂无符合条件的真实消息记录</div>
        </div>
      </section>

      <aside class="surface-card message-summary-card">
        <div class="panel-head">
          <h3>消息概览</h3>
        </div>
        <div class="about-kv-list">
          <div class="about-kv-row">
            <span>全部消息</span>
            <strong>{{ messageItems.length }}</strong>
          </div>
          <div class="about-kv-row">
            <span>未读消息</span>
            <strong>{{ unreadCount }}</strong>
          </div>
          <div class="about-kv-row">
            <span>同步通知</span>
            <strong>{{ messageItems.filter((item) => item.type === 'sync').length }}</strong>
          </div>
          <div class="about-kv-row">
            <span>错误通知</span>
            <strong>{{ messageItems.filter((item) => item.type === 'error').length }}</strong>
          </div>
        </div>
      </aside>
    </div>

    <el-drawer v-model="drawerVisible" title="消息详情" size="42%">
      <div v-if="activeMessage" class="message-detail">
        <div class="message-card-head">
          <strong>{{ activeMessage.title }}</strong>
          <StatusBadge :status="activeMessage.status" :label="statusLabel(activeMessage.status)" />
        </div>
        <span class="message-card-meta">{{ typeLabel(activeMessage.type) }} · {{ formatDateTime(activeMessage.createdAt) }}</span>
        <pre class="message-detail-text">{{ activeMessage.content }}</pre>
        <div class="button-row end">
          <el-button :icon="Copy" plain @click="copyMessage(activeMessage)">复制内容</el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>
