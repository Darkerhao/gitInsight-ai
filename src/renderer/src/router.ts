import { createRouter, createWebHashHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

export const navKeys = ['dashboard', 'repositories', 'about', 'help', 'config', 'generate', 'messages', 'sync', 'history', 'system'] as const;
export type NavKey = (typeof navKeys)[number];

const EmptyRouteView = {
  name: 'EmptyRouteView',
  render: () => null,
};

function getLastRoute() {
  const fallback = '/dashboard';
  try {
    const value = window.localStorage.getItem('gitinsight:last-route');
    return value && value !== '/' ? value : fallback;
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
    path: '/:nav(dashboard|repositories|about|help|config|generate|messages|sync|history|system)',
    component: EmptyRouteView,
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard',
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
