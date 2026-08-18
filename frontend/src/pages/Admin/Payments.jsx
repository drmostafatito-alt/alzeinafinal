import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiCreditCard, FiEye, FiEyeOff, FiPlus, FiPower, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import ImagePicker from '@/components/admin/ImagePicker';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input, { Checkbox, Select, Textarea } from '@/components/forms/Input';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import { TableSkeleton } from '@/components/ui/Skeleton';
import client from '@/api/client';
import { registerExtraTranslations, useI18n } from '@/i18n';
import { paymentTranslations } from '@/i18n/paymentTranslations';
import { paymentIcon } from '@/utils/paymentIcons';
import { useConfig } from '@/config/ConfigProvider';
import { formatPrice } from '@/utils/format';
import { cn } from '@/utils/helpers';
import SmartImage from '@/components/ui/SmartImage';

registerExtraTranslations('payments', paymentTranslations);

const EMPTY_METHOD = {
  name: '',
  nameEn: '',
  code: '',
  type: 'manual',
  description: '',
  descriptionEn: '',
  instructions: '',
  instructionsEn: '',
  walletNumber: '',
  accountNumber: '',
  accountName: '',
  iban: '',
  bankName: '',
  icon: 'card',
  feeType: 'none',
  feeValue: 0,
  minOrderAmount: '',
  maxOrderAmount: '',
  sortOrder: 0,
  isActive: true,
  isVisible: true,
  requiresProof: true,
  requiresReference: false,
  countryEG: true,
  countryAE: true
};

