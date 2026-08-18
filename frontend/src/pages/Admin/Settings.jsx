import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FiActivity, FiBell, FiDroplet, FiFileText, FiGlobe, FiHeadphones,
  FiPhone, FiPlus, FiRotateCcw, FiSave, FiSearch, FiShare2, FiShield, FiToggleLeft, FiTrash2, FiType
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import ImagePicker from '@/components/admin/ImagePicker';
import StripItemsEditor from '@/components/admin/StripItemsEditor';
import ColorField from '@/components/admin/ColorField';
import Button from '@/components/ui/Button';
import Input, { Checkbox, Select, Textarea } from '@/components/forms/Input';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { adminService } from '@/services';
import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/helpers';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import client from '@/api/client';
import { applyThemeVars } from '@/config/ConfigProvider';
import { ConfirmDialog } from '@/components/ui/Modal';
import {
  FiChevronDown, FiChevronUp, FiDatabase, FiDownload, FiEye, FiLayout, FiLock, FiLogIn,
  FiRefreshCw, FiTool, FiUpload, FiZap,
} from 'react-icons/fi';
import ThemePresets from '@/components/admin/ThemePresets';
import { BackupPanel, PermissionsPanel, TextsPanel } from '@/components/admin/SettingsPanels';
import LocalizationPanel from '@/components/admin/LocalizationPanel';

const TABS = [
  { key: 'general', icon: FiGlobe, label: 'admin.siteSettings' },
  /* المرحلة 10: نُقلا من داخل تبويب «عام» ليصبح لكل منهما مكان واضح */
  { key: 'announcement', icon: FiZap, label: 'a10.announcementBar' },
  { key: 'strips', icon: FiLayout, label: 'a11.strips' },
  { key: 'loginPage', icon: FiLogIn, label: 'a10.loginPage' },
  { key: 'theme', icon: FiDroplet, label: 'admin.theme' },
  { key: 'contact', icon: FiPhone, label: 'admin.contactInfo' },
  { key: 'social', icon: FiShare2, label: 'admin.socialMedia' },
  { key: 'seo', icon: FiSearch, label: 'SEO' },
  { key: 'analytics', icon: FiActivity, label: 'admin.analytics' },
  { key: 'features', icon: FiToggleLeft, label: 'admin.features' },
  { key: 'notifications', icon: FiBell, label: 'admin.notifications' },
  { key: 'returns', icon: FiRotateCcw, label: 'admin.returns' },
  { key: 'invoice', icon: FiFileText, label: 'admin.invoiceSettings' },
  { key: 'support', icon: FiHeadphones, label: 'admin.support' },
  /* المرحلة 3 */
  { key: 'maintenance', icon: FiTool, label: 'a3.maintenance' },
  { key: 'texts', icon: FiType, label: 'c.texts' },
  { key: 'localization', icon: FiGlobe, label: 'a4.localization' },
  { key: 'permissions', icon: FiLock, label: 'a3.permissions' },
  { key: 'backup', icon: FiDatabase, label: 'a3.backupRestore' },
  { key: 'account', icon: FiShield, label: 'admin.accountSecurity' },
];

