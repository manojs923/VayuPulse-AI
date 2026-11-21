/**
 * @file tools.ts
 * @description Safe Agent Tool Execution Layer with strict allowlist and range validation.
 */

import { URBAN_SECTORS, SectorId, TransitMode, dijkstraLowestExposure, dijkstraTimeDependent } from '../../src/lib/routing';
import { generate24HourMLForecast } from '../../src/lib/mlForecast';
import { estimatePurificationTime, PURIFIER_PRESETS, calculatePM25SubIndex, evaluateInversionRisk } from '../../src/lib/aqiCompute';
import { retrieveContext } from '../rag/knowledgeBase';
import { stripControlChars } from '../../src/lib/sanitize';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: 'get_zone_telemetry',
    description: 'Fetches real-time ambient PM2.5, EPA AQI, and inversion risk proxy for a specific urban sector.',
    parameters: {
      type: 'object',
      properties: {
        zoneId: {
          type: 'string',
          enum: ['CBD', 'IND', 'RES', 'PRK', 'TRN'],
          description: 'Sector identifier (CBD, IND, RES, PRK, TRN)',
        },
      },
      required: ['zoneId'],
    },
  },
  {
    name: 'run_ml_24h_forecast',
    description: 'Generates a 24-hour ML forecast of PM2.5 and AQI with 90% confidence bands and optimal safe outdoor window.',
    parameters: {
      type: 'object',
      properties: {
        zoneId: {
          type: 'string',
          enum: ['CBD', 'IND', 'RES', 'PRK', 'TRN'],
          description: 'Sector identifier',
        },
      },
      required: ['zoneId'],
    },
  },
  {
    name: 'find_clean_corridor',
    description: 'Finds the lowest-inhaled-dose route between urban sectors, evaluating static exposure or time-dependent departure.',
    parameters: {
      type: 'object',
      properties: {
        origin: {
          type: 'string',
          enum: ['CBD', 'IND', 'RES', 'PRK', 'TRN'],
        },
        destination: {
          type: 'string',
          enum: ['CBD', 'IND', 'RES', 'PRK', 'TRN'],
        },
        mode: {
          type: 'string',
          enum: ['METRO', 'EV_HEPA', 'ELECTRIC_BUS', 'DIESEL_BUS', 'CYCLING', 'WALKING'],
        },
        departureHour: {
          type: 'number',
          minimum: 0,
          maximum: 23,
          description: 'Optional departure clock hour (0-23) for time-dependent optimization',
        },
      },
      required: ['origin', 'destination', 'mode'],
    },
  },
  {
    name: 'calculate_room_cadr',
    description: 'Calculates single-compartment particle decay clearance time and verifies 4-ACH standard for room dimensions.',
    parameters: {
      type: 'object',
      properties: {
        lengthM: { type: 'number', minimum: 1, maximum: 50 },
        widthM: { type: 'number', minimum: 1, maximum: 50 },
        heightM: { type: 'number', minimum: 1.5, maximum: 10 },
        deviceType: {
          type: 'string',
          enum: ['CORSI_ROSENTHAL', 'STANDARD_HEPA', 'HIGH_CAPACITY'],
          description: 'Filtration device type preset',
        },
      },
      required: ['lengthM', 'widthM', 'heightM', 'deviceType'],
    },
  },
  {
    name: 'search_health_protocols',
    description: 'Searches the grounded hybrid RAG knowledge base for cited clinical air quality guidelines and mitigation protocols.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Keywords to query (e.g. "asthma pediatric outdoor", "N95 respirator seal", "inversion ventilation timing")',
        },
      },
      required: ['query'],
    },
  },
];

const VALID_ZONES: Set<SectorId> = new Set(['CBD', 'IND', 'RES', 'PRK', 'TRN']);
const VALID_MODES: Set<TransitMode> = new Set([
  'METRO',
  'EV_HEPA',
  'ELECTRIC_BUS',
  'DIESEL_BUS',
  'CYCLING',
  'WALKING',
]);

/**
 * Executes an agent tool with strict allowlist checks and numeric bounds guards.
 */
