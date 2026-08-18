import { FaWhatsapp } from 'react-icons/fa';
import { useConfig } from '@/config/ConfigProvider';
import { registerExtraTranslations, useI18n } from '@/i18n';
import { paymentTranslations } from '@/i18n/paymentTranslations';
import { cn } from '@/utils/helpers';

registerExtraTranslations('payments', paymentTranslations);

/**
 * زر واتساب مرتبط بطلب محدد.
 * الرقم من إعدادات المتجر (لوحة الإدارة ← بيانات التواصل) — لا hardcode.
 * الرسالة تُجهَّز تلقائياً برقم الطلب فقط (لا بيانات حساسة إضافية).
 */
export default function WhatsAppOrderButton({ orderNumber, order, className, size = 'md' }) {
  const { t } = useI18n();
  const { settings } = useConfig();
  const c = settings.contact || {};

  if (!c.whatsappEnabled || !c.whatsapp) return null;

  const number = String(c.whatsapp).replace(/[^\d]/g, '');
  if (!number) return null;

  const total = order?.total != null ? String(order.total) : '';
  const method = order?.paymentMethod || '';
  const text = encodeURIComponent(
    t('payment.whatsappMessage', { orderNumber: orderNumber || order?.orderNumber || '', total, method })
  );

  return (
    <a
      href={`https://wa.me/${number}?text=${text}`}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] font-bold text-white shadow-soft transition hover:brightness-105',
        size === 'lg' ? 'px-6 py-3 text-sm' : 'px-4 py-2.5 text-xs sm:text-sm',
        className
      )}
    >
      <FaWhatsapp size={size === 'lg' ? 18 : 16} />
      {t('payment.whatsappContact')}
    </a>
  );
}
