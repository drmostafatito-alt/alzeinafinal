import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FiAlertTriangle, FiBell, FiBox, FiCreditCard, FiDatabase, FiLayers,
  FiLock, FiPackage, FiRefreshCw, FiRotateCcw, FiShield, FiShoppingCart,
  FiStar, FiTag, FiTrash2, FiTruck, FiUsers, FiCheckCircle, FiX
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import client from '@/api/client';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { registerExtraTranslations, useI18n } from '@/i18n';
import { resetTranslations } from '@/i18n/resetTranslations';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/utils/helpers';

registerExtraTranslations('reset', resetTranslations);

/** تعريف مجموعات الحذف — المفاتيح تطابق مسارات الخادم تماماً */
const GROUPS = [
  { key: 'orders', icon: FiShoppingCart, tone: 'text-rose', main: 'reset.c.orders' },
  { key: 'products', icon: FiPackage, tone: 'text-rose', main: 'reset.c.products' },
  { key: 'categories', icon: FiLayers, tone: 'text-amber-600', main: 'reset.c.categories' },
  { key: 'brands', icon: FiTag, tone: 'text-amber-600', main: 'reset.c.brands' },
  { key: 'reviews', icon: FiStar, tone: 'text-amber-600', main: 'reset.c.reviews' },
  { key: 'returns', icon: FiRotateCcw, tone: 'text-amber-600', main: 'reset.c.returns' },
  { key: 'coupons', icon: FiTag, tone: 'text-amber-600', main: 'reset.c.coupons' },
  { key: 'customers', icon: FiUsers, tone: 'text-amber-600', main: 'reset.c.customers' },
  { key: 'notifications', icon: FiBell, tone: 'text-sky-600', main: 'reset.c.notifications' },
  { key: 'payment-verifications', icon: FiCreditCard, tone: 'text-rose', main: 'reset.c.paymentVerifications' },
  { key: 'inventory', icon: FiBox, tone: 'text-sky-600', main: 'reset.c.totalStock' },
];

/** ملصقات عدادات التبعيات بترتيب عرض ثابت */
const DEP_LABELS = {
  orders: ['orderItems', 'paymentVerifications', 'returnRequests', 'notifications', 'couponUsage', 'stockMovements', 'receiptFiles'],
  products: ['variants', 'productImages', 'stockMovements', 'reviews', 'wishlist', 'productViews', 'r2Files'],
  categories: ['productsLinked'],
  brands: ['productsLinked'],
  reviews: ['affectedProducts'],
  returns: ['r2Files'],
  coupons: ['couponUsage'],
  customers: ['addresses', 'carts', 'wishlist', 'notifications', 'couponUsage'],
  notifications: [],
  'payment-verifications': ['receiptFiles', 'ordersToReset'],
  inventory: ['products', 'stockMovements'],
  'store-reset': [],
};

const resultLabel = (t, k) => (t(`reset.c.${k}`) !== `reset.c.${k}` ? t(`reset.c.${k}`) : k);

/** سطّح عدادات النتيجة لجدول القراءة */
const flattenCounts = (obj) => {
  const out = [];
  const walk = (o, prefix = '') => {
    Object.entries(o || {}).forEach(([k, v]) => {
      if (typeof v === 'number') out.push([prefix ? `${prefix}.${k}` : k, v]);
      else if (v && typeof v === 'object') walk(v, k);
    });
  };
  walk(obj);
  return out;
};

