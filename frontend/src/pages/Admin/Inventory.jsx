import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiAlertTriangle, FiEdit3, FiPackage, FiTrendingDown, FiXCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import client from '@/api/client';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Button from '@/components/ui/Button';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/ui/Modal';
import SmartImage from '@/components/ui/SmartImage';
import Input, { Textarea } from '@/components/forms/Input';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useDebounced } from '@/hooks/useDebounced';
import { useI18n } from '@/i18n';
import { formatDate, formatNumber, formatPrice } from '@/utils/format';
import { cn, localized } from '@/utils/helpers';

const MOVEMENT_META = {
  adjustment: { ar: 'تعديل يدوي', en: 'Manual', color: 'bg-sky-100 text-sky-700' },
  order: { ar: 'طلب', en: 'Order', color: 'bg-violet-100 text-violet-700' },
  cancel: { ar: 'إلغاء طلب', en: 'Cancelled', color: 'bg-amber-100 text-amber-700' },
  return: { ar: 'إرجاع', en: 'Return', color: 'bg-emerald-100 text-emerald-700' },
  import: { ar: 'استيراد', en: 'Import', color: 'bg-indigo-100 text-indigo-700' },
  bulk: { ar: 'تحديث جماعي', en: 'Bulk', color: 'bg-stone-200 text-stone-700' },
  correction: { ar: 'تصحيح جرد', en: 'Correction', color: 'bg-rose/15 text-rose' }
};

