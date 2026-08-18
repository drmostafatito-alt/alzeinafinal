import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FiHeadphones, FiHeart, FiLock, FiLogOut, FiMapPin, FiPackage, FiRotateCcw, FiUser } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Avatar from '@/components/ui/Avatar';
import PageHeader from '@/components/common/PageHeader';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/utils/format';
import { cn } from '@/utils/helpers';

export default function Profile() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const tabs = [
    { to: '/profile', end: true, icon: FiUser, label: t('profile.info') },
    { to: '/profile/addresses', icon: FiMapPin, label: t('profile.addresses') },
    { to: '/orders', icon: FiPackage, label: t('profile.orders') },
    { to: '/returns', icon: FiRotateCcw, label: t('returns.myReturns') },
    { to: '/support', icon: FiHeadphones, label: t('support.title') },
    { to: '/wishlist', icon: FiHeart, label: t('profile.wishlist') },
    { to: '/profile/security', icon: FiLock, label: t('profile.security') },
  ];

  return (
    <>
      <PageHeader title={t('profile.title')} breadcrumbs={[{ label: t('profile.title') }]} />

      <div className="container-x py-8">
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
              <div className="flex items-center gap-3 border-b border-black/5 pb-4">
                <Avatar src={user?.avatar} name={user?.name} size={56} />
                <div className="min-w-0">
                  <p className="clamp-1 text-sm font-bold text-ink">{user?.name}</p>
                  <p className="clamp-1 text-xs text-ink-muted">{user?.email}</p>
                  {user?.createdAt ? (
                    <p className="mt-0.5 text-[10px] text-ink-muted">
                      {t('profile.memberSince')} {formatDate(user.createdAt, lang)}
                    </p>
                  ) : null}
                </div>
              </div>

              <nav className="mt-3 space-y-0.5">
                {tabs.map(({ to, end, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                        isActive ? 'bg-ink text-white' : 'text-ink-soft hover:bg-blush'
                      )
                    }
                  >
                    <Icon size={16} />
                    {label}
                  </NavLink>
                ))}
                <button
                  type="button"
                  onClick={() => setConfirmLogout(true)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  <FiLogOut size={16} />
                  {t('nav.logout')}
                </button>
              </nav>
            </div>
          </aside>

          <div className="lg:col-span-3">
            <Outlet />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={async () => {
          await logout();
          toast.success(t('auth.logoutSuccess'));
          navigate('/', { replace: true });
        }}
        title={t('nav.logout')}
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}
