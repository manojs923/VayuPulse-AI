/**
 * @file knowledgeBase.ts
 * @description Curated environmental health & clean air protocol knowledge base.
 * Features:
 * - Stable protocol IDs ([WHO-PM25-24H], [EPA-AQI-THRESH], etc.)
 * - Pure BM25 text retrieval
 * - Cosine vector search with graceful degradation
 * - Reciprocal Rank Fusion (RRF)
 * - Safe untrusted text containment
 */

import { stripControlChars } from '../../src/lib/sanitize';

export interface ProtocolChunk {
  id: string;
  title: string;
  category: 'guideline' | 'clinical' | 'equipment' | 'ventilation';
  text: string;
  source: string;
  embedding?: number[];
}

export const PROTOCOL_CORPUS: readonly ProtocolChunk[] = [
  {
    id: '[WHO-PM25-24H]',
    title: 'WHO Global Air Quality Guidelines (2021 Update)',
    category: 'guideline',
    text: 'The World Health Organization guideline stipulates that 24-hour average PM2.5 concentrations should not exceed 15 µg/m³, and annual averages should not exceed 5 µg/m³. Short-term elevations above 35 µg/m³ trigger acute pulmonary inflammation, exacerbate asthma symptoms, and elevate cardiovascular mortality risks across exposed urban populations.',
    source: 'World Health Organization (2021) WHO Air Quality Guidelines for Particulate Matter.',
    embedding: [0.8, 0.2, 0.1, 0.1],
  },
  {
    id: '[EPA-AQI-THRESH]',
    title: 'EPA NAAQS Air Quality Index Breakpoints (2024)',
    category: 'guideline',
    text: 'US EPA classifies PM2.5 concentrations above 35.4 µg/m³ as Unhealthy for Sensitive Groups (AQI 101–150). Concentrations between 55.5 and 125.4 µg/m³ are classified as Unhealthy (AQI 151–200). Values exceeding 125.5 µg/m³ represent Very Unhealthy levels (AQI 201–300), and values over 225.5 µg/m³ trigger Hazardous emergency public alerts.',
    source: 'US Environmental Protection Agency (2024) Revisions to NAAQS for Fine Particles.',
    embedding: [0.7, 0.3, 0.1, 0.1],
  },
  {
    id: '[PED-ASTHMA-VULN]',
    title: 'Pediatric Asthma Vulnerability & Activity Modifications',
    category: 'clinical',
    text: 'Children inhale approximately 50% more air per pound of body weight than adults, leading to disproportionate alveolar deposition of fine particles. When ambient PM2.5 exceeds 35 µg/m³, school recess and outdoor athletic training must be transitioned indoors to spaces with active mechanical filtration. Quick-relief bronchodilators should be readily accessible.',
    source: 'American Academy of Pediatrics Council on Environmental Health (2022).',
    embedding: [0.2, 0.9, 0.1, 0.1],
  },
  {
    id: '[ELDER-CARD-RISK]',
    title: 'Geriatric & Cardiovascular Protection Protocol',
    category: 'clinical',
    text: 'Elderly individuals and patients with coronary artery disease or heart failure experience heightened autonomic imbalance, endothelial dysfunction, and increased ischemic events during particulate episodes. Strenuous outdoor walks should be canceled when AQI exceeds 100. Continuous indoor filtration maintaining PM2.5 < 12 µg/m³ significantly stabilizes blood pressure and microvascular function.',
    source: 'American Heart Association Scientific Statement on Air Pollution and Cardiovascular Disease.',
    embedding: [0.2, 0.8, 0.2, 0.1],
  },
  {
    id: '[N95-PHYSICS]',
    title: 'Respiratory Personal Protection & Filtration Physics',
    category: 'equipment',
    text: 'Certified N95, FFP2, or KF94 respirators utilize electret melt-blown polymers that capture sub-micron aerosols through electrostatic attraction and Brownian diffusion, filtering at least 95% of particles down to 0.3 µm. Standard surgical masks and cloth coverings provide less than 30% filtration efficiency for sub-micron winter smog due to poor perimeter facial seal.',
    source: 'NIOSH / Journal of Aerosol Science & Technology on Filtering Facepiece Respirators.',
    embedding: [0.1, 0.2, 0.9, 0.1],
  },
  {
    id: '[CR-BOX-SPEC]',
    title: 'DIY Corsi-Rosenthal Filtration Box Specifications',
    category: 'equipment',
    text: 'A DIY Corsi-Rosenthal Box constructed from four MERV 13 furnace filters (20x20x1 or 20x20x2) and a 20-inch box fan delivers approximately 350 m³/h (205 CFM) of clean air delivery rate (CADR) for sub-micron particulate removal at an approximate materials cost of $40 USD. The multi-filter cube design lowers face velocity, reduces fan static backpressure, and maintains high filtration throughput.',
    source: 'UC Davis Environmental Health Sciences Center / Rosenthal & Corsi (2021).',
    embedding: [0.1, 0.2, 0.8, 0.2],
  },
  {
    id: '[VENT-INVERSION]',
    title: 'Boundary-Layer Inversion Window-Ventilation Timing',
    category: 'ventilation',
    text: 'During winter temperature inversions, cold ground air traps tailpipe and biomass smoke beneath a warm lid from midnight through mid-morning. Windows should remain sealed between 22:00 and 10:00. Safe natural cross-ventilation should be restricted to the afternoon convective breakup window (typically 12:30–15:00) when solar warming dissipates the thermal inversion lid.',
    source: 'Atmospheric Environment Journal / Indoor-Outdoor Boundary Layer Exchange Studies.',
    embedding: [0.1, 0.1, 0.1, 0.95],
  },
];

