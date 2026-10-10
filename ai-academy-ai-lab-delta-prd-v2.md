# AI Academy → AI Lab --- Delta PRD v2.0

**Purpose:** Change specification for the already-implemented V1 PRD.\
**Audience:** Codex / Claude Code.\
**Rule:** Do not rebuild working V1 functionality. Apply these changes
incrementally and preserve existing users, progress, XP, achievements,
Paddle customers and subscriptions.

## 1. New product model

Replace the old freemium curriculum model with:

> **AI Academy → безплатно знание**\
> **AI Lab → €14.90/месец за истинско създаване с AI**\
> **AI Missions → причината детето да се връща**\
> **AI Energy → контрол на себестойността**

Meaning:

-   **AI Academy:** every core lesson, normal interactive activity,
    quiz, mastery assessment, standard XP/level and curriculum
    progression is free.
-   **AI Lab:** Premium creation environment using real AI models.
    Existing Paddle price remains €14.90/month.
-   **AI Missions:** basic curated missions are free forever; recurring
    Premium challenges use Lab engines and live AI.
-   **AI Energy:** configurable monthly allowance for live AI
    operations; controls inference cost without exposing tokens/API
    prices.

Premium proposition: **Learn AI for free. Build real things with AI in
the Lab.**

The pricing and authorization contract is:

| Feature | AI Academy | AI Lab |
| --- | --- | --- |
| Price | Free forever | Premium |
| Lessons | ✓ | ✓ |
| Tests | ✓ | ✓ |
| AI literacy | ✓ | ✓ |
| Hallucinations / safety / prompting theory | ✓ | ✓ |
| Real prompts | – | ✓ |
| Build-a-Bot | – | ✓ |
| Agents | – | ✓ |
| Image generation | – | ✓ |
| Knowledge/RAG Lab | – | ✓ |
| AI Missions | basic | ✓ |
| AI Energy | – | ✓ |

Basic missions use curated Detective questions, server-side grading and
saved XP without subscriptions, AI provider calls or Energy. Optional
live AI explanations, Featured missions and Escape Room contexts retain
Premium authorization. Both family subscriptions and school licenses
can provide Premium, with their existing separate Energy budgets.

## 2. Required changes from V1

Remove subscription gating from all Academy worlds/lessons. Sequential
learning prerequisites may remain, but subscription state must never
gate educational knowledge.

Review/deprecate existing `isFree`, premium-world and
`subscriptionRequiredForWorld` logic. Do not destroy historical data
merely to remove authorization.

Reuse the implemented Paddle Billing checkout/webhooks. Paddle remains
the durable entitlement source, but Premium now controls AI Lab
operations.

Centralize server-side checks:

``` ts
getPremiumEntitlement(userId)
canUseAILab(userId)
```

Never trust client-provided Premium state.

Add first-class navigation:

``` text
LEARN  → AI Academy
CREATE → AI Lab
PLAY   → AI Missions
```

Suggested routes: `/app/lab`, `/app/lab/prompts`, `/prompt-battles`,
`/bots`, `/agents`, `/knowledge`, `/detective`, `/images`, `/vision`,
`/games`, `/missions`, `/escape-rooms`, `/projects`, `/creations`.

## 3. Shared AI runtime

Create provider-independent server modules:

``` text
src/lib/ai/
  provider.ts
  models.ts
  text.ts
  structured.ts
  images.ts
  vision.ts
  moderation.ts
  safety.ts
  energy.ts
  usage.ts
  schemas.ts
  prompts/
```

Business logic must not depend directly on one AI vendor. All
credentials stay server-side.

Child-safety baseline: no arbitrary web/HTTP, email, messaging, shell,
arbitrary code execution, purchases, precise-location tools,
child-provided API keys, public child profiles, public project sharing
or child-to-child messaging. Use strict input/output limits, rate
limits, moderation where appropriate, allowlisted agent tools, validated
arguments and hard execution limits. Never expose private model
chain-of-thought; show only concise action/tool/result summaries.

## 4. AI Energy

Initial configurable allowance: **1000 Energy/month**.

Suggested costs:

  Action                    Energy
  ----------------------- --------
  Prompt Playground              2
  Prompt Battle attempt          3
  Bot message                    2
  Knowledge query                3
  Detective dynamic run          3
  Vision analysis                5
  Image generation              20
  Simple agent run              10
  Complex Agent Mission         15
  AI Game turn                   3

