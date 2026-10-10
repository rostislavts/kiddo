-- The previous deployment may create family periods while Vercel builds the
-- school release. Preserve its INSERT shape without relaxing account ownership.
-- New application writes supply account_id explicitly and skip this branch.
CREATE FUNCTION initialize_legacy_energy_account() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.account_id IS NULL AND NEW.user_id IS NOT NULL AND NEW.school_contract_id IS NULL THEN
  INSERT INTO ai_energy_accounts(kind,user_id) VALUES ('family',NEW.user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT id INTO NEW.account_id FROM ai_energy_accounts WHERE kind='family' AND user_id=NEW.user_id;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER legacy_family_energy_account BEFORE INSERT ON ai_energy_periods FOR EACH ROW EXECUTE FUNCTION initialize_legacy_energy_account();
