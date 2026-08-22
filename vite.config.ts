/// <reference types="vitest" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type PluginOption} from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({mode}) => {
  const supportedModes = ['development', 'production', 'test', 'staging'];
  if (!supportedModes.includes(mode)) {
    throw new Error(`Unsupported Vite mode "${mode}". Refusing to fall back to production Firebase.`);
  }
  const firebaseConfigPath = mode === 'staging'
    ? path.resolve(__dirname, 'firebase-applet-config.staging.json')
    : path.resolve(__dirname, 'firebase-applet-config.json');
  return {
    base: '/',
    plugins: [
      react(),
      tailwindcss() as PluginOption,
      visualizer({ filename: 'stats.html', gzipSize: true, brotliSize: true }) as unknown as PluginOption
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@firebase-config': firebaseConfigPath,
      },
    },
    server: {
      // File watching can be disabled in constrained remote development environments.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    test: {
      globals: true,
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
  };
});
