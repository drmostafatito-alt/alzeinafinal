import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiCopy, FiKey, FiPlus, FiShield, FiTrash2, FiUserCheck, FiUserX, FiUsers } from 'react-icons/fi';
import { toast } from 'react-toastify';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import DataTable from '@/components/admin/DataTable';
import Input, { Select } from '@/components/forms/Input';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import RowActions from '@/components/admin/RowActions';
import client from '@/api/client';
import { useI18n } from '@/i18n';
import { formatDate } from '@/utils/format';

/**
 * إدارة فريق العمل.
 *
 * الصلاحيات نفسها موجودة مسبقاً في الإعدادات ← الصلاحيات؛ هذه الشاشة
 * تُدير **من ينتمي للفريق** لا ما يستطيع كل دور فعله. الفصل مقصود:
 * تعريف الأدوار عملية نادرة، وإضافة موظف عملية متكرّرة.
 */
export default function AdminStaff() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [tempPassword, setTempPassword] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'staff'],
    queryFn: () => client.get('/admin/staff').then((r) => r.data?.data),
  });

  const staff = data?.staff || [];
  const roles = data?.roles || [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  useEffect(() => {
    if (!modalOpen) return;
    reset(editing
      ? { name: editing.name, email: editing.email, phone: editing.phone || '', staffRole: editing.staffRole }
      : { name: '', email: '', phone: '', password: '', staffRole: 'support' });
  }, [modalOpen, editing, reset]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'staff'] });
  const onError = (e) => toast.error(e?.response?.data?.message || t('common.error'));

  const save = useMutation({
    mutationFn: (v) => (editing
      ? client.put(`/admin/staff/${editing._id}`, v)
      : client.post('/admin/staff', v)),
    onSuccess: () => { toast.success(t('admin.saved')); setModalOpen(false); setEditing(null); invalidate(); },
    onError,
  });

  const toggleActive = useMutation({
    mutationFn: (row) => client.put(`/admin/staff/${row._id}`, { isActive: !row.isActive }),
    onSuccess: invalidate,
    onError,
  });

  const resetPassword = useMutation({
    mutationFn: (row) => client.post(`/admin/staff/${row._id}/reset-password`),
    onSuccess: (r) => { setTempPassword(r.data?.data); invalidate(); },
    onError,
  });

  const remove = useMutation({
    mutationFn: (row) => client.delete(`/admin/staff/${row._id}`),
    onSuccess: () => { toast.success(t('admin.deleted')); setRemoving(null); invalidate(); },
    onError,
  });

  const roleLabel = (key) => {
    const r = roles.find((x) => x.key === key);
    if (!r) return key;
    return lang === 'ar' ? r.name : r.nameEn;
  };

  const columns = [
    {
      key: 'name',
      header: t('common.name'),
      render: (row) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">
            {row.name}
            {row.isSuperAdmin ? <FiShield size={12} className="shrink-0 text-rose" title={t('a6.staff.superAdmin')} /> : null}
          </p>
          <p className="font-en truncate text-[11px] text-ink-muted">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'staffRole',
      header: t('a6.staff.role'),
      render: (row) => (
        <Badge className={row.isSuperAdmin ? 'bg-rose/15 text-rose' : 'bg-stone-200 text-stone-700'}>
          {row.isSuperAdmin ? t('a6.staff.superAdmin') : roleLabel(row.staffRole)}
        </Badge>
      ),
    },
    {
      key: 'isActive',
      /* لا نُعيد استخدام a3.status: نصّه "حالة النشر" ويخص المنتجات */
      header: t('a6.staff.accountStatus'),
      render: (row) => (
        <Badge className={row.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-600'}>
          {row.isActive ? t('a6.staff.active') : t('a6.staff.inactive')}
        </Badge>
      ),
    },
    {
      key: 'lastLogin',
      header: t('a6.staff.lastLogin'),
      hideOnMobile: true,
      render: (row) => (
        <span className="text-xs text-ink-muted">
          {row.lastLogin ? formatDate(row.lastLogin, lang, true) : t('a6.staff.never')}
        </span>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader title={t('a6.staff.title')} subtitle={t('a6.staff.subtitle')}>
        <Button size="sm" icon={FiPlus} onClick={() => { setEditing(null); setModalOpen(true); }}>
          {t('a6.staff.add')}
        </Button>
      </AdminPageHeader>

      <DataTable
        columns={columns}
        data={staff}
        loading={isLoading}
        searchKeys={['name', 'email', 'phone']}
        emptyIcon={FiUsers}
        emptyTitle={t('a6.staff.empty')}
        emptyDescription={t('a6.staff.emptyDesc')}
        emptyActionLabel={t('a6.staff.add')}
        onEmptyAction={() => { setEditing(null); setModalOpen(true); }}
        actions={(row) => (row.isSuperAdmin ? (
          /* المدير الأعلى بلا إجراءات — الخادم يرفضها أصلاً، فلا نعرض
             أزراراً تفشل عند الضغط */
          <span className="text-[11px] text-ink-muted">{t('a6.staff.superAdminNote')}</span>
        ) : (
          <RowActions
            onEdit={() => { setEditing(row); setModalOpen(true); }}
            onDelete={() => setRemoving(row)}
            extra={
              <>
                <button
                  type="button"
                  onClick={() => resetPassword.mutate(row)}
                  className="rounded-lg p-1.5 text-ink-muted transition hover:bg-blush hover:text-ink"
                  title={t('a6.staff.resetPassword')}
                >
                  <FiKey size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive.mutate(row)}
                  className="rounded-lg p-1.5 text-ink-muted transition hover:bg-blush hover:text-ink"
                  title={row.isActive ? t('a6.staff.inactive') : t('a6.staff.active')}
                >
                  {row.isActive ? <FiUserX size={14} /> : <FiUserCheck size={14} />}
                </button>
              </>
            }
          />
        ))}
      />

      {/* نموذج الموظف */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        title={editing ? t('a6.staff.edit') : t('a6.staff.add')}
        size="md"
      >
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4 p-6">
          <Input
            label={t('common.name')} required error={errors.name?.message}
            {...register('name', { required: t('valid.required') })}
          />
          <Input
            label={t('common.email')} type="email" dir="ltr" required
            disabled={Boolean(editing)}
            hint={editing ? t('profile.security') : undefined}
            error={errors.email?.message}
            {...register('email', { required: t('valid.required') })}
          />
          <Input label={t('common.phone')} type="tel" dir="ltr" {...register('phone')} />

          {!editing ? (
            <Input
              label={t('common.password')} type="password" dir="ltr" required
              hint={t('a6.staff.passwordHint')}
              error={errors.password?.message}
              {...register('password', {
                required: t('valid.required'),
                minLength: { value: 8, message: t('valid.minLength', { n: 8 }) },
              })}
            />
          ) : null}

          <Select
            label={t('a6.staff.role')}
            options={roles.map((r) => ({ value: r.key, label: lang === 'ar' ? r.name : r.nameEn }))}
            {...register('staffRole', { required: true })}
          />

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={save.isPending} className="flex-1">{t('common.save')}</Button>
            <Button type="button" variant="outline" onClick={() => { setModalOpen(false); setEditing(null); }}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* كلمة المرور المؤقتة — تُعرض مرة واحدة */}
      <Modal open={Boolean(tempPassword)} onClose={() => setTempPassword(null)} title={t('a6.staff.tempPassword')} size="sm">
        <div className="space-y-4 p-6">
          <p className="text-sm text-ink-muted">{t('a6.staff.tempPasswordNote')}</p>
          <div className="flex items-center gap-2 rounded-xl bg-cream p-3">
            <code className="font-en flex-1 select-all break-all text-sm font-bold text-ink">
              {tempPassword?.tempPassword}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(tempPassword?.tempPassword || '');
                toast.success(t('common.copied'));
              }}
              className="shrink-0 rounded-lg p-2 text-ink-muted transition hover:bg-white hover:text-ink"
              title={t('common.copy')}
            >
              <FiCopy size={15} />
            </button>
          </div>
          <Button className="w-full" onClick={() => setTempPassword(null)}>{t('common.close')}</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => remove.mutate(removing)}
        title={t('a6.staff.remove')}
        message={t('a6.staff.removeConfirm')}
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}
