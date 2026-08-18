import { useRef, useState } from 'react';
import { FiImage, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import { toast } from 'react-toastify';
import client from '@/api/client';
import MediaLibrary from './MediaLibrary';
import Spinner from '@/components/ui/Spinner';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/helpers';
import { mediaUrl, toStoredPath } from '@/utils/media';
import SmartImage from '@/components/ui/SmartImage';

const MAX_MB = 5;

/**
 * حقل صورة واحدة: رفع مباشر من الجهاز، أو اختيار من مكتبة الوسائط،
 * أو سحب وإفلات. يحلّ محل حقول "رابط الصورة" النصية في كل لوحة الإدارة.
 *
 * @param {string}   value     المسار المحفوظ (/uploads/...)
 * @param {Function} onChange  تُستدعى بالمسار الجديد (نسبي للتخزين)
 * @param {string}   folder    مجلد الوجهة داخل المكتبة
 */
export default function ImagePicker({
  value,
  onChange,
  label,
  folder = 'general',
  hint,
  aspect = 'aspect-square',
  className,
  previewSize = 'h-28 w-28'
}) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const uploadFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('media.errType'));
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(t('media.errSize', { n: MAX_MB }));
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append('files', file);
      form.append('folder', folder);
      const res = await client.post('/admin/media', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const created = res.data?.data?.media?.[0];
      if (created?.url) {
        onChange(toStoredPath(created.url));
        toast.success(t('media.uploaded', { n: 1 }));
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || t('common.error'));
    } finally {
      setUploading(false);
    }
  };

  const preview = mediaUrl(value);

  return (
    <div className={className}>
      {label ? <span className="label">{label}</span> : null}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          uploadFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          'flex items-center gap-3 rounded-xl border-2 border-dashed p-3 transition',
          dragOver ? 'border-rose bg-blush/50' : 'border-black/10'
        )}
      >
        {/* المعاينة */}
        <div className={cn('shrink-0 overflow-hidden rounded-lg bg-blush', previewSize, aspect)}>
          {preview ? (
            <SmartImage src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-ink-muted">
              <FiImage size={20} />
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="btn btn-sm bg-ink text-white hover:bg-rose disabled:opacity-60"
            >
              {uploading ? <Spinner size={13} /> : <FiUploadCloud size={13} />}
              {value ? t('media.replace') : t('media.uploadFromDevice')}
            </button>
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="btn-outline btn-sm"
            >
              <FiImage size={13} /> {t('media.chooseFromLibrary')}
            </button>
            {value ? (
              <button
                type="button"
                onClick={() => onChange('')}
                className="btn btn-sm text-red-600 hover:bg-red-50"
                aria-label={t('common.delete')}
              >
                <FiTrash2 size={13} />
              </button>
            ) : null}
          </div>
          <p className="text-[11px] text-ink-muted">{hint || t('media.limits', { n: MAX_MB })}</p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
          hidden
          onChange={(e) => {
            uploadFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      <MediaLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        folder={folder}
        onSelect={(url) => onChange(toStoredPath(url))}
      />
    </div>
  );
}

/**
 * معرض صور متعدد (معرض المنتج): رفع دفعة واحدة + ترتيب بالسحب + حذف.
 */
export function GalleryPicker({ value = [], onChange, label, folder = 'products', max = 10 }) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);

  const images = Array.isArray(value) ? value : [];

  const addUrls = (urls) => {
    const next = [...images];
    urls.forEach((u) => {
      const p = toStoredPath(u);
      if (p && !next.includes(p) && next.length < max) next.push(p);
    });
    onChange(next);
  };

  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    if (images.length + files.length > max) {
      toast.error(t('media.maxImages', { n: max }));
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      files.forEach((f) => form.append('files', f));
      form.append('folder', folder);
      const res = await client.post('/admin/media', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      addUrls((res.data?.data?.media || []).map((m) => m.url));
      toast.success(t('media.uploaded', { n: files.length }));
    } catch (err) {
      toast.error(err?.response?.data?.message || t('common.error'));
    } finally {
      setUploading(false);
    }
  };

  /** إعادة الترتيب بالسحب — الصورة الأولى هي الرئيسية */
  const reorder = (to) => {
    if (dragIndex === null || dragIndex === to) return;
    const next = [...images];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(to, 0, moved);
    onChange(next);
    setDragIndex(null);
  };

  return (
    <div>
      {label ? <span className="label">{label}</span> : null}

      <div className="rounded-xl border-2 border-dashed border-black/10 p-3">
        <ul className="mb-3 flex flex-wrap gap-2">
          {images.map((img, i) => (
            <li
              key={`${img}-${i}`}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => reorder(i)}
              className="group relative cursor-move"
            >
              <SmartImage
                src={img}
                alt=""
                className="h-20 w-20 rounded-lg border border-black/5 object-cover"
              />
              {i === 0 ? (
                <span className="absolute inset-x-0 bottom-0 rounded-b-lg bg-ink/75 py-0.5 text-center text-[9px] font-bold text-white">
                  {t('media.main')}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => onChange(images.filter((_, idx) => idx !== i))}
                className="absolute -end-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-white text-red-600 shadow-soft opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                aria-label={t('common.delete')}
              >
                <FiTrash2 size={11} />
              </button>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || images.length >= max}
            className="btn btn-sm bg-ink text-white hover:bg-rose disabled:opacity-50"
          >
            {uploading ? <Spinner size={13} /> : <FiUploadCloud size={13} />} {t('media.addImages')}
          </button>
          <button type="button" onClick={() => setLibraryOpen(true)} className="btn-outline btn-sm">
            <FiImage size={13} /> {t('media.chooseFromLibrary')}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-ink-muted">
          {t('media.galleryHint', { n: max })} · {images.length}/{max}
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          multiple
          hidden
          onChange={(e) => {
            uploadFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <MediaLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        folder={folder}
        multiple
        onSelect={(urls) => addUrls(Array.isArray(urls) ? urls : [urls])}
      />
    </div>
  );
}
