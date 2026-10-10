import type { z } from "zod";
import { requirementSchema } from "@/lib/ai/schemas";
export type RequirementResult = { label: string; passed: boolean; detail: string };
const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("bg");
export function evaluateRequirements(
  output: string,
  requirements: z.infer<typeof requirementSchema>[],
): RequirementResult[] {
  return requirements
    .filter((r) => r.type !== "semantic")
    .map((r) => {
      const text = normalize(output);
      switch (r.type) {
        case "required_terms":
          return {
            label: `Съдържа: ${r.terms.join(", ")}`,
            passed: r.terms.every((t) => text.includes(normalize(t))),
            detail: r.terms.filter((t) => !text.includes(normalize(t))).join(", "),
          };
        case "forbidden_terms":
          return {
            label: `Без: ${r.terms.join(", ")}`,
            passed: r.terms.every((t) => !text.includes(normalize(t))),
            detail: r.terms.filter((t) => text.includes(normalize(t))).join(", "),
          };
        case "word_count": {
          const count = output.match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu)?.length ?? 0;
          return {
            label: `${r.min}–${r.max} думи`,
            passed: count >= r.min && count <= r.max,
            detail: `${count} думи`,
          };
        }
        case "item_count": {
          const count = output
            .split(/\n/)
            .filter((line) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(line)).length;
          return {
            label: `${r.count} елемента`,
            passed: count === r.count,
            detail: `${count} елемента`,
          };
        }
        case "headings":
          return {
            label: "Заглавия",
            passed: r.headings.every((h) =>
              output
                .split(/\n/)
                .some((line) => normalize(line.replace(/^#+\s*/, "").trim()) === normalize(h)),
            ),
            detail: r.headings.join(", "),
          };
        case "json_keys": {
          let passed = false;
          try {
            const value = JSON.parse(output);
            passed =
              value !== null &&
              !Array.isArray(value) &&
              typeof value === "object" &&
              r.keys.every((k) => Object.hasOwn(value, k));
          } catch {}
          return { label: "Валиден JSON с нужните полета", passed, detail: r.keys.join(", ") };
        }
      }
    });
}
export function normalizeAnswer(answer: string) {
  return normalize(answer).replace(/[^\p{L}\p{N}]/gu, "");
}
