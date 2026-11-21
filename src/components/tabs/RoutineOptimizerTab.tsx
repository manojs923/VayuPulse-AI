import React, { useState } from 'react';
import { PERSONA_OPTIONS } from '../../types';
import { UserPersona, AgentPlanResponse } from '../../types/orchestrator';
import { generateClientHeuristicPlan } from '../../lib/clientHeuristic';
import { SectorId } from '../../lib/routing';
import { MedicalNotice } from '../common/MedicalNotice';
import {
  ShieldAlert,
  Bot,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  BookmarkCheck,
  Search,
} from 'lucide-react';

export const RoutineOptimizerTab: React.FC = () => {
  const [selectedPersona, setSelectedPersona] = useState<UserPersona>('ASTHMATIC_CHILD');
  const [selectedZone, setSelectedZone] = useState<SectorId>('RES');
  const [loading, setLoading] = useState<boolean>(false);
  const [planResult, setPlanResult] = useState<AgentPlanResponse | null>(null);

  const handleGeneratePlan = async () => {
    setLoading(true);
    try {
      // First attempt backend gateway call
      const response = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: selectedPersona,
          zoneId: selectedZone,
          destinationZoneId: 'CBD',
          transitMode: 'METRO',
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as AgentPlanResponse;
        setPlanResult(data);
      } else {
        // Safe client deterministic heuristic fallback
        const fallback = generateClientHeuristicPlan({
          persona: selectedPersona,
          zoneId: selectedZone,
        });
        setPlanResult(fallback);
      }
    } catch {
      // Client offline fallback
      const fallback = generateClientHeuristicPlan({
        persona: selectedPersona,
        zoneId: selectedZone,
      });
      setPlanResult(fallback);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <MedicalNotice />

      {/* Header & Persona Selector */}
      <div className="p-6 rounded-2xl atmospheric-card space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Bot className="w-5 h-5 text-cyan-400" aria-hidden="true" />
            Agentic Daily Routine Optimizer (Planner → Safety Critic Loop)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic physics & WHO/EPA protocols orchestrated by autonomous agent planning with safety critic verification.
          </p>
        </div>

        {/* Persona Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {PERSONA_OPTIONS.map((persona) => {
            const isSelected = selectedPersona === persona.id;
            return (
              <button
                key={persona.id}
                type="button"
                onClick={() => setSelectedPersona(persona.id)}
                className={`p-3.5 rounded-xl text-left border transition-all ${
                  isSelected
                    ? 'bg-slate-800/90 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-slate-100">{persona.title}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${persona.badgeColor}`}>
                    {persona.vulnerabilityBadge}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{persona.description}</p>
              </button>
            );
          })}
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <label htmlFor="routine-zone-select" className="text-xs font-mono text-slate-400">
              Origin Sector:
            </label>
            <select
              id="routine-zone-select"
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value as SectorId)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="RES">Greenwood (RES)</option>
              <option value="CBD">Downtown (CBD)</option>
              <option value="IND">Industrial (IND)</option>
              <option value="PRK">Riverside (PRK)</option>
              <option value="TRN">Transit Hub (TRN)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleGeneratePlan}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-lg disabled:opacity-50"
          >
            {loading ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" aria-hidden="true" />
                Orchestrating Agent Loop...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                Synthesize Daily Protection Routine
              </>
            )}
          </button>
        </div>
      </div>

      {/* Plan Results Area */}
      {planResult && (
        <div className="space-y-6">
          {/* Top Banner: Risk Summary & Confidence */}
          <div className="p-5 rounded-2xl atmospheric-card border-cyan-800/40 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" aria-hidden="true" />
                <h3 className="text-base font-bold text-slate-100">
                  Daily Atmospheric Protection Assessment
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-slate-400">Model Confidence:</span>
                <span className="px-2.5 py-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-bold">
                  {(planResult.confidence * 100).toFixed(0)}% ({planResult.confidenceRationale})
                </span>
              </div>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed font-sans">
              {planResult.riskSummary}
            </p>
            <p className="text-xs text-amber-300/90 italic border-l-2 border-amber-500 pl-3">
              Physiological Vulnerability: {planResult.physiologicalImpact}
            </p>
          </div>

          {/* Hour-by-Hour Protective Routine */}
          <div className="p-6 rounded-2xl atmospheric-card space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-400" aria-hidden="true" />
              Hour-by-Hour Activity & Exposure Schedule
            </h3>
            <div className="space-y-3">
              {planResult.hourlyRoutine.map((step, idx) => {
                const isSevere = step.exposureRisk === 'SEVERE';
                const isModerate = step.exposureRisk === 'MODERATE';
                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border transition-all ${
                      isSevere
                        ? 'bg-rose-950/20 border-rose-800/40'
                        : isModerate
                        ? 'bg-emerald-950/20 border-emerald-800/40'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-slate-200">
                        {step.timeLabel}
                      </span>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                        <span
                          className={`px-2 py-0.5 rounded border uppercase font-bold ${
                            isSevere
                              ? 'bg-rose-950 text-rose-300 border-rose-800/60'
                              : isModerate
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-800/60'
                              : 'bg-amber-950 text-amber-300 border-amber-800/60'
                          }`}
                        >
                          Risk: {step.exposureRisk}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 capitalize">
                          Ventilation: {step.ventilationStatus.toLowerCase().replace(/_/g, ' ')}
                        </span>
                        {selectedPersona === 'NEWBORN_INFANT' ? (
                          <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60 font-semibold text-[10px]">
                            Masks Contraindicated (&lt;2y)
                          </span>
                        ) : step.maskingRequired ? (
                          <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/60 text-[10px]">
                            {selectedPersona === 'ASTHMATIC_CHILD' ? 'Pediatric KF94 Required' : 'N95 / FFP2 Required'}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                      {step.activityRecommendation}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Clean Route Advice & Indoor IAQ Strategy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl atmospheric-card space-y-2">
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-cyan-400" />
                Clean Route Strategy
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {planResult.cleanRouteAdvice}
              </p>
            </div>
            <div className="p-5 rounded-2xl atmospheric-card space-y-2">
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <BookmarkCheck className="w-4 h-4 text-cyan-400" />
                Indoor Air Quality (IAQ) Plan
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {planResult.iaqActionPlan}
              </p>
            </div>
          </div>

          {/* Grounded Protocol Citations */}
          <div className="p-5 rounded-2xl atmospheric-card space-y-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300">
                Grounded Hybrid RAG Protocol Citations ({planResult.citations.length})
              </h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {planResult.citations.map((cId) => (
                <span
                  key={cId}
                  className="px-3 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-xs font-mono text-cyan-300 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  {cId}
                </span>
              ))}
            </div>
          </div>

          {/* Multi-Agent Live Trace Inspector */}
          <div className="p-5 rounded-2xl atmospheric-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase font-bold text-slate-400">
                Multi-Agent Telemetry & Verification Trace
              </span>
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Safety Critic Verdict: {planResult.modelTelemetry.criticVerdict} ({planResult.modelTelemetry.latencyMs} ms)
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {planResult.modelTelemetry.trace.map((t, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs font-mono flex items-start gap-3"
                >
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold shrink-0 ${
                      t.role === 'critic'
                        ? 'bg-purple-950 text-purple-300 border border-purple-800/50'
                        : t.role === 'planner'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/50'
                        : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    {t.role}
                  </span>
                  <div className="overflow-hidden">
                    <span className="font-bold text-slate-300 block">{t.action}</span>
                    <span className="text-slate-400 text-[11px] break-words">{t.content}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
