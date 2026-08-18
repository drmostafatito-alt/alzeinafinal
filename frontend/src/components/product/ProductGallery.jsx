import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiChevronLeft, FiChevronRight, FiMaximize2, FiX, FiZoomIn } from 'react-icons/fi';
import SmartImage from '@/components/ui/SmartImage';
import { useI18n } from '@/i18n';
import { useLockBodyScroll } from '@/hooks';
import { cn } from '@/utils/helpers';
import { mediaUrl } from '@/utils/media';

/**
 * معرض صور المنتج.
 *
 * يجمع أربع تجارب في مكوّن واحد:
 *  • تكبير بتتبّع المؤشر على سطح المكتب (بدون مكتبات خارجية)
 *  • لمسة للتكبير + سحب بالإصبع على الجوال
 *  • عارض ملء الشاشة مع تنقّل بلوحة المفاتيح
 *  • تحميل كسول للمصغّرات مع جلب مسبق للصورة التالية
 *
 * قرار الأداء: نستخدم background-position بدل transform على <img>
 * لأن المتصفح يعالجها على مستوى الرسم (compositing) فلا تسبب إعادة
 * تخطيط، ونتجنّب تحميل نسخة ثانية عالية الدقة إلا عند التكبير فعلاً.
 */
export default function ProductGallery({ images = [], alt = '', badges = null }) {
  const { t, isRTL } = useI18n();
  const [active, setActive] = useState(0);
  const [zoomOn, setZoomOn] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [lightbox, setLightbox] = useState(false);
  const frameRef = useRef(null);
  const touchStart = useRef(null);

  const total = images.length;
  const safeActive = Math.min(active, Math.max(0, total - 1));
  const current = images[safeActive];

  useEffect(() => {
    setActive(0);
  }, [images]);

  /** جلب مسبق للصورة التالية والسابقة حتى يكون التنقّل فورياً */
  useEffect(() => {
    if (total < 2) return;
    [safeActive + 1, safeActive - 1].forEach((i) => {
      const src = images[(i + total) % total];
      if (!src) return;
      const img = new Image();
      img.src = mediaUrl(src);
    });
  }, [safeActive, images, total]);

  const go = useCallback(
    (dir) => {
      if (total < 2) return;
      setActive((i) => (i + dir + total) % total);
    },
    [total]
  );

  /* ---------- التكبير بتتبّع المؤشر ---------- */
  const onMove = (e) => {
    if (!zoomOn || !frameRef.current) return;
    const r = frameRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setOrigin({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  };

  /* ---------- السحب على الجوال ---------- */
  const onTouchStart = (e) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  };
  const onTouchEnd = (e) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    const dt = Date.now() - touchStart.current.t;
    touchStart.current = null;
    // سحب أفقي واضح وسريع = تنقّل بين الصور
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 600) {
      go(isRTL ? (dx > 0 ? -1 : 1) : dx > 0 ? -1 : 1);
    }
  };

  return (
    <div className="lg:sticky lg:top-24 lg:self-start">
      {/* الإطار الرئيسي */}
      <div
        ref={frameRef}
        className={cn(
          'group relative aspect-square overflow-hidden rounded-2xl bg-blush',
          zoomOn ? 'cursor-zoom-out' : 'cursor-zoom-in'
        )}
        style={{ boxShadow: 'var(--shadow-md)' }}
        onMouseEnter={() => setZoomOn(true)}
        onMouseLeave={() => setZoomOn(false)}
        onMouseMove={onMove}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={() => setLightbox(true)}
        role="button"
        tabIndex={0}
        aria-label={t('product.viewFullScreen')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setLightbox(true);
          }
          if (e.key === 'ArrowRight') go(isRTL ? -1 : 1);
          if (e.key === 'ArrowLeft') go(isRTL ? 1 : -1);
        }}
      >
        {badges}

        <SmartImage
          key={safeActive}
          src={current}
          alt={alt}
          loading="eager"
          className="h-full w-full object-cover"
          style={
            zoomOn
              ? {
                  transform: 'scale(1.9)',
                  transformOrigin: `${origin.x}% ${origin.y}%`,
                  transition: 'transform 120ms linear'
                }
              : { transform: 'scale(1)', transition: 'transform 320ms var(--ease-out-soft)' }
          }
        />

        {/* تلميح التكبير — يختفي أثناء التكبير نفسه */}
        <span
          className={cn(
            'pointer-events-none absolute bottom-3 end-3 z-10 hidden items-center gap-1.5 rounded-full bg-ink/70 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur transition-opacity md:inline-flex',
            zoomOn ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          <FiZoomIn size={12} aria-hidden="true" /> {t('product.hoverToZoom')}
        </span>

        {/* زر ملء الشاشة — دائم على الجوال */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setLightbox(true);
          }}
          className="absolute bottom-3 start-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-ink shadow-soft backdrop-blur transition hover:bg-rose hover:text-white md:opacity-0 md:group-hover:opacity-100"
          aria-label={t('product.viewFullScreen')}
        >
          <FiMaximize2 size={15} aria-hidden="true" />
        </button>

        {/* أسهم التنقّل */}
        {total > 1 ? (
          <>
            <GalleryArrow dir="prev" onClick={() => go(-1)} isRTL={isRTL} label={t('common.prev')} />
            <GalleryArrow dir="next" onClick={() => go(1)} isRTL={isRTL} label={t('common.next')} />
            <span className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-ink/60 px-2.5 py-1 font-en text-[11px] font-semibold text-white backdrop-blur">
              {safeActive + 1} / {total}
            </span>
          </>
        ) : null}
      </div>

      {/* المصغّرات */}
      {total > 1 ? (
        <div
          className="mt-3 grid grid-cols-5 gap-2.5"
          role="tablist"
          aria-label={t('product.gallery')}
        >
          {images.map((img, i) => (
            <button
              key={`${img}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === safeActive}
              onClick={() => setActive(i)}
              className={cn(
                'aspect-square overflow-hidden rounded-xl border-2 transition',
                i === safeActive
                  ? 'border-rose'
                  : 'border-transparent opacity-60 hover:opacity-100'
              )}
              style={i === safeActive ? { boxShadow: 'var(--shadow-sm)' } : undefined}
            >
              <SmartImage
                src={img}
                alt={`${alt} — ${i + 1}`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      <Lightbox
        open={lightbox}
        images={images}
        index={safeActive}
        alt={alt}
        onClose={() => setLightbox(false)}
        onNav={go}
        onSelect={setActive}
      />
    </div>
  );
}

function GalleryArrow({ dir, onClick, isRTL, label }) {
  // في RTL يتبادل معنى السهمين بصرياً
  const isPrev = dir === 'prev';
  const Icon = (isPrev ? !isRTL : isRTL) ? FiChevronLeft : FiChevronRight;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'absolute top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-ink shadow-soft backdrop-blur transition hover:bg-rose hover:text-white',
        'md:opacity-0 md:group-hover:opacity-100',
        isPrev ? 'start-3' : 'end-3'
      )}
      aria-label={label}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}

/** عارض ملء الشاشة — تنقّل بلوحة المفاتيح وإغلاق بـ Escape */
function Lightbox({ open, images, index, alt, onClose, onNav, onSelect }) {
  const { t, isRTL } = useI18n();
  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNav(isRTL ? -1 : 1);
      if (e.key === 'ArrowLeft') onNav(isRTL ? 1 : -1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, onNav, isRTL]);

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[130] flex flex-col bg-ink/95 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t('product.gallery')}
        >
          <div className="flex shrink-0 items-center justify-between p-4">
            <span className="font-en text-sm font-semibold text-white/80">
              {index + 1} / {images.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              autoFocus
              className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              aria-label={t('common.close')}
            >
              <FiX size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center px-4 pb-4">
            {images.length > 1 ? (
              <button
                type="button"
                onClick={() => onNav(isRTL ? 1 : -1)}
                className="absolute start-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                aria-label={t('common.prev')}
              >
                {isRTL ? <FiChevronRight size={22} /> : <FiChevronLeft size={22} />}
              </button>
            ) : null}

            <motion.img
              key={index}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              src={mediaUrl(images[index])}
              alt={alt}
              className="max-h-full max-w-full rounded-xl object-contain"
            />

            {images.length > 1 ? (
              <button
                type="button"
                onClick={() => onNav(isRTL ? -1 : 1)}
                className="absolute end-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                aria-label={t('common.next')}
              >
                {isRTL ? <FiChevronLeft size={22} /> : <FiChevronRight size={22} />}
              </button>
            ) : null}
          </div>

          {images.length > 1 ? (
            <div className="flex shrink-0 justify-center gap-2 overflow-x-auto p-4">
              {images.map((img, i) => (
                <button
                  key={`lb-${img}-${i}`}
                  type="button"
                  onClick={() => onSelect(i)}
                  className={cn(
                    'h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition',
                    i === index ? 'border-rose' : 'border-white/20 opacity-50 hover:opacity-100'
                  )}
                  aria-label={`${alt} — ${i + 1}`}
                >
                  <SmartImage src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
