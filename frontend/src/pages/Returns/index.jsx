import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiCheck, FiRotateCcw } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/common/PageHeader';
import { ConfirmDialog } from '@/components/ui/Modal';
import { TableSkeleton } from '@/components/ui/Skeleton';
import client from '@/api/client';
import { useI18n } from '@/i18n';
import { formatDate, formatPrice } from '@/utils/format';
import { cn } from '@/utils/helpers';

const STATUS_META = {
  pending: { ar: 'قيد المراجعة', en: 'Under review', color: 'bg-amber-100 text-amber-700' },
  approved: { ar: 'تمت الموافقة', en: 'Approved', color: 'bg-sky-100 text-sky-700' },
  rejected: { ar: 'مرفوض', en: 'Rejected', color: 'bg-red-100 text-red-700' },
  'awaiting-pickup': { ar: 'بانتظار الاستلام', en: 'Awaiting pickup', color: 'bg-violet-100 text-violet-700' },
  returned: { ar: 'تم الاستلام', en: 'Received', color: 'bg-indigo-100 text-indigo-700' },
  refunded: { ar: 'تم الاسترداد', en: 'Refunded', color: 'bg-emerald-100 text-emerald-700' },
  closed: { ar: 'مغلق', en: 'Closed', color: 'bg-stone-200 text-stone-700' }
};

const FLOW = ['pending', 'approved', 'awaiting-pickup', 'returned', 'refunded'];

/** متابعة طلبات الإرجاع الخاصة بالعميل */
export default function MyReturns() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [cancelling, setCancelling] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['my-returns'],
    queryFn: () => client.get('/returns/my').then((r) => r.data?.data)
  });
  const returns = data?.returns || [];

  const cancel = useMutation({
    mutationFn: (id) => client.put(`/returns/${id}/cancel`),
    onSuccess: () => {
      toast.success(t('returns.cancelled'));
      setCancelling(null);
      qc.invalidateQueries({ queryKey: ['my-returns'] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  return (
    <>
      <PageHeader title={t('returns.myReturns')} breadcrumbs={[{ label: t('returns.myReturns') }]} />

      <div className="container-x py-8">
        {isLoading ? (
          <TableSkeleton rows={3} cols={1} />
        ) : returns.length ? (
          <ul className="space-y-4">
            {returns.map((r) => {
              const meta = STATUS_META[r.status] || STATUS_META.pending;
              const step = FLOW.indexOf(r.status);
              const rejected = ['rejected', 'closed'].includes(r.status);
              return (
                <li key={r._id} className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/5 pb-4">
                    <div>
                      <p className="font-en text-sm font-bold text-ink">{r.returnNumber}</p>
                      <p className="mt-1 text-[11px] text-ink-muted">
                        {t('orders.orderNumber')}: <span className="font-en">{r.order?.orderNumber}</span> ·{' '}
                        {formatDate(r.createdAt, lang)}
                      </p>
                    </div>
                    <div className="text-end">
                      <Badge className={meta.color}>{meta[lang] || meta.ar}</Badge>
                      <p className="mt-2 text-lg font-bold text-rose">
                        {formatPrice(r.refundAmount || r.requestedAmount, lang)}
                      </p>
                    </div>
                  </div>

                  {/* مسار الحالة */}
                  {!rejected ? (
                    <ol className="relative my-5 flex justify-between">
                      <span className="absolute inset-x-0 top-3 -z-0 h-0.5 bg-black/8" />
                      <span
                        className="absolute top-3 -z-0 h-0.5 bg-rose transition-all duration-700 ltr:left-0 rtl:right-0"
                        style={{ width: `${(Math.max(0, step) / (FLOW.length - 1)) * 100}%` }}
                      />
                      {FLOW.map((s, i) => {
                        const done = i <= step;
                        return (
                          <li key={s} className="relative z-10 flex flex-1 flex-col items-center gap-1.5">
                            <span
                              className={cn(
                                'grid h-6 w-6 place-items-center rounded-full border-2 bg-white text-[10px] transition',
                                done ? 'border-rose bg-rose text-white' : 'border-black/10 text-ink-muted'
                              )}
                            >
                              {done ? <FiCheck size={11} /> : i + 1}
                            </span>
                            <span className={cn('text-center text-[9px] font-semibold', done ? 'text-ink' : 'text-ink-muted')}>
                              {STATUS_META[s][lang] || STATUS_META[s].ar}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  ) : r.rejectionReason ? (
                    <p className="my-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">{r.rejectionReason}</p>
                  ) : null}

                  <ul className="space-y-1.5 text-xs text-ink-muted">
                    {r.items?.map((it) => (
                      <li key={it._id}>
                        {it.name} × {it.approvedQuantity ?? it.quantity}
                      </li>
                    ))}
                  </ul>

                  {r.reason?.name || r.reasonText ? (
                    <p className="mt-3 text-[11px] text-ink-muted">
                      {t('returns.reason')}: {r.reason?.name || r.reasonText}
                    </p>
                  ) : null}

                  {r.status === 'pending' ? (
                    <div className="mt-4 border-t border-black/5 pt-3">
                      <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setCancelling(r._id)}>
                        {t('returns.cancel')}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-2xl border border-black/5 bg-white shadow-soft">
            <EmptyState
              icon={FiRotateCcw}
              title={t('returns.empty')}
              description={t('returns.emptyDesc')}
              actionLabel={t('orders.title')}
              actionTo="/orders"
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={() => cancel.mutate(cancelling)}
        title={t('returns.cancel')}
        message={t('returns.confirmCancel')}
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}
