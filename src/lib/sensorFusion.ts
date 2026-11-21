/**
 * @file sensorFusion.ts
 * @description 1-D Kalman filter for low-cost particulate sensor smoothing
 * and EWMA/CUSUM anomaly detector for spike & stuck-sensor detection.
 */

export interface KalmanFilterConfig {
  processNoiseQ: number; // Q: Process variance
  measurementNoiseR: number; // R: Sensor noise variance
  initialEstimate: number; // x_0
  initialCovariance: number; // P_0
}

export class KalmanFilter1D {
  private x: number; // Estimated state
  private p: number; // Error covariance
  private readonly q: number; // Process variance
  private readonly r: number; // Measurement variance

  constructor(config: Partial<KalmanFilterConfig> = {}) {
    this.q = config.processNoiseQ ?? 0.08;
    this.r = config.measurementNoiseR ?? 2.5;
    this.x = config.initialEstimate ?? 35.0;
    this.p = config.initialCovariance ?? 5.0;
  }

  /**
   * Filters a single incoming raw sensor measurement.
   * 
   * @param measurement Raw sensor measurement (z)
   * @returns Filtered estimate
   */
  public update(measurement: number): number {
    if (!isFinite(measurement)) {
      return this.x;
    }

    // 1. Time Update (Predict)
    const xPredict = this.x;
    const pPredict = this.p + this.q;

    // 2. Measurement Update (Correct)
    const innovation = measurement - xPredict;
    const innovationCovariance = pPredict + this.r;
    const kalmanGain = pPredict / innovationCovariance;

    this.x = xPredict + kalmanGain * innovation;
    this.p = (1 - kalmanGain) * pPredict;

    return Math.round(this.x * 100) / 100;
  }

  public getState(): { estimate: number; covariance: number } {
    return {
      estimate: Math.round(this.x * 100) / 100,
      covariance: Math.round(this.p * 1000) / 1000,
    };
  }

  public reset(estimate = 35.0, covariance = 5.0): void {
    this.x = estimate;
    this.p = covariance;
  }
}

export type AnomalyType = 'NONE' | 'SPIKE' | 'STUCK_SENSOR' | 'DROP_OUT';

export interface AnomalyReport {
  isAnomaly: boolean;
  type: AnomalyType;
  message: string;
  ewmaMean: number;
  zScore: number;
  consecutiveIdenticalCount: number;
}

export class AnomalyDetector {
  private ewmaMean: number;
  private ewmaVar: number;
  private readonly alpha: number;
  private lastMeasurement: number | null = null;
  private consecutiveIdentical = 0;
  private readonly stuckThreshold: number;
  private readonly spikeZScoreThreshold: number;

  constructor(
    alpha = 0.15,
    stuckThreshold = 5,
    spikeZScoreThreshold = 3.0,
    initialMean = 35.0
  ) {
    this.alpha = alpha;
    this.stuckThreshold = stuckThreshold;
    this.spikeZScoreThreshold = spikeZScoreThreshold;
    this.ewmaMean = initialMean;
    this.ewmaVar = 10.0;
  }

  /**
   * Evaluates incoming raw sensor point against EWMA dynamic bounds and stuck detection.
   */
  public process(measurement: number): AnomalyReport {
    if (!isFinite(measurement)) {
      return {
        isAnomaly: true,
        type: 'DROP_OUT',
        message: 'Sensor measurement is non-finite or missing (drop-out).',
        ewmaMean: this.ewmaMean,
        zScore: 0,
        consecutiveIdenticalCount: 0,
      };
    }

    // Stuck sensor check (identical readings for multiple consecutive cycles)
    if (this.lastMeasurement !== null && Math.abs(measurement - this.lastMeasurement) < 0.001) {
      this.consecutiveIdentical++;
    } else {
      this.consecutiveIdentical = 1;
      this.lastMeasurement = measurement;
    }

    if (this.consecutiveIdentical >= this.stuckThreshold) {
      return {
        isAnomaly: true,
        type: 'STUCK_SENSOR',
        message: `Sensor value has frozen identically at ${measurement} µg/m³ for ${this.consecutiveIdentical} consecutive intervals. Possible hardware/sampling freeze.`,
        ewmaMean: Math.round(this.ewmaMean * 100) / 100,
        zScore: 0,
        consecutiveIdenticalCount: this.consecutiveIdentical,
      };
    }

    // EWMA residual z-score check
    const residual = measurement - this.ewmaMean;
    const stdDev = Math.max(1.0, Math.sqrt(this.ewmaVar));
    const zScore = Math.round((residual / stdDev) * 100) / 100;

    // Update EWMA
    this.ewmaMean = this.alpha * measurement + (1 - this.alpha) * this.ewmaMean;
    this.ewmaVar = this.alpha * (residual * residual) + (1 - this.alpha) * this.ewmaVar;

    if (zScore > this.spikeZScoreThreshold) {
      return {
        isAnomaly: true,
        type: 'SPIKE',
        message: `Sudden acute particulate spike detected (z-score: ${zScore.toFixed(1)} > ${this.spikeZScoreThreshold}). Value jumped to ${measurement} µg/m³.`,
        ewmaMean: Math.round(this.ewmaMean * 100) / 100,
        zScore,
        consecutiveIdenticalCount: this.consecutiveIdentical,
      };
    }

    return {
      isAnomaly: false,
      type: 'NONE',
      message: 'Measurement within expected variance bounds.',
      ewmaMean: Math.round(this.ewmaMean * 100) / 100,
      zScore,
      consecutiveIdenticalCount: this.consecutiveIdentical,
    };
  }
}

export interface FusedSensorReading {
  timestamp: string;
  rawPM25: number;
  filteredPM25: number;
  anomaly: AnomalyReport;
}

/**
 * Convenience helper to fuse and filter an array of sensor stream points.
 */
export function fuseSensorStream(
  rawReadings: readonly number[],
  kalmanConfig?: Partial<KalmanFilterConfig>
): FusedSensorReading[] {
  const kf = new KalmanFilter1D(kalmanConfig);
  const detector = new AnomalyDetector();
  const now = Date.now();

  return rawReadings.map((raw, idx) => {
    const filtered = kf.update(raw);
    const anomaly = detector.process(raw);
    const ts = new Date(now - (rawReadings.length - 1 - idx) * 300000).toISOString(); // 5-minute ticks

    return {
      timestamp: ts,
      rawPM25: raw,
      filteredPM25: filtered,
      anomaly,
    };
  });
}
