/**
 * @file server/telemetry/openMeteoSource.ts
 * @description Live telemetry from Open-Meteo (keyless, free for non-commercial use, CC-BY attribution).
 *
 * - Air quality: https://air-quality-api.open-meteo.com/v1/air-quality  (modeled CAMS data, not a sensor)
 * - Weather + upper-air temperature: https://api.open-meteo.com/v1/forecast (pressure-level temperatures)
 *
 * Design notes
 * - City-level data. The five sectors are fictional, so the city PM2.5 is split across sectors with the
 *   relative factors of URBAN_SECTORS (the city mean is preserved). Labeled as "sector split modeled".
 * - Inversion proxy: ΔT = T(upper level) - T(2 m). The upper level is chosen from the surface pressure
 *   (first standard level at least MIN_LEVEL_GAP_HPA above ground) so that high-elevation cities do not
 *   use a pressure level that is below ground.
 * - External responses are untrusted: validated with zod, range-checked, 5 s timeout.
 * - Any failure -> last good snapshot (up to 3 h, flagged) -> simulated fallback (flagged). Never silent.
 */

import { z } from 'zod';
import { URBAN_SECTORS, type SectorId } from '../../src/lib/routing';
import { calculatePM25SubIndex, evaluateInversionRisk } from '../../src/lib/aqiCompute';
import {
  SECTOR_IDS,
  SimulatedSource,
  type SectorReading,
  type TelemetrySource,
} from '../../src/lib/telemetrySource';

const PRESSURE_LEVELS_HPA = [1000, 950, 925, 850, 800, 700] as const;
const MIN_LEVEL_GAP_HPA = 60; // roughly 500 m above the surface
const STALE_AFTER_MS = 3 * 60 * 60 * 1000;
const SOURCE_LABEL = 'Open-Meteo (CAMS air quality + forecast model); city-level, sector split modeled';

const MEAN_DEFAULT_PM25 =
  SECTOR_IDS.reduce((sum, id) => sum + URBAN_SECTORS[id].defaultPM25, 0) / SECTOR_IDS.length;

const airQualitySchema = z.object({
  current: z.object({
    time: z.string(),
    pm2_5: z.number().min(0).max(1000),
  }),
});

const weatherSchema = z.object({
  current: z.object({
    time: z.string(),
    temperature_2m: z.number().min(-60).max(60),
    wind_speed_10m: z.number().min(0).max(300),
    surface_pressure: z.number().min(300).max(1100),
  }),
  hourly: z.record(z.string(), z.array(z.union([z.string(), z.number(), z.null()]))),
});

interface CitySnapshot {
  pm25: number;
  groundTempC: number;
  upperTempC: number;
  upperLevelHPa: number;
  windSpeedKmH: number;
  asOf: string;
  fetchedAt: number;
}

export interface OpenMeteoSourceOptions {
  latitude: number;
  longitude: number;
  fetchImpl?: typeof fetch;
  ttlMs?: number;
  timeoutMs?: number;
  now?: () => number;
  airQualityBaseUrl?: string;
  forecastBaseUrl?: string;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function toIsoUtc(time: string): string {
  const withZone = /Z$|[+-]\d{2}:\d{2}$/.test(time) ? time : `${time}Z`;
  const date = new Date(withZone);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid timestamp in live response');
  return date.toISOString();
}

/** Maps internal errors to a short, safe message for the UI (no URLs, no internals). */
function describeFailure(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError') return 'timeout';
    if (err.name === 'ZodError') return 'unexpected response format';
    if (err.message.startsWith('HTTP ')) return err.message;
  }
  return 'network or data error';
}

export class OpenMeteoSource implements TelemetrySource {
  public readonly name = 'Open-Meteo (city-level, modeled)';
  public readonly isSimulated = false;

  private readonly latitude: number;
  private readonly longitude: number;
  private readonly fetchImpl: typeof fetch;
  private readonly ttlMs: number;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private readonly airQualityBaseUrl: string;
  private readonly forecastBaseUrl: string;
  private cache: CitySnapshot | null = null;
  private inFlight: Promise<CitySnapshot> | null = null;

  constructor(options: OpenMeteoSourceOptions) {
    this.latitude = options.latitude;
    this.longitude = options.longitude;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.ttlMs = options.ttlMs ?? 10 * 60 * 1000;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.now = options.now ?? Date.now;
    this.airQualityBaseUrl = options.airQualityBaseUrl ?? 'https://air-quality-api.open-meteo.com';
    this.forecastBaseUrl = options.forecastBaseUrl ?? 'https://api.open-meteo.com';
  }

  public async fetchSectorTelemetry(zoneId: SectorId): Promise<SectorReading> {
    const all = await this.fetchAllSectors();
    return all[zoneId];
  }

