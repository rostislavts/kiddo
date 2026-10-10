import { NextResponse } from "next/server";
import { z } from "zod";
import { DomainError } from "./errors";
export function errorResponse(error: unknown) {
  if (error instanceof DomainError)
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return NextResponse.json({ error: "Провери въведените данни." }, { status: 400 });
  console.error("Request failed", { kind: error instanceof Error ? error.name : "UnknownError" });
  return NextResponse.json({ error: "Не успяхме да запазим. Опитай отново." }, { status: 500 });
}
export async function readJson(request: Request, maxBytes = 100_000): Promise<unknown> {
  return JSON.parse(await readText(request, maxBytes));
}
export async function readText(request: Request, maxBytes = 100_000): Promise<string> {
  if (Number(request.headers.get("content-length") || 0) > maxBytes)
    throw new DomainError("size", "Заявката е прекалено голяма.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new DomainError("body", "Липсва съдържание.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new DomainError("size", "Заявката е прекалено голяма.", 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
