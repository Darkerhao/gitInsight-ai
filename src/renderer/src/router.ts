import { createRouter, createWebHashHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

export const navKeys = ['config', 'generate', 'history', 'system'] as const;
export type NavKey = (typeof navKeys)[number];

const EmptyRouteView = {
  name: 'EmptyRouteView',
  render: () => null,
};

function getLastRoute() {
  const fallback = '/generate';
  try {
    const value = window.localStorage.getItem('gitinsight:last-route');
    if (!value || value === '/') return fallback;
    const nav = value.replace(/^\//, '').split('?')[0];
    return navKeys.includes(nav as NavKey) ? value : fallback;
  } catch {
    return fallback;
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: () => getLastRoute(),
  },
  {
    path: '/:nav(config|generate|history|system)',
    component: EmptyRouteView,
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/generate',
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.afterEach((to) => {
  if (to.path !== '/') {
    window.localStorage.setItem('gitinsight:last-route', to.fullPath);
  }
});

export default router;
