import { Component } from 'react';
import { FiAlertTriangle, FiHome, FiRefreshCw } from 'react-icons/fi';

/**
 * حدود الأخطاء — آخر خط دفاع في الواجهة.
 *
 * ملاحظتان مهمتان:
 * 1) لا نعرض رسالة الخطأ الخام للمستخدم في الإنتاج، فقد تكشف مسارات
 *    ملفات أو تفاصيل داخلية. نعرضها في وضع التطوير فقط.
 * 2) نوفّر مخرجاً واضحاً (إعادة المحاولة / الرئيسية) بدل ترك المستخدم
 *    أمام شاشة معطّلة.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[Al Zeina] UI error:', error, info);
  }

  handleRetry = () => {
    // نحاول استئناف العرض أولاً، وإن تكرر الخطأ يعيد المستخدم التحميل
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDev = import.meta.env.DEV;

    return (
      <div
        role="alert"
        className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-16 text-center"
      >
        <div className="relative mb-6">
          <span
            aria-hidden="true"
            className="absolute inset-0 -z-10 rounded-full bg-red-500/10 blur-2xl"
          />
          <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-red-50 to-blush text-red-500 ring-1 ring-red-500/10">
            <FiAlertTriangle size={32} aria-hidden="true" />
          </div>
        </div>

        <h2 className="mb-2 text-xl font-bold text-ink md:text-2xl">حدث خطأ غير متوقع</h2>
        <p className="mb-1 text-sm text-ink-muted" dir="ltr">
          Something went wrong
        </p>
        <p className="mb-7 max-w-sm text-sm leading-relaxed text-ink-muted">
          نعتذر عن ذلك. جرّبي إعادة المحاولة، وإن استمرت المشكلة عودي للصفحة الرئيسية.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={this.handleRetry} className="btn-primary">
            <FiRefreshCw size={16} aria-hidden="true" />
            إعادة المحاولة
          </button>
          <button type="button" onClick={() => window.location.reload()} className="btn-outline">
            تحديث الصفحة
          </button>
          <a href="/" className="btn-ghost">
            <FiHome size={16} aria-hidden="true" />
            الرئيسية
          </a>
        </div>

        {/* تفاصيل تقنية للمطوّر فقط — لا تظهر أبداً في الإنتاج */}
        {isDev && this.state.error ? (
          <details className="mt-8 w-full max-w-xl text-start">
            <summary className="cursor-pointer text-xs font-semibold text-ink-muted">
              تفاصيل تقنية (وضع التطوير)
            </summary>
            <pre
              dir="ltr"
              className="mt-2 overflow-auto rounded-xl bg-ink/5 p-4 text-left text-[11px] leading-relaxed text-ink-soft"
            >
              {this.state.error?.stack || this.state.error?.message}
            </pre>
          </details>
        ) : null}
      </div>
    );
  }
}
