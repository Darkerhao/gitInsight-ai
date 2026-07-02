import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'node:path';
import vue from '@vitejs/plugin-vue';

const appEdition = process.env.APP_EDITION === 'standard' ? 'standard' : 'lite';
const appEditionLabel = appEdition === 'standard' ? '标准版' : '简洁版';
const appProductName = appEdition === 'standard' ? 'GitInsight AI Standard' : 'GitInsight AI Lite';
const editionDefines = {
  __APP_EDITION__: JSON.stringify(appEdition),
  __APP_EDITION_LABEL__: JSON.stringify(appEditionLabel),
  __APP_PRODUCT_NAME__: JSON.stringify(appProductName),
};

export default defineConfig({
  main: {
    define: editionDefines,
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve('electron/main.ts'),
      },
    },
  },
  preload: {
    define: editionDefines,
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
    define: editionDefines,
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5174,
      strictPort: true,
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
        },
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/');
            if (!normalizedId.includes('/node_modules/')) return undefined;
            if (normalizedId.includes('/element-plus/')) return 'vendor-element-plus';
            if (normalizedId.includes('/echarts/')) return 'vendor-echarts';
            if (normalizedId.includes('/lucide-vue-next/')) return 'vendor-icons';
            if (normalizedId.includes('/gsap/')) return 'vendor-animation';
            if (normalizedId.includes('/@vueuse/')) return 'vendor-vueuse';
            if (normalizedId.includes('/vue/') || normalizedId.includes('/vue-router/')) return 'vendor-vue';
            return 'vendor';
          },
        },
      },
    },
  },
});
