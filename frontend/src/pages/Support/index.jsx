import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiMessageSquare, FiPlus, FiSend, FiUser } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/common/PageHeader';
import Input, { Select, Textarea } from '@/components/forms/Input';
import Modal from '@/components/ui/Modal';
import { TableSkeleton } from '@/components/ui/Skeleton';
import client from '@/api/client';
import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import { formatDate, timeAgo } from '@/utils/format';
import { cn } from '@/utils/helpers';

const STATUS_META = {
  open: { ar: 'مفتوحة', en: 'Open', color: 'bg-sky-100 text-sky-700' },
  pending: { ar: 'بانتظار الرد', en: 'Pending', color: 'bg-amber-100 text-amber-700' },
  answered: { ar: 'تم الرد', en: 'Answered', color: 'bg-indigo-100 text-indigo-700' },
  resolved: { ar: 'تم الحل', en: 'Resolved', color: 'bg-emerald-100 text-emerald-700' },
  closed: { ar: 'مغلقة', en: 'Closed', color: 'bg-stone-200 text-stone-700' }
};

/** مركز الدعم للعميل: فتح التذاكر ومتابعة المحادثة */
export default function SupportCenter() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { settings } = useConfig();
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [reply, setReply] = useState('');
  const [form, setForm] = useState({ subject: '', message: '', category: 'general' });

  const { data, isLoading } = useQuery({
    queryKey: ['my-tickets'],
    queryFn: () => client.get('/tickets/my').then((r) => r.data?.data)
  });
  const tickets = data?.tickets || [];

  const { data: detail } = useQuery({
    queryKey: ['my-ticket', viewing?._id],
    queryFn: () => client.get(`/tickets/${viewing._id}`).then((r) => r.data?.data?.ticket),
    enabled: Boolean(viewing?._id)
  });
  const current = detail || viewing;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['my-tickets'] });
    qc.invalidateQueries({ queryKey: ['my-ticket'] });
  };

  const create = useMutation({
    mutationFn: (payload) => client.post('/tickets', payload),
    onSuccess: (r) => {
      toast.success(r.data?.message || t('support.created'));
      setCreating(false);
      setForm({ subject: '', message: '', category: 'general' });
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const sendReply = useMutation({
    mutationFn: ({ id, message }) => client.post(`/tickets/${id}/reply`, { message }),
    onSuccess: () => { toast.success(t('support.replySent')); setReply(''); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const categories = settings.support?.categories || ['general', 'order', 'payment', 'shipping', 'return', 'product'];

  return (
    <>
      <PageHeader title={t('support.title')} subtitle={t('support.subtitle')} breadcrumbs={[{ label: t('support.title') }]}>
        <Button icon={FiPlus} onClick={() => setCreating(true)}>
          {t('support.newTicket')}
        </Button>
      </PageHeader>

      <div className="container-x py-8">
        {isLoading ? (
          <TableSkeleton rows={3} cols={1} />
        ) : tickets.length ? (
          <ul className="space-y-3">
            {tickets.map((tk) => {
              const meta = STATUS_META[tk.status] || STATUS_META.open;
              return (
                <li key={tk._id}>
                  <button
                    type="button"
                    onClick={() => setViewing(tk)}
                    className="flex w-full flex-wrap items-center gap-4 rounded-2xl border border-black/5 bg-white p-5 text-start shadow-soft transition hover:border-rose/40"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blush text-rose">
                      <FiMessageSquare size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="clamp-1 text-sm font-bold text-ink">
                        {tk.unreadByCustomer ? <span className="me-1 text-rose">●</span> : null}
                        {tk.subject}
                      </p>
                      <p className="text-[11px] text-ink-muted">
                        <span className="font-en">{tk.ticketNumber}</span> · {timeAgo(tk.lastReplyAt, lang)}
                      </p>
                    </div>
                    <Badge className={meta.color}>{meta[lang] || meta.ar}</Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-2xl border border-black/5 bg-white shadow-soft">
            <EmptyState
              icon={FiMessageSquare}
              title={t('support.empty')}
              description={t('support.emptyDesc')}
              actionLabel={t('support.newTicket')}
              onAction={() => setCreating(true)}
            />
          </div>
        )}
      </div>

      {/* تذكرة جديدة */}
      <Modal open={creating} onClose={() => setCreating(false)} title={t('support.newTicket')}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ ...form, name: user?.name, email: user?.email, phone: user?.phone });
          }}
          className="space-y-4 p-6"
        >
          <Select
            label={t('common.category')}
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            options={categories.map((c) => ({ value: c, label: t(`support.cat.${c}`) }))}
          />
          <Input
            label={t('admin.subject')}
            required
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          />
          <Textarea
            label={t('contact.message')}
            rows={5}
            required
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          />
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={create.isPending} className="flex-1">
              {t('support.send')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setCreating(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* المحادثة */}
      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={current?.subject} size="lg">
        {current ? (
          <div className="space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cream p-4">
              <span className="font-en text-sm font-bold text-ink">{current.ticketNumber}</span>
              <Badge className={(STATUS_META[current.status] || STATUS_META.open).color}>
                {(STATUS_META[current.status] || STATUS_META.open)[lang]}
              </Badge>
            </div>

            <div className="max-h-[340px] space-y-3 overflow-y-auto">
              {current.messages?.map((m, i) => (
                <div
                  key={i}
                  className={cn('rounded-xl p-3', m.authorType === 'staff' ? 'me-6 bg-blush/60' : 'ms-6 bg-cream')}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={cn(
                        'grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-white',
                        m.authorType === 'staff' ? 'bg-rose' : 'bg-ink'
                      )}
                    >
                      {m.authorType === 'staff' ? '★' : <FiUser size={11} />}
                    </span>
                    <span className="text-[11px] font-bold text-ink">
                      {m.authorType === 'staff' ? t('support.team') : m.authorName || t('nav.account')}
                    </span>
                    <span className="text-[10px] text-ink-muted">{formatDate(m.at, lang, true)}</span>
                  </div>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{m.body}</p>
                </div>
              ))}
            </div>

            {current.status !== 'closed' || true ? (
              <div>
                <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t('support.typeReply')} />
                <Button
                  className="mt-3"
                  icon={FiSend}
                  loading={sendReply.isPending}
                  onClick={() => reply.trim() && sendReply.mutate({ id: current._id, message: reply })}
                >
                  {t('support.send')}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
