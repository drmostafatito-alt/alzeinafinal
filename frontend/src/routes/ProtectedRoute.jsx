import { Navigate, useLocation } from 'react-router-dom';
import { FiLock } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/store/authStore';

export function ProtectedRoute({ children }) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  if (!user || !token) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}

export function AdminRoute({ children }) {
  const { t } = useI18n();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  // غير مسجّل دخول → صفحة دخول لوحة الإدارة (وليس دخول العملاء)
  if (!user || !token) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }

  if (!['admin', 'moderator'].includes(user.role)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream px-6 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-blush text-rose">
          <FiLock size={30} />
        </span>
        <h1 className="text-xl font-bold text-ink">{t('admin.accessDenied')}</h1>
        <Button to="/">{t('notFound.home')}</Button>
      </div>
    );
  }

  return children;
}

export function GuestRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  if (user && token) return <Navigate to="/" replace />;
  return children;
}

/** يمنع عرض صفحة دخول الإدارة لمن هو مسجّل دخول كإداري بالفعل */
export function AdminGuestRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  if (user && token && ['admin', 'moderator'].includes(user.role)) {
    return <Navigate to="/admin" replace />;
  }
  return children;
}
