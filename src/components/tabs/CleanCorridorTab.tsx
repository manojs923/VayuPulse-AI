import React, { useState, useMemo } from 'react';
import {
  SectorId,
  TransitMode,
  URBAN_SECTORS,
  TRANSIT_MODE_PROFILES,
  dijkstraLowestExposure,
  dijkstraTimeDependent,
} from '../../lib/routing';
import { generate24HourMLForecast } from '../../lib/mlForecast';
import { MedicalNotice } from '../common/MedicalNotice';
import { useI18n } from '../../lib/i18n/I18nContext';
import {
  Navigation,
  Compass,
  Clock,
  ArrowRight,
  TrendingDown,
  Info,
} from 'lucide-react';

export const CleanCorridorTab: React.FC = () => {
  const { t } = useI18n();
  const [origin, setOrigin] = useState<SectorId>('RES');
  const [destination, setDestination] = useState<SectorId>('CBD');
  const [activeMode, setActiveMode] = useState<TransitMode>('METRO');
  const [departureHour, setDepartureHour] = useState<number>(8);

  // Generate 24h forecast to feed time-dependent routing
  const forecast = useMemo(() => {
    return generate24HourMLForecast(origin, [], departureHour, {
      hourOfDay: departureHour,
      groundTempC: 8.0,
      upperTempC: 11.5,
      windSpeedKmH: 3.5,
      relativeHumidity: 75,
    });
  }, [origin, departureHour]);

  // Concentrated sector values for selected departure hour
  const currentConcentrations = useMemo(() => {
    const firstPredicted = forecast.hours[0]?.predictedPM25 ?? 50.0;
    const scaleRatio = firstPredicted / 50.0;
    return {
      CBD: URBAN_SECTORS.CBD.defaultPM25 * scaleRatio,
      IND: URBAN_SECTORS.IND.defaultPM25 * scaleRatio,
      RES: URBAN_SECTORS.RES.defaultPM25 * scaleRatio,
      PRK: URBAN_SECTORS.PRK.defaultPM25 * scaleRatio,
      TRN: URBAN_SECTORS.TRN.defaultPM25 * scaleRatio,
    };
  }, [forecast]);

  // Selected route result aligned with current departure hour concentrations
  const routeResult = useMemo(() => {
    return dijkstraLowestExposure(origin, destination, activeMode, currentConcentrations);
  }, [origin, destination, activeMode, currentConcentrations]);

  // Modal comparison table across all 6 transit modes aligned with current departure hour
  const modalComparisons = useMemo(() => {
    const modes: TransitMode[] = [
      'METRO',
      'EV_HEPA',
      'ELECTRIC_BUS',
      'DIESEL_BUS',
      'CYCLING',
      'WALKING',
    ];
    return modes.map((m) => {
      const res = dijkstraLowestExposure(origin, destination, m, currentConcentrations);
      return {
        mode: m,
        profile: TRANSIT_MODE_PROFILES[m],
        durationMinutes: res.totalDurationMinutes,
        distanceKm: res.totalDistanceKm,
        doseMicrograms: res.totalInhaledDoseMicrograms,
      };
    });
  }, [origin, destination, currentConcentrations]);

  // Time-dependent departure optimization
  const timeDepResult = useMemo(() => {
    return dijkstraTimeDependent(origin, destination, activeMode, forecast, departureHour);
  }, [origin, destination, activeMode, forecast, departureHour]);

  return (
    <div className="space-y-6">
      <MedicalNotice />

      {/* Corridor Selector Card */}
      <div className="p-6 rounded-2xl atmospheric-card space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Navigation className="w-5 h-5 text-cyan-400" aria-hidden="true" />
            {t.corridorTab.title}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t.corridorTab.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          <div>
            <label htmlFor="origin-sector" className="text-xs font-mono text-slate-400 block mb-1">
              {t.corridorTab.origin}:
            </label>
            <select
              id="origin-sector"
              value={origin}
              onChange={(e) => setOrigin(e.target.value as SectorId)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="RES">Greenwood Residential (RES)</option>
              <option value="CBD">Central Business District (CBD)</option>
              <option value="IND">North Industrial Belt (IND)</option>
              <option value="PRK">Riverside Eco-Park (PRK)</option>
              <option value="TRN">Grand Transit Interchange (TRN)</option>
            </select>
          </div>

          <div>
            <label htmlFor="destination-sector" className="text-xs font-mono text-slate-400 block mb-1">
              {t.corridorTab.destination}:
            </label>
            <select
              id="destination-sector"
              value={destination}
              onChange={(e) => setDestination(e.target.value as SectorId)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="CBD">Central Business District (CBD)</option>
              <option value="RES">Greenwood Residential (RES)</option>
              <option value="IND">North Industrial Belt (IND)</option>
              <option value="PRK">Riverside Eco-Park (PRK)</option>
              <option value="TRN">Grand Transit Interchange (TRN)</option>
            </select>
          </div>

          <div>
            <label htmlFor="departure-hour" className="text-xs font-mono text-slate-400 block mb-1">
              {t.corridorTab.departureTime}:
            </label>
            <select
              id="departure-hour"
              value={departureHour}
              onChange={(e) => setDepartureHour(parseInt(e.target.value, 10))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, '0')}:00 {i >= 6 && i <= 9 ? '(Morning Peak)' : i >= 12 && i <= 15 ? '(Solar Breakup)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="preferred-mode" className="text-xs font-mono text-slate-400 block mb-1">
              Active Mode Focus:
            </label>
            <select
              id="preferred-mode"
              value={activeMode}
              onChange={(e) => setActiveMode(e.target.value as TransitMode)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="METRO">Underground Metro (75% Filt.)</option>
              <option value="EV_HEPA">EV / HEPA Cabin (85% Filt.)</option>
              <option value="ELECTRIC_BUS">Electric Bus (40% Filt.)</option>
              <option value="DIESEL_BUS">Diesel Bus (20% Filt.)</option>
              <option value="CYCLING">Active Cycling (0% Filt.)</option>
              <option value="WALKING">Pedestrian Walking (0% Filt.)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Best Departure Time Card */}
      <div className="p-5 rounded-2xl atmospheric-card border-cyan-800/40 bg-gradient-to-r from-slate-900 to-cyan-950/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base font-bold text-slate-100">
                Time-Dependent Transit Departure Window
              </h3>
            </div>
            <p className="text-xs text-cyan-200/90 mt-1 leading-relaxed">
              {timeDepResult.advice}
            </p>
          </div>

          {timeDepResult.doseReductionPercent > 0 && (
            <div className="shrink-0 px-4 py-2 rounded-xl bg-cyan-950 border border-cyan-800/80 text-right">
              <span className="text-[10px] font-mono uppercase text-cyan-400 block font-bold">
                Max Exposure Reduction
              </span>
              <span className="text-2xl font-black font-mono text-cyan-300 flex items-center gap-1 justify-end">
                <TrendingDown className="w-5 h-5 text-emerald-400" />
                {timeDepResult.doseReductionPercent}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Multi-Modal Dose Comparison Table */}
      <div className="p-6 rounded-2xl atmospheric-card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Compass className="w-5 h-5 text-cyan-400" aria-hidden="true" />
            Multi-Modal Inhaled Dose Exposure Comparison
          </h3>
          <span className="text-xs font-mono text-slate-400">
            Path: {URBAN_SECTORS[origin].name} ({origin}) → {URBAN_SECTORS[destination].name} ({destination})
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3">Transit Mode</th>
                <th className="p-3">Filtration</th>
                <th className="p-3">Avg Speed</th>
                <th className="p-3">Breathing Rate</th>
                <th className="p-3">Duration</th>
                <th className="p-3 text-right">Inhaled Dose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {modalComparisons.map((item) => {
                const isSelected = item.mode === activeMode;
                const isLowest = item.doseMicrograms === Math.min(...modalComparisons.map((m) => m.doseMicrograms));
                return (
                  <tr
                    key={item.mode}
                    onClick={() => setActiveMode(item.mode)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-cyan-950/40 text-cyan-200' : 'hover:bg-slate-900/60 text-slate-300'
                    }`}
                  >
                    <td className="p-3 font-semibold flex items-center gap-2">
                      {item.profile.name}
                      {isLowest && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/50 text-[10px] font-bold">
                          Lowest Dose
                        </span>
                      )}
                    </td>
                    <td className="p-3">{(item.profile.cabinFiltrationEfficiency * 100).toFixed(0)}%</td>
                    <td className="p-3">{item.profile.averageSpeedKmH} km/h</td>
                    <td className="p-3">{item.profile.breathingRateM3H} m³/h</td>
                    <td className="p-3">{item.durationMinutes} min</td>
                    <td className="p-3 text-right font-bold text-sm" style={{
                      color: isLowest ? '#34d399' : item.doseMicrograms > 15 ? '#f87171' : '#fcd34d'
                    }}>
                      {item.doseMicrograms} µg
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Route Breakdown & Path */}
      <div className="p-6 rounded-2xl atmospheric-card space-y-4">
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <ArrowRight className="w-5 h-5 text-cyan-400" />
          Selected Corridor Routing Breakdown ({TRANSIT_MODE_PROFILES[activeMode].name})
        </h3>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono p-3 rounded-xl bg-slate-950 border border-slate-800">
          <span className="text-slate-400">Optimal Path:</span>
          {routeResult.path.map((node, idx) => (
            <React.Fragment key={node}>
              <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-200 font-bold">
                {URBAN_SECTORS[node].name} ({node})
              </span>
              {idx < routeResult.path.length - 1 && (
                <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Segments Table */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 text-xs block font-mono">Total Corridor Distance</span>
            <span className="text-lg font-bold font-mono text-slate-200">{routeResult.totalDistanceKm} km</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 text-xs block font-mono">Transit Travel Time</span>
            <span className="text-lg font-bold font-mono text-slate-200">{routeResult.totalDurationMinutes} min</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 text-xs block font-mono">Cumulative Inhaled Dose</span>
            <span className="text-lg font-bold font-mono text-cyan-400">{routeResult.totalInhaledDoseMicrograms} µg</span>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <p>
            Inhaled dose is deterministic: <code className="text-cyan-300">Dose = Duration × C_PM2.5 × VentilationRate × (1 - Filtration)</code>.
            Underground Metro and HEPA cabins significantly reduce particulate penetration during winter boundary layer trapping episodes.
          </p>
        </div>
      </div>
    </div>
  );
};
