import { useRef, useState } from 'react';
import { FiCheck, FiChevronDown } from 'react-icons/fi';
import { useConfig } from '@/config/ConfigProvider';
import { useClickOutside, useEscapeKey } from '@/hooks';
import { useI18n } from '@/i18n';
import { switchCountry } from '@/services/countryFx';
import { useCountry } from '@/store/countryStore';

/**
 * Country Selector (EG / AE) — واجهة خفيفة فوق countryStore (Gate 1).
 *
 * • القائمة تأتي حصراً من /storefront/config (config.countries) — لا توجد
 *   قائمة دول مكتوبة هنا؛ قبل وصول الإعدادات يُخفي المكوّن نفسه.
 * • الاختيار يستدعي setCountry فقط: مفاتيح React Query (Gate 3) وترويسة
 *   X-Country (Gate 2) يتبعان تلقائياً. تسعير السلة/Recently Viewed = Gate 5.
 * • لا ألوان ثابتة: كل كلاس هنا من رموز الثيم الحالية المستخدمة فعلاً
 *   في الموقع (bg-white/border-black/5/hover:bg-blush/text-ink/shadow-lift…).
 * • الأعلام SVG مصغّرة مضمّنة — emoji flags غير مضمونة العرض على كل نظام.
 */

/** احتياطي الاسم فقط إن خلا صف الدولة من name/nameEn (المصدر الأساسي: الخادم) */
const FALLBACK_NAMES = { EG: { ar: 'مصر', en: 'Egypt' }, AE: { ar: 'الإمارات', en: 'UAE' } };

export const countryLabel = (c, lang) =>
  (lang === 'ar' ? c?.name || c?.nameEn : c?.nameEn || c?.name) ||
  FALLBACK_NAMES[c?.code]?.[lang] ||
  c?.code ||
  '';

const Flag = ({ code, className = 'h-3.5 w-5 shrink-0 rounded-[2px] ring-1 ring-black/10' }) => {
  if (code === 'EG') {
    return (
      <svg viewBox="0 0 20 14" className={className} aria-hidden="true" focusable="false">
        <rect width="20" height="14" fill="#CE1126" />
        <rect y="4.67" width="20" height="4.67" fill="#FFFFFF" />
        <rect y="9.33" width="20" height="4.67" fill="#000000" />
      </svg>
    );
  }
  if (code === 'AE') {
    return (
      <svg viewBox="0 0 20 14" className={className} aria-hidden="true" focusable="false">
        <rect width="20" height="14" fill="#00732F" />
        <rect y="4.67" width="20" height="4.67" fill="#FFFFFF" />
        <rect y="9.33" width="20" height="4.67" fill="#000000" />
        <rect width="6" height="14" fill="#FF0000" />
      </svg>
    );
  }
  return null;
};

const currencyLabel = (c, lang) => (lang === 'ar' ? c?.currencySymbol : c?.currencySymbolEn) || '';

export default function CountrySelector({ tone = 'topbar' }) {
  const { countries } = useConfig();
  const { t, lang } = useI18n();
  const country = useCountry();
  const [open, setOpen] = useState(false);
  const rootRef = useClickOutside(() => setOpen(false));
  const btnRef = useRef(null);

  const close = () => {
    setOpen(false);
    btnRef.current?.focus();
  };
  useEscapeKey(close, open);

  const list = (Array.isArray(countries) ? countries : []).filter((c) => c?.code);
  // قبل وصول الإعدادات لا نعرض شيئاً — لحظة إقلاع فقط
  if (!list.length) return null;

  const current = list.find((c) => c.code === country) || list.find((c) => c.isDefault) || list[0];

  /** Gate 5: الزر يقود المنسّق المركزي — config/سلة/عملة/شحن/recent تتبع تلقائياً */
  const choose = (code) => {
    void switchCountry(code);
    close();
  };

  /** أسهم ↑↓ تتنقل بين الخيارات — نفس فلسفة القوائم الخفيفة الموجودة */
  const onListKeyDown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = Array.from(rootRef.current?.querySelectorAll('[data-country-option]') || []);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
    items[next]?.focus();
  };

  const optionCls =
    'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-sm font-semibold text-ink transition hover:bg-blush focus:bg-blush focus:outline-none';
  const renderOption = (c) => (
    <button
      key={c.code}
      type="button"
      role="option"
      aria-selected={c.code === current.code}
      data-country-option
      onClick={() => choose(c.code)}
      onKeyDown={onListKeyDown}
      className={optionCls}
    >
      <Flag code={c.code} />
      <span className="truncate">{countryLabel(c, lang)}</span>
      <span className="text-xs text-ink-muted">{currencyLabel(c, lang)}</span>
      {c.code === current.code ? <FiCheck size={14} className="ms-auto text-rose" aria-hidden="true" /> : null}
    </button>
  );

  /* نسخة قائمة الجوال: توسيع سطري داخل الدرج — لا overlay ولا احتمال قصّ */
  if (tone === 'menu') {
    return (
      <div ref={rootRef} className="mb-2">
        <button
          ref={btnRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={t('country.select')}
          className="flex w-full items-center justify-between rounded-xl border border-ink/10 px-3 py-2.5 text-sm font-bold text-ink transition hover:border-rose hover:text-rose focus:outline-none focus:ring-2 focus:ring-rose/40"
        >
          <span className="flex items-center gap-2">
            <Flag code={current.code} />
            {countryLabel(current, lang)}
            <span className="text-xs font-medium text-ink-muted">{currencyLabel(current, lang)}</span>
          </span>
          <FiChevronDown size={16} className={`transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {open ? (
          <div role="listbox" aria-label={t('country.select')} className="mt-2 space-y-1 rounded-xl border border-black/5 bg-white p-1.5">
            {list.map(renderOption)}
          </div>
        ) : null}
      </div>
    );
  }

  /* نسخة TopBar: كبسولة صغيرة بنفس روح أزرار الشريط الحالية + dropdown عائم */
  return (
    <div ref={rootRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('country.select')}
        className="flex items-center gap-1.5 rounded-full border border-white/20 px-2.5 py-0.5 text-xs font-bold text-white transition hover:border-rose hover:bg-rose focus:outline-none focus:ring-2 focus:ring-rose/40"
      >
        <Flag code={current.code} />
        <span className="max-w-24 truncate">{countryLabel(current, lang)}</span>
        <FiChevronDown size={13} className={`transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={t('country.select')}
          className="absolute end-0 top-full z-50 mt-2 w-44 rounded-2xl border border-black/5 bg-white p-1.5 shadow-lift"
        >
          {list.map(renderOption)}
        </div>
      ) : null}
    </div>
  );
}
