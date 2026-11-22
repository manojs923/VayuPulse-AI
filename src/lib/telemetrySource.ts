/**
 * @file src/lib/telemetrySource.ts
 * @description Client-safe telemetry types + the simulated source.
 *
 * The live adapter (OpenMeteoSource) lives in server/telemetry/ because it calls the network and
 * must never be bundled into the client. The browser reads telemetry from GET /api/ai/telemetry.
 *
 * Data-honesty rule: `isSimulated` is only false when the numbers really came from a live feed.
 * When a live source fails, it falls back to SimulatedSource with `fallbackReason` set.
 */

import { URBAN_SECTORS, type SectorId } from './routing';
import { calculatePM25SubIndex, evaluateInversionRisk } from './aqiCompute';

export const SECTOR_IDS: readonly SectorId[] = ['CBD', 'IND', 'RES', 'PRK', 'TRN'];

export type InversionSeverity = 'NONE' | 'MODERATE' | 'SEVERE' | 'CRITICAL';

export interface SectorReading {
  zoneId: SectorId;
  name: string;
  pm25: number;
  aqi: number;
  category: string;
  groundTempC: number;
  upperTempC: number;
  windSpeedKmH: number;
  inversionSeverity: InversionSeverity;
  isSimulated: boolean;
  sourceLabel: string;
  /** When this reading object was produced. */
  timestamp: string;
  /** Live sources only: when the underlying observation / model step is valid. */
  asOf?: string;
  /** Live sources only: pressure level (hPa) used as the "upper" temperature for the inversion proxy. */
  upperLevelHPa?: number;
  /** Set when live data was unavailable (simulated fallback) or is stale (last good reading). */
  fallbackReason?: string;
}

export interface TelemetrySource {
  readonly name: string;
  /** Static hint only. Use each reading's `isSimulated` / `fallbackReason` as the truth. */
  readonly isSimulated: boolean;
  fetchSectorTelemetry(zoneId: SectorId): Promise<SectorReading>;
  fetchAllSectors(): Promise<Record<SectorId, SectorReading>>;
}

/**
 * Single source of truth for the simulated weather. (The old gateway used 8.0 / 11.5 / 3.5 while this
 * file used 7.5 / 11.2 / 3.2: pick one set and use it everywhere.)
 */
export const DEFAULT_SIMULATED_WEATHER = {
  groundTempC: 7.5,
  upperTempC: 11.2,
  windSpeedKmH: 3.2,
} as const;

/**
 * Default physics-based simulated telemetry source.
 * @param fallbackReason When provided, readings are labeled as a fallback for a failed live feed.
 */
export class SimulatedSource implements TelemetrySource {
  public readonly name = 'Physics-Based Simulated Environmental Telemetry';
  public readonly isSimulated = true;
  private readonly fallbackReason: string | undefined;

  constructor(fallbackReason?: string) {
    this.fallbackReason = fallbackReason;
  }

  public async fetchSectorTelemetry(zoneId: SectorId): Promise<SectorReading> {
    const sector = URBAN_SECTORS[zoneId];
    const { groundTempC, upperTempC, windSpeedKmH } = DEFAULT_SIMULATED_WEATHER;
    const aqiRes = calculatePM25SubIndex(sector.defaultPM25);
    const invRes = evaluateInversionRisk(groundTempC, upperTempC, windSpeedKmH);

    return {
      zoneId: sector.id,
      name: sector.name,
      pm25: sector.defaultPM25,
      aqi: aqiRes.aqi,
      category: aqiRes.category,
      groundTempC,
      upperTempC,
      windSpeedKmH,
      inversionSeverity: invRes.severity,
      isSimulated: true,
      sourceLabel:
        this.fallbackReason !== undefined ? 'Simulated (live feed unavailable)' : this.name,
      timestamp: new Date().toISOString(),
      ...(this.fallbackReason !== undefined ? { fallbackReason: this.fallbackReason } : {}),
    };
  }

  public async fetchAllSectors(): Promise<Record<SectorId, SectorReading>> {
    const entries = await Promise.all(
      SECTOR_IDS.map(async (id) => [id, await this.fetchSectorTelemetry(id)] as const)
    );
    return Object.fromEntries(entries) as Record<SectorId, SectorReading>;
  }
}

/**
 * Client-safe default. Live sources are created server-side (server/telemetry/factory.ts) and the
 * browser should call GET /api/ai/telemetry instead of choosing a source itself.
 */
export function getActiveTelemetrySource(): TelemetrySource {
  return new SimulatedSource();
}
