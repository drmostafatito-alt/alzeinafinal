import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiBell,
  FiCheckCircle,
  FiMail,
  FiPackage,
  FiShoppingCart,
  FiStar,
  FiUser
} from 'react-icons/fi';
import client from '@/api/client';
import { useClickOutside } from '@/hooks';
import { useI18n } from '@/i18n';
import { timeAgo } from '@/utils/format';
import { cn } from '@/utils/helpers';

const ICONS = {
  order: FiShoppingCart,
  message: FiMail,
  review: FiStar,
  stock: FiPackage,
  customer: FiUser,
  payment: FiCheckCircle,
  system: FiBell
};

/** جرس الإشعارات مع عدّاد غير المقروء — يُحدَّث دورياً */
export default function NotificationBell() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(useCallback(() => setOpen(false), []));

  const { data } = useQuery({
    queryKey: ['admin', 'notifications'],
    queryFn: () => client.get('/admin/notifications', { params: { limit: 20 } }).then((r) => r.data?.data),
    refetchInterval: 30000,
    staleTime: 15000
  });

  const notifications = data?.notifications || [];
  const unread = data?.unreadCount || 0;

  const markRead = useMutation({
    mutationFn: (id) => client.put(`/admin/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'notifications'] })
  });

  const markAll = useMutation({
    mutationFn: () => client.put('/admin/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'notifications'] })
  });

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-10 w-10 place-items-center rounded-xl text-ink transition hover:bg-blush"
        aria-label={`${unread} notifications`}
      >
        <FiBell size={18} />
        {unread > 0 ? (
          <motion.span
            key={unread}
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            className="absolute -end-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose px-1 text-[10px] font-bold text-white"
          >
            {unread > 99 ? '99+' : unread}
          </motion.span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute end-0 top-full z-50 mt-2 w-[340px] overflow-hidden rounded-2xl border border-black/5 bg-white shadow-lift"
          >
            <div className="flex items-center justify-between border-b border-black/5 bg-cream px-4 py-3">
              <p className="text-sm font-bold text-ink">
                {t('admin.notifications')} {unread > 0 ? `(${unread})` : ''}
              </p>
              {unread > 0 ? (
                <button
                  type="button"
                  onClick={() => markAll.mutate()}
                  className="text-[11px] font-semibold text-rose hover:underline"
                >
                  {t('admin.markAllRead')}
                </button>
              ) : null}
            </div>

            <div className="max-h-[380px] overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="p-8 text-center text-xs text-ink-muted">{t('admin.noData')}</p>
              ) : (
                notifications.map((n) => {
                  const Icon = ICONS[n.type] || FiBell;
                  const inner = (
                    <>
                      <span
                        className={cn(
                          'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
                          n.priority === 'high' ? 'bg-rose/15 text-rose' : 'bg-blush text-ink-soft'
                        )}
                      >
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-xs', n.isRead ? 'font-medium text-ink-soft' : 'font-bold text-ink')}>
                          {n.title}
                        </span>
                        {n.body ? <span className="clamp-2 block text-[11px] text-ink-muted">{n.body}</span> : null}
                        <span className="mt-0.5 block text-[10px] text-ink-muted">{timeAgo(n.createdAt, lang)}</span>
                      </span>
                      {!n.isRead ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose" /> : null}
                    </>
                  );

                  const cls = cn(
                    'flex w-full items-start gap-3 border-b border-black/5 p-3 text-start transition last:border-0',
                    n.isRead ? 'hover:bg-cream/60' : 'bg-blush/30 hover:bg-blush/50'
                  );

                  return n.link ? (
                    <Link
                      key={n._id}
                      to={n.link}
                      onClick={() => {
                        if (!n.isRead) markRead.mutate(n._id);
                        setOpen(false);
                      }}
                      className={cls}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <button key={n._id} type="button" onClick={() => !n.isRead && markRead.mutate(n._id)} className={cls}>
                      {inner}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
