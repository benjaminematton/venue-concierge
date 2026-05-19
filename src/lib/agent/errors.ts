// Structured error shape returned by tools. The agent reads `suggested_action`
// to recover without re-prompting the user — see the eval case for
// UNKNOWN_PACKAGE: the agent should list real packages, not retry the bad ID.
//
// Errors are *context*, not exceptions: every code carries the action the
// agent should take. If you find yourself adding a code without an obvious
// suggested_action, the tool probably shouldn't return that case at all.

export type ToolErrorCode =
  | "UNKNOWN_PACKAGE"
  | "UNKNOWN_SPACE"
  | "AMBIGUOUS_SPACE"
  | "GUESTS_EXCEED_CAPACITY"
  | "INVALID_INPUT";

export interface ToolError {
  code: ToolErrorCode;
  message: string;
  suggested_action: string;
}

export type ToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ToolError };

export function ok<T>(data: T): ToolResult<T> {
  return { ok: true, data };
}

export function err(
  code: ToolErrorCode,
  message: string,
  suggested_action: string,
): ToolResult<never> {
  return { ok: false, error: { code, message, suggested_action } };
}
