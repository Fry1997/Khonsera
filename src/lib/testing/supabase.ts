// Test-only Supabase client factories. Never imported from app code — only
// from tests under tests/integration/*.
//
// Env-gated: when SUPABASE_TEST_URL is not set, hasTestEnv() returns false
// and integration test files should describe.skipIf(!hasTestEnv()) so the
// suite is a no-op in environments without local Supabase.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type TestEnv = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

export function readTestEnv(): TestEnv | null {
  const url = process.env.SUPABASE_TEST_URL;
  const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) return null;
  return { url, anonKey, serviceRoleKey };
}

export function hasTestEnv(): boolean {
  return readTestEnv() !== null;
}

// Service-role client: bypasses RLS, used for seeding and teardown.
export function serviceClient(): SupabaseClient {
  const env = readTestEnv();
  if (!env) throw new Error("Test env not configured");
  return createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Anon client signed in as a specific test user. Use this to assert what a
// real user can/cannot see under RLS.
export function userClient(accessToken: string, refreshToken: string): SupabaseClient {
  const env = readTestEnv();
  if (!env) throw new Error("Test env not configured");
  const client = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  return client;
}

// Anon client with no session — represents an unauthenticated visitor.
export function anonClient(): SupabaseClient {
  const env = readTestEnv();
  if (!env) throw new Error("Test env not configured");
  return createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
