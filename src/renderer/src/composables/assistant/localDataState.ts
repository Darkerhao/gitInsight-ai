export function createLocalDataState(ctx: any) {
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
