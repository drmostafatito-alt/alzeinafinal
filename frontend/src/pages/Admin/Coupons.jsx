import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FiPlus, FiTag } from 'react-icons/fi';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import DataTable from '@/components/admin/DataTable';
import Input, { Checkbox, Select, Textarea } from '@/components/forms/Input';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import RowActions from '@/components/admin/RowActions';
import { useAdminResource } from '@/hooks/useAdminResource';
import { useBrands, useCategories } from '@/hooks';
import { adminService } from '@/services';
import { useI18n } from '@/i18n';
import { formatDate, formatPrice } from '@/utils/format';
import { localized } from '@/utils/helpers';

const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export default function AdminCoupons() {
  const { t, lang } = useI18n();
  const res = useAdminResource('coupons', adminService.coupons, 'coupons');
  const { categories } = useCategories();
  const { brands } = useBrands();
  const { register, handleSubmit, reset, watch, control, formState: { errors } } = useForm();

  useEffect(() => {
    if (!res.modalOpen) return;
    reset(
      res.editing
        ? {
            ...res.editing,
            startDate: toDateInput(res.editing.startDate),
            endDate: toDateInput(res.editing.endDate),
            // القيود تُخزَّن كمصفوفات معرّفات — نطبّعها لعناصر <select multiple>
            categories: (res.editing.categories || []).map((c) => String(c?._id || c)),
            brands: (res.editing.brands || []).map((b) => String(b?._id || b)),
            products: (res.editing.products || []).map((p) => String(p?._id || p)),
            freeShipping: Boolean(res.editing.freeShipping)
          }
        : {
            code: '',
            description: '',
            discountType: 'percentage',
            discountValue: 10,
            minOrderAmount: 0,
            maxDiscount: '',
            startDate: toDateInput(new Date()),
            endDate: toDateInput(new Date(Date.now() + 30 * 86400000)),
            usageLimit: 100,
            perUserLimit: 1,
            isActive: true,
            freeShipping: false,
            categories: [], brands: [], products: []
          }
    );
  }, [res.modalOpen, res.editing, reset]);

  const discountType = watch('discountType');

  const onSubmit = (v) =>
    res.save({
      ...v,
      code: String(v.code).toUpperCase(),
      // الشحن المجاني بلا قيمة خصم — الحقل يختفي من النموذج في هذه الحالة
      discountValue: v.discountType === 'free-shipping' ? 0 : Number(v.discountValue),
      minOrderAmount: Number(v.minOrderAmount) || 0,
      maxDiscount: v.maxDiscount ? Number(v.maxDiscount) : undefined,
      usageLimit: Number(v.usageLimit) || 1,
      perUserLimit: Number(v.perUserLimit) || 1,
      usedCount: res.editing?.usedCount || 0,
      freeShipping: Boolean(v.freeShipping),
      categories: v.categories || [],
      brands: v.brands || [],
      products: v.products || []
    });

  const isExpired = (c) => new Date(c.endDate).getTime() < Date.now();

  const columns = [
    {
      key: 'code',
      header: t('admin.code'),
      render: (c) => (
        <div>
          <p className="font-en text-sm font-bold text-ink">{c.code}</p>
          <p className="clamp-1 text-[11px] text-ink-muted">{c.description}</p>
        </div>
      ),
    },
    {
      key: 'discountValue',
      header: t('admin.discountValue'),
      render: (c) => {
        if (c.discountType === 'free-shipping') {
          return <span className="whitespace-nowrap rounded-full bg-sky-100 px-2 py-1 text-[11px] font-bold text-sky-700">{t('a3.freeShipping')}</span>;
        }
        return c.discountType === 'percentage' ? (
          <span className="font-bold text-rose">{c.discountValue}%</span>
        ) : (
          <span className="font-bold text-rose">{formatPrice(c.discountValue, lang)}</span>
        );
      },
    },
    { key: 'minOrderAmount', header: t('shop.minPrice'), render: (c) => formatPrice(c.minOrderAmount || 0, lang), hideOnMobile: true },
    {
      key: 'usedCount',
      header: t('admin.used'),
      render: (c) => (
        <span className="text-xs">
          {c.usedCount || 0} / {c.usageLimit}
        </span>
      ),
    },
    { key: 'endDate', header: t('admin.endDate'), render: (c) => formatDate(c.endDate, lang), hideOnMobile: true },
    {
      key: 'isActive',
      header: t('common.status'),
      render: (c) => {
        if (isExpired(c)) return <Badge variant="neutral">{lang === 'ar' ? 'منتهي' : 'Expired'}</Badge>;
        return (
          <Badge variant={c.isActive !== false ? 'success' : 'neutral'}>
            {c.isActive !== false ? t('common.active') : t('common.inactive')}
          </Badge>
        );
      },
    },
  ];

  return (
    <>
      <AdminPageHeader title={t('admin.coupons')} subtitle={`${res.items.length}`}>
        <Button onClick={res.openCreate} icon={FiPlus} size="sm">
          {t('admin.addCoupon')}
        </Button>
      </AdminPageHeader>

      <DataTable
        columns={columns}
        data={res.items}
        loading={res.isLoading}
        searchKeys={['code', 'description']}
        emptyIcon={FiTag}
        emptyTitle={t('a5.empty.coupons.title')}
        emptyDescription={t('a5.empty.coupons.desc')}
        emptyActionLabel={t('admin.addCoupon')}
        onEmptyAction={res.openCreate}
        actions={(row) => <RowActions onEdit={() => res.openEdit(row)} onDelete={() => res.setDeleting(row._id)} />}
      />

      <Modal open={res.modalOpen} onClose={res.closeModal} title={res.editing ? t('common.edit') : t('admin.addCoupon')}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('admin.code')}
              dir="ltr"
              required
              className="uppercase"
              error={errors.code?.message}
              {...register('code', { required: t('valid.required'), minLength: { value: 3, message: t('valid.minLength', { n: 3 }) } })}
            />
            <Select
              label={t('admin.discountType')}
              options={[
                { value: 'percentage', label: t('admin.percentage') },
                { value: 'fixed', label: t('admin.fixed') },
                { value: 'free-shipping', label: t('a3.freeShipping') },
              ]}
              {...register('discountType')}
            />
            {discountType !== 'free-shipping' ? (
              <Input
                label={`${t('admin.discountValue')} ${discountType === 'percentage' ? '(%)' : `(${t('common.currency')})`}`}
                type="number"
                step="0.01"
                required
                error={errors.discountValue?.message}
                {...register('discountValue', { required: t('valid.required'), min: { value: 0.01, message: t('valid.min', { n: 0.01 }) } })}
              />
            ) : null}
            <Input label={t('shop.minPrice')} type="number" {...register('minOrderAmount')} />
            {discountType === 'percentage' ? (
              <Input label={t('a3.maxDiscount')} type="number" hint={t('common.optional')} {...register('maxDiscount')} />
            ) : null}
            <Input label={t('admin.usageLimit')} type="number" {...register('usageLimit')} />
            <Input label={t('a3.perUserLimit')} type="number" min="1" {...register('perUserLimit')} />
            <Input label={t('admin.startDate')} type="date" required {...register('startDate', { required: t('valid.required') })} />
            <Input label={t('admin.endDate')} type="date" required {...register('endDate', { required: t('valid.required') })} />
          </div>
          {/* قيود التطبيق — فارغة تعني بلا قيد */}
          <div className="space-y-3 rounded-xl bg-cream p-4">
            <div>
              <p className="text-xs font-bold text-ink">{t('a3.couponRestrictions')}</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">{t('a3.noRestriction')}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Controller
                name="categories"
                control={control}
                render={({ field }) => (
                  <div>
                    <label className="label" htmlFor="c-cats">{t('a3.restrictCategories')}</label>
                    <select
                      id="c-cats" multiple size={4}
                      value={field.value || []}
                      onChange={(e) => field.onChange(Array.from(e.target.selectedOptions, (o) => o.value))}
                      className="input h-auto py-2 text-sm"
                    >
                      {categories.map((c) => (
                        <option key={c._id} value={c._id}>{localized(c, lang)}</option>
                      ))}
                    </select>
                  </div>
                )}
              />

              <Controller
                name="brands"
                control={control}
                render={({ field }) => (
                  <div>
                    <label className="label" htmlFor="c-brands">{t('a3.restrictBrands')}</label>
                    <select
                      id="c-brands" multiple size={4}
                      value={field.value || []}
                      onChange={(e) => field.onChange(Array.from(e.target.selectedOptions, (o) => o.value))}
                      className="input h-auto py-2 text-sm"
                    >
                      {brands.map((b) => (
                        <option key={b._id} value={b._id}>{localized(b, lang)}</option>
                      ))}
                    </select>
                  </div>
                )}
              />
            </div>

            <Checkbox label={t('a3.freeShipping')} {...register('freeShipping')} />
          </div>

          <Textarea label={t('common.description')} rows={2} {...register('description')} />
          <Checkbox label={t('common.active')} {...register('isActive')} />
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={res.saving} className="flex-1">
              {t('common.save')}
            </Button>
            <Button type="button" variant="outline" onClick={res.closeModal}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(res.deleting)}
        onClose={() => res.setDeleting(null)}
        onConfirm={res.confirmDelete}
        title={t('admin.confirmDelete')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}
