import { useEffect, useState } from 'react';
import AppRoutes from '@/routes';
import AppLoader from '@/components/common/AppLoader';
import Maintenance from '@/pages/Maintenance';
import ScrollToTop from '@/components/common/ScrollToTop';
import { useConfig } from '@/config/ConfigProvider';
import { useAuthStore } from '@/store/authStore';
import { useI18n } from '@/i18n';
import { FiWifiOff, FiRefreshCw } from 'react-icons/fi';

/**
 * شاشة "الخادم غير متاح" — تُعرض عندما يفشل طلب إعدادات المتجر الابتدائي.
 *
 * كانت هذه الحالة تُبتلع بصمت فيُعرض المتجر بصفحة بيضاء فارغة تماماً
 * (كل المحتوى يأتي من الـAPI)، فلا يعرف المستخدم أن الـBackend متوقف.
 * الآن تظهر رسالة تشخيص واضحة مع زر إعادة محاولة بدل الفراغ الصامت.
 */
function BackendUnavailable({ onRetry }) {
  const { t } = useI18n();
  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    setRetrying(true);
    await onRetry?.();
    setRetrying(false);
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-6 py-16 text-center">
      <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-8 shadow-soft">
        <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-amber-600">
          <FiWifiOff size={28} />
        </span>
        <h1 className="text-xl font-bold text-ink md:text-2xl">{t('errors.backendUnavailable')}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t('errors.backendUnavailableDesc')}</p>
        {/*
          أمر تشغيل التطوير — يظهر للمطوّر المحلي فقط.
          import.meta.env.DEV يُستبدل بـ false عند بناء الإنتاج،
          فيُحذف هذا السطر ونصّه بالكامل من الحزمة النهائية.
        */}
        {import.meta.env.DEV ? (
          <p dir="ltr" className="font-en mt-4 rounded-xl bg-cream px-3 py-2 text-xs text-ink-soft">
            cd backend &amp;&amp; npx wrangler dev
          </p>
        ) : null}
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-ink px-8 py-3 text-sm font-bold text-white transition hover:bg-rose disabled:opacity-60"
        >
          <FiRefreshCw size={15} className={retrying ? 'animate-spin' : ''} />
          {t('common.retry')}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const refresh = useAuthStore((s) => s.refresh);
  const { loading, maintenance, settings, configError, reload } = useConfig();

  useEffect(() => {
    refresh();
  }, [refresh]);

  /*
    ننتظر إعدادات المتجر قبل أول رسم.
    بدونها كان المتجر يرسم بالألوان الافتراضية ثم يقفز إلى ألوان
    المدير (وميض مزعج)، ولم تكن هناك أي شاشة تحميل تعرض شعار
    العلامة الذي يستطيع المدير رفعه.
  */
  if (loading) return <AppLoader />;

  /* الخادم غير متاح عند الإقلاع — شاشة تشخيص واضحة بدل صفحة بيضاء صامتة */
  if (configError) return <BackendUnavailable onRetry={reload} />;

  /*
    وضع الصيانة: الخادم يعيد 503 لكل مسارات المتجر ويمرّر الإداريين.
    كانت الحالة تُخزَّن ولا تُعرض أبداً — فيرى الزائر متجراً بالقيم
    الافتراضية بدل رسالة الصيانة. لوحة الإدارة تبقى متاحة كي يستطيع
    المالك إطفاء الوضع من الداخل.
  */
  /*
    مصدران للحقيقة عن قصد:
      • settings.maintenance.enabled — الحالة المعلنة في /storefront/config
        (هذا المسار مستثنى من الحجب كي يستطيع العميل قراءة الرسالة).
      • maintenance — رسالة 503 من أي مسار آخر (شبكة أبطأ/طلب مباشر).
    الاعتماد على الثاني وحده كان يعني ألا تظهر الصفحة أبداً، لأن أول
    ما يطلبه المتجر هو الـ config المسموح به.
  */
  const isDown = Boolean(settings?.maintenance?.enabled || maintenance);
  if (isDown && !window.location.pathname.startsWith('/admin')) {
    return <Maintenance />;
  }

  return (
    <>
      <ScrollToTop />
      <AppRoutes />
    </>
  );
}
