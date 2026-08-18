import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
  },
  server: {
    port: 3000,
    // السماح بأي مضيف أثناء التطوير (بيئات المعاينة/الأنفاق). لا يؤثر على الإنتاج.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8787',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'chart-vendor': ['chart.js', 'react-chartjs-2'],
          'motion-vendor': ['framer-motion'],
          'swiper-vendor': ['swiper'],
          /**
           * ترجمات لوحة الإدارة في حزمة مستقلة.
           * AdminLayout يُستورد مباشرة (غير كسول) لأسباب معمارية سابقة،
           * فبدون هذا الفصل تدخل نصوص اللوحة حزمة المتجر ويحمّلها كل زائر
           * رغم أنه لن يراها أبداً.
           */
          'admin-i18n': ['./src/i18n/adminTranslations.js'],
        },
      },
    },
  },
});
