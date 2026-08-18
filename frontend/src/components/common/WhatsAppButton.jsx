import { FaWhatsapp } from 'react-icons/fa';
import { motion } from 'framer-motion';
import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { localizedBrandName } from '@/utils/helpers';

/** زر واتساب عائم — يظهر فقط عند ضبط الرقم من لوحة الإدارة */
export default function WhatsAppButton() {
  const { settings } = useConfig();
  const { lang } = useI18n();
  const c = settings.contact || {};

  if (!c.whatsappEnabled || !c.whatsapp) return null;

  const number = String(c.whatsapp).replace(/[^\d]/g, '');
  const brand = localizedBrandName(settings.siteName, settings.siteNameAr, lang);
  const text = encodeURIComponent(`${c.whatsappMessage || 'مرحباً'} ${brand}`);

  return (
    <motion.a
      href={`https://wa.me/${number}?text=${text}`}
      target="_blank"
      rel="noreferrer"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1.2, type: 'spring', damping: 14 }}
      className="fixed bottom-6 start-6 z-30 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lift transition hover:scale-110"
      aria-label="WhatsApp"
    >
      <FaWhatsapp size={28} />
      <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#25D366] opacity-40" />
    </motion.a>
  );
}
