/**
 * @file openAiAdapter.ts
 * @description OpenAI provider adapter for gpt-6.1-sol and gpt-6-luna.
 * Features safe fallthrough on missing keys or deprecated models.
 */

export interface OpenAiResult {
  text: string;
  provider: 'openai';
  model: string;
}

export async function callOpenAi(
  systemPrompt: string,
  userPrompt: string,
  modelRole: 'planner' | 'fast' = 'planner'
): Promise<OpenAiResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null; // Graceful offline/test degradation
  }

  const model =
    modelRole === 'planner'
      ? process.env.OPENAI_MODEL_PLANNER || 'gpt-6.1-sol'
      : process.env.OPENAI_MODEL_FAST || 'gpt-6-luna';

  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return null;

    return {
      text: content,
      provider: 'openai',
      model,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[OpenAI Adapter] Model ${model} execution error: ${err instanceof Error ? err.message : String(err)}. Falling through.`);
    return null;
  }
}
