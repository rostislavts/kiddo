import "server-only";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import { DomainError } from "@/lib/errors";
export function paddle() {
  if (!process.env.PADDLE_API_KEY)
    throw new DomainError(
      "billing_config",
      "Плащанията още не са настроени. Безплатните уроци са достъпни.",
      503,
    );
  return new Paddle(process.env.PADDLE_API_KEY, {
    environment:
      process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
        ? Environment.production
        : Environment.sandbox,
  });
}
