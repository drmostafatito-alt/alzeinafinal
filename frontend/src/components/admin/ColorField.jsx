import { FiRotateCcw } from 'react-icons/fi';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/helpers';

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * حقل لون: منتقي لون + إدخال HEX نصي + زر إعادة تعيين.
 *
 * القيمة الفارغة تعني "استخدم اللون الافتراضي المشتق"، ولذلك نحتاج
 * زر إعادة التعيين — منتقي الألوان وحده لا يستطيع إنتاج قيمة فارغة.
 */
export default function ColorField({ label, value, onChange, hint, fallback = '#000000', className }) {
  const { t } = useI18n();
  const isValid = !value || HEX.test(value);
  const swatch = HEX.test(value || '') ? value : fallback;

  return (
    <div className={className}>
      <label className="label" htmlFor={`color-${label}`}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} — ${t('admin.themeColors')}`}
          value={swatch}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-black/10 bg-white p-0.5"
        />
        <input
          id={`color-${label}`}
          type="text"
          dir="ltr"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallback}
          className={cn('input font-en', !isValid && 'border-red-400 focus:border-red-500')}
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            title={t('admin.resetColor')}
            aria-label={t('admin.resetColor')}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:bg-blush hover:text-ink"
          >
            <FiRotateCcw size={14} />
          </button>
        ) : null}
      </div>
      {hint ? <p className="mt-1 text-[11px] text-ink-muted">{hint}</p> : null}
      {!isValid ? <p className="field-error">HEX (#RRGGBB)</p> : null}
    </div>
  );
}
