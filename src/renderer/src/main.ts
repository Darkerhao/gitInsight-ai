import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import './style.css';
import App from './App.vue';
import router from './router';

createApp(App).use(router).use(ElementPlus, { locale: zhCn }).mount('#app');

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
