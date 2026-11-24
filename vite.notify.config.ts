import { defineConfig } from 'vite';

// 알림 보내는 스크립트(scripts/notify.ts)를 Node에서 바로 돌릴 수 있게 한 파일로 묶는다.
// 앱과 같은 알림 계산 코드(src/lib/notify.ts)를 그대로 쓴다.
export default defineConfig({
  publicDir: false,
  build: {
    ssr: 'scripts/notify.ts',
    outDir: 'dist-notify',
    emptyOutDir: true,
    target: 'node22',
  },
});
