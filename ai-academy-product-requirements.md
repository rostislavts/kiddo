# AI Academy for Kids --- Product Requirements Document

**Document type:** Product Requirements / Implementation Specification\
**Version:** 1.0\
**Status:** MVP\
**Primary audience:** Codex / Claude Code / engineering team\
**Initial market:** Bulgaria\
**Initial language:** Bulgarian\
**Initial age group:** 8--11 years\
**Business model:** Freemium subscription\
**Paid price:** €14.90/month\
**Deployment:** Vercel\
**Database:** PostgreSQL (Supabase preferred for MVP; Neon compatible)\
**Payments:** Paddle Billing

------------------------------------------------------------------------

## 1. Product Summary

AI Academy for Kids is an interactive web learning platform that teaches
children artificial intelligence concepts through short lessons,
interactive activities, challenges, quizzes, progression, XP,
achievements, and projects.

The product should feel closer to **Duolingo / a learning game** than to
a traditional online course or LMS.

The core learning loop is:

> **Learn → Interact → Experiment → Quiz → Earn XP → Unlock → Progress**

The MVP targets Bulgarian-speaking children aged 8--11. A parent creates
and owns the account, creates one or more child profiles, and purchases
the subscription. Children do not need email addresses.

The platform must be designed so additional languages, age tracks,
worlds, lessons, question types, and subscription plans can be added
later without major architectural changes.

------------------------------------------------------------------------

## 2. Product Goals

### 2.1 Primary goals

1.  Teach children foundational AI literacy in an engaging,
    age-appropriate way.
2.  Validate understanding rather than merely presenting content.
3.  Make children want to return and continue learning.
4.  Give parents clear visibility into learning progress.
5.  Convert engaged free users into a €14.90/month subscription.
6.  Build the MVP on an architecture that can later support schools and
    multiple languages.

### 2.2 Non-goals for MVP

Do **not** build the following in V1 unless required by another feature:

-   Native iOS or Android apps.
-   Live classes.
-   Video conferencing.
-   Teacher/classroom management.
-   School billing.
-   Social network or public child profiles.
-   Child-to-child messaging.
-   Public leaderboards.
-   Marketplace.
-   Complex AI agent functionality.
-   User-generated public content.
-   Full authoring SaaS for external teachers.
-   Multiple paid tiers.
-   Annual subscription unless easy to add after monthly billing is
    complete.

------------------------------------------------------------------------

## 3. Target Users

### 3.1 Parent

The parent is the account owner and paying customer.

The parent can:

-   register and log in;
-   manage subscription;
-   create/manage child profiles;
-   select a child profile;
-   view learning progress;
-   view strengths and weak topics;
-   see completed worlds, lessons, quizzes and achievements;
-   manage account and privacy settings.

### 3.2 Child

The child uses a profile under the parent's account.

A child profile should require only:

-   nickname/display name;
-   avatar;
-   optional age or age band.

Do not require child email, phone number, full legal name, address, or
other unnecessary personal information.

The child can:

-   continue learning;
-   navigate available worlds;
-   complete lessons;
-   perform interactive activities;
-   answer quizzes;
-   earn XP;
-   unlock lessons/worlds;
-   earn achievements;
-   view their progress.

### 3.3 Admin / Content Manager

An internal admin can:

-   create and edit worlds;
-   create and edit lessons;
-   create quiz questions and answers;
-   set XP rewards;
-   control ordering;
-   publish/unpublish content;
-   mark content as free or premium;
-   inspect users/subscriptions/progress at a basic level.

For MVP, the admin interface may be pragmatic rather than highly
polished.

------------------------------------------------------------------------

## 4. Product Structure

The hierarchy is:

``` text
Track
└── World
    └── Lesson
        ├── Learning Blocks
        ├── Interactive Activity
        └── Quiz
```

For MVP there is one track:

``` text
AI Explorer — Ages 8–11
```

Example worlds:

1.  What Is AI?
2.  How AI Learns
3.  Train Your First AI
4.  Generative AI
5.  Talking to AI / Prompting
6.  AI Detective: Mistakes and Hallucinations
7.  Images and Computer Vision
8.  AI Safety and Privacy
9.  Bias and Fairness
10. Build With AI

The content model must not hard-code these names. Worlds and lessons are
database-driven.

------------------------------------------------------------------------

## 5. MVP Learning Content

Target MVP content:

-   1 learning track;
-   approximately 10 worlds;
-   approximately 5 lessons per world;
-   approximately 50 lessons total;
-   5--15 minutes per lesson;
-   3--7 quiz questions per lesson;
-   one larger challenge or project at the end of selected worlds.