  public async fetchAllSectors(): Promise<Record<SectorId, SectorReading>> {
    const now = this.now();

    if (this.cache && now - this.cache.fetchedAt < this.ttlMs) {
      return this.buildReadings(this.cache);
    }

    try {
      this.inFlight ??= this.fetchSnapshot().finally(() => {
        this.inFlight = null;
      });
      const snapshot = await this.inFlight;
      this.cache = snapshot;
      return this.buildReadings(snapshot);
    } catch (err) {
      const reason = describeFailure(err);
      if (this.cache && now - this.cache.fetchedAt < STALE_AFTER_MS) {
        return this.buildReadings(
          this.cache,
          `Live refresh failed (${reason}); showing the last good reading from ${this.cache.asOf}.`
        );
      }
      return new SimulatedSource(`Live feed unavailable (${reason}); showing simulated data.`).fetchAllSectors();
    }
  }

  private async getJson(url: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const doFetch = this.fetchImpl;
      const res = await doFetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  private buildUrls(): { airQuality: string; weather: string } {
    const airQuality = new URL('/v1/air-quality', this.airQualityBaseUrl);
    airQuality.searchParams.set('latitude', String(this.latitude));
    airQuality.searchParams.set('longitude', String(this.longitude));
    airQuality.searchParams.set('current', 'pm2_5,pm10');

    const weather = new URL('/v1/forecast', this.forecastBaseUrl);
    weather.searchParams.set('latitude', String(this.latitude));
    weather.searchParams.set('longitude', String(this.longitude));
    weather.searchParams.set('current', 'temperature_2m,wind_speed_10m,surface_pressure');
    weather.searchParams.set('hourly', PRESSURE_LEVELS_HPA.map((l) => `temperature_${l}hPa`).join(','));
    weather.searchParams.set('forecast_days', '1');
    weather.searchParams.set('wind_speed_unit', 'kmh');
    weather.searchParams.set('temperature_unit', 'celsius');

    return { airQuality: airQuality.toString(), weather: weather.toString() };
  }

  private async fetchSnapshot(): Promise<CitySnapshot> {
    const urls = this.buildUrls();
    const [aqRaw, wxRaw] = await Promise.all([this.getJson(urls.airQuality), this.getJson(urls.weather)]);

    const aq = airQualitySchema.parse(aqRaw);
    const wx = weatherSchema.parse(wxRaw);

    // Pick an upper level that is really above ground (925 hPa is underground in high-elevation cities).
    const maxLevel = wx.current.surface_pressure - MIN_LEVEL_GAP_HPA;
    const level = PRESSURE_LEVELS_HPA.find((l) => l <= maxLevel);
    if (level === undefined) throw new Error('No usable pressure level above ground');

    // Hourly times are GMT ("YYYY-MM-DDTHH:00"); current.time is GMT too ("YYYY-MM-DDTHH:MM").
    const hourKey = `${wx.current.time.slice(0, 13)}:00`;
    const times = wx.hourly.time ?? [];
    const index = times.findIndex((t) => t === hourKey);
    if (index < 0) throw new Error('Current hour not found in hourly data');

    const upper = wx.hourly[`temperature_${level}hPa`]?.[index];
    if (typeof upper !== 'number' || upper < -90 || upper > 60) {
      throw new Error('Upper-air temperature missing or out of range');
    }

    return {
      pm25: aq.current.pm2_5,
      groundTempC: wx.current.temperature_2m,
      upperTempC: upper,
      upperLevelHPa: level,
      windSpeedKmH: wx.current.wind_speed_10m,
      asOf: toIsoUtc(aq.current.time),
      fetchedAt: this.now(),
    };
  }

  private buildReadings(snapshot: CitySnapshot, fallbackReason?: string): Record<SectorId, SectorReading> {
    const inversion = evaluateInversionRisk(snapshot.groundTempC, snapshot.upperTempC, snapshot.windSpeedKmH);
    const timestamp = new Date(this.now()).toISOString();

    const entries = SECTOR_IDS.map((id) => {
      const sector = URBAN_SECTORS[id];
      const pm25 = round1((snapshot.pm25 * sector.defaultPM25) / MEAN_DEFAULT_PM25);
      const aqi = calculatePM25SubIndex(pm25);
      const reading: SectorReading = {
        zoneId: id,
        name: sector.name,
        pm25,
        aqi: aqi.aqi,
        category: aqi.category,
        groundTempC: snapshot.groundTempC,
        upperTempC: snapshot.upperTempC,
        windSpeedKmH: snapshot.windSpeedKmH,
        inversionSeverity: inversion.severity,
        isSimulated: false,
        sourceLabel: SOURCE_LABEL,
        timestamp,
        asOf: snapshot.asOf,
        upperLevelHPa: snapshot.upperLevelHPa,
        ...(fallbackReason !== undefined ? { fallbackReason } : {}),
      };
      return [id, reading] as const;
    });

    return Object.fromEntries(entries) as Record<SectorId, SectorReading>;
  }
}
