import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FiActivity, FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiCpu, FiDatabase,
  FiDownload, FiHardDrive, FiLogOut, FiPlay, FiRefreshCw, FiServer, FiShield,
  FiTool, FiTrash2, FiUsers, FiXCircle, FiZap
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import client from '@/api/client';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Button from '@/components/ui/Button';
import DataTable from '@/components/admin/DataTable';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useI18n } from '@/i18n';
import { formatDate, formatNumber } from '@/utils/format';
import { cn } from '@/utils/helpers';

const TABS = [
  ['health', 'a4.systemHealth', FiActivity],
  ['diagnostics', 'a4.diagnostics', FiCheckCircle],
  ['errors', 'a4.errorCenter', FiAlertCircle],
  ['jobs', 'a4.jobs', FiPlay],
  ['api', 'a4.apiManagement', FiServer],
  ['cache', 'a4.cacheCenter', FiZap],
  ['security', 'a4.securityCenter', FiShield],
  ['sessions', 'a4.sessions', FiUsers],
  ['maintenance', 'a4.maintenanceTools', FiTool],
  ['version', 'a4.versionCenter', FiCpu]
];

const STATUS_TONE = {
  passed: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700'
};

const SEVERITY_TONE = {
  fatal: 'bg-red-100 text-red-700',
  error: 'bg-orange-100 text-orange-700',
  warning: 'bg-amber-100 text-amber-700'
};

