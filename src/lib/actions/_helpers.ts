// Shared helpers used by every server action module. Every action follows the
// same contract: validate input with Zod -> auth via requireUserContext() ->
// mutate -> withAudit() -> return Result<T, AppError>.

import { z } from "zod";
import {
  err,
  errors,
  fromThrown,
  ok,
  type Result,
} from "@/lib/errors";

export function parseInput<T extends z.ZodTypeAny>(
  schema: T,
  raw: unknown,
): Result<z.infer<T>> {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);

  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join(".") || "_root";
    (fieldErrors[key] ||= []).push(issue.message);
  }
  return err(
    errors.validation(parsed.error.issues[0]?.message ?? "Invalid input", fieldErrors),
  );
}

export function dbResult<T>(
  data: T | null,
  error: { code?: string; message?: string } | null,
  entity: string,
): Result<T> {
  if (error) return err(fromThrown(error, entity));
  if (data === null || data === undefined) return err(errors.notFound(entity));
  return ok(data);
}
