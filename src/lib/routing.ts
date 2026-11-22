/**
 * @file routing.ts
 * @description Dijkstra lowest-exposure clean corridor and time-dependent transit routing engine.
 * Computes:
 * 1. Cumulative inhaled dose (µg) across 5 urban sectors and 6 transportation modes.
 * 2. Static lowest-dose pathfinding.
 * 3. Dynamic time-dependent departure optimization using 24h ML forecast.
 */

import { ForecastResult } from './mlForecast';

export type SectorId = 'CBD' | 'IND' | 'RES' | 'PRK' | 'TRN';

export interface SectorNode {
  id: SectorId;
  name: string;
  defaultPM25: number; // Base ambient PM2.5 in µg/m³
  description: string;
}

export const URBAN_SECTORS: Record<SectorId, SectorNode> = {
  CBD: {
    id: 'CBD',
    name: 'Central Business District',
    defaultPM25: 68.0,
    description: 'High-density commercial core with street canyon exhaust and moderate dispersion.',
  },
  IND: {
    id: 'IND',
    name: 'North Industrial Belt',
    defaultPM25: 115.0,
    description: 'Heavy industrial point sources, logistics hubs, and severe PM10/PM2.5 loading.',
  },
  RES: {
    id: 'RES',
    name: 'Greenwood Residential',
    defaultPM25: 42.0,
    description: 'Suburban residential zone with tree canopies and moderate domestic heating emissions.',
  },
  PRK: {
    id: 'PRK',
    name: 'Riverside Eco-Park',
    defaultPM25: 24.0,
    description: 'Riparian vegetative buffer with enhanced particulate deposition and lowest ambient smog.',
  },
  TRN: {
    id: 'TRN',
    name: 'Grand Transit Interchange',
    defaultPM25: 78.0,
    description: 'Multimodal hub with railway, metro terminus, and diesel bus idling.',
  },
};

export type TransitMode =
  | 'METRO'
  | 'EV_HEPA'
  | 'ELECTRIC_BUS'
  | 'DIESEL_BUS'
  | 'CYCLING'
  | 'WALKING';

export interface ModeProfile {
  name: string;
  averageSpeedKmH: number;
  breathingRateM3H: number; // Inhalation rate in m³/h
  cabinFiltrationEfficiency: number; // 0.0 to 1.0 (e.g. 0.85 for 85% HEPA)
  emissionFactorGCo2Km: number;
}

export const TRANSIT_MODE_PROFILES: Record<TransitMode, ModeProfile> = {
  METRO: {
    name: 'Underground Metro',
    averageSpeedKmH: 40.0,
    breathingRateM3H: 1.0,
    cabinFiltrationEfficiency: 0.75, // 75% filtration in filtered sub-surface air
    emissionFactorGCo2Km: 18.0,
  },
  EV_HEPA: {
    name: 'EV / HEPA Cabin Taxi',
    averageSpeedKmH: 35.0,
    breathingRateM3H: 0.8,
    cabinFiltrationEfficiency: 0.85, // 85% sealed recirculation cabin
    emissionFactorGCo2Km: 25.0,
  },
  ELECTRIC_BUS: {
    name: 'Electric Transit Bus',
    averageSpeedKmH: 25.0,
    breathingRateM3H: 1.1,
    cabinFiltrationEfficiency: 0.40, // 40% standard bus ventilation filter
    emissionFactorGCo2Km: 32.0,
  },
  DIESEL_BUS: {
    name: 'Diesel Commuter Bus',
    averageSpeedKmH: 22.0,
    breathingRateM3H: 1.2,
    cabinFiltrationEfficiency: 0.20, // 20% coarse filter with localized tailpipe entrainment
    emissionFactorGCo2Km: 95.0,
  },
  CYCLING: {
    name: 'Active Cycling',
    averageSpeedKmH: 15.0,
    breathingRateM3H: 2.3, // Heavy exertion ventilation rate
    cabinFiltrationEfficiency: 0.00, // Ambient exposure
    emissionFactorGCo2Km: 0.0,
  },
  WALKING: {
    name: 'Pedestrian Walking',
    averageSpeedKmH: 4.5,
    breathingRateM3H: 1.4, // Moderate exertion ventilation rate
    cabinFiltrationEfficiency: 0.00, // Ambient exposure
    emissionFactorGCo2Km: 0.0,
  },
};

