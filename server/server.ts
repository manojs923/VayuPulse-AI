/**
 * @file server.ts
 * @description Zero-Trust Express 5 Gateway for VayuPulse AI.
 * Implements:
 * - Helmet strict Content Security Policy (CSP)
 * - Exact-match CORS allowlist
 * - 15 KB body limit for standard AI JSON endpoints
 * - In-memory SHA-256 LRU cache (100 entries) with X-Cache HIT/MISS headers
 * - IP rate limiting (30 req/min for AI routes)
 * - CWE-209-safe error handling: { error: 'Internal Server Error' }
 * - Server-side key custody (OPENAI_API_KEY / GEMINI_API_KEY never leaked)
 */

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { defaultOrchestrator, PlanRequest } from './ai/orchestrator';
import { generate24HourMLForecast } from '../src/lib/mlForecast';
import { SectorId } from '../src/lib/routing';
import { estimateSkylineHaze } from './ai/visionHaze';

dotenv.config();

export const app = express();

// 1. Strict Helmet Security Headers & CSP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'http://localhost:5173', 'http://localhost:3001'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    frameguard: { action: 'deny' },
    crossOriginEmbedderPolicy: false,
  })
);

// 2. Exact-match CORS Allowlist
const rawAllowedOrigins = process.env.ALLOWED_ORIGINS || 'http://localhost:5173';
const allowedOrigins = rawAllowedOrigins.split(',').map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (e.g. tests/curl) with no origin header
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS policy: Origin not allowed.'));
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })
);

// 3. Dedicated 2 MB Upload Limit for /api/ai/vision-haze (Phase 6)
app.use(
  '/api/ai/vision-haze',
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'], limit: '2mb' }),
  express.json({ limit: '2mb' })
);

// Strict 15 KB JSON Body Limit on all other standard routes
app.use(express.json({ limit: '15kb' }));

// 4. In-Memory SHA-256 LRU Cache
interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttlMs: number;
}

class Sha256LruCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;

  constructor(maxEntries = 100, defaultTtlMs = 300000) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
  }

  public get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.cachedAt > entry.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Refresh LRU order (delete and re-insert)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  public set(key: string, data: T, ttlMs = this.defaultTtlMs): void {
    if (this.cache.size >= this.maxEntries) {
      // Evict oldest (first) entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, { data, cachedAt: Date.now(), ttlMs });
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const planCache = new Sha256LruCache<Record<string, unknown>>(100, 300000);

export function computeNormalizedPayloadHash(payload: unknown): string {
  // Sort object keys recursively for canonical deterministic hashing
  const stringifyDeterministic = (obj: unknown): string => {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return `[${obj.map(stringifyDeterministic).join(',')}]`;
    }
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${stringifyDeterministic((obj as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  };

  const canonicalJson = stringifyDeterministic(payload);
  return crypto.createHash('sha256').update(canonicalJson).digest('hex');
}

// 5. In-Memory IP Rate Limiter (30 requests per minute for AI routes)
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

export function resetRateLimitStore(): void {
  rateLimitMap.clear();
}

export function ipRateLimiter(maxRequests = 30, windowMs = 60000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const now = Date.now();
    const record = rateLimitMap.get(clientIp);

    if (!record || now > record.resetTime) {
      rateLimitMap.set(clientIp, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (record.count >= maxRequests) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Maximum ${maxRequests} requests per minute.`,
      });
      return;
    }

    record.count++;
    next();
  };
}

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'VayuPulse AI Gateway',
  });
});

// 6. /api/ai/forecast endpoint (Phase 4)
app.post('/api/ai/forecast', ipRateLimiter(30, 60000), (req: Request, res: Response, next: NextFunction) => {
  try {
    const zoneId = (req.body?.zoneId as SectorId) || 'CBD';
    const rawHour = req.body?.currentHour;
    const currentHour = typeof rawHour === 'number' && !isNaN(rawHour) ? rawHour : Number(rawHour ?? 8) || 0;

    const cacheKey = computeNormalizedPayloadHash({ route: 'forecast', zoneId, currentHour });
    const cached = planCache.get(cacheKey);

    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.json(cached);
      return;
    }

    const forecast = generate24HourMLForecast(
      zoneId,
      [],
      currentHour,
      {
        hourOfDay: currentHour,
        groundTempC: 8.0,
        upperTempC: 11.5,
        windSpeedKmH: 3.5,
        relativeHumidity: 75,
      }
    );

    planCache.set(cacheKey, forecast as unknown as Record<string, unknown>);
    res.setHeader('X-Cache', 'MISS');
    res.json(forecast);
  } catch (err) {
    next(err);
  }
});

// 7. /api/ai/plan endpoint (Phase 4)
app.post('/api/ai/plan', ipRateLimiter(30, 60000), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as PlanRequest;
    if (!body || !body.persona || !body.zoneId) {
      res.status(400).json({ error: 'Bad Request', message: 'Missing required fields: persona, zoneId.' });
      return;
    }

    const cacheKey = computeNormalizedPayloadHash({ route: 'plan', ...body });
    const cached = planCache.get(cacheKey);

    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.json(cached);
      return;
    }

    const plan = await defaultOrchestrator.planRoutine(body);
    planCache.set(cacheKey, plan as unknown as Record<string, unknown>);
    res.setHeader('X-Cache', 'MISS');
    res.json(plan);
  } catch (err) {
    next(err);
  }
});

// 8. /api/ai/vision-haze endpoint (Phase 6 - 2 MB size cap, Sharp EXIF strip)
app.post(
  '/api/ai/vision-haze',
  ipRateLimiter(30, 60000),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let imageBuffer: Buffer;
      let mimeType = 'image/jpeg';

      if (Buffer.isBuffer(req.body)) {
        imageBuffer = req.body;
        const ct = req.headers['content-type'];
        if (ct && ct.includes('image/')) {
          mimeType = ct.split(';')[0]?.trim() || 'image/jpeg';
        }
      } else if (req.body && typeof req.body === 'object' && 'imageBase64' in req.body) {
        const b64 = req.body.imageBase64 as string;
        imageBuffer = Buffer.from(b64, 'base64');
        mimeType = (req.body.mimeType as string) || 'image/jpeg';
      } else {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Provide an image as binary payload or JSON { imageBase64, mimeType }.',
        });
        return;
      }

      const hazeResult = await estimateSkylineHaze(imageBuffer, mimeType);
      res.json(hazeResult);
    } catch (err) {
      if (err instanceof Error && err.message.includes('exceeds 2 MB limit')) {
        res.status(413).json({ error: 'Payload Too Large', message: err.message });
        return;
      }
      if (err instanceof Error && err.message.includes('Unsupported image type')) {
        res.status(400).json({ error: 'Bad Request', message: err.message });
        return;
      }
      next(err);
    }
  }
);

// 9. CWE-209-Safe Global Error Handler
// Never leaks stack traces or system internals to callers
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // Handle 15KB entity too large from body-parser
  if ('type' in err && err.type === 'entity.too.large') {
    res.status(413).json({
      error: 'Payload Too Large',
      message: 'Request payload exceeds the 15 KB limit.',
    });
    return;
  }

  // Handle CORS rejection
  if (err.message && err.message.includes('CORS')) {
    res.status(403).json({ error: 'Forbidden', message: err.message });
    return;
  }

  // Generic sanitized safe error response
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server if executed directly
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[VayuPulse AI] Gateway running on http://localhost:${PORT}`);
  });
}