export interface RetrievalResult {
  id: string;
  title: string;
  category: string;
  text: string;
  source: string;
  bm25Score: number;
  vectorScore?: number;
  fusedScore: number;
}

/**
 * Tokenizes text into lowercase normalized alphanumeric tokens.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/**
 * Pure BM25 text retrieval implementation.
 */
export class BM25Engine {
  private readonly corpus: readonly ProtocolChunk[];
  private readonly docTokens: string[][];
  private readonly docLengths: number[];
  private readonly avgDocLength: number;
  private readonly idf: Map<string, number> = new Map();
  private readonly k1 = 1.2;
  private readonly b = 0.75;

  constructor(corpus: readonly ProtocolChunk[] = PROTOCOL_CORPUS) {
    this.corpus = corpus;
    this.docTokens = corpus.map((c) => tokenize(`${c.title} ${c.text}`));
    this.docLengths = this.docTokens.map((t) => t.length);
    const totalLength = this.docLengths.reduce((a, b) => a + b, 0);
    this.avgDocLength = totalLength / (this.docLengths.length || 1);

    // Compute document frequencies and IDF
    const N = corpus.length;
    const df = new Map<string, number>();

    for (const tokens of this.docTokens) {
      const unique = new Set(tokens);
      for (const token of unique) {
        df.set(token, (df.get(token) ?? 0) + 1);
      }
    }

    for (const [token, freq] of df.entries()) {
      // Standard Robertson-Sparck Jones IDF formula
      const idfVal = Math.log(1 + (N - freq + 0.5) / (freq + 0.5));
      this.idf.set(token, Math.max(0.1, idfVal));
    }
  }

