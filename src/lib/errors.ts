export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function assert(
  condition: unknown,
  message: string,
  code = "invalid",
  status = 400,
): asserts condition {
  if (!condition) throw new DomainError(code, message, status);
}
