import { expect, test, type Page, type Request } from "@playwright/test";
import { defaults } from "../../src/components/lab/builders";
import { labSeedId } from "../../src/content/lab/seed";
import { bg } from "../../src/i18n/bg";
import { lessonSeeds } from "../../src/content/seed/curriculum";
import type { Question } from "../../src/lib/content/schema";

// Chrome permits Secure cookies on loopback HTTP. Playwright's API client does
// not make that browser exception; pass this context's cookies explicitly.
async function authenticatedGet(page: Page, url: string) {
  return page.request.get(url, {
    headers: {
      cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; "),
    },
  });
}
async function authenticatedPost(
  page: Page,
  url: string,
  options: Parameters<Page["request"]["post"]>[1],
) {
  return page.request.post(url, {
    ...options,
    headers: {
      ...options?.headers,
      cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; "),
    },
  });
}
async function signup(page: Page) {
  const email = `parent-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  await page.goto("/signup");
  await page.getByLabel(bg.auth.email, { exact: true }).fill(email);
  await page.getByLabel(bg.auth.password, { exact: true }).fill("Explorer-test-123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: bg.auth.signup, exact: true }).click();
  await expect(page).toHaveURL(/select-child/);
  await page.getByLabel(bg.children.nickname, { exact: true }).fill("Ева");
  await page.getByRole("button", { name: bg.children.create, exact: true }).click();
  await page.getByRole("button", { name: bg.children.start, exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  return email;
}
async function answer(page: Page, q: Question) {
  if (q.type === "ordering") {
    const ids = q.options.map((o) => o.id);
    const desired = q.correct as string[];
    for (let i = 0; i < desired.length; i++) {
      let index = ids.indexOf(desired[i]);
      while (index > i) {
        await page
          .getByRole("button", {
            name: `${bg.player.up}: ${q.options.find((o) => o.id === desired[i])!.label}`,
            exact: true,
          })
          .click();
        [ids[index], ids[index - 1]] = [ids[index - 1], ids[index]];
        index--;
      }
    }
  } else if (q.type === "categorization") {
    for (const option of q.options)
      await page
        .getByRole("combobox", { name: option.label, exact: true })
        .selectOption((q.correct as Record<string, string>)[option.id]);
  } else for (const id of q.correct as string[]) await page.getByTestId(`option-${id}`).click();
  await page.getByRole("button", { name: bg.player.check, exact: true }).click();
  await expect(page.getByRole("status")).toContainText(bg.player.correct);
}
async function completeLesson(page: Page, index: number, refresh = false) {
  const lesson = lessonSeeds[index];
  await page.goto(`/app/lesson/${lesson.slug}`);
  for (let i = 0; i < lesson.content.blocks.length; i++) {
    const block = lesson.content.blocks[i];
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "question" in block ? block.question.prompt : block.title,
    );
    if ("question" in block) await answer(page, block.question);
    await page.getByRole("button", { name: bg.common.continue, exact: true }).click();
    if (refresh && i === 0) {
      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        lesson.content.blocks[1].title,
      );
    }
  }
  await page.getByRole("button", { name: bg.player.startQuiz, exact: true }).click();
  for (let i = 0; i < lesson.content.questions.length; i++) {
    const question = lesson.content.questions[i];
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(question.prompt);
    await answer(page, question);
    await page
      .getByRole("button", {
        name: i === lesson.content.questions.length - 1 ? bg.player.finish : bg.player.next,
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: bg.player.resultTitle, exact: true }),
  ).toBeVisible();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: bg.player.backWorld, exact: true }).click();
}
async function fixture(page: Page, path: string, email: string, status?: string) {
  const result = await page.request.post(`http://127.0.0.1:54329/__fixture/${path}`, {
    headers: { "x-test-token": "local-e2e-only" },
    data: { email, status },
  });
  expect(result.ok()).toBe(true);
}
test("public pages, navigation, FAQ and mobile layout", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(bg.home.title);
  await expect(
    page.getByText("Цялата AI Academy е безплатна завинаги. Без карта и без плащане.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("table", { name: bg.pricing.comparisonTitle })).toBeVisible();
  await page.screenshot({ path: "test-results/home-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/home-mobile.png", fullPage: true });
  await page.goto("/faq");
  await page.getByText(bg.faq.items[0].q, { exact: true }).click();
  await expect(page.getByText(bg.faq.items[0].a, { exact: true })).toBeVisible();
  await page.goto("/pricing");
  await expect(page.getByText(bg.pricing.price, { exact: true })).toBeVisible();
  const comparison = page.getByRole("table", { name: bg.pricing.comparisonTitle });
  await expect(comparison.getByRole("row", { name: /Цена/ })).toContainText("Безплатно завинаги");
  await expect(
    comparison
      .getByRole("row", { name: /^Lessons/ })
      .getByRole("img", { name: "Включено", exact: true }),
  ).toHaveCount(2);
  await expect(
    comparison
      .getByRole("row", { name: /^Real prompts/ })
      .getByRole("img", { name: "Не е включено", exact: true }),
  ).toHaveCount(1);
  await expect(comparison.getByRole("row", { name: /^AI Missions/ })).toContainText("базови");
  expect(
    await comparison
      .locator("th, td")
      .evaluateAll((cells) => cells.every((cell) => cell.scrollWidth <= cell.clientWidth + 1)),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/pricing-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: "test-results/pricing-desktop.png", fullPage: true });
});
test("header reflects login and logout on profile selection and public pages", async ({ page }) => {
  const header = page.getByRole("banner");
  await page.goto("/");
  await expect(header.getByRole("link", { name: bg.nav.login, exact: true })).toBeVisible();
  await expect(header.getByRole("link", { name: bg.nav.start, exact: true })).toBeVisible();
  await expect(header.getByRole("button", { name: bg.nav.logout, exact: true })).toHaveCount(0);

  const email = await signup(page);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/select-child");
    await expect(header.getByRole("link", { name: bg.nav.login, exact: true })).toHaveCount(0);
    await expect(header.getByRole("link", { name: bg.nav.start, exact: true })).toHaveCount(0);
    await expect(header.getByRole("link", { name: bg.nav.children, exact: true })).toBeVisible();
    await expect(header.getByRole("button", { name: bg.nav.logout, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await header.getByRole("link", { name: bg.nav.parent, exact: true }).click();
    await expect(page).toHaveURL(/\/parent$/);
    await page.goto("/select-child");
    await header.getByRole("link", { name: bg.brand, exact: true }).click();
    await expect(page).toHaveURL("http://127.0.0.1:3100/");
    await expect(header.getByRole("link", { name: bg.nav.login, exact: true })).toHaveCount(0);
    await expect(header.getByRole("link", { name: bg.nav.start, exact: true })).toHaveCount(0);
    await header.getByRole("link", { name: bg.nav.children, exact: true }).click();
    await expect(page).toHaveURL(/\/select-child$/);
    await page.reload();
    await expect(header.getByRole("button", { name: bg.nav.logout, exact: true })).toBeVisible();
  }

  await header.getByRole("button", { name: bg.nav.logout, exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  await expect(header.getByRole("link", { name: bg.nav.login, exact: true })).toBeVisible();
  await expect(header.getByRole("link", { name: bg.nav.children, exact: true })).toHaveCount(0);
  await expect(header.getByRole("button", { name: bg.nav.logout, exact: true })).toHaveCount(0);

  await header.getByRole("link", { name: bg.nav.login, exact: true }).click();
  await page.getByLabel(bg.auth.email, { exact: true }).fill(email);
  await page.getByLabel(bg.auth.password, { exact: true }).fill("Explorer-test-123");
  await page.getByRole("button", { name: bg.auth.login, exact: true }).click();
  await expect(page).toHaveURL(/\/select-child$/);
  await expect(header.getByRole("link", { name: bg.nav.login, exact: true })).toHaveCount(0);
  await expect(header.getByRole("link", { name: bg.nav.children, exact: true })).toBeVisible();
  await header.getByRole("link", { name: bg.brand, exact: true }).click();
  await header.getByRole("button", { name: bg.nav.logout, exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(header.getByRole("link", { name: bg.nav.start, exact: true })).toBeVisible();
  await page.goto("/select-child");
  await expect(page).toHaveURL(/\/login$/);
});
test("child selection loads the selected profile with a single dashboard request", async ({
  page,
}) => {
  await signup(page);
  const result = await authenticatedPost(page, "/api/account", {
    headers: { origin: "http://127.0.0.1:3100" },
    data: {
      action: "create_child",
      requestId: crypto.randomUUID(),
      nickname: "Мая",
      avatar: "robot",
      ageBand: "8-9",
    },
  });
  expect(result.ok()).toBe(true);
  for (const nickname of ["Мая", "Ева"]) {
    await page.getByRole("link", { name: bg.nav.switch, exact: true }).click();
    await expect(page).toHaveURL(/\/select-child$/);
    const requests: string[] = [];
    const record = (request: Request) => {
      if (new URL(request.url()).pathname === "/app" && !request.headers()["next-router-prefetch"])
        requests.push(request.method());
    };
    page.on("request", record);
    await page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: nickname, exact: true }) })
      .getByRole("button", { name: bg.children.start, exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(nickname);
    await expect(page).toHaveURL(/\/app$/);
    expect(requests).toEqual(["GET"]);
    page.off("request", record);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(nickname);
  }
});
test("free basic missions persist progress while real AI and Energy remain Premium", async ({
  page,
}) => {
  await signup(page);
  await page.goto("/app/missions");
  await expect(
    page.getByRole("heading", { name: "Базови мисии · Безплатно завинаги", exact: true }),
  ).toBeVisible();
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Звезда или планета?", exact: true }) });
  await card.getByRole("link", { name: /Към мисията/ }).click();
  await expect(page.getByText("Базова мисия · Безплатно", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Отключи AI Lab/ })).toHaveCount(0);
  await page.getByRole("radio", { name: "Слънцето е планета.", exact: true }).check();
  await page.getByRole("button", { name: "Провери отговора · Безплатно", exact: true }).click();
  await expect(page.getByText("✓ Успя!", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Твоите проверки", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/basic-mission-mobile.png", fullPage: true });
  const profiles = await (await authenticatedGet(page, "/api/schools?parent=true")).json();
  const childId = profiles[0].id;
  const lab = await (await authenticatedGet(page, `/api/lab?childId=${childId}`)).json();
  expect(lab.energy).toMatchObject({ premium: false, balance: 0 });
  expect(lab.history).toHaveLength(0);
  const blocked = await authenticatedPost(page, "/api/lab", {
    headers: { origin: "http://127.0.0.1:3100" },
    data: {
      action: "run",
      childId,
      data: {
        requestId: crypto.randomUUID(),
        feature: "prompts",
        input: { builder: defaults.prompts },
      },
    },
  });
  expect(blocked.status()).toBe(403);
  await page.goto("/app/lab/prompts");
  await expect(page.getByRole("link", { name: /Отключи AI Lab/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Изпълни с AI/ })).toBeDisabled();
});
test("parent signup → child → lesson → quiz → persistent XP and parent progress", async ({
  page,
}) => {
  await signup(page);
  await completeLesson(page, 0, true);
  await page.goto("/app");
  await expect(page.getByText("90", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/dashboard-mobile.png", fullPage: true });
  await page.goto("/parent");
  await expect(page.getByRole("heading", { name: "Ева", exact: true })).toBeVisible();
  await expect(page.getByText("100%", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: bg.nav.logout, exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  await page.goto("/app");
  await expect(page).toHaveURL(/login/);
});
test("free Academy → paid Lab → real runtime → cancellation retains learning and creations", async ({
  page,
}) => {
  test.setTimeout(120000);
  const email = await signup(page);
  for (let i = 0; i < 3; i++) await completeLesson(page, i);
  await page.goto("/app/world/how-ai-learns");
  await expect(page.getByRole("heading", { name: bg.world.missions, exact: true })).toBeVisible();
  await completeLesson(page, 3);
  await page.goto("/app/lab");
  await expect(page.getByRole("link", { name: /Отключи AI Lab/ })).toBeVisible();
  await page.route("https://cdn.paddle.com/paddle/v2/paddle.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.PaddleBillingV1 = { Environment: { set() {} }, Initialize(options) { this.options = options; this.Initialized = true; }, Update(options) { this.options = options; }, Checkout: { open(options) { window.__checkoutTransaction = options.transactionId; } } };`,
    }),
  );
  await page.getByRole("link", { name: /Отключи AI Lab/ }).click();
  await page.getByRole("button", { name: bg.pricing.upgrade, exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __checkoutTransaction?: string }).__checkoutTransaction,
      ),
    )
    .toMatch(/^txn_/);
  await fixture(page, "subscription", email, "active");
  await page.goto("/app/lab/prompts");
  await expect(page.getByText("1000 Energy", { exact: true })).toBeVisible();
  await page.getByLabel("Заглавие на проекта", { exact: true }).fill("Моята космическа история");
  await page.getByRole("button", { name: /Изпълни с AI/ }).click();
  await expect(page.getByText("998 Energy", { exact: true })).toBeVisible();
  await expect(page.getByText("Роботът открива светла библиотека.", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Цел", exact: true }).fill("Разкажи за робот и книга.");
  await page.getByRole("button", { name: /Изпълни с AI/ }).click();
  await expect(page.getByText("996 Energy", { exact: true })).toBeVisible();
  await page.locator(".lab-history-list input").nth(0).check();
  await page.locator(".lab-history-list input").nth(1).check();
  await expect(page.locator(".lab-compare article")).toHaveCount(2);
  await page.goto("/app/lab/prompt-battles");
  await page
    .getByLabel("Твоята инструкция", { exact: true })
    .fill("Разкажи приказка за дракон, София и робот със щастлив край в 100 до 150 думи.");
  await page.getByRole("button", { name: /Изпълни с AI/ }).click();
  await expect(page.getByText("✓ Успя!", { exact: true })).toBeVisible();
  await page.goto("/app/lab/bots");
  await page.getByLabel("Заглавие на проекта", { exact: true }).fill("Бот за приказки");
  await page
    .getByRole("textbox", { name: "Съобщение до бота", exact: true })
    .fill("Разкажи за малък робот.");
  await page.getByRole("button", { name: /Изпълни с AI/ }).click();
  await expect(page.getByText("991 Energy", { exact: true })).toBeVisible();
  await page.goto("/app/lab");
  await expect(
    page.getByRole("heading", { name: "Твоята AI лаборатория", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/lab-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/lab/prompts");
  await expect(page.getByRole("heading", { name: "Prompt Playground", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/lab-mobile.png", fullPage: true });
  await page.goto("/app");
  await expect(page.getByText("490", { exact: true })).toBeVisible();
  await fixture(page, "subscription", email, "canceled");
  await page.goto("/app/world/how-ai-learns");
  await expect(page.getByRole("heading", { name: bg.world.missions, exact: true })).toBeVisible();
  await page.goto("/app/lab");
  await expect(page.getByRole("link", { name: /Отключи AI Lab/ })).toBeVisible();
  await page.goto("/app/creations");
  await expect(page.getByRole("heading", { name: "Бот за приказки", exact: true })).toBeVisible();
  await page.goto("/app");
  await expect(page.getByText("490", { exact: true })).toBeVisible();
  await page.goto("/app/progress");
  await expect(page.getByText(lessonSeeds[3].title, { exact: true })).toBeVisible();
});
test("server authorization, CSRF and admin publishing boundaries", async ({ page }) => {
  const email = await signup(page);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/parent$/);
  const denied = await authenticatedPost(page, "/api/admin", {
    headers: { origin: "http://127.0.0.1:3100" },
    data: { action: "world", data: {} },
  });
  expect(denied.status()).toBe(403);
  const csrf = await authenticatedPost(page, "/api/account", {
    headers: { origin: "https://evil.example" },
    data: { action: "select_child", id: "00000000-0000-4000-8000-000000000900" },
  });
  expect(csrf.status()).toBe(403);
  const webhook = await authenticatedPost(page, "/api/paddle/webhook", {
    data: { event_id: "forged", event_type: "subscription.activated" },
  });
  expect(webhook.status()).toBe(400);
  await fixture(page, "admin", email);
  await page.goto("/admin/worlds");
  await expect(page.getByRole("heading", { name: bg.admin.worlds, exact: true })).toBeVisible();
  await page.goto(`/admin/lessons/${lessonSeeds[0].id}/preview`);
  await expect(page.getByText(bg.player.preview, { exact: true })).toBeVisible();
});
test("parent can export data, delete a child and delete the account", async ({ page }) => {
  const email = await signup(page);
  const exported = await authenticatedGet(page, "/api/account");
  expect(exported.ok()).toBe(true);
  const data = await exported.json();
  expect(data.account.email).toBe(email);
  expect(data.children).toHaveLength(1);
  await page.goto("/parent/children");
  await page.getByText(bg.children.deleteTitle, { exact: true }).click();
  await page.getByLabel(bg.children.confirm, { exact: true }).fill("Ева");
  await page.getByRole("button", { name: bg.common.delete, exact: true }).click();
  await expect(page.getByText(bg.children.deleteTitle, { exact: true })).toHaveCount(0);
  await page.goto("/parent/settings");
  await page.getByLabel(bg.parent.deleteConfirm, { exact: true }).fill("ИЗТРИЙ");
  await page.getByLabel(bg.parent.passwordConfirm, { exact: true }).fill("Explorer-test-123");
  await page.getByRole("button", { name: bg.parent.deleteAccount, exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  const missing = await authenticatedGet(page, "/api/account");
  expect(missing.status()).toBe(401);
});

test("Lab engines, private assets, five-step escape and CMS missions in a production build", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  const email = await signup(page);
  await fixture(page, "subscription", email, "active");
  await fixture(page, "limits", email);
  const account = await (await authenticatedGet(page, "/api/account")).json();
  const childId = account.children[0].id;
  const call = async (action: string, data: Record<string, unknown>) => {
    const response = await authenticatedPost(page, "/api/lab", {
      headers: { origin: "http://127.0.0.1:3100" },
      data: { action, childId, data },
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  const save = async (
    feature: string,
    configuration = defaults[feature],
    title = `Тест ${feature}`,
  ) => call("save_project", { feature, title, configuration });
  const run = async (
    feature: string,
    input: Record<string, unknown>,
    extra: Record<string, unknown> = {},
  ) => call("run", { requestId: crypto.randomUUID(), feature, input, ...extra });
  const knowledge = await save("knowledge");
  await call("save_card", {
    projectId: knowledge.id,
    title: "Соларен панел",
    content: "Орбита е измислен кораб. Соларен панел доставя енергия на Орбита.",
  });
  const answer = await run(
    "knowledge",
    { message: "Как Орбита получава енергия?" },
    { projectId: knowledge.id },
  );
  expect(answer.result.knowledge).toHaveLength(1);
  await page.goto(`/app/lab/knowledge?project=${knowledge.id}`);
  await page.locator(".lab-history-list input").first().check();
  await expect(page.getByText("Кое знание използва AI?", { exact: true })).toBeVisible();
  const bot = await save("bots", { ...defaults.bots, knowledgeProjectId: knowledge.id });
  await run("bots", { message: "Как Орбита получава енергия?" }, { projectId: bot.id });
  const creator = await save("projects", {
    ...defaults.projects,
    projectIds: [knowledge.id, bot.id],
  });
  expect(
    (await call("assessment", { challengeId: labSeedId(60), projectId: creator.id })).passed,
  ).toBe(true);
  const vision = await run("vision", { imageId: "space", message: "Колко ракети виждаш?" });
  expect(vision.result.knownFacts).toHaveLength(3);
  const image = await run("images", { builder: defaults.images });
  const asset = await authenticatedGet(page, `/api/lab/assets/${image.result.assetId}`);
  expect(asset.ok()).toBe(true);
  expect(asset.headers()["cache-control"]).toContain("no-store");
  const stranger = await browser.newContext();
  expect(
    (
      await stranger.request.get(`http://127.0.0.1:3100/api/lab/assets/${image.result.assetId}`)
    ).status(),
  ).toBe(401);
  await stranger.close();
  const game = await save("games", { ...defaults.games, maxTurns: 3 });
  await run("games", { choice: "" }, { projectId: game.id });
  await page.goto(`/app/lab/games?project=${game.id}`);
  await page.getByRole("button", { name: "Отвори книгата", exact: true }).click();
  await expect(page.getByText(/Ход 2 от 3/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Отвори книгата", exact: true }).click();
  await expect(page.getByText(/Приключението завърши/)).toBeVisible();
  const room = await call("start_escape", { roomId: labSeedId(50) });
  expect(
    (
      await run(
        "prompt-battles",
        { prompt: "Напиши три точки: провери, свържи, тествай." },
        { challengeId: labSeedId(2), escapeRunId: room.id },
      )
    ).result.passed,
  ).toBe(true);
  expect(
    (await call("assessment", { challengeId: labSeedId(20), answerIndex: 0, escapeRunId: room.id }))
      .passed,
  ).toBe(true);
  expect(
    (
      await run(
        "knowledge",
        { message: "Как Орбита получава енергия?" },
        { projectId: knowledge.id, challengeId: labSeedId(30), escapeRunId: room.id },
      )
    ).result.passed,
  ).toBe(true);
  for (const id of [10, 12])
    expect(
      (await run("agent-missions", {}, { challengeId: labSeedId(id), escapeRunId: room.id })).result
        .solved,
    ).toBe(true);
  await page.goto("/app/lab/escape-rooms");
  await expect(page.getByText(/Мисията е изпълнена/)).toBeVisible();
  await page.goto("/app/lab/images");
  await page.locator(".lab-history-list input").first().check();
  await expect(page.getByAltText("Твоето генерирано изображение")).toBeVisible();
  await fixture(page, "admin", email);
  await page.goto("/admin/lab");
  await expect(
    page.getByRole("heading", { name: "AI Lab · управление", exact: true }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Вид", exact: true }).selectOption("mission");
  await page.getByRole("button", { name: "Нов запис", exact: true }).click();
  const mission = {
    title: "Нова мисия от CMS",
    description: "Мисия, публикувана през администрацията.",
    challengeId: labSeedId(20),
    startsAt: new Date(Date.now() - 60000).toISOString(),
    endsAt: new Date(Date.now() + 86400000).toISOString(),
    xpReward: 30,
    achievementId: null,
    status: "published",
  };
  await page.getByLabel("Конфигурация на мисията").fill(JSON.stringify(mission));
  await page.getByRole("button", { name: "Запази съдържанието", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Промените са запазени");
  await page.goto("/app/missions");
  await expect(page.getByRole("heading", { name: "Нова мисия от CMS", exact: true })).toBeVisible();
});

test("school contract → manager invitations → parent activation → isolated Energy and staff reports", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const adminEmail = await signup(page);
  await fixture(page, "admin", adminEmail);
  const suffix = Date.now(),
    schoolName = `Училище ${suffix}`,
    managerEmail = `manager-${suffix}@example.test`,
    teacherEmail = `teacher-${suffix}@example.test`;
  await page.goto("/admin/schools");
  await page.getByRole("textbox", { name: "Име на училището", exact: true }).fill(schoolName);
  await page
    .getByRole("textbox", { name: "Лице за контакт", exact: true })
    .fill("Училищен отговорник");
  await page.getByRole("textbox", { name: "Имейл за контакт", exact: true }).fill(managerEmail);
  await page.getByRole("button", { name: "Създай училище", exact: true }).click();
  await page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { name: schoolName, exact: true }) })
    .click();
  await expect(page).toHaveURL(/\/school\/[0-9a-f-]{36}$/);
  const schoolId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByText("Добави нов договор", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Номер / референция на договора", exact: true })
    .fill("Договор за тест");
  await page
    .getByLabel("Начало (UTC)", { exact: true })
    .fill(new Date(Date.now() - 86400000).toISOString().slice(0, 16));
  await page
    .getByLabel("Край (UTC, без включване на този час)", { exact: true })
    .fill(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16));
  await page.getByRole("spinbutton", { name: "Ученически места", exact: true }).fill("3");
  await page.getByRole("spinbutton", { name: "Месечна Energy на ученик", exact: true }).fill("20");
  await page.getByRole("button", { name: "Запази договор като чернова", exact: true }).click();
  await page.getByRole("button", { name: "Активирай договора", exact: true }).click();
  await expect(page.getByText("Premium е активен", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Служебен имейл", exact: true }).fill(managerEmail);
  await page.getByRole("combobox", { name: "Роля", exact: true }).selectOption("manager");
  await page.getByRole("button", { name: "Добави / обнови служител", exact: true }).click();
  await expect(page.getByRole("cell", { name: managerEmail, exact: true })).toBeVisible();
  const staffSignup = async (p: Page, email: string) => {
    await p.goto("/signup?school=1");
    await p.getByLabel(bg.auth.email, { exact: true }).fill(email);
    await p.getByLabel(bg.auth.password, { exact: true }).fill("Explorer-test-123");
    await p.getByRole("checkbox").check();
    await p.getByRole("button", { name: bg.auth.signup, exact: true }).click();
    await expect(p).toHaveURL(/\/school$/);
  };
  const managerContext = await browser.newContext(),
    parentContext = await browser.newContext(),
    teacherContext = await browser.newContext();
  try {
    const managerPage = await managerContext.newPage(),
      parentPage = await parentContext.newPage(),
      teacherPage = await teacherContext.newPage();
    await staffSignup(managerPage, managerEmail);
    await managerPage
      .getByRole("link")
      .filter({ has: managerPage.getByRole("heading", { name: schoolName, exact: true }) })
      .click();
    await expect(managerPage.getByRole("button", { name: "Активирай договора" })).toHaveCount(0);
    await managerPage
      .getByRole("textbox", { name: "Служебен имейл", exact: true })
      .fill(teacherEmail);
    await managerPage
      .getByRole("button", { name: "Добави / обнови служител", exact: true })
      .click();
    await expect(managerPage.getByRole("cell", { name: teacherEmail, exact: true })).toBeVisible();
    const classForm = managerPage
      .locator("form")
      .filter({ has: managerPage.getByRole("button", { name: "Създай клас", exact: true }) });
    await classForm.getByRole("textbox", { name: "Име на новия клас", exact: true }).fill("3 А");
    await classForm
      .getByRole("combobox", { name: "Учител", exact: true })
      .selectOption({ label: teacherEmail });
    await classForm.getByRole("button", { name: "Създай клас", exact: true }).click();
    await expect(managerPage.getByRole("heading", { name: "3 А", exact: true })).toBeVisible();
    await managerPage.getByRole("button", { name: "Генерирай покани", exact: true }).click();
    const code = await managerPage.locator(".school-code-card code").innerText();
    const download = managerPage.waitForEvent("download");
    await managerPage.getByRole("button", { name: "Изтегли CSV", exact: true }).click();
    expect((await download).suggestedFilename()).toBe("school-invitations.csv");
    const parentEmail = await signup(parentPage);
    await parentPage.goto("/parent/school");
    await parentPage.getByRole("textbox", { name: "Код от училището", exact: true }).fill(code);
    await parentPage
      .getByRole("button", { name: "Активирай Premium за детето", exact: true })
      .click();
    await expect(parentPage.getByText("20 Energy", { exact: true })).toBeVisible();
    const records = await (await authenticatedGet(parentPage, "/api/schools?parent=true")).json();
    const childId = records[0].id;
    const sibling = await authenticatedPost(parentPage, "/api/account", {
      headers: { origin: "http://127.0.0.1:3100" },
      data: {
        action: "create_child",
        requestId: crypto.randomUUID(),
        nickname: "Луна",
        avatar: "cat",
        ageBand: "8-9",
      },
    });
    expect(sibling.status()).toBe(200);
    const children = await (await authenticatedGet(parentPage, "/api/schools?parent=true")).json();
    expect(children.find((c: { nickname: string }) => c.nickname === "Луна").energy.premium).toBe(
      false,
    );
    await fixture(parentPage, "subscription", parentEmail, "active");
    await parentPage.goto("/app/lab/prompts");
    await parentPage
      .getByRole("textbox", { name: "Заглавие на проекта", exact: true })
      .fill("Училищна история");
    await parentPage.getByRole("button", { name: /Изпълни с AI/ }).click();
    await expect(parentPage.getByText("18 Energy", { exact: true })).toBeVisible();
    await parentPage.goto("/parent/school");
    const childCard = parentPage
      .locator("section.content-card")
      .filter({ has: parentPage.getByRole("heading", { name: "Ева", exact: true }) });
    await childCard
      .getByRole("combobox", { name: "Предпочитан бюджет", exact: true })
      .selectOption("family");
    await childCard.getByLabel("Родителска парола", { exact: true }).fill("Incorrect-password");
    await childCard.getByRole("button", { name: "Запази избора на бюджет", exact: true }).click();
    await expect(childCard.getByRole("alert")).toContainText("Паролата е невалидна");
    await childCard.getByLabel("Родителска парола", { exact: true }).fill("Explorer-test-123");
    await childCard.getByRole("button", { name: "Запази избора на бюджет", exact: true }).click();
    await expect(childCard.getByText("1000 Energy", { exact: true })).toBeVisible();
    await parentPage.goto("/app/lab/prompts");
    await parentPage.getByRole("button", { name: /Изпълни с AI/ }).click();
    await expect(parentPage.getByText("998 Energy", { exact: true })).toBeVisible();
    await staffSignup(teacherPage, teacherEmail);
    await teacherPage.goto(`/school/${schoolId}`);
    await expect(teacherPage.getByRole("cell").filter({ hasText: "Ева" })).toBeVisible();
    await expect(teacherPage.getByRole("heading", { name: "Екип", exact: true })).toHaveCount(0);
    await expect(teacherPage.getByText("Училищна история", { exact: true })).toHaveCount(0);
    const denied = await authenticatedGet(parentPage, `/api/schools?schoolId=${schoolId}`);
    expect(denied.status()).toBe(403);
    const contracts = await (
      await authenticatedGet(page, `/api/schools?schoolId=${schoolId}`)
    ).json();
    const forbidden = await authenticatedPost(teacherPage, "/api/schools", {
      headers: { origin: "http://127.0.0.1:3100" },
      data: {
        action: "contract_status",
        data: { schoolId, id: contracts.contracts[0].id, status: "suspended" },
      },
    });
    expect(forbidden.status()).toBe(403);
    const csrf = await authenticatedPost(managerPage, "/api/schools", {
      headers: { origin: "https://unrelated.example" },
      data: { action: "invites", data: {} },
    });
    expect(csrf.status()).toBe(403);
    await managerPage.reload();
    await expect(
      managerPage.getByRole("heading", { level: 1, name: schoolName, exact: true }),
    ).toBeVisible();
    await expect(managerPage.getByRole("cell").filter({ hasText: "Ева" })).toBeVisible();
    await managerPage.screenshot({ path: "test-results/school-desktop.png", fullPage: true });
    await managerPage.setViewportSize({ width: 390, height: 844 });
    expect(
      await managerPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await managerPage.screenshot({ path: "test-results/school-mobile.png", fullPage: true });
    const pupil = managerPage
      .getByRole("row")
      .filter({ has: managerPage.getByRole("cell").filter({ hasText: "Ева" }) });
    await pupil.getByText("Управление", { exact: true }).click();
    await pupil.getByRole("button", { name: "Прекрати училищния достъп", exact: true }).click();
    await expect(pupil).toHaveCount(0);
    const after = await (await authenticatedGet(parentPage, "/api/schools?parent=true")).json();
    expect(after.find((c: { id: string }) => c.id === childId).school).toBeNull();
    expect(after.find((c: { id: string }) => c.id === childId).energy.premium).toBe(true);
    await parentPage.goto("/app/creations");
    await expect(
      parentPage.getByRole("heading", { name: "Училищна история", exact: true }),
    ).toBeVisible();
  } finally {
    await managerContext.close();
    await parentContext.close();
    await teacherContext.close();
  }
});
