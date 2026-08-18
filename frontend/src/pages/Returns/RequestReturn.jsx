import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FiAlertCircle, FiRotateCcw, FiUpload, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/common/PageHeader';
import QuantitySelector from '@/components/ui/QuantitySelector';
import { Textarea } from '@/components/forms/Input';
import { PageSpinner } from '@/components/ui/Spinner';
import client from '@/api/client';
import { useI18n } from '@/i18n';
import { formatPrice } from '@/utils/format';
import { cn } from '@/utils/helpers';
import SmartImage from '@/components/ui/SmartImage';

/** نموذج طلب إرجاع لطلب شراء محدد */
export default function RequestReturn() {
  const { orderId } = useParams();
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const [selected, setSelected] = useState({});
  const [reasonId, setReasonId] = useState('');
  const [note, setNote] = useState('');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  const { data: check, isLoading } = useQuery({
    queryKey: ['return-check', orderId],
    queryFn: () => client.get(`/returns/check/${orderId}`).then((r) => r.data?.data),
    retry: 1
  });

  const { data: reasonData } = useQuery({
    queryKey: ['return-reasons'],
    queryFn: () => client.get('/returns/reasons').then((r) => r.data?.data)
  });
  const reasons = reasonData?.reasons || [];
  const policy = reasonData?.policy;

  const chosenReason = reasons.find((r) => r._id === reasonId);
  const needImages = policy?.requireImages || chosenReason?.requiresImages;

  const items = check?.items || [];
  const eligibility = check?.eligibility;

  const total = useMemo(
    () => items.reduce((sum, it) => sum + (selected[it.orderItem] || 0) * it.price, 0),
    [selected, items]
  );

  const submit = useMutation({
    mutationFn: (payload) => client.post('/returns', payload),
    onSuccess: (r) => {
      toast.success(r.data?.message || t('returns.submitted'));
      navigate('/returns');
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const upload = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of Array.from(files).slice(0, 5)) {
        const form = new FormData();
        form.append('image', file);
        form.append('folder', 'returns');
        // eslint-disable-next-line no-await-in-loop
        const res = await client.post('/upload/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        if (res.data?.data?.url) urls.push(res.data.data.url);
      }
      setImages((prev) => [...prev, ...urls].slice(0, 5));
    } catch {
      toast.error(t('returns.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) return <PageSpinner />;

  if (!eligibility?.eligible) {
    return (
      <>
        <PageHeader title={t('returns.request')} breadcrumbs={[{ to: '/orders', label: t('orders.title') }, { label: t('returns.request') }]} />
        <div className="container-x py-8">
          <div className="rounded-2xl border border-black/5 bg-white shadow-soft">
            <EmptyState
              icon={FiAlertCircle}
              title={t('returns.notEligible')}
              description={eligibility?.reason}
              actionLabel={t('orders.title')}
              actionTo="/orders"
            />
          </div>
        </div>
      </>
    );
  }

  const chosenCount = Object.values(selected).filter((q) => q > 0).length;

  return (
    <>
      <PageHeader
        title={t('returns.request')}
        subtitle={`${check?.order?.orderNumber} · ${t('returns.daysLeft', { n: eligibility.daysLeft })}`}
        breadcrumbs={[{ to: '/orders', label: t('orders.title') }, { label: t('returns.request') }]}
      />

      <div className="container-x py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            {/* الأصناف */}
            <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
              <h3 className="mb-4 text-lg font-bold text-ink">{t('returns.selectItems')}</h3>
              <ul className="divide-y divide-black/5">
                {items.map((item) => {
                  const qty = selected[item.orderItem] || 0;
                  return (
                    <li key={item.orderItem} className={cn('flex flex-wrap items-center gap-4 py-4', !item.eligible && 'opacity-50')}>
                      <SmartImage src={item.image} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="clamp-2 text-sm font-semibold text-ink">{item.name}</p>
                        <p className="text-xs text-ink-muted">
                          {formatPrice(item.price, lang)} · {t('returns.ordered')}: {item.orderedQuantity}
                          {item.returnedQuantity > 0 ? ` · ${t('returns.alreadyReturned')}: ${item.returnedQuantity}` : ''}
                        </p>
                        {!item.eligible ? <p className="mt-1 text-[11px] font-semibold text-red-600">{item.blockedReason}</p> : null}
                      </div>
                      {item.eligible ? (
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={qty > 0}
                            onChange={(e) =>
                              setSelected((s) => ({ ...s, [item.orderItem]: e.target.checked ? 1 : 0 }))
                            }
                            className="h-4 w-4 accent-rose"
                          />
                          {qty > 0 ? (
                            <QuantitySelector
                              size="sm"
                              value={qty}
                              min={1}
                              max={item.returnableQuantity}
                              onChange={(v) => setSelected((s) => ({ ...s, [item.orderItem]: v }))}
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* السبب */}
            <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
              <h3 className="mb-4 text-lg font-bold text-ink">{t('returns.reason')}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {reasons.map((r) => (
                  <label
                    key={r._id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-sm transition',
                      reasonId === r._id ? 'border-rose bg-blush/50' : 'border-ink/10 hover:border-rose/40'
                    )}
                  >
                    <input
                      type="radio"
                      name="reason"
                      checked={reasonId === r._id}
                      onChange={() => setReasonId(r._id)}
                      className="h-4 w-4 accent-rose"
                    />
                    <span>{(lang === 'ar' ? r.name : r.nameEn) || r.name}</span>
                  </label>
                ))}
              </div>

              <Textarea
                label={t('returns.note')}
                rows={3}
                containerClassName="mt-4"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('returns.notePlaceholder')}
              />

              {/* الصور */}
              <div className="mt-4">
                <p className="label">
                  {t('returns.images')} {needImages ? <span className="text-rose">*</span> : null}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {images.map((img) => (
                    <div key={img} className="relative">
                      <SmartImage src={img} alt="" className="h-20 w-20 rounded-lg object-cover" />
                      <button
                        type="button"
                        onClick={() => setImages((p) => p.filter((x) => x !== img))}
                        className="absolute -end-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-red-600 text-white"
                      >
                        <FiX size={12} />
                      </button>
                    </div>
                  ))}
                  {images.length < 5 ? (
                    <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-ink/15 text-ink-muted transition hover:border-rose hover:text-rose">
                      <input type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
                      <FiUpload size={18} />
                    </label>
                  ) : null}
                </div>
                {uploading ? <p className="mt-2 text-xs text-ink-muted">{t('common.loading')}</p> : null}
              </div>
            </div>
          </div>

          {/* الملخص */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
              <h3 className="mb-4 text-lg font-bold text-ink">{t('returns.summary')}</h3>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">{t('returns.itemsCount')}</dt>
                  <dd className="font-semibold">{chosenCount}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-black/5 pt-3">
                  <dt className="font-bold text-ink">{t('returns.estimatedRefund')}</dt>
                  <dd className="text-xl font-bold text-rose">{formatPrice(total, lang)}</dd>
                </div>
              </dl>

              <Button
                fullWidth
                size="lg"
                className="mt-5"
                icon={FiRotateCcw}
                loading={submit.isPending}
                disabled={!chosenCount || !reasonId || (needImages && !images.length)}
                onClick={() =>
                  submit.mutate({
                    orderId,
                    reason: reasonId,
                    customerNote: note,
                    images,
                    items: Object.entries(selected)
                      .filter(([, q]) => q > 0)
                      .map(([orderItem, quantity]) => ({ orderItem, quantity }))
                  })
                }
              >
                {t('returns.submit')}
              </Button>

              {policy?.policyText ? (
                <p className="mt-4 whitespace-pre-line text-[11px] leading-relaxed text-ink-muted">{policy.policyText}</p>
              ) : null}
              {policy?.refundProcessingDays ? (
                <p className="mt-2 text-[11px] text-ink-muted">
                  {t('returns.processingTime', { n: policy.refundProcessingDays })}
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
