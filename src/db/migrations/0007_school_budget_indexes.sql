CREATE INDEX "energy_period_event_idx" ON "ai_energy_events" USING btree ("period_id","event_type");--> statement-breakpoint
CREATE INDEX "energy_school_period_idx" ON "ai_energy_periods" USING btree ("school_contract_id","starts_at");--> statement-breakpoint
CREATE INDEX "school_invite_batch_idx" ON "school_invites" USING btree ("batch_id");