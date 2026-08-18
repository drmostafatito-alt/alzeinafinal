import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiCheck, FiCornerUpLeft, FiEdit2, FiEyeOff, FiStar, FiTrash2, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import client from '@/api/client';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import DataTable from '@/components/admin/DataTable';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import Rating from '@/components/ui/Rating';
import Input, { Select, Textarea } from '@/components/forms/Input';
import { useI18n } from '@/i18n';
import { formatDate } from '@/utils/format';
import { cn } from '@/utils/helpers';

const STATUS_META = {
  pending: { variant: 'warning', key: 'admin.pending' },
  approved: { variant: 'success', key: 'admin.approved' },
  rejected: { variant: 'danger', key: 'admin.rejected' }
};

/**
 * إدارة التقييمات: عرض، بحث، فلترة، موافقة/رفض، إخفاء، تعديل، رد، حذف.
 * التقييمات المرفوضة أو المخفية لا تظهر في المتجر ولا تدخل حساب النجوم.
 */
export default function AdminReviews() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();

  const [status, setStatus] = useState('all');
  const [deleting, setDeleting] = useState(null);
  const [editing, setEditing] = useState(null);
  const [replying, setReplying] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reviews', status],
    queryFn: () =>
      client.get('/admin/reviews', { params: { status } }).then((r) => r.data?.data)
  });

  const reviews = data?.reviews || [];
  const summary = data?.summary || {};
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'reviews'] });

  const act = useMutation({
    mutationFn: ({ id, path, method = 'patch', body }) => client[method](`/admin/reviews/${id}${path}`, body),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      setEditing(null);
      setReplying(null);
      setRejecting(null);
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const removeMutation = useMutation({
    mutationFn: (id) => client.delete(`/admin/reviews/${id}`),
    onSuccess: () => {
      toast.success(t('admin.deleted'));
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const columns = [
    {
      key: 'user.name',
      header: t('admin.customer'),
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar src={r.user?.avatar} name={r.user?.name} size={36} />
          <div className="min-w-0">
            <p className="clamp-1 text-sm font-semibold text-ink">{r.user?.name || '—'}</p>
            <p className="text-[11px] text-ink-muted">{formatDate(r.createdAt, lang)}</p>
            {r.isVerified ? (
              <span className="text-[10px] font-bold text-emerald-600">{t('admin.verifiedPurchase')}</span>
            ) : null}
          </div>
        </div>
      )
    },
    { key: 'rating', header: t('product.rating'), render: (r) => <Rating value={r.rating} size={13} showValue /> },
    {
      key: 'comment',
      header: t('contact.message'),
      render: (r) => (
        <div className="max-w-sm">
          {r.title ? <p className="text-xs font-bold text-ink">{r.title}</p> : null}
          <p className="clamp-2 text-xs text-ink-muted">{r.comment}</p>
          {r.reply?.text ? (
            <p className="clamp-1 mt-1 text-[11px] text-rose">↳ {r.reply.text}</p>
          ) : null}
        </div>
      )
    },
    {
      key: 'product',
      header: t('admin.products'),
      render: (r) => <span className="clamp-1 text-xs text-ink-muted">{r.product?.name || '—'}</span>,
      hideOnMobile: true
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (r) => {
        const meta = STATUS_META[r.status] || STATUS_META.approved;
        return (
          <div className="flex flex-col gap-1">
            <Badge variant={meta.variant}>{t(meta.key)}</Badge>
            {r.isActive === false ? <Badge variant="neutral">{t('common.inactive')}</Badge> : null}
          </div>
        );
      }
    }
  ];

  return (
    <>
      <AdminPageHeader
        title={t('admin.reviews')}
        subtitle={`${reviews.length}${summary.pending ? ` · ${summary.pending} ${t('admin.pending')}` : ''}`}
      />

      {/* فلترة سريعة بالحالة */}
      <div className="mb-4 flex flex-wrap gap-2">
        {['all', 'pending', 'approved', 'rejected'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={cn(
              'rounded-full px-4 py-2 text-xs font-semibold transition',
              status === s ? 'bg-ink text-white' : 'bg-white text-ink-soft hover:bg-blush'
            )}
          >
            {s === 'all' ? t('common.all') : t(STATUS_META[s].key)}
            {summary[s] ? ` (${summary[s]})` : ''}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={reviews}
        loading={isLoading}
        searchKeys={['comment', 'title', 'user.name']}
        emptyIcon={FiStar}
        emptyTitle={t('a5.empty.reviews.title')}
        emptyDescription={t('a5.empty.reviews.desc')}
        actions={(row) => (
          <div className="flex flex-wrap gap-1">
            {row.status !== 'approved' ? (
              <button
                type="button"
                onClick={() => act.mutate({ id: row._id, path: '/status', body: { status: 'approved' } })}
                className="grid h-8 w-8 place-items-center rounded-lg text-emerald-600 transition hover:bg-emerald-50"
                title={t('admin.approve')}
                aria-label={t('admin.approve')}
              >
                <FiCheck size={15} />
              </button>
            ) : null}
            {row.status !== 'rejected' ? (
              <button
                type="button"
                onClick={() => setRejecting(row)}
                className="grid h-8 w-8 place-items-center rounded-lg text-red-600 transition hover:bg-red-50"
                title={t('admin.reject')}
                aria-label={t('admin.reject')}
              >
                <FiX size={15} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => act.mutate({ id: row._id, path: '/isActive' })}
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-blush"
              title={t('common.hide')}
              aria-label={t('common.hide')}
            >
              <FiEyeOff size={15} />
            </button>
            <button
              type="button"
              onClick={() => setReplying(row)}
              className="grid h-8 w-8 place-items-center rounded-lg text-rose transition hover:bg-blush"
              title={t('admin.replyToReview')}
              aria-label={t('admin.replyToReview')}
            >
              <FiCornerUpLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => setEditing(row)}
              className="grid h-8 w-8 place-items-center rounded-lg text-ink transition hover:bg-blush"
              title={t('common.edit')}
              aria-label={t('common.edit')}
            >
              <FiEdit2 size={15} />
            </button>
            <button
              type="button"
              onClick={() => setDeleting(row._id)}
              className="grid h-8 w-8 place-items-center rounded-lg text-red-600 transition hover:bg-red-50"
              title={t('common.delete')}
              aria-label={t('common.delete')}
            >
              <FiTrash2 size={15} />
            </button>
          </div>
        )}
      />

      {/* رفض مع سبب */}
      <Modal open={Boolean(rejecting)} onClose={() => setRejecting(null)} title={t('admin.reject')} size="sm">
        {rejecting ? (
          <form
            className="space-y-4 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              act.mutate({
                id: rejecting._id,
                path: '/status',
                body: { status: 'rejected', rejectionReason: new FormData(e.currentTarget).get('reason') }
              });
            }}
          >
            <p className="clamp-2 text-sm text-ink-muted">{rejecting.comment}</p>
            <Textarea label={t('admin.rejectionReason')} name="reason" rows={3} />
            <div className="flex gap-2">
              <Button type="submit" variant="danger" className="flex-1" loading={act.isPending}>
                {t('admin.reject')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setRejecting(null)}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      {/* رد المتجر */}
      <Modal open={Boolean(replying)} onClose={() => setReplying(null)} title={t('admin.replyToReview')} size="sm">
        {replying ? (
          <form
            className="space-y-4 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              act.mutate({
                id: replying._id,
                path: '/reply',
                method: 'post',
                body: { text: new FormData(e.currentTarget).get('text') }
              });
            }}
          >
            <p className="clamp-3 rounded-xl bg-cream p-3 text-sm text-ink-muted">{replying.comment}</p>
            <Textarea label={t('admin.replyToReview')} name="text" rows={3} defaultValue={replying.reply?.text} />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" loading={act.isPending}>
                {t('common.save')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setReplying(null)}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      {/* تعديل التقييم */}
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={t('common.edit')} size="sm">
        {editing ? (
          <form
            className="space-y-4 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              act.mutate({
                id: editing._id,
                path: '',
                method: 'put',
                body: {
                  rating: Number(fd.get('rating')),
                  title: fd.get('title'),
                  comment: fd.get('comment')
                }
              });
            }}
          >
            <Select
              label={t('product.rating')}
              name="rating"
              defaultValue={String(editing.rating)}
              options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} ★` }))}
            />
            <Input label={t('common.name')} name="title" defaultValue={editing.title} />
            <Textarea label={t('contact.message')} name="comment" rows={4} defaultValue={editing.comment} />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" loading={act.isPending}>
                {t('common.save')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => removeMutation.mutate(deleting)}
        title={t('admin.confirmDelete')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}
