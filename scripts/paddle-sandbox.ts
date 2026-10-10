import "./load-env";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { Environment, Paddle, type Price, type Product } from "@paddle/paddle-node-sdk";
type ClientToken = Awaited<ReturnType<Paddle["clientTokens"]["create"]>>;

// Matches existing entries in the Paddle sandbox catalog. Renaming it makes this
// script miss them and create duplicates, so it stays stable across rebrands.
const appTag = "ai-academy-kids";
const tokenName = "AI Academy Kids — Sandbox";
const webhookName = "AI Academy Kids — local sandbox webhook";
const productInput = {
  name: "AI Академия — Premium",
  description:
    "Месечен достъп до всички публикувани светове, уроци и детски профили в AI Академия.",
  taxCategory: "saas" as const,
  customData: { application: appTag, plan: "premium" },
};
const priceInput = {
  name: "Premium — месечен абонамент",
  description: "AI Academy Kids Premium / EUR 14.90 monthly / sandbox",
  unitPrice: { amount: "1490", currencyCode: "EUR" as const },
  billingCycle: { interval: "month" as const, frequency: 1 },
  trialPeriod: null,
  taxMode: "internal" as const,
  quantity: { minimum: 1, maximum: 1 },
  customData: { application: appTag, plan: "premium-monthly" },
};
const events = [
  "transaction.paid",
  "transaction.completed",
  "transaction.payment_failed",
  "transaction.past_due",
  "subscription.created",
  "subscription.activated",
  "subscription.updated",
  "subscription.trialing",
  "subscription.canceled",
  "subscription.paused",
  "subscription.resumed",
  "subscription.past_due",
] satisfies Parameters<Paddle["notificationSettings"]["create"]>[0]["subscribedEvents"];

function saveEnv(values: Record<string, string>) {
  const path = ".env.local";
  let content = existsSync(path) ? readFileSync(path, "utf8") : "# Local settings; never commit.\n";
  for (const [key, value] of Object.entries(values)) {
    if (/[\r\n]/.test(value)) throw new Error("Невалидна стойност за environment variable.");
    const pattern = new RegExp(`^${key}=.*$`, "m");
    const line = `${key}=${value}`;
    content = pattern.test(content)
      ? content.replace(pattern, () => line)
      : `${content.trimEnd()}\n${line}\n`;
  }
  // Re-read immediately before every write, preserving changes in unrelated settings.
  writeFileSync(`${path}.tmp`, content, { mode: 0o600 });
  renameSync(`${path}.tmp`, path);
}

function matchingPrice(price: Price) {
  return (
    price.status === "active" &&
    price.type === "standard" &&
    price.unitPrice.amount === "1490" &&
    price.unitPrice.currencyCode === "EUR" &&
    price.billingCycle?.interval === "month" &&
    price.billingCycle.frequency === 1 &&
    price.trialPeriod === null &&
    price.taxMode === "internal" &&
    price.unitPriceOverrides.length === 0 &&
    price.quantity.minimum === 1 &&
    price.quantity.maximum === 1
  );
}

