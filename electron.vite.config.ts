import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'node:path';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve('electron/main.ts'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve('electron/preload.ts'),
        formats: ['cjs'],
        fileName: () => 'preload.js',
      },
    },
  },
  renderer: {
    plugins: [vue()],
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@use "@/styles/tools" as *;`,
        },
      },
    },
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 15174,
      strictPort: true,
    },
    build: {
      minify: 'oxc',
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
        },
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/');
            if (!normalizedId.includes('/node_modules/')) return undefined;
            if (normalizedId.includes('/element-plus/')) return 'vendor-element-plus';
            if (normalizedId.includes('/echarts/') || normalizedId.includes('/zrender/')) return 'vendor-echarts';
            if (normalizedId.includes('/lucide-vue-next/')) return 'vendor-icons';
            if (normalizedId.includes('/three/')) return 'vendor-3d';
            if (normalizedId.includes('/@vueuse/')) return 'vendor-vueuse';
            if (normalizedId.includes('/vue/') || normalizedId.includes('/vue-router/')) return 'vendor-vue';
            return 'vendor';
          },
        },
      },
    },
  },
});
