import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { FiLock, FiMail } from 'react-icons/fi';
import { FaGoogle, FaFacebookF } from 'react-icons/fa';
import { useQuery } from '@tanstack/react-query';
import client, { API_BASE } from '@/api/client';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Input, { Checkbox } from '@/components/forms/Input';
import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { localized } from '@/utils/helpers';
import { useAuthStore } from '@/store/authStore';

/**
 * صفحة تسجيل الدخول العامة.
 *
 * لا تحتوي — ولا يجب أن تحتوي أبداً — على أي بيانات دخول جاهزة،
 * ولا بريد المدير، ولا حسابات تجريبية، ولا معلومات تطوير.
 */
export default function Login() {
  const { t, lang } = useI18n();
  /* عناوين صفحات الدخول قابلة للتعديل من: استوديو التصميم ← صفحة الدخول */
  const lp = useConfig().settings.loginPage || {};
  const navigate = useNavigate();
  const { state } = useLocation();
  const login = useAuthStore((s) => s.login);
  const [loading, setLoading] = useState(false);

  // أزرار الدخول الاجتماعي تظهر فقط عند تهيئة المفاتيح في متغيرات البيئة
  const { data: providers } = useQuery({
    queryKey: ['oauth-providers'],
    queryFn: () => client.get('/auth/providers').then((r) => r.data?.data),
    staleTime: 5 * 60 * 1000,
    retry: 0
  });
  const oauthUrl = (p) => `${API_BASE}/auth/${p}`;

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({ defaultValues: { email: '', password: '', remember: false } });

  const onSubmit = async (values) => {
    setLoading(true);
    try {
      const user = await login({
        email: values.email,
        password: values.password,
        remember: values.remember
      });
      toast.success(t('auth.loginSuccess'));
      // المدير يذهب للوحة التحكم، والعميل لصفحته المطلوبة أو الرئيسية
      const isStaff = ['admin', 'moderator'].includes(user.role);
      const dest = isStaff ? '/admin' : state?.from || '/';
      navigate(dest, { replace: true });
    } catch (e) {
      toast.error(e?.response?.data?.message || t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink md:text-3xl">{localized(lp, lang, 'loginHeading') || t('auth.loginTitle')}</h1>
      <p className="mt-2 text-sm text-ink-muted">{localized(lp, lang, 'smallDescription') || t('auth.loginSubtitle')}</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
        <Input
          label={t('common.email')}
          type="email"
          dir="ltr"
          icon={FiMail}
          autoComplete="email"
          placeholder={t('auth.emailPlaceholder')}
          error={errors.email?.message}
          {...register('email', {
            required: t('valid.required'),
            pattern: { value: /^\S+@\S+\.\S+$/, message: t('valid.email') }
          })}
        />
        <Input
          label={t('common.password')}
          type="password"
          dir="ltr"
          icon={FiLock}
          autoComplete="current-password"
          placeholder={t('auth.passwordPlaceholder')}
          error={errors.password?.message}
          {...register('password', { required: t('valid.required') })}
        />

        <div className="flex items-center justify-between">
          <Checkbox label={t('auth.rememberMe')} {...register('remember')} />
          <Link to="/forgot-password" className="text-xs font-semibold text-rose hover:underline">
            {t('auth.forgotPassword')}
          </Link>
        </div>

        <Button type="submit" loading={loading} fullWidth size="lg">
          {loading ? t('auth.signingIn') : t('auth.signIn')}
        </Button>
      </form>

      {providers?.google || providers?.facebook ? (
        <>
          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-black/10" />
            <span className="text-xs text-ink-muted">{t('auth.orContinue')}</span>
            <span className="h-px flex-1 bg-black/10" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {providers?.google ? (
              <a
                href={oauthUrl('google')}
                className="flex items-center justify-center gap-2.5 rounded-full border border-ink/15 bg-white py-3 text-sm font-semibold text-ink transition hover:border-rose hover:text-rose"
              >
                <FaGoogle className="text-[#EA4335]" /> {t('auth.google')}
              </a>
            ) : null}
            {providers?.facebook ? (
              <a
                href={oauthUrl('facebook')}
                className="flex items-center justify-center gap-2.5 rounded-full border border-ink/15 bg-white py-3 text-sm font-semibold text-ink transition hover:border-rose hover:text-rose"
              >
                <FaFacebookF className="text-[#1877F2]" /> {t('auth.facebook')}
              </a>
            ) : null}
          </div>
        </>
      ) : null}

      <p className="mt-6 text-center text-sm text-ink-muted">
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="font-bold text-rose hover:underline">
          {t('auth.createAccount')}
        </Link>
      </p>
    </div>
  );
}
