import { useEffect, useMemo, useRef, useState } from 'react';
import { FiChevronDown, FiPlus, FiX } from 'react-icons/fi';
import { useClickOutside } from '@/hooks';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/helpers';

/**
 * حقل اختيار يقبل قيمة جديدة (combobox).
 *
 * لماذا؟ قائمة <select> عادية تُجبر المدير على مغادرة نموذج المنتج
 * لإنشاء ماركة غير موجودة، ثم العودة وإعادة تعبئة ما كتبه. هنا يكتب
 * الاسم مباشرة ويُنشأ تلقائياً عند الحفظ (الخادم يتكفّل بذلك).
 *
 * القيمة المُخرَجة:
 *   • ObjectId عند اختيار عنصر موجود.
 *   • النص الخام عند كتابة اسم جديد — الخادم يحوّله إلى سجل حقيقي.
 * هذا التبسيط مقصود: لا نُنشئ الماركة قبل حفظ المنتج، فلو ألغى المدير
 * النموذج لا تبقى ماركة يتيمة في القاعدة.
 */
export default function Combobox({
  label,
  value,
  onChange,
  options = [],
  placeholder,
  hint,
  error,
  allowCreate = true,
  containerClassName
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const boxRef = useClickOutside(() => setOpen(false));

  /** التسمية المعروضة للقيمة الحالية */
  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)),
    [options, value]
  );

  // النص المعروض: اسم العنصر المختار، أو النص الحر الذي كتبه المدير
  const display = selected ? selected.label : value || '';

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // نعرض خيار الإنشاء فقط عند كتابة اسم لا يطابق أي عنصر موجود
  const exactMatch = options.some((o) => o.label.trim().toLowerCase() === query.trim().toLowerCase());
  const canCreate = allowCreate && query.trim().length > 0 && !exactMatch;

  const pick = (val) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div className={cn('w-full', containerClassName)} ref={boxRef}>
      {label ? <label className="label">{label}</label> : null}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={open ? query : display}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              // Enter لا يُرسل النموذج هنا — يؤكّد الاختيار فقط
              e.preventDefault();
              if (filtered.length === 1) pick(filtered[0].value);
              else if (canCreate) pick(query.trim());
            }
            if (e.key === 'Escape') setOpen(false);
          }}
          className={cn('input pe-16', error && 'border-red-400 focus:border-red-500 focus:ring-red-200')}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />

        <div className="absolute end-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {display ? (
            <button
              type="button"
              onClick={() => { onChange(''); setQuery(''); inputRef.current?.focus(); }}
              className="rounded p-1 text-ink-muted transition hover:text-rose"
              aria-label={t('common.clear')}
            >
              <FiX size={14} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => { setOpen((v) => !v); inputRef.current?.focus(); }}
            className="rounded p-1 text-ink-muted transition hover:text-ink"
            tabIndex={-1}
            aria-label={t('common.select')}
          >
            <FiChevronDown size={15} className={cn('transition', open && 'rotate-180')} />
          </button>
        </div>

        {open ? (
          <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-black/10 bg-white p-1 shadow-lift">
            {canCreate ? (
              <li>
                <button
                  type="button"
                  onClick={() => pick(query.trim())}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm font-semibold text-rose transition hover:bg-blush"
                >
                  <FiPlus size={14} className="shrink-0" />
                  <span className="truncate">{t('a6.createNamed').replace('{name}', query.trim())}</span>
                </button>
              </li>
            ) : null}

            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => pick(o.value)}
                  className={cn(
                    'w-full truncate rounded-lg px-3 py-2 text-start text-sm transition hover:bg-cream',
                    String(o.value) === String(value) && 'bg-blush font-semibold text-ink'
                  )}
                >
                  {o.label}
                </button>
              </li>
            ))}

            {!filtered.length && !canCreate ? (
              <li className="px-3 py-3 text-center text-xs text-ink-muted">{t('a5.empty.search.title')}</li>
            ) : null}
          </ul>
        ) : null}
      </div>

      {error ? <p className="field-error">{error}</p> : hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}