/** إدارة المخزون: تنبيهات + تعديل يدوي + سجل الحركة */
export default function AdminInventory() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();

  const [tab, setTab] = useState('alerts');
  const [adjusting, setAdjusting] = useState(null);
  const [form, setForm] = useState({ stock: '', reason: '' });
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 350);

  const alertsQ = useQuery({
    queryKey: ['admin', 'inventory', 'alerts'],
    queryFn: () => client.get('/admin/inventory/alerts').then((r) => r.data?.data),
    staleTime: 30000
  });

  const movementsQ = useQuery({
    queryKey: ['admin', 'inventory', 'movements', typeFilter, debouncedSearch],
    queryFn: () =>
      client
        .get('/admin/inventory/movements', {
          params: { type: typeFilter, q: debouncedSearch || undefined, limit: 100 }
        })
        .then((r) => r.data?.data),
    enabled: tab === 'movements',
    staleTime: 20000
  });

  const adjust = useMutation({
    mutationFn: (payload) => client.post('/admin/inventory/adjust', payload),
    onSuccess: (r) => {
      toast.success(r.data?.message || t('admin.saved'));
      setAdjusting(null);
      qc.invalidateQueries({ queryKey: ['admin', 'inventory'] });
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      qc.invalidateQueries({ queryKey: ['admin', 'analytics'] });
      // إبطال كاش واجهة المتجر أيضاً — كان المخزون يظهر قديماً حتى خمس دقائق
      // في المتجر بعد التعديل (نفس فئة إصلاح «المنتج لا يظهر في المتجر»).
      qc.invalidateQueries({ queryKey: ['products'] });
      for (const k of ['featured', 'bestSellers', 'newArrivals', 'onSale', 'product', 'products-ids'])
        qc.invalidateQueries({ queryKey: [k] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const summary = alertsQ.data?.summary;
  const alertItems = useMemo(() => {
    const d = alertsQ.data;
    if (!d) return [];
    return [...(d.outOfStock || []), ...(d.lowStock || [])];
  }, [alertsQ.data]);

  const openAdjust = (p) => {
    setAdjusting(p);
    setForm({ stock: String(p.stock ?? 0), reason: '' });
  };

  const submitAdjust = () => {
    const value = Number(form.stock);
    if (!Number.isFinite(value) || value < 0) {
      toast.error(t('a3.noNegativeStock'));
      return;
    }
    adjust.mutate({ productId: adjusting._id, stock: value, reason: form.reason });
  };

  const alertColumns = [
    {
      key: 'name',
      header: t('common.name'),
      render: (p) => (
        <div className="flex items-center gap-3">
          <SmartImage src={p.mainImage} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0">
            <p className="clamp-1 text-sm font-semibold text-ink">{localized(p, lang)}</p>
            <p className="font-en text-[11px] text-ink-muted">{p.sku}</p>
          </div>
        </div>
      )
    },
    { key: 'category.name', header: t('common.category'), render: (p) => localized(p.category, lang) || '—', hideOnMobile: true },
    { key: 'brand.name', header: t('common.brandLabel'), render: (p) => localized(p.brand, lang) || '—', hideOnMobile: true },
    { key: 'price', header: t('common.price'), render: (p) => formatPrice(p.price, lang), hideOnMobile: true },
    {
      key: 'stock',
      header: t('admin.stock'),
      render: (p) => (
        <span className={cn(
          'rounded-full px-2.5 py-1 text-[11px] font-bold',
          p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
        )}>
          {p.stock === 0 ? t('a3.outOfStock') : p.stock}
        </span>
      )
    }
  ];

  const movementColumns = [
    {
      key: 'productName',
      header: t('common.name'),
      render: (m) => (
        <div className="min-w-0">
          <p className="clamp-1 text-sm font-semibold text-ink">{m.productName || '—'}</p>
          <p className="font-en text-[11px] text-ink-muted">{m.sku}</p>
        </div>
      )
    },
    {
      key: 'type',
      header: t('a3.movementType'),
      render: (m) => {
        const meta = MOVEMENT_META[m.type] || MOVEMENT_META.adjustment;
        return <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', meta.color)}>{meta[lang]}</span>;
      }
    },
    {
      key: 'quantity',
      header: t('common.quantity'),
      render: (m) => (
        <span className={cn('font-en text-sm font-bold', m.quantity < 0 ? 'text-red-600' : 'text-emerald-600')}>
          {m.quantity > 0 ? '+' : ''}{m.quantity}
        </span>
      )
    },
    {
      key: 'stockAfter',
      header: `${t('a3.stockBefore')} → ${t('a3.stockAfter')}`,
      render: (m) => <span className="font-en text-xs text-ink-muted">{m.stockBefore} → <b className="text-ink">{m.stockAfter}</b></span>,
      hideOnMobile: true
    },
    { key: 'reason', header: t('a3.adjustReason'), render: (m) => <span className="clamp-1 text-xs text-ink-muted">{m.reason || '—'}</span>, hideOnMobile: true },
    { key: 'userName', header: t('a3.performedBy'), render: (m) => <span className="text-xs">{m.userName || '—'}</span>, hideOnMobile: true },
    { key: 'createdAt', header: t('a3.dateTime'), render: (m) => <span className="text-[11px] text-ink-muted">{formatDate(m.createdAt, lang)}</span> }
  ];

  return (
    <>
      <AdminPageHeader title={t('a3.inventory')} subtitle={t('a3.inventoryAlerts')} />

      {/* ملخّص */}
      {summary ? (
        <div className="mb-5 grid gap-3 grid-cols-2 lg:grid-cols-5">
          {[
            { label: t('a3.outOfStock'), value: summary.outOfStockCount, tone: 'text-red-600', icon: FiXCircle },
            { label: t('a3.lowStock'), value: summary.lowStockCount, tone: 'text-amber-600', icon: FiAlertTriangle },
            { label: t('a3.healthy'), value: summary.healthyCount, tone: 'text-emerald-600', icon: FiPackage },
            { label: t('a3.totalUnits'), value: formatNumber(summary.totalUnits, lang), tone: 'text-ink', icon: FiPackage },
            { label: t('a3.stockValue'), value: formatPrice(summary.stockValue, lang), tone: 'text-ink', icon: FiTrendingDown }
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-black/5 bg-white p-4 shadow-soft">
              <div className="flex items-center gap-2">
                <s.icon size={13} className="shrink-0 text-ink-muted" />
                <p className="clamp-1 text-[11px] text-ink-muted">{s.label}</p>
              </div>
              <p className={cn('mt-1.5 text-xl font-bold', s.tone)}>{s.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* تبويبات */}
      <div className="mb-4 flex gap-2">
        {[['alerts', t('a3.inventoryAlerts')], ['movements', t('a3.stockMovements')]].map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              'rounded-full px-4 py-2 text-xs font-bold transition',
              tab === k ? 'bg-ink text-white' : 'border border-black/10 bg-white text-ink hover:border-rose hover:text-rose'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'alerts' ? (
        alertsQ.isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : (
          <DataTable
            columns={alertColumns}
            data={alertItems}
            searchKeys={['name', 'nameEn', 'sku']}
            emptyMessage={t('admin.noData')}
            actions={(row) => (
              <Button size="sm" variant="outline" icon={FiEdit3} onClick={() => openAdjust(row)}>
                {t('a3.adjustStock')}
              </Button>
            )}
          />
        )
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.searchPlaceholder')}
              className="input h-10 max-w-xs py-2 text-sm"
              aria-label={t('admin.searchPlaceholder')}
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input h-10 max-w-[180px] py-2 text-sm"
              aria-label={t('a3.movementType')}
            >
              <option value="all">{t('a3.allTypes')}</option>
              {Object.entries(MOVEMENT_META).map(([k, v]) => (
                <option key={k} value={k}>{v[lang]}</option>
              ))}
            </select>
          </div>

          {movementsQ.isLoading ? (
            <TableSkeleton rows={8} cols={5} />
          ) : (
            <DataTable
              columns={movementColumns}
              data={movementsQ.data?.movements || []}
              searchable={false}
              pageSize={25}
              emptyMessage={t('admin.noData')}
            />
          )}
        </>
      )}

      {/* تعديل المخزون */}
      <Modal open={Boolean(adjusting)} onClose={() => setAdjusting(null)} title={t('a3.adjustStock')} size="sm">
        {adjusting ? (
          <div className="space-y-4 p-6">
            <div className="flex items-center gap-3 rounded-xl bg-cream p-3">
              <SmartImage src={adjusting.mainImage} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0">
                <p className="clamp-1 text-sm font-semibold text-ink">{localized(adjusting, lang)}</p>
                <p className="font-en text-[11px] text-ink-muted">
                  {adjusting.sku} • {t('a3.stockBefore')}: {adjusting.stock}
                </p>
              </div>
            </div>

            <Input
              label={t('a3.newStock')}
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
              hint={t('a3.noNegativeStock')}
            />
            <Textarea
              label={t('a3.adjustReason')}
              rows={2}
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            />

            <div className="flex gap-3 pt-1">
              <Button className="flex-1" loading={adjust.isPending} onClick={submitAdjust}>
                {t('common.save')}
              </Button>
              <Button variant="outline" onClick={() => setAdjusting(null)}>{t('common.cancel')}</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
