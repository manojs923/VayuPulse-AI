import React, { useState, useEffect } from 'react';
import { ActiveTabId } from '../../types';
import { SimulatedBanner } from '../common/SimulatedBanner';
import { TelemetryForecastTab } from '../tabs/TelemetryForecastTab';
import { RoutineOptimizerTab } from '../tabs/RoutineOptimizerTab';
import { CleanCorridorTab } from '../tabs/CleanCorridorTab';
import { IaqFiltrationTab } from '../tabs/IaqFiltrationTab';
import { CommunityResilienceTab } from '../tabs/CommunityResilienceTab';
import { CopilotDrawer } from '../copilot/CopilotDrawer';
import { ModelCardModal } from '../modelcard/ModelCardModal';
import {
  CloudFog,
  Bot,
  Compass,
  Wind,
  Users,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

interface TabDefinition {
  id: ActiveTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: readonly TabDefinition[] = [
  { id: 'telemetry', label: 'Telemetry & ML Forecast', icon: CloudFog },
  { id: 'routine', label: 'Agentic Routine Optimizer', icon: Bot },
  { id: 'corridor', label: 'Clean-Corridor Transit', icon: Compass },
  { id: 'iaq', label: 'IAQ & Filtration Lab', icon: Wind },
  { id: 'community', label: 'Community Resilience', icon: Users },
];

/**
 * Safe LocalStorage parser adhering to strict schema guards.
 */
export function safeParseLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const AppShell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTabId>(() => {
    return safeParseLocalStorage<ActiveTabId>('vayupulse_active_tab', 'telemetry');
  });
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [isModelCardOpen, setIsModelCardOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      window.localStorage.setItem('vayupulse_active_tab', JSON.stringify(activeTab));
    } catch {
      // Ignore storage errors in restricted iframe/private mode
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Persistent Simulated Data Banner */}
      <SimulatedBanner isSimulated={true} />

      {/* Primary Atmospheric Header */}
      <header className="sticky top-0 z-40 atmospheric-glass border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-400 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <CloudFog className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight bg-gradient-to-r from-cyan-300 via-teal-200 to-emerald-400 bg-clip-text text-transparent">
                  VayuPulse AI
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-semibold">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Atmospheric Intelligence, ML Smog Forecasting & Clean-Air Agent
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsModelCardOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-300 transition-colors focus:ring-2 focus:ring-cyan-500/50"
            >
              <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline">Model Card</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCopilotOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-500/20 hover:opacity-90 focus:ring-2 focus:ring-cyan-500"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Clean-Air Copilot</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Bar with full WCAG 2.2 AA ARIA */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav
            role="tablist"
            aria-label="VayuPulse Application Modules"
            className="flex space-x-1 overflow-x-auto py-1 scrollbar-none"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls={`tabpanel-${tab.id}`}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                    isSelected
                      ? 'bg-slate-800 text-cyan-300 shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div
          id={`tabpanel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          className="focus:outline-none"
        >
          {activeTab === 'telemetry' && <TelemetryForecastTab />}
          {activeTab === 'routine' && <RoutineOptimizerTab />}
          {activeTab === 'corridor' && <CleanCorridorTab />}
          {activeTab === 'iaq' && <IaqFiltrationTab />}
          {activeTab === 'community' && <CommunityResilienceTab />}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p>VayuPulse AI • Physics-Grounded Environmental Intelligence</p>
          <p className="text-[11px] text-slate-600">
            EPA NAAQS 2024 Breakpoints • WHO Air Quality Guidelines • Deterministic CADR Mass Balance
          </p>
        </div>
      </footer>

      {/* AI Copilot Drawer */}
      <CopilotDrawer isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} />

      {/* In-App Model Card Modal */}
      <ModelCardModal isOpen={isModelCardOpen} onClose={() => setIsModelCardOpen(false)} />
    </div>
  );
};
