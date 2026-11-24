/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages는 https://<user>.github.io/todo-planner/ 아래에서 서비스된다.
// 다른 곳에 배포하면 BASE_PATH 환경변수로 바꾼다.
const base = process.env.BASE_PATH ?? '/todo-planner/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '할 일·일정',
        short_name: '할 일',
        description: '할 일과 일정을 한곳에 적어두는 개인용 웹앱',
        lang: 'ko',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f7f7f5',
        theme_color: '#f7f7f5',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        // 나이스 API 응답은 캐시하지 않는다(앱이 자체적으로 짧게 캐시함).
        navigateFallbackDenylist: [/^\/hub\//],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
});
