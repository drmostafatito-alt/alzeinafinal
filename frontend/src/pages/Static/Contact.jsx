import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FiClock, FiMail, FiMapPin, FiPhone, FiSend } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Input, { Textarea } from '@/components/forms/Input';
import PageHeader from '@/components/common/PageHeader';
import { contentService } from '@/services';
import { useI18n } from '@/i18n';
import { useConfig } from '@/config/ConfigProvider';

export default function Contact() {
  const { t, lang } = useI18n();
  const { settings } = useConfig();
  const c = settings.contact || {};
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const onSubmit = async (values) => {
    setLoading(true);
    try {
      await contentService.contact(values);
      toast.success(t('contact.sent'));
      reset();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const address = (lang === 'ar' ? c.address : c.addressEn) || c.address;
  const hours = (lang === 'ar' ? c.businessHours : c.businessHoursEn) || c.businessHours;
  const info = [
    address && { icon: FiMapPin, label: t('checkout.city'), value: address },
    c.phone && { icon: FiPhone, label: t('common.phone'), value: c.phone, href: `tel:${c.phone}`, ltr: true },
    c.email && { icon: FiMail, label: t('common.email'), value: c.email, href: `mailto:${c.email}`, ltr: true },
    hours && { icon: FiClock, label: t('contact.workingHours'), value: hours },
  ].filter(Boolean);

  return (
    <>
      <PageHeader title={t('contact.title')} subtitle={t('contact.subtitle')} breadcrumbs={[{ label: t('contact.title') }]} />

      <div className="container-x py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Info */}
          <div className="space-y-4">
            {info.map(({ icon: Icon, label, value, href, ltr }) => (
              <div key={label} className="flex items-start gap-3 rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blush text-rose">
                  <Icon size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-ink-muted">{label}</p>
                  {href ? (
                    <a
                      href={href}
                      dir={ltr ? 'ltr' : undefined}
                      className="mt-0.5 block text-sm font-bold text-ink transition hover:text-rose rtl:text-end"
                    >
                      {value}
                    </a>
                  ) : (
                    <p className="mt-0.5 text-sm font-bold text-ink">{value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit(onSubmit)} className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label={t('common.name')}
                  required
                  error={errors.name?.message}
                  {...register('name', { required: t('valid.required') })}
                />
                <Input
                  label={t('common.email')}
                  type="email"
                  dir="ltr"
                  required
                  error={errors.email?.message}
                  {...register('email', {
                    required: t('valid.required'),
                    pattern: { value: /^\S+@\S+\.\S+$/, message: t('valid.email') },
                  })}
                />
                <Input label={t('common.phone')} type="tel" dir="ltr" {...register('phone')} />
                <Input
                  label={t('contact.subject')}
                  required
                  error={errors.subject?.message}
                  {...register('subject', { required: t('valid.required') })}
                />
                <Textarea
                  label={t('contact.message')}
                  rows={6}
                  required
                  containerClassName="sm:col-span-2"
                  error={errors.message?.message}
                  {...register('message', {
                    required: t('valid.required'),
                    minLength: { value: 10, message: t('valid.minLength', { n: 10 }) },
                  })}
                />
              </div>
              <Button type="submit" loading={loading} icon={FiSend} className="mt-5">
                {t('contact.send')}
              </Button>
            </form>
          </div>
        </div>

        {/* خريطة جوجل — تُضبط من لوحة الإدارة */}
        {c.mapEmbed ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-black/5 shadow-soft">
            <iframe
              title="map"
              src={c.mapEmbed}
              className="h-[360px] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
