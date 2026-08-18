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
import { useConfig } from '@/config/ConfigProvider';
import { cn } from '@/utils/helpers';

const TABS = ['general', 'governorates', 'zones', 'companies'];

export default function AdminShipping() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const { reload: reloadConfig } = useConfig();
  const [tab, setTab] = useState('general');
  const [selectedCountry, setSelectedCountry] = useState('EG');

  /* ---------- إعدادات البلاد من D1 ---------- */
  const { data: countriesData } = useQuery({
    queryKey: ['admin', 'countries'],
    queryFn: () => client.get('/admin/countries').then((r) => r.data?.data)
  });
  const countriesList = countriesData?.countries || [];
  const currentCountryRow = countriesList.find((c) => c.code === selectedCountry) || null;

  /* ---------- الإعدادات العامة ---------- */
  const { data: settingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => client.get('/admin/settings').then((r) => r.data?.data?.settings)
  });

  const settingsForm = useForm();

  useEffect(() => {
    const baseShipping = settingsData?.shipping || {};
    let overrides = {};
    if (currentCountryRow?.shipping) {
      try {
        overrides = typeof currentCountryRow.shipping === 'string' ? JSON.parse(currentCountryRow.shipping) : currentCountryRow.shipping;
      } catch { /* noop */ }
    }
    const merged = { ...baseShipping, ...overrides };
    settingsForm.reset({
      enabled: merged.enabled !== false,
      codEnabled: merged.codEnabled !== false,
      freeShippingEnabled: merged.freeShippingEnabled !== false,
      defaultCost: Number(merged.defaultCost) || 0,
      freeShippingThreshold: Number(merged.freeShippingThreshold) || 0,
      estimatedDaysMin: Number(merged.estimatedDaysMin) || 2,
      estimatedDaysMax: Number(merged.estimatedDaysMax) || 5,
      note: merged.note || ''
    });
  }, [settingsData, currentCountryRow, selectedCountry, settingsForm]);

  const saveSettings = useMutation({
    mutationFn: async (shipping) => {
      // نحفظ التجاوزات الخاصة بالبلد في جدول countries
      if (selectedCountry) {
        await client.put(`/admin/countries/${selectedCountry}`, {
          shipping: JSON.stringify(shipping)
        });
      }
      // إذا كانت مصر، نحدث أيضاً الإعدادات العامة
      if (selectedCountry === 'EG') {
        await client.put('/admin/settings', { shipping });
      }
    },
    onSuccess: () => {
      toast.success(t('admin.saved'));
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      qc.invalidateQueries({ queryKey: ['admin', 'countries'] });
      qc.invalidateQueries({ queryKey: ['storefront', 'config'] });
      reloadConfig?.();
    },
    onError: () => toast.error(t('common.error'))
  });

  /* ---------- المحافظات / الإمارات ---------- */
  const { data: govData, isLoading: loadingGovs } = useQuery({
    queryKey: ['admin', 'governorates', selectedCountry],
    queryFn: () => client.get('/admin/governorates', { params: { countryCode: selectedCountry } }).then((r) => r.data?.data)
  });
  const governorates = govData?.governorates || [];
  const [dirty, setDirty] = useState({});

  const govForm = useForm({ defaultValues: { name: '', nameEn: '', code: '', countryCode: selectedCountry, shippingCost: 50, codEnabled: true } });

  useEffect(() => {
    govForm.setValue('countryCode', selectedCountry);
  }, [selectedCountry, govForm]);

  const saveGov = useMutation({
    mutationFn: (v) => client.post('/admin/governorates', { ...v, countryCode: selectedCountry }),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      govForm.reset({ name: '', nameEn: '', code: '', countryCode: selectedCountry, shippingCost: 50, codEnabled: true });
      qc.invalidateQueries({ queryKey: ['admin', 'governorates'] });
      qc.invalidateQueries({ queryKey: ['storefront', 'config'] });
      reloadConfig?.();
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const saveGovs = useMutation({
    mutationFn: (items) => client.put('/admin/governorates-bulk', { items }),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      setDirty({});
      qc.invalidateQueries({ queryKey: ['admin', 'governorates'] });
      qc.invalidateQueries({ queryKey: ['storefront', 'config'] });
      reloadConfig?.();
    },
    onError: () => toast.error(t('common.error'))
  });

  const toggleGov = useMutation({
    mutationFn: ({ id, field }) => client.patch(`/admin/governorates/${id}/${field}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'governorates'] });
      qc.invalidateQueries({ queryKey: ['storefront', 'config'] });
      reloadConfig?.();
    }
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
      reloadConfig?.();
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
      reloadConfig?.();
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
      reloadConfig?.();
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
      reloadConfig?.();
    }
  });

  const zoneOptions = zones.map((z) => ({ value: z._id, label: z.name }));
  const currencyLabel = selectedCountry === 'AE' ? 'د.إ (AED)' : 'ج.م (EGP)';

  return (
    <>
      <AdminPageHeader title={t('admin.shipping')} />

      {/* شريط اختيار الدولة لجميع التبويبات */}
      <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white p-3 shadow-soft">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-ink-muted">البلد المستهدف:</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setSelectedCountry('EG'); setDirty({}); }}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition',
                selectedCountry === 'EG' ? 'bg-rose text-white shadow-sm' : 'border border-black/10 bg-cream text-ink hover:border-rose'
              )}
            >
              <span>🇪🇬</span>
              <span>مصر (EGP)</span>
            </button>
            <button
              type="button"
              onClick={() => { setSelectedCountry('AE'); setDirty({}); }}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition',
                selectedCountry === 'AE' ? 'bg-rose text-white shadow-sm' : 'border border-black/10 bg-cream text-ink hover:border-rose'
              )}
            >
              <span>🇦🇪</span>
              <span>الإمارات (AED)</span>
            </button>
          </div>
        </div>
        <Badge variant="blush">{currencyLabel}</Badge>
      </div>

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
            {key === 'general'
              ? `${t('admin.settings')} (${selectedCountry === 'AE' ? 'الإمارات' : 'مصر'})`
              : key === 'governorates'
              ? `${selectedCountry === 'AE' ? 'الإمارات والمدن' : t('admin.governorates')} (${governorates.length})`
              : key === 'zones'
              ? `${t('admin.zones')} (${zones.length})`
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
                defaultCost: Number(v.defaultCost) || 0,
                freeShippingThreshold: Number(v.freeShippingThreshold) || 0,
                estimatedDaysMin: Number(v.estimatedDaysMin) || 2,
                estimatedDaysMax: Number(v.estimatedDaysMax) || 5
              })
            )}
            className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft"
          >
            <div className="mb-4 flex items-center justify-between border-b border-black/5 pb-3">
              <h3 className="text-sm font-bold text-ink">
                إعدادات الشحن العامة — {selectedCountry === 'AE' ? 'الإمارات العربية المتحدة 🇦🇪' : 'جمهورية مصر العربية 🇪🇬'}
              </h3>
              <Badge variant="blush">{currencyLabel}</Badge>
            </div>
            <div className="mb-5 space-y-3">
              <Checkbox label={t('admin.shipping')} {...settingsForm.register('enabled')} />
              <Checkbox label={t('checkout.cod')} {...settingsForm.register('codEnabled')} />
              <Checkbox label={t('admin.freeShipping')} {...settingsForm.register('freeShippingEnabled')} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label={`${t('cart.shipping')} الافتراضي (${currencyLabel})`} type="number" {...settingsForm.register('defaultCost')} />
              <Input label={`${t('admin.threshold')} للشحن المجاني (${currencyLabel})`} type="number" {...settingsForm.register('freeShippingThreshold')} />
              <Input label={`${t('admin.deliveryDays')} — ${t('shop.minPrice')}`} type="number" {...settingsForm.register('estimatedDaysMin')} />
              <Input label={`${t('admin.deliveryDays')} — ${t('shop.maxPrice')}`} type="number" {...settingsForm.register('estimatedDaysMax')} />
              <Textarea label={t('common.description')} rows={2} containerClassName="sm:col-span-2" {...settingsForm.register('note')} />
            </div>
            <Button type="submit" loading={saveSettings.isPending} icon={FiSave} className="mt-5">
              {t('common.save')} ({selectedCountry === 'AE' ? 'الإمارات' : 'مصر'})
            </Button>
          </form>
        )
      ) : null}

      {/* ---------- المحافظات / الإمارات ---------- */}
      {tab === 'governorates' ? (
        <>
          <div className="mb-4 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 p-4">
              <div>
                <p className="text-sm font-bold text-ink">
                  {selectedCountry === 'AE' ? 'إمارات الدولة (7)' : 'محافظات مصر (27)'} — {governorates.length}
                </p>
                <p className="text-[11px] text-ink-muted">
                  تعديل أسعار الشحن وحالة التفعيل يتم حفظها مباشرة في قاعدة البيانات D1.
                </p>
              </div>
              {Object.keys(dirty).length > 0 ? (
                <Button
                  size="sm"
                  icon={FiSave}
                  loading={saveGovs.isPending}
                  onClick={() =>
                    saveGovs.mutate(
                      Object.entries(dirty).map(([id, v]) => {
                        const target = governorates.find((x) => (x._id || x.id) === id);
                        return { id, ...target, ...v, countryCode: selectedCountry };
                      })
                    )
                  }
                >
                  {t('common.save')} ({Object.keys(dirty).length})
                </Button>
              ) : null}
            </div>
            {loadingGovs ? (
              <TableSkeleton rows={6} cols={4} />
            ) : (
              <div className="max-h-[560px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-cream/90 text-xs uppercase text-ink-muted backdrop-blur">
                    <tr>
                      <th className="px-4 py-3 text-start font-bold">
                        {selectedCountry === 'AE' ? 'الإمارة / المنطقة' : t('checkout.governorate')}
                      </th>
                      <th className="px-4 py-3 text-start font-bold">{t('admin.zones')}</th>
                      <th className="px-4 py-3 text-start font-bold">سعر الشحن ({currencyLabel})</th>
                      <th className="px-4 py-3 text-center font-bold">{t('checkout.cod')}</th>
                      <th className="px-4 py-3 text-center font-bold">{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {governorates.map((g) => {
                      const id = g._id || g.id;
                      const isRowDirty = Boolean(dirty[id]);
                      return (
                        <tr key={id} className={cn('transition', !g.isActive && 'opacity-50', isRowDirty && 'bg-amber-50/50')}>
                          <td className="px-4 py-2.5">
                            <p className="text-sm font-semibold text-ink">{lang === 'ar' ? g.name : g.nameEn || g.name}</p>
                            <p className="font-en text-[10px] text-ink-muted">{g.code}</p>
                          </td>
                          <td className="px-4 py-2.5">
                            <select
                              defaultValue={g.zoneId || ''}
                              onChange={(e) =>
                                setDirty((d) => ({ ...d, [id]: { ...d[id], zoneId: e.target.value } }))
                              }
                              className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs outline-none focus:border-rose"
                            >
                              <option value="">—</option>
                              {zoneOptions.map((z) => (
                                <option key={z.value} value={z.value}>
                                  {z.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              type="number"
                              min="0"
                              defaultValue={g.shippingCost ?? ''}
                              onChange={(e) =>
                                setDirty((d) => ({
                                  ...d,
                                  [id]: {
                                    ...d[id],
                                    shippingCost: e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0)
                                  }
                                }))
                              }
                              className="w-28 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-bold outline-none focus:border-rose"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={g.codEnabled !== false && g.codEnabled !== 0}
                              onChange={() => toggleGov.mutate({ id, field: 'codEnabled' })}
                              className="h-4 w-4 accent-rose cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button type="button" onClick={() => toggleGov.mutate({ id, field: 'isActive' })}>
                              <Badge variant={g.isActive ? 'success' : 'neutral'}>
                                {g.isActive ? t('common.active') : t('common.inactive')}
                              </Badge>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
            <h3 className="mb-4 text-sm font-bold text-ink">
              {t('common.add')} {selectedCountry === 'AE' ? 'إمارة جديدة' : 'محافظة جديدة'}
            </h3>
            <form
              onSubmit={govForm.handleSubmit((v) =>
                saveGov.mutate({
                  ...v,
                  countryCode: selectedCountry,
                  isActive: true,
                  codEnabled: v.codEnabled ?? true,
                  shippingCost: Number(v.shippingCost || 25)
                })
              )}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
            >
              <Input label={`${t('common.name')} (AR)`} required {...govForm.register('name', { required: true })} />
              <Input label={`${t('common.name')} (EN)`} dir="ltr" {...govForm.register('nameEn')} />
              <Input label="Code" dir="ltr" required {...govForm.register('code', { required: true })} />
              <Select
                label={t('gov.country')}
                value={selectedCountry}
                disabled
                options={[{ value: 'EG', label: 'مصر 🇪🇬' }, { value: 'AE', label: 'الإمارات 🇦🇪' }]}
              />
              <Input label={`سعر الشحن (${currencyLabel})`} type="number" {...govForm.register('shippingCost')} />
              <div className="flex items-end gap-3">
                <Checkbox label={t('checkout.cod')} {...govForm.register('codEnabled')} />
                <Button type="submit" loading={saveGov.isPending}>
                  {t('common.add')}
                </Button>
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
            <Button type="submit" loading={saveZone.isPending} className="flex-1">
              {t('common.save')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setZoneModal(null)}>
              {t('common.cancel')}
            </Button>
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
            <Input label={t('common.email')} type="email" dir="ltr" />
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
            <Button type="submit" loading={saveCompany.isPending} className="flex-1">
              {t('common.save')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setCompanyModal(null)}>
              {t('common.cancel')}
            </Button>
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