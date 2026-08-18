import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FiCheck, FiClock, FiExternalLink, FiSearch, FiShield, FiX, FiZoomIn
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import client from '@/api/client';
import { registerExtraTranslations, useI18n } from '@/i18n';
import { paymentTranslations } from '@/i18n/paymentTranslations';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import SmartImage from '@/components/ui/SmartImage';
import { Select, Textarea } from '@/components/forms/Input';
import { TableSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { useConfig } from '@/config/ConfigProvider';
import { formatDate, formatPrice } from '@/utils/format';
import { localized } from '@/utils/helpers';
import { paymentIcon } from '@/utils/paymentIcons';
import { cn } from '@/utils/helpers';

registerExtraTranslations('payments', paymentTranslations);

const REJECT_REASONS = [
  'payment.reasonUnclear',
  'payment.reasonWrongAmount',
  'payment.reasonNotReceived',
  'payment.reasonInvalid',
  'payment.reasonMismatch',
  'payment.reasonOther',
];

const STATUS_META = {
  pending: { ar: 'payment.pendingBadge', en: 'payment.pendingBadge', cls: 'bg-amber-100 text-amber-700', icon: FiClock },
  approved: { ar: 'payment.approvedBadge', en: 'payment.approvedBadge', cls: 'bg-emerald-100 text-emerald-700', icon: FiShield },
  rejected: { ar: 'payment.rejectedBadge', en: 'payment.rejectedBadge', cls: 'bg-red-100 text-red-700', icon: FiX },
};

/**
 * مراجعة المدفوعات اليدوية — مصدر الحقيقة هو جدول payment_verifications.
 * لا توجد موافقة تلقائية: approve/reject كلاهما Server-side عبر RBAC.
 */
export default function AdminPaymentVerification() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const { paymentMethods } = useConfig();

  /* الفلتر الأولي من الرابط (إشعارات الدفع تحمل ?status=pending) */
  const [statusFilter, setStatusFilter] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('status') || 'pending'; } catch { return 'pending'; }
  });
  const [methodFilter, setMethodFilter] = useState('all');
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState(null); // صف المراجعة للمعاينة
  const [zoomUrl, setZoomUrl] = useState(null);
  const [approving, setApproving] = useState(null); // صف
  const [approveNote, setApproveNote] = useState('');
  const [rejecting, setRejecting] = useState(null); // صف
  const [rejectReason, setRejectReason] = useState(REJECT_REASONS[0]);
  const [rejectNote, setRejectNote] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payment-verifications', statusFilter, methodFilter, q],
    queryFn: () =>
      client
        .get('/admin/payment-verifications', {
          params: { status: statusFilter, method: methodFilter === 'all' ? undefined : methodFilter, q: q || undefined }
        })
        .then((r) => r.data?.data)
  });

  const rows = data?.verifications || [];
  const summary = data?.summary || { pending: 0, approved: 0, rejected: 0 };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'payment-verifications'] });
    qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
    qc.invalidateQueries({ queryKey: ['admin', 'notifications'] });
  };

  const approve = useMutation({
    mutationFn: ({ id, adminNote }) => client.post(`/admin/payment-verifications/${id}/approve`, { adminNote }),
    onSuccess: (res) => {
      toast.success(res.data?.message || t('admin.saved'));
      setApproving(null);
      setApproveNote('');
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }) => client.post(`/admin/payment-verifications/${id}/reject`, { reason }),
    onSuccess: (res) => {
      toast.success(res.data?.message || t('admin.saved'));
      setRejecting(null);
      setRejectNote('');
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const methodOptions = useMemo(
    () => (paymentMethods || []).map((m) => ({ value: m.code, label: (lang === 'ar' ? m.name : m.nameEn) || m.name })),
    [paymentMethods, lang]
  );

  const filters = [
    { key: 'all', label: t('common.all'), count: summary.pending + summary.approved + summary.rejected },
    { key: 'pending', label: t('payment.statusPending'), count: summary.pending },
    { key: 'approved', label: t('payment.statusApproved'), count: summary.approved },
    { key: 'rejected', label: t('payment.statusRejected'), count: summary.rejected },
  ];

  return (
    <>
      <AdminPageHeader
        title={t('admin.paymentVerification')}
        subtitle={`${summary.pending} ${t('admin.verificationQueue')}`}
      />

      {/* فلاتر: الحالة + طريقة الدفع + بحث */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition',
              statusFilter === f.key ? 'bg-ink text-white' : 'border border-black/10 bg-white text-ink-muted hover:border-rose hover:text-rose'
            )}
          >
            {f.label}
            <span className="rounded-full bg-white/20 px-1.5 text-[10px]">{f.count}</span>
          </button>
        ))}

        <div className="ms-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <FiSearch className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted" size={14} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`${t('common.search')}…`}
              className="input h-10 w-52 ps-9 text-sm"
            />
          </div>
          <Select
            label={false}
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            options={[{ value: 'all', label: t('admin.allMethods') }, ...methodOptions]}
            containerClassName="w-44"
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} cols={3} />
      ) : rows.length === 0 ? (
        <EmptyState icon={FiCheck} title={t('admin.noData')} description={t('payment.allVerified')} />
      ) : (
        <ul className="space-y-3">
          {rows.map((v) => {
            const Icon = paymentIcon(v.paymentMethodCode, v.icon);
            const meta = STATUS_META[v.status] || STATUS_META.pending;
            const StatusIcon = meta.icon;
            return (
              <li key={v._id} className="rounded-2xl border border-black/5 bg-white p-4 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blush text-rose">
                      <Icon size={18} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-en text-sm font-bold text-ink">{v.orderNumber}</p>
                        <Badge className={meta.cls}>
                          <span className="flex items-center gap-1">
                            <StatusIcon size={11} /> {t(meta.ar)}
                          </span>
                        </Badge>
                      </div>
                      <p className="clamp-1 mt-0.5 text-xs text-ink-muted">
                        {v.shippingAddress?.name} · {v.guestPhone || v.shippingAddress?.phone}
                      </p>
                      <p className="text-[11px] text-ink-muted">
                        {formatDate(v.createdAt, lang)} · {(lang === 'ar' ? v.methodName : v.methodNameEn) || v.paymentMethodCode}
                      </p>
                    </div>
                  </div>

                  <div className="text-end">
                    <p className="text-base font-bold text-rose">{formatPrice(v.amount, lang)}</p>
                    {v.reference ? <p className="font-en text-[11px] text-ink-muted">{v.reference}</p> : null}
                  </div>
                </div>

                {/* الإيصال */}
                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-black/5 pt-3">
                  {v.receiptUrl ? (
                    <button
                      type="button"
                      onClick={() => setPreview(v)}
                      className="group relative shrink-0 overflow-hidden rounded-xl border border-black/10"
                      aria-label={t('admin.receiptPreview')}
                    >
                      <SmartImage src={v.receiptUrl} alt={t('admin.receipt')} className="h-24 w-24 object-cover" />
                      <span className="absolute inset-0 grid place-items-center bg-ink/0 text-white opacity-0 transition group-hover:bg-ink/40 group-hover:opacity-100">
                        <FiZoomIn size={18} />
                      </span>
                    </button>
                  ) : (
                    <div className="grid h-24 w-24 shrink-0 place-items-center rounded-xl bg-blush text-[11px] text-ink-muted">
                      {t('admin.noData')}
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1 text-xs">
                    {v.customerNote ? (
                      <p className="text-ink-soft">{t('payment.customerNote')}: {v.customerNote}</p>
                    ) : null}
                    {v.adminNote ? (
                      <p className={cn('font-semibold', v.status === 'rejected' ? 'text-red-600' : 'text-emerald-600')}>
                        {v.status === 'rejected' ? t('payment.rejectionReason') : t('admin.adminNote')}: {v.adminNote}
                      </p>
                    ) : null}
                    {v.reviewedAt ? (
                      <p className="text-ink-muted">
                        {t('admin.reviewedAt')}: {formatDate(v.reviewedAt, lang)}
                      </p>
                    ) : null}
                  </div>

                  {/* الإجراءات: للمراجعات المعلقة فقط */}
                  {v.status === 'pending' ? (
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" icon={FiCheck} onClick={() => setApproving(v)}>
                        {t('admin.approvePayment')}
                      </Button>
                      <Button size="sm" variant="danger" icon={FiX} onClick={() => setRejecting(v)}>
                        {t('admin.rejectPayment')}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* معاينة الإيصال + تفاصيل الطلب */}
      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={t('admin.receiptPreview')} size="lg">
        {preview ? (
          <div className="grid gap-5 p-6 md:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-3">
              {preview.receiptUrl ? (
                <>
                  <SmartImage
                    src={preview.receiptUrl}
                    alt={t('admin.receipt')}
                    className="max-h-72 w-full rounded-xl border border-black/10 object-contain"
                  />
                  <div className="flex gap-2">
                    <Button size="xs" variant="outline" icon={FiZoomIn} onClick={() => setZoomUrl(preview.receiptUrl)}>
                      {t('admin.openImage')}
                    </Button>
                    {preview.receiptUrl ? (
                      <a
                        href={preview.receiptUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-rose hover:text-rose"
                      >
                        <FiExternalLink size={13} /> {t('admin.openImage')}
                      </a>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="rounded-xl bg-blush p-6 text-center text-sm text-ink-muted">{t('admin.noData')}</p>
              )}
            </div>
            <dl className="space-y-2.5 text-sm">
              {[
                { k: t('orders.orderNumber'), v: preview.orderNumber },
                { k: t('admin.customer'), v: [preview.shippingAddress?.name, preview.guestPhone || preview.shippingAddress?.phone].filter(Boolean).join(' · ') },
                { k: t('admin.paymentMethodFilter'), v: (lang === 'ar' ? preview.methodName : preview.methodNameEn) || preview.paymentMethodCode },
                { k: t('admin.amount'), v: formatPrice(preview.amount, lang) },
                { k: t('payment.statusPending'), v: t(STATUS_META[preview.status]?.ar || 'payment.statusPending') },
                { k: t('orders.orderDate'), v: formatDate(preview.orderCreatedAt || preview.createdAt, lang) },
              ].map((r) => (
                <div key={r.k} className="flex items-start justify-between gap-3 rounded-xl bg-cream px-3 py-2">
                  <dt className="text-xs text-ink-muted">{r.k}</dt>
                  <dd className="text-end text-xs font-bold text-ink">{r.v || '—'}</dd>
                </div>
              ))}
              {preview.status === 'pending' ? (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="flex-1" icon={FiCheck} onClick={() => { setApproving(preview); setPreview(null); }}>
                    {t('admin.approvePayment')}
                  </Button>
                  <Button size="sm" variant="danger" className="flex-1" icon={FiX} onClick={() => { setRejecting(preview); setPreview(null); }}>
                    {t('admin.rejectPayment')}
                  </Button>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
      </Modal>

      {/* تأكيد الموافقة */}
      <ConfirmDialog
        open={Boolean(approving)}
        onClose={() => { setApproving(null); setApproveNote(''); }}
        onConfirm={() => approve.mutate({ id: approving._id, adminNote: approveNote || null })}
        title={t('admin.approvePayment')}
        message={`${t('admin.approveConfirm')}\n${approving?.orderNumber || ''} — ${approving ? formatPrice(approving.amount, lang) : ''}`}
        confirmText={t('admin.approvePayment')}
        cancelText={t('common.cancel')}
      />

      {/* رفض مع سبب إلزامي */}
      <Modal open={Boolean(rejecting)} onClose={() => { setRejecting(null); setRejectNote(''); }} title={t('admin.rejectPayment')} size="md">
        {rejecting ? (
          <div className="space-y-4 p-6">
            <p className="text-xs text-ink-muted">
              {rejecting.orderNumber} — {formatPrice(rejecting.amount, lang)}
            </p>
            <Select
              label={t('admin.rejectReason')}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              options={REJECT_REASONS.map((k) => ({ value: t(k), label: t(k) }))}
            />
            <Textarea
              label={t('admin.adminNote')}
              rows={2}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              hint={t('payment.noteOptional')}
            />
            <div className="flex gap-3">
              <Button
                variant="danger"
                className="flex-1"
                loading={reject.isPending}
                onClick={() => reject.mutate({ id: rejecting._id, reason: [t(rejectReason), rejectNote].filter(Boolean).join(' — ') })}
              >
                {t('admin.rejectPayment')}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setRejecting(null); setRejectNote(''); }}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* تكبير الإيصال */}
      <Modal open={Boolean(zoomUrl)} onClose={() => setZoomUrl(null)} title={t('admin.receiptPreview')} size="lg">
        {zoomUrl ? (
          <div className="p-6">
            <SmartImage src={zoomUrl} alt={t('admin.receipt')} className="max-h-[70vh] w-full rounded-xl object-contain" />
          </div>
        ) : null}
      </Modal>
    </>
  );
}
