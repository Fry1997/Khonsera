// Helper for client form components that call our server actions and need
// to surface field errors. Server actions return Result<T, AppError>; this
// helper extracts a top-level message + per-field messages the FormField
// components can render.

import type { AppError } from "@/lib/errors";

export type FormFeedback = {
  message: string;
  fieldErrors: Record<string, string | undefined>;
};

export function feedbackFromError(error: AppError): FormFeedback {
  switch (error.kind) {
    case "validation": {
      const fieldErrors: Record<string, string> = {};
      for (const [k, v] of Object.entries(error.fieldErrors ?? {})) {
        if (v && v.length > 0) fieldErrors[k] = v[0];
      }
      return { message: error.message, fieldErrors };
    }
    case "authz":
      return { message: "You don't have permission to do that.", fieldErrors: {} };
    case "not_found":
      return { message: `${error.entity} not found.`, fieldErrors: {} };
    case "state_transition":
      return {
        message: error.reason ?? `Cannot transition from ${error.from} to ${error.to}.`,
        fieldErrors: {},
      };
    case "integration":
      return { message: `${error.provider}: ${error.reason}`, fieldErrors: {} };
    case "conflict":
      return { message: error.message, fieldErrors: {} };
    case "unexpected":
      return { message: error.message || "Something went wrong.", fieldErrors: {} };
  }
}