  public search(query: string, topK = 3): { chunk: ProtocolChunk; score: number }[] {
    const qTokens = tokenize(query);
    if (qTokens.length === 0) {
      return this.corpus.slice(0, topK).map((chunk) => ({ chunk, score: 0 }));
    }

    const scores = this.corpus.map((chunk, docIdx) => {
      const tokens = this.docTokens[docIdx] ?? [];
      const docLen = this.docLengths[docIdx] ?? 1;

      // Count term frequencies in this document
      const tf = new Map<string, number>();
      for (const t of tokens) {
        tf.set(t, (tf.get(t) ?? 0) + 1);
      }

      let score = 0;
      for (const q of qTokens) {
        const idfVal = this.idf.get(q) ?? 0;
        const count = tf.get(q) ?? 0;
        if (count > 0 && idfVal > 0) {
          const numerator = count * (this.k1 + 1);
          const denominator = count + this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLength));
          score += idfVal * (numerator / denominator);
        }
      }

      return { chunk, score: Math.round(score * 1000) / 1000 };
    });

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

/**
 * Cosine similarity between two float vectors.
 */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Singleton instance of BM25 engine.
 */
export const defaultBM25Engine = new BM25Engine(PROTOCOL_CORPUS);

/**
 * Hybrid retrieval combining BM25 keyword matching with Reciprocal Rank Fusion (RRF).
 * When vector embeddings are unavailable or unconfigured, it gracefully degrades to BM25.
 * 
 * RRF Formula:
 *   Score(d) = sum( 1 / (60 + rank_i(d)) )
 * 
 * Untrusted Text Containment:
 *   All retrieved text is marked as reference content and cleansed of execution triggers.
 */
export function retrieveContext(
  query: string,
  topK = 3,
  queryVector?: number[]
): RetrievalResult[] {
  // 1. BM25 search
  const bm25Results = defaultBM25Engine.search(query, PROTOCOL_CORPUS.length);
  const bm25RankMap = new Map<string, number>();
  const bm25ScoreMap = new Map<string, number>();

  bm25Results.forEach((res, idx) => {
    bm25RankMap.set(res.chunk.id, idx + 1);
    bm25ScoreMap.set(res.chunk.id, res.score);
  });

  // 2. Vector search (if vector supplied)
  const vectorRankMap = new Map<string, number>();
  const vectorScoreMap = new Map<string, number>();

  if (queryVector && queryVector.length > 0) {
    const vectorMatches = PROTOCOL_CORPUS.map((chunk) => {
      const score = chunk.embedding ? cosineSimilarity(queryVector, chunk.embedding) : 0;
      return { chunk, score };
    })
      .sort((a, b) => b.score - a.score);

    vectorMatches.forEach((res, idx) => {
      vectorRankMap.set(res.chunk.id, idx + 1);
      vectorScoreMap.set(res.chunk.id, Math.round(res.score * 1000) / 1000);
    });
  }

  // 3. Reciprocal Rank Fusion (RRF)
  const k = 60;
  const fused = PROTOCOL_CORPUS.map((chunk) => {
    const bm25Rank = bm25RankMap.get(chunk.id) ?? PROTOCOL_CORPUS.length;
    const bm25RRF = 1 / (k + bm25Rank);

    let vectorRRF = 0;
    if (vectorRankMap.size > 0) {
      const vRank = vectorRankMap.get(chunk.id) ?? PROTOCOL_CORPUS.length;
      vectorRRF = 1 / (k + vRank);
    }

    const fusedScore = Math.round((bm25RRF + vectorRRF) * 100000) / 100000;

    // Sanitize untrusted chunk text to prevent prompt injection containment leaks
    const sanitizedText = stripControlChars(chunk.text.replace(/<[^>]*>/g, ''));

    const result: RetrievalResult = {
      id: chunk.id,
      title: chunk.title,
      category: chunk.category,
      text: sanitizedText,
      source: chunk.source,
      bm25Score: bm25ScoreMap.get(chunk.id) ?? 0,
      fusedScore,
    };

    if (vectorScoreMap.has(chunk.id)) {
      result.vectorScore = vectorScoreMap.get(chunk.id);
    }

    return result;
  });

  return fused
    .sort((a, b) => b.fusedScore - a.fusedScore)
    .slice(0, topK);
}
