import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { adminService } from '@/services';
import { useI18n } from '@/i18n';
import { formatPrice } from '@/utils/format';
import { localized } from '@/utils/helpers';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Tooltip, Legend);

const PALETTE = ['#C89A8B', '#111111', '#F8E8EA', '#B27D6C', '#916354', '#DDB4A5', '#6E4B3F', '#EBCDC2'];

export default function AdminStatistics() {
  const { t, lang } = useI18n();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: adminService.dashboard });
  const d = data?.data;

  if (isLoading || !d) {
    return (
      <>
        <AdminPageHeader title={t('admin.statistics')} />
        <TableSkeleton rows={6} cols={3} />
      </>
    );
  }

  const { monthly = [], revenueByCategory = [], topProducts = [] } = d;

  const baseOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#111', padding: 12, cornerRadius: 10, bodyFont: { family: 'Cairo' } },
    },
    scales: {
      y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { family: 'Cairo', size: 11 } } },
      x: { grid: { display: false }, ticks: { font: { family: 'Cairo', size: 11 } } },
    },
  };

  const labels = monthly.map((m) => (lang === 'ar' ? m.label : m.labelEn));

  return (
    <>
      <AdminPageHeader title={t('admin.statistics')} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft lg:col-span-2">
          <h3 className="mb-4 text-base font-bold text-ink">{t('admin.salesChart')}</h3>
          <div className="h-80">
            <Line
              data={{
                labels,
                datasets: [
                  {
                    label: t('admin.totalSales'),
                    data: monthly.map((m) => m.sales),
                    borderColor: '#C89A8B',
                    backgroundColor: 'rgba(200,154,139,0.15)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2.5,
                  },
                ],
              }}
              options={baseOpts}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
          <h3 className="mb-4 text-base font-bold text-ink">{t('admin.totalOrders')}</h3>
          <div className="h-72">
            <Bar
              data={{
                labels,
                datasets: [
                  {
                    label: t('admin.totalOrders'),
                    data: monthly.map((m) => m.orders),
                    backgroundColor: '#111111',
                    borderRadius: 8,
                    barThickness: 16,
                  },
                ],
              }}
              options={baseOpts}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
          <h3 className="mb-4 text-base font-bold text-ink">{t('admin.revenueByCategory')}</h3>
          <div className="h-72">
            <Doughnut
              data={{
                labels: revenueByCategory.map((c) => localized(c, lang)),
                datasets: [
                  {
                    data: revenueByCategory.map((c) => Math.round(c.value)),
                    backgroundColor: PALETTE,
                    borderWidth: 0,
                    hoverOffset: 8,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '58%',
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: { font: { family: 'Cairo', size: 11 }, boxWidth: 10, padding: 12, usePointStyle: true },
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft lg:col-span-2">
          <h3 className="mb-4 text-base font-bold text-ink">{t('admin.topProducts')}</h3>
          <div className="h-72">
            <Bar
              data={{
                labels: topProducts.map((p) => localized(p, lang).slice(0, 24)),
                datasets: [
                  {
                    label: t('admin.totalSales'),
                    data: topProducts.map((p) => (p.soldCount || 0) * p.price),
                    backgroundColor: '#C89A8B',
                    borderRadius: 8,
                  },
                ],
              }}
              options={{
                ...baseOpts,
                indexAxis: 'y',
                plugins: {
                  ...baseOpts.plugins,
                  tooltip: {
                    ...baseOpts.plugins.tooltip,
                    callbacks: { label: (ctx) => formatPrice(ctx.parsed.x, lang) },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
