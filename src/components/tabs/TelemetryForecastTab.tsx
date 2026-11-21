import React, { useState, useMemo } from 'react';
import {
  calculatePM25SubIndex,
  evaluateInversionRisk,
} from '../../lib/aqiCompute';
import {
  generate24HourMLForecast,
  explainCounterfactual,
  WeatherFeatures,
} from '../../lib/mlForecast';
import { runRollingOriginBacktest } from '../../lib/mlEval';
import { fuseSensorStream } from '../../lib/sensorFusion';
import { URBAN_SECTORS, SectorId } from '../../lib/routing';
import { MedicalNotice } from '../common/MedicalNotice';
import {
  CloudFog,
  Thermometer,
  TrendingUp,
  Activity,
  Sliders,
  Sparkles,
  Layers,
  AlertTriangle,
} from 'lucide-react';

export const TelemetryForecastTab: React.FC = () => {
  const [selectedSector, setSelectedSector] = useState<SectorId>('CBD');
  const [windSlider, setWindSlider] = useState<number>(3.5);
  const [upperTempDelta, setUpperTempDelta] = useState<number>(3.5);
  const [trafficSlider, setTrafficSlider] = useState<number>(0.85);

  // Simulation mode
  const [activeScenario, setActiveScenario] = useState<'NORMAL' | 'NOCTURNAL_SPIKE' | 'SOLAR_BREAKUP' | 'SENSOR_STREAM'>('NORMAL');

  // Sector base conditions
  const currentSectorData = useMemo(() => {
    let groundTemp = 8.0;
    let upperTemp = groundTemp + upperTempDelta;
    let wind = windSlider;
    let basePM25 = URBAN_SECTORS[selectedSector].defaultPM25;

    if (activeScenario === 'NOCTURNAL_SPIKE') {
      groundTemp = 3.0;
      upperTemp = 10.5; // +7.5 Delta T (extreme thermal lid)
      wind = 1.2; // severe stagnation
      basePM25 = basePM25 * 1.8;
    } else if (activeScenario === 'SOLAR_BREAKUP') {
      groundTemp = 16.0;
      upperTemp = 13.0; // Negative Delta T (convective dispersion)
      wind = 14.0;
      basePM25 = Math.max(12, basePM25 * 0.4);
    }

    const aqiRes = calculatePM25SubIndex(basePM25);
    const inversionRes = evaluateInversionRisk(groundTemp, upperTemp, wind);

    const history7h = [
      Math.max(10, Math.round(basePM25 * 0.75)),
      Math.max(12, Math.round(basePM25 * 0.82)),
      Math.max(15, Math.round(basePM25 * 0.90)),
      Math.max(18, Math.round(basePM25 * 0.95)),
      Math.max(20, Math.round(basePM25 * 1.05)),
      Math.max(22, Math.round(basePM25 * 1.12)),
      Math.round(basePM25),
    ];

    return {
      sectorId: selectedSector,
      name: URBAN_SECTORS[selectedSector].name,
      pm25: Math.round(basePM25 * 10) / 10,
      aqi: aqiRes.aqi,
      category: aqiRes.category,
      color: aqiRes.color,
      advisory: aqiRes.healthAdvisory,
      isCapped: aqiRes.isCapped,
      groundTempC: groundTemp,
      upperTempC: upperTemp,
      windSpeedKmH: wind,
      inversion: inversionRes,
      history7h,
    };
  }, [selectedSector, windSlider, upperTempDelta, activeScenario]);

  // ML Forecast
  const mlForecast = useMemo(() => {
    const features: WeatherFeatures = {
      hourOfDay: 8,
      groundTempC: currentSectorData.groundTempC,
      upperTempC: currentSectorData.upperTempC,
      windSpeedKmH: currentSectorData.windSpeedKmH,
      relativeHumidity: 75,
      trafficIndex: trafficSlider,
    };
    return generate24HourMLForecast(selectedSector, currentSectorData.history7h, 8, features);
  }, [selectedSector, currentSectorData, trafficSlider]);

  // Counterfactual API evaluation
  const counterfactual = useMemo(() => {
    const baseF: WeatherFeatures = {
      hourOfDay: 8,
      groundTempC: currentSectorData.groundTempC,
      upperTempC: currentSectorData.upperTempC,
      windSpeedKmH: currentSectorData.windSpeedKmH,
      relativeHumidity: 75,
      trafficIndex: trafficSlider,
    };
    return explainCounterfactual(baseF, { windSpeedKmH: windSlider + 5.0 });
  }, [currentSectorData, trafficSlider, windSlider]);

  // Model Evaluation backtesting metrics
  const evalMetrics = useMemo(() => {
    // Generate synthetic historical sequence for backtesting panel
    const sampleSeries: number[] = [];
    for (let i = 0; i < 96; i++) {
      const diurnal = 55 + 28 * Math.sin(((i % 24) / 24) * 2 * Math.PI - Math.PI / 2);
      sampleSeries.push(Math.round(diurnal * 10) / 10);
    }
    return runRollingOriginBacktest(sampleSeries, 48, 24, 'simulated');
  }, []);

  // Sensor Fusion Live Stream Mode
  const sensorStreamData = useMemo(() => {
    const raw = [
      42, 44, 43, 45, 47, 46, 48, 142, 49, 48, 50, 52, 53, 53, 53, 53, 53, 54, 52, 50,
    ];
    return fuseSensorStream(raw);
  }, []);

  // Compute SVG coordinates for 24h confidence band
  const svgWidth = 560;
  const svgHeight = 160;
  const maxPM25Scale = 160;

  const pointsPredicted = mlForecast.hours.map((h, i) => {
    const x = (i / (mlForecast.hours.length - 1)) * (svgWidth - 40) + 20;
    const y = svgHeight - (Math.min(h.predictedPM25, maxPM25Scale) / maxPM25Scale) * (svgHeight - 30) - 15;
    return `${x},${y}`;
  }).join(' ');

  const areaConfidence = useMemo(() => {
    const topPoints = mlForecast.hours.map((h, i) => {
      const x = (i / (mlForecast.hours.length - 1)) * (svgWidth - 40) + 20;
      const y = svgHeight - (Math.min(h.upperBoundPM25, maxPM25Scale) / maxPM25Scale) * (svgHeight - 30) - 15;
      return `${x},${y}`;
    });
    const bottomPoints = [...mlForecast.hours].reverse().map((h, i) => {
      const origIdx = mlForecast.hours.length - 1 - i;
      const x = (origIdx / (mlForecast.hours.length - 1)) * (svgWidth - 40) + 20;
      const y = svgHeight - (Math.min(h.lowerBoundPM25, maxPM25Scale) / maxPM25Scale) * (svgHeight - 30) - 15;
      return `${x},${y}`;
    });
    return `${topPoints.join(' ')} ${bottomPoints.join(' ')}`;
  }, [mlForecast.hours]);

  return (
    <div className="space-y-6">
      <MedicalNotice />

      {/* Scenario Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl atmospheric-card">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Atmospheric Simulators:
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveScenario('NORMAL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeScenario === 'NORMAL'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-semibold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Baseline Normal
          </button>
          <button
            type="button"
            onClick={() => setActiveScenario('NOCTURNAL_SPIKE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeScenario === 'NOCTURNAL_SPIKE'
                ? 'bg-rose-500 text-slate-950 shadow-md font-semibold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Simulate Nocturnal Inversion Spike
          </button>
          <button
            type="button"
            onClick={() => setActiveScenario('SOLAR_BREAKUP')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeScenario === 'SOLAR_BREAKUP'
                ? 'bg-amber-400 text-slate-950 shadow-md font-semibold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Simulate Afternoon Solar Breakup
          </button>
          <button
            type="button"
            onClick={() => setActiveScenario('SENSOR_STREAM')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeScenario === 'SENSOR_STREAM'
                ? 'bg-purple-500 text-white shadow-md font-semibold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Live Sensor Stream Mode
          </button>
        </div>
      </div>

      {/* Sector Grid / Heatmap & Primary Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 5-Sector Native SVG AQI Heatmap */}
        <div className="lg:col-span-7 p-5 rounded-2xl atmospheric-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <CloudFog className="w-5 h-5 text-cyan-400" aria-hidden="true" />
                  Hyperlocal 5-Sector Urban AQI Heatmap
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Interactive atmospheric boundary-layer sectors with real-time EPA sub-indices.
                </p>
              </div>
              <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/60 px-2.5 py-1 rounded-md border border-cyan-800/40">
                5 Active Sectors
              </span>
            </div>

            {/* Accessible Screen Reader Twin */}
            <div className="sr-only">
              <h3>Urban Sectors Air Quality Status Table</h3>
              <table>
                <thead>
                  <tr>
                    <th>Sector Name</th>
                    <th>PM2.5 (µg/m³)</th>
                    <th>EPA AQI</th>
                    <th>Category</th>
                  </tr>
                </thead>
                <tbody>
                  {(['CBD', 'IND', 'RES', 'PRK', 'TRN'] as SectorId[]).map((sec) => (
                    <tr key={sec}>
                      <td>{URBAN_SECTORS[sec].name}</td>
                      <td>{URBAN_SECTORS[sec].defaultPM25}</td>
                      <td>{calculatePM25SubIndex(URBAN_SECTORS[sec].defaultPM25).aqi}</td>
                      <td>{calculatePM25SubIndex(URBAN_SECTORS[sec].defaultPM25).category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Native SVG Urban Map */}
            <div className="relative w-full aspect-[16/9] max-h-72 rounded-xl bg-slate-950/80 border border-slate-800 overflow-hidden flex items-center justify-center">
              <svg
                viewBox="0 0 500 280"
                className="w-full h-full"
                role="img"
                aria-label="Urban Sector AQI Visual Map"
              >
                {/* Sector Shapes */}
                {/* 1. RES (Greenwood Residential) */}
                <g
                  onClick={() => setSelectedSector('RES')}
                  className="cursor-pointer transition-opacity hover:opacity-90"
                >
                  <polygon
                    points="30,40 180,30 190,140 40,150"
                    fill={selectedSector === 'RES' ? '#10b981' : '#1e3a34'}
                    fillOpacity={selectedSector === 'RES' ? '0.75' : '0.45'}
                    stroke={selectedSector === 'RES' ? '#34d399' : '#10b981'}
                    strokeWidth={selectedSector === 'RES' ? '3' : '1.5'}
                  />
                  <text x="70" y="90" fill="#f1f5f9" fontSize="12" fontWeight="600">Greenwood (RES)</text>
                  <text x="70" y="110" fill="#a7f3d0" fontSize="11" fontFamily="monospace">AQI ~{calculatePM25SubIndex(URBAN_SECTORS.RES.defaultPM25).aqi}</text>
                </g>

                {/* 2. PRK (Riverside Eco-Park) */}
                <g
                  onClick={() => setSelectedSector('PRK')}
                  className="cursor-pointer transition-opacity hover:opacity-90"
                >
                  <polygon
                    points="30,165 190,155 210,250 40,260"
                    fill={selectedSector === 'PRK' ? '#06b6d4' : '#164e63'}
                    fillOpacity={selectedSector === 'PRK' ? '0.75' : '0.45'}
                    stroke={selectedSector === 'PRK' ? '#38bdf8' : '#06b6d4'}
                    strokeWidth={selectedSector === 'PRK' ? '3' : '1.5'}
                  />
                  <text x="65" y="205" fill="#f1f5f9" fontSize="12" fontWeight="600">Riverside (PRK)</text>
                  <text x="65" y="225" fill="#a5f3fc" fontSize="11" fontFamily="monospace">AQI ~{calculatePM25SubIndex(URBAN_SECTORS.PRK.defaultPM25).aqi}</text>
                </g>

                {/* 3. CBD (Central Business District) */}
                <g
                  onClick={() => setSelectedSector('CBD')}
                  className="cursor-pointer transition-opacity hover:opacity-90"
                >
                  <polygon
                    points="205,35 345,45 350,175 205,150"
                    fill={selectedSector === 'CBD' ? '#f59e0b' : '#78350f'}
                    fillOpacity={selectedSector === 'CBD' ? '0.75' : '0.45'}
                    stroke={selectedSector === 'CBD' ? '#fbbf24' : '#f59e0b'}
                    strokeWidth={selectedSector === 'CBD' ? '3' : '1.5'}
                  />
                  <text x="225" y="100" fill="#f1f5f9" fontSize="12" fontWeight="600">Downtown (CBD)</text>
                  <text x="225" y="120" fill="#fde68a" fontSize="11" fontFamily="monospace">AQI ~{calculatePM25SubIndex(URBAN_SECTORS.CBD.defaultPM25).aqi}</text>
                </g>

                {/* 4. TRN (Grand Transit Interchange) */}
                <g
                  onClick={() => setSelectedSector('TRN')}
                  className="cursor-pointer transition-opacity hover:opacity-90"
                >
                  <polygon
                    points="215,165 355,185 340,265 220,255"
                    fill={selectedSector === 'TRN' ? '#f97316' : '#7c2d12'}
                    fillOpacity={selectedSector === 'TRN' ? '0.75' : '0.45'}
                    stroke={selectedSector === 'TRN' ? '#fb923c' : '#f97316'}
                    strokeWidth={selectedSector === 'TRN' ? '3' : '1.5'}
                  />
                  <text x="235" y="215" fill="#f1f5f9" fontSize="12" fontWeight="600">Transit Hub (TRN)</text>
                  <text x="235" y="235" fill="#fed7aa" fontSize="11" fontFamily="monospace">AQI ~{calculatePM25SubIndex(URBAN_SECTORS.TRN.defaultPM25).aqi}</text>
                </g>

                {/* 5. IND (North Industrial Belt) */}
                <g
                  onClick={() => setSelectedSector('IND')}
                  className="cursor-pointer transition-opacity hover:opacity-90"
                >
                  <polygon
                    points="365,45 480,55 470,255 365,245"
                    fill={selectedSector === 'IND' ? '#ef4444' : '#7f1d1d'}
                    fillOpacity={selectedSector === 'IND' ? '0.75' : '0.45'}
                    stroke={selectedSector === 'IND' ? '#f87171' : '#ef4444'}
                    strokeWidth={selectedSector === 'IND' ? '3' : '1.5'}
                  />
                  <text x="380" y="145" fill="#f1f5f9" fontSize="12" fontWeight="600">Industrial (IND)</text>
                  <text x="380" y="165" fill="#fca5a5" fontSize="11" fontFamily="monospace">AQI ~{calculatePM25SubIndex(URBAN_SECTORS.IND.defaultPM25).aqi}</text>
                </g>
              </svg>
            </div>
          </div>

          {/* Sector Buttons */}
          <div className="flex flex-wrap gap-2 mt-4">
            {(['CBD', 'IND', 'RES', 'PRK', 'TRN'] as SectorId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedSector(id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedSector === id
                    ? 'bg-slate-100 text-slate-900 font-bold'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {URBAN_SECTORS[id].name}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Sector Telemetry & Inversion Proxy */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl atmospheric-card">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs uppercase font-mono tracking-wider text-slate-400">
                  Focused Sector
                </span>
                <h3 className="text-lg font-bold text-slate-100">{currentSectorData.name}</h3>
              </div>
              <div
                className="px-3 py-1.5 rounded-lg text-right"
                style={{ backgroundColor: `${currentSectorData.color}22` }}
              >
                <span
                  className="text-2xl font-black font-mono block leading-none"
                  style={{ color: currentSectorData.color }}
                >
                  {currentSectorData.aqi}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: currentSectorData.color }}>
                  AQI ({currentSectorData.category})
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-2 gap-3">
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                <span className="text-[11px] text-slate-400 block font-mono">PM2.5 Loading</span>
                <span className="text-lg font-bold font-mono text-cyan-300">
                  {currentSectorData.pm25} <span className="text-xs font-normal text-slate-400">µg/m³</span>
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                <span className="text-[11px] text-slate-400 block font-mono">Surface Wind</span>
                <span className="text-lg font-bold font-mono text-cyan-300">
                  {currentSectorData.windSpeedKmH} <span className="text-xs font-normal text-slate-400">km/h</span>
                </span>
              </div>
            </div>

            {/* 7-Hour Historical Sparkline */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1 font-mono">
                <span>7-Hour Historical Trend</span>
                <span>{currentSectorData.history7h[0]} → {currentSectorData.history7h[6]} µg/m³</span>
              </div>
              {/* Screen reader twin */}
              <span className="sr-only">
                Past 7 hours PM2.5 readings: {currentSectorData.history7h.join(', ')} µg/m³.
              </span>
              <div className="h-10 w-full bg-slate-950/80 rounded-lg p-1 border border-slate-800/60 flex items-end gap-1">
                {currentSectorData.history7h.map((val, idx) => {
                  const barHeight = Math.min(100, (val / 120) * 100);
                  return (
                    <div
                      key={idx}
                      className="flex-1 rounded-sm bg-cyan-500/70 hover:bg-cyan-400 transition-colors"
                      style={{ height: `${Math.max(15, barHeight)}%` }}
                      title={`T-${6 - idx}h: ${val} µg/m³`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Inversion Cap Proxy Card */}
            <div className="mt-4 p-3.5 rounded-xl bg-slate-950 border border-amber-800/30">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
                <span className="flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5" aria-hidden="true" />
                  Thermal Inversion Lid
                </span>
                <span className="font-mono uppercase px-2 py-0.5 rounded bg-amber-950 border border-amber-800/60 text-[10px]">
                  {currentSectorData.inversion.severity}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-300 font-mono">
                ΔT = {currentSectorData.inversion.deltaT > 0 ? '+' : ''}{currentSectorData.inversion.deltaT}°C
                (Ground: {currentSectorData.groundTempC}°C, Aloft: {currentSectorData.upperTempC}°C)
              </p>
              <p className="mt-1 text-[11px] text-amber-200/80 leading-relaxed">
                {currentSectorData.inversion.expectedBreakupWindow}
              </p>
              <p className="mt-2 text-[10px] text-slate-400 italic">
                Notice: {currentSectorData.inversion.simplifiedProxyNotice}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 24-Hour ML Forecaster Section */}
      <div className="p-6 rounded-2xl atmospheric-card space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" aria-hidden="true" />
              24-Hour ML Smog & Inversion Forecaster
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Zero-dependency Holt-Winters diurnal smoothing blended with Ridge atmospheric physics.
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 max-w-md">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block font-mono">
              Safe Outdoor Window
            </span>
            <p className="text-xs text-emerald-200 mt-0.5">
              {mlForecast.safeOutdoorWindow.recommendation}
            </p>
          </div>
        </div>

        {/* Confidence Band SVG Chart */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
            <span>Forecast Horizon: Next 24 Hours</span>
            <span className="text-cyan-400">90% Empirical Confidence Interval (Quantile Bounds)</span>
          </div>

          {/* Screen reader twin */}
          <div className="sr-only">
            <h4>24-Hour Hourly Forecast Table</h4>
            <table>
              <thead>
                <tr>
                  <th>Hour Offset</th>
                  <th>Clock Hour</th>
                  <th>PM2.5 (µg/m³)</th>
                  <th>90% Range</th>
                  <th>Predicted AQI</th>
                </tr>
              </thead>
              <tbody>
                {mlForecast.hours.map((h) => (
                  <tr key={h.hourOffset}>
                    <td>+{h.hourOffset}h</td>
                    <td>{h.targetHour}:00</td>
                    <td>{h.predictedPM25}</td>
                    <td>{h.lowerBoundPM25} - {h.upperBoundPM25}</td>
                    <td>{h.predictedAQI}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Native SVG Visualization */}
          <div className="w-full overflow-x-auto bg-slate-950/90 rounded-xl p-4 border border-slate-800/80">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full min-w-[500px] h-44"
              role="img"
              aria-label="24-Hour PM2.5 Forecast Chart with 90% Confidence Band"
            >
              {/* Grid lines */}
              <line x1="20" y1="20" x2={svgWidth - 20} y2="20" stroke="#334155" strokeDasharray="3 3" opacity="0.4" />
              <line x1="20" y1="80" x2={svgWidth - 20} y2="80" stroke="#334155" strokeDasharray="3 3" opacity="0.4" />
              <line x1="20" y1="140" x2={svgWidth - 20} y2="140" stroke="#334155" strokeDasharray="3 3" opacity="0.4" />

              {/* Confidence Band Polygon */}
              <polygon
                points={areaConfidence}
                fill="#06b6d4"
                fillOpacity="0.15"
                stroke="#06b6d4"
                strokeOpacity="0.3"
                strokeWidth="1"
              />

              {/* Mean Predicted Line */}
              <polyline
                points={pointsPredicted}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Hour Labels */}
              {mlForecast.hours.filter((_, idx) => idx % 4 === 0).map((h) => {
                const x = ((h.hourOffset - 1) / (mlForecast.hours.length - 1)) * (svgWidth - 40) + 20;
                return (
                  <text key={h.hourOffset} x={x} y="155" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                    {String(h.targetHour).padStart(2, '0')}:00
                  </text>
                );
              })}
            </svg>
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-1 text-right">
            {mlForecast.uncertaintyNotice}
          </p>
        </div>

        {/* Counterfactual "What-If" Analysis & Feature Contribution Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" aria-hidden="true" />
              Counterfactual "What-If" Meteorological Sliders
            </h4>
            <div className="space-y-3 text-xs font-mono">
              <div>
                <div className="flex justify-between text-slate-300">
                  <span>Surface Wind Speed ({windSlider} km/h)</span>
                  <span className="text-cyan-400">{windSlider < 6 ? 'Stagnant' : 'Active Mixing'}</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="25.0"
                  step="0.5"
                  value={windSlider}
                  onChange={(e) => setWindSlider(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 mt-1"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300">
                  <span>Inversion Thermal Cap ΔT (+{upperTempDelta}°C)</span>
                  <span className="text-amber-400">{upperTempDelta >= 5 ? 'Severe Lid' : 'Moderate'}</span>
                </div>
                <input
                  type="range"
                  min="-2.0"
                  max="8.0"
                  step="0.5"
                  value={upperTempDelta}
                  onChange={(e) => setUpperTempDelta(parseFloat(e.target.value))}
                  className="w-full accent-amber-400 mt-1"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300">
                  <span>Traffic Congestion Ratio ({(trafficSlider * 100).toFixed(0)}%)</span>
                  <span className="text-rose-400">{trafficSlider > 0.8 ? 'Peak Rush' : 'Off-Peak'}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={trafficSlider}
                  onChange={(e) => setTrafficSlider(parseFloat(e.target.value))}
                  className="w-full accent-rose-400 mt-1"
                />
              </div>
            </div>

            {/* Counterfactual Result Pill */}
            <div className="p-3 rounded-xl bg-slate-950 border border-cyan-800/40 text-xs">
              <span className="font-bold text-cyan-300 block mb-1">
                Linear Counterfactual Deduction:
              </span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {counterfactual.explanation}
              </p>
            </div>
          </div>

          {/* Model Evaluation & Backtest Metrics Panel */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" aria-hidden="true" />
              Rolling-Origin Backtest & Model Evaluation
            </h4>
            <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Mean Absolute Error (MAE)</span>
                <span className="text-base font-bold text-cyan-300">{evalMetrics.mae} µg/m³</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Root Mean Sq. Error (RMSE)</span>
                <span className="text-base font-bold text-cyan-300">{evalMetrics.rmse} µg/m³</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-slate-400 text-[10px] block">MAPE (Zero-Guarded)</span>
                <span className="text-base font-bold text-cyan-300">{evalMetrics.mape}%</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-slate-400 text-[10px] block">90% Coverage Target</span>
                <span className="text-base font-bold text-emerald-400">{evalMetrics.intervalCoverage90Percent}%</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-mono space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>Skill vs. Persistence Baseline:</span>
                <span className="text-emerald-400 font-bold">
                  +{Math.round(evalMetrics.skillScoreVsPersistence * 100)}% improvement
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Skill vs. Seasonal-Naive:</span>
                <span className="text-emerald-400 font-bold">
                  +{Math.round(evalMetrics.skillScoreVsSeasonalNaive * 100)}% improvement
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block pt-1 border-t border-slate-800/60">
                Data basis: {evalMetrics.dataSource.toUpperCase()} benchmark rolling evaluation.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Sensor Stream Mode Inspector (When Active) */}
      {activeScenario === 'SENSOR_STREAM' && (
        <div className="p-5 rounded-2xl atmospheric-card border-purple-500/40 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-purple-300 flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-400" aria-hidden="true" />
                Live Sensor Stream Mode: 1-D Kalman Filter & CUSUM Anomaly Detection
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Smoothing noisy raw optical sensor pulses and detecting sudden spikes or stuck sensor failure states.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-purple-950 text-purple-300 border border-purple-800/60 text-xs font-mono">
              Live Stream Active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-2">Sample #</th>
                  <th className="p-2">Raw Reading</th>
                  <th className="p-2">Kalman Filtered</th>
                  <th className="p-2">Status / Anomaly</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sensorStreamData.slice(-8).map((pt, i) => (
                  <tr key={i} className="hover:bg-slate-900/60">
                    <td className="p-2 text-slate-400">T-{8 - i}</td>
                    <td className="p-2 text-slate-200">{pt.rawPM25} µg/m³</td>
                    <td className="p-2 text-cyan-400 font-bold">{pt.filteredPM25} µg/m³</td>
                    <td className="p-2">
                      {pt.anomaly.isAnomaly ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800/60">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          {pt.anomaly.type}: {pt.anomaly.message}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                          Nominal Signal
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
