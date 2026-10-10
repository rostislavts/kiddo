import sharp from "sharp";
import { defaultAIConfig } from "../../src/lib/ai/models";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { SignJWT } from "jose";
import { testDatabase } from "../helpers/database";
import { processBillingEvent } from "../../src/lib/billing/webhooks";
import * as s from "../../src/db/schema";
import { eq } from "drizzle-orm";

type MockUser = {
  id: string;
  email: string;
  password: string;
  user_metadata: Record<string, unknown>;
};
async function main() {
  process.env.PADDLE_MONTHLY_PRICE_ID = "pri_test";
  const { client, db } = await testDatabase();
  const sqlServer = new PGLiteSocketServer({
    db: client,
    host: "127.0.0.1",
    port: 54328,
    maxConnections: 10,
  });
  await sqlServer.start();
  const users = new Map<string, MockUser>();
  const tokens = new Map<string, MockUser>();
  const transactions = new Map<string, Record<string, unknown>>();
  const publicUser = (user: MockUser) => ({
    id: user.id,
    email: user.email,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: user.user_metadata,
    created_at: new Date().toISOString(),
    email_confirmed_at: new Date().toISOString(),
  });
  async function session(user: MockUser) {
    const token = await new SignJWT({
      sub: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("e2e-only-secret-at-least-32-characters"));
    tokens.set(token, user);
    return {
      access_token: token,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: token,
      user: publicUser(user),
    };
  }
  const image = (await sharp("public/lab/library.png").jpeg().toBuffer()).toString("base64");
  const auth = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1:54329");
      let raw = "";
      for await (const chunk of request) raw += chunk;
      const body = raw ? JSON.parse(raw) : {};
      const send = (value: unknown, status = 200) => {
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(JSON.stringify(value));
      };
      if (url.pathname === "/health") return send({ ok: true });
      if (url.pathname === "/openai/v1/moderations")
        return send({ results: [{ flagged: false, category_scores: {} }] });
      if (url.pathname === "/openai/v1/images/generations")
        return send({
          data: [{ b64_json: image }],
          usage: { input_tokens: 10, output_tokens: 20 },
        });
      if (url.pathname === "/openai/v1/responses") {
        const text = JSON.stringify(body.input);
        let output = "Роботът открива светла библиотека.";
        if (body.text?.format?.schema?.properties?.action) {
          const context = JSON.parse(body.input[0].content);
          const clue = context.results.map((r: { result: string }) => r.result).join(" ");
          const answer = clue.includes("шия")
            ? "жираф"
            : clue.includes("хобот")
              ? "слон"
              : clue.includes("Птица")
                ? "пингвин"
                : clue.includes("робот Лъч")
                  ? "робот Лъч"
                  : clue.includes("робот Искра")
                    ? "робот Искра"
                    : clue.includes("модула „антена“") || clue.includes("Антената няма")
                      ? "антена"
                      : clue.includes("модула „соларен панел“") || clue.includes("панел не")
                        ? "соларен панел"
                        : "";
          output = JSON.stringify({
            action: answer
              ? { tool: "check_answer", answer }
              : context.allowedTools.includes("read_clue")
                ? {
                    tool: "read_clue",
                    id: context.clueIds.includes("body") ? "body" : context.clueIds[0],
                  }
                : {
                    tool: "inspect_item",
                    id: context.itemIds.includes("label") ? "label" : context.itemIds[0],
                  },
          });
        } else if (body.text?.format?.schema?.properties?.narration)
          output = JSON.stringify({
            narration: output,
            choices: ["Отвори книгата", "Попитай библиотекаря"],
            stateChanges: { discoveredClue: "Синя книга" },
            missionStatus: "active",
          });
        else if (body.text?.format?.schema?.properties?.matches)
          output = JSON.stringify({
            matches: true,
            uncertain: true,
            summary: "Вижда се робот с книга.",
          });
        else if (text.includes("100 до 150"))
          output =
            "Дракон София робот щастлив край. " +
            Array(20).fill("Приятелите откриха нова вълшебна история.").join(" ");
        else if (text.includes("номериран списък") || text.includes("три точки"))
          output = "1. Провери модула.\n2. Свържи панела.\n3. Тествай робота.";
        else if (text.includes("САМО от намерените карти"))
          output = "Корабът Орбита използва соларен панел.";
        return send({
          status: "completed",
          output: [{ type: "message", content: [{ type: "output_text", text: output }] }],
          usage: { input_tokens: 40, output_tokens: 80 },
        });
      }
      if (url.pathname === "/auth/v1/signup") {
        if (users.has(body.email))
          return send({ error: "already_exists", msg: "Already registered" }, 400);
        const user: MockUser = {
          id: randomUUID(),
          email: body.email,
          password: body.password,
          user_metadata: body.data || {},
        };
        users.set(user.email, user);
        return send(await session(user));
      }
      if (url.pathname === "/auth/v1/token") {
        const user = body.refresh_token ? tokens.get(body.refresh_token) : users.get(body.email);
        if (!user || (!body.refresh_token && user.password !== body.password))
          return send({ error: "invalid_grant", error_description: "Invalid credentials" }, 400);
        return send(await session(user));
      }
      if (url.pathname === "/auth/v1/user") {
        const user = tokens.get((request.headers.authorization || "").replace("Bearer ", ""));
        if (!user) return send({ msg: "Unauthorized" }, 401);
        if (request.method === "PUT" && body.password) user.password = body.password;
        return send(publicUser(user));
      }
      if (url.pathname === "/auth/v1/logout") return send({});
      if (
        url.pathname.startsWith("/auth/v1/admin/users/") &&
        request.method === "DELETE" &&
        request.headers.authorization === "Bearer e2e-service-key"
      ) {
        const id = url.pathname.split("/").at(-1);
        const user = [...users.values()].find((entry) => entry.id === id);
        if (!user) return send({ msg: "Not found" }, 404);
        users.delete(user.email);
        for (const [token, owner] of tokens) if (owner.id === id) tokens.delete(token);
        return send(publicUser(user));
      }
      if (url.pathname === "/auth/v1/.well-known/jwks.json") return send({ keys: [] });
      if (url.pathname === "/paddle/transactions" && request.method === "POST") {
        const id = `txn_${randomUUID().replaceAll("-", "").slice(0, 26)}`;
        const value = {
          id,
          status: "draft",
          custom_data: body.custom_data,
          items: [],
          payments: [],
          currency_code: "EUR",
          collection_mode: "automatic",
          origin: "api",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          checkout: { url: "http://127.0.0.1:3100/parent/billing" },
        };
        transactions.set(id, value);
        return send({ data: value });
      }
      if (url.pathname.startsWith("/paddle/transactions/")) {
        const value = transactions.get(url.pathname.split("/").at(-1)!);
        if (!value) return send({ error: { detail: "Not found" } }, 404);
        if (request.method === "PATCH") Object.assign(value, body);
        return send({ data: value });
      }
      if (
        url.pathname.startsWith("/__fixture/") &&
        request.headers["x-test-token"] === "local-e2e-only"
      ) {
        const user = users.get(body.email);
        if (!user) return send({ error: "No test user" }, 404);
        if (url.pathname === "/__fixture/limits") {
          const configuration = defaultAIConfig();
          configuration.childRunsPerMinute = 30;
          configuration.accountRunsPerMinute = 60;
          await db.update(s.aiSettings).set({ configuration }).where(eq(s.aiSettings.id, "lab"));
          return send({ ok: true });
        }
        if (url.pathname === "/__fixture/admin") {
          await db.update(s.users).set({ role: "admin" }).where(eq(s.users.id, user.id));
          return send({ ok: true });
        }
        if (url.pathname === "/__fixture/subscription") {
          let [checkout] = await db
            .select()
            .from(s.checkoutSessions)
            .where(eq(s.checkoutSessions.userId, user.id));
          if (!checkout)
            [checkout] = await db
              .insert(s.checkoutSessions)
              .values({ userId: user.id, transactionId: `txn_fixture_${user.id}` })
              .returning();
          const now = new Date();
          const future = new Date(now.getTime() + 30 * 86400000);
          await processBillingEvent(db, {
            eventId: `evt_${randomUUID()}`,
            eventType: `subscription.${body.status === "active" ? "activated" : body.status}`,
            occurredAt: now.toISOString(),
            data: {
              id: `sub_${user.id}`,
              status: body.status,
              customerId: `ctm_${user.id}`,
              customData: { checkout_id: checkout.id },
              items: [{ price: { id: "pri_test" } }],
              currentBillingPeriod: { startsAt: now.toISOString(), endsAt: future.toISOString() },
            },
          });
          return send({ ok: true });
        }
      }
      send({ error: "Unknown mock endpoint", path: url.pathname }, 404);
    } catch (error) {
      console.error("Test service error", error);
      response.writeHead(500);
      response.end("{}");
    }
  });
  await new Promise<void>((done) => auth.listen(54329, "127.0.0.1", done));
  const env = {
    ...process.env,
    NODE_OPTIONS: `--import=${pathToFileURL(resolve("tests/e2e/fetch-mock.mjs")).href}`,
    NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
    DATABASE_POOL_SIZE: "1",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54328/postgres",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "e2e-service-key",
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_e2e_client_token",
    NEXT_PUBLIC_PADDLE_ENV: "sandbox",
    PADDLE_API_KEY: "e2e-paddle-key",
    PADDLE_NOTIFICATION_WEBHOOK_SECRET: "e2e-webhook-secret",
    PADDLE_MONTHLY_PRICE_ID: "pri_test",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_BUILD_DIR: ".next-e2e",
    AI_PROVIDER: "openai",
    AI_API_KEY: "fixture-key-never-used-outside-local-server",
    AI_LAB_ENABLED: "true",
  };
  if (process.env.E2E_DEV !== "true") {
    await new Promise<void>((resolve, reject) => {
      const build = spawn(
        process.execPath,
        ["node_modules/next/dist/bin/next", "build", "--webpack"],
        { stdio: "inherit", env },
      );
      build.once("error", reject);
      build.once("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`E2E build failed: ${code}`)),
      );
    });
  }
  const app = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      ...(process.env.E2E_DEV === "true" ? ["dev", "--webpack"] : ["start"]),
      "--hostname",
      "127.0.0.1",
      "--port",
      "3100",
    ],
    { stdio: "inherit", env },
  );
  let closing = false;
  const stop = async () => {
    if (closing) return;
    closing = true;
    app.kill("SIGTERM");
    auth.close();
    await sqlServer.stop();
    await client.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void stop());
  process.on("SIGINT", () => void stop());
  app.on("exit", () => void stop());
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
