import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiMessageSquare, FiInstagram, FiImage, FiZap, FiPlus, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import DataTable from '@/components/admin/DataTable';
import Input, { Checkbox, Select, Textarea } from '@/components/forms/Input';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import RowActions from '@/components/admin/RowActions';
import ImagePicker from '@/components/admin/ImagePicker';
import { TableSkeleton } from '@/components/ui/Skeleton';
import client from '@/api/client';
import { registerExtraTranslations, useI18n } from '@/i18n';
import { pageBuilderTranslations } from '@/i18n/pageBuilderTranslations';
import { cn, localized } from '@/utils/helpers';
import SmartImage from '@/components/ui/SmartImage';

registerExtraTranslations('pageBuilder', pageBuilderTranslations);

/**
 * مركز محتوى المتجر: آراء العملاء، إنستجرام، النوافذ المنبثقة، عروض الفلاش.
 * هذه العناصر تظهر للعميل في المتجر، وتُدار هنا بالكامل (D1 عبر واجهات
 * الموارد العامة) بدل كتابتها في الكود.
 */

const TABS = [
  { key: 'testimonials', icon: FiMessageSquare, label: 'pb.type.testimonials' },
  { key: 'instagram', icon: FiInstagram, label: 'pb.type.instagram' },
  { key: 'popups', icon: FiImage, label: 'admin.popups' },
  { key: 'flash', icon: FiZap, label: 'a3.flashSales' },
];

const res = (path) => ({
  list: () => client.get(`/admin/${path}`).then((r) => ({ data: r.data.data })),
  create: (payload) => client.post(`/admin/${path}`, payload).then((r) => ({ data: r.data.data })),
  update: (id, payload) => client.put(`/admin/${path}/${id}`, payload).then((r) => ({ data: r.data.data })),
  remove: (id) => client.delete(`/admin/${path}/${id}`).then((r) => ({ data: r.data.data }))
});

