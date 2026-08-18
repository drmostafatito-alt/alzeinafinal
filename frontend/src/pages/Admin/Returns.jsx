import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiFileText, FiPackage, FiPlus, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import DataTable from '@/components/admin/DataTable';
import Input, { Checkbox, Select, Textarea } from '@/components/forms/Input';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import RowActions from '@/components/admin/RowActions';
import client from '@/api/client';
import { useI18n } from '@/i18n';
import { formatDate, formatPrice } from '@/utils/format';
import { cn } from '@/utils/helpers';
import SmartImage from '@/components/ui/SmartImage';

const STATUS_META = {
  pending: { ar: 'قيد المراجعة', en: 'Pending', color: 'bg-amber-100 text-amber-700' },
  approved: { ar: 'تمت الموافقة', en: 'Approved', color: 'bg-sky-100 text-sky-700' },
  rejected: { ar: 'مرفوض', en: 'Rejected', color: 'bg-red-100 text-red-700' },
  'awaiting-pickup': { ar: 'بانتظار الاستلام', en: 'Awaiting pickup', color: 'bg-violet-100 text-violet-700' },
  returned: { ar: 'تم الاستلام', en: 'Returned', color: 'bg-indigo-100 text-indigo-700' },
  refunded: { ar: 'تم الاسترداد', en: 'Refunded', color: 'bg-emerald-100 text-emerald-700' },
  closed: { ar: 'مغلق', en: 'Closed', color: 'bg-stone-200 text-stone-700' }
};

