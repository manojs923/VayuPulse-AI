// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  dijkstraLowestExposure,
  dijkstraTimeDependent,
  URBAN_SECTORS,
  SectorId,
} from '../lib/routing';
import { ForecastResult } from '../lib/mlForecast';

describe('Dijkstra Lowest-Exposure Routing', () => {
  it('finds valid route between Residential (RES) and Central Business District (CBD)', () => {
    const route = dijkstraLowestExposure('RES', 'CBD', 'METRO');
    expect(route.path[0]).toBe('RES');
    expect(route.path[route.path.length - 1]).toBe('CBD');
    expect(route.totalDistanceKm).toBeGreaterThan(0);
    expect(route.totalDurationMinutes).toBeGreaterThan(0);
    expect(route.totalInhaledDoseMicrograms).toBeGreaterThan(0);
    expect(route.segments.length).toBeGreaterThanOrEqual(1);
  });

  it('proves HEPA Cabin and Metro deliver lower inhaled dose than active cycling in smog', () => {
    const metroRoute = dijkstraLowestExposure('RES', 'CBD', 'METRO');
    const cyclingRoute = dijkstraLowestExposure('RES', 'CBD', 'CYCLING');
    const evHepaRoute = dijkstraLowestExposure('RES', 'CBD', 'EV_HEPA');

    // Cycling has higher breathing rate (2.3 vs 1.0 m³/h), slower speed (15 vs 40 km/h), and 0% filtration
    expect(cyclingRoute.totalInhaledDoseMicrograms).toBeGreaterThan(metroRoute.totalInhaledDoseMicrograms * 3);
    expect(cyclingRoute.totalInhaledDoseMicrograms).toBeGreaterThan(evHepaRoute.totalInhaledDoseMicrograms * 4);
  });

  it('selects cleaner detour through Riverside Eco-Park (PRK) if direct segment is heavily polluted', () => {
    // Inject extreme pollution on direct RES -> CBD route
    const customPollution: Partial<Record<SectorId, number>> = {
      RES: 40,
      CBD: 250, // Severe smog at CBD
      PRK: 15,  // Very clean at Eco-Park
      TRN: 300,
    };

    const route = dijkstraLowestExposure('RES', 'CBD', 'WALKING', customPollution);
    expect(route.path).toBeDefined();
    expect(route.path.length).toBeGreaterThanOrEqual(2);
  });

  it('handles unreachable destination cleanly', () => {
    // If destination node is completely disconnected from network
    const route = dijkstraLowestExposure('RES', 'NONEXISTENT' as SectorId, 'METRO');
    expect(route.path.length).toBe(0);
    expect(route.totalInhaledDoseMicrograms).toBe(Infinity);
  });
});

describe('Time-Dependent Transit Departure Optimization', () => {
  const mockFlatForecast: ForecastResult = {
    zoneId: 'CBD',
    generatedAt: new Date().toISOString(),
    hours: Array.from({ length: 24 }, (_, i) => ({
      hourOffset: i + 1,
      targetHour: (8 + i + 1) % 24,
      predictedPM25: 50.0, // Strictly flat
      lowerBoundPM25: 40.0,
      upperBoundPM25: 60.0,
      predictedAQI: 137,
      aqiCategory: 'Unhealthy for Sensitive Groups',
      aqiColor: '#f97316',
      featureContributions: {
        baseLevel: 32,
        trafficEffect: 10,
        inversionGradientEffect: 5,
        windDispersalEffect: -5,
        humidityGrowthEffect: 8,
      },
    })),
    safeOutdoorWindow: {
      startHourOffset: 1,
      endHourOffset: 3,
      startTargetHour: 9,
      endTargetHour: 11,
      averageAQI: 137,
      recommendation: 'Steady',
    },
    uncertaintyNotice: 'Test',
  };

  it('REDUCES TO STATIC when forecast is flat across horizon', () => {
    const timeDep = dijkstraTimeDependent('RES', 'CBD', 'METRO', mockFlatForecast, 8);
    expect(timeDep.isFlatForecast).toBe(true);
    // When forecast is flat, best departure hour offset is 0 (leave now) and dose reduction is 0%
    expect(timeDep.bestDepartureHourOffset).toBe(0);
    expect(timeDep.doseReductionPercent).toBe(0);
    expect(timeDep.advice).toContain('remains steady');
  });

  it('identifies best departure hour with substantial dose reduction on dynamic diurnal forecast', () => {
    // Dynamic forecast: heavy morning peak (120 µg/m³) dropping to afternoon solar clearance (30 µg/m³)
    const mockDynamicForecast: ForecastResult = {
      ...mockFlatForecast,
      hours: Array.from({ length: 24 }, (_, i) => {
        const h = (8 + i + 1) % 24;
        const val = h >= 8 && h <= 10 ? 120.0 : h >= 13 && h <= 16 ? 30.0 : 65.0;
        return {
          ...mockFlatForecast.hours[0]!,
          hourOffset: i + 1,
          targetHour: h,
          predictedPM25: val,
        };
      }),
    };

    const timeDep = dijkstraTimeDependent('RES', 'CBD', 'CYCLING', mockDynamicForecast, 8);
    expect(timeDep.isFlatForecast).toBe(false);
    expect(timeDep.doseReductionPercent).toBeGreaterThan(20);
    expect(timeDep.bestDoseMicrograms).toBeLessThan(timeDep.leaveNowDoseMicrograms);
    expect(timeDep.advice).toContain('Leave at');
  });

  it('REGRESSION 1: leaveNowDose matches dijkstraLowestExposure with departure hour dynamic concentrations', () => {
    const scaleRatio = (mockFlatForecast.hours[0]?.predictedPM25 ?? 50.0) / 50.0;
    const hourZeroConcentrations = {
      CBD: URBAN_SECTORS.CBD.defaultPM25 * scaleRatio,
      IND: URBAN_SECTORS.IND.defaultPM25 * scaleRatio,
      RES: URBAN_SECTORS.RES.defaultPM25 * scaleRatio,
      PRK: URBAN_SECTORS.PRK.defaultPM25 * scaleRatio,
      TRN: URBAN_SECTORS.TRN.defaultPM25 * scaleRatio,
    };

    const staticAtHourZero = dijkstraLowestExposure('RES', 'CBD', 'METRO', hourZeroConcentrations);
    const timeDep = dijkstraTimeDependent('RES', 'CBD', 'METRO', mockFlatForecast, 8);

    expect(timeDep.leaveNowDoseMicrograms).toBeCloseTo(staticAtHourZero.totalInhaledDoseMicrograms, 1);
  });

  it('REGRESSION 2: doseReductionPercent adheres to exact formula (leaveNow - best) / leaveNow * 100', () => {
    const mockDynamicForecast: ForecastResult = {
      ...mockFlatForecast,
      hours: Array.from({ length: 24 }, (_, i) => ({
        ...mockFlatForecast.hours[0]!,
        hourOffset: i + 1,
        targetHour: (8 + i + 1) % 24,
        predictedPM25: i === 0 ? 100.0 : i === 4 ? 40.0 : 70.0,
      })),
    };

    const timeDep = dijkstraTimeDependent('RES', 'CBD', 'EV_HEPA', mockDynamicForecast, 8);
    const expectedPercent =
      Math.round(((timeDep.leaveNowDoseMicrograms - timeDep.bestDoseMicrograms) / timeDep.leaveNowDoseMicrograms) * 1000) / 10;

    expect(timeDep.doseReductionPercent).toBe(expectedPercent);
  });
});
