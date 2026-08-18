import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FiDroplet, FiEye, FiImage, FiLayers, FiLayout, FiList, FiLogIn, FiMenu, FiMonitor, FiRotateCcw,
  FiSave, FiSmartphone, FiTablet, FiType
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Button from '@/components/ui/Button';
import Input, { Checkbox, Select, Textarea } from '@/components/forms/Input';
import ColorField from '@/components/admin/ColorField';
import ImagePicker, { GalleryPicker } from '@/components/admin/ImagePicker';
import ThemePresets from '@/components/admin/ThemePresets';
import MenuBuilder from '@/components/admin/MenuBuilder';
import { ConfirmDialog } from '@/components/ui/Modal';
import { PageSpinner } from '@/components/ui/Spinner';
import client from '@/api/client';
import { adminService } from '@/services';
import { applyThemeVars, useConfig } from '@/config/ConfigProvider';
import { ARABIC_FONT_OPTIONS, ENGLISH_FONT_OPTIONS } from '@/config/fonts';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/helpers';

/**
 * استوديو تصميم المتجر.
 *
 * لماذا صفحة جديدة بدل تبويب آخر في الإعدادات؟
 * كانت إعدادات المظهر موزّعة على ثلاثة أماكن: الإعدادات ← المظهر
 * (الألوان والخطوط)، المنصّة ← العلامة البيضاء (الشعارات وعناوين
 * المتصفح)، والإعدادات ← عام (الشعار والأيقونة). صاحب المتجر الذي
 * يريد "تغيير شكل المتجر" كان عليه أن يعرف أي شاشة تحوي أي حقل.
 *
 * ⚠️ قرار معماري: هذه الصفحة **واجهة فقط**. لا تملك حالة خاصة ولا
 * نقاط نهاية جديدة — تقرأ وتكتب عبر نفس مسارات الإعدادات والعلامة
 * البيضاء القائمة. الشاشات القديمة تبقى تعمل كما هي بالضبط، فمن
 * اعتاد عليها لا يفقد شيئاً، ومن يريد مكاناً واحداً يجده هنا.
 */

const TABS = [
  { key: 'themes', icon: FiLayout, label: 'a6.ds.themes' },
  { key: 'colors', icon: FiDroplet, label: 'a6.ds.colors' },
  { key: 'typography', icon: FiType, label: 'a6.ds.typography' },
  { key: 'identity', icon: FiImage, label: 'a6.ds.identity' },
  { key: 'backgrounds', icon: FiLayers, label: 'a7.ds.backgrounds' },
  { key: 'header', icon: FiMenu, label: 'a9.ds.header' },
  { key: 'menu', icon: FiList, label: 'a9.ds.menu' },
  { key: 'login', icon: FiLogIn, label: 'a6.ds.login' },
];

/** مجموعات الألوان — مرتّبة حسب ما يراه الزائر لا حسب ترتيب الكود */
const COLOR_GROUPS = [
  { title: 'a6.ds.grpBrand', keys: ['primary', 'accent', 'secondary'] },
  { title: 'a6.ds.grpSurfaces', keys: ['bodyBg', 'sectionBg', 'surface', 'cardBg', 'cream', 'blush'] },
  { title: 'a6.ds.grpText', keys: ['text', 'textMuted', 'heading', 'link'] },
  { title: 'a6.ds.grpButtons', keys: ['buttonBg', 'buttonText', 'buttonHoverBg'] },
  { title: 'a6.ds.grpChrome', keys: ['headerBg', 'headerText', 'topBarBg', 'topBarText', 'footerBg', 'footerText'] },
  { title: 'a6.ds.grpBorders', keys: ['border', 'cardBorder'] },
  { title: 'a6.ds.grpCommerce', keys: ['priceColor', 'saleColor', 'badgeBg', 'badgeText', 'promoBg', 'promoText'] },
];

const DEVICES = [
  { key: 'desktop', icon: FiMonitor, w: '100%', label: 'a6.ds.desktop' },
  { key: 'tablet', icon: FiTablet, w: '768px', label: 'a6.ds.tablet' },
  { key: 'mobile', icon: FiSmartphone, w: '390px', label: 'a6.ds.mobile' },
];

