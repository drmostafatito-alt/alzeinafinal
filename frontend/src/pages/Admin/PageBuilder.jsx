import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FiCopy, FiEdit2, FiExternalLink, FiEye, FiEyeOff, FiMonitor,
  FiPlus, FiRefreshCw, FiSave, FiSmartphone, FiTrash2
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import client from '@/api/client';
import { registerExtraTranslations, useI18n } from '@/i18n';
import { pageBuilderTranslations } from '@/i18n/pageBuilderTranslations';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Button from '@/components/ui/Button';
import SortableList from '@/components/admin/SortableList';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import Input, { Checkbox, Select, Textarea } from '@/components/forms/Input';
import ImagePicker from '@/components/admin/ImagePicker';
import EmptyState from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useCategories } from '@/hooks';
import { useConfig } from '@/config/ConfigProvider';
import { cn, localized } from '@/utils/helpers';

registerExtraTranslations('pageBuilder', pageBuilderTranslations);

/** أنواع البلوكات — كل نوع مع الحقول التي يحتاجها في تبويب المحتوى */
const TYPES = [
  { value: 'hero', content: ['hint'], hint: 'pb.heroHint' },
  { value: 'banner', content: ['image', 'title', 'subtitle', 'button', 'overlay'] },
  { value: 'text', content: ['title', 'subtitle', 'body'] },
  { value: 'imageText', content: ['image', 'title', 'subtitle', 'body', 'button', 'imagePosition'] },
  { value: 'products', content: ['source', 'category', 'limit', 'layout', 'columns', 'viewAllLink'] },
  { value: 'categories', content: ['title', 'subtitle'] },
  { value: 'features', content: ['title', 'subtitle', 'items'] },
  { value: 'offers', content: ['title', 'subtitle'] },
  { value: 'brands', content: ['title', 'subtitle'] },
  { value: 'testimonials', content: ['title', 'subtitle'] },
  { value: 'faq', content: ['title', 'subtitle', 'items'] },
  { value: 'cta', content: ['image', 'title', 'subtitle', 'button', 'overlay'] },
  { value: 'instagram', content: ['title', 'subtitle'] },
  { value: 'newsletter', content: ['hint'], hint: 'pb.newsletterHint' },
  { value: 'spacer', content: ['spacing', 'showDivider'] },
  { value: 'custom', content: ['html'], hint: 'pb.typeCustomHint' },
];

const SOURCES = [
  { value: 'featured', label: 'pb.sourceFeatured' },
  { value: 'bestSellers', label: 'pb.sourceBest' },
  { value: 'newArrivals', label: 'pb.sourceNew' },
  { value: 'onSale', label: 'pb.sourceSale' },
  { value: 'category', label: 'pb.sourceCategory' },
  { value: 'manual', label: 'pb.sourceManual' },
];

const EMPTY_FORM = {
  key: '', type: 'text', title: '', titleEn: '', subtitle: '', subtitleEn: '',
  body: '', bodyEn: '', html: '', image: '', mobileImage: '',
  buttonText: '', buttonTextEn: '', buttonUrl: '',
  background: '', textColor: '', overlayOpacity: 55, textAlign: 'start', imagePosition: 'start',
  paddingTop: '', paddingBottom: '', paddingTopMobile: '', paddingBottomMobile: '', radius: '',
  animation: 'fade-up',
  source: 'featured', category: '', limit: 10, layout: 'carousel',
  columnsDesktop: 4, columnsMobile: 2, viewAllLink: '/shop',
  items: [], products: [], spacing: 40, showDivider: false,
  status: 'published', isActive: true
};

const numberField = (v, fb = '') => (v === '' || v === undefined || v === null ? fb : Number(v));

/**
 * بانى الصفحة — نظام Sections/Blocks كامل.
 * إضافة / تعديل / تكرار / حذف / تفعيل / مسودة / إعادة ترتيب بالسحب،
 * ومعاينة حيّة Desktop/Mobile من المتجر الحقيقي (?preview=1 يظهر المسودات
 * للمدير فقط بعد التحقق من JWT على الخادم).
 */
