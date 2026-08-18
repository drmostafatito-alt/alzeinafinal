import { useState } from 'react';
import { FiInfo, FiX } from 'react-icons/fi';
import { useI18n } from '@/i18n';
import { useUIStore } from '@/store/uiStore';

export default function DemoBanner() {
  const { t } = useI18n();
  const isDemo = useUIStore((s) => s.isDemoMode);
  const [dismissed, setDismissed] = useState(false);

  if (!isDemo || dismissed) return null;

  return (
    <div className="bg-amber-50 text-amber-900">
      <div className="container-x flex items-center justify-center gap-2 py-1.5 text-[11px] font-medium">
        <FiInfo size={13} className="shrink-0" />
        <span>{t('common.demoMode')}</span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="ms-2 rounded p-0.5 transition hover:bg-amber-100"
          aria-label="dismiss"
        >
          <FiX size={13} />
        </button>
      </div>
    </div>
  );
}
