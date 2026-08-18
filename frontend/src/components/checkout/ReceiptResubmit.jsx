import { useRef, useState } from 'react';
import { FiUploadCloud, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import client from '@/api/client';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { registerExtraTranslations, useI18n } from '@/i18n';
import { paymentTranslations } from '@/i18n/paymentTranslations';
import { cn } from '@/utils/helpers';

registerExtraTranslations('payments', paymentTranslations);

const MAX_MB = 5;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * إرفاق إيصال لطلب قائم (إعادة رفع بعد الرفض، أو أول رفع بعد إنشاء الطلب).
 * يُرسل إلى POST /orders/:id/receipt — والخادم هو من يسجّل المراجعة ويمنع التكرار.
 */
export default function ReceiptResubmit({ orderId, onSuccess, className }) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);

  const pick = (f) => {
    if (!f) return;
    if (!OK_TYPES.includes(f.type)) { toast.error(t('media.errType')); return; }
    if (f.size > MAX_MB * 1024 * 1024) { toast.error(t('media.errSize', { n: MAX_MB })); return; }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return url; });
  };

  const submit = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await client.post(`/orders/${orderId}/receipt`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(res.data?.message || t('payment.receiptSaved'));
      setFile(null);
      setPreview((old) => { if (old) URL.revokeObjectURL(old); return ''; });
      onSuccess?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }}
      />

      {preview ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3">
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img src={preview} alt="" className="h-20 w-20 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-emerald-700">{file?.name}</p>
            <p className="text-[11px] text-emerald-600">{Math.round((file?.size || 0) / 1024)} KB</p>
          </div>
          <button
            type="button"
            onClick={() => { setFile(null); setPreview((old) => { if (old) URL.revokeObjectURL(old); return ''; }); }}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-red-600"
            aria-label={t('common.cancel')}
          >
            <FiX size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-rose/40 bg-white p-5 text-center transition hover:border-rose"
        >
          <FiUploadCloud size={22} className="text-rose" />
          <span className="text-sm font-semibold text-ink">{t('payment.uploadNewReceipt')}</span>
          <span className="text-[11px] text-ink-muted">JPG · PNG · WebP — {t('media.errSize', { n: MAX_MB })}</span>
        </button>
      )}

      <Button onClick={submit} disabled={!file || busy} loading={busy} fullWidth>
        {t('payment.uploadingReceipt')}
      </Button>
    </div>
  );
}
