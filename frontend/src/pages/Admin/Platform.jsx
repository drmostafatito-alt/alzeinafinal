import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FiBox, FiChevronRight, FiDownload, FiFile, FiFolder, FiHardDrive,
  FiPackage, FiRefreshCw, FiSave, FiSliders, FiToggleLeft, FiTrash2, FiUpload
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import client from '@/api/client';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Button from '@/components/ui/Button';
import Input, { Textarea } from '@/components/forms/Input';
import ImagePicker from '@/components/admin/ImagePicker';
import { ConfirmDialog } from '@/components/ui/Modal';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { formatDate } from '@/utils/format';
import { cn } from '@/utils/helpers';

const TABS = [
  ['flags', 'a4.featureFlags', FiToggleLeft],
  ['branding', 'a4.whiteLabel', FiSliders],
  ['plugins', 'a4.plugins', FiPackage],
  ['files', 'a4.fileManager', FiHardDrive]
];

const fmtBytes = (n) => {
  if (!n) return '0 KB';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
};

export default function AdminPlatform() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const { reload: reloadConfig } = useConfig();
  const [tab, setTab] = useState('flags');
  const [confirmReset, setConfirmReset] = useState(null);
  const [filePath, setFilePath] = useState('');
  const [fileQuery, setFileQuery] = useState('');
  const importRef = useRef(null);

  const on = (k) => tab === k;

  /* ---------- استعلامات ---------- */
  const flagsQ = useQuery({
    queryKey: ['admin', 'flags'],
    queryFn: () => client.get('/admin/flags').then((r) => r.data?.data),
    enabled: on('flags')
  });
  const brandQ = useQuery({
    queryKey: ['admin', 'branding'],
    queryFn: () => client.get('/admin/branding').then((r) => r.data?.data),
    enabled: on('branding')
  });
  const pluginQ = useQuery({
    queryKey: ['admin', 'plugins'],
    queryFn: () => client.get('/admin/plugins').then((r) => r.data?.data),
    enabled: on('plugins')
  });
  const filesQ = useQuery({
    queryKey: ['admin', 'files', filePath, fileQuery],
    queryFn: () => client.get('/admin/files', { params: { path: filePath, q: fileQuery || undefined } }).then((r) => r.data?.data),
    enabled: on('files')
  });
  const usageQ = useQuery({
    queryKey: ['admin', 'files-usage'],
    queryFn: () => client.get('/admin/files/usage').then((r) => r.data?.data),
    enabled: on('files')
  });

  /* ---------- طفرات ---------- */
  const opts = useCallback(
    (fn, keys, after) => ({
      mutationFn: fn,
      onSuccess: async (r) => {
        toast.success(r?.data?.message || t('admin.saved'));
        keys.forEach((k) => qc.invalidateQueries({ queryKey: ['admin', k] }));
        if (after) await after();
      },
      onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
    }),
    [qc, t]
  );

  // تغيير المفاتيح يجب أن ينعكس على المتجر فوراً
  const saveFlags = useMutation(opts((flags) => client.put('/admin/flags', { flags }), ['flags'], reloadConfig));
  const resetFlags = useMutation(opts(() => client.post('/admin/flags/reset'), ['flags'], reloadConfig));
  const saveBrand = useMutation(opts((branding) => client.put('/admin/branding', { branding }), ['branding'], reloadConfig));
  const resetBrand = useMutation(opts(() => client.post('/admin/branding/reset'), ['branding'], reloadConfig));
  const importBrand = useMutation(opts((profile) => client.post('/admin/branding/import', { profile }), ['branding'], reloadConfig));
  const savePlugins = useMutation(opts((plugins) => client.put('/admin/plugins', { plugins }), ['plugins']));
  const delFile = useMutation(opts((p) => client.delete('/admin/files', { params: { path: p } }), ['files', 'files-usage']));

  /* ---------- نموذج الهوية ---------- */
  const { register, handleSubmit, reset, control } = useForm();
  useEffect(() => {
    if (brandQ.data?.branding) reset(brandQ.data.branding);
  }, [brandQ.data, reset]);

  const exportBranding = useCallback(async () => {
    try {
      const r = await client.get('/admin/branding/export', { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url; a.download = `branding-${Date.now()}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch { toast.error(t('common.error')); }
  }, [t]);

  const onImportFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { importBrand.mutate(JSON.parse(await f.text())); }
    catch { toast.error(t('common.error')); }
  };

  const toggleFlag = (key, value) => saveFlags.mutate({ [key]: value });

  return (
    <>
      <AdminPageHeader title={t('a4.system')} subtitle={t('a4.featureFlags')} />

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map(([k, label, Icon]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition',
              tab === k ? 'bg-ink text-white' : 'border border-black/10 bg-white text-ink hover:border-rose hover:text-rose')}>
            <Icon size={13} /> {t(label)}
          </button>
        ))}
      </div>

      {/* ---------- مفاتيح الميزات ---------- */}
      {tab === 'flags' ? (
        flagsQ.isLoading ? <TableSkeleton rows={8} cols={2} /> : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-xs leading-relaxed text-sky-900">{t('a4.flagsIntro')}</p>
              <Button size="sm" variant="outline" icon={FiRefreshCw} onClick={() => setConfirmReset('flags')}>
                {t('a4.resetFlags')}
              </Button>
            </div>

            {(flagsQ.data?.groups || []).map((g) => (
              <div key={g.key} className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
                <div className="border-b border-black/5 bg-cream/60 px-4 py-2.5">
                  <p className="text-xs font-bold text-ink">{lang === 'ar' ? g.name : g.nameEn}</p>
                </div>
                <ul className="divide-y divide-black/5">
                  {g.items.map((key) => {
                    const value = flagsQ.data.flags[key] !== false;
                    return (
                      <li key={key} className="flex items-center justify-between gap-3 p-3.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">
                            {t(`a4.flag.${key}`) !== `a4.flag.${key}` ? t(`a4.flag.${key}`) : key}
                          </p>
                          <p className="font-en text-[10px] text-ink-muted">{key}</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={value}
                          aria-label={key}
                          disabled={saveFlags.isPending}
                          onClick={() => toggleFlag(key, !value)}
                          className={cn(
                            'relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50',
                            value ? 'bg-emerald-500' : 'bg-stone-300'
                          )}
                        >
                          <span className={cn(
                            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                            value ? 'start-[22px]' : 'start-0.5'
                          )} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )
      ) : null}

      {/* ---------- العلامة البيضاء ---------- */}
      {tab === 'branding' ? (
        brandQ.isLoading ? <TableSkeleton rows={8} cols={2} /> : (
          <form onSubmit={handleSubmit((v) => saveBrand.mutate(v))} className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" icon={FiSave} loading={saveBrand.isPending}>{t('common.save')}</Button>
              <Button type="button" size="sm" variant="outline" icon={FiDownload} onClick={exportBranding}>
                {t('a4.exportBranding')}
              </Button>
              <input ref={importRef} type="file" accept="application/json,.json" onChange={onImportFile} className="hidden" />
              <Button type="button" size="sm" variant="outline" icon={FiUpload} onClick={() => importRef.current?.click()}>
                {t('a4.importBranding')}
              </Button>
              <Button type="button" size="sm" variant="outline" icon={FiRefreshCw} onClick={() => setConfirmReset('branding')}>
                {t('a4.resetBranding')}
              </Button>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
              <h3 className="mb-4 text-sm font-bold text-ink">{t('a4.branding')}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label={`${t('a4.adminPanelName')} (AR)`} hint={t('a4.derivedHint')} {...register('adminPanelName')} />
                <Input label={`${t('a4.adminPanelName')} (EN)`} dir="ltr" {...register('adminPanelNameEn')} />
                <Input label={`${t('a4.browserTitle')} (AR)`} hint={t('a4.derivedHint')} {...register('browserTitle')} />
                <Input label={`${t('a4.browserTitle')} (EN)`} dir="ltr" {...register('browserTitleEn')} />
                <Input label={`${t('a4.footerCopyright')} (AR)`} containerClassName="sm:col-span-2" {...register('footerCopyright')} />
                <Input label={`${t('a4.footerCopyright')} (EN)`} dir="ltr" containerClassName="sm:col-span-2" {...register('footerCopyrightEn')} />
              </div>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
              <h3 className="mb-4 text-sm font-bold text-ink">{t('a4.loginLogo')} / {t('a4.loadingScreen')}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Controller name="loginLogo" control={control}
                  render={({ field }) => <ImagePicker label={t('a4.loginLogo')} folder="logo" value={field.value} onChange={field.onChange} />} />
                <Controller name="loginBackground" control={control}
                  render={({ field }) => <ImagePicker label={t('a4.loginBackground')} folder="backgrounds" value={field.value} onChange={field.onChange} />} />
                <Controller name="loadingLogo" control={control}
                  render={({ field }) => <ImagePicker label={t('a4.loadingScreen')} folder="logo" value={field.value} onChange={field.onChange} />} />
                <Input label={`${t('a4.loadingScreen')} (AR)`} {...register('loadingText')} />
                <Input label={`${t('a4.loginLogo')} — ${t('common.subtitle')} (AR)`} {...register('loginTagline')} />
                <Input label={`${t('a4.loginLogo')} — ${t('common.subtitle')} (EN)`} dir="ltr" {...register('loginTaglineEn')} />
              </div>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
              <h3 className="mb-4 text-sm font-bold text-ink">{t('a4.pwaSettings')}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label={t('a4.pwaName')} hint={t('a4.derivedHint')} {...register('pwaName')} />
                <Input label={`${t('a4.pwaName')} — short`} dir="ltr" {...register('pwaShortName')} />
                <Textarea label={t('common.description')} rows={2} containerClassName="sm:col-span-2" {...register('pwaDescription')} />
                <Controller name="pwaIcon192" control={control}
                  render={({ field }) => <ImagePicker label="Icon 192×192" folder="logo" value={field.value} onChange={field.onChange} />} />
                <Controller name="pwaIcon512" control={control}
                  render={({ field }) => <ImagePicker label="Icon 512×512" folder="logo" value={field.value} onChange={field.onChange} />} />
              </div>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
              <h3 className="mb-4 text-sm font-bold text-ink">{t('a4.emailSignature')}</h3>
              <p className="mb-3 text-[11px] text-ink-muted">
                {/* صدق: البريد معطّل في هذا التثبيت */}
                {t('a4.emailSignature')} — {t('a3.noRestriction')}
              </p>
              <div className="grid gap-4">
                <Textarea label="AR" rows={2} {...register('emailSignature')} />
                <Textarea label="EN" rows={2} dir="ltr" {...register('emailSignatureEn')} />
              </div>
            </div>
          </form>
        )
      ) : null}

      {/* ---------- الإضافات ---------- */}
      {tab === 'plugins' ? (
        pluginQ.isLoading ? <TableSkeleton rows={6} cols={2} /> : (
          <div className="space-y-4">
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              {pluginQ.data?.note || t('a4.pluginsNote')}
            </p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(pluginQ.data?.plugins || []).map((p) => (
                <li key={p.key} className="rounded-2xl border border-black/5 bg-white p-4 shadow-soft">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <FiBox size={18} className="shrink-0 text-ink-muted" />
                    <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-bold text-stone-600">
                      {t('a4.notImplemented')}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-ink">{lang === 'ar' ? p.name : p.nameEn}</p>
                  <p className="mt-0.5 mb-3 text-[11px] leading-relaxed text-ink-muted">{p.description}</p>
                  <button
                    type="button" role="switch" aria-checked={p.enabled} aria-label={p.key}
                    onClick={() => savePlugins.mutate({ [p.key]: !p.enabled })}
                    className={cn('relative h-6 w-11 rounded-full transition', p.enabled ? 'bg-emerald-500' : 'bg-stone-300')}
                  >
                    <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                      p.enabled ? 'start-[22px]' : 'start-0.5')} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      ) : null}

      {/* ---------- مدير الملفات ---------- */}
      {tab === 'files' ? (
        <div className="space-y-4">
          {usageQ.data ? (
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              {[
                [t('a4.storageUsage'), `${usageQ.data.totalMB} MB`],
                [t('a4.file'), usageQ.data.totalFiles],
                [t('media.library'), usageQ.data.mediaRecords],
                [t('a4.orphanFiles'), usageQ.data.orphanEstimate]
              ].map(([label, val]) => (
                <div key={label} className="rounded-2xl border border-black/5 bg-white p-4 shadow-soft">
                  <p className="text-[11px] text-ink-muted">{label}</p>
                  <p className="mt-1 text-xl font-bold text-ink">{val}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <input value={fileQuery} onChange={(e) => setFileQuery(e.target.value)}
              placeholder={t('admin.searchPlaceholder')} className="input h-9 max-w-xs py-1.5 text-sm"
              aria-label={t('admin.searchPlaceholder')} />
            {filePath ? (
              <Button size="sm" variant="outline" onClick={() => setFilePath(filesQ.data?.parent || '')}>
                ← {t('a4.backToParent')}
              </Button>
            ) : null}
            <span className="font-en text-xs text-ink-muted">/uploads/{filePath}</span>
          </div>

          {filesQ.isLoading ? <TableSkeleton rows={8} cols={3} /> : (
            <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
              {(filesQ.data?.items || []).length === 0 ? (
                <p className="p-12 text-center text-sm text-ink-muted">{t('a4.emptyFolder')}</p>
              ) : (
                <ul className="divide-y divide-black/5">
                  {filesQ.data.items.map((it) => (
                    <li key={it.path} className="flex items-center gap-3 p-3">
                      {it.type === 'folder' ? (
                        <button type="button" onClick={() => setFilePath(it.path)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-start">
                          <FiFolder size={16} className="shrink-0 text-amber-500" />
                          <span className="clamp-1 flex-1 text-sm font-semibold text-ink">{it.name}</span>
                          <FiChevronRight size={14} className="shrink-0 text-ink-muted rtl:rotate-180" />
                        </button>
                      ) : (
                        <>
                          <FiFile size={16} className="shrink-0 text-ink-muted" />
                          <div className="min-w-0 flex-1">
                            <p className="clamp-1 text-sm text-ink">{it.name}</p>
                            <p className="text-[10px] text-ink-muted">
                              {fmtBytes(it.size)} • {formatDate(it.modifiedAt, lang)}
                            </p>
                          </div>
                          <button type="button" onClick={() => delFile.mutate(it.path)}
                            title={t('common.delete')} aria-label={t('common.delete')}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-red-500 hover:bg-red-50 hover:text-red-600">
                            <FiTrash2 size={13} />
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {usageQ.data?.breakdown?.length ? (
            <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
              <div className="border-b border-black/5 p-4">
                <h3 className="text-sm font-bold text-ink">{t('a4.storageBreakdown')}</h3>
              </div>
              <ul className="divide-y divide-black/5">
                {usageQ.data.breakdown.map((b) => (
                  <li key={b.folder} className="flex items-center gap-3 p-3">
                    <FiFolder size={14} className="shrink-0 text-amber-500" />
                    <span className="font-en flex-1 text-xs text-ink">{b.folder}</span>
                    <span className="text-xs text-ink-muted">{b.files} {t('a4.file')}</span>
                    <span className="text-xs font-bold text-ink">{fmtBytes(b.sizeBytes)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmReset)}
        onClose={() => setConfirmReset(null)}
        onConfirm={() => {
          if (confirmReset === 'flags') resetFlags.mutate();
          if (confirmReset === 'branding') resetBrand.mutate();
          setConfirmReset(null);
        }}
        title={confirmReset === 'flags' ? t('a4.resetFlags') : t('a4.resetBranding')}
        message={confirmReset === 'branding' ? t('a4.resetBrandingConfirm') : undefined}
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}
