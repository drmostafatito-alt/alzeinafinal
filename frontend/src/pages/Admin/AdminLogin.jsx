import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { FiLock, FiMail, FiShield } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Input, { Checkbox } from '@/components/forms/Input';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/store/authStore';

/**
 * صفحة دخول لوحة الإدارة (/admin/login).
 *
 * منفصلة تماماً عن دخول العملاء وتستدعي مساراً مختلفاً على الخادم
 * يرفض حسابات العملاء. الصفحة لا تحتوي على أي بيانات دخول جاهزة
 * ولا رابط لإنشاء حساب — لوحة الإدارة ليست مفتوحة للتسجيل.
 */
export default function AdminLogin() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { state } = useLocation();
  const adminLogin = useAuthStore((s) => s.adminLogin);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({ defaultValues: { email: '', password: '', remember: false } });

  const onSubmit = async (values) => {
    setLoading(true);
    try {
      await adminLogin(values);
      toast.success(t('auth.loginSuccess'));
      navigate(state?.from?.startsWith('/admin') ? state.from : '/admin', { replace: true });
    } catch (e) {
      toast.error(e?.response?.data?.message || t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-ink px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lift">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-blush text-rose">
            <FiShield size={26} />
          </span>
          <h1 className="text-xl font-bold text-ink">{t('admin.loginTitle')}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t('admin.loginSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            label={t('common.email')}
            type="email"
            dir="ltr"
            icon={FiMail}
            autoComplete="username"
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
            error={errors.password?.message}
            {...register('password', { required: t('valid.required') })}
          />

          <Checkbox label={t('auth.rememberMe')} {...register('remember')} />

          <Button type="submit" loading={loading} fullWidth size="lg">
            {loading ? t('auth.signingIn') : t('auth.signIn')}
          </Button>
        </form>
      </div>
    </div>
  );
}
