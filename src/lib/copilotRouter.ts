/**
 * @file copilotRouter.ts
 * @description Grounded intent router and response synthesizer for the Clean-Air Copilot.
 * 
 * Intents Supported:
 * 1. 'weather' / 'telemetry': Live ambient PM2.5, EPA AQI, and thermal inversion status with observation timestamp.
 * 2. 'forecast': 24-hour smog progression and least-polluted outdoor window.
 * 3. 'route' / 'commute': Lowest-dose transit modes (EV/HEPA 85%, Metro 75%) and departure windows.
 * 4. 'iaq' / 'cadr': Room geometry, Corsi-Rosenthal DIY box CADR (350 m³/h), and common guideline: 4–5+ ACH.
 * 5. 'protocols' / 'persona': Clinical guidelines for infants (<2y no masks), asthmatic children, and cardiac patients.
 * 6. 'urgent_symptoms': Emergency triage disclaimer for acute distress (cyanosis, severe dyspnea, chest pain).
 * 7. 'out_of_scope': Polite domain-boundary explanation.
 */

import { SectorReading, DEFAULT_SIMULATED_WEATHER } from './telemetrySource';
import { URBAN_SECTORS, SectorId, dijkstraLowestExposure } from './routing';
import { calculatePM25SubIndex, evaluateInversionRisk, estimatePurificationTime, PURIFIER_PRESETS } from './aqiCompute';
import { generate24HourMLForecast } from './mlForecast';

export type CopilotIntent =
  | 'urgent_symptoms'
  | 'weather'
  | 'forecast'
  | 'route'
  | 'iaq'
  | 'protocols'
  | 'out_of_scope';

export interface CopilotRouteResult {
  intent: CopilotIntent;
  confidence: number;
  answer: string;
  citations: string[];
}

/**
 * Classifies query intent via deterministic keyword pattern matching.
 */
export function classifyCopilotIntent(query: string): CopilotIntent {
  const q = query.toLowerCase();

  // 1. Urgent Clinical Symptoms (Priority 1)
  if (
    /(chest pain|cannot breathe|can't breathe|shortness of breath|blue lips|cyanosis|stridor|asthma attack|wheezing severely|emergency)/i.test(
      q
    )
  ) {
    return 'urgent_symptoms';
  }

  // 2. Persona Guidelines & Protocols (Priority 2)
  if (
    /\b(infant|infants|baby|babies|child|children|kid|kids|mask|masks|masking|n95|kf94|ffp2|respirator|respirators|cardiac|elderly|athlete|athletes|guideline|guidelines|protocol|protocols)\b/i.test(
      q
    ) ||
    /\b(who guideline|who standard|epa guideline|epa standard|pediatric)\b/i.test(q)
  ) {
    return 'protocols';
  }

  // 3. Forecast & Prediction & Ventilation Window (Priority 3)
  if (
    /\b(forecast|forecasts|tomorrow|prediction|hourly|window|windows|least-polluted|safe window|breakup window)\b/i.test(
      q
    )
  ) {
    return 'forecast';
  }

  // 4. IAQ & Room Purification Sizing (Priority 4)
  if (
    /\b(corsi|cadr|purifier|purifiers|hepa|filter|filters|filtration|ach|merv|box fan|air delivery)\b/i.test(
      q
    )
  ) {
    return 'iaq';
  }

  // 5. Routing & Commute Transit (Priority 5)
  if (
    /\b(route|routes|routing|commute|transit|metro|bus|buses|bike|bikes|biking|cycling|walk|walking|travel|departure|car|cars|taxi|taxis)\b/i.test(
      q
    )
  ) {
    return 'route';
  }

  // 6. Weather & Current Telemetry (Priority 6)
  if (
    /\b(weather|current|pm2\.5|pm25|aqi|air quality|temperature|wind|winds|inversion|stagnation|now)\b/i.test(
      q
    ) ||
    q.includes('smog today')
  ) {
    return 'weather';
  }

  // 7. General clean air inquiries
  if (/\b(air|smoke|smog|pollution|breathe|breathing)\b/i.test(q)) {
    return 'weather';
  }

  return 'out_of_scope';
}

/**
 * Synthesizes grounded response using deterministic engines and live telemetry readings.
 */