async function main() {
  const { values } = parseArgs({
    options: { "dry-run": { type: "boolean" }, "webhook-url": { type: "string" } },
  });
  const webhookUrl = values["webhook-url"];
  if (webhookUrl) {
    const url = new URL(webhookUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/api/paddle/webhook" ||
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    ) {
      throw new Error("Webhook адресът трябва да е публичен HTTPS URL с път /api/paddle/webhook.");
    }
  }
  if (values["dry-run"]) {
    console.log(
      JSON.stringify(
        {
          environment: "sandbox",
          product: productInput,
          price: priceInput,
          clientToken: tokenName,
          webhook: webhookUrl
            ? { destination: webhookUrl, events }
            : "Нужен е HTTPS tunnel за webhook.",
        },
        null,
        2,
      ),
    );
    return;
  }
  const key = process.env.PADDLE_API_KEY;
  if (!key?.startsWith("pdl_sdbx_apikey_")) {
    throw new Error(
      "Попълни PADDLE_API_KEY в .env.local с Paddle Sandbox API ключ (pdl_sdbx_apikey_…). Няма направени API промени.",
    );
  }
  if (process.env.NEXT_PUBLIC_PADDLE_ENV !== "sandbox") {
    throw new Error("Задай NEXT_PUBLIC_PADDLE_ENV=sandbox. Тази команда работи само в Sandbox.");
  }
  const paddle = new Paddle(key, { environment: Environment.sandbox });
  let product: Product | undefined;
  let price: Price | undefined;
  // Respect an explicitly configured price; verify it before any writes.
  if (process.env.PADDLE_MONTHLY_PRICE_ID) {
    price = await paddle.prices.get(process.env.PADDLE_MONTHLY_PRICE_ID);
    product = await paddle.products.get(price.productId);
    if (!matchingPrice(price) || product.status !== "active") {
      throw new Error(
        "Зададената цена не съответства на активния план 14,90 EUR/месец. Провери PADDLE_MONTHLY_PRICE_ID.",
      );
    }
  } else {
    for await (const candidate of paddle.products.list({ status: ["active"], perPage: 200 })) {
      if (
        candidate.customData?.application === appTag &&
        candidate.customData?.plan === "premium"
      ) {
        product = candidate;
        break;
      }
    }
    product ??= await paddle.products.create(productInput);
    for await (const candidate of paddle.prices.list({
      productId: [product.id],
      status: ["active"],
      perPage: 200,
    })) {
      if (matchingPrice(candidate)) {
        price = candidate;
        break;
      }
    }
    price ??= await paddle.prices.create({ ...priceInput, productId: product.id });
  }
  saveEnv({ PADDLE_MONTHLY_PRICE_ID: price.id });
  console.log(`Sandbox продукт: ${product.id}; цена: ${price.id} (14,90 EUR/месец).`);
  let token: ClientToken | undefined;
  for await (const candidate of paddle.clientTokens.list({ status: ["active"], perPage: 200 })) {
    if (
      candidate.token === process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ||
      candidate.name === tokenName
    ) {
      token = candidate;
      break;
    }
  }
  token ??= await paddle.clientTokens.create({
    name: tokenName,
    description: "Local sandbox checkout for AI Academy Kids",
  });
  if (!token.token.startsWith("test_")) throw new Error("Очаква се Sandbox client-side token.");
  saveEnv({ NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: token.token });
  console.log("Sandbox checkout token е записан в .env.local.");
  if (webhookUrl) {
    const settings = await paddle.notificationSettings.list();
    const existing = settings.find((s) => s.description === webhookName);
    const configuration = {
      description: webhookName,
      destination: webhookUrl,
      subscribedEvents: events,
      apiVersion: 1,
      includeSensitiveFields: false,
      trafficSource: "all" as const,
    };
    const destination = existing
      ? await paddle.notificationSettings.update(existing.id, { ...configuration, active: true })
      : await paddle.notificationSettings.create({ ...configuration, type: "url" });
    if (!destination.endpointSecretKey) throw new Error("Paddle не върна webhook signing secret.");
    saveEnv({ PADDLE_NOTIFICATION_WEBHOOK_SECRET: destination.endpointSecretKey });
    console.log(`Sandbox webhook: ${destination.id}. Signing secret е записан в .env.local.`);
  } else {
    console.log(
      "Каталогът е готов. За webhook изпълни отново с --webhook-url=https://ТВОЯТ-TUNNEL/api/paddle/webhook.",
    );
  }
  console.log(
    "Рестартирай Next.js след промяната на client-side token. Checkout домейнът и default payment link се настройват отделно в Paddle.",
  );
}

main().catch((error: unknown) => {
  if (error && typeof error === "object" && "code" in error) {
    console.error(
      `Paddle API: ${String(error.code)}. Провери Sandbox ключа, правата и настройките на акаунта.`,
    );
  } else console.error(error instanceof Error ? error.message : "Неуспешна Sandbox настройка.");
  process.exitCode = 1;
});
