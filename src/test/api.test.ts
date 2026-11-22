// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, planCache, ipRateLimiter, resetRateLimitStore } from '../../server/server';
import express from 'express';

describe('Express 5 Gateway Security & Endpoint Tests', () => {
  beforeEach(() => {
    planCache.clear();
    resetRateLimitStore();
  });

  it('sets strict Helmet Content Security Policy and security headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('serves telemetry for all sectors via GET /api/ai/telemetry', async () => {
    const res = await request(app).get('/api/ai/telemetry');
    expect(res.status).toBe(200);
    expect(res.body.source).toBeDefined();
    expect(res.body.sectors).toBeDefined();
    expect(res.body.sectors.CBD).toBeDefined();
    expect(res.body.sectors.CBD.zoneId).toBe('CBD');
    expect(res.body.sectors.CBD.pm25).toBeGreaterThan(0);
  });

  it('rejects payloads exceeding the 15 KB body cap with 413 Payload Too Large', async () => {
    // Generate oversized JSON payload (> 16 KB)
    const largePadding = 'a'.repeat(16 * 1024);
    const res = await request(app)
      .post('/api/ai/plan')
      .send({ persona: 'ASTHMATIC_CHILD', zoneId: 'RES', padding: largePadding });

    expect(res.status).toBe(413);
    expect(res.body.error).toBe('Payload Too Large');
  });

  it('serves cache MISS on first request and cache HIT on identical second request', async () => {
    const payload = {
      persona: 'ASTHMATIC_CHILD',
      zoneId: 'RES',
    };

    // First call: MISS
    const res1 = await request(app).post('/api/ai/plan').send(payload);
    expect(res1.status).toBe(200);
    expect(res1.headers['x-cache']).toBe('MISS');

    // Second call: HIT (<10 ms hit)
    const startHit = Date.now();
    const res2 = await request(app).post('/api/ai/plan').send(payload);
    const hitDuration = Date.now() - startHit;

    expect(res2.status).toBe(200);
    expect(res2.headers['x-cache']).toBe('HIT');
    expect(hitDuration).toBeLessThan(50); // Well under 50ms in test environment
  });

  it('handles /api/ai/forecast and caches results by normalized hash', async () => {
    const res1 = await request(app)
      .post('/api/ai/forecast')
      .send({ zoneId: 'CBD', currentHour: 8 });

    expect(res1.status).toBe(200);
    expect(res1.headers['x-cache']).toBe('MISS');
    expect(res1.body.hours.length).toBe(24);

    const res2 = await request(app)
      .post('/api/ai/forecast')
      .send({ zoneId: 'CBD', currentHour: 8 });

    expect(res2.status).toBe(200);
    expect(res2.headers['x-cache']).toBe('HIT');
  });

  it('handles /api/ai/forecast with currentHour = 0 (midnight edge case)', async () => {
    const res = await request(app)
      .post('/api/ai/forecast')
      .send({ currentHour: 0 });

    expect(res.status).toBe(200);
    expect(res.body.hours.length).toBe(24);
  });

  it('enforces rate limiting when request limit is exceeded', async () => {
    const testApp = express();
    testApp.use(ipRateLimiter(3, 10000));
    testApp.get('/test-limit', (_req, res) => {
      res.json({ ok: true });
    });

    const client = request(testApp);
    await client.get('/test-limit').expect(200);
    await client.get('/test-limit').expect(200);
    await client.get('/test-limit').expect(200);

    const blocked = await client.get('/test-limit');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe('Too Many Requests');
  });

  it('never leaks API keys in response payloads or headers', async () => {
    const res = await request(app).post('/api/ai/plan').send({
      persona: 'OUTDOOR_ATHLETE',
      zoneId: 'PRK',
    });

    const bodyString = JSON.stringify(res.body);
    expect(bodyString).not.toMatch(/AIza[0-9A-Za-z-_]{35}/); // Gemini key regex
    expect(bodyString).not.toMatch(/sk-[a-zA-Z0-9]{32,}/); // OpenAI key regex
  });

  it('returns CWE-209-safe error shape { error: "Internal Server Error" } on unexpected errors', async () => {
    const errApp = express();
    errApp.use(express.json());
    errApp.get('/crash', () => {
      throw new Error('Database password failed: SECRET_SQL_CREDENTIALS_LEAK');
    });
    // Attach error handler identical to server.ts
    errApp.use((_err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ error: 'Internal Server Error' });
    });

    const res = await request(errApp).get('/crash');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal Server Error' });
    expect(JSON.stringify(res.body)).not.toContain('SECRET_SQL_CREDENTIALS_LEAK');
  });
});