export async function routeAndAnswerCopilot(
  query: string,
  cachedTelemetry?: Record<SectorId, SectorReading> | null
): Promise<CopilotRouteResult> {
  const intent = classifyCopilotIntent(query);

  // Fetch or fallback sector telemetry
  let readings: Record<SectorId, SectorReading>;
  if (cachedTelemetry && Object.keys(cachedTelemetry).length > 0) {
    readings = cachedTelemetry;
  } else {
    try {
      const res = await fetch('/api/ai/telemetry');
      if (res.ok) {
        const data = (await res.json()) as { sectors: Record<SectorId, SectorReading> };
        readings = data.sectors;
      } else {
        readings = getFallbackReadings();
      }
    } catch {
      readings = getFallbackReadings();
    }
  }

  const primarySector = readings.CBD ?? Object.values(readings)[0]!;

  switch (intent) {
    case 'urgent_symptoms': {
      return {
        intent,
        confidence: 1.0,
        answer:
          'CRITICAL MEDICAL NOTICE: If you or someone with you is experiencing severe shortness of breath, chest pain, inability to speak in full sentences, blue lips or nails (cyanosis), or stridor, seek emergency medical care immediately (call 911 / 112 or visit the nearest emergency room). VayuPulse provides atmospheric decision-support protocols and is not a clinical triage or emergency care service [WHO-PM25-24H].',
        citations: ['[WHO-PM25-24H]'],
      };
    }

    case 'weather': {
      const asOfTime = primarySector.asOf
        ? new Date(primarySector.asOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'recent';
      const isSim = primarySector.isSimulated;
      const statusPrefix = isSim
        ? `[Simulated telemetry: ${primarySector.fallbackReason ?? 'physics model'}]`
        : `[Live observation as of ${asOfTime} via ${primarySector.sourceLabel}]`;

      const sectorSummaries = Object.values(readings)
        .map((r) => `${r.name} (${r.zoneId}): ${r.pm25} µg/m³ (AQI ${r.aqi}, ${r.category})`)
        .join('; ');

      const deltaT = Math.round((primarySector.upperTempC - primarySector.groundTempC) * 10) / 10;
      const invMsg =
        deltaT > 0
          ? `Thermal inversion active (ΔT = +${deltaT}°C, ${primarySector.inversionSeverity} lid trapping smog at ground level). Surface winds: ${primarySector.windSpeedKmH} km/h.`
          : `No thermal inversion cap active (ΔT = ${deltaT}°C). Surface winds: ${primarySector.windSpeedKmH} km/h.`;

      return {
        intent,
        confidence: isSim ? 0.85 : 0.98,
        answer: `${statusPrefix}\n\nCurrent ambient conditions across urban sectors:\n• ${sectorSummaries}.\n\nAtmospheric dynamics: ${invMsg}\nMaintain indoor mechanical air purification and seal windows during stagnation periods [VENT-INVERSION].`,
        citations: ['[EPA-AQI-THRESH]', '[VENT-INVERSION]'],
      };
    }

    case 'forecast': {
      const forecast = generate24HourMLForecast('CBD', [], 8, {
        hourOfDay: 8,
        groundTempC: primarySector.groundTempC,
        upperTempC: primarySector.upperTempC,
        windSpeedKmH: primarySector.windSpeedKmH,
        relativeHumidity: 75,
      });

      const win = forecast.safeOutdoorWindow;
      const morningPeak = forecast.hours.find((h) => h.targetHour >= 7 && h.targetHour <= 9);
      const eveningPeak = forecast.hours.find((h) => h.targetHour >= 17 && h.targetHour <= 20);

      return {
        intent,
        confidence: 0.9,
        answer: `24-Hour ML Smog Forecast Overview:\n• Morning Inversion Peak (07:00–09:00): Forecast PM2.5 ~${morningPeak?.predictedPM25 ?? 95} µg/m³ (AQI ${morningPeak?.predictedAQI ?? 172}). Cold boundary layer caps tailpipe soot.\n• Least-Polluted Window: Between ${String(win.startTargetHour).padStart(2, '0')}:00 and ${String(win.endTargetHour).padStart(2, '0')}:59 (Forecast AQI: ~${win.averageAQI}). Solar convective heating dismantles the ground inversion.\n• Evening Re-Trapping (17:00–20:00): Forecast PM2.5 ~${eveningPeak?.predictedPM25 ?? 110} µg/m³ as surface cooling re-establishes the thermal lid.\n\nSchedule outdoor transit, school recess, and ventilation during the least-polluted solar breakup window [VENT-INVERSION].`,
        citations: ['[VENT-INVERSION]', '[WHO-PM25-24H]'],
      };
    }

    case 'route': {
      const metroRoute = dijkstraLowestExposure('RES', 'CBD', 'METRO');
      const evHepaRoute = dijkstraLowestExposure('RES', 'CBD', 'EV_HEPA');
      const busRoute = dijkstraLowestExposure('RES', 'CBD', 'ELECTRIC_BUS');
      const cycleRoute = dijkstraLowestExposure('RES', 'CBD', 'CYCLING');

      return {
        intent,
        confidence: 0.92,
        answer: `Clean-Corridor Lowest-Exposure Transit Comparison (Greenwood RES → Downtown CBD):\n1. EV / HEPA Cabin Taxi: Lowest inhaled dose (~${evHepaRoute.totalInhaledDoseMicrograms} µg dose, 85% cabin filtration efficiency) [N95-PHYSICS].\n2. Underground Metro: Premier mass-transit corridor (~${metroRoute.totalInhaledDoseMicrograms} µg dose, 75% station filtration, 40 km/h average speed).\n3. Electric Bus: ~${busRoute.totalInhaledDoseMicrograms} µg dose (40% filtration).\n4. Active Cycling / Walking: Highest inhaled dose (~${cycleRoute.totalInhaledDoseMicrograms} µg dose, elevated ventilation rate 2.3 m³/h in ambient street smog).\n\nRecommendation: Choose EV/HEPA or Metro. If commuting outdoor, plan departures for the least-polluted window (13:00–15:00) [VENT-INVERSION].`,
        citations: ['[N95-PHYSICS]', '[VENT-INVERSION]'],
      };
    }

    case 'iaq': {
      const crClearance = estimatePurificationTime(5, 4, 2.5, PURIFIER_PRESETS[0]!.cadrM3H, 0.9);
      const hepaClearance = estimatePurificationTime(5, 4, 2.5, PURIFIER_PRESETS[1]!.cadrM3H, 0.9);

      return {
        intent,
        confidence: 0.95,
        answer: `Indoor Air Quality (IAQ) & Filtration Sizing (Standard 50 m³ Room, 5m×4m×2.5m):\n• Recommended Standard: common guideline: 4–5+ ACH (5 ACH recommended, requiring ~250 m³/h CADR).\n• DIY Corsi-Rosenthal Box ($40 build, 4x MERV-13 filters + 20" box fan): Delivers ~350 m³/h CADR (${crClearance.ach} ACH). Achieves 90% particle clearance in ~${crClearance.clearanceTimeMinutes} minutes, exceeding guidelines [CR-BOX-SPEC].\n• Standard Commercial HEPA: Delivers ~250 m³/h CADR (${hepaClearance.ach} ACH). Achieves 90% clearance in ~${hepaClearance.clearanceTimeMinutes} minutes.\n• Governing Formula: t = [-ln(1 - η) × V / CADR] × 60 minutes.\nNo indoor masks required in rooms with active 4–5+ ACH mechanical filtration [CR-BOX-SPEC].`,
        citations: ['[CR-BOX-SPEC]'],
      };
    }

    case 'protocols': {
      return {
        intent,
        confidence: 0.95,
        answer: `Clinical Protection Invariants for Sensitive Personas:\n• Newborn Infants (<2 years): Masks are strictly contraindicated due to suffocation hazards, high airway resistance, and inability to adjust fit. Protect via continuous indoor HEPA filtration (>4 ACH). Suspend all outdoor stroller walks during inversions.\n• Asthmatic Children (ages 5–12): High minute ventilation per kg causes elevated particulate loading. Advise well-fitting respirators only if the child can wear one (age ≥ 2, adult supervised); consult a doctor for asthma management. Ensure quick-relief bronchodilators are immediately available [PED-ASTHMA-VULN].\n• Elderly Cardiac Patients: High vulnerability to microvascular constriction and arrhythmia. Avoid cold morning outdoor exertion; maintain continuous HEPA air cleaning [ELDER-CARD-RISK].\n• Respirator Standards: NIOSH N95 / FFP2 respirators capture >95% of 0.3 µm sub-micron particles via electrostatic fibers [N95-PHYSICS].`,
        citations: ['[PED-ASTHMA-VULN]', '[ELDER-CARD-RISK]', '[N95-PHYSICS]'],
      };
    }

    case 'out_of_scope':
    default: {
      return {
        intent: 'out_of_scope',
        confidence: 0.7,
        answer:
          'I am the VayuPulse Clean-Air Copilot, specialized in atmospheric physics, winter temperature inversions, ML smog forecasting, low-exposure transit routing, and DIY indoor air filtration sizing (Corsi-Rosenthal boxes). You can ask me about:\n• "What is the current air quality and inversion status?"\n• "When is the least-polluted outdoor window today?"\n• "Which transit mode gives the lowest inhaled PM2.5 dose?"\n• "How do I size a Corsi-Rosenthal box for my room?"\n• "What are the masking rules for infants and children?"',
        citations: ['[WHO-PM25-24H]'],
      };
    }
  }
}

function getFallbackReadings(): Record<SectorId, SectorReading> {
  const { groundTempC, upperTempC, windSpeedKmH } = DEFAULT_SIMULATED_WEATHER;
  const invRes = evaluateInversionRisk(groundTempC, upperTempC, windSpeedKmH);

  const entries = (['CBD', 'IND', 'RES', 'PRK', 'TRN'] as SectorId[]).map((id) => {
    const sector = URBAN_SECTORS[id];
    const aqiRes = calculatePM25SubIndex(sector.defaultPM25);
    return [
      id,
      {
        zoneId: id,
        name: sector.name,
        pm25: sector.defaultPM25,
        aqi: aqiRes.aqi,
        category: aqiRes.category,
        groundTempC,
        upperTempC,
        windSpeedKmH,
        inversionSeverity: invRes.severity,
        isSimulated: true,
        sourceLabel: 'Physics-Based Simulated Environmental Telemetry',
        timestamp: new Date().toISOString(),
      },
    ] as const;
  });

  return Object.fromEntries(entries) as Record<SectorId, SectorReading>;
}
