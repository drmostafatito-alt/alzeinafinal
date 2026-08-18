import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiAlertTriangle, FiCopy, FiEdit2, FiImage, FiSearch, FiTrash2, FiUploadCloud, FiZap } from 'react-icons/fi';
import { toast } from 'react-toastify';
import client from '@/api/client';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import SmartImage from '@/components/ui/SmartImage';
import Input from '@/components/forms/Input';
import Button from '@/components/ui/Button';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/helpers';
import { mediaUrl } from '@/utils/media';

const FOLDERS = [
  'all', 'products', 'categories', 'brands', 'banners',
  'logo', 'favicon', 'backgrounds', 'watermark', 'payments', 'proofs', 'general'
];
const MAX_MB = 5;

/** صفحة مكتبة الوسائط المستقلة — إدارة كاملة لكل صور الموقع */
export default function AdminMedia() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const inputRef = useRef(null);

  const [folder, setFolder] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [selected, setSelected] = useState([]);

  /* الصور غير المستخدمة */
  const [unusedOpen, setUnusedOpen] = useState(false);
  const [unusedPick, setUnusedPick] = useState([]);
  const [confirmUnused, setConfirmUnused] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'media', folder, search, page],
    queryFn: () =>
      client
        .get('/admin/media', { params: { folder, q: search || undefined, page, limit: 48 } })
        .then((r) => r.data?.data)
  });

  const items = data?.media || [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'media'] });

  const upload = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []).filter((f) => {
        if (!f.type.startsWith('image/')) {
          toast.error(`${f.name}: ${t('media.errType')}`);
          return false;
        }
        if (f.size > MAX_MB * 1024 * 1024) {
          toast.error(`${f.name}: ${t('media.errSize', { n: MAX_MB })}`);
          return false;
        }
        return true;
      });
      if (!files.length) return;

      setUploading(true);
      try {
        const form = new FormData();
        files.forEach((f) => form.append('files', f));
        form.append('folder', folder === 'all' ? 'general' : folder);
        const res = await client.post('/admin/media', form, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success(t('media.uploaded', { n: res.data?.data?.media?.length || files.length }));
        invalidate();
      } catch (err) {
        toast.error(err?.response?.data?.message || t('common.error'));
      } finally {
        setUploading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [folder, t]
  );

  const removeMutation = useMutation({
    mutationFn: (id) => client.delete(`/admin/media/${id}`),
    onSuccess: () => {
      toast.success(t('media.deleted'));
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const bulkDelete = useMutation({
    mutationFn: (ids) => client.post('/admin/media/bulk-delete', { ids }),
    onSuccess: () => {
      toast.success(t('media.deleted'));
      setSelected([]);
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => client.put(`/admin/media/${id}`, payload),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  /** فحص الصور غير المستخدمة — يعمل عند فتح النافذة فقط */
  const unusedQ = useQuery({
    queryKey: ['admin', 'media-unused'],
    queryFn: () => client.get('/admin/media/unused', { params: { limit: 200 } }).then((r) => r.data?.data),
    enabled: unusedOpen,
    staleTime: 0
  });

  const deleteUnused = useMutation({
    mutationFn: (ids) => client.post('/admin/media/delete-unused', { ids }),
    onSuccess: (r) => {
      toast.success(r.data?.message || t('admin.deleted'));
      setConfirmUnused(false);
      setUnusedPick([]);
      qc.invalidateQueries({ queryKey: ['admin', 'media-unused'] });
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const fmtBytes = (n) => {
    if (!n) return '0 KB';
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / 1048576).toFixed(1)} MB`;
  };

  const copyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(mediaUrl(url));
      toast.success(t('media.copied'));
    } catch {
      toast.info(mediaUrl(url));
    }
  };

  return (
    <>
      <AdminPageHeader title={t('media.library')} subtitle={`${data?.total ?? 0}`}>
        <Button
          variant="outline" size="sm" icon={FiZap}
          onClick={() => { setUnusedOpen(true); setUnusedPick([]); }}
        >
          {t('a3.scanUnused')}
        </Button>
        <Button onClick={() => inputRef.current?.click()} icon={FiUploadCloud} size="sm" loading={uploading}>
          {t('media.upload')}
        </Button>
      </AdminPageHeader>

      {/* أدوات البحث والفلترة */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <FiSearch className="pointer-events-none absolute inset-y-0 start-3 my-auto text-ink-muted" size={15} />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('media.search')}
            className="input ps-9"
            aria-label={t('media.search')}
          />
        </div>
        <select
          value={folder}
          onChange={(e) => {
            setFolder(e.target.value);
            setPage(1);
          }}
          className="input w-auto"
          aria-label={t('media.folder')}
        >
          {FOLDERS.map((f) => (
            <option key={f} value={f}>
              {t(`media.folder_${f}`) || f}
            </option>
          ))}
        </select>
        {selected.length ? (
          <Button variant="danger" size="sm" icon={FiTrash2} onClick={() => bulkDelete.mutate(selected)}>
            {t('media.selectedCount', { n: selected.length })}
          </Button>
        ) : null}
      </div>

      {/* السحب والإفلات */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          upload(e.dataTransfer.files);
        }}
        className={cn(
          'mb-5 rounded-2xl border-2 border-dashed p-6 text-center text-sm transition',
          dragOver ? 'border-rose bg-blush/60 text-ink' : 'border-black/10 text-ink-muted'
        )}
      >
        <FiUploadCloud className="mx-auto mb-2" size={26} />
        <p className="font-semibold">{t('media.dropHint')}</p>
        <p className="mt-1 text-[11px]">{t('media.limits', { n: MAX_MB })}</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
        multiple
        hidden
        onChange={(e) => {
          upload(e.target.files);
          e.target.value = '';
        }}
      />

      {isLoading ? (
        <div className="grid place-items-center py-20">
          <Spinner size={30} />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-black/5 bg-white py-20 text-ink-muted">
          <FiImage size={34} />
          <p className="text-sm">{t('media.empty')}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => {
            const isSel = selected.includes(item._id);
            return (
              <li
                key={item._id}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border bg-white shadow-soft transition',
                  isSel ? 'border-rose ring-2 ring-rose/30' : 'border-black/5'
                )}
              >
                <button
                  type="button"
                  onClick={() =>
                    setSelected((prev) =>
                      prev.includes(item._id) ? prev.filter((x) => x !== item._id) : [...prev, item._id]
                    )
                  }
                  className="block w-full bg-blush"
                  aria-pressed={isSel}
                >
                  <SmartImage
                    src={item.thumbnailUrl || item.url}
                    alt={item.alt || item.filename}
                    className="aspect-square w-full object-cover"
                  />
                </button>

                <div className="absolute end-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => copyUrl(item.url)}
                    className="grid h-7 w-7 place-items-center rounded-full bg-white/95 text-ink shadow-soft hover:bg-blush"
                    aria-label={t('media.copyUrl')}
                    title={t('media.copyUrl')}
                  >
                    <FiCopy size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(item)}
                    className="grid h-7 w-7 place-items-center rounded-full bg-white/95 text-ink shadow-soft hover:bg-blush"
                    aria-label={t('common.edit')}
                  >
                    <FiEdit2 size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(item._id)}
                    className="grid h-7 w-7 place-items-center rounded-full bg-white/95 text-red-600 shadow-soft hover:bg-red-50"
                    aria-label={t('common.delete')}
                  >
                    <FiTrash2 size={12} />
                  </button>
                </div>

                <div className="p-2">
                  <p className="clamp-1 text-[11px] font-semibold text-ink" title={item.filename}>
                    {item.alt || item.filename}
                  </p>
                  <p className="text-[10px] text-ink-muted">
                    {item.width && item.height ? `${item.width}×${item.height} · ` : ''}
                    {Math.round((item.size || 0) / 1024)} KB
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ترقيم الصفحات */}
      {data?.pages > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t('common.prev')}
          </Button>
          <span className="text-sm text-ink-muted">
            {page} / {data.pages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
            {t('common.next')}
          </Button>
        </div>
      ) : null}

      {/* تحرير بيانات الصورة */}
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={t('media.editImage')} size="sm">
        {editing ? (
          <form
            className="space-y-3 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              updateMutation.mutate({
                id: editing._id,
                payload: { alt: fd.get('alt'), altEn: fd.get('altEn'), title: fd.get('title') }
              });
            }}
          >
            <SmartImage
              src={editing.thumbnailUrl || editing.url}
              alt={editing.alt}
              className="mx-auto h-32 w-32 rounded-xl object-cover"
            />
            <Input label={t('media.alt')} name="alt" defaultValue={editing.alt} />
            <Input label={`${t('media.alt')} (EN)`} name="altEn" dir="ltr" defaultValue={editing.altEn} />
            <Input label={t('media.title')} name="title" defaultValue={editing.title} />
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1" loading={updateMutation.isPending}>
                {t('common.save')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      {/* نافذة الصور غير المستخدمة */}
      <Modal open={unusedOpen} onClose={() => setUnusedOpen(false)} title={t('a3.unusedMedia')} size="lg">
        <div className="space-y-4 p-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-amber-900">
              <FiAlertTriangle size={13} className="mt-0.5 shrink-0" />
              {t('a3.unusedNote')}
            </p>
          </div>

          {unusedQ.isLoading ? (
            <div className="grid place-items-center py-12"><Spinner /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  [t('media.library'), unusedQ.data?.summary?.totalMedia ?? 0, 'text-ink'],
                  [t('a3.unusedFound'), unusedQ.data?.summary?.unusedCount ?? 0, 'text-amber-600'],
                  [t('a3.reclaimable'), fmtBytes(unusedQ.data?.summary?.reclaimableBytes), 'text-ink'],
                  [t('a3.selected'), unusedPick.length, 'text-rose']
                ].map(([label, val, tone]) => (
                  <div key={label} className="rounded-xl bg-cream p-3">
                    <p className="text-[11px] text-ink-muted">{label}</p>
                    <p className={cn('mt-1 text-lg font-bold', tone)}>{val}</p>
                  </div>
                ))}
              </div>

              {(unusedQ.data?.unused || []).length === 0 ? (
                <p className="py-10 text-center text-sm text-ink-muted">{t('a3.noUnused')}</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm" variant="outline"
                      onClick={() => setUnusedPick((unusedQ.data.unused || []).map((m) => m._id))}
                    >
                      {t('a3.selectAll')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setUnusedPick([])}>
                      {t('a3.clearSelection')}
                    </Button>
                    <Button
                      size="sm" variant="danger" icon={FiTrash2}
                      disabled={!unusedPick.length}
                      onClick={() => setConfirmUnused(true)}
                    >
                      {t('a3.deleteUnused')} ({unusedPick.length})
                    </Button>
                  </div>

                  <ul className="grid max-h-[45vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
                    {(unusedQ.data.unused || []).map((m) => {
                      const picked = unusedPick.includes(m._id);
                      return (
                        <li key={m._id}>
                          <button
                            type="button"
                            onClick={() =>
                              setUnusedPick((v) => (picked ? v.filter((x) => x !== m._id) : [...v, m._id]))
                            }
                            className={cn(
                              'group relative w-full overflow-hidden rounded-xl border-2 transition',
                              picked ? 'border-rose ring-2 ring-rose/25' : 'border-black/10 hover:border-rose/50'
                            )}
                          >
                            <SmartImage
                              src={m.thumbnailUrl || m.url}
                              alt={m.alt || m.filename}
                              loading="lazy"
                              className="aspect-square w-full object-cover"
                            />
                            <span className="block truncate bg-white px-2 py-1.5 text-start text-[10px] text-ink-muted">
                              {m.filename}
                            </span>
                            {picked ? (
                              <span className="absolute end-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-rose text-[11px] font-bold text-white">
                                ✓
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmUnused}
        onClose={() => setConfirmUnused(false)}
        onConfirm={() => deleteUnused.mutate(unusedPick)}
        title={`${t('a3.deleteUnused')} (${unusedPick.length})`}
        message={t('a3.deleteUnusedConfirm')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        danger
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => removeMutation.mutate(deleting)}
        title={t('media.confirmDelete')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}
