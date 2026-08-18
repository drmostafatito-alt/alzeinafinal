import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FiMail, FiPhone, FiUser } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Input, { Select } from '@/components/forms/Input';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';

export default function ProfileInfo() {
  const { t, lang, setGender } = useI18n();
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [loading, setLoading] = useState(false);

  const wishCount = useWishlistStore((s) => s.items.length);
  const cartCount = useCartStore((s) => s.items.length);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm({
    defaultValues: {
      name: user?.name || '', email: user?.email || '', phone: user?.phone || '',
      gender: user?.gender || 'female',
    },
  });

  const onSubmit = async (values) => {
    setLoading(true);
    try {
      await updateProfile({ name: values.name, phone: values.phone, gender: values.gender });
      /* تطبيق صيغة المخاطبة فوراً بلا انتظار إعادة تحميل */
      setGender(values.gender);
      toast.success(t('profile.updated'));
    } catch (e) {
      toast.error(e?.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: t('admin.ordersCount'), value: user?.ordersCount ?? 0 },
          { label: t('nav.wishlist'), value: wishCount },
          { label: t('nav.cart'), value: cartCount },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-black/5 bg-white p-5 text-center shadow-soft">
            <p className="font-en text-2xl font-bold text-rose">{s.value}</p>
            <p className="mt-1 text-xs text-ink-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
        <h2 className="mb-5 text-lg font-bold text-ink">{t('profile.info')}</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('common.name')}
              icon={FiUser}
              required
              error={errors.name?.message}
              {...register('name', {
                required: t('valid.required'),
                minLength: { value: 2, message: t('valid.minLength', { n: 2 }) },
              })}
            />
            <Input
              label={t('common.phone')}
              type="tel"
              dir="ltr"
              icon={FiPhone}
              error={errors.phone?.message}
              {...register('phone', {
                pattern: { value: /^[+0-9\s-]{8,}$/, message: t('valid.phone') },
              })}
            />
            <Input
              label={t('common.email')}
              type="email"
              dir="ltr"
              icon={FiMail}
              disabled
              containerClassName="sm:col-span-2"
              hint={t('profile.security')}
              {...register('email')}
            />
            {/*
              صيغة المخاطبة تخصّ العربية وحدها — الإنجليزية محايدة،
              فلا معنى لعرض الحقل في واجهة إنجليزية.
            */}
            {lang === 'ar' ? (
              <Select
                label={t('profile.gender')}
                hint={t('profile.genderHint')}
                containerClassName="sm:col-span-2"
                options={[
                  { value: 'female', label: t('profile.female') },
                  { value: 'male', label: t('profile.male') },
                ]}
                {...register('gender')}
              />
            ) : null}
          </div>
          <Button type="submit" loading={loading} disabled={!isDirty}>
            {t('profile.updateInfo')}
          </Button>
        </form>
      </div>
    </div>
  );
}
