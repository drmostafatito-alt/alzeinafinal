import { memo, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS, ArcElement, BarElement, CategoryScale, Filler, Legend,
  LineElement, LinearScale, PointElement, Tooltip
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  FiAlertTriangle, FiCalendar, FiDollarSign, FiPackage, FiPercent, FiRefreshCw,
  FiShoppingCart, FiTrendingUp, FiUsers, FiXCircle
} from 'react-icons/fi';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Badge from '@/components/ui/Badge';
import StatCard from '@/components/admin/StatCard';
import SetupGuide from '@/components/admin/SetupGuide';
import { StatCardsSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import SmartImage from '@/components/ui/SmartImage';
import client from '@/api/client';
import { useI18n } from '@/i18n';
import { formatDate, formatNumber, formatPrice } from '@/utils/format';
import { ORDER_STATUS_META } from '@/utils/constants';
import { cn, localized } from '@/utils/helpers';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Tooltip, Legend);

/**
 * ألوان الرسوم تُقرأ من متغيّرات الثيم المطبّقة على :root،
 * حتى تتبع لوحة المعلومات ألوان المتجر التي يضبطها المدير
 * بدل ألوان مكتوبة في الكود.
 */
const cssVar = (name, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

const chartFont = { family: 'Cairo', size: 11 };

const baseOptions = (extra = {}) => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#111111',
      padding: 12,
      cornerRadius: 10,
      titleFont: chartFont,
      bodyFont: chartFont
    },
    ...extra.plugins
  },
  scales: extra.scales === null ? undefined : {
    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: chartFont } },
    x: { grid: { display: false }, ticks: { font: chartFont, maxRotation: 0, autoSkip: true } },
    ...extra.scales
  }
});

/** بطاقة صغيرة لمؤشر ثانوي */
const MiniStat = memo(function MiniStat({ label, value, tone = 'text-ink', icon: Icon }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-3.5">
      <div className="flex items-center gap-2">
        {Icon ? <Icon size={13} className="shrink-0 text-ink-muted" /> : null}
        <p className="clamp-1 text-[11px] text-ink-muted">{label}</p>
      </div>
      <p className={cn('mt-1.5 text-lg font-bold', tone)}>{value}</p>
    </div>
  );
});

