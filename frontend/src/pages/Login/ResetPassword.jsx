import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { FiCheck, FiLock } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Input from '@/components/forms/Input';
import { authService } from '@/services';
import { useI18n } from '@/i18n';

/**
 * صفحة إعادة تعيين كلمة المرور — تُفتح من رابط البريد:
 *   /reset-password?token=…
 *
 * - التوكن يُقرأ من الـURL مرة واحدة ويُرسل للخادم الذي يقارن بصمته (SHA-256).
 * - إظهار/إخفاء كلمة المرور مدمج في حقل Input (password type).
 * - سياسة موحّدة مع الخادم: 8 أحرف على الأقل، حروف وأرقام، حد أقصى 128.
 * - بعد النجاح: الخادم يبطل التوكن فوراً + يبطل كل الجلسات القديمة.
 */
export default function ResetPassword() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = (params.get('token') || '').trim();
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm({ defaultValues: { newPassword: '', confirmPassword: '' } });
  const newPassword = watch('newPassword');

  const onSubmit = async (values) => {
    setLoading(true);
    try {
      await authService.resetPassword({ token, newPassword: values.newPassword });
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2200);
    } catch (e) {
      toast.error(e?.response?.data?.message || t('common.error'));
      // توكن مستخدم/منتهٍ/معدّل → نوجه لطلب رابط جديد بدل بقاء المستخدم في صفحة ميتة
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="text-xl font-bold text-ink">{t('common.error')}</h1>
        <p className="mt-2 text-sm text-ink-muted">{t('auth.checkYourEmailDesc')}</p>
        <Link to="/forgot-password" className="mt-4 inline-block text-sm font-bold text-rose hover:underline">
          {t('auth.requestNewLink')}
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
          <FiCheck size={30} />
        </span>
        <h1 className="text-2xl font-bold text-ink">{t('profile.passwordChanged')}</h1>
        <p className="mt-2 text-sm text-ink-muted">{t('auth.recoverySuccess')}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink md:text-3xl">{t('auth.resetHeading')}</h1>
      <p className="mt-2 text-sm text-ink-muted">{t('auth.resetSubtitle')}</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
        <Input
          label={t('auth.newPassword')}
          type="password"
          dir="ltr"
          icon={FiLock}
          required
          autoComplete="new-password"
          hint={t('auth.passwordPolicy')}
          error={errors.newPassword?.message}
          {...register('newPassword', {
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
          error={errors.confirmPassword?.message}
          {...register('confirmPassword', {
            required: t('valid.required'),
            validate: (v) => v === newPassword || t('auth.passwordMismatch')
          })}
        />
        <Button type="submit" loading={loading} fullWidth size="lg">
          {t('common.save')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        {t('auth.checkYourEmailDesc')}{' '}
        <Link to="/forgot-password" className="font-bold text-rose hover:underline">
          {t('auth.requestNewLink')}
        </Link>
      </p>
    </div>
  );
}
