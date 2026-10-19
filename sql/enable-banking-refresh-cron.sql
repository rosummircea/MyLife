-- Requires a Vault secret named mylife_cron_secret with the same value as
-- Vercel's CRON_SECRET. Each run refreshes only the oldest due connection,
-- which staggers providers and prevents one slow bank from blocking the rest.
select cron.unschedule('refresh-enable-banking-every-4-hours')
where exists(select 1 from cron.job where jobname='refresh-enable-banking-every-4-hours');
select cron.unschedule('refresh-enable-banking-every-6-hours')
where exists(select 1 from cron.job where jobname='refresh-enable-banking-every-6-hours');
select cron.unschedule('refresh-enable-banking-staggered')
where exists(select 1 from cron.job where jobname='refresh-enable-banking-staggered');

select cron.schedule(
  'refresh-enable-banking-staggered',
  '*/15 * * * *',
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
      timeout_milliseconds := 175000
    );
  $$
);
