import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FiChevronDown, FiChevronUp, FiInbox, FiSearch } from 'react-icons/fi';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useDebounced } from '@/hooks/useDebounced';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/helpers';

/** قراءة قيمة متداخلة بمسار نقطي: 'user.name' */
const getPath = (row, key) => key.split('.').reduce((o, p) => o?.[p], row);

/**
 * صف الجدول — مفصول ومُغلَّف بـ memo حتى لا يُعاد رسم كل الصفوف
 * عند تغيير تحديد صف واحد فقط. فرق ملموس في الجداول الكبيرة.
 */
const Row = memo(function Row({ row, columns, actions, selectable, checked, onToggle, rowKey }) {
  return (
    <tr className={cn('transition hover:bg-cream/50', checked && 'bg-blush/30')}>
      {selectable ? (
        <td className="w-10 px-4 py-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onToggle(row[rowKey])}
            className="h-4 w-4 cursor-pointer accent-rose"
            aria-label={String(row.name || row.orderNumber || row.code || row[rowKey])}
          />
        </td>
      ) : null}
      {columns.map((col) => (
        <td key={col.key} className={cn('px-4 py-3 align-middle', col.className)}>
          {col.render ? col.render(row) : String(getPath(row, col.key) ?? '—')}
        </td>
      ))}
      {actions ? <td className="px-4 py-3 text-end">{actions(row)}</td> : null}
    </tr>
  );
});

/**
 * جدول بيانات عام: بحث + ترتيب + ترقيم صفحات + تحديد متعدد + بطاقات على الموبايل.
 * columns: [{ key, header, render?, sortable?, className?, hideOnMobile? }]
 *
 * التحديد اختياري تماماً (selectable=false افتراضياً) حتى تبقى كل
 * الصفحات القائمة تعمل بلا أي تعديل.
 */
