// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { OpenMeteoSource } from '../../server/telemetry/openMeteoSource';
import { createTelemetrySource } from '../../server/telemetry/factory';
import { SimulatedSource } from '../lib/telemetrySource';

const HOURS = Array.from({ length: 24 }, (_, h) => `2026-11-22T${String(h).padStart(2, '0')}:00`);
const flat = (value: number): number[] => HOURS.map(() => value);

function airQualityBody(pm25: number | null): unknown {
  return { current: { time: '2026-11-22T10:00', pm2_5: pm25, pm10: 90 } };
}

function weatherBody(surfacePressure: number): unknown {
  return {
    current: { time: '2026-11-22T10:15', temperature_2m: 8, wind_speed_10m: 3.5, surface_pressure: surfacePressure },
    hourly: {
      time: HOURS,
      temperature_1000hPa: flat(9),
      temperature_950hPa: flat(10),
      temperature_925hPa: flat(10.5),
      temperature_850hPa: flat(11.5),
      temperature_800hPa: flat(9),
      temperature_700hPa: flat(2),
    },
  };
}

interface FakeOptions {
  pm25?: number | null;
  surfacePressure?: number;
  failAll?: boolean;
}

function makeFetch(options: FakeOptions = {}) {
  const state = { ...options };
  const fn = vi.fn(async (input: string | URL | Request): Promise<Response> => {
    if (state.failAll) throw new TypeError('network down');
    const url = String(input);
    const body = url.includes('air-quality-api')
      ? airQualityBody(state.pm25 === undefined ? 65.4 : state.pm25)
      : weatherBody(state.surfacePressure ?? 1013);
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  return { fn, state, impl: fn as unknown as typeof fetch };
}

describe('OpenMeteoSource', () => {
  it('returns live, non-simulated readings and preserves the city mean across sectors', async () => {
    const fake = makeFetch();
    const source = new OpenMeteoSource({ latitude: 12.97, longitude: 77.59, fetchImpl: fake.impl });
    const all = await source.fetchAllSectors();

    expect(all.CBD.isSimulated).toBe(false);
    expect(all.CBD.fallbackReason).toBeUndefined();
    expect(all.CBD.asOf).toBe('2026-11-22T10:00:00.000Z');
    // pm25 equals the mean of the default factors, so sector values equal their defaults
    expect(all.CBD.pm25).toBeCloseTo(68, 1);
    expect(all.IND.pm25).toBeCloseTo(115, 1);
  });

  it('uses a pressure level above ground for the inversion proxy', async () => {
    const sea = new OpenMeteoSource({ latitude: 0, longitude: 0, fetchImpl: makeFetch({ surfacePressure: 1013 }).impl });
    const seaReading = (await sea.fetchAllSectors()).CBD;
    expect(seaReading.upperLevelHPa).toBe(950);
    expect(seaReading.upperTempC - seaReading.groundTempC).toBeCloseTo(2, 5);

    // High-elevation city (~910 hPa surface): 925 hPa would be underground, so 850 hPa is used
    const high = new OpenMeteoSource({ latitude: 0, longitude: 0, fetchImpl: makeFetch({ surfacePressure: 910 }).impl });
    const highReading = (await high.fetchAllSectors()).CBD;
    expect(highReading.upperLevelHPa).toBe(850);
    expect(highReading.upperTempC).toBeCloseTo(11.5, 5);
  });

  it('falls back to flagged simulated data when the feed is down', async () => {
    const fake = makeFetch({ failAll: true });
    const source = new OpenMeteoSource({ latitude: 1, longitude: 1, fetchImpl: fake.impl });
    const all = await source.fetchAllSectors();

    expect(all.CBD.isSimulated).toBe(true);
    expect(all.CBD.fallbackReason).toMatch(/Live feed unavailable/);
  });

  it('rejects malformed or out-of-range responses instead of trusting them', async () => {
    const source = new OpenMeteoSource({ latitude: 1, longitude: 1, fetchImpl: makeFetch({ pm25: null }).impl });
    const all = await source.fetchAllSectors();
    expect(all.RES.isSimulated).toBe(true);
    expect(all.RES.fallbackReason).toMatch(/unexpected response format/);
  });

  it('caches within the TTL (one pair of requests only)', async () => {
    const fake = makeFetch();
    const source = new OpenMeteoSource({ latitude: 1, longitude: 1, fetchImpl: fake.impl, ttlMs: 60_000 });
    await source.fetchAllSectors();
    await source.fetchAllSectors();
    expect(fake.fn).toHaveBeenCalledTimes(2);
  });

  it('serves the last good reading (flagged) for up to 3 hours, then falls back to simulated', async () => {
    let clock = 0;
    const fake = makeFetch();
    const source = new OpenMeteoSource({
      latitude: 1,
      longitude: 1,
      fetchImpl: fake.impl,
      ttlMs: 1000,
      now: () => clock,
    });

    await source.fetchAllSectors();
    fake.state.failAll = true;

    clock = 5_000;
    const stale = await source.fetchAllSectors();
    expect(stale.CBD.isSimulated).toBe(false);
    expect(stale.CBD.fallbackReason).toMatch(/last good reading/);

    clock = 4 * 60 * 60 * 1000;
    const simulated = await source.fetchAllSectors();
    expect(simulated.CBD.isSimulated).toBe(true);
  });
});

describe('createTelemetrySource', () => {
  it('defaults to simulated', () => {
    expect(createTelemetrySource({} as NodeJS.ProcessEnv)).toBeInstanceOf(SimulatedSource);
  });

  it('falls back (flagged) when coordinates are missing', async () => {
    const source = createTelemetrySource({ TELEMETRY_SOURCE: 'openmeteo' } as NodeJS.ProcessEnv);
    const reading = (await source.fetchAllSectors()).CBD;
    expect(reading.isSimulated).toBe(true);
    expect(reading.fallbackReason).toMatch(/not configured/);
  });

  it('creates the live source when coordinates are valid', () => {
    const source = createTelemetrySource({
      TELEMETRY_SOURCE: 'openmeteo',
      TELEMETRY_LAT: '12.97',
      TELEMETRY_LON: '77.59',
    } as NodeJS.ProcessEnv);
    expect(source).toBeInstanceOf(OpenMeteoSource);
    expect(source.isSimulated).toBe(false);
  });
});