export default function DesignStudio() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const { reload: reloadConfig } = useConfig();

  const [tab, setTab] = useState('themes');
  const [device, setDevice] = useState('desktop');
  const [showPreview, setShowPreview] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const [draft, setDraft] = useState(null);
  /* الصفحة المعروضة داخل إطار المعاينة */
  const [frameSrcKey, setFrameSrc] = useState('/');
  const frameRef = useRef(null);

  const { data, isLoading } = useQuery({ queryKey: ['admin', 'settings'], queryFn: adminService.settings.get });
  const saved = data?.data?.settings;

  // نبدأ من القيم المحفوظة، ثم يعمل المدير على نسخة مسوّدة
  useEffect(() => {
    if (!saved) return;
    setDraft({
      theme: { ...(saved.theme || {}) },
      loginPage: { ...(saved.loginPage || {}) },
      header: { ...(saved.header || {}) },
      navigation: { ...(saved.navigation || {}) },
      logo: saved.logo || '',
      logoLight: saved.logoLight || '',
      favicon: saved.favicon || '',
    });
  }, [saved]);

  /**
   * المعاينة الحية: نطبّق ألوان المسوّدة على اللوحة نفسها.
   * نستخدم نفس دالة applyThemeVars التي يستخدمها المتجر، فما يراه
   * المدير مطابق تماماً لما سيُحفظ — لا منطق معاينة منفصل يمكن أن ينحرف.
   */
  const themeSignature = JSON.stringify(draft?.theme || {});
  useEffect(() => {
    if (!showPreview || !draft?.theme) return;
    applyThemeVars(draft.theme);
  }, [themeSignature, showPreview, draft?.theme]);

  // إلغاء المعاينة يعيد الألوان المحفوظة فعلاً
  useEffect(() => {
    if (showPreview || !saved?.theme) return;
    applyThemeVars(saved.theme);
  }, [showPreview, saved?.theme]);

  const setTheme = useCallback((key, value) => {
    setDraft((d) => ({ ...d, theme: { ...d.theme, [key]: value } }));
  }, []);
  const setLogin = useCallback((key, value) => {
    setDraft((d) => ({ ...d, loginPage: { ...d.loginPage, [key]: value } }));
  }, []);
  const setHeader = useCallback((key, value) => {
    setDraft((d) => ({ ...d, header: { ...d.header, [key]: value } }));
  }, []);

  const save = useMutation({
    mutationFn: (payload) => adminService.settings.update(payload),
    onSuccess: async () => {
      toast.success(t('admin.saved'));
      await qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      await reloadConfig();
      // إعادة تحميل إطار المعاينة ليعكس ما حُفظ فعلاً
      if (frameRef.current) frameRef.current.src = frameRef.current.src;
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error')),
  });

  const resetTheme = useMutation({
    mutationFn: () => client.post('/admin/settings/reset-theme'),
    onSuccess: async () => {
      toast.success(t('admin.saved'));
      setConfirmReset(false);
      await qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      await reloadConfig();
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error')),
  });

  const previewWidth = useMemo(() => DEVICES.find((d) => d.key === device)?.w || '100%', [device]);

  if (isLoading || !draft) return <PageSpinner />;

  const th = draft.theme;
  const lp = draft.loginPage;

  return (
    <>
      <AdminPageHeader title={t('a6.ds.title')} subtitle={t('a6.ds.subtitle')}>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className={cn(
            'flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition',
            showPreview ? 'border-rose bg-blush text-rose' : 'border-black/10 text-ink hover:border-rose'
          )}
        >
          <FiEye size={14} />
          {t('admin.livePreview')}
        </button>
        <Button variant="outline" size="sm" icon={FiRotateCcw} onClick={() => setConfirmReset(true)}>
          {t('admin.restoreDefaultTheme')}
        </Button>
        <Button
          size="sm"
          icon={FiSave}
          loading={save.isPending}
          onClick={() => save.mutate({
            theme: th, loginPage: lp,
            header: draft.header, navigation: draft.navigation,
            logo: draft.logo, logoLight: draft.logoLight, favicon: draft.favicon,
          })}
        >
          {t('common.save')}
        </Button>
      </AdminPageHeader>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,420px)_1fr]">
        {/* ---------- لوحة التحكم ---------- */}
        <div className="min-w-0 rounded-2xl border border-black/5 bg-white shadow-soft">
          <div className="flex gap-1 overflow-x-auto border-b border-black/5 px-3 pt-3">
            {TABS.map((tb) => (
              <button
                key={tb.key}
                type="button"
                onClick={() => setTab(tb.key)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-t-lg px-3 py-2.5 text-xs font-semibold transition',
                  tab === tb.key
                    ? 'border-b-2 border-rose text-rose'
                    : 'border-b-2 border-transparent text-ink-muted hover:text-ink'
                )}
              >
                <tb.icon size={14} />
                {t(tb.label)}
              </button>
            ))}
          </div>

          <div className="max-h-[calc(100vh-260px)] space-y-5 overflow-y-auto p-5">
            {/* ---------- القوالب ---------- */}
            {tab === 'themes' ? (
              <ThemePresets onApplied={async () => {
                await qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
                await reloadConfig();
              }} />
            ) : null}

            {/* ---------- الألوان ---------- */}
            {tab === 'colors' ? (
              <>
                <Select
                  label={t('admin.themeMode')}
                  value={th.mode || 'light'}
                  onChange={(e) => setTheme('mode', e.target.value)}
                  options={[
                    { value: 'light', label: t('admin.lightMode') },
                    { value: 'dark', label: t('admin.darkMode') },
                  ]}
                />
                {COLOR_GROUPS.map((g) => (
                  <div key={g.title}>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted">{t(g.title)}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {g.keys.map((k) => (
                        <ColorField
                          key={k}
                          label={k}
                          value={th[k] || ''}
                          onChange={(v) => setTheme(k, v)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : null}

            {/* ---------- الخطوط والحواف ---------- */}
            {tab === 'typography' ? (
              <div className="grid gap-4">
                {/* نظام الخطوط: قوائم حقيقية من سجلّ الخطوط المعتمد بدل حقل نصي حر
                    كان يقبل أي اسم (وأي خطأ إملائي = رجوع صامت للخط الافتراضي) */}
                <Select label={t('admin.fontAr')} value={th.fontAr || ''} onChange={(e) => setTheme('fontAr', e.target.value)} options={ARABIC_FONT_OPTIONS} placeholder={t('common.select')} />
                <Select label={t('admin.fontEn')} dir="ltr" value={th.fontEn || ''} onChange={(e) => setTheme('fontEn', e.target.value)} options={ENGLISH_FONT_OPTIONS} placeholder={t('common.select')} />
                <Select label={`${t('admin.fontAr')} — Headings`} value={th.fontHeadingAr || ''} onChange={(e) => setTheme('fontHeadingAr', e.target.value)} options={ARABIC_FONT_OPTIONS} placeholder={t('common.select')} hint="خط عناوين مستقل (اختياري)" />
                <Select label={`${t('admin.fontEn')} — Headings`} dir="ltr" value={th.fontHeadingEn || ''} onChange={(e) => setTheme('fontHeadingEn', e.target.value)} options={ENGLISH_FONT_OPTIONS} placeholder={t('common.select')} hint="Optional separate heading font" />
                <Select
                  label={t('admin.radius')}
                  value={th.radius || 'rounded'}
                  onChange={(e) => setTheme('radius', e.target.value)}
                  options={[
                    { value: 'sharp', label: t('a6.ds.radiusSharp') },
                    { value: 'soft', label: t('a6.ds.radiusSoft') },
                    { value: 'rounded', label: t('a6.ds.radiusRounded') },
                    { value: 'pill', label: t('a6.ds.radiusPill') },
                  ]}
                />
                <Select
                  label={t('a9.cardStyle')}
                  hint={t('a9.cardStyleHint')}
                  value={th.cardStyle || 'classic'}
                  onChange={(e) => setTheme('cardStyle', e.target.value)}
                  options={[
                    { value: 'classic', label: t('a9.card.classic') },
                    { value: 'modern', label: t('a9.card.modern') },
                    { value: 'minimal', label: t('a9.card.minimal') },
                    { value: 'compact', label: t('a9.card.compact') },
                  ]}
                />
                <Checkbox
                  label={t('a6.ds.allowUserToggle')}
                  checked={th.allowUserToggle !== false}
                  onChange={(e) => setTheme('allowUserToggle', e.target.checked)}
                />
              </div>
            ) : null}

            {/* ---------- الهوية ---------- */}
            {tab === 'identity' ? (
              <div className="grid gap-4">
                <ImagePicker label={t('admin.siteLogo')} folder="branding" value={draft.logo} onChange={(v) => setDraft((d) => ({ ...d, logo: v }))} />
                <ImagePicker label={`${t('admin.siteLogo')} (${t('admin.darkMode')})`} folder="branding" value={draft.logoLight} onChange={(v) => setDraft((d) => ({ ...d, logoLight: v }))} />
                <ImagePicker label="Favicon" folder="branding" value={draft.favicon} onChange={(v) => setDraft((d) => ({ ...d, favicon: v }))} />
                <p className="rounded-xl bg-cream p-3 text-xs leading-relaxed text-ink-muted">
                  {t('a6.ds.brandingNote')}
                </p>
              </div>
            ) : null}

            {/* ---------- الخلفيات والعلامة المائية ---------- */}
            {tab === 'backgrounds' ? (
              <div className="grid gap-4">
                <ImagePicker label={t('a7.ds.bodyBg')} folder="backgrounds" value={th.bodyBgImage} onChange={(v) => setTheme('bodyBgImage', v)} />

                {/* ضبط الخلفية — يظهر فقط بعد رفع صورة */}
                {th.bodyBgImage ? (
                  <div className="grid gap-3 rounded-xl border border-black/10 p-3 sm:grid-cols-2">
                    <Select
                      label={t('a11.bgFit')} value={th.bodyBgFit || 'cover'}
                      onChange={(e) => setTheme('bodyBgFit', e.target.value)}
                      options={[
                        { value: 'cover', label: t('a11.fitCover') },
                        { value: 'contain', label: t('a11.fitContain') },
                        { value: 'auto', label: t('a11.fitAuto') },
                      ]}
                    />
                    <Input
                      type="number" min="0" max="90" label={t('a11.bgOverlayOpacity')}
                      hint={t('a11.bgOverlayHint')}
                      value={th.bodyBgOverlayOpacity ?? 0}
                      onChange={(e) => setTheme('bodyBgOverlayOpacity', Number(e.target.value))}
                    />
                    <ColorField label={t('a11.bgOverlayColor')} value={th.bodyBgOverlay || ''} onChange={(v) => setTheme('bodyBgOverlay', v)} />
                    <div className="flex flex-col justify-end gap-2 pb-1">
                      <Checkbox label={t('a11.bgRepeat')} checked={Boolean(th.bodyBgRepeat)} onChange={(e) => setTheme('bodyBgRepeat', e.target.checked)} />
                      <Checkbox label={t('a11.bgFixed')} checked={th.bodyBgFixed !== false} onChange={(e) => setTheme('bodyBgFixed', e.target.checked)} />
                    </div>
                  </div>
                ) : null}
                <ImagePicker label={t('a7.ds.sectionBg')} folder="backgrounds" value={th.sectionBgImage} onChange={(v) => setTheme('sectionBgImage', v)} />
                <ImagePicker label={t('a7.ds.heroBg')} folder="backgrounds" value={th.heroBgImage} onChange={(v) => setTheme('heroBgImage', v)} />
                <ImagePicker label={t('a7.ds.footerBg')} folder="backgrounds" value={th.footerBgImage} onChange={(v) => setTheme('footerBgImage', v)} />
                <ImagePicker label={t('a10.promoBg')} folder="backgrounds" value={th.promoBgImage} onChange={(v) => setTheme('promoBgImage', v)} />

                <div className="rounded-xl border border-black/10 p-4">
                  <p className="mb-3 text-sm font-bold text-ink">{t('a7.ds.watermark')}</p>
                  <ImagePicker label={t('a7.ds.watermarkImage')} folder="watermark" value={th.watermark} onChange={(v) => setTheme('watermark', v)} />
                  <p className="mt-2 text-[11px] text-ink-muted">{t('a7.ds.watermarkHint')}</p>

                  {th.watermark ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Input
                        type="number" min="1" max="100" label={t('a7.ds.watermarkOpacity')}
                        value={th.watermarkOpacity ?? 8}
                        onChange={(e) => setTheme('watermarkOpacity', Number(e.target.value))}
                      />
                      <Select
                        label={t('a11.wmScale')} value={th.watermarkScale || 'auto'}
                        hint={t('a11.wmScaleHint')}
                        onChange={(e) => setTheme('watermarkScale', e.target.value)}
                        options={[
                          { value: 'auto', label: t('a11.wmAuto') },
                          { value: 'fixed', label: t('a11.wmFixed') },
                        ]}
                      />
                      {th.watermarkScale === 'fixed' ? (
                        <Input
                          type="number" min="40" max="800" label={t('a7.ds.watermarkSize')}
                          value={th.watermarkSize ?? 200}
                          onChange={(e) => setTheme('watermarkSize', Number(e.target.value))}
                        />
                      ) : null}
                      <Select
                        label={t('a7.ds.watermarkPosition')}
                        value={th.watermarkPosition || 'center'}
                        onChange={(e) => setTheme('watermarkPosition', e.target.value)}
                        options={[
                          { value: 'center', label: t('a7.pos.center') },
                          { value: 'top left', label: t('a7.pos.topLeft') },
                          { value: 'top right', label: t('a7.pos.topRight') },
                          { value: 'bottom left', label: t('a7.pos.bottomLeft') },
                          { value: 'bottom right', label: t('a7.pos.bottomRight') },
                        ]}
                      />
                      <Checkbox
                        label={t('a7.ds.watermarkRepeat')}
                        checked={Boolean(th.watermarkRepeat)}
                        onChange={(e) => setTheme('watermarkRepeat', e.target.checked)}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* ---------- الترويسة ---------- */}
            {tab === 'header' ? (
              <div className="grid gap-4">
                <Select
                  label={t('a9.hdr.logoPosition')} value={draft.header.logoPosition || 'left'}
                  onChange={(e) => setHeader('logoPosition', e.target.value)}
                  options={[
                    { value: 'left', label: t('a9.hdr.posStart') },
                    { value: 'center', label: t('a9.hdr.posCenter') },
                  ]}
                />
                <Input
                  type="number" min="48" max="96" label={t('a9.hdr.height')}
                  hint={t('a9.hdr.heightHint')}
                  value={draft.header.navHeight ?? 64}
                  onChange={(e) => setHeader('navHeight', Number(e.target.value))}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <ColorField label={t('a9.hdr.bg')} value={draft.header.bgColor || ''} onChange={(v) => setHeader('bgColor', v)} />
                  <ColorField label={t('a9.hdr.text')} value={draft.header.textColor || ''} onChange={(v) => setHeader('textColor', v)} />
                </div>
                <div className="grid gap-2 rounded-xl bg-cream p-4 sm:grid-cols-2">
                  <Checkbox label={t('a9.hdr.sticky')} checked={draft.header.sticky !== false} onChange={(e) => setHeader('sticky', e.target.checked)} />
                  <Checkbox label={t('a9.hdr.topBar')} checked={draft.header.showTopBar !== false} onChange={(e) => setHeader('showTopBar', e.target.checked)} />
                  <Checkbox label={t('a9.hdr.search')} checked={draft.header.showSearch !== false} onChange={(e) => setHeader('showSearch', e.target.checked)} />
                  <Checkbox label={t('a9.hdr.wishlist')} checked={draft.header.showWishlist !== false} onChange={(e) => setHeader('showWishlist', e.target.checked)} />
                  <Checkbox label={t('a9.hdr.cart')} checked={draft.header.showCart !== false} onChange={(e) => setHeader('showCart', e.target.checked)} />
                  <Checkbox label={t('a9.hdr.lang')} checked={draft.header.showLanguageSwitch !== false} onChange={(e) => setHeader('showLanguageSwitch', e.target.checked)} />
                </div>
              </div>
            ) : null}

            {/* ---------- بانى القائمة ---------- */}
            {tab === 'menu' ? (
              <MenuBuilder
                value={draft.navigation?.items || []}
                onChange={(items) => setDraft((d) => ({ ...d, navigation: { ...d.navigation, items } }))}
              />
            ) : null}

            {/* ---------- صفحة الدخول ---------- */}
            {tab === 'login' ? (
              <div className="grid gap-4">
                {/*
                  الشعار والخلفية والعنوان والوصف انتقلت إلى:
                  الإعدادات ← صفحة الدخول (الأساسيات).
                  نفس مفاتيح settings.loginPage — لا بيانات مكرّرة،
                  وعنصر تحكّم واحد لكل إعداد. هنا نُبقي المتقدّم فقط.
                */}
                <p className="rounded-xl bg-cream p-3 text-xs leading-relaxed text-ink-muted">
                  {t('a10.basicsMoved')}
                </p>

                <ImagePicker label={t('a6.ds.loginBgMobile')} folder="branding" value={lp.backgroundMobile} onChange={(v) => setLogin('backgroundMobile', v)} />

                <GalleryPicker label={t('a6.ds.loginSlideshow')} folder="branding" value={lp.slideshow || []} onChange={(v) => setLogin('slideshow', v)} />
                <Input
                  type="number" min="2" label={t('a6.ds.slideSeconds')}
                  value={lp.slideshowSeconds ?? 6}
                  onChange={(e) => setLogin('slideshowSeconds', Number(e.target.value))}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label={`${t('a6.ds.footerText')} (AR)`} value={lp.footerText || ''} onChange={(e) => setLogin('footerText', e.target.value)} />
                  <Input label={`${t('a6.ds.footerText')} (EN)`} dir="ltr" value={lp.footerTextEn || ''} onChange={(e) => setLogin('footerTextEn', e.target.value)} />
                </div>

                {/*
                  🔴 هذه الحقول كانت تعمل في الخادم والمتجر بالكامل لكن
                  لم يكن لها أي عنصر تحكّم هنا — فيبدو للمالك أنها غير
                  قابلة للتعديل. أُضيفت جميعها الآن.
                */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label={`${t('a10.loginHeading')} (AR)`} value={lp.loginHeading || ''} onChange={(e) => setLogin('loginHeading', e.target.value)} />
                  <Input label={`${t('a10.loginHeading')} (EN)`} dir="ltr" value={lp.loginHeadingEn || ''} onChange={(e) => setLogin('loginHeadingEn', e.target.value)} />
                  <Input label={`${t('a10.registerHeading')} (AR)`} value={lp.registerHeading || ''} onChange={(e) => setLogin('registerHeading', e.target.value)} />
                  <Input label={`${t('a10.registerHeading')} (EN)`} dir="ltr" value={lp.registerHeadingEn || ''} onChange={(e) => setLogin('registerHeadingEn', e.target.value)} />
                  <Input label={`${t('a10.forgotHeading')} (AR)`} value={lp.forgotHeading || ''} onChange={(e) => setLogin('forgotHeading', e.target.value)} />
                  <Input label={`${t('a10.forgotHeading')} (EN)`} dir="ltr" value={lp.forgotHeadingEn || ''} onChange={(e) => setLogin('forgotHeadingEn', e.target.value)} />
                  <Textarea rows={2} label={`${t('a10.smallDesc')} (AR)`} value={lp.smallDescription || ''} onChange={(e) => setLogin('smallDescription', e.target.value)} />
                  <Textarea rows={2} label={`${t('a10.smallDesc')} (EN)`} dir="ltr" value={lp.smallDescriptionEn || ''} onChange={(e) => setLogin('smallDescriptionEn', e.target.value)} />
                  <Textarea rows={2} label={`${t('a10.termsText')} (AR)`} value={lp.termsText || ''} onChange={(e) => setLogin('termsText', e.target.value)} />
                  <Textarea rows={2} label={`${t('a10.termsText')} (EN)`} dir="ltr" value={lp.termsTextEn || ''} onChange={(e) => setLogin('termsTextEn', e.target.value)} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <ColorField label={t('a10.cardBg')} value={lp.cardBg || ''} onChange={(v) => setLogin('cardBg', v)} />
                  <ColorField label={t('a10.btnBg')} value={lp.buttonBg || ''} onChange={(v) => setLogin('buttonBg', v)} />
                  <ColorField label={t('a10.btnText')} value={lp.buttonText || ''} onChange={(v) => setLogin('buttonText', v)} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <ColorField label={t('a6.ds.overlayColor')} value={lp.overlayColor || ''} onChange={(v) => setLogin('overlayColor', v)} />
                  <Input
                    type="number" min="0" max="100" label={t('a6.ds.overlayOpacity')}
                    value={lp.overlayOpacity ?? 45}
                    onChange={(e) => setLogin('overlayOpacity', Number(e.target.value))}
                  />
                  <Select
                    label={t('a6.ds.cardRadius')} value={lp.cardRadius || 'rounded'}
                    onChange={(e) => setLogin('cardRadius', e.target.value)}
                    options={[
                      { value: 'sharp', label: t('a6.ds.radiusSharp') },
                      { value: 'soft', label: t('a6.ds.radiusSoft') },
                      { value: 'rounded', label: t('a6.ds.radiusRounded') },
                      { value: 'pill', label: t('a6.ds.radiusPill') },
                    ]}
                  />
                  <Select
                    label={t('a6.ds.cardShadow')} value={lp.cardShadow || 'lift'}
                    onChange={(e) => setLogin('cardShadow', e.target.value)}
                    options={[
                      { value: 'none', label: t('a6.ds.shadowNone') },
                      { value: 'soft', label: t('a6.ds.shadowSoft') },
                      { value: 'card', label: t('a6.ds.shadowCard') },
                      { value: 'lift', label: t('a6.ds.shadowLift') },
                    ]}
                  />
                </div>

                <div className="grid gap-2 rounded-xl bg-cream p-4 sm:grid-cols-2">
                  <Checkbox label={t('a6.ds.showLogo')} checked={lp.showLogo !== false} onChange={(e) => setLogin('showLogo', e.target.checked)} />
                  <Checkbox label={t('a6.ds.showWelcome')} checked={lp.showWelcome !== false} onChange={(e) => setLogin('showWelcome', e.target.checked)} />
                  <Checkbox label={t('a6.ds.showFooter')} checked={lp.showFooter !== false} onChange={(e) => setLogin('showFooter', e.target.checked)} />
                  <Checkbox label={t('a6.ds.glass')} checked={Boolean(lp.glassEffect)} onChange={(e) => setLogin('glassEffect', e.target.checked)} />
                  <Checkbox label={t('a6.ds.animations')} checked={lp.animations !== false} onChange={(e) => setLogin('animations', e.target.checked)} />
                  <Checkbox label={t('a10.darkVersion')} checked={Boolean(lp.darkVersion)} onChange={(e) => setLogin('darkVersion', e.target.checked)} />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* ---------- المعاينة ---------- */}
        <div className="min-w-0 rounded-2xl border border-black/5 bg-white p-4 shadow-soft">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 rounded-lg bg-cream p-1">
              {DEVICES.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setDevice(d.key)}
                  title={t(d.label)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-bold transition',
                    device === d.key ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
                  )}
                >
                  <d.icon size={13} />
                  <span className="hidden sm:inline">{t(d.label)}</span>
                </button>
              ))}
            </div>

            <Select
              className="h-9 w-auto"
              value={frameSrcKey}
              onChange={(e) => setFrameSrc(e.target.value)}
              options={[
                { value: '/', label: t('nav.home') },
                { value: '/shop', label: t('nav.shop') },
                { value: '/login', label: t('nav.login') },
              ]}
            />
          </div>

          <div className="flex justify-center overflow-auto rounded-xl bg-[#F6F7F9] p-3">
            <iframe
              ref={frameRef}
              title="store-preview"
              src={frameSrcKey}
              className="h-[calc(100vh-300px)] min-h-[420px] rounded-lg border border-black/10 bg-white transition-all"
              style={{ width: previewWidth, maxWidth: '100%' }}
            />
          </div>
          <p className="mt-2 text-center text-[11px] text-ink-muted">{t('a6.ds.previewNote')}</p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => resetTheme.mutate()}
        title={t('admin.restoreDefaultTheme')}
        message={t('admin.restoreThemeConfirm')}
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}
