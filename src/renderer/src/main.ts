import { createApp } from 'vue';
import {
  ElAlert,
  ElAvatar,
  ElBadge,
  ElButton,
  ElButtonGroup,
  ElCalendar,
  ElCheckbox,
  ElCheckboxGroup,
  ElCollapse,
  ElCollapseItem,
  ElDatePicker,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDrawer,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElLoading,
  ElMenu,
  ElMenuItem,
  ElOption,
  ElPagination,
  ElPopover,
  ElProgress,
  ElRadio,
  ElResult,
  ElSegmented,
  ElSelect,
  ElStep,
  ElSteps,
  ElSubMenu,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
  ElTag,
  ElTimePicker,
  ElTooltip,
  provideGlobalConfig,
} from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import './styles/index.scss';
import App from './App.vue';
import router from './router';

performance.mark('gitinsight:renderer-entry');
const app = createApp(App);
for (const component of [
  ElAlert, ElAvatar, ElBadge, ElButton, ElButtonGroup, ElCalendar, ElCheckbox, ElCheckboxGroup,
  ElCollapse, ElCollapseItem, ElDatePicker, ElDescriptions, ElDescriptionsItem, ElDialog, ElDrawer,
  ElEmpty, ElForm, ElFormItem, ElInput, ElInputNumber, ElMenu, ElMenuItem, ElOption, ElPagination,
  ElPopover, ElProgress, ElRadio, ElResult, ElSegmented, ElSelect, ElStep, ElSteps,
  ElSubMenu, ElSwitch, ElTable, ElTableColumn, ElTabPane, ElTabs, ElTag, ElTimePicker, ElTooltip,
]) {
  app.use(component);
}
app.use(ElLoading);
provideGlobalConfig({ locale: zhCn }, app, true);
app.use(router).mount('#app');
performance.mark('gitinsight:shell-mounted');
performance.measure('gitinsight:shell-mount', 'gitinsight:renderer-entry', 'gitinsight:shell-mounted');

const bootShell = document.getElementById('app-boot');
if (bootShell) {
  window.requestAnimationFrame(() => {
    bootShell.classList.add('is-leaving');
    window.setTimeout(() => {
      bootShell.remove();
      document.documentElement.removeAttribute('data-boot-theme');
    }, 220);
  });
} else {
  document.documentElement.removeAttribute('data-boot-theme');
}
