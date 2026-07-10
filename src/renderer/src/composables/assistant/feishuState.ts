import type { Ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { AppConfig, FeishuAuthSnapshot, FeishuFieldOption, FeishuProjectOption } from '@shared/types';
import { normalizeProjectWorkHours, normalizeWorkHours, toPlainString } from './normalizers';

type FeishuTestFailureStage = '登录态' | '字段映射' | '项目选项' | '接口返回';

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

const feishuFailurePanelMap: Record<FeishuTestFailureStage, string> = {
  登录态: 'feishu',
  字段映射: 'fields',
  项目选项: 'mapping',
  接口返回: 'feishu',
};

const feishuFailureFallbackSuggestions: Record<FeishuTestFailureStage, string> = {
  登录态: '请重新登录飞书，并确认 Cookie、CSRF Token、提交接口地址和 shareToken 已同步。',
  字段映射: '请重新解析表单字段，并确认所有字段 ID 与飞书表单类型匹配。',
  项目选项: '请刷新项目列表，并确认当前选择的飞书项目选项仍然存在。',
  接口返回: '请根据接口返回检查表单权限、网络状态和飞书服务状态。',
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || '飞书测试提交失败');
}

function inferFeishuTestFailureStage(message: string): FeishuTestFailureStage {
  if (/Login Required|登录态|Cookie|CSRF|csrf|_csrf_token|swp_csrf_token|401|403|shareToken|提交接口地址/i.test(message)) {
    return '登录态';
  }
  if (/所属项目选项|项目选项|项目列表|projectOption|options|单选|选项 ID/i.test(message)) {
    return '项目选项';
  }
  if (/字段 ID|字段映射|明细表问题|日期字段|汇报人字段|工作时长字段|工作内容字段|汇报人 userId|汇报人名称|日期格式/i.test(message)) {
    return '字段映射';
  }
  return '接口返回';
}

function parseFeishuTestSubmitFailure(error: unknown) {
  const rawMessage = getErrorMessage(error);
  const matched = rawMessage.match(/飞书测试提交失败(?:（(.+?)）)?[：:]\s*([\s\S]*)/);
  const stage = (matched?.[1] as FeishuTestFailureStage | undefined) ?? inferFeishuTestFailureStage(rawMessage);
  const body = (matched?.[2] || rawMessage).trim();
  const suggestionDivider = '。建议：';
  const suggestionIndex = body.indexOf(suggestionDivider);
  const detail = (suggestionIndex >= 0 ? body.slice(0, suggestionIndex) : body).trim();
  const suggestion = (suggestionIndex >= 0 ? body.slice(suggestionIndex + suggestionDivider.length) : feishuFailureFallbackSuggestions[stage]).trim();

  return {
    stage,
    title: `飞书测试提交失败：${stage}`,
    detail,
    suggestion,
    panel: feishuFailurePanelMap[stage],
  };
}

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


  async function showFeishuTestFailure(error: unknown) {
    const diagnosis = parseFeishuTestSubmitFailure(error);
    if (!advancedConfigPanels.value.includes(diagnosis.panel)) {
      advancedConfigPanels.value = [...advancedConfigPanels.value, diagnosis.panel];
    }
    status.value = `${diagnosis.title}：${diagnosis.detail}`;
    await ElMessageBox.alert(`${diagnosis.detail}\n\n建议：${diagnosis.suggestion}`, diagnosis.title, {
      confirmButtonText: '去检查配置',
      type: 'error',
    }).catch(() => undefined);
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
      await showFeishuTestFailure(error);
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
