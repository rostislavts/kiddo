import { z } from "zod";
import type { AIProvider, TextRequest } from "./provider";
export async function generateStructured<T extends z.ZodType>(
  provider: AIProvider,
  input: TextRequest,
  schema: T,
) {
  const jsonSchema = z.toJSONSchema(schema, { target: "draft-7" });
  delete jsonSchema.$schema;
  const output = await provider.text({ ...input, schema: jsonSchema });
  return {
    value: schema.parse(JSON.parse(output.text)) as z.infer<T>,
    usage: output.usage,
    text: output.text,
  };
}