const ChartCard = memo(function ChartCard({ title, children, className, action }) {
  return (
    <div className={cn('rounded-2xl border border-black/5 bg-white p-5 shadow-soft', className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-ink">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
});

export default function Dashboard() {
  const { t, lang } = useI18n();
  const [range, setRange] = useState('day'); // day | month

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: () => client.get('/admin/analytics').then((r) => r.data?.data),
    staleTime: 60000
  });

  const accent = cssVar('--color-accent', '#C89A8B');
  const ink = cssVar('--color-primary', '#111111');

  /* ---------- بيانات الرسوم ---------- */
  const revenueChart = useMemo(() => {
    if (!data) return null;
    const src = range === 'day' ? data.charts.revenueByDay : data.charts.revenueByMonth;
    return {
      labels: src.map((p) => (lang === 'ar' ? p.label : p.labelEn)),
      datasets: [
        {
          label: t('a3.revenue'),
          data: src.map((p) => p.revenue),
          borderColor: accent,
          backgroundColor: (ctx) => {
            const { chart } = ctx;
            if (!chart.chartArea) return 'transparent';
            const g = chart.ctx.createLinearGradient(0, 0, 0, chart.height);
            g.addColorStop(0, `${accent}59`);
            g.addColorStop(1, `${accent}00`);
            return g;
          },
          fill: true,
          tension: 0.4,
          pointRadius: range === 'day' ? 0 : 3,
          pointHoverRadius: 5,
          pointBackgroundColor: ink,
          borderWidth: 2.5
        }
      ]
    };
  }, [data, range, lang, t, accent, ink]);

  const statusChart = useMemo(() => {
    if (!data) return null;
    const rows = (data.charts.ordersByStatus || []).filter((s) => s.count > 0);
    return {
      labels: rows.map((s) => ORDER_STATUS_META[s.status]?.[lang] || s.status),
      datasets: [
        {
          data: rows.map((s) => s.count),
          backgroundColor: ['#F59E0B', '#0EA5E9', '#6366F1', '#8B5CF6', '#10B981', '#EF4444', '#78716C', '#14B8A6'],
          borderWidth: 0,
          hoverOffset: 8
        }
      ]
    };
  }, [data, lang]);

  const categoryChart = useMemo(() => {
    if (!data) return null;
    const rows = data.charts.topCategories || [];
    return {
      labels: rows.map((c) => (lang === 'ar' ? c.name : c.nameEn)),
      datasets: [{ label: t('a3.revenue'), data: rows.map((c) => c.revenue), backgroundColor: accent, borderRadius: 6, maxBarThickness: 34 }]
    };
  }, [data, lang, t, accent]);

  const brandChart = useMemo(() => {
    if (!data) return null;
    const rows = data.charts.topBrands || [];
    return {
      labels: rows.map((b) => (lang === 'ar' ? b.name : b.nameEn)),
      datasets: [{ label: t('a3.revenue'), data: rows.map((b) => b.revenue), backgroundColor: ink, borderRadius: 6, maxBarThickness: 34 }]
    };
  }, [data, lang, t, ink]);

  if (isLoading || !data) {
    return (
      <>
        <AdminPageHeader title={t('admin.dashboard')} />
        <StatCardsSkeleton count={4} />
        <div className="mt-6">
          <TableSkeleton rows={6} cols={4} />
        </div>
      </>
    );
  }

  const { sales, orders, conversion, profit, catalog, inventory, topProducts, recentCustomers, recentOrders } = data;
  /* تحصين عقد المخزون: لا نشر لمصفوفة غير موجودة (كان يسقط الصفحة) */
  const inventorySafe = {
    summary: inventory?.summary || {},
    outOfStock: Array.isArray(inventory?.outOfStock) ? inventory.outOfStock : [],
    lowStock: Array.isArray(inventory?.lowStock) ? inventory.lowStock : [],
  };

  /**
   * متجر بلا أي طلب على الإطلاق.
   *
   * كل الرسوم والقوائم أسفل اللوحة مشتقّة من الطلبات، فكانت تعرض
   * سبع بطاقات "لا توجد بيانات" فوق بعضها على متجر جديد. هذا ضجيج
   * بصري يخفي ما يهم فعلاً (دليل البدء والأرقام الأساسية).
   *
   * نخفيها حتى أول طلب حقيقي — وتعود تلقائياً بلا أي إعداد.
   */
  const hasSalesHistory = (orders?.total || 0) > 0;

  return (
    <>
      <AdminPageHeader title={t('admin.dashboard')} subtitle={formatDate(new Date(), lang, false)}>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex h-9 items-center gap-2 rounded-xl border border-black/10 px-3 text-xs font-semibold text-ink transition hover:border-rose hover:text-rose disabled:opacity-50"
        >
          <FiRefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          {t('common.refresh')}
        </button>
      </AdminPageHeader>

      {/*
        دليل البدء قبل الأرقام: على متجر جديد كل الأرقام أصفار،
        فالأولوية لما ينبغي فعله لا لما لم يحدث بعد.
        يختفي تلقائياً عند اكتمال الخطوات.
      */}
      <SetupGuide />

      {/* ---------- المبيعات حسب الفترة ---------- */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FiDollarSign} label={t('a3.todaySales')} value={formatPrice(sales.today.revenue, lang)} growth={sales.today.growth} tone="rose" delay={0} />
        <StatCard icon={FiCalendar} label={t('a3.weekSales')} value={formatPrice(sales.week.revenue, lang)} growth={sales.week.growth} tone="sky" delay={0.05} />
        <StatCard icon={FiTrendingUp} label={t('a3.monthSales')} value={formatPrice(sales.month.revenue, lang)} growth={sales.month.growth} tone="violet" delay={0.1} />
        <StatCard icon={FiDollarSign} label={t('a3.yearSales')} value={formatPrice(sales.year.revenue, lang)} growth={sales.year.growth} tone="emerald" delay={0.15} />
      </div>

      {/* ---------- إحصائيات الطلبات ---------- */}
      <div className="mb-4 grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <MiniStat label={t('admin.totalOrders')} value={formatNumber(orders.total, lang)} icon={FiShoppingCart} />
        <MiniStat label={t('a3.pendingOrders')} value={formatNumber(orders.pending, lang)} tone="text-amber-600" />
        <MiniStat label={t('a3.processingOrders')} value={formatNumber(orders.processing, lang)} tone="text-sky-600" />
        <MiniStat label={t('a3.completedOrders')} value={formatNumber(orders.completed, lang)} tone="text-emerald-600" />
        <MiniStat label={t('a3.cancelledOrders')} value={formatNumber(orders.cancelled, lang)} tone="text-red-600" icon={FiXCircle} />
        <MiniStat label={t('a3.returnedOrders')} value={formatNumber(orders.returned, lang)} tone="text-stone-600" />
      </div>

      {/* ---------- الإيراد والربح والتحويل ---------- */}
      <div className="mb-6 grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <MiniStat label={t('a3.revenue')} value={formatPrice(sales.allTime.revenue, lang)} icon={FiDollarSign} />
        <MiniStat label={t('a3.avgOrderValue')} value={formatPrice(orders.averageValue, lang)} />
        {profit.available ? (
          <>
            <MiniStat label={t('a3.profit')} value={formatPrice(profit.profit, lang)} tone="text-emerald-600" />
            <MiniStat label={t('a3.margin')} value={`${profit.margin}%`} tone="text-emerald-600" icon={FiPercent} />
          </>
        ) : (
          <div className="col-span-2 rounded-xl border border-dashed border-black/15 bg-cream/50 p-3.5">
            <p className="text-[11px] text-ink-muted">{t('a3.profit')}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{t('a3.profitUnavailable')}</p>
          </div>
        )}
        <MiniStat label={t('a3.buyerRate')} value={`${conversion.buyerRate}%`} tone="text-violet-600" />
        <MiniStat label={t('a3.fulfillmentRate')} value={`${conversion.fulfillmentRate}%`} tone="text-emerald-600" />
      </div>

      {/* ---------- الرسوم البيانية (بعد أول طلب فقط) ---------- */}
      {hasSalesHistory ? (
      <>
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <ChartCard
          title={range === 'day' ? t('a3.revenueByDay') : t('a3.revenueByMonth')}
          className="lg:col-span-2"
          action={
            <div className="flex gap-1 rounded-lg bg-cream p-1">
              {[['day', t('a3.revenueByDay')], ['month', t('a3.revenueByMonth')]].map(([k]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setRange(k)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-bold transition',
                    range === k ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
                  )}
                >
                  {k === 'day' ? '30D' : '12M'}
                </button>
              ))}
            </div>
          }
        >
          <div className="h-72">
            {revenueChart ? <Line data={revenueChart} options={baseOptions()} /> : null}
          </div>
        </ChartCard>

        <ChartCard title={t('a3.ordersByStatus')}>
          <div className="h-72">
            {statusChart && statusChart.labels.length ? (
              <Doughnut
                data={statusChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: '62%',
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { font: chartFont, boxWidth: 10, padding: 12, usePointStyle: true }
                    }
                  }
                }}
              />
            ) : (
              <p className="grid h-full place-items-center text-xs text-ink-muted">{t('admin.noData')}</p>
            )}
          </div>
        </ChartCard>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title={t('a3.topCategories')}>
          <div className="h-64">
            {categoryChart?.labels.length ? (
              <Bar data={categoryChart} options={baseOptions()} />
            ) : (
              <p className="grid h-full place-items-center text-xs text-ink-muted">{t('admin.noData')}</p>
            )}
          </div>
        </ChartCard>

        <ChartCard title={t('a3.topBrands')}>
          <div className="h-64">
            {brandChart?.labels.length ? (
              <Bar data={brandChart} options={baseOptions()} />
            ) : (
              <p className="grid h-full place-items-center text-xs text-ink-muted">{t('admin.noData')}</p>
            )}
          </div>
        </ChartCard>
      </div>
      </>
      ) : null}

      {/* ---------- تنبيهات المخزون (مستقلة: تهم حتى قبل أول طلب) ---------- */}
      {inventorySafe.summary.outOfStockCount > 0 || inventorySafe.summary.lowStockCount > 0 ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-base font-bold text-ink">
              <FiAlertTriangle className="text-amber-500" size={17} />
              {t('a3.inventoryAlerts')}
            </h3>
            <Link to="/admin/inventory" className="text-xs font-semibold text-rose hover:underline">
              {t('a3.viewAll')}
            </Link>
          </div>

          <div className="mb-4 grid gap-3 grid-cols-2 lg:grid-cols-4">
            <MiniStat label={t('a3.outOfStock')} value={formatNumber(inventorySafe.summary.outOfStockCount, lang)} tone="text-red-600" />
            <MiniStat label={t('a3.lowStock')} value={formatNumber(inventorySafe.summary.lowStockCount, lang)} tone="text-amber-600" />
            <MiniStat label={t('a3.healthy')} value={formatNumber(inventorySafe.summary.healthyCount, lang)} tone="text-emerald-600" />
            <MiniStat label={t('a3.stockValue')} value={formatPrice(inventorySafe.summary.stockValue, lang)} />
          </div>

          <ul className="grid gap-2 sm:grid-cols-2">
            {[...inventorySafe.outOfStock, ...inventorySafe.lowStock].slice(0, 6).map((p) => (
              <li key={p._id} className="flex items-center gap-3 rounded-xl bg-white p-2.5">
                <SmartImage src={p.mainImage} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="clamp-1 text-xs font-semibold text-ink">{localized(p, lang)}</p>
                  <p className="font-en text-[10px] text-ink-muted">{p.sku}</p>
                </div>
                <span className={cn(
                  'shrink-0 rounded-full px-2 py-1 text-[11px] font-bold',
                  p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                )}>
                  {p.stock}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ---------- جداول (بعد أول طلب فقط) ---------- */}
      {hasSalesHistory ? (
      <>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft lg:col-span-2">
          <div className="flex items-center justify-between border-b border-black/5 p-5">
            <h3 className="text-base font-bold text-ink">{t('admin.recentOrders')}</h3>
            <Link to="/admin/orders" className="text-xs font-semibold text-rose hover:underline">{t('a3.viewAll')}</Link>
          </div>
          {recentOrders.length ? (
            <ul className="divide-y divide-black/5">
              {recentOrders.map((o) => {
                const meta = ORDER_STATUS_META[o.orderStatus] || ORDER_STATUS_META.pending;
                return (
                  <li key={o._id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-en text-sm font-bold text-ink">{o.orderNumber}</p>
                      <p className="clamp-1 text-xs text-ink-muted">
                        {o.user?.name || o.shippingAddress?.governorate || '—'} • {formatDate(o.createdAt, lang)}
                      </p>
                    </div>
                    <Badge className={meta.color}>{meta[lang]}</Badge>
                    <span className="shrink-0 text-sm font-bold text-ink">{formatPrice(o.total, lang)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="p-10 text-center text-xs text-ink-muted">{t('admin.noData')}</p>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-black/5 p-5">
            <h3 className="flex items-center gap-2 text-base font-bold text-ink">
              <FiUsers size={16} className="text-ink-muted" />
              {t('a3.recentCustomers')}
            </h3>
            <Link to="/admin/customers" className="text-xs font-semibold text-rose hover:underline">{t('a3.viewAll')}</Link>
          </div>
          {recentCustomers.length ? (
            <ul className="divide-y divide-black/5">
              {recentCustomers.map((c) => (
                <li key={c._id} className="flex items-center gap-3 p-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blush text-xs font-bold text-ink">
                    {(c.name || '?').charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="clamp-1 text-xs font-semibold text-ink">{c.name}</p>
                    <p className="clamp-1 text-[10px] text-ink-muted">{c.email}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-ink-muted">{formatDate(c.createdAt, lang)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-10 text-center text-xs text-ink-muted">{t('admin.noData')}</p>
          )}
        </div>
      </div>

      {/* ---------- الأكثر مبيعاً ---------- */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-black/5 p-5">
          <h3 className="flex items-center gap-2 text-base font-bold text-ink">
            <FiPackage size={16} className="text-ink-muted" />
            {t('a3.bestSellers')}
          </h3>
          <Link to="/admin/products" className="text-xs font-semibold text-rose hover:underline">{t('a3.viewAll')}</Link>
        </div>
        {topProducts.length ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {topProducts.map((p, i) => (
              <div key={p._id} className="flex items-center gap-3 rounded-xl border border-black/5 p-3">
                <span className="font-en w-5 shrink-0 text-center text-sm font-bold text-rose">{i + 1}</span>
                <SmartImage src={p.mainImage} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="clamp-1 text-xs font-bold text-ink">{localized(p, lang)}</p>
                  <p className="text-[11px] text-ink-muted">
                    {formatNumber(p.units || 0, lang)} {t('a3.units')} • {formatPrice(p.revenue || 0, lang)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-10 text-center text-xs text-ink-muted">{t('admin.noData')}</p>
        )}
      </div>
      </>
      ) : null}
    </>
  );
}
