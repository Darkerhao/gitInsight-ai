import { computed, ref } from 'vue';
import { useAssistant } from '@/composables/useAssistant';
import type { AutoSyncStatus } from '@shared/types';

export type MessageType = 'system' | 'sync' | 'error';
export type MessageStatus = 'success' | 'failed' | 'running' | 'pending' | 'info';

export interface MessageItem {
  id: string;
  type: MessageType;
  title: string;
  content: string;
  createdAt: string;
  status: MessageStatus;
}

const READ_STORAGE_KEY = 'gitinsight-message-read-ids';

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

function createMessages() {
  const { config, syncLogs, errorLogs, getAutoSyncTaskState } = useAssistant();
  const readIds = ref<string[]>(loadReadIds());

  const systemMessages = computed<MessageItem[]>(() => {
    return config.autoSync.tasks.flatMap((task) => {
      const state = getAutoSyncTaskState(task.id) ?? task;
      if (!state.lastMessage) return [];
      return [{
        id: `system-auto-sync-${task.id}-${state.lastRunAt}-${state.lastStatus}-${state.lastMessage}`,
        type: 'system',
        title: `自动同步：${task.name}`,
        content: state.lastMessage,
        createdAt: state.lastRunAt,
        status: normalizeStatus(state.lastStatus),
      } satisfies MessageItem];
    });
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
      (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0),
    );
  });

  const unreadCount = computed(
    () => messageItems.value.filter((item) => !readIds.value.includes(item.id)).length,
  );

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
    readIds.value = [...new Set([...readIds.value, ...messageItems.value.map((item) => item.id)])];
    persistReadIds();
  }

  return {
    messageItems,
    unreadCount,
    isRead,
    markAsRead,
    markAllAsRead,
    normalizeStatus,
  };
}

let instance: ReturnType<typeof createMessages> | null = null;

export function useMessages() {
  if (!instance) {
    instance = createMessages();
  }
  return instance;
}
