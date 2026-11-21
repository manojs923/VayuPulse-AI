// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  KalmanFilter1D,
  AnomalyDetector,
  fuseSensorStream,
} from '../lib/sensorFusion';

describe('1-D Kalman Filter Sensor Smoothing', () => {
  it('converges toward a constant true state when fed Gaussian-like noisy readings', () => {
    const kf = new KalmanFilter1D({
      processNoiseQ: 0.05,
      measurementNoiseR: 2.0,
      initialEstimate: 10.0, // Start away from target 50
      initialCovariance: 10.0,
    });

    const target = 50.0;
    let lastEstimate = 10.0;

    // Feed 30 readings fluctuating around 50
    for (let i = 0; i < 30; i++) {
      const noise = (i % 2 === 0 ? 1 : -1) * (2.5 + (i % 3) * 0.5);
      const raw = target + noise;
      lastEstimate = kf.update(raw);
    }

    // After 30 iterations, estimate should have converged within 1.5 units of 50
    expect(Math.abs(lastEstimate - target)).toBeLessThan(1.5);
    expect(kf.getState().covariance).toBeLessThan(1.0);
  });

  it('safely handles non-finite inputs by returning previous estimate', () => {
    const kf = new KalmanFilter1D({ initialEstimate: 42.0 });
    const est = kf.update(NaN);
    expect(est).toBe(42.0);
  });
});

describe('Anomaly & Sensor Fault Detector', () => {
  it('detects acute sudden particulate spikes', () => {
    const detector = new AnomalyDetector(0.15, 5, 3.0, 30.0);

    // Warm up detector around 30 µg/m³
    for (let i = 0; i < 15; i++) {
      detector.process(30.0 + (i % 3));
    }

    // Inject massive sudden spike
    const report = detector.process(145.0);
    expect(report.isAnomaly).toBe(true);
    expect(report.type).toBe('SPIKE');
    expect(report.zScore).toBeGreaterThan(3.0);
  });

  it('detects frozen / stuck sensor values after threshold consecutive identical readings', () => {
    const detector = new AnomalyDetector(0.15, 4, 3.0, 30.0);

    // 3 identical readings (below threshold of 4)
    expect(detector.process(35.5).isAnomaly).toBe(false);
    expect(detector.process(35.5).isAnomaly).toBe(false);
    expect(detector.process(35.5).isAnomaly).toBe(false);

    // 4th identical reading triggers STUCK_SENSOR
    const stuckReport = detector.process(35.5);
    expect(stuckReport.isAnomaly).toBe(true);
    expect(stuckReport.type).toBe('STUCK_SENSOR');
    expect(stuckReport.consecutiveIdenticalCount).toBe(4);
  });

  it('flags non-finite measurements as sensor dropouts', () => {
    const detector = new AnomalyDetector();
    const rep = detector.process(NaN);
    expect(rep.isAnomaly).toBe(true);
    expect(rep.type).toBe('DROP_OUT');
  });

  it('fuseSensorStream produces complete fused series with anomaly metadata', () => {
    const rawSeries = [30, 32, 31, 33, 120, 32, 33, 33, 33, 33, 33];
    const fused = fuseSensorStream(rawSeries);

    expect(fused.length).toBe(rawSeries.length);
    expect(fused[0]?.filteredPM25).toBeDefined();
    // Index 4 should be a spike
    expect(fused[4]?.anomaly.type).toBe('SPIKE');
  });
});
