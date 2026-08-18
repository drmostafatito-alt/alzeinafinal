import { useCallback } from 'react';
import { FiChevronDown, FiChevronUp, FiCornerDownRight, FiPlus, FiTrash2 } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input, { Checkbox, Select } from '@/components/forms/Input';
import { useBrands, useCategories } from '@/hooks';
import { useI18n } from '@/i18n';
import { localized } from '@/utils/helpers';

/**
 * بانى قائمة التنقّل.
 *
 * قرار تصميمي: نخزّن القائمة كمصفوفة داخل الإعدادات بدل إنشاء
 * مجموعة (collection) جديدة في قاعدة البيانات.
 * السبب: القائمة كائن واحد صغير يُقرأ مع كل طلب للمتجر ضمن
 * /storefront/config. مجموعة منفصلة كانت ستضيف استعلاماً لكل زيارة،
 * ونقطة نهاية CRUD كاملة، ومشكلة ترتيب — مقابل صفر فائدة. البقاء
 * داخل الإعدادات يعني أيضاً أن النسخ الاحتياطي والاستيراد/التصدير
 * القائمين يشملان القائمة تلقائياً بلا أي عمل إضافي.
 *
 * القائمة الفارغة = استخدم الافتراضية المترجمة (توافق خلفي كامل).
 */

const TYPES = ['internal', 'category', 'brand', 'page', 'external'];

const blank = () => ({
  id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
  label: '', labelEn: '', url: '/', type: 'internal', icon: '',
  showDesktop: true, showMobile: true, highlight: false, newTab: false,
  children: [],
});

