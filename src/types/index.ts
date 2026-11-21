/**
 * @file types/index.ts
 * @description Core frontend types and state models for VayuPulse AI.
 */

import { SectorId } from '../lib/routing';
import { UserPersona } from './orchestrator';

export type ActiveTabId = 'telemetry' | 'routine' | 'corridor' | 'iaq' | 'community';

export interface SectorTelemetry {
  id: SectorId;
  name: string;
  pm25: number;
  aqi: number;
  category: string;
  color: string;
  groundTempC: number;
  upperTempC: number;
  windSpeedKmH: number;
  relativeHumidity: number;
  inversionSeverity: 'NONE' | 'MODERATE' | 'SEVERE' | 'CRITICAL';
  history7h: number[];
}

export interface PersonaOption {
  id: UserPersona;
  title: string;
  subtitle: string;
  vulnerabilityBadge: string;
  badgeColor: string;
  description: string;
}

export const PERSONA_OPTIONS: readonly PersonaOption[] = [
  {
    id: 'ASTHMATIC_CHILD',
    title: 'Asthmatic Child (Ages 5–12)',
    subtitle: 'High minute ventilation & developing airways',
    vulnerabilityBadge: 'High Pediatric Risk',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    description: 'Requires strict indoor shelter during morning inversion and prompt rescue inhaler readiness.',
  },
  {
    id: 'NEWBORN_INFANT',
    title: 'Newborn Infant (0–12 Months)',
    subtitle: 'Immature lung parenchyma & high respiratory rate',
    vulnerabilityBadge: 'Critical Neonatal Risk',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    description: 'Requires continuous HEPA indoor filtration and complete avoidance of stroller outdoor walks during smog.',
  },
  {
    id: 'ELDERLY_CARDIAC',
    title: 'Elderly Cardiac Patient',
    subtitle: 'Ischemic heart disease / hypertension',
    vulnerabilityBadge: 'Vascular & Arrhythmia Risk',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    description: 'Particulate exposure accelerates autonomic dysfunction and ischemic events. Cancel strenuous outdoor walks.',
  },
  {
    id: 'OUTDOOR_ATHLETE',
    title: 'Outdoor Endurance Athlete',
    subtitle: 'Elevated sustained minute ventilation (60–80 L/min)',
    vulnerabilityBadge: 'Deep Alveolar Penetration',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    description: 'High exertion drives ultrafine particles deep into distal airways. Shift workouts to low-AQI hours.',
  },
  {
    id: 'SCHOOL_COMMUTER',
    title: 'Daily School Commuter',
    subtitle: 'Fixed arrival schedules during morning peak rush',
    vulnerabilityBadge: 'Commute Peak Exposure',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    description: 'Optimize departure times and transit modes (metro/HEPA) to bypass rush hour street canyon smog.',
  },
  {
    id: 'NEIGHBORHOOD_LEAD',
    title: 'Community Resilience Lead',
    subtitle: 'Community broadcasts & clean-air pledge organizer',
    vulnerabilityBadge: 'Civic Action',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    description: 'Coordinates Corsi-Rosenthal DIY builds, emissions pledges, and multilingual emergency notices.',
  },
];
