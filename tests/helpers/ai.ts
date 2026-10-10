import type { AIProvider, TextRequest } from "@/lib/ai/provider";
export class TestAI implements AIProvider {
  readonly name = "fixture";
  calls: TextRequest[] = [];
  moderations = 0;
  blocked = false;
  failure = false;
  respond: (request: TextRequest) => string = (request) =>
    request.schema
      ? JSON.stringify({
          narration: "Роботът открива светла библиотека.",
          choices: ["Отвори книгата", "Попитай библиотекаря"],
          stateChanges: { discoveredClue: "Синя книга" },
          missionStatus: "completed",
        })
      : "Роботът открива нова история.";
  async text(request: TextRequest) {
    this.calls.push(request);
    if (this.failure) throw new Error("fixture provider unavailable");
    return { text: this.respond(request), usage: { inputTokens: 30, outputTokens: 20, images: 0 } };
  }
  async image() {
    if (this.failure) throw new Error("fixture provider unavailable");
    return {
      base64: Buffer.from([255, 216, 255, 217]).toString("base64"),
      mime: "image/jpeg" as const,
      usage: { inputTokens: 5, outputTokens: 10, images: 1 },
    };
  }
  async moderate() {
    this.moderations++;
    return !this.blocked;
  }
}
