import { FiChevronDown, FiChevronUp, FiPlus, FiTrash2 } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input, { Checkbox } from '@/components/forms/Input';
import { useI18n } from '@/i18n';

/**
 * محرّر عناصر شريط (الشريط العلوي / شريط المزايا).
 *
 * مكوّن واحد للاثنين عن قصد: بنيتهما متطابقة (أيقونة + نص عربي +
 * نص إنجليزي + وصف اختياري + رابط اختياري + تفعيل + ترتيب)، وتكرار
 * الواجهة كان سيعني إصلاح أي خلل مرّتين.
 *
 * القائمة الفارغة تعني "استخدم العناصر الافتراضية المترجمة" — وهو
 * سلوك المتجر قبل هذه المرحلة حرفياً، فلا ينكسر أي تثبيت قائم.
 */
export default function StripItemsEditor({
  value = [],
  onChange,
  withDesc = false,
  withLink = false,
  hint,
}) {
  const { t } = useI18n();
  const items = Array.isArray(value) ? value : [];

  const patch = (i, key, val) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const add = () =>
    onChange([
      ...items,
      {
        id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
        icon: '', text: '', textEn: '', title: '', titleEn: '',
        desc: '', descEn: '', link: '', enabled: true,
      },
    ]);

  /* الشريط العلوي يستخدم text/textEn، وشريط المزايا يستخدم title/titleEn */
  const mainKey = withDesc ? 'title' : 'text';
  const mainKeyEn = withDesc ? 'titleEn' : 'textEn';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-ink">{t('a11.items')}</p>
        <Button type="button" size="sm" variant="outline" icon={FiPlus} onClick={add}>
          {t('common.add')}
        </Button>
      </div>

      <p className="text-xs leading-relaxed text-ink-muted">
        {items.length ? t('a11.customActive') : hint || t('a11.usingDefault')}
      </p>

      {items.map((it, i) => (
        <div key={it.id || i} className="rounded-xl border border-black/10 bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-[70px_1fr_1fr_auto]">
            <Input
              label={t('a9.menu.icon')} placeholder="🚚"
              value={it.icon || ''} onChange={(e) => patch(i, 'icon', e.target.value)}
            />
            <Input
              label={`${t('a11.text')} (AR)`}
              value={it[mainKey] || ''} onChange={(e) => patch(i, mainKey, e.target.value)}
            />
            <Input
              label={`${t('a11.text')} (EN)`} dir="ltr"
              value={it[mainKeyEn] || ''} onChange={(e) => patch(i, mainKeyEn, e.target.value)}
            />
            <div className="flex items-end gap-1 pb-0.5">
              <button
                type="button" disabled={i === 0} title={t('a9.menu.up')}
                onClick={() => move(i, -1)}
                className="rounded-lg p-2 text-ink-muted transition hover:bg-blush disabled:opacity-30"
              >
                <FiChevronUp size={14} />
              </button>
              <button
                type="button" disabled={i === items.length - 1} title={t('a9.menu.down')}
                onClick={() => move(i, 1)}
                className="rounded-lg p-2 text-ink-muted transition hover:bg-blush disabled:opacity-30"
              >
                <FiChevronDown size={14} />
              </button>
              <button
                type="button" title={t('common.delete')}
                onClick={() => onChange(items.filter((_, x) => x !== i))}
                className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
              >
                <FiTrash2 size={14} />
              </button>
            </div>
          </div>

          {withDesc ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input
                label={`${t('a11.desc')} (AR)`}
                value={it.desc || ''} onChange={(e) => patch(i, 'desc', e.target.value)}
              />
              <Input
                label={`${t('a11.desc')} (EN)`} dir="ltr"
                value={it.descEn || ''} onChange={(e) => patch(i, 'descEn', e.target.value)}
              />
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-4">
            {withLink ? (
              <Input
                containerClassName="min-w-[220px] flex-1"
                label={t('a9.menu.url')} dir="ltr" hint="/shop"
                value={it.link || ''} onChange={(e) => patch(i, 'link', e.target.value)}
              />
            ) : null}
            <Checkbox
              label={t('a10.itemEnabled')}
              checked={it.enabled !== false}
              onChange={(e) => patch(i, 'enabled', e.target.checked)}
            />
          </div>
        </div>
      ))}

      {items.length ? (
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([])}>
          {t('a11.resetToDefault')}
        </Button>
      ) : null}
    </div>
  );
}
