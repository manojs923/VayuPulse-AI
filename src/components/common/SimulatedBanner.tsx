import React from 'react';
import { Activity, Radio, AlertTriangle } from 'lucide-react';
import { useI18n } from '../../lib/i18n/I18nContext';

export interface SimulatedBannerProps {
  isSimulated?: boolean;
  sourceLabel?: string;
  asOf?: string;
  fallbackReason?: string;
}

export const SimulatedBanner: React.FC<SimulatedBannerProps> = ({
  isSimulated = true,
  sourceLabel = 'Physics-Based Simulated Environmental Telemetry',
  asOf,
  fallbackReason,
}) => {
  const { t } = useI18n();
  const isStale = !isSimulated && !!fallbackReason;
  const displaySource =
    sourceLabel === 'Physics-Based Simulated Environmental Telemetry'
      ? t.simulatedBanner.simulatedPhysics
      : sourceLabel;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full py-1.5 px-4 text-xs font-mono flex items-center justify-between border-b transition-colors ${
        isSimulated
          ? 'bg-amber-950/40 text-amber-300 border-amber-800/50'
          : isStale
          ? 'bg-amber-950/60 text-amber-200 border-amber-700/60'
          : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50'
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {isSimulated ? (
          <Activity className="w-3.5 h-3.5 text-amber-400 animate-pulse" aria-hidden="true" />
        ) : isStale ? (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
        ) : (
          <Radio className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
        )}
        <span>
          <strong className="uppercase font-semibold">
            {isSimulated ? t.simulatedBanner.simulatedData : isStale ? t.simulatedBanner.liveStale : t.simulatedBanner.live}
          </strong>
          :{' '}
          {isSimulated ? (
            <>
              {displaySource}
              {fallbackReason && (
                <span className="opacity-90 ml-1.5">({fallbackReason})</span>
              )}
            </>
          ) : (
            <>
              {displaySource}
              {asOf && (
                <span className="opacity-90 ml-1.5">
                  (as of {new Date(asOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                </span>
              )}
              {isStale && (
                <span className="text-amber-300 font-bold ml-1.5">— {fallbackReason}</span>
              )}
            </>
          )}
        </span>
      </div>
      <span className="hidden sm:inline-block text-[11px] opacity-80 shrink-0">
        Inversion proxy model • Ridge+HW 24h Forecaster
      </span>
    </div>
  );
};
