import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { FiLock, FiMail, FiPhone, FiUser } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Input, { Checkbox } from '@/components/forms/Input';
import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { localized } from '@/utils/helpers';
import { useAuthStore } from '@/store/authStore';

/**
 * إنشاء حساب عميل.
 *
 * لا يوجد تفعيل بريد ولا OTP: الحساب يُنشأ فوراً ويُسجَّل دخول العميل
 * تلقائياً ثم يُنقل إلى الصفحة الرئيسية.
 */
export default function Register() {
  const { t, lang } = useI18n();
  /* عناوين صفحات الدخول قابلة للتعديل من: استوديو التصميم ← صفحة الدخول */
  const lp = useConfig().settings.loginPage || {};
  const navigate = useNavigate();
  const registerUser = useAuthStore((s) => s.register);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors }
  } = useForm({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      terms: false
    }
  });

  const password = watch('password');

  const onSubmit = async (values) => {
    setLoading(true);
    try {
      await registerUser({
        name: values.name,
        email: values.email,
        phone: values.phone,
        password: values.password,
        confirmPassword: values.confirmPassword
      });
      toast.success(t('auth.registerSuccess'));
      // دخول تلقائي فور التسجيل
      navigate('/', { replace: true });
    } catch (e) {
      const res = e?.response?.data;
      // البريد المكرر يظهر تحت الحقل نفسه لا كإشعار عابر فقط
      if (e?.response?.status === 409 || res?.field === 'email') {
        setError('email', { type: 'manual', message: t('auth.emailTaken') });
        toast.error(t('auth.emailTaken'));
      } else {
        toast.error(res?.message || t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink md:text-3xl">{localized(lp, lang, 'registerHeading') || t('auth.registerTitle')}</h1>
      <p className="mt-2 text-sm text-ink-muted">{localized(lp, lang, 'smallDescription') || t('auth.registerSubtitle')}</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
        <Input
          label={t('auth.fullName')}
          icon={FiUser}
          required
          autoComplete="name"
          error={errors.name?.message}
          {...register('name', {
            required: t('valid.required'),
            minLength: { value: 3, message: t('valid.minLength', { n: 3 }) }
          })}
        />
        <Input
          label={t('common.email')}
          type="email"
          dir="ltr"
          icon={FiMail}
          required
          autoComplete="email"
          placeholder={t('auth.emailPlaceholder')}
          error={errors.email?.message}
          {...register('email', {
            required: t('valid.required'),
            pattern: { value: /^\S+@\S+\.\S+$/, message: t('valid.email') }
          })}
        />
        <Input
          label={t('common.phone')}
          type="tel"
          dir="ltr"
          icon={FiPhone}
          autoComplete="tel"
          placeholder="+20 100 000 0000"
          hint={t('auth.phoneRecoveryHint')}
          error={errors.phone?.message}
          {...register('phone', {
            pattern: { value: /^[+0-9\s-]{8,}$/, message: t('valid.phone') }
          })}
        />
        <Input
          label={t('common.password')}
          type="password"
          dir="ltr"
          icon={FiLock}
          required
          autoComplete="new-password"
          placeholder={t('auth.passwordPlaceholder')}
          hint={t('auth.passwordPolicy')}
          error={errors.password?.message}
          {...register('password', {
            required: t('valid.required'),
            minLength: { value: 8, message: t('valid.minLength', { n: 8 }) },
            maxLength: { value: 128, message: t('valid.maxLength', { n: 128 }) },
            validate: (v) => (/[A-Za-z]/.test(v) && /\d/.test(v)) || t('auth.passwordPolicy')
          })}
        />
        <Input
          label={t('auth.confirmPassword')}
          type="password"
          dir="ltr"
          icon={FiLock}
          required
          autoComplete="new-password"
          placeholder={t('auth.passwordPlaceholder')}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword', {
            required: t('valid.required'),
            validate: (v) => v === password || t('auth.passwordMismatch')
          })}
        />

        <Checkbox
          /* نص الموافقة قابل للتعديل من: استوديو التصميم ← صفحة الدخول */
          label={localized(lp, lang, 'termsText') || t('auth.agreeTerms')}
          error={errors.terms?.message}
          {...register('terms', { required: t('valid.acceptTerms') })}
        />

        <Button type="submit" loading={loading} fullWidth size="lg">
          {loading ? t('auth.signingUp') : t('auth.signUp')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        {t('auth.hasAccount')}{' '}
        <Link to="/login" className="font-bold text-rose hover:underline">
          {t('auth.signIn')}
        </Link>
      </p>
    </div>
  );
}
