import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiCreditCard, FiEye, FiEyeOff, FiPower } from 'react-icons/fi';
import { toast } from 'react-toastify';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import ImagePicker from '@/components/admin/ImagePicker';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input, { Checkbox, Select, Textarea } from '@/components/forms/Input';
import Modal from '@/components/ui/Modal';
import { TableSkeleton } from '@/components/ui/Skeleton';
import client from '@/api/client';
import { registerExtraTranslations, useI18n } from '@/i18n';
import { paymentTranslations } from '@/i18n/paymentTranslations';
import { paymentIcon } from '@/utils/paymentIcons';

registerExtraTranslations('payments', paymentTranslations);
import { formatPrice } from '@/utils/format';
import { cn } from '@/utils/helpers';
import { useState } from 'react';
import SmartImage from '@/components/ui/SmartImage';

/** إدارة كاملة لطرق الدفع: تفعيل/إخفاء/أرقام المحافظ/QR/التعليمات/الرسوم/الترتيب */
export default function AdminPayments() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payment-methods'],
    queryFn: () => client.get('/admin/payment-methods').then((r) => r.data?.data)
  });
  const methods = data?.paymentMethods || [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'payment-methods'] });
    qc.invalidateQueries({ queryKey: ['storefront-config'] });
  };

  const toggle = useMutation({
    mutationFn: ({ id, field }) => client.patch(`/admin/payment-methods/${id}/${field}`),
    onSuccess: invalidate,
    onError: () => toast.error(t('common.error'))
  });

  const save = useMutation({
    mutationFn: ({ id, payload }) => client.put(`/admin/payment-methods/${id}`, payload),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const { register, handleSubmit, reset, watch, control } = useForm();

  useEffect(() => {
    if (editing) reset(editing);
  }, [editing, reset]);

  const feeType = watch('feeType');
  const qrPreview = watch('qrCode');

  if (isLoading) {
    return (
      <>
        <AdminPageHeader title={t('admin.payments')} />
        <TableSkeleton rows={6} cols={3} />
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        title={t('admin.payments')}
        subtitle={`${methods.filter((m) => m.isActive).length} / ${methods.length} ${t('admin.enabled')}`}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {methods.map((m) => (
          <div
            key={m._id}
            className={cn(
              'rounded-2xl border bg-white p-5 shadow-soft transition',
              m.isActive ? 'border-rose/40' : 'border-black/5 opacity-75'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-blush text-rose">
                  {(() => { const I = paymentIcon(m.code, m.icon); return <I size={18} />; })()}
                </span>
                <div className="min-w-0">
                  <p className="clamp-1 text-sm font-bold text-ink">
                    {(lang === 'ar' ? m.name : m.nameEn) || m.name}
                  </p>
                  <p className="font-en text-[11px] text-ink-muted">{m.code}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={m.isActive ? 'success' : 'neutral'}>
                  {m.isActive ? t('common.active') : t('common.inactive')}
                </Badge>
                {m.provider !== 'none' ? <Badge variant="blush">{m.provider}</Badge> : null}
              </div>
            </div>

            {m.accountNumber ? (
              <p className="mt-3 rounded-lg bg-cream px-3 py-2 font-en text-xs text-ink" dir="ltr">
                {m.accountNumber}
              </p>
            ) : null}

            {m.feeType !== 'none' ? (
              <p className="mt-2 text-[11px] text-ink-muted">
                {t('admin.fee')}: {m.feeType === 'fixed' ? formatPrice(m.feeValue, lang) : `${m.feeValue}%`}
              </p>
            ) : null}

            {m.qrCode ? (
              <SmartImage src={m.qrCode} alt="QR" className="mt-3 h-20 w-20 rounded-lg object-contain" />
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2 border-t border-black/5 pt-3">
              <button
                type="button"
                onClick={() => toggle.mutate({ id: m._id, field: 'isActive' })}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition',
                  m.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-black/5 text-ink-muted'
                )}
              >
                <FiPower size={12} /> {m.isActive ? t('common.active') : t('common.inactive')}
              </button>
              <button
                type="button"
                onClick={() => toggle.mutate({ id: m._id, field: 'isVisible' })}
                className="flex items-center gap-1.5 rounded-lg bg-black/5 px-2.5 py-1.5 text-[11px] font-semibold text-ink-soft transition hover:bg-blush"
              >
                {m.isVisible ? <FiEye size={12} /> : <FiEyeOff size={12} />}
                {t('admin.visible')}
              </button>
              <Button size="xs" variant="outline" onClick={() => setEditing(m)} className="ms-auto">
                {t('common.edit')}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? (lang === 'ar' ? editing.name : editing.nameEn) : ''}
        size="lg"
      >
        <form onSubmit={handleSubmit((v) => save.mutate({ id: editing._id, payload: v }))} className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={`${t('common.name')} (AR)`} {...register('name')} />
            <Input label={`${t('common.name')} (EN)`} dir="ltr" {...register('nameEn')} />
            <Input label={t('payment.walletNumber')} dir="ltr" {...register('walletNumber')} />
            <Input label={t('admin.accountNumber')} dir="ltr" {...register('accountNumber')} />
            <Input label={t('payment.accountName')} {...register('accountName')} />
            <Input label="IBAN" dir="ltr" {...register('iban')} />
            <Input label={t('admin.bankName') || 'Bank'} {...register('bankName')} />
            <Select
              label={t('admin.icon')}
              options={[
                { value: '', label: t('admin.autoByMethod') },
                { value: 'zap', label: 'InstaPay ⚡' },
                { value: 'phone', label: t('admin.wallet') },
                { value: 'card', label: t('admin.card') },
                { value: 'cash', label: t('admin.cash') },
                { value: 'truck', label: t('admin.delivery') },
              ]}
              {...register('icon')}
            />
            {/* كود QR وشعار الطريقة: رفع مباشر بدل لصق رابط */}
            <Controller
              name="qrCode"
              control={control}
              render={({ field }) => (
                <ImagePicker
                  label={t('admin.qrCode')}
                  folder="payments"
                  className="sm:col-span-2"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              name="logo"
              control={control}
              render={({ field }) => (
                <ImagePicker
                  label={t('admin.siteLogo')}
                  folder="payments"
                  className="sm:col-span-2"
                  aspect="aspect-auto"
                  previewSize="h-14 w-24"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          {qrPreview ? (
            <SmartImage src={qrPreview} alt="QR" className="h-28 w-28 rounded-xl object-contain" />
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={`${t('common.description')} (AR)`} {...register('description')} />
            <Input label={`${t('common.description')} (EN)`} dir="ltr" {...register('descriptionEn')} />
          </div>

          <Textarea label={`${t('admin.instructions')} (AR)`} rows={3} {...register('instructions')} />
          <Textarea label={`${t('admin.instructions')} (EN)`} rows={2} {...register('instructionsEn')} />

          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label={t('admin.fee')}
              options={[
                { value: 'none', label: t('common.none') },
                { value: 'fixed', label: t('admin.fixed') },
                { value: 'percentage', label: t('admin.percentage') }
              ]}
              {...register('feeType')}
            />
            {feeType && feeType !== 'none' ? (
              <Input label={t('admin.discountValue')} type="number" step="0.01" {...register('feeValue')} />
            ) : null}
            <Input label={t('admin.order')} type="number" {...register('order')} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={`${t('shop.minPrice')}`} type="number" {...register('minOrderAmount')} />
            <Input label={`${t('shop.maxPrice')}`} type="number" {...register('maxOrderAmount')} />
          </div>

          <div className="grid gap-2 rounded-xl bg-cream p-4 sm:grid-cols-2">
            <Checkbox label={t('admin.enabled')} {...register('isActive')} />
            <Checkbox label={t('admin.visible')} {...register('isVisible')} />
            <Checkbox label={t('checkout.paymentReference')} {...register('requiresReference')} />
            <Checkbox label={t('checkout.paymentProof')} {...register('requiresProof')} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={save.isPending} className="flex-1">
              {t('common.save')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
