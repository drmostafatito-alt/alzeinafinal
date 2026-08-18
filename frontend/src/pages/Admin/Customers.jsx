import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FiClock, FiDownload, FiHeart, FiMapPin, FiMessageSquare, FiShoppingBag, FiStar, FiTrash2,
  FiUserCheck, FiUsers, FiUserX
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import DataTable from '@/components/admin/DataTable';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import RowActions from '@/components/admin/RowActions';
import SmartImage from '@/components/ui/SmartImage';
import ExportMenu from '@/components/admin/ExportMenu';
import client from '@/api/client';
import { adminService } from '@/services';
import { useI18n } from '@/i18n';
import { formatDate, formatPrice } from '@/utils/format';
import { ORDER_STATUS_META } from '@/utils/constants';
import { cn, localized } from '@/utils/helpers';

export default function AdminCustomers() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [tab, setTab] = useState('orders');

  const { data, isLoading } = useQuery({ queryKey: ['admin', 'users'], queryFn: adminService.users.list });
  const users = data?.data?.users || [];

  /** ملف العميل الكامل — يُجلب عند الفتح فقط */
  const profileQ = useQuery({
    queryKey: ['admin', 'customer-profile', viewing?._id],
    queryFn: () => client.get(`/admin/customers/${viewing._id}/profile`).then((r) => r.data?.data),
    enabled: Boolean(viewing?._id)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => adminService.users.update(id, payload),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'customer-profile'] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => adminService.users.remove(id),
    onSuccess: () => {
      toast.success(t('admin.deleted'));
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const addNote = useMutation({
    mutationFn: ({ id, body }) => client.post(`/admin/customers/${id}/notes`, { body }),
    onSuccess: () => {
      setNoteText('');
      qc.invalidateQueries({ queryKey: ['admin', 'customer-profile'] });
      toast.success(t('admin.saved'));
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const delNote = useMutation({
    mutationFn: ({ id, noteId }) => client.delete(`/admin/customers/${id}/notes/${noteId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'customer-profile'] }),
    onError: () => toast.error(t('common.error'))
  });

  const exportCustomers = useCallback(async () => {
    try {
      const res = await client.get('/admin/customers/export', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customers-${Date.now()}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      toast.error(t('common.error'));
    }
  }, [t]);

  const columns = [
    {
      key: 'name',
      header: t('common.name'),
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar src={u.avatar} name={u.name} size={40} />
          <div className="min-w-0">
            <p className="clamp-1 text-sm font-semibold text-ink">{u.name}</p>
            <p className="clamp-1 text-[11px] text-ink-muted">{u.email}</p>
          </div>
        </div>
      )
    },
    { key: 'phone', header: t('common.phone'), render: (u) => <span dir="ltr">{u.phone || '—'}</span>, hideOnMobile: true },
    { key: 'ordersCount', header: t('admin.ordersCount'), render: (u) => u.ordersCount ?? 0 },
    { key: 'totalSpent', header: t('admin.totalSpent'), render: (u) => formatPrice(u.totalSpent || 0, lang) },
    { key: 'createdAt', header: t('admin.joinDate'), render: (u) => formatDate(u.createdAt, lang), hideOnMobile: true },
    {
      key: 'role',
      header: t('admin.role'),
      render: (u) => (
        <select
          value={u.role}
          onChange={(e) => updateMutation.mutate({ id: u._id, payload: { role: e.target.value } })}
          className="cursor-pointer rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[11px] font-semibold outline-none focus:border-rose"
          aria-label={t('admin.role')}
        >
          <option value="user">{t('admin.customer')}</option>
          <option value="moderator">Moderator</option>
          <option value="admin">{t('admin.admin')}</option>
        </select>
      )
    },
    {
      key: 'isActive',
      header: t('a3.accountStatus'),
      render: (u) => (
        <button
          type="button"
          onClick={() => updateMutation.mutate({ id: u._id, payload: { isActive: !u.isActive } })}
          title={t('common.update')}
        >
          <Badge variant={u.isActive !== false ? 'success' : 'neutral'}>
            {u.isActive !== false ? t('common.active') : t('common.inactive')}
          </Badge>
        </button>
      )
    }
  ];

  const p = profileQ.data;
  const stats = p?.stats;

  const TABS = [
    ['orders', t('a3.purchaseHistory'), FiShoppingBag],
    ['addresses', t('a3.savedAddresses'), FiMapPin],
    ['wishlist', t('a3.customerWishlist'), FiHeart],
    ['viewed', t('product.recentlyViewed'), FiClock],
    ['reviews', t('admin.reviews'), FiStar],
    ['notes', t('a3.customerNotes'), FiMessageSquare]
  ];

  return (
    <>
      <AdminPageHeader title={t('admin.customers')} subtitle={`${users.length} ${t('admin.totalCustomers')}`}>
        <ExportMenu path="/admin/customers/export" filename="customers" label={t('a3.exportCustomers')} />
      </AdminPageHeader>

      <DataTable
        columns={columns}
        data={users}
        loading={isLoading}
        searchKeys={['name', 'email', 'phone']}
        emptyIcon={FiUsers}
        emptyTitle={t('a5.empty.customers.title')}
        emptyDescription={t('a5.empty.customers.desc')}
        actions={(row) => (
          <RowActions
            onView={() => { setViewing(row); setTab('orders'); setNoteText(''); }}
            onDelete={() => setDeleting(row._id)}
          />
        )}
      />

      {/* ملف العميل الكامل */}
      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={t('a3.customerProfile')} size="lg">
        {viewing ? (
          <div className="p-6">
            {/* رأس الملف */}
            <div className="mb-5 flex flex-wrap items-center gap-4">
              <Avatar src={viewing.avatar} name={viewing.name} size={64} />
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-ink">{viewing.name}</h3>
                <p className="text-sm text-ink-muted">{viewing.email}</p>
                <p dir="ltr" className="text-sm text-ink-muted rtl:text-end">{viewing.phone || '—'}</p>
              </div>

              {/* إجراءات سريعة */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={viewing.isActive !== false ? 'outline' : 'primary'}
                  icon={viewing.isActive !== false ? FiUserX : FiUserCheck}
                  onClick={() => {
                    updateMutation.mutate({ id: viewing._id, payload: { isActive: !viewing.isActive } });
                    setViewing((v) => ({ ...v, isActive: !v.isActive }));
                  }}
                >
                  {viewing.isActive !== false ? t('common.inactive') : t('common.active')}
                </Button>
              </div>
            </div>

            {/* الإحصائيات */}
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                [t('admin.ordersCount'), stats?.totalOrders ?? '—'],
                [t('a3.totalSpending'), stats ? formatPrice(stats.totalSpent, lang) : '—'],
                [t('a3.avgOrderValue'), stats ? formatPrice(stats.averageOrderValue, lang) : '—'],
                [t('a3.lastOrder'), stats?.lastOrderAt ? formatDate(stats.lastOrderAt, lang) : t('a3.noOrders')]
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-cream p-3">
                  <p className="text-[11px] text-ink-muted">{label}</p>
                  <p className="mt-1 text-sm font-bold text-ink">{value}</p>
                </div>
              ))}
            </div>

            {/* تبويبات */}
            <div className="mb-4 flex flex-wrap gap-1.5 border-b border-black/5 pb-3">
              {TABS.map(([k, label, Icon]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                    tab === k ? 'bg-ink text-white' : 'text-ink-soft hover:bg-blush'
                  )}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>

            <div className="max-h-[45vh] overflow-y-auto">
              {profileQ.isLoading ? (
                <p className="py-10 text-center text-xs text-ink-muted">…</p>
              ) : (
                <>
                  {tab === 'orders' ? (
                    p?.orders?.length ? (
                      <ul className="space-y-2">
                        {p.orders.map((o) => {
                          const meta = ORDER_STATUS_META[o.orderStatus] || ORDER_STATUS_META.pending;
                          return (
                            <li key={o._id} className="flex flex-wrap items-center gap-3 rounded-xl border border-black/5 p-3">
                              <div className="min-w-0 flex-1">
                                <p className="font-en text-sm font-bold text-ink">{o.orderNumber}</p>
                                <p className="text-[11px] text-ink-muted">{formatDate(o.createdAt, lang)} • {o.items?.length || 0} {t('cart.items')}</p>
                              </div>
                              <Badge className={meta.color}>{meta[lang]}</Badge>
                              <span className="text-sm font-bold text-ink">{formatPrice(o.total, lang)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : <p className="py-10 text-center text-xs text-ink-muted">{t('a3.noOrders')}</p>
                  ) : null}

                  {tab === 'addresses' ? (
                    p?.addresses?.length ? (
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {p.addresses.map((a) => (
                          <li key={a._id} className="rounded-xl border border-black/5 p-3">
                            <p className="text-xs font-bold text-ink">{a.title || a.fullName || '—'}</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                              {[a.street, a.district, a.city, a.governorate].filter(Boolean).join('، ')}
                            </p>
                            <p dir="ltr" className="mt-1 text-[11px] text-ink-muted rtl:text-end">{a.phone}</p>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="py-10 text-center text-xs text-ink-muted">{t('admin.noData')}</p>
                  ) : null}

                  {tab === 'wishlist' ? (
                    p?.wishlist?.length ? (
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {p.wishlist.map((w) => (
                          <li key={w._id} className="flex items-center gap-3 rounded-xl border border-black/5 p-2.5">
                            <SmartImage src={w.mainImage} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                            <div className="min-w-0 flex-1">
                              <p className="clamp-1 text-xs font-semibold text-ink">{localized(w, lang)}</p>
                              <p className="text-[11px] text-ink-muted">{formatPrice(w.price, lang)}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="py-10 text-center text-xs text-ink-muted">{t('admin.noData')}</p>
                  ) : null}

                  {tab === 'viewed' ? (
                    p?.recentlyViewed?.length ? (
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {p.recentlyViewed.map((v) => (
                          <li key={v._id} className="flex items-center gap-3 rounded-xl border border-black/5 p-2.5">
                            <SmartImage src={v.mainImage} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                            <div className="min-w-0 flex-1">
                              <p className="clamp-1 text-xs font-semibold text-ink">{localized(v, lang)}</p>
                              <p className="text-[11px] text-ink-muted">
                                {formatPrice(v.price, lang)} • {formatDate(v.viewedAt, lang)}
                              </p>
                            </div>
                            {v.viewCount > 1 ? (
                              <span className="shrink-0 rounded-full bg-blush px-2 py-0.5 text-[10px] font-bold text-ink">
                                ×{v.viewCount}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : <p className="py-10 text-center text-xs text-ink-muted">{t('admin.noData')}</p>
                  ) : null}

                  {tab === 'reviews' ? (
                    p?.reviews?.length ? (
                      <ul className="space-y-2">
                        {p.reviews.map((r) => (
                          <li key={r._id} className="rounded-xl border border-black/5 p-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-amber-500">{'★'.repeat(r.rating)}</span>
                              <p className="clamp-1 flex-1 text-xs font-semibold text-ink">{localized(r.product, lang)}</p>
                            </div>
                            {r.comment ? <p className="mt-1 text-[11px] text-ink-muted">{r.comment}</p> : null}
                            <p className="mt-1 text-[10px] text-ink-muted">{formatDate(r.createdAt, lang)}</p>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="py-10 text-center text-xs text-ink-muted">{t('admin.noData')}</p>
                  ) : null}

                  {tab === 'notes' ? (
                    <div>
                      <ul className="mb-3 space-y-2">
                        {(p?.notes || []).map((n) => (
                          <li key={n._id} className="flex items-start gap-2 rounded-xl bg-cream p-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-ink">{n.body}</p>
                              <p className="mt-0.5 text-[10px] text-ink-muted">{n.authorName} • {formatDate(n.at, lang)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => delNote.mutate({ id: viewing._id, noteId: n._id })}
                              className="grid h-6 w-6 shrink-0 place-items-center rounded text-ink-muted transition hover:bg-red-50 hover:text-red-600"
                              aria-label={t('common.delete')}
                            >
                              <FiTrash2 size={12} />
                            </button>
                          </li>
                        ))}
                        {(p?.notes || []).length === 0 ? (
                          <li className="py-6 text-center text-[11px] text-ink-muted">{t('admin.noData')}</li>
                        ) : null}
                      </ul>

                      <div className="flex gap-2">
                        <input
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder={t('a3.notePlaceholder')}
                          maxLength={1000}
                          className="input h-10 flex-1 py-2 text-sm"
                          aria-label={t('a3.addNote')}
                        />
                        <Button
                          size="sm"
                          loading={addNote.isPending}
                          disabled={!noteText.trim()}
                          onClick={() => addNote.mutate({ id: viewing._id, body: noteText.trim() })}
                        >
                          {t('a3.addNote')}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {/* الاهتمامات */}
            {p?.interests?.length ? (
              <div className="mt-4 border-t border-black/5 pt-3">
                <p className="mb-2 text-[11px] font-bold text-ink-muted">{t('a3.interests')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.interests.map((i) => (
                    <span key={i.category} className="rounded-full bg-blush px-2.5 py-1 text-[11px] font-semibold text-ink">
                      {lang === 'ar' ? i.category : i.categoryEn} ({i.count})
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleteMutation.mutate(deleting)}
        title={t('admin.confirmDelete')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}
