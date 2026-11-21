/**
 * @file bandit.ts
 * @description Contextual Bandit Personalization using Thompson Sampling.
 * Learns preferred clean-air recommendation styles (Action-Oriented, Scientific, Minimalist)
 * from local user feedback stored in localStorage.
 */

export type RecommendationVariantId = 'ACTION_FOCUSED' | 'SCIENTIFIC_RIGOR' | 'PRECAUTIONARY_MINIMALIST';

export interface BanditArm {
  id: RecommendationVariantId;
  label: string;
  alpha: number; // Successes + 1
  beta: number;  // Failures + 1
  description: string;
}

export interface BanditState {
  arms: Record<RecommendationVariantId, BanditArm>;
  totalPulls: number;
}

export const INITIAL_BANDIT_STATE: BanditState = {
  arms: {
    ACTION_FOCUSED: {
      id: 'ACTION_FOCUSED',
      label: 'Action-First Routine',
      alpha: 2,
      beta: 1,
      description: 'Prioritizes immediate physical steps, purifier settings, and transit modes.',
    },
    SCIENTIFIC_RIGOR: {
      id: 'SCIENTIFIC_RIGOR',
      label: 'Scientific & Physical Rigor',
      alpha: 2,
      beta: 1,
      description: 'Emphasizes boundary-layer lapse rates, ACH decay curves, and WHO PM2.5 thresholds.',
    },
    PRECAUTIONARY_MINIMALIST: {
      id: 'PRECAUTIONARY_MINIMALIST',
      label: 'Precautionary Minimalist',
      alpha: 2,
      beta: 1,
      description: 'Concise high-impact warnings and essential shelter instructions.',
    },
  },
  totalPulls: 0,
};

/**
 * Generates standard normal random variable using Box-Muller transform.
 */
function randomStandardNormal(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Samples a Gamma(alpha, 1) random variable using Marsaglia and Tsang method.
 */
function sampleGamma(alpha: number): number {
  if (alpha < 1) {
    return sampleGamma(alpha + 1) * Math.pow(Math.random(), 1 / alpha);
  }

  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    let z = randomStandardNormal();
    let v = 1 + c * z;
    while (v <= 0) {
      z = randomStandardNormal();
      v = 1 + c * z;
    }

    v = v * v * v;
    const u = Math.random();

    if (u < 1 - 0.0331 * z * z * z * z) {
      return d * v;
    }
    if (Math.log(u) < 0.5 * z * z + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

/**
 * Samples from a Beta(alpha, beta) distribution via ratio of Gammas:
 * X ~ Gamma(alpha, 1), Y ~ Gamma(beta, 1) -> Beta = X / (X + Y).
 */
export function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGamma(Math.max(0.1, alpha));
  const y = sampleGamma(Math.max(0.1, beta));
  return x / (x + y);
}

const STORAGE_KEY = 'vayupulse_bandit_state';

/**
 * Loads bandit state from localStorage with safe fallback.
 */
export function loadBanditState(): BanditState {
  if (typeof window === 'undefined') return INITIAL_BANDIT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_BANDIT_STATE;
    const parsed = JSON.parse(raw) as BanditState;
    if (parsed && parsed.arms && parsed.arms.ACTION_FOCUSED) {
      return parsed;
    }
    return INITIAL_BANDIT_STATE;
  } catch {
    return INITIAL_BANDIT_STATE;
  }
}

/**
 * Saves bandit state to localStorage.
 */
export function saveBanditState(state: BanditState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Selects the next recommendation variant using Thompson Sampling.
 */
export function selectVariantViaThompsonSampling(state: BanditState = loadBanditState()): {
  selectedVariant: RecommendationVariantId;
  sampledValues: Record<RecommendationVariantId, number>;
} {
  const armKeys = Object.keys(state.arms) as RecommendationVariantId[];
  const sampledValues: Partial<Record<RecommendationVariantId, number>> = {};

  let bestVariant: RecommendationVariantId = 'ACTION_FOCUSED';
  let maxSample = -1;

  for (const armId of armKeys) {
    const arm = state.arms[armId];
    const sample = sampleBeta(arm.alpha, arm.beta);
    sampledValues[armId] = Math.round(sample * 1000) / 1000;

    if (sample > maxSample) {
      maxSample = sample;
      bestVariant = armId;
    }
  }

  return {
    selectedVariant: bestVariant,
    sampledValues: sampledValues as Record<RecommendationVariantId, number>,
  };
}

/**
 * Updates bandit posterior distributions after user provides "Was this helpful?" feedback.
 */
export function updateBanditFeedback(
  variantId: RecommendationVariantId,
  wasHelpful: boolean
): BanditState {
  const state = loadBanditState();
  const arm = state.arms[variantId];

  if (arm) {
    if (wasHelpful) {
      arm.alpha += 1;
    } else {
      arm.beta += 1;
    }
    state.totalPulls += 1;
    saveBanditState(state);
  }

  return state;
}
