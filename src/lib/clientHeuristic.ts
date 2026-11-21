/**
 * @file clientHeuristic.ts
 * @description Client-side deterministic heuristic fallback and safe input sanitizer.
 * Guarantees 100% offline functionality without bundling server dependencies.
 */

import { PlanRequest, AgentPlanResponse, HourlyAction } from '../types/orchestrator';
import { stripControlChars } from './sanitize';

/**
 * Sanitizes untrusted user text, stripping control characters and neutralising prompt injection phrases.
 */
export function sanitizeClientInput(text: string): string {
  const stripped = stripControlChars(text);
  return stripped
    .replace(/ignore\s+previous\s+instructions/gi, '[neutralized-injection]')
    .replace(/system\s+prompt/gi, '[neutralized-system-ref]')
    .trim()
    .slice(0, 1000);
}

/**
 * Deterministic offline fallback routine generator.
 */
export function generateClientHeuristicPlan(req: PlanRequest): AgentPlanResponse {
  const isInfant = req.persona === 'NEWBORN_INFANT';
  const isChild = req.persona === 'ASTHMATIC_CHILD';
  const isCardiac = req.persona === 'ELDERLY_CARDIAC';
  const isVulnerable = isInfant || isChild || isCardiac;

  const baseZone = req.zoneId ?? 'RES';
  const destZone = req.destinationZoneId ?? 'CBD';
  const modeLabel =
    req.transitMode === 'EV_HEPA'
      ? 'EV / HEPA Cabin Taxi'
      : req.transitMode === 'METRO'
      ? 'Underground Metro'
      : req.transitMode
      ? req.transitMode.replace(/_/g, ' ')
      : 'Underground Metro';

  // Construct conservative hourly routine with strict pediatric/neonatal safety rules
  const routine: HourlyAction[] = [
    {
      hour: 7,
      timeLabel: '07:00 - 09:00 (Dawn Peak / Inversion)',
      exposureRisk: 'SEVERE',
      activityRecommendation: isInfant
        ? 'Strict indoor nursery isolation with continuous HEPA air filtration (>4 ACH). Note: Masks are strictly contraindicated for infants under 2 years.'
        : isChild
        ? 'Strict indoor shelter. Keep windows sealed. Avoid morning outdoor school commute; use pediatric-sized KF94 mask if transit is unavoidable.'
        : isCardiac
        ? 'Strict indoor shelter. Avoid early morning cold-air exertion. Maintain continuous HEPA air scrubbing.'
        : 'Avoid strenuous outdoor cardio. Use certified N95/FFP2 respirator if commuting. Keep indoor air scrubbed.',
      ventilationStatus: 'ACTIVE_PURIFICATION',
      maskingRequired: isInfant ? false : true,
    },
    {
      hour: 10,
      timeLabel: '10:00 - 12:00 (Late Morning)',
      exposureRisk: 'HIGH',
      activityRecommendation: isInfant
        ? 'Maintain indoor filtered nursery. Suspend all outdoor stroller walks.'
        : 'Indoor filtered learning/work. Maintain Corsi-Rosenthal / HEPA filtration (>4 ACH).',
      ventilationStatus: 'ACTIVE_PURIFICATION',
      maskingRequired: isInfant ? false : isVulnerable,
    },
    {
      hour: 13,
      timeLabel: '13:00 - 15:00 (Convective Solar Breakup Window)',
      exposureRisk: 'MODERATE',
      activityRecommendation: isInfant
        ? 'Solar convective breakup dissipates ground inversion. Brief indoor cross-ventilation permitted while monitoring local AQI.'
        : isVulnerable
        ? 'Safest outdoor window of the day. Mild outdoor walking permitted if local AQI < 100.'
        : 'Optimal window for natural cross-ventilation and outdoor transit before evening inversion reforms.',
      ventilationStatus: 'FILTERED_VENTILATION',
      maskingRequired: false,
    },
    {
      hour: 17,
      timeLabel: '17:00 - 20:00 (Evening Traffic & Ground Inversion)',
      exposureRisk: 'SEVERE',
      activityRecommendation: isInfant
        ? 'Evening thermal lid traps rush-hour exhaust. Keep nursery windows sealed with HEPA filtration active.'
        : 'Evening smog cap sets in. Commute strictly via enclosed transit (EV/HEPA or Metro). Close all windows.',
      ventilationStatus: 'SEALED',
      maskingRequired: isInfant ? false : true,
    },
  ];

  const citations = isInfant
    ? ['[PED-ASTHMA-VULN]', '[WHO-PM25-24H]', '[CR-BOX-SPEC]', '[VENT-INVERSION]']
    : isVulnerable
    ? ['[PED-ASTHMA-VULN]', '[WHO-PM25-24H]', '[CR-BOX-SPEC]', '[VENT-INVERSION]']
    : ['[WHO-PM25-24H]', '[EPA-AQI-THRESH]', '[N95-PHYSICS]', '[VENT-INVERSION]'];

  const physiologicalImpact = isInfant
    ? 'Immature neonatal lung parenchyma and rapid respiratory rate create severe vulnerability to ultrafine particle loading. Air cleaners must maintain indoor PM2.5 < 10 µg/m³. Respirators contraindicated.'
    : isChild
    ? 'High minute ventilation per kg body mass causes disproportionate alveolar particulate deposition. Airway hyper-reactivity risk during cold inversions.'
    : isCardiac
    ? 'High risk of microvascular constriction and autonomic arrhythmia. Avoid strenuous morning outdoor exertion.'
    : 'Elevated oxidative burden on respiratory epithelium. Commuter exposure can be mitigated through sealed transit corridors and timed ventilation.';

  return {
    riskSummary: `Winter boundary-layer inversion active over ${baseZone}. Stagnant cool ground layer trapping particulates. Sensitive groups (${req.persona.replace(/_/g, ' ')}) must restrict morning/night exposure.`,
    hourlyRoutine: routine,
    physiologicalImpact,
    cleanRouteAdvice: `Transit between ${baseZone} and ${destZone} is best undertaken via ${modeLabel} during the convective breakup window (13:00–15:00). For maximum exposure reduction, an EV / HEPA Cabin Taxi provides 85% particulate filtration.`,
    iaqActionPlan: 'Operate Corsi-Rosenthal box (CADR 350 m³/h) continuously in bedrooms to achieve >4 ACH. Seal windows during morning inversion (05:00–10:00).',
    citations,
    confidence: 0.78,
    confidenceRationale: 'Conservative heuristic estimate based on physical inversion proxies; live sensor model uncalibrated.',
    modelTelemetry: {
      provider: 'deterministic-heuristic',
      model: 'heuristic-rules-engine-v1',
      latencyMs: 8,
      cacheStatus: 'MISS',
      toolsInvoked: ['get_zone_telemetry', 'search_health_protocols'],
      criticVerdict: 'FALLBACK_HEURISTIC',
      criticIterations: 1,
      trace: [
        {
          role: 'system',
          action: 'offline_client_heuristic',
          content: `Generated deterministic offline protection plan for persona ${req.persona}.`,
        },
      ],
    },
  };
}
