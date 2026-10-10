CREATE TABLE "ai_energy_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"user_id" uuid,
	"school_id" uuid,
	"child_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "energy_account_owner" CHECK (("ai_energy_accounts"."kind"='family' and "ai_energy_accounts"."user_id" is not null and "ai_energy_accounts"."school_id" is null and "ai_energy_accounts"."child_profile_id" is null) or ("ai_energy_accounts"."kind"='school' and "ai_energy_accounts"."user_id" is null and "ai_energy_accounts"."school_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "school_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"reference_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"teacher_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"seats" integer NOT NULL,
	"monthly_energy" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "school_contract_dates" CHECK ("school_contracts"."ends_at" > "school_contracts"."starts_at"),
	CONSTRAINT "school_contract_limits" CHECK ("school_contracts"."seats" between 1 and 10000 and "school_contracts"."monthly_energy" between 1 and 10000),
	CONSTRAINT "school_contract_status" CHECK ("school_contracts"."status" in ('draft','active','suspended'))
);
--> statement-breakpoint
CREATE TABLE "school_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"child_profile_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	CONSTRAINT "school_enrollment_status" CHECK ("school_enrollments"."status" in ('active','left'))
);
--> statement-breakpoint
CREATE TABLE "school_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"batch_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"enrollment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"redeemed_at" timestamp with time zone,
	CONSTRAINT "school_invites_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "school_invite_status" CHECK ("school_invites"."status" in ('pending','redeemed','revoked'))
);
--> statement-breakpoint
CREATE TABLE "school_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "school_staff_role" CHECK ("school_memberships"."role" in ('manager','teacher')),
	CONSTRAINT "school_staff_active" CHECK ("school_memberships"."active" in (0,1))
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "school_status" CHECK ("schools"."status" in ('active','suspended'))
);
--> statement-breakpoint
ALTER TABLE "ai_energy_events" DROP CONSTRAINT "ai_energy_events_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "ai_energy_periods" DROP CONSTRAINT "ai_energy_periods_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "energy_period_once";--> statement-breakpoint
ALTER TABLE "ai_energy_events" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_energy_periods" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_energy_periods" ALTER COLUMN "subscription_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "child_profiles" ADD COLUMN "energy_preference" text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_energy_periods" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_energy_periods" ADD COLUMN "school_contract_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_energy_periods" ADD COLUMN "allowance" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_energy_accounts" ADD CONSTRAINT "ai_energy_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_energy_accounts" ADD CONSTRAINT "ai_energy_accounts_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_energy_accounts" ADD CONSTRAINT "ai_energy_accounts_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_audit" ADD CONSTRAINT "school_audit_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_audit" ADD CONSTRAINT "school_audit_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_classes" ADD CONSTRAINT "school_classes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_classes" ADD CONSTRAINT "school_classes_teacher_membership_id_school_memberships_id_fk" FOREIGN KEY ("teacher_membership_id") REFERENCES "public"."school_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_contracts" ADD CONSTRAINT "school_contracts_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_enrollments" ADD CONSTRAINT "school_enrollments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_enrollments" ADD CONSTRAINT "school_enrollments_class_id_school_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."school_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_enrollments" ADD CONSTRAINT "school_enrollments_child_profile_id_child_profiles_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_invites" ADD CONSTRAINT "school_invites_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_invites" ADD CONSTRAINT "school_invites_class_id_school_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."school_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_invites" ADD CONSTRAINT "school_invites_enrollment_id_school_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."school_enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_memberships" ADD CONSTRAINT "school_memberships_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "family_energy_account_once" ON "ai_energy_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "school_energy_account_once" ON "ai_energy_accounts" USING btree ("school_id","child_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "school_class_name_once" ON "school_classes" USING btree ("school_id","name");--> statement-breakpoint
CREATE INDEX "school_contract_lookup" ON "school_contracts" USING btree ("school_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "school_child_once" ON "school_enrollments" USING btree ("school_id","child_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "school_child_active_once" ON "school_enrollments" USING btree ("child_profile_id") WHERE "school_enrollments"."status" = 'active';--> statement-breakpoint
CREATE INDEX "school_invite_seats" ON "school_invites" USING btree ("school_id","status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "school_staff_email_once" ON "school_memberships" USING btree ("school_id","email");--> statement-breakpoint
ALTER TABLE "ai_energy_events" ADD CONSTRAINT "ai_energy_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_energy_periods" ADD CONSTRAINT "ai_energy_periods_account_id_ai_energy_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ai_energy_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_energy_periods" ADD CONSTRAINT "ai_energy_periods_school_contract_id_school_contracts_id_fk" FOREIGN KEY ("school_contract_id") REFERENCES "public"."school_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_energy_periods" ADD CONSTRAINT "ai_energy_periods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "energy_period_once" ON "ai_energy_periods" USING btree ("account_id","starts_at");
--> statement-breakpoint
INSERT INTO ai_energy_accounts(kind,user_id) SELECT DISTINCT 'family',user_id FROM ai_energy_periods WHERE user_id IS NOT NULL ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE ai_energy_periods p SET account_id=a.id FROM ai_energy_accounts a WHERE a.kind='family' AND a.user_id=p.user_id;
--> statement-breakpoint
ALTER TABLE ai_energy_periods ALTER COLUMN account_id SET NOT NULL;
--> statement-breakpoint
-- Account deletion both anonymizes school rows and cascades family rows.
-- Check these references after all cascading actions have finished, so transient
-- SET NULL updates cannot observe a family period/account already being removed.
ALTER TABLE ai_energy_events ALTER CONSTRAINT ai_energy_events_period_id_ai_energy_periods_id_fk DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE ai_energy_periods ALTER CONSTRAINT ai_energy_periods_account_id_ai_energy_accounts_id_fk DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_energy_ledger() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF (to_jsonb(NEW) - 'child_profile_id' - 'user_id') IS DISTINCT FROM (to_jsonb(OLD) - 'child_profile_id' - 'user_id') OR (NEW.child_profile_id IS NOT NULL AND NEW.child_profile_id IS DISTINCT FROM OLD.child_profile_id) OR (NEW.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
  RAISE EXCEPTION 'Energy ledger entries are immutable';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
DO $$ DECLARE table_name text; role_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['schools','school_contracts','school_memberships','school_classes','school_enrollments','school_invites','school_audit','ai_energy_accounts'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',table_name,role_name); END IF;
  END LOOP;
 END LOOP;
END $$;
