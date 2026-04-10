-- Run ALL of this at once in the Supabase SQL Editor
-- Make sure pg_cron and pg_net extensions are enabled first

SELECT cron.schedule(
  'fenowa-push-morning',
  '0 8 * * *',
  'SELECT net.http_post(url:=''https://lwxbmjplykpcneirfpyy.supabase.co/functions/v1/send-push-notifications'', headers:=''{\"Content-Type\":\"application/json\",\"Authorization\":\"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3eGJtanBseWtwY25laXJmcHl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2OTY3MzAsImV4cCI6MjA4MzI3MjczMH0.JuwbPPlSI5w_C6XUte_il3cb9fTatcCOjB23khQy6JQ\"}''::jsonb, body:=''{}''::jsonb);'
);

SELECT cron.schedule(
  'fenowa-push-noon',
  '0 12 * * *',
  'SELECT net.http_post(url:=''https://lwxbmjplykpcneirfpyy.supabase.co/functions/v1/send-push-notifications'', headers:=''{\"Content-Type\":\"application/json\",\"Authorization\":\"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3eGJtanBseWtwY25laXJmcHl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2OTY3MzAsImV4cCI6MjA4MzI3MjczMH0.JuwbPPlSI5w_C6XUte_il3cb9fTatcCOjB23khQy6JQ\"}''::jsonb, body:=''{}''::jsonb);'
);

SELECT cron.schedule(
  'fenowa-push-afternoon',
  '0 13 * * *',
  'SELECT net.http_post(url:=''https://lwxbmjplykpcneirfpyy.supabase.co/functions/v1/send-push-notifications'', headers:=''{\"Content-Type\":\"application/json\",\"Authorization\":\"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3eGJtanBseWtwY25laXJmcHl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2OTY3MzAsImV4cCI6MjA4MzI3MjczMH0.JuwbPPlSI5w_C6XUte_il3cb9fTatcCOjB23khQy6JQ\"}''::jsonb, body:=''{}''::jsonb);'
);

SELECT cron.schedule(
  'fenowa-push-evening',
  '0 20 * * *',
  'SELECT net.http_post(url:=''https://lwxbmjplykpcneirfpyy.supabase.co/functions/v1/send-push-notifications'', headers:=''{\"Content-Type\":\"application/json\",\"Authorization\":\"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3eGJtanBseWtwY25laXJmcHl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2OTY3MzAsImV4cCI6MjA4MzI3MjczMH0.JuwbPPlSI5w_C6XUte_il3cb9fTatcCOjB23khQy6JQ\"}''::jsonb, body:=''{}''::jsonb);'
);

-- Verify all 4 jobs are scheduled:
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname LIKE 'fenowa-%';