export default function ResetCenter() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [pending, setPending] = useState(null); // {key, phrase}
  const [result, setResult] = useState(null); // {group, title, message, deleted}
  const [form, setForm] = useState({ acknowledge: false, password: '', confirmPhrase: '' });

  const isSuper = useMemo(
    () => user?.role === 'admin' && (user?.staffRole === 'super-admin' || String(user?.email || '').toLowerCase() === 'admin@alzeina.com'),
    [user]
  );

  const preview = useQuery({
    queryKey: ['admin', 'reset-preview'],
    queryFn: () => client.get('/admin/system/reset/preview').then((r) => r.data?.data),
    enabled: isSuper,
    staleTime: 10000,
    retry: false
  });

  const execute = useMutation({
    mutationFn: ({ key, payload }) => client.post(`/admin/system/reset/${key}`, payload),
    onSuccess: (r) => {
      const d = r.data?.data || {};
      setResult({ group: pending?.key, message: r.data?.message, deleted: d.deleted || {} });
      setPending(null);
      setForm({ acknowledge: false, password: '', confirmPhrase: '' });
      qc.invalidateQueries({ queryKey: ['admin'] });
      toast.success(r.data?.message || t('admin.saved'));
    },
    onError: (e) => {
      toast.error(e?.response?.data?.message || t('common.error'));
      setForm((f) => ({ ...f, password: '' }));
    }
  });

  if (!isSuper) {
    return (
      <>
        <AdminPageHeader title={t('reset.title')} subtitle={t('reset.subtitle')} />
        <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <FiLock size={28} className="mx-auto mb-3 text-red-500" />
          <p className="text-base font-bold text-red-700">{t('reset.accessDenied')}</p>
          <p className="mt-2 text-sm text-red-600/80">{t('reset.accessDeniedDesc')}</p>
        </div>
      </>
    );
  }

  const counts = preview.data?.counts || {};
  const phrases = preview.data?.phrases || {};
  const phraseFor = (key) => phrases[key] || RESET_PHRASES_FALLBACK[key] || '';

  const open = (key) => {
    setForm({ acknowledge: false, password: '', confirmPhrase: '' });
    setPending({ key, phrase: phraseFor(key) });
  };

  const canExecute = pending && form.acknowledge && String(form.password || '').length > 0 && form.confirmPhrase === pending.phrase && !execute.isPending;

  return (
    <>
      <AdminPageHeader title={t('reset.title')} subtitle={t('reset.subtitle')}>
        <Button size="sm" variant="outline" icon={FiRefreshCw} onClick={() => preview.refetch()}>
          {t('reset.refresh')}
        </Button>
      </AdminPageHeader>

      {/* إعادة الضبط الشاملة */}
      <section className="mb-6">
        <div className="overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-l from-red-50 to-white shadow-soft">
          <div className="flex flex-wrap items-center gap-4 p-5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-600 text-white">
              <FiAlertTriangle size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-ink">{t('reset.fullReset')}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{t('reset.fullResetDesc')}</p>
            </div>
            <Button variant="danger" icon={FiTrash2} onClick={() => open('store-reset')}>
              {t('reset.g.store')}
            </Button>
          </div>
        </div>
      </section>

      <p className="mb-3 text-xs text-ink-muted">💡 {t('reset.previewHint')}</p>

      {/* العمليات الفردية */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {preview.isLoading ? (
          <div className="sm:col-span-2 xl:col-span-3"><TableSkeleton rows={4} cols={3} /></div>
        ) : preview.isError || !preview.data ? (
          <div className="sm:col-span-2 xl:col-span-3 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800">
            {preview.error?.response?.data?.message || t('common.error')}
          </div>
        ) : (
          GROUPS.map(({ key, icon: Icon, tone, main }) => {
            const g = counts[key] || {};
            const deps = (DEP_LABELS[key] || []).map((k) => [k, g[k]]).filter(([, v]) => typeof v === 'number');
            return (
              <div key={key} className="flex flex-col rounded-2xl border border-black/5 bg-white p-4 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Icon size={18} className={cn('shrink-0', tone)} />
                    <p className="text-sm font-bold text-ink">{t(`reset.g.${key === 'payment-verifications' ? 'payments' : key}`)}</p>
                  </div>
                  <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold text-ink">{g[main] ?? 0}</span>
                </div>
                <div className="mt-3 flex flex-1 flex-wrap gap-1.5">
                  {deps.length ? deps.map(([k, v]) => (
                    <span key={k} className="rounded-lg bg-black/[0.04] px-2 py-1 text-[11px] text-ink-soft">
                      {t(`reset.c.${k}`) !== `reset.c.${k}` ? t(`reset.c.${k}`) : k}: <b className="font-en">{v}</b>
                    </span>
                  )) : (
                    <span className="text-[11px] text-ink-muted">—</span>
                  )}
                </div>
                <Button size="sm" variant="outline" icon={FiTrash2} className="mt-3 self-start" onClick={() => open(key)}>
                  {t('reset.confirm')}
                </Button>
              </div>
            );
          })
        )}
      </section>

      {/* المحمي دائماً */}
      <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
        <div className="flex items-start gap-3">
          <FiShield size={18} className="mt-0.5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-bold text-emerald-800">{t('reset.protectedTitle')}</p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-700/80">{t('reset.protectedDesc')}</p>
          </div>
        </div>
      </section>

      {/* مودال التأكيد */}
      <Modal open={Boolean(pending)} onClose={() => !execute.isPending && setPending(null)} title={t('reset.warningTitle')} size="md">
        <div className="space-y-4 p-6">
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-red-700">
              <FiAlertTriangle size={14} className="mt-0.5 shrink-0" />
              {t('reset.warningBody')}
            </p>
          </div>

          {pending ? (
            <div className="rounded-xl bg-cream p-3 text-center">
              <p className="text-xs text-ink-muted">{t('reset.g.' + (pending.key === 'store-reset' ? 'store' : pending.key === 'payment-verifications' ? 'payments' : pending.key))}</p>
              <p dir="ltr" className="font-en mt-1 text-lg font-black tracking-wide text-red-600">{pending.phrase}</p>
            </div>
          ) : null}

          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.acknowledge}
              onChange={(e) => setForm((f) => ({ ...f, acknowledge: e.target.checked }))}
              className="mt-0.5 h-4 w-4 accent-red-600"
            />
            <span>{t('reset.ack')}</span>
          </label>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-ink">{t('reset.password')}</label>
            <input
              type="password"
              dir="ltr"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder={t('reset.passwordPh')}
              className="input w-full"
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-ink">{t('reset.phraseLabel')}</label>
            <input
              type="text"
              dir="ltr"
              value={form.confirmPhrase}
              onChange={(e) => setForm((f) => ({ ...f, confirmPhrase: e.target.value }))}
              placeholder={pending?.phrase || ''}
              className="input font-en w-full tracking-wide"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setPending(null)} disabled={execute.isPending}>
              {t('reset.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={execute.isPending}
              disabled={!canExecute}
              onClick={() => execute.mutate({ key: pending.key, payload: { password: form.password, confirmPhrase: form.confirmPhrase, acknowledge: form.acknowledge } })}
            >
              {t('reset.confirm')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* نتيجة العملية */}
      <Modal
        open={Boolean(result)}
        onClose={() => setResult(null)}
        title={flattenCounts(result?.deleted).every(([, v]) => v === 0) ? t('reset.emptyTitle') : t('reset.successTitle')}
        size="md"
      >
        <div className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <FiCheckCircle size={22} className="shrink-0 text-emerald-600" />
            <p className="text-sm font-bold text-ink">
              {t('reset.g.' + (result?.group === 'store-reset' ? 'store' : result?.group === 'payment-verifications' ? 'payments' : result?.group || '')) || result?.group}
            </p>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-xl border border-black/5">
            <table className="w-full text-sm">
              <tbody>
                {flattenCounts(result?.deleted).map(([k, v]) => (
                  <tr key={k} className="border-b border-black/5 last:border-0">
                    <td className="px-3 py-2 text-xs text-ink-soft">{resultLabel(t, k)}</td>
                    <td className="font-en w-20 px-3 py-2 text-end text-sm font-bold text-ink">{v}</td>
                  </tr>
                ))}
                {!flattenCounts(result?.deleted).length ? (
                  <tr><td className="px-3 py-4 text-center text-xs text-ink-muted">—</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setResult(null)}>{t('common.close') || 'إغلاق'}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/** احتياط في حال لم تصل العبارات من الخادم بعد */
const RESET_PHRASES_FALLBACK = {
  orders: 'DELETE ORDERS',
  products: 'DELETE PRODUCTS',
  categories: 'DELETE CATEGORIES',
  brands: 'DELETE BRANDS',
  reviews: 'DELETE REVIEWS',
  returns: 'DELETE RETURNS',
  coupons: 'DELETE COUPONS',
  customers: 'DELETE CUSTOMERS',
  notifications: 'DELETE NOTIFICATIONS',
  'payment-verifications': 'DELETE PAYMENT VERIFICATIONS',
  inventory: 'DELETE INVENTORY',
  'store-reset': 'RESET AL ZEINA'
};
