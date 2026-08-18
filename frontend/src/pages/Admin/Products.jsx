import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FiCopy, FiDownload, FiExternalLink, FiDollarSign, FiImage, FiLayers, FiPackage,
  FiPlus, FiSearch, FiSliders, FiTrash2, FiUpload
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import BulkBar from '@/components/admin/BulkBar';
import ExportMenu from '@/components/admin/ExportMenu';
import DataTable from '@/components/admin/DataTable';
import Input, { Checkbox, Select, Textarea } from '@/components/forms/Input';
import Combobox from '@/components/forms/Combobox';
import AdvancedFields from '@/components/admin/AdvancedFields';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import RowActions from '@/components/admin/RowActions';
import ImagePicker, { GalleryPicker } from '@/components/admin/ImagePicker';
import client from '@/api/client';
import { useAdminResource } from '@/hooks/useAdminResource';
import { useBrands, useCategories } from '@/hooks';
import { adminService } from '@/services';
import { useI18n } from '@/i18n';
import { formatPrice, slugify } from '@/utils/format';
import { cn, localized } from '@/utils/helpers';
import SmartImage from '@/components/ui/SmartImage';

const STATUS_META = {
  published: { ar: 'منشور', en: 'Published', color: 'bg-emerald-100 text-emerald-700' },
  draft: { ar: 'مسودة', en: 'Draft', color: 'bg-stone-200 text-stone-700' },
  scheduled: { ar: 'مجدول', en: 'Scheduled', color: 'bg-sky-100 text-sky-700' }
};

/**
 * تبويبات نموذج المنتج.
 * الترتيب مقصود: ما يلزم لحفظ منتج صالح أولاً، ثم التفاصيل الاختيارية.
 */
const PRODUCT_TABS = [
  { key: 'general', icon: FiLayers, label: 'a6.tab.general' },
  { key: 'pricing', icon: FiDollarSign, label: 'a6.tab.pricing' },
  { key: 'inventory', icon: FiPackage, label: 'a6.tab.inventory' },
  { key: 'images', icon: FiImage, label: 'a6.tab.images' },
  { key: 'seo', icon: FiSearch, label: 'a6.tab.seo' },
  { key: 'advanced', icon: FiSliders, label: 'a6.tab.advanced' },
];

/** يحوّل تاريخاً إلى صيغة datetime-local */
const toLocalInput = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60000).toISOString().slice(0, 16);
};

