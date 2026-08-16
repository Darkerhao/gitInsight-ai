import { onMounted } from 'vue';
import { countWeeklyReportFiles } from '@shared/weeklyReport';
import { useAssistant } from './useAssistant';
import { createWeeklyReportActions } from './weeklyReportActions';
import { createWeeklyReportCommands } from './weeklyReportCommands';
import { createWeeklyReportMutations, useWeeklyReportState } from './useWeeklyReportState';
import {
  formatWeeklyDateLabel,
  getWeeklyDraftStatusLabel,
  getWeeklyDraftStatusType,
  getWeeklyHoursSourceLabel,
} from './weeklyReportDrafts';

function loadProjectOptionsOnMount(assistant: ReturnType<typeof useAssistant>) {
  onMounted(() => {
    const form = assistant.config.feishuForm;
    if (assistant.projectOptions.value.length === 0 && form.projectFieldId && form.shareToken) {
      void assistant.loadFeishuProjects({ silent: true });
    }
  });
}

export function useWeeklyReports() {
  const assistant = useAssistant();
  const state = useWeeklyReportState(assistant);
  const mutations = createWeeklyReportMutations(state, () => assistant.config.feishuForm.defaultWorkHours);
  const actions = createWeeklyReportActions({
    api: window.api, config: assistant.config,
    getProjectOptions: () => assistant.projectOptions.value,
    displayRepoName: state.displayRepoName,
  });
  const commands = createWeeklyReportCommands({ assistant, state, actions, mutations });
  loadProjectOptionsOnMount(assistant);
  return {
    config: assistant.config, sortedRepos: assistant.sortedRepos, projectOptions: assistant.projectOptions,
    projectLoading: assistant.projectLoading, feishuLoading: assistant.feishuLoading,
    ...state, ...mutations, ...commands,
    formatDateLabel: formatWeeklyDateLabel, getStatusLabel: getWeeklyDraftStatusLabel,
    getStatusType: getWeeklyDraftStatusType, getHoursSourceLabel: getWeeklyHoursSourceLabel,
    loadFeishuProjects: assistant.loadFeishuProjects, countWeeklyReportFiles,
  };
}
