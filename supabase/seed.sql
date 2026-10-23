-- Local test stack only (spec 129). Applied by `pnpm db:reset`.
-- These values exist only on the local Supabase stack. They are not valid on
-- the hosted project and must never be reused for a real account.
--   email:    test@fynfo.test
--   password: N0pOR9nj5t9qbtUX
--   PIN:      467672 (chosen at first unlock; the seed stores no vault data)

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-00000000f001',
  'authenticated',
  'authenticated',
  'test@fynfo.test',
  extensions.crypt('N0pOR9nj5t9qbtUX', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at,
  created_at, updated_at
) values (
  gen_random_uuid(),
  '00000000-0000-4000-8000-00000000f001',
  '00000000-0000-4000-8000-00000000f001',
  jsonb_build_object(
    'sub', '00000000-0000-4000-8000-00000000f001',
    'email', 'test@fynfo.test',
    'email_verified', true
  ),
  'email',
  now(),
  now(),
  now()
);
