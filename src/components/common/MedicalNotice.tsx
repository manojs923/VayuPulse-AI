import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useI18n } from '../../lib/i18n/I18nContext';

interface MedicalNoticeProps {
  className?: string;
}

export const MedicalNotice: React.FC<MedicalNoticeProps> = ({ className = '' }) => {
  const { t } = useI18n();

  return (
    <div
      role="note"
      aria-label="Medical disclaimer"
      className={`rounded-lg border border-cyan-800/40 bg-cyan-950/20 px-3.5 py-2.5 text-xs text-cyan-200/90 flex items-start gap-2.5 ${className}`}
    >
      <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" aria-hidden="true" />
      <div>
        <strong className="font-semibold text-cyan-300">{t.medicalNotice.title}</strong>
        <p className="mt-0.5 text-cyan-200/70 text-[11px] leading-relaxed">
          {t.medicalNotice.description}
        </p>
      </div>
    </div>
  );
};
