import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Прокси как в nginx: клиент ходит на ws://localhost:5173/livekit/... → LiveKit на 7880 */
const livekitTarget = process.env.VITE_LIVEKIT_DEV_PROXY ?? 'http://127.0.0.1:7880';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/livekit': {
        target: livekitTarget,
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/livekit/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/tests/**', 'src/vite-env.d.ts'],
    },
  },
});

