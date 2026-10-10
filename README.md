# AI Академия за деца

Next.js приложение на български за деца на 8–11 години: безплатна AI Academy, Premium AI Lab с реални AI инструменти, мисии и семеен Energy бюджет. [Настройка и архитектура на v2](docs/ai-lab-v2.md).

## Какво е реализирано

- Публичен сайт: начало, програма, цени, как работи, FAQ, работни текстове за поверителност и условия.
- Supabase регистрация с имейл и парола, потвърждение на имейл, вход, изход и възстановяване на парола.
- Множество детски профили към родител, избор на профил, редакция и изтриване.
- Безплатни учебни светове с последователно отключване; Premium контролира само AI Lab.
- Плейър с всички видове блокове от PRD, автоматичен запис на стъпките и възстановяване след презареждане.
- Пет вида тестови въпроси: един отговор, множество отговори, вярно/невярно, подреждане и категоризация/съпоставяне.
- Оценяване на сървъра, незабавни обяснения, подсказки, история на опитите и най-добър резултат.
- XP ledger с уникални събития, нива, значки и награда за завършен свят.
- Родителски преглед на напредъка и темите за преговор, изтегляне на данни и изтриване на акаунт.
- Paddle Billing checkout, customer portal и подписани, идемпотентни webhooks с защита от закъснели събития.
- [Училищни лицензи](docs/schools.md): договори, места, отговорници/учители, класове, еднократни покани, родителско активиране и отделна училищна Energy.
- Защитена администрация за светове и уроци, подреждане, публикуване, JSON редактор на блокове/въпроси и преглед с истинския плейър.
- PostgreSQL миграции, RLS за всички таблици, server-side authorization, споделен rate limiter и продуктови събития без рекламни тракери.

Началните данни съдържат **6 завършени урока в 2 публикувани свята**, 7 значки и 5 нива. Всички учебни светове са безплатни. Другите 8 свята са чернови. Това изпълнява минималното начално съдържание от PRD; пълната учебна програма от приблизително 50 урока предстои да се попълни през CMS.

## Локално тестване с Docker — без облачен Supabase

Има готова конфигурация в `supabase/config.toml` за отделен PostgreSQL 17 контейнер, Supabase Auth, API gateway и тестова поща. Използвана е Supabase CLI 2.109.0. Нужни са Docker Desktop и Supabase CLI в PATH. [Официални инструкции за локалния Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started).

```bash
npm run local:up
npm run dev:local
```

`local:up` стартира контейнерите, попълва `.env.local` с локалните адреси и ключове, прилага Drizzle миграциите и добавя учебното съдържание. Съществуващите Paddle настройки в `.env.local` се запазват. `.env` остава непроменен. Приложението, миграциите и seed командите четат `.env.local` с предимство пред `.env`; изрично зададените shell променливи имат най-висок приоритет.

| Услуга                   | Адрес                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------ |
| Приложение               | http://localhost:3001                                                                |
| PostgreSQL               | `127.0.0.1:55322`, база `postgres`, потребител `postgres`, локална парола `postgres` |
| Supabase Auth/API        | http://127.0.0.1:55321                                                               |
| Тестови имейли (Mailpit) | http://127.0.0.1:55324                                                               |

Регистрирай родител на `/signup`. Отвори Mailpit и последвай връзката в писмото за потвърждение. Писмата се събират локално и не се изпращат до истинската поща. Работят също възстановяването на парола и изтриването на акаунт. След първи вход можеш да дадеш admin роля с `npm run db:admin -- твоят-имейл`.

За спиране на контейнерите със запазване на данните: `npm run local:stop`. За повторно пускане: `npm run local:up`. Не използвай `supabase db reset` за рутинно стартиране, защото нулира локалната база. Всички ключове в генерирания файл са само за тази локална среда. Paddle остава незадължителен за безплатното обучение и изисква собствени sandbox ключове за тест на плащанията.

## Облачен Supabase и Paddle: попълване на `.env`

Файлът `.env` вече е създаден с празни полета за тайните. `.env.example` е шаблонът за споделяне. Всички реални `.env` файлове са изключени от Git. **Не изпращай тайните в чат и не ги добавяй в source код.**

### 1. Supabase — задължителен за вход и обучение

