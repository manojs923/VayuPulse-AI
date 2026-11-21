/**
 * @file types/orchestrator.ts
 * @description Shared schema types for Multi-Agent Orchestrator and Client UI.
 */

import { SectorId, TransitMode } from '../lib/routing';

export type UserPersona =
  | 'ASTHMATIC_CHILD'
  | 'NEWBORN_INFANT'
  | 'ELDERLY_CARDIAC'
  | 'OUTDOOR_ATHLETE'
  | 'SCHOOL_COMMUTER'
  | 'NEIGHBORHOOD_LEAD';

export interface PlanRequest {
  persona: UserPersona;
  zoneId: SectorId;
  destinationZoneId?: SectorId;
  transitMode?: TransitMode;
  roomDimensions?: { lengthM: number; widthM: number; heightM: number };
  userNotes?: string;
}

export interface HourlyAction {
  hour: number;
  timeLabel: string;
  exposureRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  activityRecommendation: string;
  ventilationStatus: 'SEALED' | 'ACTIVE_PURIFICATION' | 'FILTERED_VENTILATION' | 'OPEN_VENTILATION';
  maskingRequired: boolean;
}

export interface AgentTraceStep {
  role: 'planner' | 'critic' | 'tool' | 'system';
  action: string;
  content: string;
}

export interface AgentPlanResponse {
  riskSummary: string;
  hourlyRoutine: HourlyAction[];
  physiologicalImpact: string;
  cleanRouteAdvice: string;
  iaqActionPlan: string;
  citations: string[];
  confidence: number;
  confidenceRationale: string;
  modelTelemetry: {
    provider: string;
    model: string;
    latencyMs: number;
    cacheStatus: 'HIT' | 'MISS';
    toolsInvoked: string[];
    criticVerdict: 'PASSED' | 'REVISED_AND_PASSED' | 'FALLBACK_HEURISTIC';
    criticIterations: number;
    trace: AgentTraceStep[];
  };
}
