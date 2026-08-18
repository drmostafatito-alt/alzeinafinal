import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FiActivity, FiAlertCircle, FiDownload, FiEye, FiFilter, FiLogIn, FiRotateCcw
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import client, { API_BASE } from '@/api/client';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Button from '@/components/ui/Button';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useDebounced } from '@/hooks/useDebounced';
import { useI18n } from '@/i18n';
import { formatDate, formatNumber } from '@/utils/format';
import { cn } from '@/utils/helpers';

const ACTION_META = {
  login: { ar: 'تسجيل دخول', en: 'Login', color: 'bg-emerald-100 text-emerald-700' },
  logout: { ar: 'تسجيل خروج', en: 'Logout', color: 'bg-stone-200 text-stone-700' },
  'login-failed': { ar: 'دخول فاشل', en: 'Failed login', color: 'bg-red-100 text-red-700' },
  create: { ar: 'إنشاء', en: 'Create', color: 'bg-sky-100 text-sky-700' },
  update: { ar: 'تعديل', en: 'Update', color: 'bg-amber-100 text-amber-700' },
  delete: { ar: 'حذف', en: 'Delete', color: 'bg-red-100 text-red-700' },
  'status-change': { ar: 'تغيير حالة', en: 'Status change', color: 'bg-violet-100 text-violet-700' },
  'bulk-update': { ar: 'تعديل جماعي', en: 'Bulk update', color: 'bg-indigo-100 text-indigo-700' },
  'bulk-delete': { ar: 'حذف جماعي', en: 'Bulk delete', color: 'bg-red-100 text-red-700' },
  adjust: { ar: 'تعديل مخزون', en: 'Stock adjust', color: 'bg-teal-100 text-teal-700' },
  import: { ar: 'استيراد', en: 'Import', color: 'bg-indigo-100 text-indigo-700' },
  export: { ar: 'تصدير', en: 'Export', color: 'bg-cyan-100 text-cyan-700' },
  restore: { ar: 'استعادة', en: 'Restore', color: 'bg-purple-100 text-purple-700' }
};

const ENTITY_LABEL = {
  product: { ar: 'منتج', en: 'Product' },
  category: { ar: 'قسم', en: 'Category' },
  brand: { ar: 'ماركة', en: 'Brand' },
  order: { ar: 'طلب', en: 'Order' },
  user: { ar: 'مستخدم', en: 'User' },
  coupon: { ar: 'كوبون', en: 'Coupon' },
  banner: { ar: 'بنر', en: 'Banner' },
  settings: { ar: 'إعدادات', en: 'Settings' },
  auth: { ar: 'مصادقة', en: 'Auth' },
  media: { ar: 'وسائط', en: 'Media' },
  inventory: { ar: 'مخزون', en: 'Inventory' },
  review: { ar: 'تقييم', en: 'Review' },
  'theme-preset': { ar: 'قالب مظهر', en: 'Theme preset' },
  backup: { ar: 'نسخة احتياطية', en: 'Backup' }
};

