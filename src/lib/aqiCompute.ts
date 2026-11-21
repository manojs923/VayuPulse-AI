/**
 * @file aqiCompute.ts
 * @description Deterministic physics and pure compute engine for VayuPulse AI.
 * Implements:
 * 1. EPA piecewise linear interpolation for PM2.5 AQI (2024 revised EPA standard).
 * 2. Boundary-layer temperature inversion risk proxy (upper vs. ground temp + wind stagnation).
 * 3. Single-compartment CADR mass-balance decay calculation and 4-ACH sizing.
 */

export interface AQICategory {
  name: 'Good' | 'Moderate' | 'Unhealthy for Sensitive Groups' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous' | 'Beyond Index';
  color: string;
  healthAdvisory: string;
}

export interface EPAIndexResult {
  aqi: number;
  category: AQICategory['name'];
  color: string;
  healthAdvisory: string;
  isCapped: boolean;
  truncatedPM25: number;
}

/**
 * EPA 2024 PM2.5 Breakpoints (Federal Register / EPA-454/B-24-001 revisions)
 * Concentrations in µg/m³, AQI values 0–500.
 */
interface Breakpoint {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
  category: AQICategory['name'];
  color: string;
  advisory: string;
}

const EPA_PM25_BREAKPOINTS: readonly Breakpoint[] = [
  {
    cLow: 0.0,
    cHigh: 9.0,
    iLow: 0,
    iHigh: 50,
    category: 'Good',
    color: '#10b981', // Emerald
    advisory: 'Air quality is satisfactory, and air pollution poses little or no risk.',
  },
  {
    cLow: 9.1,
    cHigh: 35.4,
    iLow: 51,
    iHigh: 100,
    category: 'Moderate',
    color: '#f59e0b', // Amber
    advisory: 'Air quality is acceptable. Sensitive individuals should consider reducing prolonged heavy outdoor exertion.',
  },
  {
    cLow: 35.5,
    cHigh: 55.4,
    iLow: 101,
    iHigh: 150,
    category: 'Unhealthy for Sensitive Groups',
    color: '#f97316', // Orange
    advisory: 'Children, elderly, and people with respiratory/cardiac disease should limit prolonged outdoor exertion.',
  },
  {
    cLow: 55.5,
    cHigh: 125.4,
    iLow: 151,
    iHigh: 200,
    category: 'Unhealthy',
    color: '#ef4444', // Red
    advisory: 'Everyone may begin to experience health effects; members of sensitive groups may experience more serious effects.',
  },
  {
    cLow: 125.5,
    cHigh: 225.4,
    iLow: 201,
    iHigh: 300,
    category: 'Very Unhealthy',
    color: '#8b5cf6', // Purple
    advisory: 'Health alert: The risk of health effects is increased for everyone. Avoid strenuous outdoor activity.',
  },
  {
    cLow: 225.5,
    cHigh: 325.4,
    iLow: 301,
    iHigh: 400,
    category: 'Hazardous',
    color: '#7f1d1d', // Maroon
    advisory: 'Emergency conditions: The entire population is more likely to be affected. Avoid all outdoor exertion.',
  },
  {
    cLow: 325.5,
    cHigh: 500.4,
    iLow: 401,
    iHigh: 500,
    category: 'Hazardous',
    color: '#4c0519', // Dark Maroon
    advisory: 'Catastrophic health warnings: Avoid all physical activities outdoors; keep indoor air scrubbed.',
  },
];

/**
 * Calculates the EPA AQI Sub-Index for PM2.5 using EPA piecewise linear interpolation.
 * EPA Standard Revision: 2024 Updated National Ambient Air Quality Standards (NAAQS).
 * 
 * Formula:
 *   I = ((I_Hi - I_Lo) / (BP_Hi - BP_Lo)) * (C_p - BP_Lo) + I_Lo
 * 
 * @param pm25 Raw concentration in µg/m³
 * @returns EPAIndexResult with calculated index, advisory, and capping metadata
 * @throws Error if pm25 is negative or NaN/Infinite
 */
