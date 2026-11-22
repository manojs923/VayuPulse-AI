import React, { useState, useMemo } from 'react';
import {
  estimatePurificationTime,
  PURIFIER_PRESETS,
} from '../../lib/aqiCompute';
import { MedicalNotice } from '../common/MedicalNotice';
import { useI18n } from '../../lib/i18n/I18nContext';
import {
  Wind,
  CheckCircle2,
  Clock,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';

export const IaqFiltrationTab: React.FC = () => {
  const { t } = useI18n();
  const [lengthM, setLengthM] = useState<number>(5.0);
  const [widthM, setWidthM] = useState<number>(4.0);
  const [heightM, setHeightM] = useState<number>(2.5);
  const [selectedTargetEta, setSelectedTargetEta] = useState<number>(0.90); // 90% clearance

  // Corsi-Rosenthal Clearance
  const crClearance = useMemo(() => {
    return estimatePurificationTime(lengthM, widthM, heightM, PURIFIER_PRESETS[0]!.cadrM3H, selectedTargetEta);
  }, [lengthM, widthM, heightM, selectedTargetEta]);

  // Commercial HEPA Clearance
  const hepaClearance = useMemo(() => {
    return estimatePurificationTime(lengthM, widthM, heightM, PURIFIER_PRESETS[1]!.cadrM3H, selectedTargetEta);
  }, [lengthM, widthM, heightM, selectedTargetEta]);

  // High Capacity Clearance
  const highCapClearance = useMemo(() => {
    return estimatePurificationTime(lengthM, widthM, heightM, PURIFIER_PRESETS[2]!.cadrM3H, selectedTargetEta);
  }, [lengthM, widthM, heightM, selectedTargetEta]);

  const roomVolume = Math.round(lengthM * widthM * heightM * 10) / 10;
  const recommendedCADR5ACH = Math.round(roomVolume * 5.0);
  const baselineCADR4ACH = Math.round(roomVolume * 4.0);

  return (
    <div className="space-y-6">
      <MedicalNotice />

      {/* Room Geometry & Mass Balance Sliders */}
      <div className="p-6 rounded-2xl atmospheric-card space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Wind className="w-5 h-5 text-cyan-400" aria-hidden="true" />
            {t.iaqTab.title}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t.iaqTab.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          <div>
            <div className="flex justify-between text-xs font-mono text-slate-300 mb-1">
              <span>{t.iaqTab.roomLength}: {lengthM} m</span>
            </div>
            <input
              type="range"
              min="2.0"
              max="15.0"
              step="0.5"
              value={lengthM}
              onChange={(e) => setLengthM(parseFloat(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono text-slate-300 mb-1">
              <span>{t.iaqTab.roomWidth}: {widthM} m</span>
            </div>
            <input
              type="range"
              min="2.0"
              max="12.0"
              step="0.5"
              value={widthM}
              onChange={(e) => setWidthM(parseFloat(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono text-slate-300 mb-1">
              <span>{t.iaqTab.ceilingHeight}: {heightM} m</span>
            </div>
            <input
              type="range"
              min="2.0"
              max="5.0"
              step="0.1"
              value={heightM}
              onChange={(e) => setHeightM(parseFloat(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>

          <div>
            <label htmlFor="iaq-reduction-target" className="flex justify-between text-xs font-mono text-slate-300 mb-1">
              <span>{t.iaqTab.targetReduction}: {(selectedTargetEta * 100).toFixed(0)}%</span>
            </label>
            <select
              id="iaq-reduction-target"
              value={selectedTargetEta}
              onChange={(e) => setSelectedTargetEta(parseFloat(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="0.75">75% Particle Clearance (-1.38 e-fold)</option>
              <option value="0.90">90% Particle Clearance (-2.30 e-fold)</option>
              <option value="0.95">95% Particle Clearance (-3.00 e-fold)</option>
              <option value="0.99">99% Particle Clearance (-4.61 e-fold)</option>
            </select>
          </div>
        </div>

        {/* Room Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-800 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Room Volume</span>
            <span className="text-base font-bold text-slate-200">{roomVolume} m³</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Recommended (5 ACH)</span>
            <span className="text-base font-bold text-cyan-400">{recommendedCADR5ACH} m³/h</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Minimum (4 ACH)</span>
            <span className="text-base font-bold text-slate-300">{baselineCADR4ACH} m³/h</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Target Standard</span>
            <span className="text-xs font-bold text-emerald-400 block">common guideline: 4–5+ ACH</span>
            <span className="text-[10px] text-cyan-300 block font-semibold mt-0.5">5 ACH Recommended</span>
          </div>
        </div>
      </div>

      {/* Head-to-Head Comparison: Corsi-Rosenthal vs Commercial HEPA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Corsi-Rosenthal Box Card */}
        <div className="p-5 rounded-2xl atmospheric-card border-cyan-500/60 bg-gradient-to-b from-slate-900 to-cyan-950/20 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                Recommended DIY Build
              </span>
              <h3 className="text-base font-bold text-slate-100 mt-1">Corsi-Rosenthal Box</h3>
              <p className="text-xs text-slate-400">4x MERV-13 Filters + 20" Box Fan</p>
            </div>
            <span className="text-xl font-bold font-mono text-cyan-300">~$40</span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400">CADR Delivery:</span>
              <span className="font-bold text-slate-200">350 m³/h (206 CFM)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Air Changes / Hour:</span>
              <span className={`font-bold ${crClearance.meets4ACHStandard ? 'text-emerald-400' : 'text-amber-400'}`}>
                {crClearance.ach} ACH
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
              <span className="text-slate-300 font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Clearance Time:
              </span>
              <span className="text-lg font-bold font-mono text-cyan-300">
                {crClearance.clearanceTimeMinutes} min
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-[11px] text-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            {crClearance.ach >= 5
              ? 'Exceeds recommended 5 ACH (common guideline: 4–5+ ACH).'
              : crClearance.ach >= 4
              ? 'Meets 4 ACH (common guideline: 4–5+ ACH; 5 ACH recommended).'
              : 'Add second unit for common guideline: 4–5+ ACH.'}
          </div>
        </div>

        {/* Standard Commercial HEPA */}
        <div className="p-5 rounded-2xl atmospheric-card space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-slate-300 border border-slate-800">
                Commercial Entry
              </span>
              <h3 className="text-base font-bold text-slate-100 mt-1">Standard HEPA Unit</h3>
              <p className="text-xs text-slate-400">Certified H13 Mechanical Filter</p>
            </div>
            <span className="text-xl font-bold font-mono text-slate-300">~$160</span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400">CADR Delivery:</span>
              <span className="font-bold text-slate-200">250 m³/h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Air Changes / Hour:</span>
              <span className={`font-bold ${hepaClearance.meets4ACHStandard ? 'text-emerald-400' : 'text-amber-400'}`}>
                {hepaClearance.ach} ACH
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
              <span className="text-slate-300 font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Clearance Time:
              </span>
              <span className="text-lg font-bold font-mono text-slate-200">
                {hepaClearance.clearanceTimeMinutes} min
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
            {hepaClearance.ach >= 5
              ? 'Meets recommended 5 ACH (common guideline: 4–5+ ACH).'
              : hepaClearance.ach >= 4
              ? 'Meets 4 ACH (common guideline: 4–5+ ACH; 5 ACH recommended).'
              : 'Falls below common guideline: 4–5+ ACH for this volume.'}
          </div>
        </div>

        {/* High-Capacity Commercial Tower */}
        <div className="p-5 rounded-2xl atmospheric-card space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-slate-300 border border-slate-800">
                Heavy Duty
              </span>
              <h3 className="text-base font-bold text-slate-100 mt-1">Dual-HEPA Tower</h3>
              <p className="text-xs text-slate-400">Large Classroom / Office Unit</p>
            </div>
            <span className="text-xl font-bold font-mono text-slate-300">~$380</span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400">CADR Delivery:</span>
              <span className="font-bold text-slate-200">500 m³/h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Air Changes / Hour:</span>
              <span className={`font-bold ${highCapClearance.meets4ACHStandard ? 'text-emerald-400' : 'text-amber-400'}`}>
                {highCapClearance.ach} ACH
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
              <span className="text-slate-300 font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Clearance Time:
              </span>
              <span className="text-lg font-bold font-mono text-slate-200">
                {highCapClearance.clearanceTimeMinutes} min
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-[11px] text-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            {highCapClearance.ach >= 5
              ? 'Exceeds recommended 5 ACH (common guideline: 4–5+ ACH).'
              : 'Meets common guideline: 4–5+ ACH.'}
          </div>
        </div>
      </div>

      {/* Smart Window Ventilation Timing & Physics Model Assumptions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl atmospheric-card space-y-3">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            Smart Window Ventilation Schedule Tied to Inversion Lapse Rate
          </h3>
          <div className="space-y-2 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/40 flex justify-between items-center">
              <div>
                <span className="font-bold text-rose-300">22:00 – 10:00 (Nocturnal & Dawn Inversion)</span>
                <p className="text-[11px] text-rose-200/70">Cold surface inversion caps vehicle and biomass soot.</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold text-[10px]">
                KEEP SEALED
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 flex justify-between items-center">
              <div>
                <span className="font-bold text-emerald-300">12:30 – 15:00 (Solar Convective Breakup)</span>
                <p className="text-[11px] text-emerald-200/70">Ground heating dismantles inversion cap; vertical mixing height peaks.</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold text-[10px]">
                CROSS-VENTILATE
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/40 flex justify-between items-center">
              <div>
                <span className="font-bold text-rose-300">17:00 – 21:00 (Evening Rush Trapping)</span>
                <p className="text-[11px] text-rose-200/70">Surface cooling re-establishes thermal lid; traffic exhaust concentrates.</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold text-[10px]">
                SEAL & FILTER
              </span>
            </div>
          </div>
        </div>

        {/* Model Assumptions & Mass-Balance Equations */}
        <div className="p-5 rounded-2xl atmospheric-card space-y-3">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            Physical Mass-Balance Governing Assumptions
          </h3>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs space-y-1.5 text-slate-300">
            <p className="text-cyan-300 font-bold">
              t = [ -ln(1 - η) × V / CADR ] × 60 minutes
            </p>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-400">
              <li><strong>Uniform Air Mixing:</strong> Room air is well-mixed without static recirculation dead zones.</li>
              <li><strong>Infiltration Suppressed:</strong> Building envelope doors and windows are closed during the clearance interval.</li>
              <li><strong>No Continuous Emission Sources:</strong> Cooking, smoking, or indoor combustion must be suspended.</li>
              <li><strong>Zero Chemical Byproducts:</strong> Mechanical MERV-13 and HEPA filters do not generate ozone or VOC byproducts.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
