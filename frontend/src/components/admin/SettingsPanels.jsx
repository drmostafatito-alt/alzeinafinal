import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FiAlertTriangle, FiCheckCircle, FiClock, FiDownload, FiEye, FiLock, FiSave, FiSearch, FiUpload, FiXCircle
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import client from '@/api/client';
import Button from '@/components/ui/Button';
import { useI18n } from '@/i18n';
import { translations } from '@/i18n/translations';
import { cn } from '@/utils/helpers';

/* ============================================================
 * لوحة الصلاحيات
 * ============================================================ */
export function PermissionsPanel() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [draft, setDraft] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'permissions'],
    queryFn: () => client.get('/admin/permissions').then((r) => r.data?.data)
  });

  const save = useMutation({
    mutationFn: (permissions) => client.put('/admin/permissions', { permissions }),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      setDraft(null);
      qc.invalidateQueries({ queryKey: ['admin', 'permissions'] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  if (isLoading) return <p className="py-10 text-center text-xs text-ink-muted">…</p>;

  const roles = data?.roles || [];
  const keys = data?.permissionKeys || [];
  // الأدوار القابلة للتعديل فقط — المدير الأعلى صلاحياته كاملة دائماً
  const editable = roles.filter((r) => r.key !== 'super-admin');

  const current = (roleKey, permKey) =>
    draft?.[roleKey]?.[permKey] ?? roles.find((r) => r.key === roleKey)?.permissions?.[permKey] ?? 'none';

  const setPerm = (roleKey, permKey, value) =>
    setDraft((d) => ({ ...d, [roleKey]: { ...(d?.[roleKey] || {}), [permKey]: value } }));

  const buildPayload = () => {
    const out = {};
    editable.forEach((r) => {
      out[r.key] = {};
      keys.forEach((k) => { out[r.key][k] = current(r.key, k); });
    });
    return out;
  };

  const LEVELS = [
    ['none', t('a3.permNone')],
    ['read', t('a3.permRead')],
    ['full', t('a3.permFull')]
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-sky-900">
          <FiLock size={14} className="mt-0.5 shrink-0" />
          {t('a3.permissionsNote')}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-black/5">
        <table className="w-full text-start text-sm">
          <thead className="bg-cream/70 text-xs text-ink-muted">
            <tr>
              <th className="px-3 py-2.5 text-start font-bold">{t('a3.permissions')}</th>
              {editable.map((r) => (
                <th key={r.key} className="whitespace-nowrap px-3 py-2.5 text-center font-bold">
                  {lang === 'ar' ? r.name : r.nameEn}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {keys.map((k) => (
              <tr key={k} className="hover:bg-cream/40">
                <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-ink">
                  {t(`admin.${k}`) !== `admin.${k}` ? t(`admin.${k}`) : k}
                </td>
                {editable.map((r) => (
                  <td key={r.key} className="px-3 py-2 text-center">
                    <select
                      value={current(r.key, k)}
                      onChange={(e) => setPerm(r.key, k, e.target.value)}
                      aria-label={`${r.key} — ${k}`}
                      className={cn(
                        'cursor-pointer rounded-lg border border-black/10 px-2 py-1 text-[11px] font-semibold outline-none focus:border-rose',
                        current(r.key, k) === 'full' ? 'bg-emerald-50 text-emerald-700'
                          : current(r.key, k) === 'read' ? 'bg-amber-50 text-amber-700'
                          : 'bg-stone-100 text-stone-600'
                      )}
                    >
                      {LEVELS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3">
        <Button onClick={() => save.mutate(buildPayload())} loading={save.isPending} disabled={!draft}>
          {t('common.save')}
        </Button>
        {draft ? <Button variant="outline" onClick={() => setDraft(null)}>{t('common.cancel')}</Button> : null}
      </div>

      {/* فريق العمل */}
      {data?.staff?.length ? (
        <div className="rounded-xl border border-black/5 p-4">
          <p className="mb-3 text-xs font-bold text-ink">{t('a3.staff')}</p>
          <ul className="space-y-2">
            {data.staff.map((u) => (
              <li key={u._id} className="flex flex-wrap items-center gap-3 rounded-lg bg-cream p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="clamp-1 text-xs font-semibold text-ink">{u.name}</p>
                  <p className="clamp-1 text-[11px] text-ink-muted">{u.email}</p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-ink-muted">
                  {u.staffRole || u.role}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ============================================================
 * لوحة النسخ الاحتياطي والاستعادة
 * ============================================================ */
export function BackupPanel({ onRestored }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [pending, setPending] = useState(null);
  const [report, setReport] = useState(null);
  const [downloading, setDownloading] = useState('');

  const scheduleQ = useQuery({
    queryKey: ['admin', 'backup-schedule'],
    queryFn: () => client.get('/admin/backup/schedule').then((r) => r.data?.data)
  });

  const saveSchedule = useMutation({
    mutationFn: (payload) => client.put('/admin/backup/schedule', payload),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      qc.invalidateQueries({ queryKey: ['admin', 'backup-schedule'] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const restore = useMutation({
    mutationFn: (backup) => client.post('/admin/backup/restore', { backup }),
    onSuccess: (r) => {
      toast.success(r.data?.message || t('admin.saved'));
      setPending(null);
      setReport(null);
      onRestored?.();
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const download = async (scope) => {
    setDownloading(scope);
    try {
      const res = await client.get('/admin/backup', { params: { scope }, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${scope}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast.success(t('a3.downloadBackup'));
      qc.invalidateQueries({ queryKey: ['admin', 'backup-schedule'] });
    } catch (e) {
      toast.error(e?.response?.data?.message || t('common.error'));
    } finally {
      setDownloading('');
    }
  };

  /**
   * عند اختيار ملف: نتحقّق ونعاين **قبل** أي كتابة.
   * المدير يرى بالضبط ما سيتغيّر وما سيُتجاهل ولماذا.
   */
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { toast.error(t('common.error')); return; }
    try {
      const backup = JSON.parse(await f.text());
      setPending(backup);
      const r = await client.post('/admin/backup/restore-preview', { backup });
      setReport(r.data?.data);
    } catch (err) {
      const data = err?.response?.data;
      if (data?.data) { setReport(data.data); }
      else { toast.error(t('common.error')); setPending(null); }
    }
  };

  const SCOPES = [
    ['settings', t('a3.backupSettings')],
    ['theme', t('a3.backupTheme')],
    ['catalog', t('a3.backupCatalog')],
    ['full', t('a3.backupFull')]
  ];

  const sch = scheduleQ.data;

  return (
    <div className="space-y-5">
      {/* تذكير الجدول */}
      {sch ? (
        <div className={cn('rounded-xl border p-4',
          sch.overdue ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <FiClock size={14} className={cn('mt-0.5 shrink-0', sch.overdue ? 'text-amber-600' : 'text-emerald-600')} />
              <div>
                <p className={cn('text-xs font-bold', sch.overdue ? 'text-amber-900' : 'text-emerald-900')}>
                  {sch.recommendation}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  {sch.daysSinceLastBackup !== null
                    ? `${sch.daysSinceLastBackup} ${t('a4.daysSince')}`
                    : t('a4.noBackupYet')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={Boolean(sch.schedule?.enabled)}
                  onChange={(e) => saveSchedule.mutate({ ...sch.schedule, enabled: e.target.checked })}
                  className="h-4 w-4 accent-rose"
                />
                {t('a4.backupSchedule')}
              </label>
              <select
                value={sch.schedule?.frequency || 'weekly'}
                onChange={(e) => saveSchedule.mutate({ ...sch.schedule, frequency: e.target.value })}
                className="input h-8 w-auto py-1 text-xs"
                aria-label={t('a4.frequency')}
              >
                <option value="daily">{t('a4.daily')}</option>
                <option value="weekly">{t('a4.weekly')}</option>
                <option value="monthly">{t('a4.monthly')}</option>
              </select>
            </div>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-ink-muted">{sch.note}</p>
        </div>
      ) : null}

      <div>
        <h3 className="mb-3 text-sm font-bold text-ink">{t('a3.downloadBackup')}</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SCOPES.map(([scope, label]) => (
            <button
              key={scope}
              type="button"
              onClick={() => download(scope)}
              disabled={Boolean(downloading)}
              className="flex flex-col items-center gap-2 rounded-xl border border-black/10 p-4 transition hover:border-rose hover:bg-blush/20 disabled:opacity-50"
            >
              <FiDownload size={18} className="text-ink-muted" />
              <span className="text-xs font-semibold text-ink">{label}</span>
              {downloading === scope ? <span className="text-[10px] text-ink-muted">…</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-black/5 pt-5">
        <h3 className="mb-2 text-sm font-bold text-ink">{t('a3.restoreBackup')}</h3>
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-amber-900">
            <FiAlertTriangle size={13} className="mt-0.5 shrink-0" />
            {t('a3.restoreNote')}
          </p>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} className="hidden" />
        <Button variant="outline" icon={FiUpload} onClick={() => fileRef.current?.click()}>
          {t('a3.chooseFile')}
        </Button>
      </div>

      {/* تقرير التحقق والمعاينة */}
      {report ? (
        <div className="space-y-3 rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2">
            {report.valid
              ? <FiCheckCircle size={16} className="text-emerald-600" />
              : <FiXCircle size={16} className="text-red-600" />}
            <h3 className="text-sm font-bold text-ink">
              {report.valid ? t('a4.backupValid') : t('a4.backupInvalid')}
            </h3>
            {report.scope ? (
              <span className="font-en rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold text-ink-muted">
                {report.scope}
              </span>
            ) : null}
          </div>

          {(report.issues || []).length ? (
            <ul className="space-y-1">
              {report.issues.map((i, k) => (
                <li key={k} className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">⚠ {i}</li>
              ))}
            </ul>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {(report.restorable || []).length ? (
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="mb-1.5 text-[11px] font-bold text-emerald-900">{t('a4.willRestore')}</p>
                <ul className="space-y-0.5">
                  {report.restorable.map((r) => (
                    <li key={r.key} className="text-[11px] text-emerald-800">✓ {r.label} ({r.count})</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {(report.ignored || []).length ? (
              <div className="rounded-xl bg-stone-100 p-3">
                <p className="mb-1.5 text-[11px] font-bold text-stone-700">{t('a4.willIgnore')}</p>
                <ul className="space-y-1">
                  {report.ignored.map((r, k) => (
                    <li key={k} className="text-[11px] text-stone-600">
                      • {r.key} ({r.count}) — {r.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {report.changeCount !== undefined ? (
            report.changeCount === 0 ? (
              <p className="rounded-lg bg-sky-50 px-3 py-2 text-[11px] text-sky-900">{t('a4.noChanges')}</p>
            ) : (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-ink">
                  <FiEye size={12} /> {report.changeCount} {t('a4.changesFound')}
                </p>
                <ul className="max-h-48 space-y-1 overflow-y-auto">
                  {(report.changes || []).slice(0, 40).map((c, k) => (
                    <li key={k} className="rounded-lg bg-cream p-2 text-[11px]">
                      <span className="font-en font-bold text-ink">{c.key}</span>
                      <span className="mx-1 text-red-600 line-through">{String(c.from).slice(0, 40)}</span>
                      <span className="text-emerald-700">→ {String(c.to).slice(0, 40)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          ) : null}

          <div className="flex gap-2 pt-1">
            <Button
              size="sm" disabled={!report.valid} loading={restore.isPending}
              onClick={() => restore.mutate(pending)}
            >
              {t('a3.restoreBackup')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setReport(null); setPending(null); }}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ============================================================
 * مركز النصوص (Translation overrides)
 * كل نص يظهر للعميل في المتجر قابل للتعديل هنا: نبحث بالمفتاح
 * أو بالنص الافتراضي، ونكتب القيمة البديلة لكل لغة، وتُطبَّق
 * فوراً على المتجر (translationOverrides موجودة في خط الأنابيب كاملاً:
 * D1 → /storefront/config → ConfigProvider → t()).
 * ============================================================ */
export function TextsPanel({ overrides = {}, onSaved }) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState('');
  const [onlyOverridden, setOnlyOverridden] = useState(false);
  const [draft, setDraft] = useState(null);
  const [loadedFor, setLoadedFor] = useState(null);

  // نسخة تحرير محلية: { ar: {key:value}, en: {...} }
  const [edit, setEdit] = useState({ ar: {}, en: {} });

  /* تحميل التجاوزات المحفوظة عند وصولها لأول مرة */
  useEffect(() => {
    if (loadedFor === overrides) return;
    setLoadedFor(overrides);
    const decode = (pack) => {
      const out = {};
      Object.entries(pack || {}).forEach(([k, v]) => { out[String(k).replaceAll('__', '.')] = v; });
      return out;
    };
    setEdit({ ar: decode(overrides?.ar), en: decode(overrides?.en) });
    setDraft(null);
  }, [overrides, loadedFor]);

  const base = translations;

  const save = useMutation({
    mutationFn: (payload) => client.put('/admin/settings', { translationOverrides: payload }),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      setDraft(null);
      onSaved?.();
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const setVal = (lng, key, val) => {
    setEdit((prev) => {
      const pack = { ...(prev[lng] || {}) };
      if (val === '' || val === null) delete pack[key];
      else pack[key] = val;
      return { ...prev, [lng]: pack };
    });
    setDraft(true);
  };

  const resetMutation = useMutation({
    mutationFn: () => client.post('/admin/locale/translations/reset'),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      setEdit({ ar: {}, en: {} });
      setDraft(null);
      onSaved?.();
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const resetAll = () => {
    /* إعادة التعيين عبر endpoint الحذف الفعلي — حفظ {} كان لا يمسح شيئاً
       بسبب الدمج العميق في updateSettings (نفس خلل مركز التعريب) */
    resetMutation.mutate();
  };

  const keys = Object.keys(base.ar || {}).filter(
    (k) =>
      (!q || k.includes(q) || String(base.ar[k] || '').includes(q) || String(base.en?.[k] || '').includes(q))
  );
  const shown = keys
    .filter((k) => (onlyOverridden ? edit.ar[k] !== undefined || edit.en[k] !== undefined : true))
    .slice(0, 120);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <FiSearch className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted" size={15} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('common.search')}
            className="input ps-9"
            dir="auto"
          />
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
          <input type="checkbox" checked={onlyOverridden} onChange={(e) => setOnlyOverridden(e.target.checked)} className="h-4 w-4 accent-rose" />
          {t('c.onlyOverridden')}
        </label>
        <div className="ms-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={resetAll}>{t('admin.resetColor')}</Button>
          <Button
            size="sm"
            icon={FiSave}
            onClick={() => save.mutate(edit)}
            loading={save.isPending}
            disabled={!draft}
          >
            {t('common.save')}
          </Button>
        </div>
      </div>

      {draft ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          {t('c.unsavedChanges')}
        </div>
      ) : null}

      <div className="space-y-2">
        {shown.map((k) => {
          const arOver = edit.ar[k];
          const enOver = edit.en[k];
          const changed = arOver !== undefined || enOver !== undefined;
          return (
            <div key={k} className={cn('rounded-xl border p-4 transition', changed ? 'border-rose/40 bg-blush/30' : 'border-black/5 bg-white')}>
              <p className="font-en text-xs font-bold text-ink">{k}</p>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-[11px] text-ink-muted">{t('c.default')}: <span className="text-ink">{base.ar[k]}</span></p>
                  <input
                    value={arOver ?? ''}
                    onChange={(e) => setVal('ar', k, e.target.value)}
                    placeholder={base.ar[k] || ''}
                    className="input mt-1"
                    dir="rtl"
                  />
                </div>
                <div dir="ltr">
                  <p className="text-[11px] text-ink-muted">{t('c.defaultEn')}: <span className="text-ink">{base.en?.[k]}</span></p>
                  <input
                    value={enOver ?? ''}
                    onChange={(e) => setVal('en', k, e.target.value)}
                    placeholder={base.en?.[k] || ''}
                    className="input mt-1"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          );
        })}
        {!shown.length ? <p className="rounded-xl bg-white p-8 text-center text-sm text-ink-muted">{t('admin.noData')}</p> : null}
        {keys.length > shown.length ? (
          <p className="text-center text-xs text-ink-muted">
            {t('c.showing')} {shown.length} / {keys.length} — {t('c.refineSearch')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
