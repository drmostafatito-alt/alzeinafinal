import { useCallback, useState } from 'react';
import { FiChevronDown, FiDownload, FiFileText, FiGrid } from 'react-icons/fi';
import { toast } from 'react-toastify';
import client from '@/api/client';
import { useClickOutside } from '@/hooks';
import { useI18n } from '@/i18n';

/**
 * زر تصدير بصيغتين: CSV و Excel.
 * نفس نقطة النهاية تخدم الصيغتين عبر ?format= — بلا مسار جديد.
 *
 * @param {string} path مسار التصدير بلا صيغة، مثل '/admin/products/export'
 * @param {object} params معاملات إضافية (فلاتر / معرّفات محددة)
 * @param {string} filename اسم الملف بلا لاحقة
 */
export default function ExportMenu({ path, params = {}, filename = 'export', label, size = 'sm' }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const ref = useClickOutside(useCallback(() => setOpen(false), []));

  const run = useCallback(
    async (format) => {
      setBusy(format);
      try {
        const res = await client.get(path, {
          params: { ...params, ...(format === 'xlsx' ? { format: 'xlsx' } : {}) },
          responseType: 'blob'
        });
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}-${Date.now()}.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        setOpen(false);
      } catch (e) {
        toast.error(e?.response?.data?.message || t('common.error'));
      } finally {
        setBusy('');
      }
    },
    [path, params, filename, t]
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white font-semibold text-ink transition hover:border-rose hover:text-rose ${
          size === 'sm' ? 'px-4 py-2 text-xs' : 'px-6 py-3 text-sm'
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <FiDownload size={14} />
        {label || t('common.export')}
        <FiChevronDown size={13} className={open ? 'rotate-180 transition' : 'transition'} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute end-0 top-full z-40 mt-2 w-44 overflow-hidden rounded-xl border border-black/5 bg-white p-1.5 shadow-lift"
        >
          <button
            type="button"
            role="menuitem"
            disabled={Boolean(busy)}
            onClick={() => run('csv')}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm text-ink transition hover:bg-blush disabled:opacity-50"
          >
            <FiFileText size={14} className="text-ink-muted" />
            {t('a3.exportCsv')}
            {busy === 'csv' ? <span className="ms-auto h-3 w-3 animate-spin rounded-full border-2 border-rose border-t-transparent" /> : null}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={Boolean(busy)}
            onClick={() => run('xlsx')}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm text-ink transition hover:bg-blush disabled:opacity-50"
          >
            <FiGrid size={14} className="text-emerald-600" />
            {t('a3.exportExcel')}
            {busy === 'xlsx' ? <span className="ms-auto h-3 w-3 animate-spin rounded-full border-2 border-rose border-t-transparent" /> : null}
          </button>
        </div>
      ) : null}
    </div>
  );
}
