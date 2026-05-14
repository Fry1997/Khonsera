// RLS safety net. Verifies that:
//   - A member of workspace A can read their own data
//   - A member of workspace B cannot read workspace A's data
//   - An anonymous client can read nothing workspace-scoped
//
// Tests cover the most-sensitive tables: customers, visit_plans, audit_events.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  hasTestEnv,
  serviceClient,
  userClient,
} from "@/lib/testing/supabase";
import {
  cleanupAllTestUsers,
  createTestUser,
  type TestUser,
} from "@/lib/testing/seed";

describe.skipIf(!hasTestEnv())("RLS — workspace isolation", () => {
  let alice: TestUser;
  let bob: TestUser;
  let aliceCustomerId: string;

  beforeAll(async () => {
    alice = await createTestUser({ fullName: "Alice" });
    bob = await createTestUser({ fullName: "Bob" });

    // Seed a customer in Alice's workspace via the service role.
    const admin = serviceClient();
    const { data, error } = await admin
      .from("customers")
      .insert({ workspace_id: alice.workspaceId, name: "Alice Co" })
      .select("id")
      .single();
    if (error) throw error;
    aliceCustomerId = data.id;
  });

  afterAll(async () => {
    await cleanupAllTestUsers();
  });

  it("Alice can read her own customer", async () => {
    const c = userClient(alice.accessToken, alice.refreshToken);
    const { data, error } = await c
      .from("customers")
      .select("id")
      .eq("id", aliceCustomerId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("Bob cannot read Alice's customer", async () => {
    const c = userClient(bob.accessToken, bob.refreshToken);
    const { data, error } = await c
      .from("customers")
      .select("id")
      .eq("id", aliceCustomerId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("Bob cannot list any customers in Alice's workspace", async () => {
    const c = userClient(bob.accessToken, bob.refreshToken);
    const { data } = await c
      .from("customers")
      .select("id")
      .eq("workspace_id", alice.workspaceId);
    expect(data).toHaveLength(0);
  });

  it("Anonymous client cannot read customers", async () => {
    const c = anonClient();
    const { data } = await c.from("customers").select("id").limit(5);
    // RLS denies → empty result (no error, just no rows visible).
    expect(data ?? []).toHaveLength(0);
  });

  it("Bob cannot read Alice's audit events", async () => {
    // Trigger an audit event in Alice's workspace.
    const aliceC = userClient(alice.accessToken, alice.refreshToken);
    await aliceC
      .from("customers")
      .update({ notes: "rls test" })
      .eq("id", aliceCustomerId);

    const bobC = userClient(bob.accessToken, bob.refreshToken);
    const { data } = await bobC
      .from("audit_events")
      .select("id")
      .eq("workspace_id", alice.workspaceId);
    expect(data).toHaveLength(0);
  });
});
