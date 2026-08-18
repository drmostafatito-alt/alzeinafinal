import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FiCheck, FiCopy, FiDownload, FiEdit2, FiPlus, FiTrash2, FiUpload
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import client from '@/api/client';
import Button from '@/components/ui/Button';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import Input from '@/components/forms/Input';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/helpers';

/** ألوان المعاينة المعروضة لكل قالب */
const SWATCHES = ['primary', 'accent', 'cream', 'blush', 'surface'];

/**
 * إدارة قوالب المظهر داخل تبويب "المظهر" في الإعدادات.
 * الألوان المعروضة تأتي من بيانات القالب في قاعدة البيانات — لا شيء مكتوب في الكود.
 */
export default function ThemePresets({ onApplied }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const fileRef = useRef(null);

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState(null);
  const [applying, setApplying] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'theme-presets'],
    queryFn: () => client.get('/admin/theme-presets').then((r) => r.data?.data)
  });

  const presets = data?.presets || [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'theme-presets'] });

  const create = useMutation({
    mutationFn: (payload) => client.post('/admin/theme-presets', payload),
    onSuccess: () => { toast.success(t('admin.saved')); setSaving(false); setName(''); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const rename = useMutation({
    mutationFn: ({ id, payload }) => client.put(`/admin/theme-presets/${id}`, payload),
    onSuccess: () => { toast.success(t('admin.saved')); setRenaming(null); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const duplicate = useMutation({
    mutationFn: (id) => client.post(`/admin/theme-presets/${id}/duplicate`),
    onSuccess: () => { toast.success(t('admin.saved')); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const apply = useMutation({
    mutationFn: (id) => client.post(`/admin/theme-presets/${id}/apply`),
    onSuccess: (r) => {
      toast.success(r.data?.message || t('admin.saved'));
      setApplying(null);
      invalidate();
      // نُبلّغ الإعدادات لتعيد تحميل الثيم وتطبّقه فوراً بلا إعادة تحميل الصفحة
      onApplied?.(r.data?.data?.settings);
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const remove = useMutation({
    mutationFn: (id) => client.delete(`/admin/theme-presets/${id}`),
    onSuccess: () => { toast.success(t('admin.deleted')); setDeleting(null); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const importPreset = useMutation({
    mutationFn: (preset) => client.post('/admin/theme-presets/import', { preset }),
    onSuccess: () => { toast.success(t('admin.saved')); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const exportPreset = async (p) => {
    try {
      const res = await client.get(`/admin/theme-presets/${p._id}/export`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `theme-${p.nameEn || p.slug || 'preset'}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      toast.error(t('common.error'));
    }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 512 * 1024) { toast.error(t('common.error')); return; }
    try {
      const text = await file.text();
      importPreset.mutate(JSON.parse(text));
    } catch {
      toast.error(t('common.error'));
    }
  };

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-ink">{t('a3.themePresets')}</h3>
          <p className="mt-0.5 text-xs text-ink-muted">{t('a3.applyPresetConfirm')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} className="hidden" />
          <Button size="sm" variant="outline" icon={FiUpload} onClick={() => fileRef.current?.click()} loading={importPreset.isPending}>
            {t('a3.importPreset')}
          </Button>
          <Button size="sm" variant="outline" icon={FiPlus} onClick={() => setSaving(true)}>
            {t('a3.savePreset')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-cream" />
          ))}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {presets.map((p) => (
            <li
              key={p._id}
              className={cn(
                'rounded-xl border p-3 transition',
                p.isApplied ? 'border-rose ring-2 ring-rose/20' : 'border-black/10 hover:border-rose/40'
              )}
            >
              <div className="mb-2.5 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="clamp-1 text-sm font-bold text-ink">{lang === 'ar' ? p.name : p.nameEn || p.name}</p>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {p.isBuiltIn ? (
                      <span className="rounded-full bg-cream px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">{t('a3.builtIn')}</span>
                    ) : null}
                    {p.isApplied ? (
                      <span className="rounded-full bg-rose/15 px-1.5 py-0.5 text-[10px] font-bold text-rose">{t('a3.applied')}</span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* معاينة الألوان — من بيانات القالب مباشرة */}
              <div className="mb-3 flex gap-1.5" aria-hidden="true">
                {SWATCHES.map((k) => (
                  <span
                    key={k}
                    className="h-7 flex-1 rounded-md border border-black/10"
                    style={{ backgroundColor: p.theme?.[k] || 'transparent' }}
                    title={`${k}: ${p.theme?.[k] || '—'}`}
                  />
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setApplying(p)}
                  disabled={apply.isPending}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-rose disabled:opacity-50"
                >
                  <FiCheck size={12} /> {t('a3.applyPreset')}
                </button>
                <button
                  type="button" onClick={() => setRenaming(p)} title={t('a3.renamePreset')} aria-label={t('a3.renamePreset')}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-rose hover:text-rose"
                >
                  <FiEdit2 size={12} />
                </button>
                <button
                  type="button" onClick={() => duplicate.mutate(p._id)} title={t('a3.duplicatePreset')} aria-label={t('a3.duplicatePreset')}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-rose hover:text-rose"
                >
                  <FiCopy size={12} />
                </button>
                <button
                  type="button" onClick={() => exportPreset(p)} title={t('a3.exportPreset')} aria-label={t('a3.exportPreset')}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-rose hover:text-rose"
                >
                  <FiDownload size={12} />
                </button>
                {!p.isBuiltIn ? (
                  <button
                    type="button" onClick={() => setDeleting(p)} title={t('common.delete')} aria-label={t('common.delete')}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-red-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <FiTrash2 size={12} />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* حفظ الثيم الحالي كقالب */}
      <Modal open={saving} onClose={() => setSaving(false)} title={t('a3.savePreset')} size="sm">
        <div className="space-y-4 p-6">
          <Input label={t('a3.presetName')} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <p className="text-xs text-ink-muted">{t('a3.savePreset')} — {t('admin.themeColors')}</p>
          <div className="flex gap-3">
            <Button
              className="flex-1"
              loading={create.isPending}
              onClick={() => { if (!name.trim()) { toast.error(t('valid.required')); return; } create.mutate({ name: name.trim() }); }}
            >
              {t('common.save')}
            </Button>
            <Button variant="outline" onClick={() => setSaving(false)}>{t('common.cancel')}</Button>
          </div>
        </div>
      </Modal>

      {/* إعادة التسمية */}
      <Modal open={Boolean(renaming)} onClose={() => setRenaming(null)} title={t('a3.renamePreset')} size="sm">
        {renaming ? (
          <div className="space-y-4 p-6">
            <Input
              label={`${t('a3.presetName')} (AR)`}
              defaultValue={renaming.name}
              onChange={(e) => setRenaming((r) => ({ ...r, name: e.target.value }))}
              autoFocus
            />
            <Input
              label={`${t('a3.presetName')} (EN)`} dir="ltr"
              defaultValue={renaming.nameEn}
              onChange={(e) => setRenaming((r) => ({ ...r, nameEn: e.target.value }))}
            />
            <div className="flex gap-3">
              <Button
                className="flex-1"
                loading={rename.isPending}
                onClick={() => rename.mutate({ id: renaming._id, payload: { name: renaming.name, nameEn: renaming.nameEn } })}
              >
                {t('common.save')}
              </Button>
              <Button variant="outline" onClick={() => setRenaming(null)}>{t('common.cancel')}</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(applying)}
        onClose={() => setApplying(null)}
        onConfirm={() => apply.mutate(applying._id)}
        title={`${t('a3.applyPreset')}: ${applying ? (lang === 'ar' ? applying.name : applying.nameEn || applying.name) : ''}`}
        message={t('a3.applyPresetConfirm')}
        confirmText={t('a3.applyPreset')}
        cancelText={t('common.cancel')}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting._id)}
        title={t('admin.confirmDelete')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        danger
      />
    </div>
  );
}