export default function AdminPageBuilder() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const { reload: reloadConfig } = useConfig();
  const { categories } = useCategories();

  const [sections, setSections] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(null); // القسم المفتوح للتعديل (أو {} للإنشاء)
  const [form, setForm] = useState(EMPTY_FORM);
  const [tab, setTab] = useState('content');
  const [deleting, setDeleting] = useState(null);
  const [device, setDevice] = useState('desktop');
  const [previewKey, setPreviewKey] = useState(0);
  const [productSearch, setProductSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'home-sections'],
    queryFn: () => client.get('/admin/home-sections').then((r) => r.data?.data)
  });

  /* بحث منتجات للاختيار اليدوي */
  const { data: productsData } = useQuery({
    queryKey: ['admin', 'products', 'pick', productSearch],
    queryFn: () => client.get('/admin/products', { params: { q: productSearch || undefined, limit: 50 } }).then((r) => r.data?.data),
    enabled: form.source === 'manual'
  });
  const productOptions = useMemo(() => productsData?.products || [], [productsData]);

  useEffect(() => {
    if (data?.sections) {
      setSections(data.sections);
      setDirty(false);
    }
  }, [data]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'home-sections'] });
    qc.invalidateQueries({ queryKey: ['storefront', 'config'] });
    reloadConfig?.();
  };

  const bumpPreview = () => setPreviewKey((k) => k + 1);

  const saveOrder = useMutation({
    mutationFn: () =>
      client.put('/admin/home-sections/reorder', {
        items: sections.map((s, i) => ({ id: s._id || s.id, order: i + 1 }))
      }),
    onSuccess: () => { toast.success(t('admin.saved')); setDirty(false); invalidate(); bumpPreview(); },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const toggle = useMutation({
    mutationFn: (id) => client.patch(`/admin/home-sections/${id}/isActive`),
    onSuccess: () => { invalidate(); bumpPreview(); },
    onError: () => toast.error(t('common.error'))
  });

  const save = useMutation({
    mutationFn: (payload) =>
      editing?._id
        ? client.put(`/admin/home-sections/${editing._id}`, payload)
        : client.post('/admin/home-sections', payload),
    onSuccess: () => { toast.success(t('admin.saved')); setEditing(null); invalidate(); bumpPreview(); },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const remove = useMutation({
    mutationFn: (id) => client.delete(`/admin/home-sections/${id}`),
    onSuccess: () => { toast.success(t('admin.deleted')); setDeleting(null); invalidate(); bumpPreview(); },
    onError: () => toast.error(t('common.error'))
  });

  const duplicate = useMutation({
    mutationFn: (s) => {
      const copy = { ...s };
      delete copy._id; delete copy.id; delete copy.createdAt; delete copy.updatedAt;
      copy.key = `${s.key || s.type}-copy-${Date.now().toString(36)}`;
      copy.status = 'draft';
      return client.post('/admin/home-sections', copy);
    },
    onSuccess: () => { toast.success(t('a3.addSection')); invalidate(); bumpPreview(); },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  /* حقول النموذج لا تحمل null أبداً (صفوف D1 قد تحتوي titleEn=null) */
  const normalizeForm = (obj) => {
    const out = {};
    Object.entries(obj || {}).forEach(([k, v]) => {
      if (v === null || v === undefined) out[k] = '';
      else out[k] = v;
    });
    return out;
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm(normalizeForm({
      ...EMPTY_FORM, ...s,
      category: s.category?._id || s.category || '',
      limit: s.limit ?? 10,
      items: Array.isArray(s.items) ? s.items : [],
      products: Array.isArray(s.products) ? s.products : [],
      status: s.status || 'published'
    }));
    setTab('content');
  };
  const openCreate = (type) => {
    setEditing({});
    setForm({ ...EMPTY_FORM, key: `section-${Date.now().toString(36)}`, type });
    setTab('content');
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.key?.trim()) { toast.error(t('valid.required')); return; }
    const payload = {
      ...form,
      key: form.key.trim(),
      limit: numberField(form.limit, 10),
      columnsDesktop: numberField(form.columnsDesktop, 4),
      columnsMobile: numberField(form.columnsMobile, 2),
      spacing: numberField(form.spacing, 40),
      overlayOpacity: numberField(form.overlayOpacity, 55),
      paddingTop: numberField(form.paddingTop, 0),
      paddingBottom: numberField(form.paddingBottom, 0),
      paddingTopMobile: numberField(form.paddingTopMobile, 0),
      paddingBottomMobile: numberField(form.paddingBottomMobile, 0),
      category: form.source === 'category' ? form.category || null : null,
      items: Array.isArray(form.items) ? form.items : [],
      products: form.source === 'manual' ? (Array.isArray(form.products) ? form.products : []) : []
    };
    save.mutate(payload);
  };

  const reorder = (next) => { setSections(next); setDirty(true); };

  const typeMeta = (value) => TYPES.find((x) => x.value === value) || TYPES[1];
  const typeLabel = (value) => t(`pb.type.${value}`) !== `pb.type.${value}` ? t(`pb.type.${value}`) : value;
  const needs = (field) => typeMeta(form.type).content.includes(field);

  const updateItem = (idx, patch) => setForm((f) => ({
    ...f,
    items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it))
  }));
  const removeItem = (idx) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const addItem = () => setForm((f) => ({ ...f, items: [...(f.items || []), { title: '', titleEn: '', desc: '', descEn: '', icon: '', question: '', questionEn: '', answer: '', answerEn: '' }] }));

  const toggleProduct = (id) => setForm((f) => {
    const list = Array.isArray(f.products) ? f.products : [];
    return { ...f, products: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] };
  });

  const previewSrc = `/?preview=1&pb=${previewKey}`;

  return (
    <>
      <AdminPageHeader title={t('a3.pageBuilder')} subtitle={t('pb.blocks')}>
        <Button size="sm" variant="outline" icon={FiExternalLink} to="/" target="_blank">
          {t('pb.openPreview')}
        </Button>
        <Button size="sm" variant="outline" icon={FiPlus} onClick={() => openCreate('text')}>
          {t('pb.addBlock')}
        </Button>
        <Button size="sm" icon={FiSave} onClick={() => saveOrder.mutate()} loading={saveOrder.isPending} disabled={!dirty}>
          {t('a3.saveLayout')}
        </Button>
      </AdminPageHeader>

      {dirty ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          {t('a3.dragToReorder')} — {t('a3.saveLayout')}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* ===== قائمة البلوكات ===== */}
        <div className="min-w-0">
          {isLoading ? (
            <TableSkeleton rows={6} cols={3} />
          ) : sections.length === 0 ? (
            <EmptyState
              title={t('pb.noSections')}
              actionLabel={t('pb.addBlock')}
              onAction={() => openCreate('text')}
            />
          ) : (
            <SortableList items={sections} onReorder={reorder}>
              {(s, i) => {
                const isDraft = s.status === 'draft';
                return (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-en grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-cream text-xs font-bold text-ink-muted">
                      {i + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="clamp-1 text-sm font-bold text-ink">
                        {(lang === 'ar' ? s.title : s.titleEn) || typeLabel(s.type)}
                      </p>
                      <p className="clamp-1 text-[11px] text-ink-muted">
                        {typeLabel(s.type)} • {s.key}
                      </p>
                    </div>

                    <span className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold',
                      s.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-600'
                    )}>
                      {s.isActive ? t('a3.enabled') : t('a3.disabled')}
                    </span>
                    <span className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold',
                      isDraft ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
                    )}>
                      {isDraft ? t('pb.draft') : t('pb.published')}
                    </span>

                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggle.mutate(s._id)}
                        title={s.isActive ? t('a3.disabled') : t('a3.enabled')}
                        aria-label={s.isActive ? t('a3.disabled') : t('a3.enabled')}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-rose hover:text-rose"
                      >
                        {s.isActive ? <FiEye size={14} /> : <FiEyeOff size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        title={t('pb.editBlock')}
                        aria-label={t('pb.editBlock')}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-rose hover:text-rose"
                      >
                        <FiEdit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicate.mutate(s)}
                        title={t('pb.duplicate')}
                        aria-label={t('pb.duplicate')}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-ink hover:text-ink"
                      >
                        <FiCopy size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(s._id)}
                        title={t('common.delete')}
                        aria-label={t('common.delete')}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-red-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              }}
            </SortableList>
          )}

          <p className="mt-4 rounded-xl bg-cream p-3 text-[11px] leading-relaxed text-ink-muted">
            {t('pb.saveHint')}
          </p>
        </div>

        {/* ===== المعاينة الحيّة ===== */}
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t('pb.preview')}</p>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-black/10 p-0.5">
                <button
                  type="button"
                  onClick={() => setDevice('desktop')}
                  className={cn('grid h-8 w-8 place-items-center rounded-md transition', device === 'desktop' ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink')}
                  title={t('pb.desktop')}
                  aria-label={t('pb.desktop')}
                >
                  <FiMonitor size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setDevice('mobile')}
                  className={cn('grid h-8 w-8 place-items-center rounded-md transition', device === 'mobile' ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink')}
                  title={t('pb.mobile')}
                  aria-label={t('pb.mobile')}
                >
                  <FiSmartphone size={15} />
                </button>
              </div>
              <Button size="xs" variant="outline" icon={FiRefreshCw} onClick={bumpPreview}>
                {t('pb.refreshPreview')}
              </Button>
            </div>
          </div>

          <div className="flex justify-center rounded-2xl border border-black/10 bg-stone-100 p-3">
            <iframe
              key={previewKey}
              title="preview"
              src={previewSrc}
              className="h-[640px] w-full rounded-xl border border-black/10 bg-white"
              style={device === 'mobile' ? { maxWidth: 390 } : undefined}
            />
          </div>
        </div>
      </div>

      {/* ===== نافذة التعديل ===== */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?._id ? t('pb.editBlock') : t('pb.addBlock')}
        size="lg"
      >
        {editing ? (
          <form onSubmit={submit} className="flex max-h-[75vh] flex-col">
            <div className="flex gap-1 border-b border-black/10 px-6 pt-4">
              {[
                { key: 'content', label: t('pb.content') },
                { key: 'design', label: t('pb.design') },
                { key: 'layout', label: t('pb.layoutTab') },
                { key: 'visibility', label: t('pb.visibility') }
              ].map((x) => (
                <button
                  key={x.key}
                  type="button"
                  onClick={() => setTab(x.key)}
                  className={cn(
                    'rounded-t-lg px-4 py-2 text-xs font-bold transition',
                    tab === x.key ? 'bg-ink text-white' : 'text-ink-muted hover:bg-cream'
                  )}
                >
                  {x.label}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              {tab === 'content' ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Key" dir="ltr" required
                      value={form.key}
                      onChange={(e) => set({ key: e.target.value })}
                      disabled={Boolean(editing?._id)}
                    />
                    <Select
                      label={t('pb.blockType')}
                      value={form.type}
                      onChange={(e) => set({ type: e.target.value })}
                      options={TYPES.map((x) => ({ value: x.value, label: typeLabel(x.value) }))}
                    />
                  </div>

                  {typeMeta(form.type).hint ? (
                    <p className="rounded-xl bg-cream p-3 text-[11px] leading-relaxed text-ink-muted">
                      {t(typeMeta(form.type).hint)}
                    </p>
                  ) : null}

                  {needs('title') ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input label={`${t('common.title')} (AR)`} value={form.title} onChange={(e) => set({ title: e.target.value })} />
                      <Input label="Title (EN)" dir="ltr" value={form.titleEn} onChange={(e) => set({ titleEn: e.target.value })} />
                    </div>
                  ) : null}

                  {needs('subtitle') ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input label={`${t('common.subtitle')} (AR)`} value={form.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
                      <Input label="Subtitle (EN)" dir="ltr" value={form.subtitleEn} onChange={(e) => set({ subtitleEn: e.target.value })} />
                    </div>
                  ) : null}

                  {needs('body') ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Textarea label={`${t('pb.body')} (AR)`} rows={4} value={form.body} onChange={(e) => set({ body: e.target.value })} hint="HTML" />
                      <Textarea label="Text (EN)" rows={4} dir="ltr" value={form.bodyEn} onChange={(e) => set({ bodyEn: e.target.value })} hint="HTML" />
                    </div>
                  ) : null}

                  {needs('html') ? (
                    <Textarea label="HTML" rows={7} dir="ltr" value={form.html} onChange={(e) => set({ html: e.target.value })} hint={t('pb.typeCustomHint')} />
                  ) : null}

                  {needs('image') ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <ImagePicker label={`${t('pb.image')} (AR)`} value={form.image} onChange={(v) => set({ image: v })} folder="sections" aspect="aspect-video" previewSize="h-28 w-44" />
                      <ImagePicker label={t('pb.mobileImage')} value={form.mobileImage} onChange={(v) => set({ mobileImage: v })} folder="sections" aspect="aspect-video" previewSize="h-28 w-44" hint={t('common.optional')} />
                    </div>
                  ) : null}

                  {needs('button') ? (
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Input label={`${t('pb.buttonText')} (AR)`} value={form.buttonText} onChange={(e) => set({ buttonText: e.target.value })} />
                      <Input label="Button (EN)" dir="ltr" value={form.buttonTextEn} onChange={(e) => set({ buttonTextEn: e.target.value })} />
                      <Input label={t('pb.buttonUrl')} dir="ltr" placeholder="/shop" value={form.buttonUrl} onChange={(e) => set({ buttonUrl: e.target.value })} />
                    </div>
                  ) : null}

                  {needs('imagePosition') ? (
                    <Select
                      label={t('pb.imagePosition')}
                      value={form.imagePosition}
                      onChange={(e) => set({ imagePosition: e.target.value })}
                      options={[
                        { value: 'start', label: t('pb.imageStart') },
                        { value: 'end', label: t('pb.imageEnd') }
                      ]}
                    />
                  ) : null}

                  {needs('source') ? (
                    <div className="grid gap-4 rounded-xl bg-cream p-4 sm:grid-cols-2">
                      <Select
                        label={t('common.source')}
                        value={form.source}
                        onChange={(e) => set({ source: e.target.value })}
                        options={SOURCES.map((x) => ({ value: x.value, label: t(x.label) }))}
                      />
                      {form.source === 'category' ? (
                        <Select
                          label={t('pb.category')}
                          value={form.category}
                          onChange={(e) => set({ category: e.target.value })}
                          placeholder={t('common.select')}
                          options={categories.map((c) => ({ value: c._id, label: localized(c, lang) }))}
                        />
                      ) : null}
                      <Input label={t('pb.limit')} type="number" min="1" max="50" value={form.limit} onChange={(e) => set({ limit: e.target.value })} />
                      <Input label={t('pb.viewAllLink')} dir="ltr" value={form.viewAllLink} onChange={(e) => set({ viewAllLink: e.target.value })} />
                    </div>
                  ) : null}

                  {needs('layout') ? (
                    <Select
                      label={t('pb.layout')}
                      value={form.layout}
                      onChange={(e) => set({ layout: e.target.value })}
                      options={[
                        { value: 'carousel', label: t('pb.layoutCarousel') },
                        { value: 'grid', label: t('pb.layoutGrid') }
                      ]}
                    />
                  ) : null}

                  {needs('columns') ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Select
                        label={t('pb.columnsDesktop')}
                        value={String(form.columnsDesktop)}
                        onChange={(e) => set({ columnsDesktop: Number(e.target.value) })}
                        options={[2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
                      />
                      <Select
                        label={t('pb.columnsMobile')}
                        value={String(form.columnsMobile)}
                        onChange={(e) => set({ columnsMobile: Number(e.target.value) })}
                        options={[1, 2].map((n) => ({ value: String(n), label: String(n) }))}
                      />
                    </div>
                  ) : null}

                  {needs('overlay') ? (
                    <Input label={`${t('pb.overlay')} (%)`} type="number" min="0" max="95" value={form.overlayOpacity} onChange={(e) => set({ overlayOpacity: e.target.value })} />
                  ) : null}

                  {needs('spacing') ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input label={`${t('pb.spacing')} (px)`} type="number" min="0" max="200" value={form.spacing} onChange={(e) => set({ spacing: e.target.value })} />
                      <div className="flex items-end pb-2">
                        <Checkbox label={t('pb.showDivider')} checked={form.showDivider} onChange={(e) => set({ showDivider: e.target.checked })} />
                      </div>
                    </div>
                  ) : null}

                  {needs('items') ? (
                    <div className="rounded-xl bg-cream p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-bold text-ink">{t('pb.items')}</p>
                        <Button type="button" size="xs" variant="outline" icon={FiPlus} onClick={addItem}>
                          {t('pb.addItem')}
                        </Button>
                      </div>
                      <p className="mb-3 text-[11px] text-ink-muted">{t('pb.itemsHint')}</p>
                      <div className="space-y-3">
                        {(form.items || []).map((it, i) => (
                          <div key={i} className="rounded-lg border border-black/10 bg-white p-3">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <Input placeholder={`${t('common.title')} (AR)`} value={it.title || ''} onChange={(e) => updateItem(i, { title: e.target.value })} />
                              <Input placeholder="Title (EN)" dir="ltr" value={it.titleEn || ''} onChange={(e) => updateItem(i, { titleEn: e.target.value })} />
                              {form.type === 'faq' ? (
                                <>
                                  <Textarea rows={2} placeholder={`${t('pb.answer')} (AR)`} value={it.answer || ''} onChange={(e) => updateItem(i, { answer: e.target.value })} />
                                  <Textarea rows={2} placeholder="Answer (EN)" dir="ltr" value={it.answerEn || ''} onChange={(e) => updateItem(i, { answerEn: e.target.value })} />
                                </>
                              ) : (
                                <>
                                  <Textarea rows={2} placeholder={`${t('common.subtitle')} (AR)`} value={it.desc || ''} onChange={(e) => updateItem(i, { desc: e.target.value })} />
                                  <Textarea rows={2} placeholder="Description (EN)" dir="ltr" value={it.descEn || ''} onChange={(e) => updateItem(i, { descEn: e.target.value })} />
                                </>
                              )}
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <Input containerClassName="w-28" label={false} placeholder="✦" value={it.icon || ''} onChange={(e) => updateItem(i, { icon: e.target.value })} />
                              <button
                                type="button"
                                onClick={() => removeItem(i)}
                                className="grid h-8 w-8 place-items-center rounded-lg text-red-600 transition hover:bg-red-50"
                                aria-label={t('common.delete')}
                              >
                                <FiTrash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {form.source === 'manual' ? (
                    <div className="rounded-xl bg-cream p-4">
                      <p className="mb-2 text-sm font-bold text-ink">{t('pb.productsManual')}</p>
                      <Input
                        dir="ltr"
                        placeholder={t('pb.searchProduct')}
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                      />
                      <div className="mt-3 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                        {productOptions.map((p) => {
                          const on = (form.products || []).includes(p._id || p.id);
                          return (
                            <button
                              key={p._id || p.id}
                              type="button"
                              onClick={() => toggleProduct(p._id || p.id)}
                              className={cn(
                                'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                                on ? 'border-rose bg-rose text-white' : 'border-black/10 bg-white text-ink hover:border-rose hover:text-rose'
                              )}
                            >
                              {localized(p, lang)}
                            </button>
                          );
                        })}
                        {!productOptions.length ? (
                          <p className="text-xs text-ink-muted">{t('admin.noData')}</p>
                        ) : null}
                      </div>
                      {(form.products || []).length ? (
                        <p className="mt-2 text-[11px] text-ink-muted">
                          {t('a3.selected')}: {(form.products || []).length}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}

              {tab === 'design' ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ColorInput label={t('pb.background')} value={form.background} onChange={(v) => set({ background: v })} />
                    <ColorInput label={t('pb.textColor')} value={form.textColor} onChange={(v) => set({ textColor: v })} />
                    <Input label={t('pb.radius')} dir="ltr" placeholder="16px" value={form.radius} onChange={(e) => set({ radius: e.target.value })} />
                    <Select
                      label={t('pb.alignment')}
                      value={form.textAlign}
                      onChange={(e) => set({ textAlign: e.target.value })}
                      options={[
                        { value: 'start', label: t('pb.alignStart') },
                        { value: 'center', label: t('pb.alignCenter') },
                        { value: 'end', label: t('pb.alignEnd') }
                      ]}
                    />
                  </div>
                  <Select
                    label={t('pb.animation')}
                    value={form.animation}
                    onChange={(e) => set({ animation: e.target.value })}
                    options={[
                      { value: 'none', label: t('pb.animationNone') },
                      { value: 'fade-up', label: t('pb.animationFadeUp') }
                    ]}
                  />
                </>
              ) : null}

              {tab === 'layout' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label={t('pb.paddingTop')} type="number" min="0" max="300" value={form.paddingTop} onChange={(e) => set({ paddingTop: e.target.value })} />
                  <Input label={t('pb.paddingBottom')} type="number" min="0" max="300" value={form.paddingBottom} onChange={(e) => set({ paddingBottom: e.target.value })} />
                  <Input label={t('pb.paddingTopMobile')} type="number" min="0" max="300" value={form.paddingTopMobile} onChange={(e) => set({ paddingTopMobile: e.target.value })} />
                  <Input label={t('pb.paddingBottomMobile')} type="number" min="0" max="300" value={form.paddingBottomMobile} onChange={(e) => set({ paddingBottomMobile: e.target.value })} />
                </div>
              ) : null}

              {tab === 'visibility' ? (
                <div className="space-y-4">
                  <Checkbox
                    label={t('a3.enabled')}
                    checked={form.isActive}
                    onChange={(e) => set({ isActive: e.target.checked })}
                  />
                  <Select
                    label={t('pb.visibility')}
                    value={form.status}
                    onChange={(e) => set({ status: e.target.value })}
                    options={[
                      { value: 'published', label: t('pb.published') },
                      { value: 'draft', label: t('pb.draft') }
                    ]}
                  />
                  <p className="rounded-xl bg-cream p-3 text-[11px] leading-relaxed text-ink-muted">
                    {t('pb.saveHint')}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex gap-3 border-t border-black/10 p-4">
              <Button type="submit" className="flex-1" loading={save.isPending}>{t('common.save')}</Button>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting)}
        title={t('admin.confirmDelete')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}

/** حقل لون: منتقي + قيمة حرة مع زر مسح */
function ColorInput({ label, value, onChange }) {
  return (
    <div className="rounded-xl border border-black/10 p-3">
      <p className="mb-2 text-xs font-bold text-ink-muted">{label}</p>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(String(value || '')) ? value : '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-black/10 bg-white p-0.5"
          aria-label={label}
        />
        <Input containerClassName="flex-1" label={false} dir="ltr" placeholder="auto" value={value || ''} onChange={(e) => onChange(e.target.value)} />
        {value ? (
          <button type="button" onClick={() => onChange('')} className="text-xs font-bold text-red-500 hover:underline">
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}
