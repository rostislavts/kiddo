import type { AIProvider, TextRequest } from "./provider";
export async function generateText(provider: AIProvider, input: TextRequest) {
  return provider.text(input);
}