export interface RouteEdge {
  from: SectorId;
  to: SectorId;
  distanceKm: number;
}

export const URBAN_GRAPH_EDGES: readonly RouteEdge[] = [
  { from: 'RES', to: 'CBD', distanceKm: 6.5 },
  { from: 'CBD', to: 'RES', distanceKm: 6.5 },

  { from: 'RES', to: 'PRK', distanceKm: 4.0 },
  { from: 'PRK', to: 'RES', distanceKm: 4.0 },

  { from: 'PRK', to: 'CBD', distanceKm: 5.2 },
  { from: 'CBD', to: 'PRK', distanceKm: 5.2 },

  { from: 'CBD', to: 'TRN', distanceKm: 3.5 },
  { from: 'TRN', to: 'CBD', distanceKm: 3.5 },

  { from: 'TRN', to: 'IND', distanceKm: 7.0 },
  { from: 'IND', to: 'TRN', distanceKm: 7.0 },

  { from: 'RES', to: 'TRN', distanceKm: 8.0 },
  { from: 'TRN', to: 'RES', distanceKm: 8.0 },

  { from: 'PRK', to: 'TRN', distanceKm: 6.0 },
  { from: 'TRN', to: 'PRK', distanceKm: 6.0 },

  { from: 'CBD', to: 'IND', distanceKm: 9.5 },
  { from: 'IND', to: 'CBD', distanceKm: 9.5 },
];

export interface RouteSegment {
  from: SectorId;
  to: SectorId;
  distanceKm: number;
  durationMinutes: number;
  segmentPM25: number;
  segmentDoseMicrograms: number;
}