Създай отделен development проект в [Supabase](https://supabase.com/dashboard). За тази аудитория можеш да избереш регион в ЕС; окончателните настройки и договори трябва да се прегледат преди публичен старт.

| Поле в `.env`                   | Какво да поставиш                                                                                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`           | Остави `http://localhost:3000` за локална работа. Без наклонена черта накрая.                                                                                                                        |
| `DATABASE_URL`                  | PostgreSQL URI от **Connect → Transaction pooler**, обичайно порт `6543`. Замени паролата на базата; URL-кодирай специалните символи. Приложението използва `prepare: false` за pooler съвместимост. |
| `DATABASE_MIGRATION_URL`        | По желание: **Session pooler** на порт `5432` или Direct connection. Ползва се за миграции; при празно поле се използва `DATABASE_URL`.                                                              |
| `DATABASE_POOL_SIZE`            | Остави `5`. За много малка база можеш да намалиш до `1`; стойността е за един сървърен процес.                                                                                                       |
| `NEXT_PUBLIC_SUPABASE_URL`      | Project URL, например `https://PROJECT_REF.supabase.co`.                                                                                                                                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Публичният publishable key (`sb_publishable_…`) или legacy `anon` key от настройките за API keys.                                                                                                    |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only secret key (`sb_secret_…`) или legacy `service_role` key. Нужен е за изтриване на родителски акаунт през приложението. Никога не го поставяй в `NEXT_PUBLIC_…` поле.                     |

В **Authentication → URL Configuration**:

- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/callback` и `http://localhost:3000/auth/callback?next=/auth/reset-password`
- Включи Email provider и потвърждение на имейла.

Приложението поддържа PKCE callback. За потвърждаване през друго устройство можеш да използваш token-hash шаблони в **Authentication → Email Templates**:

```html
<!-- Confirm signup -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Потвърди имейла</a>

<!-- Reset password -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Нова парола</a>
```

Преди покани към реални родители настрой собствен SMTP и провери доставянето на имейлите. Входът използва Supabase Auth; няма локален фалшив вход или production test bypass.

### 2. Paddle — нужен само за тест на плащанията

За автоматично създаване на Sandbox каталог попълни `PADDLE_API_KEY` в `.env.local` с ключ от **Sandbox → Developer tools → Authentication**. За настройката са нужни `product.write`, `price.write`, `client_token.write` и (ако зададеш webhook) `notification_setting.write`. За работата на приложението добави `transaction.write`, `subscription.read` и `customer_portal_session.write`. [Paddle API права](https://developer.paddle.com/api-reference/about/permissions/).

```bash
# Преглед без API заявки или запис на файлове:
npm run paddle:sandbox -- --dry-run
# Създаване или повторно използване на каталог и checkout token:
npm run paddle:sandbox
# Допълнително създаване/обновяване на webhook след пускане на HTTPS tunnel:
npm run paddle:sandbox -- --webhook-url=https://ТВОЯТ-TUNNEL/api/paddle/webhook
```

Командата използва само Sandbox API, създава Premium продукт и месечна цена 14,90 EUR с включен данък, без trial, за един родителски акаунт. За Sandbox продукта е избрана категория `saas`; тя трябва да е разрешена в акаунта. Съществуващи подходящи записи се използват повторно при последващо изпълнение. Получените price ID, client token и webhook secret се записват в `.env.local`, без да се отпечатват тайни. Default payment link и checkout домейнът остават отделна настройка в Paddle. Данъчната категория за production се потвърждава отделно.

За тунел само за webhook стартирай `npm run paddle:webhook-proxy`. Той слуша на `127.0.0.1:3002` и препраща единствено `POST /api/paddle/webhook` към приложението на порт 3001. Всички други адреси и методи връщат 404; ограничението за payload е 1 MB. Самата команда не отваря публичен тунел. Ако решиш да използваш ngrok, насочи го към **порт 3002**, запази `NEXT_PUBLIC_APP_URL=http://localhost:3001` и използвай приложението през localhost. В Paddle Sandbox → Checkout → Checkout settings задай default payment link `http://localhost:3001/parent/billing`.

Без тези полета могат да се тестват входът и безплатното обучение. Страницата за абонамент показва, че плащанията още не са настроени.

1. Влез в [Paddle Sandbox](https://sandbox-vendors.paddle.com/). Използвай **Paddle Billing**, не Paddle Classic.
2. Създай продукт и **месечна recurring цена 14,90 EUR**. Настрой данъчното третиране така, че публичната цена да съответства на checkout за целевия пазар. Приложението не изпраща цена от браузъра.
3. Създай API key с права за transactions, subscriptions и customer portal sessions и client-side token за Paddle.js.
4. Настрой Default payment link и разрешения checkout домейн според настройките на Paddle. Локалното тестване на webhook изисква публичен HTTPS tunnel към порт 3000.
5. Създай notification destination: `https://ТВОЯТ-TUNNEL/api/paddle/webhook`.

| Поле                                 | Стойност                                     |
| ------------------------------------ | -------------------------------------------- |
| `NEXT_PUBLIC_PADDLE_ENV`             | `sandbox`                                    |
| `PADDLE_API_KEY`                     | Sandbox API key, само за сървъра             |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`    | Sandbox client-side token, обичайно `test_…` |
| `PADDLE_MONTHLY_PRICE_ID`            | ID на месечната цена, `pri_…`                |
| `PADDLE_NOTIFICATION_WEBHOOK_SECRET` | Secret key на notification destination       |

Абонирай destination за:

```text
transaction.paid
transaction.completed
transaction.payment_failed
transaction.past_due
subscription.created
subscription.activated
subscription.updated
subscription.trialing
subscription.canceled
subscription.paused
subscription.resumed
subscription.past_due
```

За checkout през HTTPS tunnel промени `NEXT_PUBLIC_APP_URL` на неговия origin и добави съответните auth callback адреси в Supabase. Ползвай приложението през същия origin. След промяна на `NEXT_PUBLIC_…` рестартирай dev сървъра; при deployment направи нов build.

Webhook събитията са източникът на истина. Съобщение за успешен checkout в браузъра **не** отключва Premium. В страницата за абонамент има изчакване и проверка на server-side състоянието. `transaction.paid`/`completed` сами по себе си не предоставят entitlement; активното състояние идва от subscription lifecycle събитията.

### 3. Останали полета

Остави `MASTERY_THRESHOLD=80` и `COMPLETION_THRESHOLD=60`, ако не променяш учебната политика. Под 60% се предлага повторение и следващият урок остава заключен; повторенията не са ограничени. 60–79% завършва урока с препоръка за преговор. 80%+ означава усвояване. Вече завършен урок не се заключва от последващ по-слаб опит.

`AI_PROVIDER=openai` и моделите са попълнени в `.env.local`. Добави свой `AI_API_KEY`, за да работят реалните AI заявки. Настройките, ограниченията и административният CMS са описани в [AI Lab v2](docs/ai-lab-v2.md). Учебните уроци не изискват AI ключ.

## Локално стартиране след попълване

Използвай Node.js 22.12+ и npm. Зависимостите са инсталирани в текущата работна папка. За нов checkout:

```bash
npm ci
```

След `.env`:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

Отвори `http://localhost:3000`. Регистрирай родител, потвърди имейла и създай детски профил. Без конфигурация публичните страници са достъпни, а защитените страници водят към `/setup`.

Seed е идемпотентен и не презаписва CMS редакции. Миграциите използват схемата от `src/db/schema.ts`; не използвай `drizzle-kit push` към production.

`npm run db:maintenance` изтрива изтекли rate-limit записи и Lab assets/raw history и възстановява Energy за изтекли задачи. Vercel има ежедневен cron; за него задай `CRON_SECRET`.

След първия успешен вход предостави admin роля на собствения си акаунт:

```bash
npm run db:admin -- your-parent-email@example.com
```

Отвори `/admin`. Нито metadata от регистрацията, нито клиентски параметър могат да предоставят admin права.

## Проверки

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Unit и integration тестовете използват истински PostgreSQL engine чрез PGlite в паметта. Прилагат миграциите и проверяват оценяване, ownership, progress, идемпотентност на XP, отключване, версии на съдържанието, изтриване, RLS конфигурацията, Paddle състояния и подписи.

Браузърни тестове:

```bash
npx playwright install chromium
npm run test:e2e
```

E2E harness стартира временна PGlite база, mock Supabase Auth API и mock Paddle/OpenAI transport на `127.0.0.1`, плюс production build на Next.js на порт `3100`. Не използва данните или ключовете от твоя `.env` и няма test endpoint в приложението. Проверява реалните route handlers и UI; външните услуги се симулират. След приключване процесите се спират и тестовата база се изхвърля. Портове `3100`, `54328` и `54329` трябва да са свободни.

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` може да посочва вече инсталиран съвместим Chromium. Screenshot-и и trace файлове са в игнорираната папка `test-results/`.

Тези тестове не заменят един реален Supabase email flow и Paddle Sandbox checkout/webhook преди бета. Нужни са твоите конфигурирани услуги, за да се потвърдят доставянето на имейли, checkout домейнът и достигането на webhook.

## Архитектура и важни решения

```text
src/app/                  Next.js routes, server-rendered pages и API
src/components/           Детски, родителски и административен интерфейс
src/db/schema.ts          Drizzle PostgreSQL schema
src/db/migrations/        Версионирани SQL миграции
src/content/seed/         Българско учебно съдържание, нива и значки
src/lib/learning/         Достъп, прогрес, транзакции и отключване
src/lib/quiz/             Чисти функции за оценяване
src/lib/gamification/     Нива и criteria за значки
src/lib/billing/          Paddle и централизирани entitlements
src/lib/admin/            Валидиран CMS запис и версии
src/i18n/                 UI текстове, отделени от curriculum
tests/                    Unit, PostgreSQL integration и Playwright
```

Уроците имат immutable `lesson_versions` с валидиран JSON за подредени блокове и въпроси. Това е съзнателна алтернатива на отделни mutable таблици за всеки блок: текущите опити остават свързани със старата версия, а новите ученици започват с новата. Повторенията на започнат урок използват неговата запазена версия. CMS пази старите версии и проверява optimistic concurrency.

Всички учебни мутации заключват детския ред и работят в транзакция. Уникални constraints пазят XP събитията, lesson progress, отговорите в опит и спечелените значки. Отговорите и XP не се приемат като резултат от браузъра. Quiz награда се дава веднъж за `(child, lesson, question)`; повторен верен отговор не генерира нова XP награда.

Платеният достъп изисква разпознат price ID, `active`/`trialing` състояние и неизтекъл billing period. Paused, past-due, canceled и изтекли записи не дават достъп. Историческият прогрес остава. Отложеното прекратяване запазва достъпа до края на периода, докато Paddle състоянието остава active.

Checkout се създава на сървъра и се свързва с непрогнозируем запис за текущия родител. Webhook не се доверява на произволен `user_id` или имейл от custom data. Събитие и промяна на subscription се записват атомарно; грешка връща HTTP 500, за да може Paddle да повтори доставката. В лога не се записват платежни payload-и.

RLS е включен за всички таблици и browser ролите нямат директен достъп. Next.js използва привилегированата PostgreSQL връзка и проверява ownership при всяка операция. Не добавяй permissive Supabase Data API политики, особено към версии с правилните отговори, users/roles и subscriptions.

## Vercel и частна бета

### Облачна среда

Приложението се деплойва като Next.js проект на Vercel с отделен Supabase проект за база и автентикация, и Paddle Sandbox за плащанията. Конкретните проекти, адреси и ключове не се описват тук — държат се в environment variables на съответната среда. Виж стъпките по-долу за настройка на нова среда.

### Стъпки за нова среда и публичен старт

1. Импортирай хранилището като Next.js проект. Build: `npm run build`. Node.js: 22+.
2. Задай environment variables отделно за Preview и Production. Никога не споделяй production база с автоматични тестове.
3. Приложи миграциите и seed към избраната база чрез локален/CI job. Build не променя базата.
4. Задай реалния `NEXT_PUBLIC_APP_URL`, Supabase Site URL/redirects, Paddle домейн и webhook адрес.
5. Изпълни реалния сценарий регистрация → профил → безплатни светове → Paddle Sandbox → webhook → AI Lab → реална AI заявка → прекратяване.
6. Прегледай писменото съдържание с педагог; допълни каталога според плана.
7. Попълни и прегледай юридическите текстове, доставчика, контакти, срокове за съхранение и необходимата политика за родителско съгласие. Текущите `/privacy` и `/terms` са ясно маркирани като работни текстове от PRD.
8. Настрой SMTP, резервни копия и наблюдение на HTTP 5xx и неуспешните Paddle notifications. Приложението има безопасни server logs, но външна monitoring услуга не е конфигурирана.

Преди публичен production launch остават правният/педагогическият преглед, собствен SMTP и реалният Sandbox checkout сценарий. Vercel deployment е направен; това само по себе си не означава завършена проверка за публичен старт.

## Използвана документация

- [Next.js App Router](https://nextjs.org/docs/app/getting-started/installation)
- [Supabase SSR и проверка на сесии](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase управление и изтриване на потребители](https://supabase.com/docs/guides/auth/managing-user-data)
- [Paddle Node.js SDK и подписани webhooks](https://developer.paddle.com/get-started/quickstart/node/)
- [Paddle subscription.created и връзка с transaction](https://developer.paddle.com/webhooks/subscriptions/subscription-created/)
- [Paddle customer portal](https://developer.paddle.com/api-reference/customer-portals/create-customer-portal-session/)
- [PGlite Socket за изолирани тестове](https://pglite.dev/docs/pglite-socket)
