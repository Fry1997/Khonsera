// Exercise the SQL transition functions and the guard trigger directly.
// These are the safety net for status correctness — every later layer
// trusts that the only way to change a status is the transition function.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  hasTestEnv,
  serviceClient,
  userClient,
} from "@/lib/testing/supabase";
import {
  cleanupAllTestUsers,
  createTestUser,
  type TestUser,
} from "@/lib/testing/seed";

describe.skipIf(!hasTestEnv())("State machines — visit_plan_transition", () => {
  let alice: TestUser;
  let bob: TestUser;
  let visitId: string;

  beforeAll(async () => {
    alice = await createTestUser({ fullName: "Alice" });
    bob = await createTestUser({ fullName: "Bob" });
  });

  beforeEach(async () => {
    const admin = serviceClient();
    const { data, error } = await admin
      .from("visit_plans")
      .insert({
        workspace_id: alice.workspaceId,
        user_id: alice.userId,
        title: "Test visit",
      })
      .select("id")
      .single();
    if (error) throw error;
    visitId = data.id;
  });

  afterAll(async () => {
    await cleanupAllTestUsers();
  });

  it("allows a legal transition draft -> checking", async () => {
    const c = userClient(alice.accessToken, alice.refreshToken);
    const { data, error } = await c.rpc("visit_plan_transition", {
      p_visit_id: visitId,
      p_to_status: "checking",
      p_actor_id: alice.userId,
    });
    expect(error).toBeNull();
    const row = Array.isArray(data) ? data[0] : data;
    expect(row.status).toBe("checking");
  });

  it("rejects an illegal transition draft -> completed with SQLSTATE 22023", async () => {
    const c = userClient(alice.accessToken, alice.refreshToken);
    const { error } = await c.rpc("visit_plan_transition", {
      p_visit_id: visitId,
      p_to_status: "completed",
      p_actor_id: alice.userId,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("22023");
  });

  it("rejects a non-member actor", async () => {
    // Bob (different workspace) cannot transition Alice's visit even with
    // his own actor_id passed in.
    const c = userClient(bob.accessToken, bob.refreshToken);
    const { error } = await c.rpc("visit_plan_transition", {
      p_visit_id: visitId,
      p_to_status: "checking",
      p_actor_id: bob.userId,
    });
    expect(error).not.toBeNull();
    // 42501 = "actor not a member of workspace" raised in the function.
    // P0002 = "visit not found" if RLS hides it entirely (also acceptable).
    expect(["42501", "P0002"]).toContain(error?.code);
  });

  it("writes an audit row on a successful transition", async () => {
    const c = userClient(alice.accessToken, alice.refreshToken);
    await c.rpc("visit_plan_transition", {
      p_visit_id: visitId,
      p_to_status: "checking",
      p_actor_id: alice.userId,
    });

    const admin = serviceClient();
    const { data: events } = await admin
      .from("audit_events")
      .select("entity_type, entity_id, action, before, after")
      .eq("entity_id", visitId)
      .order("occurred_at", { ascending: false });
    expect(events?.[0]).toMatchObject({
      entity_type: "visit_plan",
      action: "transition:checking",
    });
    expect(events?.[0].before).toMatchObject({ status: "draft" });
    expect(events?.[0].after).toMatchObject({ status: "checking" });
  });

  it("blocks a direct UPDATE to .status outside the function", async () => {
    const c = userClient(alice.accessToken, alice.refreshToken);
    const { error } = await c
      .from("visit_plans")
      .update({ status: "proposed" })
      .eq("id", visitId);
    // 42501 = "direct status update forbidden" from the guard trigger.
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("is idempotent when called with the current status", async () => {
    const c = userClient(alice.accessToken, alice.refreshToken);
    const { error } = await c.rpc("visit_plan_transition", {
      p_visit_id: visitId,
      p_to_status: "draft",
      p_actor_id: alice.userId,
    });
    expect(error).toBeNull();
  });
});
