import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FiCheck, FiMail } from 'react-icons/fi';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import DataTable from '@/components/admin/DataTable';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import RowActions from '@/components/admin/RowActions';
import { useAdminResource } from '@/hooks/useAdminResource';
import { adminService } from '@/services';
import { useI18n } from '@/i18n';
import { formatDate } from '@/utils/format';
import { cn } from '@/utils/helpers';

export default function AdminMessages() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const res = useAdminResource('messages', adminService.messages, 'messages');
  const [viewing, setViewing] = useState(null);

  const markRead = useMutation({
    mutationFn: (id) => adminService.messages.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'messages'] }),
  });

  const open = (m) => {
    setViewing(m);
    if (!m.isRead) markRead.mutate(m._id);
  };

  const unread = res.items.filter((m) => !m.isRead).length;

  const columns = [
    {
      key: 'name',
      header: t('common.name'),
      render: (m) => (
        <div className={cn('min-w-0', !m.isRead && 'font-bold')}>
          <p className="clamp-1 flex items-center gap-2 text-sm text-ink">
            {!m.isRead ? <span className="h-2 w-2 shrink-0 rounded-full bg-rose" /> : null}
            {m.name}
          </p>
          <p className="clamp-1 text-[11px] font-normal text-ink-muted">{m.email}</p>
        </div>
      ),
    },
    { key: 'subject', header: t('admin.subject'), render: (m) => <p className="clamp-1 max-w-[200px] text-sm text-ink">{m.subject}</p> },
    { key: 'message', header: t('admin.message'), render: (m) => <p className="clamp-2 max-w-sm text-xs text-ink-muted">{m.message}</p>, hideOnMobile: true },
    { key: 'createdAt', header: t('common.date'), render: (m) => <span className="text-xs text-ink-muted">{formatDate(m.createdAt, lang)}</span> },
    {
      key: 'isRead',
      header: t('common.status'),
      render: (m) => (
        <Badge variant={m.isRead ? 'neutral' : 'rose'}>{m.isRead ? t('admin.read') : t('admin.unread')}</Badge>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        title={t('admin.messages')}
        subtitle={`${res.items.length} — ${unread} ${t('admin.unread')}`}
      />

      <DataTable
        columns={columns}
        data={res.items}
        loading={res.isLoading}
        searchKeys={['name', 'email', 'subject', 'message']}
        actions={(row) => <RowActions onView={() => open(row)} onDelete={() => res.setDeleting(row._id)} />}
      />

      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing?.subject}>
        {viewing ? (
          <div className="space-y-4 p-6">
            <div className="rounded-xl bg-cream p-4 text-sm">
              <p className="font-bold text-ink">{viewing.name}</p>
              <p className="text-xs text-ink-muted">{viewing.email}</p>
              {viewing.phone ? (
                <p dir="ltr" className="text-xs text-ink-muted rtl:text-end">
                  {viewing.phone}
                </p>
              ) : null}
              <p className="mt-1 text-[11px] text-ink-muted">{formatDate(viewing.createdAt, lang, true)}</p>
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{viewing.message}</p>
            <div className="flex gap-3 pt-2">
              <Button href={`mailto:${viewing.email}?subject=Re: ${viewing.subject}`} icon={FiMail} className="flex-1">
                {t('admin.reply')}
              </Button>
              <Button variant="outline" onClick={() => setViewing(null)} icon={FiCheck}>
                {t('common.close')}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(res.deleting)}
        onClose={() => res.setDeleting(null)}
        onConfirm={res.confirmDelete}
        title={t('admin.confirmDelete')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}
