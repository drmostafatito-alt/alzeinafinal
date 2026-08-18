import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FiCheck, FiEdit2, FiImage, FiSearch, FiTrash2, FiUploadCloud, FiX
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import client from '@/api/client';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/helpers';
import { mediaUrl } from '@/utils/media';

const FOLDERS = [
  'all', 'products', 'categories', 'brands', 'banners',
  'logo', 'favicon', 'backgrounds', 'watermark', 'payments', 'general'
];

const MAX_MB = 5;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml';

/** تحقق من الملف قبل إرساله للخادم — رسائل فورية بدل انتظار الرفض */
const validateFiles = (files, t) => {
  const valid = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      toast.error(`${file.name}: ${t('media.errType')}`);
      continue;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`${file.name}: ${t('media.errSize', { n: MAX_MB })}`);
      continue;
    }
    valid.push(file);
  }
  return valid;
};

/**
 * مكتبة الوسائط: تصفح + بحث + رفع بالسحب والإفلات + تعديل + حذف + اختيار.
 * تُستخدم كنافذة منبثقة من أي حقل صورة في لوحة الإدارة.
 */
export default function MediaLibrary({ open, onClose, onSelect, multiple = false, folder = 'general' }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const inputRef = useRef(null);

  const [activeFolder, setActiveFolder] = useState(folder === 'general' ? 'all' : folder);
  const [search, setSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [editing, setEditing] = useState(null);
  /* حوار حذف داخل الواجهة بدل window.confirm — يحترم الثيم واتجاه RTL */
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (open) {
      setSelected([]);
      setActiveFolder(folder === 'general' ? 'all' : folder);
    }
  }, [open, folder]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'media', activeFolder, search],
    queryFn: () =>
      client
        .get('/admin/media', { params: { folder: activeFolder, q: search || undefined, limit: 60 } })
        .then((r) => r.data?.data),
    enabled: open
  });

  const items = data?.media || [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'media'] });

  const upload = useCallback(
    async (fileList) => {
      const files = validateFiles(Array.from(fileList || []), t);
      if (!files.length) return;

      setUploading(true);
      try {
        const form = new FormData();
        files.forEach((f) => form.append('files', f));
        form.append('folder', activeFolder === 'all' ? folder : activeFolder);

        const res = await client.post('/admin/media', form, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        const created = res.data?.data?.media || [];
        toast.success(t('media.uploaded', { n: created.length }));
        invalidate();

        // رفع صورة واحدة من حقل مفرد ⇒ نختارها مباشرة
        if (!multiple && created.length === 1) {
          onSelect?.(mediaUrl(created[0].url), created[0]);
          onClose?.();
        }
      } catch (err) {
        toast.error(err?.response?.data?.message || t('common.error'));
      } finally {
        setUploading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeFolder, folder, multiple, onSelect, onClose, t]
  );

  const removeMutation = useMutation({
    mutationFn: (id) => client.delete(`/admin/media/${id}`),
    onSuccess: () => {
      toast.success(t('media.deleted'));
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

  const toggleSelect = (item) => {
    const url = mediaUrl(item.url);
    if (multiple) {
      setSelected((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]));
    } else {
      onSelect?.(url, item);
      onClose?.();
    }
  };

  const confirmMultiple = () => {
    onSelect?.(selected);
    onClose?.();
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    upload(e.dataTransfer.files);
  };

  return (
    <Modal open={open} onClose={onClose} title={t('media.library')} size="xl">
      <div className="flex flex-col gap-4 p-5">
        {/* شريط الأدوات */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <FiSearch className="pointer-events-none absolute inset-y-0 start-3 my-auto text-ink-muted" size={15} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('media.search')}
              className="input ps-9"
              aria-label={t('media.search')}
            />
          </div>
          <select
            value={activeFolder}
            onChange={(e) => setActiveFolder(e.target.value)}
            className="input w-auto"
            aria-label={t('media.folder')}
          >
            {FOLDERS.map((f) => (
              <option key={f} value={f}>
                {t(`media.folder_${f}`) || f}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="btn bg-ink text-white hover:bg-rose disabled:opacity-60"
          >
            {uploading ? <Spinner size={16} /> : <FiUploadCloud size={16} />}
            {t('media.upload')}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              upload(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {/* منطقة السحب والإفلات */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            'rounded-2xl border-2 border-dashed p-4 text-center text-sm transition',
            dragOver ? 'border-rose bg-blush/50 text-ink' : 'border-black/10 text-ink-muted'
          )}
        >
          <FiUploadCloud className="mx-auto mb-1" size={22} />
          {t('media.dropHint')}
          <p className="mt-1 text-[11px]">{t('media.limits', { n: MAX_MB })}</p>
        </div>

        {/* الشبكة */}
        {isLoading ? (
          <div className="grid place-items-center py-12">
            <Spinner size={28} />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-ink-muted">
            <FiImage size={30} />
            <p className="text-sm">{t('media.empty')}</p>
          </div>
        ) : (
          <ul className="grid max-h-[45vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4 lg:grid-cols-6">
            {items.map((item) => {
              const url = mediaUrl(item.url);
              const isSel = selected.includes(url);
              return (
                <li key={item._id} className="group relative">
                  <button
                    type="button"
                    onClick={() => toggleSelect(item)}
                    className={cn(
                      'block w-full overflow-hidden rounded-xl border-2 bg-blush transition',
                      isSel ? 'border-rose ring-2 ring-rose/30' : 'border-transparent hover:border-rose/50'
                    )}
                    title={item.alt || item.filename}
                  >
                    <img
                      src={mediaUrl(item.thumbnailUrl || item.url)}
                      alt={item.alt || item.filename}
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                  </button>

                  {isSel ? (
                    <span className="pointer-events-none absolute start-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-rose text-white">
                      <FiCheck size={13} />
                    </span>
                  ) : null}

                  <div className="absolute end-1.5 top-1.5 flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
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
                      onClick={() => setDeleting(item)}
                      className="grid h-7 w-7 place-items-center rounded-full bg-white/95 text-red-600 shadow-soft hover:bg-red-50"
                      aria-label={t('common.delete')}
                    >
                      <FiTrash2 size={12} />
                    </button>
                  </div>

                  <p className="mt-1 truncate text-[10px] text-ink-muted" title={item.filename}>
                    {item.alt || item.filename}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        {multiple ? (
          <div className="flex items-center justify-between gap-3 border-t border-black/5 pt-3">
            <span className="text-xs text-ink-muted">{t('media.selectedCount', { n: selected.length })}</span>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-outline btn-sm">
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={confirmMultiple}
                disabled={!selected.length}
                className="btn btn-sm bg-ink text-white hover:bg-rose disabled:opacity-50"
              >
                {t('media.useSelected')}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* تحرير بيانات الصورة */}
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={t('media.editImage')} size="sm">
        {editing ? (
          <form
            className="space-y-3 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              updateMutation.mutate({
                id: editing._id,
                payload: {
                  alt: fd.get('alt'),
                  altEn: fd.get('altEn'),
                  title: fd.get('title')
                }
              });
            }}
          >
            <img
              src={mediaUrl(editing.thumbnailUrl || editing.url)}
              alt={editing.alt}
              className="mx-auto h-28 w-28 rounded-xl object-cover"
            />
            <div>
              <label className="label" htmlFor="m-alt">{t('media.alt')}</label>
              <input id="m-alt" name="alt" defaultValue={editing.alt} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="m-altEn">{t('media.alt')} (EN)</label>
              <input id="m-altEn" name="altEn" dir="ltr" defaultValue={editing.altEn} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="m-title">{t('media.title')}</label>
              <input id="m-title" name="title" defaultValue={editing.title} className="input" />
            </div>
            <p className="text-[11px] text-ink-muted">
              {editing.width}×{editing.height} · {Math.round((editing.size || 0) / 1024)} KB
            </p>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="btn btn-sm flex-1 bg-ink text-white hover:bg-rose">
                {t('common.save')}
              </button>
              <button type="button" onClick={() => setEditing(null)} className="btn-outline btn-sm">
                {t('common.cancel')}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      {/*
        تأكيد الحذف داخل الواجهة: window.confirm كان يكسر الاتساق
        البصري، ولا يدعم RTL ولا ألوان الثيم، ولا يمكن تنسيقه.
      */}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => removeMutation.mutate(deleting._id)}
        title={t('media.confirmDelete')}
        message={deleting?.alt || deleting?.filename}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        danger
      />
    </Modal>
  );
}
