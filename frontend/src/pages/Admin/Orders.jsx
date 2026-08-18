import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FiClock, FiDownload, FiFileText, FiMessageSquare, FiPrinter, FiRotateCcw, FiSend, FiShoppingCart,
  FiTrash2, FiTruck
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { toast } from 'react-toastify';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/ui/Modal';
import RowActions from '@/components/admin/RowActions';
import BulkBar from '@/components/admin/BulkBar';
import ExportMenu from '@/components/admin/ExportMenu';
import { useDebounced } from '@/hooks/useDebounced';
import { adminService } from '@/services';
import client, { API_BASE } from '@/api/client';
import { useI18n } from '@/i18n';
import { formatDate, formatPrice } from '@/utils/format';
import { ORDER_STATUS_META, PAYMENT_STATUS_META } from '@/utils/constants';
import { cn } from '@/utils/helpers';
import SmartImage from '@/components/ui/SmartImage';

export default function AdminOrders() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [viewing, setViewing] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [shipModal, setShipModal] = useState(null);
  const [shipForm, setShipForm] = useState({ shippingCompany: '', trackingNumber: '' });

  /* المرحلة 3: تحديد متعدد + فلاتر متقدمة + خط زمني وملاحظات */
  const [selected, setSelected] = useState([]);
  const [timelineFor, setTimelineFor] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [adv, setAdv] = useState({
    paymentMethod: 'all', paymentStatus: 'all', shippingStatus: 'all', from: '', to: ''
  });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 350);

  // شركات الشحن لإسنادها للطلب
  const { data: companyData } = useQuery({
    queryKey: ['admin', 'shipping-companies'],
    queryFn: () => client.get('/admin/shipping-companies').then((r) => r.data?.data)
  });
  const companies = companyData?.companies || [];

  const saveShipping = useMutation({
    mutationFn: ({ id, payload }) => client.put(`/admin/orders/${id}/shipping`, payload),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      setShipModal(null);
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
    },
    onError: () => toast.error(t('common.error'))
  });

  // فتح المستندات بتوكن المصادقة ثم عرضها في تبويب جديد
  const openDoc = async (orderId, kind) => {
    try {
      const res = await client.get(`/admin/orders/${orderId}/${kind}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      toast.error(t('common.error'));
    }
  };

  const { data, isLoading } = useQuery({ queryKey: ['admin', 'orders'], queryFn: adminService.orders.list });
  const orders = data?.data?.orders || [];

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => adminService.orders.updateStatus(id, status),
    onSuccess: (r) => {
      toast.success(t('admin.statusUpdated'));
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      if (viewing) setViewing((v) => ({ ...v, orderStatus: r?.data?.order?.orderStatus ?? v.orderStatus }));
    },
    onError: () => toast.error(t('common.error')),
  });

  /* ---------- المرحلة 3: خط زمني، ملاحظات، عمليات جماعية ---------- */
  const timelineQ = useQuery({
    queryKey: ['admin', 'order-timeline', timelineFor?._id],
    queryFn: () => client.get(`/admin/orders/${timelineFor._id}/timeline`).then((r) => r.data?.data),
    enabled: Boolean(timelineFor?._id)
  });

  const addNote = useMutation({
    mutationFn: ({ id, body }) => client.post(`/admin/orders/${id}/notes`, { body }),
    onSuccess: () => {
      setNoteText('');
      qc.invalidateQueries({ queryKey: ['admin', 'order-timeline'] });
      toast.success(t('admin.saved'));
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const delNote = useMutation({
    mutationFn: ({ id, noteId }) => client.delete(`/admin/orders/${id}/notes/${noteId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'order-timeline'] }),
    onError: () => toast.error(t('common.error'))
  });

  const bulkStatus = useMutation({
    mutationFn: ({ ids, status }) => client.post('/admin/orders/bulk-status', { ids, status }),
    onSuccess: (r) => {
      toast.success(r.data?.message || t('admin.saved'));
      setSelected([]);
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      qc.invalidateQueries({ queryKey: ['admin', 'analytics'] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const resendInvoice = useMutation({
    mutationFn: (id) => client.post(`/admin/orders/${id}/resend-invoice`),
    onSuccess: (r) => {
      // الخادم يخبرنا بصدق إن كان البريد أُرسل فعلاً أم لا
      if (r.data?.data?.delivered) toast.success(r.data.message);
      else toast.info(r.data?.message, { autoClose: 7000 });
    },
    onError: () => toast.error(t('common.error'))
  });

  const exportOrders = useCallback(async (ids) => {
    try {
      const res = await client.get('/admin/orders/export', {
        params: ids?.length ? { ids: ids.join(',') } : {},
        responseType: 'blob'
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-${Date.now()}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      toast.error(t('common.error'));
    }
  }, [t]);

  /**
   * الترشيح يتم في المتصفح على القائمة المحمّلة مسبقاً.
   * أبقينا مصدر البيانات كما هو (GET /admin/orders) حتى لا نغيّر
   * أي سلوك قائم؛ الفلاتر الجديدة تعمل فوق نفس القائمة.
   */
  const filtered = useMemo(() => {
    let list = statusFilter === 'all' ? orders : orders.filter((o) => o.orderStatus === statusFilter);

    if (adv.paymentMethod !== 'all') list = list.filter((o) => o.paymentMethod === adv.paymentMethod);
    if (adv.paymentStatus !== 'all') list = list.filter((o) => o.paymentStatus === adv.paymentStatus);

    if (adv.shippingStatus !== 'all') {
      list = list.filter((o) => {
        if (adv.shippingStatus === 'not-shipped') return !o.shippedAt && !['cancelled', 'refunded'].includes(o.orderStatus);
        if (adv.shippingStatus === 'shipped') return Boolean(o.shippedAt) && !o.deliveredAt;
        if (adv.shippingStatus === 'delivered') return Boolean(o.deliveredAt);
        if (adv.shippingStatus === 'no-tracking') return !o.trackingNumber;
        return true;
      });
    }

    if (adv.from) {
      const f = new Date(adv.from).getTime();
      list = list.filter((o) => new Date(o.createdAt).getTime() >= f);
    }
    if (adv.to) {
      const tt = new Date(adv.to);
      tt.setHours(23, 59, 59, 999);
      list = list.filter((o) => new Date(o.createdAt).getTime() <= tt.getTime());
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      list = list.filter((o) =>
        [o.orderNumber, o.user?.name, o.user?.email, o.trackingNumber, o.shippingAddress?.phone]
          .some((v) => String(v ?? '').toLowerCase().includes(q))
      );
    }

    return list;
  }, [orders, statusFilter, adv, debouncedSearch]);

  const resetFilters = () => {
    setAdv({ paymentMethod: 'all', paymentStatus: 'all', shippingStatus: 'all', from: '', to: '' });
    setSearch('');
    setStatusFilter('all');
  };

  const paymentMethodsInUse = useMemo(
    () => [...new Set(orders.map((o) => o.paymentMethod).filter(Boolean))],
    [orders]
  );

  const columns = [
    {
      key: 'orderNumber',
      header: t('orders.orderNumber'),
      render: (o) => (
        <div>
          <p className="font-en text-sm font-bold text-ink">{o.orderNumber}</p>
          <p className="text-[11px] text-ink-muted">{formatDate(o.createdAt, lang)}</p>
        </div>
      ),
    },
    {
      key: 'user.name',
      header: t('admin.customer'),
      render: (o) => {
        const name = o.customerName || o.shippingAddress?.name || o.user?.name || o.guestEmail || '—';
        const phone = o.customerPhone || o.shippingAddress?.phone || o.guestPhone || o.user?.phone || '';
        return (
          <div className="min-w-0">
            <p className="clamp-1 text-sm font-semibold text-ink">{name}</p>
            {phone ? (
              <p dir="ltr" className="clamp-1 font-en text-[11px] text-ink-muted text-start">{phone}</p>
            ) : (
              <p className="clamp-1 text-[11px] text-ink-muted">{o.customerEmail || o.user?.email || '—'}</p>
            )}
          </div>
        );
      },
    },
    { key: 'items', header: t('cart.items'), render: (o) => o.items?.length || 0, hideOnMobile: true },
    { key: 'total', header: t('common.total'), render: (o) => <span className="font-bold text-ink">{formatPrice(o.total, lang)}</span> },
    {
      key: 'paymentStatus',
      header: t('orders.paymentMethod'),
      render: (o) => {
        const m = PAYMENT_STATUS_META[o.paymentStatus] || PAYMENT_STATUS_META.pending;
        return (
          <div className="flex flex-col items-start gap-1">
            <span className="text-[11px] text-ink-muted">{t(`checkout.${o.paymentMethod}`)}</span>
            <Badge className={m.color}>{m[lang]}</Badge>
          </div>
        );
      },
      hideOnMobile: true,
    },
    {
      key: 'orderStatus',
      header: t('common.status'),
      render: (o) => (
        <select
          value={o.orderStatus}
          onChange={(e) => statusMutation.mutate({ id: o._id, status: e.target.value })}
          className={cn(
            'cursor-pointer rounded-lg border-0 px-2.5 py-1.5 text-[11px] font-bold outline-none',
            (ORDER_STATUS_META[o.orderStatus] || ORDER_STATUS_META.pending).color
          )}
        >
          {Object.entries(ORDER_STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>
              {v[lang]}
            </option>
          ))}
        </select>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader title={t('admin.orders')} subtitle={`${filtered.length} / ${orders.length}`}>
        <Button size="sm" variant="outline" icon={FiRotateCcw} onClick={() => setShowFilters((v) => !v)}>
          {t('a3.advancedFilters')}
        </Button>
        <ExportMenu
          path="/admin/orders/export"
          params={{ ids: filtered.map((o) => o._id).join(',') }}
          filename="orders"
        />
      </AdminPageHeader>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {['all', ...Object.keys(ORDER_STATUS_META)].map((s) => {
          const count = s === 'all' ? orders.length : orders.filter((o) => o.orderStatus === s).length;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition',
                statusFilter === s ? 'bg-ink text-white' : 'border border-black/10 bg-white text-ink hover:border-rose hover:text-rose'
              )}
            >
              {s === 'all' ? t('common.all') : ORDER_STATUS_META[s][lang]} ({count})
            </button>
          );
        })}
      </div>

      {showFilters ? (
        <div className="mb-4 grid gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="f-search">{t('common.search')}</label>
            <input
              id="f-search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.searchPlaceholder')} className="input h-10 py-2 text-sm"
            />
          </div>
          <div>
            <label className="label" htmlFor="f-pm">{t('a3.paymentMethodFilter')}</label>
            <select id="f-pm" value={adv.paymentMethod} onChange={(e) => setAdv((a) => ({ ...a, paymentMethod: e.target.value }))} className="input h-10 py-2 text-sm">
              <option value="all">{t('common.all')}</option>
              {paymentMethodsInUse.map((m) => <option key={m} value={m}>{t(`checkout.${m}`)}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-ps">{t('orders.paymentMethod')}</label>
            <select id="f-ps" value={adv.paymentStatus} onChange={(e) => setAdv((a) => ({ ...a, paymentStatus: e.target.value }))} className="input h-10 py-2 text-sm">
              <option value="all">{t('common.all')}</option>
              {Object.entries(PAYMENT_STATUS_META).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-ss">{t('a3.shippingStatus')}</label>
            <select id="f-ss" value={adv.shippingStatus} onChange={(e) => setAdv((a) => ({ ...a, shippingStatus: e.target.value }))} className="input h-10 py-2 text-sm">
              <option value="all">{t('common.all')}</option>
              <option value="not-shipped">{t('a3.notShipped')}</option>
              <option value="shipped">{t('a3.shippedOrders')}</option>
              <option value="delivered">{t('a3.completedOrders')}</option>
              <option value="no-tracking">{t('a3.noTracking')}</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-from">{t('a3.dateFrom')}</label>
            <input id="f-from" type="date" value={adv.from} onChange={(e) => setAdv((a) => ({ ...a, from: e.target.value }))} className="input h-10 py-2 text-sm" />
          </div>
          <div>
            <label className="label" htmlFor="f-to">{t('a3.dateTo')}</label>
            <input id="f-to" type="date" value={adv.to} onChange={(e) => setAdv((a) => ({ ...a, to: e.target.value }))} className="input h-10 py-2 text-sm" />
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" icon={FiRotateCcw} onClick={resetFilters}>{t('a3.resetFilters')}</Button>
          </div>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        searchKeys={['orderNumber', 'customerName', 'customerPhone', 'customerEmail', 'user.name', 'user.email']}
        emptyIcon={FiShoppingCart}
        emptyTitle={t('a5.empty.orders.title')}
        emptyDescription={t('a5.empty.orders.desc')}
        actions={(row) => (
          <RowActions
            onView={() => setViewing(row)}
            extra={
              <>
                <button
                  type="button"
                  onClick={() => { setTimelineFor(row); setNoteText(''); }}
                  title={t('a3.timeline')}
                  aria-label={t('a3.timeline')}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-rose hover:text-rose"
                >
                  <FiClock size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => openDoc(row._id, 'invoice')}
                  title={t('admin.invoice')}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-ink hover:text-ink"
                >
                  <FiFileText size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => openDoc(row._id, 'label')}
                  title={t('admin.label')}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-ink hover:text-ink"
                >
                  <FiPrinter size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShipModal(row);
                    setShipForm({
                      shippingCompany: row.shippingCompany?._id || row.shippingCompany || '',
                      trackingNumber: row.trackingNumber || ''
                    });
                  }}
                  title={t('admin.assignCompany')}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-rose hover:text-rose"
                >
                  <FiTruck size={14} />
                </button>
              </>
            }
          />
        )}
      />

      {/* شريط الإجراءات الجماعية */}
      <BulkBar count={selected.length} onClear={() => setSelected([])}>
        <select
          className="rounded-lg bg-white/15 px-2 py-1.5 text-xs font-semibold text-white outline-none [&>option]:text-ink"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) { bulkStatus.mutate({ ids: selected, status: e.target.value }); e.target.value = ''; }
          }}
          aria-label={t('a3.bulkStatusUpdate')}
        >
          <option value="">{t('a3.bulkStatusUpdate')}</option>
          {Object.entries(ORDER_STATUS_META).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}
        </select>
        <button
          type="button"
          onClick={() => exportOrders(selected)}
          className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/25"
        >
          <FiDownload size={12} className="me-1 inline" />
          {t('a3.exportSelected')}
        </button>
      </BulkBar>

      {/* الخط الزمني والملاحظات الداخلية */}
      <Modal
        open={Boolean(timelineFor)}
        onClose={() => setTimelineFor(null)}
        title={`${t('a3.timeline')} — ${timelineFor?.orderNumber || ''}`}
        size="lg"
      >
        {timelineFor ? (
          <div className="space-y-5 p-6">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" icon={FiFileText} onClick={() => openDoc(timelineFor._id, 'invoice')}>
                {t('a3.printInvoice')}
              </Button>
              <Button
                size="sm" variant="outline" icon={FiSend}
                loading={resendInvoice.isPending}
                onClick={() => resendInvoice.mutate(timelineFor._id)}
              >
                {t('a3.resendInvoice')}
              </Button>
            </div>

            {/* الخط الزمني */}
            <div>
              <h4 className="mb-3 text-sm font-bold text-ink">{t('a3.orderActivity')}</h4>
              {timelineQ.isLoading ? (
                <p className="text-xs text-ink-muted">…</p>
              ) : (
                <ol className="relative space-y-3 border-s-2 border-black/10 ps-4">
                  {(timelineQ.data?.timeline || []).map((e, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -start-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-rose ring-2 ring-white" />
                      <p className="text-xs font-semibold text-ink">{e.message}</p>
                      {e.note ? <p className="mt-0.5 text-[11px] text-ink-muted">{e.note}</p> : null}
                      <p className="mt-0.5 text-[10px] text-ink-muted">
                        {formatDate(e.at, lang)}{e.by ? ` • ${e.by}` : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* الملاحظات الداخلية */}
            <div className="rounded-xl bg-cream p-4">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
                <FiMessageSquare size={14} /> {t('a3.internalNotes')}
              </h4>

              <ul className="mb-3 space-y-2">
                {(timelineQ.data?.notes || []).map((n) => (
                  <li key={n._id} className="flex items-start gap-2 rounded-lg bg-white p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-ink">{n.body}</p>
                      <p className="mt-0.5 text-[10px] text-ink-muted">
                        {n.authorName} • {formatDate(n.at, lang)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => delNote.mutate({ id: timelineFor._id, noteId: n._id })}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded text-ink-muted transition hover:bg-red-50 hover:text-red-600"
                      aria-label={t('common.delete')}
                    >
                      <FiTrash2 size={12} />
                    </button>
                  </li>
                ))}
                {(timelineQ.data?.notes || []).length === 0 ? (
                  <li className="py-2 text-center text-[11px] text-ink-muted">{t('admin.noData')}</li>
                ) : null}
              </ul>

              <div className="flex gap-2">
                <input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && noteText.trim()) {
                      addNote.mutate({ id: timelineFor._id, body: noteText.trim() });
                    }
                  }}
                  placeholder={t('a3.notePlaceholder')}
                  maxLength={1000}
                  className="input h-10 flex-1 py-2 text-sm"
                  aria-label={t('a3.addNote')}
                />
                <Button
                  size="sm"
                  loading={addNote.isPending}
                  disabled={!noteText.trim()}
                  onClick={() => addNote.mutate({ id: timelineFor._id, body: noteText.trim() })}
                >
                  {t('a3.addNote')}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Order details modal */}
      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing?.orderNumber} size="lg">
        {viewing ? (
          <div className="space-y-5 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-cream p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold text-ink-muted">{t('admin.customer')}</p>
                  {(viewing.shippingAddress?.phone || viewing.guestPhone || viewing.user?.phone) ? (
                    <a
                      href={`https://wa.me/${String(viewing.shippingAddress?.phone || viewing.guestPhone || viewing.user?.phone || '').replace(/[^\d]/g, '')}?text=${encodeURIComponent('مرحباً، بخصوص الطلب رقم ' + viewing.orderNumber)}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 rounded-full bg-[#25D366] px-2.5 py-1 text-[11px] font-bold text-white shadow-sm hover:brightness-105"
                    >
                      <FaWhatsapp size={12} /> واتساب
                    </a>
                  ) : null}
                </div>
                <p className="text-sm font-semibold text-ink">
                  {viewing.shippingAddress?.name || viewing.user?.name || viewing.guestEmail || '—'}
                </p>
                <p className="text-xs text-ink-muted">{viewing.user?.email || viewing.guestEmail || '—'}</p>
                <p dir="ltr" className="mt-1 text-xs font-bold text-ink text-start">
                  📞 {viewing.shippingAddress?.phone || viewing.guestPhone || viewing.user?.phone || '—'}
                </p>
              </div>
              <div className="rounded-xl bg-cream p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold text-ink-muted">{t('orders.shippingAddress')}</p>
                  <Badge variant="blush">
                    {viewing.financialSnapshot?.country === 'AE' || viewing.shippingAddress?.countryCode === 'AE'
                      ? '🇦🇪 الإمارات'
                      : '🇪🇬 مصر'}
                  </Badge>
                </div>
                <p className="text-xs leading-relaxed text-ink-soft">
                  {[
                    viewing.shippingAddress?.street,
                    viewing.shippingAddress?.buildingNumber ? `مبنى ${viewing.shippingAddress.buildingNumber}` : null,
                    viewing.shippingAddress?.floor ? `طابق ${viewing.shippingAddress.floor}` : null,
                    viewing.shippingAddress?.apartment ? `شقة ${viewing.shippingAddress.apartment}` : null,
                    viewing.shippingAddress?.district,
                    viewing.shippingAddress?.city,
                    viewing.shippingAddress?.governorateName || viewing.shippingAddress?.governorate
                  ]
                    .filter(Boolean)
                    .join('، ') || '—'}
                </p>
                {viewing.shippingAddress?.notes ? (
                  <p className="mt-2 text-[11px] font-medium text-amber-800">
                    ملاحظات: {viewing.shippingAddress.notes}
                  </p>
                ) : null}
              </div>
            </div>

            <ul className="divide-y divide-black/5 rounded-xl border border-black/5">
              {viewing.items?.map((item) => (
                <li key={item._id} className="flex items-center gap-3 p-3">
                  <SmartImage
                    src={item.product?.mainImage || item.image}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="clamp-1 text-sm font-semibold text-ink">{item.name}</p>
                    <p className="text-xs text-ink-muted">
                      {formatPrice(item.price, lang)} × {item.quantity}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-ink">{formatPrice(item.total || item.price * item.quantity, lang)}</span>
                </li>
              ))}
            </ul>

            <dl className="space-y-2 rounded-xl bg-cream p-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-muted">{t('cart.subtotal')}</dt>
                <dd className="font-semibold">{formatPrice(viewing.subtotal, lang)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">{t('cart.shipping')}</dt>
                <dd className="font-semibold">{formatPrice(viewing.shippingCost, lang)}</dd>
              </div>
              {viewing.couponDiscount > 0 ? (
                <div className="flex justify-between text-emerald-600">
                  <dt>{t('cart.discount')}</dt>
                  <dd className="font-semibold">− {formatPrice(viewing.couponDiscount, lang)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-black/10 pt-2">
                <dt className="font-bold text-ink">{t('cart.total')}</dt>
                <dd className="text-lg font-bold text-rose">{formatPrice(viewing.total, lang)}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={viewing.orderStatus}
                onChange={(e) => statusMutation.mutate({ id: viewing._id, status: e.target.value })}
                className="input flex-1 py-2.5 text-sm"
              >
                {Object.entries(ORDER_STATUS_META).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v[lang]}
                  </option>
                ))}
              </select>
              <Button variant="outline" icon={FiFileText} onClick={() => openDoc(viewing._id, 'invoice')}>
                {t('admin.invoice')}
              </Button>
              <Button variant="outline" icon={FiPrinter} onClick={() => openDoc(viewing._id, 'label')}>
                {t('admin.label')}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* إسناد شركة الشحن ورقم التتبع */}
      <Modal open={Boolean(shipModal)} onClose={() => setShipModal(null)} title={t('admin.assignCompany')} size="sm">
        {shipModal ? (
          <div className="space-y-4 p-6">
            <div>
              <label className="label">{t('admin.assignCompany')}</label>
              <select
                value={shipForm.shippingCompany}
                onChange={(e) => setShipForm((f) => ({ ...f, shippingCompany: e.target.value }))}
                className="input"
              >
                <option value="">—</option>
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t('admin.tracking')}</label>
              <input
                value={shipForm.trackingNumber}
                onChange={(e) => setShipForm((f) => ({ ...f, trackingNumber: e.target.value }))}
                dir="ltr"
                className="input"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                className="flex-1"
                loading={saveShipping.isPending}
                onClick={() => saveShipping.mutate({ id: shipModal._id, payload: shipForm })}
              >
                {t('common.save')}
              </Button>
              <Button variant="outline" onClick={() => setShipModal(null)}>{t('common.cancel')}</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
