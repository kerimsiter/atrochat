import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const serverPort = Number(env.VITE_PORT ?? env.PORT ?? 5173);
    const previewPort = Number(env.VITE_PREVIEW_PORT ?? env.PREVIEW_PORT ?? 4173);
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      server: {
        port: serverPort,
        strictPort: false,
        host: true,
      },
      preview: {
        port: previewPort,
        host: true,
      }
    };
});
