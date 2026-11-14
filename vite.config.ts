import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * API 서버와의 연결(DNS·TLS)을 스크립트를 내려받는 동안 미리 열어, 첫 요청이 그만큼 빨리 나가게 한다.
 * 서버 주소가 절대 주소로 설정된 배포에만 넣고, 같은 출처(/api)를 쓰는 환경에는 넣지 않는다.
 */
function preconnectBackend(): Plugin {
  let origins: string[] = [];
  return {
    name: 'cameo-preconnect-backend',
    configResolved(config) {
      const found = new Set<string>();
      for (const value of [config.env.VITE_API_URL, config.env.VITE_BACKEND_ORIGIN]) {
        try {
          const url = new URL(String(value));
          if (url.protocol === 'https:' || url.protocol === 'http:') found.add(url.origin);
        } catch {
          // 상대 경로나 빈 값은 미리 열 대상이 없다.
        }
      }
      origins = [...found];
    },
    transformIndexHtml: () =>
      origins.map(href => ({
        tag: 'link',
        attrs: { rel: 'preconnect', href },
        injectTo: 'head-prepend' as const,
      })),
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), preconnectBackend()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
  },
});
