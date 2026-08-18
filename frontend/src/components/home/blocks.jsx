import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiArrowRight, FiChevronDown } from 'react-icons/fi';
import { useState } from 'react';
import SectionHeader from '@/components/ui/SectionHeader';
import SmartImage from '@/components/ui/SmartImage';
import { applyGender, useI18n } from '@/i18n';
import { cn, localized } from '@/utils/helpers';

/**
 * بلوكات بانى الصفحة — مكوّنات عرض خالصة (Presentation only).
 * لا تحمل أي منطق أعمال؛ كل القيم تأتي من إعدادات البلوك المخزّنة في D1.
 * الألوان تُستخدم كـ tokens فقط (bg-cream/text-ink/… ) أو من إعدادات
 * البلوك (background/textColor) كي تعمل مع جميع الثيمات.
 */

const or = (v, fb) => (v === undefined || v === null || v === '' ? fb : v);

const sanitizeHex = (v, fallback) => (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v.trim()) ? v.trim() : fallback);

/**
 * غلاف تصميمي مشترك لكل بلوك:
 * خلفية (لون)، لون نص، حشوات Desktop/Mobile، نصف قطر، محاذاة،
 * وأنيميشن ظهور. كل القيم اختيارية وتعود لافتراضات الثيم.
 * قواعد .section-sec في index.css تقرأ CSS vars للحشوات المتجاوبة.
 */
export function SectionShell({ s = {}, children, className }) {
  const bg = sanitizeHex(s.background, null);
  const color = sanitizeHex(s.textColor, null);
  const radius = sanitizeHex(s.radius, null);
  const padTop = Math.max(0, Number(s.paddingTop) || 0);
  const padBottom = Math.max(0, Number(s.paddingBottom) || 0);
  const padTopMobile = Math.max(0, Number(s.paddingTopMobile) || 0);
  const padBottomMobile = Math.max(0, Number(s.paddingBottomMobile) || 0);
  const align = s.textAlign || null;
  const hasCustomPad = padTop > 0 || padBottom > 0 || padTopMobile > 0 || padBottomMobile > 0;
  const alignCls = align === 'center' ? 'text-center' : align === 'end' ? 'text-end' : '';
  const animate = s.animation && s.animation !== 'none';

  const style = {
    ...(bg ? { backgroundColor: bg } : null),
    ...(color ? { color } : null),
    ...(radius ? { borderRadius: radius } : null),
    ...(hasCustomPad
      ? {
          '--sec-pt-mobile': padTopMobile > 0 ? `${padTopMobile}px` : padTop > 0 ? `${padTop}px` : undefined,
          '--sec-pb-mobile': padBottomMobile > 0 ? `${padBottomMobile}px` : padBottom > 0 ? `${padBottom}px` : undefined,
          '--sec-pt-desktop': padTop > 0 ? `${padTop}px` : undefined,
          '--sec-pb-desktop': padBottom > 0 ? `${padBottom}px` : undefined
        }
      : null)
  };

  const cls = cn('section-sec', alignCls, className);

  if (animate) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.5 }}
        className={cls}
        style={style}
      >
        {children}
      </motion.section>
    );
  }
  return (
    <section className={cls} style={style}>
      {children}
    </section>
  );
}