export function calculatePM25SubIndex(pm25: number): EPAIndexResult {
  if (typeof pm25 !== 'number' || isNaN(pm25) || !isFinite(pm25)) {
    throw new Error('PM2.5 concentration must be a finite number.');
  }
  if (pm25 < 0) {
    throw new Error('PM2.5 concentration cannot be negative.');
  }

  // EPA Rule: Truncate concentration to 1 decimal place
  const truncated = Math.floor(pm25 * 10) / 10;

  // Values exceeding 500.4 µg/m³ cap at AQI 500 with isCapped = true
  if (truncated > 500.4) {
    return {
      aqi: 500,
      category: 'Beyond Index',
      color: '#3b0764',
      healthAdvisory: 'Extremely hazardous particulate levels exceeding standard EPA AQI scale (>500.4 µg/m³). Stay indoors with continuous air filtration.',
      isCapped: true,
      truncatedPM25: truncated,
    };
  }

  for (const bp of EPA_PM25_BREAKPOINTS) {
    if (truncated >= bp.cLow && truncated <= bp.cHigh) {
      const aqi = Math.round(
        ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (truncated - bp.cLow) + bp.iLow
      );
      return {
        aqi: Math.min(500, Math.max(0, aqi)),
        category: bp.category,
        color: bp.color,
        healthAdvisory: bp.advisory,
        isCapped: false,
        truncatedPM25: truncated,
      };
    }
  }

  // Fallback edge case if between floating point intervals (e.g. 9.05 truncated is 9.0)
  const lastBp = EPA_PM25_BREAKPOINTS[EPA_PM25_BREAKPOINTS.length - 1]!;
  return {
    aqi: 500,
    category: 'Hazardous',
    color: lastBp.color,
    healthAdvisory: lastBp.advisory,
    isCapped: true,
    truncatedPM25: truncated,
  };
}

/**
 * Inversion Severity Levels.
 */
export type InversionSeverity = 'NONE' | 'MODERATE' | 'SEVERE' | 'CRITICAL';

export interface InversionRiskResult {
  deltaT: number; // T_upper - T_ground (°C)
  windSpeedKmH: number;
  severity: InversionSeverity;
  trappingMultiplier: number;
  expectedBreakupWindow: string;
  simplifiedProxyNotice: string;
  summary: string;
}

/**
 * Evaluates the risk of a boundary-layer temperature inversion capping urban particulates.
 * Physics proxy:
 *   Delta T = T_upper - T_ground
 *   Positive Delta T indicates warmer air aloft capping colder ground air (temperature inversion).
 *   Wind speeds < 6 km/h indicate stagnant mechanical mixing.
 * 
 * NOTE: This is a simplified inversion proxy, not a vertical atmospheric sounding.
 *
 * @param tGround Ground temperature in °C
 * @param tUpper Upper boundary-layer temperature (~300m AGL proxy) in °C
 * @param windSpeedKmH Surface wind speed in km/h
 */
export function evaluateInversionRisk(
  tGround: number,
  tUpper: number,
  windSpeedKmH: number
): InversionRiskResult {
  if (!isFinite(tGround) || !isFinite(tUpper) || !isFinite(windSpeedKmH)) {
    throw new Error('Temperatures and wind speed must be valid finite numbers.');
  }
  if (windSpeedKmH < 0) {
    throw new Error('Wind speed cannot be negative.');
  }

  const deltaT = Math.round((tUpper - tGround) * 10) / 10;
  const isStagnant = windSpeedKmH < 6.0;

  let severity: InversionSeverity = 'NONE';
  let trappingMultiplier = 1.0;
  let expectedBreakupWindow = 'Normal atmospheric dispersion active; no inversion cap detected.';

  if (deltaT <= 0) {
    severity = 'NONE';
    trappingMultiplier = 1.0;
    expectedBreakupWindow = 'Normal vertical lapse rate active. Pollutants mix and disperse freely.';
  } else if (deltaT < 2.0) {
    severity = isStagnant ? 'MODERATE' : 'NONE';
    trappingMultiplier = isStagnant ? 1.4 : 1.1;
    expectedBreakupWindow = isStagnant
      ? 'Weak capping lid. Expected breakup within 2–3 hours after sunrise as solar radiation warms ground.'
      : 'Wind shear is sufficient to disrupt shallow temperature inversion.';
  } else if (deltaT < 5.0) {
    severity = isStagnant ? 'SEVERE' : 'MODERATE';
    trappingMultiplier = isStagnant ? 2.2 : 1.5;
    expectedBreakupWindow = 'Strong thermal lid. Convective breakup delayed until peak solar noon (12:00–14:00).';
  } else {
    // deltaT >= 5.0 °C
    severity = 'CRITICAL';
    trappingMultiplier = isStagnant ? 3.5 : 2.6;
    expectedBreakupWindow = 'Severe persistent inversion layer. High risk of multi-day smog trapping without frontal passage.';
  }

  const summary = `Delta T = ${deltaT > 0 ? '+' : ''}${deltaT}°C, Wind = ${windSpeedKmH} km/h -> Severity: ${severity} (Trapping multiplier: ${trappingMultiplier.toFixed(1)}x).`;

  return {
    deltaT,
    windSpeedKmH,
    severity,
    trappingMultiplier,
    expectedBreakupWindow,
    simplifiedProxyNotice: 'Simplified inversion proxy, not a vertical sounding.',
    summary,
  };
}

