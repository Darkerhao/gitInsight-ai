import { createRouter, createWebHashHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

export const navKeys = ['dashboard', 'repositories', 'sync', 'messages', 'help', 'material', 'config', 'generate', 'weekly', 'summary', 'reflection', 'history', 'timeline', 'coins', 'ai', 'system', 'about'] as const;
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
    if (value === '/sync:list') return '/sync?tab=list';
    if (value === '/sync:calendar') return '/sync?tab=calendar';
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
    path: '/farm',
    redirect: '/timeline',
  },
  {
    path: '/sync\\::tab(list|calendar)',
    redirect: (to) => ({ path: '/sync', query: { tab: to.params.tab } }),
  },
  {
    path: `/:nav(${navKeys.join('|')})`,
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
