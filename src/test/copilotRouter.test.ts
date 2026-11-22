import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyCopilotIntent, routeAndAnswerCopilot } from '../lib/copilotRouter';
import { SectorReading } from '../lib/telemetrySource';
import { SectorId } from '../lib/routing';

describe('Clean-Air Copilot Intent Router', () => {
  describe('classifyCopilotIntent', () => {
    it('prioritizes urgent clinical symptoms above all else', () => {
      expect(classifyCopilotIntent("I can't breathe and have severe chest pain")).toBe('urgent_symptoms');
      expect(classifyCopilotIntent('Patient with blue lips and cyanosis')).toBe('urgent_symptoms');
      expect(classifyCopilotIntent('My asthmatic child is having an asthma attack emergency')).toBe('urgent_symptoms');
      expect(classifyCopilotIntent('Experiencing stridor and shortness of breath')).toBe('urgent_symptoms');
    });

    it('classifies IAQ and air purifier sizing queries', () => {
      expect(classifyCopilotIntent('How do I build a Corsi-Rosenthal box?')).toBe('iaq');
      expect(classifyCopilotIntent('What CADR is required for a 50m3 room to reach 5 ACH?')).toBe('iaq');
      expect(classifyCopilotIntent('Which HEPA filter gives the best clean air delivery rate?')).toBe('iaq');
      expect(classifyCopilotIntent('Do MERV-13 filters work against winter smog?')).toBe('iaq');
    });

    it('classifies transit and commute routing queries', () => {
      expect(classifyCopilotIntent('What is the lowest exposure transit route from RES to CBD?')).toBe('route');
      expect(classifyCopilotIntent('Is it safer to take the metro or bicycle today?')).toBe('route');
      expect(classifyCopilotIntent('Should I take an electric bus or car commute?')).toBe('route');
    });

    it('classifies current weather and live telemetry queries', () => {
      expect(classifyCopilotIntent('What is the current PM2.5 and AQI right now?')).toBe('weather');
      expect(classifyCopilotIntent('Is there a temperature inversion today?')).toBe('weather');
      expect(classifyCopilotIntent('What is the ambient temperature and wind speed?')).toBe('weather');
    });

    it('classifies forecast and ventilation timing queries', () => {
      expect(classifyCopilotIntent('What is the 24-hour smog forecast?')).toBe('forecast');
      expect(classifyCopilotIntent('When is the least-polluted outdoor window today?')).toBe('forecast');
      expect(classifyCopilotIntent('Will smog peak later tomorrow morning?')).toBe('forecast');
    });

    it('classifies vulnerable persona guidelines and masking protocols', () => {
      expect(classifyCopilotIntent('Can my 6-month-old infant wear an N95 mask?')).toBe('protocols');
      expect(classifyCopilotIntent('What are the protocols for an asthmatic child during smog?')).toBe('protocols');
      expect(classifyCopilotIntent('Should elderly cardiac patients exercise outdoors?')).toBe('protocols');
    });

    it('classifies unrelated queries as out_of_scope', () => {
      expect(classifyCopilotIntent('What is the recipe for chocolate cake?')).toBe('out_of_scope');
      expect(classifyCopilotIntent('Who won the world cup in 2022?')).toBe('out_of_scope');
      expect(classifyCopilotIntent('Write a Python script for binary search')).toBe('out_of_scope');
    });
  });

  describe('routeAndAnswerCopilot Synthesizer', () => {
    const mockTelemetry: Record<SectorId, SectorReading> = {
      CBD: {
        zoneId: 'CBD',
        name: 'Downtown Commercial',
        pm25: 145,
        aqi: 198,
        category: 'Unhealthy',
        groundTempC: 7.5,
        upperTempC: 11.2,
        windSpeedKmH: 3.2,
        inversionSeverity: 'SEVERE',
        isSimulated: false,
        sourceLabel: 'CAMS/Open-Meteo European Model',
        asOf: '2026-11-22T08:00:00Z',
        timestamp: '2026-11-22T08:05:00Z',
      },
      IND: {
        zoneId: 'IND',
        name: 'Industrial Corridor',
        pm25: 210,
        aqi: 260,
        category: 'Very Unhealthy',
        groundTempC: 7.5,
        upperTempC: 11.2,
        windSpeedKmH: 3.2,
        inversionSeverity: 'SEVERE',
        isSimulated: false,
        sourceLabel: 'CAMS/Open-Meteo European Model',
        asOf: '2026-11-22T08:00:00Z',
        timestamp: '2026-11-22T08:05:00Z',
      },
      RES: {
        zoneId: 'RES',
        name: 'Greenwood Residential',
        pm25: 85,
        aqi: 166,
        category: 'Unhealthy',
        groundTempC: 7.5,
        upperTempC: 11.2,
        windSpeedKmH: 3.2,
        inversionSeverity: 'SEVERE',
        isSimulated: false,
        sourceLabel: 'CAMS/Open-Meteo European Model',
        asOf: '2026-11-22T08:00:00Z',
        timestamp: '2026-11-22T08:05:00Z',
      },
      PRK: {
        zoneId: 'PRK',
        name: 'Riverside Eco Park',
        pm25: 60,
        aqi: 153,
        category: 'Unhealthy',
        groundTempC: 7.5,
        upperTempC: 11.2,
        windSpeedKmH: 3.2,
        inversionSeverity: 'SEVERE',
        isSimulated: false,
        sourceLabel: 'CAMS/Open-Meteo European Model',
        asOf: '2026-11-22T08:00:00Z',
        timestamp: '2026-11-22T08:05:00Z',
      },
      TRN: {
        zoneId: 'TRN',
        name: 'Northern Transit Hub',
        pm25: 175,
        aqi: 225,
        category: 'Very Unhealthy',
        groundTempC: 7.5,
        upperTempC: 11.2,
        windSpeedKmH: 3.2,
        inversionSeverity: 'SEVERE',
        isSimulated: false,
        sourceLabel: 'CAMS/Open-Meteo European Model',
        asOf: '2026-11-22T08:00:00Z',
        timestamp: '2026-11-22T08:05:00Z',
      },
    };

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('handles emergency symptoms with immediate clinical triage notice', async () => {
      const res = await routeAndAnswerCopilot("Help, I can't breathe and have chest pain!", mockTelemetry);
      expect(res.intent).toBe('urgent_symptoms');
      expect(res.confidence).toBe(1.0);
      expect(res.answer).toContain('CRITICAL MEDICAL NOTICE');
      expect(res.answer).toContain('call 911 / 112');
      expect(res.citations).toContain('[WHO-PM25-24H]');
    });

    it('synthesizes live weather telemetry with observation timestamp and inversion delta', async () => {
      const res = await routeAndAnswerCopilot('What is the current air quality?', mockTelemetry);
      expect(res.intent).toBe('weather');
      expect(res.answer).toContain('Live observation as of');
      expect(res.answer).toContain('CAMS/Open-Meteo European Model');
      expect(res.answer).toContain('Thermal inversion active');
      expect(res.answer).toContain('ΔT = +3.7°C');
      expect(res.citations).toContain('[VENT-INVERSION]');
    });

    it('synthesizes 24h ML forecast with least-polluted window', async () => {
      const res = await routeAndAnswerCopilot('When is the least-polluted window tomorrow?', mockTelemetry);
      expect(res.intent).toBe('forecast');
      expect(res.answer).toContain('24-Hour ML Smog Forecast Overview');
      expect(res.answer).toContain('Least-Polluted Window: Between');
      expect(res.answer).toContain('convective heating');
      expect(res.citations).toContain('[VENT-INVERSION]');
    });

    it('synthesizes routing transit comparison with EV/HEPA and Metro', async () => {
      const res = await routeAndAnswerCopilot('Which transit route gives the lowest exposure?', mockTelemetry);
      expect(res.intent).toBe('route');
      expect(res.answer).toContain('Lowest-Exposure Transit Comparison');
      expect(res.answer).toContain('EV / HEPA Cabin Taxi');
      expect(res.answer).toContain('Underground Metro');
      expect(res.citations).toContain('[N95-PHYSICS]');
    });

    it('synthesizes IAQ CADR sizing with 4-5+ ACH guideline and CR box specs', async () => {
      const res = await routeAndAnswerCopilot('How do I size a Corsi-Rosenthal box for a 50m3 room?', mockTelemetry);
      expect(res.intent).toBe('iaq');
      expect(res.answer).toContain('common guideline: 4–5+ ACH (5 ACH recommended');
      expect(res.answer).toContain('Corsi-Rosenthal Box');
      expect(res.answer).toContain('Delivers ~350 m³/h CADR');
      expect(res.answer).toContain('t = [-ln(1 - η) × V / CADR] × 60 minutes');
      expect(res.citations).toContain('[CR-BOX-SPEC]');
    });

    it('enforces clinical pediatric and infant contraindication rules in protocol queries', async () => {
      const res = await routeAndAnswerCopilot('Can my 8-month infant wear a respirator mask?', mockTelemetry);
      expect(res.intent).toBe('protocols');
      expect(res.answer).toContain('Newborn Infants (<2 years): Masks are strictly contraindicated');
      expect(res.answer).toContain('Asthmatic Children (ages 5–12)');
      expect(res.answer).toContain('well-fitting respirators only if the child can wear one (age ≥ 2, adult supervised)');
      expect(res.citations).toContain('[PED-ASTHMA-VULN]');
    });

    it('gracefully handles out-of-scope requests with educational guidance', async () => {
      const res = await routeAndAnswerCopilot('What is quantum entanglement?', mockTelemetry);
      expect(res.intent).toBe('out_of_scope');
      expect(res.answer).toContain('I am the VayuPulse Clean-Air Copilot');
      expect(res.answer).toContain('Corsi-Rosenthal');
    });
  });
});
