-- Create default admin auth user using the same approach GoTrue uses internally.
-- GoTrue expects: bcrypt cost 10, an auth.identities row, and proper metadata.

DO $$
DECLARE
  admin_user_id uuid;
  admin_email text := 'admin@nexus.edu';
  admin_password text := 'nexus2026';
  -- bcrypt hash for 'nexus2026' with cost factor 10 (GoTrue's default)
  -- Generated using: crypt('nexus2026', gen_salt('bf', 10))
  admin_hash text;
BEGIN
  -- Generate bcrypt hash with cost factor 10 to match GoTrue expectations
  admin_hash := crypt(admin_password, gen_salt('bf', 10));

  -- Delete any pre-existing admin user (and cascade identities)
  DELETE FROM auth.users WHERE email = admin_email;

  -- Generate a new UUID for the admin user
  admin_user_id := gen_random_uuid();

  -- Insert into auth.users with all fields GoTrue expects
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    phone,
    phone_confirmed_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_sso_user,
    deleted_at
  ) VALUES (
    admin_user_id,
    NULL,
    'authenticated',
    'authenticated',
    admin_email,
    admin_hash,
    now(),
    NULL,
    NULL,
    '',
    NULL,
    '',
    NULL,
    '',
    '',
    NULL,
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"name": "General Team Leader", "position": "General Team Leader", "role": "admin"}'::jsonb,
    false,
    NULL
  );

  -- Insert the matching auth.identities row (GoTrue requires this for login)
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider_id,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    admin_user_id,
    jsonb_build_object('sub', admin_user_id::text, 'email', admin_email),
    admin_user_id::text,
    'email',
    now(),
    now(),
    now()
  );

  -- Upsert the members row linked to this auth user
  INSERT INTO members (user_id, name, email, position, role, status, created_at)
  VALUES (admin_user_id, 'General Team Leader', admin_email, 'General Team Leader', 'admin', 'active', now())
  ON CONFLICT (email) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        position = EXCLUDED.position;

  RAISE NOTICE 'Admin user created with id: %', admin_user_id;
END $$;