The first world should be free.

All later worlds require an active paid subscription.

The exact number of worlds/lessons must be configurable and must not be
assumed by application logic.

------------------------------------------------------------------------

## 6. Learning Experience

### 6.1 Lesson design

A lesson should consist of ordered blocks.

Supported MVP block types:

-   `text`
-   `heading`
-   `illustration`
-   `callout`
-   `example`
-   `multiple_choice_activity`
-   `sort_activity`
-   `categorize_activity`
-   `prediction_activity`
-   `quiz`

Future block types should be addable without redesigning the lesson
schema.

Avoid long pages of text. Content should be broken into small
screens/cards or steps.

### 6.2 Lesson player

The lesson player should:

1.  show one learning step at a time;
2.  show progress through the lesson;
3.  allow forward navigation after required interaction;
4.  persist progress after every meaningful step;
5.  recover correctly after refresh/browser close;
6.  work well on phone, tablet, and desktop;
7.  transition naturally into the lesson quiz.

Example:

``` text
Step 1/8
"What is AI?"

↓
short explanation

Step 2/8
"Which of these products may use AI?"

↓
interactive task

...

Step 8/8
"Ready for your mission?"

↓
Quiz
```

### 6.3 Interactive activities

Activities should test understanding during the lesson without
necessarily affecting the final mastery score.

Examples:

-   classify images into categories;
-   choose what data an AI model should learn from;
-   predict what an AI system might do;
-   identify a biased dataset;
-   identify an AI hallucination;
-   construct a better prompt;
-   order steps in an AI workflow.

Activity definitions should be content-driven, preferably stored as
structured JSON validated with Zod.

------------------------------------------------------------------------

## 7. Quiz and Mastery System

### 7.1 Quiz types

MVP must support:

-   single-choice;
-   multiple-choice;
-   true/false;
-   ordering;
-   matching/categorization.

Each question should support:

``` text
prompt
optional context
answer options
correct answer(s)
explanation
hint
difficulty
XP reward
```

### 7.2 Feedback

After an answer, provide immediate feedback.

Correct answer:

-   positive confirmation;
-   concise explanation;
-   XP animation/update.

Incorrect answer:

-   do not shame or punish the child;
-   explain the concept;
-   optionally allow retry;
-   store the first-attempt result for analytics.

### 7.3 Mastery

Each completed quiz produces a percentage score.

Default thresholds:

-   **80--100%:** mastered;
-   **60--79%:** completed, review recommended;
-   **0--59%:** retry recommended.

The threshold must be configurable.

Do not permanently block a child for failing. Allow retry.

Store:

-   attempts;
-   answers;
-   first-attempt correctness;
-   final score;
-   best score;
-   completion timestamp.

------------------------------------------------------------------------

## 8. Progression and Gamification

### 8.1 XP

Children earn XP for:

-   completing a lesson;
-   answering quiz questions correctly;
-   completing a world;
-   completing selected challenges.

XP values must be configurable in content/admin.

### 8.2 Levels

Use a simple XP-based level system.

Example:

``` text
Level 1 — AI Rookie
Level 2 — AI Explorer
Level 3 — AI Investigator
Level 4 — AI Creator
Level 5 — AI Builder
```

Do not hard-code the final level taxonomy into business logic.

### 8.3 Achievements

MVP achievement examples:

-   First Mission
-   5 Lessons Completed
-   Perfect Quiz
-   First World Completed
-   AI Detective
-   500 XP
-   1,000 XP

Achievements should be data-driven.

### 8.4 Streaks

Streaks are optional for the first release but the data model should
allow them.

If implemented:

-   a learning day counts when at least one lesson/activity is
    completed;
-   show current streak and best streak;
-   do not use aggressive loss-aversion UX for children.

### 8.5 World unlocking

Default rule:

-   lessons unlock sequentially inside a world;
-   next world unlocks when the required previous world is completed;
-   World 1 is free;
-   premium worlds additionally require subscription entitlement.

Unlocking rules should be configurable enough to change later.

------------------------------------------------------------------------

## 9. Child Home / Learning Dashboard

The child dashboard is the primary application screen.

It should prominently show:

-   avatar and nickname;
-   current level;
-   total XP;
-   current world;
-   overall progress;
-   primary **Continue learning** CTA;
-   world map / world cards;
-   locked/unlocked/completed states;
-   recent achievements.

The experience should be visual, friendly and modern without looking
designed for preschool children.

Target age: 8--11.

Avoid dense enterprise dashboard UI.

------------------------------------------------------------------------

## 10. Parent Dashboard

The parent dashboard should show all child profiles.