/** لوحة النشاط وسجل التدقيق */
export default function AdminActivity() {
  const { t, lang } = useI18n();

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    entity: 'all', action: 'all', user: 'all', success: 'all', from: '', to: ''
  });
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState(null);
  const debounced = useDebounced(search, 350);

  const params = useMemo(
    () => ({
      page, limit: 50,
      entity: filters.entity, action: filters.action, user: filters.user,
      ...(filters.success !== 'all' ? { success: filters.success } : {}),
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
      ...(debounced ? { q: debounced } : {})
    }),
    [page, filters, debounced]
  );

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit-logs', params],
    queryFn: () => client.get('/admin/audit-logs', { params }).then((r) => r.data?.data),
    staleTime: 15000
  });

  const summaryQ = useQuery({
    queryKey: ['admin', 'audit-summary'],
    queryFn: () => client.get('/admin/audit-logs/summary').then((r) => r.data?.data),
    staleTime: 60000
  });

  const logs = data?.logs || [];
  const actors = data?.actors || [];

  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };
  const reset = () => { setFilters({ entity: 'all', action: 'all', user: 'all', success: 'all', from: '', to: '' }); setSearch(''); setPage(1); };

  const exportCsv = async () => {
    try {
      const res = await client.get('/admin/audit-logs/export', {
        params: { entity: filters.entity, action: filters.action, from: filters.from || undefined, to: filters.to || undefined },
        responseType: 'blob'
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${Date.now()}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast.success(t('common.export'));
    } catch {
      toast.error(t('common.error'));
    }
  };

  const columns = [
    {
      key: 'createdAt',
      header: t('a3.dateTime'),
      render: (l) => {
        const d = new Date(l.createdAt);
        return (
          <div>
            <p className="font-en text-xs font-semibold text-ink">{d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')}</p>
            <p className="font-en text-[11px] text-ink-muted">{d.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-GB')}</p>
          </div>
        );
      }
    },
    {
      key: 'userName',
      header: t('a3.performedBy'),
      render: (l) => (
        <div className="min-w-0">
          <p className="clamp-1 text-sm font-medium text-ink">{l.userName || '—'}</p>
          <p className="clamp-1 text-[11px] text-ink-muted">{l.userEmail}</p>
        </div>
      )
    },
    {
      key: 'action',
      header: t('a3.action'),
      render: (l) => {
        const m = ACTION_META[l.action] || { ar: l.action, en: l.action, color: 'bg-stone-200 text-stone-700' };
        return <span className={cn('whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold', m.color)}>{m[lang]}</span>;
      }
    },
    {
      key: 'entity',
      header: t('a3.entity'),
      render: (l) => <span className="text-xs text-ink-soft">{ENTITY_LABEL[l.entity]?.[lang] || l.entity}</span>,
      hideOnMobile: true
    },
    { key: 'label', header: t('a3.object'), render: (l) => <span className="clamp-1 text-xs text-ink">{l.label || '—'}</span> },
    { key: 'ip', header: t('a3.ipAddress'), render: (l) => <span className="font-en text-[11px] text-ink-muted">{l.ip || '—'}</span>, hideOnMobile: true },
    {
      key: 'success',
      header: t('common.status'),
      render: (l) => (
        <span className={cn('rounded-full px-2 py-1 text-[11px] font-bold', l.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
          {l.success ? t('a3.succeeded') : t('a3.failed')}
        </span>
      )
    }
  ];

  const s = summaryQ.data;

  return (
    <>
      <AdminPageHeader title={t('a3.activityDashboard')} subtitle={t('a3.auditLog')}>
        <Button size="sm" variant="outline" icon={FiDownload} onClick={exportCsv}>
          {t('common.export')}
        </Button>
      </AdminPageHeader>

      {/* ملخّص */}
      {s ? (
        <div className="mb-5 grid gap-3 grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-soft">
            <div className="flex items-center gap-2"><FiActivity size={13} className="text-ink-muted" /><p className="text-[11px] text-ink-muted">{t('a3.totalEvents')}</p></div>
            <p className="mt-1.5 text-xl font-bold text-ink">{formatNumber(s.total, lang)}</p>
          </div>
          <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-soft">
            <div className="flex items-center gap-2"><FiAlertCircle size={13} className="text-red-500" /><p className="text-[11px] text-ink-muted">{t('a3.failedLast7')}</p></div>
            <p className={cn('mt-1.5 text-xl font-bold', s.failedLast7Days > 0 ? 'text-red-600' : 'text-ink')}>
              {formatNumber(s.failedLast7Days, lang)}
            </p>
          </div>
          <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-soft">
            <div className="flex items-center gap-2"><FiLogIn size={13} className="text-ink-muted" /><p className="text-[11px] text-ink-muted">{ACTION_META.login[lang]}</p></div>
            <p className="mt-1.5 text-xl font-bold text-ink">
              {formatNumber(s.byAction?.find((a) => a._id === 'login')?.count || 0, lang)}
            </p>
          </div>
          <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-soft">
            <div className="flex items-center gap-2"><FiFilter size={13} className="text-ink-muted" /><p className="text-[11px] text-ink-muted">{t('a3.entity')}</p></div>
            <p className="mt-1.5 text-xl font-bold text-ink">{formatNumber(s.byEntity?.length || 0, lang)}</p>
          </div>
        </div>
      ) : null}

      {/* فلاتر */}
      <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-black/5 bg-white p-3 shadow-soft">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={t('admin.searchPlaceholder')}
          className="input h-9 min-w-[180px] flex-1 py-1.5 text-sm"
          aria-label={t('admin.searchPlaceholder')}
        />
        <select value={filters.action} onChange={(e) => setFilter('action', e.target.value)} className="input h-9 w-auto py-1.5 text-sm" aria-label={t('a3.action')}>
          <option value="all">{t('a3.allActions')}</option>
          {Object.entries(ACTION_META).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}
        </select>
        <select value={filters.entity} onChange={(e) => setFilter('entity', e.target.value)} className="input h-9 w-auto py-1.5 text-sm" aria-label={t('a3.entity')}>
          <option value="all">{t('a3.allEntities')}</option>
          {Object.entries(ENTITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}
        </select>
        <select value={filters.user} onChange={(e) => setFilter('user', e.target.value)} className="input h-9 w-auto py-1.5 text-sm" aria-label={t('a3.performedBy')}>
          <option value="all">{t('a3.allUsers')}</option>
          {actors.map((a) => <option key={a._id} value={a._id}>{a.name || a.email}</option>)}
        </select>
        <select value={filters.success} onChange={(e) => setFilter('success', e.target.value)} className="input h-9 w-auto py-1.5 text-sm" aria-label={t('common.status')}>
          <option value="all">{t('common.all')}</option>
          <option value="true">{t('a3.succeeded')}</option>
          <option value="false">{t('a3.failed')}</option>
        </select>
        <input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} className="input h-9 w-auto py-1.5 text-sm" aria-label={t('a3.dateFrom')} />
        <input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} className="input h-9 w-auto py-1.5 text-sm" aria-label={t('a3.dateTo')} />
        <button type="button" onClick={reset} className="flex h-9 items-center gap-1.5 rounded-xl border border-black/10 px-3 text-xs font-semibold text-ink transition hover:border-rose hover:text-rose">
          <FiRotateCcw size={13} /> {t('a3.resetFilters')}
        </button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={10} cols={6} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={logs}
            searchable={false}
            pageSize={50}
            emptyMessage={t('admin.noData')}
            actions={(row) => (
              <button
                type="button"
                onClick={() => setViewing(row)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-ink hover:text-ink"
                title={t('a3.details')}
                aria-label={t('a3.details')}
              >
                <FiEye size={14} />
              </button>
            )}
          />
          {data?.pages > 1 ? (
            <div className="mt-4">
              <Pagination page={data.page} pages={data.pages} onChange={setPage} />
            </div>
          ) : null}
        </>
      )}

      {/* تفاصيل السجل */}
      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={t('a3.details')} size="md">
        {viewing ? (
          <div className="space-y-4 p-6">
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                [t('a3.performedBy'), `${viewing.userName || '—'}${viewing.userEmail ? ` (${viewing.userEmail})` : ''}`],
                [t('a3.role'), viewing.userRole || '—'],
                [t('a3.action'), ACTION_META[viewing.action]?.[lang] || viewing.action],
                [t('a3.entity'), ENTITY_LABEL[viewing.entity]?.[lang] || viewing.entity],
                [t('a3.object'), viewing.label || '—'],
                [t('a3.dateTime'), formatDate(viewing.createdAt, lang)],
                [t('a3.ipAddress'), viewing.ip || '—'],
                [t('common.status'), viewing.success ? t('a3.succeeded') : `${t('a3.failed')} — ${viewing.message || ''}`]
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-cream p-3">
                  <dt className="text-[11px] font-bold text-ink-muted">{k}</dt>
                  <dd className="mt-0.5 break-words text-sm text-ink">{v}</dd>
                </div>
              ))}
            </dl>

            {viewing.path ? (
              <div className="rounded-xl bg-cream p-3">
                <p className="text-[11px] font-bold text-ink-muted">{viewing.method}</p>
                <p dir="ltr" className="font-en mt-0.5 break-all text-xs text-ink">{viewing.path}</p>
              </div>
            ) : null}

            {viewing.changes ? (
              <div>
                <p className="mb-2 text-xs font-bold text-ink">{t('a3.changes')}</p>
                <pre dir="ltr" className="font-en max-h-64 overflow-auto rounded-xl bg-ink p-3 text-[11px] leading-relaxed text-white/90">
                  {JSON.stringify(viewing.changes, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
