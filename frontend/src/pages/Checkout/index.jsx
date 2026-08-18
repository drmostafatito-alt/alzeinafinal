import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { FiCheck, FiChevronLeft, FiChevronRight, FiCopy } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/common/PageHeader';
import Input, { Checkbox, RadioCard, Select, Textarea } from '@/components/forms/Input';
import { orderService } from '@/services';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/utils/format';
import { cn, localized, readStorage, writeStorage } from '@/utils/helpers';
import { useConfig } from '@/config/ConfigProvider';
import client from '@/api/client';
import PaymentProofUpload from '@/components/checkout/PaymentProofUpload';
import SmartImage from '@/components/ui/SmartImage';
import { paymentIcon } from '@/utils/paymentIcons';
import { registerExtraTranslations } from '@/i18n';
import { paymentTranslations } from '@/i18n/paymentTranslations';

registerExtraTranslations('payments', paymentTranslations);

const STEPS = ['shippingInfo', 'paymentMethod', 'review'];

export default function Checkout() {
  const { t, lang, isRTL } = useI18n();
  const { governorates, paymentMethods } = useConfig();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());
  const couponDiscount = useCartStore((s) => s.couponDiscount());
  const localShipping = useCartStore((s) => s.shippingCost());
  const localTotal = useCartStore((s) => s.total());
  const coupon = useCartStore((s) => s.coupon);
  const setShippingGov = useCartStore((s) => s.setShippingGovernorate);
  const clearCart = useCartStore((s) => s.clear);

  const [step, setStep] = useState(0);
  const [payment, setPayment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // يمنع الـ guard من إعادة التوجيه إلى /cart بعد إفراغ السلة عند نجاح الطلب.
  // نستخدم ref لأن تحديث zustand يسبب re-render فورياً قبل تثبيت أي setState.
  const placedRef = useRef(false);
  const [serverShipping, setServerShipping] = useState(null);
  // إيصال التحويل للطرق اليدوية — يُرفع للخادم ويُخزَّن مساره
  const [paymentProof, setPaymentProof] = useState('');

  const saved = readStorage('alzeina_shipping', {});

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: user?.name || saved.name || '',
      phone: user?.phone || saved.phone || '',
      email: user?.email || saved.email || '',
      governorate: saved.governorate || '',
      city: saved.city || '',
      district: saved.district || '',
      street: saved.street || '',
      buildingNumber: saved.buildingNumber || '',
      floor: saved.floor || '',
      apartment: saved.apartment || '',
      landmark: saved.landmark || '',
      notes: '',
      saveAddress: true,
    },
  });

  const govValue = watch('governorate');

  // طرق الدفع المتاحة لهذا المبلغ (يفلترها الخادم أيضاً عند الإرسال)
  const availableMethods = useMemo(() => {
    const gov = governorates.find((g) => g.code === govValue);
    return (paymentMethods || []).filter((m) => {
      if (m.minOrderAmount && subtotal < m.minOrderAmount) return false;
      if (m.maxOrderAmount && subtotal > m.maxOrderAmount) return false;
      if (m.type === 'cod' && gov && gov.codEnabled === false) return false;
      return true;
    });
  }, [paymentMethods, subtotal, governorates, govValue]);

  // تغيير طريقة الدفع يلغي الإيصال المرفوع سابقاً
  useEffect(() => {
    setPaymentProof('');
  }, [payment]);

  // اختيار أول طريقة متاحة تلقائياً
  useEffect(() => {
    if (!payment && availableMethods.length) setPayment(availableMethods[0].code);
    if (payment && !availableMethods.some((m) => m.code === payment)) {
      setPayment(availableMethods[0]?.code || '');
    }
  }, [availableMethods, payment]);

  // الخادم هو المرجع في سعر الشحن والرسوم — القيم المحلية للعرض الفوري فقط
  const selectedMethod = availableMethods.find((m) => m.code === payment) || null;
  const proofRequired = Boolean(selectedMethod?.requiresProof);
  const referenceRequired = Boolean(selectedMethod?.requiresReference);

  const shippingCost = serverShipping ? serverShipping.cost : localShipping;
  const selectedForFee = availableMethods.find((m) => m.code === payment);
  /* الرسوم من D1 (feeType/feeValue) — القيمة المعروضة تقريبية والعرض النهائي من الخادم */
  const paymentFee = selectedForFee?.feeType === 'fixed'
    ? Number(selectedForFee.feeValue) || 0
    : selectedForFee?.feeType === 'percentage'
      ? Math.round((subtotal - couponDiscount) * (Number(selectedForFee.feeValue) || 0)) / 100
      : 0;
  const total = Math.max(0, subtotal - couponDiscount + shippingCost + paymentFee);

  // سعر الشحن يُطلب من الخادم — لا يُحسب في المتصفح
  useEffect(() => {
    if (!govValue) return;
    const gov = governorates.find((g) => g.code === govValue);
    /* Gate 5: محافظة لا تنتمي للدولة الحالية (بعد تبديل البلد) — تُمحى مع
       أي عرضة شحن قديمة، وإلا ظلّ «gov-cairo» مختاراً تحت دولة الإمارات */
    if (!gov) {
      setServerShipping(null);
      setValue('governorate', '');
      return;
    }
    setShippingGov({ ...gov, shipping: gov.shippingCost });

    let cancelled = false;
    client
      .get('/storefront/shipping/quote', { params: { governorate: govValue, subtotal } })
      .then((res) => {
        if (cancelled) return;
        const q = res.data?.data;
        if (q) setServerShipping(q);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [govValue, subtotal, governorates, setShippingGov]);

  useEffect(() => {
    if (!items.length && !placedRef.current) {
      toast.info(t('checkout.emptyCart'));
      navigate('/cart', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  if (!items.length) return null;

  const Prev = isRTL ? FiChevronRight : FiChevronLeft;
  const Next = isRTL ? FiChevronLeft : FiChevronRight;

  const onSubmit = async (values) => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // نفس شروط الخادم: إيصال ورقم عملية للطرق اليدوية
    if (proofRequired && !paymentProof) {
      toast.error(t('payment.proofRequired'));
      setStep(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (referenceRequired && !String(values.paymentReference || '').trim()) {
      toast.error(t('payment.referenceRequired'));
      setStep(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    try {
      if (values.saveAddress) writeStorage('alzeina_shipping', values);

      const gov = governorates.find((g) => g.code === values.governorate);
      const payload = {
        shippingAddress: {
          name: values.name,
          governorate: gov ? (lang === 'ar' ? gov.name : gov.nameEn) || gov.name : values.governorate,
          city: values.city,
          district: values.district,
          street: values.street,
          buildingNumber: values.buildingNumber,
          floor: values.floor,
          apartment: values.apartment,
          landmark: values.landmark,
          phone: values.phone,
        },
        items: items.map((i) => ({
          productId: i.productId,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          image: i.image,
          variant: i.variant,
        })),
        paymentMethod: payment,
        governorateCode: values.governorate,
        paymentReference: values.paymentReference,
        paymentProof,
        subtotal,
        couponDiscount,
        coupon: coupon?._id,
        shippingCost,
        total,
        notes: values.notes,
        guestEmail: values.email,
        guestPhone: values.phone,
      };

      const { data } = await orderService.create(payload);
      const order = data.order;
      placedRef.current = true;
      clearCart();
      navigate('/order-success', { state: { order }, replace: true });
    } catch (e) {
      placedRef.current = false;
      toast.error(e?.response?.data?.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const govOptions = governorates.map((g) => ({
    value: g.code,
    label: (lang === 'ar' ? g.name : g.nameEn) || g.name
  }));

  return (
    <>
      <PageHeader title={t('checkout.title')} breadcrumbs={[{ to: '/cart', label: t('cart.title') }, { label: t('checkout.title') }]} />

      <div className="container-x py-8">
        {/* Stepper */}
        <ol className="mb-8 flex items-center justify-center gap-2 sm:gap-4">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2 sm:gap-4">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className="flex items-center gap-2.5"
              >
                <span
                  className={cn(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold transition',
                    i < step
                      ? 'bg-emerald-500 text-white'
                      : i === step
                      ? 'bg-ink text-white'
                      : 'bg-black/5 text-ink-muted'
                  )}
                >
                  {i < step ? <FiCheck size={16} /> : i + 1}
                </span>
                <span
                  className={cn(
                    'hidden text-sm font-semibold sm:block',
                    i === step ? 'text-ink' : 'text-ink-muted'
                  )}
                >
                  {t(`checkout.${s}`)}
                </span>
              </button>
              {i < STEPS.length - 1 ? <span className="h-px w-6 bg-black/10 sm:w-12" /> : null}
            </li>
          ))}
        </ol>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            {/* Step 1: shipping */}
            <div className={cn('rounded-2xl border border-black/5 bg-white p-6 shadow-soft', step !== 0 && 'hidden')}>
              <h3 className="mb-5 text-lg font-bold text-ink">{t('checkout.shippingInfo')}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label={t('checkout.fullName')}
                  required
                  error={errors.name?.message}
                  {...register('name', { required: t('valid.required') })}
                />
                <Input
                  label={t('common.phone')}
                  type="tel"
                  dir="ltr"
                  required
                  error={errors.phone?.message}
                  {...register('phone', {
                    required: t('valid.required'),
                    pattern: { value: /^[+0-9\s-]{8,}$/, message: t('valid.phone') },
                  })}
                />
                <Input
                  label={t('common.email')}
                  type="email"
                  dir="ltr"
                  containerClassName="sm:col-span-2"
                  error={errors.email?.message}
                  {...register('email', {
                    pattern: { value: /^\S+@\S+\.\S+$/, message: t('valid.email') },
                  })}
                />
                <Select
                  label={t('checkout.governorate')}
                  required
                  placeholder={t('common.select')}
                  options={govOptions}
                  error={errors.governorate?.message}
                  {...register('governorate', { required: t('valid.required') })}
                />
                <Input
                  label={t('checkout.city')}
                  required
                  error={errors.city?.message}
                  {...register('city', { required: t('valid.required') })}
                />
                <Input
                  label={t('checkout.district')}
                  required
                  error={errors.district?.message}
                  {...register('district', { required: t('valid.required') })}
                />
                <Input
                  label={t('checkout.street')}
                  required
                  error={errors.street?.message}
                  {...register('street', { required: t('valid.required') })}
                />
                <Input label={t('checkout.building')} {...register('buildingNumber')} />
                <Input label={t('checkout.floor')} {...register('floor')} />
                <Input label={t('checkout.apartment')} {...register('apartment')} />
                <Input
                  label={`${t('checkout.landmark')} (${t('common.optional')})`}
                  containerClassName="sm:col-span-2"
                  {...register('landmark')}
                />
                <Textarea
                  label={t('checkout.notes')}
                  placeholder={t('checkout.notesPlaceholder')}
                  rows={3}
                  containerClassName="sm:col-span-2"
                  {...register('notes')}
                />
              </div>
              <div className="mt-4">
                <Checkbox label={t('checkout.saveAddress')} {...register('saveAddress')} />
              </div>
            </div>

            {/* Step 2: payment */}
            <div className={cn('rounded-2xl border border-black/5 bg-white p-6 shadow-soft', step !== 1 && 'hidden')}>
              <h3 className="mb-5 text-lg font-bold text-ink">{t('checkout.paymentMethod')}</h3>
              <div className="space-y-3">
                {availableMethods.length === 0 ? (
                  <p className="rounded-xl bg-blush/50 p-4 text-center text-sm text-ink-muted">
                    {t('admin.noData')}
                  </p>
                ) : null}
                {availableMethods.map((m) => {
                  const Icon = paymentIcon(m.code, m.icon);
                  const label = (lang === 'ar' ? m.name : m.nameEn) || m.name;
                  const desc = (lang === 'ar' ? m.description : m.descriptionEn) || m.description;
                  const feeLabel = m.feeType === 'fixed' && Number(m.feeValue) > 0
                    ? `${label} (+${formatPrice(m.feeValue, lang)})`
                    : m.feeType === 'percentage' && Number(m.feeValue) > 0
                      ? `${label} (+${m.feeValue}%)`
                      : label;
                  const isSelected = payment === m.code;
                  const wallet = m.walletNumber || m.accountNumber || '';
                  const handle = m.instaPayHandle || m.handle || '';
                  const isInstapay = String(m.code).toLowerCase().includes('instapay');
                  return (
                    <div key={m._id} className={cn(
                      'overflow-hidden rounded-2xl border transition',
                      isSelected ? 'border-rose bg-blush/20 shadow-soft' : 'border-black/5'
                    )}>
                      <RadioCard
                        name="payment"
                        value={m.code}
                        checked={isSelected}
                        onChange={() => setPayment(m.code)}
                        icon={Icon}
                        label={feeLabel}
                        description={desc}
                        className={isSelected ? 'border-0' : undefined}
                      />
                      {/* بيانات الدفع والتعليمات والمبلغ — من D1 كما يضبطها المدير */}
                      {isSelected && m.type !== 'cod' ? (
                        <div className="space-y-3 border-t border-rose/20 px-4 pb-4 pt-3 text-sm sm:px-5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                              {t('payment.paymentDetails')}
                            </p>
                            {m.amountLabel ? <span className="text-[11px] text-ink-muted">{m.amountLabel}</span> : null}
                          </div>

                          {(wallet || handle || m.accountName) ? (
                            <dl className="space-y-2">
                              {isInstapay && handle ? (
                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                                  <dt className="text-xs text-ink-muted">{t('payment.instaPayHandle')}</dt>
                                  <dd className="flex items-center gap-2">
                                    <span dir="ltr" className="font-en font-bold text-ink">{handle}</span>
                                    <button type="button" onClick={() => { navigator.clipboard.writeText(handle); toast.success(t('common.copied')); }}
                                      className="grid h-7 w-7 place-items-center rounded-lg bg-blush text-rose" aria-label={t('common.copy')}>
                                      <FiCopy size={12} />
                                    </button>
                                  </dd>
                                </div>
                              ) : null}
                              {wallet ? (
                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                                  <dt className="text-xs text-ink-muted">{t('payment.walletNumber')}</dt>
                                  <dd className="flex items-center gap-2">
                                    <span dir="ltr" className="font-en font-bold text-ink">{wallet}</span>
                                    <button type="button" onClick={() => { navigator.clipboard.writeText(wallet); toast.success(t('common.copied')); }}
                                      className="grid h-7 w-7 place-items-center rounded-lg bg-blush text-rose" aria-label={t('common.copy')}>
                                      <FiCopy size={12} />
                                    </button>
                                  </dd>
                                </div>
                              ) : null}
                              {m.accountName ? (
                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                                  <dt className="text-xs text-ink-muted">{t('payment.accountName')}</dt>
                                  <dd className="font-semibold text-ink">{m.accountName}</dd>
                                </div>
                              ) : null}
                            </dl>
                          ) : null}

                          {m.instructions ? (
                            <p className="whitespace-pre-line text-xs leading-relaxed text-ink-soft">
                              {(lang === 'ar' ? m.instructions : m.instructionsEn) || m.instructions}
                            </p>
                          ) : null}

                          {m.qrCode ? (
                            <div className="flex justify-center rounded-xl bg-white p-3">
                              <SmartImage src={m.qrCode} alt="QR" className="h-36 w-36 rounded-lg object-contain" />
                            </div>
                          ) : null}

                          {/* المبلغ المطلوب — من إجمالي الطلب المحسوب خادمياً */}
                          <div className="flex items-center justify-between rounded-xl bg-ink px-4 py-3 text-white">
                            <span className="text-xs font-semibold opacity-80">{t('payment.payAmount')}</span>
                            <span className="font-en text-lg font-bold">{formatPrice(total, lang)}</span>
                          </div>

                          {m.requiresReference ? (
                            <Input
                              label={t('checkout.paymentReference')}
                              required
                              error={errors.paymentReference?.message}
                              {...register('paymentReference', {
                                validate: (v) =>
                                  !referenceRequired || (v && String(v).trim())
                                    ? true
                                    : t('payment.referenceRequired'),
                              })}
                            />
                          ) : null}
                          {m.requiresProof ? (
                            <PaymentProofUpload value={paymentProof} onChange={setPaymentProof} required />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 3: review */}
            <div className={cn('space-y-5', step !== 2 && 'hidden')}>
              <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
                <h3 className="mb-4 text-lg font-bold text-ink">{t('orders.shippingAddress')}</h3>
                <div className="space-y-1 text-sm text-ink-soft">
                  <p className="font-semibold text-ink">{watch('name')}</p>
                  <p dir="ltr" className="text-start rtl:text-end">
                    {watch('phone')}
                  </p>
                  <p>
                    {[watch('street'), watch('district'), watch('city'), govOptions.find((g) => g.value === govValue)?.label]
                      .filter(Boolean)
                      .join('، ')}
                  </p>
                  {watch('landmark') ? <p className="text-xs text-ink-muted">{watch('landmark')}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="mt-3 text-xs font-semibold text-rose hover:underline"
                >
                  {t('common.edit')}
                </button>
              </div>

              <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
                <h3 className="mb-4 text-lg font-bold text-ink">{t('orders.orderItems')}</h3>
                <ul className="divide-y divide-black/5">
                  {items.map((item) => (
                    <li key={item.key} className="flex items-center gap-3 py-3">
                      <SmartImage
                        src={item.image}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="clamp-1 text-sm font-semibold text-ink">{localized(item, lang)}</p>
                        <p className="text-xs text-ink-muted">
                          {formatPrice(item.price, lang)} × {item.quantity}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-ink">
                        {formatPrice(item.price * item.quantity, lang)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Nav buttons */}
            <div className="flex flex-wrap gap-3">
              {step > 0 ? (
                <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} icon={Prev}>
                  {t('common.prev')}
                </Button>
              ) : null}
              <Button
                type="submit"
                loading={submitting}
                disabled={step === 1 && ((proofRequired && !paymentProof) || (referenceRequired && !String(watch('paymentReference') || '').trim()))}
                iconEnd={step < STEPS.length - 1 ? Next : undefined}
                className="flex-1 sm:flex-none"
              >
                {step < STEPS.length - 1 ? t('common.next') : t('checkout.placeOrder')}
              </Button>
            </div>
          </div>

          {/* Summary */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
              <h3 className="mb-5 text-lg font-bold text-ink">{t('cart.orderSummary')}</h3>

              <ul className="mb-5 max-h-64 space-y-3 overflow-y-auto">
                {items.map((item) => (
                  <li key={item.key} className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <SmartImage src={item.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                      <span className="absolute -end-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">
                        {item.quantity}
                      </span>
                    </div>
                    <p className="clamp-2 min-w-0 flex-1 text-xs text-ink-soft">{localized(item, lang)}</p>
                    <span className="shrink-0 text-xs font-bold text-ink">
                      {formatPrice(item.price * item.quantity, lang)}
                    </span>
                  </li>
                ))}
              </ul>

              <dl className="space-y-2.5 border-t border-black/5 pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">{t('cart.subtotal')}</dt>
                  <dd className="font-semibold">{formatPrice(subtotal, lang)}</dd>
                </div>
                {couponDiscount > 0 ? (
                  <div className="flex justify-between text-emerald-600">
                    <dt>{t('cart.discount')}</dt>
                    <dd className="font-semibold">− {formatPrice(couponDiscount, lang)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-ink-muted">{t('cart.shipping')}</dt>
                  <dd className="font-semibold">
                    {shippingCost === 0 ? <span className="text-emerald-600">{t('common.free')}</span> : formatPrice(shippingCost, lang)}
                  </dd>
                </div>
                {paymentFee > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">{t('checkout.paymentFee')}</dt>
                    <dd className="font-semibold">{formatPrice(paymentFee, lang)}</dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between border-t border-black/5 pt-3">
                  <dt className="text-base font-bold text-ink">{t('cart.total')}</dt>
                  <dd className="text-xl font-bold text-rose">{formatPrice(total, lang)}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </form>
      </div>
    </>
  );
}