For each child show:

-   current level;
-   total XP;
-   lessons completed;
-   worlds completed;
-   overall mastery;
-   recent activity;
-   topic-level mastery;
-   topics that may need review.

Example:

``` text
Eva — AI Explorer, Level 4

12 / 50 lessons
1,850 XP
Overall mastery: 84%

Prompting                 92%
Computer Vision           88%
How AI Learns             81%
Hallucinations            61%  ← Review recommended
```

Parent controls:

-   create child profile;
-   edit nickname/avatar/age band;
-   select child;
-   subscription management;
-   account settings;
-   privacy/data controls.

------------------------------------------------------------------------

## 11. Authentication

### 11.1 Account model

Only parents need authentication.

Recommended MVP options:

**Option A --- Supabase** - Supabase Auth; - Supabase Postgres.

**Option B --- Neon** - Neon Postgres; - Auth.js / Better Auth or
another mature auth provider.

Prefer **Supabase for MVP** because authentication and PostgreSQL can be
managed together and Paddle maintains an official Next.js starter
architecture using Supabase.

Keep domain/business logic independent enough that PostgreSQL can later
be moved to Neon.

### 11.2 Auth methods

MVP:

-   email + password or magic link;
-   Google login may be added if straightforward.

Do not build child authentication.

A parent selects a child profile after login.

### 11.3 Authorization

Enforce authorization server-side.

A parent may access only:

-   their own account;
-   their own child profiles;
-   progress belonging to those child profiles;
-   their own billing state.

Admin routes require an explicit admin role.

Never rely only on client-side route hiding.

------------------------------------------------------------------------

## 12. Subscription and Payments

### 12.1 Business model

**Free** - account creation; - child profile; - complete World 1; -
progress tracking for free content.

**Premium** - €14.90/month; - access to all published premium worlds; -
all quizzes, challenges and achievements; - parent progress dashboard.

The Paddle price/product IDs must be environment configuration, not
hard-coded.

### 12.2 Paddle

Use **Paddle Billing**, not Paddle Classic.

Use:

-   Paddle.js for checkout;
-   official Paddle Node.js SDK server-side;
-   Paddle customer/subscription entities;
-   Paddle webhooks as the source of truth for subscription state.

Never expose Paddle API keys client-side.

### 12.3 Checkout flow

Expected flow:

``` text
Parent hits premium lock
        ↓
Pricing / upgrade modal
        ↓
€14.90/month
        ↓
Paddle Checkout
        ↓
Payment
        ↓
Paddle webhook
        ↓
Subscription synced to Postgres
        ↓
Premium entitlement enabled
```

Do not grant durable premium access merely because the browser reports
checkout success. Durable entitlement must be reconciled with
server-side Paddle state/webhooks.

### 12.4 Required Paddle webhook handling

At minimum support the relevant lifecycle events for:

-   transaction completed/paid;
-   subscription created;
-   subscription updated;
-   subscription canceled;
-   subscription paused/resumed if enabled;
-   past-due/payment failure states as needed.

Webhook implementation requirements:

-   verify `Paddle-Signature`;
-   use raw request body where required by SDK;
-   store Paddle `event_id`;
-   process events idempotently;
-   tolerate duplicate delivery;
-   tolerate out-of-order delivery;
-   store `occurred_at`;
-   return appropriate HTTP response quickly;
-   log failures without logging sensitive payment data.

### 12.5 Subscription state

Suggested internal states:

``` text
none
trialing
active
past_due
paused
canceled
```

Access policy should be centralized in one entitlement function, e.g.:

``` ts
canAccessPremium(parentAccount): boolean
```

Do not scatter subscription checks throughout UI components.

### 12.6 Billing management

Provide a parent billing page with:

-   current plan;
-   status;
-   next billing date when available;
-   cancel/manage subscription action;
-   Paddle-supported customer management flow.

------------------------------------------------------------------------

## 13. Suggested Database Model

Use PostgreSQL.

Use migrations. Recommended ORM: **Drizzle ORM** or Prisma. Prefer
Drizzle for a lightweight Vercel/Postgres stack.

Suggested entities:

### `users`

``` text
id
email
display_name
role
created_at
updated_at
```

### `child_profiles`

``` text
id
parent_user_id
nickname
avatar_key
age_band
created_at
updated_at
```

### `tracks`

``` text
id
slug
title
description
age_min
age_max
language
status
sort_order
```

### `worlds`

``` text
id
track_id
slug
title
description
image_key
sort_order
is_free
status
required_world_id nullable
```

### `lessons`

