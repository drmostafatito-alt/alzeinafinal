import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiAlertTriangle, FiGlobe, FiPlus, FiRefreshCw, FiSave, FiSearch, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import client from '@/api/client';
import Button from '@/components/ui/Button';
import Input, { Select } from '@/components/forms/Input';
import { ConfirmDialog } from '@/components/ui/Modal';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useConfig } from '@/config/ConfigProvider';
import { registerExtraTranslations, useI18n } from '@/i18n';
import { translations as baseTranslations } from '@/i18n/translations';
import { localeTranslations } from '@/i18n/localeTranslations';
import { cn } from '@/utils/helpers';

registerExtraTranslations('locale', localeTranslations);

/**
 * ترميز العرض: النقاط تُعرض كـ __ في الحقل (نمط اللوحة القديم)،
 * والخادم يخزّن المفاتيح بنقاطها الفعلية — مصدر الحقيقة الوحيد
 * settings.translationOverrides في D1 (نفس مخزن «الإعدادات ← النصوص»).
 */
const encodeKey = (k) => String(k).trim().replace(/\./g, '__');
const decodeKey = (k) => String(k).replace(/__/g, '.');

export default function LocalizationPanel() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const { reload: reloadConfig } = useConfig();

  const [form, setForm] = useState(null);
  const [currency, setCurrency] = useState(null);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const localeQ = useQuery({
    queryKey: ['admin', 'locale'],
    queryFn: () => client.get('/admin/locale').then((r) => r.data?.data)
  });
  const transQ = useQuery({
    queryKey: ['admin', 'translations'],
    queryFn: () => client.get('/admin/locale/translations').then((r) => r.data?.data)
  });

  /* شكل البيانات الجديد: {locale, currency, languages, timezones, dateFormats, preview} */
  useEffect(() => {
    if (localeQ.data) {
      setForm(localeQ.data.locale || {});
      setCurrency(localeQ.data.currency || { code: '', symbol: '', symbolEn: '', position: 'after' });
    }
  }, [localeQ.data]);

  /* التجاوزات المخزّنة → صفوف قابلة للتحرير (المفاتيح مفكوكة الترميز) */
  useEffect(() => {
    const ov = transQ.data?.overrides;
    if (!ov) return;
    const keys = new Set([...Object.keys(ov.ar || {}), ...Object.keys(ov.en || {})]);
    setRows([...keys].map((k) => ({ key: decodeKey(k), ar: ov.ar?.[k] || '', en: ov.en?.[k] || '' })));
  }, [transQ.data]);

  const afterSave = useCallback(async () => {
    await reloadConfig();
  }, [reloadConfig]);

  const opts = useCallback(
    (fn, keys, after) => ({
      mutationFn: fn,
      onSuccess: async (r) => {
        toast.success(r?.data?.message || t('a4.savedAndApplied'));
        keys.forEach((k) => qc.invalidateQueries({ queryKey: ['admin', k] }));
        if (after) await after();
      },
      onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
    }),
    [qc, t]
  );

  const saveLocale = useMutation(
    opts((payload) => client.put('/admin/locale', payload), ['locale'], afterSave)
  );
  const saveTrans = useMutation(
    opts((overrides) => client.put('/admin/locale/translations', { overrides }), ['translations'], afterSave)
  );
  const resetTrans = useMutation(
    opts(() => client.post('/admin/locale/translations/reset'), ['translations'], afterSave)
  );

  const submitTranslations = () => {
    const overrides = { ar: {}, en: {} };
    let bad = 0;
    rows.forEach((r) => {
      const key = encodeKey(r.key);
      if (!key || !/^[\w.]{2,80}$/.test(key.replace(/__/g, '.'))) { if (r.key) bad += 1; return; }
      if (r.ar?.trim()) overrides.ar[key] = r.ar.trim();
      if (r.en?.trim()) overrides.en[key] = r.en.trim();
    });
    if (bad) { toast.error(t('a4.dotHint')); return; }
    if (!Object.keys(overrides.ar).length && !Object.keys(overrides.en).length) {
      /* كل الصفوف فارغة = إزالة كل التجاوزات */
      resetTrans.mutate();
      return;
    }
    saveTrans.mutate(overrides);
  };

  /* بحث في الصفوف: بالمفتاح أو القيمتين — نحتفظ بالفهرس الأصلي للتحرير الآمن.
     مهم: هذا الـ useMemo قبل أي early-return حتى لا ينكسر ترتيب الـ Hooks. */
  const q = search.trim().toLowerCase();
  const visibleRows = useMemo(() => {
    if (!q) return rows.map((r, idx) => ({ r, idx }));
    return rows
      .map((r, idx) => ({ r, idx }))
      .filter(({ r }) =>
        r.key.toLowerCase().includes(q) ||
        r.ar.toLowerCase().includes(q) ||
        r.en.toLowerCase().includes(q));
  }, [rows, q]);

  /* حالة فشل التحميل: رسالة + إعادة محاولة — لا Loading أبدي ولا شاشة فارغة صامتة */
  if (localeQ.isError || transQ.isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <FiAlertTriangle className="mx-auto mb-3 text-red-500" size={26} />
        <p className="text-sm font-bold text-red-800">{t('a4.loadFailed')}</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-red-600">
          {localeQ.error?.response?.data?.message || transQ.error?.response?.data?.message || t('common.error')}
        </p>
        <Button
          size="sm" variant="outline" icon={FiRefreshCw} className="mt-4"
          onClick={() => { localeQ.refetch(); transQ.refetch(); }}
        >
          {t('a4.retry')}
        </Button>
      </div>
    );
  }

  if (localeQ.isLoading || !form) return <TableSkeleton rows={6} cols={2} />;

  const d = localeQ.data;
  const preview = d?.preview || {};
  const counts = transQ.data?.counts || { ar: 0, en: 0 };

  /* القيمة الافتراضية من ملفات الترجمة الأساسية (عرضية فقط — لا تُخزَّن هنا) */
  const baseOf = (key) => ({
    ar: baseTranslations.ar?.[decodeKey(key)],
    en: baseTranslations.en?.[decodeKey(key)],
  });

  return (
    <div className="space-y-4">
      {/* اللغات والاتجاه */}
      <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
          <FiGlobe size={15} /> {t('a4.languages')}
        </h3>
        <ul className="mb-4 grid gap-2 sm:grid-cols-2">
          {(d.languages || []).map((l) => (
            <li key={l.code} className="flex items-center justify-between gap-2 rounded-xl bg-cream p-3">
              <div>
                <p className="text-sm font-semibold text-ink">{lang === 'ar' ? l.name : l.nameEn}</p>
                <p className="font-en text-[11px] text-ink-muted">{l.code} · {l.dir?.toUpperCase()}</p>
              </div>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold',
                form.defaultLanguage === l.code ? 'bg-rose/15 text-rose' : 'bg-white text-ink-muted')}>
                {form.defaultLanguage === l.code ? t('a4.defaultLanguage') : t('a4.enabled')}
              </span>
            </li>
          ))}
        </ul>
        <p className="mb-4 rounded-lg bg-sky-50 px-3 py-2 text-[11px] text-sky-900">💡 {t('a4.languageNote')}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t('a4.defaultLanguage')}
            value={form.defaultLanguage}
            onChange={(e) => setForm((f) => ({ ...f, defaultLanguage: e.target.value }))}
            options={(d.languages || []).map((l) => ({ value: l.code, label: lang === 'ar' ? l.name : l.nameEn }))}
          />
          <Select
            label={t('a3.timezone')}
            value={form.timezone}
            onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
            options={(d.timezones || []).map((tz) => ({ value: tz, label: tz }))}
          />
          <Select
            label={t('a4.dateFormat')}
            value={form.dateFormat}
            onChange={(e) => setForm((f) => ({ ...f, dateFormat: e.target.value }))}
            options={(d.dateFormats || []).map((f) => ({ value: f.value, label: `${f.value} — ${f.example}` }))}
          />
          <Input
            label={t('a4.numberDecimals')} type="number" min="0" max="4"
            value={form.numberDecimals}
            onChange={(e) => setForm((f) => ({ ...f, numberDecimals: e.target.value }))}
          />
          <Input
            label={t('a4.currencyCode')} dir="ltr"
            value={currency?.code || ''}
            onChange={(e) => setCurrency((c) => ({ ...c, code: e.target.value }))}
          />
          <Input
            label={t('a3.currencySymbol')}
            value={currency?.symbol || ''}
            onChange={(e) => setCurrency((c) => ({ ...c, symbol: e.target.value }))}
          />
          <Select
            label={t('a4.currencyPosition')}
            value={currency?.position || 'after'}
            onChange={(e) => setCurrency((c) => ({ ...c, position: e.target.value }))}
            options={[{ value: 'before', label: t('a4.before') }, { value: 'after', label: t('a4.after') }]}
          />
        </div>

        {/* معاينة حيّة */}
        <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
          <p className="mb-2 text-xs font-bold text-sky-900">{t('a4.livePreview')}</p>
          <div className="grid gap-2 sm:grid-cols-4">
            {[
              [t('a4.previewNumber'), preview.number],
              [t('a4.previewCurrency'), preview.currency],
              [t('a4.previewDate'), preview.date],
              [t('a4.previewTime'), preview.time]
            ].map(([label, val]) => (
              <div key={label} className="rounded-lg bg-white p-2.5">
                <p className="text-[10px] text-ink-muted">{label}</p>
                <p className="mt-0.5 text-sm font-bold text-ink">{val || '—'}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <Button
            size="sm" icon={FiSave} loading={saveLocale.isPending}
            onClick={() => saveLocale.mutate({
              locale: { ...form, numberDecimals: Number(form.numberDecimals) || 0 },
              currency
            })}
          >
            {t('common.save')}
          </Button>
        </div>
      </div>

      {/* محرّر الترجمات */}
      <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-ink">{t('a4.translationEditor')}</h3>
            <p className="mt-0.5 text-[11px] text-ink-muted">{t('a4.translationNote')}</p>
          </div>
          <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold text-ink-muted">
            {counts.ar + counts.en} {t('a4.overrideCount')}
          </span>
        </div>

        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-900">💡 {t('a4.dotHint')}</p>

        {/* بحث */}
        <div className="relative mb-3">
          <FiSearch className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted" size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('a4.searchTranslations')}
            className="input h-9 ps-9 text-sm"
            aria-label={t('a4.searchTranslations')}
          />
        </div>

        {visibleRows.length === 0 ? (
          <p className="rounded-xl bg-cream py-8 text-center text-xs text-ink-muted">
            {rows.length === 0 ? t('a4.emptyTranslations') : t('admin.noData')}
          </p>
        ) : (
          <div className="space-y-3">
            {visibleRows.map(({ r, idx: i }) => {
              const base = baseOf(r.key);
              return (
                <div key={`${r.key || 'row'}-${i}`} className="grid gap-2 rounded-xl border border-black/5 bg-cream/50 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <div>
                    <input
                      value={r.key} placeholder="nav__shop" dir="ltr"
                      onChange={(e) => setRows((v) => v.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}
                      className="input font-en h-9 py-1.5 text-xs"
                      aria-label={t('a4.translationKey')}
                    />
                    {base.ar || base.en ? (
                      <p className="clamp-1 mt-1 text-[10px] text-ink-muted" dir="ltr">{decodeKey(r.key)}</p>
                    ) : null}
                  </div>
                  <div>
                    <input
                      value={r.ar} placeholder={base.ar || 'AR'}
                      onChange={(e) => setRows((v) => v.map((x, j) => (j === i ? { ...x, ar: e.target.value } : x)))}
                      className="input h-9 py-1.5 text-xs" aria-label="AR"
                    />
                    {base.ar ? <p className="clamp-1 mt-1 text-[10px] text-ink-muted">{t('a4.baseValue')}: {base.ar}</p> : null}
                  </div>
                  <div>
                    <input
                      value={r.en} placeholder={base.en || 'EN'} dir="ltr"
                      onChange={(e) => setRows((v) => v.map((x, j) => (j === i ? { ...x, en: e.target.value } : x)))}
                      className="input h-9 py-1.5 text-xs" aria-label="EN"
                    />
                    {base.en ? <p className="clamp-1 mt-1 text-[10px] text-ink-muted" dir="ltr">{t('a4.baseValue')}: {base.en}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setRows((v) => v.filter((_, j) => j !== i))}
                    aria-label={t('common.delete')}
                    className="grid h-9 w-9 self-start place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-red-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <FiTrash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" icon={FiPlus}
            onClick={() => { setRows((v) => [...v, { key: '', ar: '', en: '' }]); setSearch(''); }}>
            {t('a4.addTranslation')}
          </Button>
          <Button size="sm" icon={FiSave} loading={saveTrans.isPending} onClick={submitTranslations}>
            {t('common.save')}
          </Button>
          <Button size="sm" variant="outline" icon={FiRefreshCw} onClick={() => setConfirmReset(true)}>
            {t('a4.resetTranslations')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => { resetTrans.mutate(); setConfirmReset(false); }}
        title={t('a4.resetTranslations')}
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        danger
      />
    </div>
  );
}
