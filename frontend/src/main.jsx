import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import App from './App';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { I18nProvider } from '@/i18n';
import { ConfigProvider } from '@/config/ConfigProvider';
import { registerServiceWorker } from '@/utils/pwa';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 60 * 1000,
    },
  },
});

function ToastHost() {
  const isRTL = document.documentElement.dir === 'rtl';
  return (
    <ToastContainer
      position={isRTL ? 'top-left' : 'top-right'}
      rtl={isRTL}
      autoClose={2600}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      pauseOnHover
      theme="light"
      limit={3}
    />
  );
}

/**
 * تسجيل Service Worker.
 * يتجاهل نفسه في التطوير وداخل لوحة الإدارة، وأي فشل صامت
 * لأن PWA تحسين إضافي لا يجوز أن يمنع تشغيل المتجر.
 */
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <ConfigProvider>
            <BrowserRouter>
              <App />
              <ToastHost />
            </BrowserRouter>
          </ConfigProvider>
        </QueryClientProvider>
      </I18nProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
