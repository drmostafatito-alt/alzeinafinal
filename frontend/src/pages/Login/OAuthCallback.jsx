import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { PageSpinner } from '@/components/ui/Spinner';
import { authService } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { useI18n } from '@/i18n';

/** يستقبل التوكن بعد تسجيل الدخول عبر جوجل/فيسبوك ثم يكمل الجلسة */
export default function OAuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const setSession = useAuthStore((s) => s.setSession);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token = params.get('token');
    const error = params.get('error');

    if (error || !token) {
      toast.error(t('auth.invalidCredentials'));
      navigate('/login', { replace: true });
      return;
    }

    (async () => {
      try {
        // نخزّن التوكن أولاً حتى يستخدمه الـ interceptor
        setSession(null, token);
        const { data } = await authService.me();
        setSession(data.user, token);
        toast.success(t('auth.loginSuccess'));
        navigate(['admin', 'moderator'].includes(data.user?.role) ? '/admin' : '/', { replace: true });
      } catch {
        toast.error(t('common.error'));
        navigate('/login', { replace: true });
      }
    })();
  }, [params, navigate, setSession, t]);

  return <PageSpinner label={t('common.loading')} />;
}