``` text
id
world_id
slug
title
description
sort_order
estimated_minutes
xp_reward
status
content_version
```

### `lesson_blocks`

``` text
id
lesson_id
type
sort_order
content_json
```

### `quiz_questions`

``` text
id
lesson_id
type
prompt
context_json
answers_json
correct_answer_json
explanation
hint
difficulty
xp_reward
sort_order
```

### `lesson_progress`

``` text
id
child_profile_id
lesson_id
status
current_step
started_at
completed_at
best_quiz_score
last_activity_at
```

Unique:

``` text
(child_profile_id, lesson_id)
```

### `quiz_attempts`

``` text
id
child_profile_id
lesson_id
attempt_number
score
max_score
percentage
started_at
completed_at
```

### `quiz_answers`

``` text
id
quiz_attempt_id
question_id
answer_json
is_correct
xp_awarded
answered_at
```

### `xp_events`

Use an append-only ledger rather than only storing a mutable XP total.

``` text
id
child_profile_id
event_type
reference_type
reference_id
xp
created_at
```

Total XP can be calculated/cached.

### `achievements`

``` text
id
key
title
description
icon_key
criteria_json
status
```

### `child_achievements`

``` text
id
child_profile_id
achievement_id
earned_at
```

Unique:

``` text
(child_profile_id, achievement_id)
```

### `subscriptions`

``` text
id
user_id
provider
paddle_customer_id
paddle_subscription_id
paddle_price_id
status
current_period_start
current_period_end
cancel_at_period_end
last_event_occurred_at
created_at
updated_at
```

### `payment_webhook_events`

``` text
id
provider
provider_event_id
event_type
occurred_at
processed_at
payload_json optional
processing_status
error_message nullable
```

`provider_event_id` must be unique.

### `analytics_events`

Optional internal event table:

``` text
id
user_id nullable
child_profile_id nullable
event_name
properties_json
created_at
```

------------------------------------------------------------------------

## 14. Content Architecture

Learning content must not be hard-coded into React components.

Store lesson structure in PostgreSQL and/or version-controlled seed
content that is imported into PostgreSQL.

Use structured JSON for flexible block content.

Example:

``` json
{
  "type": "multiple_choice_activity",
  "title": "Кое от тези използва AI?",
  "prompt": "Избери всички верни отговори.",
  "options": [
    {
      "id": "a",
      "label": "Гласов асистент"
    },
    {
      "id": "b",
      "label": "Обикновена крушка"
    }
  ],
  "correct": ["a"],
  "explanation": "Гласовият асистент..."
}
```

All content JSON must be validated server-side with schemas
(recommended: Zod).

Support content versioning so changing a lesson does not corrupt
existing progress.

------------------------------------------------------------------------

## 15. Admin CMS

Protected route:

``` text
/admin
```

MVP functionality:

### Worlds

-   list;
-   create;
-   edit;
-   reorder;
-   free/premium toggle;
-   draft/published toggle.

### Lessons

-   list by world;
-   create;
-   edit;
-   reorder;
-   estimated duration;
-   XP reward;
-   draft/published toggle.

### Lesson blocks

-   add;
-   edit;
-   remove;
-   reorder;
-   preview.

### Quiz questions

-   add;
-   edit;
-   remove;
-   reorder;
-   define correct answers;
-   explanation;
-   hint;
-   XP.

### Preview

Admin should be able to preview a lesson using the real lesson player
before publishing.

Do not spend excessive MVP time building a sophisticated drag-and-drop
CMS. Simple forms and reorder controls are sufficient.

------------------------------------------------------------------------

## 16. AI Features

AI is part of the subject being taught, but the MVP does not require
every lesson to make live LLM calls.

Prefer deterministic activities wherever possible.

### 16.1 Optional AI Tutor

Design the architecture so a future AI tutor can be added.

Potential tutor capabilities:

-   explain a concept differently;
-   provide a hint;
-   ask a follow-up question;
-   evaluate selected open-ended exercises.

If implemented later:

-   conversations must be constrained to educational context;
-   use age-appropriate system instructions;
-   prevent requesting unnecessary personal data;
-   implement moderation/safety controls;
-   rate-limit usage;
-   do not use AI judgment as the sole authoritative source for mastery;
-   do not expose model/API keys client-side.

### 16.2 AI usage abstraction

If an LLM is added, create a provider abstraction such as:

``` text
lib/ai/
  provider.ts
  prompts/
  safety.ts
```

Avoid coupling product logic directly to one model vendor.

------------------------------------------------------------------------

## 17. UX / UI Requirements

### 17.1 Design direction

The product should be:

