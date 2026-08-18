import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiMessageSquare, FiSend, FiUser } from 'react-icons/fi';
import { toast } from 'react-toastify';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import DataTable from '@/components/admin/DataTable';
import Input, { Select, Textarea } from '@/components/forms/Input';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import RowActions from '@/components/admin/RowActions';
import client from '@/api/client';
import { useI18n } from '@/i18n';
import { formatDate, timeAgo } from '@/utils/format';
import { cn } from '@/utils/helpers';

const STATUS_META = {
  open: { ar: 'مفتوحة', en: 'Open', color: 'bg-sky-100 text-sky-700' },
  pending: { ar: 'بانتظار الرد', en: 'Pending', color: 'bg-amber-100 text-amber-700' },
  answered: { ar: 'تم الرد', en: 'Answered', color: 'bg-indigo-100 text-indigo-700' },
  resolved: { ar: 'تم الحل', en: 'Resolved', color: 'bg-emerald-100 text-emerald-700' },
  closed: { ar: 'مغلقة', en: 'Closed', color: 'bg-stone-200 text-stone-700' }
};

const PRIORITY_META = {
  low: { ar: 'منخفضة', en: 'Low', color: 'bg-stone-100 text-stone-600' },
  normal: { ar: 'عادية', en: 'Normal', color: 'bg-sky-100 text-sky-700' },
  high: { ar: 'مرتفعة', en: 'High', color: 'bg-amber-100 text-amber-700' },
  urgent: { ar: 'عاجلة', en: 'Urgent', color: 'bg-red-100 text-red-700' }
};

