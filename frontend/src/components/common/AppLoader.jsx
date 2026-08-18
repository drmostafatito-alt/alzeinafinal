import Spinner from '@/components/ui/Spinner';
import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { mediaUrl } from '@/utils/media';

/**
 * شاشة التحميل الأولى للمتجر.
 *
 * كانت حقول branding.loadingLogo / loadingText / loadingTextEn قابلة
 * للتعديل من: المنصّة ← العلامة البيضاء، لكن لم توجد شاشة تحميل أصلاً
 * تعرضها — إعداد وهمي بالكامل: المدير يرفع شعاراً ولا يظهر في أي مكان.
 *
 * الآن تظهر أثناء جلب إعدادات المتجر (قبل أول رسم للمحتوى). لو لم
 * يضبط المدير شيئاً تعرض دوّامة بسيطة على ألوان الثيم — أي أن المتاجر
 * القائمة لا ترى تغييراً يُذكر (كانت الشاشة بيضاء لجزء من الثانية).
 */
export default function AppLoader() {
  const { settings } = useConfig();
  const { lang } = useI18n();
  const brand = settings.branding || {};

  const logo = brand.loadingLogo || settings.logo || '';
  const text = (lang === 'ar' ? brand.loadingText : brand.loadingTextEn) || brand.loadingText || '';

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 bg-cream"
      role="status"
      aria-live="polite"
    >
      {logo ? (
        <img src={mediaUrl(logo)} alt="" className="h-16 w-auto animate-pulse object-contain" />
      ) : null}
      <Spinner size={34} className="text-rose" />
      {text ? <p className="text-sm font-medium text-ink-muted">{text}</p> : null}
    </div>
  );
}
