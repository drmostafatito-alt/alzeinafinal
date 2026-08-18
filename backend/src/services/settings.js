import { nowIso, parseJson, stringify } from '../lib/response.js';

const deepMerge = (base, override) => {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k,v] of Object.entries(override || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base?.[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) out[k] = deepMerge(base[k], v);
    else out[k] = v;
  }
  return out;
};

export const DEFAULT_SETTINGS = {
  siteName: 'Al Zeina', siteNameAr: 'الزينة', tagline: 'جمالك يبدأ من هنا', taglineEn: 'Where your beauty begins', logo: '', logoLight: '', favicon: '',
  theme: { primary:'#111111', accent:'#C89A8B', cream:'#FFF8F5', blush:'#F8E8EA', surface:'#FFFFFF', mode:'light', allowUserToggle:true, fontAr:'Cairo', fontEn:'Poppins', radius:'rounded', cardStyle:'classic', defaultLang:'ar' },
  contact: { email:'', supportEmail:'', phone:'', phone2:'', whatsapp:'', whatsappEnabled:true, whatsappMessage:'مرحباً، أحتاج مساعدة بخصوص', address:'', mapEmbed:'', businessHours:'السبت - الخميس: 10ص - 10م' },
  social: { facebook:'', instagram:'', twitter:'', tiktok:'', youtube:'', linkedin:'', snapchat:'', telegram:'' },
  shipping: { enabled:true, codEnabled:true, defaultCost:50, freeShippingEnabled:true, freeShippingThreshold:500, estimatedDaysMin:2, estimatedDaysMax:5, note:'' },
  locale: { timezone:'Africa/Cairo', defaultLanguage:'ar', languages:['ar','en'], allowLanguageSwitch:true, dateFormat:'dd/MM/yyyy', weekStart:'saturday', numberDecimals:2 },
  payment: { currency:'EGP', currencySymbol:'ج.م', currencySymbolEn:'EGP', currencyPosition:'after', taxEnabled:false, taxRate:0, taxIncluded:true, taxName:'ضريبة القيمة المضافة', taxNameEn:'VAT', taxNumber:'', paymobEnabled:false, stripeEnabled:false },
  seo: { metaTitle:'', metaDescription:'', keywords:'', ogImage:'', robots:'index,follow', canonicalBase:'' },
  analytics: { googleAnalyticsId:'', googleTagManagerId:'', metaPixelId:'', tiktokPixelId:'', snapPixelId:'', hotjarId:'', googleSiteVerification:'' },
  features: { wishlist:true, reviews:true, reviewsRequirePurchase:false, reviewsAutoApprove:true, guestCheckout:true, newsletter:true, testimonials:true, instagramFeed:true, popups:true, compareProducts:false, lowStockThreshold:5, maintenanceMode:false, maintenanceMessage:'الموقع تحت الصيانة، نعود قريباً' },
  maintenance: { enabled:false, title:'الموقع تحت الصيانة', titleEn:'We are under maintenance', message:'نجري بعض التحسينات لخدمتك بشكل أفضل.', messageEn:'We are making improvements to serve you better.', backgroundImage:'', logo:'', countdownTo:'', showCountdown:false, showSocial:true, contactEmail:'', allowAdminBypass:true },
  announcement: { enabled:false, text:'', textEn:'', link:'', linkLabel:'', bgColor:'', textColor:'', dismissible:true, items:[], rotateSeconds:5 },
  topBar: { enabled:true, items:[], showPhone:true, showTrackOrder:true },
  featuresStrip: { enabled:true, items:[] },
  search: { placeholderAr:'ابحثي عن منتج…', placeholderEn:'Search for products…', popularAr:['سيروم فيتامين سي','ماسكارا','واقي شمس','زيت الأرجان','كريم مرطب'], popularEn:['Vitamin C serum','Mascara','Sunscreen','Argan oil','Moisturiser'] },
  navigation: { items:[] },
  header: { logoPosition:'left', showSearch:true, showWishlist:true, showCart:true, showLanguageSwitch:true, showTopBar:true, sticky:true, navHeight:56, bgColor:'', textColor:'' },
  loginPage: { logo:'', background:'', welcomeTitle:'', welcomeSubtitle:'', overlayColor:'#111111', overlayOpacity:45, cardBg:'', buttonBg:'', slideshow:[], showLogo:true, showWelcome:true, darkVersion:false, glassEffect:false },
  footer: { about:'', copyright:'', paymentIcons:['VISA','MASTERCARD','MEEZA','COD'] },
  returns: { enabled:true, windowDays:14, requireDelivered:true, autoApprove:false, autoRestock:true, refundShipping:false, excludedCategories:[], excludedProducts:[], excludeDiscounted:false, requireImages:false, policyText:'', refundPolicyText:'', refundProcessingDays:'5-10' },
  invoice: { prefix:'INV', companyName:'', taxNumber:'', commercialRegister:'', companyAddress:'', companyPhone:'', companyEmail:'', logo:'', accentColor:'', footerNote:'شكراً لتعاملكم معنا', footerNoteEn:'Thank you for your business', showQrCode:true, qrContent:'order-url', showTax:true, showPaymentInfo:true, showShippingInfo:true, customerDownload:true },
  support: { enabled:true, ticketsFromContact:true, guestTickets:true, autoCloseAfterDays:14, autoReply:true, autoReplyMessage:'شكراً لتواصلك معنا، سيقوم فريق الدعم بالرد خلال 24 ساعة.', categories:['general','order','payment','shipping','return','product','complaint','suggestion'] },
  notifications: { emailOnNewOrder:true, emailOnNewMessage:true, adminEmails:[], orderEmailToCustomer:true, emailOnNewTicket:true, emailOnNewReturn:true, smsEnabled:false, whatsappEnabled:false },
  permissions: {}, branding: { adminPanelName:'AL-ZEINA Admin', pwaName:'AL-ZEINA', pwaShortName:'AL-ZEINA', pwaDescription:'Beauty and care store', pwaThemeColor:'#111111', pwaBackgroundColor:'#ffffff', showPoweredBy:false },
  plugins: { loyalty:false, blog:false, affiliate:false, marketplace:false, giftCards:false, pos:false, crm:false, erp:false },
  multiStore: { enabled:false, storeId:'default', sharedCatalog:true, sharedCustomers:true }, translationOverrides: {}, backupSchedule: { enabled:false, frequency:'weekly', scope:'settings' }, versionNotes: [], flags: { wishlist:true, compareProducts:true, reviews:true, recentlyViewed:true, announcementBar:true, newsletter:true, coupons:true, liveSearch:true, productZoom:true, productBadges:true, quickView:true, homepageSections:true, guestCheckout:true, registration:true, inventoryTracking:true, inventoryAlerts:true, taxes:true, shippingModule:true, analyticsWidgets:true, notifications:true, activityDashboard:true, auditLogs:true, themePresets:true, backupCenter:true, pageBuilder:true, errorCenter:true, systemHealth:true, mediaLibrary:true }
};

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

