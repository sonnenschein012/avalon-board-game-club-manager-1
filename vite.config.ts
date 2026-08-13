/// <reference types="vitest" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type PluginOption} from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({mode}) => {
  const supportedModes = ['development', 'production', 'test', 'staging'];
  if (!supportedModes.includes(mode)) {
    throw new Error(`Unsupported Vite mode "${mode}". Refusing to fall back to production Firebase.`);
  }
  const firebaseConfigPath = mode === 'staging'
    ? path.resolve(__dirname, 'firebase-applet-config.staging.json')
    : path.resolve(__dirname, 'firebase-applet-config.json');
  const env = loadEnv(mode, '.', '');
  return {
    base: '/',
    plugins: [
      react(), 
      // @ts-ignore
      tailwindcss(),
      // @ts-ignore
      visualizer({ filename: 'stats.html', gzipSize: true, brotliSize: true }) as unknown as PluginOption
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@firebase-config': firebaseConfigPath,
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    test: {
      globals: true,
      environment: 'jsdom',
    },
  };
});