export default function AdminPayments() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const { reload: reloadConfig } = useConfig();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [countryFilter, setCountryFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payment-methods'],
    queryFn: () => client.get('/admin/payment-methods').then((r) => r.data?.data)
  });
  const methods = data?.paymentMethods || [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'payment-methods'] });
    qc.invalidateQueries({ queryKey: ['storefront', 'config'] });
    reloadConfig?.();
  };

  const toggle = useMutation({
    mutationFn: ({ id, field }) => client.patch(`/admin/payment-methods/${id}/${field}`),
    onSuccess: invalidate,
    onError: () => toast.error(t('common.error'))
  });

  const save = useMutation({
    mutationFn: ({ id, payload }) => {
      // تجهيز قائمة الدول من المربعات
      const countries = [];
      if (payload.countryEG) countries.push('EG');
      if (payload.countryAE) countries.push('AE');
      if (!countries.length) throw new Error('اختر دولة واحدة على الأقل');

      const body = {
        ...payload,
        code: String(payload.code || payload.nameEn || payload.name || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 30),
        countries,
        config: JSON.stringify({
          countries,
          walletNumber: payload.walletNumber || '',
          accountNumber: payload.accountNumber || '',
          accountName: payload.accountName || '',
          iban: payload.iban || '',
          bankName: payload.bankName || '',
          icon: payload.icon || '',
          qrCode: payload.qrCode || '',
          minOrderAmount: payload.minOrderAmount ? Number(payload.minOrderAmount) : null,
          maxOrderAmount: payload.maxOrderAmount ? Number(payload.maxOrderAmount) : null
        })
      };

      return id && id !== 'new'
        ? client.put(`/admin/payment-methods/${id}`, body)
        : client.post('/admin/payment-methods', body);
    },
    onSuccess: () => {
      toast.success(t('admin.saved'));
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message || t('common.error'))
  });

  const remove = useMutation({
    mutationFn: (id) => client.delete(`/admin/payment-methods/${id}`),
    onSuccess: () => {
      toast.success(t('admin.deleted'));
      setDeleting(null);
      invalidate();
    },
    onError: () => toast.error(t('common.error'))
  });

  const { register, handleSubmit, reset, watch, control } = useForm();

  useEffect(() => {
    if (editing) {
      const cfg = editing.config && typeof editing.config === 'object' ? editing.config : {};
      const countriesList = Array.isArray(cfg.countries) ? cfg.countries : ['EG', 'AE'];
      reset({
        ...EMPTY_METHOD,
        ...editing,
        ...cfg,
        countryEG: countriesList.includes('EG'),
        countryAE: countriesList.includes('AE')
      });
    }
  }, [editing, reset]);

  const feeType = watch('feeType');
  const qrPreview = watch('qrCode');

  // تصفية وسائل الدفع حسب الدولة
  const filteredMethods = methods.filter((m) => {
    const cfg = m.config && typeof m.config === 'object' ? m.config : {};
    const countriesList = Array.isArray(cfg.countries) ? cfg.countries : [];
    if (countryFilter === 'EG') return !countriesList.length || countriesList.includes('EG');
    if (countryFilter === 'AE') return !countriesList.length || countriesList.includes('AE');
    return true;
  });

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
      >
        <Button onClick={() => setEditing({ _id: 'new', ...EMPTY_METHOD })} icon={FiPlus} size="sm">
          {t('common.add')} وسيلة دفع
        </Button>
      </AdminPageHeader>

      {/* شريط اختيار الدولة */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white p-3 shadow-soft">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-xs font-bold text-ink-muted">تصفية حسب الدولة:</span>
          <button
            type="button"
            onClick={() => setCountryFilter('all')}
            className={cn(
              'rounded-full px-4 py-1.5 text-xs font-bold transition',
              countryFilter === 'all' ? 'bg-ink text-white' : 'border border-black/10 bg-cream text-ink hover:border-rose'
            )}
          >
            🌍 جميع الدول
          </button>
          <button
            type="button"
            onClick={() => setCountryFilter('EG')}
            className={cn(
              'rounded-full px-4 py-1.5 text-xs font-bold transition',
              countryFilter === 'EG' ? 'bg-rose text-white' : 'border border-black/10 bg-cream text-ink hover:border-rose'
            )}
          >
            🇪🇬 مصر
          </button>
          <button
            type="button"
            onClick={() => setCountryFilter('AE')}
            className={cn(
              'rounded-full px-4 py-1.5 text-xs font-bold transition',
              countryFilter === 'AE' ? 'bg-rose text-white' : 'border border-black/10 bg-cream text-ink hover:border-rose'
            )}
          >
            🇦🇪 الإمارات
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredMethods.map((m) => {
          const cfg = m.config && typeof m.config === 'object' ? m.config : {};
          const countriesList = Array.isArray(cfg.countries) ? cfg.countries : [];
          const isEg = !countriesList.length || countriesList.includes('EG');
          const isAe = !countriesList.length || countriesList.includes('AE');

          return (
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
                    {(() => {
                      const I = paymentIcon(m.code, m.icon);
                      return <I size={18} />;
                    })()}
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
                  <div className="flex gap-1 text-[11px]">
                    {isEg && <span title="مصر">🇪🇬</span>}
                    {isAe && <span title="الإمارات">🇦🇪</span>}
                  </div>
                </div>
              </div>

              {m.accountNumber || m.walletNumber ? (
                <p className="mt-3 rounded-lg bg-cream px-3 py-2 font-en text-xs text-ink" dir="ltr">
                  {m.accountNumber || m.walletNumber}
                </p>
              ) : null}

              {m.feeType !== 'none' && m.feeType ? (
                <p className="mt-2 text-[11px] text-ink-muted">
                  {t('admin.fee')}: {m.feeType === 'fixed' ? formatPrice(m.feeValue, lang) : `${m.feeValue}%`}
                </p>
              ) : null}

              {m.qrCode ? (
                <SmartImage src={m.qrCode} alt="QR" className="mt-3 h-20 w-20 rounded-lg object-contain" />
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/5 pt-3">
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
                {m.code !== 'cod' && (
                  <button
                    type="button"
                    onClick={() => setDeleting(m)}
                    className="grid h-7 w-7 place-items-center rounded-lg text-red-500 hover:bg-red-50 transition"
                  >
                    <FiTrash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* مودال إنشاء / تعديل وسيلة دفع */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?._id === 'new' ? 'إضافة وسيلة دفع جديدة' : ((lang === 'ar' ? editing?.name : editing?.nameEn) || 'تعديل وسيلة الدفع')}
        size="lg"
      >
        <form onSubmit={handleSubmit((v) => save.mutate({ id: editing?._id, payload: v }))} className="space-y-4 p-6">
          {/* الدولة المستهدفة */}
          <div className="rounded-xl border border-rose/30 bg-cream/60 p-4">
            <p className="mb-2 text-xs font-bold text-ink">الدول المتاحة لوسيلة الدفع:</p>
            <div className="flex flex-wrap gap-6">
              <Checkbox label="🇪🇬 جمهورية مصر العربية" {...register('countryEG')} />
              <Checkbox label="🇦🇪 الإمارات العربية المتحدة" {...register('countryAE')} />
            </div>
            <p className="mt-1.5 text-[11px] text-ink-muted">
              تحديد الدول يمنع ظهور وسيلة الدفع في دول أخرى ويمنع الخادم من قبولها خارج نطاقها.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={`${t('common.name')} (AR)`} required {...register('name', { required: true })} />
            <Input label={`${t('common.name')} (EN)`} dir="ltr" {...register('nameEn')} />
            <Input label="الكود البرمجي (Code)" dir="ltr" placeholder="e.g. aani, instapay, card" {...register('code')} />
            <Select
              label={t('admin.icon')}
              options={[
                { value: 'card', label: t('admin.card') },
                { value: 'zap', label: 'InstaPay / Aani ⚡' },
                { value: 'phone', label: t('admin.wallet') },
                { value: 'cash', label: t('admin.cash') },
                { value: 'truck', label: t('admin.delivery') }
              ]}
              {...register('icon')}
            />
            <Input label={t('payment.walletNumber')} dir="ltr" {...register('walletNumber')} />
            <Input label={t('admin.accountNumber')} dir="ltr" {...register('accountNumber')} />
            <Input label={t('payment.accountName')} {...register('accountName')} />
            <Input label="IBAN" dir="ltr" {...register('iban')} />
            <Input label={t('admin.bankName') || 'Bank'} {...register('bankName')} />
            <Input label="الترتيب (Sort Order)" type="number" {...register('sortOrder')} />

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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={`${t('shop.minPrice')}`} type="number" {...register('minOrderAmount')} />
            <Input label={`${t('shop.maxPrice')}`} type="number" {...register('maxOrderAmount')} />
          </div>

          <div className="grid gap-2 rounded-xl bg-cream p-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting._id)}
        title={t('admin.confirmDelete')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}