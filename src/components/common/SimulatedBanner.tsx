import React from 'react';
import { Activity, Radio } from 'lucide-react';

interface SimulatedBannerProps {
  isSimulated?: boolean;
  sourceName?: string;
}

export const SimulatedBanner: React.FC<SimulatedBannerProps> = ({
  isSimulated = true,
  sourceName = 'Physics-Based Simulated Environmental Telemetry',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full py-1.5 px-4 text-xs font-mono flex items-center justify-between border-b transition-colors ${
        isSimulated
          ? 'bg-amber-950/40 text-amber-300 border-amber-800/50'
          : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50'
      }`}
    >
      <div className="flex items-center gap-2">
        {isSimulated ? (
          <Activity className="w-3.5 h-3.5 text-amber-400 animate-pulse" aria-hidden="true" />
        ) : (
          <Radio className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
        )}
        <span>
          <strong className="uppercase font-semibold">
            {isSimulated ? 'Simulated Data' : 'Live Sensor Feed Active'}
          </strong>
          : {sourceName}
        </span>
      </div>
      <span className="hidden sm:inline-block text-[11px] opacity-80">
        Inversion proxy model • Ridge+HW 24h Forecaster
      </span>
    </div>
  );
};