export default function MenuBuilder({ value = [], onChange }) {
  const { t, lang } = useI18n();
  const { categories } = useCategories();
  const { brands } = useBrands();

  const items = Array.isArray(value) ? value : [];

  const patch = useCallback((i, key, val) => {
    onChange(items.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));
  }, [items, onChange]);

  const move = useCallback((i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }, [items, onChange]);

  /** حقل الرابط يتغيّر شكله حسب النوع — لا يكتب المالك slug يدوياً */
  const UrlField = ({ it, onSet }) => {
    if (it.type === 'category') {
      return (
        <Select
          label={t('common.category')} value={it.url || ''} onChange={(e) => onSet(e.target.value)}
          placeholder={t('common.select')}
          options={categories.map((c) => ({ value: c.slug, label: localized(c, lang) }))}
        />
      );
    }
    if (it.type === 'brand') {
      return (
        <Select
          label={t('common.brandLabel')} value={it.url || ''} onChange={(e) => onSet(e.target.value)}
          placeholder={t('common.select')}
          options={brands.map((b) => ({ value: b.slug, label: localized(b, lang) }))}
        />
      );
    }
    return (
      <Input
        label={t('a9.menu.url')} dir="ltr" value={it.url || ''}
        onChange={(e) => onSet(e.target.value)}
        hint={it.type === 'external' ? 'https://…' : '/shop?sort=newest'}
      />
    );
  };

  const Row = ({ it, i, isChild = false, parentIdx = null }) => (
    <div className={isChild ? 'rounded-lg border border-black/10 bg-cream/50 p-3' : 'rounded-xl border border-black/10 bg-white p-3'}>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_150px_auto]">
        <Input
          label={`${t('a9.menu.label')} (AR)`} value={it.label || ''}
          onChange={(e) => (isChild ? patchChild(parentIdx, i, 'label', e.target.value) : patch(i, 'label', e.target.value))}
        />
        <Input
          label={`${t('a9.menu.label')} (EN)`} dir="ltr" value={it.labelEn || ''}
          onChange={(e) => (isChild ? patchChild(parentIdx, i, 'labelEn', e.target.value) : patch(i, 'labelEn', e.target.value))}
        />
        <Select
          label={t('a9.menu.type')} value={it.type || 'internal'}
          onChange={(e) => (isChild ? patchChild(parentIdx, i, 'type', e.target.value) : patch(i, 'type', e.target.value))}
          options={TYPES.map((v) => ({ value: v, label: t(`a9.menu.type.${v}`) }))}
        />
        <div className="flex items-end gap-1 pb-0.5">
          {!isChild ? (
            <>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                className="rounded-lg p-2 text-ink-muted transition hover:bg-blush disabled:opacity-30" title={t('a9.menu.up')}>
                <FiChevronUp size={14} />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1}
                className="rounded-lg p-2 text-ink-muted transition hover:bg-blush disabled:opacity-30" title={t('a9.menu.down')}>
                <FiChevronDown size={14} />
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => (isChild ? removeChild(parentIdx, i) : onChange(items.filter((_, x) => x !== i)))}
            className="rounded-lg p-2 text-red-600 transition hover:bg-red-50" title={t('common.delete')}
          >
            <FiTrash2 size={14} />
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px]">
        <UrlField it={it} onSet={(v) => (isChild ? patchChild(parentIdx, i, 'url', v) : patch(i, 'url', v))} />
        <Input
          label={t('a9.menu.icon')} placeholder="🔥" value={it.icon || ''}
          onChange={(e) => (isChild ? patchChild(parentIdx, i, 'icon', e.target.value) : patch(i, 'icon', e.target.value))}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        <Checkbox label={t('a9.menu.desktop')} checked={it.showDesktop !== false}
          onChange={(e) => (isChild ? patchChild(parentIdx, i, 'showDesktop', e.target.checked) : patch(i, 'showDesktop', e.target.checked))} />
        <Checkbox label={t('a9.menu.mobile')} checked={it.showMobile !== false}
          onChange={(e) => (isChild ? patchChild(parentIdx, i, 'showMobile', e.target.checked) : patch(i, 'showMobile', e.target.checked))} />
        <Checkbox label={t('a9.menu.highlight')} checked={Boolean(it.highlight)}
          onChange={(e) => (isChild ? patchChild(parentIdx, i, 'highlight', e.target.checked) : patch(i, 'highlight', e.target.checked))} />
        {it.type === 'external' ? (
          <Checkbox label={t('a9.menu.newTab')} checked={Boolean(it.newTab)}
            onChange={(e) => (isChild ? patchChild(parentIdx, i, 'newTab', e.target.checked) : patch(i, 'newTab', e.target.checked))} />
        ) : null}
      </div>

      {/* عناصر فرعية = قائمة منسدلة */}
      {!isChild ? (
        <div className="mt-3 border-t border-dashed border-black/10 pt-3">
          {(it.children || []).length ? (
            <div className="mb-2 space-y-2">
              {it.children.map((c, ci) => (
                <Row key={c.id || ci} it={c} i={ci} isChild parentIdx={i} />
              ))}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => patch(i, 'children', [...(it.children || []), blank()])}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose transition hover:underline"
          >
            <FiCornerDownRight size={12} /> {t('a9.menu.addChild')}
          </button>
        </div>
      ) : null}
    </div>
  );

  function patchChild(pi, ci, key, val) {
    onChange(items.map((it, idx) => (idx !== pi ? it : {
      ...it,
      children: (it.children || []).map((c, x) => (x === ci ? { ...c, [key]: val } : c)),
    })));
  }
  function removeChild(pi, ci) {
    onChange(items.map((it, idx) => (idx !== pi ? it : {
      ...it, children: (it.children || []).filter((_, x) => x !== ci),
    })));
  }

  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-cream p-3 text-xs leading-relaxed text-ink-muted">
        {items.length ? t('a9.menu.customActive') : t('a9.menu.usingDefault')}
      </p>

      {items.map((it, i) => <Row key={it.id || i} it={it} i={i} />)}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" icon={FiPlus} onClick={() => onChange([...items, blank()])}>
          {t('a9.menu.add')}
        </Button>
        {items.length ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onChange([])}>
            {t('a9.menu.reset')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
