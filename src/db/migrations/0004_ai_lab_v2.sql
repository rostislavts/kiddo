CREATE TABLE "agent_project_tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"tool" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_run_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"step" integer NOT NULL,
	"tool" text NOT NULL,
	"arguments_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_energy_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"child_profile_id" uuid,
	"period_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"feature" text NOT NULL,
	"reference_id" uuid,
	"amount" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"provider_usage_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_energy_events_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "ai_energy_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subscription_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "energy_period_dates" CHECK ("ai_energy_periods"."ends_at" > "ai_energy_periods"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "ai_game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_profile_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"turn" integer DEFAULT 0 NOT NULL,
	"state_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_game_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"turn" integer NOT NULL,
	"choice" text NOT NULL,
	"narration" text NOT NULL,
	"choices_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_profile_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"feature" text NOT NULL,
	"request_key" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"energy_reserved" integer NOT NULL,
	"energy_used" integer DEFAULT 0 NOT NULL,
	"period_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output_metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_code" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ai_run_energy_nonnegative" CHECK ("ai_runs"."energy_reserved" >= 0 and "ai_runs"."energy_used" >= 0),
	CONSTRAINT "ai_run_status" CHECK ("ai_runs"."status" in ('pending','running','completed','failed','moderated','canceled'))
);
--> statement-breakpoint
CREATE TABLE "ai_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"configuration_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_profile_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escape_room_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_profile_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escape_room_step_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escape_room_run_id" uuid NOT NULL,
	"step_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escape_room_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"challenge_id" uuid NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "featured_missions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"feature_type" text NOT NULL,
	"challenge_id" uuid NOT NULL,
	"configuration_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"xp_reward" integer DEFAULT 50 NOT NULL,
	"achievement_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "featured_dates" CHECK ("featured_missions"."ends_at" > "featured_missions"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "knowledge_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_retrievals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"card_id" uuid,
	"card_title" text NOT NULL,
	"excerpt" text NOT NULL,
	"rank" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_profile_id" uuid NOT NULL,
	"project_id" uuid,
	"run_id" uuid NOT NULL,
	"mime" text NOT NULL,
	"base64" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_profile_id" uuid NOT NULL,
	"challenge_id" uuid NOT NULL,
	"run_id" uuid,
	"attempt_number" integer NOT NULL,
	"configuration_version" integer NOT NULL,
	"input_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"evaluation_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"passed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"feature_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"configuration_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"xp_reward" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lab_challenges_slug_unique" UNIQUE("slug"),
	CONSTRAINT "lab_challenge_status" CHECK ("lab_challenges"."status" in ('draft','published','archived')),
	CONSTRAINT "lab_challenge_xp" CHECK ("lab_challenges"."xp_reward" between 0 and 1000)
);
--> statement-breakpoint
CREATE TABLE "lab_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_profile_id" uuid NOT NULL,
	"feature" text NOT NULL,
	"title" text NOT NULL,
	"configuration_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"completion_state" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mission_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_profile_id" uuid NOT NULL,
	"mission_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_project_tools" ADD CONSTRAINT "agent_project_tools_project_id_lab_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."lab_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_run_steps" ADD CONSTRAINT "agent_run_steps_run_id_ai_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_energy_events" ADD CONSTRAINT "ai_energy_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_energy_events" ADD CONSTRAINT "ai_energy_events_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_energy_events" ADD CONSTRAINT "ai_energy_events_period_id_ai_energy_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."ai_energy_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_energy_periods" ADD CONSTRAINT "ai_energy_periods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_game_sessions" ADD CONSTRAINT "ai_game_sessions_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_game_sessions" ADD CONSTRAINT "ai_game_sessions_project_id_lab_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."lab_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_game_turns" ADD CONSTRAINT "ai_game_turns_session_id_ai_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."ai_game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_game_turns" ADD CONSTRAINT "ai_game_turns_run_id_ai_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_project_id_lab_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."lab_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_period_id_ai_energy_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."ai_energy_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_conversations" ADD CONSTRAINT "bot_conversations_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_conversations" ADD CONSTRAINT "bot_conversations_project_id_lab_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."lab_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_messages" ADD CONSTRAINT "bot_messages_conversation_id_bot_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."bot_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_messages" ADD CONSTRAINT "bot_messages_run_id_ai_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escape_room_runs" ADD CONSTRAINT "escape_room_runs_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escape_room_runs" ADD CONSTRAINT "escape_room_runs_room_id_lab_challenges_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."lab_challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escape_room_step_attempts" ADD CONSTRAINT "escape_room_step_attempts_escape_room_run_id_escape_room_runs_id_fk" FOREIGN KEY ("escape_room_run_id") REFERENCES "public"."escape_room_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escape_room_step_attempts" ADD CONSTRAINT "escape_room_step_attempts_step_id_escape_room_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."escape_room_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escape_room_step_attempts" ADD CONSTRAINT "escape_room_step_attempts_attempt_id_lab_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."lab_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escape_room_steps" ADD CONSTRAINT "escape_room_steps_room_id_lab_challenges_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."lab_challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escape_room_steps" ADD CONSTRAINT "escape_room_steps_challenge_id_lab_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."lab_challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "featured_missions" ADD CONSTRAINT "featured_missions_challenge_id_lab_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."lab_challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "featured_missions" ADD CONSTRAINT "featured_missions_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_cards" ADD CONSTRAINT "knowledge_cards_project_id_lab_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."lab_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_retrievals" ADD CONSTRAINT "knowledge_retrievals_run_id_ai_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_retrievals" ADD CONSTRAINT "knowledge_retrievals_card_id_knowledge_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."knowledge_cards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_assets" ADD CONSTRAINT "lab_assets_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_assets" ADD CONSTRAINT "lab_assets_project_id_lab_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."lab_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_assets" ADD CONSTRAINT "lab_assets_run_id_ai_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_attempts" ADD CONSTRAINT "lab_attempts_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_attempts" ADD CONSTRAINT "lab_attempts_challenge_id_lab_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."lab_challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_attempts" ADD CONSTRAINT "lab_attempts_run_id_ai_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_projects" ADD CONSTRAINT "lab_projects_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_completions" ADD CONSTRAINT "mission_completions_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_completions" ADD CONSTRAINT "mission_completions_mission_id_featured_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."featured_missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_tool_once" ON "agent_project_tools" USING btree ("project_id","tool");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_step_once" ON "agent_run_steps" USING btree ("run_id","step");--> statement-breakpoint