export default function AdminSettings() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState('general');
  const { reload: reloadConfig, settings: liveSettings } = useConfig();
  /** المعاينة الحية: تطبّق قيم النموذج على الصفحة فوراً قبل الحفظ */
  const [preview, setPreview] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmLoginReset, setConfirmLoginReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['admin', 'settings'], queryFn: adminService.settings.get });
  const settings = data?.data?.settings;

  const { register, handleSubmit, reset, control, watch } = useForm();

  useEffect(() => {
    if (!settings) return;
    reset({
      ...settings,
      notifications: {
        ...settings.notifications,
        adminEmails: Array.isArray(settings.notifications?.adminEmails)
          ? settings.notifications.adminEmails.join(', ')
          : settings.notifications?.adminEmails || ''
      },
      search: {
        ...settings.search,
        popularAr: Array.isArray(settings.search?.popularAr) ? settings.search.popularAr.join(', ') : settings.search?.popularAr || '',
        popularEn: Array.isArray(settings.search?.popularEn) ? settings.search.popularEn.join(', ') : settings.search?.popularEn || ''
      }
    });
  }, [settings, reset]);

  /**
   * معاينة حيّة بلا إعادة تحميل.
   * نراقب كائن theme في النموذج ونطبّقه على متغيّرات CSS مباشرة،
   * فيرى المدير النتيجة على اللوحة نفسها قبل الضغط على حفظ.
   * عند إيقاف المعاينة أو مغادرة الصفحة نعيد الإعدادات المحفوظة.
   */
  const watchedTheme = watch('theme');
  /**
   * ⚠️ react-hook-form يعيد نفس مرجع الكائن عند تغيّر حقل متداخل،
   * فلا يلاحظ useEffect أي فرق ولا تُطبَّق المعاينة. نقارن بالمحتوى
   * (سلسلة JSON) بدل المرجع لضمان تشغيل التأثير عند كل تعديل.
   */
  const themeSignature = JSON.stringify(watchedTheme || {});
  useEffect(() => {
    if (!preview || tab !== 'theme') return;
    try {
      const parsed = JSON.parse(themeSignature);
      if (parsed && Object.keys(parsed).length) applyThemeVars(parsed);
    } catch {
      /* تجاهل قيمة غير صالحة أثناء الكتابة */
    }
  }, [preview, tab, themeSignature]);

  // استعادة الثيم المحفوظ عند الخروج من التبويب أو إيقاف المعاينة
  useEffect(() => {
    if (tab !== 'theme' || !preview) {
      applyThemeVars(liveSettings?.theme || {});
    }
  }, [tab, preview, liveSettings]);

  /**
   * استعادة افتراضيات صفحة الدخول.
   *
   * تُفرغ الحقول الأساسية فقط (شعار/خلفية/عنوان/وصف) — والفراغ في هذا
   * المشروع يعني «استخدم التصميم الافتراضي». لا نلمس الخيارات المتقدّمة
   * (الألوان، الشرائح، الشروط) التي يضبطها الاستوديو، حتى لا يفقد
   * المالك عملاً لم يطلب استعادته.
   */
  const resetLoginPage = async () => {
    try {
      const cleared = { logo: '', background: '', welcomeTitle: '', welcomeTitleEn: '', welcomeSubtitle: '', welcomeSubtitleEn: '' };
      await adminService.settings.update({ loginPage: cleared });
      reset((prev) => ({ ...prev, loginPage: { ...(prev.loginPage || {}), ...cleared } }));
      toast.success(t('admin.saved'));
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      reloadConfig();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('common.error'));
    } finally {
      setConfirmLoginReset(false);
    }
  };

  const resetTheme = async () => {
    setResetting(true);
    try {
      const res = await client.post('/admin/settings/theme/reset');
      const fresh = res.data?.data?.theme;
      toast.success(res.data?.message || t('admin.saved'));
      if (fresh) {
        applyThemeVars(fresh);
        // نحدّث النموذج بالقيم الافتراضية الجديدة
        reset((prev) => ({ ...prev, theme: fresh }));
      }
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      reloadConfig();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('common.error'));
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  };

  const mutation = useMutation({
    mutationFn: (payload) => adminService.settings.update(payload),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      // إعادة تحميل إعدادات المتجر فوراً حتى تنعكس الألوان/الشعار بلا refresh
      reloadConfig();
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error')),
  });

  if (isLoading || !settings) {
    return (
      <>
        <AdminPageHeader title={t('admin.settings')} />
        <TableSkeleton rows={5} cols={2} />
      </>
    );
  }

  return (
    <>
      <AdminPageHeader title={t('admin.settings')} />

      <div className="grid gap-4 lg:grid-cols-4">
        {/* Tabs */}
        <nav className="space-y-1 lg:sticky lg:top-24 lg:self-start">
          {TABS.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition',
                tab === key ? 'bg-ink text-white shadow-soft' : 'bg-white text-ink-soft hover:bg-blush'
              )}
            >
              <Icon size={16} />
              {/*
                'SEO' يُكتب حرفياً وليس مفتاح ترجمة. أي تسمية تحتوي نقطة
                تُعامل كمفتاح — كان الشرط سابقاً على 'admin.' فقط فظهرت
                مفاتيح 'a3.' الجديدة خاماً في الواجهة.
              */}
              {label.includes('.') ? t(label) : label}
            </button>
          ))}
        </nav>

        <form
          onSubmit={handleSubmit((v) => {
            /* البحث الشائع: نص بفواصل في النموذج ← مصفوفة في الإعدادات */
            const splitList = (x) => String(x || '').split(/[,،]+/).map((s) => s.trim()).filter(Boolean);
            const payload = {
              ...v,
              search: { ...v.search, popularAr: splitList(v.search?.popularAr), popularEn: splitList(v.search?.popularEn) }
            };
            mutation.mutate(payload);
          })}
          className="lg:col-span-3"
        >
          <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
            {tab === 'general' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label={`${t('admin.siteName')} (EN)`} dir="ltr" {...register('siteName')} />
                <Input label={`${t('admin.siteName')} (AR)`} {...register('siteNameAr')} />
                <Input label="Tagline (AR)" {...register('tagline')} />
                <Input label="Tagline (EN)" dir="ltr" {...register('taglineEn')} />
                <Controller
                  name="logo"
                  control={control}
                  render={({ field }) => (
                    <ImagePicker
                      label={t('admin.siteLogo')}
                      folder="logo"
                      aspect="aspect-auto"
                      previewSize="h-16 w-28"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  name="logoLight"
                  control={control}
                  render={({ field }) => (
                    <ImagePicker
                      label={`${t('admin.siteLogo')} (${t('admin.darkMode')})`}
                      folder="logo"
                      aspect="aspect-auto"
                      previewSize="h-16 w-28"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  name="favicon"
                  control={control}
                  render={({ field }) => (
                    <ImagePicker
                      label="Favicon"
                      folder="favicon"
                      className="sm:col-span-2"
                      previewSize="h-12 w-12"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                {/* العملة والضريبة والمنطقة الزمنية واللغة */}
                <div className="sm:col-span-2 rounded-xl border border-black/5 bg-cream p-4">
                  <p className="mb-3 text-sm font-bold text-ink">
                    {t('a3.currency')} · {t('a3.taxSettings')} · {t('a3.timezone')}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label={t('a3.currency')} dir="ltr" hint="EGP" {...register('payment.currency')} />
                    <Input label={t('a3.currencySymbol')} {...register('payment.currencySymbol')} />
                    <Select
                      label={t('a3.timezone')}
                      options={[
                        { value: 'Africa/Cairo', label: 'Africa/Cairo' },
                        { value: 'Asia/Riyadh', label: 'Asia/Riyadh' },
                        { value: 'Asia/Dubai', label: 'Asia/Dubai' },
                        { value: 'UTC', label: 'UTC' },
                      ]}
                      {...register('locale.timezone')}
                    />
                    <Select
                      label={t('a3.language')}
                      options={[
                        { value: 'ar', label: 'العربية' },
                        { value: 'en', label: 'English' },
                      ]}
                      {...register('locale.defaultLanguage')}
                    />
                    <Checkbox
                      label={t('a3.taxEnabled')}
                      containerClassName="sm:col-span-2"
                      {...register('payment.taxEnabled')}
                    />
                    <Input label={`${t('a3.taxRate')} (%)`} type="number" step="0.01" {...register('payment.taxRate')} />
                    <Input label={t('a3.taxName')} {...register('payment.taxName')} />
                  </div>
                </div>

                <Textarea label={`${t('footer.about')} (AR)`} rows={3} containerClassName="sm:col-span-2" {...register('footer.about')} />
                <Textarea label={`${t('footer.about')} (EN)`} rows={2} containerClassName="sm:col-span-2" {...register('footer.aboutEn')} />

                <Input label={`${t('footer.rights')} (AR)`} {...register('footer.copyright')} />
                <Input label={`${t('footer.rights')} (EN)`} dir="ltr" {...register('footer.copyrightEn')} />

                {/* البحث: نص التلميح والبحث الشائع — يُدار من هنا بدل الكود */}
                <div className="sm:col-span-2 mt-2 rounded-xl border border-black/5 bg-cream p-4">
                  <p className="mb-3 text-sm font-bold text-ink">{t('c.search')}</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label={`${t('common.search')} (AR)`} {...register('search.placeholderAr')} />
                    <Input label={`${t('common.search')} (EN)`} dir="ltr" {...register('search.placeholderEn')} />
                    <Input label={`${t('c.popularSearches')} (AR)`} hint={t('c.commaSeparated')} {...register('search.popularAr')} />
                    <Input label={`${t('c.popularSearches')} (EN)`} dir="ltr" hint={t('c.commaSeparated')} {...register('search.popularEn')} />
                  </div>
                </div>
              </div>
            ) : null}

            {/*
              شريط الإعلانات — تبويب مستقل.
              نُقل من تبويب «عام» ولم يُنسخ: مصدر البيانات هو نفسه
              (settings.announcement) وعنصر التحكّم موجود هنا فقط.
            */}
            {tab === 'announcement' ? (
              <div className="grid gap-4">
                {/* شريط الإعلانات العلوي — يظهر أعلى كل صفحات المتجر */}
                <div className="sm:col-span-2 mt-2 rounded-xl border border-black/5 bg-cream p-4">
                  <p className="mb-3 text-sm font-bold text-ink">{t('admin.announcementBar')}</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Checkbox
                      label={t('admin.announcementEnabled')}
                      containerClassName="sm:col-span-2"
                      {...register('announcement.enabled')}
                    />
                    <Controller
                      name="announcement.bgColor"
                      control={control}
                      render={({ field }) => (
                        <ColorField
                          label={t('admin.announcementBg')}
                          fallback="#C89A8B"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      )}
                    />
                    <Controller
                      name="announcement.textColor"
                      control={control}
                      render={({ field }) => (
                        <ColorField
                          label={t('admin.announcementColor')}
                          fallback="#FFFFFF"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      )}
                    />
                    <Checkbox
                      label={t('admin.announcementDismissible')}
                      containerClassName="sm:col-span-2"
                      {...register('announcement.dismissible')}
                    />
                    <Input
                      type="number" min="0"
                      label={t('a6.ann.rotateSeconds')}
                      hint={t('a6.ann.rotateHint')}
                      {...register('announcement.rotateSeconds')}
                    />
                    <Input
                      type="number" min="10" max="24"
                      label={t('a6.ann.fontSize')}
                      {...register('announcement.fontSize')}
                    />
                  </div>

                  {/*
                    إعلانات متعدّدة تتناوب.
                    الحقول المفردة أعلاه تبقى للتوافق: تُستخدم فقط عندما
                    تكون هذه القائمة فارغة، فلا ينكسر أي متجر قائم.
                  */}
                  <Controller
                    name="announcement.items"
                    control={control}
                    render={({ field }) => {
                      const items = Array.isArray(field.value) ? field.value : [];
                      const patch = (i, key, val) =>
                        field.onChange(items.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));
                      return (
                        <div className="mt-4 border-t border-black/10 pt-4">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="text-sm font-bold text-ink">{t('a10.annItems')}</p>
                            <Button
                              type="button" size="sm" variant="outline" icon={FiPlus}
                              onClick={() => field.onChange([...items, { text: '', textEn: '', icon: '', link: '', linkLabel: '', enabled: true }])}
                            >
                              {t('common.add')}
                            </Button>
                          </div>
                          <p className="mb-3 text-xs text-ink-muted">{t('a6.ann.multiHint')}</p>

                          {/*
                            الحقول المفردة القديمة: تُستخدم فقط عندما تكون
                            القائمة فارغة. نضعها مطويّة كي لا تنافس القائمة
                            بصرياً، مع إبقائها متاحة للتوافق الخلفي.
                          */}
                          {!items.length ? (
                            <details className="mb-3 rounded-xl border border-dashed border-black/15 p-3">
                              <summary className="cursor-pointer text-xs font-semibold text-ink-muted">
                                {t('a10.legacySingle')}
                              </summary>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
    <Input label={`${t('admin.announcementText')} (AR)`} {...register('announcement.text')} />
    <Input label={`${t('admin.announcementText')} (EN)`} dir="ltr" {...register('announcement.textEn')} />
    <Input label={t('admin.announcementLink')} dir="ltr" hint="/shop" {...register('announcement.link')} />
    <Input label={t('admin.announcementLinkLabel')} {...register('announcement.linkLabel')} />
                              </div>
                            </details>
                          ) : null}

                          {items.length ? (
                            <div className="space-y-3">
                              {items.map((it, i) => (
                                <div key={i} className="rounded-xl border border-black/10 bg-white p-3">
                                  <div className="grid gap-3 sm:grid-cols-[70px_1fr_1fr_auto]">
                                    <Input
                                      label={t('a6.ann.icon')} placeholder="🚚"
                                      value={it.icon || ''} onChange={(e) => patch(i, 'icon', e.target.value)}
                                    />
                                    <Input
                                      label={`${t('admin.announcementText')} (AR)`}
                                      value={it.text || ''} onChange={(e) => patch(i, 'text', e.target.value)}
                                    />
                                    <Input
                                      label={`${t('admin.announcementText')} (EN)`} dir="ltr"
                                      value={it.textEn || ''} onChange={(e) => patch(i, 'textEn', e.target.value)}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => field.onChange(items.filter((_, idx) => idx !== i))}
                                      className="mt-6 h-10 w-10 shrink-0 rounded-lg text-red-600 transition hover:bg-red-50"
                                      title={t('common.delete')}
                                    >
                                      <FiTrash2 size={15} className="mx-auto" />
                                    </button>
                                  </div>
                                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                    <Input
                                      label={t('admin.announcementLink')} dir="ltr" hint="/shop"
                                      value={it.link || ''} onChange={(e) => patch(i, 'link', e.target.value)}
                                    />
                                    <Input
                                      label={t('admin.announcementLinkLabel')}
                                      value={it.linkLabel || ''} onChange={(e) => patch(i, 'linkLabel', e.target.value)}
                                    />
                                  </div>

                                  {/* تفعيل/إيقاف كل إعلان + إعادة ترتيبه */}
                                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-3">
                                    <div className="flex flex-wrap items-center gap-4">
                                      <Checkbox
                                        label={t('a10.itemEnabled')}
                                        checked={it.enabled !== false}
                                        onChange={(e) => patch(i, 'enabled', e.target.checked)}
                                      />
                                      <Checkbox
                                        label={t('a9.menu.newTab')}
                                        checked={Boolean(it.newTab)}
                                        onChange={(e) => patch(i, 'newTab', e.target.checked)}
                                      />
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button" disabled={i === 0} title={t('a9.menu.up')}
                                        onClick={() => { const n = items.slice(); [n[i - 1], n[i]] = [n[i], n[i - 1]]; field.onChange(n); }}
                                        className="rounded-lg p-2 text-ink-muted transition hover:bg-blush disabled:opacity-30"
                                      >
                                        <FiChevronUp size={14} />
                                      </button>
                                      <button
                                        type="button" disabled={i === items.length - 1} title={t('a9.menu.down')}
                                        onClick={() => { const n = items.slice(); [n[i + 1], n[i]] = [n[i], n[i + 1]]; field.onChange(n); }}
                                        className="rounded-lg p-2 text-ink-muted transition hover:bg-blush disabled:opacity-30"
                                      >
                                        <FiChevronDown size={14} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    }}
                  />
                </div>
              </div>
            ) : null}

            {/* الشريط العلوي وشريط المزايا — كانا مكتوبين في الكود */}
            {tab === 'strips' ? (
              <div className="grid gap-6">
                <div className="rounded-xl border border-black/5 bg-cream p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-bold text-ink">{t('a11.topBar')}</p>
                    <Checkbox label={t('a11.showStrip')} {...register('topBar.enabled')} />
                  </div>
                  <p className="mb-3 text-xs text-ink-muted">{t('a11.topBarHint')}</p>
                  <Controller
                    name="topBar.items"
                    control={control}
                    render={({ field }) => (
                      <StripItemsEditor value={field.value} onChange={field.onChange} withLink />
                    )}
                  />
                  <div className="mt-4 flex flex-wrap gap-5 border-t border-black/10 pt-3">
                    <Checkbox label={t('a11.showPhone')} {...register('topBar.showPhone')} />
                    <Checkbox label={t('a11.showTrack')} {...register('topBar.showTrackOrder')} />
                  </div>
                </div>

                <div className="rounded-xl border border-black/5 bg-cream p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-bold text-ink">{t('a11.featuresStrip')}</p>
                    <Checkbox label={t('a11.showStrip')} {...register('featuresStrip.enabled')} />
                  </div>
                  <p className="mb-3 text-xs text-ink-muted">{t('a11.featuresHint')}</p>
                  <Controller
                    name="featuresStrip.items"
                    control={control}
                    render={({ field }) => (
                      <StripItemsEditor value={field.value} onChange={field.onChange} withDesc />
                    )}
                  />
                </div>
              </div>
            ) : null}

            {/*
              صفحة الدخول — الأساسيات فقط.
              نفس مفاتيح settings.loginPage التي يستخدمها استوديو
              التصميم؛ لا بيانات مكرّرة ولا إعداد جديد. الاستوديو
              يعرض الخيارات المتقدّمة (العناوين، الشروط، الألوان،
              الشرائح) وهذه الصفحة تعرض ما يحتاجه صاحب المتجر فعلاً.
            */}
            {tab === 'loginPage' ? (
              <div className="grid gap-5">
                <p className="rounded-xl bg-cream p-3 text-xs leading-relaxed text-ink-muted">
                  {t('a10.loginPageHint')}
                </p>

                <Controller
                  name="loginPage.logo"
                  control={control}
                  render={({ field }) => (
                    <ImagePicker
                      label={t('a10.loginLogo')}
                      folder="branding"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  name="loginPage.background"
                  control={control}
                  render={({ field }) => (
                    <ImagePicker
                      label={t('a10.loginBg')}
                      folder="branding"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label={`${t('a10.loginTitle')} (AR)`} {...register('loginPage.welcomeTitle')} />
                  <Input label={`${t('a10.loginTitle')} (EN)`} dir="ltr" {...register('loginPage.welcomeTitleEn')} />
                  <Textarea rows={2} label={`${t('a10.loginDesc')} (AR)`} {...register('loginPage.welcomeSubtitle')} />
                  <Textarea rows={2} label={`${t('a10.loginDesc')} (EN)`} dir="ltr" {...register('loginPage.welcomeSubtitleEn')} />
                </div>

                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-black/5 bg-cream p-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={FiRefreshCw}
                    onClick={() => setConfirmLoginReset(true)}
                  >
                    {t('a10.restoreDefault')}
                  </Button>
                  <span className="text-[11px] text-ink-muted">{t('a10.restoreLoginHint')}</span>
                </div>
              </div>
            ) : null}

            {tab === 'theme' ? (
              <div className="space-y-7">
                {/* شريط أدوات الثيم: معاينة حيّة + استعادة الافتراضي */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/5 bg-cream p-4">
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-ink">
                    <input
                      type="checkbox"
                      checked={preview}
                      onChange={(e) => setPreview(e.target.checked)}
                      className="h-4 w-4 accent-current"
                    />
                    <FiEye size={15} className="text-rose" aria-hidden="true" />
                    {t('admin.livePreview')}
                    <span className="text-[11px] font-normal text-ink-muted">{t('admin.livePreviewHint')}</span>
                  </label>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={FiRefreshCw}
                    onClick={() => setConfirmReset(true)}
                  >
                    {t('admin.restoreDefaultTheme')}
                  </Button>
                </div>

                {/* قوالب المظهر: حفظ/تطبيق/نسخ/تصدير/استيراد */}
                <ThemePresets
                  onApplied={async () => {
                    // نعيد تحميل الإعدادات فيتحدّث النموذج والمتجر معاً
                    await qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
                    await reloadConfig();
                  }}
                />

                {/* وضع العرض */}
                <section>
                  <h3 className="mb-3 text-sm font-bold text-ink">{t('admin.themeMode')}</h3>
                  <Select
                    label={t('admin.themeMode')}
                    options={[
                      { value: 'light', label: t('admin.lightMode') },
                      { value: 'dark', label: t('admin.darkMode') },
                    ]}
                    {...register('theme.mode')}
                  />
                </section>

                {/* الألوان الأساسية */}
                <section>
                  <h3 className="mb-3 text-sm font-bold text-ink">{t('admin.themeColors')}</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      ['theme.primary', t('admin.colorPrimary'), '#111111'],
                      ['theme.accent', t('admin.colorAccent'), '#C89A8B'],
                      ['theme.secondary', t('admin.colorSecondary'), '#C89A8B'],
                      ['theme.cream', t('admin.colorBackground'), '#FFF8F5'],
                      ['theme.blush', t('admin.colorSoft'), '#F8E8EA'],
                      ['theme.surface', t('admin.colorSurface'), '#FFFFFF'],
                    ].map(([name, label, fb]) => (
                      <Controller
                        key={name}
                        name={name}
                        control={control}
                        render={({ field }) => (
                          <ColorField label={label} fallback={fb} value={field.value} onChange={field.onChange} />
                        )}
                      />
                    ))}
                  </div>
                </section>

                {/* النصوص */}
                <section>
                  <h3 className="mb-3 text-sm font-bold text-ink">{t('admin.themeText')}</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      ['theme.text', t('admin.colorText'), '#111111'],
                      ['theme.textMuted', t('admin.colorTextMuted'), '#6B6B6B'],
                      ['theme.heading', t('admin.colorHeading'), '#111111'],
                      ['theme.link', t('admin.colorLink'), '#C89A8B'],
                      ['theme.priceColor', t('admin.colorPrice'), '#C89A8B'],
                      ['theme.saleColor', t('admin.colorSale'), '#DC2626'],
                    ].map(([name, label, fb]) => (
                      <Controller
                        key={name}
                        name={name}
                        control={control}
                        render={({ field }) => (
                          <ColorField label={label} fallback={fb} value={field.value} onChange={field.onChange} />
                        )}
                      />
                    ))}
                  </div>
                </section>

                {/* الأزرار */}
                <section>
                  <h3 className="mb-3 text-sm font-bold text-ink">{t('admin.themeButtons')}</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      ['theme.buttonBg', t('admin.colorButtonBg'), '#111111'],
                      ['theme.buttonText', t('admin.colorButtonText'), '#FFFFFF'],
                      ['theme.buttonHoverBg', t('admin.colorButtonHover'), '#C89A8B'],
                      ['theme.badgeBg', t('admin.colorBadgeBg'), '#C89A8B'],
                      ['theme.badgeText', t('admin.colorBadgeText'), '#FFFFFF'],
                    ].map(([name, label, fb]) => (
                      <Controller
                        key={name}
                        name={name}
                        control={control}
                        render={({ field }) => (
                          <ColorField label={label} fallback={fb} value={field.value} onChange={field.onChange} />
                        )}
                      />
                    ))}
                  </div>
                </section>

                {/* الهيدر والفوتر */}
                <section>
                  <h3 className="mb-3 text-sm font-bold text-ink">{t('admin.themeHeaderFooter')}</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      ['theme.topBarBg', t('admin.colorTopBarBg'), '#111111'],
                      ['theme.topBarText', t('admin.colorTopBarText'), '#FFFFFF'],
                      ['theme.headerBg', t('admin.colorHeaderBg'), '#FFFFFF'],
                      ['theme.headerText', t('admin.colorHeaderText'), '#111111'],
                      ['theme.footerBg', t('admin.colorFooterBg'), '#111111'],
                      ['theme.footerText', t('admin.colorFooterText'), '#FFFFFF'],
                    ].map(([name, label, fb]) => (
                      <Controller
                        key={name}
                        name={name}
                        control={control}
                        render={({ field }) => (
                          <ColorField label={label} fallback={fb} value={field.value} onChange={field.onChange} />
                        )}
                      />
                    ))}
                  </div>
                </section>

                {/* البطاقات والحدود */}
                <section>
                  <h3 className="mb-3 text-sm font-bold text-ink">{t('admin.themeCards')}</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      ['theme.cardBg', t('admin.colorCardBg'), '#FFFFFF'],
                      ['theme.cardBorder', t('admin.colorCardBorder'), '#EEEEEE'],
                      ['theme.border', t('admin.colorBorder'), '#E5E5E5'],
                    ].map(([name, label, fb]) => (
                      <Controller
                        key={name}
                        name={name}
                        control={control}
                        render={({ field }) => (
                          <ColorField label={label} fallback={fb} value={field.value} onChange={field.onChange} />
                        )}
                      />
                    ))}
                  </div>
                </section>

                {/* الخلفيات وصورها */}
                <section>
                  <h3 className="mb-3 text-sm font-bold text-ink">{t('admin.themeBackgrounds')}</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      ['theme.bodyBg', t('admin.bgBody'), '#FFF8F5'],
                      ['theme.sectionBg', t('admin.bgSection'), '#FFFFFF'],
                      ['theme.heroBg', t('admin.bgHero'), '#F8E8EA'],
                      ['theme.promoBg', t('admin.bgPromo'), '#C89A8B'],
                      ['theme.promoText', t('admin.colorPromoText'), '#FFFFFF'],
                    ].map(([name, label, fb]) => (
                      <Controller
                        key={name}
                        name={name}
                        control={control}
                        render={({ field }) => (
                          <ColorField label={label} fallback={fb} value={field.value} onChange={field.onChange} />
                        )}
                      />
                    ))}
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {[
                      ['theme.bodyBgImage', t('admin.bgBodyImage'), 'backgrounds'],
                      ['theme.heroBgImage', t('admin.bgHeroImage'), 'backgrounds'],
                      ['theme.sectionBgImage', t('admin.bgSectionImage'), 'backgrounds'],
                      ['theme.promoBgImage', t('admin.bgPromoImage'), 'backgrounds'],
                      ['theme.footerBgImage', t('admin.bgFooterImage'), 'backgrounds'],
                      ['theme.watermark', t('admin.watermark'), 'watermark'],
                    ].map(([name, label, folder]) => (
                      <Controller
                        key={name}
                        name={name}
                        control={control}
                        render={({ field }) => (
                          <ImagePicker
                            label={label}
                            folder={folder}
                            aspect="aspect-video"
                            previewSize="h-16 w-24"
                            value={field.value}
                            onChange={field.onChange}
                          />
                        )}
                      />
                    ))}
                  </div>
                </section>

                {/* الخطوط واللغة */}
                <section>
                  <h3 className="mb-3 text-sm font-bold text-ink">{t('admin.fontAr')} / {t('admin.fontEn')}</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label={t('admin.fontAr')} {...register('theme.fontAr')} hint="Cairo, Tajawal, Almarai…" />
                    <Input label={t('admin.fontEn')} dir="ltr" {...register('theme.fontEn')} hint="Poppins, Inter, Roboto…" />
                    <Select
                      label={t('admin.defaultLang')}
                      options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]}
                      {...register('theme.defaultLang')}
                    />
                    <Select
                      label={t('admin.radius')}
                      options={[
                        { value: 'none', label: '0' },
                        { value: 'small', label: 'S' },
                        { value: 'rounded', label: 'M' },
                        { value: 'pill', label: 'XL' },
                      ]}
                      {...register('theme.radius')}
                    />
                  </div>
                </section>
              </div>
            ) : null}

            {tab === 'contact' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label={t('common.email')} type="email" dir="ltr" {...register('contact.email')} />
                <Input label={`${t('common.email')} (support)`} type="email" dir="ltr" {...register('contact.supportEmail')} />
                <Input label={t('common.phone')} dir="ltr" {...register('contact.phone')} />
                <Input label={`${t('common.phone')} 2`} dir="ltr" {...register('contact.phone2')} />
                <Input label="WhatsApp (افتراضي)" dir="ltr" {...register('contact.whatsapp')} />
                <Input label="WhatsApp مصر 🇪🇬" dir="ltr" hint="إن فُرغ يُستخدم الافتراضي" {...register('contact.whatsappEG')} />
                <Input label="WhatsApp الإمارات 🇦🇪" dir="ltr" hint="إن فُرغ يُستخدم الافتراضي" {...register('contact.whatsappAE')} />
                <Input label={t('admin.whatsappMessage')} {...register('contact.whatsappMessage')} />
                <Input label={`${t('checkout.city')} (AR)`} {...register('contact.address')} />
                <Input label={`${t('checkout.city')} (EN)`} dir="ltr" {...register('contact.addressEn')} />
                <Input label={`${t('contact.workingHours')} (AR)`} {...register('contact.businessHours')} />
                <Input label={`${t('contact.workingHours')} (EN)`} dir="ltr" {...register('contact.businessHoursEn')} />
                <Textarea
                  label={t('admin.mapEmbed')}
                  rows={2}
                  dir="ltr"
                  hint="Google Maps embed URL"
                  containerClassName="sm:col-span-2"
                  {...register('contact.mapEmbed')}
                />
                <Checkbox label={t('admin.whatsappButton')} {...register('contact.whatsappEnabled')} />
              </div>
            ) : null}

            {tab === 'social' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {['facebook', 'instagram', 'twitter', 'tiktok', 'youtube', 'linkedin', 'snapchat', 'telegram'].map((k) => (
                  <Input key={k} label={k[0].toUpperCase() + k.slice(1)} dir="ltr" {...register(`social.${k}`)} />
                ))}
              </div>
            ) : null}

            {tab === 'seo' ? (
              <div className="space-y-4">
                <Input label="Meta title" {...register('seo.metaTitle')} />
                <Textarea label="Meta description" rows={3} {...register('seo.metaDescription')} />
                <Input label="Keywords" {...register('seo.keywords')} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Controller
                    name="seo.ogImage"
                    control={control}
                    render={({ field }) => (
                      <ImagePicker
                        label="OG image"
                        folder="general"
                        aspect="aspect-video"
                        previewSize="h-16 w-28"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                  <Input label="Twitter handle" dir="ltr" {...register('seo.twitterHandle')} />
                  <Input label="robots" dir="ltr" {...register('seo.robots')} />
                  <Input label="Canonical base" dir="ltr" {...register('seo.canonicalBase')} />
                </div>
              </div>
            ) : null}

            {tab === 'analytics' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Google Analytics (G-…)" dir="ltr" {...register('analytics.googleAnalyticsId')} />
                <Input label="Google Tag Manager (GTM-…)" dir="ltr" {...register('analytics.googleTagManagerId')} />
                <Input label="Meta Pixel ID" dir="ltr" {...register('analytics.metaPixelId')} />
                <Input label="TikTok Pixel ID" dir="ltr" {...register('analytics.tiktokPixelId')} />
                <Input label="Snap Pixel ID" dir="ltr" {...register('analytics.snapPixelId')} />
                <Input label="Hotjar ID" dir="ltr" {...register('analytics.hotjarId')} />
                <Input
                  label="Google site verification"
                  dir="ltr"
                  containerClassName="sm:col-span-2"
                  {...register('analytics.googleSiteVerification')}
                />
              </div>
            ) : null}

            {tab === 'features' ? (
              <div className="space-y-3">
                {[
                  ['features.wishlist', t('nav.wishlist')],
                  ['features.reviews', t('admin.reviews')],
                  ['features.reviewsRequirePurchase', t('admin.reviewsRequirePurchase')],
                  ['features.guestCheckout', t('admin.guestCheckout')],
                  ['features.newsletter', t('home.newsletter.title')],
                  ['features.testimonials', t('home.testimonials.title')],
                  ['features.instagramFeed', t('home.instagram.title')],
                  ['features.popups', t('admin.popups')],
                ].map(([name, label]) => (
                  <Checkbox key={name} label={label} {...register(name)} />
                ))}
                <div className="grid gap-4 pt-3 sm:grid-cols-2">
                  <Input label={t('admin.lowStock')} type="number" {...register('features.lowStockThreshold')} />
                </div>
                {/*
                  🔴 أُزيل مربّع "وضع الصيانة" من هنا.
                  كان هناك مربّعان لنفس الميزة في تبويبين مختلفين
                  (هنا features.maintenanceMode، وفي تبويب الصيانة
                  maintenance.enabled)، والحارس يجمعهما بـ OR — فإطفاء
                  أحدهما لا يُطفئ الوضع، ويعود الموقع للصيانة وحده.
                  المكان الوحيد الآن: الإعدادات ← الصيانة، حيث توجد
                  بقية الخيارات (الرسالة، الشعار، العدّاد) مجتمعة.
                */}
                <button
                  type="button"
                  onClick={() => setTab('maintenance')}
                  className="mt-4 flex w-full items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-start transition hover:bg-amber-100"
                >
                  <span>
                    <span className="block text-sm font-bold text-ink">{t('admin.maintenanceMode')}</span>
                    <span className="mt-0.5 block text-[11px] text-amber-900">{t('a10.maintenanceMoved')}</span>
                  </span>
                  <FiTool size={16} className="shrink-0 text-amber-700" />
                </button>
              </div>
            ) : null}

            {tab === 'notifications' ? (
              <div className="space-y-3">
                <Checkbox label={t('admin.emailOnNewOrder')} {...register('notifications.emailOnNewOrder')} />
                <Checkbox label={t('admin.emailOnNewMessage')} {...register('notifications.emailOnNewMessage')} />
                <Checkbox label={t('admin.orderEmailToCustomer')} {...register('notifications.orderEmailToCustomer')} />
                <Input
                  label={t('admin.adminEmails')}
                  dir="ltr"
                  hint="a@x.com, b@y.com"
                  containerClassName="pt-3"
                  {...register('notifications.adminEmails')}
                />
              </div>
            ) : null}

            {tab === 'returns' ? (
              <div className="space-y-3">
                <Checkbox label={t('admin.returnsEnabled')} {...register('returns.enabled')} />
                <Checkbox label={t('admin.requireDelivered')} {...register('returns.requireDelivered')} />
                <Checkbox label={t('admin.autoApprove')} {...register('returns.autoApprove')} />
                <Checkbox label={t('admin.autoRestockHint')} {...register('returns.autoRestock')} />
                <Checkbox label={t('admin.refundShippingOpt')} {...register('returns.refundShipping')} />
                <Checkbox label={t('admin.excludeDiscounted')} {...register('returns.excludeDiscounted')} />
                <Checkbox label={t('admin.requireImages')} {...register('returns.requireImages')} />
                <div className="grid gap-4 pt-3 sm:grid-cols-2">
                  <Input label={t('admin.returnWindow')} type="number" {...register('returns.windowDays')} />
                  <Input label={t('admin.refundProcessing')} {...register('returns.refundProcessingDays')} />
                </div>
                <Textarea label={`${t('admin.returnPolicy')} (AR)`} rows={4} {...register('returns.policyText')} />
                <Textarea label={`${t('admin.returnPolicy')} (EN)`} rows={2} {...register('returns.policyTextEn')} />
                <Textarea label={`${t('admin.refundPolicy')} (AR)`} rows={4} {...register('returns.refundPolicyText')} />
                <Textarea label={`${t('admin.refundPolicy')} (EN)`} rows={2} {...register('returns.refundPolicyTextEn')} />
              </div>
            ) : null}

            {tab === 'invoice' ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label={`${t('admin.companyName')} (AR)`} {...register('invoice.companyName')} />
                  <Input label={`${t('admin.companyName')} (EN)`} dir="ltr" {...register('invoice.companyNameEn')} />
                  <Input label={t('admin.taxNumber')} dir="ltr" {...register('invoice.taxNumber')} />
                  <Input label={t('admin.commercialRegister')} dir="ltr" {...register('invoice.commercialRegister')} />
                  <Input label={t('common.email')} type="email" dir="ltr" {...register('invoice.companyEmail')} />
                  <Input label={t('common.phone')} dir="ltr" {...register('invoice.companyPhone')} />
                  <Input label={t('checkout.city')} containerClassName="sm:col-span-2" {...register('invoice.companyAddress')} />
                  <Input label={t('admin.invoicePrefix')} dir="ltr" {...register('invoice.prefix')} />
                  <div className="flex items-end gap-2">
                    <Input label={t('admin.colorAccent')} dir="ltr" containerClassName="flex-1" {...register('invoice.accentColor')} />
                    <input type="color" {...register('invoice.accentColor')} className="mb-0.5 h-11 w-12 cursor-pointer rounded-lg border border-black/10" />
                  </div>
                </div>
                <Input label={t('admin.headerText')} {...register('invoice.headerNote')} />
                <Input label={`${t('admin.footerText')} (AR)`} {...register('invoice.footerNote')} />
                <Input label={`${t('admin.footerText')} (EN)`} dir="ltr" {...register('invoice.footerNoteEn')} />
                <Textarea label={t('footer.terms')} rows={3} {...register('invoice.terms')} />
                <div className="grid gap-2 rounded-xl bg-cream p-4 sm:grid-cols-2">
                  <Checkbox label={t('admin.showQr')} {...register('invoice.showQrCode')} />
                  <Checkbox label={t('admin.showTax')} {...register('invoice.showTax')} />
                  <Checkbox label={t('admin.showPaymentInfo')} {...register('invoice.showPaymentInfo')} />
                  <Checkbox label={t('admin.showShippingInfo')} {...register('invoice.showShippingInfo')} />
                  <Checkbox label={t('admin.customerDownload')} {...register('invoice.customerDownload')} />
                </div>
                <Select
                  label={t('admin.qrContent')}
                  options={[
                    { value: 'order-url', label: t('admin.qrOrderUrl') },
                    { value: 'summary', label: t('admin.qrSummary') }
                  ]}
                  {...register('invoice.qrContent')}
                />
              </div>
            ) : null}

            {tab === 'support' ? (
              <div className="space-y-3">
                <Checkbox label={t('admin.supportEnabled')} {...register('support.enabled')} />
                <Checkbox label={t('admin.ticketsFromContact')} {...register('support.ticketsFromContact')} />
                <Checkbox label={t('admin.guestTickets')} {...register('support.guestTickets')} />
                <Checkbox label={t('admin.autoReply')} {...register('support.autoReply')} />
                <div className="grid gap-4 pt-3">
                  <Textarea label={t('admin.autoReplyMessage')} rows={2} {...register('support.autoReplyMessage')} />
                  <Input label={t('contact.workingHours')} {...register('support.workingHoursNote')} />
                  <Input label={t('admin.autoCloseDays')} type="number" {...register('support.autoCloseAfterDays')} />
                </div>
              </div>
            ) : null}

            {/* تبويب حساب المدير له نموذجه المستقل — لا يُحفظ مع الإعدادات */}
            {tab === 'maintenance' ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <Checkbox label={t('a3.maintenanceOn')} {...register('maintenance.enabled')} />
                  <p className="mt-2 text-[11px] leading-relaxed text-amber-900">{t('a3.maintenanceWarning')}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label={`${t('a3.maintenanceTitle')} (AR)`} {...register('maintenance.title')} />
                  <Input label={`${t('a3.maintenanceTitle')} (EN)`} dir="ltr" {...register('maintenance.titleEn')} />
                </div>
                <Textarea label={`${t('a3.maintenanceMessage')} (AR)`} rows={3} {...register('maintenance.message')} />
                <Textarea label={`${t('a3.maintenanceMessage')} (EN)`} rows={2} dir="ltr" {...register('maintenance.messageEn')} />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Controller
                    name="maintenance.logo"
                    control={control}
                    render={({ field }) => (
                      <ImagePicker label={t('a3.maintenanceLogo')} folder="logo" value={field.value} onChange={field.onChange} />
                    )}
                  />
                  <Controller
                    name="maintenance.backgroundImage"
                    control={control}
                    render={({ field }) => (
                      <ImagePicker label={t('a3.maintenanceBg')} folder="backgrounds" value={field.value} onChange={field.onChange} />
                    )}
                  />
                </div>

                <div className="grid gap-4 rounded-xl bg-cream p-4 sm:grid-cols-2">
                  <Checkbox label={t('a3.countdown')} {...register('maintenance.showCountdown')} />
                  <Input label={t('a3.countdownTo')} type="datetime-local" {...register('maintenance.countdownTo')} />
                </div>

                <div className="space-y-3">
                  <Checkbox label={t('a3.adminBypass')} {...register('maintenance.allowAdminBypass')} />
                  <Checkbox label={t('admin.socialMedia')} {...register('maintenance.showSocial')} />
                  <Input label={t('admin.contactInfo')} type="email" dir="ltr" {...register('maintenance.contactEmail')} />
                </div>
              </div>
            ) : null}

            {tab === 'localization' ? <LocalizationPanel /> : null}
            {tab === 'texts' ? (
              <TextsPanel
                overrides={settings?.translationOverrides || {}}
                onSaved={() => {
                  qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
                  reloadConfig();
                }}
              />
            ) : null}

            {tab === 'permissions' ? <PermissionsPanel /> : null}

            {tab === 'backup' ? (
              <BackupPanel
                onRestored={async () => {
                  await qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
                  await reloadConfig();
                }}
              />
            ) : null}

            {tab === 'account' ? <AdminAccountPanel /> : null}

            {tab !== 'account' ? (
              <Button type="submit" loading={mutation.isPending} icon={FiSave} className="mt-6">
                {t('common.save')}
              </Button>
            ) : null}
          </div>
        </form>
      </div>

      {/* تأكيد قبل استعادة الثيم — عملية لا رجعة فيها */}
      <ConfirmDialog
        open={confirmLoginReset}
        onClose={() => setConfirmLoginReset(false)}
        onConfirm={resetLoginPage}
        title={t('a10.restoreDefault')}
        message={t('a10.restoreLoginConfirm')}
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        danger
      />

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={resetTheme}
        title={t('admin.restoreDefaultTheme')}
        message={t('admin.restoreThemeConfirm')}
        confirmText={resetting ? t('common.loading') : t('admin.restoreConfirmBtn')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}

