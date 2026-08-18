import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiPlus, FiSave, FiTruck } from 'react-icons/fi';
import { toast } from 'react-toastify';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import DataTable from '@/components/admin/DataTable';
import Input, { Checkbox, Select, Textarea } from '@/components/forms/Input';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import RowActions from '@/components/admin/RowActions';
import { TableSkeleton } from '@/components/ui/Skeleton';
import client from '@/api/client';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/helpers';

const TABS = ['general', 'governorates', 'zones', 'companies'];

export default function AdminShipping() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState('general');

  /* ---------- الإعدادات العامة ---------- */
  const { data: settingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => client.get('/admin/settings').then((r) => r.data?.data?.settings)
  });

  const settingsForm = useForm();
  useEffect(() => {
    if (settingsData?.shipping) settingsForm.reset(settingsData.shipping);
  }, [settingsData, settingsForm]);

  const saveSettings = useMutation({
    mutationFn: (shipping) => client.put('/admin/settings', { shipping }),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
    onError: () => toast.error(t('common.error'))
  });

  /* ---------- المحافظات ---------- */
  const { data: govData } = useQuery({
    queryKey: ['admin', 'governorates'],
    queryFn: () => client.get('/admin/governorates').then((r) => r.data?.data)
  });
  const governorates = govData?.governorates || [];
  const [dirty, setDirty] = useState({});
  const govForm = useForm({ defaultValues: { name:'', nameEn:'', code:'', shippingCost:50, codEnabled:true } });
  const saveGov = useMutation({ mutationFn: (v) => client.post('/admin/governorates', v), onSuccess: () => { toast.success(t('admin.saved')); govForm.reset(); qc.invalidateQueries({queryKey:['admin','governorates']}); }, onError:(e)=>toast.error(e?.response?.data?.message||t('common.error')) });

  const saveGovs = useMutation({
    mutationFn: (items) => client.put('/admin/governorates-bulk', { items }),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      setDirty({});
      qc.invalidateQueries({ queryKey: ['admin', 'governorates'] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const toggleGov = useMutation({
    mutationFn: ({ id, field }) => client.patch(`/admin/governorates/${id}/${field}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'governorates'] })
  });

  /* ---------- المناطق ---------- */
  const { data: zoneData } = useQuery({
    queryKey: ['admin', 'shipping-zones'],
    queryFn: () => client.get('/admin/shipping-zones').then((r) => r.data?.data)
  });
  const zones = zoneData?.zones || [];
  const [zoneModal, setZoneModal] = useState(null);
  const zoneForm = useForm();
  useEffect(() => {
    if (zoneModal) zoneForm.reset(zoneModal._id ? zoneModal : { cost: 50, estimatedDaysMin: 2, estimatedDaysMax: 5, isActive: true });
  }, [zoneModal, zoneForm]);

  const saveZone = useMutation({
    mutationFn: (v) => (v._id ? client.put(`/admin/shipping-zones/${v._id}`, v) : client.post('/admin/shipping-zones', v)),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      setZoneModal(null);
      qc.invalidateQueries({ queryKey: ['admin', 'shipping-zones'] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const [deleteZone, setDeleteZone] = useState(null);
  const removeZone = useMutation({
    mutationFn: (id) => client.delete(`/admin/shipping-zones/${id}`),
    onSuccess: () => {
      toast.success(t('admin.deleted'));
      setDeleteZone(null);
      qc.invalidateQueries({ queryKey: ['admin', 'shipping-zones'] });
    }
  });

  /* ---------- شركات الشحن ---------- */
  const { data: companyData } = useQuery({
    queryKey: ['admin', 'shipping-companies'],
    queryFn: () => client.get('/admin/shipping-companies').then((r) => r.data?.data)
  });
  const companies = companyData?.companies || [];
  const [companyModal, setCompanyModal] = useState(null);
  const companyForm = useForm();
  useEffect(() => {
    if (companyModal) companyForm.reset(companyModal._id ? companyModal : { isActive: true });
  }, [companyModal, companyForm]);

  const saveCompany = useMutation({
    mutationFn: (v) => (v._id ? client.put(`/admin/shipping-companies/${v._id}`, v) : client.post('/admin/shipping-companies', v)),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      setCompanyModal(null);
      qc.invalidateQueries({ queryKey: ['admin', 'shipping-companies'] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const [deleteCompany, setDeleteCompany] = useState(null);
  const removeCompany = useMutation({
    mutationFn: (id) => client.delete(`/admin/shipping-companies/${id}`),
    onSuccess: () => {
      toast.success(t('admin.deleted'));
      setDeleteCompany(null);
      qc.invalidateQueries({ queryKey: ['admin', 'shipping-companies'] });
    }
  });

  const zoneOptions = zones.map((z) => ({ value: z._id, label: z.name }));

  return (
    <>
      <AdminPageHeader title={t('admin.shipping')} />

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition',
              tab === key ? 'bg-ink text-white' : 'border border-black/10 bg-white text-ink hover:border-rose hover:text-rose'
            )}
          >
            {key === 'general' ? t('admin.settings')
              : key === 'governorates' ? `${t('admin.governorates')} (${governorates.length})`
              : key === 'zones' ? `${t('admin.zones')} (${zones.length})`
              : `${t('admin.companies')} (${companies.length})`}
          </button>
        ))}
      </div>

      {/* ---------- عام ---------- */}
      {tab === 'general' ? (
        loadingSettings ? (
          <TableSkeleton rows={4} cols={2} />
        ) : (
          <form
            onSubmit={settingsForm.handleSubmit((v) =>
              saveSettings.mutate({
                ...v,
                defaultCost: Number(v.defaultCost),
                freeShippingThreshold: Number(v.freeShippingThreshold),
                estimatedDaysMin: Number(v.estimatedDaysMin),
                estimatedDaysMax: Number(v.estimatedDaysMax)
              })
            )}
            className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft"
          >
            <div className="mb-5 space-y-3">
              <Checkbox label={t('admin.shipping')} {...settingsForm.register('enabled')} />
              <Checkbox label={t('checkout.cod')} {...settingsForm.register('codEnabled')} />
              <Checkbox label={t('admin.freeShipping')} {...settingsForm.register('freeShippingEnabled')} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label={`${t('cart.shipping')} (${t('common.currency')})`} type="number" {...settingsForm.register('defaultCost')} />
              <Input label={t('admin.threshold')} type="number" {...settingsForm.register('freeShippingThreshold')} />
              <Input label={`${t('admin.deliveryDays')} — ${t('shop.minPrice')}`} type="number" {...settingsForm.register('estimatedDaysMin')} />
              <Input label={`${t('admin.deliveryDays')} — ${t('shop.maxPrice')}`} type="number" {...settingsForm.register('estimatedDaysMax')} />
              <Textarea label={t('common.description')} rows={2} containerClassName="sm:col-span-2" {...settingsForm.register('note')} />
            </div>
            <Button type="submit" loading={saveSettings.isPending} icon={FiSave} className="mt-5">
              {t('common.save')}
            </Button>
          </form>
        )
      ) : null}

      {/* ---------- المحافظات ---------- */}
      {tab === 'governorates' ? (
        <>
          <div className="mb-4 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 p-4">
              <p className="text-sm text-ink-muted">{t('admin.governorates')} ({governorates.length})</p>
              {Object.keys(dirty).length > 0 ? (
                <Button size="sm" icon={FiSave} loading={saveGovs.isPending} onClick={() => saveGovs.mutate(Object.entries(dirty).map(([id, v]) => ({ id, ...v })))}>
                  {t('common.save')} ({Object.keys(dirty).length})
                </Button>
              ) : null}
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-cream/90 text-xs uppercase text-ink-muted backdrop-blur">
                  <tr>
                    <th className="px-4 py-3 text-start font-bold">{t('checkout.governorate')}</th>
                    <th className="px-4 py-3 text-start font-bold">{t('admin.zones')}</th>
                    <th className="px-4 py-3 text-start font-bold">{t('cart.shipping')}</th>
                    <th className="px-4 py-3 text-center font-bold">{t('checkout.cod')}</th>
                    <th className="px-4 py-3 text-center font-bold">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {governorates.map((g) => (
                    <tr key={g._id} className={cn('transition', !g.isActive && 'opacity-50')}>
                      <td className="px-4 py-2.5">
                        <p className="text-sm font-semibold text-ink">{lang === 'ar' ? g.name : g.nameEn || g.name}</p>
                        <p className="font-en text-[10px] text-ink-muted">{g.code}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          defaultValue={g.zoneId || ''}
                          onChange={(e) => setDirty((d) => ({ ...d, [g._id]: { ...d[g._id], zoneId: e.target.value } }))}
                          className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs outline-none focus:border-rose"
                        >
                          <option value="">—</option>
                          {zoneOptions.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <input type="number" defaultValue={g.shippingCost ?? ''} onChange={(e) => setDirty((d) => ({ ...d, [g._id]: { ...d[g._id], shippingCost: e.target.value === '' ? null : Number(e.target.value) } }))} className="w-24 rounded-lg border border-black/10 px-2 py-1.5 text-xs outline-none focus:border-rose" />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input type="checkbox" checked={!!g.codEnabled} onChange={() => toggleGov.mutate({ id: g._id, field: 'codEnabled' })} className="h-4 w-4 accent-rose" />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button type="button" onClick={() => toggleGov.mutate({ id: g._id, field: 'isActive' })}>
                          <Badge variant={g.isActive ? 'success' : 'neutral'}>{g.isActive ? t('common.active') : t('common.inactive')}</Badge>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
            <h3 className="mb-4 text-sm font-bold text-ink">{t('common.add')} / {t('common.edit')}</h3>
            <form onSubmit={govForm.handleSubmit((v) => saveGov.mutate({ ...v, isActive: true, codEnabled: v.codEnabled ?? true, shippingCost: Number(v.shippingCost || 50) }))} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Input label={`${t('common.name')} (AR)`} required {...govForm.register('name', { required: true })} />
              <Input label={`${t('common.name')} (EN)`} dir="ltr" {...govForm.register('nameEn')} />
              <Input label="Code" dir="ltr" required {...govForm.register('code', { required: true })} />
              <Input label={t('cart.shipping')} type="number" {...govForm.register('shippingCost')} />
              <div className="flex items-end gap-3">
                <Checkbox label={t('checkout.cod')} {...govForm.register('codEnabled')} />
                <Button type="submit" loading={saveGov.isPending}>{t('common.add')}</Button>
              </div>
            </form>
          </div>
        </>
      ) : null}

      {/* ---------- المناطق ---------- */}
      {tab === 'zones' ? (
        <>
          <div className="mb-4 flex justify-end">
            <Button size="sm" icon={FiPlus} onClick={() => setZoneModal({})}>
              {t('common.add')}
            </Button>
          </div>
          <DataTable
            columns={[
              { key: 'name', header: t('common.name'), render: (z) => <span className="font-semibold">{z.name}</span> },
              { key: 'cost', header: t('cart.shipping'), render: (z) => z.cost },
              { key: 'estimatedDaysMin', header: t('admin.deliveryDays'), render: (z) => `${z.estimatedDaysMin}–${z.estimatedDaysMax}` },
              { key: 'freeShippingThreshold', header: t('admin.threshold'), render: (z) => z.freeShippingThreshold ?? '—' },
              {
                key: 'isActive',
                header: t('common.status'),
                render: (z) => <Badge variant={z.isActive ? 'success' : 'neutral'}>{z.isActive ? t('common.active') : t('common.inactive')}</Badge>
              }
            ]}
            data={zones}
            searchable={false}
            actions={(z) => <RowActions onEdit={() => setZoneModal(z)} onDelete={() => setDeleteZone(z._id)} />}
          />
        </>
      ) : null}

      {/* ---------- شركات الشحن ---------- */}
      {tab === 'companies' ? (
        <>
          <div className="mb-4 flex justify-end">
            <Button size="sm" icon={FiPlus} onClick={() => setCompanyModal({})}>
              {t('common.add')}
            </Button>
          </div>
          <DataTable
            columns={[
              {
                key: 'name',
                header: t('common.name'),
                render: (c) => (
                  <span className="flex items-center gap-2 font-semibold">
                    <FiTruck className="text-rose" size={14} /> {c.name}
                  </span>
                )
              },
              { key: 'phone', header: t('common.phone'), render: (c) => c.phone || '—' },
              { key: 'trackingUrlTemplate', header: t('admin.tracking'), render: (c) => <span className="font-en text-[11px] text-ink-muted">{c.trackingUrlTemplate || '—'}</span> },
              {
                key: 'isActive',
                header: t('common.status'),
                render: (c) => <Badge variant={c.isActive ? 'success' : 'neutral'}>{c.isActive ? t('common.active') : t('common.inactive')}</Badge>
              }
            ]}
            data={companies}
            searchable={false}
            actions={(c) => <RowActions onEdit={() => setCompanyModal(c)} onDelete={() => setDeleteCompany(c._id)} />}
          />
        </>
      ) : null}

      {/* مودال المنطقة */}
      <Modal open={Boolean(zoneModal)} onClose={() => setZoneModal(null)} title={t('admin.zones')}>
        <form onSubmit={zoneForm.handleSubmit((v) => saveZone.mutate({ ...v, _id: zoneModal?._id }))} className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={`${t('common.name')} (AR)`} required {...zoneForm.register('name', { required: true })} />
            <Input label={`${t('common.name')} (EN)`} dir="ltr" {...zoneForm.register('nameEn')} />
            <Input label={t('cart.shipping')} type="number" required {...zoneForm.register('cost', { required: true })} />
            <Input label={t('admin.threshold')} type="number" hint={t('common.optional')} {...zoneForm.register('freeThreshold')} />
            <Input label={`${t('admin.deliveryDays')} min`} type="number" {...zoneForm.register('estimatedDaysMin')} />
            <Input label={`${t('admin.deliveryDays')} max`} type="number" {...zoneForm.register('estimatedDaysMax')} />
          </div>
          <Checkbox label={t('common.active')} {...zoneForm.register('isActive')} />
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saveZone.isPending} className="flex-1">{t('common.save')}</Button>
            <Button type="button" variant="outline" onClick={() => setZoneModal(null)}>{t('common.cancel')}</Button>
          </div>
        </form>
      </Modal>

      {/* مودال شركة الشحن */}
      <Modal open={Boolean(companyModal)} onClose={() => setCompanyModal(null)} title={t('admin.companies')}>
        <form onSubmit={companyForm.handleSubmit((v) => saveCompany.mutate({ ...v, _id: companyModal?._id }))} className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={`${t('common.name')} (AR)`} required {...companyForm.register('name', { required: true })} />
            <Input label={`${t('common.name')} (EN)`} dir="ltr" {...companyForm.register('nameEn')} />
            <Input label={t('common.phone')} dir="ltr" {...companyForm.register('name')} />
            <Input label={t('common.email')} type="email" dir="ltr"  />
            <Input
              label={t('admin.tracking')}
              dir="ltr"
              hint="https://track.example.com/{tracking}"
              containerClassName="sm:col-span-2"
              {...companyForm.register('trackingUrl')}
            />
          </div>
          <Checkbox label={t('common.active')} {...companyForm.register('isActive')} />
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saveCompany.isPending} className="flex-1">{t('common.save')}</Button>
            <Button type="button" variant="outline" onClick={() => setCompanyModal(null)}>{t('common.cancel')}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteZone)}
        onClose={() => setDeleteZone(null)}
        onConfirm={() => removeZone.mutate(deleteZone)}
        title={t('admin.confirmDelete')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        danger
      />
      <ConfirmDialog
        open={Boolean(deleteCompany)}
        onClose={() => setDeleteCompany(null)}
        onConfirm={() => removeCompany.mutate(deleteCompany)}
        title={t('admin.confirmDelete')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}
