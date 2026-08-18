import { FiEdit2, FiEye, FiTrash2 } from 'react-icons/fi';
import { useI18n } from '@/i18n';

export default function RowActions({ onView, onEdit, onDelete, extra }) {
  const { t } = useI18n();
  const btn =
    'grid h-8 w-8 place-items-center rounded-lg border border-black/10 text-ink-muted transition';

  return (
    <div className="inline-flex items-center gap-1.5">
      {extra}
      {onView ? (
        <button type="button" onClick={onView} className={`${btn} hover:border-ink hover:text-ink`} title={t('common.view')}>
          <FiEye size={14} />
        </button>
      ) : null}
      {onEdit ? (
        <button type="button" onClick={onEdit} className={`${btn} hover:border-rose hover:text-rose`} title={t('common.edit')}>
          <FiEdit2 size={14} />
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          className={`${btn} hover:border-red-500 hover:bg-red-50 hover:text-red-600`}
          title={t('common.delete')}
        >
          <FiTrash2 size={14} />
        </button>
      ) : null}
    </div>
  );
}
