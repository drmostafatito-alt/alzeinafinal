import {
  FiCreditCard, FiDollarSign, FiSmartphone, FiTruck, FiZap
} from 'react-icons/fi';

/**
 * أيقونات وسائل الدفع — من نظام react-icons الموجود حصراً
 * (لا صور خارجية ولا روابط غير موثوقة)، وأحجامها موحّدة.
 * أي طريقة غير معروفة ترجع FiCreditCard.
 */
export const PAYMENT_ICONS = {
  cod: FiDollarSign,
  card: FiCreditCard,
  wallet: FiSmartphone,
  bank: FiCreditCard,
  instapay: FiZap,
  aani: FiZap,
  'vodafone-cash': FiSmartphone,
  'etisalat-cash': FiSmartphone,
  'orange-cash': FiSmartphone,
  meeza: FiCreditCard,
};

/** أيقونة يختارها المدير من لوحة الإدارة (config.icon) إن وُجدت */
const NAMED_ICONS = {
  zap: FiZap,
  phone: FiSmartphone,
  card: FiCreditCard,
  cash: FiDollarSign,
  truck: FiTruck,
  wallet: FiSmartphone,
};

export function paymentIcon(code, configuredIcon) {
  if (configuredIcon && NAMED_ICONS[configuredIcon]) return NAMED_ICONS[configuredIcon];
  return PAYMENT_ICONS[code] || FiCreditCard;
}

/** وسم نوعي مختصر للطرق اليدوية مقابل COD */
export const isManualPayment = (method) =>
  Boolean(method) && String(method.code).toLowerCase() !== 'cod';
