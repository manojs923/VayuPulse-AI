import React from 'react';
import { X, ShieldCheck, AlertTriangle, Cpu, Database, BarChart3 } from 'lucide-react';

interface ModelCardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModelCardModal: React.FC<ModelCardModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-card-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-3xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <h2 id="model-card-title" className="text-base font-bold text-slate-100">
              VayuPulse AI - Responsible AI Model Card & Architecture Factsheet
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss Model Card Modal"
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 text-xs text-slate-300 max-h-[75vh] overflow-y-auto font-sans">
          {/* Section 1: Intended Use */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-1.5 uppercase font-mono tracking-wider">
              <Cpu className="w-4 h-4 text-cyan-400" />
              1. Intended Use & Target Community
            </h3>
            <p className="leading-relaxed">
              VayuPulse AI is an atmospheric intelligence and clean-air agent platform engineered to mitigate urban particulate trapping during winter boundary-layer temperature inversions. It provides real-time protective daily routines, multi-modal lowest-exposure transit routing, and DIY indoor air filtration sizing (Corsi-Rosenthal boxes) for vulnerable families, school commuters, and municipal resilience leads.
            </p>
          </section>

          {/* Section 2: Data Sources & Telemetry Labeling */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-1.5 uppercase font-mono tracking-wider">
              <Database className="w-4 h-4 text-cyan-400" />
              2. Data Sources & Transparency Labeling
            </h3>
            <p className="leading-relaxed">
              By default, environmental telemetry is synthesized via a physics-based boundary-layer simulator. When live telemetry is enabled (<code className="text-cyan-300">TELEMETRY_SOURCE=openmeteo</code>), ambient data is fetched from Open-Meteo and the Copernicus Atmosphere Monitoring Service (CAMS) under CC-BY 4.0 attribution. CAMS air quality is modeled, not a raw sensor; city-level PM2.5 is distributed proportionally across urban sectors preserving the city mean.
            </p>
            <p className="leading-relaxed text-[11px] text-slate-400">
              When live feeds fail or are unconfigured, VayuPulse automatically falls back to deterministic simulation and explicitly flags the data as simulated with the fallback reason. Simulated data is never relabeled as live.
            </p>
          </section>

          {/* Section 3: Physics & Mathematical Invariants */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-1.5 uppercase font-mono tracking-wider">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              3. Deterministic Separation of Concerns
            </h3>
            <p className="leading-relaxed">
              Under strict design principles, large language models (LLMs) never compute raw physical concentrations or mathematical indices. All numbers are computed by deterministic, unit-tested pure functions:
            </p>
            <ul className="list-disc pl-5 space-y-1 font-mono text-[11px] text-slate-400">
              <li><strong>EPA Sub-Index:</strong> 2024 revised NAAQS piecewise linear interpolation.</li>
              <li><strong>Inversion Proxy:</strong> ΔT = T_upper - T_ground combined with wind stagnation (&lt;6 km/h).</li>
              <li><strong>Mass Balance Decay:</strong> Single-compartment CADR exponential decay: t = [-ln(1-η) × V / CADR] × 60 min.</li>
              <li><strong>Dijkstra Lowest Dose:</strong> Graph optimization minimizing cumulative inhaled microgram dose.</li>
            </ul>
          </section>

          {/* Section 4: Known Failure Modes & Limitations */}
          <section className="space-y-2 p-4 rounded-xl bg-amber-950/20 border border-amber-800/40">
            <h3 className="text-sm font-bold text-amber-300 flex items-center gap-1.5 uppercase font-mono tracking-wider">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              4. Limitations & Known Failure Modes
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-amber-200/90 text-[11px] leading-relaxed">
              <li>
                <strong>Simplified Inversion Proxy:</strong> The thermal lid model calculates temperature differences between two levels (~300m AGL proxy vs ground). It is <em>not a vertical atmospheric sounding (radiosonde)</em> and cannot resolve complex multiple capping inversions.
              </li>
              <li>
                <strong>Micro-Environmental Sources:</strong> Indoor cooking without extraction, direct tobacco/woodsmoke, or hyperlocal idling vehicles immediately next to an individual may exceed regional sector predictions.
              </li>
              <li>
                <strong>Abrupt Synoptic Fronts:</strong> Rapid cold front arrivals or severe squall lines can disperse inversion lids hours faster than diurnal solar models anticipate.
              </li>
            </ul>
          </section>

          {/* Section 5: Responsible AI & Citations */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-1.5 uppercase font-mono tracking-wider">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              5. Multi-Agent Verification & Citations
            </h3>
            <p className="leading-relaxed">
              Agent recommendations are passed through a dedicated Safety Critic agent. Draft recommendations are verified to ensure that: (1) citations map to vetted WHO/EPA guidelines, (2) vulnerable persona rules (such as pediatric masking) are strictly upheld, and (3) no numerical values contradict tool outputs.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold transition-colors"
          >
            Close Model Card
          </button>
        </div>
      </div>
    </div>
  );
};
