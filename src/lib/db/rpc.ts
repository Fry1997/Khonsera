// Transactional unit-of-work helper.
//
// Background: supabase-js is REST-based — every call is its own transaction.
// For multi-statement actions that need atomicity (e.g. "confirm visit"
// transitions a VisitPlan, creates a SavedTrip and a BookingIntent in one
// shot), we define a SECURITY DEFINER SQL function and call it via RPC.
//
// This module is the one place where RPC calls go through, so error mapping
// stays consistent.
//
// Naming note: the plan called this withTx(); we kept the same intent but
// chose `callRpc` because that's what's actually happening (Postgres is
// running the transaction, not us).

import { createClient } from "@/lib/supabase/server";
import {
  err,
  errors,
  fromThrown,
  ok,
  type Result,
} from "@/lib/errors";

export async function callRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  fallbackEntity = "rpc",
): Promise<Result<T>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    return err(fromThrown(error, fallbackEntity));
  }
  if (data === null || data === undefined) {
    return err(errors.notFound(fallbackEntity));
  }
  return ok(data as T);
}
