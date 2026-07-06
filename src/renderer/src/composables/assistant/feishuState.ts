import type { Ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { AppConfig, FeishuAuthSnapshot, FeishuFieldOption, FeishuProjectOption } from '@shared/types';
import { normalizeProjectWorkHours, normalizeWorkHours, toPlainString } from './normalizers';

type FeishuStateContext = {
  config: AppConfig;
  form: { date: string; startDateTime: string; endDateTime: string };
  status: Ref<string>;
  feishuLoading: Ref<boolean>;
  fieldLoading: Ref<boolean>;
  projectLoading: Ref<boolean>;
  projectOptions: Ref<FeishuProjectOption[]>;
  feishuFieldOptions: Ref<FeishuFieldOption[]>;
  advancedConfigPanels: Ref<string[]>;
  getConfigPayload: () => AppConfig;
  persistConfig: () => Promise<AppConfig>;
  persistConfigBeforeAction: (actionLabel: string) => Promise<AppConfig>;
};

export function createFeishuState(ctx: FeishuStateContext) {
  const {
    config,
    form,
    status,
    feishuLoading,
    fieldLoading,
    projectLoading,
    projectOptions,
    feishuFieldOptions,
    advancedConfigPanels,
    getConfigPayload,
    persistConfig,
    persistConfigBeforeAction,
  } = ctx;

  let lastAppliedFeishuAuthSignature = '';

  async function applyFeishuAuthSnapshot(snapshot: FeishuAuthSnapshot, options: { silent?: boolean } = {}) {
    const nextShareToken = toPlainString(snapshot.shareToken).trim();
    const nextEndpoint = toPlainString(snapshot.endpoint).trim();
    const nextCookie = toPlainString(snapshot.cookie).trim();
    const nextCsrfToken = toPlainString(snapshot.csrfToken).trim();
    const signature = JSON.stringify({ endpoint: nextEndpoint, shareToken: nextShareToken, cookie: nextCookie, csrfToken: nextCsrfToken });

    if (!nextEndpoint && !nextShareToken && !nextCookie && !nextCsrfToken) return false;
    if (signature === lastAppliedFeishuAuthSignature) return false;

    let changed = false;
    if (nextEndpoint && config.feishuForm.endpoint !== nextEndpoint) {
      config.feishuForm.endpoint = nextEndpoint;
      changed = true;
    }
    if (nextShareToken && config.feishuForm.shareToken !== nextShareToken) {
      config.feishuForm.shareToken = nextShareToken;
      changed = true;
    }
    if (nextCookie && config.feishuForm.cookie !== nextCookie) {
      config.feishuForm.cookie = nextCookie;
      changed = true;
    }
    if (nextCsrfToken && config.feishuForm.csrfToken !== nextCsrfToken) {
      config.feishuForm.csrfToken = nextCsrfToken;
      changed = true;
    }

    if (!changed) return false;

    if (!advancedConfigPanels.value.includes('feishu')) {
      advancedConfigPanels.value = [...advancedConfigPanels.value, 'feishu'];
    }

    await persistConfig();
    lastAppliedFeishuAuthSignature = signature;
    if (!options.silent) {
      ElMessage.success('飞书登录凭据已自动同步');
    }
    return true;
  }


  async function loginFeishu() {
    feishuLoading.value = true;
    try {
      await persistConfigBeforeAction('打开飞书登录');
      const snapshot = await window.api.loginFeishu({ config: getConfigPayload().feishuForm });
      const synced = await applyFeishuAuthSnapshot(snapshot, { silent: true });
      ElMessage.success(synced ? '飞书登录凭据已自动同步' : '已打开飞书登录窗口，登录成功后将自动同步凭据');
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '打开飞书登录失败');
    } finally {
      feishuLoading.value = false;
    }
  }


  async function openFeishuSubmissionRecords(targetDate = form.date) {
    feishuLoading.value = true;
    try {
      await persistConfigBeforeAction('打开飞书提交记录');
      const openedRecords = await window.api.openFeishuSubmissionRecords({
        config: getConfigPayload().feishuForm,
        targetDate,
      });
      ElMessage[openedRecords ? 'success' : 'warning'](
        openedRecords ? '已打开飞书提交记录页' : '已打开飞书页面，未自动定位到提交记录，可在页面中手动选择',
      );
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '打开飞书提交记录失败');
    } finally {
      feishuLoading.value = false;
    }
  }


  async function loadFeishuFields(options: { silent?: boolean } = {}) {
    fieldLoading.value = true;
    try {
      await persistConfigBeforeAction('解析飞书字段');
      feishuFieldOptions.value = await window.api.listFeishuFields({ config: getConfigPayload().feishuForm });
      status.value = `已解析 ${feishuFieldOptions.value.length} 个飞书表单字段`;
      if (!options.silent) ElMessage.success('飞书字段已解析');
    } catch (error) {
      if (!options.silent) {
        ElMessage.error(error instanceof Error ? error.message : '解析飞书字段失败');
      }
    } finally {
      fieldLoading.value = false;
    }
  }


  async function loadFeishuProjects(options: { silent?: boolean } = {}) {
    if (!config.feishuForm.projectFieldId.trim()) {
      if (!options.silent) ElMessage.warning('请先选择或填写所属项目字段 ID');
      return;
    }

    projectLoading.value = true;
    try {
      await persistConfigBeforeAction('刷新飞书项目');
      projectOptions.value = await window.api.listFeishuProjects({ config: getConfigPayload().feishuForm });
      const selected = projectOptions.value.find((item) => item.id === config.feishuForm.projectOptionId);
      if (selected) {
        config.feishuForm.projectName = selected.name;
      }
      status.value = `已获取 ${projectOptions.value.length} 个飞书项目选项`;
      if (!options.silent) ElMessage.success('飞书项目选项已刷新');
    } catch (error) {
      if (!options.silent) {
        ElMessage.error(error instanceof Error ? error.message : '获取飞书项目列表失败');
      }
    } finally {
      projectLoading.value = false;
    }
  }


  function selectFeishuProject(optionId: string) {
    const selected = projectOptions.value.find((item) => item.id === optionId);
    config.feishuForm.projectName = selected?.name ?? '';
    const projectHours = config.feishuForm.projectWorkHours?.[optionId];
    config.feishuForm.defaultWorkHours = normalizeWorkHours(projectHours, config.feishuForm.defaultWorkHours);
  }


  function updateProjectWorkHours(value: number | undefined) {
    const hours = normalizeWorkHours(value, config.feishuForm.defaultWorkHours);
    config.feishuForm.defaultWorkHours = hours;
    const optionId = config.feishuForm.projectOptionId.trim();
    if (!optionId) return;
    config.feishuForm.projectWorkHours = {
      ...normalizeProjectWorkHours(config.feishuForm.projectWorkHours),
      [optionId]: hours,
    };
  }


  async function testSubmitFeishu() {
    try {
      await ElMessageBox.confirm('测试提交会向当前飞书表单写入一条带测试标记的真实记录，确认继续？', '确认测试提交', {
        confirmButtonText: '写入测试记录',
        cancelButtonText: '取消',
        type: 'warning',
      });
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') {
        ElMessage.error(error instanceof Error ? error.message : '测试提交已取消');
      }
      return;
    }

    feishuLoading.value = true;
    try {
      await persistConfigBeforeAction('测试提交');
      const payloadConfig = {
        ...getConfigPayload().feishuForm,
        reporterName: config.feishuForm.reporterName || config.reporterName,
      };
      const result = await window.api.testSubmitFeishu({
        config: payloadConfig,
        date: form.date,
      });
      status.value = `飞书测试提交成功，code=${result.code}`;
      ElMessage.success('飞书测试提交成功');
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '飞书测试提交失败');
    } finally {
      feishuLoading.value = false;
    }
  }



  return {
    applyFeishuAuthSnapshot,
    loginFeishu,
    openFeishuSubmissionRecords,
    loadFeishuFields,
    loadFeishuProjects,
    selectFeishuProject,
    updateProjectWorkHours,
    testSubmitFeishu,
  };
}