function useContentResource(tab) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const key = ['admin', 'content', tab];
  const service = res(tab);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const query = useQuery({ queryKey: key, queryFn: service.list });
  const items = query.data?.data?.items || [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: [tab] });
    qc.invalidateQueries({ queryKey: ['storefront', 'config'] });
  };

  const createM = useMutation({
    mutationFn: service.create,
    onSuccess: () => { toast.success(t('admin.saved')); setModalOpen(false); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });
  const updateM = useMutation({
    mutationFn: ({ id, payload }) => service.update(id, payload),
    onSuccess: () => { toast.success(t('admin.saved')); setModalOpen(false); setEditing(null); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });
  const deleteM = useMutation({
    mutationFn: service.remove,
    onSuccess: () => { toast.success(t('admin.deleted')); setDeleting(null); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  return { items, isLoading: query.isLoading, modalOpen, setModalOpen, editing, setEditing, deleting, setDeleting,
    save: (payload) => (editing?._id ? updateM.mutate({ id: editing._id, payload }) : createM.mutate(payload)),
    saving: createM.isPending || updateM.isPending,
    confirmDelete: () => deleteM.mutate(deleting) };
}

export default function AdminContent() {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState('testimonials');
  const r = useContentResource(tab);
  const [form, setForm] = useState({});

  useEffect(() => {
    setForm({});
  }, [tab, r.modalOpen]);

  const openEdit = (item) => {
    r.setEditing(item);
    const clean = {};
    Object.entries(item || {}).forEach(([k, v]) => { clean[k] = v === null || v === undefined ? '' : v; });
    setForm(clean);
    r.setModalOpen(true);
  };
  const openCreate = () => { r.setEditing(null); setForm({ isActive: true, rating: 5 }); r.setModalOpen(true); };
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const columns = {
    testimonials: [
      { key: 'name', header: t('common.name'), render: (x) => (
        <div className="flex items-center gap-3">
          {x.avatar ? <SmartImage src={x.avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : null}
          <div className="min-w-0">
            <p className="clamp-1 text-sm font-semibold text-ink">{localized(x, lang)}</p>
            <p className="clamp-1 text-xs text-ink-muted">{localized(x, lang, 'content')}</p>
          </div>
        </div>
      ) },
      { key: 'rating', header: '★', render: (x) => <span className="text-sm font-bold text-ink">{x.rating}</span>, hideOnMobile: true },
      { key: 'isActive', header: t('common.status'), render: (x) => <Badge variant={x.isActive ? 'success' : 'neutral'}>{x.isActive ? t('common.active') : t('common.inactive')}</Badge> }
    ],
    instagram: [
      { key: 'image', header: t('common.image'), render: (x) => <SmartImage src={x.image} alt="" className="h-12 w-12 rounded-lg object-cover" /> },
      { key: 'caption', header: t('common.description'), render: (x) => <span className="clamp-1 text-xs text-ink-muted">{x.caption}</span> },
      { key: 'isActive', header: t('common.status'), render: (x) => <Badge variant={x.isActive ? 'success' : 'neutral'}>{x.isActive ? t('common.active') : t('common.inactive')}</Badge> }
    ],
    popups: [
      { key: 'title', header: t('common.name'), render: (x) => (
        <div className="min-w-0">
          <p className="clamp-1 text-sm font-semibold text-ink">{x.title}</p>
          <p className="clamp-1 text-xs text-ink-muted">{x.showOn || 'all'}</p>
        </div>
      ) },
      { key: 'image', header: t('common.image'), render: (x) => x.image ? <SmartImage src={x.image} alt="" className="h-9 w-14 rounded object-cover" /> : '—' },
      { key: 'isActive', header: t('common.status'), render: (x) => <Badge variant={x.isActive ? 'success' : 'neutral'}>{x.isActive ? t('common.active') : t('common.inactive')}</Badge> }
    ],
    flash: [
      { key: 'name', header: t('common.name'), render: (x) => (
        <div className="min-w-0">
          <p className="clamp-1 text-sm font-semibold text-ink">{localized(x, lang)}</p>
          <p className="font-en text-[11px] text-ink-muted">{x.startsAt?.slice(0, 10)} → {x.endsAt?.slice(0, 10)}</p>
        </div>
      ) },
      { key: 'products', header: t('admin.products'), render: (x) => <span className="text-xs text-ink-muted">{(x.products || []).length}</span>, hideOnMobile: true },
      { key: 'isActive', header: t('common.status'), render: (x) => <Badge variant={x.isActive ? 'success' : 'neutral'}>{x.isActive ? t('common.active') : t('common.inactive')}</Badge> }
    ]
  }[tab];

  const submit = (e) => {
    e.preventDefault();
    const payload = { ...form };
    if (tab === 'flash') {
      payload.products = Array.isArray(payload.products) ? payload.products : [];
      payload.showCountdown = payload.showCountdown !== false;
    }
    r.save(payload);
  };

  return (
    <>
      <AdminPageHeader title={t('c.center')} subtitle={TABS.find((x) => x.key === tab)?.label}>
        <Button onClick={openCreate} icon={FiPlus} size="sm">{t('common.add')}</Button>
      </AdminPageHeader>

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition',
              tab === key ? 'border-ink bg-ink text-white' : 'border-black/10 bg-white text-ink-muted hover:border-rose hover:text-rose'
            )}
          >
            <Icon size={14} />
            {t(label)}
          </button>
        ))}
      </div>

      {r.isLoading ? (
        <TableSkeleton rows={5} cols={3} />
      ) : (
        <DataTable
          columns={columns}
          data={r.items}
          loading={r.isLoading}
          actions={(row) => (
            <RowActions onEdit={() => openEdit(row)} onDelete={() => r.setDeleting(row._id)} />
          )}
        />
      )}

      <Modal open={r.modalOpen} onClose={() => r.setModalOpen(false)} title={TABS.find((x) => x.key === tab)?.label} size="md">
        <form onSubmit={submit} className="space-y-4 p-6">
          {tab === 'testimonials' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label={`${t('common.name')} (AR)`} required value={form.name || ''} onChange={(e) => set({ name: e.target.value })} />
                <Input label="Name (EN)" dir="ltr" value={form.nameEn || ''} onChange={(e) => set({ nameEn: e.target.value })} />
              </div>
              <Select label={t('c.rating')} value={String(form.rating ?? 5)} onChange={(e) => set({ rating: Number(e.target.value) })}
                options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: '★'.repeat(n) }))} />
              <Textarea label={`${t('common.description')} (AR)`} required rows={3} value={form.content || ''} onChange={(e) => set({ content: e.target.value })} />
              <Textarea label="Content (EN)" rows={3} dir="ltr" value={form.contentEn || ''} onChange={(e) => set({ contentEn: e.target.value })} />
              <ImagePicker label={t('c.avatar')} value={form.avatar || ''} onChange={(v) => set({ avatar: v })} folder="avatars" previewSize="h-20 w-20" />
            </>
          ) : null}

          {tab === 'instagram' ? (
            <>
              <ImagePicker label={t('common.image')} required value={form.image || ''} onChange={(v) => set({ image: v })} folder="instagram" aspect="aspect-square" previewSize="h-28 w-28" />
              <Textarea label={t('common.description')} rows={2} value={form.caption || ''} onChange={(e) => set({ caption: e.target.value })} />
              <Input label="Link" dir="ltr" value={form.link || ''} onChange={(e) => set({ link: e.target.value })} />
            </>
          ) : null}

          {tab === 'popups' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label={`${t('common.title')} (AR)`} required value={form.title || ''} onChange={(e) => set({ title: e.target.value })} />
                <Input label="Title (EN)" dir="ltr" value={form.titleEn || ''} onChange={(e) => set({ titleEn: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Textarea label={`${t('common.description')} (AR)`} rows={3} value={form.body || ''} onChange={(e) => set({ body: e.target.value })} />
                <Textarea label="Body (EN)" rows={3} dir="ltr" value={form.bodyEn || ''} onChange={(e) => set({ bodyEn: e.target.value })} />
              </div>
              <ImagePicker label={t('common.image')} value={form.image || ''} onChange={(v) => set({ image: v })} folder="popups" aspect="aspect-video" previewSize="h-24 w-40" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label={t('pb.buttonText')} value={form.buttonText || ''} onChange={(e) => set({ buttonText: e.target.value })} />
                <Input label="Link" dir="ltr" value={form.link || ''} onChange={(e) => set({ link: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label={t('pb.visibility')} value={form.showOn || 'all'} onChange={(e) => set({ showOn: e.target.value })}
                  options={[{ value: 'all', label: t('c.all') }, { value: 'home', label: t('nav.home') }, { value: 'shop', label: t('nav.shop') }, { value: 'product', label: t('c.productPage') }]} />
                <Input label={t('c.delay')} type="number" min="0" max="60" value={form.delaySeconds ?? 3} onChange={(e) => set({ delaySeconds: Number(e.target.value) })} />
              </div>
            </>
          ) : null}

          {tab === 'flash' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label={`${t('common.name')} (AR)`} required value={form.name || ''} onChange={(e) => set({ name: e.target.value })} />
                <Input label="Name (EN)" dir="ltr" value={form.nameEn || ''} onChange={(e) => set({ nameEn: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label={`${t('admin.startDate')} (ISO)`} dir="ltr" type="datetime-local" value={form.startsAt?.slice(0, 16) || ''} onChange={(e) => set({ startsAt: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
                <Input label={`${t('admin.endDate')} (ISO)`} dir="ltr" type="datetime-local" value={form.endsAt?.slice(0, 16) || ''} onChange={(e) => set({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
              </div>
              <Checkbox label={t('c.showCountdown')} checked={form.showCountdown !== false} onChange={(e) => set({ showCountdown: e.target.checked })} />
            </>
          ) : null}

          <div className="flex gap-6 pt-1">
            <Checkbox label={t('common.active')} checked={form.isActive !== false} onChange={(e) => set({ isActive: e.target.checked })} />
          </div>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" loading={r.saving}>{t('common.save')}</Button>
            <Button type="button" variant="outline" onClick={() => r.setModalOpen(false)}>{t('common.cancel')}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(r.deleting)}
        onClose={() => r.setDeleting(null)}
        onConfirm={r.confirmDelete}
        title={t('admin.confirmDelete')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}
