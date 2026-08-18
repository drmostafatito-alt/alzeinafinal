import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FiAlertCircle, FiBell, FiCheckCircle, FiCheckSquare, FiMail, FiPackage,
  FiRotateCcw, FiShoppingCart, FiStar, FiTrash2, FiUser
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import client from '@/api/client';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/Modal';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useDebounced } from '@/hooks/useDebounced';
import { useI18n } from '@/i18n';
import { timeAgo } from '@/utils/format';
import { cn } from '@/utils/helpers';

const TYPE_META = {
  order: { icon: FiShoppingCart, ar: 'طلبات', en: 'Orders', tone: 'bg-sky-100 text-sky-600' },
  stock: { icon: FiPackage, ar: 'مخزون', en: 'Stock', tone: 'bg-amber-100 text-amber-600' },
  customer: { icon: FiUser, ar: 'عملاء', en: 'Customers', tone: 'bg-emerald-100 text-emerald-600' },
  payment: { icon: FiCheckCircle, ar: 'مدفوعات', en: 'Payments', tone: 'bg-violet-100 text-violet-600' },
  message: { icon: FiMail, ar: 'رسائل', en: 'Messages', tone: 'bg-indigo-100 text-indigo-600' },
  review: { icon: FiStar, ar: 'تقييمات', en: 'Reviews', tone: 'bg-rose/15 text-rose' },
  system: { icon: FiAlertCircle, ar: 'النظام', en: 'System', tone: 'bg-stone-200 text-stone-700' },
  return: { icon: FiRotateCcw, ar: 'مرتجعات', en: 'Returns', tone: 'bg-teal-100 text-teal-600' },
  ticket: { icon: FiMail, ar: 'تذاكر', en: 'Tickets', tone: 'bg-cyan-100 text-cyan-600' }
};

/** مركز الإشعارات — عرض كامل بفلاتر، يكمّل جرس الإشعارات في الشريط العلوي */
export default function AdminNotifications() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [type, setType] = useState('all');
  const [read, setRead] = useState('all');
  const [search, setSearch] = useState('');
  const [clearing, setClearing] = useState(false);
  const debounced = useDebounced(search, 350);

  const params = useMemo(
    () => ({ page, limit: 30, type, read, ...(debounced ? { q: debounced } : {}) }),
    [page, type, read, debounced]
  );

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'notifications-feed', params],
    queryFn: () => client.get('/admin/notifications/feed', { params }).then((r) => r.data?.data),
    staleTime: 10000
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'notifications-feed'] });
    qc.invalidateQueries({ queryKey: ['admin', 'notifications'] });
  };

  const markRead = useMutation({
    mutationFn: (id) => client.put(`/admin/notifications/${id}/read`),
    onSuccess: invalidate
  });
  const markAll = useMutation({
    mutationFn: () => client.put('/admin/notifications/read-all'),
    onSuccess: () => { invalidate(); toast.success(t('admin.saved')); }
  });
  const remove = useMutation({
    mutationFn: (id) => client.delete(`/admin/notifications/${id}`),
    onSuccess: invalidate
  });
  const clearRead = useMutation({
    mutationFn: () => client.delete('/admin/notifications/read'),
    onSuccess: (r) => { invalidate(); setClearing(false); toast.success(r.data?.message || t('admin.deleted')); }
  });

  const items = data?.notifications || [];
  const byType = data?.byType || [];

  return (
    <>
      <AdminPageHeader
        title={t('a3.notificationCenter')}
        subtitle={data ? `${data.unreadCount} ${t('a3.unread')}` : undefined}
      >
        <Button size="sm" variant="outline" icon={FiCheckSquare} onClick={() => markAll.mutate()} loading={markAll.isPending}>
          {t('a3.markAllRead')}
        </Button>
        <Button size="sm" variant="outline" icon={FiTrash2} onClick={() => setClearing(true)}>
          {t('a3.clearRead')}
        </Button>
      </AdminPageHeader>

      {/* فلاتر النوع */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setType('all'); setPage(1); }}
          className={cn(
            'rounded-full px-3.5 py-2 text-xs font-semibold transition',
            type === 'all' ? 'bg-ink text-white' : 'border border-black/10 bg-white text-ink hover:border-rose hover:text-rose'
          )}
        >
          {t('a3.allTypes')}
        </button>
        {byType.map((b) => {
          const meta = TYPE_META[b.type] || TYPE_META.system;
          return (
            <button
              key={b.type}
              type="button"
              onClick={() => { setType(b.type); setPage(1); }}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition',
                type === b.type ? 'bg-ink text-white' : 'border border-black/10 bg-white text-ink hover:border-rose hover:text-rose'
              )}
            >
              {meta[lang]} ({b.count})
              {b.unread > 0 ? <span className="grid h-4 min-w-4 place-items-center rounded-full bg-rose px-1 text-[10px] text-white">{b.unread}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={t('admin.searchPlaceholder')}
          className="input h-9 min-w-[200px] flex-1 py-1.5 text-sm"
          aria-label={t('admin.searchPlaceholder')}
        />
        <select value={read} onChange={(e) => { setRead(e.target.value); setPage(1); }} className="input h-9 w-auto py-1.5 text-sm" aria-label={t('common.status')}>
          <option value="all">{t('common.all')}</option>
          <option value="false">{t('a3.unread')}</option>
          <option value="true">{t('a3.read')}</option>
        </select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} cols={3} />
      ) : items.length === 0 ? (
        <EmptyState icon={FiBell} title={t('admin.noData')} />
      ) : (
        <>
          <ul className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
            {items.map((n) => {
              const meta = TYPE_META[n.type] || TYPE_META.system;
              const Icon = meta.icon;
              const Inner = (
                <>
                  <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', n.priority === 'high' ? 'bg-rose/15 text-rose' : meta.tone)}>
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm', n.isRead ? 'font-medium text-ink-soft' : 'font-bold text-ink')}>{n.title}</span>
                    {n.body ? <span className="clamp-2 mt-0.5 block text-xs text-ink-muted">{n.body}</span> : null}
                    <span className="mt-1 block text-[11px] text-ink-muted">{timeAgo(n.createdAt, lang)}</span>
                  </span>
                  {!n.isRead ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose" aria-label={t('a3.unread')} /> : null}
                </>
              );

              return (
                <li key={n._id} className={cn('flex items-start gap-3 border-b border-black/5 p-4 last:border-0', n.isRead ? '' : 'bg-blush/20')}>
                  {n.link ? (
                    <Link to={n.link} onClick={() => !n.isRead && markRead.mutate(n._id)} className="flex min-w-0 flex-1 items-start gap-3 text-start">
                      {Inner}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => !n.isRead && markRead.mutate(n._id)} className="flex min-w-0 flex-1 items-start gap-3 text-start">
                      {Inner}
                    </button>
                  )}

                  <div className="flex shrink-0 gap-1.5">
                    {!n.isRead ? (
                      <button
                        type="button"
                        onClick={() => markRead.mutate(n._id)}
                        title={t('a3.read')}
                        aria-label={t('a3.read')}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-emerald-500 hover:text-emerald-600"
                      >
                        <FiCheckCircle size={14} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => remove.mutate(n._id)}
                      title={t('common.delete')}
                      aria-label={t('common.delete')}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-red-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {data?.pages > 1 ? (
            <div className="mt-4">
              <Pagination page={data.page} pages={data.pages} onChange={setPage} />
            </div>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={clearing}
        onClose={() => setClearing(false)}
        onConfirm={() => clearRead.mutate()}
        title={t('a3.clearRead')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}
