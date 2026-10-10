import type { AIProvider } from "./provider";
import { moderateImage } from "./moderation";
export async function generateImage(
  provider: AIProvider,
  input: Parameters<AIProvider["image"]>[0],
) {
  const image = await provider.image(input);
  await moderateImage(provider, `data:${image.mime};base64,${image.base64}`, input.signal);
  return image;
}