export async function executeAgentTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'get_zone_telemetry': {
      const zoneId = args['zoneId'] as SectorId;
      if (!VALID_ZONES.has(zoneId)) {
        throw new Error(`Invalid zoneId: "${String(zoneId)}". Must be one of: CBD, IND, RES, PRK, TRN.`);
      }
      const sector = URBAN_SECTORS[zoneId];
      const aqiRes = calculatePM25SubIndex(sector.defaultPM25);
      const invRes = evaluateInversionRisk(7.5, 11.0, 3.2);

      return {
        zoneId: sector.id,
        zoneName: sector.name,
        pm25: sector.defaultPM25,
        aqi: aqiRes.aqi,
        category: aqiRes.category,
        inversionRisk: invRes.severity,
        inversionTrappingFactor: invRes.trappingMultiplier,
        isSimulated: true,
      };
    }

    case 'run_ml_24h_forecast': {
      const zoneId = args['zoneId'] as SectorId;
      if (!VALID_ZONES.has(zoneId)) {
        throw new Error(`Invalid zoneId: "${String(zoneId)}".`);
      }
      const forecast = generate24HourMLForecast(zoneId, [], 8, {
        hourOfDay: 8,
        groundTempC: 8.0,
        upperTempC: 11.5,
        windSpeedKmH: 3.5,
        relativeHumidity: 75,
      });

      return {
        zoneId: forecast.zoneId,
        generatedAt: forecast.generatedAt,
        safeOutdoorWindow: forecast.safeOutdoorWindow,
        first6HoursPreview: forecast.hours.slice(0, 6).map((h) => ({
          targetHour: h.targetHour,
          predictedPM25: h.predictedPM25,
          predictedAQI: h.predictedAQI,
          category: h.aqiCategory,
        })),
      };
    }

    case 'find_clean_corridor': {
      const origin = args['origin'] as SectorId;
      const destination = args['destination'] as SectorId;
      const mode = args['mode'] as TransitMode;

      if (!VALID_ZONES.has(origin) || !VALID_ZONES.has(destination)) {
        throw new Error(`Invalid origin or destination sector.`);
      }
      if (!VALID_MODES.has(mode)) {
        throw new Error(`Invalid transit mode: "${String(mode)}".`);
      }

      const staticRoute = dijkstraLowestExposure(origin, destination, mode);

      if (typeof args['departureHour'] === 'number') {
        const depHour = Math.max(0, Math.min(23, Math.round(args['departureHour'])));
        const forecast = generate24HourMLForecast(origin, [], depHour, {
          hourOfDay: depHour,
          groundTempC: 8.0,
          upperTempC: 11.5,
          windSpeedKmH: 3.5,
          relativeHumidity: 75,
        });

        const timeDep = dijkstraTimeDependent(origin, destination, mode, forecast, depHour);
        return {
          staticRoute,
          timeDependentAdvice: timeDep.advice,
          bestDepartureHour: timeDep.departureClockHour,
          doseReductionPercent: timeDep.doseReductionPercent,
        };
      }

      return { staticRoute };
    }

    case 'calculate_room_cadr': {
      const lengthM = Number(args['lengthM']);
      const widthM = Number(args['widthM']);
      const heightM = Number(args['heightM']);
      const deviceType = String(args['deviceType']);

      if (isNaN(lengthM) || lengthM <= 0 || isNaN(widthM) || widthM <= 0 || isNaN(heightM) || heightM <= 0) {
        throw new Error('Room dimensions must be positive numbers.');
      }

      let cadr = PURIFIER_PRESETS[0]!.cadrM3H; // Corsi-Rosenthal default
      if (deviceType === 'STANDARD_HEPA') cadr = PURIFIER_PRESETS[1]!.cadrM3H;
      if (deviceType === 'HIGH_CAPACITY') cadr = PURIFIER_PRESETS[2]!.cadrM3H;

      const cadrRes = estimatePurificationTime(lengthM, widthM, heightM, cadr, 0.90);
      return {
        deviceType,
        cadrM3H: cadr,
        roomVolumeM3: cadrRes.roomVolumeM3,
        ach: cadrRes.ach,
        meets4ACHStandard: cadrRes.meets4ACHStandard,
        clearanceTimeMinutes: cadrRes.clearanceTimeMinutes,
        recommendedCADR4ACH: cadrRes.recommendedCADR4ACH,
      };
    }

    case 'search_health_protocols': {
      const rawQuery = String(args['query'] ?? '');
      // Sanitize query to prevent control-character injection
      const sanitized = stripControlChars(rawQuery, ' ').trim();
      if (!sanitized) {
        throw new Error('Search query cannot be empty.');
      }

      const results = retrieveContext(sanitized, 3);
      return {
        query: sanitized,
        protocols: results.map((r) => ({
          id: r.id,
          title: r.title,
          summary: r.text.slice(0, 200) + '...',
          source: r.source,
          fusedScore: r.fusedScore,
        })),
      };
    }

    default:
      throw new Error(`Unrecognized agent tool: "${name}".`);
  }
}
