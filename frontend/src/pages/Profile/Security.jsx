import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FiLock } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Input from '@/components/forms/Input';
import { authService } from '@/services';
import { useI18n } from '@/i18n';

export default function Security() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm();

  const newPassword = watch('newPassword');

  const onSubmit = async (values) => {
    setLoading(true);
    try {
      await authService.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success(t('profile.passwordChanged'));
      reset();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
      <h2 className="mb-5 text-lg font-bold text-ink">{t('profile.changePassword')}</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-md space-y-4">
        <Input
          label={t('profile.currentPassword')}
          type="password"
          dir="ltr"
          icon={FiLock}
          required
          error={errors.currentPassword?.message}
          {...register('currentPassword', { required: t('valid.required') })}
        />
        <Input
          label={t('profile.newPassword')}
          type="password"
          dir="ltr"
          icon={FiLock}
          required
          error={errors.newPassword?.message}
          {...register('newPassword', {
            required: t('valid.required'),
            minLength: { value: 6, message: t('valid.minLength', { n: 6 }) },
          })}
        />
        <Input
          label={t('auth.confirmPassword')}
          type="password"
          dir="ltr"
          icon={FiLock}
          required
          error={errors.confirmPassword?.message}
          {...register('confirmPassword', {
            required: t('valid.required'),
            validate: (v) => v === newPassword || t('auth.passwordMismatch'),
          })}
        />
        <Button type="submit" loading={loading}>
          {t('profile.changePassword')}
        </Button>
      </form>
    </div>
  );
}
