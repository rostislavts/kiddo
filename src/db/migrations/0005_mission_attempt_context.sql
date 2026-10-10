ALTER TABLE "lab_attempts" DROP CONSTRAINT "lab_attempts_run_id_ai_runs_id_fk";
--> statement-breakpoint
DROP INDEX "lab_attempt_number_once";--> statement-breakpoint
ALTER TABLE "lab_attempts" ADD COLUMN "context_key" text DEFAULT 'challenge' NOT NULL;--> statement-breakpoint
ALTER TABLE "lab_attempts" ADD CONSTRAINT "lab_attempts_run_id_ai_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lab_attempt_number_once" ON "lab_attempts" USING btree ("child_profile_id","challenge_id","context_key","attempt_number");
--> statement-breakpoint
UPDATE lab_attempts SET context_key = 'challenge:v' || configuration_version::text;
--> statement-breakpoint
CREATE OR REPLACE VIEW prompt_battle_attempts WITH (security_invoker = true) AS SELECT * FROM lab_attempts WHERE challenge_id IN (SELECT id FROM lab_challenges WHERE feature_type = 'prompt-battles');
--> statement-breakpoint
CREATE OR REPLACE VIEW detective_attempts WITH (security_invoker = true) AS SELECT * FROM lab_attempts WHERE challenge_id IN (SELECT id FROM lab_challenges WHERE feature_type = 'detective');