/** إدارة طلبات الإرجاع والاسترداد + أسباب الإرجاع */
export default function AdminReturns() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState('requests');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewing, setViewing] = useState(null);
  const [note, setNote] = useState('');
  const [refund, setRefund] = useState({ amount: '', method: 'original', reference: '' });
  const [reasonModal, setReasonModal] = useState(null);
  const [deleteReason, setDeleteReason] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'returns', statusFilter],
    queryFn: () =>
      client.get('/admin/returns', { params: statusFilter === 'all' ? {} : { status: statusFilter } })
        .then((r) => r.data?.data)
  });
  const returns = data?.returns || [];

  const { data: reasonData } = useQuery({
    queryKey: ['admin', 'return-reasons'],
    queryFn: () => client.get('/admin/return-reasons').then((r) => r.data?.data)
  });
  const reasons = reasonData?.reasons || [];

  const { data: detail } = useQuery({
    queryKey: ['admin', 'return', viewing?._id],
    queryFn: () => client.get(`/admin/returns/${viewing._id}`).then((r) => r.data?.data?.returnRequest),
    enabled: Boolean(viewing?._id)
  });
  const current = detail || viewing;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'returns'] });
    qc.invalidateQueries({ queryKey: ['admin', 'return'] });
    qc.invalidateQueries({ queryKey: ['admin', 'notifications'] });
  };

  const changeStatus = useMutation({
    mutationFn: ({ id, payload }) => client.put(`/admin/returns/${id}/status`, payload),
    onSuccess: () => { toast.success(t('admin.statusUpdated')); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const addNote = useMutation({
    mutationFn: ({ id, note: n }) => client.post(`/admin/returns/${id}/notes`, { note: n }),
    onSuccess: () => { toast.success(t('admin.saved')); setNote(''); invalidate(); }
  });

  const restock = useMutation({
    mutationFn: (id) => client.post(`/admin/returns/${id}/restock`),
    onSuccess: (r) => { toast.success(r.data?.message || t('admin.saved')); invalidate(); }
  });

  const saveReason = useMutation({
    mutationFn: (v) => (v._id ? client.put(`/admin/return-reasons/${v._id}`, v) : client.post('/admin/return-reasons', v)),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      setReasonModal(null);
      qc.invalidateQueries({ queryKey: ['admin', 'return-reasons'] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const removeReason = useMutation({
    mutationFn: (id) => client.delete(`/admin/return-reasons/${id}`),
    onSuccess: () => {
      toast.success(t('admin.deleted'));
      setDeleteReason(null);
      qc.invalidateQueries({ queryKey: ['admin', 'return-reasons'] });
    }
  });

  const openDoc = async (id) => {
    try {
      const res = await client.get(`/admin/returns/${id}/credit-note`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      toast.error(t('common.error'));
    }
  };

  const columns = [
    {
      key: 'returnNumber',
      header: t('admin.returnNumber'),
      render: (r) => (
        <div>
          <p className="font-en text-sm font-bold text-ink">{r.returnNumber}</p>
          <p className="text-[11px] text-ink-muted">{formatDate(r.createdAt, lang)}</p>
        </div>
      )
    },
    {
      key: 'order.orderNumber',
      header: t('orders.orderNumber'),
      render: (r) => <span className="font-en text-xs text-ink-muted">{r.order?.orderNumber || '—'}</span>,
      hideOnMobile: true
    },
    {
      key: 'user.name',
      header: t('admin.customer'),
      render: (r) => (
        <div className="min-w-0">
          <p className="clamp-1 text-sm">{r.user?.name || '—'}</p>
          <p className="clamp-1 text-[11px] text-ink-muted">{r.user?.email || r.guestEmail}</p>
        </div>
      )
    },
    { key: 'reasonText', header: t('admin.reason'), render: (r) => <span className="text-xs">{r.reasonText || '—'}</span>, hideOnMobile: true },
    {
      key: 'requestedAmount',
      header: t('common.total'),
      render: (r) => (
        <div>
          <p className="text-sm font-bold text-ink">{formatPrice(r.refundAmount || r.requestedAmount, lang)}</p>
          {r.refundAmount > 0 && r.refundAmount !== r.requestedAmount ? (
            <p className="text-[10px] text-ink-muted line-through">{formatPrice(r.requestedAmount, lang)}</p>
          ) : null}
        </div>
      )
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (r) => {
        const m = STATUS_META[r.status] || STATUS_META.pending;
        return <Badge className={m.color}>{m[lang] || m.ar}</Badge>;
      }
    }
  ];

  return (
    <>
      <AdminPageHeader
        title={t('admin.returns')}
        subtitle={data?.pending ? `${data.pending} ${t('admin.pendingReview')}` : undefined}
      />

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {['requests', 'reasons'].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              'shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition',
              tab === k ? 'bg-ink text-white' : 'border border-black/10 bg-white text-ink hover:border-rose hover:text-rose'
            )}
          >
            {k === 'requests' ? `${t('admin.returnRequests')} (${returns.length})` : `${t('admin.returnReasons')} (${reasons.length})`}
          </button>
        ))}
      </div>

      {tab === 'requests' ? (
        <>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {['all', ...Object.keys(STATUS_META)].map((s) => {
              const count = s === 'all' ? data?.total || 0 : data?.statusCounts?.[s] || 0;
              if (s !== 'all' && !count) return null;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition',
                    statusFilter === s ? 'bg-rose text-white' : 'border border-black/10 bg-white text-ink-soft hover:border-rose'
                  )}
                >
                  {s === 'all' ? t('common.all') : STATUS_META[s][lang] || STATUS_META[s].ar} ({count})
                </button>
              );
            })}
          </div>

          <DataTable
            columns={columns}
            data={returns}
            loading={isLoading}
            searchKeys={['returnNumber', 'reasonText']}
            actions={(row) => (
              <RowActions
                onView={() => setViewing(row)}
                extra={
                  row.status === 'refunded' ? (
                    <button
                      type="button"
                      onClick={() => openDoc(row._id)}
                      title={t('admin.creditNote')}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-ink hover:text-ink"
                    >
                      <FiFileText size={14} />
                    </button>
                  ) : null
                }
              />
            )}
          />
        </>
      ) : (
        <>
          <div className="mb-4 flex justify-end">
            <Button size="sm" icon={FiPlus} onClick={() => setReasonModal({ isActive: true, autoRestock: true })}>
              {t('common.add')}
            </Button>
          </div>
          <DataTable
            columns={[
              { key: 'name', header: t('common.name'), render: (r) => <span className="font-semibold">{lang === 'ar' ? r.name : r.nameEn || r.name}</span> },
              { key: 'requiresImages', header: t('admin.requiresImages'), render: (r) => (r.requiresImages ? '✓' : '—') },
              { key: 'isStoreFault', header: t('admin.storeFault'), render: (r) => (r.isStoreFault ? '✓' : '—'), hideOnMobile: true },
              { key: 'autoRestock', header: t('admin.autoRestock'), render: (r) => (r.autoRestock ? '✓' : '—') },
              {
                key: 'isActive',
                header: t('common.status'),
                render: (r) => <Badge variant={r.isActive ? 'success' : 'neutral'}>{r.isActive ? t('common.active') : t('common.inactive')}</Badge>
              }
            ]}
            data={reasons}
            searchable={false}
            actions={(r) => <RowActions onEdit={() => setReasonModal(r)} onDelete={() => setDeleteReason(r._id)} />}
          />
        </>
      )}

      {/* ------- تفاصيل الطلب ------- */}
      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={current?.returnNumber} size="lg">
        {current ? (
          <div className="space-y-5 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-cream p-4">
                <p className="mb-2 text-xs font-bold text-ink-muted">{t('admin.customer')}</p>
                <p className="text-sm font-semibold text-ink">{current.user?.name || '—'}</p>
                <p className="text-xs text-ink-muted">{current.user?.email || current.guestEmail}</p>
                <p className="mt-2 text-xs text-ink-muted">
                  {t('orders.orderNumber')}: <span className="font-en">{current.order?.orderNumber}</span>
                </p>
              </div>
              <div className="rounded-xl bg-cream p-4">
                <p className="mb-2 text-xs font-bold text-ink-muted">{t('admin.reason')}</p>
                <p className="text-sm text-ink">{current.reasonText || '—'}</p>
                {current.customerNote ? <p className="mt-2 text-xs text-ink-muted">{current.customerNote}</p> : null}
              </div>
            </div>

            {current.images?.length ? (
              <div className="flex gap-2">
                {current.images.map((img) => (
                  <SmartImage key={img} src={img} alt="" className="h-24 w-24 rounded-lg object-cover" />
                ))}
              </div>
            ) : null}

            <div className="rounded-xl border border-black/5">
              <p className="border-b border-black/5 p-3 text-xs font-bold text-ink-muted">{t('orders.orderItems')}</p>
              <ul className="divide-y divide-black/5">
                {current.items?.map((item) => (
                  <li key={item._id} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="clamp-1 text-sm font-semibold text-ink">{item.name}</p>
                      <p className="text-xs text-ink-muted">
                        {t('common.quantity')}: {item.quantity}
                        {item.approvedQuantity !== undefined && item.approvedQuantity !== item.quantity
                          ? ` → ${t('admin.approved')}: ${item.approvedQuantity}`
                          : ''}
                        {item.restocked ? ` · ${t('admin.restocked')}` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-bold">{formatPrice(item.price * (item.approvedQuantity ?? item.quantity), lang)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* إجراءات الحالة */}
            <div className="rounded-xl bg-cream p-4">
              <p className="mb-3 text-xs font-bold text-ink-muted">{t('admin.updateStatus')}</p>
              <div className="flex flex-wrap gap-2">
                {Object.keys(STATUS_META).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={changeStatus.isPending || current.status === s}
                    onClick={() => changeStatus.mutate({ id: current._id, payload: { status: s } })}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-40',
                      current.status === s ? STATUS_META[s].color : 'border border-black/10 bg-white text-ink-soft hover:border-rose'
                    )}
                  >
                    {STATUS_META[s][lang] || STATUS_META[s].ar}
                  </button>
                ))}
              </div>
            </div>

            {/* الاسترداد */}
            <div className="rounded-xl border border-black/5 p-4">
              <p className="mb-3 text-xs font-bold text-ink-muted">{t('admin.issueRefund')}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  label={t('admin.refundAmount')}
                  type="number"
                  step="0.01"
                  placeholder={String(current.refundAmount || current.requestedAmount)}
                  value={refund.amount}
                  onChange={(e) => setRefund((f) => ({ ...f, amount: e.target.value }))}
                />
                <Select
                  label={t('admin.refundMethod')}
                  value={refund.method}
                  onChange={(e) => setRefund((f) => ({ ...f, method: e.target.value }))}
                  options={[
                    { value: 'original', label: t('admin.refundOriginal') },
                    { value: 'wallet', label: t('admin.refundWallet') },
                    { value: 'bank', label: t('admin.refundBank') },
                    { value: 'cash', label: t('admin.refundCash') },
                    { value: 'store-credit', label: t('admin.refundCredit') }
                  ]}
                />
                <Input
                  label={t('checkout.paymentReference')}
                  value={refund.reference}
                  onChange={(e) => setRefund((f) => ({ ...f, reference: e.target.value }))}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  loading={changeStatus.isPending}
                  onClick={() =>
                    changeStatus.mutate({
                      id: current._id,
                      payload: {
                        status: 'refunded',
                        refundAmount: refund.amount ? Number(refund.amount) : undefined,
                        refundMethod: refund.method,
                        refundReference: refund.reference
                      }
                    })
                  }
                >
                  {t('admin.confirmRefund')}
                </Button>
                <Button size="sm" variant="outline" icon={FiRefreshCw} loading={restock.isPending} onClick={() => restock.mutate(current._id)}>
                  {t('admin.restock')}
                </Button>
                {current.status === 'refunded' ? (
                  <Button size="sm" variant="outline" icon={FiFileText} onClick={() => openDoc(current._id)}>
                    {t('admin.creditNote')}
                  </Button>
                ) : null}
              </div>
            </div>

            {/* ملاحظات داخلية */}
            <div className="rounded-xl border border-black/5 p-4">
              <p className="mb-3 text-xs font-bold text-ink-muted">{t('admin.internalNotes')}</p>
              {current.internalNotes?.length ? (
                <ul className="mb-3 space-y-2">
                  {current.internalNotes.map((n, i) => (
                    <li key={i} className="rounded-lg bg-cream p-2.5 text-xs">
                      <p className="text-ink">{n.note}</p>
                      <p className="mt-1 text-[10px] text-ink-muted">
                        {n.author?.name || ''} · {formatDate(n.at, lang, true)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex gap-2">
                <Input value={note} onChange={(e) => setNote(e.target.value)} containerClassName="flex-1" placeholder={t('admin.addNote')} />
                <Button size="sm" loading={addNote.isPending} onClick={() => note.trim() && addNote.mutate({ id: current._id, note })}>
                  {t('common.add')}
                </Button>
              </div>
            </div>

            {/* السجل */}
            {current.statusHistory?.length ? (
              <div className="rounded-xl bg-cream p-4">
                <p className="mb-2 text-xs font-bold text-ink-muted">{t('admin.history')}</p>
                <ul className="space-y-1.5">
                  {current.statusHistory.map((h, i) => (
                    <li key={i} className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-ink">{STATUS_META[h.status]?.[lang] || h.status}</span>
                      <span className="text-ink-muted">{formatDate(h.at, lang, true)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* ------- سبب الإرجاع ------- */}
      <Modal open={Boolean(reasonModal)} onClose={() => setReasonModal(null)} title={t('admin.returnReasons')}>
        {reasonModal ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveReason.mutate(reasonModal);
            }}
            className="space-y-4 p-6"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={`${t('common.name')} (AR)`}
                required
                value={reasonModal.name || ''}
                onChange={(e) => setReasonModal((r) => ({ ...r, name: e.target.value }))}
              />
              <Input
                label={`${t('common.name')} (EN)`}
                dir="ltr"
                value={reasonModal.nameEn || ''}
                onChange={(e) => setReasonModal((r) => ({ ...r, nameEn: e.target.value }))}
              />
            </div>
            <Textarea
              label={t('common.description')}
              rows={2}
              value={reasonModal.description || ''}
              onChange={(e) => setReasonModal((r) => ({ ...r, description: e.target.value }))}
            />
            <div className="grid gap-2 rounded-xl bg-cream p-4">
              <Checkbox
                label={t('admin.requiresImages')}
                checked={Boolean(reasonModal.requiresImages)}
                onChange={(e) => setReasonModal((r) => ({ ...r, requiresImages: e.target.checked }))}
              />
              <Checkbox
                label={t('admin.storeFaultHint')}
                checked={Boolean(reasonModal.isStoreFault)}
                onChange={(e) => setReasonModal((r) => ({ ...r, isStoreFault: e.target.checked }))}
              />
              <Checkbox
                label={t('admin.autoRestockHint')}
                checked={Boolean(reasonModal.autoRestock)}
                onChange={(e) => setReasonModal((r) => ({ ...r, autoRestock: e.target.checked }))}
              />
              <Checkbox
                label={t('common.active')}
                checked={reasonModal.isActive !== false}
                onChange={(e) => setReasonModal((r) => ({ ...r, isActive: e.target.checked }))}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={saveReason.isPending} className="flex-1">
                {t('common.save')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setReasonModal(null)}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteReason)}
        onClose={() => setDeleteReason(null)}
        onConfirm={() => removeReason.mutate(deleteReason)}
        title={t('admin.confirmDelete')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}
