import { lazy, Suspense, useCallback, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PageSpinner } from '@/components/ui/Spinner';
import {
  FiActivity,
  FiAlertTriangle,
  FiBarChart2,
  FiBell,
  FiCheckSquare,
  FiSliders,
  FiServer,
  FiToggleLeft,
  FiCreditCard,
  FiDroplet,
  FiExternalLink,
  FiFileText,
  FiHeadphones,
  FiLayout,
  FiRotateCcw,
  FiTruck,
  FiGrid,
  FiImage,
  FiLayers,
  FiLogOut,
  FiMail,
  FiMenu,
  FiPackage,
  FiSettings,
  FiShoppingCart,
  FiStar,
  FiTag,
  FiTrendingUp,
  FiUser,
  FiUsers,
  FiX,
  FiMessageSquare,
} from 'react-icons/fi';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-toastify';
import Avatar from '@/components/ui/Avatar';
import NotificationBell from '@/components/admin/NotificationBell';
/**
 * البحث الشامل كسول عن قصد.
 * AdminLayout يُستورد مباشرة (غير كسول) لأسباب معمارية سابقة، فلو
 * استوردنا البحث معه لدخل حزمة المتجر الرئيسية وحمّل كل زائر كوداً
 * إدارياً لا يستخدمه.
 */
const GlobalSearch = lazy(() => import('@/components/admin/GlobalSearch'));
import Logo from '@/components/ui/Logo';
import { useClickOutside, useLockBodyScroll, useMediaQuery } from '@/hooks';
import { useI18n } from '@/i18n';
import { registerExtraTranslations } from '@/i18n';
import { adminTranslations } from '@/i18n/adminTranslations';
import { pageBuilderTranslations } from '@/i18n/pageBuilderTranslations';
import { resetTranslations } from '@/i18n/resetTranslations';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/utils/helpers';

/**
 * ترجمات اللوحة تُسجَّل عند تحميل الوحدة (وقت دخول /admin فقط)،
 * قبل أول تصيير — فلا يحدث وميض مفاتيح غير مترجمة.
 */
registerExtraTranslations('admin', adminTranslations);
registerExtraTranslations('pageBuilder', pageBuilderTranslations);
registerExtraTranslations('reset', resetTranslations);

