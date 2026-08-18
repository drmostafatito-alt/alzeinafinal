import { motion } from 'framer-motion';
import { FiAward, FiHeadphones, FiRefreshCw, FiTruck } from 'react-icons/fi';
import { useConfig } from '@/config/ConfigProvider';
import { applyGender, useI18n } from '@/i18n';
import SectionHeader from '@/components/ui/SectionHeader';

/**
 * شريط المزايا.
 * المصدر الأول: عناصر الإعدادات العامة (settings.featuresStrip.items).
 * المصدر الثاني: عناصر بلوك محدد من بانى الصفحة (props.items).
 * بلا أي مصدر مخصص → النصوص الافتراضية المترجمة (توافق خلفي كامل).
 */
export default function FeaturesStrip({ items: blockItems, title, subtitle } = {}) {
  const { t, lang, gender } = useI18n();
  const { settings } = useConfig();

  const fs = settings.featuresStrip || {};
  const fromSettings = Array.isArray(fs.items)
    ? fs.items.filter((i) => i && i.enabled !== false && (i.title || i.titleEn))
    : [];
  const fromBlock = Array.isArray(blockItems)
    ? blockItems.filter((i) => i && i.enabled !== false && (i.title || i.titleEn))
    : [];

  const custom = fromBlock.length ? fromBlock : fromSettings;

  const features = custom.length
    ? custom.map((i) => ({
        icon: null,
        emoji: i.icon || '',
        title: applyGender((lang === 'ar' ? i.title : i.titleEn) || i.title || '', gender),
        desc: applyGender((lang === 'ar' ? i.desc : i.descEn) || i.desc || '', gender),
      }))
    : [
        { icon: FiTruck, title: t('home.features.shipping'), desc: t('home.features.shippingDesc') },
        { icon: FiAward, title: t('home.features.original'), desc: t('home.features.originalDesc') },
        { icon: FiRefreshCw, title: t('home.features.returns'), desc: t('home.features.returnsDesc') },
        { icon: FiHeadphones, title: t('home.features.support'), desc: t('home.features.supportDesc') },
      ];

  if (fs.enabled === false) return null;

  return (
    <section className="border-b border-black/5 bg-white">
      <div className="container-x py-8">
        {title || subtitle ? (
          <SectionHeader title={title} subtitle={subtitle} align="center" className="mb-6" />
        ) : null}
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4">
          {features.map(({ icon: Icon, emoji, title, desc }, i) => (
            <motion.div
              key={title + i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="flex items-start gap-3"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blush text-rose">
                {Icon ? <Icon size={19} /> : <span className="text-lg" aria-hidden="true">{emoji}</span>}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">{title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
