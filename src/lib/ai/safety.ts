import { DomainError } from "@/lib/errors";
const privateData = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(?:https?:\/\/|www\.)\S+/i,
  /(?:\+?\d[\s().-]*){9,}/,
  /(?:адресът ми|моят адрес|my address|моето училище|my school|телефонът ми)\s*(?:е|is|:)/iu,
  /(?:sk-[a-z0-9_-]{16,}|sb_secret_|pdl_(?:live|sdbx)_apikey_)/i,
];
export function localSafety(text: string, maxChars = 8000) {
  if (text.length > maxChars)
    throw new DomainError("input_limit", "Съкрати текста, за да можем да го изследваме.", 413);
  if (privateData.some((re) => re.test(text)))
    throw new DomainError(
      "personal_data",
      "Използвай измислени герои. Премахни имейли, телефони, адреси, училище и връзки.",
      422,
    );
  if (
    /(?:chain[ -]of[ -]thought|hidden reasoning|скрит[ио] разсъждени|system prompt reveal|reveal.{0,20}system prompt)/iu.test(
      text,
    )
  )
    throw new DomainError(
      "safety",
      "Можем да покажем действията и резултата, но не и скритите вътрешни разсъждения.",
      422,
    );
  return text;
}
export const safeAdvice = "AI може да греши. Провери отговора и не споделяй лични данни.";
