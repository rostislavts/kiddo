import type { AIProvider, TextRequest } from "./provider";
export async function analyzeImage(provider: AIProvider, input: TextRequest & { image: string }) {
  return provider.text(input);
}
