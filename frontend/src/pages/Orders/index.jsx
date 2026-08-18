import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiPackage } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/common/PageHeader';
import { ConfirmDialog } from '@/components/ui/Modal';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { orderService } from '@/services';
import { useI18n } from '@/i18n';
import { formatDate, formatPrice } from '@/utils/format';
import { ORDER_STATUS_META, PAYMENT_STATUS_META } from '@/utils/constants';
import { cn } from '@/utils/helpers';
import SmartImage from '@/components/ui/SmartImage';

export default function Orders() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [cancelling, setCancelling] = useState(null);
  const [filter, setFilter] = useState('all');

  const { data, isLoading } = useQuery({ queryKey: ['orders'], queryFn: orderService.list });
  const orders = data?.data?.orders || [];

  const cancelMutation = useMutation({
    mutationFn: (id) => orderService.cancel(id, 'user request'),
    onSuccess: () => {
      toast.success(t('orders.cancelled'));
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: () => toast.error(t('common.error')),
  });

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.orderStatus === filter);
  const statuses = ['all', ...Object.keys(ORDER_STATUS_META)];

  return (
    <>
      <PageHeader title={t('orders.title')} breadcrumbs={[{ label: t('orders.title') }]} />

      <div className="container-x py-8">
        {/* Status filters */}
        {orders.length ? (
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {statuses.map((s) => {
              const count = s === 'all' ? orders.length : orders.filter((o) => o.orderStatus === s).length;
              if (s !== 'all' && !count) return null;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter(s)}
                  className={cn(
                    'shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition',
                    filter === s ? 'bg-ink text-white' : 'border border-ink/10 bg-white text-ink hover:border-rose hover:text-rose'
                  )}
                >
                  {s === 'all' ? t('common.all') : ORDER_STATUS_META[s][lang]} ({count})
                </button>
              );
            })}
          </div>
        ) : null}

        {isLoading ? (
          <TableSkeleton rows={4} cols={1} />
        ) : filtered.length ? (
          <ul className="space-y-4">
            {filtered.map((order) => {
              const meta = ORDER_STATUS_META[order.orderStatus] || ORDER_STATUS_META.pending;
              const canCancel = ['pending', 'confirmed'].includes(order.orderStatus);
              return (
                <li key={order._id} className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/5 pb-4">
                    <div>
                      <p className="text-[11px] text-ink-muted">{t('orders.orderNumber')}</p>
                      <p className="font-en text-sm font-bold text-ink">{order.orderNumber}</p>
                      <p className="mt-1 text-[11px] text-ink-muted">
                        {t('orders.orderDate')}: {formatDate(order.createdAt, lang)}
                      </p>
                    </div>
                    <div className="text-end">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Badge className={meta.color}>{meta[lang]}</Badge>
                        {order.paymentMethod !== 'cod' ? (
                          <Badge className={(PAYMENT_STATUS_META[order.paymentStatus] || PAYMENT_STATUS_META.pending).color}>
                            {(PAYMENT_STATUS_META[order.paymentStatus] || PAYMENT_STATUS_META.pending)[lang]}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-lg font-bold text-rose">{formatPrice(order.total, lang)}</p>
                    </div>
                  </div>

                  <ul className="flex gap-3 overflow-x-auto py-4 no-scrollbar">
                    {order.items?.map((item) => (
                      <li key={item._id} className="flex w-56 shrink-0 items-center gap-3">
                        <SmartImage
                          src={item.product?.mainImage || item.image}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-lg object-cover"
                        />
                        <div className="min-w-0">
                          <p className="clamp-2 text-xs font-semibold text-ink">{item.name}</p>
                          <p className="text-[11px] text-ink-muted">
                            {formatPrice(item.price, lang)} × {item.quantity}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap gap-2 border-t border-black/5 pt-4">
                    <Button to={`/orders/${order._id}`} size="sm" variant="outline">
                      {t('orders.viewDetails')}
                    </Button>
                    {order.trackingNumber ? (
                      <span className="inline-flex items-center rounded-full bg-blush px-3 py-2 text-[11px] font-semibold text-rose-700">
                        {t('orders.trackingNumber')}: {order.trackingNumber}
                      </span>
                    ) : null}
                    {canCancel ? (
                      <Button
                        onClick={() => setCancelling(order._id)}
                        size="sm"
                        variant="ghost"
                        className="ms-auto text-red-600 hover:bg-red-50"
                      >
                        {t('orders.cancelOrder')}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-2xl border border-black/5 bg-white shadow-soft">
            <EmptyState
              icon={FiPackage}
              title={t('orders.empty')}
              description={t('orders.emptyDesc')}
              actionLabel={t('cart.startShopping')}
              actionTo="/shop"
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={() => cancelMutation.mutate(cancelling)}
        title={t('orders.cancelOrder')}
        message={t('orders.confirmCancel')}
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}
