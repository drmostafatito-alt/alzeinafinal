import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FiPlus } from 'react-icons/fi';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import DataTable from '@/components/admin/DataTable';
import Input, { Checkbox, Select } from '@/components/forms/Input';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import RowActions from '@/components/admin/RowActions';
import ImagePicker from '@/components/admin/ImagePicker';
import { useAdminResource } from '@/hooks/useAdminResource';
import { adminService } from '@/services';
import { useI18n } from '@/i18n';
import { localized } from '@/utils/helpers';
import SmartImage from '@/components/ui/SmartImage';

export default function AdminBanners() {
  const { t, lang } = useI18n();
  const res = useAdminResource('banners', adminService.banners, 'banners');
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();

  useEffect(() => {
    if (!res.modalOpen) return;
    reset(
      res.editing || {
        title: '',
        titleEn: '',
        subtitle: '',
        subtitleEn: '',
        image: 'https://picsum.photos/seed/new-banner/1600/800',
        link: '/shop',
        buttonText: 'تسوّقي الآن',
        buttonTextEn: 'Shop now',
        position: 'hero',
        order: res.items.length + 1,
        isActive: true,
      }
    );
  }, [res.modalOpen, res.editing, reset, res.items.length]);

  const onSubmit = (v) => res.save({ ...v, order: Number(v.order) || 0 });

  const columns = [
    {
      key: 'title',
      header: t('common.name'),
      render: (b) => (
        <div className="flex items-center gap-3">
          <SmartImage src={b.image} alt="" className="h-12 w-20 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0">
            <p className="clamp-1 text-sm font-semibold text-ink">{localized(b, lang, 'title')}</p>
            <p className="clamp-1 text-[11px] text-ink-muted">{localized(b, lang, 'subtitle')}</p>
          </div>
        </div>
      ),
    },
    { key: 'position', header: t('admin.position'), render: (b) => <Badge variant="blush">{b.position}</Badge> },
    { key: 'link', header: t('admin.link'), render: (b) => <span className="font-en text-xs text-ink-muted">{b.link}</span>, hideOnMobile: true },
    { key: 'order', header: t('admin.order'), render: (b) => b.order ?? 0, hideOnMobile: true },
    {
      key: 'isActive',
      header: t('common.status'),
      render: (b) => (
        <Badge variant={b.isActive !== false ? 'success' : 'neutral'}>
          {b.isActive !== false ? t('common.active') : t('common.inactive')}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader title={t('admin.banners')} subtitle={`${res.items.length}`}>
        <Button onClick={res.openCreate} icon={FiPlus} size="sm">
          {t('admin.addBanner')}
        </Button>
      </AdminPageHeader>

      <DataTable
        columns={columns}
        data={res.items}
        loading={res.isLoading}
        searchKeys={['title', 'titleEn']}
        actions={(row) => <RowActions onEdit={() => res.openEdit(row)} onDelete={() => res.setDeleting(row._id)} />}
      />

      <Modal open={res.modalOpen} onClose={res.closeModal} title={res.editing ? t('common.edit') : t('admin.addBanner')} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={`${t('common.name')} (AR)`} required error={errors.title?.message} {...register('title', { required: t('valid.required') })} />
            <Input label={`${t('common.name')} (EN)`} dir="ltr" {...register('titleEn')} />
            <Input label={`${t('admin.subtitle')} (AR)`} {...register('subtitle')} />
            <Input label={`${t('admin.subtitle')} (EN)`} dir="ltr" {...register('subtitleEn')} />
            <Input label={`${t('admin.buttonText')} (AR)`} {...register('buttonText')} />
            <Input label={`${t('admin.buttonText')} (EN)`} dir="ltr" {...register('buttonTextEn')} />
            <Input label={t('admin.link')} dir="ltr" {...register('link')} />
            <Select
              label={t('admin.position')}
              options={[
                { value: 'hero', label: 'Hero' },
                { value: 'featured', label: 'Featured' },
                { value: 'sidebar', label: 'Sidebar' },
                { value: 'footer', label: 'Footer' },
              ]}
              {...register('position')}
            />
            <Input label={t('admin.order')} type="number" {...register('order')} />
            <Controller
              name="image"
              control={control}
              render={({ field }) => (
                <ImagePicker
                  label={t('common.image')}
                  folder="banners"
                  className="sm:col-span-2"
                  aspect="aspect-video"
                  previewSize="h-20 w-32"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
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