export interface CADRClearanceResult {
  clearanceTimeMinutes: number;
  ach: number;
  roomVolumeM3: number;
  targetReductionPercent: number;
  meets4ACHStandard: boolean;
  recommendedCADR4ACH: number;
  assumptions: string[];
}

export interface PurifierPreset {
  name: string;
  cadrM3H: number;
  approximateCostUSD: number;
  noiseLevelDb: number;
  notes: string;
}

export const PURIFIER_PRESETS: readonly PurifierPreset[] = [
  {
    name: 'DIY Corsi-Rosenthal Box (4x MERV 13 + Box Fan)',
    cadrM3H: 350,
    approximateCostUSD: 40,
    noiseLevelDb: 52,
    notes: 'Low-cost, high-throughput open-source build with superior particle clearance.',
  },
  {
    name: 'Standard Commercial HEPA Unit',
    cadrM3H: 250,
    approximateCostUSD: 160,
    noiseLevelDb: 48,
    notes: 'Compact certified HEPA H13 filtration unit.',
  },
  {
    name: 'High-Capacity Dual-HEPA Tower',
    cadrM3H: 500,
    approximateCostUSD: 380,
    noiseLevelDb: 58,
    notes: 'Heavy duty unit suitable for large communal rooms and school halls.',
  },
];

/**
 * Calculates purification time and Air Changes per Hour (ACH) using
 * single-compartment mass-balance decay:
 * 
 *   t = ((-ln(1 - eta) * V) / CADR) * 60 minutes
 * 
 * Assumptions:
 * - Well-mixed single compartment air.
 * - Negligible envelope infiltration during clearance period.
 * - No active continuous indoor emission sources (e.g. frying, smoking).
 *
 * @param lengthM Room length in meters (> 0)
 * @param widthM Room width in meters (> 0)
 * @param heightM Room height in meters (> 0)
 * @param cadrM3H Clean Air Delivery Rate in m³/h (> 0)
 * @param targetEfficiency Fractional particle reduction target (0 < eta < 1, e.g. 0.90 for 90%)
 */
export function estimatePurificationTime(
  lengthM: number,
  widthM: number,
  heightM: number,
  cadrM3H: number,
  targetEfficiency: number = 0.90
): CADRClearanceResult {
  if (
    !isFinite(lengthM) ||
    !isFinite(widthM) ||
    !isFinite(heightM) ||
    !isFinite(cadrM3H) ||
    !isFinite(targetEfficiency)
  ) {
    throw new Error('All CADR arguments must be finite numbers.');
  }

  if (lengthM <= 0 || widthM <= 0 || heightM <= 0) {
    throw new Error('Room dimensions must be strictly positive.');
  }

  if (cadrM3H <= 0) {
    throw new Error('CADR must be strictly greater than 0.');
  }

  if (targetEfficiency <= 0 || targetEfficiency >= 1) {
    throw new Error('Target efficiency must be strictly between 0 and 1 (e.g. 0.90 for 90%).');
  }

  const roomVolumeM3 = lengthM * widthM * heightM;
  const ach = cadrM3H / roomVolumeM3;
  const recommendedCADR4ACH = roomVolumeM3 * 4.0;
  const meets4ACHStandard = ach >= 4.0;

  // Single compartment mass balance exponential decay
  const minutes = ((-Math.log(1 - targetEfficiency) * roomVolumeM3) / cadrM3H) * 60;
  const clearanceTimeMinutes = Math.round(minutes * 10) / 10;

  return {
    clearanceTimeMinutes,
    ach: Math.round(ach * 100) / 100,
    roomVolumeM3: Math.round(roomVolumeM3 * 100) / 100,
    targetReductionPercent: Math.round(targetEfficiency * 100),
    meets4ACHStandard,
    recommendedCADR4ACH: Math.round(recommendedCADR4ACH),
    assumptions: [
      'Room air is uniformly and continuously mixed.',
      'Infiltration of outdoor pollutants during clearance is assumed negligible.',
      'Indoor particle source is suppressed during the clearance run.',
    ],
  };
}
