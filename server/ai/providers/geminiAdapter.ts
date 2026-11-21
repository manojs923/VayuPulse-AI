/**
 * @file geminiAdapter.ts
 * @description Google Gemini 3.5 Flash-Lite provider adapter.
 * 
 * Rules:
 * - Strictly OMIT temperature, top_p, top_k, and prefilled model turns (removed/deprecated for this family).
 * - Use thinking level 'medium' or 'high' for Planner and Safety Critic calls.
 * - Use 'minimal' only for fast triage/classification.
 * - Graceful fallthrough on model not found or deprecation.
 */

export interface GeminiRequestConfig {
  model: string;
  thinkingLevel: 'minimal' | 'medium' | 'high';
  systemInstruction?: string;
}

/**
 * Builds Gemini request configuration ensuring strict compliance with Gemini 3.5 Flash-Lite rules.
 * NEVER includes temperature, top_p, or top_k.
 */
export function buildGeminiRequestConfig(
  purpose: 'planner' | 'critic' | 'triage',
  modelOverride?: string
): GeminiRequestConfig {
  const model = modelOverride || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

  // Strict thinking level rules: Planner and Critic require medium or high
  const thinkingLevel: 'minimal' | 'medium' | 'high' =
    purpose === 'triage' ? 'minimal' : 'medium';

  const systemInstruction =
    purpose === 'critic'
      ? 'You are the VayuPulse Safety Critic. Verify all protocol citations and check that vulnerable personas receive protective advice.'
      : 'You are the VayuPulse Clean-Air Planner. Ground recommendations in tools and verified protocols. Never compute numbers directly.';

  return {
    model,
    thinkingLevel,
    systemInstruction,
  };
}

export interface GeminiGenerationResult {
  text: string;
  provider: 'gemini';
  model: string;
  tokensUsed?: number;
}

/**
 * Calls Gemini with fallback protection. In test or key-less environments,
 * falls through gracefully.
 */
export async function callGemini(
  prompt: string,
  purpose: 'planner' | 'critic' | 'triage' = 'planner'
): Promise<GeminiGenerationResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null; // Graceful offline/test degradation
  }

  const config = buildGeminiRequestConfig(purpose);

  try {
    // Dynamic import to avoid crash if SDK not initialized
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    
    // Construct request according to Gemini 3.5 specifications
    // DO NOT pass temperature, top_p, or top_k
    const response = await ai.models.generateContent({
      model: config.model,
      contents: prompt,
      config: {
        systemInstruction: config.systemInstruction,
      },
    });

    return {
      text: response.text || '',
      provider: 'gemini',
      model: config.model,
    };
  } catch (err) {
    // Log safe error and fall through
    // eslint-disable-next-line no-console
    console.warn(`[Gemini Adapter] Provider failed or model not found: ${err instanceof Error ? err.message : String(err)}. Falling through.`);
    return null;
  }
}
