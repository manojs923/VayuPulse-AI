// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  calculatePM25SubIndex,
  evaluateInversionRisk,
  estimatePurificationTime,
  PURIFIER_PRESETS,
} from '../lib/aqiCompute';

describe('EPA PM2.5 Sub-Index Computation (2024 Standards)', () => {
  it('correctly maps lower boundary 0.0 µg/m³ to AQI 0 (Good)', () => {
    const res = calculatePM25SubIndex(0.0);
    expect(res.aqi).toBe(0);
    expect(res.category).toBe('Good');
    expect(res.isCapped).toBe(false);
  });

  it('correctly maps upper boundary 9.0 µg/m³ to AQI 50 (Good)', () => {
    const res = calculatePM25SubIndex(9.0);
    expect(res.aqi).toBe(50);
    expect(res.category).toBe('Good');
  });

  it('correctly interpolates 9.1 µg/m³ to AQI 51 (Moderate threshold)', () => {
    const res = calculatePM25SubIndex(9.1);
    expect(res.aqi).toBe(51);
    expect(res.category).toBe('Moderate');
  });

  it('correctly interpolates 35.4 µg/m³ to AQI 100 (Moderate boundary)', () => {
    const res = calculatePM25SubIndex(35.4);
    expect(res.aqi).toBe(100);
    expect(res.category).toBe('Moderate');
  });

  it('correctly interpolates 35.5 µg/m³ to AQI 101 (USG threshold)', () => {
    const res = calculatePM25SubIndex(35.5);
    expect(res.aqi).toBe(101);
    expect(res.category).toBe('Unhealthy for Sensitive Groups');
  });

  it('correctly interpolates 55.4 µg/m³ to AQI 150', () => {
    const res = calculatePM25SubIndex(55.4);
    expect(res.aqi).toBe(150);
    expect(res.category).toBe('Unhealthy for Sensitive Groups');
  });

  it('correctly interpolates 55.5 µg/m³ to AQI 151 (Unhealthy)', () => {
    const res = calculatePM25SubIndex(55.5);
    expect(res.aqi).toBe(151);
    expect(res.category).toBe('Unhealthy');
  });

  it('correctly interpolates 125.4 µg/m³ to AQI 200', () => {
    const res = calculatePM25SubIndex(125.4);
    expect(res.aqi).toBe(200);
    expect(res.category).toBe('Unhealthy');
  });

  it('correctly caps values above 500.4 µg/m³ at AQI 500 with isCapped = true', () => {
    const res = calculatePM25SubIndex(620.5);
    expect(res.aqi).toBe(500);
    expect(res.isCapped).toBe(true);
    expect(res.category).toBe('Beyond Index');
  });

  it('rejects negative PM2.5 values', () => {
    expect(() => calculatePM25SubIndex(-5.0)).toThrow('PM2.5 concentration cannot be negative.');
  });

  it('rejects non-finite inputs', () => {
    expect(() => calculatePM25SubIndex(NaN)).toThrow('PM2.5 concentration must be a finite number.');
    expect(() => calculatePM25SubIndex(Infinity)).toThrow('PM2.5 concentration must be a finite number.');
  });
});

describe('Boundary-Layer Temperature Inversion Model', () => {
  it('returns NONE severity when Delta T is negative or zero', () => {
    const res = evaluateInversionRisk(15, 10, 4);
    expect(res.severity).toBe('NONE');
    expect(res.deltaT).toBe(-5);
    expect(res.trappingMultiplier).toBe(1.0);
    expect(res.simplifiedProxyNotice).toContain('Simplified inversion proxy');
  });

  it('returns MODERATE severity when Delta T is positive but small with stagnant wind', () => {
    const res = evaluateInversionRisk(8, 9.5, 3.2); // deltaT = +1.5, wind < 6
    expect(res.severity).toBe('MODERATE');
    expect(res.deltaT).toBe(1.5);
    expect(res.trappingMultiplier).toBeGreaterThan(1.0);
  });

  it('returns NONE severity when small Delta T is accompanied by strong mixing wind', () => {
    const res = evaluateInversionRisk(8, 9.5, 18.0); // deltaT = +1.5, wind > 6
    expect(res.severity).toBe('NONE');
  });

  it('returns SEVERE severity for moderate inversions with stagnation', () => {
    const res = evaluateInversionRisk(5, 8.5, 2.0); // deltaT = +3.5
    expect(res.severity).toBe('SEVERE');
    expect(res.trappingMultiplier).toBe(2.2);
  });

  it('returns CRITICAL severity for strong thermal caps (Delta T >= 5°C)', () => {
    const res = evaluateInversionRisk(2, 9, 1.5); // deltaT = +7.0
    expect(res.severity).toBe('CRITICAL');
    expect(res.trappingMultiplier).toBe(3.5);
  });

  it('rejects negative wind speed', () => {
    expect(() => evaluateInversionRisk(10, 15, -2)).toThrow('Wind speed cannot be negative.');
  });
});

describe('Single-Compartment CADR Mass-Balance Decay', () => {
  it('correctly calculates 90% particle clearance time for standard room and Corsi-Rosenthal box', () => {
    // Room: 5m x 4m x 2.5m = 50 m³
    // Corsi-Rosenthal Box: 350 m³/h
    // eta = 0.90 -> -ln(0.10) ~= 2.302585
    // t = (2.302585 * 50 / 350) * 60 = 19.74 minutes
    const res = estimatePurificationTime(5, 4, 2.5, 350, 0.90);
    expect(res.roomVolumeM3).toBe(50);
    expect(res.ach).toBe(7.0); // 350 / 50 = 7 ACH
    expect(res.meets4ACHStandard).toBe(true);
    expect(res.clearanceTimeMinutes).toBeCloseTo(19.7, 0);
    expect(res.assumptions.length).toBeGreaterThan(0);
  });

  it('correctly identifies when a purifier fails to meet the 4-ACH standard', () => {
    // Room: 8m x 6m x 3m = 144 m³
    // Low CADR purifier: 120 m³/h -> ACH = 120 / 144 = 0.83 ACH
    const res = estimatePurificationTime(8, 6, 3, 120, 0.90);
    expect(res.meets4ACHStandard).toBe(false);
    expect(res.recommendedCADR4ACH).toBe(576); // 144 * 4
  });

  it('rejects zero or negative dimensions', () => {
    expect(() => estimatePurificationTime(-4, 3, 2.5, 300)).toThrow('Room dimensions must be strictly positive.');
    expect(() => estimatePurificationTime(4, 0, 2.5, 300)).toThrow('Room dimensions must be strictly positive.');
  });

  it('rejects CADR <= 0', () => {
    expect(() => estimatePurificationTime(5, 4, 2.5, 0)).toThrow('CADR must be strictly greater than 0.');
  });

  it('rejects target efficiency out of bounds (<= 0 or >= 1)', () => {
    expect(() => estimatePurificationTime(5, 4, 2.5, 300, 0)).toThrow('Target efficiency must be strictly between 0 and 1');
    expect(() => estimatePurificationTime(5, 4, 2.5, 300, 1.0)).toThrow('Target efficiency must be strictly between 0 and 1');
  });

  it('includes the $40 Corsi-Rosenthal Box preset', () => {
    const cr = PURIFIER_PRESETS.find((p) => p.name.includes('Corsi-Rosenthal'));
    expect(cr).toBeDefined();
    expect(cr?.cadrM3H).toBe(350);
    expect(cr?.approximateCostUSD).toBe(40);
  });
});
