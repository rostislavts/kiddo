import type { AIUsage } from "./provider";
import type { AIConfig } from "./models";
export const emptyUsage = (): AIUsage => ({ inputTokens: 0, outputTokens: 0, images: 0 });
export function addUsage(total: AIUsage, value: AIUsage, model?: string) {
  total.inputTokens += value.inputTokens;
  total.outputTokens += value.outputTokens;
  total.images += value.images;
  if (value.reported === false) total.reported = false;
  if (model) {
    total.byModel ??= {};
    const bucket = (total.byModel[model] ??= { inputTokens: 0, outputTokens: 0, images: 0 });
    bucket.inputTokens += value.inputTokens;
    bucket.outputTokens += value.outputTokens;
    bucket.images += value.images;
    if (value.reported === false) bucket.reported = false;
  }
}
export function usageMetadata(usage: AIUsage, model: string, config: AIConfig) {
  const entries = Object.entries(usage.byModel ?? { [model]: usage });
  let estimate = 0;
  let known = true;
  for (const [name, value] of entries) {
    const price = config.prices[name];
    if (!price || value.reported === false) {
      known = false;
      continue;
    }
    estimate +=
      (value.inputTokens / 1e6) * price.inputPerMillion +
      (value.outputTokens / 1e6) * price.outputPerMillion +
      value.images * price.perImage;
  }
  return { ...usage, estimatedCostUsd: known && usage.reported !== false ? estimate : null };
}