export default function AdminProducts() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  /* مفاتيح كاش واجهة المتجر التي تعتمد على المنتجات — تُبطَل بعد أي تعديل
     حتى لا تعرض الرئيسية/صفحة المنتج قوائم قديمة (staleTime خمس دقائق). */
  const STOREFRONT_PRODUCT_KEYS = ['featured', 'bestSellers', 'newArrivals', 'onSale', 'product', 'products-ids'];

  const res = useAdminResource('products', adminService.products, 'products', STOREFRONT_PRODUCT_KEYS);
  const { categories } = useCategories();
  const { brands } = useBrands();
  const fileRef = useRef(null);

  const [selected, setSelected] = useState([]);
  const [bulkConfirm, setBulkConfirm] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importState, setImportState] = useState({ csv: '', fileName: '', result: null });
  /* التبويب النشط داخل نموذج المنتج */
  const [formTab, setFormTab] = useState('general');

  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm();
  const status = watch('status');

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['admin', 'products'] });
    qc.invalidateQueries({ queryKey: ['admin', 'analytics'] });
    qc.invalidateQueries({ queryKey: ['admin', 'inventory'] });
    // إبطال مفاتيح واجهة المتجر أيضاً (نفس إصلاح «المنتج لا يظهر في المتجر»)
    for (const k of STOREFRONT_PRODUCT_KEYS) qc.invalidateQueries({ queryKey: [k] });
  }, [qc]);

  /* ---------- العمليات الجماعية ---------- */
  const bulk = useMutation({
    mutationFn: (payload) => client.post('/admin/products/bulk', payload),
    onSuccess: (r) => {
      toast.success(r.data?.message || t('admin.saved'));
      setSelected([]);
      setBulkConfirm(null);
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const duplicate = useMutation({
    mutationFn: (id) => client.post(`/admin/products/${id}/duplicate`),
    onSuccess: (r) => { toast.success(r.data?.message || t('admin.saved')); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const runImport = useMutation({
    mutationFn: ({ csv, dryRun }) => client.post('/admin/products/import', { csv, dryRun }),
    onSuccess: (r, vars) => {
      setImportState((s) => ({ ...s, result: r.data?.data }));
      toast.success(r.data?.message);
      if (!vars.dryRun) invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const download = useCallback(async (path, filename) => {
    try {
      const r = await client.get(path, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      toast.error(t('common.error'));
    }
  }, [t]);

  useEffect(() => {
    if (!res.modalOpen) return;
    /* نبدأ دائماً من التبويب الأول حتى لا يفتح النموذج على تبويب قديم */
    setFormTab('general');
    const e = res.editing;
    reset(
      e
        ? {
            name: e.name || '', nameEn: e.nameEn || '', slug: e.slug || '', sku: e.sku || '',
            category: e.category?._id || e.category || '', brand: e.brand?._id || e.brand || '',
            price: e.price ?? '', oldPrice: e.oldPrice ?? '', cost: e.cost ?? '',
            stock: e.stock ?? 0, mainImage: e.mainImage || '',
            images: Array.isArray(e.images) ? e.images : [],
            description: e.description || '', descriptionEn: e.descriptionEn || '',
            shortDescription: e.shortDescription || '', shortDescriptionEn: e.shortDescriptionEn || '',
            metaTitle: e.metaTitle || '', metaDescription: e.metaDescription || '',
            tags: Array.isArray(e.tags) ? e.tags.join(', ') : '',
            status: e.status || (e.isActive === false ? 'draft' : 'published'),
            publishAt: toLocalInput(e.publishAt),
            isFeatured: Boolean(e.isFeatured), isBestSeller: Boolean(e.isBestSeller),
            isNewArrival: Boolean(e.isNewArrival), isActive: e.isActive !== false
          }
        : {
            name: '', nameEn: '', slug: '', sku: '', category: '', brand: '',
            price: '', oldPrice: '', cost: '', stock: 0, mainImage: '', images: [],
            description: '', descriptionEn: '', shortDescription: '', shortDescriptionEn: '',
            metaTitle: '', metaDescription: '', tags: '',
            status: 'published', publishAt: '',
            isFeatured: false, isBestSeller: false, isNewArrival: true, isActive: true
          }
    );
  }, [res.modalOpen, res.editing, reset]);

  const onSubmit = (v) => {
    const gallery = Array.isArray(v.images) ? v.images.filter(Boolean) : [];
    const main = v.mainImage || gallery[0] || '';
    const images = main ? [main, ...gallery.filter((g) => g !== main)] : gallery;

    res.save({
      ...v,
      slug: v.slug || slugify(v.nameEn || v.name),
      price: Number(v.price),
      oldPrice: v.oldPrice ? Number(v.oldPrice) : undefined,
      cost: v.cost ? Number(v.cost) : 0,
      stock: Number(v.stock),
      mainImage: main,
      images,
      publishAt: v.status === 'scheduled' && v.publishAt ? new Date(v.publishAt).toISOString() : undefined,
      // isActive يُشتق من حالة النشر حتى لا تتعارض القيمتان
      isActive: v.status === 'published',
      tags: String(v.tags || '').split(',').map((x) => x.trim()).filter(Boolean)
    });
  };

  /*
   * فشل التحقق: كان الرفض صامتاً — أخطاء الحقول المطلوبة تُعرض داخل تبويبات
   * مطوية (مثل السعر في تبويب التسعير) فيضغط المدير «حفظ» ولا يحدث شيء مرئي،
   * ويظن أن المنتج لم يُحفظ أو أن الحفظ معلّق. ننتقل الآن لأول تبويب فيه
   * خطأ ونُظهر تنبيهاً، ونعلّم التبويبات الناقصة بنقطة حمراء.
   */
  const FIELD_TAB = {
    name: 'general', nameEn: 'general', description: 'general', descriptionEn: 'general',
    shortDescription: 'general', shortDescriptionEn: 'general',
    price: 'pricing', oldPrice: 'pricing', cost: 'pricing',
    stock: 'inventory',
    mainImage: 'images', images: 'images',
    slug: 'seo', sku: 'seo', metaTitle: 'seo', metaDescription: 'seo'
  };
  const onInvalid = (errs) => {
    const firstBad = PRODUCT_TABS.find((tb) => Object.keys(errs).some((k) => FIELD_TAB[k] === tb.key));
    if (firstBad && firstBad.key !== formTab) setFormTab(firstBad.key);
    toast.error(t('valid.fixRequired'));
  };

  const columns = useMemo(() => [
    {
      key: 'name',
      header: t('common.name'),
      render: (p) => (
        <div className="flex items-center gap-3">
          <SmartImage src={p.mainImage} alt={localized(p, lang)} loading="lazy" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0">
            <p className="clamp-1 text-sm font-semibold text-ink">{localized(p, lang)}</p>
            <p className="font-en text-[11px] text-ink-muted">{p.sku}</p>
          </div>
        </div>
      )
    },
    { key: 'category.name', header: t('common.category'), render: (p) => localized(p.category, lang) || '—', hideOnMobile: true },
    { key: 'brand.name', header: t('common.brandLabel'), render: (p) => localized(p.brand, lang) || '—', hideOnMobile: true },
    {
      key: 'price',
      header: t('common.price'),
      render: (p) => (
        <div>
          <p className="text-sm font-bold text-ink">{formatPrice(p.price, lang)}</p>
          {p.oldPrice ? <p className="text-[11px] text-ink-muted line-through">{formatPrice(p.oldPrice, lang)}</p> : null}
        </div>
      )
    },
    {
      key: 'stock',
      header: t('admin.stock'),
      render: (p) => (
        <span className={cn(
          'rounded-full px-2.5 py-1 text-[11px] font-bold',
          p.stock === 0 ? 'bg-red-100 text-red-700' : p.stock <= 5 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
        )}>
          {p.stock}
        </span>
      )
    },
    {
      key: 'status',
      header: t('a3.status'),
      render: (p) => {
        const st = p.status || (p.isActive === false ? 'draft' : 'published');
        const meta = STATUS_META[st] || STATUS_META.published;
        return (
          <div className="flex flex-wrap gap-1">
            <span className={cn('whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold', meta.color)}>
              {meta[lang]}
            </span>
            {p.isFeatured ? <Badge variant="rose">{t('admin.featured')}</Badge> : null}
          </div>
        );
      }
    }
  ], [t, lang]);

  const bulkAction = (action, value) => bulk.mutate({ ids: selected, action, value });

  const bulkBtn = 'rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/25';
  const bulkSelect = 'rounded-lg bg-white/15 px-2 py-1.5 text-xs font-semibold text-white outline-none [&>option]:text-ink';

  return (
    <>
      <AdminPageHeader title={t('admin.products')} subtitle={`${res.items.length} ${t('categories.products')}`}>
        <ExportMenu path="/admin/products/export" filename="products" label={t('a3.exportProducts')} />
        <Button size="sm" variant="outline" icon={FiUpload} onClick={() => { setImportOpen(true); setImportState({ csv: '', fileName: '', result: null }); }}>
          {t('a3.importProducts')}
        </Button>
        <Button onClick={res.openCreate} icon={FiPlus} size="sm">{t('admin.addProduct')}</Button>
      </AdminPageHeader>

      <DataTable
        columns={columns}
        data={res.items}
        loading={res.isLoading}
        searchKeys={['name', 'nameEn', 'sku']}
        emptyIcon={FiPackage}
        emptyTitle={t('a5.empty.products.title')}
        emptyDescription={t('a5.empty.products.desc')}
        emptyActionLabel={t('admin.addProduct')}
        onEmptyAction={res.openCreate}
        pageSize={10}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        actions={(row) => (
          <RowActions
            onEdit={() => res.openEdit(row)}
            onDelete={() => res.setDeleting(row._id)}
            extra={
              <>
                <button
                  type="button"
                  onClick={() => window.open(`/product/${row.slug}`, '_blank', 'noopener')}
                  title={t('a3.preview')}
                  aria-label={t('a3.preview')}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-ink hover:text-ink"
                >
                  <FiExternalLink size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => duplicate.mutate(row._id)}
                  title={t('a3.duplicate')}
                  aria-label={t('a3.duplicate')}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-rose hover:text-rose"
                >
                  <FiCopy size={14} />
                </button>
              </>
            }
          />
        )}
      />

      {/* شريط الإجراءات الجماعية */}
      <BulkBar count={selected.length} onClear={() => setSelected([])}>
        <button type="button" className={bulkBtn} onClick={() => bulkAction('activate')}>{t('a3.bulkActivate')}</button>
        <button type="button" className={bulkBtn} onClick={() => bulkAction('deactivate')}>{t('a3.bulkDeactivate')}</button>
        <button type="button" className={bulkBtn} onClick={() => bulkAction('feature')}>{t('admin.featured')}</button>

        <select
          className={bulkSelect}
          defaultValue=""
          onChange={(e) => { if (e.target.value) { bulkAction('category', e.target.value); e.target.value = ''; } }}
          aria-label={t('a3.bulkCategory')}
        >
          <option value="">{t('a3.bulkCategory')}</option>
          {categories.map((c) => <option key={c._id} value={c._id}>{localized(c, lang)}</option>)}
        </select>

        <select
          className={bulkSelect}
          defaultValue=""
          onChange={(e) => { if (e.target.value) { bulkAction('brand', e.target.value); e.target.value = ''; } }}
          aria-label={t('a3.bulkBrand')}
        >
          <option value="">{t('a3.bulkBrand')}</option>
          {brands.map((b) => <option key={b._id} value={b._id}>{localized(b, lang)}</option>)}
        </select>

        <button
          type="button"
          className={bulkBtn}
          onClick={() => {
            const v = window.prompt(t('a3.bulkStock'));
            if (v !== null && v !== '') bulkAction('stock', Number(v));
          }}
        >
          {t('a3.bulkStock')}
        </button>

        <button
          type="button"
          className={bulkBtn}
          onClick={() => {
            const v = window.prompt(t('a3.bulkPrice'));
            if (v !== null && v !== '') bulkAction('price', Number(v));
          }}
        >
          {t('a3.bulkPrice')}
        </button>

        <button
          type="button"
          onClick={() => setBulkConfirm('delete')}
          className="rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-500"
        >
          <FiTrash2 size={12} className="me-1 inline" />
          {t('a3.bulkDelete')}
        </button>
      </BulkBar>

      {/* نموذج المنتج */}
      <Modal open={res.modalOpen} onClose={res.closeModal} title={res.editing ? t('admin.editProduct') : t('admin.addProduct')} size="lg">
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="p-0" noValidate>
          {/*
            تبويبات بدل نموذج واحد طويل.
            كان النموذج ~80 سطراً من الحقول في عمود واحد، فيضطر المدير
            للتمرير كثيراً ولا يعرف كم بقي. التبويبات تجعل الحقول
            المطلوبة فعلاً (تبويب "أساسي") أول ما يظهر، وكل ما عداها
            اختياري ومطويّ. أسرع منتج يمكن حفظه = تبويب واحد.
          */}
          <div className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-black/5 bg-white px-4 pt-3">
            {PRODUCT_TABS.map((tb) => {
              const hasError = Object.keys(errors).some((k) => FIELD_TAB[k] === tb.key);
              return (
                <button
                  key={tb.key}
                  type="button"
                  onClick={() => setFormTab(tb.key)}
                  className={cn(
                    'relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3.5 py-2.5 text-sm font-semibold transition',
                    formTab === tb.key
                      ? 'border-b-2 border-rose text-rose'
                      : 'border-b-2 border-transparent text-ink-muted hover:text-ink'
                  )}
                >
                  <tb.icon size={14} />
                  {t(tb.label)}
                  {hasError ? (
                    <span
                      aria-label={t('valid.fixRequired')}
                      className={cn(
                        'ms-0.5 h-1.5 w-1.5 rounded-full',
                        formTab === tb.key ? 'bg-rose' : 'bg-red-400'
                      )}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="space-y-4 p-6">
            {/* ---------- أساسي ---------- */}
            <div className={cn(formTab !== 'general' && 'hidden')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label={`${t('common.name')} (AR)`} required error={errors.name?.message} containerClassName="sm:col-span-2" {...register('name', { required: t('valid.required') })} />
                <Input label={`${t('common.name')} (EN)`} dir="ltr" {...register('nameEn')} />

                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <Combobox
                      label={t('common.category')}
                      hint={t('a6.categoryHint')}
                      placeholder={t('common.select')}
                      allowCreate={false}
                      options={categories.map((c) => ({ value: c._id, label: localized(c, lang) }))}
                      value={field.value || ''}
                      onChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  name="brand"
                  control={control}
                  render={({ field }) => (
                    <Combobox
                      label={t('common.brandLabel')}
                      hint={t('a6.brandHint')}
                      placeholder={t('a6.brandPlaceholder')}
                      options={brands.map((b) => ({ value: b._id, label: localized(b, lang) }))}
                      value={field.value || ''}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Input label={`${t('product.shortDesc')} (AR)`} {...register('shortDescription')} />
                <Input label={`${t('product.shortDesc')} (EN)`} dir="ltr" {...register('shortDescriptionEn')} />
              </div>
              <div className="mt-4 space-y-4">
                <Textarea label={`${t('common.description')} (AR)`} rows={4} required error={errors.description?.message} {...register('description', { required: t('valid.required') })} />
                <Textarea label={`${t('common.description')} (EN)`} rows={3} dir="ltr" {...register('descriptionEn')} />
              </div>

              <div className="mt-4 grid gap-4 rounded-xl bg-cream p-4 sm:grid-cols-2">
                <Select
                  label={t('a3.status')}
                  options={Object.entries(STATUS_META).map(([k, v]) => ({ value: k, label: v[lang] }))}
                  {...register('status')}
                />
                {status === 'scheduled' ? (
                  <Input label={t('a3.publishAt')} type="datetime-local" {...register('publishAt')} />
                ) : null}
              </div>
            </div>

            {/* ---------- التسعير ---------- */}
            <div className={cn(formTab !== 'pricing' && 'hidden')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label={t('common.price')} type="number" step="0.01" required error={errors.price?.message}
                  {...register('price', { required: t('valid.required'), min: { value: 0, message: t('valid.min', { n: 0 }) } })}
                />
                <Input label={t('a6.oldPrice')} type="number" step="0.01" hint={t('a6.oldPriceHint')} {...register('oldPrice')} />
                <Input label={t('a3.cost')} type="number" step="0.01" hint={t('a6.costHint')} {...register('cost')} />
              </div>
            </div>

            {/* ---------- المخزون ---------- */}
            <div className={cn(formTab !== 'inventory' && 'hidden')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label={t('admin.stock')} type="number" required error={errors.stock?.message}
                  {...register('stock', { required: t('valid.required'), min: { value: 0, message: t('valid.min', { n: 0 }) } })}
                />
              </div>
            </div>

            {/* ---------- الصور ---------- */}
            <div className={cn(formTab !== 'images' && 'hidden')}>
              <div className="space-y-4">
                <Controller
                  name="mainImage" control={control}
                  render={({ field }) => (
                    <ImagePicker label={t('common.image')} folder="products" value={field.value} onChange={field.onChange} />
                  )}
                />
                <Controller
                  name="images" control={control}
                  render={({ field }) => (
                    <GalleryPicker label={t('product.gallery')} folder="products" value={field.value} onChange={field.onChange} />
                  )}
                />
              </div>
            </div>

            {/* ---------- SEO ---------- */}
            <div className={cn(formTab !== 'seo' && 'hidden')}>
              <div className="grid gap-4">
                <Input label="SEO Title" hint={t('a6.seoTitleHint')} {...register('metaTitle')} />
                <Textarea label="SEO Description" rows={2} hint={t('a6.seoDescHint')} {...register('metaDescription')} />
                <Input label={t('product.tags')} hint={t('product.tagsHint')} {...register('tags')} />
              </div>
            </div>

            {/* ---------- متقدم ---------- */}
            <div className={cn(formTab !== 'advanced' && 'hidden')}>
              <div className="grid gap-2 rounded-xl bg-cream p-4 sm:grid-cols-2">
                <Checkbox label={t('admin.featured')} {...register('isFeatured')} />
                <Checkbox label={t('admin.bestSeller')} {...register('isBestSeller')} />
                <Checkbox label={t('admin.newArrival')} {...register('isNewArrival')} />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-muted">{t('a6.advancedHint')}</p>

              {/*
                الرابط والكود مخفيان افتراضياً — يُولَّدان تلقائياً ولا
                يحتاجهما صاحب المتجر إطلاقاً. متاحان لمن ينقل متجراً
                قائماً (روابط جوجل) أو يطابق أكواد المورّد.
              */}
              <AdvancedFields className="mt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label={t('a7.slugLabel')} dir="ltr" hint={t('a6.slugHint')} {...register('slug')} />
                  <Input label={t('admin.sku')} dir="ltr" hint={t('a6.skuHint')} placeholder={t('a6.skuPlaceholder')} {...register('sku')} />
                </div>
              </AdvancedFields>
            </div>
          </div>

          {/*
            شريط الحفظ ثابت أسفل النموذج: مع التبويبات لم يعد الزر في
            نهاية تمرير طويل، والمدير يستطيع الحفظ من أي تبويب.
          */}
          <div className="sticky bottom-0 flex items-center gap-3 border-t border-black/5 bg-white p-4">
            <Button type="submit" loading={res.saving} className="flex-1">{t('common.save')}</Button>
            <Button type="button" variant="outline" onClick={res.closeModal}>{t('common.cancel')}</Button>
          </div>
        </form>
      </Modal>

      {/* استيراد CSV */}
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title={t('a3.importProducts')} size="md">
        <div className="space-y-4 p-6">
          <Button
            variant="outline" size="sm" icon={FiDownload}
            onClick={() => download('/admin/products/import-template', 'products-template.csv')}
          >
            {t('a3.downloadTemplate')}
          </Button>

          <input
            ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              if (f.size > 5 * 1024 * 1024) { toast.error(t('common.error')); return; }
              setImportState({ csv: await f.text(), fileName: f.name, result: null });
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-black/15 p-8 text-center transition hover:border-rose hover:bg-blush/20"
          >
            <FiUpload size={22} className="text-ink-muted" />
            <span className="text-sm font-semibold text-ink">{importState.fileName || t('a3.chooseFile')}</span>
          </button>

          {importState.result ? (
            <div className="rounded-xl bg-cream p-4">
              <p className="mb-2 text-xs font-bold text-ink">
                {t('a3.importResult')} {importState.result.dryRun ? `(${t('a3.dryRun')})` : ''}
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-lg font-bold text-emerald-600">{importState.result.created}</p><p className="text-[11px] text-ink-muted">{t('a3.created')}</p></div>
                <div><p className="text-lg font-bold text-sky-600">{importState.result.updated}</p><p className="text-[11px] text-ink-muted">{t('a3.updated')}</p></div>
                <div><p className="text-lg font-bold text-amber-600">{importState.result.skipped}</p><p className="text-[11px] text-ink-muted">{t('a3.skipped')}</p></div>
              </div>
              {importState.result.errors?.length ? (
                <ul className="mt-3 max-h-32 space-y-1 overflow-auto border-t border-black/10 pt-2">
                  {importState.result.errors.slice(0, 20).map((er, i) => (
                    <li key={i} className="text-[11px] text-red-600">#{er.line}: {er.message}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="flex gap-3">
            <Button
              variant="outline" className="flex-1"
              disabled={!importState.csv}
              loading={runImport.isPending}
              onClick={() => runImport.mutate({ csv: importState.csv, dryRun: true })}
            >
              {t('a3.dryRun')}
            </Button>
            <Button
              className="flex-1"
              disabled={!importState.csv}
              loading={runImport.isPending}
              onClick={() => runImport.mutate({ csv: importState.csv, dryRun: false })}
            >
              {t('a3.importProducts')}
            </Button>
          </div>
        </div>
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

      <ConfirmDialog
        open={bulkConfirm === 'delete'}
        onClose={() => setBulkConfirm(null)}
        onConfirm={() => bulkAction('delete')}
        title={`${t('a3.bulkDelete')} (${selected.length})`}
        message={t('a3.bulkDeleteConfirm')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}