/**
 * تغيير بريد/كلمة مرور المدير الأعلى.
 *
 * يتطلب كلمة المرور الحالية، ويُبطل كل الجلسات فور النجاح،
 * فتتوقف البيانات القديمة عن العمل مباشرة ويُعاد توجيه المدير للدخول.
 */
function AdminAccountPanel() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const currentUser = useAuthStore((s) => s.user);
  const [saving, setSaving] = useState(false);

  const {
    register: reg,
    handleSubmit: submit,
    watch: w,
    reset: resetForm,
    formState: { errors: errs }
  } = useForm({
    defaultValues: { currentPassword: '', newEmail: currentUser?.email || '', newPassword: '', confirmPassword: '' }
  });

  const newPassword = w('newPassword');

  const onSave = async (v) => {
    setSaving(true);
    try {
      const payload = { currentPassword: v.currentPassword };
      if (v.newEmail && v.newEmail !== currentUser?.email) payload.newEmail = v.newEmail;
      if (v.newPassword) {
        payload.newPassword = v.newPassword;
        payload.confirmPassword = v.confirmPassword;
      }
      if (!payload.newEmail && !payload.newPassword) {
        toast.info(t('admin.noChanges'));
        return;
      }

      const res = await client.put('/admin/account/credentials', payload);
      toast.success(res.data?.message || t('admin.saved'));
      resetForm({ currentPassword: '', newEmail: '', newPassword: '', confirmPassword: '' });

      // الجلسات أُبطلت على الخادم → نخرج ونعيد التوجيه لدخول الإدارة
      await logout();
      navigate('/admin/login', { replace: true });
    } catch (e) {
      toast.error(e?.response?.data?.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        {t('admin.accountSecurityHint')}
      </div>

      <Input
        label={t('admin.currentPassword')}
        type="password"
        dir="ltr"
        required
        autoComplete="current-password"
        error={errs.currentPassword?.message}
        {...reg('currentPassword', { required: t('valid.required') })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t('admin.newAdminEmail')}
          type="email"
          dir="ltr"
          autoComplete="username"
          error={errs.newEmail?.message}
          {...reg('newEmail', {
            pattern: { value: /^\S+@\S+\.\S+$/, message: t('valid.email') }
          })}
        />
        <Input
          label={t('admin.newAdminPassword')}
          type="password"
          dir="ltr"
          autoComplete="new-password"
          hint={t('admin.adminPasswordPolicy')}
          error={errs.newPassword?.message}
          {...reg('newPassword', {
            validate: (v) =>
              !v || (v.length >= 10 && /[A-Za-z]/.test(v) && /\d/.test(v)) || t('admin.adminPasswordPolicy')
          })}
        />
        <Input
          label={t('auth.confirmPassword')}
          type="password"
          dir="ltr"
          autoComplete="new-password"
          error={errs.confirmPassword?.message}
          {...reg('confirmPassword', {
            validate: (v) => !newPassword || v === newPassword || t('auth.passwordMismatch')
          })}
        />
      </div>

      <Button type="button" onClick={submit(onSave)} loading={saving} icon={FiSave}>
        {t('common.save')}
      </Button>
    </div>
  );
}
