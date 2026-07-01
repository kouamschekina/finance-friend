-- ─────────────────────────────────────────────────────────────────────────────
-- Fenowa Push Notification Cron Jobs
-- Run this entire script in the Supabase SQL Editor
--
-- Prerequisites:
--   1. Go to Database → Extensions → enable "pg_cron" and "pg_net"
--   2. Deploy the Edge Function with: supabase functions deploy send-push-notifications
--   3. Set CRON_SECRET in Edge Function secrets (Supabase Dashboard →
--      Edge Functions → send-push-notifications → Secrets)
--      Use any random string, e.g.: openssl rand -hex 32
--   4. Replace YOUR_CRON_SECRET below with that same value
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop existing jobs first (safe to re-run)
DO $$
BEGIN
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname LIKE 'fenowa-push-%';
END $$;

-- ── Schedule 3 daily reminders (times in UTC) ─────────────────────────────────
-- WAT = UTC+1, so adjust: 8am WAT = 7am UTC, 1pm WAT = 12pm UTC, 8pm WAT = 7pm UTC

SELECT cron.schedule(
  'fenowa-push-morning',
  '0 7 * * *',
  $cmd$
  SELECT net.http_post(
    url     := 'https://lwxbmjplykpcneirfpyy.supabase.co/functions/v1/send-push-notifications',
    headers := '{"Content-Type":"application/json","x-cron-secret":"YOUR_CRON_SECRET"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $cmd$
);

SELECT cron.schedule(
  'fenowa-push-midday',
  '0 12 * * *',
  $cmd$
  SELECT net.http_post(
    url     := 'https://lwxbmjplykpcneirfpyy.supabase.co/functions/v1/send-push-notifications',
    headers := '{"Content-Type":"application/json","x-cron-secret":"YOUR_CRON_SECRET"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $cmd$
);

SELECT cron.schedule(
  'fenowa-push-evening',
  '0 19 * * *',
  $cmd$
  SELECT net.http_post(
    url     := 'https://lwxbmjplykpcneirfpyy.supabase.co/functions/v1/send-push-notifications',
    headers := '{"Content-Type":"application/json","x-cron-secret":"YOUR_CRON_SECRET"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $cmd$
);

-- Verify
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname LIKE 'fenowa-%';

-- ── To check recent execution logs: ──────────────────────────────────────────
-- SELECT * FROM cron.job_run_details WHERE jobid IN (
--   SELECT jobid FROM cron.job WHERE jobname LIKE 'fenowa-%'
-- ) ORDER BY start_time DESC LIMIT 20;

-- ── To manually test right now (runs immediately): ───────────────────────────
-- SELECT net.http_post(
--   url     := 'https://lwxbmjplykpcneirfpyy.supabase.co/functions/v1/send-push-notifications',
--   headers := '{"Content-Type":"application/json","x-cron-secret":"YOUR_CRON_SECRET"}'::jsonb,
--   body    := '{}'::jsonb
-- );
