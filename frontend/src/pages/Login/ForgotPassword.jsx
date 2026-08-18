import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { FiCheck, FiMail } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Input from '@/components/forms/Input';
import { authService } from '@/services';
import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { localized } from '@/utils/helpers';

/**
 * استعادة كلمة المرور عبر البريد الإلكتروني.
 *
 * التدفق الآمن:
 * 1) المستخدم يدخل بريده فقط.
 * 2) الخادم يولّد توكن إعادة تعيين عشوائياً (crypto.getRandomValues)،
 *    يخزّن بصمته (SHA-256) فقط مع صلاحية قصيرة، ويرسل رسالة بريد
 *    تحتوي رابط /reset-password?token=…
 * 3) الصفحة تعرض دائماً نفس الرسالة العامة سواء وُجد البريد أم لا —
 *    لا Email Enumeration.
 *
 * ملاحظة مهمة: التوكن لا يعود في استجابة الـAPI إطلاقاً (أماناً)،
 * فالنسخة السابقة من هذه الصفحة كانت تنتظر resetToken في الرد ثم تفشل —
 * أُعيدت كتابتها على التدفق الصحيح القائم على البريد.
 */
export default function ForgotPassword() {
  const { t, lang } = useI18n();
  /* عناوين صفحات الدخول قابلة للتعديل من: استوديو التصميم ← صفحة الدخول */
  const lp = useConfig().settings.loginPage || {};
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: { email: '' } });

  const onSubmit = async ({ email }) => {
    setLoading(true);
    try {
      await authService.forgotPassword({ email });
      // نفس الشاشة للجميع — لا يكشف الخادم ولا الصفحة وجود البريد
      setSent(true);
    } catch (e) {
      /* 429 = حد معدل الطلبات — نعرض رسالة الخادم العامة (لا تكشف أي شيء عن البريد).
         أي خطأ آخر: نفس شاشة النجاح العامة حفاظاً على منع Email Enumeration. */
      if (e?.response?.status === 429) {
        toast.error(e?.response?.data?.message || t('common.error'));
      } else {
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center">
        <span className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-600">
          <FiCheck size={34} />
        </span>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">{t('auth.checkYourEmail')}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-muted">
          {t('auth.checkYourEmailDesc')}
        </p>
        <div className="mt-7 flex flex-col items-center gap-3">
          <Link to="/login" className="text-sm font-bold text-rose hover:underline">
            {t('auth.backToLogin')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink md:text-3xl">{localized(lp, lang, 'forgotHeading') || t('auth.recoverTitle')}</h1>
      <p className="mt-2 text-sm text-ink-muted">{localized(lp, lang, 'smallDescription') || t('auth.recoverSubtitle')}</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
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

        <Button type="submit" loading={loading} fullWidth size="lg" icon={FiMail}>
          {t('auth.sendResetLink')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        <Link to="/login" className="font-bold text-rose hover:underline">
          {t('auth.backToLogin')}
        </Link>
      </p>
    </div>
  );
}