-   playful;
-   modern;
-   colorful but not chaotic;
-   suitable for ages 8--11;
-   usable without reading large paragraphs;
-   touch-friendly;
-   visually rewarding.

Avoid:

-   corporate SaaS aesthetics in the child experience;
-   preschool aesthetics;
-   excessive animation;
-   manipulative dark patterns;
-   public competitive ranking.

### 17.2 Responsive design

Must work at minimum on:

-   modern mobile phones;
-   tablets;
-   laptops/desktops.

Primary child interactions must be touch-friendly.

### 17.3 Accessibility

Baseline requirements:

-   semantic HTML;
-   keyboard accessibility;
-   visible focus states;
-   sufficient contrast;
-   meaningful alt text;
-   do not rely only on color to communicate correct/incorrect state;
-   reduced-motion support where appropriate.

------------------------------------------------------------------------

## 18. Application Routes

Suggested route structure:

``` text
/
  Landing page

/pricing
  Pricing

/login
/signup

/app
  Parent/child selector

/app/learn
  Child dashboard

/app/world/[worldSlug]
  World detail

/app/lesson/[lessonSlug]
  Lesson player

/app/progress
  Child progress

/app/achievements
  Achievements

/parent
  Parent dashboard

/parent/children
  Manage child profiles

/parent/billing
  Subscription management

/parent/settings
  Account/privacy settings

/admin
/admin/worlds
/admin/worlds/[id]
/admin/lessons/[id]

/api/paddle/webhook
  Paddle webhook endpoint
```

Exact route naming may differ if implementation quality benefits.

------------------------------------------------------------------------

## 19. Recommended Technical Stack

### Frontend / Full-stack framework

-   Next.js current stable release;
-   App Router;
-   TypeScript;
-   React Server Components where appropriate;
-   Server Actions or Route Handlers for mutations/APIs;
-   Tailwind CSS;
-   shadcn/ui for generic parent/admin UI primitives;
-   custom child-facing visual components.

### Hosting

-   Vercel;
-   preview deployments for pull requests;
-   production environment separated from development.

### Database

Preferred MVP:

-   Supabase PostgreSQL.

Alternative:

-   Neon PostgreSQL.

Database access:

-   Drizzle ORM;
-   migration files committed to Git.

### Authentication

If Supabase:

-   Supabase Auth.

If Neon:

-   Better Auth/Auth.js or another mature solution.

### Validation

-   Zod.

### Payments

-   Paddle Billing;
-   `@paddle/paddle-node-sdk`;
-   Paddle.js/client wrapper.

### Testing

-   Vitest for unit tests;
-   React Testing Library where useful;
-   Playwright for critical end-to-end flows.

### Code quality

-   ESLint;
-   Prettier;
-   strict TypeScript;
-   no `any` unless justified.

------------------------------------------------------------------------

## 20. Environment Variables

Create `.env.example`.

Expected variables include:

``` bash
# App
NEXT_PUBLIC_APP_URL=

# Database
DATABASE_URL=

# Supabase, if selected
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Paddle
PADDLE_API_KEY=
PADDLE_NOTIFICATION_WEBHOOK_SECRET=
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=
NEXT_PUBLIC_PADDLE_ENV=sandbox
PADDLE_MONTHLY_PRICE_ID=

# Optional future AI
AI_PROVIDER=
AI_API_KEY=
```

Never commit secrets.

Production and preview environments must use appropriate separate
credentials where necessary.

------------------------------------------------------------------------

## 21. Analytics

Track product events from day one.

Minimum events:

``` text
signup_completed
child_profile_created
child_profile_selected
world_viewed
lesson_started
lesson_step_completed
lesson_completed
quiz_started
quiz_answered
quiz_completed
quiz_retried
world_completed
achievement_earned
premium_gate_viewed
checkout_started
checkout_completed
subscription_activated
subscription_canceled
```

Useful properties:

``` text
track_id
world_id
lesson_id
child_age_band
question_id
quiz_score
attempt_number
is_free_content
```

Avoid collecting unnecessary child personal information in analytics.

Key metrics:

### Acquisition

-   visitors;
-   signups;
-   signup conversion.

### Activation

-   child profiles created;
-   first lesson started;
-   first lesson completed;
-   World 1 completion.

### Learning

-   lesson completion rate;
-   quiz first-attempt score;
-   mastery by topic;
-   retries;
-   drop-off step.

### Monetization

-   premium gate → checkout;
-   checkout → paid;
-   free → paid conversion;
-   MRR;
-   churn.

### Retention

-   D1;
-   D7;
-   D30;
-   lessons per active child;
-   worlds completed.