export interface RoutePlanResult {
  origin: SectorId;
  destination: SectorId;
  mode: TransitMode;
  path: SectorId[];
  pathNames: string[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
  totalInhaledDoseMicrograms: number;
  segments: RouteSegment[];
}

/**
 * Calculates cumulative inhaled dose for a path:
 * Dose = sum( (distance / speed) * C_PM2.5 * ventilationRate * (1 - filtrationEfficiency) )
 */
export function calculateInhaledDose(
  distanceKm: number,
  concentrationPM25: number,
  mode: TransitMode
): { durationHours: number; doseMicrograms: number } {
  const profile = TRANSIT_MODE_PROFILES[mode];
  const durationHours = distanceKm / profile.averageSpeedKmH;
  // Concentration is µg/m³, ventilation is m³/h -> Dose = hours * (µg/m³) * (m³/h) * (1 - eff) = µg
  const dose =
    durationHours *
    concentrationPM25 *
    profile.breathingRateM3H *
    (1 - profile.cabinFiltrationEfficiency);

  return {
    durationHours,
    doseMicrograms: Math.round(dose * 100) / 100,
  };
}

/**
 * Static lowest-exposure Dijkstra pathfinder across the urban graph.
 * 
 * @param origin Starting SectorId
 * @param destination Target SectorId
 * @param mode Transit mode
 * @param zoneConcentrations Map of sector -> current PM2.5 (µg/m³)
 */
export function dijkstraLowestExposure(
  origin: SectorId,
  destination: SectorId,
  mode: TransitMode,
  zoneConcentrations: Partial<Record<SectorId, number>> = {}
): RoutePlanResult {
  const allNodes: SectorId[] = ['CBD', 'IND', 'RES', 'PRK', 'TRN'];

  // Guard against non-existent / unreachable nodes immediately
  if (!allNodes.includes(origin) || !allNodes.includes(destination)) {
    return {
      origin,
      destination,
      mode,
      path: [],
      pathNames: [],
      totalDistanceKm: 0,
      totalDurationMinutes: 0,
      totalInhaledDoseMicrograms: Infinity,
      segments: [],
    };
  }

  const distances: Record<SectorId, number> = {
    CBD: Infinity,
    IND: Infinity,
    RES: Infinity,
    PRK: Infinity,
    TRN: Infinity,
  };
  const previous: Record<SectorId, SectorId | null> = {
    CBD: null,
    IND: null,
    RES: null,
    PRK: null,
    TRN: null,
  };
  const visited = new Set<SectorId>();

  distances[origin] = 0;

  // Build adjacency
  const adj = new Map<SectorId, { to: SectorId; distanceKm: number }[]>();
  for (const n of allNodes) adj.set(n, []);
  for (const edge of URBAN_GRAPH_EDGES) {
    adj.get(edge.from)?.push({ to: edge.to, distanceKm: edge.distanceKm });
  }

  while (visited.size < allNodes.length) {
    // Find unvisited node with minimal cumulative dose
    let current: SectorId | null = null;
    let minDose = Infinity;
    for (const node of allNodes) {
      if (!visited.has(node) && (distances[node] ?? Infinity) < minDose) {
        minDose = distances[node] ?? Infinity;
        current = node;
      }
    }

    if (!current || minDose === Infinity) break;
    if (current === destination) break;

    visited.add(current);

    const neighbors = adj.get(current) ?? [];
    for (const edge of neighbors) {
      if (visited.has(edge.to)) continue;

      // Effective PM2.5 on segment: average of origin and destination sector
      const cFrom = zoneConcentrations[current] ?? URBAN_SECTORS[current].defaultPM25;
      const cTo = zoneConcentrations[edge.to] ?? URBAN_SECTORS[edge.to].defaultPM25;
      const avgPM25 = (cFrom + cTo) / 2;

      const { doseMicrograms } = calculateInhaledDose(edge.distanceKm, avgPM25, mode);
      const newDose = (distances[current] ?? 0) + doseMicrograms;

      if (newDose < (distances[edge.to] ?? Infinity)) {
        distances[edge.to] = newDose;
        previous[edge.to] = current;
      }
    }
  }

  // If destination is unreachable
  if (distances[destination] === Infinity || (origin !== destination && previous[destination] === null)) {
    return {
      origin,
      destination,
      mode,
      path: [],
      pathNames: [],
      totalDistanceKm: 0,
      totalDurationMinutes: 0,
      totalInhaledDoseMicrograms: Infinity,
      segments: [],
    };
  }

  // Reconstruct path
  const path: SectorId[] = [];
  let curr: SectorId | null = destination;
  const loopGuard = new Set<SectorId>();
  while (curr !== null && curr !== undefined && !loopGuard.has(curr)) {
    loopGuard.add(curr);
    path.unshift(curr);
    if (curr === origin) break;
    curr = previous[curr] ?? null;
  }

  if (path[0] !== origin) {
    // Destination unreachable
    return {
      origin,
      destination,
      mode,
      path: [],
      pathNames: [],
      totalDistanceKm: 0,
      totalDurationMinutes: 0,
      totalInhaledDoseMicrograms: Infinity,
      segments: [],
    };
  }

  // Calculate detailed segments
  const segments: RouteSegment[] = [];
  let totalDist = 0;
  let totalMin = 0;
  let totalDose = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i]!;
    const to = path[i + 1]!;
    const edge = URBAN_GRAPH_EDGES.find((e) => e.from === from && e.to === to);
    const dist = edge ? edge.distanceKm : 5.0;

    const cFrom = zoneConcentrations[from] ?? URBAN_SECTORS[from].defaultPM25;
    const cTo = zoneConcentrations[to] ?? URBAN_SECTORS[to].defaultPM25;
    const avgPM25 = (cFrom + cTo) / 2;

    const { durationHours, doseMicrograms } = calculateInhaledDose(dist, avgPM25, mode);
    const durationMin = Math.round(durationHours * 60 * 10) / 10;

    totalDist += dist;
    totalMin += durationMin;
    totalDose += doseMicrograms;

    segments.push({
      from,
      to,
      distanceKm: dist,
      durationMinutes: durationMin,
      segmentPM25: Math.round(avgPM25 * 10) / 10,
      segmentDoseMicrograms: doseMicrograms,
    });
  }

  return {
    origin,
    destination,
    mode,
    path,
    pathNames: path.map((id) => URBAN_SECTORS[id].name),
    totalDistanceKm: Math.round(totalDist * 10) / 10,
    totalDurationMinutes: Math.round(totalMin * 10) / 10,
    totalInhaledDoseMicrograms: Math.round(totalDose * 100) / 100,
    segments,
  };
}

export interface TimeDependentDepartureResult {
  bestDepartureHourOffset: number; // 0 (leave now) to 11 (in 11 hours)
  departureClockHour: number; // 0 to 23
  bestDoseMicrograms: number;
  leaveNowDoseMicrograms: number;
  doseReductionPercent: number; // e.g. 31%
  isFlatForecast: boolean;
  advice: string;
  hourlyDoses: { hourOffset: number; clockHour: number; doseMicrograms: number }[];
}