/** بانر واحد: صورة + عنوان + وصف + زر */
export function BannerBlock({ s = {} }) {
  const { t, lang, isRTL } = useI18n();
  const Arrow = isRTL ? FiArrowLeft : FiArrowRight;
  const align = s.textAlign || 'start';
  const justify =
    align === 'center' ? 'justify-center text-center' : align === 'end' ? 'justify-end text-end' : 'justify-start text-start';
  const overlay = Math.min(95, Math.max(0, Number(s.overlayOpacity ?? 55))) / 100;

  if (!s.image) return null;

  return (
    <section className="relative overflow-hidden" style={sanitizeHex(s.background, null) ? { backgroundColor: s.background } : { backgroundColor: 'var(--color-ink)' }}>
      <div className="relative">
        <picture className="block w-full">
          {s.mobileImage ? <source media="(max-width: 767px)" srcSet={s.mobileImage} /> : null}
          <SmartImage src={s.image} alt={localized(s, lang, 'title')} loading="lazy" className="h-[300px] w-full object-cover md:h-[420px]" />
        </picture>
        <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${overlay})` }} />
        <div className={`absolute inset-0 flex ${justify}`}>
          <div className="container-x flex items-center">
            <div className="max-w-xl py-10 md:py-14" style={sanitizeHex(s.textColor, null) ? { color: s.textColor } : { color: '#fff' }}>
              {s.title || s.titleEn ? (
                <h2 className="text-2xl font-bold leading-tight text-balance md:text-4xl">
                  {applyGender(localized(s, lang, 'title'), 'female')}
                </h2>
              ) : null}
              {s.subtitle || s.subtitleEn ? (
                <p className="mt-3 max-w-md text-sm leading-relaxed opacity-80 md:text-base">
                  {applyGender(localized(s, lang, 'subtitle'), 'female')}
                </p>
              ) : null}
              {(s.buttonText || s.buttonTextEn) && s.buttonUrl ? (
                <Link
                  to={s.buttonUrl}
                  className="group mt-6 inline-flex items-center gap-2 rounded-full bg-rose px-7 py-3 text-sm font-bold text-white shadow-card transition hover:bg-white hover:text-ink"
                >
                  {localized(s, lang, 'buttonText')}
                  <Arrow className="transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" size={15} />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** بلوك نص حر: عنوان + وصف + محتوى HTML مُنظَّف */
export function TextBlock({ s = {} }) {
  const { lang } = useI18n();
  const body = or(lang === 'ar' ? s.body : s.bodyEn, (lang === 'ar' ? s.bodyEn : s.body) || s.body || '');
  if (!s.title && !s.titleEn && !s.subtitle && !s.subtitleEn && !body) return null;
  return (
    <section className="section bg-white">
      <div className="container-x">
        <SectionHeader
          title={applyGender(localized(s, lang, 'title'), 'female')}
          subtitle={applyGender(localized(s, lang, 'subtitle'), 'female')}
          align={s.textAlign || 'start'}
        />
        {body ? (
          <div
            className={cn(
              'prose-rtl mx-auto max-w-3xl text-sm leading-loose text-ink-soft',
              (s.textAlign === 'center' || s.textAlign === 'end') && 'text-center'
            )}
            dangerouslySetInnerHTML={{ __html: body }}
          />
        ) : null}
      </div>
    </section>
  );
}

/** بلوك صورة + نص جنباً إلى جنب */
export function ImageTextBlock({ s = {} }) {
  const { t, lang, isRTL } = useI18n();
  const Arrow = isRTL ? FiArrowLeft : FiArrowRight;
  if (!s.image) return null;
  const flip = s.imagePosition === 'end'; // صورة في نهاية السطر (يسار في RTL)
  const body = or(lang === 'ar' ? s.body : s.bodyEn, (lang === 'ar' ? s.bodyEn : s.body) || s.body || '');
  return (
    <section className="section bg-white">
      <div className="container-x">
        <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
          <div className={cn('relative', flip && 'md:order-2')}>
            <SmartImage src={s.image} alt={localized(s, lang, 'title')} loading="lazy" className="aspect-[4/3] w-full rounded-2xl object-cover shadow-card" />
          </div>
          <div className={cn(flip && 'md:order-1')}>
            {s.title || s.titleEn ? (
              <h2 className="text-2xl font-bold text-ink md:text-3xl">{applyGender(localized(s, lang, 'title'), 'female')}</h2>
            ) : null}
            {s.subtitle || s.subtitleEn ? (
              <p className="mt-3 text-sm font-semibold text-rose">{applyGender(localized(s, lang, 'subtitle'), 'female')}</p>
            ) : null}
            {body ? (
              <div
                className="prose-rtl mt-4 text-sm leading-loose text-ink-soft"
                dangerouslySetInnerHTML={{ __html: body }}
              />
            ) : null}
            {(s.buttonText || s.buttonTextEn) && s.buttonUrl ? (
              <Link
                to={s.buttonUrl}
                className="group mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3 text-sm font-bold text-white transition hover:bg-rose"
              >
                {localized(s, lang, 'buttonText')}
                <Arrow className="transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" size={15} />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/** بلوك أسئلة شائعة — عناصر تُدار من بانى الصفحة */
export function FaqBlock({ s = {} }) {
  const { lang } = useI18n();
  const items = Array.isArray(s.items) ? s.items.filter((i) => i && (i.question || i.questionEn)) : [];
  const [open, setOpen] = useState(-1);
  if (!items.length) return null;
  return (
    <section className="section">
      <div className="container-x">
        <SectionHeader
          title={applyGender(localized(s, lang, 'title'), 'female')}
          subtitle={applyGender(localized(s, lang, 'subtitle'), 'female')}
          align={s.textAlign || 'center'}
        />
        <div className="mx-auto max-w-3xl space-y-3">
          {items.map((f, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
              <button
                type="button"
                onClick={() => setOpen(open === i ? -1 : i)}
                className="flex w-full items-center justify-between gap-4 p-5 text-start"
              >
                <span className="text-sm font-bold text-ink">
                  {applyGender(localized(f, lang, 'question'), 'female')}
                </span>
                <FiChevronDown
                  size={18}
                  className={cn('shrink-0 text-rose transition-transform', open === i && 'rotate-180')}
                />
              </button>
              {open === i ? (
                <p className="whitespace-pre-line border-t border-black/5 p-5 text-sm leading-loose text-ink-soft">
                  {applyGender(localized(f, lang, 'answer'), 'female')}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** بلوك دعوة لاتخاذ إجراء (CTA): خلفية صورة/لون + عنوان + زر */
export function CtaBlock({ s = {} }) {
  const { t, lang, isRTL } = useI18n();
  const Arrow = isRTL ? FiArrowLeft : FiArrowRight;
  if ((!s.title && !s.titleEn && !s.subtitle && !s.subtitleEn) || (!s.buttonText && !s.buttonTextEn)) return null;
  const textColor = sanitizeHex(s.textColor, null);
  return (
    <section className="relative overflow-hidden">
      {s.image ? (
        <>
          <SmartImage src={s.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${Math.min(90, Number(s.overlayOpacity ?? 60)) / 100})` }} />
        </>
      ) : (
        <div className="absolute inset-0 bg-ink" style={sanitizeHex(s.background, null) ? { backgroundColor: s.background } : null} />
      )}
      <div className="container-x relative py-16 text-center md:py-24">
        {s.title || s.titleEn ? (
          <h2 className="mx-auto max-w-2xl text-2xl font-bold leading-tight text-balance md:text-4xl" style={textColor ? { color: textColor } : { color: '#fff' }}>
            {applyGender(localized(s, lang, 'title'), 'female')}
          </h2>
        ) : null}
        {s.subtitle || s.subtitleEn ? (
          <p className="mx-auto mt-3 max-w-xl text-sm md:text-base" style={textColor ? { color: textColor, opacity: 0.85 } : { color: 'rgba(255,255,255,.75)' }}>
            {applyGender(localized(s, lang, 'subtitle'), 'female')}
          </p>
        ) : null}
        {s.buttonUrl ? (
          <Link
            to={s.buttonUrl}
            className="group mt-8 inline-flex items-center gap-2 rounded-full bg-rose px-8 py-3.5 text-sm font-bold text-white shadow-card transition hover:bg-white hover:text-ink"
          >
            {localized(s, lang, 'buttonText') || t?.('common.viewAll')}
            <Arrow className="transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" size={15} />
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/** فاصل/مساحة: يتحكم بالمسافات وفاصل اختياري */
export function SpacerBlock({ s = {} }) {
  const height = Math.max(0, Math.min(200, Number(s.spacing) || 0));
  if (s.showDivider) {
    return (
      <section className="section bg-transparent">
        <div className="container-x">
          <div className="mx-auto max-w-5xl border-t border-black/10" style={{ marginTop: height, marginBottom: height }} />
        </div>
      </section>
    );
  }
  return <div aria-hidden="true" style={{ height }} />;
}