Analytics provider may be PostHog or equivalent. Keep provider
integration isolated.

------------------------------------------------------------------------

## 22. Privacy and Child Safety

This product is designed for children, so privacy must be a first-class
requirement.

MVP principles:

1.  The parent owns the account.
2.  Do not require child email.
3.  Do not require a child's full legal name.
4.  Collect the minimum data needed.
5.  No public child profiles.
6.  No child-to-child messaging.
7.  No public leaderboards.
8.  No behavioral advertising targeted at children.
9.  No sale of child data.
10. Provide parent-accessible data deletion.
11. Provide parent-accessible child profile deletion.
12. Clearly separate necessary product analytics from optional marketing
    analytics.
13. Do not send child-entered free text to third-party AI services
    unless the feature explicitly requires it and the privacy design
    supports it.

Before production launch, perform a dedicated legal/privacy review for
applicable EU/Bulgarian requirements, including GDPR obligations related
to children's data and parental consent.

Do not encode a guessed legal age/consent threshold directly into
product logic. Make age/consent policy configurable after legal review.

------------------------------------------------------------------------

## 23. Security Requirements

-   Server-side authorization for protected resources.
-   Validate all input.
-   Parameterized DB access through ORM.
-   CSRF-safe auth/mutation patterns.
-   Secure cookies.
-   Rate-limit sensitive endpoints.
-   Rate-limit authentication attempts where supported.
-   Verify Paddle webhook signatures.
-   Idempotent webhook processing.
-   Do not trust price/product IDs sent by browser.
-   Do not trust subscription status from client.
-   Never expose service-role/API secrets.
-   Admin authorization checked server-side.
-   Sanitize/render CMS content safely.
-   Avoid arbitrary HTML from content editors in MVP.
-   Log security-relevant failures without leaking secrets or sensitive
    child data.

------------------------------------------------------------------------

## 24. Performance Requirements

Targets for production:

-   fast first load on typical mobile connection;
-   use Next.js image optimization;
-   lazy-load non-critical media;
-   avoid shipping large animation libraries unnecessarily;
-   lesson navigation should feel immediate;
-   persist progress without noticeable blocking;
-   avoid unnecessary client-side JavaScript.

Prefer server components for data-heavy parent/admin pages and client
components only where interactivity requires them.

------------------------------------------------------------------------

## 25. SEO / Marketing Site

Public pages should be server-rendered/indexable.

Initial public pages:

-   homepage;
-   how it works;
-   curriculum;
-   pricing;
-   FAQ;
-   privacy;
-   terms.

Primary homepage CTA:

> **Start learning for free**

Secondary message:

> First AI world free. No payment required.

Do not require Paddle checkout before the child can experience the free
world.

------------------------------------------------------------------------

## 26. Seed Content

The repository should include enough seed content to demonstrate the
complete product.

Minimum development seed:

### World 1: What Is AI?

At least 3 complete lessons:

1.  What is Artificial Intelligence?
2.  Where Do We Meet AI?
3.  Can AI Make Mistakes?

Each should include:

-   lesson blocks;
-   at least one interactive activity;
-   3--5 quiz questions;
-   explanations;
-   XP rewards.

Also seed:

-   sample achievements;
-   level definitions;
-   one premium World 2 with at least one lesson so premium locking can
    be tested.

Bulgarian should be the default learner-facing language.

------------------------------------------------------------------------

## 27. Localization

Even though MVP is Bulgarian, do not hard-code UI copy throughout
components.

Prepare for i18n.

At minimum distinguish:

-   application UI strings;
-   curriculum content.

Curriculum records should contain a language/locale association.

Initial locale:

``` text
bg-BG
```

Future expected locales may include:

``` text
en
ro
el
```

Do not implement all translations in MVP.

------------------------------------------------------------------------

## 28. Core Business Rules

1.  A user may own multiple child profiles.
2.  Progress belongs to a child profile, not directly to the parent.
3.  Subscription belongs to the parent account.
4.  One active parent subscription grants premium entitlement to child
    profiles under that account for MVP.
5.  Free content is available without an active subscription after
    parent registration.
6.  Premium content requires entitlement.
7.  Completed progress is not deleted when a subscription ends.
8.  If subscription expires, premium content becomes locked but
    historical progress remains visible.
9.  Reactivating a subscription restores access.
10. XP must not be duplicated when the same completion request is
    retried.
11. Webhook retries must not create duplicate subscriptions/events.
12. Quiz attempts remain historically stored.

------------------------------------------------------------------------

## 29. Important Idempotency Rules

The implementation must be safe against retries.

### XP

Award XP through an idempotent ledger event keyed by something
equivalent to:

``` text
child_profile_id
event_type
reference_id
```

A repeated request must not award the same one-time XP twice.

### Lesson completion

Completing an already completed lesson must not:

-   duplicate completion records;
-   duplicate completion XP;
-   duplicate achievements.

### Paddle

`provider_event_id` / Paddle `event_id` must be unique.

A duplicate webhook should safely return success after detecting it was
already processed.

------------------------------------------------------------------------

## 30. Error and Empty States

Implement intentional states for:

-   no child profile;
-   no progress yet;
-   no published lessons;
-   locked premium content;
-   failed lesson save;
-   offline/network failure;
-   Paddle checkout failure;
-   subscription sync pending;
-   canceled subscription;
-   quiz with malformed content;
-   deleted/unpublished lesson accessed via old URL.

Never leave the child on a blank screen.

------------------------------------------------------------------------

## 31. Testing Requirements

### Unit tests

At minimum test:

-   mastery calculation;
-   XP calculation/idempotency;
-   lesson unlock rules;
-   world unlock rules;
-   premium entitlement;
-   achievement criteria;
-   quiz scoring;
-   content schema validation.

### Integration tests

Test:

-   parent creates child;
-   progress persistence;
-   quiz submission;
-   lesson completion;
-   subscription state update;
-   duplicate Paddle webhook;
-   out-of-order Paddle event protection where relevant.

### E2E tests

Playwright critical paths:

#### Free learner

``` text
signup
→ create child
→ start World 1
→ complete lesson
→ complete quiz
→ receive XP
→ dashboard progress updated
```

#### Conversion

``` text
free user
→ opens premium world
→ sees premium gate
→ initiates Paddle sandbox checkout
```

#### Paid entitlement

Use mocked/test Paddle state where appropriate:

``` text
subscription active
→ premium world unlocked
```

#### Cancellation

``` text
subscription canceled/expired
→ premium locked
→ existing progress retained
```

------------------------------------------------------------------------

## 32. Definition of Done for MVP

MVP is ready for private beta when:

-   parent registration/login works;
-   child profiles work;
-   free/premium content distinction works;
-   child dashboard works;
-   world/lesson navigation works;
-   lesson player supports required block types;
-   progress survives refresh/logout;
-   quizzes are scored correctly;
-   XP is awarded idempotently;
-   achievements work;
-   world unlocking works;
-   parent progress dashboard works;
-   Paddle sandbox checkout works;
-   Paddle webhooks are verified and idempotent;
-   active subscription unlocks premium content;
-   cancellation/expiration removes entitlement without deleting
    progress;
-   admin can create/edit/publish curriculum;
-   Bulgarian seed curriculum exists;
-   responsive UI works on phone/tablet/desktop;
-   critical E2E tests pass;
-   application deploys successfully to Vercel;
-   production secrets are not present in repository.

------------------------------------------------------------------------

## 33. Recommended Implementation Phases

### Phase 1 --- Foundation

Implement:

-   Next.js project;
-   database;
-   migrations;
-   auth;
-   parent account;
-   child profiles;
-   app shell;
-   authorization;
-   seed framework.

### Phase 2 --- Curriculum Engine

Implement:

-   tracks;
-   worlds;
-   lessons;
-   block schemas;
-   lesson player;
-   progress persistence.

### Phase 3 --- Assessment

Implement:

-   quiz engine;
-   question types;
-   scoring;
-   mastery;
-   retries;
-   explanations.

### Phase 4 --- Gamification

Implement:

-   XP ledger;
-   levels;
-   achievements;
-   world unlocking;
-   child dashboard.

### Phase 5 --- Parent Experience

Implement:

-   parent dashboard;
-   child management;
-   progress reporting;
-   settings.

### Phase 6 --- Billing

Implement:

-   premium gate;
-   Paddle sandbox;
-   checkout;
-   verified webhook handler;
-   subscription sync;
-   entitlement service;
-   billing page.

### Phase 7 --- Admin

Implement:

-   content CRUD;
-   ordering;
-   publish/draft;
-   preview.

### Phase 8 --- Production Hardening

Implement:

-   analytics;
-   privacy controls;
-   deletion flows;
-   rate limiting;
-   logging;
-   error monitoring;
-   accessibility review;
-   E2E suite;
-   performance optimization;
-   Vercel production configuration.

------------------------------------------------------------------------

## 34. Suggested Repository Structure

