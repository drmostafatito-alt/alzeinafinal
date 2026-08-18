import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FiArrowLeft, FiArrowRight, FiCheck, FiCheckCircle, FiX } from 'react-icons/fi';
import client from '@/api/client';
import { useLocalStorage } from '@/hooks';
import { useI18n } from '@/i18n';
import { formatNumber } from '@/utils/format';
import { cn } from '@/utils/helpers';

/**
 * دليل تجهيز المتجر — أول ما يراه المالك في لوحة التحكم.
 *
 * المشكلة التي يحلّها: لوحة التحكم على متجر جديد كانت جداراً من
 * الأصفار وثماني بطاقات "لا توجد بيانات". هذا صحيح تقنياً لكنه لا
 * يخبر المالك بما ينبغي فعله. النتيجة أن المالك غير التقني يفتح
 * اللوحة ولا يعرف من أين يبدأ.
 *
 * الحل: قائمة خطوات محسوبة من الحالة الحقيقية للمتجر، كل خطوة
 * تقود بنقرة واحدة إلى مكان تنفيذها. الخطوات الحرجة (منتج + وسيلة
 * دفع) مميّزة لأن غيابها يعني أن المتجر لا يستطيع البيع أصلاً.
 *
 * يختفي الدليل تلقائياً عند اكتمال كل الخطوات — لا يبقى يشغّل
 * مساحة في لوحة متجر ناضج.
 */
export default function SetupGuide() {
  const { t, lang, isRTL } = useI18n();
  const Arrow = isRTL ? FiArrowLeft : FiArrowRight;

  /**
   * الإخفاء اليدوي تفضيل واجهة لا بيانات عمل، لذلك يُحفظ محلياً
   * بدل إضافة حقل جديد لقاعدة البيانات. الإخفاء التلقائي عند
   * الاكتمال يأتي من الخادم، وهو السلوك الأهم.
   */
  const [dismissed, setDismissed] = useLocalStorage('alzeina_setup_dismissed', false);

  const { data } = useQuery({
    queryKey: ['admin', 'setup-status'],
    queryFn: () => client.get('/admin/system/setup-status').then((r) => r.data?.data),
    staleTime: 30000
  });

  const steps = useMemo(
    () =>
      (data?.steps || []).map((s) => ({
        ...s,
        title: t(`a5.setup.${s.key}.title`),
        desc: t(`a5.setup.${s.key}.desc`)
      })),
    [data, t]
  );

  // لا نعرض شيئاً قبل وصول البيانات حتى لا يومض الدليل ثم يختفي
  if (!data || data.complete || dismissed || !steps.length) return null;

  const pct = Math.round((data.done / data.total) * 100);

  return (
    <section
      className="mb-6 overflow-hidden rounded-2xl border border-rose/20 bg-white shadow-soft"
      aria-labelledby="setup-guide-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 bg-blush/40 px-5 py-4">
        <div className="min-w-0">
          <h2 id="setup-guide-title" className="text-base font-bold text-ink">
            {t('a5.setup.title')}
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">{t('a5.setup.subtitle')}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* شريط تقدّم يجعل الإنجاز ملموساً ويشجّع على الإكمال */}
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-black/10">
              <div className="h-full rounded-full bg-rose transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="whitespace-nowrap text-xs font-bold text-ink">
              {/* أرقام عربية-هندية في الواجهة العربية، اتساقاً مع بقية اللوحة */}
              {t('a5.setup.progress')
                .replace('{done}', formatNumber(data.done, lang))
                .replace('{total}', formatNumber(data.total, lang))}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-lg p-1.5 text-ink-muted transition hover:bg-black/5 hover:text-ink"
            aria-label={t('a5.setup.hide')}
            title={t('a5.setup.hide')}
          >
            <FiX size={16} />
          </button>
        </div>
      </div>

      <ul className="divide-y divide-black/5">
        {steps.map((step) => (
          <li key={step.key}>
            {step.done ? (
              <div className="flex items-center gap-3 px-5 py-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                  <FiCheck size={14} />
                </span>
                <p className="min-w-0 flex-1 truncate text-sm text-ink-muted line-through">{step.title}</p>
                <span className="shrink-0 text-[11px] font-bold text-emerald-600">{t('a5.setup.done')}</span>
              </div>
            ) : (
              <Link
                to={step.to}
                className="group flex items-center gap-3 px-5 py-3 transition hover:bg-cream/60"
              >
                <span
                  className={cn(
                    'grid h-7 w-7 shrink-0 place-items-center rounded-full ring-1',
                    step.weight === 'critical'
                      ? 'bg-rose/10 text-rose ring-rose/30'
                      : 'bg-black/[0.03] text-ink-muted ring-black/10'
                  )}
                >
                  <FiCheckCircle size={14} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{step.title}</p>
                  <p className="truncate text-xs text-ink-muted">{step.desc}</p>
                </div>

                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-rose opacity-0 transition group-hover:opacity-100">
                  {t('a5.setup.goNow')}
                  <Arrow size={13} />
                </span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
