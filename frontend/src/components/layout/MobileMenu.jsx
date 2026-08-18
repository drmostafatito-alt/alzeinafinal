import { Link, useNavigate } from 'react-router-dom';
import {
  FiChevronLeft,
  FiGrid,
  FiHeart,
  FiHome,
  FiInfo,
  FiLogIn,
  FiLogOut,
  FiMail,
  FiPackage,
  FiShoppingBag,
  FiTag,
  FiUser,
  FiZap,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import Avatar from '@/components/ui/Avatar';
import Drawer from '@/components/ui/Drawer';
import Logo from '@/components/ui/Logo';
import { useCategories } from '@/hooks';
import { useI18n } from '@/i18n';
import { useNavigation } from '@/hooks/useNavigation';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { localized } from '@/utils/helpers';

export default function MobileMenu() {
  const { t, lang, toggleLang } = useI18n();
  const navigate = useNavigate();
  const open = useUIStore((s) => s.mobileMenuOpen);
  const close = useUIStore((s) => s.closeMobileMenu);
  const { categories } = useCategories();
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore((s) => ['admin', 'moderator'].includes(s.user?.role));
  const logout = useAuthStore((s) => s.logout);

  const nav = (to) => {
    close();
    navigate(to);
  };

  /*
    نفس مصدر قائمة سطح المكتب — كانت القائمتان مكتوبتين بشكل منفصل
    فيضيف المالك رابطاً في مكان ولا يظهر في الآخر.
    نُبقي أيقونة افتراضية لكل رابط معروف حتى لا تفقد القائمة شكلها.
  */
  const navItems = useNavigation('mobile');
  const ICONS = {
    '/': FiHome,
    '/shop': FiShoppingBag,
    '/categories': FiGrid,
    '/about': FiInfo,
    '/contact': FiMail,
  };
  const withIcon = (l) => ({ ...l, icon: ICONS[l.to] || (l.highlight ? FiZap : FiTag) });

  /* أول 5 روابط رئيسية والباقي ثانوي — يحافظ على التقسيم البصري */
  const mainLinks = navItems.slice(0, 5).map(withIcon);
  const secondaryLinks = navItems.slice(5).map(withIcon);

  return (
    <Drawer open={open} onClose={close} title={<Logo size="sm" asLink={false} />} side="start" width="max-w-[320px]">
      <div className="flex h-full flex-col">
        {/* User block */}
        <div className="border-b border-black/5 bg-cream p-4">
          {user ? (
            <div className="flex items-center gap-3">
              <Avatar src={user.avatar} name={user.name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="clamp-1 text-sm font-bold text-ink">{user.name}</p>
                <p className="clamp-1 text-xs text-ink-muted">{user.email}</p>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => nav('/login')}
                className="btn btn-sm flex-1 bg-ink text-white hover:bg-rose"
              >
                <FiLogIn size={14} /> {t('nav.login')}
              </button>
              <button
                type="button"
                onClick={() => nav('/register')}
                className="btn btn-sm flex-1 border border-ink/15 bg-white text-ink hover:border-rose hover:text-rose"
              >
                {t('nav.register')}
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-0.5">
            {mainLinks.map(({ to, icon: Icon, label, accent }) => (
              <li key={to + label}>
                <button
                  type="button"
                  onClick={() => nav(to)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-ink transition hover:bg-blush"
                >
                  <Icon size={17} className={accent ? 'text-rose' : 'text-ink-muted'} />
                  <span className={accent ? 'text-rose' : ''}>{label}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="my-3 h-px bg-black/5" />

          <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
            {t('nav.categories')}
          </p>
          <ul className="space-y-0.5">
            {categories.map((c) => (
              <li key={c._id}>
                <button
                  type="button"
                  onClick={() => nav(`/shop?category=${c.slug}`)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm text-ink transition hover:bg-blush"
                >
                  <span className="clamp-1">{localized(c, lang)}</span>
                  <span className="flex items-center gap-1 text-[11px] text-ink-muted">
                    {c.productCount || 0}
                    <FiChevronLeft className="rtl:rotate-0 ltr:rotate-180" size={13} />
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="my-3 h-px bg-black/5" />

          <ul className="space-y-0.5">
            {user
              ? [
                  { to: '/profile', icon: FiUser, label: t('nav.profile') },
                  { to: '/orders', icon: FiPackage, label: t('nav.orders') },
                  { to: '/wishlist', icon: FiHeart, label: t('nav.wishlist') },
                  ...(isAdmin ? [{ to: '/admin', icon: FiGrid, label: t('nav.admin') }] : []),
                ].map(({ to, icon: Icon, label }) => (
                  <li key={to}>
                    <button
                      type="button"
                      onClick={() => nav(to)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink transition hover:bg-blush"
                    >
                      <Icon size={16} className="text-ink-muted" />
                      {label}
                    </button>
                  </li>
                ))
              : null}
            {secondaryLinks.map(({ to, icon: Icon, label }) => (
              <li key={to}>
                <button
                  type="button"
                  onClick={() => nav(to)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink transition hover:bg-blush"
                >
                  <Icon size={16} className="text-ink-muted" />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-black/5 p-3">
          <button
            type="button"
            onClick={toggleLang}
            className="mb-2 w-full rounded-xl border border-ink/10 py-2.5 text-sm font-bold text-ink transition hover:border-rose hover:text-rose"
          >
            {lang === 'ar' ? 'English' : 'العربية'}
          </button>
          {user ? (
            <button
              type="button"
              onClick={async () => {
                close();
                await logout();
                toast.success(t('auth.logoutSuccess'));
                navigate('/', { replace: true });
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              <FiLogOut size={16} /> {t('nav.logout')}
            </button>
          ) : null}
        </div>
      </div>
    </Drawer>
  );
}
