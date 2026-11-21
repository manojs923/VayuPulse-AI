// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  retrieveContext,
  tokenize,
  cosineSimilarity,
  BM25Engine,
  PROTOCOL_CORPUS,
} from '../../server/rag/knowledgeBase';

describe('Hybrid RAG Knowledge Base & Retrieval Engine', () => {
  it('contains all required stable protocol IDs', () => {
    const requiredIds = [
      '[WHO-PM25-24H]',
      '[EPA-AQI-THRESH]',
      '[PED-ASTHMA-VULN]',
      '[ELDER-CARD-RISK]',
      '[N95-PHYSICS]',
      '[CR-BOX-SPEC]',
      '[VENT-INVERSION]',
    ];

    const presentIds = new Set(PROTOCOL_CORPUS.map((c) => c.id));
    for (const reqId of requiredIds) {
      expect(presentIds.has(reqId)).toBe(true);
    }
  });

  it('correctly tokenizes queries into normalized terms', () => {
    const tokens = tokenize('Corsi-Rosenthal Box (MERV-13) Air Filtration!');
    expect(tokens).toContain('corsi-rosenthal');
    expect(tokens).toContain('box');
    expect(tokens).toContain('merv-13');
    expect(tokens).toContain('filtration');
  });

  it('retrieves relevant protocol chunks via BM25', () => {
    const engine = new BM25Engine(PROTOCOL_CORPUS);
    const results = engine.search('pediatric asthma school recess', 2);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]?.chunk.id).toBe('[PED-ASTHMA-VULN]');
  });

  it('degrades gracefully to BM25-only when vector is omitted', () => {
    const results = retrieveContext('Corsi-Rosenthal box fan CADR', 3);
    expect(results.length).toBe(3);
    expect(results[0]?.id).toBe('[CR-BOX-SPEC]');
    expect(results[0]?.fusedScore).toBeGreaterThan(0);
    expect(results[0]?.vectorScore).toBeUndefined();
  });

  it('correctly calculates cosine similarity between float vectors', () => {
    const a = [1.0, 0.0, 0.5];
    const b = [1.0, 0.0, 0.5];
    const c = [0.0, 1.0, 0.0];

    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 4);
    expect(cosineSimilarity(a, c)).toBeCloseTo(0.0, 4);
  });

  it('fuses vector and BM25 scores when query vector is provided', () => {
    // Vector closely matching [VENT-INVERSION]
    const results = retrieveContext('inversion window ventilation', 5, [0.1, 0.1, 0.1, 0.95]);
    expect(results.length).toBe(5);

    const ventChunk = results.find((r) => r.id === '[VENT-INVERSION]');
    expect(ventChunk).toBeDefined();
    expect(ventChunk?.vectorScore).toBeDefined();
    expect(ventChunk?.vectorScore).toBeGreaterThan(0.9);
    expect(ventChunk?.fusedScore).toBeGreaterThan(0);
  });

  it('sanitizes untrusted text chunks preventing injection pass-through', () => {
    const results = retrieveContext('WHO guideline particulate', 1);
    expect(results[0]?.text).not.toContain('<script>');
  });
});
