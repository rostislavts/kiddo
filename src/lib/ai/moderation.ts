import type { AIProvider } from "./provider";
import { DomainError } from "@/lib/errors";
import { localSafety } from "./safety";
export async function moderateText(
  provider: AIProvider,
  text: string,
  signal: AbortSignal,
  maxChars: number,
) {
  localSafety(text, maxChars);
  if (!(await provider.moderate({ text, signal })))
    throw new DomainError(
      "moderated",
      "Нека променим задачата, за да е подходяща и безопасна.",
      422,
    );
}
export async function moderateImage(provider: AIProvider, image: string, signal: AbortSignal) {
  if (!(await provider.moderate({ image, signal })))
    throw new DomainError("moderated", "Нека опитаме с друга безопасна идея за изображение.", 422);
}
