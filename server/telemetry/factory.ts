/**
 * @file server/telemetry/factory.ts
 * @description Chooses the telemetry source from environment configuration (server-side only).
 *
 * .env:
 *   TELEMETRY_SOURCE=simulated        # or: openmeteo
 *   TELEMETRY_LAT=12.97               # required when TELEMETRY_SOURCE=openmeteo
 *   TELEMETRY_LON=77.59
 */

import { SimulatedSource, type TelemetrySource } from '../../src/lib/telemetrySource';
import { OpenMeteoSource } from './openMeteoSource';

function parseCoordinate(raw: string | undefined, min: number, max: number): number | null {
  if (raw === undefined || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

export function createTelemetrySource(env: NodeJS.ProcessEnv = process.env): TelemetrySource {
  if (env.TELEMETRY_SOURCE !== 'openmeteo') {
    return new SimulatedSource();
  }

  const latitude = parseCoordinate(env.TELEMETRY_LAT, -90, 90);
  const longitude = parseCoordinate(env.TELEMETRY_LON, -180, 180);

  if (latitude === null || longitude === null) {
    // eslint-disable-next-line no-console
    console.warn('[VayuPulse AI] TELEMETRY_SOURCE=openmeteo but TELEMETRY_LAT/TELEMETRY_LON are missing or invalid; using simulated data.');
    return new SimulatedSource('Live feed not configured (missing or invalid TELEMETRY_LAT/TELEMETRY_LON).');
  }

  return new OpenMeteoSource({ latitude, longitude });
}