Use an append-only ledger:

``` text
ai_energy_events
id
child_profile_id
event_type
feature
reference_id nullable
amount
idempotency_key UNIQUE
provider_usage_json nullable
created_at
```

Positive: monthly/admin/promo grants and refunds. Negative: usage.

Execution: authenticate → authorize child → verify Premium → validate →
atomically reserve Energy → provider call → safety/validation → persist
→ finalize. Provider failure before usable output refunds/releases
Energy. Prevent negative balances under concurrency. Initial policy:
unused Energy does not roll over; make configurable. Prefer grants
aligned with Paddle billing periods.

## 5. Prompt Playground

Guided real-prompt environment. Visual blocks: **Role, Goal, Context,
Audience, Constraints, Output Format, Example**. Provide **Show actual
prompt**.

Flow: build → run real model → inspect → modify → rerun → compare.

Tables: `prompt_sessions`, `prompt_runs`. Require real server-side model
calls, Energy, safety, rate limiting and bounded history.

## 6. Prompt Battles

Prompt engineering as missions. Example: create a 100--150 word story
containing a dragon, Sofia and a robot, with a happy ending, within
three attempts.

Configuration: title, instructions, requirements JSON, forbidden
elements, max attempts, difficulty, Energy/attempt, XP, status.

Evaluate deterministically first: required/forbidden terms, word count,
item count, headings, schema validity. Use a structured AI judge only
when deterministic evaluation is insufficient.

Tables: `prompt_battles`, `prompt_battle_attempts`. Store prompt,
output, requirement-level evaluation and pass/fail. Award completion XP
once.

## 7. Build-a-Bot

Children create a constrained real chatbot without code.

Fields: name, avatar, role, personality, goal, topic/knowledge, rules,
response style. Server builds a controlled system prompt.

Provide **Show how my bot works** to reveal simplified instructions and
introduce *system prompt*. Provide **Test your bot** with bounded real
chat. Editing rules should visibly change behavior.

Tables: `child_bots`, `bot_conversations`, `bot_messages`. No arbitrary
external tools.

## 8. Mini Agent Builder

Teach: **Goal → choose tool → get result → continue → finish**.

Visual blocks: Mission, Brain, Tools, Knowledge, Memory, Rules, Finish
Condition.

Initial allowlisted tools: `read_clue`, `ask_character`, `inspect_item`,
`search_knowledge`, `check_answer`, `calculate`, `roll_dice`,
`get_game_state`.

Each tool has a strict schema. Each agent has server-side `max_steps`,
`max_tool_calls`, `max_energy`, `allowed_tools`, timeout.

Execution UI shows safe traces such as "Used tool: Read Clue → Result:
It lives in Africa," never hidden reasoning.

Tables: `agent_templates`, `agent_projects`, `agent_project_tools`,
`agent_runs`, `agent_run_steps`.

## 9. Agent Missions

Ready-made games using the generic agent runtime:

-   **Secret Animal:** Ask Question / Read Clue / Check Answer; solve
    within N questions.
-   **Museum Mystery:** Inspect Object / Ask Witness / Read Note /
    Submit Suspect.
-   **Space Repair:** Scan Module / Read Manual / Test Component /
    Repair Component.

Prefer deterministic completion checks. Support seeded variants so
replaying changes the solution.

## 10. Teach Your AI / Knowledge Lab

Teach retrieval/context/RAG through **Knowledge Cards**.

Visual flow:

``` text
Question
→ Find useful knowledge
→ Selected cards
→ Give context to AI
→ Answer
```

Always provide **Which knowledge did the AI use?** and show retrieval
provenance.

Initial retrieval may use PostgreSQL full-text search for small
collections; permit embeddings + pgvector later.

Challenge: "Your AI cannot answer correctly. Add/improve its Knowledge
Cards."

Tables: `knowledge_projects`, `knowledge_cards`, `knowledge_queries`,
`knowledge_retrievals`.

## 11. AI Detective

Teach critical evaluation of AI.

Modes: **Find the Mistake**, **Which Answer Is Better?**, **Missing
Evidence**, **Fix the Answer**.

Never generate arbitrary false claims and assume the app knows they are
false. Assessed challenges must use curated facts, approved sources,
deterministic templates, or structured generation independently verified
before display.

Tables: `detective_challenges`, `detective_attempts`.

## 12. Image Lab

Real image prompting. Builder: Subject, Setting, Style Category,
Composition, Details, Restrictions.

