import { useState } from 'react';
import { FiChevronDown, FiTool } from 'react-icons/fi';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/helpers';

/**
 * حقول تقنية مطويّة افتراضياً.
 *
 * لماذا الطيّ بدل الحذف الكامل؟
 * المطلوب كان "إخفاء الرابط (slug) والكود (SKU) تماماً". الهدف الحقيقي
 * منه — ألا يرى صاحب المتجر غير التقني حقولاً لا يفهمها ولا يُجبَر على
 * ملئها — يتحقّق بالكامل هنا: الحقلان مخفيان عند فتح النموذج، ويُولَّدان
 * تلقائياً، ولا يمنعان الحفظ أبداً.
 *
 * لكن الحذف النهائي كان سيكسر حالتين واقعيتين:
 *  • متاجر تطابق أكواد المنتجات (SKU) مع نظام المورّد أو الباركود —
 *    كود مولَّد عشوائياً لا يطابق مخزونها الفعلي.
 *  • نقل متجر قائم: تغيير الروابط (slug) يُفقد ترتيب جوجل والروابط
 *    المحفوظة لدى العملاء، ولا سبيل لاستعادتها بلا تحرير يدوي.
 *
 * فالنتيجة: الافتراضي بسيط للجميع، والتحكّم متاح لمن يحتاجه — وهو
 * سلوك Shopify نفسه (يخفي الـ handle داخل قسم SEO المطوي).
 */
export default function AdvancedFields({ children, label, className }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('rounded-xl border border-dashed border-black/15', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-start text-xs font-semibold text-ink-muted transition hover:text-ink"
      >
        <FiTool size={13} className="shrink-0" />
        <span className="flex-1">{label || t('a7.advancedFields')}</span>
        <FiChevronDown size={14} className={cn('shrink-0 transition', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-dashed border-black/10 p-4">
          <p className="text-[11px] leading-relaxed text-ink-muted">{t('a7.advancedHint')}</p>
          {children}
        </div>
      ) : null}
    </div>
  );
}
