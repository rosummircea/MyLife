-- Requires a Vault secret named mylife_cron_secret with the same value as
-- Vercel's CRON_SECRET. The longer timeout covers all linked bank sessions.
select cron.schedule(
  'refresh-enable-banking-every-4-hours',
  '0 */4 * * *',
  $$
    select net.http_post(
      url := 'https://my-life-sable.vercel.app/api/cron/enable-banking-refresh',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'mylife_cron_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $$
);