Flow: create prompt → generate → inspect → modify → regenerate →
compare.

Example mission: robot inside a library, holding a red book, at night.

Use stronger image safety. Do not promise perfect automated visual
validation; use deterministic prompt checks and scoped vision evaluation
where necessary.

Tables: `image_projects`, `image_generations`; define asset
retention/deletion.

## 13. Vision Lab

Start with curated platform images. Activities: identify objects,
describe/compare scenes, inspect ambiguity, expose mistakes and
uncertainty.

Flow: curated image → question → real vision model → inspect → compare
with known facts.

Before adding child uploads, implement explicit privacy/storage/deletion
controls. Do not perform sensitive inference about people.

## 14. AI Game Master

Children create bounded AI text adventures.

Builder: World, Hero, Goal, Characters, Rules, Tone, Maximum Turns.

Require structured output such as:

``` json
{"narration":"...","choices":["..."],"stateChanges":{},"missionStatus":"active"}
```

Authoritative state stays server-side. Enforce turn/Energy limits.

Tables: `ai_games`, `ai_game_sessions`, `ai_game_turns`.

## 15. AI Escape Rooms

Combine multiple Lab skills. Example **Escape from Mars**:

1.  Prompting --- extract repair instructions.
2.  Detective --- find unsupported AI statement.
3.  Knowledge --- select useful cards.
4.  Agent --- configure tools/rules.
5.  Final mission --- run the fictional repair workflow.

Compose reusable engines (`prompt_battle`, `detective`, `knowledge`,
`agent_mission`, `image_challenge`) rather than bespoke pages.

Tables: `escape_rooms`, `escape_room_steps`, `escape_room_runs`,
`escape_room_step_attempts`.

## 16. AI Creator Projects / My Creations

Persistent templates:

-   **My AI Tutor:** bot + rules + Knowledge Cards.
-   **My Space Agent:** agent + tools + mission.
-   **My Story Game:** Game Master.
-   **My AI Museum Guide:** bot + retrieval + curated visuals.

Store title, template, configuration, assets, version, completion state
and timestamps. Add private **My Creations** gallery for child and
parent. No public sharing initially.

## 17. AI Missions --- retention layer

Missions orchestrate existing engines; they are not a separate AI
runtime.

Types: Prompt Battle, Agent Mission, Detective, Image Challenge,
Knowledge Challenge, Escape Room, Creator Challenge.

Support database-driven featured missions without deployment:

``` text
featured_missions
id
title
description
feature_type
configuration_json
starts_at
ends_at
xp_reward
achievement_id nullable
status
```

Examples: Halloween Story Bot, AI Detective Mystery, Santa's AI
Assistant. This is the primary reason Premium children return after
static curriculum completion.

## 18. Premium achievements

Data-driven examples: Prompt Apprentice, Prompt Master, Bot Builder,
Agent Engineer, AI Detective, Knowledge Keeper, Image Creator, Escape
Room Solver, AI Creator, Monthly Mission Complete.

Award idempotently. Earned achievements remain visible after
cancellation.

## 19. AI Lab home and Premium gate

Premium Lab home should show Energy, Continue Creating, Create tools,
Challenges, current Featured Mission and My Creations.

Free users may browse selected previews, but paid AI execution requires
Premium.

Suggested gate:

``` text
AI Lab Premium
Build and experiment with real AI.

✓ Real AI prompts
✓ Build your own bots
✓ Create mini agents
✓ Generate images
✓ AI missions and escape rooms
✓ Monthly AI Energy

€14.90/month
[ Unlock AI Lab ]
```

Do not repeatedly interrupt free Academy lessons with upsells.

## 20. Generic AI run observability

Where practical:

``` text
ai_runs
id
child_profile_id
feature
project_id nullable
status
energy_reserved
energy_used
provider
model
input_metadata_json
output_metadata_json
error_code nullable
started_at
completed_at
```

Statuses: pending/running/completed/failed/moderated/canceled. Do not
store secrets or unnecessary raw provider payloads.

## 21. Cost controls

Central configuration must control: monthly Energy, per-feature costs,
max outputs, agent steps/tool calls, game turns, image limits,
child/account rate limits, model per feature, global kill switches and
usage telemetry. Do not scatter constants through components.

## 22. Analytics

Keep existing Academy analytics and add:

