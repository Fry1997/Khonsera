// Test fixtures. Every test that needs a user calls createTestUser() which
// auto-provisions a profile + personal workspace via the auth trigger.
// Tests that need a second workspace use createTestUser() twice. Cleanup is
// best-effort via the unique test_ email prefix.

import { serviceClient } from "./supabase";

export type TestUser = {
  userId: string;
  email: string;
  password: string;
  workspaceId: string;
  accessToken: string;
  refreshToken: string;
  isStaff: boolean;
};

const TEST_PASSWORD = "Test-pass-12345!";

let counter = 0;
function uniqueEmail(): string {
  counter += 1;
  return `test_${Date.now()}_${counter}@journies.test`;
}

export async function createTestUser(
  options: { isStaff?: boolean; fullName?: string } = {},
): Promise<TestUser> {
  const admin = serviceClient();
  const email = uniqueEmail();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: options.fullName ?? "Test User" },
  });
  if (createErr || !created.user) {
    throw new Error(`createUser failed: ${createErr?.message}`);
  }
  const userId = created.user.id;

  if (options.isStaff) {
    const { error: staffErr } = await admin
      .from("profiles")
      .update({ is_staff: true })
      .eq("id", userId);
    if (staffErr) throw new Error(`set is_staff failed: ${staffErr.message}`);
  }

  // Pull the workspace the auth trigger provisioned for this user.
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("default_workspace_id")
    .eq("id", userId)
    .single();
  if (profileErr || !profile?.default_workspace_id) {
    throw new Error(
      `provisioning trigger didn't populate default_workspace_id: ${profileErr?.message}`,
    );
  }

  // Sign in to get tokens for an RLS-scoped client.
  const { data: signIn, error: signInErr } = await admin.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (signInErr || !signIn.session) {
    throw new Error(`signIn failed: ${signInErr?.message}`);
  }

  return {
    userId,
    email,
    password: TEST_PASSWORD,
    workspaceId: profile.default_workspace_id,
    accessToken: signIn.session.access_token,
    refreshToken: signIn.session.refresh_token,
    isStaff: options.isStaff ?? false,
  };
}

export async function deleteTestUser(userId: string): Promise<void> {
  const admin = serviceClient();
  await admin.auth.admin.deleteUser(userId);
}

// Best-effort cleanup. Workspaces cascade-delete from auth.users → profiles.
export async function cleanupAllTestUsers(): Promise<void> {
  const admin = serviceClient();
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (!users?.users) return;
  await Promise.all(
    users.users
      .filter((u) => u.email?.startsWith("test_") && u.email.endsWith("@journies.test"))
      .map((u) => admin.auth.admin.deleteUser(u.id)),
  );
}
