import { useRef, useState } from 'react';
import { FiCheckCircle, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import { toast } from 'react-toastify';
import client from '@/api/client';
import Spinner from '@/components/ui/Spinner';
import SmartImage from '@/components/ui/SmartImage';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/helpers';

const MAX_MB = 5;

/**
 * رفع صورة إيصال التحويل للطرق اليدوية (محفظة/إنستاباي/بنك).
 * الصورة تُرفع للخادم فوراً ويُخزَّن المسار الناتج، فلا يُقبل رابط خارجي.
 */
export default function PaymentProofUpload({ value, onChange, required = true }) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('media.errType'));
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(t('media.errSize', { n: MAX_MB }));
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await client.post('/orders/payment-proof', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const url = res.data?.data?.url;
      if (url) {
        onChange(url);
        toast.success(t('payment.proofUploaded'));
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || t('common.error'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-3">
      <span className="label">
        {t('payment.proofTitle')}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>

      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3">
          <SmartImage src={value} alt={t('payment.proofTitle')} className="h-20 w-20 rounded-lg object-cover" />
          <p className="flex flex-1 items-center gap-2 text-sm font-semibold text-emerald-700">
            <FiCheckCircle size={16} /> {t('payment.proofUploaded')}
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-semibold text-ink"
            >
              {t('media.replace')}
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="grid h-8 w-8 place-items-center rounded-lg bg-white text-red-600"
              aria-label={t('common.delete')}
            >
              <FiTrash2 size={13} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            upload(e.dataTransfer.files?.[0]);
          }}
          disabled={uploading}
          className={cn(
            'flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed p-5 text-center transition',
            dragOver ? 'border-rose bg-blush' : 'border-rose/40 bg-white hover:border-rose'
          )}
        >
          {uploading ? <Spinner size={22} /> : <FiUploadCloud size={22} className="text-rose" />}
          <span className="text-sm font-semibold text-ink">{t('payment.uploadProof')}</span>
          <span className="text-[11px] text-ink-muted">{t('payment.proofHint')}</span>
        </button>
      )}

      {required && !value ? <p className="field-error">{t('payment.proofRequired')}</p> : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
