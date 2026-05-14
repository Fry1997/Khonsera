// Typed error taxonomy. Server actions return Result<T, AppError> rather than
// throwing, so callers (UI + tests) handle failures explicitly. Adding this
// later would force every server action signature to change — that's why
// it lands at Layer 2.5 before any action is written.

export type AppError =
  | { kind: "validation"; message: string; fieldErrors?: Record<string, string[]> }
  | { kind: "authz"; message: string }
  | { kind: "not_found"; entity: string; id?: string }
  | { kind: "state_transition"; from: string; to: string; reason?: string }
  | { kind: "integration"; provider: string; reason: string }
  | { kind: "conflict"; message: string }
  | { kind: "unexpected"; message: string };

export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <E extends AppError>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

export const errors = {
  validation: (
    message: string,
    fieldErrors?: Record<string, string[]>,
  ): AppError => ({ kind: "validation", message, fieldErrors }),
  authz: (message = "Not authorised"): AppError => ({ kind: "authz", message }),
  notFound: (entity: string, id?: string): AppError => ({
    kind: "not_found",
    entity,
    id,
  }),
  stateTransition: (from: string, to: string, reason?: string): AppError => ({
    kind: "state_transition",
    from,
    to,
    reason,
  }),
  integration: (provider: string, reason: string): AppError => ({
    kind: "integration",
    provider,
    reason,
  }),
  conflict: (message: string): AppError => ({ kind: "conflict", message }),
  unexpected: (message: string): AppError => ({ kind: "unexpected", message }),
} as const;

// Map a thrown error (e.g. from Postgres) to an AppError. Postgres SQLSTATE
// codes we care about:
//   42501 → authz
//   22023 → state_transition (raised by our transition functions)
//   23505 → conflict (unique violation, e.g. idempotency_key)
//   P0002 → not_found
export function fromThrown(e: unknown, fallbackEntity = "unknown"): AppError {
  const code = (e as { code?: string })?.code;
  const message = (e as { message?: string })?.message ?? "Unexpected error";
  switch (code) {
    case "42501":
      return errors.authz(message);
    case "22023":
      // Caller doesn't always know from/to; let them refine if needed.
      return errors.stateTransition("?", "?", message);
    case "23505":
      return errors.conflict(message);
    case "P0002":
      return errors.notFound(fallbackEntity);
    default:
      return errors.unexpected(message);
  }
}