``` text
src/
  app/
    (marketing)/
    (auth)/
    app/
    parent/
    admin/
    api/
      paddle/
        webhook/

  components/
    child/
    parent/
    admin/
    learning/
    quiz/
    gamification/
    ui/

  db/
    schema/
    migrations/
    seed/

  lib/
    auth/
    billing/
      paddle/
      entitlements.ts
    learning/
    progress/
    quiz/
    gamification/
    analytics/
    validation/

  content/
    seed/

  i18n/

tests/
  unit/
  integration/
  e2e/
```

Keep business rules out of React components.

For example:

``` text
lib/learning/unlocks.ts
lib/quiz/scoring.ts
lib/gamification/xp.ts
lib/billing/entitlements.ts
```

These modules should be independently testable.

------------------------------------------------------------------------

## 35. Engineering Principles for the Coding Agent

When implementing this specification:

1.  Build production-quality code, not a visual prototype.
2.  Use strict TypeScript.
3.  Prefer simple, maintainable abstractions.
4.  Do not over-engineer microservices; keep MVP as a modular monolith.
5.  Use PostgreSQL transactions for operations that update related
    progress/XP/achievement state.
6.  Keep billing, learning, quiz and gamification business logic
    separate.
7.  Never put authorization solely in the client.
8.  Never put Paddle secrets in browser code.
9.  Never trust client-submitted subscription state, XP or quiz score.
10. Calculate scores and rewards server-side.
11. Make all important mutation endpoints idempotent where retries are
    possible.
12. Add database constraints for invariants rather than relying only on
    application code.
13. Create migrations; do not mutate production schema manually.
14. Add tests as each business module is implemented.
15. Keep curriculum data editable without code changes.
16. Optimize first for a reliable private beta, not hypothetical scale.

------------------------------------------------------------------------

## 36. Initial Product Decisions

Unless explicitly changed, implement with these assumptions:

  Decision                 MVP choice
  ------------------------ ---------------------------------
  Market                   Bulgaria
  Learner age              8--11
  Language                 Bulgarian
  Account owner            Parent
  Child login              None
  Free tier                World 1
  Premium                  €14.90/month
  Billing                  Paddle Billing
  Hosting                  Vercel
  Framework                Next.js + TypeScript
  Database                 PostgreSQL
  Preferred DB/Auth        Supabase
  ORM                      Drizzle
  Styling                  Tailwind CSS
  Generic components       shadcn/ui
  Architecture             Modular monolith
  Native app               No
  Teacher accounts         Not in MVP
  Live classes             No
  Public social features   No
  AI tutor                 Future/optional
  Primary learner device   Tablet/mobile + desktop support

------------------------------------------------------------------------

## 37. Post-MVP Roadmap

Potential next releases:

### V1.1

-   annual subscription;
-   family plan;
-   streaks;
-   certificates;
-   richer world-end projects;
-   email progress summary for parents.

### V1.2

-   English localization;
-   AI tutor;
-   adaptive quiz difficulty;
-   personalized review queue;
-   additional age track: 12--14.

### V2

-   teacher accounts;
-   classrooms;
-   student invitation codes;
-   school dashboard;
-   school licenses;
-   assignments;
-   curriculum analytics;
-   B2B billing;
-   multi-tenant organizations.

### Later

-   Romanian/Greek/localized markets;
-   advanced AI Builder track;
-   coding exercises;
-   LLM/API projects;
-   computer vision labs;
-   safe collaborative classroom activities.

------------------------------------------------------------------------

## 38. Key Acceptance Scenario

A new parent must be able to:

``` text
Visit website
↓
Understand the product
↓
Create free account
↓
Create "Eva" child profile
↓
Enter child learning experience
↓
Complete first interactive AI lesson
↓
Answer quiz
↓
Receive score + explanation + XP
↓
See progress on world map
↓
Continue and complete free World 1
↓
Attempt to open World 2
↓
See €14.90/month premium offer
↓
Pay through Paddle
↓
Paddle webhook activates entitlement
↓
World 2 unlocks
↓
Parent can see learning progress
```

This end-to-end journey is the primary MVP acceptance criterion.

------------------------------------------------------------------------

## 39. External Implementation Notes

Paddle currently provides an official Next.js SaaS starter architecture
using **Next.js + Vercel + Supabase + Paddle**, including checkout,
subscription management and webhook synchronization. Use the official
current Paddle documentation and SDK behavior during implementation
rather than copying stale integration snippets.

Paddle webhook delivery is at-least-once. Treat `event_id` as a
deduplication key and account for events potentially arriving out of
order using event timestamps/state reconciliation.

When implementing Paddle with Codex or Claude Code, prefer the current
official Paddle developer documentation, SDK, and agent skills/MCP
integration where available.

------------------------------------------------------------------------

# End of PRD
