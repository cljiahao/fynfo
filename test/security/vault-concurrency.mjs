export async function runVaultConcurrency(fixture) {
  const userId = '78000000-0000-4000-8000-000000000001';
  await fixture.sql(`INSERT INTO auth.users(id) VALUES ('${userId}');`);
  try {
    const queries = Array.from(
      { length: 6 },
      () =>
        `BEGIN; SET LOCAL ROLE service_role; SELECT public.reserve_vault_unlock('${userId}'); SELECT pg_sleep(1); COMMIT;`
    );
    const results = await fixture.concurrent(queries, {
      expectedSuccesses: 6,
      observeQuery: 'reserve_vault_unlock',
    });
    const tokens = results.flatMap(
      ({ stdout }) =>
        stdout.match(
          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g
        ) ?? []
    );
    if (tokens.length !== 5 || new Set(tokens).size !== 5)
      throw new Error(
        'Concurrent vault attempts exceeded the five-slot budget'
      );
    await fixture.sql(`DO $$ BEGIN
      IF (SELECT count(*) FROM public.vault_unlock_reservations WHERE user_id='${userId}') <> 5 THEN RAISE EXCEPTION 'reservation budget'; END IF;
    END $$;
    UPDATE public.vault_unlock_reservations SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id='${userId}';
    SET ROLE service_role;
    DO $$ BEGIN
      IF public.reserve_vault_unlock('${userId}') IS NOT NULL THEN RAISE EXCEPTION 'abandoned attempts bypassed lockout'; END IF;
    END $$;
    RESET ROLE;
    DO $$ BEGIN
      IF (SELECT fail_count FROM public.vault_unlock_attempts WHERE user_id='${userId}') <> 5 THEN RAISE EXCEPTION 'expired attempts not charged'; END IF;
    END $$;
    UPDATE public.vault_unlock_attempts SET window_start=clock_timestamp()-interval '16 minutes',locked_until=clock_timestamp()-interval '1 second' WHERE user_id='${userId}';
    SET ROLE service_role;
    DO $$ DECLARE token uuid; BEGIN
      token := public.reserve_vault_unlock('${userId}');
      IF token IS NULL THEN RAISE EXCEPTION 'elapsed lockout did not recover'; END IF;
      PERFORM public.finish_vault_unlock('${userId}',token,true);
      BEGIN
        PERFORM public.finish_vault_unlock('${userId}',token,true);
        RAISE EXCEPTION 'consumed token replay accepted';
      EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'invalid attempt' THEN RAISE; END IF;
      END;
    END $$;
    RESET ROLE;`);
    await fixture.sql(`SET ROLE service_role;
    DO $$ DECLARE first_token uuid; pending_token uuid; BEGIN
      first_token := public.reserve_vault_unlock('${userId}');
      pending_token := public.reserve_vault_unlock('${userId}');
      IF first_token IS NULL OR pending_token IS NULL THEN RAISE EXCEPTION 'fresh reservations missing'; END IF;
      PERFORM public.finish_vault_unlock('${userId}',first_token,true);
      PERFORM public.finish_vault_unlock('${userId}',pending_token,false);
    END $$;
    RESET ROLE;
    DO $$ BEGIN
      IF (SELECT fail_count FROM public.vault_unlock_attempts WHERE user_id='${userId}') <> 1 THEN RAISE EXCEPTION 'success erased pending failure'; END IF;
      IF EXISTS (SELECT 1 FROM public.vault_unlock_reservations WHERE user_id='${userId}') THEN RAISE EXCEPTION 'finished reservation retained'; END IF;
    END $$;`);
    const reserved = await fixture.sql(
      `SET ROLE service_role; SELECT public.reserve_vault_unlock('${userId}');`
    );
    const deadlineToken = reserved.stdout.trim();
    if (!/^[0-9a-f-]{36}$/.test(deadlineToken))
      throw new Error('Deadline fixture reservation missing');
    await fixture.sql(`UPDATE public.vault_unlock_reservations SET expires_at=clock_timestamp()-interval '1 second' WHERE id='${deadlineToken}';
    SET ROLE service_role;
    DO $$ BEGIN
      BEGIN
        PERFORM public.finish_vault_unlock('${userId}','${deadlineToken}',true);
        RAISE EXCEPTION 'expired success token accepted';
      EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'invalid attempt' THEN RAISE; END IF;
      END;
    END $$;
    RESET ROLE;
    DO $$ BEGIN
      IF (SELECT fail_count FROM public.vault_unlock_attempts WHERE user_id='${userId}') <> 1 THEN RAISE EXCEPTION 'expired success reset failures'; END IF;
    END $$;
    SET ROLE service_role;
    SELECT public.reserve_vault_unlock('${userId}');
    RESET ROLE;
    DO $$ BEGIN
      IF (SELECT fail_count FROM public.vault_unlock_attempts WHERE user_id='${userId}') <> 2 THEN RAISE EXCEPTION 'expired completion not charged on admission'; END IF;
    END $$;`);
  } finally {
    await fixture.sql(`DELETE FROM auth.users WHERE id='${userId}';`);
  }
}