export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  searchable = true,
  searchKeys = [],
  pageSize = 10,
  actions,
  toolbar,
  emptyMessage,
  /**
   * حالة فارغة غنية (المرحلة 5).
   * emptyMessage يبقى مدعوماً للتوافق مع كل الصفحات القائمة؛ الخصائص
   * الجديدة اختيارية بالكامل وتُستخدم عند الرغبة في حالة أوضح.
   */
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  emptyActionTo,
  onEmptyAction,
  rowKey = '_id',
  selectable = false,
  selected = [],
  onSelectedChange
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 'asc' });
  const [page, setPage] = useState(1);

  // البحث مؤجَّل: لا نعيد ترشيح آلاف الصفوف مع كل ضغطة زر
  const debouncedQuery = useDebounced(query, 250);

  useEffect(() => setPage(1), [debouncedQuery]);

  const filtered = useMemo(() => {
    let list = data;

    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase().trim();
      const keys = searchKeys.length ? searchKeys : columns.map((c) => c.key);
      list = list.filter((row) =>
        keys.some((k) => String(getPath(row, k) ?? '').toLowerCase().includes(q))
      );
    }

    if (sort.key) {
      // نسخة جديدة قبل الترتيب حتى لا نعدّل مصفوفة الكاش في مكانها
      list = [...list].sort((a, b) => {
        const av = getPath(a, sort.key);
        const bv = getPath(b, sort.key);
        if (typeof av === 'number' && typeof bv === 'number') return sort.dir === 'asc' ? av - bv : bv - av;
        return sort.dir === 'asc'
          ? String(av ?? '').localeCompare(String(bv ?? ''), 'ar')
          : String(bv ?? '').localeCompare(String(av ?? ''), 'ar');
      });
    }

    return list;
  }, [data, debouncedQuery, sort, columns, searchKeys]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const rows = useMemo(
    () => filtered.slice((current - 1) * pageSize, current * pageSize),
    [filtered, current, pageSize]
  );

  const toggleSort = useCallback(
    (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })),
    []
  );

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggleRow = useCallback(
    (id) => {
      if (!onSelectedChange) return;
      onSelectedChange(selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    },
    [selected, selectedSet, onSelectedChange]
  );

  // "تحديد الكل" يعمل على الصفحة الحالية — سلوك متوقّع ولا يفاجئ المستخدم
  const pageIds = useMemo(() => rows.map((r) => r[rowKey]), [rows, rowKey]);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id));

  const toggleAll = useCallback(() => {
    if (!onSelectedChange) return;
    if (allOnPageSelected) onSelectedChange(selected.filter((id) => !pageIds.includes(id)));
    else onSelectedChange([...new Set([...selected, ...pageIds])]);
  }, [allOnPageSelected, onSelectedChange, pageIds, selected]);

  const colCount = columns.length + (actions ? 1 : 0) + (selectable ? 1 : 0);

  /** لا نتائج بسبب البحث، لا لأن القائمة فارغة أصلاً */
  const isSearchEmpty = data.length > 0 && filtered.length === 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
      {(searchable || toolbar) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-black/5 p-4">
          {searchable ? (
            <div className="relative min-w-[200px] flex-1">
              <FiSearch className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-muted" size={15} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('admin.searchPlaceholder')}
                aria-label={t('admin.searchPlaceholder')}
                className="h-10 w-full rounded-xl border border-black/10 bg-white ps-10 pe-4 text-sm outline-none transition focus:border-rose focus:ring-2 focus:ring-rose/15"
              />
            </div>
          ) : null}
          {toolbar}
        </div>
      )}

      {loading ? (
        <div className="p-4">
          <TableSkeleton rows={5} cols={Math.min(colCount, 5)} />
        </div>
      ) : rows.length === 0 ? (
        /*
          كان هنا سطر نصّي باهت "لا توجد بيانات" — يبدو كخطأ ولا يقترح
          أي خطوة تالية، رغم وجود مكوّن EmptyState مصقول يستخدمه المتجر.
          نوحّد التجربة، ونفرّق بين حالتين مختلفتين تماماً:
          • بحث بلا نتائج ⇒ الحل مسح البحث، لا إضافة عنصر جديد.
          • قائمة فارغة أصلاً ⇒ الحل إنشاء أول عنصر.
        */
        isSearchEmpty ? (
          <EmptyState
            compact
            icon={FiSearch}
            title={t('a5.empty.search.title')}
            description={t('a5.empty.search.desc')}
            actionLabel={t('a5.empty.clearSearch')}
            onAction={() => setQuery('')}
          />
        ) : (
          <EmptyState
            compact
            icon={emptyIcon || FiInbox}
            title={emptyTitle || emptyMessage || t('a5.empty.generic.title')}
            description={emptyDescription}
            actionLabel={emptyActionLabel}
            actionTo={emptyActionTo}
            onAction={onEmptyAction}
          />
        )
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-start text-sm">
              <thead className="bg-cream/70 text-xs uppercase text-ink-muted">
                <tr>
                  {selectable ? (
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleAll}
                        className="h-4 w-4 cursor-pointer accent-rose"
                        aria-label={t('a3.selectAll')}
                      />
                    </th>
                  ) : null}
                  {columns.map((col) => (
                    <th key={col.key} className={cn('whitespace-nowrap px-4 py-3 text-start font-bold', col.className)}>
                      {col.sortable !== false ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(col.key)}
                          className="inline-flex items-center gap-1 transition hover:text-rose"
                        >
                          {col.header}
                          {sort.key === col.key ? (
                            sort.dir === 'asc' ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />
                          ) : null}
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  ))}
                  {actions ? <th className="px-4 py-3 text-end font-bold">{t('common.actions')}</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {rows.map((row) => (
                  <Row
                    key={row[rowKey]}
                    row={row}
                    columns={columns}
                    actions={actions}
                    selectable={selectable}
                    checked={selectedSet.has(row[rowKey])}
                    onToggle={toggleRow}
                    rowKey={rowKey}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="divide-y divide-black/5 md:hidden">
            {rows.map((row) => (
              <li key={row[rowKey]} className={cn('p-4', selectedSet.has(row[rowKey]) && 'bg-blush/30')}>
                {selectable ? (
                  <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-ink-muted">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(row[rowKey])}
                      onChange={() => toggleRow(row[rowKey])}
                      className="h-4 w-4 cursor-pointer accent-rose"
                    />
                    {t('a3.selected')}
                  </label>
                ) : null}
                <dl className="space-y-2">
                  {columns
                    .filter((c) => !c.hideOnMobile)
                    .map((col) => (
                      <div key={col.key} className="flex items-start justify-between gap-3">
                        <dt className="shrink-0 text-xs text-ink-muted">{col.header}</dt>
                        <dd className="min-w-0 text-end text-sm text-ink">
                          {col.render ? col.render(row) : String(getPath(row, col.key) ?? '—')}
                        </dd>
                      </div>
                    ))}
                </dl>
                {actions ? <div className="mt-3 flex justify-end gap-2 border-t border-black/5 pt-3">{actions(row)}</div> : null}
              </li>
            ))}
          </ul>

          {pages > 1 ? (
            <div className="border-t border-black/5 p-4">
              <Pagination page={current} pages={pages} onChange={setPage} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
