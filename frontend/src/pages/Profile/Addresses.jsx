import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FiCheck, FiEdit2, FiMapPin, FiPlus, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Input, { Checkbox, Select } from '@/components/forms/Input';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import { useLocalStorage } from '@/hooks';
import { useI18n } from '@/i18n';
import { GOVERNORATES } from '@/utils/constants';
import { cn, uid } from '@/utils/helpers';

export default function Addresses() {
  const { t, lang } = useI18n();
  const [addresses, setAddresses] = useLocalStorage('alzeina_addresses', []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const openNew = () => {
    setEditing(null);
    reset({
      title: '',
      name: '',
      phone: '',
      governorate: '',
      city: '',
      district: '',
      street: '',
      buildingNumber: '',
      floor: '',
      apartment: '',
      landmark: '',
      isDefault: !addresses.length,
    });
    setModalOpen(true);
  };

  const openEdit = (addr) => {
    setEditing(addr);
    reset(addr);
    setModalOpen(true);
  };

  const onSubmit = (values) => {
    const list = [...(addresses || [])];
    if (values.isDefault) list.forEach((a) => (a.isDefault = false));

    if (editing) {
      const idx = list.findIndex((a) => a._id === editing._id);
      list[idx] = { ...editing, ...values };
    } else {
      list.push({ ...values, _id: uid() });
    }
    setAddresses(list);
    setModalOpen(false);
    toast.success(t('profile.addressSaved'));
  };

  const setDefault = (id) => {
    setAddresses((addresses || []).map((a) => ({ ...a, isDefault: a._id === id })));
  };

  const remove = (id) => {
    setAddresses((addresses || []).filter((a) => a._id !== id));
    toast.info(t('profile.addressDeleted'));
  };

  const govOptions = GOVERNORATES.map((g) => ({ value: g.value, label: g[lang] || g.ar }));
  const govLabel = (v) => govOptions.find((g) => g.value === v)?.label || v;

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">{t('profile.addresses')}</h2>
        <Button onClick={openNew} size="sm" icon={FiPlus}>
          {t('profile.addAddress')}
        </Button>
      </div>

      {addresses?.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <div
              key={a._id}
              className={cn(
                'relative rounded-xl border p-4 transition',
                a.isDefault ? 'border-rose bg-blush/40' : 'border-black/10 hover:border-rose/40'
              )}
            >
              {a.isDefault ? (
                <span className="absolute end-3 top-3 inline-flex items-center gap-1 rounded-full bg-rose px-2 py-0.5 text-[10px] font-bold text-white">
                  <FiCheck size={10} /> {t('profile.defaultAddress')}
                </span>
              ) : null}

              <p className="text-sm font-bold text-ink">{a.title || a.name}</p>
              <p className="mt-1 text-xs text-ink-muted">{a.name}</p>
              <p dir="ltr" className="text-xs text-ink-muted rtl:text-end">
                {a.phone}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                {[a.street, a.district, a.city, govLabel(a.governorate)].filter(Boolean).join('، ')}
              </p>
              {a.landmark ? <p className="mt-1 text-[11px] text-ink-muted">{a.landmark}</p> : null}

              <div className="mt-3 flex flex-wrap gap-2 border-t border-black/5 pt-3">
                <button
                  type="button"
                  onClick={() => openEdit(a)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-ink transition hover:text-rose"
                >
                  <FiEdit2 size={12} /> {t('common.edit')}
                </button>
                {!a.isDefault ? (
                  <button
                    type="button"
                    onClick={() => setDefault(a._id)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-ink transition hover:text-rose"
                  >
                    <FiCheck size={12} /> {t('profile.setDefault')}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setDeleting(a._id)}
                  className="ms-auto flex items-center gap-1 text-[11px] font-semibold text-red-600 transition hover:underline"
                >
                  <FiTrash2 size={12} /> {t('common.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FiMapPin}
          title={t('profile.noAddresses')}
          actionLabel={t('profile.addAddress')}
          onAction={openNew}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('profile.editAddress') : t('profile.addAddress')}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={`${t('common.name')} (${t('common.optional')})`} placeholder="المنزل / العمل" {...register('title')} />
            <Input
              label={t('checkout.fullName')}
              required
              error={errors.name?.message}
              {...register('name', { required: t('valid.required') })}
            />
            <Input
              label={t('common.phone')}
              type="tel"
              dir="ltr"
              required
              error={errors.phone?.message}
              {...register('phone', { required: t('valid.required') })}
            />
            <Select
              label={t('checkout.governorate')}
              required
              placeholder={t('common.select')}
              options={govOptions}
              error={errors.governorate?.message}
              {...register('governorate', { required: t('valid.required') })}
            />
            <Input
              label={t('checkout.city')}
              required
              error={errors.city?.message}
              {...register('city', { required: t('valid.required') })}
            />
            <Input
              label={t('checkout.district')}
              required
              error={errors.district?.message}
              {...register('district', { required: t('valid.required') })}
            />
            <Input
              label={t('checkout.street')}
              required
              containerClassName="sm:col-span-2"
              error={errors.street?.message}
              {...register('street', { required: t('valid.required') })}
            />
            <Input label={t('checkout.building')} {...register('buildingNumber')} />
            <Input label={t('checkout.floor')} {...register('floor')} />
            <Input label={t('checkout.apartment')} {...register('apartment')} />
            <Input label={t('checkout.landmark')} {...register('landmark')} />
          </div>

          <Checkbox label={t('profile.setDefault')} {...register('isDefault')} />

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">
              {t('common.save')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove(deleting)}
        title={t('admin.confirmDelete')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        danger
      />
    </div>
  );
}
