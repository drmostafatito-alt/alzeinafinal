import { useCallback, useRef, useState } from 'react';
import { FiChevronDown, FiChevronUp, FiMove } from 'react-icons/fi';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/helpers';

/**
 * قائمة قابلة لإعادة الترتيب بالسحب والإفلات — بلا أي مكتبة خارجية.
 *
 * إمكانية الوصول: السحب وحده لا يكفي لمستخدمي لوحة المفاتيح،
 * لذا يوفّر كل عنصر زرَّي "لأعلى/لأسفل" يعملان بالكيبورد أيضاً.
 *
 * @param {Array}   items    العناصر (يجب أن تحمل _id)
 * @param {Function} onReorder تُستدعى بالترتيب الجديد كاملاً
 * @param {Function} children (item, index) => ReactNode
 */
export default function SortableList({ items = [], onReorder, children, disabled = false, className }) {
  const { t } = useI18n();
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const listRef = useRef(null);

  const move = useCallback(
    (from, to) => {
      if (from === to || to < 0 || to >= items.length) return;
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onReorder?.(next);
    },
    [items, onReorder]
  );

  const handleDrop = useCallback(
    (index) => {
      if (dragIndex === null) return;
      move(dragIndex, index);
      setDragIndex(null);
      setOverIndex(null);
    },
    [dragIndex, move]
  );

  return (
    <ul ref={listRef} className={cn('space-y-2', className)}>
      {items.map((item, index) => {
        const isDragging = dragIndex === index;
        const isOver = overIndex === index && dragIndex !== index;

        return (
          <li
            key={item._id || item.key || index}
            draggable={!disabled}
            onDragStart={(e) => {
              setDragIndex(index);
              e.dataTransfer.effectAllowed = 'move';
              // بعض المتصفحات تتطلب بيانات لبدء السحب
              try { e.dataTransfer.setData('text/plain', String(index)); } catch { /* noop */ }
            }}
            onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
            onDragOver={(e) => { e.preventDefault(); setOverIndex(index); }}
            onDragLeave={() => setOverIndex((v) => (v === index ? null : v))}
            onDrop={(e) => { e.preventDefault(); handleDrop(index); }}
            className={cn(
              'flex items-center gap-3 rounded-xl border bg-white p-3 transition',
              isDragging ? 'opacity-40' : 'opacity-100',
              isOver ? 'border-rose ring-2 ring-rose/25' : 'border-black/5',
              !disabled && 'cursor-grab active:cursor-grabbing'
            )}
          >
            {!disabled ? (
              <span className="shrink-0 text-ink-muted" aria-hidden="true">
                <FiMove size={15} />
              </span>
            ) : null}

            <div className="min-w-0 flex-1">{children(item, index)}</div>

            {/* بديل لوحة المفاتيح للسحب والإفلات */}
            {!disabled ? (
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0}
                  aria-label={`${t('a3.moveUp')} — ${index + 1}`}
                  title={t('a3.moveUp')}
                  className="grid h-6 w-6 place-items-center rounded border border-black/10 text-ink-muted transition hover:border-rose hover:text-rose disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <FiChevronUp size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, index + 1)}
                  disabled={index === items.length - 1}
                  aria-label={`${t('a3.moveDown')} — ${index + 1}`}
                  title={t('a3.moveDown')}
                  className="grid h-6 w-6 place-items-center rounded border border-black/10 text-ink-muted transition hover:border-rose hover:text-rose disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <FiChevronDown size={13} />
                </button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
