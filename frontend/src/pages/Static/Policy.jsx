import { useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import PageHeader from '@/components/common/PageHeader';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/helpers';

const CONTENT = {
  shipping: {
    ar: {
      title: 'سياسة الشحن',
      sections: [
        ['مدة التوصيل', 'القاهرة والجيزة: 1-2 يوم عمل.\nباقي المحافظات: 2-5 أيام عمل.\nالمناطق النائية: حتى 7 أيام عمل.'],
        ['تكلفة الشحن', 'تبدأ من 40 ج.م حسب المحافظة. الشحن مجاني تماماً للطلبات التي تتجاوز 500 ج.م.'],
        ['تتبع الشحنة', 'يصلك رقم تتبع عبر رسالة نصية وبريد إلكتروني فور خروج الطلب من المخزن، ويمكنك متابعته من صفحة "طلباتي".'],
        ['محاولات التسليم', 'يقوم المندوب بثلاث محاولات للتسليم. في حال تعذر الوصول إليك يُعاد الطلب إلى المخزن ويتم التواصل معك.'],
      ],
    },
    en: {
      title: 'Shipping Policy',
      sections: [
        ['Delivery time', 'Cairo & Giza: 1-2 business days.\nOther governorates: 2-5 business days.\nRemote areas: up to 7 business days.'],
        ['Shipping cost', 'Starts at 40 EGP depending on the governorate. Shipping is completely free for orders above 500 EGP.'],
        ['Tracking', 'A tracking number is sent by SMS and email as soon as your order leaves the warehouse. You can follow it from "My Orders".'],
        ['Delivery attempts', 'The courier makes three delivery attempts. If we cannot reach you, the order returns to the warehouse and we contact you.'],
      ],
    },
  },
  returns: {
    ar: {
      title: 'سياسة الاسترجاع',
      sections: [
        ['مدة الاسترجاع', 'يمكنك طلب الإرجاع خلال 14 يوماً من تاريخ الاستلام، بشرط أن يكون المنتج بحالته الأصلية وغير مفتوح.'],
        ['المنتجات غير القابلة للإرجاع', 'لأسباب صحية، لا يمكن إرجاع منتجات المكياج المفتوحة، أو المنتجات المستخدمة، أو العروض النهائية.'],
        ['كيفية طلب الإرجاع', 'تواصل معنا عبر صفحة "تواصل معنا" أو الواتساب مع ذكر رقم الطلب وسبب الإرجاع، وسنرتب استلام المنتج.'],
        ['استرداد المبلغ', 'يتم رد المبلغ خلال 5-10 أيام عمل بعد فحص المنتج، بنفس طريقة الدفع الأصلية أو كرصيد في المتجر.'],
      ],
    },
    en: {
      title: 'Returns Policy',
      sections: [
        ['Return window', 'You may request a return within 14 days of receipt, provided the product is in its original, unopened condition.'],
        ['Non-returnable items', 'For hygiene reasons, opened makeup, used products and final-sale items cannot be returned.'],
        ['How to request', 'Contact us via the Contact page or WhatsApp with your order number and reason, and we will arrange a pickup.'],
        ['Refunds', 'Refunds are processed within 5-10 business days after inspection, to the original payment method or as store credit.'],
      ],
    },
  },
  privacy: {
    ar: {
      title: 'سياسة الخصوصية',
      sections: [
        ['البيانات التي نجمعها', 'الاسم، البريد الإلكتروني، رقم الهاتف، وعنوان الشحن — وهي البيانات الضرورية فقط لتنفيذ طلبك.'],
        ['كيف نستخدم بياناتك', 'لمعالجة الطلبات، التواصل معك بخصوص طلبك، وتحسين تجربتك في المتجر. لا نبيع بياناتك لأي طرف ثالث.'],
        ['ملفات تعريف الارتباط', 'نستخدم الكوكيز لحفظ سلة التسوق وتفضيلات اللغة وتحسين الأداء. يمكنك تعطيلها من إعدادات المتصفح.'],
        ['أمان البيانات', 'جميع البيانات مشفّرة أثناء النقل عبر HTTPS، وبيانات الدفع تُعالج عبر بوابات دفع معتمدة ولا تُخزَّن لدينا.'],
        ['حقوقك', 'يمكنك طلب الاطلاع على بياناتك أو تعديلها أو حذفها في أي وقت بالتواصل معنا.'],
      ],
    },
    en: {
      title: 'Privacy Policy',
      sections: [
        ['Data we collect', 'Name, email, phone number and shipping address — only what is necessary to fulfil your order.'],
        ['How we use it', 'To process orders, contact you about them and improve your experience. We never sell your data to third parties.'],
        ['Cookies', 'We use cookies to keep your cart, language preference and improve performance. You can disable them in your browser.'],
        ['Security', 'All data is encrypted in transit via HTTPS, and payment data is handled by certified gateways — we never store it.'],
        ['Your rights', 'You can request access to, correction of, or deletion of your data at any time by contacting us.'],
      ],
    },
  },
  terms: {
    ar: {
      title: 'الشروط والأحكام',
      sections: [
        ['قبول الشروط', 'باستخدامك لموقع الزينة فإنك توافق على هذه الشروط. إذا لم توافق عليها يُرجى عدم استخدام الموقع.'],
        ['الحساب', 'أنت مسؤول عن الحفاظ على سرية بيانات حسابك وعن كل النشاط الذي يتم من خلاله.'],
        ['الأسعار والتوافر', 'جميع الأسعار بالجنيه المصري وشاملة الضريبة. نحتفظ بحق تعديل الأسعار أو إيقاف أي منتج دون إشعار مسبق.'],
        ['الطلبات', 'نحتفظ بحق رفض أو إلغاء أي طلب في حالات مثل خطأ في السعر، نفاد المخزون، أو الاشتباه في الاحتيال.'],
        ['الملكية الفكرية', 'كل المحتوى والصور والشعارات في هذا الموقع مملوكة لـ Al Zeina ولا يجوز استخدامها دون إذن كتابي.'],
      ],
    },
    en: {
      title: 'Terms & Conditions',
      sections: [
        ['Acceptance', 'By using the Al Zeina website you agree to these terms. If you do not agree, please do not use the site.'],
        ['Your account', 'You are responsible for keeping your account credentials confidential and for all activity under your account.'],
        ['Prices & availability', 'All prices are in EGP and include tax. We may change prices or discontinue products without prior notice.'],
        ['Orders', 'We reserve the right to refuse or cancel any order in cases such as pricing errors, stock issues or suspected fraud.'],
        ['Intellectual property', 'All content, images and logos on this site belong to Al Zeina and may not be used without written permission.'],
      ],
    },
  },
  faq: {
    ar: {
      title: 'الأسئلة الشائعة',
      sections: [
        ['هل المنتجات أصلية؟', 'نعم، 100%. نتعامل مع الوكلاء المعتمدين فقط، وكل منتج يأتي بضمان الأصالة.'],
        ['كم تستغرق مدة التوصيل؟', 'من 1-2 يوم في القاهرة والجيزة، ومن 2-5 أيام لباقي المحافظات.'],
        ['هل يمكنني الدفع عند الاستلام؟', 'نعم، الدفع عند الاستلام متاح لجميع المحافظات، بالإضافة إلى الدفع بالبطاقة والمحفظة الإلكترونية.'],
        ['كيف أستخدم كود الخصم؟', 'أدخلي الكود في خانة "كود الخصم" في صفحة السلة أو الدفع، وسيُطبَّق الخصم تلقائياً على الإجمالي.'],
        ['هل يمكنني تعديل طلبي بعد تأكيده؟', 'يمكنك التعديل أو الإلغاء طالما لم يتم شحن الطلب. تواصل معنا فوراً على الواتساب.'],
        ['هل تشحنون خارج مصر؟', 'حالياً نشحن داخل مصر فقط، ونعمل على توسيع نطاق الشحن قريباً.'],
      ],
    },
    en: {
      title: 'Frequently Asked Questions',
      sections: [
        ['Are the products authentic?', 'Yes, 100%. We work only with authorized distributors and every product carries an authenticity guarantee.'],
        ['How long does delivery take?', '1-2 days in Cairo and Giza, and 2-5 days for other governorates.'],
        ['Can I pay on delivery?', 'Yes, cash on delivery is available nationwide, along with card and e-wallet payments.'],
        ['How do I use a coupon code?', 'Enter it in the "Coupon code" field on the cart or checkout page and the discount applies automatically.'],
        ['Can I edit my order after confirming?', 'You can edit or cancel as long as the order has not shipped. Contact us right away on WhatsApp.'],
        ['Do you ship outside Egypt?', 'Currently we ship within Egypt only, and we are working on expanding soon.'],
      ],
    },
  },
};

export default function Policy({ type = 'privacy' }) {
  const { lang } = useI18n();
  const data = CONTENT[type]?.[lang] || CONTENT.privacy[lang];
  const [open, setOpen] = useState(type === 'faq' ? 0 : -1);

  const isAccordion = type === 'faq';

  return (
    <>
      <PageHeader title={data.title} breadcrumbs={[{ label: data.title }]} />

      <div className="container-x py-8">
        <div className="mx-auto max-w-3xl space-y-3">
          {data.sections.map(([heading, body], i) =>
            isAccordion ? (
              <div key={heading} className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
                <button
                  type="button"
                  onClick={() => setOpen(open === i ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-start"
                >
                  <span className="text-sm font-bold text-ink">{heading}</span>
                  <FiChevronDown
                    size={18}
                    className={cn('shrink-0 text-rose transition-transform', open === i && 'rotate-180')}
                  />
                </button>
                {open === i ? (
                  <p className="whitespace-pre-line border-t border-black/5 p-5 text-sm leading-loose text-ink-soft">
                    {body}
                  </p>
                ) : null}
              </div>
            ) : (
              <section key={heading} className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
                <h2 className="mb-3 text-base font-bold text-ink">
                  <span className="font-en me-2 text-rose">{String(i + 1).padStart(2, '0')}</span>
                  {heading}
                </h2>
                <p className="whitespace-pre-line text-sm leading-loose text-ink-soft">{body}</p>
              </section>
            )
          )}
        </div>
      </div>
    </>
  );
}