/** مركز خدمة العملاء: التذاكر، الردود، الإسناد، الملاحظات الداخلية */
export default function AdminSupport() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ status: 'all', priority: 'all', q: '' });
  const [viewing, setViewing] = useState(null);
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [deleting, setDeleting] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'tickets', filters],
    queryFn: () =>
      client.get('/admin/tickets', {
        params: {
          ...(filters.status !== 'all' ? { status: filters.status } : {}),
          ...(filters.priority !== 'all' ? { priority: filters.priority } : {}),
          ...(filters.q ? { q: filters.q } : {})
        }
      }).then((r) => r.data?.data)
  });
  const tickets = data?.tickets || [];

  const { data: staffData } = useQuery({
    queryKey: ['admin', 'staff'],
    queryFn: () => client.get('/admin/tickets/staff').then((r) => r.data?.data)
  });
  const staff = staffData?.staff || [];

  const { data: detail } = useQuery({
    queryKey: ['admin', 'ticket', viewing?._id],
    queryFn: () => client.get(`/admin/tickets/${viewing._id}`).then((r) => r.data?.data?.ticket),
    enabled: Boolean(viewing?._id)
  });
  const current = detail || viewing;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'tickets'] });
    qc.invalidateQueries({ queryKey: ['admin', 'ticket'] });
    qc.invalidateQueries({ queryKey: ['admin', 'notifications'] });
  };

  const sendReply = useMutation({
    mutationFn: ({ id, message }) => client.post(`/admin/tickets/${id}/reply`, { message }),
    onSuccess: () => { toast.success(t('admin.replySent')); setReply(''); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const update = useMutation({
    mutationFn: ({ id, payload }) => client.put(`/admin/tickets/${id}`, payload),
    onSuccess: () => { toast.success(t('admin.saved')); invalidate(); }
  });

  const addNote = useMutation({
    mutationFn: ({ id, note: n }) => client.post(`/admin/tickets/${id}/notes`, { note: n }),
    onSuccess: () => { toast.success(t('admin.saved')); setNote(''); invalidate(); }
  });

  const remove = useMutation({
    mutationFn: (id) => client.delete(`/admin/tickets/${id}`),
    onSuccess: () => { toast.success(t('admin.deleted')); setDeleting(null); invalidate(); }
  });

  const columns = [
    {
      key: 'ticketNumber',
      header: t('admin.ticketNumber'),
      render: (tk) => (
        <div className="min-w-0">
          <p className={cn('font-en text-sm', tk.unreadByAdmin ? 'font-bold text-ink' : 'text-ink-soft')}>
            {tk.unreadByAdmin ? '● ' : ''}{tk.ticketNumber}
          </p>
          <p className="clamp-1 text-[11px] text-ink-muted">{timeAgo(tk.lastReplyAt, lang)}</p>
        </div>
      )
    },
    {
      key: 'subject',
      header: t('admin.subject'),
      render: (tk) => (
        <div className="min-w-0 max-w-[240px]">
          <p className="clamp-1 text-sm font-semibold text-ink">{tk.subject}</p>
          <p className="clamp-1 text-[11px] text-ink-muted">{tk.name} · {tk.email}</p>
        </div>
      )
    },
    { key: 'category', header: t('common.category'), render: (tk) => <span className="text-xs">{t(`support.cat.${tk.category}`)}</span>, hideOnMobile: true },
    {
      key: 'priority',
      header: t('admin.priority'),
      render: (tk) => {
        const m = PRIORITY_META[tk.priority] || PRIORITY_META.normal;
        return <Badge className={m.color}>{m[lang] || m.ar}</Badge>;
      }
    },
    {
      key: 'assignedTo',
      header: t('admin.assignedTo'),
      render: (tk) => <span className="text-xs text-ink-muted">{tk.assignedTo?.name || '—'}</span>,
      hideOnMobile: true
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (tk) => {
        const m = STATUS_META[tk.status] || STATUS_META.open;
        return <Badge className={m.color}>{m[lang] || m.ar}</Badge>;
      }
    }
  ];

  return (
    <>
      <AdminPageHeader
        title={t('admin.support')}
        subtitle={data?.unreadCount ? `${data.unreadCount} ${t('admin.unread')}` : undefined}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold outline-none focus:border-rose"
        >
          <option value="all">{t('common.all')} ({data?.total ?? 0})</option>
          {Object.entries(STATUS_META).map(([k, m]) => (
            <option key={k} value={k}>{m[lang] || m.ar} ({data?.statusCounts?.[k] || 0})</option>
          ))}
        </select>
        <select
          value={filters.priority}
          onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
          className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold outline-none focus:border-rose"
        >
          <option value="all">{t('admin.priority')}</option>
          {Object.entries(PRIORITY_META).map(([k, m]) => (
            <option key={k} value={k}>{m[lang] || m.ar}</option>
          ))}
        </select>
        <input
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          placeholder={t('admin.searchPlaceholder')}
          className="min-w-[180px] flex-1 rounded-full border border-black/10 bg-white px-4 py-2 text-xs outline-none focus:border-rose"
        />
      </div>

      <DataTable
        columns={columns}
        data={tickets}
        loading={isLoading}
        searchable={false}
        actions={(row) => <RowActions onView={() => setViewing(row)} onDelete={() => setDeleting(row._id)} />}
      />

      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={current?.subject} size="lg">
        {current ? (
          <div className="space-y-5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cream p-4">
              <div className="min-w-0">
                <p className="font-en text-sm font-bold text-ink">{current.ticketNumber}</p>
                <p className="text-xs text-ink-muted">{current.name} · {current.email}</p>
                {current.phone ? <p dir="ltr" className="text-xs text-ink-muted rtl:text-end">{current.phone}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={current.status}
                  onChange={(e) => update.mutate({ id: current._id, payload: { status: e.target.value } })}
                  className={cn('cursor-pointer rounded-lg border-0 px-2.5 py-1.5 text-[11px] font-bold', (STATUS_META[current.status] || STATUS_META.open).color)}
                >
                  {Object.entries(STATUS_META).map(([k, m]) => (
                    <option key={k} value={k}>{m[lang] || m.ar}</option>
                  ))}
                </select>
                <select
                  value={current.priority}
                  onChange={(e) => update.mutate({ id: current._id, payload: { priority: e.target.value } })}
                  className={cn('cursor-pointer rounded-lg border-0 px-2.5 py-1.5 text-[11px] font-bold', (PRIORITY_META[current.priority] || PRIORITY_META.normal).color)}
                >
                  {Object.entries(PRIORITY_META).map(([k, m]) => (
                    <option key={k} value={k}>{m[lang] || m.ar}</option>
                  ))}
                </select>
                <select
                  value={current.assignedTo?._id || current.assignedTo || ''}
                  onChange={(e) => update.mutate({ id: current._id, payload: { assignedTo: e.target.value } })}
                  className="cursor-pointer rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[11px] font-semibold outline-none focus:border-rose"
                >
                  <option value="">{t('admin.unassigned')}</option>
                  {staff.map((u) => (
                    <option key={u._id} value={u._id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {current.order ? (
              <p className="text-xs text-ink-muted">
                {t('orders.orderNumber')}: <span className="font-en font-bold text-ink">{current.order.orderNumber}</span>
              </p>
            ) : null}

            {/* المحادثة */}
            <div className="max-h-[320px] space-y-3 overflow-y-auto rounded-xl border border-black/5 p-4">
              {current.messages?.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-xl p-3',
                    m.authorType === 'staff' ? 'ms-8 bg-blush/60' : 'me-8 bg-cream'
                  )}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className={cn('grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold',
                      m.authorType === 'staff' ? 'bg-rose text-white' : 'bg-ink text-white')}>
                      {m.authorType === 'staff' ? 'S' : <FiUser size={11} />}
                    </span>
                    <span className="text-[11px] font-bold text-ink">{m.authorName || '—'}</span>
                    <span className="text-[10px] text-ink-muted">{formatDate(m.at, lang, true)}</span>
                  </div>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{m.body}</p>
                </div>
              ))}
            </div>

            {/* الرد */}
            <div>
              <Textarea
                label={t('admin.reply')}
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={t('admin.typeReply')}
              />
              <Button
                className="mt-3"
                icon={FiSend}
                loading={sendReply.isPending}
                onClick={() => reply.trim() && sendReply.mutate({ id: current._id, message: reply })}
              >
                {t('admin.sendReply')}
              </Button>
            </div>

            {/* ملاحظات داخلية */}
            <div className="rounded-xl border border-black/5 p-4">
              <p className="mb-3 text-xs font-bold text-ink-muted">{t('admin.internalNotes')}</p>
              {current.internalNotes?.length ? (
                <ul className="mb-3 space-y-2">
                  {current.internalNotes.map((n, i) => (
                    <li key={i} className="rounded-lg bg-amber-50 p-2.5 text-xs">
                      <p className="text-ink">{n.note}</p>
                      <p className="mt-1 text-[10px] text-ink-muted">
                        {n.author?.name || n.authorName || ''} · {formatDate(n.at, lang, true)}
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

            {current.rating ? (
              <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
                {t('admin.customerRating')}: {'★'.repeat(current.rating)} — {current.ratingComment || ''}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting)}
        title={t('admin.confirmDelete')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}