export async function getSettings(env, fresh = false) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const stored = {};
  for (const r of results || []) stored[r.key] = parseJson(r.value, r.value);
  return deepMerge(DEFAULT_SETTINGS, stored);
}

export async function updateSettings(env, payload = {}) {
  const current = await getSettings(env, true);
  const wantsMaintenance = payload.maintenance?.enabled !== undefined ? Boolean(payload.maintenance.enabled) : payload.features?.maintenanceMode !== undefined ? Boolean(payload.features.maintenanceMode) : undefined;
  if (wantsMaintenance !== undefined) {
    payload = { ...payload, maintenance: { ...(payload.maintenance||{}), enabled:wantsMaintenance }, features: { ...(payload.features||{}), maintenanceMode:wantsMaintenance } };
  }
  const ts = nowIso();
  const stmts = [];
  for (const [key,value] of Object.entries(payload)) {
    if (value === undefined) continue;
    const merged = isObj(value) && isObj(current[key]) ? deepMerge(current[key], value) : value;
    const groupMap = { theme:'theme', topBar:'theme', featuresStrip:'theme', navigation:'theme', header:'theme', loginPage:'theme', contact:'contact', social:'social', shipping:'shipping', payment:'payment', seo:'seo', analytics:'analytics', features:'features' };
    stmts.push(env.DB.prepare(`INSERT INTO settings(key,value,groupName,updatedAt) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, groupName=excluded.groupName, updatedAt=excluded.updatedAt`).bind(key, stringify(merged), groupMap[key] || 'general', ts));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return getSettings(env, true);
}

export function publicSettings(s) {
  return {
    ...Object.fromEntries(['siteName','siteNameAr','tagline','taglineEn','logo','logoLight','favicon','theme','topBar','featuresStrip','navigation','search','header','loginPage','contact','social','locale','flags','branding','seo','analytics','features','footer','announcement','returns','support','invoice','translationOverrides'].map(k => [k, s[k]])),
    shipping: { enabled:s.shipping.enabled, codEnabled:s.shipping.codEnabled, defaultCost:s.shipping.defaultCost, freeShippingEnabled:s.shipping.freeShippingEnabled, freeShippingThreshold:s.shipping.freeShippingThreshold, estimatedDaysMin:s.shipping.estimatedDaysMin, estimatedDaysMax:s.shipping.estimatedDaysMax, note:s.shipping.note },
    payment: { currency:s.payment.currency, currencySymbol:s.payment.currencySymbol, currencySymbolEn:s.payment.currencySymbolEn, currencyPosition:s.payment.currencyPosition, taxEnabled:s.payment.taxEnabled, taxRate:s.payment.taxRate, taxIncluded:s.payment.taxIncluded, taxName:s.payment.taxName, taxNameEn:s.payment.taxNameEn, taxNumber:s.payment.taxNumber, paymobEnabled:s.payment.paymobEnabled, stripeEnabled:s.payment.stripeEnabled },
    maintenance: { enabled:Boolean(s.maintenance?.enabled), title:s.maintenance?.title, titleEn:s.maintenance?.titleEn, message:s.maintenance?.message || s.features?.maintenanceMessage, messageEn:s.maintenance?.messageEn, backgroundImage:s.maintenance?.backgroundImage, logo:s.maintenance?.logo, countdownTo:s.maintenance?.countdownTo, showCountdown:s.maintenance?.showCountdown, showSocial:s.maintenance?.showSocial, contactEmail:s.maintenance?.contactEmail }
  };
}

export async function resetTheme(env) { await updateSettings(env, { theme: JSON.parse(JSON.stringify(DEFAULT_SETTINGS.theme)) }); return getSettings(env, true); }