`premium_feature_opened`, `ai_run_started/completed/failed`,
`energy_spent/exhausted`, `prompt_playground_run`,
`prompt_battle_started/completed`, `bot_created/tested/edited`,
`agent_created/run`, `agent_mission_completed`,
`knowledge_project_created`, `knowledge_query_run`,
`detective_challenge_completed`, `image_generated`,
`vision_analysis_run`, `game_created/completed`,
`escape_room_started/completed`, `creator_project_created`,
`monthly_mission_completed`.

Measure free→Premium conversion, Lab feature adoption, runs/Premium
child, Energy use, estimated inference cost/subscriber, mission
participation, project creation, retention and churn.

## 23. Parent/Admin changes

Parent dashboard: show subscription state, child's Energy, creations,
missions completed and broad Lab activity. Do not expose private child
conversations/prompts by default without an explicit privacy decision.

Admin CMS: add AI feature config, Energy costs/grants, Prompt Battles,
Agent Missions, Detective challenges, Escape Rooms, Featured Missions,
Premium achievements, feature kill switches and model selection. New
Missions must be publishable without deployment.

## 24. Migration

Preserve users, child profiles, progress, XP, achievements, Paddle
customers/subscriptions.

Migration must: 1. remove subscription gating from Academy; 2.
reinterpret active subscriptions as AI Lab entitlement; 3. initialize
Energy for active Premium users exactly once; 4. avoid duplicate grants;
5. retain all history when subscriptions end; 6. use explicit DB
migrations, not manual production edits.

## 25. Implementation order

1.  **Product migration:** remove Academy paywall; update
    copy/navigation/entitlement semantics.
2.  **AI foundation:** provider abstraction, safety, runs, Energy,
    cost/rate controls.
3.  **Premium MVP:** Prompt Playground + Prompt Battles + Build-a-Bot.
4.  **Agents:** Mini Agent Builder + Agent Missions.
5.  **Knowledge/Critical thinking:** Knowledge Lab + AI Detective.
6.  **Multimodal:** Image Lab + Vision Lab.
7.  **Retention:** AI Missions + Escape Rooms + Monthly Missions +
    achievements.
8.  **Creation platform:** Game Master + Creator Projects + My
    Creations.

## 26. Acceptance scenarios

Primary journey:

``` text
Parent creates free account
→ child completes multiple Academy worlds for free
→ no educational paywall
→ child previews AI Lab
→ parent buys €14.90/month through existing Paddle flow
→ webhook activates Lab entitlement
→ Energy grant occurs exactly once
→ child runs a real Prompt Playground request
→ Energy decreases correctly
→ child completes Prompt Battle and earns XP
→ child builds/tests a bot
→ child later receives a fresh AI Mission
→ all Academy progress remains intact
```

Cancellation:

``` text
subscription ends
→ Academy remains fully accessible
→ new AI Lab execution is locked
→ existing creations/progress/achievements remain visible
→ resubscription restores Lab execution
```

## 27. Engineering rules

-   Treat this as a **delta to implemented V1**, not a greenfield
    rewrite.
-   Reuse existing auth, child profiles, Academy, progress,
    gamification, admin and Paddle code.
-   Keep AI operations server-side and schema-validated.
-   Calculate Energy/XP server-side.
-   Make billing, Energy and rewards idempotent.
-   Use DB constraints/transactions for invariants.
-   Keep Premium feature definitions/configuration data-driven.
-   Prefer deterministic evaluation over AI-as-judge.
-   Never use hidden chain-of-thought as learner-facing content.
-   Add unit/integration/E2E tests for each new business rule.

## 28. Definition of Done for v2

v2 is ready for private beta when:

-   every Academy lesson/quiz is free;
-   existing progress is preserved;
-   existing Paddle Premium activates AI Lab;
-   Energy grants/usage/refunds are correct and idempotent;
-   Prompt Playground works with a real model;
-   Prompt Battles evaluate correctly;
-   Build-a-Bot works end-to-end;
-   Mini Agent Builder uses only validated allowlisted tools;
-   at least one Agent Mission works;
-   Knowledge Lab shows retrieval provenance;
-   AI Detective uses verified ground truth;
-   Image/Vision safety controls exist before launch of those modules;
-   at least one Escape Room composes reusable engines;
-   Monthly Missions can be published without deploy;
-   My Creations is private;
-   cost/rate kill switches exist;
-   cancellation never removes free learning or historical progress;
-   critical E2E tests pass on Vercel preview/production-like
    environment.