/** بطاقة مؤشّر صغيرة */
function Metric({ label, value, tone = 'text-ink', icon: Icon, hint }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-soft">
      <div className="flex items-center gap-2">
        {Icon ? <Icon size={13} className="shrink-0 text-ink-muted" /> : null}
        <p className="clamp-1 text-[11px] text-ink-muted">{label}</p>
      </div>
      <p className={cn('mt-1.5 text-xl font-bold', tone)}>{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export default function AdminSystem() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState('health');
  const [viewErr, setViewErr] = useState(null);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [errFilter, setErrFilter] = useState({ type: 'all', resolved: 'all' });

  const enabled = (k) => tab === k;

  const health = useQuery({
    queryKey: ['admin', 'sys-health'],
    queryFn: () => client.get('/admin/system/health').then((r) => r.data?.data),
    enabled: enabled('health'), staleTime: 15000
  });
  const diag = useQuery({
    queryKey: ['admin', 'sys-diag'],
    queryFn: () => client.get('/admin/system/diagnostics').then((r) => r.data?.data),
    enabled: enabled('diagnostics'), staleTime: 30000
  });
  const errors = useQuery({
    queryKey: ['admin', 'sys-errors', errFilter],
    queryFn: () => client.get('/admin/system/errors', { params: { ...errFilter, limit: 100 } }).then((r) => r.data?.data),
    enabled: enabled('errors'), staleTime: 10000
  });
  const jobsQ = useQuery({
    queryKey: ['admin', 'sys-jobs'],
    queryFn: () => client.get('/admin/system/jobs').then((r) => r.data?.data),
    enabled: enabled('jobs'), staleTime: 10000
  });
  const apiQ = useQuery({
    queryKey: ['admin', 'sys-api'],
    queryFn: () => client.get('/admin/system/api').then((r) => r.data?.data),
    enabled: enabled('api'), staleTime: 10000
  });
  const cacheQ = useQuery({
    queryKey: ['admin', 'sys-cache'],
    queryFn: () => client.get('/admin/system/cache').then((r) => r.data?.data),
    enabled: enabled('cache'), staleTime: 5000
  });
  const secQ = useQuery({
    queryKey: ['admin', 'sys-security'],
    queryFn: () => client.get('/admin/system/security').then((r) => r.data?.data),
    enabled: enabled('security'), staleTime: 20000
  });
  const sessQ = useQuery({
    queryKey: ['admin', 'sys-sessions'],
    queryFn: () => client.get('/admin/system/sessions').then((r) => r.data?.data),
    enabled: enabled('sessions'), staleTime: 10000
  });
  const verQ = useQuery({
    queryKey: ['admin', 'sys-version'],
    queryFn: () => client.get('/admin/system/version').then((r) => r.data?.data),
    enabled: enabled('version'), staleTime: 60000
  });

  /**
   * مصنع خيارات الطفرة.
   *
   * ⚠️ لا نستدعي useMutation داخل دالة مساعدة — ذلك يخالف قواعد الخطّافات
   * ويؤدي لترتيب استدعاء غير ثابت. نبني الخيارات فقط، ثم نستدعي
   * useMutation صراحةً على المستوى الأعلى للمكوّن.
   */
  const opts = useCallback(
    (fn, keys) => ({
      mutationFn: fn,
      onSuccess: (r) => {
        toast.success(r?.data?.message || t('admin.saved'));
        keys.forEach((k) => qc.invalidateQueries({ queryKey: ['admin', k] }));
      },
      onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
    }),
    [qc, t]
  );

  const runJob = useMutation(opts((key) => client.post(`/admin/system/jobs/${key}/run`), ['sys-jobs', 'sys-health']));
  const clearCache = useMutation(opts((ns) => client.post('/admin/system/cache/clear', { namespace: ns }), ['sys-cache', 'sys-health']));
  const resolveErr = useMutation(opts((id) => client.put(`/admin/system/errors/${id}/resolve`), ['sys-errors', 'sys-health']));
  const clearErrors = useMutation(opts(() => client.delete('/admin/system/errors?resolved=true'), ['sys-errors']));
  const runTask = useMutation(opts((task) => client.post(`/admin/system/maintenance/${task}`), ['sys-health', 'sys-cache']));
  const revoke = useMutation(opts((id) => client.post(`/admin/system/sessions/${id}/revoke`), ['sys-sessions', 'sys-security']));
  const revokeAll = useMutation(opts(() => client.post('/admin/system/sessions/revoke-all'), ['sys-sessions', 'sys-security']));
  const resetApi = useMutation(opts(() => client.post('/admin/system/api/reset'), ['sys-api']));

  const exportErrors = useCallback(async () => {
    try {
      const r = await client.get('/admin/system/errors/export', { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url; a.download = `errors-${Date.now()}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch { toast.error(t('common.error')); }
  }, [t]);

  const h = health.data;
  const scoreTone = (s) => (s >= 90 ? 'text-emerald-600' : s >= 70 ? 'text-sky-600' : s >= 50 ? 'text-amber-600' : 'text-red-600');

  const diagByArea = useMemo(() => {
    const groups = {};
    (diag.data?.results || []).forEach((r) => {
      groups[r.area] = groups[r.area] || [];
      groups[r.area].push(r);
    });
    return groups;
  }, [diag.data]);

  return (
    <>
      <AdminPageHeader title={t('a4.system')} subtitle={t('a4.systemHealth')}>
        <Button
          size="sm" variant="outline" icon={FiRefreshCw}
          onClick={() => qc.invalidateQueries({ queryKey: ['admin'] })}
        >
          {t('common.refresh')}
        </Button>
      </AdminPageHeader>

      {/* التبويبات */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map(([k, label, Icon]) => (
          <button
            key={k} type="button" onClick={() => setTab(k)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition',
              tab === k ? 'bg-ink text-white' : 'border border-black/10 bg-white text-ink hover:border-rose hover:text-rose'
            )}
          >
            <Icon size={13} /> {t(label)}
          </button>
        ))}
      </div>

      {/* ---------- صحة النظام ---------- */}
      {tab === 'health' ? (
        health.isLoading || !h ? <TableSkeleton rows={6} cols={4} /> : (
          <div className="space-y-5">
            <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
              <div className="flex flex-wrap items-center gap-6">
                <div className="text-center">
                  <p className={cn('font-en text-5xl font-bold', scoreTone(h.healthScore))}>{h.healthScore}</p>
                  <p className="mt-1 text-xs text-ink-muted">{t('a4.healthScore')}</p>
                  <p className={cn('mt-0.5 text-[11px] font-bold', scoreTone(h.healthScore))}>{t(`a4.${h.grade}`)}</p>
                </div>
                <ul className="grid flex-1 gap-2 sm:grid-cols-2">
                  {h.checks.map((c) => (
                    <li key={c.key} className="flex items-center gap-2 rounded-lg bg-cream p-2.5">
                      {c.ok ? <FiCheckCircle className="shrink-0 text-emerald-600" size={14} />
                        : <FiAlertTriangle className="shrink-0 text-amber-500" size={14} />}
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-ink">{c.label}</span>
                        <span className="block text-[10px] text-ink-muted">{c.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <Metric label={t('a4.dbStatus')} value={h.database.connected ? t('a4.connected') : t('a4.disconnected')}
                tone={h.database.connected ? 'text-emerald-600' : 'text-red-600'} icon={FiDatabase}
                hint={h.database.pingMs !== null ? `${h.database.pingMs}ms` : ''} />
              <Metric label={t('a4.responseTime')} value={`${h.api.responseTimeMs}ms`} icon={FiServer}
                hint={`${t('a4.uptime')}: ${Math.round(h.api.uptimeSeconds / 60)}m`} />
              <Metric label={t('a4.memoryUsage')} value={`${h.memory.heapUsedMB} MB`} icon={FiCpu}
                tone={h.memory.usagePercent > 85 ? 'text-amber-600' : 'text-ink'}
                hint={`${h.memory.usagePercent}% / ${h.memory.heapTotalMB} MB`} />
              <Metric label={t('a4.storageUsage')} value={`${h.storage.uploadsMB} MB`} icon={FiHardDrive}
                hint={`${formatNumber(h.storage.files, lang)} ${t('a4.file')}`} />
              <Metric label={t('a4.activeUsers')} value={formatNumber(h.counts.activeUsers, lang)} icon={FiUsers} />
              <Metric label={t('admin.totalOrders')} value={formatNumber(h.counts.orders, lang)} />
              <Metric label={t('admin.totalProducts')} value={formatNumber(h.counts.products, lang)} />
              <Metric label={t('admin.totalCustomers')} value={formatNumber(h.counts.customers, lang)} />
              <Metric label={t('a4.errorCount')} value={formatNumber(h.errors.total, lang)}
                tone={h.errors.total > 0 ? 'text-amber-600' : 'text-emerald-600'} icon={FiAlertCircle}
                hint={h.errors.fatal ? `${h.errors.fatal} ${t('a4.fatal')}` : ''} />
              <Metric label={t('a4.lastBackup')}
                value={h.lastBackup ? formatDate(h.lastBackup.at, lang) : t('a4.noBackupYet')}
                tone={h.lastBackup ? 'text-ink' : 'text-amber-600'} />
              <Metric label={t('a4.systemVersion')} value={h.version.version} icon={FiCpu}
                hint={`schema v${h.version.schemaVersion}`} />
              <Metric label={t('a4.cacheKeys')} value={formatNumber(h.cache.keys, lang)} icon={FiZap}
                hint={`${h.cache.hitRate}% ${t('a4.hitRate')}`} />
            </div>

            {/* التكاملات */}
            <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
              <h3 className="mb-3 text-sm font-bold text-ink">{t('a4.integrations')}</h3>
              <div className="grid gap-4 lg:grid-cols-3">
                {[
                  [t('a4.paymentGateways'), h.integrations.payments],
                  [t('a4.shippingCarriers'), h.integrations.shipping],
                  [t('a4.notificationChannels'), h.integrations.notifications]
                ].map(([title, items]) => (
                  <div key={title}>
                    <p className="mb-2 text-[11px] font-bold text-ink-muted">{title}</p>
                    <ul className="space-y-1.5">
                      {items.map((i) => (
                        <li key={i.code} className="flex items-center justify-between gap-2 rounded-lg bg-cream px-2.5 py-1.5">
                          <span className="clamp-1 text-xs text-ink">{lang === 'ar' ? i.name : i.nameEn}</span>
                          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                            i.configured ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-600')}>
                            {i.configured ? t('a4.configured') : t('a4.readyToConnect')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      ) : null}

      {/* ---------- التشخيص ---------- */}
      {tab === 'diagnostics' ? (
        diag.isLoading ? <TableSkeleton rows={8} cols={3} /> : (
          <div className="space-y-4">
            <div className="grid gap-3 grid-cols-3">
              <Metric label={t('a4.passed')} value={diag.data?.summary?.passed ?? 0} tone="text-emerald-600" icon={FiCheckCircle} />
              <Metric label={t('a4.warning')} value={diag.data?.summary?.warning ?? 0} tone="text-amber-600" icon={FiAlertTriangle} />
              <Metric label={t('a4.failed')} value={diag.data?.summary?.failed ?? 0} tone="text-red-600" icon={FiXCircle} />
            </div>

            {Object.entries(diagByArea).map(([area, items]) => (
              <div key={area} className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
                <div className="border-b border-black/5 bg-cream/60 px-4 py-2.5">
                  <p className="font-en text-xs font-bold uppercase text-ink-muted">{area}</p>
                </div>
                <ul className="divide-y divide-black/5">
                  {items.map((r, i) => (
                    <li key={i} className="flex flex-wrap items-start gap-3 p-3.5">
                      <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold', STATUS_TONE[r.status])}>
                        {t(`a4.${r.status}`)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink">{r.name}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">{r.detail}</p>
                        {r.fix ? (
                          <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                            💡 {t('a4.suggestedFix')}: {r.fix}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )
      ) : null}

      {/* ---------- مركز الأخطاء ---------- */}
      {tab === 'errors' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <select value={errFilter.type} onChange={(e) => setErrFilter((f) => ({ ...f, type: e.target.value }))}
              className="input h-9 w-auto py-1.5 text-sm" aria-label={t('a4.errorType')}>
              <option value="all">{t('common.all')}</option>
              {['api', 'validation', 'auth', 'database', 'job', 'client'].map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <select value={errFilter.resolved} onChange={(e) => setErrFilter((f) => ({ ...f, resolved: e.target.value }))}
              className="input h-9 w-auto py-1.5 text-sm" aria-label={t('common.status')}>
              <option value="all">{t('common.all')}</option>
              <option value="false">{t('a4.unresolved')}</option>
              <option value="true">{t('a4.resolved')}</option>
            </select>
            <Button size="sm" variant="outline" icon={FiDownload} onClick={exportErrors}>{t('common.export')}</Button>
            <Button size="sm" variant="outline" icon={FiTrash2} onClick={() => clearErrors.mutate()}>{t('a4.clearResolved')}</Button>
          </div>

          {errors.isLoading ? <TableSkeleton rows={6} cols={4} /> : (
            <DataTable
              columns={[
                { key: 'severity', header: t('a4.severity'), render: (e) => (
                  <span className={cn('rounded-full px-2 py-1 text-[10px] font-bold', SEVERITY_TONE[e.severity])}>{e.severity}</span>
                ) },
                { key: 'type', header: t('a4.errorType'), render: (e) => <span className="font-en text-xs">{e.type}</span> },
                { key: 'message', header: t('common.description'), render: (e) => (
                  <p className="clamp-2 max-w-md text-xs text-ink">{e.message}</p>
                ) },
                { key: 'path', header: 'Path', render: (e) => <span className="font-en clamp-1 text-[11px] text-ink-muted">{e.method} {e.path}</span>, hideOnMobile: true },
                { key: 'count', header: t('a4.occurrences'), render: (e) => <span className="font-en font-bold">{e.count}</span> },
                { key: 'lastSeenAt', header: t('a4.lastSeen'), render: (e) => <span className="text-[11px] text-ink-muted">{formatDate(e.lastSeenAt, lang)}</span> },
                { key: 'resolved', header: t('common.status'), render: (e) => (
                  <span className={cn('rounded-full px-2 py-1 text-[10px] font-bold',
                    e.resolved ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-600')}>
                    {e.resolved ? t('a4.resolved') : t('a4.unresolved')}
                  </span>
                ) }
              ]}
              data={errors.data?.errors || []}
              searchable={false}
              pageSize={25}
              emptyMessage={t('a4.noErrors')}
              actions={(row) => (
                <div className="inline-flex gap-1.5">
                  <button type="button" onClick={() => setViewErr(row)} title={t('a3.details')} aria-label={t('a3.details')}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-ink hover:text-ink">
                    <FiAlertCircle size={14} />
                  </button>
                  {!row.resolved ? (
                    <button type="button" onClick={() => resolveErr.mutate(row._id)} title={t('a4.resolve')} aria-label={t('a4.resolve')}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-emerald-500 hover:text-emerald-600">
                      <FiCheckCircle size={14} />
                    </button>
                  ) : null}
                </div>
              )}
            />
          )}
        </div>
      ) : null}

      {/* ---------- المهام ---------- */}
      {tab === 'jobs' ? (
        jobsQ.isLoading ? <TableSkeleton rows={6} cols={4} /> : (
          <ul className="space-y-2">
            {(jobsQ.data?.jobs || []).map((j) => (
              <li key={j.key} className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-soft">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">{lang === 'ar' ? j.name : j.nameEn}</p>
                  <p className="font-en text-[11px] text-ink-muted">
                    {j.key} • {t('a4.interval')}: {j.intervalHuman} • {t('a4.runs')}: {j.runs}
                    {j.failures > 0 ? ` • ${t('a4.failures')}: ${j.failures}` : ''}
                  </p>
                  {j.lastError ? <p className="mt-1 text-[11px] text-red-600">{j.lastError}</p> : null}
                </div>
                <div className="text-end">
                  <p className="text-[11px] text-ink-muted">{t('a4.lastRun')}</p>
                  <p className="text-xs font-semibold text-ink">
                    {j.lastRun ? formatDate(j.lastRun, lang) : t('a4.neverRan')}
                  </p>
                </div>
                <Button size="sm" variant="outline" icon={FiPlay}
                  loading={runJob.isPending} onClick={() => runJob.mutate(j.key)}>
                  {t('a4.runNow')}
                </Button>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {/* ---------- إدارة الـ API ---------- */}
      {tab === 'api' ? (
        apiQ.isLoading ? <TableSkeleton rows={8} cols={4} /> : (
          <div className="space-y-4">
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
              <Metric label={t('a4.requests')} value={formatNumber(apiQ.data?.summary?.totalRequests || 0, lang)} />
              <Metric label={t('a4.avgResponse')} value={`${apiQ.data?.summary?.averageResponseMs || 0}ms`} />
              <Metric label={t('a4.errorRate')} value={`${apiQ.data?.summary?.errorRate || 0}%`}
                tone={(apiQ.data?.summary?.errorRate || 0) > 5 ? 'text-red-600' : 'text-emerald-600'} />
              <Metric label={t('a4.endpoints')} value={apiQ.data?.summary?.trackedRoutes || 0} />
              <Metric label={t('a4.rateLimit')}
                value={apiQ.data?.rateLimit?.enabled ? t('a4.enabled') : t('a4.disabled')}
                tone={apiQ.data?.rateLimit?.enabled ? 'text-emerald-600' : 'text-amber-600'} />
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" icon={FiRefreshCw} onClick={() => resetApi.mutate()}>
                {t('a4.resetMetrics')}
              </Button>
            </div>
            <DataTable
              columns={[
                { key: 'method', header: 'Method', render: (r) => <span className="font-en text-xs font-bold">{r.method}</span> },
                { key: 'path', header: t('a4.endpoints'), render: (r) => <span className="font-en clamp-1 text-xs">{r.path}</span> },
                { key: 'count', header: t('a4.requests'), render: (r) => formatNumber(r.count, lang) },
                { key: 'avgMs', header: t('a4.avgResponse'), render: (r) => (
                  <span className={cn('font-en text-xs font-bold', r.avgMs > 500 ? 'text-red-600' : r.avgMs > 200 ? 'text-amber-600' : 'text-emerald-600')}>
                    {r.avgMs}ms
                  </span>
                ) },
                { key: 'maxMs', header: 'Max', render: (r) => <span className="font-en text-xs">{r.maxMs}ms</span>, hideOnMobile: true },
                { key: 'errorRate', header: t('a4.errorRate'), render: (r) => (
                  <span className={cn('text-xs font-bold', r.errorRate > 0 ? 'text-red-600' : 'text-ink-muted')}>{r.errorRate}%</span>
                ) }
              ]}
              data={apiQ.data?.routes || []}
              searchable={false}
              pageSize={20}
            />
          </div>
        )
      ) : null}

      {/* ---------- الكاش ---------- */}
      {tab === 'cache' ? (
        cacheQ.isLoading ? <TableSkeleton rows={4} cols={3} /> : (
          <div className="space-y-4">
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <Metric label={t('a4.cacheKeys')} value={formatNumber(cacheQ.data?.stats?.keys || 0, lang)} icon={FiZap} />
              <Metric label={t('a4.hitRate')} value={`${cacheQ.data?.stats?.hitRate || 0}%`} tone="text-emerald-600" />
              <Metric label={t('a4.cacheSize')} value={`${Math.round((cacheQ.data?.stats?.approximateBytes || 0) / 1024)} KB`} />
              <Metric label="Hits / Misses" value={`${cacheQ.data?.stats?.hits || 0} / ${cacheQ.data?.stats?.misses || 0}`} />
            </div>
            <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
              <h3 className="mb-3 text-sm font-bold text-ink">{t('a4.clearCache')}</h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="danger" icon={FiTrash2} onClick={() => clearCache.mutate('all')}>
                  {t('a4.clearAll')}
                </Button>
                {(cacheQ.data?.namespaces || []).map((ns) => (
                  <Button key={ns} size="sm" variant="outline" onClick={() => clearCache.mutate(ns)}>
                    {ns} ({cacheQ.data?.stats?.byNamespace?.[ns] ?? 0})
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )
      ) : null}

      {/* ---------- الأمان ---------- */}
      {tab === 'security' ? (
        secQ.isLoading ? <TableSkeleton rows={6} cols={3} /> : (
          <div className="space-y-4">
            {(secQ.data?.warnings || []).length ? (
              <ul className="space-y-2">
                {secQ.data.warnings.map((w, i) => (
                  <li key={i} className={cn('flex items-start gap-2 rounded-xl border p-3 text-xs',
                    w.level === 'critical' ? 'border-red-200 bg-red-50 text-red-800'
                      : w.level === 'high' ? 'border-orange-200 bg-orange-50 text-orange-800'
                      : w.level === 'medium' ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : 'border-sky-200 bg-sky-50 text-sky-800')}>
                    <FiAlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>{w.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                ✓ {t('a4.noWarnings')}
              </p>
            )}

            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <Metric label={t('a4.failedLogins')} value={secQ.data?.failedLoginsCount ?? 0}
                tone={(secQ.data?.failedLoginsCount ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600'} />
              <Metric label={t('a4.lockedAccounts')} value={(secQ.data?.lockedAccounts || []).length}
                tone={(secQ.data?.lockedAccounts || []).length ? 'text-red-600' : 'text-emerald-600'} />
              <Metric label={t('a4.suspiciousIps')} value={(secQ.data?.suspiciousIps || []).length}
                tone={(secQ.data?.suspiciousIps || []).length ? 'text-amber-600' : 'text-emerald-600'} />
              <Metric label={t('a3.staff')} value={(secQ.data?.adminAccounts || []).length} icon={FiShield} />
            </div>

            {(secQ.data?.suspiciousIps || []).length ? (
              <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
                <div className="border-b border-black/5 p-4"><h3 className="text-sm font-bold text-ink">{t('a4.suspiciousIps')}</h3></div>
                <ul className="divide-y divide-black/5">
                  {secQ.data.suspiciousIps.map((ip) => (
                    <li key={ip._id} className="flex items-center gap-3 p-3">
                      <span className="font-en flex-1 text-xs text-ink">{ip._id}</span>
                      <span className="text-xs font-bold text-red-600">{ip.attempts} {t('a4.attempts')}</span>
                      <span className="text-[11px] text-ink-muted">{formatDate(ip.lastAt, lang)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
              <div className="border-b border-black/5 p-4"><h3 className="text-sm font-bold text-ink">{t('a4.recentLogins')}</h3></div>
              <ul className="divide-y divide-black/5 max-h-80 overflow-y-auto">
                {(secQ.data?.recentLogins || []).slice(0, 20).map((l) => (
                  <li key={l._id} className="flex items-center gap-3 p-3">
                    <FiCheckCircle size={13} className="shrink-0 text-emerald-600" />
                    <span className="min-w-0 flex-1">
                      <span className="clamp-1 block text-xs font-semibold text-ink">{l.userName || l.userEmail}</span>
                      <span className="font-en block text-[10px] text-ink-muted">{l.ip}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-ink-muted">{formatDate(l.createdAt, lang)}</span>
                  </li>
                ))}
                {!(secQ.data?.recentLogins || []).length ? (
                  <li className="p-8 text-center text-xs text-ink-muted">{t('admin.noData')}</li>
                ) : null}
              </ul>
            </div>
          </div>
        )
      ) : null}

      {/* ---------- الجلسات ---------- */}
      {tab === 'sessions' ? (
        sessQ.isLoading ? <TableSkeleton rows={6} cols={4} /> : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Metric label={t('a4.online')} value={sessQ.data?.onlineCount ?? 0} tone="text-emerald-600" icon={FiUsers} />
              <Button size="sm" variant="danger" icon={FiLogOut} onClick={() => setConfirmRevokeAll(true)}>
                {t('a4.revokeAll')}
              </Button>
            </div>
            <DataTable
              columns={[
                { key: 'name', header: t('common.name'), render: (u) => (
                  <div className="min-w-0">
                    <p className="clamp-1 text-sm font-semibold text-ink">
                      {u.name} {u.isSelf ? <span className="text-[10px] text-rose">({t('a4.currentSession')})</span> : null}
                    </p>
                    <p className="clamp-1 text-[11px] text-ink-muted">{u.email}</p>
                  </div>
                ) },
                { key: 'role', header: t('a3.role'), render: (u) => <span className="font-en text-xs">{u.staffRole || u.role}</span> },
                { key: 'isOnline', header: t('common.status'), render: (u) => (
                  <span className={cn('rounded-full px-2 py-1 text-[10px] font-bold',
                    u.isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-600')}>
                    {u.isOnline ? t('a4.online') : t('a4.offline')}
                  </span>
                ) },
                { key: 'idleMinutes', header: t('a4.idleFor'), render: (u) => (
                  <span className="text-xs text-ink-muted">{u.idleMinutes !== null ? `${u.idleMinutes}m` : '—'}</span>
                ), hideOnMobile: true },
                { key: 'lastLogin', header: t('a4.lastRun'), render: (u) => (
                  <span className="text-[11px] text-ink-muted">{u.lastLogin ? formatDate(u.lastLogin, lang) : '—'}</span>
                ), hideOnMobile: true }
              ]}
              data={sessQ.data?.sessions || []}
              searchKeys={['name', 'email']}
              pageSize={20}
              actions={(row) => (!row.isSelf ? (
                <Button size="xs" variant="outline" icon={FiLogOut} onClick={() => revoke.mutate(row._id)}>
                  {t('a4.revokeSession')}
                </Button>
              ) : null)}
            />
          </div>
        )
      ) : null}

      {/* ---------- الصيانة ---------- */}
      {tab === 'maintenance' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['optimize-db', t('a4.optimizeDb'), FiDatabase],
            ['clear-cache', t('a4.clearCache'), FiZap],
            ['clean-temp', t('a4.cleanTemp'), FiTrash2],
            ['clean-logs', t('a4.cleanLogs'), FiTrash2],
            ['storage-analysis', t('a4.storageAnalysis'), FiHardDrive]
          ].map(([task, label, Icon]) => (
            <div key={task} className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
              <Icon size={20} className="mb-3 text-ink-muted" />
              <p className="mb-3 text-sm font-bold text-ink">{label}</p>
              <Button size="sm" variant="outline" loading={runTask.isPending} onClick={() => runTask.mutate(task)}>
                {t('a4.runTask')}
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {/* ---------- الإصدارات ---------- */}
      {tab === 'version' ? (
        verQ.isLoading ? <TableSkeleton rows={5} cols={2} /> : (
          <div className="space-y-4">
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
              <Metric label={t('a4.currentVersion')} value={verQ.data?.version} icon={FiCpu} />
              <Metric label={t('a4.buildNumber')} value={verQ.data?.build} />
              <Metric label={t('a4.buildDate')} value={formatDate(verQ.data?.buildDate, lang)} />
              <Metric label={t('a4.schemaVersion')} value={`v${verQ.data?.schemaVersion}`} icon={FiDatabase} />
              <Metric label={t('a4.frontendVersion')} value={verQ.data?.frontend} />
              <Metric label={t('a4.backendVersion')} value={verQ.data?.backend} />
            </div>

            <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
              <div className="border-b border-black/5 p-4"><h3 className="text-sm font-bold text-ink">{t('a4.changelog')}</h3></div>
              <ul className="divide-y divide-black/5">
                {(verQ.data?.changelog || []).map((c) => (
                  <li key={c.version} className="p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="font-en rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white">v{c.version}</span>
                      <span className="text-sm font-bold text-ink">{c.title}</span>
                      <span className="text-[11px] text-ink-muted">{c.date}</span>
                    </div>
                    <ul className="space-y-1 ps-4">
                      {c.changes.map((ch, i) => (
                        <li key={i} className="list-disc text-xs text-ink-muted">{ch}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>

            {(verQ.data?.notes || []).length ? (
              <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
                <div className="border-b border-black/5 p-4"><h3 className="text-sm font-bold text-ink">{t('a4.versionNotes')}</h3></div>
                <ul className="divide-y divide-black/5">
                  {verQ.data.notes.map((n, i) => (
                    <li key={i} className="p-4">
                      <p className="text-sm font-semibold text-ink">{n.title}</p>
                      {n.body ? <p className="mt-1 text-xs text-ink-muted">{n.body}</p> : null}
                      <p className="mt-1 text-[10px] text-ink-muted">v{n.version} • {n.author} • {formatDate(n.at, lang)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )
      ) : null}

      {/* تفاصيل الخطأ */}
      <Modal open={Boolean(viewErr)} onClose={() => setViewErr(null)} title={t('a3.details')} size="lg">
        {viewErr ? (
          <div className="space-y-4 p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [t('a4.errorType'), viewErr.type],
                [t('a4.severity'), viewErr.severity],
                ['Status', viewErr.statusCode],
                [t('a4.occurrences'), viewErr.count],
                [t('a4.firstSeen'), formatDate(viewErr.firstSeenAt, lang)],
                [t('a4.lastSeen'), formatDate(viewErr.lastSeenAt, lang)],
                ['IP', viewErr.ip || '—'],
                [t('a3.performedBy'), viewErr.userEmail || '—']
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-cream p-3">
                  <p className="text-[11px] font-bold text-ink-muted">{k}</p>
                  <p className="mt-0.5 break-words text-sm text-ink">{v}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-cream p-3">
              <p className="text-[11px] font-bold text-ink-muted">{viewErr.method} {viewErr.path}</p>
              <p className="mt-1 break-words text-sm text-ink">{viewErr.message}</p>
            </div>
            {viewErr.stack ? (
              <div>
                <p className="mb-2 text-xs font-bold text-ink">{t('a4.stackTrace')}</p>
                <pre dir="ltr" className="font-en max-h-64 overflow-auto rounded-xl bg-ink p-3 text-[11px] leading-relaxed text-white/90">
                  {viewErr.stack}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={confirmRevokeAll}
        onClose={() => setConfirmRevokeAll(false)}
        onConfirm={() => { revokeAll.mutate(); setConfirmRevokeAll(false); }}
        title={t('a4.revokeAll')}
        message={t('a4.revokeAllConfirm')}
        confirmText={t('a4.revokeAll')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}
