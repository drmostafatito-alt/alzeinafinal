import { FiClock, FiMail } from 'react-icons/fi';
import Logo from '@/components/ui/Logo';
import { useCountdown } from '@/hooks';
import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { localized } from '@/utils/helpers';
import { mediaUrl } from '@/utils/media';
import { socialLinks } from '@/utils/socialIcons';

/**
 * صفحة الصيانة.
 *
 * المشكلة التي تحلّها: كان الخادم يعمل بشكل صحيح تماماً — يعيد 503 مع
 * كل بيانات الصيانة (عنوان، رسالة، شعار، خلفية، عدّاد، تواصل) —
 * و ConfigProvider يخزّنها في حالة `maintenance`، لكن **لا مكوّن واحد
 * يقرأ تلك الحالة**. النتيجة: يفعّل المالك وضع الصيانة فيرى الزائر
 * متجراً بالقيم الافتراضية بدل رسالة الصيانة. أي أن الميزة كانت
 * مكتملة في الخادم ومفقودة في الواجهة.
 *
 * كل ما يظهر هنا يأتي من الإعدادات — لا نص ولا صورة مكتوبة في الكود.
 */
export default function Maintenance() {
  const { maintenance, settings } = useConfig();
  const { lang } = useI18n();

  const m = settings.maintenance || {};
  const title = localized(m, lang, 'title') || maintenance || '';
  const message = localized(m, lang, 'message') || '';

  const { days, hours, minutes, seconds, isExpired } = useCountdown(
    m.showCountdown && m.countdownTo ? m.countdownTo : null
  );
  const showCountdown = Boolean(m.showCountdown && m.countdownTo) && !isExpired;

  const links = m.showSocial === false ? [] : socialLinks(settings.social);

  const email = m.contactEmail || settings.contact?.supportEmail || settings.contact?.email || '';

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-cream px-6 py-16 text-center">
      {/* خلفية يرفعها المدير */}
      {m.backgroundImage ? (
        <>
          <img
            src={mediaUrl(m.backgroundImage)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-ink/60" />
        </>
      ) : null}

      <div className="relative z-10 w-full max-w-xl">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" asLink={false} src={m.logo || undefined} variant={m.backgroundImage ? 'light' : 'dark'} />
        </div>

        {title ? (
          <h1
            className={
              m.backgroundImage
                ? 'text-3xl font-bold text-white md:text-4xl'
                : 'text-3xl font-bold text-ink md:text-4xl'
            }
          >
            {title}
          </h1>
        ) : null}

        {message ? (
          <p className={m.backgroundImage ? 'mt-4 leading-relaxed text-white/80' : 'mt-4 leading-relaxed text-ink-muted'}>
            {message}
          </p>
        ) : null}

        {/* عدّاد العودة — يظهر فقط بتاريخ حقيقي لم ينقضِ */}
        {/*
          dir=ltr مقصود: العدّاد يُقرأ يوم←ساعة←دقيقة←ثانية في كل اللغات.
          بلا هذا ينعكس الترتيب في RTL فيظهر 54:59:23:01 بدل 01:23:59:54.
        */}
        {showCountdown ? (
          <div dir="ltr" className="mt-8 flex items-center justify-center gap-3">
            {[
              [days, 'D'], [hours, 'H'], [minutes, 'M'], [seconds, 'S'],
            ].map(([v, l]) => (
              <div
                key={l}
                className="flex min-w-[62px] flex-col items-center rounded-xl bg-white/90 px-3 py-2 shadow-soft backdrop-blur"
              >
                <span className="font-en text-2xl font-bold tabular-nums text-ink">
                  {String(v).padStart(2, '0')}
                </span>
                <span className="mt-0.5 text-[10px] font-medium text-ink-muted">{l}</span>
              </div>
            ))}
          </div>
        ) : null}

        {email ? (
          <a
            href={`mailto:${email}`}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-rose px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
          >
            <FiMail size={15} />
            {email}
          </a>
        ) : null}

        {links.length ? (
          <div className="mt-8 flex items-center justify-center gap-3">
            {links.map(({ key, icon: Icon, href }) => (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={key}
                className={
                  m.backgroundImage
                    ? 'grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25'
                    : 'grid h-10 w-10 place-items-center rounded-full bg-white text-ink shadow-soft transition hover:text-rose'
                }
              >
                <Icon size={16} />
              </a>
            ))}
          </div>
        ) : null}

        {!showCountdown && m.showCountdown ? (
          <p className="mt-6 inline-flex items-center gap-2 text-xs text-ink-muted">
            <FiClock size={13} /> {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