/**
 * Time-dependent transit pathfinder using dynamic 24-hour ML forecast concentrations.
 * Consumes hourly forecast and optimizes departure time over the next 12 hours.
 * 
 * Requirement: Must reduce to the static version when the forecast is flat.
 */
export function dijkstraTimeDependent(
  origin: SectorId,
  destination: SectorId,
  mode: TransitMode,
  forecast: ForecastResult,
  currentHourOfDay: number
): TimeDependentDepartureResult {
  const hourlyDoses: { hourOffset: number; clockHour: number; doseMicrograms: number }[] = [];

  // Check if forecast is flat across horizon
  const firstPredicted = forecast.hours[0]?.predictedPM25 ?? 50.0;
  const isFlatForecast =
    forecast.hours.length === 0 ||
    forecast.hours.every((h) => Math.abs(h.predictedPM25 - firstPredicted) < 0.01);

  let bestOffset = 0;
  let minDose = Infinity;
  let leaveNowDose = 0;

  for (let offset = 0; offset < 12; offset++) {
    const clockHour = (currentHourOfDay + offset) % 24;
    const forecastHour = forecast.hours[offset] ?? forecast.hours[0];
    const predictedPM25 = forecastHour ? forecastHour.predictedPM25 : firstPredicted;

    // Scale sector base concentrations proportionally by forecast ratio
    const scaleRatio = predictedPM25 / 50.0;
    const dynamicConcentrations: Partial<Record<SectorId, number>> = {
      CBD: URBAN_SECTORS.CBD.defaultPM25 * scaleRatio,
      IND: URBAN_SECTORS.IND.defaultPM25 * scaleRatio,
      RES: URBAN_SECTORS.RES.defaultPM25 * scaleRatio,
      PRK: URBAN_SECTORS.PRK.defaultPM25 * scaleRatio,
      TRN: URBAN_SECTORS.TRN.defaultPM25 * scaleRatio,
    };

    const route = dijkstraLowestExposure(origin, destination, mode, dynamicConcentrations);
    const dose = route.totalInhaledDoseMicrograms;

    if (offset === 0) {
      leaveNowDose = dose;
    }

    if (dose < minDose) {
      minDose = dose;
      bestOffset = offset;
    }

    hourlyDoses.push({
      hourOffset: offset,
      clockHour,
      doseMicrograms: dose,
    });
  }

  // Handle unreachable destination
  if (minDose === Infinity || leaveNowDose === Infinity) {
    return {
      bestDepartureHourOffset: 0,
      departureClockHour: currentHourOfDay,
      bestDoseMicrograms: Infinity,
      leaveNowDoseMicrograms: Infinity,
      doseReductionPercent: 0,
      isFlatForecast: true,
      advice: 'Destination sector is currently unreachable via transit network.',
      hourlyDoses,
    };
  }

  const rawReduction =
    leaveNowDose > 0 && minDose < leaveNowDose
      ? ((leaveNowDose - minDose) / leaveNowDose) * 100
      : 0;
  const doseReductionPercent = Math.round(rawReduction * 10) / 10;

  const bestTargetHour = (currentHourOfDay + bestOffset) % 24;
  const formattedBestTime = `${String(bestTargetHour).padStart(2, '0')}:00`;
  const formattedCurrentTime = `${String(currentHourOfDay).padStart(2, '0')}:00`;

  let advice: string;
  if (isFlatForecast || doseReductionPercent <= 1.0 || bestOffset === 0) {
    advice = `Forecast air quality remains steady or worsens later. Leaving now at ${formattedCurrentTime} is optimal (~${leaveNowDose.toFixed(1)} µg dose).`;
  } else {
    advice = `Leave at ${formattedBestTime} instead of ${formattedCurrentTime} to inhale ${doseReductionPercent}% less PM2.5 (reduces inhaled dose from ${leaveNowDose.toFixed(1)} µg to ${minDose.toFixed(1)} µg).`;
  }

  return {
    bestDepartureHourOffset: bestOffset,
    departureClockHour: bestTargetHour,
    bestDoseMicrograms: minDose,
    leaveNowDoseMicrograms: leaveNowDose,
    doseReductionPercent,
    isFlatForecast,
    advice,
    hourlyDoses,
  };
}
