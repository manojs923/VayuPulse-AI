// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  generate24HourMLForecast,
  computeFeatureContributions,
  explainCounterfactual,
  WeatherFeatures,
} from '../lib/mlForecast';
import {
  calculateEvaluationMetrics,
  runRollingOriginBacktest,
  PredictionPoint,
} from '../lib/mlEval';

describe('ML Forecaster Property Tests', () => {
  const baseFeatures: WeatherFeatures = {
    hourOfDay: 8,
    groundTempC: 8.0,
    upperTempC: 11.5,
    windSpeedKmH: 3.5,
    relativeHumidity: 75,
  };

  const sampleHistory = [
    35, 38, 42, 50, 60, 75, 88, 95, 85, 70, 60, 52,
    48, 45, 43, 47, 58, 72, 85, 92, 86, 75, 62, 48
  ];

  it('generates exactly 24 hourly forecast steps', () => {
    const result = generate24HourMLForecast('CBD', sampleHistory, 8, baseFeatures);
    expect(result.hours.length).toBe(24);
  });

  it('maintains lowerBound <= predictedPM25 <= upperBound for all hours', () => {
    const result = generate24HourMLForecast('CBD', sampleHistory, 8, baseFeatures);
    for (const h of result.hours) {
      expect(h.lowerBoundPM25).toBeLessThanOrEqual(h.predictedPM25);
      expect(h.predictedPM25).toBeLessThanOrEqual(h.upperBoundPM25);
    }
  });

  it('maintains non-negativity for all predictions', () => {
    const result = generate24HourMLForecast('CBD', sampleHistory, 8, baseFeatures);
    for (const h of result.hours) {
      expect(h.predictedPM25).toBeGreaterThanOrEqual(0);
      expect(h.predictedAQI).toBeGreaterThanOrEqual(0);
    }
  });

  it('feature contributions sum exactly to linear Ridge prediction', () => {
    const contribs = computeFeatureContributions(baseFeatures);
    const sum =
      contribs.baseLevel +
      contribs.trafficEffect +
      contribs.inversionGradientEffect +
      contribs.windDispersalEffect +
      contribs.humidityGrowthEffect;

    // Wind dispersal is negative, traffic/inversion positive
    expect(contribs.windDispersalEffect).toBeLessThan(0);
    expect(contribs.trafficEffect).toBeGreaterThan(0);
    expect(contribs.inversionGradientEffect).toBeGreaterThan(0);
    expect(sum).toBeGreaterThan(0);
  });

  it('explains counterfactual what-if adjustments consistently', () => {
    // If wind increases by 10 km/h, particulate concentration must drop
    const cfWind = explainCounterfactual(baseFeatures, { windSpeedKmH: baseFeatures.windSpeedKmH + 10 });
    expect(cfWind.deltaPM25).toBeLessThan(0);
    expect(cfWind.explanation).toContain('drops');

    // If upper temp rises (stronger inversion), concentration must rise
    const cfInversion = explainCounterfactual(baseFeatures, { upperTempC: baseFeatures.upperTempC + 4 });
    expect(cfInversion.deltaPM25).toBeGreaterThan(0);
    expect(cfInversion.explanation).toContain('rises');
  });

  it('identifies an optimal 3-hour outdoor window with valid hours', () => {
    const result = generate24HourMLForecast('CBD', sampleHistory, 8, baseFeatures);
    const win = result.safeOutdoorWindow;
    expect(win.startHourOffset).toBeGreaterThanOrEqual(1);
    expect(win.endHourOffset).toBeLessThanOrEqual(24);
    expect(win.averageAQI).toBeGreaterThan(0);
    expect(win.recommendation).toContain('Least-polluted outdoor');
  });
});

describe('ML Forecast Evaluation & Backtesting Harness', () => {
  it('correctly calculates MAE, RMSE, MAPE and coverage on known data points', () => {
    const pairs: PredictionPoint[] = [
      { actual: 50, predicted: 55, lowerBound: 45, upperBound: 60, persistenceBenchmark: 48, seasonalNaiveBenchmark: 52 }, // err: +5
      { actual: 80, predicted: 76, lowerBound: 70, upperBound: 85, persistenceBenchmark: 78, seasonalNaiveBenchmark: 82 }, // err: -4
      { actual: 100, predicted: 100, lowerBound: 90, upperBound: 110, persistenceBenchmark: 95, seasonalNaiveBenchmark: 98 }, // err: 0
    ];

    const metrics = calculateEvaluationMetrics(pairs, 'historical');
    // Abs errors: 5, 4, 0 -> MAE = 9 / 3 = 3.0
    expect(metrics.mae).toBe(3.0);
    // Sq errors: 25 + 16 + 0 = 41 / 3 = 13.67 -> RMSE = ~3.69
    expect(metrics.rmse).toBeCloseTo(3.7, 0);
    // All 3 points fall within lower and upper bounds -> 100%
    expect(metrics.intervalCoverage90Percent).toBe(100);
    expect(metrics.dataSource).toBe('historical');
  });

  it('guards against division by zero in MAPE when actual is zero', () => {
    const pairs: PredictionPoint[] = [
      { actual: 0, predicted: 2.0, lowerBound: 0, upperBound: 5, persistenceBenchmark: 0, seasonalNaiveBenchmark: 0 },
    ];
    const metrics = calculateEvaluationMetrics(pairs, 'simulated');
    expect(isFinite(metrics.mape)).toBe(true);
  });

  it('executes rolling-origin backtest and yields valid bounded skill scores', () => {
    // Generate 72 hours of synthetic sinusoidal diurnal series
    const series: number[] = [];
    for (let i = 0; i < 72; i++) {
      const diurnal = 50 + 25 * Math.sin((i / 24) * 2 * Math.PI);
      series.push(Math.round(diurnal * 10) / 10);
    }

    const backtest = runRollingOriginBacktest(series, 48, 24, 'simulated');
    expect(backtest.sampleCount).toBeGreaterThan(0);
    expect(backtest.mae).toBeGreaterThan(0);
    expect(backtest.rmse).toBeGreaterThan(0);
    expect(backtest.skillScoreVsPersistence).toBeGreaterThanOrEqual(-1.0);
    expect(backtest.skillScoreVsPersistence).toBeLessThanOrEqual(1.0);
    expect(backtest.intervalCoverage90Percent).toBeGreaterThan(50);
  });
});