export default function AdminLayout() {
  const { t, lang, toggleLang, isRTL } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  useLockBodyScroll(sidebarOpen && !isDesktop);
  const menuRef = useClickOutside(useCallback(() => setUserMenu(false), []));

  /**
   * القائمة الجانبية مقسّمة إلى مجموعات بدل 26 رابطاً مسطّحاً.
   *
   * لماذا؟ القائمة المسطّحة كانت تتجاوز ارتفاع الشاشة وتُجبر المدير على
   * التمرير للوصول إلى "الإعدادات"، ولا تعطي أي إشارة عن علاقة العناصر
   * ببعضها (كان "الكوبونات" بين "العملاء" و"البانرات").
   * التجميع هنا يتبع نموذج Shopify: الكتالوج، المبيعات، العملاء،
   * المحتوى، التقارير، الإعدادات — وهو ترتيب يعرفه أي صاحب متجر.
   *
   * "لوحة التحكم" تبقى خارج المجموعات كعنصر أول مباشر لأنها الوجهة
   * الأكثر زيارة ولا يصح إخفاؤها داخل مجموعة قابلة للطي.
   */
  const navGroups = [
    {
      key: 'catalog',
      label: t('a5.navGroup.catalog'),
      items: [
        { to: '/admin/products', icon: FiPackage, label: t('admin.products') },
        { to: '/admin/categories', icon: FiLayers, label: t('admin.categories') },
        { to: '/admin/brands', icon: FiTag, label: t('admin.brands') },
        { to: '/admin/inventory', icon: FiTrendingUp, label: t('a3.inventory') },
      ],
    },
    {
      key: 'sales',
      label: t('a5.navGroup.sales'),
      items: [
        { to: '/admin/orders', icon: FiShoppingCart, label: t('admin.orders') },
        { to: '/admin/returns', icon: FiRotateCcw, label: t('admin.returns') },
        { to: '/admin/coupons', icon: FiTag, label: t('admin.coupons') },
        { to: '/admin/payments', icon: FiCreditCard, label: t('admin.payments') },
        {
          to: '/admin/payment-verification',
          icon: FiCheckSquare,
          label: t('admin.paymentVerification'),
        },
        { to: '/admin/shipping', icon: FiTruck, label: t('admin.shipping') },
      ],
    },
    {
      key: 'customers',
      label: t('a5.navGroup.customers'),
      items: [
        { to: '/admin/customers', icon: FiUsers, label: t('admin.customers') },
        { to: '/admin/reviews', icon: FiStar, label: t('admin.reviews') },
        { to: '/admin/support', icon: FiHeadphones, label: t('admin.support') },
        { to: '/admin/messages', icon: FiMail, label: t('admin.messages') },
      ],
    },
    {
      key: 'content',
      label: t('a5.navGroup.content'),
      items: [
        { to: '/admin/design', icon: FiDroplet, label: t('a6.ds.title') },
        { to: '/admin/page-builder', icon: FiSliders, label: t('a3.pageBuilder') },
        { to: '/admin/banners', icon: FiImage, label: t('admin.banners') },
        { to: '/admin/pages', icon: FiFileText, label: t('admin.pages') },
        { to: '/admin/content', icon: FiMessageSquare, label: t('c.center') },
        { to: '/admin/media', icon: FiImage, label: t('media.library') },
        { to: '/admin/templates', icon: FiLayout, label: t('admin.templates') },
      ],
    },
    {
      key: 'insights',
      label: t('a5.navGroup.insights'),
      items: [
        { to: '/admin/statistics', icon: FiBarChart2, label: t('admin.statistics') },
        { to: '/admin/activity', icon: FiActivity, label: t('a3.activityDashboard') },
        { to: '/admin/notifications', icon: FiBell, label: t('a3.notificationCenter') },
      ],
    },
    {
      key: 'config',
      label: t('a5.navGroup.config'),
      items: [
        { to: '/admin/staff', icon: FiUsers, label: t('a6.staff.title') },
        { to: '/admin/settings', icon: FiSettings, label: t('admin.settings') },
        { to: '/admin/platform', icon: FiToggleLeft, label: t('a4.featureFlags') },
        { to: '/admin/system', icon: FiServer, label: t('a4.system') },
        /* إعادة ضبط بيانات المتجر — تظهر للمدير الأعلى فقط */
        ...(user?.role === 'admin' && (user?.staffRole === 'super-admin' || String(user?.email || '').toLowerCase() === 'admin@alzeina.com')
          ? [{ to: '/admin/reset', icon: FiAlertTriangle, label: t('reset.title') }]
          : []),
      ],
    },
  ];

  const linkClass = ({ isActive }) =>
    cn(
      'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition',
      isActive ? 'bg-rose text-white shadow-card' : 'hover:bg-white/10 hover:text-white'
    );

  /**
   * اسم الصفحة الحالية للشريط العلوي.
   * نطابق أطول مسار أولاً حتى لا يلتقط "/admin" كل شيء.
   */
  const currentPageLabel =
    navGroups
      .flatMap((g) => g.items)
      .filter((i) => location.pathname.startsWith(i.to))
      .sort((a, b) => b.to.length - a.to.length)[0]?.label || t('admin.dashboard');

  const closeOnMobile = () => !isDesktop && setSidebarOpen(false);

  const sidebar = (
    <div className="flex h-full flex-col bg-ink text-white/70">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-5">
        <Logo variant="light" size="sm" />
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 lg:hidden"
          aria-label="close"
        >
          <FiX size={18} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <NavLink to="/admin" end onClick={closeOnMobile} className={linkClass}>
          <FiGrid size={17} className="shrink-0" />
          <span className="truncate">{t('admin.dashboard')}</span>
        </NavLink>

        {navGroups.map((group) => (
          <div key={group.key} className="mt-4">
            <p className="px-3.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/35">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} onClick={closeOnMobile} className={linkClass}>
                  <Icon size={17} className="shrink-0" />
                  <span className="truncate">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition hover:bg-white/10 hover:text-white"
        >
          <FiExternalLink size={17} />
          {t('admin.backToStore')}
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 z-40 hidden w-64 lg:block ltr:left-0 rtl:right-0">{sidebar}</aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && !isDesktop ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="absolute inset-0 bg-black/50"
            />
            <motion.aside
              initial={{ x: isRTL ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? '100%' : '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="absolute inset-y-0 w-64 ltr:left-0 rtl:right-0"
            >
              {sidebar}
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      {/* Content */}
      <div className="lg:ltr:pl-64 lg:rtl:pr-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-black/5 bg-white px-4 shadow-sm sm:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-xl text-ink transition hover:bg-blush lg:hidden"
            aria-label="menu"
          >
            <FiMenu size={20} />
          </button>

          {/*
            كان العنوان ثابتاً "لوحة الإدارة" في كل صفحة — معلومة بلا فائدة.
            الآن يعرض اسم الصفحة الحالية، فيعرف المدير مكانه فوراً حتى
            على الموبايل حيث القائمة الجانبية مخفيّة.
          */}
          <h1 className="truncate text-base font-bold text-ink">{currentPageLabel}</h1>

          <div className="ms-auto flex items-center gap-1">
            <Suspense fallback={<span className="h-10 w-10" />}>
              <GlobalSearch />
            </Suspense>

            <button
              type="button"
              onClick={toggleLang}
              className="rounded-lg border border-ink/10 px-2.5 py-1.5 text-xs font-bold text-ink transition hover:border-rose hover:text-rose"
            >
              {lang === 'ar' ? 'EN' : 'ع'}
            </button>

            <NotificationBell />

            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setUserMenu((v) => !v)}
                className="flex items-center gap-2 rounded-xl p-1.5 transition hover:bg-blush"
              >
                <Avatar src={user?.avatar} name={user?.name} size={32} />
                <span className="hidden text-sm font-semibold text-ink sm:block">{user?.name}</span>
              </button>

              <AnimatePresence>
                {userMenu ? (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute end-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-black/5 bg-white p-1.5 shadow-lift"
                  >
                    <Link
                      to="/profile"
                      onClick={() => setUserMenu(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink transition hover:bg-blush"
                    >
                      <FiUser size={15} /> {t('nav.profile')}
                    </Link>
                    <Link
                      to="/"
                      onClick={() => setUserMenu(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink transition hover:bg-blush"
                    >
                      <FiExternalLink size={15} /> {t('admin.backToStore')}
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        setUserMenu(false);
                        await logout();
                        toast.success(t('auth.logoutSuccess'));
                        navigate('/', { replace: true });
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"
                    >
                      <FiLogOut size={15} /> {t('nav.logout')}
                    </button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="p-4 sm:p-6">
          <Suspense fallback={<PageSpinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
