-- All application data is accessed through authorized server handlers using
-- the database owner connection. Supabase's browser API gets no table policies.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users', 'child_profiles', 'tracks', 'worlds', 'lessons', 'lesson_versions',
    'lesson_progress', 'quiz_attempts', 'quiz_answers', 'xp_events', 'levels',
    'achievements', 'child_achievements', 'subscriptions', 'checkout_sessions',
    'payment_webhook_events', 'analytics_events', 'rate_limits'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', table_name);
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', table_name);
    END IF;
  END LOOP;
  -- Supabase account deletion also deletes application data atomically.
  -- Conditional so migrations/tests remain compatible with plain PostgreSQL.
  IF to_regclass('auth.users') IS NOT NULL THEN
    ALTER TABLE public.users ADD CONSTRAINT users_auth_user_fk
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
