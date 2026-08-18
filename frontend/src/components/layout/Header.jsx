import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiHeart, FiLogOut, FiMenu, FiPackage, FiSearch, FiShoppingBag, FiUser, FiGrid } from 'react-icons/fi';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-toastify';
import Avatar from '@/components/ui/Avatar';
import Logo from '@/components/ui/Logo';
import SearchBar from './SearchBar';
import { useConfig, useFeature } from '@/config/ConfigProvider';
import { useClickOutside, useScrolled } from '@/hooks';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { useUIStore } from '@/store/uiStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { cn } from '@/utils/helpers';

function IconButton({ icon: Icon, badge, label, onClick, to }) {
  const cls =
    'relative grid h-11 w-11 place-items-center rounded-full text-ink transition hover:bg-blush hover:text-rose';
  const content = (
    <>
      <Icon size={19} />
      {badge > 0 ? (
        <motion.span
          key={badge}
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          className="absolute -end-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose px-1 text-[10px] font-bold text-white shadow-soft"
        >
          {badge > 99 ? '99+' : badge}
        </motion.span>
      ) : null}
    </>
  );
  if (to)
    return (
      <Link to={to} className={cls} aria-label={label}>
        {content}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={cls} aria-label={label}>
      {content}
    </button>
  );
}

export default function Header() {
  const { t } = useI18n();
  /* المفضلة ميزة قابلة للإطفاء من: المنصّة ← مفاتيح الميزات */
  const wishlistOn = useFeature('wishlist');
  /* إعدادات الترويسة القابلة للتعديل — استوديو التصميم ← الترويسة */
  const hdr = useConfig().settings.header || {};
  const navigate = useNavigate();
  const scrolled = useScrolled(60);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  const cartCount = useCartStore((s) => s.items.reduce((a, i) => a + i.quantity, 0));
  const wishCount = useWishlistStore((s) => s.items.length);
  const openCart = useUIStore((s) => s.openCartDrawer);
  const toggleMobileMenu = useUIStore((s) => s.toggleMobileMenu);
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore((s) => ['admin', 'moderator'].includes(s.user?.role));
  const logout = useAuthStore((s) => s.logout);

  const userMenuRef = useClickOutside(useCallback(() => setUserMenu(false), []));

  const handleLogout = async () => {
    setUserMenu(false);
    await logout();
    toast.success(t('auth.logoutSuccess'));
    navigate('/', { replace: true });
  };

  return (
    <header
      className={cn(
        'z-40 transition-shadow duration-300',
        /* التثبيت أصبح اختيارياً — كان دائماً sticky بلا تحكّم */
        hdr.sticky === false ? 'relative' : 'sticky top-0',
        scrolled ? 'shadow-soft' : ''
      )}
      style={hdr.bgColor ? { backgroundColor: hdr.bgColor, color: hdr.textColor || undefined } : undefined}
    >
      <div
        className={cn('border-b border-black/5 transition-colors duration-300', scrolled ? 'glass' : 'bg-white')}
        style={hdr.bgColor ? { backgroundColor: hdr.bgColor } : undefined}
      >
        <div
          className="container-x flex items-center gap-3 md:gap-6"
          /* الارتفاع قابل للضبط (48–96) مع الإبقاء على الافتراضي السابق */
          style={{ minHeight: `${Math.min(96, Math.max(48, Number(hdr.navHeight) || 64))}px` }}
        >
          {/* Mobile menu */}
          <button
            type="button"
            onClick={toggleMobileMenu}
            className="grid h-11 w-11 place-items-center rounded-full text-ink transition hover:bg-blush lg:hidden"
            aria-label={t('nav.menu')}
          >
            <FiMenu size={21} />
          </button>

          <Logo className="shrink-0" size="md" />

          {/* Desktop search — يمكن إخفاؤه من الإعدادات */}
          {hdr.showSearch === false ? (
            <div className="mx-auto" />
          ) : (
            <div className="mx-auto hidden w-full max-w-xl lg:block">
              <SearchBar />
            </div>
          )}

          {/* Actions */}
          <div className="ms-auto flex items-center gap-0.5 lg:ms-0">
            <button
              type="button"
              onClick={() => setMobileSearch((v) => !v)}
              className="grid h-11 w-11 place-items-center rounded-full text-ink transition hover:bg-blush hover:text-rose lg:hidden"
              aria-label={t('common.searchShort')}
            >
              <FiSearch size={19} />
            </button>

            {/* أيقونة المفضلة تحترم مفتاح الميزة — كانت تظهر دائماً */}
            {wishlistOn && hdr.showWishlist !== false ? (
              <IconButton icon={FiHeart} badge={wishCount} label={t('nav.wishlist')} to="/wishlist" />
            ) : null}

            {/* User */}
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => (user ? setUserMenu((v) => !v) : navigate('/login'))}
                className="grid h-11 w-11 place-items-center rounded-full text-ink transition hover:bg-blush hover:text-rose"
                aria-label={t('nav.account')}
              >
                {user ? <Avatar src={user.avatar} name={user.name} size={32} /> : <FiUser size={19} />}
              </button>

              <AnimatePresence>
                {userMenu && user ? (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute end-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-lift"
                  >
                    <div className="border-b border-black/5 bg-cream px-4 py-3">
                      <p className="clamp-1 text-sm font-bold text-ink">{user.name}</p>
                      <p className="clamp-1 text-xs text-ink-muted">{user.email}</p>
                    </div>
                    <div className="p-1.5">
                      {[
                        { to: '/profile', icon: FiUser, label: t('nav.profile') },
                        { to: '/orders', icon: FiPackage, label: t('nav.orders') },
                        ...(wishlistOn ? [{ to: '/wishlist', icon: FiHeart, label: t('nav.wishlist') }] : []),
                        ...(isAdmin ? [{ to: '/admin', icon: FiGrid, label: t('nav.admin') }] : []),
                      ].map(({ to, icon: Icon, label }) => (
                        <Link
                          key={to}
                          to={to}
                          onClick={() => setUserMenu(false)}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-blush"
                        >
                          <Icon size={16} className="text-rose" />
                          {label}
                        </Link>
                      ))}
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        <FiLogOut size={16} />
                        {t('nav.logout')}
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {hdr.showCart === false ? null : (
              <IconButton icon={FiShoppingBag} badge={cartCount} label={t('nav.cart')} onClick={openCart} />
            )}
          </div>
        </div>

        {/* Mobile search bar */}
        <AnimatePresence>
          {mobileSearch ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-visible lg:hidden"
            >
              <div className="container-x pb-3">
                <SearchBar autoFocus onNavigate={() => setMobileSearch(false)} />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  );
}
