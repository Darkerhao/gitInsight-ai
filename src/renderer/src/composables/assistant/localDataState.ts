import type { Ref } from 'vue';
import type { DailyReportRecord, ErrorLogRecord, StorageInfo, SyncLogRecord } from '@shared/types';

type LocalDataStateContext = {
  dailyReports: Ref<DailyReportRecord[]>;
  syncLogs: Ref<SyncLogRecord[]>;
  errorLogs: Ref<ErrorLogRecord[]>;
  storageInfo: Ref<StorageInfo | null>;
};

export function createLocalDataState(ctx: LocalDataStateContext) {
  const { dailyReports, syncLogs, errorLogs, storageInfo } = ctx;

  async function refreshDailyReports() {
    dailyReports.value = await window.api.listDailyReports(10);
  }

  async function refreshLocalData() {
    const [reports, syncRecords, errorRecords, storage] = await Promise.all([
      window.api.listDailyReports(50),
      window.api.listSyncLogs(50),
      window.api.listErrorLogs(50),
      window.api.getStorageInfo(),
    ]);
    dailyReports.value = reports;
    syncLogs.value = syncRecords;
    errorLogs.value = errorRecords;
    storageInfo.value = storage;
  }

  return {
    refreshDailyReports,
    refreshLocalData,
  };
}