CREATE INDEX "energy_account_period_idx" ON "ai_energy_events" USING btree ("user_id","period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "energy_period_once" ON "ai_energy_periods" USING btree ("user_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "game_session_project" ON "ai_game_sessions" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_turn_once" ON "ai_game_turns" USING btree ("session_id","turn");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_request_once" ON "ai_runs" USING btree ("user_id","request_key");--> statement-breakpoint
CREATE INDEX "ai_runs_child_idx" ON "ai_runs" USING btree ("child_profile_id","started_at");--> statement-breakpoint
CREATE INDEX "ai_runs_recovery_idx" ON "ai_runs" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "one_bot_conversation" ON "bot_conversations" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bot_message_once" ON "bot_messages" USING btree ("run_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "escape_child_room_once" ON "escape_room_runs" USING btree ("child_profile_id","room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "escape_step_credit_once" ON "escape_room_step_attempts" USING btree ("escape_room_run_id","step_id");--> statement-breakpoint
CREATE UNIQUE INDEX "escape_step_position" ON "escape_room_steps" USING btree ("room_id","position");--> statement-breakpoint
CREATE INDEX "knowledge_project_idx" ON "knowledge_cards" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "retrieval_run_idx" ON "knowledge_retrievals" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "lab_asset_expiry_idx" ON "lab_assets" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lab_attempt_number_once" ON "lab_attempts" USING btree ("child_profile_id","challenge_id","attempt_number");--> statement-breakpoint
CREATE INDEX "lab_project_child_idx" ON "lab_projects" USING btree ("child_profile_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mission_completion_once" ON "mission_completions" USING btree ("child_profile_id","mission_id");
--> statement-breakpoint
ALTER TABLE "agent_project_tools" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "agent_run_steps" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_energy_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_energy_periods" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_game_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_game_turns" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "bot_conversations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "bot_messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "escape_room_runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "escape_room_step_attempts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "escape_room_steps" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "featured_missions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "knowledge_cards" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "knowledge_retrievals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "lab_assets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "lab_attempts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "lab_challenges" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "lab_projects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mission_completions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
   EXECUTE format('REVOKE ALL ON TABLE public.agent_project_tools FROM %I', role_name);
   EXECUTE format('REVOKE ALL ON TABLE public.agent_run_steps FROM %I', role_name);
   EXECUTE format('REVOKE ALL ON TABLE public.ai_energy_events FROM %I', role_name);
   EXECUTE format('REVOKE ALL ON TABLE public.ai_energy_periods FROM %I', role_name);
   EXECUTE format('REVOKE ALL ON TABLE public.ai_game_sessions FROM %I', role_name);
   EXECUTE format('REVOKE ALL ON TABLE public.ai_game_turns FROM %I', role_name);
   EXECUTE format('REVOKE ALL ON TABLE public.ai_runs FROM %I', role_name);
   EXECUTE format('REVOKE ALL ON TABLE public.ai_settings FROM %I', role_name);
   EXECUTE format('REVOKE ALL ON TABLE public.bot_conversations FROM %I', role_name);
   EXECUTE format('REVOKE ALL ON TABLE public.bot_messages FROM %I', role_name);
   EXECUTE format('REVOKE ALL ON TABLE public.escape_room_runs FROM %I', role_name);
   EXECUTE format('REVOKE ALL ON TABLE public.escape_room_step_attempts FROM %I', role_name);
   EXECUTE format('REVOKE ALL ON TABLE public.escape_room_steps FROM %I', role_name);
   EXECUTE format('REVOKE ALL ON TABLE public.featured_missions FROM %I', role_name);
   EXECUTE format('REVOKE ALL ON TABLE public.knowledge_cards FROM %I', role_name);
   EXECUTE format('REVOKE ALL ON TABLE public.knowledge_retrievals FROM %I', role_name);
   EXECUTE format('REVOKE ALL ON TABLE public.lab_assets FROM %I', role_name);
   EXECUTE format('REVOKE ALL ON TABLE public.lab_attempts FROM %I', role_name);
   EXECUTE format('REVOKE ALL ON TABLE public.lab_challenges FROM %I', role_name);
   EXECUTE format('REVOKE ALL ON TABLE public.lab_projects FROM %I', role_name);
   EXECUTE format('REVOKE ALL ON TABLE public.mission_completions FROM %I', role_name);
  END IF;
 END LOOP;
END $$;
--> statement-breakpoint
CREATE INDEX knowledge_cards_search_idx ON knowledge_cards USING gin (to_tsvector('simple', title || ' ' || content));
--> statement-breakpoint
CREATE FUNCTION protect_energy_ledger() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF (to_jsonb(NEW) - 'child_profile_id') IS DISTINCT FROM (to_jsonb(OLD) - 'child_profile_id') OR (NEW.child_profile_id IS NOT NULL AND NEW.child_profile_id IS DISTINCT FROM OLD.child_profile_id) THEN
  RAISE EXCEPTION 'Energy ledger entries are immutable';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER energy_events_immutable BEFORE UPDATE ON ai_energy_events FOR EACH ROW EXECUTE FUNCTION protect_energy_ledger();

--> statement-breakpoint
CREATE VIEW prompt_sessions WITH (security_invoker = true) AS SELECT * FROM lab_projects WHERE feature = 'prompts';

--> statement-breakpoint
CREATE VIEW prompt_runs WITH (security_invoker = true) AS SELECT * FROM ai_runs WHERE feature = 'prompts';

--> statement-breakpoint
CREATE VIEW prompt_battles WITH (security_invoker = true) AS SELECT * FROM lab_challenges WHERE feature_type = 'prompt-battles';

--> statement-breakpoint
CREATE VIEW prompt_battle_attempts WITH (security_invoker = true) AS SELECT * FROM lab_attempts WHERE challenge_id IN (SELECT id FROM lab_challenges WHERE feature_type = 'prompt-battles');

--> statement-breakpoint
CREATE VIEW child_bots WITH (security_invoker = true) AS SELECT * FROM lab_projects WHERE feature = 'bots';

--> statement-breakpoint
CREATE VIEW agent_templates WITH (security_invoker = true) AS SELECT * FROM lab_challenges WHERE feature_type = 'agent-missions';

--> statement-breakpoint
CREATE VIEW agent_projects WITH (security_invoker = true) AS SELECT * FROM lab_projects WHERE feature = 'agents';

--> statement-breakpoint
CREATE VIEW agent_runs WITH (security_invoker = true) AS SELECT * FROM ai_runs WHERE feature IN ('agents','agent-missions');

--> statement-breakpoint
CREATE VIEW knowledge_projects WITH (security_invoker = true) AS SELECT * FROM lab_projects WHERE feature = 'knowledge';

--> statement-breakpoint
CREATE VIEW knowledge_queries WITH (security_invoker = true) AS SELECT * FROM ai_runs WHERE feature = 'knowledge';

--> statement-breakpoint
CREATE VIEW detective_challenges WITH (security_invoker = true) AS SELECT * FROM lab_challenges WHERE feature_type = 'detective';

--> statement-breakpoint
CREATE VIEW detective_attempts WITH (security_invoker = true) AS SELECT * FROM lab_attempts WHERE challenge_id IN (SELECT id FROM lab_challenges WHERE feature_type = 'detective');

--> statement-breakpoint
CREATE VIEW image_projects WITH (security_invoker = true) AS SELECT * FROM lab_projects WHERE feature = 'images';

--> statement-breakpoint
CREATE VIEW image_generations WITH (security_invoker = true) AS SELECT * FROM ai_runs WHERE feature = 'images';

--> statement-breakpoint
CREATE VIEW ai_games WITH (security_invoker = true) AS SELECT * FROM lab_projects WHERE feature = 'games';

--> statement-breakpoint
CREATE VIEW escape_rooms WITH (security_invoker = true) AS SELECT * FROM lab_challenges WHERE feature_type = 'escape-rooms';

--> statement-breakpoint
CREATE VIEW creator_projects WITH (security_invoker = true) AS SELECT * FROM lab_projects WHERE feature = 'projects';
