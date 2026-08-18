import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FiEye, FiEyeOff, FiLayers, FiList, FiPlus, FiSave, FiGrid } from 'react-icons/fi';
import { toast } from 'react-toastify';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import DataTable from '@/components/admin/DataTable';
import AdvancedFields from '@/components/admin/AdvancedFields';
import Input, { Checkbox, Textarea } from '@/components/forms/Input';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import RowActions from '@/components/admin/RowActions';
import ImagePicker from '@/components/admin/ImagePicker';
import SortableList from '@/components/admin/SortableList';
import client from '@/api/client';
import { useAdminResource } from '@/hooks/useAdminResource';
import { adminService } from '@/services';
import { useI18n } from '@/i18n';
import { slugify } from '@/utils/format';
import { cn, localized } from '@/utils/helpers';
import SmartImage from '@/components/ui/SmartImage';

export default function AdminCategories() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const res = useAdminResource('categories', adminService.categories, 'categories');
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();

  /* عرض الجدول أو ترتيب بالسحب والإفلات */
  const [view, setView] = useState('table');
  const [ordered, setOrdered] = useState([]);
  const [dirty, setDirty] = useState(false);

  // نُهيّئ قائمة الترتيب من البيانات، ولا نكتب فوق تعديل غير محفوظ
  useEffect(() => {
    if (!dirty) setOrdered(res.items);
  }, [res.items, dirty]);

  const saveOrder = useMutation({
    mutationFn: () =>
      client.put('/admin/categories-reorder', {
        items: ordered.map((c, i) => ({ id: c._id, order: i + 1 }))
      }),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const toggleActive = useMutation({
    mutationFn: (c) => client.put(`/admin/categories/${c._id}`, { isActive: !c.isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: () => toast.error(t('common.error'))
  });

  useEffect(() => {
    if (!res.modalOpen) return;
    reset(
      (res.editing && {
        ...res.editing,
        metaKeywords: Array.isArray(res.editing.metaKeywords) ? res.editing.metaKeywords.join(', ') : (res.editing.metaKeywords || '')
      }) || {
        name: '', nameEn: '', slug: '', description: '', descriptionEn: '',
        image: '', order: res.items.length + 1, isActive: true,
        metaTitle: '', metaDescription: '', metaKeywords: ''
      }
    );
  }, [res.modalOpen, res.editing, reset, res.items.length]);


  const onSubmit = (v) =>
    res.save({
      ...v,
      slug: v.slug || slugify(v.nameEn || v.name),
      order: Number(v.order) || 0,
      metaKeywords: typeof v.metaKeywords === 'string'
        ? v.metaKeywords.split(',').map((x) => x.trim()).filter(Boolean)
        : v.metaKeywords
    });

  const columns = [
    {
      key: 'name',
      header: t('common.name'),
      render: (c) => (
        <div className="flex items-center gap-3">
          <SmartImage src={c.image} alt={localized(c, lang)} loading="lazy" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0">
            <p className="clamp-1 text-sm font-semibold text-ink">{localized(c, lang)}</p>
            <p className="font-en text-[11px] text-ink-muted">{c.slug}</p>
          </div>
        </div>
      ),
    },
    { key: 'description', header: t('common.description'), render: (c) => <p className="clamp-2 max-w-xs text-xs text-ink-muted">{c.description || '—'}</p>, hideOnMobile: true },
    { key: 'productCount', header: t('categories.products'), render: (c) => c.productCount ?? 0 },
    { key: 'order', header: t('admin.order'), render: (c) => c.order ?? 0, hideOnMobile: true },
    {
      key: 'isActive',
      header: t('common.status'),
      render: (c) => (
        <Badge variant={c.isActive !== false ? 'success' : 'neutral'}>
          {c.isActive !== false ? t('common.active') : t('common.inactive')}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader title={t('admin.categories')} subtitle={`${res.items.length}`}>
        <div className="flex gap-1 rounded-lg bg-cream p-1">
          <button
            type="button" onClick={() => setView('table')}
            aria-label={t('common.view')} title={t('common.view')}
            className={cn('grid h-8 w-8 place-items-center rounded-md transition', view === 'table' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted')}
          >
            <FiGrid size={14} />
          </button>
          <button
            type="button" onClick={() => setView('sort')}
            aria-label={t('a3.dragToReorder')} title={t('a3.dragToReorder')}
            className={cn('grid h-8 w-8 place-items-center rounded-md transition', view === 'sort' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted')}
          >
            <FiList size={14} />
          </button>
        </div>
        {view === 'sort' ? (
          <Button size="sm" icon={FiSave} onClick={() => saveOrder.mutate()} loading={saveOrder.isPending} disabled={!dirty}>
            {t('a3.saveLayout')}
          </Button>
        ) : null}
        <Button onClick={res.openCreate} icon={FiPlus} size="sm">
          {t('admin.addCategory')}
        </Button>
      </AdminPageHeader>

      {view === 'sort' ? (
        <SortableList items={ordered} onReorder={(next) => { setOrdered(next); setDirty(true); }}>
          {(c, i) => (
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-en grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-cream text-xs font-bold text-ink-muted">{i + 1}</span>
              <SmartImage src={c.image} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="clamp-1 text-sm font-semibold text-ink">{localized(c, lang)}</p>
                <p className="font-en text-[11px] text-ink-muted">{c.slug}</p>
              </div>
              <Badge variant={c.isActive !== false ? 'success' : 'neutral'}>
                {c.isActive !== false ? t('a3.visible') : t('a3.hidden')}
              </Badge>
            </div>
          )}
        </SortableList>
      ) : (
        <DataTable
          columns={columns}
          data={res.items}
          loading={res.isLoading}
          searchKeys={['name', 'nameEn', 'slug']}
          emptyIcon={FiLayers}
          emptyTitle={t('a5.empty.categories.title')}
          emptyDescription={t('a5.empty.categories.desc')}
          emptyActionLabel={t('admin.addCategory')}
          onEmptyAction={res.openCreate}
          actions={(row) => (
            <RowActions
              onEdit={() => res.openEdit(row)}
              onDelete={() => res.setDeleting(row._id)}
              extra={
                <button
                  type="button"
                  onClick={() => toggleActive.mutate(row)}
                  title={row.isActive !== false ? t('a3.hidden') : t('a3.visible')}
                  aria-label={row.isActive !== false ? t('a3.hidden') : t('a3.visible')}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-rose hover:text-rose"
                >
                  {row.isActive !== false ? <FiEye size={14} /> : <FiEyeOff size={14} />}
                </button>
              }
            />
          )}
        />
      )}

      <Modal open={res.modalOpen} onClose={res.closeModal} title={res.editing ? t('common.edit') : t('admin.addCategory')}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={`${t('common.name')} (AR)`} required error={errors.name?.message} {...register('name', { required: t('valid.required') })} />
            <Input label={`${t('common.name')} (EN)`} dir="ltr" {...register('nameEn')} />
            <Input label={t('admin.order')} type="number" {...register('order')} />

          </div>
          {/* الرابط مخفي افتراضياً — يُولَّد تلقائياً من الاسم */}
          <AdvancedFields className="mt-2">
            <Input label={t('a7.slugLabel')} dir="ltr" hint={t('a6.slugHint')} {...register('slug')} />
          </AdvancedFields>

          <Controller
            name="image"
            control={control}
            render={({ field }) => (
              <ImagePicker
                label={t('common.image')}
                folder="categories"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Textarea label={`${t('common.description')} (AR)`} rows={3} {...register('description')} />
          <Textarea label={`${t('common.description')} (EN)`} rows={2} dir="ltr" {...register('descriptionEn')} />

          {/* حقول تحسين محركات البحث */}
          <div className="grid gap-4 rounded-xl bg-cream p-4">
            <p className="text-xs font-bold text-ink-muted">{t('a3.seoFields')}</p>
            <Input label="SEO Title" {...register('metaTitle')} />
            <Textarea label="SEO Description" rows={2} {...register('metaDescription')} />
            <Input label="Keywords" hint={t('product.tagsHint')} {...register('metaKeywords')} />
          </div>

          <Checkbox label={t('a3.visible')} {...register('isActive')} />
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
